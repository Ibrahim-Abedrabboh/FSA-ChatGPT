"""Budget-guard logic ported from the n8n "Budget · NN · Ticket/Permit/Receipt/Restore" nodes.

Pure functions only; network calls live in ``budget.py``.
"""

from __future__ import annotations

import re
from typing import Any

from .canonical import canonical, canonical_sha256, js_stringify, sha256_hex

PERMIT = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
RECEIPT_REF = re.compile(r"^[a-zA-Z0-9_.:-]{1,180}$")
CLIENT_ID = re.compile(r"^owner-[a-f0-9-]{36}$")
ENVELOPE_KEYS = (
    "id", "status", "output", "content", "candidates", "response", "usage", "usageMetadata",
    "stop_reason", "steps", "output_image", "finishReason", "error",
)


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 2**53 - 1


def operation_slot(state: dict[str, Any], node_name: str, inp: dict[str, Any] | None = None) -> dict[str, Any]:
    """``operationSlot`` from the Ticket node. For source analysis every counter is 0 and output is 'job'."""
    inp = inp or {}
    stage04 = inp.get("s04") or state.get("stage04") or {}
    current = (state.get("scenes") or {}).get("current") or {}
    rv = inp.get("rv") or {}
    output = rv.get("output_id") or (stage04.get("dispatch") or {}).get("output_id") or (stage04.get("operation") or {}).get("output_id") or current.get("output_id") or "job"

    def first(*values: Any) -> Any:
        for v in values:
            if v is not None:
                return v
        return 0

    slot = {
        "client": state.get("client_run_id"),
        "run": state.get("run_id"),
        "node": node_name,
        "output": output,
        "attempt": first(rv.get("attempt"), (stage04.get("dispatch") or {}).get("attempt"), (stage04.get("operation") or {}).get("attempt"), current.get("attempt")),
        "phase": current.get("phase") or "",
        "go1": state.get("go1_rounds") or 0,
        "go2": state.get("go2_round") or 0,
        "plan": state.get("plan_round") or 0,
        "rewrite": state.get("rewrites_used") or 0,
        "review": state.get("review_again_count") or 0,
    }
    if not isinstance(slot["client"], str) or not CLIENT_ID.match(slot["client"]) or not isinstance(slot["run"], str) or not slot["run"]:
        raise ValueError("budget_identity_missing")
    return slot


def operation_key(slot: dict[str, Any]) -> str:
    """Slot identity intentionally excludes the request hash: the same draft and node always
    map to the same operation key, so a retry can never obtain a second permission to spend."""
    return "a7:" + canonical_sha256(slot)


def request_sha256(parameters: dict[str, Any], inp: dict[str, Any], state: dict[str, Any], binary_hashes: dict[str, str]) -> str:
    return sha256_hex(canonical({"parameters": parameters, "input": inp, "state": state, "binaryHashes": binary_hashes}))


def provider_usage(response: Any, kind: str) -> dict[str, int] | None:
    """``providerUsage`` from the Receipt node."""
    r = response.get("body") or response if isinstance(response, dict) else response
    if not isinstance(r, dict) or r.get("error"):
        return None
    if kind == "gemini":
        u = r.get("usageMetadata") or (r.get("response") or {}).get("usageMetadata")
        if not isinstance(u, dict) or not _is_int(u.get("promptTokenCount")) or not _is_int(u.get("candidatesTokenCount")):
            return None
        if "thoughtsTokenCount" in u and not _is_int(u.get("thoughtsTokenCount")):
            return None
        inp, out = u["promptTokenCount"], u["candidatesTokenCount"] + (u.get("thoughtsTokenCount") or 0)
    else:
        u = r.get("usage") or (r.get("response") or {}).get("usage")
        if kind == "openai" and isinstance(u, dict) and _is_int(u.get("prompt_tokens")) and _is_int(u.get("completion_tokens")):
            total = u["prompt_tokens"] + u["completion_tokens"]
            return {"input": u["prompt_tokens"], "output": u["completion_tokens"]} if total > 0 else None
        if not isinstance(u, dict) or not _is_int(u.get("input_tokens")) or not _is_int(u.get("output_tokens")):
            return None
        if "cache_creation_input_tokens" in u and u.get("cache_creation_input_tokens") not in (0, None):
            return None
        if "cache_read_input_tokens" in u and u.get("cache_read_input_tokens") is not None and not _is_int(u.get("cache_read_input_tokens")):
            return None
        inp, out = u["input_tokens"] + (u.get("cache_read_input_tokens") or 0), u["output_tokens"]
    if not _is_int(inp) or not _is_int(out) or inp + out == 0:
        return None
    return {"input": inp, "output": out}


def answer_envelope(raw: Any) -> dict[str, Any]:
    """``answerEnvelope``: only the provider's answer fields, never the request, headers or keys."""
    if not isinstance(raw, dict):
        return {}
    if raw.get("statusCode") and raw.get("statusCode") != 200:
        return {"error": "provider_http_error"}
    r = raw.get("body") or raw
    return {k: r[k] for k in ENVELOPE_KEYS if k in r and r[k] is not None}


def has_answer(envelope: dict[str, Any]) -> bool:
    if envelope.get("error"):
        return False
    return bool(
        envelope.get("output") or envelope.get("content") or envelope.get("candidates")
        or (envelope.get("response") or {}).get("candidates") or envelope.get("steps") or envelope.get("output_image")
    )


def receipt_ref(raw: Any) -> str:
    """Provider id when it is a safe token, else ``answer:<sha256 of the answer envelope>``
    (the analysis-only workflow's variant of the Receipt node)."""
    candidate: Any = ""
    if isinstance(raw, dict):
        def get(obj: Any, *path: str) -> Any:
            for key in path:
                obj = obj.get(key) if isinstance(obj, dict) else None
            return obj

        candidate = (
            get(raw, "s04", "receipt", "provider_request_id")
            or get(raw, "body", "id")
            or raw.get("id")
            or get(raw, "response", "id")
            or ""
        )
    if isinstance(candidate, str) and RECEIPT_REF.match(candidate):
        return candidate
    return "answer:" + sha256_hex(js_stringify(answer_envelope(raw)))


def permission_granted(status_code: int | None, body: Any) -> bool:
    return (
        status_code == 200
        and isinstance(body, dict)
        and body.get("send") is True
        and isinstance(body.get("permit"), str)
        and bool(PERMIT.match(body["permit"]))
        and _is_int(body.get("reservedMicroUsd"))
        and body["reservedMicroUsd"] > 0
    )


def settlement_preserved(status_code: int | None, body: Any) -> bool:
    """``settlementCompleted`` plus ``responsePreserved`` (Restore and the final pointer check)."""
    return (
        status_code == 200
        and isinstance(body, dict)
        and body.get("recorded") is True
        and body.get("status") == "completed"
        and body.get("responsePreserved") is True
    )
