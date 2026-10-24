# Midas A7: the first end-to-end run

**Run:** `claude-a7-4f80c2bf-fac7-4e88-80c1-2a4fded57928` (owner-preview, new project)
**Date:** 20 Oct 2026. All times are UTC.
**Product:** a sofa set of 3 × Double Seat, from one vendor photo (sha256 `b44d574f…`).
**Outputs planned:** a white master (catalogue image), then a lifestyle hero (made in stage 07, after Go 2).
**Result:** Send → Go 1 → white master → automatic review → Go 2 (owner approved as an exception) → Package held, because the image's framing left no background at the right edge. This is the first run to pass through every stage without a technical failure.

Every prompt sent to a model in this run is in the companion file:
[`2026-10-20-run-4f80c2bf-prompts.md`](2026-10-20-run-4f80c2bf-prompts.md).
The image prompt there is stored text. The other prompts are rebuilt by running A7's own code on this run's saved data, and that file says which is which.

---

## 1. Timeline

**Sources:**
- the run's trail, its vault events and the A7 operations table (n8n);
- Netlify request logs for owner-preview. Each paid call opens and closes with a budget request (`reserve` before the call, `settle` after it), so the gap between the two is the call's duration.

**Labels used below:**
- *Measured*: read directly from a timestamp.
- *Derived*: the difference between two measured timestamps.

| # | Step | What happens | Start → end | Duration |
|---|---|---|---|---|
| 1 | **Send** (site) | Owner presses Send. The site saves the version and forwards the job and the photo through the bridge. | 03:26:26.8 → 03:26:32.5 (A7 receives) | **5.6 s** |
| 2 | 01–10 Intake (code) | Intent, ingest, confirmed source proof (the readers are not re-run), route, locks, contract, Midas retrieval (12 shortlisted). | 03:26:32.5 → 03:26:33.9 | **1.4 s** |
| 3 | **11 Stylist plans** (gpt-6.1-sol) | Writes the shot plans for shot 1 (white master) and shot 2 (hero). | reserve 03:26:34.0 → settle 03:27:05.4 | **31.4 s** |
| 4 | 11b Stylist check (code) | Code checks on the plan: 0 findings. | 03:27:05.4 → 03:27:06.0 | 0.6 s |
| 5 | **11c Plan critic** (claude-sonnet-5-5) | An independent check of both plans before any image is paid for. Both shots passed. | reserve 03:27:06.1 → settle 03:27:22.3 | **16.3 s** |
| 6 | 11d Verdict, 12 Go 1 ticket (code) | Go 1 opens on owner-preview. | → 03:27:22.7 | 0.4 s |
| — | **Owner at Go 1** | Owner reads the plan and presses Go. | 03:27:22.7 → 03:27:54.2 | *31.5 s (person)* |
| 7 | 13–15 Compile, model, Drive folder, reserve (code) | The image prompt is built; the approved model is chosen; USD 0.0699 is reserved. | 03:27:55.8 → 03:27:58.1 | **2.3 s** |
| 8 | **15g White master** (gemini-nano-banana-2.1, 2K) | The image call. | reserve 03:27:58.1 → settle 03:28:25.5 | **27.3 s** |
| 9 | 15n–15q Drive upload, receipt (code + Drive) | The 2048 × 2048 image is saved to Drive and its checksum checked. | 03:28:25.5 → 03:28:30.2 | **4.8 s** |
| 10 | **16 Critic review** (claude-sonnet-5-5, 2 images) | 16 checks against the vendor photo. | reserve 03:28:30.9 → settle 03:28:48.2 | **17.3 s** |
| 11 | **16x Blind count** (gemini-3.8-flash, 1 image) | Counts the pieces without seeing the vendor photo, and returns the product box. | reserve 03:28:48.9 → settle 03:30:12.8 | **83.8 s** |
| 12 | 16b Verdict, Go 2 ticket (code) | Review result: failed on colour and on whole-in-frame. Go 2 opens. | → 03:30:14.1 | 1.4 s |
| — | **Owner at Go 2** | Owner approves the image as it is. | 03:30:14.1 → 03:33:31.6 | *3 min 17 s (person)* |
| 13 | 18 Package (code, no AI) | Held: "the protected product box leaves no safe background margin at an image edge". | 03:33:31.6 → 03:33:34.7 | **3.0 s** |

