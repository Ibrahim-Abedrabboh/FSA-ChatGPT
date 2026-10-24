"""Flow definitions: the nodes and connections of each A7 flow, as committed in src/midas_a7/flows."""

from __future__ import annotations

import importlib
import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Any

Item = dict[str, Any]  # {"json": {...}, "binary": {key: ref}}

_LITERAL_REF = re.compile(r"""\$\(\s*(['"])((?:(?!\1).)+)\1\s*\)""")
_ANY_REF = re.compile(r"\$\(")


@dataclass(frozen=True)
class NodeDef:
    name: str
    type: str
    type_version: float
    parameters: dict[str, Any]
    position: tuple[float, float] = (0.0, 0.0)
    credentials: dict[str, Any] = field(default_factory=dict)
    on_error: str = "stopWorkflow"
    always_output_data: bool = False
    execute_once: bool = False
    retry_on_fail: bool = False
    max_tries: int = 3
    wait_between_tries_ms: int = 1000
    disabled: bool = False
    webhook_id: str | None = None

    @property
    def kind(self) -> str:
        """Short node type, e.g. 'code', 'httpRequest', 'openAi'."""
        return self.type.rsplit(".", 1)[-1]

    @property
    def continue_on_fail(self) -> bool:
        return self.on_error in ("continueRegularOutput", "continueErrorOutput")

    @cached_property
    def referenced_nodes(self) -> tuple[frozenset[str], bool]:
        """Nodes this node reads with $('Name'); the flag is True when a name is computed at run time.

        Every `$(` that is not one whole quoted literal counts as computed: `$(name)`, a template literal, or a
        concatenation such as `$('Budget · '+n+' · Ticket')`. Such a node is given every executed node, as n8n does.
        The parameters are scanned as written (not JSON-escaped), so a double-quoted name inside the script stays literal.
        """
        text = "\n".join(_strings(self.parameters))
        names: set[str] = set()
        dynamic = False
        for ref in _ANY_REF.finditer(text):
            literal = _LITERAL_REF.match(text, ref.start())
            if literal:
                names.add(literal.group(2))
            else:
                dynamic = True
        return frozenset(names), dynamic

    @cached_property
    def has_expressions(self) -> bool:
        return _has_expr({k: v for k, v in self.parameters.items() if k != "jsCode"})


def _has_expr(v: Any) -> bool:
    if isinstance(v, str):
        return v.startswith("=")
    if isinstance(v, dict):
        return any(_has_expr(x) for x in v.values())
    if isinstance(v, list):
        return any(_has_expr(x) for x in v)
    return False


def _strings(v: Any):
    """Every string in a parameter tree (the code as written, not JSON-escaped)."""
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from _strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from _strings(x)


