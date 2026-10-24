"""Reserve/settle sequence against a fake budget API, matching the n8n budget chain."""

from __future__ import annotations

import pytest

from app.canonical import canonical_sha256
from app.providers.fake import FakeProvider
from tests.conftest import make_job, sha
from tests.fakes import FakeBudgetApi

NODES_ROOM = ["03 Eye reads the product photo", "05 Second count", "06 Room reader", "09 Conflict check"]


def slot_key(job, node):
    slot = {"client": job.client_run_id, "run": job.payload["runId"], "node": node, "output": "job", "attempt": 0,
            "phase": "", "go1": 0, "go2": 0, "plan": 0, "rewrite": 0, "review": 0}
    return "a7:" + canonical_sha256(slot)


def test_each_reader_is_reserved_then_settled_in_order(harness):
    events: list[str] = []
    budget = FakeBudgetApi(events=events)
    provider = FakeProvider()
    h = harness(budget=budget, provider=provider)
    job = make_job(room=True)
    assert h.post(job).status_code == 200
    assert budget.actions() == [(a, n) for n in NODES_ROOM for a in ("reserve", "settle")]
    reserves = [r for a, _o, r in budget.calls if a == "reserve"]
    settles = [r for a, _o, r in budget.calls if a == "settle"]
    expected = {
        "03 Eye reads the product photo": ("gemini-3.8-flash", 1048576, 16000),
        "05 Second count": ("claude-sonnet-5-5", 1048576, 1500),
        "06 Room reader": ("gemini-3.8-flash", 1048576, 8000),
        "09 Conflict check": ("gpt-6-luna", 1050000, 2000),
    }
    for request in reserves:
        assert set(request) == {"clientId", "runId", "operationKey", "node", "model", "outputId", "inputTokens", "outputTokens", "requestSha256"}
        assert request["clientId"] == job.client_run_id and request["runId"] == job.payload["runId"]
        assert request["outputId"] == "job"
        assert (request["model"], request["inputTokens"], request["outputTokens"]) == expected[request["node"]]
        assert request["operationKey"] == slot_key(job, request["node"])
        assert len(request["requestSha256"]) == 64
    assert len({r["requestSha256"] for r in reserves}) == 4
    for request, reserve in zip(settles, reserves):
        assert request["operationKey"] == reserve["operationKey"]
        assert request["permit"] == budget.operations[reserve["operationKey"]]["permit"]
        assert request["checkpointRequired"] is True
        assert request["usage"]["input"] > 0 and request["usage"]["output"] > 0
        assert "completeAnswer" in request
        assert set(request["completeAnswer"]) <= {"id", "status", "output", "content", "candidates", "response", "usage",
                                                  "usageMetadata", "stop_reason", "steps", "output_image", "finishReason", "error"}
    # Gemini answers have no id: the receipt is the hash of the answer envelope.
    assert settles[0]["receiptRef"].startswith("answer:")
    assert settles[1]["receiptRef"].startswith("msg_")
    assert settles[3]["receiptRef"].startswith("resp_")
    # Provider calls interleave with the ledger: never sent before its permit.
    assert [c.node for c in provider.calls] == NODES_ROOM
    assert all(op["status"] == "completed" for op in budget.operations.values())


def test_gemini_usage_counts_thought_tokens_as_output(harness):
    h = harness()
    job = make_job()
    assert h.post(job).status_code == 200
    first = [r for a, _o, r in h.budget.calls if a == "settle"][0]
    assert first["usage"] == {"input": 1201, "output": 340}


def test_budget_origin_routing_matches_n8n(harness):
    h = harness()
    listed = make_job(budgetOrigin="https://claude-final-midas-a7.netlify.app")
    h.post(listed)
    assert {o for _a, o, _r in h.budget.calls} == {"https://claude-final-midas-a7.netlify.app"}
    for other in ("https://evil.example", None, "https://claude-final-midas-a7.netlify.app/"):
        h2 = harness()
        job = make_job(budgetOrigin=other) if other else make_job()
        if other is None:
            job.payload.pop("budgetOrigin")
        h2.post(job)
        assert {o for _a, o, _r in h2.budget.calls} == {"https://midas-a7-owner-preview.netlify.app"}


