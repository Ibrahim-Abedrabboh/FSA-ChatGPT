# Claude · Midas A7 reader test 4 — README

16 Oct 2026, 23:1x Amman. Written by Claude. **Run made. Not a pass. Stopped; waiting for the owner.**

## Status

- **Workflow:** "Claude · Midas A7 reader test 4", id `Ouf9Th4Xbg2hSa4u`, in the owner's personal project. Manual trigger only. **Not published.**
- **Paid run:** execution **465**, 20:02:35–20:08:11 UTC, version `c84792ba`, run id `claude-rt4-20261016200237`. Owner's go: 22:56 (cap USD 1).
  - All 10 photos were read. No errors, no retries in the counts, the cap did not stop anything.
- **After the run:** the reader was switched off again (version `6a59c8b2`), so the workflow cannot make a paid call by accident. The prompt is unchanged.
- **Writes:** none. No table, no sheet. Results are in the execution and in `n8n/claude-midas-a7-reader-test-4/results-execution-465.json`.
- **A7:** not changed. The D13 prompt and the test 4 prompt stay in `pending/`.

## The prompt that ran

- `pending/03_Eye_photo_reader.rt4-candidate-with-test4-clause.txt`: the rt4 candidate plus the owner's 22:56 colour exception, added to line 5 right after the counter-example. Lines 1–4 and 6–22 are the candidate's text.
- Line 5 as it ran: "Which pieces are product: a piece is product only if it matches the product's design (the same material, finish and detailing), or a label or printed count in the photo names it. Furniture or objects that only stage the photo stay context, even when they stand next to the product. A piece near the set in a different colour or finish is context unless the brief or a label names it. Exception for colour: when the photo shows only the product on a plain background, with no room or staging, pieces of the same design in different colours are all product, as colour options of one set. This exception does not apply to a piece standing apart from a joined set, such as a loose module next to a sectional; that piece stays context unless the brief or a label names it. If you cannot tell whether a piece is product or context, give it role uncertain and say why in unknowns; never guess."
- Everything else is reader test 3: same photos, gpt-6.1-sol, detail high, output cap 6000, 2 tries 5 s apart, one photo at a time with the USD 1 stop.

## Photo checks before the run (by eye, owner's step 1)

- **Test 4:** plain white background, no room or staging. Only four fabric swatches across the top and scatter cushions. 2 light curved sofas, 2 dusty-rose round swivel chairs.
- **Test 3:** the white module sits in its own white panel at the left, apart from the joined sectional in the room shot.
- How: the photos were read from Drive (Test 3 through the Drive connector; Test 4 through a scratch n8n workflow, Drive read only) and viewed as images.

## Results (execution 465)

**Cost:** about **USD 0.18** (USD 0.1818). 17,743 input and 14,636 output tokens, at USD 2 and USD 10 per million (gpt-6.1-sol, read 16 Oct 2026). An estimate from the token counts, not an invoice.

**Tests 2, 3 and 4, photo by photo** (corrected sheet):

| Photo | Sheet | Test 2 | Test 3 | Test 4 | Test 4 notes |
|---|---|---|---|---|---|
| Test 1 | 2 | 1 | 2 | **2** | both called "sofa" (test 3: chaise + sofa); apart rule kept |
| Test 2 | 2 | 1 | 2 | **2** | both called "sofa"; apart rule kept |
| Test 3 | 6 | 14 | 6 | **6** | white piece read as **a view** again; reader's crop flag **true** (was false) |
| Test 4 | 4 | 4 | 4 | **4** | 2 sofas + 2 armchairs, **all product** |
| Test 5 | 4 (2 sofas, 2 armchairs) | 4, wrong kinds | 4, wrong kinds | **4, 2 sofas + 2 armchairs** | **kinds fixed** |
| Test 6 | 6 | 5 | 6 | **6** | same |
| Test 7 | 2 | 2 | 2 | **2** | called "sculpture" (test 3: bookend) |
| Test 8 | 1 | 1 | 3 | **1** | **fixed**: both nightstands context |
| Test 9 | 7 (label 15, cropped) | 7 | 7 | **7** | cropped, right |
| Test 10 | 7 | 7 | 7 | **7** | same |

