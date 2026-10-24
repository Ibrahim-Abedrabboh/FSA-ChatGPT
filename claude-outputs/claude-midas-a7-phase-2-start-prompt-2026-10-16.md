# Phase 2 start prompt: reader test 4

16 Oct 2026, 22:4x Amman. Written by Claude, to paste into a new chat. Fill in the one choice in step 2 before you send it.

---

Phase 2 of Midas A7: reader test 4. This is the photo-reader prompt fix.

**Read first** (the Project, then the repo `claude-midas-studio`, branch `final`, commit `aea0412` or later):
- `claude-outputs/claude-midas-a7-reader-test-3-README-2026-10-16.md` (results and the corrected re-score)
- `claude-outputs/claude-midas-a7-owner-answers-2128-README-2026-10-16.md` (the A7 draft as it is now)
- `claude-outputs/claude-midas-a7-remaining-plan-2026-10-16.md` (Phase 2 section)
- `n8n/claude-midas-a7/model-prompts/pending/README.md` and `03_Eye_photo_reader.rt4-candidate.txt`
- `n8n/claude-midas-a7-reader-test-3/` (the test 3 workflow export, code nodes, results of execution 461)

Check n8n before you state or change anything. The docs are snapshots.

**Where things stand (16 Oct 2026)**
- Reader test 3 (`YRl8RlplXULsrMyY`, version `6311040f`, execution 461, about USD 0.18) used the D13 prompt.
- Against the corrected sheet it is right on 9 of 10 photos. Reader test 2 was right on 6 of 10.
- Open problems:
  - **Test 8:** it read 3 pieces (the bed plus 2 staged nightstands); the answer is 1.
  - **Test 5:** the count is right but the kinds are wrong (1 sofa + 3 chairs; the answer is 2 sofas + 2 armchairs). This is an old gap that test 2 had too.
- A7 draft `eefd6c42` (`1cgZc9rmBOrPdKIe`, not published) keeps the reader prompt from before D13. D13 is marked pending.

**My go for this message:** one paid run of reader test 4, about USD 0.18, **cap USD 1**. Stop the run if the cap would be exceeded, and report what finished. No table writes.

**Do this**

1. **Build reader test 4** as a new workflow, "Claude · Midas A7 reader test 4". Copy reader test 3 exactly:
   - same Drive > Testing photos (Test 1–10, `main.*`);
   - same model `gpt-6.1-sol`, detail high, output cap 6000, 2 tries 5 s apart;
   - same one-photo-at-a-time loop with the USD 1 budget stop.
   - Run ids start with `claude-rt4-`. Unpublished, manual trigger.
   - **Change only the prompt.** It is one change from D13: `pending/03_Eye_photo_reader.rt4-candidate.txt`, which holds:
     - the narrowed "pieces of one set" rule with role "uncertain";
     - the kind definitions (sofa = seats two or more; armchair = one seat with arms; chair = one seat, no arms or small arms; ottoman = no back);
     - the counter-example "a piece near the set in a different colour or finish is context unless the brief or a label names it".
2. **Test 4 risk. My choice: [ADD / DO NOT ADD]** the clause below.
   - The sheet's Test 4 chairs (dusty rose) differ in colour from its sofas (light grey-oatmeal). Read literally, the new rule may make the reader call them context, which would make Test 4 worse.
   - The clause: "Pieces of different kinds shown together as one offer on a plain background (for example sofas and chairs) are product even when their fabric colours differ. The colour-or-finish rule applies to a second piece of the same kind, and to pieces staged in a room."
   - If I wrote ADD, it goes into the same single prompt change. If I left the choice blank, ask me before running.
3. **Show me** the final prompt and its difference from the D13 text before the run. Then run once.
4. **Score against the corrected answer sheet:**
   - Test 1 = 2, Test 2 = 2, Test 3 = 6, Test 4 = 4, Test 5 = 4 (2 sofas, 2 armchairs), Test 6 = 6, Test 7 = 2, Test 8 = 1, Test 9 = 7 visible (label 15; the only cropped photo), Test 10 = 7.
   - For Test 3, the white piece outside the sectional is context.
   - A piece with role "uncertain" is never counted. List every uncertain piece. In A7, code would hold for my answer.
5. **Pass means all of these:**
   - Test 8 counts 1.
   - Test 5's kinds are 2 sofas and 2 armchairs.
   - Test 3 counts 6, and the white piece has role context or uncertain:
     - "product" is a fail even if the count is right;
     - any other label (for example "a view") is not a pass; report it to me.
   - No photo is worse than in test 3. Compare per photo: the count, the crop flag, the crop after the box check, the "photographed apart" rule on Tests 1, 2, 4 and 5, and cushions not counted.
6. **If anything gets worse, stop and report.** Do not change the prompt again or run again without me.
7. **Report:**
   - tests 2, 3 and 4 side by side, photo by photo;
   - the cost from the token counts;
   - the execution id;
   - whether it passed, against each condition in step 5.
   - Write a dated README in plain language to `claude-outputs/` in the Project. Put the code in the repo.
8. **Even if it passes, do not put the prompt into A7 yet.** Propose the A7 change and wait for my go:
   - a new draft version with the prompt in 03 and 03b and a matching 05;
   - code in 04-06 Evidence that holds for me on any "uncertain" piece and never counts it.
   - Phase 2 is decided after I see the result. Image generation waits for it.

**Standing rules**
- No publish, unpublish or paid call unless I say so in that message. Test with pinned or code-made data.
- New draft versions only. Never edit a published workflow or an earlier pipeline in place. Prefix new things "Claude ·" or "claude-".
- No keys or tokens in any file, payload, log or screenshot.
- Never claim something was built, tested or verified without a version id, a test result or an execution id.
- A passed review is a reviewed candidate, not an approval. Scores are model judgements.
- An incomplete result is never called complete.
- List the leftovers.
- Reader test 2 (`Q7IlyqUHtmEu7kEH`) is archived; its rows and files stay. Do not resume reading Midas product pages until I say how.
- The Google Sheet's "pieces that belong" cell for Test 3 still names the white module. I will change it myself, unless I ask you to.
