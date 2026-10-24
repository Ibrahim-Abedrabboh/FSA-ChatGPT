"""Runs a flow the way n8n's v1 execution order does.

The order matters because Code nodes read other nodes' latest output with $('Name'):
- depth first: after a node runs, its children go to the front of the stack, top-most first
  (then left-most), so one branch finishes before the next starts;
- a node with several inputs (Merge) waits until every input has data, or until nothing else
  is left to run;
- a node only runs when it receives at least one item;
- `alwaysOutputData` turns an empty first output into one empty item, `executeOnce` keeps only
  the first input item, `retryOnFail` re-runs a node that throws, and `onError` decides whether
  a failure stops the run or passes on.
A Wait node parks the run: its state is saved and it resumes later from the resume URL or a timer.
One deliberate exception (owner, 20 Oct 2026): a node listed in the flow's settings.parallelFanOut starts its
branches at the same time (see _run_parallel and Flow.parallel_regions).
"""

from __future__ import annotations

import asyncio
import copy
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from .model import Flow, Item, NodeDef

log = logging.getLogger(__name__)


class NodeError(Exception):
    """A node failed. `description` and `http_code` mirror n8n's NodeApiError fields."""

    def __init__(self, message: str, description: str | None = None, http_code: str | None = None):
        super().__init__(message)
        self.description = description
        self.http_code = http_code


def describe_failure(message: str, description: str | None = None, http_code: str | None = None) -> str:
    """One log line for a failed call: n8n's message, the status, then the provider's own words (never the request)."""
    text = message
    if http_code:
        text += f" [{http_code}]"
    if description and description != message:
        text += f": {description[:300]}"
    return text


def describe_error(exc: BaseException) -> str:
    message = str(exc) or exc.__class__.__name__
    if isinstance(exc, NodeError):
        return describe_failure(message, exc.description, exc.http_code)
    return message


@dataclass
class WaitRequest:
    """Returned by a Wait node: park the run until resumed (webhook) or until the time passes."""

    kind: str  # "webhook" | "time"
    till: datetime | None
    passthrough: list[Item]


@dataclass
class Response:
    status: int = 200
    body: Any = None
    headers: dict[str, str] = field(default_factory=dict)
    raw: bytes | None = None
    content_type: str | None = None


NodeOutput = list[list[Item]]
Handler = Callable[["NodeContext"], Awaitable["NodeOutput | WaitRequest"]]


@dataclass
class Execution:
    """Everything needed to continue a run; saved as JSON while the run waits."""

    id: str
    flow_id: str
    mode: str = "production"
    status: str = "new"
    started_at: float = field(default_factory=time.time)
    stack: list[dict[str, Any]] = field(default_factory=list)
    waiting: dict[str, list[list[list[Item] | None]]] = field(default_factory=dict)
    run_data: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    last_node: str | None = None
    error: dict[str, Any] | None = None
    wait: dict[str, Any] | None = None
    resume_url: str = ""
    # Set while a webhook caller is waiting for a "Respond to Webhook" node.
    responder: asyncio.Future | None = None

    def to_state(self) -> dict[str, Any]:
        return {
            "id": self.id, "flow_id": self.flow_id, "mode": self.mode, "status": self.status,
            "started_at": self.started_at, "stack": self.stack, "waiting": self.waiting,
            "run_data": self.run_data, "last_node": self.last_node, "error": self.error,
            "wait": self.wait, "resume_url": self.resume_url,
        }

    @classmethod
    def from_state(cls, state: dict[str, Any]) -> "Execution":
        ex = cls(id=state["id"], flow_id=state["flow_id"])
        for k in ("mode", "status", "started_at", "stack", "waiting", "run_data", "last_node", "error", "wait", "resume_url"):
            if k in state:
                setattr(ex, k, state[k])
        return ex

    def latest_output(self, name: str, output: int = 0) -> list[Item] | None:
        runs = self.run_data.get(name)
        if not runs:
            return None
        data = runs[-1].get("data") or []
        return data[output] if output < len(data) and data[output] is not None else []

    def run_index(self, name: str) -> int:
        return len(self.run_data.get(name, []))


