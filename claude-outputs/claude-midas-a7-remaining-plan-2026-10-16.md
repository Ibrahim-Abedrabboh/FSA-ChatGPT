# Claude · Midas A7: plan for the remaining work

16 Oct 2026, 11:15 Amman. Written by Claude. Testing has stopped (owner, 11:09). This plan lists what is left, in order. Nothing here is built, run, published or paid until the owner says so.

## Where A7 stands now (checked in n8n, 16 Oct 2026, 11:1x)

- **A7** "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`. **Not published.** Its current draft is `ad7d33eb` (fallback readers). Update 16 Oct 2026, 17:15: the current draft is now `e584d5ed` (Phase 1, below). It has never run. The last version that ran for real is `006de87c`.
- **Proven by the first paid test** (job `-06`, execution 454):
  - intake, plan, go 1;
  - the white master call, its review, go 2 and the package;
  - the empty room, the live Midas stock read and the placement.
- **Not proven yet:**
  - the scene review, a scene's go 2 and the scene delivery files;
  - a repair;
  - other lights, other views and series;
  - a person in the scene;
  - the fallback readers;
  - a second product.
- **Older workflows that were published at 11:15** (`active: true` in n8n). Update 11:3x: see D2 below. Pipeline 3 and white clean-up are still published.
  - pipeline 3 `LCkfLFMQS5MjA5FQ`;
  - "job request pipeline" `nz0MH8SFeCFJpt0K`;
  - "variations" `XvdiJKSllFsMyad5`;
  - VTON A6 `FPAF0QHltl8iIcdZ`;
  - white clean-up `MSU2K5WKKfizCapW`.

  The project instructions still say "Current working pipeline: [fill in]", so Claude does not know which of these the client page uses today.

## Phase 0: Owner decisions (no cost; they unblock the rest)

Each decision has Claude's recommendation. The owner decides.

| # | Decision | Claude's recommendation |
|---|---|---|
| D1 | Which pipeline is live for clients today (the "[fill in]" line) | Name it, so nothing live is touched by mistake |
| D2 | Older published workflows (list above) | Unpublish the ones no client uses; keep them as history. Unpublishing needs the owner's go in that message |
| D3 | Unreviewed scene (the `-06` hold): how can the owner approve it? | Add a "review again" choice at the hold. It makes one review call on the stored image and makes no new image |
| D4 | White background at about 253, not 255 | Clean the background to 255 in code, keeping the contact shadow, on the delivery files only. The approved master stays untouched in the vault. Reuse the logic of the existing white clean-up workflow. No AI |
| D5 | Other styling checks (light, camera level, scale, grounding, realism, only listed props): fail, or note like framing? | Keep them as fails. They protect fidelity and trust. Only framing stays a note |
| D6 | A product cut off by the frame in a hero or wide view | Keep it as a fail |
| D7 | Later views made from the approved wide image (shared room) | Keep it |
| D8 | Lifestyle + Category template plans the same 4 images as Website | Owner to confirm it is intended |
| D9 | Assumptions to confirm: warm 3000 K, night 2700 K, camera height 120 cm for other rooms, white framing band 72–80%, detail "most" = more than half, raised camera from 9 dining pieces | Confirm or change each |
| D10 | Pre-order pieces in scenes (decision 28, open) | In-stock only, for all pieces, since stock is the truth |
| D11 | Profiles table wording (43 rows, `FZJg1MHUh2lcIV1H`), including bed guidance | The owner reviews it; Claude applies the edits |
| D12 | Side-view series on the page while the page takes one photo | Show them as "Coming later" until F4 (P5.3) is built |
| D13 | Photo reader prompt change (pieces of one set photographed apart; split "cropped" from "hidden") | Yes, with the retest in P2 |
| D14 | Test leftovers (sender `Omb5qvpJIJvJty7T`, reader test 2 `Q7IlyqUHtmEu7kEH`, runs rows 31–36, ops rows 2–5, vault rows, Drive run folders) | Archive both workflows. Keep the rows and files as the audit trail of the first paid test |
| D15 | Not built and not decided: SKU tiers (Tier 1/2/3), SSIM as a code check, material maps, frontal view from angled photos, measurement infographic, colour variants | Leave them out of version 1. Decide after go-live |

