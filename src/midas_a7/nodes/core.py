"""Control-flow nodes: Code, IF, Switch, Merge, No-op, Respond to Webhook, Wait and the triggers."""

from __future__ import annotations

import asyncio
import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from ..engine.executor import NodeContext, NodeError, Response, WaitRequest, strip_binary_data
from ..engine.jsrunner import JsError
from ..engine.model import Item
from .claude_reference_resize import LONG_SIDE_PX, resize_reference


# ---------- Code ----------
async def code(ctx: NodeContext):
    params = ctx.node.parameters
    if params.get("language", "javaScript") != "javaScript":
        raise NodeError("Only JavaScript Code nodes are supported")
    if params.get("mode", "runOnceForAllItems") != "runOnceForAllItems":
        raise NodeError("Only 'Run Once for All Items' Code nodes are supported")
    source = params["jsCode"]
    items = ctx.items
    binaries: dict[str, str] = {}
    if "getBinaryDataBuffer" in source or "binaryToBuffer" in source:
        for item in items:
            for ref in (item.get("binary") or {}).values():
                if isinstance(ref, dict) and ref.get("id") and ref["id"] not in binaries:
                    try:
                        binaries[ref["id"]] = base64.b64encode(await ctx.services.binaries.get(ref)).decode()
                    except KeyError:
                        pass  # the code gets n8n's "not available" error if it asks for it
    # Phase 1.6 (FL-10): a node that shrinks reference photos gets the engine helper for it (the runner has no image library).
    callbacks = {"resizeReference": lambda payload: _resize_reference(ctx, payload)} if "midasResizeReference" in source else None
    try:
        res = await ctx.services.js.call(
            "code", callbacks=callbacks, code=source, items=[strip_binary_data(i) for i in items], binaries=binaries,
            **ctx.js_context())
    except JsError as exc:
        raise NodeError(str(exc)) from exc
    out_items: list[Item] = res["items"]
    new = res.get("newBinaries") or {}
    if new:
        stored: dict[str, dict[str, Any]] = {}
        for temp_id, b64 in new.items():
            stored[temp_id] = {"bytes": base64.b64decode(b64)}
        await _store_new_binaries(ctx, out_items, stored)
    await _store_inline_binaries(ctx, out_items)
    return [out_items]


async def _resize_reference(ctx: NodeContext, payload: dict[str, Any]) -> dict[str, Any]:
    """this.helpers.midasResizeReference(ref, longSide): shrink a stored image to longSide px on its long side (no AI).

    Answers {resized: false, px, bytes, why} when the image is already small enough or cannot be read, else the new file's
    stored reference (`binary`) with from_px/to_px, from_bytes/to_bytes, its sha256 and its type.
    """
    ref = payload.get("ref")
    if not isinstance(ref, dict) or not ref.get("id"):
        raise NodeError("midasResizeReference needs a stored binary reference")
    long_side = int(payload.get("longSide") or LONG_SIDE_PX)
    data = await ctx.services.binaries.get(ref)
    res = await asyncio.to_thread(resize_reference, data, long_side)
    if not res["resized"]:
        return res
    stem = str(ref.get("fileName") or "reference").rsplit(".", 1)[0]
    stored = await ctx.services.binaries.put(ctx.execution.id, res.pop("data"), "image/jpeg", f"{stem}_{long_side}px.jpg")
    return {**res, "binary": stored}


async def _store_inline_binaries(ctx: NodeContext, items: list[Item]) -> None:
    """Code may build a binary entry by hand with the bytes inline ({data: <base64>, mimeType, fileName}),
    as n8n allows (the owner bridge does). Store those bytes and keep a normal reference."""
    for item in items:
        binary = item.get("binary")
        if not isinstance(binary, dict):
            continue
        for key, ref in list(binary.items()):
            if not isinstance(ref, dict):
                continue
            data = ref.get("data")
            if not isinstance(data, str) or data == "filesystem-v2" or str(ref.get("id", "")).startswith("bin:"):
                continue
            try:
                raw = base64.b64decode(data, validate=True)
            except ValueError as exc:
                raise NodeError(f"Binary data in field '{key}' is not valid base64") from exc
            stored = await ctx.services.binaries.put(
                ctx.execution.id, raw, ref.get("mimeType"), ref.get("fileName"), ref.get("fileExtension"))
            binary[key] = {**{k: v for k, v in ref.items() if k not in ("data", "id")}, **stored}


async def _store_new_binaries(ctx: NodeContext, items: list[Item], stored: dict[str, dict[str, Any]]) -> None:
    refs: dict[str, dict[str, Any]] = {}

    async def fix(value: Any) -> Any:
        if isinstance(value, dict):
            vid = value.get("id")
            if isinstance(vid, str) and vid in stored:
                if vid not in refs:
                    meta = value
                    refs[vid] = await ctx.services.binaries.put(
                        ctx.execution.id, stored[vid]["bytes"], meta.get("mimeType"), meta.get("fileName"), meta.get("fileExtension"))
                return {**{k: v for k, v in value.items() if k not in ("id", "bytes", "data")}, **refs[vid]}
            return {k: await fix(v) for k, v in value.items()}
        if isinstance(value, list):
            return [await fix(v) for v in value]
        return value

    for i, item in enumerate(items):
        items[i] = await fix(item)


