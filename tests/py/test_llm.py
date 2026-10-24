"""LLM vendor nodes (OpenAI, Google Gemini, Anthropic) on the real A7 node definitions.

Every provider call goes to an httpx.MockTransport: the tests check the exact request each node sends,
that the item is the provider's raw response (simplify off), the continue-on-fail error items, and that
the real Code nodes after the readers (budget receipts, the 04-06 evidence parser) read these outputs.
The OpenAI and Anthropic answers are trimmed copies of what n8n recorded in run 1591 ("11 Stylist plans
the scenes", "11c Plan critic"); the other answers follow the providers' documented response shapes.
"""

from __future__ import annotations

import base64
import copy
import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from conftest import link, make_flow, run_flow
from midas_a7.engine.model import flow_from_definition
from midas_a7.flows import a7_main, analysis_only
from midas_a7.nodes import llm

PNG = b"\x89PNG\r\n\x1a\n" + b"vendor-photo"
JPEG = b"\xff\xd8\xff\xe0" + b"candidate-image"

STYLIST_PLAN = {
    "shots": [
        {"output_id": "white_master", "frame": "square, 1:1",
         "setting": "Pure white seamless background with no room or supporting pieces.", "midas_pieces": []},
        {"output_id": "hero", "frame": "square, 1:1", "room_size": "large",
         "midas_pieces": [{"sku": "141368", "count": 1, "rests_on": "Oak floor between the three seating pieces"}]},
    ],
    "risks": ["Merging the separate sofas into a sectional or altering their source angles."],
}
# Raw Responses API object as OpenAI sends it (n8n drops `error: null` and decodes the JSON-mode text).
OPENAI_TEXT_RESPONSE = {
    "id": "resp_0f1b4b83a8b88948016ad7748b7fac87d28ff3b79c6db12c37", "object": "response", "created_at": 1792504971,
    "status": "completed", "background": False, "error": None, "incomplete_details": None, "instructions": "(trimmed)",
    "max_output_tokens": 8000, "model": "gpt-6.1-sol",
    "output": [
        {"id": "rs_0f1b4b83a8b88948016ad7748d20d087d2a628cba0861f1338", "type": "reasoning", "content": [],
         "encrypted_content": "gAAAA(trimmed)", "summary": []},
        {"id": "msg_0f1b4b83a8b88948016ad7749306cc87d2ac4d546bae0c4aae", "type": "message", "status": "completed",
         "content": [{"type": "output_text", "annotations": [], "logprobs": [], "text": json.dumps(STYLIST_PLAN)}],
         "phase": "final_answer", "role": "assistant"},
    ],
    "parallel_tool_calls": True, "store": False, "text": {"format": {"type": "json_object"}, "verbosity": "medium"},
    "tools": [], "truncation": "disabled",
    "usage": {"input_tokens": 3329, "input_tokens_details": {"cache_write_tokens": 3326, "cached_tokens": 0},
              "output_tokens": 1392, "output_tokens_details": {"reasoning_tokens": 158}, "total_tokens": 4721},
}
CRITIC_TEXT = ('```json\n{\n  "plans": [\n    {\n      "shot": 1,\n      "checks": {"product_unchanged": {"result": "pass", '
               '"evidence": "all three double-seat pieces"}},\n      "rewrite": null\n    }\n  ]\n}\n```')
ANTHROPIC_TEXT_RESPONSE = {
    "model": "claude-sonnet-5-5", "id": "msg_011CgDca3Tj5kqzyP1hurdsW", "type": "message", "role": "assistant",
    "content": [{"type": "thinking", "thinking": "", "signature": "CAQS(trimmed)"}, {"type": "text", "text": CRITIC_TEXT}],
    "container": None, "stop_reason": "end_turn", "stop_sequence": None, "stop_details": None,
    "usage": {"input_tokens": 3631, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
              "cache_creation": {"ephemeral_5m_input_tokens": 0, "ephemeral_1h_input_tokens": 0}, "output_tokens": 2745,
              "output_tokens_details": {"thinking_tokens": 1384}, "service_tier": "standard"},
    "diagnostics": None,
}
EYE_READING = {"category": "sofa set", "pieces": [{"label": "left sofa", "kind": "double seat", "role": "product"}],
               "count_by_kind": [{"kind": "double seat", "count": 3}]}
