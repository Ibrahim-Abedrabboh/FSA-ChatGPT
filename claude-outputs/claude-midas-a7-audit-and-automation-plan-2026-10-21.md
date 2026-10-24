# Midas A7: audit and automation plan

21 Oct 2026. Written by Claude. Read-only review of `main` at `b286045`: no deployed call, no paid call, no setting changed.

**How this was done.** Four separate reviewers each read one part of the system:
- the owner app: 14,600 lines of JS/HTML and 19 Netlify functions;
- the Python engine: 5,000 lines;
- the A7 flow logic: 7 flow packages and 151 Code nodes;
- the process, tests and docs.

**Tests run locally, all passing:**

| Suite | Result |
|---|---|
| Python service | 195 tests passed |
| Owner app | 370 passed, 1 skipped |
| A7 Node suites | Every suite in `a7-guidance.yml` passed |
| `midas-a7 check` | Clean |

**What "Checked" means below.** I re-read the code of every finding marked **Checked** myself. The rest come from one reviewer's reading, with the file and line given so anyone can check them.

---

## 1. The short version

- **The pipeline has never delivered a full job, and that is not bad luck.** Four structural blocks in the code stop it:
  1. Three of the four "new job" screens cannot send at all.
  2. On the Python service, every delivered file is silently dropped by the site.
  3. A package on hold blocks every scene and edit, and there is no way to continue.
  4. When any of 150 Code nodes throws, the run ends with no hold recorded, so the site shows it frozen.
- **These have to be fixed before automation means anything.** Section 4 orders the work so that each phase removes blocks before the next adds automation.
- **Your approvals stay manual.** Go 1 and Go 2, the cost confirmation, repairs and every paid test stay with you (rules 3, 15, 16 and 22). Automation removes everything around those decisions:
  - intake, estimates and retries;
  - reminders and monitoring;
  - delivery, reports and cleanup.

## 2. Why today's job never reached the service

The service logs show no request from the owner site at all today. The code allows five explanations, in this order of likelihood.

1. **It was sent from a screen that can never send.** **Checked.**
   - **The rule:** the server refuses every send without confirmed photo facts (`netlify/functions/owner-actions.mjs:96`, `requireConfirmedSource`).
   - **Which screen has that step:** only `/owner/` has "Check the photos" (`start-connected.js` calls `source-understanding` 9 times).
   - **Which screens don't:** `/owner/client/`, `/owner/draft3/` and `/owner/desk/` (alias `/owner/controls/`) call it 0 times.
   - **What you see:** they get a 409 that points to a step they don't have.
2. **It was sent from `claude-final-midas-a7`.**
   - That site calls n8n.
   - It also has `A7_ANALYSIS_READY` off, so no photo can be confirmed there and no job can be sent from any screen (`lib/a7-understanding-production.mjs:14`). **Checked.**
3. **The send failed after the draft was claimed.**
   - The catch block at `owner-actions.mjs:118-120` returns "not confirmed" and writes **no log line**. **Checked.**
   - The version then sits as "Sent · receipt not recorded" for 15 minutes.
4. **The engine address fell back to n8n.**
   - A bad `A7_ENGINE_BASE_URL` sends calls to n8n with only a warning (`lib/a7-engine-base.mjs:13-16`).
   - Four modules read the address once, when they load. That load-time path is untested.
5. **It was never confirmed.** On `/owner/` a send needs four steps: Save, Get estimate (good for 15 minutes), Review, then tick and Confirm.

**To settle it (free reads, no spending):**
- the `dispatch_state` of that version in `a7_job_versions`;
- the Netlify function log for `owner-actions`;
- n8n executions of the bridge at that time.

**Until the duplicate screens are removed,** send jobs from `https://midas-a7-owner-preview.netlify.app/owner/` only.

## 3. Gaps, bugs and unsolved cases

**Severity:** Critical means it blocks the whole pipeline. High means it loses money, data or a run, or hides a failure.

