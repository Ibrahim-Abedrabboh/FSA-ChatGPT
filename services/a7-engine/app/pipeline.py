"""The analysis run: 03 Eye -> 05 Second count -> 06 Room reader (room photo only) -> 09 Conflict check.

Each reader is wrapped exactly like the n8n budget chain:

  Ticket   operation key from the slot (client, run, node, output 'job', counters 0)
           and requestSha256 from the node parameters, input, state and file hashes
  Reserve  POST /api/a7/budget/reserve; anything but a valid permit -> hold, nothing sent
  Reader   provider call, retried once after 5 s on error, inside the same reservation
  Receipt  usage from the provider's token counts, receiptRef, complete answer envelope
  Settle   POST /api/a7/budget/settle; anything but completed + responsePreserved -> hold

A hold never resends a paid call. The response carries only pointers into the
site's ledger; the site rebuilds the facts from the preserved answers.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from .budget import BudgetClient
from .config import Settings
from .intake import Intake
from .ledger import (
    answer_envelope,
    has_answer,
    operation_key,
    operation_slot,
    permission_granted,
    provider_usage,
    receipt_ref,
    request_sha256,
    settlement_preserved,
)
from .providers.base import Provider, ProviderError
from .readers import READERS, Reader

log = logging.getLogger("a7engine")


@dataclass
class Outcome:
    status_code: int
    body: dict[str, Any]

    @property
    def accepted(self) -> bool:
        return self.status_code == 200 and self.body.get("accepted") is True


def hold() -> Outcome:
    # Same body and status as the n8n bridge's "Bounded source receipt" for any uncertain run.
    return Outcome(409, {"http_status": 409, "error": "analysis_outcome_uncertain", "accepted": False})


class Pipeline:
    def __init__(
        self,
        settings: Settings,
        budget: BudgetClient,
        provider: Provider,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
        receipt_id: Callable[[], str] = lambda: str(uuid.uuid4()),
    ):
        self.settings = settings
        self.budget = budget
        self.provider = provider
        self.clock = clock
        self.sleep = sleep
        self.receipt_id = receipt_id

    async def run(self, intake: Intake) -> Outcome:
        p = intake.payload
        deadline = self.clock() + self.settings.run_deadline_s
        origin = self.settings.budget_origin_for(p.get("budgetOrigin"))
        answers: dict[str, Any] = {}
        readers: list[dict[str, Any]] = []
        for reader in READERS:
            if not reader.applies(intake):
                continue
            try:
                pointer, raw = await self._stage(reader, intake, answers, origin, deadline)
            except Exception:  # noqa: BLE001 - any unexpected failure is a hold, never a resend
                log.exception("stage_failed node=%s", reader.node)
                return hold()
            if pointer is None:
                return hold()
            readers.append(pointer)
            answers[reader.node] = raw
        if not 3 <= len(readers) <= 4:
            return hold()
        return Outcome(200, {
            "http_status": 200,
            "accepted": True,
            "receiptId": self.receipt_id(),
            "draftId": p["draftId"],
            "clientRunId": p["clientRunId"],
            "runId": p["runId"],
            "sourceSha256": p["sourceSha256"],
            "referenceFingerprint": p["referenceFingerprint"],
            "roomSha256": p.get("roomSha256") or None,
            "intentFingerprint": p["intentFingerprint"],
            "readers": readers,
        })

    def ticket(self, reader: Reader, intake: Intake, answers: dict[str, Any]) -> dict[str, Any]:
        state = reader.state(intake, answers)
        slot = operation_slot(state, reader.node, state)
        return {
            "clientId": state["client_run_id"],
            "runId": state["run_id"],
            "operationKey": operation_key(slot),
            "node": reader.node,
            "model": reader.budget_model,
            "outputId": slot["output"],
            "inputTokens": reader.input_tokens,
            "outputTokens": reader.output_tokens,
            "requestSha256": request_sha256(reader.n8n_parameters, state, state, intake.binary_hashes),
        }

    async def _stage(self, reader: Reader, intake: Intake, answers: dict[str, Any], origin: str, deadline: float):
        ticket = self.ticket(reader, intake, answers)
        remaining = deadline - self.clock()
        if remaining <= 0 or remaining < self.settings.min_stage_s:
            # Do not reserve money for a call that has no time left to finish.
            log.info("hold node=%s reason=deadline_before_reserve", reader.node)
            return None, None
        reserved = await self.budget.reserve(origin, ticket)
        if not permission_granted(reserved.status_code, reserved.body):
            reason = reserved.body.get("reason") if isinstance(reserved.body, dict) else None
            log.info("hold node=%s reason=no_permit status=%s detail=%s", reader.node, reserved.status_code, reason)
            return None, None
        permit = reserved.body["permit"]
        raw = await self._call_provider(reader, intake, answers, deadline)
        usage = provider_usage(raw, reader.kind)
        envelope = answer_envelope(raw)
        settle_request: dict[str, Any] = {
            "clientId": ticket["clientId"],
            "operationKey": ticket["operationKey"],
            "permit": permit,
            "usage": usage,
            "receiptRef": receipt_ref(raw),
            "checkpointRequired": bool(usage),
        }
        if has_answer(envelope):
            settle_request["completeAnswer"] = envelope
        # Money is reserved: settle even if the run deadline has passed.
        settled = await self.budget.settle(origin, settle_request)
        if not settlement_preserved(settled.status_code, settled.body):
            log.info("hold node=%s reason=settlement_uncertain status=%s", reader.node, settled.status_code)
            return None, None
        log.info("completed node=%s", reader.node)
        return {"node": reader.node, "status": "completed", "operationKey": ticket["operationKey"], "receiptRef": settle_request["receiptRef"]}, raw

    async def _call_provider(self, reader: Reader, intake: Intake, answers: dict[str, Any], deadline: float) -> dict[str, Any]:
        request = reader.build(intake, answers)
        attempts = 1 + self.settings.reader_retries
        reason = "provider_failed"
        for attempt in range(attempts):
            remaining = deadline - self.clock()
            if remaining <= 0:
                reason = "deadline"
                break
            try:
                return await self.provider.call(request, min(self.settings.provider_timeout_s, remaining))
            except ProviderError as error:
                reason = error.reason
            except Exception:  # noqa: BLE001
                log.exception("provider_crashed node=%s", reader.node)
                reason = "provider_failed"
            log.info("provider_error node=%s attempt=%d reason=%s", reader.node, attempt + 1, reason)
            if attempt + 1 < attempts:
                if deadline - self.clock() <= self.settings.reader_retry_delay_s:
                    break
                await self.sleep(self.settings.reader_retry_delay_s)
        # Shape of n8n's continue-on-error output: the settle records it as uncertain.
        return {"error": reason}
