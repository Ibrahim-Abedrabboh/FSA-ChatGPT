"""Replay of the real A7 run 1591 (20 Oct 2026, owner job, intake to go 1) through the Python engine.

Nodes that talk to the outside world (HTTP, model, data-table, Drive, image) return what n8n recorded.
Every other node (Code, IF, Merge, Wait, Respond) runs in this engine, on the frozen flow, and its
output must equal n8n's recorded output. Masked: timestamps; `go1_token` (random by design);
`requestSha256` of the budget tickets (a hash over the run state, which holds those timestamps).
n8n's `pairedItem` lineage metadata (not item data; this engine does not track it) is ignored.
Nothing else is masked.

The recording holds no file bytes, so "02 Ingest files" (which hashes the uploaded photo) is replayed too.
The recording also keeps only the first item of each node output. So the two reference reads (handling
profiles, catalogue) are fed their full rows from the frozen seeds (unchanged since 16 Oct, first rows
equal to the recorded ones), and each node's first output item is compared with n8n's.
The fixture was scrubbed: request headers and the resume-link signature are not in it.
"""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

import pytest

from midas_a7.engine.executor import Execution, Executor
from midas_a7.engine.model import load_flow
from midas_a7.nodes import all_handlers

FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"
OUTSIDE_KINDS = {"httpRequest", "dataTable", "openAi", "anthropic", "googleGemini", "googleDrive", "editImage"}
NEEDS_FILE_BYTES = {"02 Ingest files"}
SEEDS = Path(__file__).resolve().parents[2] / "src" / "midas_a7" / "data" / "seeds"
REFERENCE_READS = {"07a Load handling profiles": "AgXKkFbIj5dQAnvn", "10a Load Midas catalogue": "lwJbRv4TVqlFTILl"}
TS = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z")
VARIES = {"go1_token", "requestSha256"}


def masked(value) -> str:
    def strip_binary(v):
        if isinstance(v, dict):
            return {k: ("<varies>" if k in VARIES and x else
                        sorted(x.keys()) if k == "binary" and isinstance(x, dict) else strip_binary(x))
                    for k, x in v.items() if k != "pairedItem"}
        if isinstance(v, list):
            return [strip_binary(x) for x in v]
        return v
    return TS.sub("<ts>", json.dumps(strip_binary(value), ensure_ascii=False, sort_keys=True))


@pytest.fixture(scope="module")
def recording():
    return json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())


async def test_run_1591_matches_n8n_node_by_node(services, recording):
    flow = load_flow("midas_a7.flows.a7_main")
    recorded = recording["runData"]

    def replay():
        async def handler(ctx):
            if ctx.node.name in REFERENCE_READS:
                rows = json.loads((SEEDS / f"{REFERENCE_READS[ctx.node.name]}.json").read_text(encoding="utf-8"))["rows"]
                return [[{"json": r} for r in rows]]
            runs = recorded.get(ctx.node.name)
            assert runs and ctx.run_index < len(runs), f"engine ran {ctx.node.name} more often than n8n did"
            return runs[ctx.run_index]["main"]
        return handler

    handlers = dict(all_handlers())
    for kind in OUTSIDE_KINDS:
        handlers[kind] = replay()
    real = dict(handlers)

    async def pick(ctx):
        if ctx.node.name in NEEDS_FILE_BYTES:
            return await replay()(ctx)
        return await real[ctx.node.kind](ctx)

    executor = Executor(services, {kind: pick for kind in handlers})
    ex = Execution(id=recording["execution_id"], flow_id=flow.id)
    ex.resume_url = recording["resume_url"]
    trigger = flow.nodes["A7 job webhook"]
    trigger_items = recorded["A7 job webhook"][0]["main"][0]
    await executor.start(flow, ex, trigger, trigger_items)

    assert ex.status == "waiting", ex.error
    assert ex.wait["node"] == "Wait for go 1"

    order_recorded = [n for n, _ in sorted(((n, r[0]["executionIndex"]) for n, r in recorded.items()), key=lambda t: t[1])]
    order_engine = list(ex.run_data.keys())
    assert order_engine == order_recorded

    mismatches = []
    for name, runs in recorded.items():
        ours = ex.run_data.get(name, [])
        assert len(ours) == len(runs), f"{name}: ran {len(ours)}x, n8n ran {len(runs)}x"
        for i, run in enumerate(runs):
            if flow.nodes[name].kind in OUTSIDE_KINDS or name in NEEDS_FILE_BYTES:
                continue
            mine = [out[:1] if out else out for out in (ours[i]["data"] or [])]
            theirs = [out[:1] if out else out for out in (run["main"] or [])]
            if masked(mine) != masked(theirs):
                mismatches.append(name)
    assert not mismatches, f"outputs differ from n8n for: {mismatches}"
