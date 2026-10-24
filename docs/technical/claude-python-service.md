# Python service (`src/midas_a7`)

*Technical documentation · checked against commit `2bd6550` (21 Oct 2026). 195 tests pass and `midas-a7 check` reports all node types handled at this commit.*

## How it works

- **Frozen flows.** Each n8n workflow is frozen in `n8n/baseline/<id>.json`. `tools/n8n_to_flow.py` turns it into a package `src/midas_a7/flows/<pkg>/`: `__init__.py` holds `FLOW = {nodes, connections, settings}`, and `code/*.js` holds each Code node byte for byte. Sticky notes are dropped.
- **Allowed changes.** The only deliberate changes are `PATCHES`, `NODE_PATCHES` and `SETTINGS_PATCHES` in `tools/n8n_to_flow.py`, each recorded with a reason in `flows/manifest.json`.
- **Executor** (`engine/executor.py`). Follows n8n v1 order: depth first, Merge waits for its inputs. It honours `alwaysOutputData`, `executeOnce`, `retryOnFail` and `onError`. A Wait node parks the run. One deliberate exception: `parallelFanOut` on `Images ready?`.
- **JavaScript** (`engine/jsrunner.py` with `engine/js/runner.mjs`). A persistent Node process speaks JSON lines and evaluates Code nodes and `={{ }}` expressions, with luxon 3.5.0. `require` allows only `crypto`, `buffer`, `zlib`, `url` and `util`.
- **Node handlers** (`nodes/`):

| Module | Handles |
|---|---|
| `core.py` | code, if, switch, merge, noOp, respondToWebhook, wait, webhook, manualTrigger, scheduleTrigger |
| `http_request.py` | httpRequest. Calls to the old n8n host are routed in process (`SELF_BASE_ALIASES`) |
| `data_table.py` | dataTable row operations |
| `google_drive.py` | folder create, file upload and download, backed by the `files` table (no Google calls) |
| `edit_image.py` | editImage with Pillow |
| `llm.py` | openAi (Responses API), googleGemini, anthropic |

- **Runtime** (`runtime.py`). Starts, parks and resumes runs. It signs resume links and stores credential headers as `<redacted>`. Only waiting runs keep full state; finished runs keep status and the failing node.

## Flows

| Package | n8n id | Nodes (Code) | Webhook |
|---|---|---|---|
| `a7_main` | `1cgZc9rmBOrPdKIe` | 354 (151) | `POST claude-midas-a7`, `POST claude-midas-a7-decision` |
| `owner_bridge` | `Mo9c5GmTcx0K79F7` | 14 (5) | `GET a7/owner-context`, `POST a7/owner-submit`, `POST a7/owner-decision` |
| `owner_read` | `G4cLxmwbkCxmCbQF` | 6 (2) | `GET a7/owner-read` |
| `owner_analysis` | `AOTL7OVYtXLLs1L1` | 5 (2) | `POST a7/owner-analyze` |
| `analysis_only` | `AMdtt1fFwHln4DB8` | 46 (23) | `POST claude-midas-a7-analysis` |
| `model_tests` | `jYkKQ2NOreSG0t97` | 13 (3) | `POST a7/model-test` |
| `catalogue_refresh` | `mGgKxO0638I77meF` | 19 (4) | none: schedule, or `midas-a7 run catalogue_refresh` |

**Patches in force** (`flows/manifest.json`):
- The owner bridge accepts the service's signed links instead of Drive links.
- Speed change 1: `16x Blind count` thinking level set to `low`.
- Speed change 2: review and blind count run in parallel.
- Speed change 3: the paid plan critic is skipped when only white-master plans remain.

## HTTP API (`app.py`)

| Route | Purpose |
|---|---|
| `GET /health` | Status, flow versions, webhooks, which credentials are set (booleans only) |
| `GET /status` | Authenticated with `Authorization: <A7_BRIDGE_HEADER_VALUE>`. Runs by status, active and waiting runs with their age, the latest failed or crashed runs with the failing node. No run state, request data or secret (22 Oct 2026) |
| `ANY /webhook/{path}` | Runs the flow registered for method and path; header auth; 413 over 64 MB; 404 if not registered |
| `GET\|POST /webhook-waiting/{execution_id}?signature=` | Resumes a run parked at Go 1 or Go 2: 401 bad signature, 404 unknown run, 409 not waiting |
| `GET /files/{file_id}/view?sig=` | Serves a stored file with a valid HMAC signature; `Cache-Control: private, no-store` |

