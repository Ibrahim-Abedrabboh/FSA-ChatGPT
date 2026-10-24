"""Speed changes of 20 Oct 2026 (owner's go: changes 1-3 of the first end-to-end run report, section 4).

1. 16x Blind count asks Gemini for low thinking: tests/py/test_llm.py.
2. The critic review and the blind count run at the same time (settings.parallelFanOut, Flow.parallel_regions).
3. 11b Stylist check: no paid plan critic when every shot left to check is a white master whose plan is the studio's own.
"""

from __future__ import annotations

import asyncio
import copy
import gzip
import json
import time
from pathlib import Path

import pytest

from conftest import link, make_flow, run_flow
from midas_a7.engine.executor import Execution, Executor, NodeError
from midas_a7.engine.model import flow_from_definition, load_flow
from midas_a7.flows import a7_main
from midas_a7.nodes import all_handlers

FLOWS = Path(__file__).resolve().parents[2] / "src" / "midas_a7" / "flows"
FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"


@pytest.fixture(scope="module")
def recorded_11b_state():
    run = json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())["runData"]
    return run["11b Stylist check"][0]["main"][0][0]["json"]


def _recheck(state: dict, keep_kinds: tuple[str, ...]) -> dict:
    """A plan state as 11b receives it on a second round, with only the shots of the given kinds left to check."""
    st = copy.deepcopy(state)
    st["shots"] = [s for s in st["shots"] if s["kind"] in keep_kinds]
    for s in st["shots"]:
        s["plan_ok"] = False
        s["code_findings"] = []
    st["plan_state"] = True
    return st


async def _run_11b(executor, state: dict) -> dict:
    code = (FLOWS / "a7_main" / "code" / "11b_Stylist_check.js").read_text(encoding="utf-8")
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "position": [0, 0], "parameters": {}},
        {"name": "11b Stylist check", "type": "n8n-nodes-base.code", "position": [200, 0], "parameters": {"jsCode": code}},
    ], link(("Start", "11b Stylist check")))
    ex = await run_flow(executor, flow, [{"json": state}])
    assert ex.status == "success", ex.error
    return ex.run_data["11b Stylist check"][0]["data"][0][0]["json"]


async def test_white_master_only_plan_skips_the_paid_plan_critic(executor, recorded_11b_state):
    out = await _run_11b(executor, _recheck(recorded_11b_state, ("white",)))
    assert out["critic_needed"] is False
    assert [(s["kind"], s["plan_ok"]) for s in out["shots"]] == [("white", True)]
    assert "check" not in out["shots"][0] or not out["shots"][0]["check"]  # 12 then shows "fixed by the studio"
    assert out["trail"][-1]["note"].endswith("plan critic not called: white master only, plan written by code")


async def test_a_plan_with_a_scene_still_goes_to_the_plan_critic(executor, recorded_11b_state):
    out = await _run_11b(executor, _recheck(recorded_11b_state, ("white", "hero")))
    assert out["critic_needed"] is True
    assert [(s["kind"], s["plan_ok"]) for s in out["shots"]] == [("white", False), ("hero", False)]
    assert "plan critic not called" not in out["trail"][-1]["note"]



# ---------- 2. the critic review and the blind count run at the same time ----------
SLEEP = 0.3


def stub_executor(services, order: list[str], slow: set[str] = frozenset(), fail: set[str] = frozenset()):
    """Every node of type test.step passes its input on output 0; `slow` ones take SLEEP s, `fail` ones throw."""
    async def step(ctx):
        order.append(ctx.node.name + ":start")
        if ctx.node.name in slow:
            await asyncio.sleep(SLEEP)
        if ctx.node.name in fail:
            raise NodeError("boom")
        order.append(ctx.node.name + ":end")
        return [ctx.items]

    return Executor(services, {**all_handlers(), "step": step})


def step(name: str, x: int, y: int = 0) -> dict:
    return {"name": name, "type": "test.step", "position": [x, y], "parameters": {}}


def fan_flow(parallel: bool, extra_nodes=(), extra_links=()):
    """Start -> Fan -> A1 -> A2 -> Join(0); Fan -> B1 -> B2 -> Join(1); Join -> After."""
    nodes = [
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "position": [0, 0], "parameters": {}},
        step("Fan", 100), step("A1", 200, 0), step("A2", 300, 0), step("B1", 200, 100), step("B2", 300, 100),
        {"name": "Join", "type": "n8n-nodes-base.merge", "typeVersion": 3.2, "position": [400, 50], "parameters": {}},
        step("After", 500, 50), *extra_nodes,
    ]
    connections = link(("Start", "Fan"), ("Fan", "A1"), ("Fan", "B1"), ("A1", "A2"), ("B1", "B2"),
                       ("A2", "Join", 0, 0), ("B2", "Join", 0, 1), ("Join", "After"), *extra_links)
    settings = {"executionOrder": "v1", **({"parallelFanOut": ["Fan"]} if parallel else {})}
    return make_flow(nodes, connections, settings)


async def _timed(executor, flow):
    t0 = time.monotonic()
    ex = await run_flow(executor, flow, [{"json": {"n": 1}}])
    return ex, time.monotonic() - t0


