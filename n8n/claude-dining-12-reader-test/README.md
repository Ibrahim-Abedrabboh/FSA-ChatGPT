# Claude · Dining 12 reader test (scratch), 17 Oct 2026: README

**PIPELINE TEST ONLY. The photo is a generated test photo, NOT A VENDOR PHOTO.** It is never a vendor photo, a reference or a source for any image job, and is never shown as a Midas product (owner, 17 Oct 01:54).

## Status
- n8n `BySxuove4y88tu74`, version `dc1d4fb0`, **not published**, manual trigger only.
- **One real paid run:** execution **478**, 17 Oct 2026 02:34:00–02:34:28 Amman. Owner's go: 01:54 (one reader call), plus "OK" at 02:31 (sheet and method).
- **Cost:** about **USD 0.012** (1,701 input + 2,910 output tokens × USD 0.75 / 3.75 per million, A7's 01 prices read 16 Oct). An estimate, not an invoice. This counts against the USD 3 Phase 4 cap.

## What it is
- A copy of A7 `eefd6c42` step 03: Gemini 3.8 Flash, the old reader prompt byte-identical, and an output cap of 16,000 tokens.
- Retries are off and there is no gpt-6.1-sol fallback, so there is exactly one call.
- A hash gate stops the run before the call unless the Drive file's sha256 is `5c8b4e5f…16b71a1`.
- Scoring is done in code against the owner's sheet. Nothing is written anywhere.
- Why not A7 itself: unpublished A7 cannot take a job (execution 477: 404). A full A7 job would also make more paid calls before go 1.

## Result: PASS (pipeline test only)

| | Sheet | Read |
|---|---|---|
| Table | 1 | 1 |
| Armless chairs | 10 | 10 (5 front, 5 back) |
| Armchairs | 2 | 2 (one at each end) |
| Product total | 13 | 13 |
| Excluded or other | 0 | 0 |

- Roles: 13 product, 0 context, 0 excluded.
- The 5 back chairs are `seen_whole: false`, and `cropped: false`.
- Relations: "two rows of five along the long sides", "armchairs at the two short ends". No conflicts.
- Full output: `results-execution-478.json`.
- A model judgement, not a measurement. It shows the reader can count this 12-chair set. **Dining stays parked:** a dining image job still needs a real vendor photo of the full set (owner, 01:54).

## Checked
- The gate and scoring code were tested locally: the real file passes, another file is refused, a 12-piece reply is held, and a 503 is held.
- The n8n read-back after creation: the prompt is identical to A7's, and retries are off.

## Leftovers
- Workflow `BySxuove4y88tu74` and execution 478.
- Drive: `Testing/Dining 12/generated-test-photo-NOT-VENDOR.png` (`1akFp64COlPJXetAwuNck_rJNPamZvfMf`).