**Totals (derived):**
- Machine time: **about 197 s (3 min 17 s)**. Send → Go 1 took 56 s, Go → image took 34 s, the review took 104 s, Package took 3 s.
- Time spent waiting for the owner: 3 min 49 s, across Go 1 and Go 2.
- The two independent checks of the image take **104 s, three times the 27 s image call itself**. The blind count alone is **84 s, 43% of all machine time**.

**Where the order of steps 10 and 11 comes from:** n8n runs parallel branches one after another, in canvas order from top to bottom. `Budget · 16 · Ticket` sits above `Budget · 16x · Ticket`, so the critic review ran first and the blind count second. The budget request times match that order.

## 2. Model calls, tokens and cost

All costs are calculated from provider token counts at the registry prices. They are estimates, not invoices.

| Call | Model | Input tokens | Output tokens | USD | Duration |
|---|---|---|---|---|---|
| 11 Stylist plans | gpt-6.1-sol | 3,359 | 1,168 | 0.0184 | 31.4 s |
| 11c Plan critic | claude-sonnet-5-5 | 3,591 | 2,304 | 0.0302 | 16.3 s |
| 15g White master | gemini-nano-banana-2.1 (2K) | in Google's receipt (reserve estimate ≈2,987) | 1 image (≈1,680) + thinking | **0.0631** | 27.3 s |
| 16 Critic review | claude-sonnet-5-5 | 11,599 (2 images) | 1,937 | 0.0426 | 17.3 s |
| 16x Blind count | gemini-3.8-flash | 1,413 (1 image) | 2,310 | 0.0097 | 83.8 s |
| **Total** | | | | **0.1640** | 176 s |

**Notes:**
- No reader calls (03 Eye, 05 Second count) were made. The source reading was confirmed on an earlier version and reused through the server-verified source proof. A new photo adds both reader calls.
- The 11 and 11c call records appear twice in the vault: once at the Go 1 ticket and once at the Go 1 decision. The cost was counted once (text total USD 0.1009).

## 3. What the run showed

1. **The full path works.** Intake, the confirmed source proof, the plan, Go 1, the paid image, the review, Go 2 and the package hand-off all ran with no technical error, no hold and no budget stop.
2. **The review was right to fail the image:**
   - Colour: the fabric drifted from cool grey-blue to a warmer mauve grey.
   - Framing: the set spans 97.6% of the width, against the white-master target of 76%.
3. **Package held on the framing.** The background can't be set to pure white where the product touches the frame edge.
   - Fix: PR #54, saved as an unpublished A7 draft. A master framed too tight is now placed on a white canvas in code: scaled to 76% and centred, with no AI involved.
   - Tested on this run's real master: scale 0.779, 0 product pixels changed by the clean-up.
4. **Speed:** the white master is ready about 1.5 minutes after Send, plus the owner's Go 1 time. The review then adds 1 min 44 s before Go 2, mostly the blind count.

## 4. How to cut the time a lot

The table is ranked by seconds saved per run. The savings figures are **estimates** until measured on a live run, and each one is named as such.

