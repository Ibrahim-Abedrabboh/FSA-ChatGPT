"""Intake rejections, ported from the bridge and analysis intake nodes (and
tests/a7-analysis-only-workflow.test.mjs). Every rejection happens before any budget
or provider call."""

from __future__ import annotations

import json
import uuid

import pytest

from app.intake import IntakeError, UploadedFile, validate
from tests.conftest import PNG, ROOM_PNG, Job, make_job, sha


def files_of(job: Job) -> list[UploadedFile]:
    return [UploadedFile(name, mime, data) for name, data, mime in job.files]


def test_valid_intake_binds_keys_roles_and_hashes():
    job = make_job(room=True, side=True)
    intake = validate(json.dumps(job.payload), files_of(job))
    assert intake.product_key == "files0" and intake.room_key == "files2"
    assert [r["role"] for r in intake.references] == ["product", "other_view", "room"]
    assert intake.references[0]["sha256"] == sha(PNG)
    assert intake.state["source_payload"] == job.payload
    assert intake.state["brief"]["reference_roles"][1]["role"] == "other_view"
    assert intake.binary_hashes == {"files0": sha(PNG), "files1": intake.references[1]["sha256"], "files2": sha(ROOM_PNG)}


@pytest.mark.parametrize("change", [
    {"purpose": "generation"},
    {"draftId": "not-a-uuid"},
    {"runId": "claude-a7-" + str(uuid.uuid4())},
    {"clientRunId": "owner-" + str(uuid.uuid4())},
    {"requestId": str(uuid.uuid1())},
    {"sourceSha256": "A" * 64},
    {"referenceFingerprint": "short"},
    {"quoteFingerprint": None},
    {"intentFingerprint": 7},
    {"maxCostUsd": 0.2},
    {"maxCostUsd": 5.01},
    {"maxCostUsd": "3.18"},
    {"budgetLimitUsd": 2},
    {"budgetLimitUsd": 5.5},
    {"budgetLimitUsd": True},
])
def test_payload_rejections(change):
    job = make_job(**change)
    with pytest.raises(IntakeError) as error:
        validate(json.dumps(job.payload), files_of(job))
    assert error.value.code == "invalid_analysis_intake"


def test_unparseable_or_missing_payload():
    job = make_job()
    for raw in (None, "", "{not json", "[]", json.dumps("string")):
        with pytest.raises(IntakeError, match="invalid_analysis_intake"):
            validate(raw, files_of(job))


def test_file_count_limits():
    job = make_job()
    with pytest.raises(IntakeError, match="invalid_analysis_intake"):
        validate(json.dumps(job.payload), [])
    many = files_of(job) + [UploadedFile("other_view-" + str(uuid.uuid4()), "image/png", b"x" * 10) for _ in range(12)]
    with pytest.raises(IntakeError, match="invalid_analysis_intake"):
        validate(json.dumps(job.payload), many)


@pytest.mark.parametrize("bad", [
    UploadedFile("spec-" + str(uuid.uuid4()), "image/png", b"x"),  # role not accepted by the bridge
    UploadedFile("product.png", "image/png", b"x"),
    UploadedFile("other_view-" + str(uuid.uuid4()), "application/pdf", b"%PDF"),
    UploadedFile("other_view-" + str(uuid.uuid4()), "image/gif", b"GIF89a"),
    UploadedFile("other_view-" + str(uuid.uuid4()), "image/png", b""),
    UploadedFile("other_view-" + str(uuid.uuid4()), "image/png", b"x" * (3 * 1024 * 1024 + 1)),
])
def test_file_rejections(bad):
    job = make_job()
    with pytest.raises(IntakeError) as error:
        validate(json.dumps(job.payload), files_of(job) + [bad])
    assert error.value.code == "invalid_analysis_file"


def test_twelve_files_at_the_per_file_limit_fit_the_total_limit():
    """3 MiB x 12 is exactly the bridge's 36 MiB total, so both limits are honoured together."""
    job = make_job()
    product = UploadedFile(job.files[0][0], "image/png", PNG + b"y" * (3 * 1024 * 1024 - len(PNG)))
    job.payload["sourceSha256"] = sha(product.data)
    rest = [UploadedFile("other_view-" + str(uuid.uuid4()), "image/png", b"x" * (3 * 1024 * 1024)) for _ in range(11)]
    intake = validate(json.dumps(job.payload), [product, *rest])
    assert len(intake.references) == 12


@pytest.mark.parametrize("case", ["hash", "two_products", "no_product", "room_without_hash", "hash_without_room", "room_hash", "two_rooms"])
def test_source_mismatch(case):
    job = make_job(room=case in ("room_hash", "two_rooms", "room_without_hash"))
    files = files_of(job)
    p = dict(job.payload)
    if case == "hash":
        p["sourceSha256"] = "f" * 64
    elif case == "two_products":
        files.append(UploadedFile("product-" + str(uuid.uuid4()), "image/png", PNG))
    elif case == "no_product":
        files = [UploadedFile("other_view-" + str(uuid.uuid4()), "image/png", PNG)]
    elif case == "room_without_hash":
        p["roomSha256"] = None
    elif case == "hash_without_room":
        p["roomSha256"] = sha(ROOM_PNG)
    elif case == "room_hash":
        p["roomSha256"] = "0" * 64
    elif case == "two_rooms":
        files.append(UploadedFile("room-" + str(uuid.uuid4()), "image/png", ROOM_PNG))
    with pytest.raises(IntakeError) as error:
        validate(json.dumps(p), files)
    assert error.value.code == "analysis_source_mismatch"


def test_http_rejections_make_no_budget_or_provider_call(harness):
    h = harness()
    job = make_job(sourceSha256="f" * 64)
    r = h.post(job)
    assert r.status_code == 400 and r.json() == {"error": "analysis_source_mismatch"}
    bad = make_job(budgetLimitUsd=9)
    r = h.post(bad)
    assert r.status_code == 400 and r.json() == {"error": "invalid_analysis_intake"}
    r = h.client.post("/webhook/a7/owner-analyze", json=job.payload, headers={"Authorization": "test-engine-authorization"})
    assert r.status_code == 400 and r.json() == {"error": "invalid_analysis_intake"}
    many = make_job()
    many.files += [("other_view-" + str(uuid.uuid4()), b"x", "image/png") for _ in range(12)]
    r = h.post(many)
    assert r.status_code == 400 and r.json() == {"error": "invalid_analysis_intake"}
    gif = make_job()
    gif.files.append(("other_view-" + str(uuid.uuid4()), b"GIF89a", "image/gif"))
    r = h.post(gif)
    assert r.status_code == 400 and r.json() == {"error": "invalid_analysis_file"}
    assert h.budget.calls == [] and h.provider.calls == []