# ---------- conditions (IF v2, Switch v3) ----------
class _TypeError(NodeError):
    pass


def _to_bool(value: Any, strict: bool) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if strict:
        raise _TypeError(f"Wrong type: '{value}' is a {_js_type(value)} but was expecting a boolean")
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str) and value.strip().lower() in ("true", "false", "1", "0"):
        return value.strip().lower() in ("true", "1")
    raise _TypeError(f"Wrong type: '{value}' is a {_js_type(value)} but was expecting a boolean")


def _to_str(value: Any, strict: bool) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if strict:
        raise _TypeError(f"Wrong type: '{value}' is a {_js_type(value)} but was expecting a string")
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"))
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _to_num(value: Any, strict: bool) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        if strict:
            raise _TypeError(f"Wrong type: '{value}' is a boolean but was expecting a number")
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if strict:
        raise _TypeError(f"Wrong type: '{value}' is a {_js_type(value)} but was expecting a number")
    try:
        return float(str(value).strip())
    except ValueError as exc:
        raise _TypeError(f"Wrong type: '{value}' cannot be converted to a number") from exc


def _js_type(v: Any) -> str:
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    return "object"


def evaluate_condition(cond: dict[str, Any], strict: bool, case_sensitive: bool) -> bool:
    op = cond.get("operator") or {}
    typ, operation = op.get("type"), op.get("operation")
    left, right = cond.get("leftValue"), cond.get("rightValue")
    if operation == "exists":
        return left is not None
    if operation == "notExists":
        return left is None
    if typ == "boolean":
        lv = _to_bool(left, strict)
        if operation == "true":
            return lv is True
        if operation == "false":
            return lv is False
        rv = _to_bool(right, strict)
        if operation == "equals":
            return lv == rv
        if operation == "notEquals":
            return lv != rv
    elif typ == "string":
        if operation == "empty":
            return left in (None, "")
        if operation == "notEmpty":
            return left not in (None, "")
        lv, rv = _to_str(left, strict), _to_str(right, strict)
        if lv is None:
            lv = ""
        if rv is None:
            rv = ""
        if not case_sensitive:
            lv, rv = lv.lower(), rv.lower()
        ops = {
            "equals": lambda: lv == rv, "notEquals": lambda: lv != rv,
            "contains": lambda: rv in lv, "notContains": lambda: rv not in lv,
            "startsWith": lambda: lv.startswith(rv), "notStartsWith": lambda: not lv.startswith(rv),
            "endsWith": lambda: lv.endswith(rv), "notEndsWith": lambda: not lv.endswith(rv),
        }
        if operation in ops:
            return ops[operation]()
    elif typ == "number":
        lv, rv = _to_num(left, strict), _to_num(right, strict)
        ops = {
            "equals": lambda: lv == rv, "notEquals": lambda: lv != rv,
            "gt": lambda: lv is not None and rv is not None and lv > rv,
            "lt": lambda: lv is not None and rv is not None and lv < rv,
            "gte": lambda: lv is not None and rv is not None and lv >= rv,
            "lte": lambda: lv is not None and rv is not None and lv <= rv,
        }
        if operation in ops:
            return ops[operation]()
    raise NodeError(f"Condition operator {typ}.{operation} is not supported")


def evaluate_filter(conditions: dict[str, Any], loose_override: bool = False) -> bool:
    options = conditions.get("options") or {}
    strict = (options.get("typeValidation", "strict") == "strict") and not loose_override
    case_sensitive = options.get("caseSensitive", True)
    results = [evaluate_condition(c, strict, case_sensitive) for c in conditions.get("conditions") or []]
    if (conditions.get("combinator") or "and") == "or":
        return any(results)
    return all(results)


async def if_(ctx: NodeContext):
    items = ctx.items
    params = await ctx.params()
    true_items: list[Item] = []
    false_items: list[Item] = []
    for item, p in zip(items, params):
        loose = bool(p.get("looseTypeValidation", False))
        try:
            ok = evaluate_filter(p.get("conditions") or {}, loose)
        except _TypeError as exc:
            raise NodeError(str(exc) + " [condition 0, item 0]") from exc
        (true_items if ok else false_items).append(item)
    return [true_items, false_items]