**IDs:** FE = owner app, BE = engine, FL = A7 flow logic.

**Go?** means the fix needs your go under rule 3: flow behaviour, deleting, publishing or switching an engine.

### 3.1 Critical: these stop any job from finishing

| ID | Problem | Where | Fix | Go? |
|---|---|---|---|---|
| FE-1 | 3 of 4 new-job screens can never send (above) | `client/app.js`, `studio/app.js`, `owner-actions.js` | Keep `/owner/` only; retire or redirect the other three (also listed as your open decision) | Yes: changes the published site |
| FE-7 | On the Python service every delivered file is dropped. The site keeps a result only if it is a Google Drive link, but the service returns `/files/<id>/view?sig=` links. The approval link is also labelled "in Google Drive" | `lib/a7-results.mjs:11`, `owner-actions.mjs:35-36`, `start-connected.js:892` | Accept the service's signed file links (allowlist that host), and rename the label. **Checked** | No (site code); deploy needs your go |
| FL-4 | A package on hold blocks every scene and every edit built on it. `Scene due?` never accepts `hold`. `E2_Edit_base.js` holds with no ready white package. The only resume path is a webhook hard-wired to one run from 18 Oct. Run `4f80c2bf` can therefore never reach scenes, and its edit `34b37efe` would hold too | `18p_Package_result.js`, `E2_Edit_base.js:41`, `Package · Webhook` | Give a held package an owner decision at Go 2: "deliver as exception", "regenerate", or "stop" | Yes: flow change |
| FL-1 | When a Code node throws, the run ends with no hold. 150 of 151 Code nodes have no error path: 60 `budget_identity_missing`, 24 ticket/permit, about 30 recovery throws. n8n saves no error data, and the Python service records the error only in its own table. The site shows the last status, for example "Go 1 given", forever | all `Budget_*`, recovery and Blind/Package nodes | One engine-level rule: any run that ends in an error writes `status=hold` with the failing node and a plain reason to the run row the site reads | Yes: flow/engine behaviour |
| FE-2 | The final site cannot send any job, and switching its engine alone changes nothing | `SETTINGS.md`, `a7-understanding-production.mjs:14` | Switch the engine **and** turn on `A7_ANALYSIS_READY` together, after the preview run is proven | Yes |

### 3.2 High: lost runs, lost money, hidden failures

