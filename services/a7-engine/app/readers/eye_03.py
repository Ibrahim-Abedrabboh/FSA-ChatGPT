"""03 Eye reads the product photo: Gemini 3.8 Flash, product photo, 16000 output tokens.

Prompt v3 (owner-approved 19 Oct 2026), copied verbatim from
analysis-reader-prompts-live.md into prompts/03_eye.txt.
"""

from __future__ import annotations

from typing import Any

from ..intake import Intake
from ..providers.base import ProviderRequest
from .base import Reader, intake_state, load_prompt

NODE = "03 Eye reads the product photo"
PROMPT = load_prompt("03_eye.txt")
MAX_OUTPUT_TOKENS = 16000

PARAMETERS: dict[str, Any] = {
    "resource": "image",
    "operation": "analyze",
    "modelId": {"__rl": True, "mode": "id", "value": "models/gemini-3.8-flash"},
    "text": PROMPT,
    "inputType": "binary",
    "binaryPropertyName": "={{ $json.product_key }}",
    "simplify": False,
    "options": {"maxOutputTokens": MAX_OUTPUT_TOKENS},
}


def build(intake: Intake, _answers: dict[str, Any]) -> ProviderRequest:
    photo = intake.binary[intake.product_key]
    return ProviderRequest(node=NODE, kind="gemini", model="models/gemini-3.8-flash", max_output_tokens=MAX_OUTPUT_TOKENS,
                           prompt=PROMPT, image=photo.data, image_mime=photo.mime)


READER = Reader(node=NODE, stage="03", kind="gemini", provider_model="models/gemini-3.8-flash", budget_model="gemini-3.8-flash",
                input_tokens=1048576, output_tokens=MAX_OUTPUT_TOKENS, n8n_parameters=PARAMETERS, build=build, state=intake_state)
