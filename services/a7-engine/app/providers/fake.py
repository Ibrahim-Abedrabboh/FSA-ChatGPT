"""Fake provider for tests and smoke runs. It never touches the network.

Each answer has the shape the real provider returns, so the site's
``normalizeAnswer`` and ``answerObject`` accept it unchanged.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Callable

from .base import ProviderError, ProviderRequest

DEFAULT_ANSWERS: dict[str, dict[str, Any]] = {
    "03 Eye reads the product photo": {
        "upload_type": "W2",
        "category": "Sofa",
        "pieces": [
            {"label": "left module", "kind": "sectional module", "seats": 2, "seen_whole": True, "role": "product"},
            {"label": "right module", "kind": "sectional module", "seats": 2, "seen_whole": True, "role": "product"},
            {"label": "plant", "kind": "plant", "seats": None, "seen_whole": True, "role": "context"},
        ],
        "count_by_kind": [{"kind": "sectional module", "count": 2}],
        "views_not_pieces": [],
        "colour_observed": "cream",
        "material_appearance": "woven fabric",
        "design_locks": ["low track arms, cream"],
        "unknowns": ["dimensions"],
        "conflicts": [],
        "cropped": False,
        "occluded": False,
        "blocking_question": None,
    },
    "05 Second count": {"pieces": [{"kind": "sectional module", "count": 2}], "excluded": [], "total": 2, "unclear": [], "cropped": False},
    "06 Room reader": {
        "room_type": "Living room", "walls": "white", "floor": "oak", "windows": "one", "doors": "one",
        "built_ins": "none seen", "fixed_objects": ["radiator"], "camera": {"height": "eye", "angle": "front"},
        "light": {"direction": "left", "kind": "daylight"}, "free_floor_zone": "centre", "unknowns": ["exact dimensions"],
    },
    "09 Conflict check": {"conflicts": [], "instruction_locks": [], "summary": "No unresolved conflict."},
}


def raw_answer(kind: str, answer: dict[str, Any], index: int = 0) -> dict[str, Any]:
    text = json.dumps(answer)
    if kind == "gemini":
        return {
            "candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 1200 + index, "candidatesTokenCount": 300, "thoughtsTokenCount": 40},
            "modelVersion": "gemini-3.8-flash",
        }
    if kind == "anthropic":
        return {
            "id": f"msg_fake{index:04d}", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
            "content": [{"type": "text", "text": text}], "stop_reason": "end_turn",
            "usage": {"input_tokens": 1500, "output_tokens": 80, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
        }
    return {
        "id": f"resp_fake{index:04d}", "object": "response", "status": "completed", "model": "gpt-6-luna",
        "output": [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}],
        "usage": {"input_tokens": 900, "output_tokens": 70},
    }


class FakeProvider:
    """Records every request. ``behaviour`` maps a node to an answer dict, an exception,
    a delay in seconds (``("sleep", seconds)``) or a callable returning a raw answer."""

    def __init__(self, behaviour: dict[str, Any] | None = None):
        self.behaviour = behaviour or {}
        self.calls: list[ProviderRequest] = []

    async def call(self, request: ProviderRequest, timeout_s: float) -> dict[str, Any]:
        self.calls.append(request)
        index = len(self.calls)
        rule = self.behaviour.get(request.node)
        if isinstance(rule, list):
            rule = rule.pop(0) if rule else None
        if isinstance(rule, BaseException):
            raise rule
        if isinstance(rule, tuple) and rule and rule[0] == "sleep":
            try:
                await asyncio.wait_for(asyncio.sleep(rule[1]), timeout=timeout_s)
            except asyncio.TimeoutError as error:
                raise ProviderError("provider_timeout") from error
            rule = None
        if callable(rule):
            result: Callable[[ProviderRequest], dict[str, Any]] = rule
            return result(request)
        answer = rule if isinstance(rule, dict) else DEFAULT_ANSWERS[request.node]
        return raw_answer(request.kind, answer, index)
