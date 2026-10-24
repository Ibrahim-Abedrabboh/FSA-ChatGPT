"""Go 1 round trip on the real flows, inside the service:
owner submit (bridge) -> A7 intake -> source continuation -> budget-guarded stylist and critic calls ->
parked at "Wait for go 1" -> approval context (bridge) -> owner decision (bridge) -> A7 decision webhook ->
resume link -> the run records the decision.

The outside services answer with what they answered in the real run 1591: the Netlify budget site
(source continuation, reserve, settle), OpenAI (stylist) and Anthropic (critic). Nothing is paid or sent out.
"""

from __future__ import annotations

import gzip
import io
import json
from pathlib import Path

import httpx
import pytest
from PIL import Image

from midas_a7.app import create_app
from midas_a7.config import Settings

FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"
RUNS_TABLE = "l0roUCBwIQL3h9Eq"


@pytest.fixture(scope="module")
def recorded():
    return json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())["runData"]


def out(recorded, node):
    return recorded[node][0]["main"][0][0]["json"]


@pytest.fixture
async def service(monkeypatch, recorded):
    for k, v in {"A7_BRIDGE_HEADER_VALUE": "bridge", "MIDAS_CLIENT_HEADER_VALUE": "client", "MIDAS_OWNER_HEADER_VALUE": "owner",
                 "PUBLIC_BASE_URL": "https://a7.test", "RESUME_SIGNING_SECRET": "resume", "OPENAI_API_KEY": "test",
                 "ANTHROPIC_API_KEY": "test", "GEMINI_API_KEY": "test"}.items():
        monkeypatch.setenv(k, v)
    calls: list[tuple[str, str, str | None]] = []

    def outside(request: httpx.Request) -> httpx.Response:
        host, path = request.url.host, request.url.path
        req = json.loads(request.content) if request.headers.get("content-type", "").startswith("application/json") else {}
        calls.append((host, path, req.get("node")))
        stage = "11c" if "11c" in json.dumps(req) or "Plan critic" in json.dumps(req) else "11"
        if path.endswith("/api/a7/budget/source-continuation"):
            return httpx.Response(200, json=out(recorded, "Claim confirmed source continuation")["body"])
        if path.endswith("/api/a7/budget/reserve"):
            return httpx.Response(200, json=out(recorded, f"Budget · {stage} · Reserve")["body"])
        if path.endswith("/api/a7/budget/settle"):
            return httpx.Response(200, json=out(recorded, f"Budget · {stage} · Settle")["body"])
        if host == "api.openai.com":
            return httpx.Response(200, json=out(recorded, "11 Stylist plans the scenes"))
        if host == "api.anthropic.com":
            return httpx.Response(200, json=out(recorded, "11c Plan critic"))
        raise AssertionError(f"unexpected outside call {host}{path}")

    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(outside))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as c:
            yield app, c, calls


async def test_go1_round_trip(service, recorded):
    app, c, calls = service
    store = app.state.services.store
    payload = json.loads(out(recorded, "A7 job webhook")["body"]["payload"])
    photo = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(photo, "PNG")
    name = payload["references"][0]["name"]

    r = await c.post("/webhook/a7/owner-submit", headers={"Authorization": "bridge"},
                     data={"payload": json.dumps(payload)}, files={"files0": (f"{name}.png", photo.getvalue(), "image/png")})
    assert r.status_code == 200 and r.json()["receiptKind"] == "accepted"
    await app.state.runtime.drain()

    [row] = store.dt_select(RUNS_TABLE)
    assert row["status"] == "awaiting_go_1" and row["run_id"] == payload["runId"]
    assert row["resume_url"].startswith("https://a7.test/webhook-waiting/")
    netlify = "midas-a7-owner-preview.netlify.app"
    assert calls == [
        (netlify, "/api/a7/budget/source-continuation", None),
        (netlify, "/api/a7/budget/reserve", "11 Stylist plans the scenes"),
        ("api.openai.com", "/v1/responses", None),
        (netlify, "/api/a7/budget/settle", None),
        (netlify, "/api/a7/budget/reserve", "11c Plan critic"),
        ("api.anthropic.com", "/v1/messages", None),
        (netlify, "/api/a7/budget/settle", None),
    ]

    r = await c.get(f"/webhook/a7/owner-context?id={payload['runId']}", headers={"Authorization": "bridge"})
    ctx = r.json()
    assert r.status_code == 200 and ctx["gate"] == "go1" and ctx["allowed"] == ["go", "change", "stop"]
    assert "resume_url" not in json.dumps(ctx) and "go1_token" not in json.dumps(ctx)

    r = await c.post("/webhook/a7/owner-decision", headers={"Authorization": "bridge"}, json={
        "id": payload["clientRunId"], "run_id": payload["runId"], "round": ctx["round"], "decision": "stop", "note": "test"})
    assert r.status_code == 200 and r.json()["accepted"] is True and r.json()["forwarded"] is True
    await app.state.runtime.drain()

    [row] = store.dt_select(RUNS_TABLE)
    assert row["status"] == "stopped_by_owner" and row["go1_decision"] == "stop"
    runs = [store.load_execution(str(i)) for i in range(1, 6)]
    # bridge submit, A7 run (parked, then resumed), bridge context, bridge decision, A7 decision intake
    assert [(e["flow_id"], e["status"], e["state"]) for e in runs] == [
        ("Mo9c5GmTcx0K79F7", "success", None), ("1cgZc9rmBOrPdKIe", "success", None), ("Mo9c5GmTcx0K79F7", "success", None),
        ("Mo9c5GmTcx0K79F7", "success", None), ("1cgZc9rmBOrPdKIe", "success", None)]

    # The resume link works once only: a second answer is refused by A7 and reported as not forwarded.
    r = await c.post("/webhook/a7/owner-decision", headers={"Authorization": "bridge"}, json={
        "id": payload["clientRunId"], "run_id": payload["runId"], "round": ctx["round"], "decision": "go", "note": "again"})
    assert r.json()["accepted"] is False
