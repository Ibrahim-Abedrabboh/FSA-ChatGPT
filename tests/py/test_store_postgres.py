"""The store against a real Postgres (production's database). Every other test uses SQLite.

Runs only when MIDAS_TEST_DATABASE_URL points at a disposable Postgres database (CI's postgres job sets it);
otherwise it is skipped. It covers what SQLite cannot show: the JSON filters, the atomic claim of a waiting run,
the crash sweep at startup and the /status summary.
"""

from __future__ import annotations

import os
import uuid
from datetime import timedelta

import pytest

from midas_a7.store import Store, now

URL = os.environ.get("MIDAS_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="MIDAS_TEST_DATABASE_URL is not set")


@pytest.fixture
def store():
    return Store(URL)


def test_waiting_run_is_claimed_once_and_running_runs_are_swept_as_crashed(store):
    flow = "pg-" + uuid.uuid4().hex[:8]
    parked = store.create_execution(flow)
    store.save_execution(parked, "waiting", {"x": 1}, wait_till=now() - timedelta(seconds=1), wait_kind="webhook")
    assert parked in store.due_waits(now())
    assert store.claim_waiting(parked) is not None
    assert store.claim_waiting(parked) is None  # a second resume finds nothing to claim
    live = store.create_execution(flow)
    assert store.fail_interrupted() >= 1
    row = store.load_execution(live)
    assert row["status"] == "crashed" and row["state"] is None


def test_json_filters_and_the_status_summary(store):
    table = "pg-" + uuid.uuid4().hex[:8]
    store.dt_insert(table, {"run_id": "claude-a7-1", "status": "awaiting_go_1"})
    store.dt_insert(table, {"run_id": "claude-a7-2", "status": "hold"})
    rows = store.dt_select(table, {"status": "hold"})
    assert [r["run_id"] for r in rows] == ["claude-a7-2"]
    failed = store.create_execution("pg-status")
    store.save_execution(failed, "error", None, error={"node": "15g Send to Google", "message": "boom"})
    summary = store.run_summary()
    assert summary["counts"].get("error", 0) >= 1
    assert any(r["id"] == int(failed) for r in summary["failed"])
