"""Starts, parks and resumes runs, and keeps the saved state of parked runs.

Like the n8n settings of these flows (saveDataSuccessExecution / saveDataErrorExecution = none),
a finished run keeps only its status and, on failure, the failing node and message. A parked run
(waiting for go 1 / go 2) keeps its full state until it continues.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from .engine.executor import Execution, Executor, Response
from .engine.model import Flow, Item, NodeDef
from .engine.services import Services

log = logging.getLogger(__name__)

REDACTED_HEADERS = {"authorization", "x-midas-key", "x-midas-owner-key", "cookie", "proxy-authorization"}


class Runtime:
    def __init__(self, services: Services, executor: Executor, flows: dict[str, Flow]):
        self.services = services
        self.executor = executor
        self.flows = flows  # by flow id
        self._tasks: set[asyncio.Task] = set()
        self._resume_secret = services.settings.resume_secret or secrets.token_hex(32)
        if not services.settings.resume_secret:
            links = "resume links" if services.settings.file_link_secret else "resume and file links"
            log.warning("RESUME_SIGNING_SECRET is not set: %s stop working after a restart", links)
        services.extra["signing_secret"] = self._resume_secret
        # File links (BE-6, PR A): signed with FILE_LINK_SECRET once it is set, so rotating either secret leaves the other's
        # links working. Links signed before it was set (with the resume secret) are still accepted.
        file_secret = services.settings.file_link_secret
        services.extra["file_link_secret"] = file_secret or self._resume_secret
        services.extra["file_link_secrets_accepted"] = [file_secret, self._resume_secret] if file_secret else [self._resume_secret]
        for header_name in self._inbound_header_names():
            REDACTED_HEADERS.add(header_name.lower())

    def _inbound_header_names(self) -> set[str]:
        from .config import HEADER_CREDENTIALS, _env
        return {_env(h_env, default) for h_env, default, _ in HEADER_CREDENTIALS.values()}

    # ---------- resume links ----------
    def signature(self, execution_id: str) -> str:
        return hmac.new(self._resume_secret.encode(), f"resume:{execution_id}".encode(), hashlib.sha256).hexdigest()

    def resume_url(self, execution_id: str) -> str:
        return f"{self.services.settings.public_base_url}/webhook-waiting/{execution_id}?signature={self.signature(execution_id)}"

    def signature_ok(self, execution_id: str, signature: str) -> bool:
        return hmac.compare_digest(self.signature(execution_id), signature or "")

    # ---------- starting runs ----------
    async def run_trigger(self, flow: Flow, trigger: NodeDef, items: list[Item], wait_for_response: bool,
                          timeout_s: float = 600.0,
                          files: list[tuple[str, bytes, str | None, str | None]] | None = None) -> Response | None:
        """Start a run. `files` (field name, bytes, mime, file name) become the first item's binaries."""
        execution_id = await asyncio.to_thread(self.services.store.create_execution, flow.id)
        if files:
            binary: dict[str, Any] = dict(items[0].get("binary") or {})
            for name, data, mime, filename in files:
                binary[name] = await self.services.binaries.put(execution_id, data, mime, filename)
            items = [{**items[0], "binary": binary}, *items[1:]]
        execution = Execution(id=execution_id, flow_id=flow.id)
        execution.resume_url = self.resume_url(execution_id)
        loop = asyncio.get_running_loop()
        if wait_for_response:
            execution.responder = loop.create_future()
        task = asyncio.create_task(self._drive(flow, execution, trigger, items))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        if not wait_for_response:
            return None
        assert execution.responder is not None
        done, _ = await asyncio.wait({execution.responder, task}, timeout=timeout_s, return_when=asyncio.FIRST_COMPLETED)
        if execution.responder in done:
            return execution.responder.result()
        if task in done:
            if execution.status == "error":
                return Response(status=500, body={"code": 0, "message": "Error in workflow"})
            return Response(status=200, body={"message": "Workflow executed successfully"})
        return Response(status=504, body={"message": "Workflow did not respond in time"})

    async def _drive(self, flow: Flow, execution: Execution, trigger: NodeDef, items: list[Item]) -> None:
        try:
            await self.executor.start(flow, execution, trigger, items)
        except Exception as exc:  # engine faults must not leave the run marked as running
            log.exception("run %s failed in the engine", execution.id)
            execution.status = "error"
            execution.error = {"node": execution.last_node, "message": f"engine error: {exc}"}
            self.executor._fail_responder(execution)
        await self._persist(execution, flow)

    async def _persist(self, execution: Execution, flow: Flow | None = None) -> None:
        store = self.services.store
        if execution.status == "waiting":
            wait = execution.wait or {}
            till = datetime.fromisoformat(wait["till"]) if wait.get("till") else None
            await asyncio.to_thread(store.save_execution, execution.id, "waiting", execution.to_state(), till, wait.get("kind"))
            return
        error = None
        if execution.status == "error" and execution.error:
            error = {"node": execution.error.get("node"), "message": str(execution.error.get("message"))[:2000]}
            hold = (flow.settings.get("holdOnError") if flow else None) or None
            if hold:
                await self._hold_on_error(flow, execution, hold)
        await asyncio.to_thread(store.save_execution, execution.id, execution.status, None, None, None, error)
        await asyncio.to_thread(store.delete_binaries, execution.id)

    # ---------- a run that ends in an error (Phase 1.1, FL-1) ----------
    async def _hold_on_error(self, flow: Flow, execution: Execution, setting: dict[str, Any]) -> None:
        """Record a run that ended in an error as a hold on its row in the runs table the site reads, naming the step.

        Set per flow (settings.holdOnError = {"runsTable": <data table id>}). Only the row this execution wrote (its
        execution_id) is changed: an execution that only read another run's row (a recovery or decision webhook) never
        touches it. A row at an open gate (awaiting_*) or already on hold is left as it is. Nothing is resumed or resent;
        if no row is found or the update fails, the failure is logged and /status still lists it."""
        table = setting.get("runsTable") if isinstance(setting, dict) else None
        if not table:
            return
        store = self.services.store
        node = str((execution.error or {}).get("node") or "an unknown step")
        reason = f"Stopped at {node}: {_short_reason((execution.error or {}).get('message'))}"
        try:
            rows = await asyncio.to_thread(store.dt_select, table, {"execution_id": str(execution.id)})
            if len(rows) != 1:
                log.warning("hold on error: %s run rows found, nothing recorded [run %s, %s]", len(rows), execution.id, flow.name)
                return
            row = rows[0]
            status = str(row.get("status") or "")
            if status == "hold" or status.startswith("awaiting_"):  # the flow's own hold, or a gate the owner still decides
                log.warning("hold on error: run row %s left as %s [run %s, %s]", row["id"], status, execution.id, flow.name)
                return
            trail = _trail_with(row.get("trail"), node, reason)
            await asyncio.to_thread(store.dt_update, table, [row["id"]], {
                "status": "hold", "hold_reason": reason, "trail": trail,
                "client_question": "A step stopped unexpectedly. Check the run before anything else; nothing is resent automatically."})
            log.warning("hold on error: run row %s set to hold at %s [run %s, %s]", row["id"], node, execution.id, flow.name)
        except Exception as exc:  # recording the hold must never hide the original failure
            log.warning("hold on error: the run row could not be updated (%s) [run %s, %s]", exc.__class__.__name__, execution.id, flow.name)

    # ---------- resuming parked runs ----------
    async def resume_from_webhook(self, execution_id: str, item: Item) -> tuple[int, dict[str, Any]]:
        row = await asyncio.to_thread(self.services.store.load_execution, execution_id)
        if not row:
            return 404, {"code": 404, "message": f"The execution \"{execution_id}\" does not exist."}
        if row["status"] != "waiting" or row.get("wait_kind") != "webhook":
            return 409, {"code": 409, "message": f"The execution \"{execution_id}\" is not waiting."}
        claimed = await asyncio.to_thread(self.services.store.claim_waiting, execution_id)
        if not claimed:
            return 409, {"code": 409, "message": f"The execution \"{execution_id}\" is not waiting."}
        self._spawn_resume(claimed, [item])
        return 200, {"message": "Workflow was started"}

    async def resume_due(self) -> int:
        """Continue runs whose wait time is over: the Wait node passes its input on (go 1 / go 2 timeouts, long timers)."""
        due = await asyncio.to_thread(self.services.store.due_waits, datetime.now(timezone.utc))
        n = 0
        for execution_id in due:
            claimed = await asyncio.to_thread(self.services.store.claim_waiting, execution_id)
            if not claimed:
                continue
            state = claimed["state"] or {}
            node = (state.get("wait") or {}).get("node")
            runs = (state.get("run_data") or {}).get(node) or []
            passthrough = ((runs[-1].get("data") or [[]])[0]) if runs else []
            self._spawn_resume(claimed, passthrough)
            n += 1
        return n

    def _spawn_resume(self, row: dict[str, Any], output: list[Item]) -> None:
        state = row["state"]
        flow = self.flows[state["flow_id"]]
        execution = Execution.from_state(state)
        execution.resume_url = self.resume_url(execution.id)

        async def go() -> None:
            try:
                await self.executor.resume(flow, execution, output)
            except Exception as exc:
                log.exception("resumed run %s failed in the engine", execution.id)
                execution.status = "error"
                execution.error = {"node": execution.last_node, "message": f"engine error: {exc}"}
            await self._persist(execution, flow)

        task = asyncio.create_task(go())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def drain(self, timeout_s: float = 30.0) -> None:
        """Wait until no run is active, including runs started or resumed while waiting."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_s
        while self._tasks:
            remaining = deadline - loop.time()
            if remaining <= 0:
                return
            await asyncio.wait(set(self._tasks), timeout=remaining)
            await asyncio.sleep(0)  # let done-callbacks remove finished tasks


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    return {k: ("<redacted>" if k.lower() in REDACTED_HEADERS else v) for k, v in headers.items()}


_LINK = re.compile(r"https?://\S+", re.IGNORECASE)
# Credentials that can appear in an error's own words (provider messages, headers), beyond query strings.
_SECRET = re.compile(r"(?i)\bbearer\s+\S+|\bsk-[\w-]{6,}|\bAIza[\w-]{10,}|\bgh[pousr]_\w{10,}|"
                     r"\b((?:x-[\w-]*key|api[_-]?key|key|token|secret|password|authorization)\s*[:=]\s*)\S+")


def _short_reason(message: Any) -> str:
    """The first line of an error message, without links or query secrets, cut short for the site."""
    from .cli import _RedactSecrets
    text = str(message or "no reason recorded").strip().splitlines()[0] if str(message or "").strip() else "no reason recorded"
    text = _RedactSecrets.redact(_LINK.sub("[link]", text))
    text = _SECRET.sub(lambda m: (m.group(1) or "") + "<redacted>", text)
    return text[:160] + ("…" if len(text) > 160 else "")


def _trail_with(trail: Any, node: str, reason: str) -> str:
    """The row's trail (a JSON list) with one more entry for the stop; an unreadable trail is replaced by that entry."""
    try:
        entries = json.loads(trail) if isinstance(trail, str) and trail else (trail or [])
        if not isinstance(entries, list):
            entries = []
    except ValueError:
        entries = []
    step = int(m.group(1)) if (m := re.search(r"(?:^|·\s*)(\d+)", node)) else 0
    entries.append({"step": step, "name": "Stopped", "note": reason, "at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")})
    return json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
