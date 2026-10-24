"""Executor order, Code nodes through the JS sidecar, IF/Switch/Merge and node settings."""

from __future__ import annotations

from conftest import link, make_flow, run_flow


def node(name, kind, params=None, pos=(0, 0), **extra):
    types = {"code": "n8n-nodes-base.code", "if": "n8n-nodes-base.if", "merge": "n8n-nodes-base.merge",
             "noOp": "n8n-nodes-base.noOp", "manualTrigger": "n8n-nodes-base.manualTrigger",
             "switch": "n8n-nodes-base.switch"}
    return {"name": name, "type": types[kind], "typeVersion": 2.2 if kind == "if" else 2, "position": list(pos),
            "parameters": params or {}, **extra}


def bool_if(expr):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                           "conditions": [{"leftValue": "={{ " + expr + " }}", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                           "combinator": "and"}, "options": {}}


async def test_code_if_and_cross_node_reference(executor):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Make", "code", {"jsCode": "return [{json:{n:1}},{json:{n:2}},{json:{n:3}}];"}, (200, 0)),
        node("Big?", "if", bool_if("$json.n >= 2"), (400, 0)),
        node("Yes", "code", {"jsCode": "return $input.all().map(i => ({json:{n:i.json.n, first:$('Make').first().json.n}}));"}, (600, -100)),
        node("No", "noOp", pos=(600, 100)),
    ], link(("Start", "Make"), ("Make", "Big?"), ("Big?", "Yes", 0), ("Big?", "No", 1)))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    assert [i["json"] for i in ex.latest_output("Yes")] == [{"n": 2, "first": 1}, {"n": 3, "first": 1}]
    assert [i["json"]["n"] for i in ex.latest_output("No")] == [1]


async def test_depth_first_top_branch_first(executor):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Bottom", "code", {"jsCode": "return [{json:{at: Date.now()}}];"}, (200, 300)),
        node("Top", "code", {"jsCode": "return [{json:{at: Date.now()}}];"}, (200, -300)),
        node("Top child", "code", {"jsCode": "return [{json:{x:1}}];"}, (400, -300)),
    ], link(("Start", "Bottom"), ("Start", "Top"), ("Top", "Top child")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    order = [n for n in ex.run_data]
    assert order[1:] == ["Top", "Top child", "Bottom"], order


async def test_merge_waits_for_all_inputs(executor):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("A", "code", {"jsCode": "return [{json:{a:1}}];"}, (200, -100)),
        node("B", "code", {"jsCode": "return [{json:{b:1}}];"}, (200, 100)),
        node("M", "merge", {}, (400, 0)),
    ], link(("Start", "A"), ("Start", "B"), ("A", "M", 0, 0), ("B", "M", 0, 1)))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert [i["json"] for i in ex.latest_output("M")] == [{"a": 1}, {"b": 1}]
    assert len(ex.run_data["M"]) == 1


async def test_always_output_data_and_empty_output_stops_branch(executor):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Empty", "code", {"jsCode": "return [];"}, (200, -100)),
        node("After empty", "noOp", pos=(400, -100)),
        node("Empty but always", "code", {"jsCode": "return [];"}, (200, 100), alwaysOutputData=True),
        node("After always", "noOp", pos=(400, 100)),
    ], link(("Start", "Empty"), ("Empty", "After empty"), ("Start", "Empty but always"), ("Empty but always", "After always")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert "After empty" not in ex.run_data
    assert ex.latest_output("After always") == [{"json": {}}]


async def test_code_error_stops_or_continues(executor, caplog):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Boom", "code", {"jsCode": "throw new Error('nope');"}, (200, 0), onError="continueRegularOutput"),
        node("After", "noOp", pos=(400, 0)),
    ], link(("Start", "Boom"), ("Boom", "After")))
    ex = await run_flow(executor, flow, [{"json": {"k": 1}}])
    assert ex.status == "success"
    assert ex.latest_output("After") == [{"json": {"k": 1}}]
    [continued] = [r for r in caplog.records if r.getMessage().startswith("node Boom failed; the run continues: ")]
    assert "nope" in continued.getMessage()
    flow2 = make_flow([node("Start", "manualTrigger"), node("Boom", "code", {"jsCode": "throw new Error('nope');"})],
                      link(("Start", "Boom")))
    ex2 = await run_flow(executor, flow2, [{"json": {}}])
    assert ex2.status == "error" and "nope" in ex2.error["message"]
    assert any(r.getMessage().startswith("node Boom failed; the run stops: ") for r in caplog.records)


