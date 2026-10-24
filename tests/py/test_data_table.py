"""Data Table node: insert/get/update/upsert/delete on the SQL-backed tables, coercion, filters and seeding."""

from __future__ import annotations

import json
import re
import time

import pytest
from conftest import link, make_flow, run_flow

from midas_a7.nodes.data_table import SEEDED_TABLES, seed_reference_tables, seed_reference_tables_sync

RUNS, VAULT, CATALOGUE = "l0roUCBwIQL3h9Eq", "Tyn4UT6BmIYMHAYl", "lwJbRv4TVqlFTILl"
MODELS, PROFILES = "eso9cF84jXYIGu5S", "AgXKkFbIj5dQAnvn"
ISO_MS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def rl(table_id: str) -> dict:
    return {"__rl": True, "mode": "id", "value": table_id}


def columns(values: dict) -> dict:
    return {"mappingMode": "defineBelow", "value": values}


def conds(*pairs, **kw) -> dict:
    """filters.conditions from (keyName, keyValue[, condition]) tuples."""
    out = []
    for p in pairs:
        c = {"keyName": p[0], "keyValue": p[1]}
        if len(p) > 2:
            c["condition"] = p[2]
        out.append(c)
    return {"conditions": out}


async def run(executor, params: dict, items: list[dict] | None = None, version: float = 1.1, **node_extra):
    """Run one Data Table node on `items` (json dicts) and return (execution, its output items)."""
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
        {"name": "DT", "type": "n8n-nodes-base.dataTable", "typeVersion": version, "position": [200, 0],
         "parameters": params, **node_extra},
    ], link(("Start", "DT")))
    ex = await run_flow(executor, flow, [{"json": j} for j in (items if items is not None else [{}])])
    return ex, (ex.latest_output("DT") or [])


def put(services, table_id: str, **values) -> dict:
    """Insert a row straight into the store (every column of the table, NULL when not given)."""
    cols = [c["name"] for c in services.schemas[table_id]["columns"]]
    return services.store.dt_insert(table_id, {c: values.get(c) for c in cols})


def jsons(items: list[dict]) -> list[dict]:
    return [i["json"] for i in items]


# ---------- insert ----------
async def test_insert_is_the_default_operation_and_fills_nulls(executor, services):
    params = {"dataTableId": rl(RUNS), "columns": columns({
        "run_id": "r1", "stage": "01 Intake & observe", "status": "received", "brief_version": 1})}
    ex, out = await run(executor, params)
    assert ex.status == "success", ex.error
    [row] = jsons(out)
    schema_cols = [c["name"] for c in services.schemas[RUNS]["columns"]]
    # Same shape as the recorded "Log received" output: table columns in order, then id, createdAt, updatedAt.
    assert list(row) == schema_cols + ["id", "createdAt", "updatedAt"]
    assert row["run_id"] == "r1" and row["brief_version"] == 1 and isinstance(row["brief_version"], int)
    assert row["hold_reason"] is None and row["go1_rounds"] is None and row["trail"] is None
    assert isinstance(row["id"], int) and ISO_MS.match(row["createdAt"]) and row["createdAt"] == row["updatedAt"]
    assert out[0]["pairedItem"] == {"item": 0}
    assert services.store.dt_count(RUNS) == 1


async def test_insert_coerces_values_to_the_column_type(executor):
    # number column: numeric strings, booleans and blank strings follow JavaScript's Number(); string column: kept as text
    params = {"dataTableId": rl(RUNS), "columns": columns({
        "run_id": 12345, "stage": True, "brief_version": "3", "contract_version": "", "go1_rounds": True, "go2_round": " 2.5 "})}
    ex, out = await run(executor, params)
    [row] = jsons(out)
    assert row["run_id"] == "12345" and row["stage"] == "true"
    assert row["brief_version"] == 3 and isinstance(row["brief_version"], int)
    assert row["contract_version"] == 0 and row["go1_rounds"] == 1 and row["go2_round"] == 2.5


async def test_insert_boolean_column(executor):
    base = {"sku": 174770, "name": "x"}
    for given, expected in (("false", False), ("TRUE", True), (1, True), ("0", False), (False, False)):
        ex, out = await run(executor, {"dataTableId": rl(CATALOGUE), "columns": columns({**base, "active": given})})
        assert jsons(out)[0]["active"] is expected, given
        assert jsons(out)[0]["sku"] == "174770"
    ex, out = await run(executor, {"dataTableId": rl(CATALOGUE), "columns": columns({"active": "maybe"})})
    assert ex.status == "error"
    assert "does not match column type 'boolean'" in ex.error["message"]


