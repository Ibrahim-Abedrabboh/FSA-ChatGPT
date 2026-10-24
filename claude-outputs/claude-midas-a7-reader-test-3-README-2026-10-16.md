# Claude · Midas A7 reader test 3 (D13 prompts) — README

16 Oct 2026, updated 22:3x Amman (re-scored against the corrected sheet). Written by Claude.

## Status

- **Workflow:** "Claude · Midas A7 reader test 3 (D13 prompts)", id `YRl8RlplXULsrMyY`.
  - Version `6311040f`, 12 nodes, manual trigger only, in the owner's personal project.
- **Not published.**
- **One dry run:** execution 460, with the reader switched off (no paid call). It proved the photo loop, the budget stop and the scoring after a stop.
- **One paid run:** execution 461, 18:34–18:40 UTC, with the owner's go at 21:28 (cap USD 1).
  - All 10 photos were read. The cap did not stop anything, and there were no errors.
- **Writes:** none. No table was written; the results stay in the execution and in `n8n/claude-midas-a7-reader-test-3/results-execution-461.json`. The run id is `claude-rt3-20261016183433`.
- **Source:** in `n8n/claude-midas-a7-reader-test-3/`:
  - `workflow-YRl8RlplXULsrMyY.json` is the export of `6311040f`.
  - `code-nodes/` holds the code nodes. Each matches the export byte for byte.
  - `reader-test-3.sdk.js` is the first shell, from before the loop was added. It is kept for history only.
  - The prompt is A7's `model-prompts/03_Eye_photo_reader.txt` (draft `b187e58d`).

## Same as reader test 2, apart from the prompt (owner, 21:07)

