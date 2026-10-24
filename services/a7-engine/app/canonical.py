"""JSON serialisation that matches the JavaScript the site and n8n use.

* ``js_stringify`` matches ``JSON.stringify(value)`` (insertion order, no spaces).
* ``canonical`` matches the site's ``canonical`` helper in ``lib/a7-actions.mjs``:
  ``JSON.stringify`` with every object's keys sorted, arrays kept in order.

Hashes computed here are compared with hashes the site computes, so number and
string formatting follow JavaScript rules, not Python's ``json`` defaults.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any


def _js_number(value: float | int) -> str:
    if isinstance(value, bool):  # pragma: no cover - guarded by caller
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if not math.isfinite(value):
        return "null"
    if value == 0:
        return "0"
    if value.is_integer() and abs(value) < 1e21:
        return str(int(value))
    text = repr(value)
    if "e" in text:
        mantissa, exponent = text.split("e")
        sign = "-" if exponent.startswith("-") else "+"
        digits = exponent.lstrip("+-").lstrip("0") or "0"
        if mantissa.endswith(".0"):
            mantissa = mantissa[:-2]
        return f"{mantissa}e{sign}{digits}"
    return text


def _encode(value: Any, sort_keys: bool) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        return _js_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(_encode(item, sort_keys) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys()) if sort_keys else list(value.keys())
        return "{" + ",".join(json.dumps(str(k), ensure_ascii=False) + ":" + _encode(value[k], sort_keys) for k in keys) + "}"
    raise TypeError(f"not JSON serialisable: {type(value).__name__}")


def js_stringify(value: Any) -> str:
    return _encode(value, sort_keys=False)


def canonical(value: Any) -> str:
    return _encode(value, sort_keys=True)


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def canonical_sha256(value: Any) -> str:
    return sha256_hex(canonical(value))
