# Claude · Midas A7 reader test 5 — README

21 Oct 2026, 06:3x Amman. Written by Claude. **Run made. Not a pass: 8 of 10. Stopped; waiting for the owner.**

## Why this test

Four Eye prompts exist. Three had been scored on the owner's 10-photo truth sheet: the pre-D13 prompt that runs in the job pipeline (6 of 10, reader tests 1 and 2), the D13 prompt (9 of 10, reader test 3) and the rt4 candidate with the test 4 clause (10 of 10, reader test 4, execution 465, with the Test 3 white piece read as a view and a wrong crop flag that the box check cleared). The v3 prompt, live on the photo check since 19 Oct 2026, had only been seen on the owner's own Midas photos in the model tests (4 of 5). It had never been scored on the sheet, so the prompt comparison of 21 Oct could not rank it against the others. The owner's go ("run it", 21 Oct 2026): run v3 on the reader test 4 harness, cap USD 1.

## Status

- **Workflow:** "Claude · Midas A7 reader test 5", id `hFm2QIV9o9anvJhH`, in the owner's personal project. Manual trigger only. **Not published.**
- **Build:** a copy of reader test 4 (`Ouf9Th4Xbg2hSa4u`, version `6a59c8b2`). Only the reader prompt changes, to v3; the run-id prefix is `claude-rt5-`. Same Drive folder (`Test 1` to `Test 10`), gpt-6.1-sol, detail high, output cap 6000, 2 tries 5 s apart, one photo at a time with the USD 1 stop. Code: `n8n/claude-midas-a7-reader-test-5/`.
- **Dry run:** execution **1656**, 03:18:23–03:18:41 UTC, reader disabled, no model call, no charge. Config reported the stored prompt at 8514 characters and 227 lines, the same first and last words as the file; all five code nodes ran; the 10 folders paired. The budget loop stopped after 6 photos because a disabled reader returns no token counts and each photo is then charged at the worst case (USD 0.144): the designed behaviour, not a fault.
- **Paid run:** execution **1657**, 03:19:25–03:24:01 UTC, version `11764c7d`, run id `claude-rt5-20261021031927`.
  - All 10 photos were read. No errors, no retries in the counts, the cap did not stop anything.
- **After the run:** the reader was switched off again (version `6076d239`), so the workflow cannot make a paid call by accident. The prompt is unchanged.
- **Writes:** none. No table, no sheet. Results are in the execution and in `n8n/claude-midas-a7-reader-test-5/results-execution-1657.json`; the reader's ten raw answers are in `tests/claude-midas-a7-reader-test-5/fixtures/execution-1657-reader-replies.json`.
- **A7:** not changed. v3 stays on the photo check; the pre-D13 prompt stays in the job pipeline. Any change is the owner's call (below).

## The prompt that ran

`n8n/claude-midas-a7-reader-test-5/prompt-v3.txt`: byte for byte the text of the analysis_only node "03 Eye reads the product photo" (8514 characters), also published for the owner in `claude-outputs/claude-midas-a7-owner-workspace/analysis-reader-prompts-live.md`. It gives no boxes, calls covered parts `occluded`, lists membership doubts in `unclear_membership` (it has no `uncertain` role), reports `upload_type` (W1 to W5) and may ask one `blocking_question`.

## The scorer

The reader test 4 scorer with its checks unchanged, reading v3's answer shape too:

