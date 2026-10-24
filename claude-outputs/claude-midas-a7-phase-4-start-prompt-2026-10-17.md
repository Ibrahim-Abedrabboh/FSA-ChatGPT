# Phase 4 start prompt: second paid test

17 Oct 2026, 00:3x Amman. Written by Claude, to paste into a new chat. **Updated 17 Oct, 01:0x: the owner's choices of 00:43 are filled in, and the free checks made since are under "Checks already made". Owner, 01:04: dining is parked; Phase 4 runs Test 8 only.** Phase 4 starts only after the owner confirms in writing that Phase 2 is closed (choice 1).

---

Phase 4 of Midas A7: the second paid test. **Paid.** It makes real image, text and vision calls, within the cap in choice 5.

The aim is to prove what the first test (Test 10, 16 Oct) did not:
- three scene views in one shared room;
- three scene reviews and three scene go 2s;
- a repair ordered at go 2;
- a night or warm-light image;
- a large dining set with the raised camera (**parked**: no usable photo yet; see choice 3);
- the scene delivery files.

**Read first** (the Project, then the repo `claude-midas-studio`, branch `final`, newest commit):
- `claude-outputs/claude-midas-a7-remaining-plan-2026-10-16.md` (Phase 4 section; decisions D3, D4, D9, D10, D13)
- `claude-outputs/claude-midas-a7-live-test-README-2026-10-16.md` (how the first paid test ran, its six jobs and its three fixes)
- the newest A7 READMEs: Phase 1, owner answers 21:28, reader test 4, scene files, views and framing, stage 07
- `claude-outputs/claude-midas-a7-phase-3-README-2026-10-16.md` (catalogue state on 17 Oct: SANOVA inactive; stock on 174770 and 174788)
- repo: `n8n/claude-a7-test-sender/` and the A7 export in `n8n/claude-midas-a7/`

Check n8n before you state or change anything. The docs are snapshots.

