"""The real flows through the web service, with no outside call: owner read on an empty database, and
the A7 intake refusing a job it cannot start (n8n answered 422 and logged the refusal)."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from midas_a7.app import create_app
from midas_a7.config import Settings

BRIDGE = "bridge-secret-for-tests"
CLIENT = "client-secret-for-tests"


@pytest.fixture
async def client(monkeypatch):
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", BRIDGE)
    monkeypatch.setenv("MIDAS_CLIENT_HEADER_VALUE", CLIENT)
    monkeypatch.setenv("MIDAS_OWNER_HEADER_VALUE", "owner-secret-for-tests")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    monkeypatch.setenv("RESUME_SIGNING_SECRET", "resume-secret-for-tests")
    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        # Any call that tries to leave the service fails the test.
        def no_outside_calls(request):
            raise AssertionError(f"unexpected outside call to {request.url.host}")
        app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(no_outside_calls))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as c:
            yield app, c


async def test_reference_tables_seeded_at_start(client):
    app, _ = client
    store = app.state.services.store
    assert store.dt_count("eso9cF84jXYIGu5S") == 2
    assert store.dt_count("AgXKkFbIj5dQAnvn") == 44
    assert store.dt_count("lwJbRv4TVqlFTILl") == 428


async def test_owner_read_on_an_empty_database(client):
    _, c = client
    assert (await c.get("/webhook/a7/owner-read")).status_code == 403
    r = await c.get("/webhook/a7/owner-read?offset=0", headers={"Authorization": BRIDGE})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["jobs"] == [] and body["total"] == 0
    r = await c.get("/webhook/a7/owner-read?id=claude-a7-00000000-0000-4000-8000-000000000000", headers={"Authorization": BRIDGE})
    assert r.status_code == 404


async def test_a7_intake_refuses_a_job_without_files_and_logs_it(client):
    app, c = client
    payload = {"clientRunId": "owner-00000000-0000-4000-8000-000000000001", "jobMode": "new_project",
               "scope": {"outcomes": ["White background"]}, "item": {"productType": "chair"}}
    r = await c.post("/webhook/claude-midas-a7", data={"payload": json.dumps(payload)}, headers={"X-Midas-Key": CLIENT})
    assert r.status_code == 422, r.text
    await app.state.runtime.drain()
    await asyncio.sleep(0)
    rows = app.state.services.store.dt_select("l0roUCBwIQL3h9Eq")
    assert len(rows) == 1 and rows[0]["status"] == "refused"


async def test_owner_submit_reaches_the_a7_intake_in_process(client):
    """Owner bridge -> A7 intake, both inside the service: the bridge's receipt says accepted.
    Uses the payload of the real owner job 1591; the only outside service (the Netlify budget site) answers 503."""
    import gzip
    import io
    from pathlib import Path

    from PIL import Image

    app, c = client
    outside = []

    def netlify_unavailable(request):
        outside.append(request.url.host)
        return httpx.Response(503, json={"error": "unavailable in tests"})

    app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(netlify_unavailable))
    rec = json.loads(gzip.open(Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz", "rt").read())
    payload = json.loads(rec["runData"]["A7 job webhook"][0]["main"][0][0]["json"]["body"]["payload"])
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(buf, "PNG")
    name = payload["references"][0]["name"]
    r = await c.post("/webhook/a7/owner-submit", headers={"Authorization": BRIDGE},
                     data={"payload": json.dumps(payload)}, files={"files0": (f"{name}.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200, r.text
    receipt = r.json()
    assert receipt["accepted"] is True and receipt["receiptKind"] == "accepted", receipt
    assert receipt["clientId"] == payload["clientRunId"] and receipt["upstreamStatus"] == 202
    await app.state.runtime.drain()
    rows = app.state.services.store.dt_select("l0roUCBwIQL3h9Eq")
    assert [r["client_run_id"] for r in rows] == [payload["clientRunId"]]
    assert set(outside) <= {"midas-a7-owner-preview.netlify.app", "claude-final-midas-a7.netlify.app"}