| # | Change | Saves (estimate) | Risk / trade-off | Effort |
|---|---|---|---|---|
| 1 | **Make the blind count fast.** It took 84 s for 2,310 output tokens, while the larger Sonnet review took 17 s, so most of that time is not the model writing. Likely causes, to be confirmed by one timed test: the n8n Gemini node uploads the image to Google's file service and waits for it before asking; and Gemini's default "thinking" on a counting task. Fix: send the image inline through an HTTP request (as the image call already does), with a low thinking setting. | **60–70 s** | Low. Same model, same question. Keep the OpenAI fallback. | Small: one node, plus a test on 5–10 saved masters to confirm the counts don't change. |
| 2 | **Run the critic review and the blind count at the same time.** Today n8n runs them one after the other (17 s + 84 s). Running both requests together means the review takes as long as the slower one. Two ways: one code step that sends both requests in parallel, or start each as its own sub-run and wait for both. | **15–20 s** (after change 1); 17 s today | Low. The budget reserve and settle stay per call. | Medium. |
| 3 | **Plan only the white master before Go 1; plan the hero after Go 2.** The hero image isn't made until stage 07, after Go 2, but its plan and its critic check run before Go 1. The white master's plan is mostly fixed by code (white background, no props, vendor view). | **≈40 s before Go 1** (most of the 31 s planner + 16 s critic) | Medium. Go 1 would no longer show the hero plan. The owner would approve the hero plan at a later Go 1-style step, or at Go 2. **Owner decision.** | Medium. |
| 4 | **Skip the paid plan critic when the plan is code-made and the code checks found nothing.** This applies to a white-master-only plan, where the critic adds little. Keep the critic for scene plans. | **≈16 s** (and USD 0.03) | Low for white masters; not recommended for scenes. | Small. |
| 5 | **Lower the planner's reasoning effort** (gpt-6.1-sol) for white masters and standard heroes. | **10–20 s** (to measure) | Medium: plan quality must be checked on a few runs. | Small (one setting). |
| 6 | **Run the two readers (03 Eye and 05 Second count) together** on new photos. They are independent, like the review pair. | **≈15–30 s per new photo** (not in this run) | Low. | Medium, same pattern as change 2. |
| 7 | **Avoid repairs by fixing framing at the source.** This run's image filled 97.6% of the width. The prompt asks for 76%, but the model ignored it on a wide set. Ask for a 4:3 or 3:2 frame for wide sets, then pad to square in code (as PR #54 now does), instead of asking for a square 1:1 frame. | **One whole repair cycle (≈2.5 min + USD 0.07)** whenever it would have failed | Low. The framing is set in code; the product is not redrawn. | Small to medium. |
| 8 | Smaller items: the budget round trips (about 0.4 s each, 10 per run ≈ 4 s), the Drive upload (≈5 s), and the site's forwarding (≈5.6 s). | ≈5–10 s | — | Not worth doing first. |

**Expected effect (estimate) if changes 1, 2 and 4 are made:**

| Segment | Today | After (estimate) |
|---|---|---|
| Send → Go 1 | 56 s | ≈40 s (≈15 s with change 3) |
| Go → image saved | 34 s | 34 s (model-bound) |
| Image → Go 2 | 104 s | ≈20–25 s |
| **Machine total** | **≈197 s** | **≈95–100 s, about half** |

With change 3 as well, the machine total is about 75 s (15 + 34 + 22 + 3).

**What does not get faster without changing quality:**
- The image call itself (27 s at 2K).
- The critic review (17 s).

Neither should be cut: they make and check the product.

## 5. Recommended order

1. **Change 1** (blind count inline, low thinking). It is the biggest win at the lowest risk. Measure once on the saved master from this run; don't pay for a new image to test it.
2. **Change 2** (review pair in parallel).
3. **Change 4** (no plan critic for code-made white-master plans).
4. **Owner decision on change 3** (plan the hero after Go 2).
5. **Change 7** (wide sets framed wider, then padded in code), together with PR #54.

## 6. Status of fixes from this run

| Item | State |
|---|---|
| PR #54: Package fits a too-tight master on white instead of holding | Draft PR open; n8n draft saved and verified identical to the repo; **not published** |
| Run `4f80c2bf` package | Held. The approved master is unchanged in Drive. The current owner-preview package-recovery path is a one-off for an earlier run, so re-packaging this run needs either a new recovery or a new version. |
| Run `34b37efe` (edit of this run: hero from 45° right) | Waiting at Go 1 since 03:44:05. It runs on the version it started with, so it doesn't include the PR #54 fix. |