class Executor:
    """Runs flows. `handlers` maps a node kind (e.g. 'code') to its async handler."""

    def __init__(self, services: Any, handlers: dict[str, Handler]):
        self.services = services
        self.handlers = handlers

    # ---------- public entry points ----------
    async def start(self, flow: Flow, execution: Execution, trigger: NodeDef, items: list[Item]) -> Execution:
        execution.status = "running"
        self._record(execution, trigger.name, [items], source=None)
        self._schedule_children(flow, execution, trigger.name, [items])
        await self._loop(flow, execution)
        return execution

    async def resume(self, flow: Flow, execution: Execution, output: list[Item]) -> Execution:
        """Continue a parked run: the Wait node outputs `output` (the resume request, or its input on timeout)."""
        wait = execution.wait or {}
        node_name = wait.get("node")
        if not node_name:
            raise RuntimeError("execution is not waiting")
        execution.status = "running"
        execution.wait = None
        runs = execution.run_data.setdefault(node_name, [])
        if runs and runs[-1].get("status") == "waiting":
            runs[-1].update({"status": "success", "data": [output]})
        else:
            runs.append({"status": "success", "data": [output], "start": time.time()})
        self._schedule_children(flow, execution, node_name, [output])
        await self._loop(flow, execution)
        return execution

    # ---------- main loop ----------
    async def _loop(self, flow: Flow, execution: Execution) -> None:
        if await self._drain(flow, execution, execution.stack) == "done":
            execution.status = "success"

    async def _drain(self, flow: Flow, execution: Execution, stack: list[dict[str, Any]],
                     region: frozenset[str] | None = None, deferred: list[tuple] | None = None) -> str:
        """Run nodes from `stack` until it is empty: "done", "error" or "waiting".

        In a parallel branch (`region` set) a child outside the region is not run but put in `deferred`, and
        an empty stack ends the branch instead of releasing a waiting Merge.
        """
        while True:
            if not stack:
                if region is not None or not self._release_partial_merge(flow, execution):
                    return "done"
            entry = stack.pop(0)
            node = flow.nodes[entry["node"]]
            inputs: list[list[Item]] = entry["inputs"]
            if node.disabled:
                out = [inputs[0] if inputs else []]
                self._record(execution, node.name, out, source=entry.get("source"))
                self._schedule_children(flow, execution, node.name, out, stack, region, deferred)
                continue
            if node.execute_once:
                inputs = [i[:1] for i in inputs]
            execution.last_node = node.name
            try:
                result = await self._run_node(flow, execution, node, inputs)
            except NodeError as exc:
                log.warning("node %s failed; the run %s: %s [run %s, %s]", node.name, "continues" if node.continue_on_fail else "stops",
                            describe_error(exc), execution.id, flow.name)
                if node.continue_on_fail:
                    # n8n passes the input on when a node throws and the node is set to continue.
                    out = [list(inputs[0]) if inputs else []]
                    self._record(execution, node.name, out, source=entry.get("source"), error=str(exc))
                    self._schedule_children(flow, execution, node.name, out, stack, region, deferred)
                    continue
                self._record(execution, node.name, None, source=entry.get("source"), error=str(exc))
                execution.status = "error"
                if execution.error is None:  # in parallel branches the first failure is the one reported
                    execution.error = {"node": node.name, "message": str(exc), "description": exc.description}
                self._fail_responder(execution)
                return "error"
            if isinstance(result, WaitRequest):
                if result.kind == "time" and result.till is not None:
                    delay = (result.till - datetime.now(timezone.utc)).total_seconds()
                    if delay <= 65:
                        await asyncio.sleep(max(0.0, delay))
                        out = [result.passthrough]
                        self._record(execution, node.name, out, source=entry.get("source"))
                        self._schedule_children(flow, execution, node.name, out, stack, region, deferred)
                        continue
                if region is not None:  # regions never hold a Wait node (model.parallel_regions)
                    raise RuntimeError(f"{node.name} cannot park the run inside a parallel branch")
                execution.run_data.setdefault(node.name, []).append(
                    {"status": "waiting", "data": [result.passthrough], "start": time.time(), "source": entry.get("source")})
                execution.status = "waiting"
                execution.wait = {
                    "node": node.name, "kind": result.kind,
                    "till": result.till.isoformat() if result.till else None,
                }
                return "waiting"
            out = result
            if node.always_output_data and (not out or not out[0]):
                out = list(out) if out else [[]]
                out[0] = [{"json": {}}]
            self._record(execution, node.name, out, source=entry.get("source"))
            if region is None and node.name in flow.parallel_regions:
                if not await self._run_parallel(flow, execution, node.name, out):
                    return "error"
                continue
            self._schedule_children(flow, execution, node.name, out, stack, region, deferred)

    async def _run_parallel(self, flow: Flow, execution: Execution, name: str, out: NodeOutput) -> bool:
        """settings.parallelFanOut: the branches of `name` run at the same time (model.parallel_regions).

        Each branch runs in n8n's order inside itself. What a branch passes out of its region (a Merge, a node
        reached from elsewhere) waits and joins the normal order once every branch has finished, branch by
        branch, top-most first. A failing branch does not stop the others: each finishes its paid call and its
        budget settlement, and the run then stops with the first failure.
        """
        regions = flow.parallel_regions[name]
        heads: list[tuple[NodeDef, int, int]] = []
        for oi, items in enumerate(out):
            if items:
                heads.extend((flow.nodes[c], oi, ii) for c, ii in flow.children(name, oi))
        branches = [h for h in heads if h[0].name in regions]
        if len(branches) < 2:
            self._schedule_children(flow, execution, name, out)
            return True
        heads.sort(key=lambda t: (t[0].position[1], t[0].position[0]))
        deferred: dict[str, list[tuple]] = {child.name: [] for child, _, _ in branches}

        async def branch(child: NodeDef, oi: int) -> str:
            stack = [{"node": child.name, "inputs": [copy.deepcopy(out[oi])], "source": {"node": name, "output": oi}}]
            return await self._drain(flow, execution, stack, regions[child.name], deferred[child.name])

        results = await asyncio.gather(*(branch(child, oi) for child, oi, _ in heads if child.name in regions))
        if "error" in results:
            return False
        later: list[tuple] = []
        for child, oi, ii in heads:
            if child.name in regions:
                later.extend(deferred[child.name])
            else:
                later.append((child.name, ii, copy.deepcopy(out[oi]), {"node": name, "output": oi}))
        for target, ii, items, source in reversed(later):
            self._add(flow, execution, target, ii, items, source)
        return True

    async def _run_node(self, flow: Flow, execution: Execution, node: NodeDef, inputs: list[list[Item]]):
        handler = self.handlers.get(node.kind)
        if handler is None:
            raise NodeError(f"Node type '{node.type}' is not supported by this engine")
        tries, wait_ms = retry_params(node)
        last: NodeError | None = None
        for attempt in range(tries):
            if attempt and wait_ms:
                await retry_pause(wait_ms / 1000.0)
            ctx = NodeContext(self, flow, execution, node, inputs)
            try:
                result = await handler(ctx)
            except NodeError as exc:
                last = exc
                if attempt < tries - 1:
                    log.warning("node %s failed (attempt %d of %d, retrying): %s [run %s, %s]", node.name, attempt + 1, tries,
                                describe_error(exc), execution.id, flow.name)
                continue
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # unexpected failures behave like node errors
                log.exception("node %s failed [run %s, %s]", node.name, execution.id, flow.name)
                last = NodeError(str(exc) or exc.__class__.__name__)
                continue
            # n8n also retries a node that returns an error item (continue-on-fail), not only one that throws.
            if isinstance(result, WaitRequest) or attempt == tries - 1 or not _first_item_failed(result):
                return result
            log.warning("node %s returned an error item (attempt %d of %d, retrying) [run %s, %s]", node.name, attempt + 1, tries,
                        execution.id, flow.name)
        assert last is not None
        raise last

    # ---------- bookkeeping ----------
    def _record(self, execution: Execution, name: str, out: NodeOutput | None, source: Any, error: str | None = None) -> None:
        run: dict[str, Any] = {"status": "error" if error and out is None else "success", "data": out, "start": time.time(), "source": source}
        if error:
            run["error"] = error
        execution.run_data.setdefault(name, []).append(run)

    def _schedule_children(self, flow: Flow, execution: Execution, name: str, out: NodeOutput,
                           stack: list[dict[str, Any]] | None = None, region: frozenset[str] | None = None,
                           deferred: list[tuple] | None = None) -> None:
        to_add: list[tuple[NodeDef, int, int]] = []
        for oi, items in enumerate(out):
            if not items:
                continue
            for child, ii in flow.children(name, oi):
                to_add.append((flow.nodes[child], oi, ii))
        # Top-most first, then left-most; added in reverse to the front of the stack.
        to_add.sort(key=lambda t: (t[0].position[1], t[0].position[0]))
        if region is not None and deferred is not None:
            for child, oi, ii in to_add:
                if child.name not in region:
                    deferred.append((child.name, ii, copy.deepcopy(out[oi]), {"node": name, "output": oi}))
            to_add = [t for t in to_add if t[0].name in region]
        for child, oi, ii in reversed(to_add):
            self._add(flow, execution, child.name, ii, copy.deepcopy(out[oi]), {"node": name, "output": oi}, stack)

    def _add(self, flow: Flow, execution: Execution, name: str, input_index: int, items: list[Item], source: dict,
             stack: list[dict[str, Any]] | None = None) -> None:
        n_inputs = flow.input_count(name)
        if n_inputs <= 1:
            (execution.stack if stack is None else stack).insert(0, {"node": name, "inputs": [items], "source": source})
            return
        rounds = execution.waiting.setdefault(name, [])
        slot = next((r for r in rounds if r[input_index] is None), None)
        if slot is None:
            slot = [None] * n_inputs
            rounds.append(slot)
        slot[input_index] = items
        if all(s is not None for s in slot):
            rounds.remove(slot)
            if not rounds:
                execution.waiting.pop(name, None)
            execution.stack.insert(0, {"node": name, "inputs": [s or [] for s in slot], "source": source})

    def _release_partial_merge(self, flow: Flow, execution: Execution) -> bool:
        """When nothing else can run, a waiting Merge runs with the inputs it has (n8n v1 does the same)."""
        for name, rounds in list(execution.waiting.items()):
            if rounds:
                slot = rounds.pop(0)
                if not rounds:
                    execution.waiting.pop(name, None)
                execution.stack.insert(0, {"node": name, "inputs": [s or [] for s in slot], "source": None})
                return True
            execution.waiting.pop(name, None)
        return False

    def _fail_responder(self, execution: Execution) -> None:
        fut = execution.responder
        if fut is not None and not fut.done():
            fut.set_result(Response(status=500, body={"code": 0, "message": "Error in workflow"}))


