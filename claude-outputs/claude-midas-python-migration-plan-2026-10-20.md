# Midas A7: plan to move everything into one Python project (no n8n)

20 Oct 2026. Plan only. Nothing is built, deployed, published or unpublished by this document.

**Revised 20 Oct after the owner's input:**
1. Treat the n8n flow as brand new. No run history, ledger or file data is moved (section 4).
2. A faster route that is mostly Python, not fully Python, is added as section 10 and is recommended to do first.

| Route | What it is | Estimate (working days, incl. 25% buffer) |
|---|---|---|
| **Fast track (section 10)** | A Python service replaces n8n completely. It runs the existing A7 JavaScript logic files unchanged. The Netlify owner site and its budget ledger stay as they are. | about **24–34** |
| Full Python (sections 2–6) | Every piece of logic is ported to Python, and the Netlify server code moves too. | about **43–56** |

The fast track is also the first half of the full route: each JS file can later be swapped for a Python port, one at a time, behind the same call.

## 0. Baselines this plan ports

| What | n8n id | Version to port | State on 20 Oct 2026 |
|---|---|---|---|
| Claude · Midas A7 (stages 01–07) | `1cgZc9rmBOrPdKIe` | `4669b0d7` | Published; it is also the latest saved version |
| A7 · Owner submission and approval bridge | `Mo9c5GmTcx0K79F7` | `b41c6e1d` | Published; it is also the latest saved version |
| Repo | `main` | `b443142` (merge of PR #62) | CI green |

Supporting production workflows (published) that must also move:

- `G4cLxmwbkCxmCbQF` Owner status and history (read only)
- `AOTL7OVYtXLLs1L1` Owner source analysis bridge
- `AMdtt1fFwHln4DB8` Source analysis only
- `jYkKQ2NOreSG0t97` Model tests per stage
- `mGgKxO0638I77meF` Catalogue refresh. It is not published but is needed: it is the only thing that keeps the catalogue current.

### Sources

Everything below comes from three read-only surveys done on 20 Oct 2026:
- the live A7 workflow, read from n8n;
- every other workflow, the data tables and the credentials on the instance;
- this repo, including a run of every test suite.

Nothing in n8n was run or changed.

## 1. What exists today (verified)

### 1.1 The main A7 workflow

**Size and settings.**
- 362 nodes:

  | Count | Node type |
  |---|---|
  | 151 | Code (all JavaScript, ~10,000 lines) |
  | 88 | IF |
  | 41 | HTTP Request |
  | 25 | Data Table |
  | 13 | Google Drive |
  | 9 | Edit Image |
  | 4 | Webhook |
  | 3 | Wait |
  | 3 each | Gemini, Anthropic |
  | 4 | OpenAI |
  | 2 each | Merge, NoOp |
  | 8 | Sticky note |

- No error workflow.
- No sub-workflows.
- Executions are not saved. A finished run therefore leaves no execution record; only the data tables keep its history.

**Design.** A7 is already a state machine. Every branch ends in `V1 Vault events → Update run row → V2 → V3 Save to vault`. A chain of IF routers reads the new status and starts the next phase. This shape ports directly to a Python state machine.

**Entry points.**

| Method | Path | What it is |
|---|---|---|
| POST | `/webhook/claude-midas-a7` | Job intake (`X-Midas-Key`) |
| POST | `/webhook/claude-midas-a7-decision` | Go 1 / Go 2 answers |
| POST | `a7/approved-blind-recovery` | One-off recovery; the run id is hard-coded |
| POST | `a7/approved-package-recovery` | One-off recovery; the run id is hard-coded |

The pauses are `Wait for go 1` and `Wait for go 2`: an n8n resume URL with a 24-hour limit. There is also a polling loop for the image call (`15j Wait`, 15 s × up to 20 polls).

**Models.**

| Stage | Model |
|---|---|
| 03 Eye, 06 Room, 16x Blind | Gemini `gemini-3.8-flash` |
| 05 Second count, 11c Plan critic, 16 Critic | Anthropic `claude-sonnet-5-5` |
| 09 Conflict check | OpenAI `gpt-6-luna` |
| 11 Stylist, plus fallbacks 03b, 06b, 16xb | OpenAI `gpt-6.1-sol` |
| Image | `gemini-nano-banana-2.1` (Google Interactions API, from the model-registry table) |

**State: 7 n8n data tables.**

| Table | id | Rows |
|---|---|---|
| runs | `l0roUCBwIQL3h9Eq` | 59 |
| vault | `Tyn4UT6BmIYMHAYl` | 725 |
| operations | `cw86pzlOSjKSrU01` | 12 |
| identity | `OpszBn1IWmYzWftI` | 4 |
| catalogue | `lwJbRv4TVqlFTILl` | 428 |
| handling profiles v2 | `AgXKkFbIj5dQAnvn` | 44 |
| model registry | `eso9cF84jXYIGu5S` | 2 |

**Budget.** Every one of the 12 paid model calls runs inside an 8-node pattern: Ticket → Reserve → Permit → call → Receipt → Settle. The ledger itself is not in n8n. It lives in the Netlify owner site (`/api/a7/budget/*`, backed by Postgres).

**Repo copy.**
- `n8n/claude-midas-a7/live/workflow-1cgZc9rmBOrPdKIe.json` matches the live workflow node for node (362 nodes). Only `versionId` and `settings` differ.
- The repo README says 361 nodes; it should say 362.
- `code-nodes/` holds only the 58 baseline Code nodes (5,369 lines). The other 93 guard nodes come from `budget-guards/*.mjs`. A port must therefore cover about 10,700 lines of JavaScript, not 5,400.

### 1.2 The bridges

The submission bridge `Mo9c` (`b41c6e1d`) has 14 nodes and three endpoints:
- `GET a7/owner-context`: a safe view of the approval. It computes the `revision` hash, the `allowed[]` decisions and the 24-hour ticket expiry.
- `POST a7/owner-submit`: checks the multipart upload (1–12 files, at most 3 MiB each, at most 14 MiB in total, exactly one product photo), then forwards it to the A7 intake.
- `POST a7/owner-decision`: checks the answer, then forwards it to the A7 decision webhook.

The other bridges:
- `G4cL` is a read-only projection of the runs table.
- `AOTL` and `AMdtt` are the source-analysis path: readers 03, 05, 06 and 09 under the budget guard.
- `jYkK` is the per-stage model test (arms A–E).

All of them are thin layers of validation and projection. In a single project they become ordinary function calls; the multipart hop and the header-key hop between n8n workflows disappear.

### 1.3 The owner site (Netlify)

**Code.** 19 functions (about 816 lines) and about 40 `lib/` modules (about 2,100 lines).

**Netlify services used.**
- Netlify Identity: the owner role.
- Netlify Database (Postgres):

  | Area | Tables |
  |---|---|
  | Budget ledger | `a7_owner_budgets`, `a7_paid_operations`, `a7_budget_audit` |
  | Projects and cases | `a7_projects`, `a7_cases`, `a7_case_ref_counters` |
  | Job versions | `a7_job_versions`, `a7_version_references` |
  | Results | `a7_result_assets` |

- Netlify Blobs: source photos, claims, answer checkpoints and model-test runs.

**Calls in both directions.** The site calls n8n through hard-coded URLs, and n8n calls back into the site's budget API.

### 1.4 Python that already exists

**`services/a7-engine/`** is FastAPI.
- It ports the source-analysis path (03, 05, 06, 09 under the budget guard).
- `pytest`: **100 passed**, run on 20 Oct.
- Not deployed. The owner paused it on 19 Oct; the review page lists five open questions about the Python/Railway engine.
- Its own README lists gaps:
  - no fallback readers;
  - no recovery paths;
  - request shapes, `requestSha256` byte parity and the real budget API have not been checked against n8n;
  - `budgetLimitUsd` is capped at 5, but the site allows 10.

**`claude-outputs/claude-midas-stylist-skill/`** is the Python twin of `11b Stylist check`.
- Pydantic schema plus a rule engine.
- 25 tests, plus a 10,000-case parity test against the JS version.

### 1.5 The behaviour specification we already have

About 890 JS tests run the real Code nodes with mocked `$()` and `$input`, on pinned data with no network:

| Suites | Tests | Status |
|---|---|---|
| guidance, release, instructions, fidelity, prompt-fixes, phase-1, budget, stage-06, edit-phase-2 | 399 | In CI, all passing |
| phase-1b | 55 | Not in CI; **1 failing** |
| stage-05 | 58 | Not in CI; **1 failing** |
| stage-07, scene-files, views-framing, fallback, facet-rules, catalogue, reader tests, mt4 | 380 | Not in CI; passing (the catalogue parser tests were skipped) |

There are also 40 Python catalogue-audit tests, all passing.

The owner-site tests (`node --test`) gave 204 passed and 19 failed. That run was done without `npm ci`, so the failures are probably missing dependencies; this is not confirmed.

These suites are the acceptance tests for the Python port.

### 1.6 Problems found during the survey (fix whatever the plan)

1. **Secret in stored executions.** Executions 677–682 (18 Oct) hold the `X-Midas-Key` value in plain text.
   - Rotate the key.
   - Delete those executions.
   - The review page already lists "rotate `X-Midas-Key`" as open.
2. **Hard-coded recovery triggers.** `Blind · Webhook` and `Package · Webhook` hard-code run `claude-a7-20261017230527-1i4fxz` and are still live. They should not be ported; they should be removed.
3. **Legacy workflows still active.**
   - Pipeline 3 (`LCkfLFMQS5MjA5FQ`) points at a deleted credential.
   - White clean-up (`MSU2K5WKKfizCapW`) is still active.
   - Both are already marked "switch off" in the review.
4. **Failing tests outside CI.** Two tests fail in suites CI does not run (phase-1b, stage-05).
5. **Orphan nodes.** Three nodes have no input:
   - `Budget · 15g · Check actual call`
   - `Budget · 15g · Call skipped`
   - `Recovery · Cached count`

## 2. Target: one Python project

### 2.1 Principle

All pipeline logic, state, scheduling, approvals and budget control live in this repo as Python. They run as one service with one database.

Two things stay non-Python:
- **The browser pages.** Browsers run JavaScript. They become static files served by the Python app.
- **The external APIs.** Google, OpenAI, Anthropic, Google Drive and the Midas website stay external services, called from Python.

### 2.2 Recommended stack

- **Language and web:** Python 3.12, FastAPI, Pydantic v2, uvicorn. This is the same base as `a7-engine`.
- **Database:** PostgreSQL 16 through SQLAlchemy 2 and Alembic migrations, with psycopg 3. One database replaces 7 n8n tables, 9 Netlify tables and the Netlify Blobs metadata.
- **Run engine:** a state machine written in our own code, with a job queue in Postgres (`SELECT … FOR UPDATE SKIP LOCKED`) and an asyncio worker.
  - No Temporal, Prefect or Celery: the user asked for no workflows outside the code.
  - This matches A7's own design (decision of 14 Oct: "code decides each next stage").
- **Model calls:** `httpx` against the REST APIs, as `a7-engine` already does. This gives exact control of the request bytes for `requestSha256`, and the same fake-provider tests.
- **Images:** Pillow and numpy. They replace the Edit Image nodes and the raw BMP pixel work in `18e3 Clean background`.
- **Drive:** Google Drive v3 REST through `httpx`, with an OAuth refresh token or a service account (decision D5).
- **Schedules:** CLI commands (`python -m midas_a7.jobs.catalogue_refresh`), run by the host's cron.
  - The cron entry is kept in `railway.json` (or the host's equivalent) in this repo.
  - The schedule is Saturday 04:00 Amman, as now.
- **Quality checks:** pytest, ruff, mypy (strict for `domain/` and `budget/`). CI runs them on GitHub Actions.
- **Hosting:** Railway, with one web service, one worker service and Railway Postgres. This is already prepared in `services/a7-engine/railway.json`, and the Railway connector is available. Monthly cost has not been checked.

### 2.3 Repository layout (proposed)

```
pyproject.toml                    # one project; replaces services/a7-engine/pyproject.toml
src/midas_a7/
  config.py                       # env settings + the "04 Settings" constants
  domain/                         # Pydantic models: Brief, Observation, Contract, Plan, Run, Operation, Ticket
  api/
    intake.py                     # replaces webhook claude-midas-a7 (202 then background run)
    decisions.py                  # replaces claude-midas-a7-decision
    owner.py                      # replaces Mo9c (context/submit/decision) and G4cL (read)
    analysis.py                   # replaces AOTL + AMdtt
    model_tests.py                # replaces jYkK
    site.py                       # replaces the Netlify functions (projects, cases, versions, results)
    health.py
  engine/
    machine.py                    # status → step table, single source of transitions
    worker.py                     # Postgres queue, one step per transaction, lease + heartbeat
    gates.py                      # Go 1 / Go 2 tickets, allowed[], revision hash, 24 h expiry
    sweeper.py                    # expires gates to `hold`, retries stuck leases
  stages/
    s01_intake.py                 # 01 Intent & scope, 02 Ingest files
    s01_readers.py                # 03/03b Eye, 05 Second count, 06/06b Room, 04-06 Evidence, source continuation
    s02_scope.py                  # 07 Route, 08 Locks and freedoms, 09 Conflict check, 09b Contract
    s03_style.py                  # 10 Retrieve, 11 Stylist, 11b check, 11c critic, 11d verdict, 12 lead
    s04_image.py                  # 13 Compile, 14 Choose model, 15a–15q dispatch, poll, receipt, Drive
    s05_review.py                 # 16 Critic, 16x/16xb Blind count, 16a/16b verdict
    s06_package.py                # 18a–18p package, identity entry
    s07_scenes.py                 # 19a–19g scenes, 20a–20m scene files
    edit_base.py                  # E1, E1b, E2
    recovery.py                   # reader recovery, replacement checkpoint (generic, no hard-coded ids)
  budget/                         # reserve, permit, receipt, settle, rates, call policy (port of lib/a7-budget.mjs)
  providers/                      # gemini.py, gemini_images.py, openai_responses.py, anthropic.py, fake.py
  integrations/                   # drive.py, midas_site.py (10 s throttle, robots rules), blobs.py
  imaging/                        # resize, jpg/webp encode, clean background, framing checks
  prompts/                        # every prompt as a versioned .txt; hash-checked in tests
  db/                             # SQLAlchemy models + alembic/
  jobs/                           # catalogue_refresh.py, seed_reference.py, reconcile_ledger.py
  cli.py                          # `midas replay <run>`, `midas run-step`, `midas seed`
web/                              # owner site static pages (moved from claude-outputs/…owner-workspace)
tests/
  unit/  stages/  api/  budget/  imaging/
  parity/                         # runs the original JS node and the Python port on the same fixtures
  fixtures/                       # pinned inputs/outputs from the JS suites and real runs
tools/parity/                     # Node harness for parity (dev only; deleted after cutover)
```

The current `services/a7-engine/app/*` and the stylist-skill engine move into `src/midas_a7/` with their tests. Nothing is thrown away.

### 2.4 How each n8n mechanism maps to Python

| n8n mechanism | Python replacement |
|---|---|
| Webhook + "Respond, then continue" (202) | FastAPI route writes the run row, enqueues step 1 and returns 202 |
| Wait node + `$execution.resumeUrl` (Go 1 / Go 2, 24 h) | Run status `awaiting_go_1/2`, plus a ticket row (token, round, contract stamp, `expires_at`). The decision API checks the ticket and enqueues the next step. The sweeper moves an expired ticket to `hold` |
| `15j Wait` poll loop | A step that re-enqueues itself with `run_after = now + 15 s`, at most 20 times |
| IF routers on `V1.status` | One transition table in `engine/machine.py` |
| `V1 → Update run row → V3 Save to vault` | One transaction per step: update `runs` and append to `vault_events` |
| `$('Node').first()` cross-references | Typed fields on the run's state object (Pydantic), saved as JSONB |
| Data Table nodes | SQLAlchemy tables (section 4) |
| Binary items, `binaryMode: separate` | Bytes in object storage (Postgres `bytea` or an S3 bucket); rows keep the sha256 and storage key |
| Edit Image nodes, BMP read-back | Pillow, with numpy for `18e3` |
| LangChain Gemini, OpenAI and Anthropic nodes | `providers/*` on `httpx`; the existing `a7-engine` clients are the start |
| `retryOnFail` (2 tries, 5 s) on model nodes | An explicit retry inside the same budget reservation, as in `a7-engine`; never a new reservation |
| Header Auth credentials | Env secrets checked with `hmac.compare_digest` |
| Netlify budget API called by n8n | An in-process `budget` module on the same database. No HTTP hop, no `budgetOrigin` routing |
| Schedule trigger (catalogue) | A cron-run CLI command |

## 3. Rules that must not change

These carry over byte-for-byte or rule-for-rule, each with a test:

1. **Budget.**
   - Every paid call reserves first, using a v4 permit with `reservedMicroUsd > 0`.
   - `operationKey = "a7:" + sha256(canonical(slot))`.
   - An uncertain result **holds** the run and is never resent (`automatic_resend: false`).
   - Job ceiling: USD 0.25–10.00.
   - At most 20 image calls per UTC day.
   - Rates and their expiry dates are taken from `lib/a7-budget.mjs`.
2. **Go 1.** go / change / stop. At most 3 change rounds, at most 5 ignored answers.
3. **Go 2.** approve / repair / stop / review_again / approve_unreviewed.
   - At most 2 repairs per image.
   - `auto_repair = false`.
   - One Go 2 per scene.
   - The ticket expires after 24 hours.
   - `allowed[]` is filtered exactly as in `Mo9c`.
   - A `revision` hash protects against stale decisions.
4. **Intake limits.**
   - 1–12 files, at most 3 MiB each.
   - Total at most 14 MiB for a submission and 36 MiB for an analysis.
   - Exactly 1 product photo, at most 1 room photo.
   - File roles follow `roleOf`.
   - The analysis path requires a SHA-256 match on the source photo.
5. **Contract.** The canonical JSON and its sha256 stamp (`09b`) must give **identical stamps** for identical inputs. This is the strongest parity check available.
6. **Output.**
   - White package: master, then 1125×1125 jpg q95 (q100 if needed) plus webp, and a manifest.
   - Scenes: short side 1125, jpg q92 plus webp.
   - The master stays in the vault.
7. **Midas site reads.** One page per 10 s, and no query strings (`robots.txt`).
8. **Owner views.** Responses stay safe: URLs, tokens and resume URLs are redacted, and `Cache-Control: no-store` is set.

## 4. Data model (fresh start, no migration)

On the owner's instruction, the system starts empty. No run history, vault events, image operations, identities, ledger rows or stored files are moved from n8n or Netlify. The n8n tables are only used to read their **column shape**.

**Run tables, created empty:**

| Table | Shape taken from | Replaces |
|---|---|---|
| `runs` | n8n `l0roUCBwIQL3h9Eq` | |
| `vault_events` | n8n `Tyn4UT6BmIYMHAYl` | |
| `image_operations` | n8n `cw86pzlOSjKSrU01` | |
| `identities` | n8n `OpszBn1IWmYzWftI` | |
| `gate_tickets` | new | `resume_url`, `go*_token` and the vault ticket rows |
| `job_queue` | new | |

In the full Python route only, these are also created empty:
- the ledger tables;
- the project, case and version tables;
- `blobs`.

**Reference data, loaded at install.** This is configuration the pipeline cannot run without, not migrated history:

| Data | Rows | Loaded from |
|---|---|---|
| Model registry | 2 | `seeds/model_registry.json` (the two current rows; prices dated 2026-10-14) |
| Handling profiles v2 | 44 | `n8n/claude-midas-a7/data/claude-a7-handling-profiles-v2.json` |
| Catalogue | 428 | The catalogue refresh job's first run. The repo snapshot `data/claude-midas-catalogue-snapshot-2026-10-16.json` can be used instead, if the owner prefers it to a fresh read |

## 5. Parity method (how we prove the Python behaves the same)

1. **Port the tests first.** For each stage, convert its JS suite into pytest, using the same fixtures and the same expected outputs. A stage is not "ported" until every case passes.
2. **Differential tests.** `tools/parity/` runs the original JS Code node in Node, using the existing `AsyncFunction` harness, and the Python function on the same inputs, then compares the outputs.
   - Generated cases are used where the logic is pure: 18e3 pixel maths, 19a scene ticket, 13 Compile prompt text.
   - The stylist skill already does this with 10,000 cases.
3. **Replay real runs.** Re-run the stored inputs of real runs through the Python stages with the fake provider, which returns the recorded model answers.
   - Runs: `claude-a7-4f80c2bf` (first end-to-end run) and execution 1591 (waiting at Go 1).
   - The contract stamps, prompts sent and plan verdicts must match.
4. **Paid checks only with the owner's go.** One bounded live run per stage group, with a USD cap per run (proposed USD 3.00, the Phase 4 cap) and a total cap for the whole migration (proposed USD 15.00).
   - Reference cost: run `4f80c2bf` cost about USD 0.16 in total.

## 6. Phases

Effort is an estimate in working days, assuming one engineer working with Claude. It includes porting tests. **It is not a commitment.** A 25% buffer is added at the end.

### Phase 0: freeze and clean up (1–2 days)

- Export A7 `4669b0d7` and bridge `b41c6e1d` into the repo as the frozen port baseline, with checksums.
  - Also export `G4cL`, `AOTL`, `AMdtt`, `jYkK` and `mGgK`.
  - Pin the owner-site commit.
- Security:
  - Rotate `X-Midas-Key`.
  - Delete executions 677–682.
  - Remove the two hard-coded recovery webhooks (with the owner's approval).
- Fix the 2 failing tests and add all JS suites to CI, so the specification is green before porting.
- Freeze rule: from this point, any change to the live n8n A7 workflow must also update the baseline export and its tests. Without this, the port chases a moving target.
- **Exit:** all JS suites green in CI; baselines committed.

### Phase 1: the project skeleton (4–5 days)

- `pyproject.toml` at the repo root, plus `src/midas_a7/`.
- Move `a7-engine` and the stylist engine in; their 125 tests stay green.
- Postgres schema and Alembic migrations (section 4).
- Config: env settings plus the `04 Settings` constants.
- Engine: queue, worker, transition table, sweeper.
- Providers: Gemini, Gemini images (Interactions), OpenAI Responses, Anthropic, and the fake provider.
- Drive and Midas-site clients.
- **Budget module.** Port `lib/a7-budget.mjs`, together with its 17 test files and the site's contract tests. It runs in-process.
- CI: ruff, mypy, pytest. Docker image builds.
- **Exit:** a fake run passes through an empty state machine end to end; budget tests at parity with the JS ledger.

### Phase 2: source analysis, completed (2–3 days)

- Add the fallback readers 03b and 06b, reader recovery and source continuation.
- Raise the `budgetLimitUsd` cap to 10.
- **Exit:** AOTL and AMdtt behaviour covered, plus one paid analysis run under the owner's go.

### Phase 3: stages 01–02 and 03 with Go 1 (5–6 days)

- Port `01 Intent & scope`, `02 Ingest files`, `04-06 Evidence`, `07 Route`, `08 Locks`, `09`/`09b Contract`, `10 Retrieve`, `11`/`11b`/`11c`/`11d`, `12`, and the gate logic for Go 1.
- Acceptance suites: instructions, fidelity, phase-1, phase-1b, prompt-fixes.
- **Exit:** replaying run 1591 reaches `awaiting_go_1` with an identical contract stamp and identical plan verdict.

### Phase 4: image generation, stage 04 (3–4 days)

- Port `13 Compile`, `14 Choose model`, and `15a`–`15q`: dispatch guard, request build, polling loop, receipts, Drive upload. Also the daily limit and the image budget.
- Acceptance suites: views-framing, release, guidance.
- **Exit:** the prompts are byte-equal to the n8n `13 Compile` output for the replayed runs; one paid white master under the owner's go.

### Phase 5: review and Go 2, stage 05 (3–4 days)

- Port `16`, `16x`/`16xb`, `16a`, `16b`, the Go 2 verdict, repairs, review again, and approve unreviewed.
- Acceptance suites: stage-05, fallback.
- **Exit:** the review verdicts on replayed runs match.

### Phase 6: package and scenes, stages 06–07 and edit base (7–9 days)

- Port `18a`–`18p`, including the `18e3` pixel work and the framing hold, and `19a`–`19g` with the live stock check. Also `20a`–`20m`, the edit base (`E1`/`E2`) and scenes from an approved white image.
- Acceptance suites: stage-06, stage-07, scene-files, edit-phase-2.
- **Exit:** package files are byte-identical, or within a stated pixel tolerance where the encoders differ (Pillow vs GraphicsMagick). The tolerance must be agreed with the owner. Then one paid scene under the owner's go. Room scenes have never been delivered, so this is new ground and not only a port.

### Phase 7: owner API and site (6–8 days)

- Port the bridges: `Mo9c` (context, submit, decision), `G4cL`, `jYkK`.
- Port the 19 Netlify functions: projects, cases, versions, results, background analysis, model tests.
- Move the static pages to `web/`, served by FastAPI.
- Replace Netlify Identity (decision D4).
- **Exit:** the owner-site test suite, ported to pytest plus a browser check, passes against the Python API.

### Phase 8: switch (2–3 days)

1. Load the reference data (section 4).
2. Point the owner site at the Python API.
3. Unpublish the n8n workflows, with the owner's approval. Nothing is imported or drained: the flow is treated as new.
4. Run one supervised paid end-to-end job: white package plus one scene, with both Go gates.

Rollback for 14 days: n8n stays saved but unpublished. Switching back means republishing it and pointing the site back.

### Phase 9: decommission (1 day, after 14 calm days)

- Unpublish, then archive, all A7 workflows: `1cgZ`, `Mo9c`, `G4cL`, `AOTL`, `AMdtt`, `jYkK`, `mGgK`, `GConR`, and every A7 test/scratch workflow listed in the survey.
- Switch off legacy `LCkf` and `MSU2`.
- Remove the n8n credentials, `n8n/`, the JS Code-node tests and the Netlify functions from the repo, keeping a dated archive tag.
- **Out of scope; will not be touched:** "Competitor Intelligence" (`PS3VCZ8zpiTFm57d`, `t5E45gcKKTzsj9Wc`, Supabase) is a separate project, and the third-party templates are not Midas work.

### Total effort

| | Working days |
|---|---|
| Phases 0–9 | 34–45 |
| With 25% buffer | about **43–56** |

## 7. Definition of done

- `grep -r "n8n.cloud\|/webhook/" src web` returns nothing, and no request leaves the system for n8n.
- All A7 n8n workflows are unpublished, and the owner has confirmed.
- Every JS test case has a passing pytest equivalent. CI runs only Python, plus the browser check of the static site.
- The budget ledger reconciles exactly: reserved, settled and uncertain totals per job match the provider usage records for the supervised runs.
- The supervised paid run (white package plus one scene, both Go gates) is approved by the owner.
- The runbook in the repo covers deploy, rollback, key rotation, catalogue refresh and ledger reconciliation.

## 8. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Live n8n keeps changing during the port | Python behaviour lags | Freeze rule in Phase 0; each n8n change updates the baseline and its tests |
| Pillow output differs from GraphicsMagick | Package files not byte-identical | Decide the tolerance with the owner before Phase 6; checksums are recorded fresh after cutover |
| Request shapes differ from the n8n LangChain nodes | Model answers drift | Record real request bodies in a bounded paid check per provider; prompts are hash-checked |
| Losing the n8n "respond, then keep running" behaviour on a host with request time limits | Long runs cut off | Runs never execute inside a request; the worker owns them |
| Drive auth moves from n8n OAuth | Uploads fail | Decision D5; test against the private owner folder before Phase 4 |
| Two owner sites today | Ledger split (`budgetOrigin`) | One site after Phase 7; this resolves the open "choose one owner site" item |
| Owner paused the Python engine on 19 Oct | Work starts without agreement | Decision D1 below |

## 9. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Resume the paused Python engine and adopt this plan, answering the five open questions from 19 Oct as part of Phase 0 | Yes |
| D2 | Bring the Netlify server functions and the budget ledger into Python too, not only n8n | Yes. Otherwise state stays split and "everything in Python" is not met |
| D3 | Hosting | Railway: web, worker and Postgres |
| D4 | Owner login after Netlify Identity | Short term: verify Netlify Identity tokens in Python. Final: a single-owner login with a passkey or emailed link |
| D5 | Drive access | A service account with the two output folders shared to it. No personal refresh token kept on the server |
| D6 | Cutover style | Settled by the owner: fresh start, no data moved. The switch is a URL change on the owner site |
| D7 | Paid test budget for the migration | USD 3.00 per run, USD 15.00 in total, each run with the owner's go |
| D8 | Pixel tolerance for package files | Set before Phase 6 |

## 10. Fast track: Python runs everything, the existing JS logic is reused (recommended first)

### 10.1 Idea

Most of A7's 362 nodes are not logic. They are routing (88 IF nodes), data-table reads and writes (25), HTTP and model calls (51), Drive steps (13), image edits (9), waits (3) and webhooks (4). The logic itself sits in 151 Code nodes, about 10,700 lines of JavaScript, and about 890 JS tests already check it.

The fast track splits that work:

- **Python replaces only the n8n part:** triggers, routing, waits, tables, calls, Drive and image edits.
- **The Code-node files are copied byte for byte from the frozen baseline** (A7 `4669b0d7` and the bridge `b41c6e1d`) into the repo. Python runs them through a small Node runner. The runner is the same `AsyncFunction` harness the test suites already use: it mocks `$('Node')`, `$input`, `require('crypto')`, `getBinaryDataBuffer` and `prepareBinaryData`.

The result:
- n8n is gone entirely.
- Nothing runs outside this repo.
- The logic is exactly what was tested and approved.

**As built (20 Oct, after the owner chose this route).** The routing is not hand-written.
- `tools/n8n_to_flow.py` turns each frozen workflow into a committed Python flow package. The package holds the nodes and connections as Python data, and each Code node's JS as its own file.
- A small engine runs that graph in n8n's own execution order.
- This needed far less new logic than a hand-made transition table, and it can be proved: run 1591 replays node by node with outputs identical to n8n's.

Operating details are in `claude-midas-a7-python-service-runbook-2026-10-20.md`.

### 10.2 What stays and what changes

| Piece | Fast track |
|---|---|
| n8n A7 and the 5 bridges | Replaced by one Python service (FastAPI app plus a worker) on Railway with its own Postgres, created empty |
| Code-node logic (151 nodes) | Reused as `.js` files in `src/midas_a7/nodes/`, run by a long-lived Node process that Python calls |
| IF routing and the `V1 → V3` vault chain | A Python transition table. A first draft is generated from the baseline workflow's `connections`, then checked by hand |
| Go 1 / Go 2 waits, 24-hour expiry | Status plus a ticket row plus a sweeper, as in section 2.4 |
| Model calls | Python `httpx` clients. The analysis path reuses `services/a7-engine` (100 tests passing) |
| Image call and polling | A Python step that re-enqueues itself every 15 s, at most 20 times |
| Drive, Midas pages, 9 Edit Image nodes | Python: Drive REST, a throttled page reader, Pillow |
| Budget ledger | **Unchanged.** Python calls the same Netlify `/api/a7/budget/*` endpoints, with the same header and payloads that n8n sends today |
| Owner site (Netlify) | **Unchanged, except one setting.** Its n8n webhook URLs are hard-coded; they become one environment variable pointing at the Python service |
| Endpoint contracts | Identical paths, fields and status codes. The site cannot tell the difference: `a7/owner-context`, `owner-submit`, `owner-decision`, `owner-read`, `owner-analyze`, `model-test` |
| Catalogue refresh | A Python cron command |
| Data | None moved. Reference data is loaded at install (section 4) |

### 10.3 Steps and estimate (working days, an estimate, not a commitment)

| Step | Work | Days |
|---|---|---|
| F0 | Freeze baselines into the repo; rotate `X-Midas-Key`; delete executions 677–682; fix the 2 failing tests; all JS suites in CI | 1 |
| F1 | Service skeleton: FastAPI, Postgres plus Alembic, job queue and worker, gate tickets, sweeper, config (`04 Settings`) | 3–4 |
| F2 | Node runner (from the test harness), binary storage, per-run node-output store that feeds `$('Node')` | 1–2 |
| F3 | Wiring: transition table, IF conditions, table reads and writes as SQL | 6–8 |
| F4 | External calls: models, Google image API with polling, Drive, Midas pages, Pillow for the Edit Image nodes; budget calls go to Netlify unchanged | 3–4 |
| F5 | The six endpoints with identical contracts; owner-analyze taken from `a7-engine` | 2–3 |
| F6 | Tests: JS suites run unchanged against the same files; Python integration tests take a run through both gates with fake providers; replay run `4f80c2bf` | 2–3 |
| F7 | Deploy on Railway; set the site's URL variable; supervised paid run (with the owner's go, USD 3.00 cap); unpublish n8n (with the owner's approval) | 1–2 |
| **Total** | | **19–27** |
| **With 25% buffer** | | **about 24–34** |

### 10.4 Why this is the fastest safe route

- **No logic is rewritten.** The roughly 10,700 lines that carry the risk stay byte-identical, so the 890 existing tests remain valid as they are.
- **No site change beyond one setting,** and no ledger change: the Netlify side and its 223 tests are untouched.
- **No data work.** The system starts fresh, as instructed.
- **It leads straight into full Python.** Each `nodes/*.js` call can later be replaced by a Python function, one stage at a time, with a parity test. The runner can run the JS original and the Python port side by side on the same inputs. The full route (sections 5–6) then shrinks to porting the logic and the Netlify server code.

### 10.5 Limits of the fast track (what is not Python)

- About 10,700 lines of A7 logic stay JavaScript, run by Node inside the Python service.
- The Netlify owner site keeps its server functions (JavaScript) and its Postgres ledger.
- The Railway image therefore contains both Python and Node.

### 10.6 Quickest Python win inside the fast track

`services/a7-engine` (source analysis: readers 03, 05, 06, 09) is already written and its 100 tests pass. Deploying it and pointing the site's `owner-analyze` call at it takes about **2–3 days**. Two things are still needed first:
- the owner lifts the 19 Oct pause;
- its README gaps are closed: the fallback readers, the `budgetLimitUsd` cap raised to 10, and one paid parity check.

This can go live first, while F1–F5 are built.