### Decisions recorded, 16 Oct 2026, 11:3x Amman

**D1: pipeline 3 is live for clients.**
- The live pipeline is "Claude · Midas job request pipeline 3", `LCkfLFMQS5MjA5FQ`. The project page `midas-studio-site-regenerate/app.js` sends to its `/webhook/claude-midas-studio-3…` addresses.
- **Owner action:** set the project instructions' "Current working pipeline" line to pipeline 3. Claude cannot edit the project instructions.
- **Finding (not fixed):** n8n cannot load pipeline 3's full details. It reports that credential `9Rrf1S4GHPgftmJA` ("Header Auth account") could not be found. Pipeline 3's nodes still refer to that credential, most likely the owner key check on its addresses.
  - If so, the live page's requests may be refused or may fail. Claude did not send a request to check.
  - Pipeline 3 is published, so it is not edited in place.

**D2: unpublished by Claude at 11:3x Amman, on the owner's go in the answer.** n8n now shows each of these as not active:
- "Claude · Midas job request pipeline variations" `XvdiJKSllFsMyad5`
- "Claude · Midas job request pipeline" `nz0MH8SFeCFJpt0K`
- "Claude · Midas VTON · Option A6" `FPAF0QHltl8iIcdZ`
- "Hero shot — photo only" `BqIv4OKP4hSZcRvH`
- "Cursor - image processing" `XwMygMivS6hNpeVg`

Before unpublishing, Claude checked that pipeline 3 calls none of these. Pipeline 3's only call to another workflow is to white clean-up `MSU2K5WKKfizCapW`, which stays published.

Published workflows that are still running, outside this project: "Competitor Intelligence | Dynamic Intake (Foundation)" `PS3VCZ8zpiTFm57d` and "WF-07 | Google Search Intelligence — Apify API" `t5E45gcKKTzsj9Wc`. Not touched.

**D3: "review again", with the owner's three conditions.**
1. **Cause first.**
   - In execution 454 the scene's blind count got "Service unavailable" (503) from Gemini on all 3 tries, over 38 s.
   - This was a technical failure, not a box format the code could not read. The same reader's box on the white master in that run was readable: `[336,97,698,902]`.
   - The cause is already addressed in the draft `ad7d33eb`: 5 tries, then the gpt-6.1-sol fallback.
   - **New finding:** the scene's critic review (Claude) did answer in execution 454: fidelity 88, framing 79% against 40–55%, realism "unsure", and the runner hangs oddly. But 16b dropped that answer from the record when the blind count failed (`review.result` empty, `checks` empty). Fix in P1.10.
2. **Limit and cost.** One "review again" per image. It runs only the review and the blind count on the stored image, with no image call, and shows its estimated cost before it runs.
3. **Owner override.** If the second review also fails, the hold stays, but the owner may approve by eye. This is recorded as "approved by owner without an automated review" and is never shown as a passed review.

**D4: background set to 255 on the delivery files only, with the owner's five conditions.**
1. **What is reused from the white clean-up workflow:**
   - the soft tone curve to 255 (white point and knee);
   - the background sample from the outer edge band;
   - the near-white share check;
   - the edge check after saving.
2. **What is not reused:** that workflow finds the product with a paid fal.ai background-removal model (BiRefNet) and uploads to fal storage. Under the "no AI" decision, A7 does not reuse that part.
   - Instead, only near-white pixels connected to the image border are changed (a flood fill from the border). Pixels inside the product are never changed, so a white or ivory product keeps its edges.
3. **Contact shadow:** anything clearly darker than near-white is outside the fill and stays as it is.
4. **Check after saving:**
   - Files are saved at high quality.
   - The final jpg and webp are read back.
   - The check confirms their edge rows read 255.
5. **Manifest:** it says "background set to 255". The approved master is untouched.

