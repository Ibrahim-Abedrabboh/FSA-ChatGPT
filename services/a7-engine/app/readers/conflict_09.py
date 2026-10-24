"""09 Conflict check: GPT-6 Luna (OpenAI Responses API), JSON object output, 2000 tokens.

The message is the conflict ticket built like n8n's "Prepare analysis conflict
ticket" node: the raw 03/05/(06) answers as JSON strings, the client's written
instructions and empty code-found conflict and unknown lists. Instructions copied
verbatim from analysis-reader-prompts-live.md into prompts/09_conflict_check.txt.
"""

from __future__ import annotations

from typing import Any

from ..canonical import js_stringify
from ..intake import Intake
from ..providers.base import ProviderRequest
from .base import Reader, load_prompt

NODE = "09 Conflict check"
INSTRUCTIONS = load_prompt("09_conflict_check.txt")
MAX_OUTPUT_TOKENS = 2000
EYE, SECOND, ROOM = "03 Eye reads the product photo", "05 Second count", "06 Room reader"

PARAMETERS: dict[str, Any] = {
    "modelId": {"__rl": True, "mode": "id", "value": "gpt-6-luna"},
    "responses": {"values": [{"content": "={{ $('Prepare analysis conflict ticket').first().json.conflict_ticket }}"}]},
    "simplify": False,
    "builtInTools": {},
    "options": {
        "instructions": INSTRUCTIONS,
        "maxTokens": MAX_OUTPUT_TOKENS,
        "store": False,
        "textFormat": {"textOptions": {"type": "json_object"}},
    },
}


def conflict_ticket(intake: Intake, answers: dict[str, Any]) -> str:
    p = intake.payload
    return js_stringify({
        "source_sha256": p["sourceSha256"],
        "eye": js_stringify(answers[EYE]),
        "second": js_stringify(answers[SECOND]),
        "room": js_stringify(answers[ROOM]) if p.get("roomSha256") else None,
        "instructions": p.get("instructions") or "",
        "conflicts": [],
        "unknowns": [],
    })


def state(intake: Intake, answers: dict[str, Any]) -> dict[str, Any]:
    return {**intake.state, "conflict_ticket": conflict_ticket(intake, answers)}


def build(intake: Intake, answers: dict[str, Any]) -> ProviderRequest:
    return ProviderRequest(node=NODE, kind="openai", model="gpt-6-luna", max_output_tokens=MAX_OUTPUT_TOKENS,
                           instructions=INSTRUCTIONS, message=conflict_ticket(intake, answers), json_object=True)


READER = Reader(node=NODE, stage="09", kind="openai", provider_model="gpt-6-luna", budget_model="gpt-6-luna",
                input_tokens=1050000, output_tokens=MAX_OUTPUT_TOKENS, n8n_parameters=PARAMETERS, build=build, state=state)
