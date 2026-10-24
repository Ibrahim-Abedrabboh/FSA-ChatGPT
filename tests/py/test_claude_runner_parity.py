"""Differential replay of the recorded A7 intake through Go 1."""

from __future__ import annotations

import gzip
import importlib.util
import json
import re
import sys
from pathlib import Path

import httpx

from midas_a7.engine.executor import Execution as OldExecution
from midas_a7.engine.executor import Executor as OldExecutor
from midas_a7.engine.model import load_flow as old_load_flow
from midas_a7.nodes import all_handlers as old_handlers


ROOT = Path(__file__).resolve().parents[2]
FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"
OUTSIDE = {"httpRequest", "dataTable", "openAi", "anthropic", "googleGemini", "googleDrive", "editImage"}
REFERENCE_READS = {"07a Load handling profiles": "AgXKkFbIj5dQAnvn", "10a Load Midas catalogue": "lwJbRv4TVqlFTILl"}
VARIES = {"go1_token", "requestSha256"}
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z")


def normalized(value) -> str:
    def walk(item):
        if isinstance(item, dict):
            return {key: ("<varies>" if key in VARIES and val else walk(val))
                    for key, val in item.items() if key != "pairedItem"}
        if isinstance(item, list):
            return [walk(val) for val in item]
        return item

    return TIMESTAMP.sub("<ts>", json.dumps(walk(value), sort_keys=True, ensure_ascii=False))


async def execute_recording(flow, services, execution_type, executor_type, handlers_factory, recording, seeds):
    recorded = recording["runData"]

    async def replay(ctx):
        if ctx.node.name in REFERENCE_READS:
            table_id = REFERENCE_READS[ctx.node.name]
            return [[{"json": row} for row in seeds[table_id]["rows"]]]
        return recorded[ctx.node.name][ctx.run_index]["main"]

    handlers = dict(handlers_factory())
    for kind in OUTSIDE:
        handlers[kind] = replay
    real = dict(handlers)

    async def pick(ctx):
        if ctx.node.name == "02 Ingest files":
            return await replay(ctx)
        return await real[ctx.node.kind](ctx)

    executor = executor_type(services, {kind: pick for kind in handlers})
    execution = execution_type(id=recording["execution_id"], flow_id=flow.id)
    execution.resume_url = recording["resume_url"]
    trigger = flow.nodes["A7 job webhook"]
    trigger_items = recorded["A7 job webhook"][0]["main"][0]
    await executor.start(flow, execution, trigger, trigger_items)
    return execution


async def test_run_1591_old_service_and_runner_match_node_by_node(services, monkeypatch, tmp_path):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    monkeypatch.setenv("MIDAS_RUNNER_HOME", str(tmp_path / "runner-runtime"))
    spec = importlib.util.spec_from_file_location("claude_runner_parity", ROOT / "claude-runner" / "runner.py")
    assert spec and spec.loader
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)
    runner.runner_setup()
    recording = json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())
    seeds = {table_id: json.loads((ROOT / "src" / "midas_a7" / "data" / "seeds" / f"{table_id}.json").read_text())
             for table_id in REFERENCE_READS.values()}

    old = await execute_recording(old_load_flow("midas_a7.flows.a7_main"), services,
                                  OldExecution, OldExecutor, old_handlers, recording, seeds)

    store = runner.store__Store("sqlite://")
    js = runner.engine_jsrunner__JsRunner()
    http = httpx.AsyncClient()
    settings = runner.config__Settings(database_url="sqlite://", public_base_url="https://a7.test")
    new_services = runner.engine_services__Services(
        settings=settings, store=store, js=js, binaries=runner.engine_binary__BinaryStore(store),
        credentials=runner.config__Credentials(), schemas=runner.store__load_schemas(settings.data_tables_path), http=http,
    )
    try:
        new = await execute_recording(runner.engine_model__load_flow("midas_a7.flows.a7_main"), new_services,
                                      runner.engine_executor__Execution, runner.engine_executor__Executor,
                                      runner.nodes__all_handlers, recording, seeds)
    finally:
        await js.close()
        await http.aclose()
        store.engine.dispose()

    assert old.status == new.status == "waiting"
    assert old.wait["node"] == new.wait["node"] == "Wait for go 1"
    assert list(old.run_data) == list(new.run_data)
    for node in old.run_data:
        old_items = [run["data"] for run in old.run_data[node]]
        new_items = [run["data"] for run in new.run_data[node]]
        assert normalized(old_items) == normalized(new_items), node
