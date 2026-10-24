"""Web service: routing, header auth, respond-then-continue, parking at a Wait node and resuming."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from conftest import link, make_flow

from midas_a7.app import create_app, load_flows, webhook_table
from midas_a7.config import Settings


def webhook_node(name, path, method="POST", auth=True, pos=(0, 0)):
    n = {"name": name, "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": list(pos),
         "parameters": {"httpMethod": method, "path": path, "responseMode": "responseNode", "options": {}}}
    if auth:
        n["parameters"]["authentication"] = "headerAuth"
        n["credentials"] = {"httpHeaderAuth": {"id": "x", "name": "Claude · Midas client header"}}
    return n


def code(name, js, pos):
    return {"name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": list(pos), "parameters": {"jsCode": js}}


def respond(name, body_expr, code_=200, pos=(0, 0)):
    return {"name": name, "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": list(pos),
            "parameters": {"respondWith": "json", "responseBody": body_expr, "options": {"responseCode": code_}}}


def wait_node(name, pos):
    return {"name": name, "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "position": list(pos),
            "parameters": {"resume": "webhook", "httpMethod": "POST", "limitWaitTime": True, "resumeAmount": 24, "options": {}}}


@pytest.fixture
def test_flows():
    flow = make_flow([
        webhook_node("Hook", "test-park"),
        code("Prepare", "return [{json:{run: $input.first().json.body.name, resume: $execution.resumeUrl,"
                        " files: Object.keys($input.first().binary || {})}}];", (200, 0)),
        respond("Reply", '={{ JSON.stringify({ ok: true, run: $json.run, files: $json.files }) }}', 202, (400, 0)),
        wait_node("Wait for go", (600, 0)),
        code("After", "return [{json:{answer: ($input.first().json.body || {}).decision, run: $('Prepare').first().json.run}}];", (800, 0)),
    ], link(("Hook", "Prepare"), ("Prepare", "Reply"), ("Reply", "Wait for go"), ("Wait for go", "After")))
    return {flow.id: flow}


@pytest.fixture
async def client(monkeypatch, test_flows):
    monkeypatch.setenv("MIDAS_CLIENT_HEADER_VALUE", "client-secret-for-tests")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    monkeypatch.setenv("RESUME_SIGNING_SECRET", "resume-secret-for-tests")
    app = create_app(Settings(database_url="sqlite://"), flows=test_flows)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as c:
            yield app, c


def test_real_flows_register_the_n8n_webhook_paths():
    paths = {f"{m} {p}" for m, p in webhook_table(load_flows())}
    assert {"POST claude-midas-a7", "POST claude-midas-a7-decision", "GET a7/owner-context", "POST a7/owner-submit",
            "POST a7/owner-decision", "GET a7/owner-read", "POST a7/owner-analyze", "POST claude-midas-a7-analysis",
            "POST a7/model-test"} == paths


async def test_health_and_unknown_webhook(client):
    _, c = client
    r = await c.get("/health")
    assert r.status_code == 200 and r.json()["configured"]["Claude · Midas client header"] is True
    r = await c.post("/webhook/nope")
    assert r.status_code == 404


async def test_header_auth(client):
    _, c = client
    assert (await c.post("/webhook/test-park", json={"name": "x"})).status_code == 403
    assert (await c.post("/webhook/test-park", json={"name": "x"}, headers={"X-Midas-Key": "wrong"})).status_code == 403


async def test_respond_then_park_then_resume(client):
    app, c = client
    files = {"files0": ("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, "image/png")}
    r = await c.post("/webhook/test-park", data={"name": "run-1"}, files=files, headers={"X-Midas-Key": "client-secret-for-tests"})
    assert r.status_code == 202, r.text
    assert r.json() == {"ok": True, "run": "run-1", "files": ["files0"]}
    runtime = app.state.runtime
    await runtime.drain()
    store = app.state.services.store
    row = store.load_execution("1")
    assert row["status"] == "waiting" and row["wait_kind"] == "webhook"
    state = row["state"]
    hook_headers = state["run_data"]["Hook"][0]["data"][0][0]["json"]["headers"]
    assert hook_headers["x-midas-key"] == "<redacted>"
    resume = state["run_data"]["Prepare"][0]["data"][0][0]["json"]["resume"]
    assert resume.startswith("https://a7.test/webhook-waiting/1?signature=")
    path = resume[len("https://a7.test"):]
    assert (await c.post("/webhook-waiting/1?signature=bad", json={})).status_code == 401
    r = await c.post(path, json={"decision": "go"})
    assert r.status_code == 200
    await runtime.drain()
    row = store.load_execution("1")
    assert row["status"] == "success" and row["state"] is None
    assert (await c.post(path, json={"decision": "go"})).status_code == 409  # answered once only
    assert store.get_binary("bin:none") is None


async def test_wait_timeout_resumes_with_input(client):
    app, c = client
    r = await c.post("/webhook/test-park", json={"name": "run-2"}, headers={"X-Midas-Key": "client-secret-for-tests"})
    assert r.status_code == 202
    runtime = app.state.runtime
    await runtime.drain()
    store = app.state.services.store
    from datetime import datetime, timedelta, timezone
    store.save_execution("1", "waiting", store.load_execution("1")["state"], datetime.now(timezone.utc) - timedelta(seconds=1), "webhook")
    assert await runtime.resume_due() == 1
    await runtime.drain()
    row = store.load_execution("1")
    assert row["status"] == "success"
    await asyncio.sleep(0)


async def test_status_page_needs_the_bridge_secret_and_shows_runs_without_their_state(client, monkeypatch):
    app, c = client
    assert (await c.get("/status")).status_code == 503  # no bridge secret configured
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "bridge-secret-for-tests")
    assert (await c.get("/status")).status_code == 403
    assert (await c.get("/status", headers={"Authorization": "wrong"})).status_code == 403

    r = await c.post("/webhook/test-park", json={"name": "run-s"}, headers={"X-Midas-Key": "client-secret-for-tests"})
    assert r.status_code == 202
    await app.state.runtime.drain()
    store = app.state.services.store
    failed = store.create_execution("flow-x")
    store.save_execution(failed, "error", None, error={"node": "15g Send to Google", "message": "boom ?key=SECRET123 at x"})

    r = await c.get("/status", headers={"Authorization": "bridge-secret-for-tests"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["database"] == "ok"
    assert body["counts"] == {"waiting": 1, "error": 1}
    [waiting] = body["waiting"]
    assert waiting["status"] == "waiting" and waiting["waitKind"] == "webhook" and waiting["ageSeconds"] >= 0
    [fail] = body["failed"]
    assert fail["failedNode"] == "15g Send to Google"
    assert "SECRET123" not in r.text and "key=<redacted>" in fail["message"]
    assert "run_data" not in r.text and "run-s" not in r.text  # no run state or request data
