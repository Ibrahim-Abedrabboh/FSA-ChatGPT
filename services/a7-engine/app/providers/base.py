"""Provider interface shared by every reader.

A provider takes a ``ProviderRequest`` and returns the provider's raw JSON answer
(the same object n8n's node passes on with ``simplify: false``). Any failure raises
``ProviderError``; the pipeline then settles the reservation as uncertain, exactly as
n8n's ``onError: continueRegularOutput`` path does.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ProviderRequest:
    node: str
    kind: str  # "gemini", "anthropic" or "openai"
    model: str  # provider model id, e.g. "models/gemini-3.8-flash"
    max_output_tokens: int
    prompt: str = ""  # user text for image readers
    instructions: str = ""  # system instructions (09)
    message: str = ""  # user message text (09)
    image: bytes | None = field(default=None, repr=False)
    image_mime: str = ""
    json_object: bool = False


class ProviderError(Exception):
    """A provider call failed. ``reason`` is a short, non-secret code."""

    def __init__(self, reason: str, status_code: int | None = None):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


class Provider(Protocol):
    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]: ...