D5–D15 are still open.

### Decisions recorded, 16 Oct 2026, 11:45 Amman (D5–D10, D12)

- **D5 (C):** fail only on a prop or piece not in the plan, floating or poorly grounded furniture, clearly wrong scale. Note only: light, camera level, realism, framing. A failed scene still reaches the owner's go 2 with its reason; nothing repairs itself.
- **D6 (A):** cut-off product fails in hero and wide views; checked in code from the blind-count boxes (box touching the frame edge), not only by the reviewer.
- **D7 (A):** shared room kept; the wide image guides room, light and arrangement only; identity comes from the vendor photo and the approved white master.
- **D8 (B):** Lifestyle + Category template = white master + hero. Wide and close-up only when chosen in Views.
- **D9:** confirmed 3000 K, 2700 K, 72–80% (target 76%, longest side), detail > half. Camera height 120 cm for room-scale furniture only; tabletop accessories and lamps near product height at the vendor angle; no height line for detail views. The 9-piece raised camera is a starting rule; a 12-chair dining set joins the first paid scene test (P4); a small downward tilt is allowed for large dining sets only, if chair backs are hidden.
- **D10 (A):** in stock only, every piece, Kuwait /en/ pages only.
- **D12 (A):** both side-view series "Coming later" on the page until it takes other-side photos.

Still open: D11 (profiles wording), D13 (reader prompt, Phase 2), D14 (leftovers), D15 (later items). None blocks Phase 1.

### Phase 1 review (independent reviewer, 16 Oct 2026, 12:3x Amman; read-only, nothing run against n8n)

The code in commit 3bd0a06 is not deployed. Fix these before deploying (the new Phase 1 chat acts on them):

**High**
1. **18e3 flood fill can change a pale product.**
   - **Problem:** the fill crosses steps of 6 or less. The only leak guard is the centre square. In a simulation, an ivory side panel away from the centre, shaded gradually from 251 to 236, was fully brightened. The result still said `product_pixels_changed: 0`.
   - **Fix:**
     - Grow the fill only through pixels at or above the white point, then apply the curve to a 2–3 px band around it.
     - Forbid changes inside the product box (`box_2d` from the approved review), except a strip below it for the shadow.
     - Measure, rather than assert, the product-pixel claim.
     - Add a soft-edged, off-centre ivory test.

**Medium**
2. **"Not reviewed" also covers rounds where no reader was called.** This happens when 16a was not ready, for example when an image was missing. Review again would fail the same way, and 18l/20k would say "the review did not answer, twice".
   - **Fix:** `notReviewed = rv.ready && fail && rv.candidate`; hold otherwise. Correct the stage-05 test.
3. **The empty-room prompt for a lamp or accessory names "image 1".** The room call has no images.
   - **Fix:** give a concrete camera level for the room phase (the height of the surface the product will stand on). Keep `height_rule` for placement only.
4. **19a's small-product word list can catch room-scale furniture** (for example "TV unit with LED lights").
   - **Fix:** decide from `profile.id` first; use words only when the profile is unknown.
5. **The box rule turns a reader's "cropped" into a note.** For scenes, one blind-count box is then the only crop signal.
   - **Fix:** keep "cut off" when the box is at the edge. When the flag is set but the box is inside, record `unsure` (not passed), not a note. This follows the owner's "not only by the reader's flag".
6. **18h accepts 99% of edge pixels at 255 with no floor on the rest, and does not check the read-back size.**
   - **Fix:** require 100%, or 99.9% with the darkest value at 254 or more, and check 1125 x 1125.

**Low**
7. **`go2_decisions` sits at the end of the run row's review JSON.** That JSON is cut at 60,000 characters, which could drop the decisions.
   - **Fix:** put the decisions in their own field, or first.
8. **Not-reviewed tickets list light, camera level and realism fails as defects, and show scores.**
   - **Fix:** route those three to notes; leave out or label the scores.
9. **19c `sizeOnly` can read the word "in" as the unit.**
   - **Fix:** take a unit that sits next to a number, preferring cm or mm.