| ID | Problem | Where | Fix | Go? |
|---|---|---|---|---|
| BE-1 | A restart or deploy throws away a run in progress, including a paid image call not yet settled. Startup marks every running run `crashed` and **deletes its state**, so the image id and the reservation are lost and nothing reconciles them. The exposure is about 25 minutes between Go 1 and Go 2. **Checked** | `store.py:150-155`, `runtime.py:156` (30 s drain) | Save a checkpoint after each Reserve, call and Settle. On restart, poll the saved image id (never resend) and settle as "uncertain". Until then: deploy only when no run is active | Yes |
| BE-2 | Nobody can tell when a run is stuck, crashed or failed. `/health` is static and checks neither the database nor the JS runner. No route shows runs. Log lines carry no run id | `app.py:226-233`, `executor.py:188` | Authenticated `/status` (runs by state, oldest waiting, failed settles), run id in every log line, and alerts | No |
| FE-6 | The emergency stop does not stop spending. `A7_PAID_BUDGET_GUARDS_READY` blocks new sends and decisions, but the ledger's `reserve` never checks it, so a run already past Go 1 keeps spending (image and repairs). **Checked** | `netlify/functions/a7-budget.mjs:28` | Refuse `reserve` when the flag is off; the run then holds at its next paid call | No (site code) |
| FE-3 / FE-4 | Failed sends are silent. A 401 or 404 from the engine (wrong secret, unknown webhook) becomes "outcome unknown" instead of a clear refusal, the draft is not reopened, and no log line is written | `owner-actions.mjs:23-30, 118-120` | Log every failure without secrets; treat 4xx as a definite refusal and reopen the draft | No |
| FL-3 / FE-8 | Model tests spend without a ledger reservation, which breaks rule 22. Arms A–E call Gemini, OpenAI and Claude directly. The only limit is 20 runs a day, with no USD cap. Prices differ from the ledger (gpt-6.1-sol 2/10 vs 4/15) | `model_tests` flow, `lib/model-tests.mjs` | Reserve each arm on the ledger with a per-run cap; one price table | Yes: flow change |
| FL-12 | Choosing any other image model crashes the run. The budget ticket hard-codes `gemini-nano-banana-2.1`. **Checked** | `Budget_15g_Ticket.js`, `15f_Build_request.js` | Read the allowed model from the registry entry that `14 Choose model` picked | Yes |
| FL-5 | Fit-on-white can hide a cut-off product. When the product is really cut off, scaling it to 76% delivers a truncated sofa marked "ready". A master at about 85–95% that clears the edge guard is delivered unchanged, so rule 20's 76% is not enforced on delivery | `18e3_Clean_background.js` | Fit only when the review says the product is whole; hold otherwise. Enforce 76% ± tolerance on delivery | Yes |
| FL-2 | A job whose id is not `owner-<uuid>` crashes at its first paid call: client-page jobs and test senders. **Checked** | every `Budget_*_Ticket.js` | Accept the documented id forms, or refuse at intake (01) with a clear reason | Yes |
| BE-6 | Permanent image links reach the logs. Log redaction covers `signature=` but not `sig=`. Links never expire, and the same secret also signs resume links, so rotating it breaks waiting runs. **Checked** | `cli.py:77`, `google_drive.py:29-42` | Add `sig` to redaction; separate file-link secret with expiry | No / Yes for expiry |
| BE-5 | The A7 budget suites test an old copy of the workflow: the 183-node export `eefd6c42`. The service runs the 362-node baseline `4669b0d7`, which no Node suite reads. **Checked** | `tests/claude-midas-a7-budget/*.test.mjs` | Point the suites at `n8n/baseline/` | No |

### 3.3 Medium

| ID | Problem | Fix |
|---|---|---|
| FL-6 / FL-7 / FL-8 | Rule 17 ("never invent unseen parts") is only partly enforced:<br>• The preview site's confirmed-photo path skips every 04–06 check.<br>• The photo-check prompt (v3) gives no boxes, so false crop flags cannot be cleared. Tests 3 and 8 would hold after Go 1.<br>• The job prompt (pre-D13, 6/10) does not ask for the fields the code reads.<br>• A product box at the frame edge alone never holds. | Choose one reader prompt for both paths (rt4 scored 10/10) that returns boxes. Run the 04–06 checks on the confirmed path too. Add a code-only crop rule (box at edge → hold). Needs your go |
| FL-9 | Every hold ends the run with no way to continue: gate timeouts (a paid image is thrown away), budget holds, uncertain images, scene holds. A failed attempt 3 holds without opening Go 2. | "Continue" and "approve as exception" decisions for held runs, under the same gate rules |
| FL-11 | "White master on demand" is ignored by the flow: the site sends `whiteMaster=false`, no flow reads it, and scenes still require an approved white master. The site estimate and the real calls disagree. | Flow patch (WP3) or hide the option |
| FL-10 | A scene request can pass the 14 MB limit (the Test 8 photo alone is 6.8 MB; base64 adds about 33%), and resizing is not built. | Resize references in code before the call |
| FL-13 | A model decides piece-count conflicts (rule 14 tension). A client count below the seen count is never held. | Code rule: hold when the counts differ in either direction |
| FE-5 | The engine address is resolved once, at module load. `/api/owner/connection` never says which host it reached. | Resolve per request; show host and deploy time in the connection check |
| FE-9 | There is a per-job cap (USD 10) but no daily or global cap, so N parallel jobs can spend N × 10. | Global daily ceiling on the ledger |
| FE-10 / FL-15 | Hard-coded hosts and ids:<br>• Ledger routing knows two netlify.app hosts only, so a custom domain sends jobs to the wrong ledger.<br>• Recovery webhooks are tied to 18 Oct runs.<br>• Prices run until 2027-01-01.<br>• n8n host aliases. | One settings table; retire one-off recovery paths |
| FE-11 | After the final site switches engine, runs sent to n8n look "not found" and can be sent again (a duplicate run). Gates waiting on n8n become unreachable. | Drain n8n runs before switching; mark the engine on each version |
| FE-12 / FE-13 | Variations are shown as "applied" but every send that includes them is refused. The secondary screens disagree with the server on limits. | Remove from the UI; retiring the screens resolves FE-13 |
| FE-14 | The background photo reader fails silently, and the page polls for 6 minutes. | Log, and write a failed state the page shows at once |
| BE-3 / BE-4 | A database error while parking a run strands it. One shared JS runner: a timeout in one run kills Code nodes in **every** run (shown by experiment), and CPU-heavy code blocks all expressions. | Retry the save; restart only the timed-out script, or run a small pool |
| BE-7 | Storage grows without limit: every image is stored as bytes in Postgres, with no retention, crashed-run files never deleted, and runs never pruned. | Retention policy (needs your go: deleting) |
| BE-8 | A deploy may briefly run two instances; the new one marks the old one's live runs crashed. | Turn off deploy overlap, or deploy only when idle |
| Options | Saved but never used by A7:<br>• room description, catalogue references, product links;<br>• plants, mood, strengths;<br>• inspiration photos, PDF and Excel specs;<br>• hero item, description/meta "No". | Apply each in its node (listed in the front-end review) or hide it |

