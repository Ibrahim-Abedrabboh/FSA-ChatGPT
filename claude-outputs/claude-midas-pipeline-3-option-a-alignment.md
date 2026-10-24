# Pipeline 3 and Option A: comparison, and the new pipeline 5

Written 5 October 2026, updated the same day. Covers the n8n workflow `Claude · Midas job request pipeline 3` (id `LCkfLFMQS5MjA5FQ`), the new workflow `Claude · Midas job request pipeline 5 (Option A)` (id `OPpIksTXhbHxHkxN`) and Architecture A ("Option A, surgical replacement") on the studio architectures page, revision 2 of 4 October 2026.

## Status

- **Pipeline 3 is as it was.** Its draft was put back to `Re-generate address (7 of 7)`, and a comparison with that version shows no difference. Its published version was never changed. The six `Option A 1 of 6` to `6 of 6` versions remain in its history only.
- **Pipeline 5 is new and holds the Option A steps.** It is pipeline 3 at `7 of 7` plus the Option A steps: 140 steps, 160 links, 10 canvas groups. It is **not published**, so its addresses do not answer yet.
- Pipeline 5 has its own addresses, its own run log and its own run ids, so the two pipelines do not share job records.
- Every run so far used simulated answers for the paid steps. No OpenAI or fal.ai call was made. No real job has run on pipeline 5.
- On a definition-level count of the 21 Option A responsibilities, pipeline 3 scores 52% and pipeline 5 scores 71%. The count is explained below. It says what the workflow definition contains, not how well it works on real products.

## Pipeline 5 at a glance

| Item | Pipeline 3 | Pipeline 5 |
|---|---|---|
| Workflow id | `LCkfLFMQS5MjA5FQ` | `OPpIksTXhbHxHkxN` |
| Job address ends in | `claude-midas-studio-3` | `claude-midas-studio-5` |
| Other addresses | `-status`, `-decision`, `-batch`, `-file`, `-regenerate` after the same stem | The same five endings after `claude-midas-studio-5` |
| Run log table | `Claude job runs v3` | `Claude job runs v5` (same 20 columns) |
| Run id starts with | `v3-` | `v5-` |
| Published | Yes, `Re-generate address (7 of 7)` | No |

Used by pipeline 5 only: `Claude Midas vault`, `Claude Midas operations`, `Claude Midas model registry`. Shared by both: the handling profiles table, the catalogue table, the white clean-up sub-workflow, and the OpenAI, fal.ai and header-key credentials.

To use pipeline 5, the client page must send to the `studio-5` addresses. Publishing it is a separate step that has not been taken.

## What was compared

- Option A source: `studio-architectures` page and its full specification (`architecture-lab/two-architectures.txt`).
- Pipeline 3 source: the attached export (96 nodes, version `c9a176a8`) and the live workflow. The export is older than the live workflow, which had 118 nodes after the white background and re-generate changes of 5 October. The comparison uses the live workflow.

## Overall similarity

- Both keep the original product photo as the only authority for the product.
- Both run a fixed, code-chosen sequence in which models do the looking and judging and code decides the next step.
- Both separate what is seen from what the client supplied and from what is unknown.
- Both review each image against the original with structured checks, repair at most twice, then hold.
- Both keep spending bounded and stop before paid images unless an automatic run was asked for.
- Both refuse to call an incomplete website package complete, and neither approves on the owner's behalf.

## Overall difference

- Option A is a specification. Its own page says "Production autonomy: not yet proven", and its endpoints and tables are proposed, not built. Pipeline 3 is a running workflow.
- Option A wants a versioned contract with an evidence basis per fact. Pipeline 3 has one unversioned contract per run.
- Option A wants a durable queue with a reserved operation, a receipt and reconciliation for every paid call. Pipeline 3 sends the request and retries on failure.
- Option A wants a Vault: unchangeable files plus an append-only record. Pipeline 3 has one row per run and image links held by fal.ai.
- Option A wants a package manifest with checksums and a release gate. Pipeline 3 has a run card and a website-package check.
- Option A reads documents, spreadsheets, several views and a client room. Pipeline 3 reads one product image.
- Option A wants a calibrated benchmark and cost per accepted package. Pipeline 3 has model assessments and counts of paid calls.

