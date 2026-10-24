# Midas A7 reader test: build README

Updated: 15 Oct 2026, 03:55 Amman time. First written 01:10 the same day.

## Status
- **Workflow:** `Claude · Midas A7 reader test`, id `4Ev84j0HwluPpACo`, 16 nodes.
- **Not published.** It starts only from its manual trigger and has no webhook. Checked in n8n at 03:54: inactive, no published version.
- **Real runs made: two.**
  - Run 1: execution 386, 14 Oct 22:06–22:10 UTC, all 10 folders.
  - Rerun: execution 387, 15 Oct 00:23–00:25 UTC (03:23–03:25 Amman), Tests 4 and 6–10. The owner gave the go ("go rerun") at 03:22.
- **The test is finished.** The owner has answered all 10 cases. Test 3 needs a recheck (see "Check with the owner").
- **The gaps it found are now built** into the A7 draft. That work is described in the A7 README: `claude-midas-a7-stages-01-02-README-2026-10-14.md`, section "Update, 15 Oct 2026, 03:55".
- **Results table:** `Claude Midas A7 reader test` (`U0quiuvjYjGt3HpZ`).
- **Run ids** start with `claude-rt-`.
- **Config** is set to all folders (`only_folders: []`).

## What it does
1. It lists the folders named `Test N` in Drive > Testing (`1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1`). It uses the `Claude · Midas Drive` credential.
2. It takes the image named `main.*` in each folder. A folder with no photo gets a row saying so.
3. It runs the same two blind counts as A7 stage 01, with the same prompts. Neither reader is told the expected number.
   - `gemini-3.8-flash` lists the pieces with boxes. Output limit 16000. Retries 3 times, 5 seconds apart.
   - `claude-sonnet-5-5` counts the pieces. Output limit 1500. Retries 3 times, 5 seconds apart (since 03:54).
4. It reads the owner's answer sheet `claude-midas-model-test-truth (10 cases, confirm each row)` as CSV.
5. It scores each count as match, miss, "provisional" (the owner has not confirmed the row) or "answer not given yet".
6. It saves one row per folder and returns a summary.

Scores are model readings compared with the owner's sheet. They are not measurements.

## Final results, 15 Oct 2026

How to read this table:
- **Owner answer** comes from the answer sheet, re-read at 03:22, except Test 6. The owner answered Test 6 in chat at 03:38.
- **First** is `gemini-3.8-flash`. **Second** is `claude-sonnet-5-5`.
- **Run** says which execution the counts come from.
- Rows from run 1 were scored by that run as "provisional", because the sheet was not filled yet. I re-scored them by hand. Test 6 is also scored by hand, from the chat answer.

| Test | Owner answer | First | Second | Agree | Result | Hand, excluded pieces, notes | Run |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 2 | 2 | yes | both match | Hand read right: chaise on the left, sofa arm on the right. The 2 cushions were treated as styling, not pieces. | 386 |
| 2 | 2 | 2 | 2 | yes | both match | The first reader read the hand right: sofa arm on the left, chaise on the right. The second count named no side. It did not come out as Test 1. | 386 |
| 3 | 3 ("FULL ROOM"), to recheck | 6 (cropped) | 7 | no | both miss (6 and 7 vs 3) | The first reader saw 4 armless seats, 1 corner seat and 1 one-arm seat, with the arm on the right. Both treated the white-background module as a view, not a piece. | 386 |
| 4 | 4 | 4 | 2 | no | first match; second miss (2 vs 4) | The first reader saw a left-hand and a right-hand curved sofa plus 2 swivel chairs. The second count thought each pair was one piece shown twice, and said 4 was possible. All 4 swatches were treated as swatches. | 387 |
| 5 | 4 | 4 | 4 | yes | both match | 2 sofas and 2 armchairs. The 3 swatches were not counted. | 386 |
| 6 | 4: bed, 2 nightstands, dresser. The stool and mirror are not part of the set. | 6 | 6 | yes | both miss (6 vs 4) | Both readers excluded the crossed-out tall chest and wardrobe. Both counted the mirror and the stool as product. See the X note below. | 387 |
| 7 | 2 | none (503) | 2 | — | second match | Google returned "Service unavailable" in both runs, even after 3 retries. The second count kept the two shapes different: a half-disc on the left and a U shape on the right. | 387 |
| 8 | 1 (bed only) | 1 | 1 | yes | both match | The first reader marked the nightstand as context. The second count flagged that the nightstands might belong to a set. | 387 |
| 9 | 15 | 7 (cropped) | 7 (cropped) | yes | both "miss (7 vs 15)", expected | Only 7 pieces are visible. The first reader read the printed label "TABLE + 12 CHAIRS + 2 ARMCHAIRS". A "miss" here is the correct reading of the photo. | 387 |
| 10 | 7 | 7 | 7 | yes | both match | 1 table and 6 chairs. The Ashley logo was read as a brand label, not a piece. | 387 |