### 3.4 Low

- **Concurrent writes:** data-table writes can collide (BE-13), and parallel review branches are not cancelled together (BE-10).
- **Run limits:** no overall run deadline (BE-11); the 64 MB body limit can be bypassed by a chunked upload (BE-12).
- **Open endpoints:** `/health` is public and lists every webhook (BE-12).
- **Ledger:** one shared secret both calls the engine and writes the ledger (FE-19); reconciliation can set an uncertain charge to USD 0 (FE-20).
- **Pages:**
  - a token expiry sends `/owner/client/` to login and loses unsaved files (FE-21);
  - the public `/consumer/` page is a dead concept with internal jargon (FE-22);
  - one page is published at four paths (FE-23);
  - the success message claims more than the server knows (FE-17).
- **Dead flow branches:** four (FL-14).

### 3.5 Unsolved cases (the pipeline has no answer today)

1. **A product cut off in the vendor photo:** the run holds forever and asks for a new photo. There is no "pad in code" path.
2. **Wide sets:** the model ignores 76% (97.6% on run `4f80c2bf`), and no rule picks a wider aspect ratio for generation.
3. **Set pieces photographed separately:** there is no way to combine several photos of one set.
4. **Large dining sets:** the 12-chair job is parked because its only photo is cropped.
5. **Glass, mirror, white or ivory products:** no special handling in prompts, checks or background clean-up.
6. **A room photo is supplied:** the light preset can't apply, and the client is not told.
7. **Side or other views:** held unless a photo of that side exists, and the page takes one photo.
8. **You never answer a gate:** the run holds after 24 h with no reminder and no way to continue.
9. **Budget runs out mid-run:** the run holds and the remaining scene queue is lost.
10. **Jobs from the client page:** they crash (FL-2), and there is no result address for the page.
11. **Lifestyle-only jobs (no white image):** impossible (FL-11).
12. **Edits:** they need an approved scene or a ready white package, and none exists yet.
13. **Batch jobs, angled photos, colour variants, Arabic copy:** not built, or still to be decided.
14. **Delivery to Midas:** no step exists. Files sit behind signed links, and nothing hands them to the Midas catalogue.

### 3.6 Docs that are out of date

**Docs that still list open items that are now done:**
- PR #79 "waiting for merge": it is merged.
- The Anthropic blocker: the workspace id is set, and `/health` reports it.

