"""In-memory stand-in for the site's budget API, ported from lib/a7-budget.mjs
(quoteCall, reserveCall, settleCall) and lib/a7-answer-checkpoints.mjs (normalizeAnswer).

It covers the analysis readers only (no blind/replacement/image paths). The real
JavaScript is exercised by tests/test_site_crosscheck.py when Node is available.
"""

from __future__ import annotations

import asyncio
import json
import math
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.budget import BudgetReply
from app.canonical import canonical_sha256

PRICING_VERSION = "a7-standard-2026-10-17"
RATES = {
    "gemini-3.8-flash": {"input": 0.75, "output": 3.75, "inputLimit": 1048576, "outputLimit": 65536},
    "claude-sonnet-5-5": {"input": 2, "output": 10, "inputLimit": 1048576, "outputLimit": 128000},
    "gpt-6-luna": {"input": 0.2, "output": 0.75, "inputLimit": 1050000, "outputLimit": 128000},
}
CALL_POLICY = {
    "03 Eye reads the product photo": ("gemini-3.8-flash", 16000),
    "05 Second count": ("claude-sonnet-5-5", 1500),
    "06 Room reader": ("gemini-3.8-flash", 8000),
    "09 Conflict check": ("gpt-6-luna", 2000),
}
ANSWER_NODES = {
    "03 Eye reads the product photo": "gemini", "05 Second count": "anthropic",
    "06 Room reader": "gemini", "09 Conflict check": "openai",
}
ID = re.compile(r"^[a-zA-Z0-9_.:-]{1,180}$")
CLIENT = re.compile(r"^owner-[a-f0-9-]{36}$")
SHA = re.compile(r"^[a-f0-9]{64}$")


class Refused(Exception):
    pass


def _int(v: Any, lo: int, hi: int) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def _nonempty(v: Any) -> bool:
    return bool(v.strip()) if isinstance(v, str) else isinstance(v, dict) and bool(v)


def normalize_answer(raw: Any, op: dict[str, Any], usage: Any, receipt_ref: str) -> dict[str, Any]:
    kind = ANSWER_NODES.get(op["node_name"])
    if not kind or not isinstance(raw, dict):
        raise Refused("invalid_answer_checkpoint")
    r = raw.get("body") or raw
    if r.get("error") or raw.get("error") or (raw.get("statusCode") and raw.get("statusCode") != 200):
        raise Refused("invalid_answer_checkpoint")
    if r.get("id") and receipt_ref and r["id"] != receipt_ref:
        raise Refused("invalid_answer_checkpoint")
    source = (r.get("response") or r) if kind == "gemini" else r
    u = source.get("usageMetadata") or source.get("usage") or {}
    if kind == "gemini":
        inp = u.get("promptTokenCount")
        out = (u.get("candidatesTokenCount") or 0) + (u.get("thoughtsTokenCount") or 0) if isinstance(u.get("candidatesTokenCount"), int) else None
    else:
        inp = u.get("input_tokens", u.get("prompt_tokens"))
        inp = inp + (u.get("cache_read_input_tokens") or 0) if isinstance(inp, int) else None
        out = u.get("output_tokens", u.get("completion_tokens"))
        if u.get("cache_creation_input_tokens"):
            raise Refused("invalid_answer_checkpoint")
    if usage is not None and (not _int(inp, 0, 2**53) or not _int(out, 0, 2**53) or inp + out == 0 or inp != usage.get("input") or out != usage.get("output")):
        raise Refused("invalid_answer_checkpoint")
    if kind == "openai":
        if r.get("status") and r["status"] != "completed":
            raise Refused("invalid_answer_checkpoint")
        output = [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": c["text"]} for c in (m.get("content") or []) if c.get("type") in ("output_text", "text") and _nonempty(c.get("text"))]}
                  for m in (r.get("output") or []) if m.get("type") == "message"]
        if not any(m["content"] for m in output):
            raise Refused("invalid_answer_checkpoint")
        answer = {"output": output}
    elif kind == "anthropic":
        if r.get("stop_reason") and r["stop_reason"] not in ("end_turn", "stop_sequence"):
            raise Refused("invalid_answer_checkpoint")
        content = [{"type": "text", "text": b["text"]} for b in (r.get("content") or []) if b.get("type") == "text" and _nonempty(b.get("text"))]
        if not content:
            raise Refused("invalid_answer_checkpoint")
        answer = {"content": content}
    else:
        g = r.get("response") or r
        candidates = []
        for c in g.get("candidates") or []:
            if c.get("finishReason") and c["finishReason"] != "STOP":
                raise Refused("invalid_answer_checkpoint")
            parts = [{"text": p["text"]} for p in (c.get("content") or {}).get("parts") or [] if p.get("thought") is not True and _nonempty(p.get("text"))]
            entry: dict[str, Any] = {"content": {"role": "model", "parts": parts}}
            if c.get("finishReason"):
                entry["finishReason"] = c["finishReason"]
            candidates.append(entry)
        if not candidates or not any(c["content"]["parts"] for c in candidates):
            raise Refused("invalid_answer_checkpoint")
        answer = {"candidates": candidates}
    checkpoint = {"schema": "a7-complete-answer-v1", "node": op["node_name"], "model": op["model"], "kind": kind,
                  "receipt_ref": receipt_ref or "", "usage": None if usage is None else {"input": usage["input"], "output": usage["output"]}, "answer": answer}
    return {"checkpoint": checkpoint, "sha256": canonical_sha256(checkpoint)}


