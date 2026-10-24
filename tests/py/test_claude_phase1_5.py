"""Phase 1.5 (FL-12, FL-2; owner's go 22 Oct 2026), on the mocked service (no paid call).

The image budget ticket takes the model that 14 Choose model picked from an approved registry row, instead of a fixed id, and
the ledger reservation names that model. A job id other than owner-<uuid> is refused at intake, before any paid call.
Design: claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md, item 1.5.
"""

from __future__ import annotations

import json

from claude_a7_harness import CLIENT, a7_service

REGISTRY = "eso9cF84jXYIGu5S"  # Claude Midas A7 model registry
RUNS = "l0roUCBwIQL3h9Eq"  # Claude Midas A7 runs


def approve_only(store, model_id: str, **fill) -> None:
    """Make `model_id` the only approved row (with `fill` applied), the default model a trial."""
    for row in store.dt_select(REGISTRY):
        changes = {"status": "approved", **fill} if row["model_id"] == model_id else {"status": "trial"}
        store.dt_update(REGISTRY, [row["id"]], changes)


async def test_the_default_model_is_unchanged(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        reserves = []
        a7.outside.answers["reserve"] = lambda r, b, base=a7.outside.reserve: (reserves.append(b), base(r, b))[1]
        await a7.to_go2()
        [image] = a7.outside.image_requests
        assert image["model"] == "gemini-nano-banana-2.1"
        assert [b["model"] for b in reserves if b.get("node") == "15g Send to Google"] == ["gemini-nano-banana-2.1"]


async def test_a_second_approved_model_is_used_for_the_call_and_the_reservation(monkeypatch):
    """Before 1.5 the ticket threw image_call_policy_mismatch for any model but the fixed one, so the run crashed."""
    async with a7_service(monkeypatch) as a7:
        default = next(r for r in a7.store.dt_select(REGISTRY) if r["model_id"] == "gemini-nano-banana-2.1")
        approve_only(a7.store, "gemini-3-pro-image", ratios=default["ratios"], max_refs=default["max_refs"])
        reserves = []
        a7.outside.answers["reserve"] = lambda r, b, base=a7.outside.reserve: (reserves.append(b), base(r, b))[1]
        await a7.to_go2()
        [image] = a7.outside.image_requests
        assert image["model"] == "gemini-3-pro-image"
        assert [b["model"] for b in reserves if b.get("node") == "15g Send to Google"] == ["gemini-3-pro-image"]
        assert a7.outside.image_calls() == 1


async def test_an_approved_status_in_any_case_is_accepted(monkeypatch):
    """14 Choose model reads the status in any case; the ticket must read it the same way (review finding, 22 Oct 2026)."""
    async with a7_service(monkeypatch) as a7:
        row = next(r for r in a7.store.dt_select(REGISTRY) if r["model_id"] == "gemini-nano-banana-2.1")
        a7.store.dt_update(REGISTRY, [row["id"]], {"status": "Approved"})
        await a7.to_go2()
        assert a7.outside.image_calls() == 1


async def test_no_approved_model_holds_before_any_image_call(monkeypatch):
    """The registry decides: with no approved row, 14 holds with a reason and nothing is sent (unchanged by 1.5)."""
    async with a7_service(monkeypatch) as a7:
        for row in a7.store.dt_select(REGISTRY):
            a7.store.dt_update(REGISTRY, [row["id"]], {"status": "trial"})
        await a7.submit()
        await a7.decide("go")
        row = a7.row()
        assert row["status"] == "hold" and "No image model is approved" in row["hold_reason"]
        assert a7.outside.image_calls() == 0 and "15g Send to Google" not in a7.outside.reserves()


async def test_a_job_id_that_is_not_owner_is_refused_at_intake_before_any_paid_call(monkeypatch):
    """Before 1.5 such a job crashed at its first paid step (budget_identity_missing)."""
    async with a7_service(monkeypatch) as a7:
        # A plain job (not a source-confirmed owner send, which has its own preallocated-id check).
        payload = {"clientRunId": "client-0f3c2a9e-7d41-4b8e-9a55-3c1d2e4f5a6b", "jobMode": "new_project",
                   "scope": {"outcomes": ["White background"]}, "item": {"productType": "chair"}}
        r = await a7.client.post("/webhook/claude-midas-a7", data={"payload": json.dumps(payload)}, headers={"X-Midas-Key": CLIENT})
        await a7.drain()
        assert r.status_code == 422, r.text
        assert "Only jobs sent from the owner site can start" in r.text
        assert a7.outside.paid() == [] and a7.outside.reserves() == []
        assert [row["status"] for row in a7.store.dt_select(RUNS)] == ["refused"]
