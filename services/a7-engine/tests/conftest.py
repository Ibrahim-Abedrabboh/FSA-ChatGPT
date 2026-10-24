from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# The engine must never reach a real service from the test suite.
for name in ("A7_ENGINE_AUTHORIZATION", "A7_BUDGET_AUTHORIZATION", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"):
    os.environ.pop(name, None)

from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.providers.fake import FakeProvider  # noqa: E402
from tests.fakes import FakeBudgetApi  # noqa: E402

AUTH = "test-engine-authorization"
PNG = b"\x89PNG\r\n\x1a\n" + b"synthetic product photo" * 4
ROOM_PNG = b"\x89PNG\r\n\x1a\n" + b"synthetic room photo" * 4
SIDE_JPEG = b"\xff\xd8\xff\xe0" + b"synthetic side view" * 4


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass
class Job:
    payload: dict[str, Any]
    files: list[tuple[str, bytes, str]] = field(default_factory=list)  # (filename, bytes, mime)

    @property
    def client_run_id(self) -> str:
        return self.payload["clientRunId"]

    def multipart(self) -> tuple[dict[str, str], list[tuple[str, tuple[str, bytes, str]]]]:
        return {"payload": json.dumps(self.payload)}, [("files", f) for f in self.files]


def make_job(room: bool = False, side: bool = False, **overrides: Any) -> Job:
    draft = str(uuid.uuid4())
    files = [("product-" + str(uuid.uuid4()), PNG, "image/png")]
    if side:
        files.append(("other_view-" + str(uuid.uuid4()), SIDE_JPEG, "image/jpeg"))
    if room:
        files.append(("room-" + str(uuid.uuid4()), ROOM_PNG, "image/png"))
    payload = {
        "purpose": "source_analysis_only", "draftId": draft, "clientRunId": "owner-" + draft, "runId": "claude-a7-" + draft,
        "requestId": str(uuid.uuid4()), "sourceSha256": sha(PNG), "roomSha256": sha(ROOM_PNG) if room else None,
        "referenceFingerprint": "c" * 64, "quoteFingerprint": "d" * 64, "intentFingerprint": "e" * 64,
        "maxCostUsd": 3.99 if room else 3.18, "budgetLimitUsd": 5, "instructions": "Keep the two units separate",
        "budgetOrigin": "https://claude-final-midas-a7.netlify.app",
    }
    payload.update(overrides)
    return Job(payload, files)


def engine_settings(**overrides: Any) -> Settings:
    base = dict(engine_authorization=AUTH, budget_authorization="test-budget-authorization", provider_mode="fake",
                reader_retry_delay_s=0.0, provider_timeout_s=5.0, run_deadline_s=60.0)
    base.update(overrides)
    return Settings(**base)


class Harness:
    def __init__(self, budget: FakeBudgetApi | None = None, provider: FakeProvider | None = None, **settings: Any):
        self.budget = budget or FakeBudgetApi()
        self.provider = provider or FakeProvider()
        self.app = create_app(engine_settings(**settings), budget=self.budget, provider=self.provider)
        self.client = TestClient(self.app)
        self.client.__enter__()

    def post(self, job: Job, auth: str | None = AUTH, open_budget: bool = True):
        if open_budget:
            self.budget.open(job.client_run_id)
        data, files = job.multipart()
        headers = {"Authorization": auth} if auth is not None else {}
        return self.client.post("/webhook/a7/owner-analyze", data=data, files=files, headers=headers)

    def close(self) -> None:
        self.client.__exit__(None, None, None)


@pytest.fixture
def harness():
    created: list[Harness] = []

    def make(**kwargs: Any) -> Harness:
        h = Harness(**kwargs)
        created.append(h)
        return h

    yield make
    for h in created:
        h.close()