async def test_code_sees_crypto_luxon_and_execution(executor):
    js = ("const c=require('crypto'); return [{json:{h:c.createHash('sha256').update('a').digest('hex').slice(0,8),"
          " d: DateTime.fromISO('2026-10-20T00:00:00Z').toUTC().toFormat('yyyy-MM-dd'), id:$execution.id, r:$runIndex}}];")
    flow = make_flow([node("Start", "manualTrigger"), node("C", "code", {"jsCode": js})], link(("Start", "C")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.latest_output("C")[0]["json"] == {"h": "ca978112", "d": "2026-10-20", "id": "1", "r": 0}


async def test_code_may_declare_its_own_items_as_in_n8n(executor):
    # 15b Dispatch guard declares `const items`; n8n allows it (items is a sandbox global), so the runner must too.
    js = "const items = $input.all().map(i => i.json); return [{ json: { n: items.length, same: this.helpers !== undefined } }];"
    flow = make_flow([node("Start", "manualTrigger"), node("C", "code", {"jsCode": js})], link(("Start", "C")))
    ex = await run_flow(executor, flow, [{"json": {"a": 1}}, {"json": {"a": 2}}])
    assert ex.status == "success", ex.error
    assert ex.latest_output("C")[0]["json"] == {"n": 2, "same": True}


async def test_binary_round_trip_through_code(executor):
    make = ("const b = await this.helpers.prepareBinaryData(Buffer.from('hello'), 'a.txt', 'text/plain');"
            " return [{json:{}, binary:{data:b}}];")
    read = ("const buf = await this.helpers.getBinaryDataBuffer(0, 'data');"
            " return [{json:{text: buf.toString(), name: $input.first().binary.data.fileName}}];")
    flow = make_flow([node("Start", "manualTrigger"), node("Make", "code", {"jsCode": make}), node("Read", "code", {"jsCode": read})],
                     link(("Start", "Make"), ("Make", "Read")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    ref = ex.latest_output("Make")[0]["binary"]["data"]
    assert ref["id"].startswith("bin:") and ref["mimeType"] == "text/plain" and ref["bytes"] == 5
    assert ex.latest_output("Read")[0]["json"] == {"text": "hello", "name": "a.txt"}


async def test_switch_rules(executor):
    def rule(v):
        return {"conditions": {"combinator": "and", "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                               "conditions": [{"leftValue": "={{ $json.arm }}", "operator": {"operation": "equals", "type": "string"},
                                               "rightValue": v}]},
                "outputKey": v}
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("S", "switch", {"mode": "rules", "rules": {"values": [rule("A"), rule("B")]}}, (200, 0)),
        node("A", "noOp", pos=(400, -100)), node("B", "noOp", pos=(400, 100)),
    ], link(("Start", "S"), ("S", "A", 0), ("S", "B", 1)))
    ex = await run_flow(executor, flow, [{"json": {"arm": "B"}}, {"json": {"arm": "A"}}, {"json": {"arm": "Z"}}])
    assert [i["json"]["arm"] for i in ex.latest_output("A")] == ["A"]
    assert [i["json"]["arm"] for i in ex.latest_output("B")] == ["B"]


