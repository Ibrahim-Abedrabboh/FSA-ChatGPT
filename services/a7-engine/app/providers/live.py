"""Real provider clients. Keys come from environment variables (see config.py) and are
sent only in the provider's own auth header; they are never logged or returned.

These request shapes follow each provider's public REST API. They have not been
compared byte-for-byte with what n8n's Gemini, Anthropic and OpenAI nodes send; see
the parity checklist in README.md.
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from .base import ProviderError, ProviderRequest


class _HttpProvider:
    def __init__(self, api_key: str, base_url: str, transport: httpx.AsyncBaseTransport | None = None):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._transport = transport

    async def _post(self, url: str, headers: dict[str, str], body: dict[str, Any], timeout_s: float) -> dict[str, Any]:
        if not self._api_key:
            raise ProviderError("provider_not_configured")
        try:
            async with httpx.AsyncClient(timeout=timeout_s, follow_redirects=False, transport=self._transport) as client:
                response = await client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as error:
            raise ProviderError("provider_timeout") from error
        except (httpx.HTTPError, OSError) as error:
            raise ProviderError("provider_unreachable") from error
        if response.status_code != 200:
            raise ProviderError("provider_http_error", response.status_code)
        try:
            data = response.json()
        except ValueError as error:
            raise ProviderError("provider_unreadable_answer", response.status_code) from error
        if not isinstance(data, dict):
            raise ProviderError("provider_unreadable_answer", response.status_code)
        return data


class GeminiProvider(_HttpProvider):
    """Google Generative Language API, ``models/{model}:generateContent``."""

    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]:
        model = request.model if request.model.startswith("models/") else "models/" + request.model
        parts: list[dict[str, Any]] = []
        if request.image is not None:
            parts.append({"inline_data": {"mime_type": request.image_mime, "data": base64.b64encode(request.image).decode("ascii")}})
        parts.append({"text": request.prompt})
        body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": {"maxOutputTokens": request.max_output_tokens}}
        return await self._post(f"{self._base_url}/{model}:generateContent", {"x-goog-api-key": self._api_key}, body, timeout_s)


class AnthropicProvider(_HttpProvider):
    """Anthropic Messages API."""

    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]:
        content: list[dict[str, Any]] = []
        if request.image is not None:
            content.append({"type": "image", "source": {"type": "base64", "media_type": request.image_mime, "data": base64.b64encode(request.image).decode("ascii")}})
        content.append({"type": "text", "text": request.prompt})
        body = {"model": request.model, "max_tokens": request.max_output_tokens, "messages": [{"role": "user", "content": content}]}
        headers = {"x-api-key": self._api_key, "anthropic-version": "2023-06-01"}
        return await self._post(f"{self._base_url}/messages", headers, body, timeout_s)


class OpenAIProvider(_HttpProvider):
    """OpenAI Responses API (n8n's OpenAI node v2 "responses" resource)."""

    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": request.model,
            "input": [{"role": "user", "content": request.message}],
            "instructions": request.instructions,
            "max_output_tokens": request.max_output_tokens,
            "store": False,
        }
        if request.json_object:
            body["text"] = {"format": {"type": "json_object"}}
        return await self._post(f"{self._base_url}/responses", {"Authorization": "Bearer " + self._api_key}, body, timeout_s)
