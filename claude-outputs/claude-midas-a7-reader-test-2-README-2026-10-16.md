# Claude · Midas A7 reader test 2 (OpenAI fallback): README

16 Oct 2026, 07:26–07:33 UTC (10:26–10:33 Amman). Written by Claude.

## Status

- Workflow: "Claude · Midas A7 reader test 2 (OpenAI fallback)", id `Q7IlyqUHtmEu7kEH`, 12 nodes. **Not published.** It has a manual trigger only and writes to no table.
- **One real paid run:** execution 459, made with the owner's go (cap USD 1). It made 12 OpenAI calls to `gpt-6.1-sol` and nothing else.
- A7 was **not changed** by this test.
- Source: `n8n/claude-midas-a7-reader-test-2/reader-test-2.sdk.js`.

## Owner decisions (16 Oct, 10:2x Amman)

- The new reader is a **fallback only**: Gemini stays first.
- Model family: **OpenAI vision**.
- A reader test before any A7 change, capped at **USD 1**.
- Gemini's own retries go to **5 tries, 15 s apart**. Not built yet.

## What it ran

- **Part A:** A7's own photo-reader prompt (`03 Eye`, A7 version 006de87c, unchanged), on `main.*` in Drive > Testing > Test 1–10. Settings: `detail: high`, output cap 6000.
- **Part B:** A7's blind-count prompts (`16a`, copied from execution 454), on the Test 10 white master and wide scene made in the first paid test.
- Gemini's answers to the same photos come from reader test 1 (executions 386 and 387, table `U0quiuvjYjGt3HpZ`).

## Part A: photo reader against the owner's truth sheet

| Test | Owner | Gemini 3.8 Flash | gpt-6.1-sol | Note on gpt-6.1-sol |
|---|---|---|---|---|
| 1 | 2 | 2 ✓ | **1 ✗** | Read the chaise photo as "the sofa from the opposite angle" |
| 2 | 2 | 2 ✓ | **1 ✗** | Same: "an alternative configuration", not a second piece |
| 3 | 7 (modules; the sheet note is unclear) | 6 | **14 ✗** | Counted 7 cushions and the coffee table as product |
| 4 | 4 | 4 ✓ | 4 ✓ | Swatches kept apart |
| 5 | 4 | 4 ✓ | 4 ✓ by count | Kinds wrong: 1 sofa + 3 chairs (the owner has 2 sofas + 2 armchairs) |
| 6 | 6 | 6 ✓ | **5 ✗** | Missed the second nightstand. The crossed chest and wardrobe were correctly excluded |
| 7 | 2 | no answer (503, twice) | 2 ✓ | The two different shapes were kept different |
| 8 | 1 | 1 ✓ | 1 ✓ | Nightstands and lamps read as context |
| 9 | 15 (label) / 7 visible | 7 + label | 7 + label | Same as Gemini |
| 10 | 7 | 7 ✓ | 7 ✓ | The Ashley logo was read as a printed label |

**Boxes.** Where both readers answered, gpt-6.1-sol's product boxes are within a few thousandths of Gemini's: Test 8 bed [248,62,835,942] against [248,62,835,946]; Test 10 table [359,225,652,871] against [358,224,654,866]. A few *context* boxes were invalid (ymax < ymin), but no product box was.

**Crop flag.** gpt-6.1-sol said "cropped" on 8 of 10 photos. A7's prompt defines cropped as "cut off by the frame **or hidden behind something**", so occluded pieces count. The box check from fix 3 (A7 006de87c) leaves only Test 9 as cropped, with a product box at the edge (0 of 1000), and Test 9 is the one photo that really is cropped. So fix 3 also works for this reader.

## Part B: blind count (the review's second counter)

| Image | Total | Background white | Text/logo | box_2d | Width from the box | Claude's pixel or visual check |
|---|---|---|---|---|---|---|
| White master (exec 454) | 7 ✓ | true | false | [337,99,699,901] | 80.2% | 80.0% from pixels |
| Wide scene (exec 454) | 7 ✓ | n/a | false | [486,109,851,902] | 79.3% | about 79% by eye |

## Cost