@dataclass
class FakeBudgetApi:
    """Ledger rows keyed by operation key, one budget per client run."""

    limit_micro_usd: int = 5_000_000
    owner_id: str = "owner-account"
    budgets: dict[str, dict[str, Any]] = field(default_factory=dict)
    operations: dict[str, dict[str, Any]] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, Any]]] = field(default_factory=list)
    fail: dict[str, Any] = field(default_factory=dict)  # action -> "transport" | (status, body) | ("sleep", s)
    events: list[str] | None = None

    def open(self, client_id: str, limit_micro_usd: int | None = None) -> None:
        self.budgets.setdefault(client_id, {"client_run_id": client_id, "owner_id": self.owner_id, "run_id": None,
                                            "limit_micro_usd": limit_micro_usd or self.limit_micro_usd, "committed_micro_usd": 0})

    async def reserve(self, origin: str, request: dict[str, Any]) -> BudgetReply:
        return await self._handle("reserve", origin, request)

    async def settle(self, origin: str, request: dict[str, Any]) -> BudgetReply:
        return await self._handle("settle", origin, request)

    async def _handle(self, action: str, origin: str, request: dict[str, Any]) -> BudgetReply:
        request = json.loads(json.dumps(request))  # as it travels over HTTP
        self.calls.append((action, origin, request))
        if self.events is not None:
            self.events.append(f"{action}:{request.get('node') or request.get('operationKey')}")
        rule = self.fail.get(action)
        if isinstance(rule, list):
            rule = rule.pop(0) if rule else None
        if rule == "transport":
            return BudgetReply(None, None)
        if isinstance(rule, tuple) and rule[0] == "sleep":
            await asyncio.sleep(rule[1])
        elif isinstance(rule, tuple):
            return BudgetReply(rule[0], rule[1])
        try:
            body = self._reserve(request) if action == "reserve" else self._settle(request)
            return BudgetReply(200, body)
        except Refused as error:
            return BudgetReply(409, {"error": str(error)})

    def _reserve(self, i: dict[str, Any]) -> dict[str, Any]:
        if not (isinstance(i.get("clientId"), str) and CLIENT.match(i["clientId"]) and isinstance(i.get("runId"), str) and ID.match(i["runId"])
                and isinstance(i.get("operationKey"), str) and ID.match(i["operationKey"]) and isinstance(i.get("node"), str) and len(i["node"]) <= 100
                and isinstance(i.get("outputId"), str) and ID.match(i["outputId"]) and isinstance(i.get("requestSha256"), str) and SHA.match(i["requestSha256"])):
            raise Refused("invalid_operation")
        rate = RATES.get(i.get("model"))
        if not rate:
            raise Refused("price_verification_required")
        if not _int(i.get("inputTokens"), 0, rate["inputLimit"]) or not _int(i.get("outputTokens"), 1, rate["outputLimit"]):
            raise Refused("invalid_token_bounds")
        policy = CALL_POLICY.get(i["node"])
        if not policy or policy[0] != i["model"] or policy[1] != i["outputTokens"] or i["inputTokens"] != rate["inputLimit"]:
            raise Refused("call_policy_mismatch")
        reserve = math.ceil(i["inputTokens"] * rate["input"] + i["outputTokens"] * rate["output"])
        fingerprint = canonical_sha256([i["clientId"], i["runId"], i["node"], i["model"], i["outputId"], i["requestSha256"], i["inputTokens"], i["outputTokens"], PRICING_VERSION])
        budget = self.budgets.get(i["clientId"])
        if not budget:
            raise Refused("budget_missing")
        if budget["run_id"] and budget["run_id"] != i["runId"]:
            raise Refused("budget_run_mismatch")
        old = self.operations.get(i["operationKey"])
        if old:
            if old["client_run_id"] != i["clientId"] or old["request_sha256"] != fingerprint:
                raise Refused("operation_conflict")
            return {"send": False, "reason": "operation_already_exists", "status": old["status"]}
        if budget["committed_micro_usd"] + reserve > budget["limit_micro_usd"]:
            return {"send": False, "reason": "budget_limit", "availableMicroUsd": max(0, budget["limit_micro_usd"] - budget["committed_micro_usd"])}
        budget["run_id"] = i["runId"]
        budget["committed_micro_usd"] += reserve
        permit = str(uuid.uuid4())
        self.operations[i["operationKey"]] = {
            "operation_key": i["operationKey"], "client_run_id": i["clientId"], "run_id": i["runId"], "node_name": i["node"],
            "model": i["model"], "output_id": i["outputId"], "request_sha256": fingerprint, "permit": permit,
            "reserved_micro_usd": reserve, "accounted_micro_usd": reserve, "status": "reserved",
            "pricing": {**rate, "inputLimit": i["inputTokens"], "outputLimit": i["outputTokens"]},
            "receipt_ref": None, "settle_sha256": None, "reader_response": None, "reader_response_sha256": None,
        }
        return {"send": True, "permit": permit, "reservedMicroUsd": reserve, "pricingVersion": PRICING_VERSION}

    def _settle(self, i: dict[str, Any]) -> dict[str, Any]:
        if not (isinstance(i.get("clientId"), str) and CLIENT.match(i["clientId"]) and isinstance(i.get("operationKey"), str) and ID.match(i["operationKey"]) and isinstance(i.get("permit"), str)):
            raise Refused("invalid_settlement")
        op = self.operations.get(i["operationKey"])
        if not op or op["client_run_id"] != i["clientId"] or op["permit"] != i["permit"]:
            raise Refused("operation_mismatch")
        if i.get("checkpointRequired") is True and "completeAnswer" not in i:
            raise Refused("invalid_answer_checkpoint")
        full = normalize_answer(i["completeAnswer"], op, i.get("usage"), i.get("receiptRef")) if "completeAnswer" in i else None
        fingerprint = canonical_sha256([i.get("usage"), i.get("receiptRef") or ""])
        if op["settle_sha256"]:
            if op["settle_sha256"] != fingerprint:
                raise Refused("settlement_conflict")
            return {"recorded": True, "status": op["status"], "responsePreserved": bool(op["reader_response_sha256"])}
        r, u = op["pricing"], i.get("usage")
        valid = isinstance(u, dict) and _int(u.get("input"), 0, r["inputLimit"]) and _int(u.get("output"), 0, r["outputLimit"]) and (u["input"] > 0 or u["output"] > 0)
        if full and not valid and u is not None:
            raise Refused("invalid_reader_response")
        cost = math.ceil(u["input"] * r["input"] + u["output"] * r["output"]) if valid else op["reserved_micro_usd"]
        status = "completed" if valid else "uncertain"
        budget = self.budgets[i["clientId"]]
        budget["committed_micro_usd"] += cost - op["accounted_micro_usd"]
        op.update(status=status, accounted_micro_usd=cost, usage=u if valid else None,
                  receipt_ref=(i.get("receiptRef") or "")[:200] if isinstance(i.get("receiptRef"), str) else "",
                  settle_sha256=fingerprint, reader_response=full["checkpoint"] if full else None,
                  reader_response_sha256=full["sha256"] if full else None)
        return {"recorded": True, "status": status, "accountedMicroUsd": cost, "responsePreserved": bool(full)}

    def actions(self) -> list[tuple[str, str]]:
        return [(a, r.get("node") or self.operations.get(r.get("operationKey"), {}).get("node_name", "?")) for a, _o, r in self.calls]


