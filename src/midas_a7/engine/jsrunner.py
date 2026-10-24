"""Client for the Node sidecar (js/runner.mjs) that runs Code-node logic and ={{ }} expressions."""

from __future__ import annotations

import asyncio
import itertools
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Awaitable, Callable

log = logging.getLogger(__name__)

# An engine helper a Code node may call while it runs (Phase 1.6): it gets the request's payload and returns plain JSON data.
Callback = Callable[[dict[str, Any]], Awaitable[Any]]

RUNNER = Path(__file__).with_name("js") / "runner.mjs"
_LINE_LIMIT = 1 << 30  # replies can carry large binaries as base64


class JsError(Exception):
    """Raised when the code or expression throws inside the sidecar."""

    def __init__(self, message: str, name: str = "Error", stack: str = ""):
        super().__init__(message)
        self.name = name
        self.stack = stack


class JsRunner:
    def __init__(self, node_bin: str | None = None, timeout_s: float = 300.0):
        self._node = node_bin or os.environ.get("MIDAS_NODE_BIN") or shutil.which("node") or "node"
        self._timeout = timeout_s
        self._proc: asyncio.subprocess.Process | None = None
        self._pending: dict[int, asyncio.Future] = {}
        self._callbacks: dict[int, dict[str, Callback]] = {}
        self._tasks: set[asyncio.Task] = set()
        self._ids = itertools.count(1)
        self._write_lock = asyncio.Lock()
        self._start_lock = asyncio.Lock()
        self._reader: asyncio.Task | None = None
        self._stderr: asyncio.Task | None = None

    async def _ensure(self) -> None:
        async with self._start_lock:
            if self._proc and self._proc.returncode is None:
                return
            self._proc = await asyncio.create_subprocess_exec(
                self._node, str(RUNNER),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                limit=_LINE_LIMIT, cwd=str(RUNNER.parent),
            )
            self._reader = asyncio.create_task(self._read_loop(self._proc))
            self._stderr = asyncio.create_task(self._stderr_loop(self._proc))

    async def _read_loop(self, proc: asyncio.subprocess.Process) -> None:
        assert proc.stdout
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                log.error("js runner sent a line that is not JSON")
                continue
            if "callback" in msg:
                # The running code asks the engine for a helper (e.g. resizing a reference photo); its reply goes back on stdin.
                # The reply goes back to this process only: after a restart the new runner numbers its callbacks from 1
                # again, so a late answer sent to it could resolve another run's request.
                task = asyncio.create_task(self._answer_callback(msg, proc))
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)
                continue
            fut = self._pending.pop(msg.get("id"), None)
            if fut and not fut.done():
                fut.set_result(msg)
        err = JsError("js runner stopped")
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(err)
        self._pending.clear()

    async def _stderr_loop(self, proc: asyncio.subprocess.Process) -> None:
        assert proc.stderr
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            log.info("js: %s", line.decode(errors="replace").rstrip())

    async def _send(self, message: dict[str, Any], proc: asyncio.subprocess.Process | None = None) -> None:
        proc = proc or self._proc
        if not proc or not proc.stdin or proc is not self._proc:
            raise JsError("js runner stopped")
        data = json.dumps(message, ensure_ascii=False, separators=(",", ":"))
        async with self._write_lock:
            proc.stdin.write(data.encode() + b"\n")
            await proc.stdin.drain()

    async def _answer_callback(self, msg: dict[str, Any], proc: asyncio.subprocess.Process) -> None:
        """Run the engine helper a Code node asked for and send its answer back (the node's promise resolves or rejects)."""
        op = str(msg.get("op") or "")
        fn = self._callbacks.get(msg.get("id"), {}).get(op)
        reply: dict[str, Any] = {"op": "callbackResult", "callback": msg.get("callback")}
        if fn is None:
            reply.update(ok=False, error={"message": f"the engine helper {op!r} is not available to this node"})
        else:
            try:
                reply.update(ok=True, result=await fn(msg.get("payload") or {}))
            except Exception as exc:  # the node decides what a failed helper means
                log.warning("engine helper %s failed: %s", op, exc)
                reply.update(ok=False, error={"message": str(exc) or exc.__class__.__name__})
        try:
            await self._send(reply, proc)
        except (JsError, OSError, ConnectionError):
            pass  # the runner stopped; the call that asked fails on its own

    async def call(self, op: str, callbacks: dict[str, Callback] | None = None, **payload: Any) -> Any:
        """Send one request. `callbacks` are the engine helpers the code may call while this request runs."""
        await self._ensure()
        assert self._proc and self._proc.stdin
        rid = next(self._ids)
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[rid] = fut
        if callbacks:
            self._callbacks[rid] = callbacks
        try:
            await self._send({"id": rid, "op": op, **payload})
            msg = await asyncio.wait_for(fut, self._timeout)
        except asyncio.TimeoutError:
            self._pending.pop(rid, None)
            await self.close()  # a stuck script must not block later work
            raise JsError(f"Code ran longer than {self._timeout:.0f} s and was stopped")
        finally:
            self._callbacks.pop(rid, None)
        if not msg.get("ok"):
            e = msg.get("error") or {}
            raise JsError(e.get("message", "unknown error"), e.get("name", "Error"), e.get("stack", ""))
        return msg["result"]

    async def close(self) -> None:
        proc, self._proc = self._proc, None
        if proc and proc.returncode is None:
            proc.kill()
            await proc.wait()
        for task in (self._reader, self._stderr):
            if task:
                task.cancel()