async def test_retry_on_error_item_and_on_throw_like_n8n(services, monkeypatch):
    from midas_a7.engine import executor as ex_mod
    from midas_a7.engine.executor import Executor, NodeError
    from midas_a7.nodes import all_handlers

    sleeps = []

    async def fake_sleep(s):
        sleeps.append(s)

    monkeypatch.setattr(ex_mod, "retry_pause", fake_sleep)
    calls = {"n": 0}

    async def flaky(ctx):
        calls["n"] += 1
        if calls["n"] == 1:
            return [[{"json": {"error": "provider busy"}}]]  # continue-on-fail error item
        if calls["n"] == 2:
            raise NodeError("timeout")
        return [[{"json": {"ok": True}}]]

    handlers = {**all_handlers(), "noOp": flaky}
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Call", "noOp", pos=(200, 0), retryOnFail=True, maxTries=3, waitBetweenTries=0, onError="continueRegularOutput"),
    ], link(("Start", "Call")))
    ex = await run_flow(Executor(services, handlers), flow, [{"json": {}}])
    assert calls["n"] == 3 and ex.latest_output("Call") == [{"json": {"ok": True}}]
    assert sleeps == [1.0, 1.0]  # n8n: a wait of 0 becomes 1000 ms


async def test_retry_gives_up_with_last_error_item(services, monkeypatch, caplog):
    from midas_a7.engine import executor as ex_mod
    from midas_a7.engine.executor import Executor, retry_params
    from midas_a7.engine.model import NodeDef
    from midas_a7.nodes import all_handlers

    async def fake_sleep(s):
        return None

    monkeypatch.setattr(ex_mod, "retry_pause", fake_sleep)
    calls = {"n": 0}

    async def always_failing(ctx):
        calls["n"] += 1
        return [[{"json": {"error": f"fail {calls['n']}"}}]]

    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Call", "noOp", pos=(200, 0), retryOnFail=True, maxTries=9, waitBetweenTries=9000, onError="continueRegularOutput"),
    ], link(("Start", "Call")))
    ex = await run_flow(Executor(services, {**all_handlers(), "noOp": always_failing}), flow, [{"json": {}}])
    assert calls["n"] == 5  # clamped to 5 tries
    assert ex.latest_output("Call") == [{"json": {"error": "fail 5"}}]
    assert caplog.text.count("node Call returned an error item (attempt") == 4  # the last try is not followed by a retry
    assert retry_params(NodeDef("x", "t", 1, {}, retry_on_fail=True, max_tries=1, wait_between_tries_ms=9000)) == (2, 5000)
    assert retry_params(NodeDef("x", "t", 1, {})) == (1, 0)


def test_node_references_built_at_run_time_count_as_computed():
    from midas_a7.engine.model import NodeDef, load_flow

    def refs(js):
        return NodeDef("x", "n8n-nodes-base.code", 2, {"jsCode": js}).referenced_nodes

    assert refs("return $('A').all().concat($(\"B\").all());") == (frozenset({"A", "B"}), False)
    # A name concatenated at run time starts with a quote, so it is not a literal: every executed node must be visible.
    assert refs("const n='03';return [$('Budget · '+n+' · Ticket').first(), $('Validate').first()];") == (frozenset({"Validate"}), True)
    assert refs("return $(name).all();") == (frozenset(), True)
    assert refs("return $(`Budget · ${n}`).all();") == (frozenset(), True)
    # The real node that stopped the photo check on 21 Oct 2026.
    flow = load_flow("midas_a7.flows.analysis_only")
    assert flow.nodes["Return verified reader pointers"].referenced_nodes == (frozenset({"Validate analysis originals"}), True)


async def test_a_script_can_read_a_node_whose_name_it_builds_at_run_time(executor):
    flow = make_flow([
        node("Start", "manualTrigger"),
        node("Budget · 03 · Ticket", "code", {"jsCode": "return [{json:{n:3}}];"}, (200, 0)),
        node("Pointers", "code", {"jsCode": "const n='03';return [{json:{seen:$('Budget · '+n+' · Ticket').first().json.n}}];"}, (400, 0)),
    ], link(("Start", "Budget · 03 · Ticket"), ("Budget · 03 · Ticket", "Pointers")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    assert ex.latest_output("Pointers") == [{"json": {"seen": 3}}]
