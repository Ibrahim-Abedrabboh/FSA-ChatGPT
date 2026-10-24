# Midas A7 Python service: runbook

20 Oct 2026. This is the fast track of `claude-midas-python-migration-plan-2026-10-20.md` (section 10). The code is in `src/midas_a7/`.

## 1. What it is

**One Python service replaces n8n for A7.** It serves the same webhook addresses, with the same request and response contracts, as the seven n8n workflows it replaces:

| n8n workflow (frozen version) | Flow package | Webhooks it serves |
|---|---|---|
| Claude · Midas A7 (`4669b0d7`) | `a7_main` | `POST /webhook/claude-midas-a7`<br>`POST /webhook/claude-midas-a7-decision` |
| Owner submission and approval bridge (`b41c6e1d`) | `owner_bridge` | `GET /webhook/a7/owner-context`<br>`POST /webhook/a7/owner-submit`<br>`POST /webhook/a7/owner-decision` |
| Owner status and history (`ba566aef`) | `owner_read` | `GET /webhook/a7/owner-read` |
| Owner source analysis bridge (`f2d2a5cc`) | `owner_analysis` | `POST /webhook/a7/owner-analyze` |
| Source analysis only (`eabd2f38`) | `analysis_only` | `POST /webhook/claude-midas-a7-analysis` |
| Model tests per stage (`d6a59452`) | `model_tests` | `POST /webhook/a7/model-test` |
| Catalogue refresh (`040930df`) | `catalogue_refresh` | No webhook. It runs weekly (Saturday 04:00 Amman) when `SCHEDULES_ENABLED=true`, or by hand with `midas-a7 run catalogue_refresh` |