**Where things stand (17 Oct 2026, 00:30; check each in n8n)**
- **A7:** "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, draft `eefd6c42`, not published.
  - Confirm that the Phase 1 items are in the version you will test, before anything is published:
    - D3 "review again" at a scene held without a review (the first test's scene stayed "not reviewed" after a Gemini 503);
    - D4 delivery-file background at 255, shadow kept;
    - P1.8 cost receipts for text and vision calls.
- **Phase 2 (photo reader):** reader test 4 (execution 465) did not pass. A7 keeps the pre-D13 reader prompt until a reader passes. See choice 1.
- **Test sender:** "Claude · A7 test sender" (`Omb5qvpJIJvJty7T`) is **archived** (checked 17 Oct, 00:3x). It sent jobs and my answers with the header credentials stored in n8n, so no key was ever typed, read or saved.
  - For this test, make a new unpublished copy from the repo export `n8n/claude-a7-test-sender/claude-a7-test-sender.sdk.js`, named "Claude · A7 test sender 2". Do not unarchive the old one.
  - It uses the same stored header credential. **No key is ever typed, read or saved.**
- **Test photos:** Drive > Testing (Test 1–10).
- **Catalogue:** `lwJbRv4TVqlFTILl`, 428 rows. Scene pieces are in stock only, Kuwait `/en/` only (D10), checked live at scene time.
- **D9 (confirmed):**
  - warm 3000 K, night 2700 K;
  - white framing band 72–80% (target 76%, longest side);
  - detail view = more than half the frame;
  - camera 120 cm for room-scale furniture;
  - for large dining sets, the 9-piece raised camera is a starting rule; a small downward tilt is allowed only if chair backs are hidden.
- **Cost estimate** (16 Oct receipts, images only):
  - white master about USD 0.06;
  - empty room about USD 0.06;
  - 3 placements about USD 0.20;
  - 1 repair about USD 0.065;
  - about **USD 0.40 per job**, before text and vision calls.

**My choices for this chat** (owner, 17 Oct 2026, 00:43)
1. **Phase 2: still open.** Stop before any paid job. Phase 4 runs on the **OLD reader prompt**, and only if the old reader read the chosen photos correctly. I will confirm in writing that Phase 2 is closed.
   - Note (Claude, 01:0x): the old prompt ran in reader **tests 1 and 2**, not 2 and 3. Test 1 was Gemini 3.8 Flash, A7's first reader. Test 2 was gpt-6.1-sol, the fallback. Test 3 used the D13 wording. The checks below use tests 1 and 2.
2. **Product job: Test 8** (the bed only), if (a) the old reader read it correctly and (b) the D11 bed guide fix is in the draft. Otherwise Test 6, and say why.
3. **Dining photo: the original is "test 1.jpg"** (also stored as dining.jpg), 400 × 245 px, sha256 `f682e323ac885e966c9f6296f056fb507f9c4d4854ad041aa1c5114797bd8ac5`. Never use a generated dining image as the source.
   - **Brief:** 12 chairs in total (10 armless, 5 per long side, plus 1 armchair at each end), not 14.
   - If the photo's short side is too small for the reader, hold and tell me.
   - **Owner, 17 Oct 01:04: (c), no dining job this phase.** Phase 4 runs **Test 8 only**, within the same USD 3 cap.
   - **Parked until the owner supplies a vendor photo that shows the whole table and all 12 chairs** (option a). When it arrives:
     - first, a free check: the photo exists and opens, and its hash and size are recorded;
     - then the reader count is checked against **12 chairs (10 armless + 2 armchairs) plus the table**, before any paid image call;
     - if the count does not match, hold and tell the owner.
   - **Never** brief the cropped version (option b, the pieces in the current photo only).
   - **Never** add chairs the photo does not show.
   - The current photo (reader Test 9) stays a test photo for the reader only.
4. **Light:**
   - Dining: warm (3000 K), on the hero (wide) view. **Parked with the dining job.**
   - Test 8: night (2700 K), only as one series image made from its approved image, and only if a Midas lamp is in stock. Otherwise no night image this phase.
   - No other light variants.
5. **Cap: USD 3 hard stop for all of Phase 4**, text and vision calls included. Stop and report at **USD 2.40** (80%). Repairs only when I order them (at most 2 per image).
6. **Publishing:** nobody publishes A7 without my explicit go in that chat. Run the jobs as manual or test executions of the unpublished workflow.
   - If publishing turns out to be required, stop and ask me.
   - If I say yes: publish, run, and unpublish straight after. Report both times.

**Checks already made** (free, 17 Oct 2026, 00:5x–01:0x; check again in the new chat)
- **Dining photo by hash** (scratch "Claude · dining photo hash check", `dB5mXV1fgKSG6uFz`, execution 471; Drive reads and code only):
  - Reader Test 1 (`Testing/Test 1/main.jpg`) is **not** the dining file: 340 × 223 px, sha256 `0936aa53…06b3`, sofas.
  - **Reader Test 9 (`Testing/Test 9/main.jpg`, Drive id `1imPe7wRDjWU75-YvhF0dw56QPFrxXlem`) is the file:** 400 × 245 px, 39,542 bytes, sha256 matches exactly.
  - The four "dining.jpg / DINING.jpg" files elsewhere in Drive do not match.
- **Reader on the dining photo:** four reads, both readers, three prompts. All gave 7 visible pieces (table, 4 chairs, 2 armchairs) plus the printed label "12CHAIRS / 2 ARMCHAIRS". No sign that 245 px is too small for the reader.
- **A7 will hold the dining job at 13 Compile, by design.** The photo is cropped (table and left end armchair cut off), and it shows 7 of the 13 pieces in the brief. A7's rule: "Drawing the missing pieces would invent how they look and where they stand, so nothing is made." The owner chose (17 Oct, 01:04) **(c): no dining job this phase**, parked until a photo showing all 12 chairs arrives (see choice 3).
- **Test 8 qualifies:**
  - The old reader read it right in test 1 (Gemini) and test 2 (gpt-6.1-sol): count 1, nightstands as context.
  - The D11 bed fix is in the draft: A7 `eefd6c42` reads profiles table v2 `AgXKkFbIj5dQAnvn`, whose "bed" row has its own guide and the check "Bedding unchanged".
  - Test 6 would be weaker: the fallback reader counted 5 of 6 on it.
- **Lamps:** table lamps 174770 and 174788 read In stock on the Kuwait listing, 17 Oct 00:20–00:23 (refresh run 468). A7 checks stock again live at scene time.
- **A7:** `eefd6c42`, not published (read 17 Oct, 00:5x).

**Do this**
1. **Checks, free, before anything is published or paid:**
   - The A7 version you will test, and that the Phase 1 items above are in it. Run pinned tests if they are not covered yet.
   - Build "Claude · A7 test sender 2" (see above), then run its free connection check.
   - The Test 8 photo (choice 2) exists and opens. Record its hash and size.
   - The Midas lamp stock for the Test 8 night image (choice 4), read live.
   - The cost to date against the cap.
   - Report all of this, with version ids, then wait for my "go" for the first paid job.
2. **One job: Test 8** (dining is parked, choice 3), sent through the test sender. Job ids `claude-a7-p4-YYYYMMDD-<product>-NN`.
   - **Brief for each:** Category template (hero, wide and detail), the light from choice 4 on its view, otherwise Daylight, no person.
   - Count every text, vision and image call against the USD 3 cap. Stop and report at USD 2.40.
   - **Go 1 and go 2 come from me in the chat.** Never give a go yourself.
   - **Repair:** only when I order it at a go 2. At most two repairs per image, then hold.
   - **A hold without a review** (for example a 503): use "review again". It makes no new image. Do not resend the whole job unless I say so.
3. **Stop rules:**
   - Stop and ask me before any call that would pass the cap.
   - Stop and ask me before any fix to A7. A fix is a new version, made only with my go in that message, and published only for this test.
   - Never edit a published workflow in place. Never change pipeline 3 or the live client page.
4. **After each job**, show me:
   - each image with its Drive link and checksum;
   - its review result. Scores are model judgements, not measurements; never say the 90–95 target was achieved;
   - the Midas pieces used and left out, with the live stock reading;
   - the cost from the receipts.
5. **At the end:**
   - Confirm "not published" from n8n. If A7 was published with my go (choice 6), it is unpublished straight after the run, and both times are reported.
   - Write a dated README in `claude-outputs/`:
     - status;
     - jobs and executions;
     - what passed and what did not;
     - the measured cost per call type against the estimate;
     - fixes made;
     - what was not checked;
     - leftovers (runs-table rows, vault rows, Drive files, executions, test sender runs).
   - Code and exports go in the repo.

**Done when**
- Each job has:
  - a white master approved by me at go 2;
  - its package;
  - three scenes that were each reviewed;
  - each scene approved or held by me at go 2;
  - the scene delivery files (jpg and webp at the scene's shape) for each approved scene.
- One repair ran, if I ordered one.
- One night image (2700 K) made from Test 8's approved image, **only if** a Midas lamp is in stock at scene time. If none is, there is no night image this phase, and the README says so.
- Dining is not part of this phase (parked, choice 3). Do not report it as done or failed.
- An incomplete job is never called complete. If something is still on hold, say so and list it.

**Standing rules**
- No publish, unpublish or paid call unless I say so in this chat (choices 5 and 6, and each "go"). Phase 2 must be closed in writing first.
- No keys or tokens in any file, payload, log or screenshot.
- The vendor's photo is the only authority for the product: piece count, shape, pattern, colour, handedness, excluded pieces.
- Never invent a Midas product. Scene pieces only with SKU, catalogue photo and an in-stock live reading.
- Label results "Generated image". "Approved" only from my recorded decision.
- Never claim something was built, tested, paid or verified without a version id, an execution id or a receipt.