**Other stale docs:**
- `docs/claude-docs-state.json` records `2bd6550`; `main` is now `b286045`.
- Root `README.md` still says n8n is the authority and that images are in Drive.
- The catalogue refresh reads page 1 only. Scheduling it will not widen coverage beyond about 20% of 2,082 items; only the sitemap import does.

## 4. Automation plan

**Principles:**
- Code decides each next stage (rule 14).
- Each phase is one work package with its own draft PR, tests and dated README (rule 11).
- Every paid test states its cap and waits for your go.
- Sizes are rough estimates: **S** under a day, **M** 1–3 days, **L** about a week.

### Phase 0: stop silent failures (no flow change; mostly site and engine code)

| # | Work | Size | Done when |
|---|---|---|---|
| 0.1 | Send failures logged; 4xx = clear refusal and draft reopened (FE-3, FE-4, FE-14, FE-15) | S | Unit tests cover 401, 404 and a thrown blob read |
| 0.2 | Emergency stop also refuses `reserve` (FE-6) | S | Test: flag off → reserve refused |
| 0.3 | Accept the service's signed file links; fix the "Google Drive" label (FE-7) | S | Contract test with a real `/files/…?sig=` link |
| 0.4 | Engine address read per request; connection check shows host and deploy time (FE-5) | S | Test of the load-time path |
| 0.5 | `sig` added to log redaction (BE-6, first half) | S | Test on an access-log line |
| 0.6 | `/status` (authenticated) and run id in every log line (BE-2) | M | Lists running, waiting and crashed runs with age |
| 0.7 | Suites read `n8n/baseline/`; add a Postgres CI job; owner-app changes also trigger Python CI (BE-5) | M | CI green on both |

**Your decision:** retire `/owner/client/`, `/owner/draft3/` and `/owner/desk/`, keeping `/owner/` (FE-1).

**After Phase 0:** the supervised paid run (cap USD 3.00) from the preview site. Every failure is now visible, so the run tells us something.

### Phase 1: let a job reach the end (flow changes, each with your go)

| # | Work | Size | Done when |
|---|---|---|---|
| 1.1 | Any error ends as a recorded hold with node and reason (FL-1) | M | Mocked runs that throw in a Budget node show "held: <reason>" on the site |
| 1.2 | Held package → Go 2 decision: deliver as exception, regenerate, stop (FL-4); retire the 18 Oct one-off recovery webhooks (FL-15) | M | Mocked run: package hold → decision → scenes start |
| 1.3 | Fit only a whole product; enforce 76% on delivery (FL-5) | M | Fixture tests: whole wide set fitted; cut-off product held |
| 1.4 | One reader prompt with boxes for both paths; 04–06 checks on the confirmed path; code-only edge crop (FL-6/7/8) | M | Reader test sheet ≥ 9/10 (paid, cap about USD 1, your go) |
| 1.5 | Allowed image model from the registry (FL-12); job-id forms (FL-2) | S | Tests with a second model id |
| 1.6 | Resize scene references in code below the request limit (FL-10) | S | Test with the 6.8 MB Test 8 photo |
| 1.7 | "Continue" for budget and timeout holds; Go 2 at attempt 3 (FL-9) | M | Mocked runs |
| 1.8 | Mocked end-to-end tests on the Python engine: Go 1 → image → reviews → Go 2 (approve, repair ×2 then hold, exception) → package → scene → scene files → edit | L | All paths green in CI, no live calls |

**Then:** a second paid run, a white package plus one scene (cap USD 3, your go). This is the first possible scene delivery.

### Phase 2: make the engine safe to leave running

