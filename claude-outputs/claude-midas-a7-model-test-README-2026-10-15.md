# Claude · Midas A7 model test: README

15 Oct 2026, Amman time. Written by Claude. First written 12:10; updated 16:25 (first paid run), 16:40 (owner verdict) and 21:30 (owner answers applied; see "Build 21:25"), 16 Oct 2026, 02:45 (MT4 aligned to hold and ask; see "Build 16 Oct 01:50").

## Status

- Two draft workflows. Neither is published.
  - "Claude · Midas A7 model test", id `WvmDSrnX6lYdiKzZ`, 20 nodes. Latest version: "Owner answers 21:12 applied (plan + settings)".
  - "Claude · Midas A7 model test · one call", id `MYwlkpnVdCqoEmfR`, version `e66075ec-568b-4212-989c-689200762e37`, 20 nodes. Not changed today after 12:06.
- Data table "Claude Midas A7 model test" (`LqajV3K8gVqYaN3E`): results and verdict columns.
- **One real paid run made** (Test 10, execution 417, 16:17). The paid switch is off; no go token is set.
- A7 (`1cgZc9rmBOrPdKIe`), A6 and Pipelines 3 and 5 were not changed.

## Build 16 Oct 01:50: MT4 aligned to hold and ask

Owner answer, 16 Oct 01:40: "Align to hold and ask". Code in GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, commit `1f22401`.

**What changed (model test only)**
- MT4 Plan now uses A7's rule (13 Compile, 16 Oct 00:50). If the sheet inventory names something the first reader marked as room context, and the reader's product pieces do not already cover it, no call is planned for that case. The reason says "room context; A7 holds and asks the owner".
- This check runs before the piece-count check, as in A7.
- Every room-context entry is now told to be left out of the white master, as in A7. The 21:20 exception (a context entry naming an inventory piece was not told to be left out) is removed.
- The head-word matching is copied unchanged from 13 Compile.

**Status**
- n8n `WvmDSrnX6lYdiKzZ`, version `2614706e`. Not published. Not run after the change. The paid switch stays off.

**What was checked, and how**
- 9 local tests, with readings abridged from reader-test rows 15 and 17:
  - the current sheet (16 Oct) plans Test 6 and Test 8, with the paid switch off;
  - Test 8: inventory "1 x bed" in the prompt, and the context nightstand is told to be left out;
  - the old sheet ("bed + nightstands"): Test 8 is held, no call, and only Test 6 is planned;
  - an extra context nightstand while 2 product nightstands are seen: planned, as in A7.
- Byte check: the 7 Code nodes read back from n8n match the repo files.

**Not checked:** a free preview run in n8n after the change.

The "Finding for A7" under "Build 21:25" below is now answered: both A7 and the model test hold and ask.

## Build 21:25: owner answers applied

Owner answers in chat, 21:06 and 21:12: Test 3 = 7 pieces; Test 6 = yes, yes, 6 pieces; Test 7 = test from the sheet alone; Test 8 = the bed plus 2 nightstands, 3 pieces; Test 1 = drop the reader's relation line; Test 4 = "rust red" is the pillows, drop it.

**What changed (model test only)**
- MT1 Config: `prompt_edits` (Test 1 relation lines dropped; Test 4 colour line without "rust red"), `no_reading_ok: ['Test 7']`, `expected_counts: {Test 3: 7, Test 6: 6, Test 8: 3}`, Test 8 off the skip list.
- MT4 Plan: applies those edits to the photo reading before the prompt is built. A context entry whose head word names a furniture piece of the confirmed inventory is no longer told to be left out. A case with no reading and `no_reading_ok` uses the sheet's "true colour" as the client's colour line. A case whose sheet count differs from the owner's chat answer is skipped with that reason.
- **The prompt function is unchanged.** It is still the stage 04 "13 Compile" function.
- Record of the code change: `claude-midas-a7-model-test/js/mt4_plan_patch_2026-10-15.js`. `src/mt4_plan.src.js` does not include it yet.

**What was checked, and how**
- Helper tests on the real sheet texts (head words, colour removal): all pass.
- Local run on preview 421's own n8n inputs, old settings: every prompt identical to 421, byte for byte.
- Same inputs, new settings: only the intended lines change (Test 1: the relation line is gone; Test 4: "light grey/cream, reddish-brown/mauve and dark brown"); Test 7 planned with the sheet's colour.
- Deployed code: on preview 422's inputs, n8n's MT4 output equals the local code's output (cases, prompts and totals).
- Free preview 422 (21:26): nothing sent or paid.

**Preview 422 (live sheet)**