@pytest.mark.parametrize("refusal", [
    (200, {"send": False, "reason": "budget_limit", "availableMicroUsd": 10}),
    (409, {"error": "budget_missing"}),
    (200, {"send": True, "permit": "not-a-uuid", "reservedMicroUsd": 5}),
    (200, {"send": True, "permit": "4f1c7f1e-0a8e-4b33-9e6c-3c4d5e6f7a8b", "reservedMicroUsd": 0}),
    (503, {"error": "budget_storage_unavailable"}),
    "transport",
])
def test_no_permit_means_no_provider_call(harness, refusal):
    h = harness()
    h.budget.fail["reserve"] = refusal
    r = h.post(make_job())
    assert r.status_code == 409 and r.json()["error"] == "analysis_outcome_uncertain"
    assert h.provider.calls == []
    assert h.budget.actions() == [("reserve", "03 Eye reads the product photo")]


def test_budget_limit_reached_mid_run_holds_before_the_next_reader(harness):
    # 03 reserves 846432 micro-USD and settles at its token cost; 05 needs 2112152 more than the limit allows.
    h = harness(budget=FakeBudgetApi(limit_micro_usd=2_000_000))
    r = h.post(make_job(room=True))
    assert r.status_code == 409
    assert [c.node for c in h.provider.calls] == ["03 Eye reads the product photo"]
    assert h.budget.actions()[-1] == ("reserve", "05 Second count")
    assert [op["node_name"] for op in h.budget.operations.values()] == ["03 Eye reads the product photo"]


@pytest.mark.parametrize("settle", [
    "transport",
    (409, {"error": "settlement_conflict"}),
    (200, {"recorded": True, "status": "uncertain", "responsePreserved": True}),
    (200, {"recorded": True, "status": "completed", "responsePreserved": False}),
])
def test_unconfirmed_settlement_holds_and_stops(harness, settle):
    h = harness()
    h.budget.fail["settle"] = [settle]
    r = h.post(make_job())
    assert r.status_code == 409
    assert [c.node for c in h.provider.calls] == ["03 Eye reads the product photo"]
    assert h.budget.actions() == [("reserve", "03 Eye reads the product photo"), ("settle", "03 Eye reads the product photo")]


def test_unusable_answer_is_settled_as_uncertain_and_holds(harness):
    def truncated(request):
        return {"candidates": [{"content": {"parts": [{"text": "{"}]}, "finishReason": "MAX_TOKENS"}],
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 16000}}

    h = harness(provider=FakeProvider({"03 Eye reads the product photo": truncated}))
    r = h.post(make_job())
    assert r.status_code == 409
    # The site refuses the checkpoint (finishReason not STOP), so nothing is recorded as completed.
    assert h.budget.operations[next(iter(h.budget.operations))]["status"] == "reserved"
    assert len(h.provider.calls) == 1


def test_authorization_and_budget_secret_never_appear_in_payloads(harness):
    h = harness()
    h.post(make_job())
    blob = repr(h.budget.calls)
    assert "test-engine-authorization" not in blob and "test-budget-authorization" not in blob


def test_request_hash_depends_on_bytes_and_instructions(harness):
    a, b = harness(), harness()
    job = make_job()
    a.post(job)
    job2 = make_job(instructions="Something else")
    b.post(job2)
    eye_a = [r for x, _o, r in a.budget.calls if x == "reserve"][0]["requestSha256"]
    eye_b = [r for x, _o, r in b.budget.calls if x == "reserve"][0]["requestSha256"]
    assert eye_a != eye_b
    assert sha(b"") != eye_a