class NodeContext:
    """What a node handler sees: its node, its input items, resolved parameters and the services."""

    def __init__(self, executor: Executor, flow: Flow, execution: Execution, node: NodeDef, inputs: list[list[Item]]):
        self.executor = executor
        self.flow = flow
        self.execution = execution
        self.node = node
        self.inputs = inputs
        self.services = executor.services
        self.run_index = execution.run_index(node.name)

    @property
    def items(self) -> list[Item]:
        return self.inputs[0] if self.inputs else []

    @property
    def continue_on_fail(self) -> bool:
        return self.node.continue_on_fail

    # ---------- data other nodes produced ----------
    def referenced_node_data(self) -> dict[str, dict[str, Any]]:
        names, dynamic = self.node.referenced_nodes
        if dynamic:
            names = frozenset(self.execution.run_data.keys())
        out: dict[str, dict[str, Any]] = {}
        for name in names:
            if name not in self.flow.nodes or not self.execution.run_data.get(name):
                continue
            oi = self.flow.output_towards(name, self.node.name)
            items = self.execution.latest_output(name, oi)
            if items is None:
                continue
            out[name] = {"items": items}
        return out

    def js_context(self) -> dict[str, Any]:
        return {
            "nodes": self.referenced_node_data(),
            "execution": {"id": self.execution.id, "mode": self.execution.mode, "resumeUrl": self.execution.resume_url},
            "workflow": {"id": self.flow.id, "name": self.flow.name, "active": True},
            "runIndex": self.run_index,
            "timezone": self.flow.settings.get("timezone") or "UTC",
        }

    async def params(self, items: list[Item] | None = None) -> list["Params"]:
        """Node parameters with ={{ }} expressions resolved for each input item (n8n resolves per item)."""
        items = self.items if items is None else items
        raw = {k: v for k, v in self.node.parameters.items() if k != "jsCode"}
        count = max(1, len(items))
        if not self.node.has_expressions:
            return [Params(copy.deepcopy(raw), self.node.name) for _ in range(count)]
        res = await self.services.js.call(
            "resolve", params=raw, items=[strip_binary_data(i) for i in items] or [{"json": {}}], **self.js_context())
        return [Params(p, self.node.name) for p in res["perItem"]]

    # ---------- responses to the webhook caller ----------
    def respond(self, response: Response) -> bool:
        fut = self.execution.responder
        if fut is None or fut.done():
            return False
        fut.set_result(response)
        return True


