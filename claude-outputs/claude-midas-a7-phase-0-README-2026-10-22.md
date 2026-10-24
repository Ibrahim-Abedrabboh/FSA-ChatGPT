# Midas A7, Phase 0: stop silent failures (22 Oct 2026)

Written by Claude. **Built and tested locally. Not deployed:** the owner merges, and the sites and the service deploy from `main`.

The plan this belongs to is `claude-outputs/claude-midas-a7-audit-and-automation-plan-2026-10-21.md`, and the IDs below come from it. Phase 0 changes no A7 flow step and makes no paid call.

## What changed

| Item | Change | Where |
|---|---|---|
| FE-1 | Only `/owner/` sends new jobs (owner's decision). `/owner/client/`, `/owner/guide/`, `/owner/draft3/` and `/owner/desk/` are no longer built and redirect to `/owner/`. `/owner/controls/` keeps the queue, billing reconciliation and reader recovery, and its new-job form is hidden and points to `/owner/`. Sources are kept | `build.mjs`, `netlify.toml` |
| FE-3, FE-4 | When the engine answers 401, 403 or 404, the send is a clear refusal and the draft reopens. A send that fails before leaving the site reopens its draft and says nothing was sent. Every failed send and refused decision is logged with its reason, never the job or a secret | `netlify/functions/owner-actions.mjs` |
| FE-14 | The background photo reader logs why it did not start | `owner-source-analysis-background.mjs` |
| FE-15 | An unexpected error during the send check is no longer shown as a source-facts problem | `lib/a7-actions.mjs` |
| FE-6 | The emergency stop (`A7_PAID_BUDGET_GUARDS_READY` off) also makes the ledger refuse new reservations, so a run past Go 1 holds at its next paid call. Settling keeps working | `netlify/functions/a7-budget.mjs` |
| FE-7, FE-18 | Delivered files and the Go 2 candidate are kept when they are Google Drive links or signed `/files/…?sig=` links from the configured engine. Anything else is dropped. Labels no longer say "Google Drive" | `owner-actions.mjs`, `start-connected.js`, `owner-actions.js` |
| FE-5 | The engine address is read on every call. `/api/owner/connection` says which engine it reached (`python_service` or `n8n`) and its host | `owner-actions.mjs`, `owner-projects.mjs`, `owner-reader-recovery.mjs`, `lib/model-tests.mjs`, `owner-connection.mjs` |
| BE-6 (first half) | `sig=` file-link signatures are redacted in the service logs | `src/midas_a7/cli.py` |
| BE-2 | `GET /status` on the service, authenticated with the bridge secret, lists:<ul><li>runs by status;</li><li>active and waiting runs with their age;</li><li>the latest failed or crashed runs with the failing node.</li></ul>It shows no run state, request data or secret. Failure log lines end with `[run <id>, <flow>]` | `src/midas_a7/app.py`, `store.py`, `engine/executor.py` |
| BE-5 | A new suite checks the budget and image-call rules on the baseline the service runs (`n8n/baseline/…`, 362 nodes). A Postgres CI job tests the store on real Postgres. Python CI also runs on owner-app changes | `tests/claude-midas-a7-baseline/`, `tests/py/test_store_postgres.py`, `.github/workflows/` |

## Verified (locally, 22 Oct 2026)

**Owner app:**
- `npm test`: 388 passed, 0 failed, 1 skipped.
- `npm run build`: passes.

**Python service:**
- `python -m pytest -q`: 209 passed.
- `midas-a7 check`: clean.
- `ruff 0.8.4`: clean.
- The flow packages equal a regeneration, so no flow changed.

**Postgres:** `tests/py/test_store_postgres.py` passed 2 of 2 against a local Postgres 16.

**A7 workflow suites:** all 21 `node`/`python3` steps of `.github/workflows/a7-guidance.yml` pass, including the new baseline suite (5 of 5).

## Not verified

- Nothing is deployed, so no live behaviour was checked.
- The redirects run on Netlify only. The local test checks their order in `netlify.toml`.
- `/status` was not called on the live service.

## Owner actions

1. Review and merge the PR. Merging deploys both sites from `main`, and Railway deploys the service.
2. Deploy the service only when no run is active. A deploy marks active runs as crashed (BE-1, Phase 2).
3. After the deploy, while signed in, open `https://midas-a7-owner-preview.netlify.app/api/owner/connection`. It should show `"engine":"python_service"`.
4. Then run the supervised paid run (cap USD 3.00) from `/owner/` on the preview site.