async def test_insert_validation_errors_stop_the_node_and_insert_nothing(executor, services):
    cases = [
        ("brief_version", "abc", "Validation error with data table request: value 'abc' does not match column type "
                                "'number': 'brief_version' expects a number but we got 'abc'"),
        ("nope", "x", "Validation error with data table request: unknown column name 'nope'"),
        ("status", {"a": 1}, 'unexpected object input \'{"a":1}\' in row 1'),
        ("status", ["a"], "unexpected array input '[\"a\"]' in row 1"),
    ]
    for column, bad, message in cases:
        # two input items; only the second carries the bad value, and the first row must not be written either
        value = {"run_id": "={{ $json.run_id }}", column: "={{ $json.bad ? " + json.dumps(bad) + " : undefined }}"}
        ex, _ = await run(executor, {"dataTableId": rl(RUNS), "columns": columns(value)},
                          [{"run_id": "ok", "bad": False}, {"run_id": "bad", "bad": True}])
        assert ex.status == "error", column
        assert ex.error["message"] == message, ex.error["message"]
        assert services.store.dt_count(RUNS) == 0


async def test_insert_continue_on_fail_returns_the_input_items_with_an_error(executor, services):
    params = {"dataTableId": rl(RUNS), "columns": columns({"status": "={{ $json.obj }}"})}
    ex, out = await run(executor, params, [{"obj": {"a": 1}}, {"obj": {"b": 2}}], onError="continueRegularOutput")
    assert ex.status == "success"
    assert len(out) == 2
    # n8n maps the whole input items into json on this path (a quirk of its bulk branch): the data sits one level deeper
    assert out[0]["json"]["json"] == {"obj": {"a": 1}}
    assert out[0]["error"]["name"] == "NodeOperationError" and "unexpected object input" in out[0]["error"]["message"]
    assert services.store.dt_count(RUNS) == 0


async def test_insert_one_row_per_input_item_with_item_expressions(executor, services):
    params = {"dataTableId": rl(VAULT), "columns": columns({
        "run_id": "run-1", "kind": "={{ $json.kind }}", "step": "={{ $json.step }}", "at": "={{ 'T' + $json.step }}"})}
    ex, out = await run(executor, params, [{"kind": "a", "step": 1}, {"kind": "b", "step": "2"}, {"kind": "c", "step": 3}])
    rows = jsons(out)
    assert [(r["kind"], r["step"], r["at"]) for r in rows] == [("a", 1, "T1"), ("b", 2, "T2"), ("c", 3, "T3")]
    assert [o["pairedItem"] for o in out] == [{"item": 0}, {"item": 1}, {"item": 2}]
    assert rows[0]["id"] < rows[1]["id"] < rows[2]["id"]
    assert services.store.dt_count(VAULT) == 3


async def test_insert_optimize_bulk_returns_only_the_count(executor, services):
    params = {"dataTableId": rl(CATALOGUE), "columns": columns({"sku": "={{ $json.sku }}"}), "options": {"optimizeBulk": True}}
    ex, out = await run(executor, params, [{"sku": "1"}, {"sku": "2"}], version=1.1)
    assert jsons(out) == [{"success": True, "insertedRows": 2}]
    assert [r["sku"] for r in services.store.dt_select(CATALOGUE)] == ["1", "2"]


async def test_insert_with_an_expression_table_id_runs_per_item(executor, services):
    params = {"dataTableId": {"__rl": True, "mode": "id", "value": "={{ $json.table }}"},
              "columns": columns({"run_id": "={{ $json.run_id }}", "kind": "={{ $json.run_id }}"})}
    ex, out = await run(executor, params, [{"table": RUNS, "run_id": "a"}, {"table": VAULT, "run_id": "b"}])
    assert ex.status == "error"  # the runs table has no 'kind' column
    assert "unknown column name 'kind'" in ex.error["message"]
    params["columns"] = columns({"run_id": "={{ $json.run_id }}"})
    ex, out = await run(executor, params, [{"table": RUNS, "run_id": "a"}, {"table": VAULT, "run_id": "b"}])
    assert ex.status == "success", ex.error
    assert [o["pairedItem"] for o in out] == [{"item": 0}, {"item": 0}]
    assert services.store.dt_count(RUNS) == 1 and services.store.dt_count(VAULT) == 1