**How the logic is carried over.**
- The A7 logic is not rewritten. Each workflow was frozen from n8n into `n8n/baseline/` and turned into a flow package by `tools/n8n_to_flow.py`.
- Every Code node's JavaScript is kept byte for byte in `src/midas_a7/flows/*/code/`.
- The Python engine runs the nodes in n8n's own order. A Node process inside the same container runs the JavaScript and the `={{ }}` expressions.
- Routing, waits for go 1 and go 2, the database, model calls, Google image calls, image resizing and schedules are all Python.
- **No Google Drive** (owner's decision, 20 Oct 2026). The flows' 13 Drive nodes keep their parameters and outputs, but the files (images, packages, manifests) are stored in the service's own database. Each file gets a signed private link, `/files/<id>/view?sig=…`. The owner bridge has one documented patch, which passes these links instead of Drive links; it is listed in `tools/n8n_to_flow.py` (`PATCHES`) and in `flows/manifest.json`.
- **Image edits** (resize, jpg, webp, the BMP read-backs) reproduce n8n's GraphicsMagick files byte for byte along the A7 package chain (`tests/py/test_edit_image.py`).

**Unchanged:**
- The Netlify owner site and its budget ledger. The service calls `/api/a7/budget/*` on the site exactly as n8n did.
- The rules in the Code nodes: budget guard, gates, 24-hour go tickets, intake limits, contract stamp, package and scene rules.

**Proof of the same behaviour:** `tests/py/test_replay_run_1591.py` replays the real run 1591 (20 Oct, owner job, intake to go 1) through the engine.
- External calls return their recorded answers.
- Every other node is recomputed: Code, IF, Merge, Wait and Respond.
- The result has the same execution order and the same run count per node as n8n. Each node's output is identical to n8n's, including the `09b` contract stamp.
- The run parks at "Wait for go 1" as it did in n8n.

## 2. Deploying on Railway

- **Service:** one service built from `Dockerfile` (Python 3.12 + Node 22), plus a Postgres database.
- **Replicas:** `railway.json` pins exactly 1 replica, because the run state of an active run is held in the process.
- **Health check:** `GET /health` reports which credentials are set (never their values) and which flow versions are loaded.

### Variables to set (the owner sets the secret ones; none is in the repo)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `PUBLIC_BASE_URL` | The service's public https address, currently `https://midas-a7-production.up.railway.app`. Resume links of go 1 and go 2 are built from it |
| `RESUME_SIGNING_SECRET` | A new random 64-hex value. It signs the resume links of go 1 and go 2, and the private file links while `FILE_LINK_SECRET` is not set. Changing it invalidates the links of waiting runs (and of stored files, if `FILE_LINK_SECRET` is not set) |
| `FILE_LINK_SECRET` | Optional (BE-6, PR A, 22 Oct 2026). A long random value, set by the owner. When set, new file links are signed with it and links signed earlier with `RESUME_SIGNING_SECRET` still open; rotating `RESUME_SIGNING_SECRET` then no longer breaks file links. Set it only when no run is active (the change redeploys). `/health` shows `configured.fileLinkSecret: true/false`, never the value |
| `A7_BRIDGE_HEADER_VALUE` | **The same value as the owner site's `A7_READ_AUTHORIZATION`.** It authenticates the site's calls to this service and this service's calls to the site's budget ledger |
| `MIDAS_CLIENT_HEADER_VALUE` | A new random value (this is the rotation of `X-Midas-Key`). Used between the bridges and the A7 intake, now inside the service |
| `MIDAS_OWNER_HEADER_VALUE` | A new random value. Used between the owner bridge and the decision intake, inside the service |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | Provider keys (paid calls) |
| `ANTHROPIC_WORKSPACE_ID` | Needed when `ANTHROPIC_API_KEY` was created at the organisation level rather than inside a workspace: Anthropic then refuses every call with 400 "This API key is not scoped to a workspace" (seen 21 Oct 2026). Copy the workspace id from the Anthropic Console (Settings → Workspaces) or, instead, create the key inside the workspace and leave this unset. `GET /health` reports it as `anthropicWorkspaceId` |
| `SCHEDULES_ENABLED` | `false` (default). Set `true` to run the weekly catalogue refresh. n8n never published it |

Optional: `LOG_LEVEL` (default `INFO`) and `SELF_BASE_ALIASES` (default: the old n8n host, so the flows' own internal calls stay inside the service).

### Starting empty

On the owner's instruction (20 Oct), no run, ledger or file history is moved. The database starts empty. On first start the service loads only the reference tables, from `src/midas_a7/data/seeds/`:
- the model registry (2 rows);
- the handling profiles (44);
- the catalogue (428).

## 3. Switching the owner site

The owner site now reads one setting, `A7_ENGINE_BASE_URL`:
- **Unset:** every call goes to n8n as before.
- **Set to the service origin:** all seven call sites (jobs, connection, actions, projects, reader recovery, source analysis, model tests) go to the Python service.
- **Not a bare https origin:** the value is ignored with a warning, and calls stay on n8n.

The owner site accepts both link forms during the switch: Drive links from n8n and signed service links. It no longer says "Drive".

**Steps** (each one needs the owner's go):
1. Deploy the service. Set the variables above. Check that `GET /health` shows every credential as `true`.
2. **Unpaid check:** with the owner site still on n8n, call `GET /webhook/a7/owner-read` on the service with the bridge header. It answers with an empty queue.
3. **Switch:** set `A7_ENGINE_BASE_URL` on the owner site (Netlify) to the service origin, then redeploy the site.
4. **One supervised paid run**: white package plus one scene, through go 1 and go 2. The job ceiling must be at least about USD 4.50, because the ledger holds each call's worst case first (`claude-outputs/claude-midas-a7-supervised-run-checklist-2026-10-22.md`, note 1).
5. **Unpublish the n8n workflows**, only with the owner's approval: A7, the five bridges and the catalogue refresh. Keep them saved for 14 days as the rollback.

**Rollback:** unset `A7_ENGINE_BASE_URL` on the owner site, redeploy it, and republish the n8n workflows. Runs started on the Python service do not move back.

**Where it stands (20 Oct 2026, evening):**
- Step 1 done: the seven secret variables are set on the service; `GET /health` reports every credential `true` and the seven flow versions loaded.
- Step 2 not run on its own: the first call the owner site makes after the switch is this same `owner-read` call, and it is unpaid.
- Step 3 done on the owner's go: `A7_ENGINE_BASE_URL=https://midas-a7-production.up.railway.app` set on `midas-a7-owner-preview` (production context, all scopes), redeployed by the merge of this change. `claude-final-midas-a7` stays on n8n.
- Steps 4 and 5 open (as of 20 Oct): the supervised paid run, then the n8n unpublish on the owner's approval.
- 21 Oct: `ANTHROPIC_WORKSPACE_ID` set; `/health` reports `anthropicWorkspaceId: true`.
- 22 Oct: Phase 0 merged (PR #84). After a Railway platform outage, the deploy went live at 10:31 (deployment `6ad5631e`).
- 22 Oct: step 4 run (run `ff0aa7e5`, USD 5.00 job ceiling, USD 0.219505 charged for the case that ran; a first attempt's three photo-check calls were also paid, see the run report). Go 1, the image call, review and Go 2 worked; the package held on a 2-px grey halo (FL-4), so no scene. Step 4 is therefore only half done: the scene part waits for Phase 1.2 and 1.3. Step 5 is still open. Report: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md`.

**21 Oct 2026, early:** the photo check ended in `409 analysis_outcome_uncertain` because the Anthropic reader ("05 Second count") was refused on every call. The service now logs each refused provider call with the provider's own words (PR #75), and the model-tests page (arm E) showed the reason: Anthropic 400, "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header". Fix: set `ANTHROPIC_WORKSPACE_ID` (table above) or replace the key with one created inside a workspace. The same key on n8n would have failed the same way. Step 4 resumes once one of the two is done.

## 4. Known differences from n8n (deliberate)

| Difference | Why |
|---|---|
| Request headers that carry credentials (`Authorization`, `X-Midas-Key`, the owner key, cookies) are stored as `<redacted>` | n8n stored them in plain text in waiting executions (seen in executions 677–682 and 1591). No Code node reads request headers |
| The one-off recovery webhooks `a7/approved-blind-recovery` and `a7/approved-package-recovery` are not served | They hard-code run `claude-a7-20261017230527-1i4fxz`, which does not exist in the fresh database. Their nodes stay in the flow untouched |
| No `pairedItem` lineage | No Code node uses it. `$('Node').first()` and `.all()` behave as in n8n |
| Finished runs keep only their status, and on failure the failing node and message | The same as n8n's "save no execution data" setting on these workflows. Waiting runs keep their full state until they continue |
| Files are kept by the service, not in Google Drive | The owner dropped Drive. Links are signed `/files/<id>/view` links, and uploads report a SHA-256 that the flows' existing checks compare |
| Image resizing uses Pillow instead of GraphicsMagick | The files along the A7 package chain are byte-identical to GraphicsMagick's. The only exception is the 2048→1125 resize, which differs by at most 1 level on a few pixels. Masters with alpha or grey use bicubic, because Pillow has no Mitchell filter |
| A run that is active when the service restarts is marked `crashed` | n8n behaved the same on a crash. Waiting runs survive restarts |
| A main-flow run that ends in an error is recorded as a hold on its run row: status `hold`, `hold_reason` "Stopped at <node>: <short reason>" (first line only, links and query secrets removed), plus a "Stopped" trail entry | Phase 1.1 (FL-1, owner's go 22 Oct 2026). n8n left the row on its last status, so the site showed "received" or "Go 1 given" for ever. Set per flow with `holdOnError` in `SETTINGS_PATCHES`, on `a7_main` only. It does not resume the run or resend anything; the execution itself still ends in `error` and `/status` lists it. Only the row this execution wrote (`execution_id`) is changed. A row the flow already put on hold keeps its own reason, and a row at an open gate (`awaiting_*`) is left for the owner |
| A package held only by the background rule (edge rows or a grey halo in a saved JPG or WebP) opens a go 2 decision instead of ending the run | Phase 1.2 (FL-4, owner's go 22 Oct 2026). Run `ff0aa7e5` held on 2 pixels at 249 and could go no further. The choices are approve = deliver as exception (packaging runs again from the same approved master, with no AI and no paid call; the files are delivered as they are and the problem is recorded; the release is `owner_exception` and never catalogue-eligible), repair = a new image (one of the two repairs) and stop. Any other package hold (checksum, size, already packaged, storage) is still a plain hold. The 18 Oct one-off recovery webhooks are untouched: retiring them is a deletion and needs its own go. Set in `PATCHES` (`18a`, `18h`, `18p`, `G2`) |
| The image budget ticket uses the model the registry approved, and job ids other than `owner-<uuid>` are refused at intake | Phase 1.5 (FL-12, FL-2, owner's go 22 Oct 2026). Before, any model but `gemini-nano-banana-2.1` crashed the run at the ticket, and a `client-…` job crashed at its first paid step. To use another model, approve its registry row with ratios, sizes, reference limit and a dated price, **and** change the ledger on the owner site (`lib/a7-budget.mjs`, a site change). Its `CALL_POLICY` for `15g Send to Google` must accept a list of models (today it names one), and `RATES` needs a dated price for the model with the limits the ticket reserves (131,072 input and 32,768 output tokens). Until both are done the reservation is refused and the run holds before any call. Set in `PATCHES` (`Budget_15g_Ticket`, `01 Intent & scope`) |
| The white files keep 76% ± 3 points on the product's longest side, and only a product confirmed whole is fitted | Phase 1.3 (FL-5, owner's go 22 Oct 2026). Before, a cut-off product was scaled onto white and delivered as ready, and a master at about 90% was delivered unchanged. Now `18e3` fits (scales down on a white canvas, no AI) only when the review of that exact image found the product whole (no crop, no disagreement), checks the span after fitting, and holds with a plain reason when the product is cut off, not confirmed whole, or below 73% (it is never enlarged). The tolerance is 3 points by default (`18a`; `04 Settings` `framing.white_delivery_tolerance_pts` may set it). Follow-up (22 Oct): an image approved without a review is judged by the review's own box test on the blind count's box (more than 15 of 1000 from every edge and no "cropped" flag = whole). Set in `PATCHES` (`16b`, `18a`, `18e3`) |
| Scene references above the request size are shrunk in code before the placement call | Phase 1.6 (FL-10, owner's go 22 Oct 2026). Before, a placement whose vendor photo, master, room and Midas photos together passed `max_inline_mb` (`04 Settings`, 14 MB) held with "Resizing is not built", after the room was already paid. Now `19g` first shrinks each reference whose long side is above 2048 px to a 2048 px long side (aspect kept, nothing cropped, JPEG quality 90, transparency laid on white): the room, side photo, Midas photos and approved master (only made smaller) first, the vendor photo only if still needed. Each resize is recorded in `scene.ref_resized` (from/to px and bytes, both checksums), the scene notes and the trail; the new checksums go into the references that `15f` checks. Only if the images are still too large does it drop the master and then hold, before any reservation for the placement. Nothing is resized when the images fit. The resize runs in the engine (`nodes/claude_reference_resize.py`, the Edit Image node's Pillow resize) through a Code-node helper, `this.helpers.midasResizeReference`, that the sidecar asks the engine for (`jsrunner.py` and `runner.mjs` callbacks); n8n has no such helper. The review (16) still compares with the vendor photo as received. Set in `PATCHES` (`19g`) |
| The critic review (16) and the blind count (16x) run at the same time | Speed change 2 (owner, 20 Oct 2026). n8n ran them one after the other: 17 s + 84 s in the first end-to-end run. Each call keeps its own budget reserve and settle; the ledger locks the job's row, so two reservations at once are safe. If one side fails, the other still finishes its call and settlement, then the run stops. Set in `SETTINGS_PATCHES` (`parallelFanOut`) |
| The blind count (16x) asks Gemini for low thinking | Speed change 1. The image already goes with the request, not through Google's file upload. If the model refuses the setting, the request is sent again once with the model's default. Set in `NODE_PATCHES`. **The counts must be compared on the supervised paid run** |
| A plan with only the white master left to check skips the paid plan critic (11c) | Speed change 3. The white master's plan is the studio's fixed plan, written by code; Go 1 shows its plan check as "fixed by the studio". Plans with a scene still go to the critic. Set in `PATCHES` (11b Stylist check) |

## 5. Daily operation

| Task | How |
|---|---|
| Logs | Railway service logs. Messages printed by the JavaScript appear prefixed `js:` |
| Runs at a glance | `GET /status` with the header `Authorization: <A7_BRIDGE_HEADER_VALUE>` (the owner site's `A7_READ_AUTHORIZATION`). It returns runs by status, the active and waiting runs with their age and wait time, and the latest failed or crashed runs with the failing node. It shows no run state, request data or secret. Engine log lines for a failed node end with `[run <id>, <flow>]` |
| A run waiting for go 1 or go 2 | Its row in `executions` has status `waiting` and a `wait_till` time. After 24 hours it continues as n8n did: the verdict node records a hold |
| Catalogue refresh by hand | `midas-a7 run catalogue_refresh` (reads midasfurniture.com, one page per 10 s) |
| Check that every node of every flow has a handler | `midas-a7 check` |
| A flow changes | Change the frozen baseline in `n8n/baseline/` (or, later, the flow package directly). Then run `python tools/n8n_to_flow.py`. CI fails if the packages and baselines differ |

## 6. Rotating a secret

The owner sets and rotates every secret (CLAUDE.md rule 2); nobody else needs to see a value. Changing a Railway variable redeploys the service, and a run that is active at that moment is lost (BE-1). So rotate only when `GET /status` shows no active run, and, for the resume secret, no run waiting at Go 1 or Go 2.

| Secret | Where it must change | What breaks until it matches |
|---|---|---|
| `A7_BRIDGE_HEADER_VALUE` (service) = `A7_READ_AUTHORIZATION` (owner sites) | The service and every owner site that calls it, together (`claude-outputs/claude-midas-a7-owner-workspace/SETTINGS.md`). While `claude-final-midas-a7` still calls n8n, n8n holds the same key | The site cannot reach the service, and the service cannot reach the budget ledger, so every paid call holds |
| `RESUME_SIGNING_SECRET` | The service only | Resume links of runs waiting at Go 1 or Go 2, and file links signed with it (all file links while `FILE_LINK_SECRET` is not set) |
| `FILE_LINK_SECRET` (optional, BE-6 PR A) | The service only | File links made with the old value stop opening. Links signed with `RESUME_SIGNING_SECRET` still open. Resume links are not affected |
| `MIDAS_CLIENT_HEADER_VALUE`, `MIDAS_OWNER_HEADER_VALUE` | The service only (used between the flows inside it, table above) | Nothing outside the service |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | The service only. Revoke the old key at the provider afterwards | Nothing, once the new key is set |
| Postgres credential (Railway security notice) | Follow Railway's notice for the Postgres service. `DATABASE_URL` on the service is a reference (`${{Postgres.DATABASE_URL}}`); how Railway updates it after a rotation was not checked here | If `DATABASE_URL` ends up empty, the service silently starts on a local SQLite file (`config.py` default) and the Postgres runs are not visible. After the redeploy, check that `GET /status` answers and does not report `database: unreachable` |

Still open from the n8n period: n8n executions 677–682 and 1591 hold the old `X-Midas-Key` in plain text. Deleting them needs the owner's go; then rotate that key on n8n.

After any rotation: `GET /health` shows every `configured` flag `true`, and the owner site's connection check reaches the service.

## 7. Reconciling the budget ledger

The ledger lives on the owner site (Netlify, `lib/a7-budget.mjs`). Every paid call reserves first and settles after. A call whose outcome is not known is recorded as `uncertain` (`lib/a7-budget.mjs:104`). It is never sent again (rule 22).

To close an uncertain call:
1. Check the provider's billing for that call, by time and model.
2. Record what was really charged with the owner page's billing reconciliation, signed in as the owner. The page sends `POST /api/owner/budgets/<client run id>` (the `owner-<uuid>` id; `netlify/functions/owner-budget.mjs`, `lib/a7-budget.mjs:125-140`) with the operation key, the charged amount in USD, a note (up to 1,000 characters), a short evidence reference (up to 200 characters), an explicit confirmation and a request id the page generates.
3. The operation becomes `owner_reconciled` with that amount, and an audit row is written. The record says "Owner-reported billing reconciliation; not independently verified by A7."

**Rules:**
- Only an `uncertain` operation can be reconciled (`operation_not_uncertain` otherwise).
- The same request id sent again with the same content is accepted once. The same request id with different content is refused (`reconciliation_conflict`).
- A new request for an operation that is already reconciled is refused (`operation_not_uncertain`), because it is no longer `uncertain`.
- No provider request is ever resent.
- Known gap (FE-20, audit plan): the amount may be set to USD 0, so the evidence field matters.