- **Count** = pieces with role `product` (the sheet's corrected totals, 16 Oct 2026, 22:06).
- **Crop flag** = the reader's `cropped`. **Crop after the box check**: v3 gives no boxes, so this equals the reader's own flag (the A7 04-06 rule cannot clear a flag without a box).
- **Test 3 white piece**: context, uncertain, or named in `unclear_membership` all pass; a view does not.
- **Apart rule** (Tests 1, 2, 4, 5): counted once each, and a relation that says the pieces belong together.
- **Worse than test 3**: anything test 3 got right that is now wrong, per photo.
- Checks on the scorer: `tests/claude-midas-a7-reader-test-5/run_score_test.js` (30), `replay_execution_461.js` (8) and `replay_execution_1657.js` (16, replays this run's answers and expects these results). All pass.

## Results (execution 1657)

**Cost:** about **USD 0.17** (USD 0.1695) at the test 4 price basis (USD 2 input / 10 output per million, gpt-6.1-sol, read 16 Oct 2026); about **USD 0.28** (USD 0.2793) at the USD 4 / 15 the site has listed since 19 Oct. 24,983 input and 11,956 output tokens (2,990 of the output tokens are reasoning). An estimate from the token counts, not an invoice. **Time:** 4 min 36 s for the ten photos.

**Tests 2 to 5, photo by photo** (corrected sheet):

| Photo | Sheet | Test 2 | Test 3 | Test 4 | Test 5 (v3) | Test 5 notes |
|---|---|---|---|---|---|---|
| Test 1 | 2 | 1 | 2 | 2 | **1** | **wrong**: the upper shot read as "an alternate angle" view; one three-seater sofa |
| Test 2 | 2 | 1 | 2 | 2 | **2** | chaise lounge + three-seater sofa; relation says "shown separately, not visibly connected"; blocking question: "Are these two separate seating pieces or two configurations of one product?" |
| Test 3 | 6 | 14 | 6 | 6 | **6** | 6 sectional modules; white piece read as **a view** again ("Isolated matching single-seat unit on white"); crop flag **true** (wrong, as in test 4) and no box to clear it |
| Test 4 | 4 | 4 | 4 | 4 | **4** | 2 loveseats + 2 armchairs, all product; the armchairs listed under unclear_membership, as v3 instructs |
| Test 5 | 4 (2 sofas, 2 armchairs) | 4, wrong kinds | 4, wrong kinds | 4, right kinds | **4, 1 sofa + 3 armchairs** | **kinds wrong again** (test 3's reading) |
| Test 6 | 6 | 5 | 6 | 6 | **6** | bed, 2 nightstands, dresser, wall mirror, stool; the crossed-out chest and wardrobe excluded |
| Test 7 | 2 | 2 | 2 | 2 | **2** | called "decorative sculpture" (test 4: sculpture; test 3: bookend) |
| Test 8 | 1 | 1 | 3 | 1 | **3** | **wrong**: both nightstands **product** ("bedroom set"); crop flag true (wrong) |
| Test 9 | 7 (label 15, cropped) | 7 | 7 | 7 | **7** | dining table, 4 dining chairs, 2 armchairs; cropped, right; printed counts "12CHAIRS" and "2 ARMCHAIRS" recorded, one conflict; blocking question: "Should images show the visible pieces or the full printed set?" |
| Test 10 | 7 | 7 | 7 | 7 | **7** | same |

- **Count right:** test 5 is **8 of 10**; test 4 was 10 of 10; test 3 was 9 of 10; test 2 was 6 of 10.
- **Crop flag (reader's own):** 8 of 10. Tests 3 and 8 flagged true. With no boxes there is nothing to clear a wrong flag, so crop after the box check is also 8 of 10 (test 4: 10 of 10).
- **Apart rule (Tests 1, 2, 4, 5):** counted once each on Tests 2, 4 and 5, not on Test 1. No photo got a relation that ties the apart pieces together: v3's RELATIONSHIPS section asks for visible spatial relationships, not set membership, so the reader described positions ("Two mauve armchairs sit between the two light sofas"). On Test 2 it went the other way ("not visibly connected") and asked the owner.
- **Upload type:** W4 (multi-reference sheet) on Tests 1 to 5, W3 (set or selection) on Tests 6 to 10. Plausible on all ten.
- **Occluded:** true on 9 of 10 (not Test 7). **Blocking questions:** 2 (Tests 2 and 9). **Cushions counted as pieces:** none. **Uncertain pieces:** none (v3 has no such role).
- **Worse than test 3:** Test 1 (count 2 to 1), Test 3 (crop flag), and the missing "belong together" relation on Tests 2, 4 and 5.

## Pass check (owner, 16 Oct 2026, 22:56)

| Condition | Result |
|---|---|
| Test 3: count 6 | **Yes** |
| Test 3: white piece context or uncertain | **No.** A view, as in tests 3 and 4. |
| Test 4: count 4, dusty-rose chairs product | **Yes** (2 armchairs, product, flagged in unclear_membership) |
| Test 5: kinds 2 sofas + 2 armchairs | **No.** 1 sofa + 3 armchairs. |
| Test 8: nightstands context, count 1 | **No.** Both nightstands product, count 3. |
| No photo worse than test 3 | **No.** Test 1 count, Test 3 crop flag, apart relations. |

**Not a pass.** The test 4 prompt (rt4 candidate with the test 4 clause) remains the only one that met the count conditions on all ten.

## What this means for the prompt choice

- **Ranking on the sheet, counts:** rt4 with the test 4 clause 10 of 10; D13 9 of 10; **v3 8 of 10**; pre-D13 6 of 10.
- **Why v3 misses:** two of its rules cost it. "Bedroom sets may include beds, nightstands ..." pulls the Test 8 nightstands into the product (the owner's sheet says context, 1 piece). Without the counting rule for pieces photographed apart in one image, Test 1's second shot became a view. v3's own gains (upload type, blocking questions, unclear_membership, no coordinates) did not change a count.
- **Strongest practical option:** run the rt4 prompt with the test 4 clause on the photo check as well as the job pipeline, so one prompt runs everywhere and the job pipeline's 04-06 Evidence gets boxes back from the confirmed photo check. The known open points on that prompt stay as they were on 17 Oct (white piece a view, Test 3 crop flag cleared only by the box check). v3's extras (upload type, blocking question) would need adding to that prompt and a further run on the sheet if the owner wants them.
- **Not decided here:** the Opus 5.5 question for 03 Eye is separate. No prompt has run on Opus 5.5 against the sheet; a bounded run (ten photos, about USD 0.6 at the arm E token counts) would settle it before any flow change.
- Any change to the photo check or the job pipeline is a flow change and needs the owner's go; it would land as a recorded patch in `tools/n8n_to_flow.py`.
