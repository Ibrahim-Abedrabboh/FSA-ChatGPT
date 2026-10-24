# Midas A7: handoff for the next chat, Phase 1 (16 Oct 2026, updated after the review)

Paste the block below into a new chat in the "Midas Furniture styling" project.

```text
Continue the Midas A7 work: finish Phase 1 of the remaining plan, strictly following the project instructions.

First, check the current state. Do not publish, unpublish or run anything paid.
1. In n8n (the authority), check "Claude · Midas A7 (stages 01–07)", id 1cgZc9rmBOrPdKIe.
   - Expected: not published; current draft ad7d33eb-d392-4335-a045-93a3688f22f8 (the fallback readers). Phase 1 is NOT in n8n yet.
   - Pipeline 3 (LCkfLFMQS5MjA5FQ) and "Claude · Midas white clean-up" (MSU2K5WKKfizCapW) are published; leave them alone.
2. Read these Project docs:
   - claude-outputs/claude-midas-a7-remaining-plan-2026-10-16.md (the plan; Phase 0 decisions D1–D10 and D12 are recorded there)
   - claude-outputs/claude-midas-a7-coverage-register-2026-10-15.md (owner decisions 30–40 are the new ones)
   - claude-outputs/claude-midas-a7-reader-test-2-README-2026-10-16.md and claude-midas-a7-live-test-README-2026-10-16.md, if needed.
3. Attach the private GitHub repo Ibrahim-Abedrabboh/claude-midas-studio (add_repo with push access), clone it, check out branch final.
   - Commit 3bd0a06 holds the Phase 1 code, tested locally only.

What is already done in the repo (3bd0a06), not yet in n8n:
- D3 review again: 16b sends a not-reviewed candidate to go 2 with decisions review_again or stop and the estimated cost; G2 routes review_again back to the review (status awaiting_review), once per image; after a second not-reviewed result, approve_unreviewed or stop, recorded as "approved by owner without an automated review". G1b reads the allowed decisions from the run row's review column; 18a, 20a, 18l and 20k accept and label it.
- P1.10: 16b keeps the reviewer's answer when the blind count fails.
- D5: scene notes only for camera_level, light, realism (and framing); fails for props/pieces not in the plan, grounding, clearly wrong scale; auto_repair ignored (nothing repairs itself).
- D6: "cut off by the frame" decided in code from the blind count's box_2d (edge within 15/1000); the reader's flag decides only without a usable box; white master too.
- D8: Lifestyle + Category template = white master + hero (01 Intent).
- D9: 19a sets a near-product-height camera for tabletop accessories and lamps; no height line for detail views; small downward tilt allowed for large dining sets (04 Settings raise text); 3000 K, 2700 K, 72–80%, detail > half marked as confirmed.
- D10: 10 Retrieve and 19c use in-stock pieces only, on https://midasfurniture.com/en/ only.
- P1.2: 12 go 1 ticket warns when stage 04 will hold (cropped photo, inventory piece read as context, fewer pieces seen).
- P1.3: 15b records the call as synchronous, not stored. P1.4: 19c size line keeps measurements only; 13 "Its role in the scene:". P1.5: G1d and 18l stale texts fixed. P1.6: stronger wide framing line (19a).
- P1.7: new Code node 18e3_Clean_background.js (flood fill from the border, white clean-up's curve, centre guard; master untouched); 18h checks the saved jpg and webp read back as BMP (edge rows 255, at least 99%); manifest notes "background set to 255"; jpg quality 95. Checked locally on the real Test 10 master with GraphicsMagick: tests/claude-midas-a7-phase-1/claude-white-clean-check.js (edges 100% at 255, product and shadow core unchanged).
- P1.8: 01 records text prices (read 16 Oct 2026: claude-sonnet-5-5 2/10, gemini-3.8-flash 0.75/3.75 until 31 Dec 2026, gpt-6.1-sol 2/10, gpt-6-luna 0.1/0.5 USD per million tokens); 04-06, 09b, 11b, 11d and 16b record token counts in st.text_calls; V1 writes one text_call vault event per call; 18e adds text_usd to the package cost.
- Page draft 2 (claude-outputs/claude-midas-a7-page-2/): D8 counts and D12 series "Coming later". Mock mode only.
- Tests: every suite passes (87, 42, 9, 103, 65, 58, 59, 86, 79, 13, 78, 36) plus tests/claude-midas-a7-phase-1/run_tests_phase1.js 62/62.

What is left for Phase 1:
1. Fix the independent review findings before deploying. They are in the plan doc, section "Phase 1 review" (commit ceb089e):
   - HIGH 1: 18e3 can brighten a pale, soft-edged, off-centre product part while reporting 0 product pixels changed. Grow the fill only through pixels at or above the white point, apply the curve only to a 2–3 px band, keep the fill out of the product box_2d (except a shadow strip), and add a test for it.
   - MEDIUM 2–6: notReviewed must also require rv.ready (otherwise hold); the empty-room prompt for a lamp or accessory must not cite "image 1"; 19a must use profile.id before the small-product words; flag set but box inside → 'unsure', not a note; 18h must require 100% (or 99.9% with darkest value ≥254) and check the read-back size.
   - LOW 7–10, 12: go2_decisions in its own field; not-reviewed tickets send note-only fails to notes and label scores; sizeOnly must not read "in" as a unit; page draft 2 still says "2 to 10 images" and "or a series"; review again is once per attempt.
   - 11: ask me whether scenes should still fail on no_text_or_logo, people_ok and midas_pieces_match.
   - Test gaps: 32-bit BMP with masks in 18h; checks that only match words in the source.
   Re-run every suite after the fixes.
2. Deploy to A7 as a new draft version (unpublished), with update_workflow:
   - setNodeParameter jsCode for every changed Code node in n8n/claude-midas-a7/code-nodes/ (git diff --name-only 0fc281e 3bd0a06 -- n8n/).
   - addNode "18e2 Master to pixels" (Edit Image, multiStep resize binary 'data' to $json.pk.cfg.size_px both sides, ignoreAspectRatio, format bmp, destinationKey 'pix', continueRegularOutput), Code "18e3 Clean background", IF "Cleaned?" ($json.pk.ok === true), Edit Image "18g1 jpg to pixels" ('jpg' → bmp 'jpgpix') and "18g2 webp to pixels" ('webp' → bmp 'webppix').
   - Wiring: Master usable? true → 18e2 → 18e3 → Cleaned?; Cleaned? true → 18f Make jpg, false → 18p Package result; 18g Make webp → 18g1 → 18g2 → 18h Check files (remove 18g → 18h and Master usable? → 18f).
   - 18f and 18g: dataPropertyName 'clean' instead of 'data'.
   - simplify false on the 11 AI nodes (03, 03b, 05, 06, 06b, 09, 11, 11c, 16, 16x, 16xb), so token counts arrive.
3. Read the new version back, export it (python3 tools/claude-midas-a7-export.py <saved details json>), byte-check every Code node against the repo, and check the wiring and parameters.
4. Write the README claude-outputs/claude-midas-a7-phase-1-README-2026-10-16.md (status, what changed, checked, not checked, assumptions: STEP 6 and the 99% edge limit in 18e3/18h, the small-product word list in 19a, 1600 tokens per image in the review-again estimate; not built; leftovers), update the plan and the register, commit, push, write the README to the Project.
5. Not checked until a real run (Phase 4): the raw reply shapes with simplify off, Edit Image BMP on n8n Cloud, binaries kept across the go 2 wait for review again.

Rules (project instructions, still in force):
- No publish, unpublish or paid call unless I say so in that message. Test with pinned or code-made data.
- New draft versions only; never edit a published workflow or an earlier pipeline in place. Prefix new things "Claude ·" or "claude-". No keys or tokens anywhere.
- A passed review is a reviewed candidate, not an approval. Scores are model judgements; never present the 90–95 target as achieved. At most two repairs per image, then hold. An incomplete package is never called complete.
- Never claim something was built, tested or verified without a version id, a test result or an execution id.
- Every build gets a dated README in plain language. README to the Project; code in the repo.
```