class ExpressionError(NodeError):
    pass


class Params:
    """Resolved parameters of one item. Reading a value whose expression failed raises, like n8n."""

    def __init__(self, data: dict[str, Any], node_name: str):
        self._data = data
        self._node = node_name

    def get(self, path: str, default: Any = None) -> Any:
        cur: Any = self._data
        for part in path.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                return default
        return self._check(cur)

    def raw(self) -> dict[str, Any]:
        return self._data

    def _check(self, v: Any) -> Any:
        if isinstance(v, dict):
            if "__exprError__" in v and len(v) == 1:
                raise ExpressionError(f"Expression error in node '{self._node}': {v['__exprError__']}")
            if v.get("__rl") is True and "value" in v:
                return {**v, "value": self._check(v["value"])}
            return {k: self._check(x) for k, x in v.items()}
        if isinstance(v, list):
            return [self._check(x) for x in v]
        return v

    def rl(self, path: str, default: Any = None) -> Any:
        """Value of a resource-locator parameter ({__rl, mode, value}) or a plain value."""
        v = self.get(path, default)
        if isinstance(v, dict) and "value" in v:
            return v["value"]
        return v


async def retry_pause(seconds: float) -> None:
    """Wait between tries (a separate function so tests can skip the wait)."""
    await asyncio.sleep(seconds)


def retry_params(node: NodeDef) -> tuple[int, int]:
    """n8n's WorkflowExecute.getRetryParams: tries clamped to 2..5, wait to 0..5000 ms (unset or 0 means 1000)."""
    if not node.retry_on_fail:
        return 1, 0
    return min(5, max(2, node.max_tries or 3)), min(5000, max(0, node.wait_between_tries_ms or 1000))


def _first_item_failed(result: Any) -> bool:
    """n8n's checkFailure: the first item of the first output carries an error (anything but undefined/null/false)."""
    try:
        err = result[0][0]["json"].get("error")
    except (IndexError, KeyError, TypeError, AttributeError):
        return False
    return err is not None and err is not False


def strip_binary_data(item: Item) -> Item:
    """Items as the JS side sees them: binary references keep their metadata, never their bytes."""
    if "binary" not in item:
        return item
    return {**item, "binary": {k: {kk: vv for kk, vv in (v or {}).items() if kk != "content"} for k, v in item["binary"].items()}}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def wait_until(hours: float = 0, seconds: float = 0) -> datetime:
    return utcnow() + timedelta(hours=hours, seconds=seconds)
