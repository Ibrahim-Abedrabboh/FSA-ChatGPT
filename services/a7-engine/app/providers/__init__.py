from __future__ import annotations

from typing import Any

from ..config import Settings
from .base import Provider, ProviderError, ProviderRequest
from .fake import FakeProvider
from .live import AnthropicProvider, GeminiProvider, OpenAIProvider


class ProviderRouter:
    """Routes a request to the provider for its kind."""

    def __init__(self, providers: dict[str, Provider]):
        self._providers = providers

    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]:
        provider = self._providers.get(request.kind)
        if provider is None:
            raise ProviderError("provider_not_configured")
        return await provider.call(request, timeout_s)


def providers_from_settings(settings: Settings) -> Provider:
    if settings.provider_mode == "fake":
        return FakeProvider()
    return ProviderRouter({
        "gemini": GeminiProvider(settings.gemini_api_key, settings.gemini_base_url),
        "anthropic": AnthropicProvider(settings.anthropic_api_key, settings.anthropic_base_url),
        "openai": OpenAIProvider(settings.openai_api_key, settings.openai_base_url),
    })


__all__ = ["Provider", "ProviderError", "ProviderRequest", "ProviderRouter", "FakeProvider", "providers_from_settings"]
