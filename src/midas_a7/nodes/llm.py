"""LLM vendor nodes: OpenAI (v2.x), Google Gemini (v1.x) and Anthropic (v1), as the A7 flows use them.

Each handler mirrors n8n's @n8n/nodes-langchain vendor node (packages/@n8n/nodes-langchain/nodes/vendors/
OpenAi/v2, GoogleGemini, Anthropic) for the parameters the flows set:
- items run one at a time; with "continue on fail" a failed item becomes {json: {error: message}}
  (actions/router.ts of each vendor), otherwise the node fails;
- with "Simplify Output" off (every A7 node) the item is the provider's raw response, so the readers
  and budget receipts downstream find `output`/`content`/`candidates` and the token counts.
Base URLs can be redirected with OPENAI_BASE_URL, GEMINI_BASE_URL and ANTHROPIC_BASE_URL. An Anthropic key issued at
the organisation level (not scoped to a workspace) is refused with 400 unless ANTHROPIC_WORKSPACE_ID names the workspace.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any, Awaitable, Callable

import httpx

from ..config import MissingCredential
from ..engine.binary import sniff_mime
from ..engine.executor import NodeContext, NodeError, Params, describe_error
from ..engine.model import Item

log = logging.getLogger(__name__)

OPENAI_BASE = "https://api.openai.com/v1"
GEMINI_BASE = "https://generativelanguage.googleapis.com"
ANTHROPIC_BASE = "https://api.anthropic.com"
ANTHROPIC_HEADERS = {"anthropic-version": "2023-06-01", "anthropic-beta": "files-api-2025-04-14"}
# n8n sets no timeout on these calls; a reasoning model can take minutes for a long answer.
TIMEOUT = httpx.Timeout(600.0, connect=30.0)
# Gemini: n8n uploads every image to the Files API first. Inline data gives the same answer with
# fewer calls, so images go inline while the request stays well under the API's 20 MB inline limit
# (base64 adds a third); larger images take n8n's route through the Files API.
GEMINI_INLINE_LIMIT = 12 * 1024 * 1024
GEMINI_FILE_POLL_SECONDS = 1.0
DEFAULT_IMAGE_PROMPT = "What's in this image?"
JSON_MODE_SYSTEM = {"role": "system", "content": [{"type": "input_text", "text": "You are a helpful assistant designed to output JSON."}]}

# n8n's NodeApiError messages by HTTP status (packages/workflow/src/errors/node-api.error.ts).
STATUS_MESSAGES = {
    "4XX": "Your request is invalid or could not be processed by the service",
    "400": "Bad request - please check your parameters",
    "401": "Authorization failed - please check your credentials",
    "402": "Payment required - perhaps check your payment details?",
    "403": "Forbidden - perhaps check your credentials?",
    "404": "The resource you are requesting could not be found",
    "405": "Method not allowed - please check you are using the right HTTP method",
    "429": "The service is receiving too many requests from you",
    "5XX": "The service failed to process your request",
    "500": "The service was not able to process your request",
    "502": "Bad gateway - the service failed to handle your request",
    "503": "Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)",
    "504": "Gateway timed out - perhaps try again later?",
}
# ... and for connection failures (packages/workflow/src/errors/abstract/node.error.ts).
NETWORK_MESSAGES = {
    "ECONNREFUSED": "The service refused the connection - perhaps it is offline",
    "ECONNRESET": "The connection to the server was closed unexpectedly, perhaps it is offline. "
                  "You can retry the request immediately or wait and retry later.",
    "ENOTFOUND": "The connection cannot be established, this usually occurs due to an incorrect host (domain) value",
    "ETIMEDOUT": "The connection timed out, consider setting the 'Retry on Fail' option in the node settings",
}
# OpenAI's router renames these when the node stops on the error (OpenAi/helpers/error-handling.ts).
OPENAI_ERROR_MESSAGES = {
    "insufficient_quota": 'Insufficient quota detected. <a href="https://docs.n8n.io/integrations/builtin/app-nodes/'
                          'n8n-nodes-langchain.openai/common-issues/#insufficient-quota" target="_blank">Learn more</a> '
                          "about resolving this issue",
    "rate_limit_exceeded": "OpenAI: Rate limit reached",
}

ItemOperation = Callable[[NodeContext, Params, Item, int], Awaitable[list[Item]]]


class ApiError(NodeError):
    """A provider answered with an HTTP error. `raise_message` replaces the message when the node stops."""

    def __init__(self, message: str, description: str | None, http_code: str, code: str | None = None):
        super().__init__(message, description, http_code)
        self.code = code
        self.raise_message: str | None = None


# ---------- shared ----------
def _base(env: str, default: str) -> str:
    return (os.environ.get(env) or default).rstrip("/")


async def _each_item(ctx: NodeContext, operation: ItemOperation) -> list[list[Item]]:
    """The vendor routers: one call per item; with continue-on-fail any failure becomes that item's {error}."""
    items = ctx.items
    if not items:
        return [[]]
    params = await ctx.params()
    out: list[Item] = []
    for i, (item, p) in enumerate(zip(items, params)):
        try:
            out.extend(await operation(ctx, p, item, i))
        except Exception as exc:  # n8n catches every error here, not only API errors
            if ctx.continue_on_fail:
                # The item only carries n8n's short message; the provider's own words go to the log.
                log.warning("%s: item %d failed: %s", ctx.node.name, i, describe_error(exc))
                out.append({"json": {"error": str(exc) or exc.__class__.__name__}})
                continue
            if isinstance(exc, ApiError) and exc.raise_message:
                raise NodeError(exc.raise_message, exc.description, exc.http_code) from exc
            if isinstance(exc, MissingCredential):
                raise NodeError(str(exc)) from exc
            raise
    return [out]


