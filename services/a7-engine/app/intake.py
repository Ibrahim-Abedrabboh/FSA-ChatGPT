"""Request validation, ported from the two n8n intake nodes.

1. Bridge "Validate analysis-only intake" (a7-owner-analysis-workflow.ts): payload
   shape, 1-12 files, file names ``<role>-<uuid>``, PNG/JPEG/WebP, each file at most
   3 MiB and 36 MiB in total.
2. Analysis "Validate analysis originals" (a7-analysis-only-workflow.ts): exactly one
   product photo whose SHA-256 is ``sourceSha256``, at most one room photo whose
   SHA-256 is ``roomSha256`` (and only when ``roomSha256`` is given).

The error codes are the ones the n8n nodes throw.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from typing import Any

from .canonical import sha256_hex

UUID_V4 = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
FILE_NAME = re.compile(r"^(product|room|other_view|look)-[a-f0-9-]{36}$")
ALLOWED_MIME = ("image/png", "image/jpeg", "image/webp")
MAX_FILES = 12
MAX_FILE_BYTES = 3 * 1024 * 1024  # 3145728, as in the bridge
MAX_TOTAL_BYTES = 36 * 1024 * 1024  # 37748736, as in the bridge


class IntakeError(Exception):
    def __init__(self, code: str, status: int = 400):
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass
class UploadedFile:
    name: str
    mime: str
    data: bytes = field(repr=False)


@dataclass
class Intake:
    payload: dict[str, Any]
    references: list[dict[str, Any]]
    binary: dict[str, UploadedFile] = field(repr=False)
    product_key: str
    room_key: str
    state: dict[str, Any]
    binary_hashes: dict[str, str]

    @property
    def client_run_id(self) -> str:
        return self.payload["clientRunId"]

    @property
    def run_id(self) -> str:
        return self.payload["runId"]

    @property
    def has_room(self) -> bool:
        return bool(self.room_key)


def _uuid(v: Any) -> bool:
    return isinstance(v, str) and bool(UUID_V4.match(v))


def _sha(v: Any) -> bool:
    return isinstance(v, str) and bool(SHA256.match(v))


def _finite(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def parse_payload(raw: Any) -> dict[str, Any] | None:
    p = raw
    if isinstance(p, (bytes, bytearray)):
        p = p.decode("utf-8", errors="replace")
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except ValueError:
            return None
    return p if isinstance(p, dict) else None


def payload_valid(p: dict[str, Any] | None, file_count: int) -> bool:
    if not p or p.get("purpose") != "source_analysis_only":
        return False
    draft = p.get("draftId")
    if not _uuid(draft):
        return False
    if p.get("clientRunId") != "owner-" + draft or p.get("runId") != "claude-a7-" + draft:
        return False
    if not _uuid(p.get("requestId")):
        return False
    for key in ("sourceSha256", "referenceFingerprint", "quoteFingerprint", "intentFingerprint"):
        if not _sha(p.get(key)):
            return False
    cost, limit = p.get("maxCostUsd"), p.get("budgetLimitUsd")
    if not _finite(cost) or cost < 0.25 or cost > 5:
        return False
    if not _finite(limit) or limit < cost or limit > 5:
        return False
    return 1 <= file_count <= MAX_FILES


def _role(name: str) -> str:
    for prefix, role in (("product-", "product"), ("room-", "room"), ("other_view-", "other_view"), ("look-", "look")):
        if name.startswith(prefix):
            return role
    return "unassigned"


def validate(raw_payload: Any, files: list[UploadedFile]) -> Intake:
    p = parse_payload(raw_payload)
    # Bridge intake.
    if not payload_valid(p, len(files)):
        raise IntakeError("invalid_analysis_intake")
    total = 0
    for f in files:
        if not FILE_NAME.match(f.name or "") or f.mime not in ALLOWED_MIME:
            raise IntakeError("invalid_analysis_file")
        total += len(f.data)
        if not f.data or len(f.data) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            raise IntakeError("invalid_analysis_file")
    assert p is not None
    # Analysis intake. The bridge forwards files as files0..files11, so those are the binary keys.
    binary = {f"files{i}": f for i, f in enumerate(files)}
    refs = []
    for key, f in binary.items():
        refs.append({
            "key": key,
            "name": f.name,
            "role": _role(f.name),
            "sha256": sha256_hex(f.data),
            "mime": f.mime,
            "image": str(f.mime or "").startswith("image/"),
        })
    product = [r for r in refs if r["role"] == "product" and r["image"]]
    room = [r for r in refs if r["role"] == "room" and r["image"]]
    room_sha = p.get("roomSha256")
    if (
        len(product) != 1
        or product[0]["sha256"] != p["sourceSha256"]
        or len(room) > 1
        or bool(room) != bool(room_sha)
        or (room and room[0]["sha256"] != room_sha)
        or any(r["role"] == "unassigned" for r in refs)
    ):
        raise IntakeError("analysis_source_mismatch")
    state = {
        "client_run_id": p["clientRunId"],
        "run_id": p["runId"],
        "source_payload": p,
        "references": refs,
        "product_key": product[0]["key"],
        "room_key": room[0]["key"] if room else "",
        "brief": {"reference_roles": [{"name": r["name"], "role": r["role"]} for r in refs]},
        "not_applied": [],
        "problems": [],
        "trail": [],
        "usable": "ok",
    }
    return Intake(
        payload=p,
        references=refs,
        binary=binary,
        product_key=state["product_key"],
        room_key=state["room_key"],
        state=state,
        binary_hashes={r["key"]: r["sha256"] for r in refs},
    )