- **Count right:** test 4 is **10 of 10**; test 3 was 9 of 10; test 2 was 6 of 10.
- **Crop flag (reader's own):** 9 of 10. Test 3 is the miss: the reader called the left module "cut off", because the room photo inside the image ends at its left edge.
- **Crop after the box check:** **10 of 10** (test 3: 9 of 10). The box check clears Test 3 (nearest edge 62 of 1000) and Test 8 now passes.
- **Apart rule (Tests 1, 2, 4, 5):** each counted once, with a relation, on all four.
- **Cushions counted as pieces:** none.
- **Uncertain pieces:** none on any photo.

## Pass check (owner, 22:56)

| Condition | Result |
|---|---|
| Test 3: count 6 | **Yes** |
| Test 3: white piece context or uncertain | **No.** Listed only under views: "White-background inset at left shows an individual upholstered module; it is not counted again as an additional piece." Not "product", but not context or uncertain either. |
| Test 4: count 4, dusty-rose chairs product | **Yes** (read as 2 armchairs, product) |
| Test 5: kinds 2 sofas + 2 armchairs | **Yes** |
| Test 8: nightstands context, count 1 | **Yes** |
| No photo worse than test 3 | **No.** Test 3's crop flag went from right (false) to wrong (true). The crop after the box check stayed right. |

**Overall: not a pass.** Both misses are on Test 3. Per the owner's rule, nothing was changed and no second run was made.

## Observations (not scored)

- The reader treats the Test 3 white panel as an inset view of a sectional module, not as a separate piece. It did so in test 3 too. The new rule's second sentence ("a piece standing apart from a joined set … stays context") did not change that, because the reader never treats it as a piece.
- The Test 3 crop flag comes from the boundary of the room photo inside the composite image, not the outer frame.
- Kind words moved on Tests 1, 2 and 7 (chaise → sofa, bookend → sculpture). Counts are unchanged; kinds are not scored on those photos.

## What was checked and how

- **Local tests** (code-made replies, no model call): `tests/claude-midas-a7-reader-test-4/run_score_test.js` passes **30 checks**, including the owner's 22:56 checks (Test 4 chairs, Test 8 nightstands, an uncertain nightstand is not a pass).
- **Replay of reader test 3's answers** through the scorer: 8 checks pass. Reader test 3's own tests still pass (20).
- **n8n free tests:** executions 462 and 464 (pinned data, reader off) ran every code node, and the budget stop worked.
- **Read-back** of version `c84792ba` before the run: the prompt, the reader settings and the code nodes were read from n8n and compared with the repo.
- **Execution 465:** status success; the Score output and all 10 reader answers were read from the execution. Saved: `results-execution-465.json`, and `fixtures/execution-465-reader-replies.json` (answer text and token counts only).

## Not checked

- The OpenAI billing page, against the USD 0.18 estimate.
- Test 7 and Test 8 photos were not viewed by Claude in this round.

## Not proposed

- Step 8 (the A7 change) applies only after a pass, so no A7 change is proposed.

## Leftovers

- Workflow `Ouf9Th4Xbg2hSa4u` (unpublished; reader off).
- Executions 462 and 464 (free pinned tests) and 465 (the paid run).
- Scratch workflow "Claude · scratch: view Test 4 photo" `GMUHSjI9mTqxIyB2`, archived; its execution 463 (Drive read only) is kept.
- Repo: `n8n/claude-midas-a7-reader-test-4/`, `tests/claude-midas-a7-reader-test-4/`, and the ADD prompt in `pending/`.

## Update, 17 Oct 2026, 01:0x: per-photo breakdown and a cost correction

Owner, 00:37: keep the old reader prompt in A7. The rt4 prompt stays in `pending/` and is not merged. The test-4 result is **not accepted**, and Phase 2 stays open.

**Per photo** (execution 465; truth = the owner's sheet, 16 Oct 22:06):

| Photo | Expected | Read | Result |
|---|---|---|---|
| Test 1 | 2 | 2 sofa | Pass |
| Test 2 | 2 | 2 sofa | Pass |
| Test 3 | 6, white piece = context | 6 (5 armless + 1 corner). White inset read as a **view**. Crop flag **true** | **Fail** on two rules: "white piece is context" and "no photo worse than test 3" |
| Test 4 | 4 (2 sofas + 2 chairs) | 2 sofa + 2 armchair | Pass |
| Test 5 | 4 (2 sofas + 2 armchairs) | 2 sofa + 2 armchair | Pass |
| Test 6 | 6 | 6 | Pass |
| Test 7 | 2 | 2 "sculpture" | Pass |
| Test 8 | 1 | 1 bed, nightstands as context | Pass |
| Test 9 | 7 visible | 7, label read as printed text | Pass |
| Test 10 | 7 | 7 | Pass |

**Test 3, the reader's own "unknowns":**
- "The left edge of the sectional is clipped by the boundary of the room photograph."
- "The inset does not establish an additional physical module beyond those in the assembled sectional."
- Plus three general lines.

**Reader test 3 (execution 461) on this photo:**
- Count 6 and crop flag false: right.
- The white inset was also read as a view, which is the same miss under the 22:06 sheet. It was not scored, because test 3 was scored against the older sheet.
- So the only thing test 4 made worse is the crop flag. The box check sets it back to "not cropped" (nearest box 62 of 1000 from the edge).

**Cost correction.** I said a rerun would cost "about USD 1". That was wrong: USD 1 was the cap. A rerun of the 10 photos is expected to cost about USD 0.18, like execution 465. The budget stop counts a worst case of USD 0.144 per photo (2 tries × 6,000 input + 6,000 output tokens). That is why a USD 1 cap lets about 6 photos through at the worst case.

**Which tests used the old prompt:** tests 1 (Gemini 3.8 Flash, A7's first reader) and 2 (gpt-6.1-sol, the fallback). Test 3 used the D13 prompt.