GEMINI_RESPONSE = {
    "candidates": [{"content": {"parts": [{"text": "```json\n" + json.dumps(EYE_READING) + "\n```"}], "role": "model"},
                    "finishReason": "STOP", "index": 0}],
    "usageMetadata": {"promptTokenCount": 1834, "candidatesTokenCount": 412, "totalTokenCount": 3010, "thoughtsTokenCount": 764},
    "modelVersion": "gemini-3.8-flash", "responseId": "8nTXaqKXJ5bqz7IP",
}
COUNT_READING = {"pieces": [{"kind": "double seat", "count": 3}], "excluded": [], "total": 3, "unclear": [], "cropped": False}
ANTHROPIC_IMAGE_RESPONSE = {
    "model": "claude-sonnet-5-5", "id": "msg_01SecondCount", "type": "message", "role": "assistant",
    "content": [{"type": "text", "text": json.dumps(COUNT_READING)}], "stop_reason": "end_turn", "stop_sequence": None,
    "usage": {"input_tokens": 1650, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0, "output_tokens": 120},
}
ROOM_READING = {"room_type": "living room", "walls": "white", "floor": "oak", "fixed_objects": ["radiator"]}
OPENAI_IMAGE_RESPONSE = {
    "id": "resp_room_fallback_1", "object": "response", "status": "completed", "error": None, "model": "gpt-6.1-sol",
    "output": [{"id": "msg_room_1", "type": "message", "status": "completed", "role": "assistant",
                "content": [{"type": "output_text", "annotations": [], "logprobs": [], "text": json.dumps(ROOM_READING)}]}],
    "usage": {"input_tokens": 1210, "input_tokens_details": {"cached_tokens": 0}, "output_tokens": 230,
              "output_tokens_details": {"reasoning_tokens": 64}, "total_tokens": 1440},
}

START = {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}}


class FakeApi:
    """Answers provider calls from routes (URL fragment -> JSON body or callable) and records every request."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.routes: list[tuple[str, Any]] = []

    def on(self, fragment: str, reply: Any) -> None:
        self.routes.append((fragment, reply))

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        for fragment, reply in self.routes:
            if fragment in str(request.url):
                return reply(request) if callable(reply) else httpx.Response(200, json=copy.deepcopy(reply))
        return httpx.Response(404, json={"error": {"message": f"no fake route for {request.url}"}})

    def body(self, n: int = -1) -> Any:
        return json.loads(self.requests[n].content)


@pytest.fixture
async def api(services, monkeypatch):
    for env, value in {"OPENAI_API_KEY": "sk-test", "GEMINI_API_KEY": "gm-test", "ANTHROPIC_API_KEY": "an-test"}.items():
        monkeypatch.setenv(env, value)
    for env in ("OPENAI_BASE_URL", "GEMINI_BASE_URL", "ANTHROPIC_BASE_URL", "ANTHROPIC_WORKSPACE_ID"):
        monkeypatch.delenv(env, raising=False)
    fake = FakeApi()
    real = services.http
    services.http = httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
    yield fake
    await services.http.aclose()
    services.http = real


def real_node(module, name: str, **changes) -> dict:
    node = copy.deepcopy(next(n for n in module.FLOW["nodes"] if n["name"] == name))
    node.update(changes)
    return node


def code(name: str, js: str, x: int) -> dict:
    return {"name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [x, 0], "parameters": {"jsCode": js}}


async def run_one(executor, node: dict, items: list[dict], before: list[dict] | None = None):
    """Start -> [before...] -> node; returns the execution and the node's output items."""
    chain = [START, *(before or []), {**node, "position": [1000, 0]}]
    flow = make_flow(chain, link(*[(a["name"], b["name"]) for a, b in zip(chain, chain[1:])]))
    ex = await run_flow(executor, flow, items)
    return ex, ex.latest_output(node["name"])


async def photo(services, data: bytes, mime: str, name: str) -> dict:
    return await services.binaries.put("1", data, mime, name)


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


