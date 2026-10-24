"""Unit tests for the ported Ticket/Receipt helpers."""

from __future__ import annotations

import pytest

from app.canonical import canonical, js_stringify, sha256_hex
from app.ledger import (
    answer_envelope,
    has_answer,
    operation_key,
    operation_slot,
    permission_granted,
    provider_usage,
    receipt_ref,
    settlement_preserved,
)

CLIENT = "owner-0f8fad5b-d9cb-469f-a165-70867728950e"


def test_canonical_sorts_keys_and_formats_numbers_like_javascript():
    assert canonical({"b": 1, "a": [3.0, 0.5, {"d": None, "c": True}]}) == '{"a":[3,0.5,{"c":true,"d":null}],"b":1}'
    assert js_stringify({"b": 1, "a": "é"}) == '{"b":1,"a":"é"}'
    assert canonical(1e21) == "1e+21" and canonical(1e-7) == "1e-7" and canonical(-0.0) == "0"


def test_operation_slot_for_source_analysis():
    state = {"client_run_id": CLIENT, "run_id": "claude-a7-x"}
    slot = operation_slot(state, "05 Second count", state)
    assert slot == {"client": CLIENT, "run": "claude-a7-x", "node": "05 Second count", "output": "job", "attempt": 0,
                    "phase": "", "go1": 0, "go2": 0, "plan": 0, "rewrite": 0, "review": 0}
    assert operation_key(slot) == "a7:" + sha256_hex(canonical(slot))
    with pytest.raises(ValueError, match="budget_identity_missing"):
        operation_slot({"client_run_id": "bad", "run_id": "x"}, "05 Second count")


def test_provider_usage():
    assert provider_usage({"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5, "thoughtsTokenCount": 2}}, "gemini") == {"input": 10, "output": 7}
    assert provider_usage({"response": {"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5}}}, "gemini") == {"input": 10, "output": 5}
    assert provider_usage({"usageMetadata": {"promptTokenCount": 10}}, "gemini") is None
    assert provider_usage({"usage": {"input_tokens": 7, "output_tokens": 3, "cache_read_input_tokens": 2}}, "anthropic") == {"input": 9, "output": 3}
    assert provider_usage({"usage": {"input_tokens": 7, "output_tokens": 3, "cache_creation_input_tokens": 5}}, "anthropic") is None
    assert provider_usage({"usage": {"prompt_tokens": 4, "completion_tokens": 1}}, "openai") == {"input": 4, "output": 1}
    assert provider_usage({"usage": {"input_tokens": 0, "output_tokens": 0}}, "openai") is None
    assert provider_usage({"error": "provider_timeout"}, "openai") is None
    assert provider_usage({"usage": {"input_tokens": True, "output_tokens": 1}}, "openai") is None


def test_answer_envelope_and_receipt():
    raw = {"id": "msg_01ABC", "type": "message", "content": [{"type": "text", "text": "{}"}], "usage": {"input_tokens": 1, "output_tokens": 1}, "stop_reason": "end_turn", "model": "x"}
    env = answer_envelope(raw)
    assert list(env) == ["id", "content", "usage", "stop_reason"] and has_answer(env)
    assert receipt_ref(raw) == "msg_01ABC"
    gemini = {"candidates": [{"content": {"parts": [{"text": "{}"}]}}], "usageMetadata": {}, "modelVersion": "m", "responseId": "abc"}
    assert "modelVersion" not in answer_envelope(gemini)
    assert receipt_ref(gemini) == "answer:" + sha256_hex(js_stringify(answer_envelope(gemini)))
    assert receipt_ref({"id": "has space"}).startswith("answer:")
    assert answer_envelope({"statusCode": 500, "body": {"id": "x"}}) == {"error": "provider_http_error"}
    assert not has_answer({"error": "x", "content": [1]})
    assert receipt_ref({"error": "provider_timeout"}) == "answer:" + sha256_hex('{"error":"provider_timeout"}')


def test_permit_and_settlement_checks():
    permit = "4f1c7f1e-0a8e-4b33-9e6c-3c4d5e6f7a8b"
    assert permission_granted(200, {"send": True, "permit": permit, "reservedMicroUsd": 5})
    assert not permission_granted(201, {"send": True, "permit": permit, "reservedMicroUsd": 5})
    assert not permission_granted(200, {"send": False, "reason": "operation_already_exists"})
    assert not permission_granted(200, {"send": True, "permit": permit, "reservedMicroUsd": 5.5})
    assert settlement_preserved(200, {"recorded": True, "status": "completed", "responsePreserved": True})
    assert not settlement_preserved(200, {"recorded": True, "status": "completed"})
    assert not settlement_preserved(None, None)