| # | Work | Size |
|---|---|---|
| 2.1 | Checkpoint around every paid call; after a restart, reconcile (poll the saved image id, settle as uncertain; never resend) (BE-1) | L |
| 2.2 | Deploy gate: deploy only with no active run; no instance overlap; longer drain (BE-8) | S |
| 2.3 | JS runner isolation: a timeout in one script must not kill the others (BE-4); retry a failed park save (BE-3) | M |
| 2.4 | Alerts by email or Slack:<br>• a crashed run at startup;<br>• a run active longer than N minutes;<br>• a failed settle;<br>• a JS runner restart;<br>• a gate waiting more than 12 h;<br>• storage size. | M |
| 2.5 | Global daily spending ceiling on the ledger (FE-9); one price table for the ledger and model tests; model tests reserve on the ledger (FL-3) | M |
| 2.6 | Retention: delete files of finished and crashed runs after N days, and prune old runs (BE-7). **Needs your go** (deleting) and a chosen N | S |

### Phase 3: automate the process around your two decisions

| # | Step today | Automated version | Stays with you |
|---|---|---|---|
| 3.1 | Photos arrive by any channel; you build each job by hand | **Intake to draft:** a watched Drive folder or email inbox makes a draft case per product photo, with photo check and estimate prepared | Confirming the photo facts and the cost |
| 3.2 | One job at a time | **Batch send:** select N drafts → one confirmation with a total cap → sent in sequence, within the daily ceiling | The one batch confirmation |
| 3.3 | You check the site to see if a gate is waiting | **Gate alerts:** email, WhatsApp or Slack when Go 1 or Go 2 opens, with the plan or image and a link; a reminder at 12 h and before the 24 h timeout | Go 1 and Go 2 |
| 3.4 | Estimate expires after 15 min; stuck sends need a button | Automatic re-estimate; a server-side check for stuck sends on a timer | — |
| 3.5 | No delivery step | **Delivery after your recorded Go 2:** package bundle (JPG, WebP, manifest) to a chosen place: a Drive folder, a download page, or the Midas catalogue feed. Each destination needs your go once | Choosing the destination |
| 3.6 | No cost view | **Daily/weekly cost report:** spend per job and per accepted package, holds, failures (labelled estimates) | — |
| 3.7 | Catalogue at 428 of about 2,082 items, refreshed by hand, page 1 only | Sitemap import (about 4 h 45 min, no model cost), then a weekly schedule. **Needs your go** | Approving the schedule |
| 3.8 | Final site on n8n | Move the final site to the Python service (engine and analysis together, after draining n8n runs), then unpublish n8n with a 14-day rollback | Each switch and unpublish |

### Phase 4: cleanup and security

These items are already open in the docs:
- delete n8n executions 677–682 and 1591, which hold `X-Midas-Key` in plain text, then rotate that key;
- separate secrets for "site → engine" and "engine → ledger" (FE-19);
- a file-link secret separate from the resume secret, with expiry (BE-6);
- remove `A7_OWNER_TEST_ALL_SCOPES` from the preview site;
- retire `/consumer/` and `services/a7-engine/`;
- delete the 7 merged branches;
- add secret scanning to CI;
- bring the docs and root README up to date.

All deletes and rotations need your go and are done by you or with you.

## 5. What stays manual, by the project rules

- **Go 1 and Go 2 (rule 15).** "Approved" comes only from your recorded Go 2. Automation may notify and remind, never decide.
- **Repairs, at most two (rule 16).** `auto_repair` stays false.
- **Every paid call has a stated cap and your confirmation (rules 3 and 22).** A batch can share one confirmation with one total cap.
- **Publishing, switching an engine, deleting, changing flow behaviour (rule 3).**
- **Setting or rotating secrets (rule 2).**

## 6. Decisions I need from you

1. **Which "new job" screen to keep.** Recommended: `/owner/` only.
2. **Phase 0 can start now.** It changes site and engine code only, with no flow change and no spending. Go?
3. **Phase 1 flow changes 1.1–1.7.** Each comes as its own draft PR for your review first. Go on the order?
4. **Where finished packages should be delivered** (3.5).
5. **The retention period N** for stored images (2.6).
6. **The supervised paid run** (cap USD 3.00): after Phase 0 (recommended), or now as it is.