- **Not measured.** The node runs with "simplify" on, which drops the token counts. Check the OpenAI billing page.
- Upper bound from the output caps: 12 calls × (about 4k input × USD 2/M + 6k output × USD 10/M) ≈ **USD 0.82 at most**. This is an estimate, and it is under the USD 1 cap.
- Prices are OpenAI's standard short-context rates for gpt-6.1-sol (USD 2 input, USD 10 output per million tokens), read 16 Oct 2026 at developers.openai.com/api/docs/pricing.

## What this means (Claude's reading; for the owner to decide)

1. **Blind count (16x) fallback → gpt-6.1-sol:** a good fit. It got 2 of 2, and its frame shares match the pixels.
2. **Photo reader (03) fallback → gpt-6.1-sol:** usable only as a fallback, and it will cause more holds.
   - It missed 3 counts that Gemini got right: Tests 1 and 2 (pieces photographed apart) and Test 6 (a hidden nightstand). It also overcounted Test 3.
   - In A7 those misses do not change the product, because the client's inventory and the second count decide the count. But 13 Compile holds when the reader saw fewer pieces than the contract, so Tests 1, 2 and 6 would hold for the owner.
3. **Room reader (06):** not tested; there is no room photo in the test set.
4. **Prompt notes (not changed):**
   - Add a line that pieces of one set may be photographed apart in one image (Tests 1 and 2).
   - Split "cropped" (cut off by the frame) from "hidden" (behind another piece).
   - Both would need a new test on both readers.

## Leftovers

- Workflow `Q7IlyqUHtmEu7kEH` (unpublished) and execution 459.
- No table rows and no Drive files.

## Build, 16 Oct 2026, 07:4x UTC: fallback readers in A7 (owner: "Both fallbacks + retries")

**Status**
- A7 `1cgZc9rmBOrPdKIe`, new version `ad7d33eb-d392-4335-a045-93a3688f22f8`, saved in three steps: nodes and wiring, 04-06 Evidence, 16b.
- **Not published. Not run.** The last published version is 006de87c, and A7 is currently unpublished.
- The version stays unpublished until the owner says so.

**What changed**
- **Retries:** `03 Eye`, `06 Room reader` and `16x Blind count` now try 5 times, 5 s apart (they tried 3 times before). The owner asked for 15 s, but **n8n allows at most 5 s between tries**, so the wait is 5 s.
- **Fallback:** after each of those nodes, an IF checks for an error.
  - On an error, the same input goes to a gpt-6.1-sol node with the same prompt: `03b Eye fallback (OpenAI)` (output cap 16000), `06b Room fallback (OpenAI)` (8000) and `16xb Blind count fallback (OpenAI)` (8000).
  - Each fallback node retries 3 times, 5 s apart, and continues on error.
  - Three small Code nodes (`03a`, `06a`, `16xa`) hand the photo back to the fallback.
- **04-06 Evidence:**
  - It reads the fallback only when the Gemini node of this run returned an error, so it never reads an old answer.
  - When both readers fail, the owner hold names both. The client is never asked.
  - `observation.readers_used` and the trail record which reader answered.
- **16b Review verdict:** the same rule for the blind count. The review records `blind_reader` and the readers line.
- The second count, the plan critic and the reviewer stay Claude, so every pair of readers is from two different families.

**Checked**
- Local tests: the new suite `tests/claude-midas-a7-fallback` passes 13/13 (F1–F13: photo, room and blind-count fallback, both readers failing, stale answers ignored, a fallback that sees fewer pieces). All other suites pass: 87, 42, 9, 100, 36, 103, 65, 58, 56, 86, 79 and 1.
- In n8n, the 57 Code nodes are byte-identical to the repo, both prompts are identical, and the 03b prompt is byte-identical to 03's (same sha256). The wiring and retry settings were read back.

**Not checked**
- No n8n run, pinned or real. A pinned run cannot carry the product photo into 02 Ingest.
- The fallback's first real use will be the next time Gemini fails on a live job.
- The room fallback has never seen a real room photo.

**Known effect:** when the photo fallback reads, expect more holds for the owner. gpt-6.1-sol missed pieces photographed apart (Tests 1 and 2) and a hidden nightstand (Test 6). 13 Compile holds when the reader saw fewer pieces than the contract.