| | Reader test 2 (execution 459) | Reader test 3 (execution 461) |
|---|---|---|
| Photos | Drive > Testing, Test 1–10, `main.*` | same (the same finder and pairing code) |
| Model | gpt-6.1-sol | same |
| Image detail | high | same |
| Output cap | 6000 | same |
| Tries | 2, 5 s apart; continue on error | same |
| Prompt | A7 03, version 006de87c | **A7 03, D13 version (b187e58d)** |
| Answer sheet | the owner's truth sheet | same |
| "Simplify reply" | on | **off**: only what n8n keeps changes. The request is the same, and the token counts are kept |
| Order | all photos in one batch | **one photo at a time**, with a budget check before each (owner's cap, 21:28) |

**Budget stop.**
- Before each photo, the workflow adds up the cost of the calls already made, using the provider's token counts. A call with no counts is counted at its worst case.
- The next photo is sent only if that total plus the worst case of one more photo stays within USD 1. The worst case is 2 tries × (6,000 input + 6,000 output tokens), which is USD 0.144.
- If the cap would be passed, the run stops, and the photos already read are scored.

## Results (execution 461)

**Cost:** about **USD 0.18**.
- 15,303 input and 14,549 output tokens, at USD 2 and USD 10 per million (gpt-6.1-sol, OpenAI pricing page, read 16 Oct 2026).
- This is an estimate from the token counts, not an invoice. A retried call would not be in the counts; none of the 10 calls returned an error.

**Piece counts, photo by photo:**

| Photo | Owner's sheet | Test 2 | Test 3 | Result |
|---|---|---|---|---|
| Test 1 | 2 | 1: chaise read as the sofa from another angle | **2**: chaise + sofa, "photographed apart" | Fixed |
| Test 2 | 2 | 1: second piece read as another configuration | **2**: chaise module + one-arm module, same set | Fixed |
| Test 3 | 7 (note unclear, not scored) | 14: 7 cushions and the coffee table counted | **6**: 5 armless + 1 corner module, no cushions; the white-background module is listed as a view | Changed; the owner judges 6 against 7 |
| Test 4 | 4 | 4 | 4: 2 sofas, 2 chairs; swatches listed as views | Same |
| Test 5 | 4 (2 sofas, 2 armchairs) | 4, wrong kinds (1 sofa, 3 chairs) | 4, **still the wrong kinds** (1 sofa, 3 chairs) | Same; kinds not fixed |
| Test 6 | 6 | 5: missed one nightstand | **6**; the crossed-out chest and wardrobe excluded | Fixed |
| Test 7 | 2 | 2 | 2: two bookends | Same |
| Test 8 | 1 | 1: nightstands and lamps as context | **3**: bed + 2 nightstands | **Worse** |
| Test 9 | 7 (label 15, cropped) | 7 + the printed label | 7; label "12CHAIRS, 2 ARMCHAIRS" kept as a printed count | Same |
| Test 10 | 7 | 7 | 7 | Same |

- **Count right:** test 3 is right on **8 of 9** scored photos; test 2 was right on 6 of 9. The one miss is Test 8.

**Cropped and hidden:**
- **The reader's own "cropped" flag:**
  - Test 2 said "cropped" on 8 of 10 photos.
  - Test 3 said it on 2: Tests 8 and 9. So it is right on 8 of 9 scored photos. Only Test 9 is cropped.
- **After A7's box check:** 8 of 9. Test 8 still counts as cropped, because the reader put the left nightstand's box at the frame edge (0 of 1000).
- **"Hidden"** was reported on 9 photos (all but Test 7). On none of them did a covered piece turn into "cropped", except Test 8, where the cause is the nightstand count.
- **Test 2's per-photo crop flags** are not in the table. Reader test 2 is archived, so execution 459 cannot be read through the connection.

**The new D13 rules:**
- **Pieces photographed apart:**
  - Owner, 21:28: check the photos, not only the notes. I did this by eye on the Drive photos and the owner's sheet.
  - Tests 1 and 2 show separate shots in one image. Tests 4 and 5 show pieces standing separately in one shot. Test 7 was not viewed and is not used for this rule.
  - On all four photos, each piece was counted once and a "same set" relation was given.
- **Modules:** on Test 3, the count was per module (6 against the owner's 7). No cushion was counted as a piece on any photo; test 2 counted 7 on Test 3.

## Re-scored against the corrected answer sheet (owner, 16 Oct 2026, 22:06)

The owner counted Test 3 himself: **6 modules**. The white piece outside the sectional is not part of the set (different finish, not named in the brief or on the product page). It is context.

The re-score uses the saved run; there was no new model call. Script: `tests/claude-midas-a7-reader-test-3/rescore_corrected_sheet.py`.

- **Counts:** reader test 3 is right on **9 of 10** photos; the only miss is Test 8. Reader test 2 was right on 6 of 10 (it missed Tests 1, 2, 3 and 6).
- **Crop flag:** right on 9 of 10, both the reader's own flag and after the box check. Test 8 is the only miss.
- **Test 3:**
  - Count **6**, with no cushion counted.
  - The white piece is **not counted as product**. The reader listed it as a view: "Isolated white-background view at left shows an armless module matching those in the sectional; it is not counted again."
  - So it is not the fail case ("product"). But it is not labelled "context" or "uncertain" either.
- **The Google Sheet:** it already shows 6 in "true piece count". Its "pieces that belong" cell for Test 3 still names "one armless seat module on white (left)". I did not write to the sheet; that cell is for the owner to change.

## Open (owner, 22:06)

- **Test 8 and Test 5** are the open problems. They go into one prompt change, reader test 4:
  - the narrowed "pieces of one set" rule, with the role "uncertain";
  - the kind definitions;
  - the Test 3 counter-example.
- The candidate text is `n8n/claude-midas-a7/model-prompts/pending/03_Eye_photo_reader.rt4-candidate.txt`. It is not run and not in any workflow.
- The paid run moves to a new chat (the Phase 2 start prompt). **Not started here.**

## What was checked and how

- **Local scoring test**, with code-made replies and no model call: `tests/claude-midas-a7-reader-test-3/run_score_test.js` passes **20 checks**. It covers a full run, the budget sums and the stop path.
- **Dry run, execution 460:** reader off, no paid call. The loop ran, the budget stop triggered at 6 photos (counted at worst case), and scoring after a stop worked.
- **Paid run, execution 461:**
  - Status was success.
  - The Score output was read in full from the execution.
  - The figures above come from it (`results-execution-461.json`).
- **Export:**
  - `workflow-YRl8RlplXULsrMyY.json` is read back from n8n, version `6311040f`.
  - The 5 code nodes match `code-nodes/` exactly.
  - No keys or tokens are in the export; credentials appear by name and id only.

## Not checked

- **Test 7, Test 8 and Test 3 photos:** not viewed by me in this round. The Test 8 reading above comes from the reader's own boxes and notes.
- **The OpenAI billing page:** not checked against the USD 0.18 estimate.

## Leftovers

- **Reader test 3 `YRl8RlplXULsrMyY`:** kept, unpublished, for re-runs. It makes paid calls only when run by hand.
- **Reader test 2 `Q7IlyqUHtmEu7kEH`:**
  - It was archived at about 20:55 Amman, before the owner's 21:07 message ("archive it only after test 3's results are recorded").
  - Test 3's results are now recorded here, so it stays archived. Its executions and files are not deleted.
  - To add test 2's per-photo crop flags, restore it in n8n (Workflows → Archived → Unarchive) and tell me. I will read execution 459 and archive it again.
- **Sender `Omb5qvpJIJvJty7T`:** archived. Confirmed by read-back.
