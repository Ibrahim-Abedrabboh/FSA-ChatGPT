"""06 Room reader: Gemini 3.8 Flash, typed room photo only, 8000 output tokens.

Runs only when the job has a room photo (``roomSha256``). Prompt copied verbatim
from analysis-reader-prompts-live.md into prompts/06_room_reader.txt.
"""

from __future__ import annotations

from typing import Any

from ..intake import Intake
from ..providers.base import ProviderRequest
from .base import Reader, intake_state, load_prompt

NODE = "06 Room reader"
PROMPT = load_prompt("06_room_reader.txt")
MAX_OUTPUT_TOKENS = 8000

PARAMETERS: dict[str, Any] = {
    "resource": "image",
    "operation": "analyze",
    "modelId": {"__rl": True, "mode": "id", "value": "models/gemini-3.8-flash"},
    "text": PROMPT,
    "inputType": "binary",
    "binaryPropertyName": "={{ $json.room_key }}",
    "simplify": False,
    "options": {"maxOutputTokens": MAX_OUTPUT_TOKENS},
}


def build(intake: Intake, _answers: dict[str, Any]) -> ProviderRequest:
    photo = intake.binary[intake.room_key]
    return ProviderRequest(node=NODE, kind="gemini", model="models/gemini-3.8-flash", max_output_tokens=MAX_OUTPUT_TOKENS,
                           prompt=PROMPT, image=photo.data, image_mime=photo.mime)


READER = Reader(node=NODE, stage="06", kind="gemini", provider_model="models/gemini-3.8-flash", budget_model="gemini-3.8-flash",
                input_tokens=1048576, output_tokens=MAX_OUTPUT_TOKENS, n8n_parameters=PARAMETERS, build=build, state=intake_state)
