# Claude · Midas A7: Phase 4 (second paid test): README

17 Oct 2026, 01:5x Amman. Written by Claude. **Part 1 of the phase: the free checks.** No paid call, no publish. Waiting for the owner's answers and "go".

## Status

- **A7** "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`: version `eefd6c42-ea05-4de8-8a1b-3a7a1008ff4c`, **not published** (n8n: `active: false`, no active version; read 17 Oct, 01:3x). No A7 execution since 16 Oct, 10:15 Amman.
- **Real paid run: none.** Phase 4 cost to date: **USD 0.00** of the USD 3 cap.
- **Phase 2 is still open.** The owner has not yet confirmed in writing that it is closed (choice 1). No paid job starts before that.

## Checks made (all free)

| Check | Result | Evidence |
|---|---|---|
| A7 version to test | `eefd6c42` is the newest version in n8n and the version in the repo export `n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json` (written and byte-checked by `tools/claude-midas-a7-export.py` on 16 Oct). The Code nodes were **not** downloaded again and re-compared in this chat. | n8n version history; repo commit `9804323` |
| D3 review again (white master and scenes) | In `eefd6c42` (16b, G2, G1b, G1d, 18a, 18l, 20a, 20k). | Local suite Phase 1: 82/82 pass, incl. "D3 scene: not reviewed → review again offered" |
| D4 background 255, shadow kept | In `eefd6c42` (18e2, 18e3, Cleaned?, 18g1, 18g2, 18h). | Phase 1 82/82; stage 06 70/70 |
| P1.8 cost receipts for text and vision calls | In `eefd6c42` (01 prices, `text_call` vault events). | Phase 1 82/82 ("V1 writes one text_call event per call") |
| Other suites | Phase 1b 55/55, stage 07 92/92, scene files 70/70, views and framing 79/79. | Run locally 17 Oct, 01:3x |
| Test 8 photo | `Testing/Test 8/main.jpg`, Drive id `1wqXIWE7v1GKIUJJ2nthpzX3biLSbR67Y`. Opens. **PNG** content (name says .jpg), 2048 × 2048 px, 6,838,351 bytes, sha256 `ad85daeda79b04c4a8720202203a786990514ea91eb118be200646c63f724d01`. Under A7's 25 MB limit. | Scratch "Claude · Test 8 photo check (scratch)" `Hfz8axbhMmnU1Oeh`, execution 474 |
| Test 8 facts | Owner's truth sheet (`1cKIwvEn…`, row Test 8, confirmed): bed only, 1 piece; light grey-oatmeal fabric, walnut wood; nightstands, lamps, rug, bedding and cushions are context; no exclusions. Material not confirmed. | Drive read |
| Lamp stock, live (A7's own 19c stock rule) | **174770 RENESMEE table lamp: in stock** (one signal). **174788 white/gold table lamp: conflicting** (in stock and pre-order signals), so A7 would leave it out. Read 17 Oct, 01:44 Amman. | Scratch "Claude · lamp stock read (scratch)" `EgRTlLtMKY6fYwbk`, execution 476 (475 used an earlier parser that found no signal) |
| Test sender 2 | Built: "Claude · A7 test sender 2" `eR7T5l7aQQJlUX6b`, version `66cf41c2`, unpublished. Uses the stored header credentials (`Claude · Midas client header`, `Claude · Midas owner header`) by id; no key was typed, read or saved. | n8n read-back |
| Sender 2 free connection check | Decision for a fake job sent to A7's decision address: **404 "webhook not registered"**, because A7 is unpublished. The sender works; A7 cannot receive a job until it is published. | Execution 477 |
| Sender 2 dry run (local) | Its job payload goes through A7's 01 Intent & scope with no problems. Brief "website": white master, hero, wide, detail (Daylight). Brief "lifestyle_wide_closeup": white master, wide, detail. Bad job ids, unknown briefs and unknown decisions are refused. | Local, no network |

## Changes in sender 2 (against the repo export of the archived sender)

- Test 8 photo and Test 8 facts from the truth sheet.
- Job ids must be `claude-a7-p4-YYYYMMDD-<product>-NN`.
- The brief is one of two, named by the owner: `website` or `lifestyle_wide_closeup`.
- Go 2 decisions `review_again` and `approve_unreviewed` (D3) are allowed.
- Code: `n8n/claude-a7-test-sender/claude-a7-test-sender-2.sdk.js`.

## Findings that need the owner

1. **Phase 2 closed?** Written confirmation needed (choice 1).
2. **The brief.** Since D8 (B), "Category template" makes the white master and the **hero only**. Three scenes (hero, wide, detail) come from the **Website** outcome. The alternative, Lifestyle "Wide view + close-up", gives two scenes.
3. **The night image.** A7 has no brief for "one night image made from the approved image". Light is set per job, and the only per-image light route is the "Views by light" series (9 images in 3 lights, which includes warm light). So a night image this phase needs either that series, a new A7 version (owner's go), or none.
4. **Publishing.** Execution 477 shows A7 must be published to take the job (choice 6). Publish, run, and unpublish straight after.
5. **The Test 8 file is a 2048 × 2048 PNG.** Please confirm it is the vendor's original photo, not a generated image.

## Not checked

- The Code nodes of `eefd6c42` were not re-downloaded and byte-compared in this chat (version id match only).
- Nothing on n8n Cloud that Phase 1 left for a real run (BMP read/write, simplify-off reply shapes, review again after the wait).

## Leftovers so far

- Workflows (unpublished): "Claude · Test 8 photo check (scratch)" `Hfz8axbhMmnU1Oeh`; "Claude · lamp stock read (scratch)" `EgRTlLtMKY6fYwbk`; "Claude · A7 test sender 2" `eR7T5l7aQQJlUX6b` (kept for the test).
- Executions 474, 475, 476, 477.
- No data table rows, Drive files or A7 runs were made.

## Update, 17 Oct 2026, 02:3x: Dining 12 reader test (pipeline test only)

- Owner, 01:54 and 02:31: ONE paid reader call on a **generated test photo, NOT A VENDOR PHOTO**. Results are "pipeline test only". Dining stays parked, and Phase 4 stays Test 8 only.
- Scratch "Claude · Dining 12 reader test (scratch)" `BySxuove4y88tu74`, unpublished, execution **478**. It is a copy of A7 03: Gemini 3.8 Flash, old prompt byte-identical, no retry, no fallback, and a hash gate before the call.
- **Result: PASS (pipeline test only):** 13 product pieces = 1 table + 10 armless (5 + 5) + 2 armchairs (one at each end). Nothing excluded, not cropped.
- **Cost:** about USD 0.012 (1,701 + 2,910 tokens), an estimate.
- **Phase 4 cost to date: about USD 0.012 of the USD 3 cap.**
- Details: `n8n/claude-dining-12-reader-test/README.md`. Photo record: `data/claude-midas-dining-12-generated-test-photo-2026-10-17.json`.
- Leftovers added:
  - workflow `BySxuove4y88tu74`, execution 478;
  - Drive folder `Testing/Dining 12` with `generated-test-photo-NOT-VENDOR.png`;
  - from the earlier free checks in another chat: `dB5mXV1fgKSG6uFz` (execution 471) and `QKNubeKlqZhyU9sx` (472–473).