async def test_auto_map_input_data_drops_system_columns(executor, services):
    params = {"dataTableId": rl(CATALOGUE), "columns": {"mappingMode": "autoMapInputData"}}
    item = {"id": 99, "createdAt": "2020-01-01T00:00:00.000Z", "updatedAt": "2020-01-01T00:00:00.000Z", "sku": "S1", "active": True}
    ex, out = await run(executor, params, [item])
    [row] = jsons(out)
    assert row["sku"] == "S1" and row["active"] is True and row["id"] != 99 and row["createdAt"] != "2020-01-01T00:00:00.000Z"
    ex, out = await run(executor, params, [{"sku": "S2", "not_a_column": 1}])
    assert ex.status == "error" and "unknown column name 'not_a_column'" in ex.error["message"]


async def test_unknown_table_is_an_error(executor):
    ex, _ = await run(executor, {"dataTableId": rl("nope"), "columns": columns({"a": 1})})
    assert ex.status == "error"
    assert ex.error["message"] == "Data table with ID 'nope' could not be found in this project"


async def test_date_columns_are_stored_as_utc_iso(executor, services):
    services.schemas["dates"] = {"id": "dates", "name": "Dates", "columns": [
        {"name": "label", "type": "string"}, {"name": "due", "type": "date"}]}
    ex, out = await run(executor, {"dataTableId": rl("dates"), "columns": columns({"label": "a", "due": "2026-10-20 10:30:00"})})
    assert jsons(out)[0]["due"] == "2026-10-20T10:30:00.000Z"
    ex, out = await run(executor, {"dataTableId": rl("dates"), "columns": columns({"label": "b", "due": "2026-10-20T12:30:00+02:00"})})
    assert jsons(out)[0]["due"] == "2026-10-20T10:30:00.000Z"
    ex, out = await run(executor, {"dataTableId": rl("dates"), "columns": columns({"label": "c", "due": "2026-11-01"})})
    assert jsons(out)[0]["due"] == "2026-11-01T00:00:00.000Z"
    ex, _ = await run(executor, {"dataTableId": rl("dates"), "columns": columns({"due": "not a date"})})
    assert ex.status == "error" and "does not match column type 'date'" in ex.error["message"]
    # date filters compare instants
    flt = {"dataTableId": rl("dates"), "operation": "get", "returnAll": True,
           "filters": conds(("due", "2026-10-31T00:00:00Z", "gt"))}
    ex, out = await run(executor, flt)
    assert [r["label"] for r in jsons(out)] == ["c"]


# ---------- get ----------
@pytest.fixture
def runs(services):
    rows = {
        "a": put(services, RUNS, run_id="a", client_run_id="c1", status="received", brief_version=1, stage="01"),
        "b": put(services, RUNS, run_id="b", client_run_id="c1", status="held", brief_version=2, stage="02"),
        "c": put(services, RUNS, run_id="c", client_run_id="c2", status="held", brief_version=None, stage=""),
    }
    return rows


GET = {"operation": "get", "dataTableId": rl(RUNS), "returnAll": True}


async def test_get_all_rows_and_system_columns(executor, runs):
    ex, out = await run(executor, GET)
    rows = jsons(out)
    assert [r["run_id"] for r in rows] == ["a", "b", "c"]
    assert [o["pairedItem"] for o in out] == [{"item": 0}] * 3
    assert all(ISO_MS.match(r["createdAt"]) and ISO_MS.match(r["updatedAt"]) for r in rows)
    assert list(rows[0])[-3:] == ["id", "createdAt", "updatedAt"]


async def test_get_match_type_defaults_to_any_condition(executor, runs):
    # "15a Load operations" has two conditions and no matchType: n8n's default is anyCondition (OR)
    ex, out = await run(executor, {**GET, "filters": conds(("run_id", "a"), ("status", "held"))})
    assert [r["run_id"] for r in jsons(out)] == ["a", "b", "c"]
    ex, out = await run(executor, {**GET, "matchType": "allConditions", "filters": conds(("run_id", "b"), ("status", "held"))})
    assert [r["run_id"] for r in jsons(out)] == ["b"]
    ex, out = await run(executor, {**GET, "matchType": "allConditions", "filters": conds(("run_id", "a"), ("status", "held"))})
    assert out == []


async def test_get_eq_is_case_sensitive_and_empty_result_has_no_items(executor, runs):
    ex, out = await run(executor, {**GET, "filters": conds(("status", "HELD"))})
    assert ex.status == "success" and out == []
    ex, out = await run(executor, {**GET, "filters": conds(("status", "held"))}, alwaysOutputData=True)
    assert [r["run_id"] for r in jsons(out)] == ["b", "c"]
    ex, out = await run(executor, {**GET, "filters": conds(("status", "nothing"))}, alwaysOutputData=True)
    assert jsons(out) == [{}]  # the executor's alwaysOutputData, not the node