# ---------- OpenAI ----------
async def test_openai_text_sends_responses_request_and_returns_raw_response(executor, api):
    api.on("/v1/responses", OPENAI_TEXT_RESPONSE)
    node = real_node(a7_main, "11 Stylist plans the scenes")
    ex, out = await run_one(executor, node, [{"json": {"plan_request": "Plan 2 photographs of the same product."}}])
    assert ex.status == "success", ex.error

    req = api.requests[0]
    assert (req.method, str(req.url)) == ("POST", "https://api.openai.com/v1/responses")
    assert req.headers["authorization"] == "Bearer sk-test"
    assert api.body() == {
        "model": "gpt-6.1-sol",
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": "You are a helpful assistant designed to output JSON."}]},
            {"role": "user", "content": [{"type": "input_text", "text": "Plan 2 photographs of the same product."}]},
        ],
        "parallel_tool_calls": True,
        "store": False,
        "instructions": node["parameters"]["options"]["instructions"],
        "max_output_tokens": 8000,
        "background": False,
        "text": {"verbosity": "medium", "format": {"type": "json_object"}},
    }
    expected = copy.deepcopy(OPENAI_TEXT_RESPONSE)
    del expected["error"]
    expected["output"][1]["content"][0]["text"] = STYLIST_PLAN  # JSON mode: n8n decodes output_text
    assert out == [{"json": expected}]


async def test_openai_text_prompt_from_another_node(executor, api):
    api.on("/v1/responses", OPENAI_TEXT_RESPONSE)
    ticket = code("08 Locks and freedoms", "return [{json:{conflict_ticket:'{\"conflicts\":[]}'}}];", 500)
    ex, out = await run_one(executor, real_node(a7_main, "09 Conflict check"), [{"json": {}}], [ticket])
    body = api.body()
    assert (body["model"], body["max_output_tokens"], body["store"]) == ("gpt-6-luna", 2000, False)
    assert body["input"][1]["content"][0]["text"] == '{"conflicts":[]}'
    assert out[0]["json"]["usage"]["output_tokens"] == 1392


async def test_openai_text_keeps_text_when_json_mode_answer_is_not_json(executor, api):
    answer = copy.deepcopy(OPENAI_TEXT_RESPONSE)
    answer["output"][1]["content"][0]["text"] = "Sorry, no JSON today"
    api.on("/v1/responses", answer)
    _, out = await run_one(executor, real_node(a7_main, "11 Stylist plans the scenes"), [{"json": {"plan_request": "Plan"}}])
    assert out[0]["json"]["output"][1]["content"][0]["text"] == "Sorry, no JSON today"


async def test_openai_image_analyze_sends_base64_image_after_prompt(executor, api, services):
    api.on("/v1/responses", OPENAI_IMAGE_RESPONSE)
    node = real_node(a7_main, "06b Room fallback (OpenAI)")
    ref = await photo(services, JPEG, "image/jpeg", "room.jpg")
    ex, out = await run_one(executor, node, [{"json": {"room_key": "room"}, "binary": {"room": ref}}])
    assert ex.status == "success", ex.error
    assert api.body() == {
        "model": "gpt-6.1-sol",
        "input": [{"role": "user", "content": [
            {"type": "input_text", "text": node["parameters"]["text"]},
            {"type": "input_image", "detail": "high", "image_url": "data:image/jpeg;base64," + b64(JPEG)},
        ]}],
        "max_output_tokens": 8000,
    }
    expected = copy.deepcopy(OPENAI_IMAGE_RESPONSE)
    del expected["error"]
    assert out == [{"json": expected}]  # no JSON mode here: output_text stays a string