**Test 6, the X marks.** The owner says the stool and mirror are out "since they have X". Both readers, run separately, put the X marks on the tall chest and the wardrobe only. Neither saw an X on the stool or the mirror.
- If the stool and mirror do carry X marks, both readers missed them. That would be a reader error to note.
- If the X marks are only on the chest and wardrobe, the stool and mirror are out for another reason, and the readers were right about the marks.
- I could not view the image from here to settle it. Please check the photo.

### Totals (all 10 answered; Test 3 to recheck)
- **First reader answered** 9 of 10. It never answered Test 7.
  - Matches: Tests 1, 2, 4, 5, 8 and 10 (6).
  - Misses: Tests 3 and 6, and Test 9 by design.
- **Second count answered** all 10.
  - Matches: Tests 1, 2, 5, 7, 8 and 10 (6).
  - Misses: Tests 3, 4 and 6, and Test 9 by design.
- **When both readers agreed** on an uncropped photo, they matched the owner 5 times out of 6. The exception was Test 6: both counted the stool and mirror.
- **When they disagreed** (Tests 3 and 4), at least one reader was wrong both times.
- This is a small sample: 10 photos, one reading each. It shows how the rules behave. It does not show a reliable error rate.

## What this means for A7's rules
Before the fixes, A7 had five gaps:
1. A reader outage became a client question asking for "a clearer photo".
2. A set piece nobody had confirmed (Test 6) would have gone ahead.
3. The printed label was compared item by item instead of as a total.
4. Swatch colours could leak into the photo colour.
5. The second count had no retry.

On 15 Oct the owner asked for these to be built. The owner also asked that anything written about the product be read and used when the photo does not settle a question.

All of this is built and tested with pinned data in the A7 draft. See the A7 README.

Replaying the real readings from these runs through the new A7 code, with no client number:

| Test | Owner answer | A7 now | Before the fixes |
|---|---|---|---|
| 1 | 2 | proceeds with 2 | proceeds with 2 |
| 2 | 2 | proceeds with 2 | proceeds with 2 |
| 3 | 3, to recheck | asks the client how many pieces (readers disagree) | same |
| 4 | 4 | asks the client how many pieces (readers disagree) | same |
| 5 | 4 | proceeds with 4 | proceeds with 4 |
| 6 | 4 | asks the client: "not sure about: mirror, stool" | proceeded with 6 (wrong) |
| 7 | 2 | holds for the owner: the reader did not answer, and the client is not asked | asked the client for a clearer photo (wrong question) |
| 8 | 1 | proceeds with 1: the written product type "bed" names one item, so the doubted nightstands are not part | proceeded with 1 |
| 9 | 15 | proceeds with 15 from the written label: 1 table, 12 chairs, 2 armchairs | held, because the photo was cropped |
| 10 | 7 | proceeds with 7 | proceeds with 7 |

- Every case where A7 now goes ahead matches the owner's answer.
- **Assumption in this replay:** the product type each client typed is taken from the sheet's "product type" column ("bed", "dining set", and so on). With a different product type, Tests 8 and 9 could ask instead.
- The replay keeps the readers' pieces, roles, notes, labels and cropping. It leaves out boxes and long text.
- It ran the A7 code locally. It made no model call.

## Check with the owner
- **Test 3:** the sheet says "FULL ROOM" with a count of 3. Both readers counted 6 or 7 modules in the room arrangement.
  - If 3 is right, please say which 3 pieces.
  - Otherwise, please correct the count.
- **Test 6:** please check where the X marks are (see above).
  - I did not write your Test 6 answer into the sheet. Enter "yes 4" in the "Answer" column and 4 in "true piece count" if you want the next run to score it.
- **Test 9:** the count cell still reads "15 (from the printed label; not confirmed)". The "Answer" column says "yes", so I treated 15 as confirmed.

## Changes made in this chat (15 Oct, all in the reader test draft)
1. **03:23 — the scorer reads the "Answer" column.**
   - A row now counts as confirmed when either column says so.
   - An "Answer" cell starting with "no" does not count.
   - n8n version: "Scorer also reads the owner's Answer column".
2. **03:28 — `only_folders` set back to `[]`.** n8n version: "Config back to all Test folders".
3. **03:54 — same prompt as A7, and the second count retries.**
   - The first reader now uses the A7 photo-reader prompt. That prompt keeps swatch colours apart (`swatch_colours`) from the product colour.
   - The second count retries 3 times, 5 seconds apart.
   - n8n version: "Same Eye prompt as A7; second count retries".
   - Not run.