async def test_listed_fan_out_runs_its_branches_at_the_same_time(services):
    order: list[str] = []
    ex, took = await _timed(stub_executor(services, order, slow={"A1", "B1"}), fan_flow(parallel=True))
    assert ex.status == "success", ex.error
    assert took < SLEEP * 1.7  # both slow calls overlap
    assert order.index("B1:start") < order.index("A1:end")  # B started before A finished
    for name in ("A2", "B2"):
        assert order.index(name + ":end") < order.index("After:start")
    assert len(ex.run_data["Join"]) == 1 and [len(i) for i in ex.run_data["Join"][0]["data"]] == [2]
    assert len(ex.run_data["After"]) == 1


async def test_without_the_setting_the_branches_run_one_after_the_other(services):
    order: list[str] = []
    ex, took = await _timed(stub_executor(services, order, slow={"A1", "B1"}), fan_flow(parallel=False))
    assert ex.status == "success", ex.error
    assert took >= SLEEP * 2
    assert [o for o in order if o.endswith(":start")] == ["Fan:start", "A1:start", "A2:start", "B1:start", "B2:start", "After:start"]


async def test_a_failing_branch_lets_the_other_finish_then_stops_the_run(services):
    order: list[str] = []
    ex, _ = await _timed(stub_executor(services, order, slow={"B1"}, fail={"A1"}), fan_flow(parallel=True))
    assert ex.status == "error" and ex.error["node"] == "A1"
    assert "B2:end" in order  # the sibling finished its work (its paid call and budget settlement)
    assert "Join" not in ex.run_data and "After:start" not in order


async def test_a_node_reached_from_outside_a_branch_waits_until_both_branches_finish(services):
    # A1 also leads to Log, which Start reaches too: Log is outside the region and runs after the branches.
    order: list[str] = []
    flow = fan_flow(parallel=True, extra_nodes=[step("Log", 300, -100)], extra_links=[("A1", "Log"), ("Start", "Log")])
    assert flow.parallel_regions["Fan"] == {"A1": frozenset({"A1", "A2"}), "B1": frozenset({"B1", "B2"})}
    ex, _ = await _timed(stub_executor(services, order, slow={"B1"}), flow)
    assert ex.status == "success", ex.error
    log_runs = [i for i, o in enumerate(order) if o == "Log:start"]
    assert len(log_runs) == 2 and log_runs[1] > order.index("B2:end")


def test_branches_that_read_each_other_are_refused():
    flow = fan_flow(parallel=True)
    flow.nodes["B2"].parameters["jsCode"] = "return $('A1').all();"
    with pytest.raises(ValueError, match="reads nodes of the 'A1' branch"):
        _ = flow.parallel_regions


def test_a7_review_regions_are_the_two_budgeted_calls():
    regions = load_flow("midas_a7.flows.a7_main").parallel_regions
    assert set(regions) == {"Images ready?"}
    critic, blind = regions["Images ready?"]["Budget · 16 · Ticket"], regions["Images ready?"]["Budget · 16x · Ticket"]
    assert critic == {"16 Critic review"} | {f"Budget · 16 · {s}" for s in
                                             ("Ticket", "Reserve", "Permit", "Allowed", "Hold", "Receipt", "Settle", "Restore", "Settled")}
    assert {"16x Blind count", "16x Blind answered?", "16xa Blind fallback input", "16xb Blind count fallback (OpenAI)"} <= blind
    assert len(blind) == 22


async def test_a7_review_section_runs_both_calls_at_once_and_merges_once(services):
    """The real nodes and links from 'Images ready?' to '16b Review verdict', each node replaced by a stub step."""
    keep = {"Images ready?", "Reviews done", "16b Review verdict", "V1 Vault events"}
    keep |= set().union(*load_flow("midas_a7.flows.a7_main").parallel_regions["Images ready?"].values())
    nodes = []
    for n in a7_main.FLOW["nodes"]:
        if n["name"] in keep:
            n = copy.deepcopy(n)
            if n["name"] != "Reviews done":
                n.update(type="test.step", parameters={})
            nodes.append(n)
    nodes.append({"name": "Start", "type": "n8n-nodes-base.manualTrigger", "position": [0, 0], "parameters": {}})
    connections = {src: {"main": [[c for c in outs if c["node"] in keep] for outs in by["main"]]}
                   for src, by in a7_main.FLOW["connections"].items() if src in keep}
    connections["Start"] = {"main": [[{"node": "Images ready?", "type": "main", "index": 0}]]}
    flow = flow_from_definition({"id": "t", "name": "t", "nodes": nodes, "connections": connections,
                                 "settings": a7_main.FLOW["settings"]})
    order: list[str] = []
    executor = stub_executor(services, order, slow={"16 Critic review", "16x Blind count"})
    ex = Execution(id="1", flow_id="t")
    t0 = time.monotonic()
    await executor.start(flow, ex, flow.nodes["Start"], [{"json": {"rv": {"ready": True}}}])
    assert ex.status == "success", ex.error
    assert time.monotonic() - t0 < SLEEP * 1.7
    assert order.index("16x Blind count:start") < order.index("16 Critic review:end")
    assert len(ex.run_data["Reviews done"]) == 1 and len(ex.run_data["16b Review verdict"]) == 1
    assert not any(n in ex.run_data for n in ("Budget · 16 · Hold", "Budget · 16x · Hold", "16xa Blind fallback input"))
