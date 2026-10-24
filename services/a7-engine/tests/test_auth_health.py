from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import authorized, create_app
from tests.conftest import AUTH, make_job


def test_health_reports_no_secret_values(harness):
    h = harness()
    r = h.client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["service"] == "a7-engine" and body["configured"] is True
    assert AUTH not in r.text and "test-budget-authorization" not in r.text


def test_wrong_or_missing_authorization_is_refused_before_reading(harness):
    h = harness()
    job = make_job()
    for auth in (None, "", "wrong", AUTH + "x", "x" * 5000):
        r = h.post(job, auth=auth)
        assert r.status_code == 403 and r.json() == {"error": "unauthorized"}
    assert h.budget.calls == [] and h.provider.calls == []


def test_unconfigured_engine_refuses_and_says_so_without_names():
    app = create_app(Settings())
    with TestClient(app) as client:
        assert client.get("/health").json()["configured"] is False
        data, files = make_job().multipart()
        r = client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": "anything"})
    assert r.status_code == 503 and r.json() == {"error": "engine_not_configured"}


def test_live_mode_requires_all_provider_keys():
    app = create_app(Settings(engine_authorization=AUTH, budget_authorization="b", gemini_api_key="g", anthropic_api_key="a"))
    with TestClient(app) as client:
        data, files = make_job().multipart()
        r = client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": AUTH})
    assert r.status_code == 503


def test_constant_time_compare_helper():
    assert authorized("secret", "secret")
    assert not authorized("secret", "Secret")
    assert not authorized("", "")
    assert not authorized("secret", "s" * 5000)


def test_fake_provider_mode_never_serves_real_requests():
    """Fake answers settled into a real ledger would look like paid, completed reads."""
    app = create_app(Settings(engine_authorization=AUTH, budget_authorization="b", provider_mode="fake"))
    with TestClient(app) as client:
        data, files = make_job().multipart()
        r = client.post("/webhook/a7/owner-analyze", data=data, files=files, headers={"Authorization": AUTH})
    assert r.status_code == 503 and r.json() == {"error": "engine_not_configured"}


def test_settings_from_env_hide_secrets(monkeypatch):
    monkeypatch.setenv("A7_ENGINE_AUTHORIZATION", "engine-secret")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.setenv("A7_BUDGET_ORIGINS", "https://a.example/, https://b.example")
    monkeypatch.setenv("A7_READER_RETRIES", "not-a-number")
    s = Settings.from_env()
    assert s.engine_authorization == "engine-secret" and s.reader_retries == 1
    assert s.budget_origins == ("https://a.example", "https://b.example")
    assert s.budget_origin_for("https://b.example") == "https://b.example"
    assert s.budget_origin_for("https://c.example") == "https://midas-a7-owner-preview.netlify.app"
    assert s.gemini_base_url == "https://generativelanguage.googleapis.com/v1beta"
    assert "secret" not in repr(s)


def test_only_post_on_the_webhook(harness):
    h = harness()
    assert h.client.get("/webhook/a7/owner-analyze").status_code == 405
