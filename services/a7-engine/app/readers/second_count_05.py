"""05 Second count: Claude Sonnet 5.5, product photo, 1500 output tokens.

Prompt copied verbatim from analysis-reader-prompts-live.md into prompts/05_second_count.txt.
"""

from __future__ import annotations

from typing import Any

from ..intake import Intake
from ..providers.base import ProviderRequest
from .base import Reader, intake_state, load_prompt

NODE = "05 Second count"
PROMPT = load_prompt("05_second_count.txt")
MAX_OUTPUT_TOKENS = 1500

PARAMETERS: dict[str, Any] = {
    "resource": "image",
    "modelId": {"__rl": True, "mode": "id", "value": "claude-sonnet-5-5"},
    "text": PROMPT,
    "inputType": "binary",
    "binaryPropertyName": "={{ $json.product_key }}",
    "simplify": False,
    "options": {"maxTokens": MAX_OUTPUT_TOKENS},
}


def build(intake: Intake, _answers: dict[str, Any]) -> ProviderRequest:
    photo = intake.binary[intake.product_key]
    return ProviderRequest(node=NODE, kind="anthropic", model="claude-sonnet-5-5", max_output_tokens=MAX_OUTPUT_TOKENS,
                           prompt=PROMPT, image=photo.data, image_mime=photo.mime)


READER = Reader(node=NODE, stage="05", kind="anthropic", provider_model="claude-sonnet-5-5", budget_model="claude-sonnet-5-5",
                input_tokens=1048576, output_tokens=MAX_OUTPUT_TOKENS, n8n_parameters=PARAMETERS, build=build, state=intake_state)