| Case | Result |
|---|---|
| Test 1 | planned (relation line dropped) |
| Test 2 | planned, prompt as before |
| Test 3 | skipped: the reading says the photo is cropped (A7 would hold it) |
| Test 4 | planned ("rust red" dropped) |
| Test 5 | planned, prompt as before |
| Test 6 | skipped: the owner said 6 pieces, the sheet count says 7 |
| Test 7 | planned from the sheet alone |
| Test 8 | skipped: both photo readers counted 1 piece; the sheet says 3 (A7 would hold it) |
| Test 9 | skipped (skip list: cropped, label count) |
| Test 10 | planned, prompt as before (already made) |

12 calls planned, about USD 1.39 reserved (estimate, registry prices of 14 Oct). Without Test 10: Tests 1, 2, 4, 5, 7 = 10 calls on both models (about USD 1.16) or 5 calls on Nano Banana 2.1 only (about USD 0.35).

**Finding for A7 (not changed)**
- Test 8: the readers counted the nightstands as room context, so they "saw" 1 piece. With the owner's count of 3, the test holds, and A7's stage 04 ("13 Compile": fewer pieces seen than the contract holds) would hold the same real job. A7 stage 01 would also raise a piece-count conflict. A fix would count a context piece that names a confirmed inventory piece as seen, in A7 and the model test together. Owner decision.
- The same A7 prompt builder tells the model to leave out every context entry, even one that is part of the confirmed inventory. The model test now avoids that; A7 does not yet.

## Paid run 1: Test 10 (15 Oct 2026, 16:17–16:21 Amman)

- Run id `claude-mt-20261015131753`. Executions 417 (parent), 418 (2.1), 419 (Pro). All succeeded.

| Model | Status | Time | Size | Cost (estimate, not an invoice) | Image | Owner verdict |
|---|---|---|---|---|---|---|
| gemini-nano-banana-2.1 | completed | 18 s | 2048 × 2048 | USD 0.0563 | [Drive](https://drive.google.com/file/d/1Bj71peI3qDj2i3h2-zuwIlZOyxeQeq0D/view) | **go** (truth sheet, column K) |
| gemini-3-pro-image | completed | 149 s | 2048 × 2048 | USD 0.1432 | [Drive](https://drive.google.com/file/d/1B7CeFcdv4cmS1AKqcj14bKga-N8bS9qx/view) | not given |

- Confirmed: the request shape on the Interactions route for both models (frame and size honoured), the live Drive steps, and that the parent can call the unpublished child. Not confirmed: stage 04's background and polling path.
- The verdict columns in the n8n results table are still empty (no row-update tool); the truth sheet is the record.

## How it works (unchanged)

1. Reads the registry, the reader readings, the truth sheet (Drive, as CSV) and the Drive > Testing folders.
2. MT4 Plan keeps cases the owner confirmed with a plain count, builds the stage 04 white-master prompt, and holds cropped photos or photos showing fewer pieces than the sheet.
3. Preview stops there. A paid run needs `paid_calls_allowed: true` and a new `go_token`; MT6 Guard, MT7 run folder, MT9 one call per order.
4. Never paying twice: operation key per token, folder and model; reserve and read back before sending; uncertain outcomes never re-sent.

## Not checked

- Tests 1, 2, 4, 5 and 7 on real calls.
- gemini-3-pro-image's reference limit and frames other than 1:1.

## Owner decisions

1. Test 6: the sheet count says 7; your answer was 6 (bed, 2 nightstands, dresser, mirror, stool). Fix the cell.
2. ~~Test 8 context rule~~: answered (hold and ask, 16 Oct 00:50 and 01:40). The sheet now says the bed only, 1 piece.
3. Next paid batch, in its own message: which cases and which models.

## Leftovers

- Results table: rows 1–3 simulated (`claude-mt-test-child-…`; row 2's error text is invented test data). Rows 4–5: real Test 10 results.
- Drive: run folder "Claude model test · claude-mt-20261015131753" in Testing.
- Executions 408–416 (pinned), 417–419 (real, paid), 420–422 (free previews).
- No scratch workflows.

## Files (project `claude-outputs/claude-midas-a7-model-test/`)

- `js/`: `mt1_config.js` (21:20), `mt4_plan_patch_2026-10-15.js` (new), `mt_read_sheet.js`, `mt_pair.js`, `mt6_guard.js`, `mt8_orders.js`, `mt10_summary.js`; child `c1_check.js`, `c3_budget.js`, `c4_build.js`, `c6_ready.js`, `c8_read.js`, `c10_final.js`, `c12_return.js`.
- `src/mt4_plan.src.js` and `build_plan.py` (before the 21:20 patch).
