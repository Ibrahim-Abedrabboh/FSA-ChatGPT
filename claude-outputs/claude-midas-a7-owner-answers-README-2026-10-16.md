# Claude · Midas A7: owner answers of 19:26 — README

16 Oct 2026, 21:2x Amman. Written by Claude.

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", id `1cgZc9rmBOrPdKIe`.
- Current draft: **`b187e58d`** (183 nodes). It was built in 5 versions ("Owner answers 19:26, 1/5" to "5/5").
- **Not published.** `active` is false and there is no active version (read back 16 Oct, 16:54 UTC).
- **No run was made.** Nothing was paid for.
- Code is in the repo: branch `final`, commits `5197d0c` (code) and `4ae868f` (export of `b187e58d`).

## What changed

1. **White master approved by eye, with no product box.**
   - The master is now packaged instead of held.
   - The manifest and the owner view show "Approved by the studio · not reviewed".
   - Two steps are skipped, and each skip is listed in `skipped_steps`: background clean-up and the framing band.
   - The master's own background is delivered. The package says so: "background not set to 255: no product box from the review…".
   - The saved files' edges are measured and reported. The 255 rule and the halo check are not applied on this path.
   - Changed nodes: G2, 18a, 18e3, 18h, 18l, 18p.
2. **Room heights for small products.**
   - The rule is now "camera near the product's mid-height, at the same angle as image 1".
   - Table or console: 75 cm.
   - Low coffee table: about 55–60 cm. This is a starting value, to be checked in the first test.
   - 120 cm is no longer used for small products.
   - The surface is read from the plan's words. When a height with a unit is supplied, half of it is shown.
   - Changed nodes: 04 Settings, 19a, 13.
3. **Fade around the product box.**
   - 18e3 now measures how far the fade reaches outside the box.
   - It stops the package if any pixel beyond the margin changed, or if any background pixel beyond the margin is not exactly 255.
   - Nothing inside the box is changed (as before).
4. **The 99.9% edge rule and the grey halo, measured on the saved files.**
   - 18h checks the saved jpg and the saved webp after saving.
   - If the jpg fails only because of compression, a new path saves it again at quality 100 and checks it again. The new path is 18f9 "Make jpg at quality 100" and 18g3 "jpg100 to pixels", placed between 18g2 and 18h.
   - The file that passes is delivered, and its quality is recorded.
   - A wrong format or a wrong size gets no second try.
   - Halo check: background pixels at 255 in the cleaned picture, and 2 px or more from the product, must read 250 or more after saving. At least 99.9% of them must read 254 or more.
5. **D13: reader prompts.**
   - 03 and 03b (the photo reader and its fallback) and 05 (the second count) now say: pieces of one set photographed apart count once each, with a relation saying they belong together; modules count once per joint or gap; seat and back cushions are not pieces; "cropped" means cut off by the frame; "hidden" means covered.
   - 04-06 Evidence keeps the two apart. A piece marked cut off is a crop flag, still checked against its box. Hidden parts become unknowns ("not confirmed").

## What was checked, and how

- **Local tests:** all 15 suites pass (87, 42, 13, 9, 78, 36, 103, 68, 58, 70, 88, 79, 1, 82, 45). The new suite is `tests/claude-midas-a7-phase-1b` (45 checks).
- **Real-file check on the Test 10 master, with local GraphicsMagick:**
  - Fade margin 68 px, reach 68 px, 0 pixels changed beyond it.
  - jpg: 0 halo pixels below 250, 99.99% at 254 or more.
  - webp: 100%.
- **Read-back of `b187e58d`:**
  - All 58 code nodes are byte-identical to the repo.
  - All 5 model prompts are identical (ignoring a final newline).
  - The wiring is 18g2 → 18f9 → 18g3 → 18h, and both new nodes are in the "Stage 06 · Package" group.

## Not checked

- **Edit Image on n8n Cloud:** the quality-100 jpg path (18f9, 18g3) has not run there.
- **Real model replies** to the new prompts have not been seen. That is what reader test 3 is for.
- **Failure on the new path:** if 18f9 fails, the item may lose its files, and the package then holds as "not made". This has not been tested on Cloud.

## Assumptions

- Halo thresholds: 2 px, 250, and 99.9% at 254 or more. They were derived from Test 10 only.
- Low tables are recognised by words such as "coffee table" or "low table" in the plan.
- A supplied height is used only when it has a unit.

## Open questions for the owner

- Should a **scene** approved by eye also be shown as "Approved by the studio · not reviewed"? Only the white master was changed.
- For items on a table or console, should the camera go to the console plus half the item's height? Example: a 63 cm lamp on a 75 cm console gives about 106 cm.
- Should the blind-count prompts in 16a get the same "cropped" and "hidden" definitions?
- **D11:** the guide fixes ("Fixes below") did not arrive in the message.

## Leftovers

- No test rows were written. No scratch workflows were made for this build.