async def switch(ctx: NodeContext):
    items = ctx.items
    params = await ctx.params()
    first = params[0] if params else None
    if first is None or first.get("mode", "rules") != "rules":
        raise NodeError("Only Switch nodes in 'Rules' mode are supported")
    rules = (first.get("rules") or {}).get("values") or []
    options = first.get("options") or {}
    fallback = options.get("fallbackOutput", "none")
    all_matching = bool(options.get("allMatchingOutputs", False))
    n_out = len(rules) + (1 if fallback == "extra" else 0)
    outputs: list[list[Item]] = [[] for _ in range(max(1, n_out))]
    for item, p in zip(items, params):
        matched = False
        loose = bool(p.get("looseTypeValidation", False))
        for ri, rule in enumerate((p.get("rules") or {}).get("values") or []):
            if evaluate_filter(rule.get("conditions") or {}, loose):
                outputs[ri].append(item)
                matched = True
                if not all_matching:
                    break
        if not matched:
            if fallback == "extra":
                outputs[len(rules)].append(item)
            elif isinstance(fallback, int) or (isinstance(fallback, str) and fallback.isdigit()):
                outputs[int(fallback)].append(item)
    return outputs


# ---------- Merge, No-op ----------
async def merge(ctx: NodeContext):
    mode = ctx.node.parameters.get("mode", "append")
    if mode != "append":
        raise NodeError(f"Merge mode '{mode}' is not supported")
    out: list[Item] = []
    for items in ctx.inputs:
        out.extend(items or [])
    return [out]


async def no_op(ctx: NodeContext):
    return [ctx.items]


async def passthrough(ctx: NodeContext):
    return [ctx.items]


# ---------- Respond to Webhook ----------
async def respond_to_webhook(ctx: NodeContext):
    items = ctx.items
    params = (await ctx.params(items[:1] or [{"json": {}}]))[0]
    respond_with = params.get("respondWith", "firstIncomingItem")
    options = params.get("options") or {}
    status = int(options.get("responseCode") or 200)
    headers: dict[str, str] = {}
    for entry in ((options.get("responseHeaders") or {}).get("entries") or []):
        if entry.get("name"):
            headers[str(entry["name"])] = str(entry.get("value", ""))
    first = items[0] if items else {"json": {}}
    response = Response(status=status, headers=headers)
    if respond_with == "json":
        body = params.get("responseBody")
        if isinstance(body, str):
            try:
                body = json.loads(body) if body.strip() else {}
            except json.JSONDecodeError as exc:
                raise NodeError("Invalid JSON in 'Response Body' field") from exc
        response.body = body
    elif respond_with == "text":
        response.raw = str(params.get("responseBody") or "").encode()
        response.content_type = "text/html; charset=utf-8"
    elif respond_with == "firstIncomingItem":
        response.body = first.get("json", {})
    elif respond_with == "allIncomingItems":
        response.body = [i.get("json", {}) for i in items]
    elif respond_with == "noData":
        response.raw = b""
    elif respond_with == "binary":
        key = options.get("responseDataSource") == "set" and params.get("inputFieldName") or "data"
        ref = (first.get("binary") or {}).get(key)
        if not ref:
            raise NodeError(f"No binary data with field {key} found.")
        response.raw = await ctx.services.binaries.get(ref)
        response.content_type = ref.get("mimeType")
    else:
        raise NodeError(f"Respond with '{respond_with}' is not supported")
    ctx.respond(response)
    return [items]


# ---------- Wait ----------
_UNITS = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400}


async def wait(ctx: NodeContext):
    items = ctx.items
    p = (await ctx.params(items[:1] or [{"json": {}}]))[0]
    resume = p.get("resume", "timeInterval")
    now = datetime.now(timezone.utc)
    if resume == "webhook":
        till = None
        if p.get("limitWaitTime"):
            if p.get("limitType", "afterTimeInterval") == "afterTimeInterval":
                amount = float(p.get("resumeAmount", 1))
                till = now + timedelta(seconds=amount * _UNITS[p.get("resumeUnit", "hours")])
            else:
                till = datetime.fromisoformat(str(p.get("maxDateAndTime")).replace("Z", "+00:00"))
        return WaitRequest("webhook", till, items)
    if resume == "timeInterval":
        # Wait v1.1 defaults to seconds (v1 defaulted to hours).
        default_unit = "seconds" if ctx.node.type_version >= 1.1 else "hours"
        amount = float(p.get("amount", 5 if ctx.node.type_version >= 1.1 else 1))
        return WaitRequest("time", now + timedelta(seconds=amount * _UNITS[p.get("unit", default_unit)]), items)
    if resume == "specificTime":
        till = datetime.fromisoformat(str(p.get("dateTime")).replace("Z", "+00:00"))
        if till.tzinfo is None:
            till = till.replace(tzinfo=timezone.utc)
        return WaitRequest("time", till, items)
    raise NodeError(f"Wait mode '{resume}' is not supported")


HANDLERS = {
    "code": code,
    "if": if_,
    "switch": switch,
    "merge": merge,
    "noOp": no_op,
    "respondToWebhook": respond_to_webhook,
    "wait": wait,
    "webhook": passthrough,
    "manualTrigger": passthrough,
    "scheduleTrigger": passthrough,
}