async def _request(ctx: NodeContext, method: str, url: str, headers: dict[str, str], *,
                   json_body: Any = None, content: bytes | None = None) -> httpx.Response:
    client, target = ctx.services.route(url)
    try:
        resp = await client.request(method, target, headers=headers, json=json_body, content=content, timeout=TIMEOUT)
    except httpx.TimeoutException as exc:
        raise NodeError(NETWORK_MESSAGES["ETIMEDOUT"]) from exc
    except httpx.ConnectError as exc:
        text = str(exc)
        unknown_host = any(s in text for s in ("Name or service not known", "nodename nor servname", "getaddrinfo"))
        raise NodeError(NETWORK_MESSAGES["ENOTFOUND" if unknown_host else "ECONNREFUSED"], text or None) from exc
    except (httpx.RemoteProtocolError, httpx.ReadError, httpx.WriteError) as exc:
        raise NodeError(NETWORK_MESSAGES["ECONNRESET"], str(exc) or None) from exc
    except httpx.HTTPError as exc:
        raise NodeError(str(exc) or exc.__class__.__name__) from exc
    if resp.status_code >= 400:
        raise _api_error(resp)
    return resp


def _api_error(resp: httpx.Response) -> ApiError:
    """Like NodeApiError: a message from the status code, the provider's own message as description."""
    status = str(resp.status_code)
    message = STATUS_MESSAGES.get(status) or STATUS_MESSAGES.get(status[0] + "XX") or f"Request failed with status code {status}"
    description: str | None = None
    code: str | None = None
    try:
        data = resp.json()
    except ValueError:
        data = None
    if isinstance(data, dict):
        err = data.get("error")
        if data.get("message"):
            description = str(data["message"])
        elif isinstance(err, dict) and err.get("message"):
            description = str(err["message"])
        if isinstance(err, dict) and isinstance(err.get("code"), str):
            code = err["code"]
    elif resp.text:
        description = resp.text[:500]
    return ApiError(message, description if description != message else None, status, code)


