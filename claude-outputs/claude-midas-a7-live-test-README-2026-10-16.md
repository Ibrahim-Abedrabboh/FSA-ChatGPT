# Claude · Midas A7: first paid test (Test 10): README

16 Oct 2026, 06:30–07:12 UTC (09:30–10:12 Amman). Written by Claude.

## Status

- **A7** (`1cgZc9rmBOrPdKIe`) is **unpublished** again (07:11 UTC). Its current version is `006de87c-b6ff-4404-99df-f60aed9b59c0`. No execution is waiting or running.
- **Real paid runs: yes.** 6 jobs were sent, and the 6th (`claude-a7-live-20261016-t10-06`) went from intake to the scene image.
- **Three fixes** were made during the test. Each was a new version, each was made with the owner's go in the chat, and each was published only for this test (details under "Fixes made during the test").
- **Helper workflow** "Claude · A7 test sender" (`Omb5qvpJIJvJty7T`) is unpublished. It sent the job and the owner's answers using the header credentials stored in n8n, so no key was typed, seen or saved by Claude.
- Code: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, branch `final`, commits `14c3697`, `dc0cf7b`, `677d09e` and the commit that adds this README.

## What the owner decided (in the chat)

| Time (UTC) | Decision |
|---|---|
| 06:2x | Publish A7 for the test and unpublish after; Test 10; Wide view, Daylight, Reference view, no person; spending cap USD 2 |
| 06:36 | Fix 11c, republish, resend (`-03`) |
| 06:39 | Go 1 on `-03` |
| 06:47 | Fix stage 04 (synchronous call), republish, resend (`-04`) |
| 06:53 | Go 1 on `-05` |
| 07:00 | Fix the crop flag with a box check, republish, resend (`-06`) |
| 07:04 | Go 1 on `-06` |
| 07:07 | Go 2 **approve** on the white master of `-06` |

## The six jobs

| Job | A7 version | A7 execution | Result |
|---|---|---|---|
| `-01` | 64545f4f | 440 | Held at stage 01: the Gemini photo reader answered 503 "Service unavailable" |
| `-02` | 64545f4f | 442 | Held at stage 03: 11c Plan critic got "Bad request" twice (cause: temperature, see fix 1) |
| `-03` | 3203fc38 | 444 | Go 1 given. Held at stage 04: Google refused background mode, HTTP 400 (see fix 2). Recorded `failed_not_started`, no charge expected (not confirmed) |
| `-04` | 8c9b4675 | 448 | Held at stage 01: Gemini 503 again |
| `-05` | 8c9b4675 | 450 | Go 1 given. Held at stage 04: one reading called the photo "cropped" (see fix 3). Nothing paid at stage 04 |
| `-06` | 006de87c | 454 | Go 1 given. White master made, reviewed (passed) and **approved by the owner at go 2**. Package made. Empty room and placement made. **Held at the scene review**: the Gemini blind count answered 503, so the scene is **not reviewed** |

Sender executions: 437 (free connection check: 409, as expected), 439, 441, 443, 445, 447, 449, 451, 453, 455, 457.

## What job `-06` produced