## Row by row

Levels: covered means the artifact Option A asks for is produced and its boundary rule is enforced in the workflow definition. Partial means part of it.

| # | Responsibility | Pipeline 3 | Pipeline 5 | In pipeline 5 | Still missing |
|---|---|---|---|---|---|
| 1 | Intent and scope | Partial | Covered | Brief version, `revisionOf`, owner `resolutions`, conflicts sorted, hold on a critical conflict | A revision is a new run; it does not cancel a run in progress |
| 2 | Eye: ingest | Partial | Partial | Checksum, size and role of the product photo | One image only: no PDF, spreadsheet, OCR, extra views, room photo or crop coordinates |
| 3 | Eye: recognize | Partial | Partial | Unchanged: client type against photo type, conflict recorded | No list of alternative readings, no second look when unsure |
| 4 | Eye: interpret signs | Covered | Covered | Unchanged: marks, insets, excluded pieces | Text printed on a sheet is not kept as specification text |
| 5 | Eye: preserve uncertainty | Partial | Covered | Every fact carries its basis: observed, supplied or inferred. Critical-unknown gate | No evidence region per fact |
| 6 | Eye: scene and time | Partial | Partial | Unchanged, plus regressions between tries | No scene graph, no view coverage record |
| 7 | Brain: route | Partial | Covered | Recorded route: input kind, category, role, output, mode, order of images, needs checked against the registry | Role is always hero; no room reference |
| 8 | Brain: modes | Partial | Covered | Mode per image, table of locks and free variables | None at definition level |
| 9 | Brain: semantic grounding | Partial | Partial | SKU, page, image checksum, placement and reason | No relation graph, no visual search |
| 10 | Stylist: retrieve | Partial | Covered | Selected and rejected pieces with reasons, out-of-stock dropped, image checksum | Small catalogue table; stock status as of its listed date |
| 11 | Stylist: compose | Partial | Partial | Unchanged: one plan per image, checked by the plan critic | No alternative boards compared and ranked |
| 12 | Stylist: reverse role | Partial | Partial | Unchanged: hero field, accessory handling profile | Role is not a planner setting |
| 13 | Engine: compile | Partial | Covered | Exact prompt, checksum, reference roles, model and settings per request | None at definition level |
| 14 | Engine: choose models | Partial | Partial | Registry table with documented limits | Not tested or benchmarked; no prices |
| 15 | Operator: execute | Partial | Partial | Operation key, reservation before sending, receipt, hold on an uncertain answer, no second send | No provider request id, no cost, no transactional lease, no reconciliation with the provider |
| 16 | Critique: assess | Covered | Covered | Unchanged | No region coordinates |
| 17 | Critique: repair | Partial | Covered | Named targets, preserve list, resolved points and regressions per try | No local masked edit |
| 18 | Critique: benchmark | Missing | Missing | Nothing | Needs an owner-reviewed set of examples |
| 19 | Vault: memory | Partial | Partial | Append-only records: brief, contract, plan, operations, manifest | Image files are not stored durably |
| 20 | Package and release | Partial | Covered | Manifest with checks, checksums and hold reasons; `accepted` refused on a hold | None at definition level |
| 21 | Business operator | Partial | Partial | Seconds elapsed, working and waiting; renders, repairs and paid-call counts per package | No money figure, no report across packages, no human minutes |

Count, with covered = 1, partial = 0.5, missing = 0. Pipeline 3: 2 covered, 18 partial, 1 missing: (2 + 9) / 21 = 52%. Pipeline 5: 10 covered, 10 partial, 1 missing: (10 + 5) / 21 = 71%.

