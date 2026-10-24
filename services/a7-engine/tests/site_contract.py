"""Python ports of what the site does with the engine's answer.

* ``answer_object`` / ``verified_analysis_answers``: lib/a7-analysis-ledger.mjs
* ``observation_from_verified_answers``: lib/a7-analysis-observation.mjs
* ``check_production_reply``: the response checks in lib/a7-understanding-production.mjs (run)
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.canonical import canonical_sha256

NODES_PRODUCT = ["03 Eye reads the product photo", "05 Second count", "09 Conflict check"]


def required_nodes(room: bool) -> list[str]:
    return ["03 Eye reads the product photo", "05 Second count", *(["06 Room reader"] if room else []), "09 Conflict check"]


class Unverified(Exception):
    pass


def _answer_texts(a: Any) -> list[Any]:
    a = a or {}
    if a.get("candidates") is not None:
        parts = [p.get("text") for c in a["candidates"] for p in ((c.get("content") or {}).get("parts") or [])]
    elif a.get("content") is not None:
        parts = [c.get("text") for c in a["content"]]
    elif a.get("output") is not None:
        parts = [c.get("text") for m in a["output"] for c in (m.get("content") or [])]
    else:
        parts = []
    return [v for v in parts if (isinstance(v, str) and v.strip()) or (isinstance(v, dict) and v)]


def answer_object(a: Any) -> dict[str, Any] | None:
    parts = _answer_texts(a)
    objects = [v for v in parts if isinstance(v, dict)]
    if objects:
        return objects[0]
    text = "".join(v for v in parts if isinstance(v, str))
    if not text or len(text) > 120000:
        return None
    first, last = text.find("{"), text.rfind("}")
    if first < 0 or last < first:
        return None
    try:
        value = json.loads(text[first:last + 1])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def verified_analysis_answers(ledger: Any, owner_id: str, source: dict[str, Any], reported: dict[str, Any]) -> dict[str, Any]:
    draft = source["draftId"]
    client, run = "owner-" + draft, "claude-a7-" + draft
    required = required_nodes(bool(source.get("roomSha256")))
    if (reported.get("clientRunId") != client or reported.get("runId") != run or reported.get("sourceSha256") != source["sourceSha256"]
            or reported.get("referenceFingerprint") != source["referenceFingerprint"] or not isinstance(reported.get("readers"), list)
            or len(reported["readers"]) != len(required)):
        raise Unverified("analysis_receipt_unverified")
    budget = ledger.budgets.get(client)
    if not budget or budget["owner_id"] != owner_id or budget["run_id"] != run or budget["limit_micro_usd"] != round(source["budgetLimitUsd"] * 1e6):
        raise Unverified("analysis_receipt_unverified")
    rows = [op for op in ledger.operations.values() if op["client_run_id"] == client and op["run_id"] == run and op["node_name"] in required]
    if len(rows) != len(required) or len({r["node_name"] for r in rows}) != len(required):
        raise Unverified("analysis_receipt_unverified")
    answers = {}
    for name in required:
        row = next(r for r in rows if r["node_name"] == name)
        pointer = next((r for r in reported["readers"] if r.get("node") == name), None)
        rr = row.get("reader_response") or {}
        if (not pointer or row["status"] != "completed" or pointer.get("status") != "completed" or pointer.get("operationKey") != row["operation_key"]
                or pointer.get("receiptRef") != row["receipt_ref"] or not row["receipt_ref"] or rr.get("schema") != "a7-complete-answer-v1"
                or rr.get("node") != name or canonical_sha256(rr) != row["reader_response_sha256"]):
            raise Unverified("analysis_receipt_unverified")
        parsed = answer_object(rr.get("answer"))
        if not parsed:
            raise Unverified("analysis_receipt_unverified")
        answers[name] = parsed
    return answers


def _bounded(v: Any, n: int = 350) -> str | None:
    return v.strip()[:n] if isinstance(v, str) and v.strip() else None


def _list(v: Any, n: int = 20) -> list[str]:
    return [x for x in (_bounded(y) for y in v[:n]) if x] if isinstance(v, list) else []


def _positive(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and 0 < v <= 199 else None


def observation_from_verified_answers(source: dict[str, Any], answers: dict[str, Any]) -> dict[str, Any]:
    eye, second = answers.get("03 Eye reads the product photo"), answers.get("05 Second count")
    room, conflict = answers.get("06 Room reader"), answers.get("09 Conflict check")
    if not eye or not second or not conflict or bool(room) != bool(source.get("roomSha256")):
        raise Unverified("analysis_receipt_unverified")
    pieces = [{"label": _bounded(p.get("label"), 100), "kind": _bounded(p.get("kind"), 80), "role": p["role"]}
              for p in (eye.get("pieces") if isinstance(eye.get("pieces"), list) else [])[:60]
              if isinstance(p, dict) and p.get("role") in ("product", "excluded", "context") and _bounded(p.get("label"), 100) and _bounded(p.get("kind"), 80)]
    eye_count = _positive(len([p for p in pieces if p["role"] == "product"]))
    second_count = _positive(second.get("total"))
    category = _bounded(eye.get("category"), 120)
    if not category or not eye_count or not second_count:
        raise Unverified("analysis_receipt_unverified")
    observation = {"category": category, "eyeCount": eye_count, "secondCount": second_count, "pieces": pieces,
                   "uncertainties": _list(eye.get("unknowns"))}
    room_observation = {"sourceSha256": source.get("roomSha256"), "roomType": _bounded(room.get("room_type"), 120),
                        "fixedObjects": _list(room.get("fixed_objects")), "unknowns": _list(room.get("unknowns"))} if room else None
    findings = [x for x in (_bounded(c if isinstance(c, str) else ": ".join(str(c.get(k)) for k in ("topic", "severity", "reason") if isinstance(c, dict) and c.get(k)))
                            for c in (conflict.get("conflicts") if isinstance(conflict.get("conflicts"), list) else [])[:20]) if x]
    return {"observation": observation, "roomObservation": room_observation, "conflictFindings": findings}


def check_production_reply(status: int, raw: str, intent_fingerprint: str) -> dict[str, Any]:
    """The checks productionReader.run applies before trusting a reply; raises with the code it would record."""
    try:
        reported = json.loads(raw)
    except ValueError:
        reported = None
    code = reported.get("error") if isinstance(reported, dict) and isinstance(reported.get("error"), str) and re.match(r"^[a-z_]{1,80}$", reported["error"]) else None
    if not 200 <= status < 300:
        raise Unverified(code or "a7_http_error")
    if len(raw) > 180000 or not reported:
        raise Unverified("a7_unreadable_answer")
    if reported.get("accepted") is not True:
        raise Unverified(code or "a7_not_accepted")
    if reported.get("intentFingerprint") != intent_fingerprint:
        raise Unverified("a7_answer_for_other_request")
    return reported
