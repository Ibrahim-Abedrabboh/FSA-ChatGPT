"""Per-process protection against duplicate runs.

The site's ledger already makes a second payment for the same draft impossible:
every reader's operation key depends only on the draft and node, so a repeated
reservation is refused (``operation_already_exists``) and the run holds. This layer
makes retries cheaper and clearer:

* the same ``requestId`` (and intent) while a run is in progress waits for that run;
* a different request for the same draft while one is in progress holds at once,
  with no budget call;
* a completed run for the same ``requestId`` (and intent) is answered again from
  memory, with no budget or provider call.

The memory is per process. With more than one replica, the ledger remains the guard.
"""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from typing import Awaitable, Callable

from .intake import Intake
from .pipeline import Outcome, hold


class RequestRegistry:
    def __init__(self, ttl_s: float = 3600.0, max_entries: int = 1000, clock: Callable[[], float] = time.monotonic):
        self.ttl_s = ttl_s
        self.max_entries = max_entries
        self.clock = clock
        self._inflight: dict[str, tuple[tuple[str, str], asyncio.Task[Outcome]]] = {}
        self._done: OrderedDict[tuple[str, str], tuple[float, Outcome]] = OrderedDict()

    def _cached(self, key: tuple[str, str]) -> Outcome | None:
        entry = self._done.get(key)
        if entry is None:
            return None
        if entry[0] < self.clock():
            self._done.pop(key, None)
            return None
        return entry[1]

    async def run(self, intake: Intake, start: Callable[[], Awaitable[Outcome]]) -> Outcome:
        key = (intake.payload["requestId"], intake.payload["intentFingerprint"])
        cached = self._cached(key)
        if cached is not None:
            return cached
        client = intake.client_run_id
        running = self._inflight.get(client)
        if running is not None:
            if running[0] == key:
                return await asyncio.shield(running[1])
            return hold()
        task: asyncio.Task[Outcome] = asyncio.ensure_future(start())
        self._inflight[client] = (key, task)

        def finished(t: asyncio.Task[Outcome]) -> None:
            if self._inflight.get(client, (None, None))[1] is t:
                self._inflight.pop(client, None)
            if t.cancelled() or t.exception() is not None:
                return
            outcome = t.result()
            if outcome.accepted:
                self._done[key] = (self.clock() + self.ttl_s, outcome)
                while len(self._done) > self.max_entries:
                    self._done.popitem(last=False)

        task.add_done_callback(finished)
        # Shielded: a client that disconnects (or a gateway timeout) does not cancel a run
        # that may hold a reservation; it finishes and settles in the background.
        return await asyncio.shield(task)