| Output | Drive | sha256 (start) | Size | State |
|---|---|---|---|---|
| White master, attempt 1 | [file](https://drive.google.com/file/d/1sHSOrGPQA5_gMneH5BFLYKZC4-xQ7ivb/view) | `a49a3bc7` | 2048 × 2048 | Review passed; **approved by the owner** (go 2, 07:07:43 UTC) |
| Package jpg | [file](https://drive.google.com/file/d/1k-uNuP_2pM4mLGS35ZSuZHB8GPJ9Tr8i/view) | `03d82632` | 1125 × 1125 | Made without AI; Drive checksum matches |
| Package webp | [file](https://drive.google.com/file/d/1vXMCKlOTdtcxJE6x8qhxBOwp5kgUDedR/view) | `ef41da12` | 1125 × 1125 | Made without AI; Drive checksum matches |
| Manifest v1 | [file](https://drive.google.com/file/d/1vHxAvNdTPqMkMF_eBlpolYODmH0UCoYd/view) | `d3d1d839` | | |
| Empty room (wide) | [file](https://drive.google.com/file/d/1LIaebXYc5f_zTtMnRi5xh-Zgx8x8t7Xw/view) | `af130b51` | 2048 × 2048 | An internal step, not a delivery image |
| Wide scene, attempt 1 | [file](https://drive.google.com/file/d/1Tat1czkXVBmnGREYAcI20DfBxD4EMI1V/view) | `87294c28` | 2048 × 2048 | **Not reviewed** (blind count 503). Not approved. The scene package is **incomplete** |

Local copies of the white master, room and scene are in `claude-outputs/claude-midas-a7-live-test/`. Their checksums match the receipts.

**White master, checked by Claude (not a measurement by A7)**
- 7 pieces, with the arrangement and handedness as in the vendor photo.
- The Ashley logo is gone. The pedestal arch, split uprights and fabric texture are kept.
- Product width from the pixels: 80.0% of the frame. The review read 81%; the band is 72–80%.
- The background is near-white, about 253/255, with the darkest corner pixels at 248. It is not pure #FFFFFF.
- Review scores (model judgements, not measurements, and not the 90–95 target): fidelity 93, integrity 95.

**Wide scene, looked at by Claude (no review by A7)**
- 1 table and 6 chairs. Arrangement and angle as in the vendor photo. The room is the same as the empty room. Daylight comes from the left windows, with a cove light. No added props.
- The runner (SKU 160720) lies along the table and hangs over the left end. It was not compared with its catalogue photo.
- Framing, by eye: the set spans about 79% of the frame width. The wide view asks for 40–55%. This is a styling miss.

## Cost

| Paid call | Status | Cost (from Google's token counts × registry prices dated 14 Oct; an estimate, not an invoice) |
|---|---|---|
| `-03` white master | refused before start | USD 0 expected (not confirmed) |
| `-06` white master | completed | USD 0.0635 |
| `-06` empty room | completed | USD 0.0595 |
| `-06` wide placement | completed | USD 0.0670 |
| **Image calls in total** | | **USD 0.1900** |

The photo readers, conflict checks, planners, plan critics and reviewers have no receipts in A7. Their cost is **not measured**: check the Google, Anthropic and OpenAI billing pages. They are text and vision calls on 6 jobs; Claude has not checked whether the total stays under the USD 2 cap.

## Fixes made during the test (each with the owner's go)

1. **`3203fc38`: 11c Plan critic without `temperature`.** claude-sonnet-5-5 answers HTTP 400 to a non-default temperature, per the Anthropic Sonnet 5 migration guide. Only that option was removed; the diff shows one change. Seen in execution 442.
2. **`8c9b4675`: synchronous Google image call.**
   - 15f now sends `store: false` and no `background`. This is the shape the model test made on 15 Oct (execution 418).
   - The photo type is now read from the bytes. The Test 10 file is a real PNG, so this changed nothing here.
   - 15h now reads a finished answer that has no request id.
   - 15g timeout raised from 60 s to 240 s.
   - Cause: with `background: true` Google answered HTTP 400 "Image input modality is not enabled for models/gemini-nano-banana-2.1-agent". Background mode had never been run for real.
   - Tests: stage 04 40/40 (T3 updated; T38, T39, T40 new).
3. **`006de87c`: crop flag checked against the reader's boxes (04-06 Evidence).**
   - "Cropped" now holds only when a product box touches a frame edge (within 15 of 1000), or when there is no usable box. Otherwise `crop_note` records the reader's flag.
   - Cause: in execution 450 the reader called the photo cropped. Claude looked at the photo: every piece is inside the frame (nearest box edge 96 of 1000). 13 Compile then held after go 1.
   - Tests: stage 04 42/42 (T25 updated so a real crop still holds; T41, T42 new). Reader replay unchanged.

**Checked after each fix**
- All Code nodes in n8n are byte-identical to the repo files (54 of 54), and both prompts are identical.
- Every local suite passes: 87, 42, 9, 100, 36, 103, 65, 58, 56, 86, 79, 1.

## Confirmed for the first time by this test

- The real go 1 and go 2 resume through the decision address: the token, run id and round, then the waiting run continues. A wrong job id gets a 409.
- The real white-master call, receipt, Drive upload and review.
- Stage 06 packaging on a real master, with Drive checksums matching.
- The stage 07 empty room, the live Midas stock read (1 of 1 confirmed) and the placement call with 4 reference images.

## Findings not fixed (owner decisions or later work)

1. **(Update 16 Oct, 07:4x UTC: fallback readers built in A7 version ad7d33eb, not published; see the reader test 2 README.)** **Gemini 3.8 Flash answered 503 in 3 of 8 calls.** These were the photo reader in 2 of 6 jobs and the blind count in 1 of 2 reviews. A7 execution 438 (the free check's decision address) made no model call. Each time A7 held correctly. A longer retry wait, or a fallback reader, is a decision for the owner.
2. **An unreviewed scene has no way to go 2.** The run ends at the hold, so the owner can look at the image but cannot approve it inside A7. Only a new job (new paid calls) would help.
3. **The go 1 ticket does not warn about a stage 04 hold.** The plan could pass go 1 and then hold before the paid call. Fix 3 removes this case, but not the general gap.
4. **The operations row `settings` still records `background: true, store: true`** (15b), although the call is now synchronous. The record is wrong; the call was right.
5. **The placement prompt carries page junk for the Midas size:** "&diams; Table Runner * W220 * D33 * H CM Qty Add to Cart Add Wishlist …". This comes from 19c's size read, with the HTML entity left in. A grammar slip also reads "as Provide a restrained …".
6. **A stale go 2 reply** says "Scene images and the delivery package are not built yet".
7. **Framing:** the white master is at the top of its band (80%). The wide scene is about 79% against 40–55%.
8. **The white background** is about 253, not 255.

## Not checked

- What the text and vision calls cost.
- The scene review, the scene's go 2 and the scene delivery files (stage 07 step 20), because the scene hold stopped the run.
- Repairs (none was ordered). Night or warm light, series, people, side views.
- The runner against its catalogue photo.

## Leftovers (real data from this test; not deleted)

- Runs table `l0roUCBwIQL3h9Eq`: rows 31–36 (jobs `-01` to `-06`).
- Operations table `cw86pzlOSjKSrU01`: rows 2–5.
- Vault rows for these runs; the identity entry and package v1 for photo `f9138489…`.
- Drive, in "Claude · Midas A7 images": the run folders of `-03` and `-06` with the files above.
- Executions 437–457 (A7 and the sender).
- Workflow "Claude · A7 test sender" `Omb5qvpJIJvJty7T` (unpublished): archive or delete it when it is no longer needed.