# ---------- Google Gemini ----------
async def test_gemini_analyze_sends_inline_image_and_returns_raw_response(executor, api, services):
    api.on(":generateContent", GEMINI_RESPONSE)
    node = real_node(a7_main, "03 Eye reads the product photo")
    ref = await photo(services, PNG, "image/png", "vendor.png")
    ex, out = await run_one(executor, node, [{"json": {"product_key": "product"}, "binary": {"product": ref}}])
    assert ex.status == "success", ex.error

    req = api.requests[0]
    assert str(req.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    assert req.headers["x-goog-api-key"] == "gm-test" and "key" not in req.url.params
    assert api.body() == {
        "contents": [{"role": "user", "parts": [
            {"inlineData": {"mimeType": "image/png", "data": b64(PNG)}},
            {"text": node["parameters"]["text"]},
        ]}],
        "generationConfig": {"maxOutputTokens": 16000},
    }
    assert out == [{"json": GEMINI_RESPONSE}]


async def test_gemini_large_images_go_through_the_files_api(executor, api, services, monkeypatch):
    monkeypatch.setattr(llm, "GEMINI_INLINE_LIMIT", 4)
    monkeypatch.setattr(llm, "GEMINI_FILE_POLL_SECONDS", 0)
    uploaded = {"name": "files/abc123", "uri": "https://generativelanguage.googleapis.com/v1beta/files/abc123",
                "mimeType": "image/png"}
    api.on("upload.test", {"file": {**uploaded, "state": "PROCESSING"}})
    api.on("/upload/v1beta/files", lambda r: httpx.Response(200, headers={"x-goog-upload-url": "https://upload.test/u/1"}, json={}))
    api.on("/v1beta/files/abc123", {**uploaded, "state": "ACTIVE"})
    api.on(":generateContent", GEMINI_RESPONSE)
    ref = await photo(services, PNG, "image/png", "candidate.png")
    ex, out = await run_one(executor, real_node(a7_main, "16x Blind count"),
                            [{"json": {"rv": {"blind_text": "Count the pieces."}}, "binary": {"candidate": ref}}])
    assert ex.status == "success", ex.error

    start, upload, poll, generate = api.requests
    assert start.headers["x-goog-upload-protocol"] == "resumable" and start.headers["x-goog-upload-command"] == "start"
    assert start.headers["x-goog-upload-header-content-length"] == str(len(PNG))
    assert start.headers["x-goog-upload-header-content-type"] == "image/png"
    assert upload.content == PNG and upload.headers["x-goog-upload-command"] == "upload, finalize"
    assert "x-goog-api-key" not in upload.headers  # the upload URL carries its own authorization
    assert poll.method == "GET"
    assert json.loads(generate.content)["contents"][0]["parts"] == [
        {"fileData": {"fileUri": uploaded["uri"], "mimeType": "image/png"}}, {"text": "Count the pieces."}]
    assert out == [{"json": GEMINI_RESPONSE}]


# ---------- Anthropic ----------
async def test_blind_count_asks_for_low_thinking_with_the_image_inline(executor, api, services):
    """Speed change 1 (20 Oct 2026): 16x carries options.thinkingLevel = low (NODE_PATCHES); the image goes inline."""
    api.on(":generateContent", GEMINI_RESPONSE)
    node = real_node(a7_main, "16x Blind count")
    assert node["parameters"]["options"] == {"maxOutputTokens": 8000, "thinkingLevel": "low"}
    ref = await photo(services, JPEG, "image/jpeg", "candidate.jpg")
    ex, out = await run_one(executor, node, [{"json": {"rv": {"blind_text": "Count the pieces."}}, "binary": {"candidate": ref}}])
    assert ex.status == "success", ex.error
    assert len(api.requests) == 1  # no Files API upload and no polling
    assert api.body() == {
        "contents": [{"role": "user", "parts": [
            {"inlineData": {"mimeType": "image/jpeg", "data": b64(JPEG)}}, {"text": "Count the pieces."}]}],
        "generationConfig": {"maxOutputTokens": 8000, "thinkingConfig": {"thinkingLevel": "low"}},
    }
    assert out == [{"json": GEMINI_RESPONSE}]


async def test_a_model_that_refuses_the_thinking_level_is_asked_again_with_its_default(executor, api, services):
    def reply(request):
        if "thinkingConfig" in json.loads(request.content)["generationConfig"]:
            return httpx.Response(400, json={"error": {"code": 400, "status": "INVALID_ARGUMENT",
                                                       "message": "Thinking level is not supported for this model."}})
        return httpx.Response(200, json=GEMINI_RESPONSE)
    api.on(":generateContent", reply)
    ref = await photo(services, JPEG, "image/jpeg", "candidate.jpg")
    ex, out = await run_one(executor, real_node(a7_main, "16x Blind count"),
                            [{"json": {"rv": {"blind_text": "Count the pieces."}}, "binary": {"candidate": ref}}])
    assert ex.status == "success", ex.error
    assert [("thinkingConfig" in json.loads(r.content)["generationConfig"]) for r in api.requests] == [True, False]
    assert out == [{"json": GEMINI_RESPONSE}]


async def test_other_gemini_errors_are_not_retried_without_thinking(executor, api, services):
    api.on(":generateContent", lambda r: httpx.Response(400, json={"error": {"code": 400, "message": "Unable to process input image."}}))
    ref = await photo(services, JPEG, "image/jpeg", "candidate.jpg")
    node = real_node(a7_main, "16x Blind count", onError="stopWorkflow", retryOnFail=False)
    ex, _ = await run_one(executor, node, [{"json": {"rv": {"blind_text": "Count the pieces."}}, "binary": {"candidate": ref}}])
    assert ex.status == "error" and ex.error["description"] == "Unable to process input image."
    assert len(api.requests) == 1


async def test_anthropic_text_sends_messages_request_and_returns_raw_message(executor, api):
    api.on("/v1/messages", ANTHROPIC_TEXT_RESPONSE)
    node = real_node(a7_main, "11c Plan critic")
    ex, out = await run_one(executor, node, [{"json": {"critic_request": "Check the written plan of each photograph."}}])
    assert ex.status == "success", ex.error

    req = api.requests[0]
    assert str(req.url) == "https://api.anthropic.com/v1/messages"
    assert (req.headers["x-api-key"], req.headers["anthropic-version"], req.headers["anthropic-beta"]) == (
        "an-test", "2023-06-01", "files-api-2025-04-14")
    assert api.body() == {
        "model": "claude-sonnet-5-5",
        "messages": [{"content": "Check the written plan of each photograph.", "role": "user"}],
        "tools": [],
        "max_tokens": 8000,
        "system": node["parameters"]["options"]["system"],
    }
    assert out == [{"json": ANTHROPIC_TEXT_RESPONSE}]  # thinking block kept; no merged_response unless asked


async def test_anthropic_workspace_header_is_sent_only_when_configured(executor, api, monkeypatch):
    """An organisation-level key is refused with 400 unless the request names a workspace; a scoped key needs nothing."""
    api.on("/v1/messages", ANTHROPIC_TEXT_RESPONSE)
    await run_one(executor, real_node(a7_main, "11c Plan critic"), [{"json": {"critic_request": "Check"}}])
    assert "anthropic-workspace-id" not in api.requests[0].headers
    monkeypatch.setenv("ANTHROPIC_WORKSPACE_ID", " wrkspc_01ExampleWorkspaceId ")
    await run_one(executor, real_node(a7_main, "11c Plan critic"), [{"json": {"critic_request": "Check"}}])
    assert api.requests[1].headers["anthropic-workspace-id"] == "wrkspc_01ExampleWorkspaceId"
    assert api.requests[1].headers["x-api-key"] == "an-test"


async def test_anthropic_image_sends_every_named_binary_in_order(executor, api, services):
    api.on("/v1/messages", ANTHROPIC_IMAGE_RESPONSE)
    node = real_node(a7_main, "16 Critic review")  # binaryPropertyName: {{ $json.rv.binary_names || 'vendor,candidate' }}
    vendor = await photo(services, PNG, "image/png", "vendor.png")
    candidate = await photo(services, JPEG, "image/jpeg", "candidate.jpg")
    item = {"json": {"rv": {"critic_text": "Compare the candidate with the vendor photo."}},
            "binary": {"candidate": candidate, "vendor": vendor}}
    ex, out = await run_one(executor, node, [item])
    assert ex.status == "success", ex.error
    assert api.body() == {
        "model": "claude-sonnet-5-5",
        "max_tokens": 4000,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64(PNG)}},
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64(JPEG)}},
            {"type": "text", "text": "Compare the candidate with the vendor photo."},
        ]}],
    }
    assert out == [{"json": ANTHROPIC_IMAGE_RESPONSE}]


