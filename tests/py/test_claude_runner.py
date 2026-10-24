"""Direct, offline checks of the proposed single-file runner."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


RUNNER_PATH = Path(__file__).resolve().parents[2] / "claude-runner" / "runner.py"


@pytest.fixture(scope="module")
def runner(tmp_path_factory):
    import os

    cache = tmp_path_factory.mktemp("runner-cache")
    before = os.environ.get("MIDAS_RUNNER_HOME")
    os.environ["MIDAS_RUNNER_HOME"] = str(cache)
    spec = importlib.util.spec_from_file_location("claude_runner_direct_test", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
        yield module
    finally:
        sys.modules.pop(spec.name, None)
        if before is None:
            os.environ.pop("MIDAS_RUNNER_HOME", None)
        else:
            os.environ["MIDAS_RUNNER_HOME"] = before


def test_verify_and_tampered_code(runner, capsys):
    assert runner.runner_verify() == 0
    node = next(iter(runner.CODE["a7_main"]))
    original = runner.CODE["a7_main"][node]
    runner.CODE["a7_main"][node] = original + " "
    try:
        assert runner.runner_verify() == 1
        assert node in capsys.readouterr().out
    finally:
        runner.CODE["a7_main"][node] = original


def test_verify_rejects_changed_executable_flow_parameter(runner, capsys):
    flow_node = runner.FLOWS["a7_main"]["nodes"][0]
    original = flow_node["parameters"]
    flow_node["parameters"] = {**original, "tampered": True}
    try:
        assert runner.runner_verify() == 1
        assert "executable flow definition" in capsys.readouterr().out
    finally:
        flow_node["parameters"] = original


def test_verify_names_changed_model_prompt(runner, capsys):
    package, call = next((package, call) for package, calls in runner.PROMPT_CATALOG.items()
                         for call in calls if call.get("fields"))
    node = next(node for node in runner.FLOWS[package]["nodes"] if node["name"] == call["node"])
    field = call["fields"][0]
    keys = runner._runner_re.findall(r"[^.\[\]]+", field["path"])
    container = node["parameters"]
    for key in keys[:-1]:
        container = container[int(key)] if isinstance(container, list) else container[key]
    last = int(keys[-1]) if isinstance(container, list) else keys[-1]
    original = container[last]
    container[last] = original + " "
    try:
        assert runner.runner_verify() == 1
        assert call["node"] in capsys.readouterr().out
    finally:
        container[last] = original


def test_health_and_recovery_routes_default_off(runner):
    with TestClient(runner.app__create_app()) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert client.post("/webhook/a7/approved-blind-recovery").status_code == 404
        assert client.post("/webhook/a7/approved-package-recovery").status_code == 404


def test_recovery_route_registration_requires_flag(runner, monkeypatch):
    flows = runner.app__load_flows()
    monkeypatch.setattr(runner, "app__RETIRED_WEBHOOKS", set())
    routes = runner.app__webhook_table(flows)
    assert ("POST", "a7/approved-blind-recovery") in routes
    assert ("POST", "a7/approved-package-recovery") in routes


def test_enabled_recovery_routes_reject_missing_authorization(runner, monkeypatch):
    monkeypatch.setattr(runner, "app__RETIRED_WEBHOOKS", set())
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "synthetic-local-bridge")
    with TestClient(runner.app__create_app()) as client:
        for path in ("a7/approved-blind-recovery", "a7/approved-package-recovery"):
            response = client.post(f"/webhook/{path}", json={"claim": "unapproved"})
            assert response.status_code == 403


def test_enabled_recovery_paths_reject_unapproved_ids_before_external_calls(runner, monkeypatch):
    import httpx

    monkeypatch.setattr(runner, "app__RETIRED_WEBHOOKS", set())
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "synthetic-local-bridge")
    monkeypatch.setenv("A7_BRIDGE_HEADER_NAME", "Authorization")
    calls = []

    def outside(request):
        calls.append((request.method, str(request.url)))
        raise AssertionError("rejected recovery request made an external call")

    with TestClient(runner.app__create_app()) as client:
        client.app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(outside))
        for path in ("a7/approved-blind-recovery", "a7/approved-package-recovery"):
            response = client.post(f"/webhook/{path}", headers={"Authorization": "synthetic-local-bridge"}, json={
                "recoveryId": "unapproved-local-test", "confirmed": True, "capUsd": 0.1, "paidCalls": 0,
            })
            assert response.status_code == 500
        assert calls == []


def test_old_wait_signature_cannot_resume_a_later_wait(runner, monkeypatch):
    monkeypatch.setenv("RESUME_SIGNING_SECRET", "synthetic-resume-secret")
    with TestClient(runner.app__create_app()) as client:
        runtime = client.app.state.runtime
        execution_id = runtime.services.store.create_execution("test-flow")
        runtime.services.store.save_execution(execution_id, "waiting", {
            "id": execution_id, "flow_id": "test-flow", "resume_generation": 1,
            "wait": {"node": "Wait for go 2", "kind": "webhook"},
        }, wait_kind="webhook")
        stale = runtime.signature(execution_id, 1)
        current = runtime.signature(execution_id, 2)
        assert stale != current
        response = client.post(f"/webhook-waiting/{execution_id}?signature={stale}", json={})
        assert response.status_code == 401
        runtime.services.store.save_execution(execution_id, "running", {
            "id": execution_id, "flow_id": "test-flow", "resume_generation": 1,
            "wait": {"node": "Wait for go 2", "kind": "webhook"},
        }, wait_kind="webhook")
        response = client.post(f"/webhook-waiting/{execution_id}?signature={current}", json={})
        assert response.status_code == 409  # signature accepted; execution is deliberately marked running


def test_resume_claim_rechecks_generation_after_signature_validation(runner, monkeypatch):
    monkeypatch.setenv("RESUME_SIGNING_SECRET", "synthetic-resume-secret")
    with TestClient(runner.app__create_app()) as client:
        runtime = client.app.state.runtime
        store = runtime.services.store
        execution_id = store.create_execution("test-flow")
        old_gate = {"id": execution_id, "flow_id": "test-flow", "resume_generation": 0,
                    "wait": {"node": "Wait for go 1", "kind": "webhook"}}
        newer_gate = {**old_gate, "resume_generation": 1, "wait": {"node": "Wait for go 2", "kind": "webhook"}}
        store.save_execution(execution_id, "waiting", old_gate, wait_kind="webhook")
        original = runtime.resume_from_webhook

        async def advance_before_claim(run_id, item, expected_generation=None):
            # Model another request completing Go1 after this request validated its Go1 signature.
            store.save_execution(run_id, "waiting", newer_gate, wait_kind="webhook")
            return await original(run_id, item, expected_generation)

        monkeypatch.setattr(runtime, "resume_from_webhook", advance_before_claim)
        stale = runtime.signature(execution_id, 1)
        response = client.post(f"/webhook-waiting/{execution_id}?signature={stale}", json={})
        assert response.status_code == 409
        row = store.load_execution(execution_id)
        assert row["status"] == "waiting" and row["resume_generation"] == 1


def test_store_adds_generation_column_to_existing_database(runner, tmp_path):
    database = tmp_path / "existing-runner.sqlite"
    engine = runner.store__create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(runner.store__text(
            "CREATE TABLE executions (id INTEGER PRIMARY KEY AUTOINCREMENT, flow_id VARCHAR(64) NOT NULL, "
            "status VARCHAR(16) NOT NULL, state JSON, wait_till DATETIME, wait_kind VARCHAR(16), error JSON, "
            "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"))
    engine.dispose()
    store = runner.store__Store(f"sqlite:///{database}")
    try:
        execution_id = store.create_execution("existing-db")
        assert store.load_execution(execution_id)["resume_generation"] == 0
    finally:
        store.engine.dispose()


def test_former_n8n_host_cannot_go_outbound(runner):
    services = runner.engine_services__Services.__new__(runner.engine_services__Services)
    services.settings = runner.config__Settings(self_aliases=())
    services.http = object()
    services.self_http = None
    with pytest.raises(runner.engine_executor__NodeError, match="cannot be called externally"):
        services.route("https://ibrahimnewaeon.app.n8n.cloud/webhook/a7/owner-submit")


def test_extracted_code_matches_embedded_text(runner, tmp_path):
    runner.runner_extract_code(tmp_path)
    for package, nodes in runner.CODE.items():
        for name, source in nodes.items():
            path = tmp_path / package / runner.CODE_FILES[package][name]
            assert path.read_text(encoding="utf-8") == source