10. **Page draft 2 still says "2 to 10 images" and "or a series"** (lines 57 and 66).
11. **Owner to confirm:** scenes still fail on `no_text_or_logo`, `people_ok` and `midas_pieces_match`. These are not in D5's list. Claude's reading is that they are identity and rule checks, not styling.
12. **Review again is once per attempt** (per candidate), not once per output. It is bounded in both G1b and G2.

**Test gaps**
- 18h's BMP reader has not been run on the 32-bit BMP with colour masks that GraphicsMagick writes for a master with transparency.
- These are checked only by matching words in the source, not by running the code: 15b, the 18e text cost, 18l, 20a/20k and the room-context warning in 12.

**Checked and fine**
- No `$()` call to a node that has not run.
- Raw and simplified replies of all three providers parse.
- A reply without token counts is recorded as unpriced, never as zero.
- Review again runs at most once per attempt.
- `approve_unreviewed` is offered only after a review again that also failed.
- Packages and scene files accept only an approval recorded as the owner's.
- The stock rule, the D8 views and the page's "Coming later" series work as the decisions say.

### Decisions recorded, 16 Oct 2026, 19:26 and 21:07 Amman

- 1: a white master approved by eye with no product box is packaged, labelled "Approved by the studio · not reviewed"; no background clean-up; skips listed. Built in A7 draft `b187e58d`.
- 2: small products: camera near the product's mid-height at image 1's angle; 75 cm on a table or console; about 55–60 cm on a low coffee table (check in the first test); no 120 cm. Built.
- 3: fade accepted inside a small margin; 255 beyond it; product unchanged; halo checked on the saved files. Built.
- 4: 99.9% edge rule measured on the saved jpg and webp; a jpg that fails on compression is saved again at quality 100. Built.
- D13: reader prompts changed (apart pieces once each with a relation; modules per joint; cushions not pieces; cropped vs hidden). Built in 03, 03b, 05 and 04-06.
- D11: A7 edits so far approved; the guide fixes did not arrive in the message — waiting.
- D14: test workflows archived; rows and files kept. Sender `Omb5qvpJIJvJty7T` archived. Reader test 2 `Q7IlyqUHtmEu7kEH` was archived at about 20:55, before the 21:07 instruction to wait; the owner is asked to unarchive it in n8n so test 2's per-photo crop flags can be read.
- Reader test 3 (21:07): prompt only changed; same photos, sheet, model (gpt-6.1-sol) and settings as test 2; new fields scored; side by side with test 2; paid, waits for the owner's go. Built as `YRl8RlplXULsrMyY` (not run). See `claude-midas-a7-reader-test-3-README-2026-10-16.md`.

### Decisions recorded, 16 Oct 2026, 21:28 and 22:06 Amman

- **21:28:**
  - Reader test 3 run, cap USD 1 (execution 461, about USD 0.18, 10 of 10 photos).
  - D11 guide fixes (table v2 `AgXKkFbIj5dQAnvn`).
  - Scenes approved by eye: "Approved by the studio · not reviewed"; the client sees "Approved by the studio".
  - Tabletop camera = surface height + half the product's height, tilt 0.
  - The blind count uses the reader's cropped and hidden definitions.
  - All of this is built in A7 draft `eefd6c42`; not published, not run.
- **22:06:**
  - Test 3 = 6 modules; the white piece is context.
  - Re-scored: reader test 3 is right on 9 of 10.
  - Reader test 4 is one prompt change: the narrowed "pieces of one set" rule with role "uncertain", the kind definitions, and the Test 3 counter-example. It is one paid run, about USD 0.18, cap USD 1.
  - **Pass:** Test 8 = 1; Test 5 kinds = 2 sofas + 2 armchairs; Test 3 = 6 with the white piece context or uncertain; no photo worse than test 3. If anything gets worse, stop.
  - A7 keeps the pre-D13 reader prompt until it passes; D13 is pending. Phase 2 stays undecided until the reader passes.
  - The run moves to a new chat: `claude-midas-a7-phase-2-start-prompt-2026-10-16.md`.

