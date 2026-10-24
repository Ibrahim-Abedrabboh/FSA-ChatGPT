"""Timeouts and retries: one retry after the delay inside the same reservation, an
uncertain settlement when the provider gives no answer, and a run deadline that stops
new reservations but never skips the settlement of one already made."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.providers.base import ProviderError
from app.providers.fake import FakeProvider
from tests.conftest import AUTH, engine_settings, make_job
from tests.fakes import FakeBudgetApi


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0
        self.slept: list[float] = []

    def __call__(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def run(budget, provider, clock=None, **settings):
    clock = clock or Clock()
    app = create_app(engine_settings(**settings), budget=budget, provider=provider, clock=clock, sleep=clock.sleep)
    job = make_job()
    budget.open(job.client_run_id)
    data, files = job.multipart()
    with TestClient(app) as client:
        return client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": AUTH}), clock


def test_provider_timeout_retries_once_after_delay_then_settles_uncertain():
    budget = FakeBudgetApi()
    provider = FakeProvider({"03 Eye reads the product photo": [ProviderError("provider_timeout"), ProviderError("provider_timeout")]})
    r, clock = run(budget, provider, reader_retries=1, reader_retry_delay_s=5.0)
    assert r.status_code == 409 and r.json()["error"] == "analysis_outcome_uncertain"
    assert clock.slept == [5.0]
    assert len(provider.calls) == 2  # one retry, same reservation
    assert budget.actions() == [("reserve", "03 Eye reads the product photo"), ("settle", "03 Eye reads the product photo")]
    settle = budget.calls[-1][2]
    assert settle["usage"] is None and settle["checkpointRequired"] is False and "completeAnswer" not in settle
    assert settle["receiptRef"].startswith("answer:")
    op = next(iter(budget.operations.values()))
    assert op["status"] == "uncertain" and op["accounted_micro_usd"] == op["reserved_micro_usd"]


def test_retry_succeeds_inside_the_same_reservation():
    budget = FakeBudgetApi()
    provider = FakeProvider({"05 Second count": [ProviderError("provider_http_error", 529)]})
    r, clock = run(budget, provider, reader_retry_delay_s=5.0)
    assert r.status_code == 200
    assert [c.node for c in provider.calls].count("05 Second count") == 2
    assert sum(1 for a, _o, req in budget.calls if a == "reserve" and req["node"] == "05 Second count") == 1
    assert clock.slept == [5.0]


def test_no_retry_when_disabled():
    budget = FakeBudgetApi()
    provider = FakeProvider({"03 Eye reads the product photo": [ProviderError("provider_unreachable")]})
    r, clock = run(budget, provider, reader_retries=0)
    assert r.status_code == 409 and len(provider.calls) == 1 and clock.slept == []


def test_real_provider_timeout_is_enforced():
    budget = FakeBudgetApi()
    provider = FakeProvider({"03 Eye reads the product photo": [("sleep", 5), ("sleep", 5)]})
    app = create_app(engine_settings(provider_timeout_s=0.05, reader_retry_delay_s=0.0), budget=budget, provider=provider)
    job = make_job()
    budget.open(job.client_run_id)
    data, files = job.multipart()
    with TestClient(app) as client:
        r = client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": AUTH})
    assert r.status_code == 409
    assert next(iter(budget.operations.values()))["status"] == "uncertain"


def test_deadline_stops_new_reservations_but_settles_the_open_one():
    clock = Clock()

    class SlowProvider(FakeProvider):
        async def call(self, request, timeout_s):
            result = await super().call(request, timeout_s)
            clock.now += 200  # each reader "takes" 200 s
            return result

    budget, provider = FakeBudgetApi(), SlowProvider()
    r, _ = run(budget, provider, clock=clock, run_deadline_s=295)
    assert r.status_code == 409
    # 03 at t=0 (ends 200), 05 at t=200 (ends 400, past the deadline but settled), then nothing new.
    assert budget.actions() == [("reserve", "03 Eye reads the product photo"), ("settle", "03 Eye reads the product photo"),
                                ("reserve", "05 Second count"), ("settle", "05 Second count")]
    assert all(op["status"] == "completed" for op in budget.operations.values())


def test_provider_timeout_is_capped_by_the_remaining_run_time():
    seen: list[float] = []

    class Recording(FakeProvider):
        async def call(self, request, timeout_s):
            seen.append(timeout_s)
            return await super().call(request, timeout_s)

    run(FakeBudgetApi(), Recording(), provider_timeout_s=120, run_deadline_s=30)
    assert seen and all(t <= 30 for t in seen)


def test_retry_skipped_when_delay_would_pass_the_deadline():
    clock = Clock()
    provider = FakeProvider({"03 Eye reads the product photo": [ProviderError("provider_http_error", 500)]})
    r, _ = run(FakeBudgetApi(), provider, clock=clock, run_deadline_s=12, reader_retry_delay_s=15.0)
    assert r.status_code == 409 and len(provider.calls) == 1 and clock.slept == []


def test_no_reservation_when_too_little_run_time_remains():
    clock = Clock()

    class SlowProvider(FakeProvider):
        async def call(self, request, timeout_s):
            result = await super().call(request, timeout_s)
            clock.now += 50
            return result

    budget, provider = FakeBudgetApi(), SlowProvider()
    r, _ = run(budget, provider, clock=clock, run_deadline_s=58, min_stage_s=10)
    assert r.status_code == 409
    # 03 ends at 50 s; 8 s remain, under the 10 s minimum, so 05 is never reserved.
    assert budget.actions() == [("reserve", "03 Eye reads the product photo"), ("settle", "03 Eye reads the product photo")]


def test_budget_reserve_timeout_holds_without_provider_call():
    budget = FakeBudgetApi()
    budget.fail["reserve"] = ["transport"]
    provider = FakeProvider()
    r, _ = run(budget, provider)
    assert r.status_code == 409 and provider.calls == []
