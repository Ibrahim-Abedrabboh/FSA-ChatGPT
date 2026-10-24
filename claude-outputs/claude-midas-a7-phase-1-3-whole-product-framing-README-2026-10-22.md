# Midas A7, Phase 1.3: fit only a whole product; 76% on delivery (22 Oct 2026)

Written by Claude for the owner. You said "go, start 1.3 and 1.5" on 22 Oct. This changes flow behaviour on the Python service, so it waits for your review and merge. Nothing is deployed. The owner site `claude-final-midas-a7` still calls n8n, where nothing changes.

## What it fixes (FL-5)
- **A cut-off product was delivered as ready.** If the white image cut the product off at the edge, the package scaled it down onto white and delivered it. On 22 Oct the review failed the image for exactly this (cut off, 97% of the width).
- **The 76% rule was not enforced on the delivered file.** A white image at about 90% was delivered unchanged.

## What changes
The white catalogue files are delivered only when the product's longest side spans **76% ± 3 points** (73–79%) of the frame (rule 20).

| The product in the approved white image | What happens |
|---|---|
| Within 73–79% | Delivered as it is, as before |
| Above 79%, or too tight to clean, and the review of **this exact image** found it whole | Scaled down in code onto a white canvas, to 76%. No AI and nothing redrawn. The span is checked again after the fit |
| Above 79% or too tight, but the review found it **cut off**, was **unsure**, or did not review this image | **Holds** with a plain reason. It is never scaled. A cut-off product is never delivered (rule 17) |
| Below 73% | **Holds**. It is never enlarged |

**All of this needs the product box from the review's blind count.** With no usable box, the package step works as before: the master is packaged with its own background, unscaled, and the band is not checked. The skipped steps are listed in the package. So a product the blind count flagged as cut off without giving a box is still delivered if you approve it.

These framing holds are plain holds. They do not open the Phase 1.2 decision, which is only for the faint grey edge. A cut-off image needs a repair, which you order at Go 2 before approving.

Design choices you approved: the rule, and the ±3 tolerance. The tolerance is 3 by default in the package step. A setting (`framing.white_delivery_tolerance_pts`) can change it later. The settings node itself is unchanged, so the run 1591 parity test stays as it was.

## A change you should know about
An image you approve **without a review** (the choice offered only when the reviewers did not answer twice) has no confirmed whole-in-frame result. If such an image needs fitting (above 79% or too tight), it now holds instead of being fitted, and that job cannot go further: start a new job.
- This follows rule 17: nothing confirmed the product is whole.
- If you prefer, I can make the package fall back on the blind count's own box test for this case (the box well inside the frame, and no "cropped" flag), the same test the review uses. Say so and it rides a small follow-up.

## How it is built
Flow patches in `tools/n8n_to_flow.py`, regenerated, with each reason in `manifest.json`:
- `18a Package ticket` carries the tolerance and whether the review **bound to these bytes** found the product whole (no crop, no disagreement).
- `18e3 Clean background` applies the table above and writes a plain reason when it holds.

## Verified (22 Oct 2026, dev container, mocked; no paid call)
- In `tests/py/test_claude_phase1_past_go1.py` (all pass):
  - a whole product at about 90% is fitted and delivered at 73–79%, measured on the delivered JPG;
  - a product at 76% keeps its framing;
  - a product at about 60% holds with "below 73% … never enlarged", and no new image call;
  - an approved cut-off product holds, names the cut-off, and is never fitted.
- The two "today" tests and the two expected-failure markers for FL-5 were removed.
- `python -m pytest -q`: 250 passed, 2 skipped, 3 xfailed (after the review fixes; one more test for an "unsure" review). The run 1591 replay is unchanged (it never reaches the package).
- ruff 0.8.4 clean; `midas-a7 check` reports all node types handled; regenerating the flows gives no diff; all 21 A7 suite steps pass.

**Not verified:** a real run. The box used for the measurement is the review's product box. The test measures the delivered file's pixels too, but on a stand-in image.

## Review
An independent read-only review found six points, all checked against the code:
1. **Told to you above:** an image approved without a review now holds if it needs fitting.
2. **Fixed (docs):** the README and status page now say the rule needs the review's product box.
3. **Fixed:** the briefing still said 1.2 was a draft.
4. **Fixed:** the after-fit check now runs before the image is resampled, and gives the "never enlarged" reason when that is the cause.
5. **Fixed:** a tolerance of 0 can now be set. The skipped-step note names 76% ± 3. **Not changed:** the review's own note band (72–80%, your decision D9 of 16 Oct) stays, so a review may call an image "within" while the package holds it at 72% or 80%.
6. **Fixed:** the status-page wording.

## What you do
Review and merge, then deploy when no run is active. 1.5 is a separate PR. Whichever you merge second, I will bring the latest `main` into it first.
