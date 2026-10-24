# Midas A7: the supervised paid run on the Python service (22 Oct 2026)

Written by Claude. Claude watched and reported; the owner started the run and made every decision. Nothing was sent, retried or decided by Claude.

**Run:** `claude-a7-ff0aa7e5-e404-4fac-af35-77f6c7ea32fb` (client run `owner-ff0aa7e5-…`), on `midas-a7-owner-preview` → the Python service `midas-a7-production.up.railway.app`.
**Service build:** Railway deployment `b8bab968`, commit `3d35328` (contains Phase 0, PR #84). Owner site build: Netlify deploy `6ad9d0ce`, commit `c32a37e`.
**Product:** a sofa set of 3 pieces: 1 Four Seater Arm Sofa and 2 Three Seater Arm Sofas. **Outputs:** a white master, then one lifestyle hero scene.
**Job ceiling:** USD 5.00 (raised from the planned 3.00; see section 4.2). **Provisional estimate shown:** USD 0.414 with no repairs, USD 0.848 with two repairs per image.
**Result:**
- **Reached:** send → Go 1 → one image call → blind count and review. The **review failed**: the product was cut off at the frame edge and framed at 97%. Go 2: the owner approved anyway.
- **Stopped:** the **package held** on a grey-halo check in the saved WebP.
- **Not reached:** no scene was made, because a held package blocks scenes (FL-4). The run cannot be continued (FL-9).

All times are UTC.

## 1. Before the run

| Check | Result | Evidence |
|---|---|---|
| Phase 0 build live | **Yes, from 10:31.** The deploy had been queued since about 09:09 behind a Railway incident: builds were paused and then brought back by plan tier. That morning the status page said Pro and Enterprise had builds again, Hobby, Free and Trial did not yet, and many deployments stayed queued. A deploy in another project of the same workspace was queued too. | Railway deployments: `6ad5631e` (PR #85, contains PR #84) SUCCESS at 10:31:35. `b8bab968` (PR #88, no service code change) SUCCESS at 11:10:40. `/status` answered 404 before 10:31 and 403 after. |
| `/status` refuses requests without the secret | **Yes** | 403 "Authorization data is wrong!", with no header and with a wrong one |
| Nothing queued, no other run | **Yes, from 11:10** | No queued deployment; no webhook traffic before the run |
| Owner site has the Phase 0 site changes | **Yes** | Netlify deploy `6ad9d0ce` is built from `c32a37e` (PR #84). PR #87's later site change only moves the send gate into its own module; same behaviour. |
| Railway security notice | **Not checked by Claude.** During the incident Railway advised checking for unexpected Anthropic and OpenAI usage and rotating PostgreSQL credentials. This service holds those keys and `DATABASE_URL`. | status.railway.com, 22 Oct |

## 2. Timeline

**Sources:**
- Railway service and network logs for the service;
- Netlify request logs for the owner site. Every paid call opens with a budget `reserve` and closes with a `settle`, both on the site;
- the owner's screenshot of the run page (`/owner/controls/`, 15:14 Asia/Amman = 12:14 UTC). It shows the run's recorded history, the review result and the job spending per call.

The page shows times in Asia/Amman (UTC+3); they are converted to UTC here.

| Time | Step | What the logs show |
|---|---|---|
| 11:33–11:35 | First attempt (case `2e58f4ed…`): photo check | 3 reserves and 3 settles, all 200. `POST owner-analyze` 200 (11:35:21 → 11:35:42, 21.6 s). Facts confirmed at 11:46:30. |
| 11:46–11:52 | First attempt stuck before the estimate | No estimate request reached the site (section 4.1) |
| 12:03:01–12:03:07 | **New case:** photo check | reserves and settles, all 200; `owner-analyze` 200 |
| 12:04:23–12:04:27 | **Send** | `source-continuation` 200, reserve (planning) 200, `owner-submit` 200 |
| 12:05:04–12:05:24 | Planning settled, plan critic reserved and settled | settle, reserve, settle, all 200 |
| 12:05:37 | **Go 1 opened** | `owner-context` 200 |
| about 12:05:48 | **Go 1 given**, then the image call reserved | `owner-decision` 200; reserve 200 at 12:05:48 |
| 12:06:09 | **Image call settled** (about 21 s after its reserve; made once) | settle 200 |
| 12:06:10 → 12:06:28 | Blind count and review: reserved together, settled at 12:06:14 and 12:06:28 | 2 reserves and 2 settles, all 200 |
| 12:08:06–12:08:09 | **Go 2 opened** | `owner-read` 200, `owner-context` 200 ×2 |
| 12:08:10 | **Go 2 given** (approve) | `owner-decision` 200 |
| 12:08:09–12:08:15 | Package made in code (no AI). Heavy database traffic: over 150 MB between the service and Postgres. | Railway network flow |
| 12:08:14 | **Package held** | The run's trail, as shown on the page: "the saved webp file shows a grey halo: 2 background pixels below 250, 99.97% at 254 or more (darkest 249; needed: none below 250, …)" |
| after 12:08 | No further paid call; no reserve or settle on the ledger | Netlify request logs through 12:10 |

**Paid calls.** Each one reserved first and was settled. None was retried, and the image call was made once. Amounts are the page's recorded usage: token counts × price tables, estimates, not invoices.

| Case | Calls |
|---|---|
| First attempt | 3 photo-check calls |
| New case | Photo check; planning; plan critic; **1 image call**; blind count; review |

**Job spending for the new case** (from the run page):

| Node | Model | Held first (USD) | Charged (USD) |
|---|---|---|---|
| 03 Eye reads the product photo | gemini-3.8-flash | 0.846432 | 0.005227 |
| 05 Second count | claude-sonnet-5-5 | 2.112152 | 0.008504 |
| 09 Conflict check | gpt-6-luna | 0.2115 | 0.000926 |
| 11 Stylist plans the scenes | gpt-6.1-sol | 4.32 | 0.035289 |
| 11c Plan critic | claude-sonnet-5-5 | 2.177152 | 0.034608 |
| 15g Send to Google (image) | gemini-nano-banana-2.1 | 1.179648 | 0.094967 |
| 16x Blind count | gemini-3.8-flash | 0.816432 | 0.001368 |
| 16 Critic review | claude-sonnet-5-5 | 2.137152 | 0.038616 |
| **Total** | | | **0.219505** |

- **Totals:** the page shows "estimated charges and held reservations" of USD 0.219505, against the USD 5.00 ceiling (available: USD 4.780495). The charged column adds up to the same figure, so no reservation was still held at 12:14 UTC.
- **Against the estimate:** USD 0.219505 is about 53% of the USD 0.414 estimated before sending. The estimate included a scene, which was not made.
- **Not included:** the first attempt's photo check (case `2e58f4ed…`, 3 calls), which belongs to that case.
- **A second budget figure:** the flow's own step 14 records "reserved USD 0.0698" for the image model. That is its internal estimate, not the ledger hold of USD 1.179648.

## 3. What worked

1. **The readers on the service, including the first live Anthropic reader** (05 Second count, claude-sonnet-5-5). Both photo checks answered 200, with no 400 or "not scoped to a workspace" error. The two readers disagreed on the count: 03 Eye counted 3, and the independent count was 6. The page asked for the real count, and the owner confirmed 3.
2. **The budget guard.** Every paid call reserved budget first and was settled. A photo check that did not fit the job ceiling was refused before any call by the site's quote check (`lib/a7-understanding-service.mjs:125`; section 4.2), and nothing was paid for it.
3. **Go 1 and Go 2.** Both opened, and both decisions were recorded (`owner-decision` 200). The page asked for the owner's decision at each gate.
4. **One image call, never retried** (rule 22).
5. **Phase 0 log redaction.** When the owner opened a file link, the access log shows `sig=<redacted>`.
6. **The service's own file links open.** The white master link answered 200 with a 2048×2048 JPEG (1,437,636 bytes, sha256 `502a01b5…`).
7. **No crash, no silent failure.** The hold has a plain reason on the page.

## 4. What went wrong

### 4.1 The page (owner site): three blockers before sending

1. **Get estimate stays disabled after any edit.**
   - Any typing in the new-case form disables it, including a budget change (`start-connected.js:326`, `334-335`). Only a save turns it back on (lines 667, 688, 704, 732, all in the save paths).
   - The checklist told the owner to set the budget *after* saving, so following it as written left the button disabled. This was a checklist error by Claude.
2. **A saved version opens as an edit, with locked fields holding invalid pieces.**
   - The first attempt reopened an earlier saved version (`GEN-2610-31`). The page treated it as an *edit*, not a new case.
   - It locked product type and pieces (`lockSavedFields`, line 630). The pieces held `Four Seater Arm Sofa.`, which has no quantity, so "5. Save all details" refused it (line 653) and the field could not be corrected.
   - Fix used: a new case.
3. **The same message shows twice:** as the heading and in the status box. Cosmetic.

### 4.2 The planned USD 3.00 ceiling cannot work with today's ledger

The ledger holds the worst case of each call before it runs. The worst case is the model's maximum input and output, not the expected use.

| Step | Held before the call | Charged |
|---|---|---|
| Photo check (three readers together) | USD 3.18 (`lib/a7-analysis-quote.mjs`) | — |
| Planning step (recorded run 1591) | USD 4.320 | USD 0.034 |

Under a 3.00 ceiling the photo check was refused by the quote check. Planning would have been refused by the ledger, which allows a call only when committed spend plus the hold stays within the limit (`lib/a7-budget.mjs:76`). The owner raised the ceiling to USD 5.00. **Consequence:** the ledger's own stop was then 5.00, and the 3.00 line depended on the owner watching. This is a design point for the budget, not a defect in this run. The checklist's cap was set without checking it. That was a Claude error.

### 4.3 The image: framing far above 76% (FL-5) and a grey floor

The white master candidate, measured by Claude on the file (pixels darker than 200):

| Measure | Value | Target |
|---|---|---|
| Product span, width | **97.3%** (21 px from the left edge, 35 px from the right) | about 76% (rule 20) |
| Edge pixels at 254 or more | 33%; darkest edge pixel 221 (a light grey floor gradient) | pure white after the 18e3 clean-up and the 18h check |

- Visually, all 3 pieces are present, and nothing obviously invented was seen. That is Claude's judgement, not a measurement.
- **The review failed it** (history step 16: "attempt 1: failed, 1 defect(s), 0 unsure, framing 97% (outside 72–80%)"). The defect is `whole_in_frame`: "the product's box reaches the frame edge (10 of 1000 from it; the limit is 15), so part of the product is cut off by the frame". Framing is a note-only check; the cut-off is a real defect.
- The flow still opened Go 2 (a failed review goes to the owner, as designed). The owner chose **approve**, not repair. That decision is the owner's to make (rule 15). It does mean a master the review had flagged as cut off went on to the package. That is the FL-5 path, which the harness test `test_today_an_approved_cut_off_product_is_fitted_on_white` (PR #89) shows on mocks.
- Run `4f80c2bf` (20 Oct) also came out at 97.6%. There too the review failed it, and the package held because the product touched the edge (`2026-10-20-first-end-to-end-run.md:70-75`). The 18e3 fit step was added after that run.

### 4.4 The package held, and that blocks the scene (FL-4)

- *Inference from the code, not verified:* 18e3 widens the product box by 15/1000 on each side and keeps an 8 px white guard at the edges (`18e3_Clean_background.js:29, 32`). It scales a master that leaves no safe margin down to 76% on a white canvas (lines 112-147). The measured 21 px left margin is below that widened margin (about 31 px at 2048), so 18e3 very likely fitted this master to about 76% before saving. If so, the files that held were framed near 76%, not 97%. The halo came from the fitted, resampled file. On the mocks, fitted files are also where halos appear. The run record would show it (`package.white_clean.fit`); it was not read.

- **Why it held:** 18h's halo check found **2 background pixels** below 250 (darkest 249) in the saved 1125×1125 WebP. 99.97% read 254 or more, above the 99.9% asked for. The rule allows none below 250.
- **What it blocks:** a held package blocks scenes, so neither the empty room nor the placement was made.
- **What the page shows:** it keeps the old "go 2: approve…" wording on the held run, but offers no choice (`allowed: []`). The owner read this as "scene Go 2 ready". The harness test `test_today_a_held_package_offers_no_decision_and_no_scene_starts` (PR #89) shows the same thing.
- **No way to continue:** there is no Continue for a hold (FL-9).

### 4.5 A signed file link was shared in chat

- File links never expire (BE-6). A link pasted into a chat stays usable for as long as the file exists.
- Risk is low: one image of a catalogue product.
- The BE-6 proposal (PR #90) covers this.

## 5. What this means for Phase 1

| Phase 1 item | This run |
|---|---|
| **1.2** A held package gets a Go 2 decision (FL-4) | Hit directly. With 1.2, the owner could have chosen "deliver as exception", "regenerate" or "stop", and the scene would have started. |
| **1.3** Fit only a whole product; enforce 76% (FL-5) | Hit directly. The review flagged the product as cut off and framed at 97%. After the owner's approval, the package step was the only remaining guard. With 1.3, a cut-off product holds with a plain reason, instead of being fitted on white. The halo hold most likely came from that fitting (section 4.4); not proven. |
| **1.7** Continue for holds (FL-9) | Related: no Continue exists. But 1.7 covers budget holds, gate timeouts and attempt 3, not package holds; 1.2 is the path for this hold. |
| **1.1** Crash → recorded hold (FL-1) | Not triggered: nothing crashed. |
| **1.6** Scene request size (FL-10) | Not reached: no scene was made. |
| Not in Phase 1 | The halo rule's strictness (2 pixels at 249 fail a whole package) |
| Not in Phase 1 | The worst-case budget holds (section 4.2) |
| Not in Phase 1 | The page issues in 4.1 |

Suggested order unchanged: 1.1, 1.5, 1.2, 1.3, 1.6, 1.7, 1.4. This run strengthens the case for 1.2 and 1.3.

## Review
The `a7-reviewer` prompt was run as a separate read-only agent on the first draft. It made six points, all checked against the code and fixed:
- run `4f80c2bf` was misdescribed;
- the 18e3 fit step was left out;
- the briefing's cost wording was unclear;
- the 1.7 mapping was overstated;
- a citation was incomplete;
- the source of the photo-check refusal was wrong.

Separately, the run page then showed the review had failed the image, which corrected an earlier "passed".

## 6. Not verified

- The blind count's piece count and the review scores. The page shows the review result and its defect, but not those figures.
- Whether 18e3 fitted the master (section 4.4).
- The history's ingest line, "1 files registered; 0 written files read; storage not connected": not explained here. It may be old wording from before Drive was dropped. Worth a look.
- The 1125 package files: none were uploaded.
- Whether the confirmed photo facts match the photo; the owner confirmed them.
- The Railway security-notice checks.

## 7. Owner actions

1. Decide on Phase 1, item by item (`claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md`).
2. Consider the Railway security notice: provider usage, and the Postgres credential.
3. Decide whether the halo rule and the worst-case budget holds should become their own work items.