def _json(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except ValueError as exc:
        raise NodeError("The service returned a response that is not JSON", resp.text[:200] or None) from exc


def _split(value: Any, drop_empty: bool = True) -> list[str]:
    if not isinstance(value, str):
        raise NodeError("Provided parameter is not a string or binary data object.")
    parts = [s.strip() for s in value.split(",")]
    return [s for s in parts if s] if drop_empty else parts


def _prompt(p: Params) -> str:
    text = p.get("text", DEFAULT_IMAGE_PROMPT)
    if not isinstance(text, str) or not text.strip():
        raise NodeError("A non-empty prompt is required.")
    return text


async def _binary(ctx: NodeContext, item: Item, i: int, name: str) -> tuple[bytes, str]:
    """Bytes and MIME type of one binary field, failing with n8n's assertBinaryData messages."""
    files = item.get("binary")
    if files is None:
        raise NodeError(f"This operation expects the node's input data to contain a binary file '{name}', "
                        f"but none was found [item {i}]", "Make sure that the previous node outputs a binary file")
    ref = files.get(name)
    if ref is None:
        raise NodeError(f"The item has no binary field '{name}' [item {i}]",
                        "Check that the parameter where you specified the input binary field name is correct, "
                        "and that it matches a field in the binary input")
    try:
        data = await ctx.services.binaries.get(ref)
    except KeyError as exc:
        raise NodeError(f"The file in binary field '{name}' is no longer available [item {i}]") from exc
    return data, ref.get("mimeType") or sniff_mime(data) or "application/octet-stream"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _parse_json_param(value: Any, message: str) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except ValueError as exc:
        raise NodeError(message) from exc


def _first(value: Any) -> dict[str, Any]:
    """A single-value fixedCollection entry (stored as an object, or as a one-element list in defaults)."""
    if isinstance(value, list):
        value = value[0] if value else {}
    return value if isinstance(value, dict) else {}


def _drop_empty(d: dict[str, Any]) -> dict[str, Any]:
    """removeEmptyProperties from OpenAi/v2/actions/text/helpers/responses.ts (and JSON dropping undefined)."""
    return {k: v for k, v in d.items() if v is not None and v != "" and not (isinstance(v, (dict, list)) and not v)}


def _reject(options: dict[str, Any], names: tuple[str, ...], node: str) -> None:
    for name in names:
        if options.get(name):
            raise NodeError(f"Option '{name}' of the {node} node is not supported by this engine")


# ---------- OpenAI (v2: Responses API) ----------
async def _openai_post(ctx: NodeContext, path: str, body: dict[str, Any]) -> Any:
    key = ctx.services.credentials.api_key("openAiApi")
    try:
        resp = await _request(ctx, "POST", _base("OPENAI_BASE_URL", OPENAI_BASE) + path, {"Authorization": f"Bearer {key}"},
                              json_body=body)
    except ApiError as exc:
        exc.raise_message = OPENAI_ERROR_MESSAGES.get(exc.code or "")
        raise
    data = _json(resp)
    # OpenAi/transport/index.ts turns `error: null` into undefined, so the key is gone from the item.
    if isinstance(data, dict) and "error" in data and data["error"] is None:
        del data["error"]
    return data


def _openai_input(message: dict[str, Any]) -> dict[str, Any]:
    """formatInputMessages for text messages (image and file messages are not used by the flows)."""
    if message["type"] != "text":
        raise NodeError(f"Messages of type '{message['type']}' are not supported by this engine")
    role, text = message["role"], message.get("content", "")
    part = {"type": "output_text", "text": text, "annotations": []} if role == "assistant" else {"type": "input_text", "text": text}
    return {"role": role, "content": [part]}


def _openai_text_config(options: dict[str, Any], body: dict[str, Any]) -> None:
    """Output Format option. n8n fills the fixedCollection defaults (verbosity 'medium', type '')."""
    text_options = _first((options.get("textFormat") or {}).get("textOptions"))
    kind = text_options.get("type", "")
    config: dict[str, Any] = {"verbosity": text_options.get("verbosity", "medium")}
    if kind == "json_schema":
        config["format"] = _drop_empty({"type": kind, "name": text_options.get("name", "my_schema"),
                                        "schema": _parse_json_param(text_options.get("schema"), "Failed to parse schema")})
    elif kind == "json_object":
        config["format"] = {"type": kind}
        body["input"] = [JSON_MODE_SYSTEM, *body["input"]]
    elif kind == "text":
        config["format"] = {"type": kind}
    body["text"] = config


def _decode_json_output(response: dict[str, Any]) -> None:
    """In JSON modes n8n replaces each output_text text by its parsed value, in place, stopping at the first failure."""
    def strict(c: str) -> Any:
        raise ValueError(c)  # JSON.parse has no NaN/Infinity

    try:
        for entry in response.get("output") or []:
            if entry.get("type") == "message":
                for part in entry["content"]:
                    if part.get("type") == "output_text":
                        part["text"] = json.loads(part["text"], parse_constant=strict)
    except (ValueError, TypeError, KeyError, AttributeError):
        pass


async def _openai_response(ctx: NodeContext, p: Params, item: Item, i: int) -> list[Item]:
    """Text > Message a Model (actions/text/response.operation.ts + helpers/responses.ts)."""
    model = p.rl("modelId", "")
    messages = [{"type": "text", "role": "user", "content": "", **m} for m in (p.get("responses.values") or [])]
    if not any(m["type"] in ("text", None, "") and isinstance(m["content"], str) and m["content"].strip() for m in messages):
        raise NodeError("A non-empty prompt is required.")
    options = p.get("options") or {}
    tools = p.get("builtInTools") or {}
    if tools.get("webSearch") is not None or tools.get("fileSearch") is not None or tools.get("codeInterpreter"):
        raise NodeError("Built-in tools of the OpenAI node are not supported by this engine")
    _reject(options, ("promptConfig",), "OpenAI")
    if _first(((options.get("backgroundMode") or {}).get("values"))).get("enabled"):
        raise NodeError("Background mode of the OpenAI node is not supported by this engine")

    body: dict[str, Any] = {
        "model": model,
        "input": [_openai_input(m) for m in messages],
        "parallel_tool_calls": options.get("parallelToolCalls", True),
        "store": options.get("store", True),
        "instructions": options.get("instructions"),
        "max_output_tokens": options.get("maxTokens"),
        "previous_response_id": options.get("previousResponseId"),
        "prompt_cache_key": options.get("promptCacheKey"),
        "safety_identifier": options.get("safetyIdentifier"),
        "service_tier": options.get("serviceTier"),
        "temperature": options.get("temperature"),
        "top_p": options.get("topP"),
        "top_logprobs": options.get("topLogprobs"),
        "max_tool_calls": options.get("maxToolCalls"),
        "background": False,
    }
    if "truncation" in options:
        body["truncation"] = "auto" if options["truncation"] else "disabled"
    if options.get("conversationId"):
        body["conversation"] = options["conversationId"]
    if isinstance(options.get("include"), list) and options["include"]:
        body["include"] = options["include"]
    if options.get("metadata"):
        body["metadata"] = _parse_json_param(options["metadata"], "Failed to parse metadata")
    if options.get("reasoning"):
        reasoning = _first((options["reasoning"] or {}).get("reasoningOptions"))
        summary = reasoning.get("summary", "auto")
        body["reasoning"] = _drop_empty({"effort": reasoning.get("effort", "medium"), "summary": summary if summary != "none" else None})
    if options.get("textFormat"):
        _openai_text_config(options, body)
    body = _drop_empty(body)

    response = await _openai_post(ctx, "/responses", body)
    if not response:
        return []
    if isinstance(response, dict) and body.get("text", {}).get("format", {}).get("type") in ("json_object", "json_schema"):
        _decode_json_output(response)
    if p.get("simplify", True):
        return [{"json": {"output": [o for o in response.get("output") or [] if o.get("type") == "message"]}}]
    return [{"json": response}]


async def _openai_analyze(ctx: NodeContext, p: Params, item: Item, i: int) -> list[Item]:
    """Image > Analyze Image (actions/image/analyze.operation.ts): the Responses API, prompt first, then images."""
    model = p.rl("modelId", "gpt-4o")
    text = _prompt(p)
    options = p.get("options") or {}
    detail = options.get("detail") or "auto"
    content: list[dict[str, Any]] = [{"type": "input_text", "text": text}]
    if p.get("inputType", "url") == "url":
        for url in _split(p.get("imageUrls", ""), drop_empty=False):
            content.append({"type": "input_image", "detail": detail, "image_url": url})
    else:
        for name in _split(p.get("binaryPropertyName", "data"), drop_empty=False):
            data, mime = await _binary(ctx, item, i, name)
            content.append({"type": "input_image", "detail": detail, "image_url": f"data:{mime};base64,{_b64(data)}"})
    body = {"model": model, "input": [{"role": "user", "content": content}], "max_output_tokens": options.get("maxTokens") or 300}
    response = await _openai_post(ctx, "/responses", body)
    return [{"json": response.get("output") if p.get("simplify", True) else response}]


async def open_ai(ctx: NodeContext):
    if ctx.node.type_version < 2:
        raise NodeError("OpenAI node versions before 2 are not supported by this engine")
    resource = ctx.node.parameters.get("resource", "text")
    operation = ctx.node.parameters.get("operation", {"text": "response", "image": "generate"}.get(resource))
    ops: dict[tuple[str, Any], ItemOperation] = {("text", "response"): _openai_response, ("image", "analyze"): _openai_analyze}
    if (resource, operation) not in ops:
        raise NodeError(f"OpenAI {resource} / {operation} is not supported by this engine")
    return await _each_item(ctx, ops[(resource, operation)])


# ---------- Google Gemini ----------
async def _gemini_upload(ctx: NodeContext, base: str, key: str, data: bytes, mime: str) -> dict[str, str]:
    """helpers/utils.ts uploadFile: resumable upload to the Files API, then wait until the file is ACTIVE."""
    start = await _request(ctx, "POST", f"{base}/upload/v1beta/files", {
        "x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(len(data)), "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json"})
    upload_url = start.headers.get("x-goog-upload-url")
    if not upload_url:
        raise NodeError("Failed to get upload URL", "Error uploading file")
    done = await _request(ctx, "POST", upload_url, {"X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"},
                          content=data)
    file = (_json(done) or {}).get("file") or {}
    while file.get("state") not in ("ACTIVE", "FAILED"):
        await asyncio.sleep(GEMINI_FILE_POLL_SECONDS)
        file = _json(await _request(ctx, "GET", f"{base}/v1beta/{file.get('name')}", {"x-goog-api-key": key})) or {}
    if file["state"] == "FAILED":
        raise NodeError((file.get("error") or {}).get("message") or "Unknown error", "Error uploading file")
    return {"fileUri": file.get("uri", ""), "mimeType": file.get("mimeType", mime)}


async def _gemini_analyze(ctx: NodeContext, p: Params, item: Item, i: int) -> list[Item]:
    """Image > Analyze Image (helpers/baseAnalyze.ts): images first, then the prompt, in one user turn."""
    model = p.rl("modelId", "")
    text = _prompt(p)
    options = p.get("options") or {}
    max_tokens = options.get("maxOutputTokens")
    if max_tokens is not None and (isinstance(max_tokens, bool) or not isinstance(max_tokens, (int, float))):
        raise NodeError("Parameter 'maxOutputTokens' must be a number")
    # Not an n8n option: set by a flow patch (tools/n8n_to_flow.py, NODE_PATCHES) to ask for less thinking.
    thinking = str(options.get("thinkingLevel") or "").strip()
    if p.get("inputType", "url") == "url":
        raise NodeError("Gemini image analysis from URLs is not supported by this engine; use binary input")
    files = [await _binary(ctx, item, i, name) for name in _split(p.get("binaryPropertyName", "data"))]
    key = ctx.services.credentials.api_key("googlePalmApi")
    base = _base("GEMINI_BASE_URL", GEMINI_BASE)
    if sum(len(data) for data, _ in files) <= GEMINI_INLINE_LIMIT:
        parts: list[dict[str, Any]] = [{"inlineData": {"mimeType": mime, "data": _b64(data)}} for data, mime in files]
    else:
        parts = [{"fileData": await _gemini_upload(ctx, base, key, data, mime)} for data, mime in files]
    parts.append({"text": text})
    config: dict[str, Any] = {} if max_tokens is None else {"maxOutputTokens": max_tokens}
    if thinking:
        config["thinkingConfig"] = {"thinkingLevel": thinking}
    body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": config}
    # n8n sends the key as ?key=; the header is equivalent and keeps the key out of logged URLs.
    url, headers = f"{base}/v1beta/{model}:generateContent", {"x-goog-api-key": key}
    try:
        resp = await _request(ctx, "POST", url, headers, json_body=body)
    except ApiError as exc:
        # A model that does not take this thinking level is asked once more with its default, rather than failing
        # over to the paid fallback node.
        if not thinking or exc.http_code != "400" or "thinking" not in (exc.description or "").lower():
            raise
        log.warning("%s: %s refused thinkingLevel=%s (%s); asked again with the model's default", ctx.node.name, model,
                    thinking, exc.description)
        config.pop("thinkingConfig")
        resp = await _request(ctx, "POST", url, headers, json_body=body)
    response = _json(resp)
    if p.get("simplify", True):
        return [{"json": c} for c in response.get("candidates") or []]
    return [{"json": response}]


async def google_gemini(ctx: NodeContext):
    resource = ctx.node.parameters.get("resource", "text")
    operation = ctx.node.parameters.get("operation", "generate" if resource == "image" else None)
    if (resource, operation) != ("image", "analyze"):
        raise NodeError(f"Google Gemini {resource} / {operation} is not supported by this engine")
    return await _each_item(ctx, _gemini_analyze)


# ---------- Anthropic ----------
def _anthropic_headers(key: str) -> dict[str, str]:
    """The key and the fixed headers, plus the workspace an organisation-level key must name (ANTHROPIC_WORKSPACE_ID)."""
    headers = {"x-api-key": key, **ANTHROPIC_HEADERS}
    workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID", "").strip()
    if workspace:
        headers["anthropic-workspace-id"] = workspace
    return headers


async def _anthropic_post(ctx: NodeContext, key: str, body: dict[str, Any]) -> Any:
    url = _base("ANTHROPIC_BASE_URL", ANTHROPIC_BASE) + "/v1/messages"
    return _json(await _request(ctx, "POST", url, _anthropic_headers(key), json_body=body))


async def _anthropic_analyze(ctx: NodeContext, p: Params, item: Item, i: int) -> list[Item]:
    """Image > Analyze Image (helpers/baseAnalyze.ts): base64 images first, then the prompt."""
    model = p.rl("modelId", "")
    input_type = p.get("inputType", "url")
    text = _prompt(p)
    options = p.get("options") or {}
    key = ctx.services.credentials.api_key("anthropicApi")
    content: list[dict[str, Any]] = []
    if input_type == "url":
        prefix = _base("ANTHROPIC_BASE_URL", ANTHROPIC_BASE) + "/v1/files/"
        for url in _split(p.get("imageUrls", "")):
            source = {"type": "file", "file_id": url[len(prefix):]} if url.startswith(prefix) else {"type": "url", "url": url}
            content.append({"type": "image", "source": source})
    else:
        for name in _split(p.get("binaryPropertyName", "data")):
            data, mime = await _binary(ctx, item, i, name)
            content.append({"type": "image", "source": {"type": "base64", "media_type": mime, "data": _b64(data)}})
    content.append({"type": "text", "text": text})
    max_tokens = options.get("maxTokens")
    body = {"model": model, "max_tokens": 1024 if max_tokens is None else max_tokens, "messages": [{"role": "user", "content": content}]}
    response = await _anthropic_post(ctx, key, body)
    return [{"json": {"content": response.get("content")} if p.get("simplify", True) else response}]


async def _anthropic_message(ctx: NodeContext, p: Params, item: Item, i: int) -> list[Item]:
    """Text > Message a Model (actions/text/message.operation.ts), without tools or attachments."""
    model = p.rl("modelId", "")
    messages = [{"content": "", "role": "user", **m} for m in (p.get("messages.values") or [])]
    messages = [m for m in messages if not isinstance(m["content"], str) or m["content"].strip()]
    if p.get("addAttachments", False):
        raise NodeError("Attachments of the Anthropic node are not supported by this engine")
    if not messages:
        raise NodeError("A non-empty prompt is required.")
    options = p.get("options") or {}
    _reject(options, ("codeExecution", "webSearch"), "Anthropic")
    key = ctx.services.credentials.api_key("anthropicApi")
    max_tokens = options.get("maxTokens")
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "tools": [],  # the node has a Tools input; with nothing connected n8n sends an empty list
        "max_tokens": 1024 if max_tokens is None else max_tokens,
        "system": options.get("system"),
        "temperature": options.get("temperature"),
        "top_p": options.get("topP"),
        "top_k": options.get("topK"),
    }
    caching = options.get("promptCaching")
    if caching and caching != "disabled":
        body["cache_control"] = {"type": "ephemeral", "ttl": caching}
    body = {k: v for k, v in body.items() if v is not None}
    # No tools are sent, so the answer never stops for tool_use or pause_turn: one call is the whole exchange.
    response = await _anthropic_post(ctx, key, body)
    extra: dict[str, Any] = {}
    if options.get("includeMergedResponse"):
        extra["merged_response"] = "".join(str(c.get("text", "")) for c in response.get("content") or [] if c.get("type") == "text")
    if p.get("simplify", True):
        return [{"json": {"content": response.get("content"), **extra}}]
    return [{"json": {**response, **extra}}]


async def anthropic(ctx: NodeContext):
    resource = ctx.node.parameters.get("resource", "text")
    operation = ctx.node.parameters.get("operation", {"text": "message", "image": "analyze"}.get(resource))
    ops: dict[tuple[str, Any], ItemOperation] = {("text", "message"): _anthropic_message, ("image", "analyze"): _anthropic_analyze}
    if (resource, operation) not in ops:
        raise NodeError(f"Anthropic {resource} / {operation} is not supported by this engine")
    return await _each_item(ctx, ops[(resource, operation)])


HANDLERS = {
    "openAi": open_ai,
    "googleGemini": google_gemini,
    "anthropic": anthropic,
}
