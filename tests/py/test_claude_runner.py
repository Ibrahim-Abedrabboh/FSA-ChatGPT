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