@dataclass
class Flow:
    id: str
    name: str
    version_id: str
    settings: dict[str, Any]
    nodes: dict[str, NodeDef]
    # connections[source][output_index] -> [(target, input_index), ...]
    connections: dict[str, list[list[tuple[str, int]]]]

    @cached_property
    def parents(self) -> dict[str, list[tuple[str, int, int]]]:
        out: dict[str, list[tuple[str, int, int]]] = {n: [] for n in self.nodes}
        for src, outputs in self.connections.items():
            for oi, targets in enumerate(outputs):
                for dst, ii in targets:
                    out.setdefault(dst, []).append((src, oi, ii))
        return out

    def input_count(self, name: str) -> int:
        node = self.nodes[name]
        if node.kind == "merge":
            return int(node.parameters.get("numberInputs", 2))
        ins = [ii for _, _, ii in self.parents.get(name, [])]
        return (max(ins) + 1) if ins else 1

    def children(self, name: str, output: int) -> list[tuple[str, int]]:
        outs = self.connections.get(name, [])
        return list(outs[output]) if output < len(outs) else []

    @cached_property
    def _reach(self) -> dict[str, set[str]]:
        reach: dict[str, set[str]] = {}

        def visit(n: str, seen: set[str]) -> set[str]:
            if n in reach:
                return reach[n]
            acc: set[str] = set()
            seen.add(n)
            for targets in self.connections.get(n, []):
                for dst, _ in targets:
                    acc.add(dst)
                    if dst not in seen:
                        acc |= visit(dst, seen)
            reach[n] = acc
            return acc

        for n in self.nodes:
            visit(n, set())
        return reach

    @cached_property
    def parallel_regions(self) -> dict[str, dict[str, frozenset[str]]]:
        """settings.parallelFanOut: for each listed node, the region each of its children owns, keyed by that child.

        A region holds the child and every node all of whose parents are already in it; it stops at a node with
        several inputs (a Merge), at a node reached from elsewhere, and at Wait, Respond and trigger nodes. The
        executor runs the regions of one fan-out at the same time and leaves every node outside them to the
        normal order. Regions that overlap, or that read each other's nodes with $('Name'), are refused.
        """
        stop = {"wait", "respondToWebhook", "webhook"}
        out: dict[str, dict[str, frozenset[str]]] = {}
        for fan in self.settings.get("parallelFanOut") or []:
            if fan not in self.nodes:
                raise ValueError(f"parallelFanOut: no node named {fan!r}")
            heads = [c for targets in self.connections.get(fan, []) for c, _ in targets]
            regions: dict[str, frozenset[str]] = {}
            for head in heads:
                if self.input_count(head) > 1 or self.nodes[head].kind in stop or len(self.parents[head]) != 1:
                    continue
                own = {head}
                grown = True
                while grown:
                    grown = False
                    for n in list(own):
                        for targets in self.connections.get(n, []):
                            for c, _ in targets:
                                if (c not in own and self.input_count(c) == 1 and self.nodes[c].kind not in stop
                                        and all(p in own for p, _, _ in self.parents[c])):
                                    own.add(c)
                                    grown = True
                regions[head] = frozenset(own)
            for a, ra in regions.items():
                for b, rb in regions.items():
                    if a == b:
                        continue
                    if ra & rb:
                        raise ValueError(f"parallelFanOut {fan!r}: the branches of {a!r} and {b!r} overlap")
                    for n in ra:
                        names, dynamic = self.nodes[n].referenced_nodes
                        if names & rb or dynamic:
                            raise ValueError(f"parallelFanOut {fan!r}: {n!r} reads nodes of the {b!r} branch")
            out[fan] = regions
        return out

    def output_towards(self, source: str, target: str) -> int:
        """Which output of `source` leads to `target` (n8n uses it for $('source') lookups); 0 if none."""
        for oi, targets in enumerate(self.connections.get(source, [])):
            for dst, _ in targets:
                if dst == target or target in self._reach.get(dst, set()):
                    return oi
        return 0

    def webhook_nodes(self) -> list[NodeDef]:
        return [n for n in self.nodes.values() if n.kind == "webhook" and not n.disabled]

    def trigger_nodes(self) -> list[NodeDef]:
        kinds = {"webhook", "scheduleTrigger", "manualTrigger", "executeWorkflowTrigger"}
        return [n for n in self.nodes.values() if n.kind in kinds and not n.disabled]


def flow_from_definition(defn: dict[str, Any], code_dir: Path | None = None) -> Flow:
    """Build a Flow from a definition dict as written by tools/n8n_to_flow.py.

    Code nodes keep their JavaScript in code_dir/<file>; the definition names the file in
    parameters["jsCodeFile"], and the file text becomes parameters["jsCode"] byte for byte.
    """
    nodes: dict[str, NodeDef] = {}
    for raw in defn["nodes"]:
        params = dict(raw.get("parameters") or {})
        code_file = params.pop("jsCodeFile", None)
        if code_file:
            if code_dir is None:
                raise ValueError(f"node {raw['name']} needs a code directory")
            params["jsCode"] = (code_dir / code_file).read_text(encoding="utf-8")
        pos = raw.get("position") or [0, 0]
        nodes[raw["name"]] = NodeDef(
            name=raw["name"],
            type=raw["type"],
            type_version=float(raw.get("typeVersion", 1)),
            parameters=params,
            position=(float(pos[0]), float(pos[1])),
            credentials=raw.get("credentials") or {},
            on_error=raw.get("onError") or ("continueRegularOutput" if raw.get("continueOnFail") else "stopWorkflow"),
            always_output_data=bool(raw.get("alwaysOutputData")),
            execute_once=bool(raw.get("executeOnce")),
            retry_on_fail=bool(raw.get("retryOnFail")),
            max_tries=int(raw.get("maxTries") or 3),
            wait_between_tries_ms=int(raw.get("waitBetweenTries") if raw.get("waitBetweenTries") is not None else 1000),
            disabled=bool(raw.get("disabled")),
            webhook_id=raw.get("webhookId"),
        )
    connections: dict[str, list[list[tuple[str, int]]]] = {}
    for src, by_type in (defn.get("connections") or {}).items():
        main = by_type.get("main") or []
        connections[src] = [[(c["node"], int(c.get("index", 0))) for c in (outs or [])] for outs in main]
    return Flow(
        id=defn["id"], name=defn["name"], version_id=defn.get("versionId", ""),
        settings=defn.get("settings") or {}, nodes=nodes, connections=connections,
    )


def load_flow(module_name: str) -> Flow:
    """Load a committed flow package, e.g. 'midas_a7.flows.a7_main'."""
    mod = importlib.import_module(module_name)
    code_dir = Path(mod.__file__).with_name("code")
    return flow_from_definition(mod.FLOW, code_dir)
