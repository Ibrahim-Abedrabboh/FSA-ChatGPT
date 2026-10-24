# Midas A7: docs catch-up (22 Oct 2026)

Written by Claude for the owner, after the audit of plans that were made but not finished. Docs only: no code, flow, setting or paid call changes.

## What was out of date, and what it says now

| File | Was | Now |
|---|---|---|
| `docs/business/claude-status.md` | The supervised paid run was "blocked by an account setting"; next decision "fix the Anthropic setting"; scene test "job budget USD 3" | The run took place on 22 Oct (`ff0aa7e5`, USD 0.22 charged) and stopped at packaging. Next decisions are the Phase 1 items, one owner site and a scene test with a ceiling of at least about USD 4.50 |
| `docs/technical/claude-migration-status.md` | Supervised run "ready once the deploy is live"; white image on demand "no flow patch yet"; the Anthropic refusal as a current symptom | The run result; the white-image flow patch merged in PR #74 (`362d50c`); the Anthropic refusal marked resolved on 21 Oct |
| `claude-outputs/claude-midas-a7-supervised-run-checklist-2026-10-22.md` | Its header said USD 3.00 cannot work, but steps 4, the cost check and the checks table still said 3.00 | Job budget 4.50 or more (5.00 on 22 Oct); checks use the owner's limit |
| `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md` | Step 4 "cap USD 3.00"; no section on rotating secrets or on reconciling the ledger (both in the migration plan's definition of done) | Step 4 ceiling corrected and marked half done (no scene yet); new section 6, rotating a secret; new section 7, reconciling the budget ledger, from `lib/a7-budget.mjs` |
| `README.md` (root) | "n8n is the authority"; generated images in Google Drive | The Python service, flow patches, the service's file store; the old layout list marked as dated |

## Checked
- Every figure added appears in a source: the run report (USD 0.219505, USD 5.00 ceiling, 2-px halo), the checklist note 1 (USD 4.32 planning hold, about USD 4.50 ceiling), `lib/a7-budget.mjs` lines 104 and 125-140 for reconciliation.
- Every path named exists.

## Review

An independent read-only review found six points, all checked against the code and fixed: the reconciliation inputs (request id, note limit, client run id, done through the owner page); the two refusal cases told apart; the Postgres row no longer claims an unverified Railway behaviour and warns of the SQLite fallback; the run's charge labelled "for the case that ran"; a line range; "merged 22 Oct" for PR #74.

## Not changed here
- `docs/claude-docs-state.json`: the daily docs check moves it forward on its next run.
- BE-6 PR A (PR #93) merged while this was open; its variable is added to the rotation table in section 6.
