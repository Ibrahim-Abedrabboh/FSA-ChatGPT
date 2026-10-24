"""HTTP clients against mock transports (no network)."""

from __future__ import annotations

import asyncio
import base64
import json

import httpx
import pytest

from app.budget import HttpBudgetClient
from app.providers.base import ProviderError, ProviderRequest
from app.providers.fake import DEFAULT_ANSWERS, raw_answer
from app.providers.live import AnthropicProvider, GeminiProvider, OpenAIProvider

IMAGE = b"\x89PNG\r\n\x1a\nimage"


def recorder(reply):
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return reply(request) if callable(reply) else reply

    return httpx.MockTransport(handler), seen


def test_gemini_request_shape():
    transport, seen = recorder(httpx.Response(200, json=raw_answer("gemini", DEFAULT_ANSWERS["06 Room reader"])))
    provider = GeminiProvider("g-key", "https://gemini.test/v1beta", transport)
    req = ProviderRequest(node="06 Room reader", kind="gemini", model="models/gemini-3.8-flash", max_output_tokens=8000, prompt="P", image=IMAGE, image_mime="image/png")
    out = asyncio.run(provider.call(req, 5))
    assert out["candidates"]
    sent = seen[0]
    assert str(sent.url) == "https://gemini.test/v1beta/models/gemini-3.8-flash:generateContent"
    assert sent.headers["x-goog-api-key"] == "g-key"
    body = json.loads(sent.content)
    assert body["generationConfig"] == {"maxOutputTokens": 8000}
    assert body["contents"][0]["parts"] == [{"inline_data": {"mime_type": "image/png", "data": base64.b64encode(IMAGE).decode()}}, {"text": "P"}]


def test_anthropic_request_shape():
    transport, seen = recorder(httpx.Response(200, json=raw_answer("anthropic", DEFAULT_ANSWERS["05 Second count"])))
    provider = AnthropicProvider("a-key", "https://anthropic.test/v1", transport)
    req = ProviderRequest(node="05 Second count", kind="anthropic", model="claude-sonnet-5-5", max_output_tokens=1500, prompt="P", image=IMAGE, image_mime="image/png")
    asyncio.run(provider.call(req, 5))
    sent = seen[0]
    assert str(sent.url) == "https://anthropic.test/v1/messages"
    assert sent.headers["x-api-key"] == "a-key" and sent.headers["anthropic-version"] == "2023-06-01"
    body = json.loads(sent.content)
    assert body["model"] == "claude-sonnet-5-5" and body["max_tokens"] == 1500
    assert [c["type"] for c in body["messages"][0]["content"]] == ["image", "text"]


def test_openai_request_shape():
    transport, seen = recorder(httpx.Response(200, json=raw_answer("openai", DEFAULT_ANSWERS["09 Conflict check"])))
    provider = OpenAIProvider("o-key", "https://openai.test/v1", transport)
    req = ProviderRequest(node="09 Conflict check", kind="openai", model="gpt-6-luna", max_output_tokens=2000, instructions="I", message="{}", json_object=True)
    asyncio.run(provider.call(req, 5))
    sent = seen[0]
    assert str(sent.url) == "https://openai.test/v1/responses"
    assert sent.headers["authorization"] == "Bearer o-key"
    body = json.loads(sent.content)
    assert body == {"model": "gpt-6-luna", "input": [{"role": "user", "content": "{}"}], "instructions": "I",
                    "max_output_tokens": 2000, "store": False, "text": {"format": {"type": "json_object"}}}


@pytest.mark.parametrize("reply,reason", [
    (httpx.Response(500, json={"error": {"message": "boom"}}), "provider_http_error"),
    (httpx.Response(200, text="not json"), "provider_unreadable_answer"),
    (httpx.Response(200, json=[1, 2]), "provider_unreadable_answer"),
])
def test_provider_errors_are_short_codes_without_secrets(reply, reason):
    transport, _ = recorder(reply)
    provider = OpenAIProvider("o-key-secret", "https://openai.test/v1", transport)
    req = ProviderRequest(node="09 Conflict check", kind="openai", model="gpt-6-luna", max_output_tokens=2000)
    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.call(req, 5))
    assert error.value.reason == reason and "o-key-secret" not in str(error.value)


def test_provider_timeout_and_missing_key():
    def slow(_request):
        raise httpx.ReadTimeout("slow")

    transport, _ = recorder(slow)
    req = ProviderRequest(node="09 Conflict check", kind="openai", model="gpt-6-luna", max_output_tokens=2000)
    with pytest.raises(ProviderError, match="provider_timeout"):
        asyncio.run(OpenAIProvider("k", "https://openai.test/v1", transport).call(req, 5))
    with pytest.raises(ProviderError, match="provider_not_configured"):
        asyncio.run(OpenAIProvider("", "https://openai.test/v1", transport).call(req, 5))


def test_budget_client_posts_json_with_authorization_and_never_follows_redirects():
    transport, seen = recorder(httpx.Response(200, json={"send": False, "reason": "budget_limit"}))
    client = HttpBudgetClient("budget-secret", 20, transport)
    reply = asyncio.run(client.reserve("https://site.test", {"node": "05 Second count"}))
    assert reply.status_code == 200 and reply.body["reason"] == "budget_limit"
    assert str(seen[0].url) == "https://site.test/api/a7/budget/reserve"
    assert seen[0].headers["authorization"] == "budget-secret"
    assert json.loads(seen[0].content) == {"node": "05 Second count"}
    redirect, _ = recorder(httpx.Response(302, headers={"location": "https://elsewhere.test"}))
    reply = asyncio.run(HttpBudgetClient("s", 20, redirect).settle("https://site.test", {}))
    assert reply.status_code == 302 and reply.body is None

    def broken(_request):
        raise httpx.ConnectError("down")

    failing, _ = recorder(broken)
    assert asyncio.run(HttpBudgetClient("s", 20, failing).settle("https://site.test", {})).status_code is None
    assert asyncio.run(HttpBudgetClient("", 20, failing).settle("https://site.test", {})).status_code is None