## Phase 1: Fix the known findings in A7 (free; local tests and pinned data only)

**Status, 16 Oct 2026, 17:15 Amman: done in a draft.**
- P1.1–P1.10 and the review findings 1–10 and 12 are in A7 draft `e584d5ed-52c0-4a49-9da2-5c833b5e1b48`. A7 is not published.
- Nothing was run in n8n, and no paid call was made.
- Finding 11 (owner): scenes keep failing on `no_text_or_logo`, `people_ok` and `midas_pieces_match`.
- All 58 Code nodes are byte-identical to the repo. All local suites pass.
- Details, what was not checked, and three owner questions: `claude-midas-a7-phase-1-README-2026-10-16.md`.
- P1.1 is tested locally only. Its live proof waits for Phase 4.

All of these go into one new A7 draft version. Nothing is published.

| # | Fix | Source | Done when |
|---|---|---|---|
| P1.1 | "Review again" path for a scene held without a review (after D3) | Finding 2 | Local test: hold, then review again, then go 2 |
| P1.2 | The go 1 ticket warns when the plan could still hold at stage 04 (the crop, count and type checks) | Finding 3 | Test: the warning text shows on a risky plan |
| P1.3 | Operations row `settings` records the synchronous call (`store: false`, no background) | Finding 4 | Test reads the row shape |
| P1.4 | 19c size line: remove the page junk ("&diams; … Add to Cart …") and the HTML entities. Fix the grammar slip "as Provide …" | Finding 5 | Test with the saved Midas page text from execution 454 |
| P1.5 | Stale go 2 reply ("Scene images and the delivery package are not built yet") | Finding 6 | Text matches what A7 now does |
| P1.6 | Wide framing: stronger prompt line for wide 40–55% (the test scene was about 79%) | Finding 7 | Prompt check. The effect is only seen in P4 |
| P1.7 | White background clean-up on the delivery files (after D4) | Finding 8 | Code test: background 255, shadow kept, product pixels unchanged |
| P1.8 | Record token counts for every text and vision call (readers, checks, planners, critics, reviewers), so a run's full cost is measured, not estimated | Cost gap | Each call writes a receipt row with its tokens |
| P1.9 | Apply D5–D10 and D12 | Phase 0 | Tests updated |
| P1.10 | 16b keeps the critic's answer when the blind count fails. The hold still stands, but the record shows what the critic saw | Execution 454 (found 16 Oct) | Test: blind count error, critic answer kept in `review.checks` |

Each fix is checked by:
- the local suites;
- a byte check of every Code node against the repo;
- a README.

## Phase 2: Photo reader prompt (paid; about USD 1, owner's go needed)

- **P2.1** Change the reader prompt (after D13). Pieces of one set may be photographed apart in one image. "Cropped" means cut off by the frame; "hidden" means behind another piece.
- **P2.2** Rerun the reader test on Test 1–10 with Gemini and gpt-6.1-sol, scored against the owner's truth sheet.
- **Done when:** both readers are scored on all 10 tests. The register records whether gpt-6.1-sol now gets Tests 1, 2 and 6.
- If the new prompt does worse on any test, keep the old one.

## Phase 3: Data (free; no AI)

- **P3.1 Fuller catalogue.** Read more than page 1 of the 19 Accessories categories: today 412 of about 2,082 items. Keep the 10 s gap the site's robots.txt asks for.
- **P3.2 Scheduled refresh.** The refresh workflow `mGgKxO0638I77meF` exists. A schedule needs publishing, so it needs the owner's go.
- **P3.3 Facet vocabulary** (fabric, material, table top, colour family, handles) from the project's taxonomy snapshot, unchanged. It goes into the spec card as supplied facts only.
- **P3.4 Missing fields.** Size and finish stay "not confirmed" until a Midas source gives them.
- **Status, 16 Oct 2026, 23:50 Amman** (see `claude-midas-a7-phase-3-README-2026-10-16.md`): owner chose P3.1 skip and P3.2 not now. P3.3 is blocked: the taxonomy snapshot holds no facet values, so all facets stay "not confirmed"; a mapper and a spec-card proposal are ready. P3.4 audit done as a report: the 412 imported rows are clean; findings on hand rows only (SANOVA 161283, stock on 174770 and 174788, three finishes read by eye). No row or workflow changed.