4. **Source files synced in the project:** `readertest/js/score.js` and `readertest/js/config.js`. `../prompts.py` was updated with the A7 prompts.

The A7 draft `1cgZc9rmBOrPdKIe` was changed in this chat; see its README. A6 `FPAF0QHltl8iIcdZ` was not touched.

## What was checked, and how
- Execution 387 finished with status "success". I read its "Score against the answer sheet" and "Summary" outputs.
- The summary reported: 6 folders, 5 read by both readers, 4 agreeing, 5 final rows, and 1 problem (Test 7, 503).
- Run 1 rows for Tests 1, 2, 3 and 5 were read from the results table and re-scored by hand.
- The answer sheet was re-read from Drive at 03:22.
- After the 03:54 change, I re-read the workflow in n8n. The prompt and retry are in place, it is still inactive, and `only_folders` is `[]`.

## What was not checked
- **The new prompt with a real model.** A paid run is needed to see whether `swatch_colours` works on Test 4.
- **Real token use.** The Gemini node runs with "simplify" on, which drops `usageMetadata`. Exact spend is in the Google and Anthropic consoles.
- **The Test 6 photo itself.** It could not be viewed from here.

## Cost
These are estimates, in USD, with list prices from `claude-midas-a7-design/cost_model.json`.

**Per-call ceilings, from the output limits:**
- First reader, at most about $0.0613 per photo: 1,740 input tokens at $0.75 per million, plus 16,000 output tokens at $3.75 per million.
- Second count, at most about $0.020 per photo: about 2,500 input tokens at $2 per million, plus 1,500 output tokens at $10 per million.

**Bounds per run:**

| Run | Billed calls (assumed) | Old cost model | Ceiling |
|---|---|---|---|
| 386 | 5 first-reader (4 answers, plus Test 4 cut off at 6000), 10 second-count | about $0.130 | about $0.319 |
| 387 | 5 first-reader, 6 second-count | about $0.090 | about $0.427 |

- Calls that got 503 are assumed not billed. Not verified.
- **Total for the reader test: between about $0.22 and $0.75.** The real figure is in the consoles.
- No paid call was made after 03:25.

**Cost model note:**
- `cost_model.json` assumes 519 output tokens for photo reading. That is too low, because Gemini's thinking counts as output.
- In the rerun, the first reader took 91 seconds for 6 photos, against 25 seconds for the second count. Both point to far more than 519 output tokens.
- I have **not** changed `cost_model.json`. There is no measured number yet.
- To measure it, either read the 15 Oct token counts in the Google AI Studio usage page, or turn "simplify" off on the first reader in a draft and log `usageMetadata`.

## Leftovers
- **Reader test table** (`U0quiuvjYjGt3HpZ`), 19 rows. None hold keys or client data.
  - 3 rows from the pinned test, run `claude-rt-20261014220521` (ids 1–3).
  - 10 rows from run 1, run `claude-rt-20261014220656` (ids 4–13).
  - 6 rows from the rerun, run `claude-rt-20261015002326` (ids 14–19).
- **Executions:** 385 (pinned), 386 (real), 387 (real). All manual.
- **Workflow versions:** three new versions on `4Ev84j0HwluPpACo` from this chat.
- **Drive:**
  - Folders `Test 1` to `Test 10` in Testing.
  - The answer sheet, with the owner's "Answer" column.
  - Two earlier versions of the answer sheet in the Drive bin.
- **No scratch workflows.**

## Noticed, not changed
- **A6 (`FPAF0QHltl8iIcdZ`) is active and published in n8n.**
- Its description still says "Draft A6 … Not published. No paid run made." Its last update (14 Oct 08:32 UTC) is before this chat.
- Please confirm A6 is meant to be live.

## Files
`claude-outputs/claude-midas-a7-build/readertest/`:
- `js/`: the Code nodes. `score.js` and `config.js` match n8n as of 15 Oct.
- `build.py`: builds the workflow code from `js/` and `../prompts.py`. `prompts.py` now holds the 15 Oct prompts.
- `pins.json`: the pinned test data. It holds no keys.

`claude-outputs/claude-midas-a7-build/test/`:
- `replay_reader_test.js` and `replay_results.json`: the replay of the real readings above.

## History: before the rerun
- **Run 1 (execution 386):**
  - The first reader answered 4 of 10. Tests 6–10 got 503, and Test 4 was cut off at the 6000 output limit.
  - The second count answered all 10.
- **Fixes made after run 1, before the rerun (draft only):**
  - First reader: output limit 6000 to 16000, 3 retries 5 seconds apart, and a cut-off answer is reported.
  - The same output and retry fix was applied to the A7 draft: `03 Eye` at 16000 and `06 Room reader` at 8000.
- **Pinned test (execution 385):** checked the scoring and the "no photo" path. No model was called.
