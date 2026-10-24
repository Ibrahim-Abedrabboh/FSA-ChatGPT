"""Phase 1 baseline: what whole runs do today when something goes wrong, on the mocked service (no paid call).

Three kinds of test:
- plain tests pin the behaviour Phase 1 must keep;
- `test_today_*` tests characterise a gap as it behaves now; the Phase 1 PR that closes the gap replaces them;
- each gap Phase 1 is meant to close is a strict xfail (1.1 closed FL-1 on 22 Oct 2026; its tests are plain now): the day a Phase 1 change fixes it, the test passes, strict mode
  turns that into a failure, and that PR removes the marker. Where the design leaves a choice open
  (claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md), every option satisfies the test.
"""

from __future__ import annotations

import io
import json

import httpx
import pytest
from claude_a7_harness import CLIENT, NETLIFY, a7_service
from PIL import Image

A7_FLOW = "1cgZc9rmBOrPdKIe"
RUNS = "l0roUCBwIQL3h9Eq"


async def test_the_harness_reaches_go1_like_run_1591(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        r = await a7.submit()
        assert r.json()["receiptKind"] == "accepted"
        assert a7.row()["status"] == "awaiting_go_1"
        assert [(h, p.rsplit("/", 1)[-1], n) for h, p, n in a7.outside.calls] == [
            (NETLIFY, "source-continuation", None), (NETLIFY, "reserve", "11 Stylist plans the scenes"), ("api.openai.com", "responses", None),
            (NETLIFY, "settle", None), (NETLIFY, "reserve", "11c Plan critic"), ("api.anthropic.com", "messages", None), (NETLIFY, "settle", None)]
        assert (await a7.context())["allowed"] == ["go", "change", "stop"]


# Outside faults before Go 1 already end as a recorded hold with a reason (no error, nothing resent). Phase 1 keeps this.
FAULTS = {
    "source receipt unreadable": ("source-continuation", lambda r, b: httpx.Response(200, json={}), "source receipt could not be verified", []),
    "source check down": ("source-continuation", lambda r, b: httpx.Response(500, json={}), "source receipt could not be verified", []),
    "budget refuses": ("reserve", lambda r, b: httpx.Response(200, json={"send": False, "reason": "budget_exhausted"}),
                       "No valid spending permission", []),
    "permit without ticket": ("reserve", lambda r, b: httpx.Response(200, json={"send": True}), "No valid spending permission", []),
    "settlement unreadable": ("settle", lambda r, b: httpx.Response(200, json={"x": 1}), "do not resend", ["api.openai.com"]),
    "settlement down": ("settle", lambda r, b: httpx.Response(500, text="no"), "do not resend", ["api.openai.com"]),
    "planner unreadable": ("openai", lambda r, b: httpx.Response(200, json={"output": "x"}), "did not return a readable plan", ["api.openai.com"]),
    "critic unreadable twice": ("anthropic", lambda r, b: httpx.Response(200, json={"content": []}), "could not be read after two tries",
                                ["api.openai.com", "api.anthropic.com", "api.anthropic.com"]),
}


@pytest.mark.parametrize("fault", list(FAULTS))
async def test_an_outside_fault_before_go1_holds_with_a_reason(monkeypatch, fault):
    key, answer, reason, paid = FAULTS[fault]
    async with a7_service(monkeypatch) as a7:
        a7.outside.answers[key] = answer
        await a7.submit()
        row = a7.row()
        assert row["status"] == "hold" and reason in row["hold_reason"]
        assert all(e["status"] != "error" for e in a7.executions())
        assert a7.outside.paid() == paid, "a text call is tried at most twice and an uncertain settlement stops further calls (rule 22)"


async def submit_client_job(a7) -> httpx.Response:
    """A job from the client page: a `client-` id and no owner pre-allocation, through the client intake."""
    p = {k: v for k, v in a7.payload.items() if k not in ("runId", "ownerWorkspace", "sourceUnderstanding")}
    p["clientRunId"] = "client-" + a7.payload["clientRunId"].removeprefix("owner-")
    photo = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(photo, "PNG")
    name = p["references"][0]["name"]
    r = await a7.client.post("/webhook/claude-midas-a7", headers={"X-Midas-Key": CLIENT}, data={"payload": json.dumps(p)},
                             files={"files0": (f"{name}.png", photo.getvalue(), "image/png")})
    await a7.drain()
    return r


async def test_a_client_job_is_refused_at_intake_with_a_reason(monkeypatch):
    """FL-2, fixed by 1.5 (refuse at intake, the owner's choice): the job is refused before any paid step, with a reason."""
    async with a7_service(monkeypatch) as a7:
        r = await submit_client_job(a7)
        assert r.status_code == 422 and "Only jobs sent from the owner site can start" in r.text
        assert all(e["status"] != "error" for e in a7.executions())
        assert a7.outside.calls == [], "nothing is reserved or paid"


CRASH_AT = "Budget · 11c · Ticket"  # a Code node on the way to Go 1; the planted throw stands for any Code node that throws


async def test_a_run_that_crashes_is_recorded_as_a_hold_naming_the_step(monkeypatch):
    """FL-1, fixed by 1.1: the execution still ends in an error (as /status reports it), and the run row the site reads
    says hold, names the step and adds it to the trail. Nothing is resent: the call before the crash is not repeated."""
    async with a7_service(monkeypatch) as a7:
        a7.fail_node(monkeypatch, CRASH_AT)
        await a7.submit()
        [run] = [e for e in a7.executions() if e["flow_id"] == A7_FLOW]
        assert run["status"] == "error" and run["error"]["node"] == CRASH_AT
        row = a7.row()
        assert row["status"] == "hold" and row["hold_reason"] == f"Stopped at {CRASH_AT}: planted failure"
        assert "nothing is resent" in row["client_question"]
        assert json.loads(row["trail"])[-1] | {"at": None} == {"step": 11, "name": "Stopped", "note": row["hold_reason"], "at": None}
        assert a7.outside.paid() == ["api.openai.com"], "the planner call before the crash is not repeated"
        assert (await a7.context())["allowed"] == [], "1.1 records the hold; Continue is 1.7"


async def test_a_crash_after_go1_is_recorded_as_a_hold_too(monkeypatch):
    """The resumed half of a run (after a gate) ends the same way."""
    async with a7_service(monkeypatch) as a7:
        await a7.submit()
        a7.fail_node(monkeypatch, "15f Build request")
        await a7.decide("go")
        row = a7.row()
        assert row["status"] == "hold" and row["hold_reason"] == "Stopped at 15f Build request: planted failure"
        assert a7.outside.image_calls() == 0


async def test_the_hold_reason_carries_no_link_or_secret(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        a7.fail_node(monkeypatch, CRASH_AT, "fetch failed for https://a7.test/files/abc/view?sig=0123abcd and ?key=AIzaXYZ, "
                     "provided: sk-proj-abcdef123456, Bearer abc.def, AIzaSyD1234567890abcd\nsecond line")
        await a7.submit()
        reason = a7.row()["hold_reason"]
        for secret in ("https://", "0123abcd", "AIzaXYZ", "sk-proj", "abc.def", "AIzaSyD", "second line"):
            assert secret not in reason
        assert reason == f"Stopped at {CRASH_AT}: fetch failed for [link] and ?key=<redacted> provided: <redacted>, <redacted> <redacted>"


async def test_a_hold_the_flow_already_recorded_is_kept(monkeypatch):
    """If the row already says hold (the flow recorded its own reason), the engine does not overwrite it."""
    async with a7_service(monkeypatch) as a7:
        a7.outside.answers["reserve"] = lambda r, b: httpx.Response(200, json={"send": False, "reason": "budget_exhausted"})
        await a7.submit()
        before = a7.row()
        assert before["status"] == "hold" and "No valid spending permission" in before["hold_reason"]
        await a7.app.state.runtime._hold_on_error(a7.app.state.runtime.flows[A7_FLOW],
                                                  _errored(before["execution_id"]), {"runsTable": RUNS})
        assert a7.row()["hold_reason"] == before["hold_reason"]


async def test_an_execution_that_only_read_another_runs_row_never_touches_it(monkeypatch):
    """A recovery or decision execution that read run X's row and then throws must not put X on hold (review finding)."""
    async with a7_service(monkeypatch) as a7:
        await a7.submit()
        row = a7.row()
        store = a7.store
        store.dt_update(RUNS, [row["id"]], {"status": "white_package_ready"})
        foreign = _errored("4242")
        foreign.run_data = {"Package · Read run": [{"status": "success", "start": 1.0, "data": [[{"json": dict(row)}]]}]}
        await a7.app.state.runtime._hold_on_error(a7.app.state.runtime.flows[A7_FLOW], foreign, {"runsTable": RUNS})
        assert a7.row()["status"] == "white_package_ready"


async def test_a_row_at_an_open_gate_is_left_for_the_owner(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await a7.submit()
        row = a7.row()
        assert row["status"] == "awaiting_go_1"
        await a7.app.state.runtime._hold_on_error(a7.app.state.runtime.flows[A7_FLOW], _errored(row["execution_id"]),
                                                  {"runsTable": RUNS})
        assert a7.row()["status"] == "awaiting_go_1" and (await a7.context())["allowed"] == ["go", "change", "stop"]


async def test_no_row_found_logs_and_does_not_raise(monkeypatch, caplog):
    async with a7_service(monkeypatch) as a7:
        await a7.app.state.runtime._hold_on_error(a7.app.state.runtime.flows[A7_FLOW], _errored("999"), {"runsTable": RUNS})
        assert "0 run rows found, nothing recorded" in caplog.text


async def test_flows_without_the_setting_are_unchanged(monkeypatch):
    """holdOnError is set on a7_main only (SETTINGS_PATCHES); the other flows end in an error as before."""
    async with a7_service(monkeypatch) as a7:
        settings = {f.name: f.settings for f in a7.app.state.runtime.flows.values()}
        assert [n for n, s in settings.items() if s.get("holdOnError")] == ["Claude · Midas A7 (stages 01–07)"]


def _errored(execution_id: str):
    from midas_a7.engine.executor import Execution
    e = Execution(id=execution_id, flow_id=A7_FLOW)
    e.status, e.error = "error", {"node": CRASH_AT, "message": "planted failure"}
    return e


async def test_a_client_job_id_is_refused_held_or_runs(monkeypatch):
    """Either option of 1.5: refused at intake or held with a reason before any paid step, or accepted and run normally."""
    async with a7_service(monkeypatch) as a7:
        r = await submit_client_job(a7)
        assert all(e["status"] != "error" for e in a7.executions())
        rows = a7.rows()
        refused = r.status_code >= 400 or (len(rows) == 1 and rows[0]["status"] in ("hold", "refused") and rows[0]["hold_reason"])
        if refused:
            assert a7.outside.paid() == [], "a refused or held job pays nothing"
        else:
            assert rows[0]["status"] == "awaiting_go_1"


@pytest.mark.xfail(strict=True, reason="FL-9 (Phase 1.7): a budget hold offers the owner no way to continue")
async def test_a_budget_hold_can_be_continued_once_the_budget_allows_it(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        permit = a7.outside.answers["reserve"]
        a7.outside.answers["reserve"] = lambda r, b: httpx.Response(200, json={"send": False, "reason": "budget_exhausted"})
        await a7.submit()
        assert a7.row()["status"] == "hold"
        a7.outside.answers["reserve"] = permit  # the owner raised the job budget; the ledger permits again
        assert any(a.lower().startswith("continue") for a in (await a7.context())["allowed"])