## What pipeline 5 adds to pipeline 3

| Step | Nodes | What it does |
|---|---|---|
| Brief ledger and conflict gate | `03d` to `03g`, `Contract clear?` | Records the photo checksum, facts with their basis and the brief version. One GPT-4.1 text call sorts conflicts. A conflict that changes which product is made holds the job before any plan |
| Locked contract | `05i0`, `05i`, `Contract leaves images?`, `05g2` | Stamps the contract: locks, mode per image, route, Midas pieces selected and rejected, model limits. Adds the contract to the go preview |
| Operations | `07a` to `07d`, `09b` to `09d` | Keys each image request, saves it as reserved before sending, saves the answer as a receipt, never sends the same key twice |
| Repair plan | `11b` | Names corrections and the accepted points to keep. A provider timeout holds the image instead of sending it again |
| Package manifest and release gate | `12m`, `Decision release gate` | Checks every output and lists hold reasons. `accepted` is refused while a hold reason stands |
| Vault | `V1`, `V2` | Appends brief, contract, plan and manifest records |

Two steps that exist in pipeline 3 differ in pipeline 5: `08 Render with Nano Banana` reads its request by position from `07`, and `15 Audit verdict` takes its state from `11b`.

Optional new form fields: `revisionOf` (the job id this brief replaces) and `resolutions` (lines that settle a conflict).

## How pipeline 5 behaves differently from pipeline 3

- One more paid text call per job (the conflict check).
- A job can stop before planning when the brief and the photo disagree on which product to make.
- A provider timeout puts the image on hold. Pipeline 3 sends it again.
- `accepted` is refused when any image of the run is on hold. Pipeline 3 accepts a partly finished run unless it is a website package.
- If the operations table cannot be written, no image is sent.
- A Midas piece listed as out of stock is not used.

## Checks made

| Check | Result |
|---|---|
| Node logic run locally (26 cases) | Passed |
| Pipeline 5 compared step by step with the intended copy | All 140 steps identical in type, settings, parameters, credentials and notes; all 160 links and 10 groups identical |
| Pipeline 5 addresses | All six end in `claude-midas-studio-5…` |
| Pipeline 3 draft compared with `7 of 7` after the restore | No step or link differs; published version unchanged |
| Run 218 on pipeline 5, all reviews pass | Run id `v5-…`, two images ready, manifest passes, operations saved as reserved then succeeded, four Vault records written as `pipeline 5`, checksums recorded |
| Runs 212 to 217, made on the same steps while they were a draft in pipeline 3 | 212 all pass; 213 review always fails: three tries, preserve list, hold; 214 critical conflict: held before planning; 215 revision plus provider timeout: brief version 2, image held and not sent again; 217 `accepted` on a held run: refused with the reason |

Not checked on pipeline 5: a real paid job, the conflict check with the real model, the wait-for-go path, the failing, conflict and timeout cases (checked only on the pipeline 3 draft), batch, White BK, Website package, Re-generate, and the five webhook addresses, which need publishing first. The run log `Claude job runs v5` was not written in the test, because its steps were simulated.

One setting differs: pipeline 3 carries `binaryMode: separate` and a time-saved setting that the n8n connection cannot set on pipeline 5. Run 218 read and wrote image files correctly without them.

Test rows left behind, which can be deleted by hand: 18 rows in `Claude Midas vault` and 16 in `Claude Midas operations`, with job ids `optiona-selftest-0001` to `0005`. The scratch workflow `Claude · Option A expression check (scratch)` is archived.

## What cannot be reached by editing the workflow

- Rows 2, 3, 6: a new intake for several files, documents and a room photo, with regions.
- Rows 11, 12: a second styling step that compares boards, and a role setting.
- Rows 14, 18, 21: measured results, which need real runs, prices and owner-reviewed examples.
- Row 15: the fal.ai queue API for request ids and status checks.
- Row 19: storage for image files outside fal.ai.