async def test_defaults_when_options_are_absent(executor, api, services):
    """n8n defaults: OpenAI max 300 tokens and detail auto, Anthropic max_tokens 1024, Gemini no generationConfig."""
    api.on("/v1/responses", OPENAI_IMAGE_RESPONSE)
    api.on("/v1/messages", ANTHROPIC_IMAGE_RESPONSE)
    api.on(":generateContent", GEMINI_RESPONSE)
    ref = await photo(services, PNG, "image/png", "data.png")
    item = {"json": {}, "binary": {"data": ref}}
    base = {"resource": "image", "operation": "analyze", "simplify": False, "text": "Describe."}
    nodes = [
        {"type": "@n8n/n8n-nodes-langchain.openAi", "typeVersion": 2.3,
         "parameters": {**base, "inputType": "base64", "modelId": {"__rl": True, "mode": "id", "value": "gpt-x"}}},
        {"type": "@n8n/n8n-nodes-langchain.anthropic", "typeVersion": 1,
         "parameters": {**base, "inputType": "binary", "modelId": {"__rl": True, "mode": "id", "value": "claude-x"}}},
        {"type": "@n8n/n8n-nodes-langchain.googleGemini", "typeVersion": 1.2,
         "parameters": {**base, "inputType": "binary", "modelId": {"__rl": True, "mode": "id", "value": "models/gemini-x"}}},
    ]
    for n in nodes:
        ex, _ = await run_one(executor, {"name": "LLM", **n}, [item])
        assert ex.status == "success", ex.error
    openai_body, anthropic_body, gemini_body = (json.loads(r.content) for r in api.requests)
    assert openai_body["max_output_tokens"] == 300 and openai_body["input"][0]["content"][1]["detail"] == "auto"
    assert anthropic_body["max_tokens"] == 1024
    assert gemini_body["generationConfig"] == {}


