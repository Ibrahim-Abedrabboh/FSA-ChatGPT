"""What every reader module declares.

``n8n_parameters`` is the provider node's parameter object, which the n8n Ticket
node hashes into ``requestSha256``. Keeping it identical keeps the reservation
fingerprint the same for the same draft whichever engine sends it.
"""

from __future__ import annotations

import pathlib
from dataclasses import dataclass
from typing import Any, Callable

from ..intake import Intake
from ..providers.base import ProviderRequest

PROMPTS = pathlib.Path(__file__).resolve().parents[1] / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS / name).read_text(encoding="utf-8")


@dataclass(frozen=True)
class Reader:
    node: str  # ledger node name; must match the site's CALL_POLICY and recover() list
    stage: str  # "03", "05", "06", "09"
    kind: str  # provider kind used by normalizeAnswer: gemini, anthropic, openai
    provider_model: str  # model id sent to the provider
    budget_model: str  # model name in the site's RATES/CALL_POLICY
    input_tokens: int  # reservation input bound (the model's inputLimit in RATES)
    output_tokens: int  # reservation and request output bound (CALL_POLICY)
    n8n_parameters: dict[str, Any]
    build: Callable[[Intake, dict[str, Any]], ProviderRequest]
    state: Callable[[Intake, dict[str, Any]], dict[str, Any]]

    def applies(self, intake: Intake) -> bool:
        return self.stage != "06" or intake.has_room


def intake_state(intake: Intake, _answers: dict[str, Any]) -> dict[str, Any]:
    return intake.state
