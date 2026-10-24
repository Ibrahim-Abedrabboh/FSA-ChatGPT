"""A retry never pays twice."""

from __future__ import annotations

import asyncio
import copy
import json
import uuid

import httpx
import pytest

from app.main import create_app
from app.providers.fake import FakeProvider
from tests.conftest import AUTH, engine_settings, make_job
from tests.fakes import FakeBudgetApi


def test_same_request_id_is_answered_again_without_paying(harness):
    h = harness()
    job = make_job()
    first = h.post(job)
    calls, provider_calls = len(h.budget.calls), len(h.provider.calls)
    second = h.post(job)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(h.budget.calls) == calls and len(h.provider.calls) == provider_calls


def test_same_draft_new_request_is_refused_by_the_ledger_not_paid(harness):
    """A new request for an analysed draft (or a fresh process) reaches the ledger, which
    reports operation_already_exists for 03; the run holds before any provider call."""
    h = harness()
    job = make_job()
    assert h.post(job).status_code == 200
    provider_calls = len(h.provider.calls)
    retry = copy.deepcopy(job)
    retry.payload["requestId"] = str(uuid.uuid4())
    r = h.post(retry)
    assert r.status_code == 409 and r.json()["error"] == "analysis_outcome_uncertain"
    assert len(h.provider.calls) == provider_calls
    last = h.budget.calls[-1]
    assert last[0] == "reserve" and last[2]["node"] == "03 Eye reads the product photo"
    assert len(h.budget.operations) == 3


def test_new_process_same_request_still_does_not_pay(harness):
    """The in-memory answer cache is per process; the ledger guard holds across restarts."""
    budget = FakeBudgetApi()
    first = harness(budget=budget)
    job = make_job()
    assert first.post(job).status_code == 200
    restarted = harness(budget=budget)
    r = restarted.post(job, open_budget=False)
    assert r.status_code == 409
    assert restarted.provider.calls == []
    assert sum(1 for a, _o, _r in budget.calls if a == "reserve") == 4


def test_retry_after_a_hold_before_any_reservation_can_proceed(harness):
    h = harness()
    job = make_job()
    h.budget.fail["reserve"] = ["transport"]
    assert h.post(job).status_code == 409
    assert h.provider.calls == []
    assert h.post(job).status_code == 200


def test_changed_request_in_the_same_slot_conflicts(harness):
    """Same draft, different bytes or instructions: same operation key, different request
    hash, so the ledger answers operation_conflict instead of a second permit."""
    h = harness()
    job = make_job()
    assert h.post(job).status_code == 200
    changed = copy.deepcopy(job)
    changed.payload["requestId"] = str(uuid.uuid4())
    changed.payload["instructions"] = "Different"
    r = h.post(changed)
    assert r.status_code == 409
    assert h.budget.calls[-1][0] == "reserve"
    assert len([c for c in h.provider.calls]) == 3


@pytest.mark.parametrize("same_request", [True, False])
def test_concurrent_duplicates_share_one_run(same_request):
    async def scenario():
        gate = asyncio.Event()

        async def slow_eye(_request):
            await gate.wait()
            from app.providers.fake import DEFAULT_ANSWERS, raw_answer
            return raw_answer("gemini", DEFAULT_ANSWERS["03 Eye reads the product photo"])

        class GatedProvider(FakeProvider):
            async def call(self, request, timeout_s):
                if request.node == "03 Eye reads the product photo":
                    self.calls.append(request)
                    return await slow_eye(request)
                return await super().call(request, timeout_s)

        budget, provider = FakeBudgetApi(), GatedProvider()
        app = create_app(engine_settings(), budget=budget, provider=provider)
        job = make_job()
        budget.open(job.client_run_id)
        other = copy.deepcopy(job)
        if not same_request:
            other.payload["requestId"] = str(uuid.uuid4())

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://engine") as client:
            def send(j):
                data, files = j.multipart()
                return client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": AUTH})

            first = asyncio.create_task(send(job))
            while not provider.calls:
                await asyncio.sleep(0.001)
            second = asyncio.create_task(send(other))
            await asyncio.sleep(0.01)
            gate.set()
            return await first, await second, budget, provider

    first, second, budget, provider = asyncio.run(scenario())
    assert first.status_code == 200
    if same_request:
        assert second.status_code == 200 and second.json() == first.json()
    else:
        assert second.status_code == 409 and json.loads(second.text)["error"] == "analysis_outcome_uncertain"
    assert sum(1 for a, _o, _r in budget.calls if a == "reserve") == 3
    assert len(provider.calls) == 3
