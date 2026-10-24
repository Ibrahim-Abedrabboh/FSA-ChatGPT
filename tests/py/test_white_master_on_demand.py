"""White catalogue image on demand (owner, 20 Oct 2026; WP3 stage A).

The owner site sends scope.whiteMaster = false when a Lifestyle job does not need the white catalogue image. Then:
01 plans no white master and records brief.white_master 'not_asked'; go 1 says the first scene comes next; after the go, 13 hands
the run to stage 07 (15q status scenes_start, which "Scene due?" accepts); 19a starts the first scene without a white approval; the
placement sends no white master (19d2, 19g). White BK and Website always keep it. Without the flag (every request before this
change, and run 1591) nothing changes: the replay of run 1591 checks that node by node.

The end-to-end tests run the real flows inside the service up to the first paid image call, which the mock refuses: the outside
services answer with what they answered in run 1591, and nothing is paid or sent out.
"""

from __future__ import annotations

import gzip
import io
import json
from pathlib import Path

import httpx
import pytest
from PIL import Image

from conftest import link, make_flow, run_flow
from midas_a7.app import create_app
from midas_a7.config import Settings

FLOWS = Path(__file__).resolve().parents[2] / "src" / "midas_a7" / "flows"
FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"
RUNS_TABLE = "l0roUCBwIQL3h9Eq"
EMPTY_ROOM = "No image is attached. Create a photograph of an empty room."


@pytest.fixture(scope="module")
def recorded():
    return json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())["runData"]


def out(recorded, node):
    return recorded[node][0]["main"][0][0]["json"]


def code(name: str) -> str:
    return (FLOWS / "a7_main" / "code" / name).read_text(encoding="utf-8")


# ---------- end to end, inside the service ----------

@pytest.fixture
async def service(monkeypatch, recorded):
    for k, v in {"A7_BRIDGE_HEADER_VALUE": "bridge", "MIDAS_CLIENT_HEADER_VALUE": "client", "MIDAS_OWNER_HEADER_VALUE": "owner",
                 "PUBLIC_BASE_URL": "https://a7.test", "RESUME_SIGNING_SECRET": "resume", "OPENAI_API_KEY": "test",
                 "ANTHROPIC_API_KEY": "test", "GEMINI_API_KEY": "test"}.items():
        monkeypatch.setenv(k, v)
    calls: list[tuple[str, str, str | None]] = []
    images: list[dict] = []

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
        if host == "generativelanguage.googleapis.com":
            images.append(req)  # the first paid image call: recorded, then refused, so no image is made
            raise httpx.ConnectError("test: the image call is not made")
        raise AssertionError(f"unexpected outside call {host}{path}")

    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(outside))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as c:
            yield app, c, calls, images


async def _submit_and_go(app, c, recorded, scope_extra: dict) -> tuple[dict, dict, dict]:
    """Owner submit (bridge) -> A7 to go 1 -> context -> owner go -> A7 to the first paid image call. Returns (row at go 1, context, row after)."""
    store = app.state.services.store
    payload = json.loads(out(recorded, "A7 job webhook")["body"]["payload"])
    payload["scope"].update(scope_extra)
    photo = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(photo, "PNG")
    r = await c.post("/webhook/a7/owner-submit", headers={"Authorization": "bridge"}, data={"payload": json.dumps(payload)},
                     files={"files0": (payload["references"][0]["name"] + ".png", photo.getvalue(), "image/png")})
    assert r.status_code == 200 and r.json()["receiptKind"] == "accepted"
    await app.state.runtime.drain()
    [at_go1] = store.dt_select(RUNS_TABLE)
    ctx = (await c.get(f"/webhook/a7/owner-context?id={payload['runId']}", headers={"Authorization": "bridge"})).json()
    r = await c.post("/webhook/a7/owner-decision", headers={"Authorization": "bridge"}, json={
        "id": payload["clientRunId"], "run_id": payload["runId"], "round": ctx["round"], "decision": "go", "note": "test"})
    assert r.json()["accepted"] is True and r.json()["forwarded"] is True
    await app.state.runtime.drain()
    [after] = store.dt_select(RUNS_TABLE)
    return at_go1, ctx, after


async def test_unticked_lifestyle_job_starts_with_the_empty_room_after_go_1(service, recorded):
    app, c, calls, images = service
    at_go1, ctx, after = await _submit_and_go(app, c, recorded, {"whiteMaster": False})

    assert at_go1["status"] == "awaiting_go_1"
    assert json.loads(at_go1["required_outputs"]) == [{"id": "hero", "kind": "hero", "mode": "fidelity_locked"}]
    assert [s["output"] for s in ctx["shots"]] == ["hero"]
    assert "This job makes no white catalogue image: a go lets stage 07 make the first scene" in ctx["decisionNeeded"]

    # After the go: stage 07 starts the hero's empty room (no white approval asked for), and its one image call is the only paid call.
    scenes = json.loads(after["scenes"])
    assert scenes["current"]["output_id"] == "hero" and scenes["current"]["phase"] == "room"
    assert json.loads(after["stage04"])["orders"][0]["output_id"] == "hero_room"
    [image] = images
    assert image["input"][0]["text"].startswith(EMPTY_ROOM) and [p["type"] for p in image["input"]] == ["text"]
    assert [x[2] for x in calls if x[2]] == ["11 Stylist plans the scenes", "11c Plan critic", "15g Send to Google"]
    assert after["status"] == "hold"  # the refused image call holds the run; nothing was made


