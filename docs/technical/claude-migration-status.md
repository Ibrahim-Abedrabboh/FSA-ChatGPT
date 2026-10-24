# n8n → Python migration: status

*Technical documentation · checked against commit `6925ad1` (22 Oct 2026). Sources:*
- *`claude-outputs/claude-midas-python-migration-plan-2026-10-20.md`*
- *`claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md`*
- *`claude-outputs/claude-midas-a7-revamp-prompt-2026-10-20.md`*

## Approach

The "fast track", chosen on 20 Oct 2026:
- **Engine.** One Python service runs the seven frozen workflows with their Code-node JavaScript unchanged, and serves the same webhooks.
- **Owner site.** The Netlify owner site and its budget ledger stay as they are.
- **Storage.** Google Drive is replaced by the service's own file store.
- **Data.** The start is fresh: no data was moved.

The plan estimates a full rewrite in Python at about 43–56 days, against 24–34 for the fast track.

## Status per part

| Part | Status | Evidence |
|---|---|---|
| Service built and deployed | Done | `/health`: every credential set, seven flows loaded (runbook, 20 Oct) |
| Parity with n8n | Replay of run 1591 matches node for node to Go 1 | `tests/py/test_replay_run_1591.py` |
| Owner preview site switched | Done, 20 Oct 2026, on the owner's go | `SETTINGS.md`; runbook step 3 |
| Final site (`claude-final-midas-a7`) | Still on n8n | `SETTINGS.md` |
| Drive replaced by service files | Done | `nodes/google_drive.py`, `files` table |
| Speed changes 1–3 | Live; effect not measured | `flows/manifest.json`; runbook |
| Supervised paid run | **Run on 22 Oct (`ff0aa7e5`), under a USD 5.00 job ceiling** (a USD 3.00 ceiling cannot work: the ledger holds worst cases first). Go 1, one image call, review and Go 2 worked; USD 0.219505 charged for the case that ran (a first attempt's three photo-check calls are not in that figure). The package held on a 2-px grey halo, so no scene (FL-4) | `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md` |
| White master on demand | Site side and flow patch merged (PR #74, merged 22 Oct). Not yet used on a paid run | commits `fbbc6a1`, `362d50c`; `whiteMaster` patch in `tools/n8n_to_flow.py` |
| Unpublish n8n workflows | Open; needs the owner's go; 14-day rollback window | revamp prompt WP5 |
| Cleanup | Open: delete executions 677–682 and 1591 (they hold the `X-Midas-Key`), rotate the client header credential, delete merged branches, decide the catalogue schedule | revamp prompt WP5 |
| `services/a7-engine` | Paused 19 Oct; not deployed; to be retired or merged | migration plan |

## What "functions not working" maps to today

| Symptom | Cause | Next step |
|---|---|---|
| Photo check ended `409 analysis_outcome_uncertain` (21 Oct) | Anthropic refused the organisation-level key | Resolved 21 Oct: `ANTHROPIC_WORKSPACE_ID` set |
| No room scene ever delivered | Not proven on either engine; on 22 Oct a held package blocked the scene (FL-4) | Phase 1.2 and 1.3, then a bounded scene test (owner go; job ceiling at least about USD 4.50) |
| Edits never completed | Five attempts each stopped on a different fault (since fixed) | Run the 7 edit checks |
| Package held on wide sets | Model ignores framing (97.6% of width against a 76% target, run `4f80c2bf`) | Fit-on-white fix merged; prove it live |
| Options do nothing | "Recorded, not applied by A7" in the owner app | Apply in A7 or hide in the UI |

A parity audit of every owner-app option, mapping each to the flow node that uses it, is the recommended way to turn these into a complete list.