## Phase 4: Second paid test (owner's go and spending cap needed)

It goes ahead only after Phase 1, and after Phase 2 if D13 is yes. The aim is to prove what the first test did not.

- **Product:** a different one from Test 10, for example Test 6 (6 bedroom pieces) or Test 8 (the bed only), **plus a 12-chair dining set** (owner, D9).
  - **Update, 17 Oct 2026, 01:04 (owner): Phase 4 runs Test 8 only. The dining set is parked.** The only dining photo (reader Test 9, sha256 `f682e323…8ac5`) is cropped and shows 7 of the 13 pieces, so A7 would hold it at step 13. The dining job waits until the owner supplies a vendor photo that shows the whole table and all 12 chairs. When it arrives, the reader count is checked against 12 chairs (10 armless + 2 armchairs) plus the table, before any paid image call. A cropped brief is never used, and no chair the photo does not show is ever added. The raised camera for large dining sets (D9) is therefore not tested in Phase 4.
- **Brief:** Category template (hero, wide and detail), so the shared room, three scene reviews and three scene go 2s are tested.
- **Repair:** at least one repair, ordered by the owner at go 2.
- **Light:** one image in night or warm light.
- **Delivery:** the scene delivery files (jpg and webp at the scene's shape).
- **Expected image cost** (estimate from 16 Oct receipts):
  - white master about USD 0.06;
  - empty room about USD 0.06;
  - 3 placements about USD 0.20;
  - 1 repair about USD 0.065;
  - total about **USD 0.40**.

  With P1.8 built, the text and vision calls are measured for the first time. Suggested cap: **USD 3** for the whole test.
- **The owner's part:** publish A7 for the test, give go 1 and go 2, then unpublish.

## Phase 5: Client page (free; mock mode only)

- **P5.1 Result address.** A7 gets a result address the page can read: status, then "Generated image", then "Approved" only from the owner's recorded decision.
- **P5.2 Connect page draft 2.**
  - Connect it to A7, offering only what A7 delivers. Everything else shows as "Coming later".
  - No internal terms. No promised delivery time, pixel size, retention or human stylist.
- **P5.3 F4.** Room photo and other-view photos on the page. This lets side views run instead of hold. When the client sends a room photo, a note says the light comes from that photo.
- **P5.4 Verify in mock mode.**
- **P5.5 Arabic.** Arabic copy and the package description need a native review before use. Claude can draft them; the owner arranges the review.

## Phase 6: Go-live readiness

- **P6.1 Publish A7.** The owner's go, after Phase 4 passes.
- **P6.2 Retire the older pipelines** the client page no longer uses (after D1 and D2).
- **P6.3 Error alerts.** A workflow that tells the owner when a run fails or waits too long at a hold.
- **P6.4 Batch.** One job per item, sent one after another, with a daily image limit (A6 had one).
- **P6.5 Clean-up and handoff.**
  - Archive the test workflows.
  - Update the project instructions' "Current working pipeline" line.
  - Write a final README.

## Order and dependencies

1. **Phase 0 decisions.** Everything else waits on D1–D4 at least.
2. **Phase 1 and Phase 3** can run side by side. Both are free.
3. **Phase 2** (paid, small) after D13.
4. **Phase 4** (paid) after Phases 1 and 2.
5. **Phase 5** can start after P1.1 and runs in mock mode, alongside Phase 4.
6. **Phase 6** after Phase 4 passes and the page is verified.

## What this plan does not cover

- VTON (customer try-on): not A7, by scope.
- Video, 3D and advertising formats: out of scope (owner, 16 Oct).
- Changes to any published or earlier pipeline in place: never. Every change is a new draft.
