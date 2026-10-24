"""End-to-end contract: what the site sends, what the engine answers, and whether the
site's own verification (ported in site_contract.py) accepts the ledger the engine left."""

from __future__ import annotations

import json

import pytest

from app.providers.fake import FakeProvider
from tests.conftest import make_job
from tests.site_contract import (
    Unverified,
    check_production_reply,
    observation_from_verified_answers,
    required_nodes,
    verified_analysis_answers,
)

RESPONSE_KEYS = ["http_status", "accepted", "receiptId", "draftId", "clientRunId", "runId", "sourceSha256",
                 "referenceFingerprint", "roomSha256", "intentFingerprint", "readers"]


@pytest.mark.parametrize("room", [False, True])
def test_success_matches_bridge_shape_and_site_verification(harness, room):
    h = harness()
    job = make_job(room=room, side=True)
    r = h.post(job)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert list(body) == RESPONSE_KEYS
    assert body["http_status"] == 200 and body["accepted"] is True
    p = job.payload
    for key in ("draftId", "clientRunId", "runId", "sourceSha256", "referenceFingerprint", "intentFingerprint"):
        assert body[key] == p[key]
    assert body["roomSha256"] == (p["roomSha256"] if room else None)
    assert [x["node"] for x in body["readers"]] == required_nodes(room)
    assert all(set(x) == {"node", "status", "operationKey", "receiptRef"} and x["status"] == "completed" for x in body["readers"])

    # The site's run(): accepted, same intent, then the ledger is the only source of facts.
    reported = check_production_reply(r.status_code, r.text, p["intentFingerprint"])
    source = {"draftId": p["draftId"], "sourceSha256": p["sourceSha256"], "roomSha256": p["roomSha256"],
              "referenceFingerprint": p["referenceFingerprint"], "budgetLimitUsd": 5}
    answers = verified_analysis_answers(h.budget, h.budget.owner_id, source, reported)
    observed = observation_from_verified_answers(source, answers)
    assert observed["observation"]["eyeCount"] == 2
    assert observed["observation"]["secondCount"] == 2
    assert observed["observation"]["category"] == "Sofa"
    assert len([x for x in observed["observation"]["pieces"] if x["role"] == "product"]) == 2
    assert (observed["roomObservation"] or {}).get("sourceSha256") == (p["roomSha256"] if room else None)
    if room:
        assert observed["roomObservation"]["roomType"] == "Living room"


def test_forged_or_uncertain_ledger_rows_are_rejected_by_the_site(harness):
    """Port of tests/a7-analysis-workflow-synthetic.test.mjs: a changed checkpoint or an
    uncertain row breaks verification even though the engine's pointers are unchanged."""
    h = harness()
    job = make_job()
    r = h.post(job)
    p = job.payload
    reported = r.json()
    source = {"draftId": p["draftId"], "sourceSha256": p["sourceSha256"], "roomSha256": None,
              "referenceFingerprint": p["referenceFingerprint"], "budgetLimitUsd": 5}
    eye = next(op for op in h.budget.operations.values() if op["node_name"] == "03 Eye reads the product photo")
    original = eye["reader_response"]["answer"]["candidates"][0]["content"]["parts"][0]["text"]
    eye["reader_response"]["answer"]["candidates"][0]["content"]["parts"][0]["text"] = '{"category":"forged"}'
    with pytest.raises(Unverified):
        verified_analysis_answers(h.budget, h.budget.owner_id, source, reported)
    eye["reader_response"]["answer"]["candidates"][0]["content"]["parts"][0]["text"] = original
    second = next(op for op in h.budget.operations.values() if op["node_name"] == "05 Second count")
    second["status"] = "uncertain"
    with pytest.raises(Unverified):
        verified_analysis_answers(h.budget, h.budget.owner_id, source, reported)
    second["status"] = "completed"
    with pytest.raises(Unverified):
        verified_analysis_answers(h.budget, h.budget.owner_id, {**source, "budgetLimitUsd": 4}, reported)
    assert verified_analysis_answers(h.budget, h.budget.owner_id, source, reported)["05 Second count"]["total"] == 2


def test_hold_matches_bridge_uncertain_response(harness):
    """Port of the bridge test: any uncertain outcome is 409 analysis_outcome_uncertain, never accepted."""
    h = harness()
    job = make_job()
    h.budget.fail["reserve"] = (409, {"error": "budget_missing"})
    r = h.post(job)
    assert r.status_code == 409
    assert r.json() == {"http_status": 409, "error": "analysis_outcome_uncertain", "accepted": False}
    with pytest.raises(Unverified, match="analysis_outcome_uncertain"):
        check_production_reply(r.status_code, r.text, job.payload["intentFingerprint"])


def test_conflict_reader_receives_the_n8n_ticket(harness):
    provider = FakeProvider()
    h = harness(provider=provider)
    job = make_job(room=True)
    assert h.post(job).status_code == 200
    nine = provider.calls[-1]
    assert nine.node == "09 Conflict check" and nine.kind == "openai" and nine.json_object
    ticket = json.loads(nine.message)
    assert list(ticket) == ["source_sha256", "eye", "second", "room", "instructions", "conflicts", "unknowns"]
    assert ticket["source_sha256"] == job.payload["sourceSha256"]
    assert ticket["instructions"] == "Keep the two units separate"
    assert json.loads(ticket["eye"])["candidates"][0]["finishReason"] == "STOP"
    assert json.loads(ticket["second"])["stop_reason"] == "end_turn"
    assert json.loads(ticket["room"])["candidates"]
    assert ticket["conflicts"] == [] and ticket["unknowns"] == []


def test_product_only_ticket_has_null_room_and_no_room_read(harness):
    provider = FakeProvider()
    h = harness(provider=provider)
    assert h.post(make_job()).status_code == 200
    assert [c.node for c in provider.calls] == required_nodes(False)
    assert json.loads(provider.calls[-1].message)["room"] is None


def test_readers_see_the_right_photo(harness):
    provider = FakeProvider()
    h = harness(provider=provider)
    job = make_job(room=True, side=True)
    assert h.post(job).status_code == 200
    by_node = {c.node: c for c in provider.calls}
    product, side, room = job.files[0][1], job.files[1][1], job.files[2][1]
    assert by_node["03 Eye reads the product photo"].image == product
    assert by_node["05 Second count"].image == product
    assert by_node["06 Room reader"].image == room
    assert by_node["09 Conflict check"].image is None
    assert side not in [c.image for c in provider.calls]


def test_models_and_token_bounds(harness):
    provider = FakeProvider()
    h = harness(provider=provider)
    assert h.post(make_job(room=True)).status_code == 200
    assert [(c.node, c.kind, c.model, c.max_output_tokens) for c in provider.calls] == [
        ("03 Eye reads the product photo", "gemini", "models/gemini-3.8-flash", 16000),
        ("05 Second count", "anthropic", "claude-sonnet-5-5", 1500),
        ("06 Room reader", "gemini", "models/gemini-3.8-flash", 8000),
        ("09 Conflict check", "openai", "gpt-6-luna", 2000),
    ]
