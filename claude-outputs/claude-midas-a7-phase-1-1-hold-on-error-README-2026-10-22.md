# Midas A7, Phase 1.1: a crash ends as a recorded hold (22 Oct 2026)

Written by Claude. Approved by the owner on 22 Oct 2026 ("yes to 1.1, start it"). This changes engine behaviour for the main flow. No flow node changes and no paid call.

## The problem (FL-1)
When a step of a run threw an error, the engine marked the execution `error` and stopped. Nothing wrote to the runs table the site reads. So the job page kept showing its last status, for example "received" or "Go 1 given", for ever. 150 of the 151 Code nodes have no error path.

## What changed
- **One engine rule, set per flow.** When a run of a flow with the setting `holdOnError` ends in an error, the service updates that run's row:
  - `status` becomes `hold`;
  - `hold_reason` becomes "Stopped at <step>: <short reason>";
  - `client_question` says a step stopped and nothing is resent;
  - a "Stopped" entry is added to the trail, so the run's history on the site shows it.
- **Only `a7_main` has the setting.** It is added through `SETTINGS_PATCHES` in `tools/n8n_to_flow.py`, with its reason in the manifest. Generated files were regenerated, not edited by hand.
- **Finding the row:** only the row this execution wrote (`execution_id`). An execution that only *read* another run's row, such as a recovery or decision webhook, never changes it. If no single row is found, or the update fails, the service logs it with `[run <id>, <flow>]` and does not raise. The execution still ends in `error`, and `/status` lists it as before.
- **The reason is safe to show:** first line only, cut at 160 characters. Links are replaced by `[link]`. Query secrets (`sig=`, `key=` and others) are removed, and so are credentials written into an error's own words: `Bearer …`, `sk-…`, `AIza…`, `ghp_…`, and `key/token/secret/password: …`.
- **A hold the flow already recorded is kept,** and a row at an open gate (`awaiting_go_1`, `awaiting_go_2`) is left for the owner to decide.
- **It never resumes the run or resends a call.** Continue comes with item 1.7.

**Code:** `Runtime._hold_on_error` and helpers in `src/midas_a7/runtime.py`; the setting in `tools/n8n_to_flow.py`.

**Two differences from the approved design (§1.1):**
- `hold_for='owner'` is not written. The runs table has no `hold_for` column; it lives only in the flow's state.
- `client_question` is written, as every flow hold does, so the row reads like any other hold.

## Tests (no paid call)
In `tests/py/test_claude_phase1_baseline.py`:
- **Was an expected failure, now a plain test:** a crash before Go 1 is recorded as a hold naming the step. The execution still ends in `error`. The call before the crash is not repeated. No decision is offered.
- **New:**
  - a crash after Go 1 (the resumed half of a run) is recorded the same way, and no image call is made;
  - the reason carries no link and no secret;
  - a hold the flow already recorded is kept;
  - no row found → a log line, no crash;
  - only `a7_main` has the setting;
  - an execution that only read another run's row never changes it;
  - a row at an open gate stays as it is, and its Go 1 choices remain.
- **Updated "today" test:** a client-page job (FL-2) is still accepted and still crashes at its first ticket, but is now shown as held with the step named. Item 1.5 decides the rest.

## Verified (locally)
- `python -m pytest -q`: 235 passed, 2 skipped, 6 xfailed. Before: 228 passed, 2 skipped, 7 xfailed.
- `tests/py/test_replay_run_1591.py`: unchanged and passing. Run 1591 has no error, and no node changed.
- `ruff 0.8.4`: clean.
- `midas-a7 check`: all node types handled.
- `python tools/n8n_to_flow.py`: the committed packages equal a regeneration.
- All 21 suites in `.github/workflows/a7-guidance.yml`: pass.

## Review
The `a7-reviewer` prompt was run as a separate read-only agent. All five findings were checked against the code and fixed:
- A run_id fallback could put *another* run's row on hold, even a finished one, or one at Go 1. Reproduced by the reviewer. The fallback is removed; only the execution's own row is used.
- `hold_for` was missing, and `client_question` was not in the design. Both are recorded above.
- The redaction covered query strings only. It is now widened.
- The fallback had no test. It is now removed, and its scenario is tested.
- The trail step was read from any digit. It now takes the step number only.

## Docs
Updated in this PR:
- the runbook, §3 and §4;
- `docs/technical/claude-python-service.md`;
- `docs/business/claude-status.md`;
- the briefing.

## Not verified
- On the live service: it needs a deploy. A real crash on the live service has not been seen with this change.
- How the owner site words the new hold. It shows `hold_reason` as it does for every hold.

## Owner actions
Review and merge. After the deploy, nothing needs setting.