async def test_default_job_still_makes_the_white_master_first(service, recorded):
    app, c, calls, images = service
    at_go1, ctx, after = await _submit_and_go(app, c, recorded, {})

    assert [o["id"] for o in json.loads(at_go1["required_outputs"])] == ["white_master", "hero"]
    assert ctx["decisionNeeded"].startswith("go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. "
                                            "A go lets stage 04 make the white master")
    assert after["scenes"] == ""
    assert json.loads(after["stage04"])["orders"][0]["output_id"] == "white_master"
    [image] = images
    assert [p["type"] for p in image["input"]] == ["text", "image"]  # the vendor photo goes with the white master prompt


# ---------- single nodes ----------

async def _run_01(executor, recorded, scope: dict) -> dict:
    item = recorded["Recovery · Requested?"][0]["main"][1][0]
    body = json.loads(json.dumps(item["json"]))
    p = json.loads(body["body"]["payload"]) if isinstance(body.get("body", {}).get("payload"), str) else body
    p["scope"].update(scope)
    if isinstance(body.get("body", {}).get("payload"), str):
        body["body"]["payload"] = json.dumps(p)
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "position": [0, 0], "parameters": {}},
        {"name": "01 Intent & scope", "type": "n8n-nodes-base.code", "position": [200, 0], "parameters": {"jsCode": code("01_Intent_scope.js")}},
    ], link(("Start", "01 Intent & scope")))
    ex = await run_flow(executor, flow, [{"json": body}])
    assert ex.status == "success", ex.error
    return ex.run_data["01 Intent & scope"][0]["data"][0][0]["json"]


@pytest.mark.parametrize("scope, outputs, marker, note", [
    ({}, ["white_master", "hero"], None, False),
    ({"whiteMaster": True}, ["white_master", "hero"], None, False),
    ({"whiteMaster": False}, ["hero"], "not_asked", False),
    ({"whiteMaster": "no"}, ["hero"], "not_asked", False),
    ({"whiteMaster": False, "outcomes": ["Lifestyle", "White BK"]}, ["white_master", "hero"], None, True),
    ({"whiteMaster": False, "outcomes": ["Lifestyle", "Website"]}, None, None, True),
])
async def test_01_plans_the_white_master_only_when_asked_or_needed(executor, recorded, scope, outputs, marker, note):
    o = await _run_01(executor, recorded, scope)
    brief = o["brief"]
    ids = [x["id"] for x in brief["outputs"]]
    if outputs is not None:
        assert ids == outputs
    else:
        assert "white_master" in ids
    assert brief.get("white_master") == marker
    assert any("White catalogue image left out: not applied" in n for n in o.get("not_applied", [])) is note


async def _run_19g_placement(executor, state: dict) -> dict:
    """19d2 then 19g for a placement, with the earlier stage 07 nodes stubbed: room checked, no Midas piece, no Drive call."""
    stub = lambda name, js: {"name": name, "type": "n8n-nodes-base.code", "position": [0, 0], "parameters": {"jsCode": js}}  # noqa: E731
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "position": [0, 0], "parameters": {}},
        stub("04 Settings", "return [{ json: { max_inline_mb: 14 } }];"),
        stub("19c Prop verdict", "return [{ json: $('Start').first().json }];"),
        stub("19d Download master", "return [{ json: { error: 'no file id' } }];"),
        stub("19d2 Master check", code("19d2_Master_check.js")),
        stub("19e2 Room check", "return [{ json: { room: { ok: true, key: 'room_photo', name: 'room', mime: 'image/png', bytes: 10, sha256: 'b'.repeat(64) } } }];"),
        stub("19f0 Photo list", "return [{ json: { none: true } }];"),
        stub("19f2 Photo check", "return [{ json: { photos: [] } }];"),
        stub("19g Scene references", code("19g_Scene_references.js")),
    ], link(("Start", "04 Settings"), ("04 Settings", "19c Prop verdict"), ("19c Prop verdict", "19d Download master"),
            ("19d Download master", "19d2 Master check"), ("19d2 Master check", "19e2 Room check"), ("19e2 Room check", "19f0 Photo list"),
            ("19f0 Photo list", "19f2 Photo check"), ("19f2 Photo check", "19g Scene references")))
    ex = await run_flow(executor, flow, [{"json": state}])
    assert ex.status == "success", ex.error
    return ex.run_data["19g Scene references"][0]["data"][0][0]["json"]


def _placement_state(marker: str | None) -> dict:
    vendor = {"key": "product_1", "name": "vendor", "mime": "image/png", "bytes": 10, "sha256": "a" * 64, "image": True}
    st = {"status": "scene_preparing", "product_key": "product_1", "references": [vendor], "outputs": [{"id": "hero", "kind": "hero"}],
          "brief": {}, "approved": None, "trail": [], "scenes": {"queue": ["hero"], "done": {}},
          "scene": {"output_id": "hero", "phase": "place", "attempt": 1, "props": []}}
    if marker:
        st["brief"]["white_master"] = marker
    return st


async def test_placement_without_a_white_master_sends_vendor_photo_and_room_only(executor):
    st = await _run_19g_placement(executor, _placement_state("not_asked"))
    assert st["status"] == "scene_due"
    assert [r["role"] for r in st["scene"]["refs"]] == ["vendor photo", "room"]


async def test_placement_of_a_white_master_job_still_needs_the_checked_master(executor):
    st = await _run_19g_placement(executor, _placement_state(None))
    assert st["status"] == "hold" and "The approved white master cannot be used" in st["hold_reason"]


def test_scene_due_accepts_the_new_status():
    from midas_a7.flows import a7_main
    node = next(n for n in a7_main.FLOW["nodes"] if n["name"] == "Scene due?")
    assert "'scenes_start'" in node["parameters"]["conditions"]["conditions"][0]["leftValue"]