async def test_get_limit_defaults_to_50_and_return_all_ignores_it(executor, services):
    for n in range(60):
        put(services, VAULT, run_id="r", step=n)
    base = {"operation": "get", "dataTableId": rl(VAULT)}
    ex, out = await run(executor, base)
    assert len(out) == 50
    ex, out = await run(executor, {**base, "limit": 7})
    assert [r["step"] for r in jsons(out)] == list(range(7))
    ex, out = await run(executor, {**base, "limit": 7, "returnAll": True})
    assert len(out) == 60
    ex, out = await run(executor, {**base, "limit": 1001})
    assert len(out) == 60


async def test_get_order_by_defaults_to_descending(executor, services, runs):
    time.sleep(0.01)
    services.store.dt_update(RUNS, [runs["b"]["id"]], {"status": "touched"})
    time.sleep(0.01)
    services.store.dt_update(RUNS, [runs["a"]["id"]], {"status": "touched"})  # updatedAt order is now c < b < a
    base = {**GET, "orderBy": True, "orderByColumn": "updatedAt"}
    ex, out = await run(executor, base)
    assert [r["run_id"] for r in jsons(out)] == ["a", "b", "c"]
    ex, out = await run(executor, {**base, "orderByDirection": "ASC"})
    assert [r["run_id"] for r in jsons(out)] == ["c", "b", "a"]
    ex, out = await run(executor, {**base, "returnAll": False, "limit": 2})
    assert [r["run_id"] for r in jsons(out)] == ["a", "b"]


async def test_get_order_by_user_column_ties_by_id_and_nulls(executor, runs):
    base = {**GET, "orderBy": True, "orderByColumn": "brief_version", "orderByDirection": "ASC"}
    ex, out = await run(executor, base)
    assert [r["run_id"] for r in jsons(out)] == ["a", "b", "c"]  # NULL last when ascending
    ex, out = await run(executor, {**base, "orderByDirection": "DESC"})
    assert [r["run_id"] for r in jsons(out)] == ["c", "b", "a"]  # NULL first when descending
    ex, out = await run(executor, {**base, "orderByColumn": "status"})
    assert [r["run_id"] for r in jsons(out)] == ["b", "c", "a"]  # 'held' twice: id ascending breaks the tie
    ex, out = await run(executor, {**base, "orderByColumn": "missing"})
    assert ex.status == "error" and ex.error["message"] == "Specified column does not exist"


async def test_get_filters_on_numbers_ids_and_nulls(executor, runs):
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", "2"))})
    assert [r["run_id"] for r in jsons(out)] == ["b"]  # numeric string against a number column
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", 1, "gt"))})
    assert [r["run_id"] for r in jsons(out)] == ["b"]
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", 2, "lte"))})
    assert [r["run_id"] for r in jsons(out)] == ["a", "b"]  # NULL is neither
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", 1, "neq"))})
    assert [r["run_id"] for r in jsons(out)] == ["b", "c"]  # neq keeps NULL rows
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", "", "isEmpty"))})
    assert [r["run_id"] for r in jsons(out)] == ["c"]
    ex, out = await run(executor, {**GET, "filters": conds(("stage", "", "isEmpty"))})
    assert [r["run_id"] for r in jsons(out)] == ["c"]  # string columns: '' counts as empty
    ex, out = await run(executor, {**GET, "filters": conds(("stage", "", "isNotEmpty"))})
    assert [r["run_id"] for r in jsons(out)] == ["a", "b"]
    ex, out = await run(executor, {**GET, "filters": conds(("id", str(runs["b"]["id"])))})
    assert [r["run_id"] for r in jsons(out)] == ["b"]
    ex, out = await run(executor, {**GET, "filters": conds(("brief_version", "abc"))})
    assert ex.status == "error" and "does not match column type 'number'" in ex.error["message"]
    ex, out = await run(executor, {**GET, "filters": conds(("nope", "x"))})
    assert ex.status == "error" and 'Column(s) "nope" do not exist' in ex.error["message"]