async def test_base_urls_can_be_redirected(executor, api, services, monkeypatch):
    monkeypatch.setenv("OPENAI_BASE_URL", "https://llm-gateway.test/openai/v1/")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://llm-gateway.test/anthropic")
    monkeypatch.setenv("GEMINI_BASE_URL", "https://llm-gateway.test/gemini")
    api.on("/openai/v1/responses", OPENAI_TEXT_RESPONSE)
    api.on("/anthropic/v1/messages", ANTHROPIC_TEXT_RESPONSE)
    api.on("/gemini/v1beta/", GEMINI_RESPONSE)
    ref = await photo(services, PNG, "image/png", "vendor.png")
    await run_one(executor, real_node(a7_main, "11 Stylist plans the scenes"), [{"json": {"plan_request": "Plan"}}])
    await run_one(executor, real_node(a7_main, "11c Plan critic"), [{"json": {"critic_request": "Check"}}])
    await run_one(executor, real_node(a7_main, "06 Room reader"), [{"json": {"room_key": "room"}, "binary": {"room": ref}}])
    assert [str(r.url) for r in api.requests] == [
        "https://llm-gateway.test/openai/v1/responses",
        "https://llm-gateway.test/anthropic/v1/messages",
        "https://llm-gateway.test/gemini/v1beta/models/gemini-3.8-flash:generateContent",
    ]