A 30-second scheduler loop resumes timed-out waits. It also fires schedule triggers when `SCHEDULES_ENABLED=true` (currently off).

## CLI (`midas-a7`)

`serve` (uvicorn on `$PORT`, default 8080) · `check` (every node kind has a handler) · `seed` (reference tables) · `run <package>` (manual trigger; only `catalogue_refresh` has one)

## Storage (`store.py`)

SQLite by default and Postgres in production. Tables:

| Table | Holds |
|---|---|
| `executions` | Parked and finished runs |
| `binaries` | Files of live runs |
| `files` | Stored outputs, replacing Drive |
| `dt_rows` | The seven n8n data tables |

On first start the service seeds the model registry (2 rows), handling profiles (44) and the catalogue (428).

## Configuration (names only)

| Group | Variables |
|---|---|
| Service | `DATABASE_URL`, `PUBLIC_BASE_URL`, `SELF_BASE_ALIASES`, `RESUME_SIGNING_SECRET`, `FILE_LINK_SECRET` (optional), `SCHEDULES_ENABLED`, `DATA_TABLES_PATH`, `SEEDS_DIR`, `PORT`, `LOG_LEVEL`, `MIDAS_NODE_BIN` |
| Header auth | `A7_BRIDGE_HEADER_NAME/VALUE`, `MIDAS_CLIENT_HEADER_NAME/VALUE`, `MIDAS_OWNER_HEADER_NAME/VALUE` |
| Providers | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` |

If `RESUME_SIGNING_SECRET` is unset, a random secret is generated, and resume links stop working after a restart, and file links too unless `FILE_LINK_SECRET` is set. If `FILE_LINK_SECRET` is set, new file links are signed with it and the view also accepts links signed with `RESUME_SIGNING_SECRET`, so links made before the variable was set keep opening; `/health` reports `configured.fileLinkSecret` (true/false only). Expiring links and a cut-off for old links are BE-6 PR B and C (`claude-outputs/claude-midas-a7-be-6-file-links-proposal-2026-10-22.md`). `ANTHROPIC_WORKSPACE_ID` is required when the Anthropic key was created at organisation level (seen 21 Oct 2026).

## Deliberate differences from n8n (runbook §4)

- Credential headers are stored redacted.
- The two recovery webhooks are not served.
- There is no `pairedItem`.
- Finished runs keep status only.
- Runs active at a restart are marked `crashed`.
- A main-flow run that ends in an error is recorded as a hold on its run row, naming the step (`holdOnError` on `a7_main`, Phase 1.1). The row's status is `hold`, its reason is "Stopped at <node>: <short reason>", and a "Stopped" trail entry is added. The execution still ends in `error`. Code: `Runtime._hold_on_error` in `src/midas_a7/runtime.py`.
- A package held only by the background rule opens a go 2 decision (deliver as exception, repair, stop) instead of ending the run (Phase 1.2, FL-4). This is a flow change, made as patches to `18a`, `18h`, `18p` and `G2` in `tools/n8n_to_flow.py`.
- Pillow replaces GraphicsMagick: the 2048→1125 resize differs by at most 1 level on a few pixels.
- Speed changes 1–3 (above).

## Deliberately unsupported (raise "not supported by this engine")

- HTTP pagination and other auth types.
- OpenAI built-in tools and background mode.
- Gemini image analysis from URLs.
- Anthropic attachments.
- Data-table resources other than rows.
- Drive operations beyond folder create and file upload/download.

None of these are used by the current flows. Pagination use was checked; the others are inferred unused.

## Known issues

- **Supervised paid run blocked (21 Oct 2026).** The photo check ended `409 analysis_outcome_uncertain`: Anthropic refused every call because the key is not scoped to a workspace. Fix: set `ANTHROPIC_WORKSPACE_ID`, or use a key created inside a workspace.
- **Speed change 1 not measured.** Its effect on blind-count accuracy has not been checked on a paid run.
- **Old n8n host still in the flows.** `owner_bridge`, `owner_analysis` and the budget code nodes still name `ibrahimnewaeon.app.n8n.cloud`. They work only because `SELF_BASE_ALIASES` routes that host in process.
- **Stale a7-engine README.** `services/a7-engine/README.md` describes a switch variable `A7_ANALYSIS_BASE_URL` that no site code uses.