async def test_get_like_ilike_and_boolean_filters(executor, services):
    put(services, CATALOGUE, sku="1", name="CHALLVOR centre table", active=True)
    put(services, CATALOGUE, sku="2", name="Dining table_set", active=False)
    put(services, CATALOGUE, sku="3", name="Sofa", active=None)
    base = {"operation": "get", "dataTableId": rl(CATALOGUE), "returnAll": True}
    ex, out = await run(executor, {**base, "filters": conds(("name", "table", "like"))})
    assert [r["sku"] for r in jsons(out)] == ["1", "2"]
    ex, out = await run(executor, {**base, "filters": conds(("name", "TABLE", "like"))})
    assert out == []
    ex, out = await run(executor, {**base, "filters": conds(("name", "TABLE", "ilike"))})
    assert [r["sku"] for r in jsons(out)] == ["1", "2"]
    ex, out = await run(executor, {**base, "filters": conds(("name", "table_set", "like"))})  # '_' is literal
    assert [r["sku"] for r in jsons(out)] == ["2"]
    ex, out = await run(executor, {**base, "filters": conds(("name", "Sofa%", "like"))})
    assert [r["sku"] for r in jsons(out)] == ["3"]
    ex, out = await run(executor, {**base, "filters": conds(("active", "", "isTrue"))})
    assert [r["sku"] for r in jsons(out)] == ["1"]
    ex, out = await run(executor, {**base, "filters": conds(("active", "", "isFalse"))})
    assert [r["sku"] for r in jsons(out)] == ["2"]


async def test_get_equality_on_string_columns_is_prefiltered_in_sql_but_checked_in_python(executor, services, runs, monkeypatch):
    calls = []
    real = services.store.dt_select

    def spy(table_id, equals=None):
        calls.append(equals)
        return real(table_id, equals)

    monkeypatch.setattr(services.store, "dt_select", spy)
    ex, out = await run(executor, {**GET, "matchType": "allConditions", "filters": conds(("run_id", "a"), ("brief_version", 1))})
    assert [r["run_id"] for r in jsons(out)] == ["a"]
    assert calls == [{"run_id": "a"}]  # string eq goes to SQL, the number condition stays in Python
    calls.clear()
    ex, out = await run(executor, {**GET, "filters": conds(("run_id", "a"), ("run_id", "b"))})  # anyCondition: no prefilter
    assert [r["run_id"] for r in jsons(out)] == ["a", "b"] and calls == [None]
    calls.clear()
    ex, out = await run(executor, {**GET, "filters": conds(("id", runs["a"]["id"]))})
    assert [r["run_id"] for r in jsons(out)] == ["a"] and calls == [None]


async def test_type_version_1_behaves_the_same(executor, runs):
    ex, out = await run(executor, {**GET, "filters": conds(("run_id", "b"))}, version=1)
    assert [r["run_id"] for r in jsons(out)] == ["b"]


# ---------- update ----------
def update_params(filters: dict, values: dict, **extra) -> dict:
    return {"operation": "update", "dataTableId": rl(RUNS), "matchType": "allConditions", "filters": filters,
            "columns": columns(values), **extra}


async def test_update_returns_the_updated_rows_and_leaves_others(executor, services, runs):
    before = {r["run_id"]: r for r in services.store.dt_select(RUNS)}
    time.sleep(0.01)
    ex, out = await run(executor, update_params(conds(("run_id", "b")), {"status": "done", "go1_rounds": "4"}))
    assert ex.status == "success", ex.error
    [row] = jsons(out)
    assert row["run_id"] == "b" and row["status"] == "done" and row["go1_rounds"] == 4 and row["brief_version"] == 2
    assert row["id"] == before["b"]["id"] and row["createdAt"] == before["b"]["createdAt"]
    assert row["updatedAt"] > before["b"]["updatedAt"]
    assert out[0]["pairedItem"] == {"item": 0}
    after = {r["run_id"]: r for r in services.store.dt_select(RUNS)}
    assert after["a"] == before["a"] and after["c"] == before["c"]
    assert after["b"]["status"] == "done"


async def test_update_matches_several_rows_and_none(executor, services, runs):
    ex, out = await run(executor, update_params(conds(("client_run_id", "c1")), {"stage": "03"}))
    assert [r["run_id"] for r in jsons(out)] == ["a", "b"] and {r["stage"] for r in jsons(out)} == {"03"}
    ex, out = await run(executor, update_params(conds(("run_id", "zzz")), {"stage": "04"}))
    assert ex.status == "success" and out == []
    assert {r["stage"] for r in services.store.dt_select(RUNS) if r["run_id"] in ("a", "b")} == {"03"}