# ---------- errors ----------
async def test_continue_on_fail_gives_one_error_item_per_failed_item(executor, api, services, caplog):
    api.on("/v1/messages", lambda r: httpx.Response(529 if len(api.requests) == 1 else 200,
                                                    json={"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
                                                    if len(api.requests) == 1 else ANTHROPIC_IMAGE_RESPONSE))
    ref = await photo(services, PNG, "image/png", "vendor.png")
    items = [
        {"json": {"product_key": "product"}, "binary": {"product": ref}},  # API answers 529
        {"json": {"product_key": "product"}, "binary": {"other": ref}},  # no such binary field: no call
        {"json": {"product_key": "product"}, "binary": {"product": ref}},  # fine
    ]
    # Retry off: this checks the per-item error items; the retry rule is tested in test_engine_core.
    ex, out = await run_one(executor, real_node(a7_main, "05 Second count", retryOnFail=False), items)
    assert ex.status == "success", ex.error
    assert out == [
        {"json": {"error": "The service failed to process your request"}},
        {"json": {"error": "The item has no binary field 'product' [item 1]"}},
        {"json": ANTHROPIC_IMAGE_RESPONSE},
    ]
    assert len(api.requests) == 2
    # The log names the node, the item, the status and the provider's own words; the key is never in it.
    assert "05 Second count: item 0 failed: The service failed to process your request [529]: Overloaded" in caplog.text
    assert "05 Second count: item 1 failed: The item has no binary field 'product' [item 1]" in caplog.text
    assert "an-test" not in caplog.text


async def test_empty_prompt_is_an_error_item_without_a_call(executor, api, services):
    ref = await photo(services, PNG, "image/png", "candidate.png")
    _, out = await run_one(executor, real_node(a7_main, "16xb Blind count fallback (OpenAI)"),
                           [{"json": {"rv": {"blind_text": "  "}}, "binary": {"candidate": ref}}])
    assert out == [{"json": {"error": "A non-empty prompt is required."}}]
    assert api.requests == []


async def test_missing_api_key_is_an_error_item(executor, api, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    _, out = await run_one(executor, real_node(a7_main, "11c Plan critic"), [{"json": {"critic_request": "Check"}}])
    assert out == [{"json": {"error": "Credential 'anthropicApi' is not configured (set ANTHROPIC_API_KEY)"}}]


async def test_api_error_stops_the_node_without_continue_on_fail(executor, api):
    api.on("/v1/responses", lambda r: httpx.Response(429, json={"error": {
        "message": "You exceeded your current quota.", "type": "insufficient_quota", "code": "insufficient_quota"}}))
    node = real_node(a7_main, "11 Stylist plans the scenes", onError="stopWorkflow", retryOnFail=False)
    ex, _ = await run_one(executor, node, [{"json": {"plan_request": "Plan"}}])
    assert ex.status == "error"
    assert ex.error["message"].startswith("Insufficient quota detected.")
    assert ex.error["description"] == "You exceeded your current quota."


async def test_gemini_http_error_message_and_description(executor, api, services):
    api.on(":generateContent", lambda r: httpx.Response(400, json={"error": {
        "code": 400, "message": "Unable to process input image.", "status": "INVALID_ARGUMENT"}}))
    node = real_node(a7_main, "06 Room reader", onError="stopWorkflow", retryOnFail=False)
    ref = await photo(services, PNG, "image/png", "room.png")
    ex, _ = await run_one(executor, node, [{"json": {"room_key": "room"}, "binary": {"room": ref}}])
    assert ex.error["message"] == "Bad request - please check your parameters"
    assert ex.error["description"] == "Unable to process input image."


# ---------- the real Code nodes that read these outputs ----------
def receipt_flow(module, llm_name: str, budget: str):
    """Ticket and Reserve as the Receipt expects them, the real LLM node, then the real Receipt Code node."""
    ticket, reserve, allowed, receipt = (f"{budget} · {s}" for s in ("Ticket", "Reserve", "Allowed", "Receipt"))
    nodes = [
        START,
        code(ticket, "return [{json:{budgetRequest:{clientId:'owner-00000000-0000-4000-8000-000000000001',operationKey:'a7:test'}}}];", 200),
        code(reserve, "return [{json:{statusCode:200,body:{send:true,permit:'00000000-0000-4000-8000-0000000000aa',"
                      "reservedMicroUsd:120000}}}];", 400),
        code(allowed, "return $('Start').all();", 600),
        real_node(module, llm_name, position=[800, 0]),
        real_node(module, receipt, position=[1000, 0]),
    ]
    connections = link((START["name"], ticket), (ticket, reserve), (reserve, allowed), (allowed, llm_name), (llm_name, receipt))
    defn = {"id": "t", "name": "t", "nodes": nodes, "connections": connections, "settings": {"executionOrder": "v1"}}
    return flow_from_definition(defn, Path(module.__file__).with_name("code")), receipt


CASES = [  # module, LLM node, budget prefix, input item json, route, answer, usage, receiptRef, completeAnswer keys
    (a7_main, "11 Stylist plans the scenes", "Budget · 11", {"plan_request": "Plan"}, "/v1/responses", OPENAI_TEXT_RESPONSE,
     {"input": 3329, "output": 1392}, OPENAI_TEXT_RESPONSE["id"], ["id", "status", "output", "usage"]),
    (a7_main, "11c Plan critic", "Budget · 11c", {"critic_request": "Check"}, "/v1/messages", ANTHROPIC_TEXT_RESPONSE,
     {"input": 3631, "output": 2745}, ANTHROPIC_TEXT_RESPONSE["id"], ["id", "content", "usage", "stop_reason"]),
    (a7_main, "06b Room fallback (OpenAI)", "Budget · 06b", {"room_key": "photo"}, "/v1/responses", OPENAI_IMAGE_RESPONSE,
     {"input": 1210, "output": 230}, OPENAI_IMAGE_RESPONSE["id"], ["id", "status", "output", "usage"]),
    (a7_main, "05 Second count", "Budget · 05", {"product_key": "photo"}, "/v1/messages", ANTHROPIC_IMAGE_RESPONSE,
     {"input": 1650, "output": 120}, ANTHROPIC_IMAGE_RESPONSE["id"], ["id", "content", "usage", "stop_reason"]),
    (analysis_only, "03 Eye reads the product photo", "Budget · 03", {"product_key": "photo"}, ":generateContent", GEMINI_RESPONSE,
     {"input": 1834, "output": 412 + 764}, None, ["candidates", "usageMetadata"]),
]


@pytest.mark.parametrize("case", CASES, ids=[c[1] for c in CASES])
async def test_budget_receipt_reads_usage_from_the_output(executor, api, services, case):
    module, llm_name, budget, item_json, route, answer, usage, receipt_ref, answer_keys = case
    api.on(route, answer)
    flow, receipt = receipt_flow(module, llm_name, budget)
    ref = await photo(services, PNG, "image/png", "photo.png")
    ex = await run_flow(executor, flow, [{"json": item_json, "binary": {"photo": ref}}])
    assert ex.status == "success", ex.error
    out = ex.latest_output(receipt)[0]["json"]
    request = out["budgetRequest"]
    assert request["usage"] == usage and request["checkpointRequired"] is True
    if receipt_ref:
        assert request["receiptRef"] == receipt_ref  # run 1591 recorded the same usage and refs for 11 and 11c
    else:
        assert request["receiptRef"].startswith("answer:")  # Gemini answers carry no id; the receipt hashes the answer
    assert list(request["completeAnswer"]) == answer_keys
    assert out["original"] == ex.latest_output(llm_name)[0]["json"]


async def test_budget_receipt_records_no_usage_for_an_error_item(executor, api, services):
    api.on("/v1/messages", lambda r: httpx.Response(500, json={"type": "error", "error": {"type": "api_error", "message": "boom"}}))
    flow, receipt = receipt_flow(a7_main, "11c Plan critic", "Budget · 11c")
    ex = await run_flow(executor, flow, [{"json": {"critic_request": "Check"}}])
    request = ex.latest_output(receipt)[0]["json"]["budgetRequest"]
    assert request["usage"] is None and "completeAnswer" not in request
    assert ex.latest_output(receipt)[0]["json"]["original"] == {"error": "The service was not able to process your request"}


async def test_evidence_parser_reads_every_provider_answer(executor, api, services):
    """bodyOf / deepText / parse / usageOf from the real 04-06 Evidence node, run on each reader's output."""
    source = (Path(a7_main.__file__).with_name("code") / "04_06_Evidence.js").read_text(encoding="utf-8")
    helpers = source[:source.index("const s = out('02 Ingest files');")]
    reader = code("Reader", helpers + "return $input.all().map(i => ({json: {data: parse(deepText(bodyOf(i.json))), "
                                      "usage: usageOf(i.json), error: i.json.error || null}}));", 1200)
    api.on(":generateContent", GEMINI_RESPONSE)
    api.on("/v1/messages", ANTHROPIC_IMAGE_RESPONSE)
    api.on("/v1/responses", OPENAI_IMAGE_RESPONSE)
    ref = await photo(services, PNG, "image/png", "photo.png")
    item = {"json": {"product_key": "photo", "room_key": "photo"}, "binary": {"photo": ref}}
    expected = {
        "03 Eye reads the product photo": (EYE_READING, {"input": 1834, "output": 1176}),
        "05 Second count": (COUNT_READING, {"input": 1650, "output": 120}),
        "06b Room fallback (OpenAI)": (ROOM_READING, {"input": 1210, "output": 230}),
    }
    for name, (data, usage) in expected.items():
        node = real_node(a7_main, name, position=[1000, 0])
        flow = make_flow([START, node, reader], link(("Start", name), (name, "Reader")))
        ex = await run_flow(executor, flow, [item])
        assert ex.latest_output("Reader")[0]["json"] == {"data": data, "usage": usage, "error": None}, name


@pytest.fixture(autouse=True)
def _no_retry_wait(monkeypatch):
    """Model nodes retry once after 5 s as in n8n; tests skip the wait."""
    from midas_a7.engine import executor as ex_mod

    async def no_wait(seconds):
        return None

    monkeypatch.setattr(ex_mod, "retry_pause", no_wait)