async def test_update_per_item_filters_by_row_id_and_sets_null_for_missing_values(executor, services, runs):
    params = update_params({"conditions": [{"keyName": "id", "condition": "eq", "keyValue": "={{ $json.row_id }}"}]},
                           {"status": "={{ $json.status }}", "stage": "={{ $json.nothing }}"})
    items = [{"row_id": runs["a"]["id"], "status": "x"}, {"row_id": str(runs["c"]["id"]), "status": "y"}]
    ex, out = await run(executor, params, items)
    assert [(r["run_id"], r["status"], r["stage"]) for r in jsons(out)] == [("a", "x", None), ("c", "y", None)]
    assert [o["pairedItem"] for o in out] == [{"item": 0}, {"item": 1}]
    assert [r["status"] for r in services.store.dt_select(RUNS)] == ["x", "held", "y"]


async def test_update_needs_a_condition_and_data(executor, runs):
    ex, _ = await run(executor, update_params({}, {"status": "x"}))
    assert ex.status == "error" and ex.error["message"] == "At least one condition is required"
    ex, _ = await run(executor, update_params(conds(("run_id", "a")), {}))
    assert ex.status == "error" and ex.error["message"].endswith("Data columns must not be empty")


async def test_update_continue_on_fail_keeps_the_item(executor, runs):
    ex, out = await run(executor, update_params({}, {"status": "x"}), [{"keep": 1}], onError="continueRegularOutput")
    assert ex.status == "success"
    assert out[0]["json"] == {"keep": 1} and out[0]["error"]["message"] == "At least one condition is required"


async def test_update_dry_run_returns_before_and_after_without_writing(executor, services, runs):
    ex, out = await run(executor, update_params(conds(("run_id", "a")), {"status": "dry"}, options={"dryRun": True}))
    rows = jsons(out)
    assert [r["dryRunState"] for r in rows] == ["before", "after"]
    assert rows[0]["status"] == "received" and rows[1]["status"] == "dry"
    assert [r for r in services.store.dt_select(RUNS) if r["run_id"] == "a"][0]["status"] == "received"


# ---------- upsert, delete, exists ----------
async def test_upsert_updates_a_match_or_inserts(executor, services, runs):
    params = {"operation": "upsert", "dataTableId": rl(RUNS), "matchType": "allConditions",
              "filters": conds(("run_id", "a")), "columns": columns({"status": "upserted"})}
    ex, out = await run(executor, params)
    assert [(r["run_id"], r["status"]) for r in jsons(out)] == [("a", "upserted")]
    assert services.store.dt_count(RUNS) == 3
    params["filters"] = conds(("run_id", "new"))
    params["columns"] = columns({"run_id": "new", "status": "fresh"})
    ex, out = await run(executor, params)
    assert [(r["run_id"], r["status"]) for r in jsons(out)] == [("new", "fresh")]
    assert services.store.dt_count(RUNS) == 4


async def test_delete_rows_returns_what_it_deleted(executor, services, runs):
    params = {"operation": "deleteRows", "dataTableId": rl(RUNS), "matchType": "allConditions", "filters": conds(("status", "held"))}
    ex, out = await run(executor, params)
    assert [r["run_id"] for r in jsons(out)] == ["b", "c"]
    assert [r["run_id"] for r in services.store.dt_select(RUNS)] == ["a"]
    ex, out = await run(executor, {**params, "filters": {}})
    assert ex.status == "error" and ex.error["message"] == "At least one condition is required"


async def test_row_exists_and_not_exists_pass_the_input_item_on(executor, runs):
    base = {"dataTableId": rl(RUNS), "matchType": "allConditions", "filters": conds(("run_id", "={{ $json.k }}"))}
    items = [{"k": "a", "extra": 1}, {"k": "zzz"}]
    ex, out = await run(executor, {**base, "operation": "rowExists"}, items)
    assert jsons(out) == [{"k": "a", "extra": 1}]
    ex, out = await run(executor, {**base, "operation": "rowNotExists"}, items)
    assert jsons(out) == [{"k": "zzz"}]


# ---------- seeding ----------
async def test_seed_reference_tables_fills_only_empty_tables(services, executor):
    put(services, PROFILES, profile_id="mine", name="Mine")  # not empty: must stay as it is
    counts = await seed_reference_tables(services)
    assert counts == {MODELS: 2, PROFILES: 0, CATALOGUE: 428}
    assert [r["profile_id"] for r in services.store.dt_select(PROFILES)] == ["mine"]
    assert await seed_reference_tables(services) == {MODELS: 0, PROFILES: 0, CATALOGUE: 0}
    assert services.store.dt_count(CATALOGUE) == 428 and services.store.dt_count(MODELS) == 2

    ex, out = await run(executor, {"operation": "get", "dataTableId": rl(CATALOGUE), "returnAll": True,
                                   "filters": conds(("sku", "141368"))})
    [row] = jsons(out)
    assert row["name"] == "CHALLVOR centre table" and row["active"] is True and row["stock_checked"] is None
    ex, out = await run(executor, {"operation": "get", "dataTableId": rl(MODELS), "returnAll": True})
    models = jsons(out)
    assert len(models) == 2 and models[0]["model_id"] == "gemini-nano-banana-2.1"
    assert isinstance(models[0]["priority"], int) and models[0]["input_usd_per_m"] == 1.5


async def test_seed_reference_tables_sync_loads_all_three(services):
    counts = seed_reference_tables_sync(services.store, services.schemas, services.settings.seeds_dir)
    assert counts == {MODELS: 2, PROFILES: 44, CATALOGUE: 428}
    assert set(counts) == set(SEEDED_TABLES)


# ---------- through the executor ----------
def _node(name, typ, params, pos, version=1, **extra):
    return {"name": name, "type": f"n8n-nodes-base.{typ}", "typeVersion": version, "position": list(pos), "parameters": params, **extra}


async def test_flow_inserts_then_reads_back_with_an_expression_value(executor, services):
    make = "return [{json:{run_id:'run-7', kind:'brief', step:1}}, {json:{run_id:'run-7', kind:'review', step:'2'}}, {json:{run_id:'other', kind:'brief', step:3}}];"
    flow = make_flow([
        _node("Start", "manualTrigger", {}, (0, 0)),
        _node("Make", "code", {"jsCode": make}, (200, 0), 2),
        _node("Save", "dataTable", {"dataTableId": rl(VAULT), "columns": columns({
            "run_id": "={{ $json.run_id }}", "kind": "={{ $json.kind }}", "step": "={{ $json.step }}",
            "at": "={{ $now.toUTC().toFormat('yyyy-MM-dd') }}"})}, (400, 0), 1.1),
        _node("Read", "dataTable", {"operation": "get", "dataTableId": rl(VAULT), "matchType": "allConditions",
                                    "filters": {"conditions": [{"keyName": "run_id", "keyValue": "={{ $json.run_id }}"},
                                                               {"keyName": "kind", "keyValue": "review"}]},
                                    "returnAll": True}, (600, 0), 1.1, executeOnce=True, alwaysOutputData=True),
        _node("Check", "code", {"jsCode": "return [{json:{n:$input.all().length, ids:$('Save').all().map(i=>i.json.id), "
                                          "step:$input.first().json.step, created:typeof $input.first().json.createdAt}}];"},
              (800, 0), 2),
    ], link(("Start", "Make"), ("Make", "Save"), ("Save", "Read"), ("Read", "Check")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    assert len(ex.latest_output("Save")) == 3
    read = jsons(ex.latest_output("Read"))
    assert [(r["run_id"], r["kind"], r["step"]) for r in read] == [("run-7", "review", 2)]
    check = jsons(ex.latest_output("Check"))[0]
    assert check["n"] == 1 and check["step"] == 2 and check["created"] == "string" and len(check["ids"]) == 3
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", read[0]["at"])


async def test_flow_read_of_a_missing_row_gives_one_empty_item_with_always_output_data(executor):
    flow = make_flow([
        _node("Start", "manualTrigger", {}, (0, 0)),
        _node("Read", "dataTable", {"operation": "get", "dataTableId": rl(RUNS), "matchType": "allConditions",
                                    "filters": conds(("run_id", "={{ ($json.body && $json.body.id) || 'none' }}")),
                                    "returnAll": True}, (200, 0), 1.1, alwaysOutputData=True),
        _node("After", "noOp", {}, (400, 0), 1),
    ], link(("Start", "Read"), ("Read", "After")))
    ex = await run_flow(executor, flow, [{"json": {"body": {"id": "missing"}}}])
    assert ex.latest_output("After") == [{"json": {}}]


# ---------- every Data Table node of the frozen flows ----------
def _flow_data_table_nodes() -> list[tuple[str, dict]]:
    import importlib
    import pkgutil

    import midas_a7.flows as flows

    found = []
    for mod in pkgutil.iter_modules(flows.__path__):
        if mod.ispkg:
            flow = importlib.import_module(f"midas_a7.flows.{mod.name}").FLOW
            found += [(f"{mod.name}:{n['name']}", n) for n in flow["nodes"] if n["type"] == "n8n-nodes-base.dataTable"]
    return found


def _with_sample_values(node: dict, schemas: dict) -> dict:
    """The node's real parameters, with every expression replaced by a value of the column's type."""
    import copy

    params = copy.deepcopy(node["parameters"])
    types = {**{"id": "number", "createdAt": "date", "updatedAt": "date"},
             **{c["name"]: c["type"] for c in schemas[params["dataTableId"]["value"]]["columns"]}}
    sample = lambda t: {"number": 1, "boolean": True, "date": "2026-10-20T10:00:00Z"}.get(t, "x")  # noqa: E731
    for k, v in (params.get("columns", {}).get("value") or {}).items():
        if isinstance(v, str) and v.startswith("="):
            params["columns"]["value"][k] = sample(types[k])
    for cond in params.get("filters", {}).get("conditions", []):
        if isinstance(cond.get("keyValue"), str) and cond["keyValue"].startswith("="):
            cond["keyValue"] = sample(types[cond["keyName"]])
    return params


@pytest.mark.parametrize("label,node", _flow_data_table_nodes(), ids=[n[0] for n in _flow_data_table_nodes()])
async def test_every_data_table_node_of_the_flows_runs(label, node, executor, services):
    params = _with_sample_values(node, services.schemas)
    table_id = params["dataTableId"]["value"]
    extra = {k: v for k, v in node.items() if k in ("onError", "alwaysOutputData", "executeOnce")}
    ex, out = await run(executor, params, [{}], version=node["typeVersion"], **extra)
    assert ex.status == "success", (label, ex.error)
    if params.get("operation", "insert") == "insert":
        assert services.store.dt_count(table_id) == 1
        if params.get("options", {}).get("optimizeBulk"):
            assert jsons(out) == [{"success": True, "insertedRows": 1}]
        else:
            assert len(out) == 1 and list(jsons(out)[0])[-3:] == ["id", "createdAt", "updatedAt"]
    else:  # the tables start empty: nothing to get, nothing to update (alwaysOutputData is the executor's doing)
        assert jsons(out) == ([{}] if node.get("alwaysOutputData") else [])


async def test_real_log_received_and_update_run_row_nodes_chain(executor, services):
    """The two A7 nodes with their real parameters: shape of the recorded n8n outputs (exec 1591), then an update."""
    import copy
    import importlib

    nodes = {n["name"]: n for n in importlib.import_module("midas_a7.flows.a7_main").FLOW["nodes"]}
    log, upd = copy.deepcopy(nodes["Log received"]), copy.deepcopy(nodes["Update run row"])
    make = ("return [{json:{run_id:'claude-a7-1', client_run_id:'owner-1', parent_run_id:'', received_at:'2026-10-20T14:02:49.000Z',"
            " brief:{job_type:'new_project', outcomes:['lifestyle'], outputs:[{id:'white_master',kind:'white'}]},"
            " references:[{name:'p1', role:'product', sha256:'ab', bytes:12, extra:'dropped'}], not_applied:[], trail:[{name:'01', at:'t'}]}}];")
    after = ("return [{json:{run_id:$json.run_id, row:{status:'awaiting_go_1', stage:'03 Retrieve & style', hold_reason:'',"
             " contract_version:1, contract_stamp:'sha256:abc', required_outputs:'[]'}}}];")
    flow = make_flow([
        _node("Start", "manualTrigger", {}, (0, 0)),
        _node("Make", "code", {"jsCode": make}, (200, 0), 2),
        {**{k: v for k, v in log.items() if k != "credentials"}, "position": [400, 0]},
        _node("Shape", "code", {"jsCode": after}, (600, 0), 2),
        {**{k: v for k, v in upd.items() if k != "credentials"}, "position": [800, 0]},
    ], link(("Start", "Make"), ("Make", "Log received"), ("Log received", "Shape"), ("Shape", "Update run row")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    [first] = jsons(ex.latest_output("Log received"))
    assert first["run_id"] == "claude-a7-1" and first["parent_run_id"] == "" and first["job_type"] == "new_project"
    assert first["stage"] == "01 Intake & observe" and first["status"] == "received" and first["brief_version"] == 1
    assert first["outcomes"] == '["lifestyle"]' and first["execution_id"] == "1"
    assert first["references"] == '[{"name":"p1","role":"product","sha256":"ab","bytes":12}]'
    assert first["hold_reason"] is None and first["contract_version"] is None and first["go1_rounds"] is None
    [second] = jsons(ex.latest_output("Update run row"))
    assert second["id"] == first["id"] and second["createdAt"] == first["createdAt"]
    assert (second["status"], second["stage"], second["hold_reason"], second["contract_version"]) == ("awaiting_go_1", "03 Retrieve & style", "", 1)
    assert second["job_type"] == "new_project" and second["parent_run_id"] == "" and second["go1_decision"] is None
    assert services.store.dt_count(RUNS) == 1
