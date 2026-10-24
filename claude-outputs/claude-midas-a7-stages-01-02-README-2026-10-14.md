# Midas A7, stages 01–02 (steps 1–9): build README

Date: 14 Oct 2026, 23:35 Amman time. Updated 15 Oct 2026, 03:55.

## Status
- **Workflow:** `Claude · Midas A7 (stages 01–02)`, id `1cgZc9rmBOrPdKIe`, version `ab903fd8-ed4d-44c5-97be-5dc921043ed1`, 36 nodes.
  - The version before the 15 Oct reader-test fixes is `c4656a59-8dbe-4000-bc97-505fcc949059`. It is in n8n's version history if a rollback is needed.
- **Not published.** It is inactive and has no published version. The production address does not answer. Checked in n8n at 03:53.
- **No real run of A7 has been made.**
  - Every model node was pinned in the tests. No OpenAI, Google, Anthropic or fal.ai call was made from A7, and no image was made.
  - The same reader prompts were run for real in the separate reader test workflow. See `claude-midas-a7-reader-test-README-2026-10-15.md`.
- **A6 is unchanged.** Workflow `FPAF0QHltl8iIcdZ` and its tables were not edited.
- **Addresses:** webhook path `claude-midas-a7`. It uses the client header credential. Run ids start with `claude-a7-`.
- **Run log:** `Claude Midas A7 runs` (`l0roUCBwIQL3h9Eq`).
- **Event log:** `Claude Midas A7 vault` (`Tyn4UT6BmIYMHAYl`).

## What it does
The workflow follows Architecture A, "Surgical replacement". It covers stages 01 and 02 of the 21-step design. It stops at **Contract ready** because stage 03 is not built.

| Step | Node | What happens |
|---|---|---|
| 1 | 01 Intent & scope | Reads the brief and maps outcomes to required outputs: one white master, then lifestyle, hero/wide/detail, composition, scene or variations. The cap is 8 outputs. It keeps the client's product description (since 15 Oct). It refuses bad input: an id that is too short or too long, or variations with no parent run. |
| 2 | 02 Ingest files | Gives each file its role (product, room, look, previous result, other view, spec) and a sha256. Reads written files that are text: txt, csv, tsv, md and json (since 15 Oct). Refuses a job with no product photo or a file over 25 MB. Storage is marked "not stored" because Drive is not connected. |
| — | Send job received | Replies 202 `received` before any model runs. A refused job gets 422 with the reasons. |
| 3 | 03 Eye reads the product photo | `gemini-3.8-flash` lists the pieces with boxes. It is never told the expected count. It lists swatch colours apart from the product colour (since 15 Oct). |
| 5 | 05 Second count | `claude-sonnet-5-5` counts the pieces again, also blind. It retries 3 times, 5 seconds apart (since 15 Oct). |
| 6 | 06 Room reader | Reads the room photo, only when one was sent. |
| 4–6 | 04-06 Evidence | Code compares the two counts with the client's number, then with what is written about the product. A printed label never overrides the client. The photo decides colour. A missing fact leads to a hold with one client question. A reader that did not answer leads to an owner hold. |
| 7 | 07 Route | Matches a handling profile from the 44-row table (read only). Sets the gates and adds the cost estimate, labelled "estimate". |
| 8 | 08 Locks and freedoms | Sets locks and freedoms per output. The white master gets "pure white background, neutral studio light, no props, no person". Passes the written information to the conflict check. |
| 9 | 09 Conflict check, 09b Contract | `gpt-6-luna` classifies conflicts and turns written instructions into locks. It runs only when there is something to classify. Code then builds contract vN with a sha256 stamp of canonical JSON, and earlier contracts are voided. If a conflict is still unsettled, the job is held. |
| 19 | V1–V3 Vault | Writes one run row, plus one vault row per event: brief, reference, observation, conflict ledger, contract, voided contract, hold, status. |

## Update, 15 Oct 2026, 03:55: reader test fixes, and written information is read

### Why
The reader test of 15 Oct ran the A7 reader prompts on 10 real photos. It found five gaps in the evidence step. The owner asked for them to be built ("yes build them", 03:38).

The owner also set a rule at 03:46: "anything written about the product must be read and considered if the images doesn't give you what you want".

### What changed
All changes are in the draft, as two new n8n versions: "Reader test fixes 1" and "Reader test fixes 2".

1. **A reader that does not answer goes to the owner, not the client.**
   - This covers a node error such as a 503, an answer cut off at the output limit, and an answer in the wrong format.
   - The run holds with `hold_for: owner` and an empty client question. The hold reason names the reader and the error.
   - Before, the client was asked to "send a clearer photo" when the service was down. The photo-reader, second-count and room-reader all follow the new rule.
   - "Send a clearer photo" now goes to the client only when the reader answered but found no product in the photo.
2. **Set pieces nobody confirmed are checked, then asked about.** This applies only when the client gave no piece count.
   - A companion piece counted with a set (stool, mirror, bench, ottoman, side or coffee table, console, lamp, rug) is a doubt. So is a furniture piece that a reader doubts in its notes (for example "may be staging or part of a set").
   - Each doubt is checked against what is written first:
     - Written as included → it belongs.
     - Written as "sold separately", "without …" or similar → it is excluded, with basis "written".
     - The product type names one item, such as "Bed", and the doubted piece was only noted, not counted → it is not part.
   - Only what is still open goes to the client: "Please confirm which pieces belong to the product. We were not sure about: …"
   - Soft styling (pillows, cushions, throws, bedding) and crossed-out pieces never trigger this.
3. **Printed labels are compared as a total.**
   - Before, each printed item (1 table, 12 chairs, 2 armchairs) was compared with the client's total.
   - Now the items are added up first.
   - With no client number, an itemised label that covers every piece the readers see gives the inventory, with basis "written on the photo". This is the cropped dining set case.
   - A label that does not match what is seen leads to a client question.
4. **Written information is read before anything is asked.**
   - Sources, in this order: the client's own words (product type, category, SKU, description, instructions), written text files they sent, then text printed on the photo.
   - A total the client wrote, such as "7-piece", is used like a client number, and a difference goes to the conflict check.
   - A written file that cannot be read yet (PDF, Excel, Word) is not ignored. If a client question would be raised, the job first holds for the owner, with the file name and the question, so the owner can check the file before the client is asked.
   - The conflict check now receives the written information and the rule: "When the photo does not settle a fact, what is written about the product decides it."
5. **Swatch colours stay apart.**
   - The photo-reader prompt now says the product colour is never taken from a swatch, a fabric sample, a cushion or another colourway.
   - It lists those colours in a new `swatch_colours` field.
   - The colour conflict shows them separately.
6. **The second count retries** 3 times, 5 seconds apart.

Nodes changed:
- `01 Intent & scope`, `02 Ingest files`, `03 Eye reads the product photo` (prompt), `05 Second count` (retry), `04-06 Evidence`, `Hold and ask the client`, `08 Locks and freedoms`, `09 Conflict check` (rules), `V1 Vault events` (the hold event records `hold_for`).
- Connections are unchanged.
- The node "Hold and ask the client" keeps its name, but it now also holds for the owner.

### What was checked, and how
- **34 local tests: 34 passed** (`test/run_tests.js`).
  - The 13 earlier tests still pass.
  - Before the change, 10 of the new tests failed on the deployed code. That confirmed they reproduce the gaps.
  - New tests:

  | Test | Result |
  |---|---|
  | S14 First reader 503 | Owner hold; no client question |
  | S15 First reader cut off | Owner hold |
  | S16 Second count 503 | Owner hold |
  | S17 Room reader 503 | Owner hold, not "send a clearer room photo" |
  | S18 Bedroom set, stool and mirror counted (reader test case 6) | Client asked about mirror and stool |
  | S19 "Bed set", reader doubts the nightstands | Client asked about nightstand |
  | S20 Pillows doubted only (case 1) | No hold; contract ready with 2 |
  | S21 Itemised label covers the 7 seen (case 9) | No hold; inventory 15 from the label |
  | S21b Label says 6 chairs, 8 seen | Client question |
  | S22 Client says 15; label adds up to 15 | No label conflict; contract ready |
  | S23 Client says 13; label adds up to 15 | One "client wins" conflict |
  | S24 Swatch colours | Kept apart from the product colour |
  | S25 "Dresser with mirror" | No question about the mirror |
  | S26 A single stool | No question |
  | S27 Description lists the stool and mirror | No question; 6 pieces |
  | S28 "Stool sold separately" | Stool excluded; only the mirror asked |
  | S29 Product type "Bed", nightstands doubted (case 8) | Proceeds with 1; nightstands recorded as not part |
  | S30 "7-piece" written, readers say 6 and 7 | Written total used; conflict classified |
  | S31 A text spec file lists the stool and mirror | No question |
  | S32 PDF spec cannot be read, question due | Owner hold naming `spec.pdf` and the question |
  | S33 PDF spec cannot be read, nothing to ask | No hold; the file is listed as not read |

- **Replay of the 10 real reader answers** (`test/replay_reader_test.js`, no model call).
  - With no client number, every case where A7 goes ahead matches the owner's answer: Tests 1, 2, 5, 8, 9 and 10.
  - It asks the client on Tests 3, 4 and 6, and holds for the owner on Test 7. The full table is in the reader test README.
- **Deployed code matches the tested files, byte by byte.** I re-read the workflow from n8n and compared all 11 Code nodes, the photo-reader prompt and the conflict-check rules with the local files. All are identical. Only the nine nodes listed changed.
- **3 test runs in n8n, with pinned data on the webhook and the model nodes** (no model was called):

  | Execution | Scenario | Result |
  |---|---|---|
  | 388 | Photo reader returns 503 | Success. Run row 4: status hold, client question empty, reason "The photo reader did not answer (Service unavailable …)". |
  | 389 | Bedroom set, stool and mirror counted, no number | Success. Run row 5: status hold, client question "Please confirm which pieces belong to the product. We were not sure about: mirror, stool." |
  | 390 | Dining set, label "TABLE + 12 CHAIRS + 2 ARMCHAIRS", 7 visible, cropped | Success. Run row 6: contract v1, inventory 1 table + 12 chairs + 2 armchairs, basis "written on the photo". |

### What was not checked
- **Real model calls with the new photo-reader prompt.** Whether Gemini fills `swatch_colours` correctly needs a paid run (Test 4 is the case to watch).
- **Word lists are a first version.**
  - The companion, furniture and doubt-phrase lists cover the 10 test photos and common cases.
  - Other wording from a reader or a client can slip past them. When that happens, A7 still asks if the counts disagree or the photo is cropped, but a doubtful piece could go ahead unasked.
- **Reading written files other than text.** PDF, Excel and Word are registered and named to the owner, but not read.
- **The client page's field for a product description.** Intake reads `item.description`, `item.notes`, `item.details` or `notes`. I have not checked which one the page sends.

### Assumptions
- A written statement from the client (product type, description, files) outranks text printed on the photo. A client number entered as an inventory outranks both.
- A product type with no set words ("Bed", "Sofa") names one item. Pieces a reader only doubts in its notes are then treated as not part of it. Pieces a reader counted as product are still asked about.
- A 503 call is not billed. Not verified.

### Not built yet
- An extract step for PDF, Excel and Word files. n8n's "Extract from File" node can read PDF and Excel; Word needs another route.
- The hold re-entry, so an owner can re-run a job held for the owner with one click.
- Everything listed under "Not built yet" below.

## Update, 15 Oct 2026, 00:40
- The owner replaced the Gemini and Anthropic credentials. I pointed the draft's nodes at the new ones:
  - `03 Eye` and `06 Room reader` now use `g0WJ658hQMZWuEHU`, with model `models/gemini-3.8-flash`.
  - `05 Second count` now uses `3RFaZDH3xCJ3rM63`, a direct Anthropic key that lists `claude-sonnet-5-5`.
- All three model credentials now return their model lists. The Gemini key also lists `models/gemini-nano-banana-2.1` for image generation and editing.
- A Google Drive credential, `Claude · Midas Drive` (`NA6JT99b4IrTLmzl`), now exists. It is not used by this draft yet.
- Later on 15 Oct, after reader test run 1, the output limits were raised and retries added: `03 Eye` to 16000 and `06 Room reader` to 8000, with 3 retries 5 seconds apart.

## What was checked on 14 Oct, and how
- **Code matches the source.** I compared the deployed Code nodes and prompts with the local files in `js/` and `prompts.py`, byte by byte. All were identical.
- **13 local tests: 13 passed** at that time. They are S1–S13 in the list above.
- **3 test runs in n8n, with pinned data on the webhook and the four model nodes:**

  | Execution | Path | Result |
  |---|---|---|
  | 382 | Ready | Success. Contract v1, stamp `sha256:057e3ef3…`, 6 vault rows. |
  | 383 | Hold | Success. Reason: "Two independent counts of the photo disagree (5 and 7) and no number was given." The client question was saved. 5 vault rows. |
  | 384 | Refused | Success. 422 reply "Add at least one product photo." No model node ran. |

## What was not checked (overall)
- **A real run of A7.** No paid call has been made from this workflow.
- **A real multipart upload through the webhook.** The tests pinned the binary file directly.
- **The client page.** It is not connected to A7 yet.
- **CORS.** The webhook still allows any origin. It must be limited to the portal before publishing.

## Assumptions (overall)
- The client page sends a `payload` field (a JSON string) plus the files. The field names follow the A6 page.
- Cost estimates use the A7 cost model of 14 Oct 2026, in USD, and are labelled as estimates.
- A hold ends the run. The answer starts a new run with brief version +1. That re-entry is not built.

## Not built yet
- Stages 03–06 (steps 10–21): retrieval and styling, owner Go 1, images with Nano Banana 2.1, checks and at most two repairs each, the package, owner approval.
- Storage on Google Drive.
- The status endpoint, the hold re-entry, the batch splitter for many products, and an error-trigger workflow.
- Reading PDF, Excel and Word files.

## Owner actions before any real run of A7
1. Add a Gemini API key with billing for images.
2. Choose the Google Drive folder for storage.
3. Give the go for the model test (10 products, about $6.466 estimated, $10 cap) in its own message.

## Leftovers
- **Run log:** 6 rows.
  - Ids 1–3, from 14 Oct: `claude-test-a7-n8n-ready-01`, `-hold-01` and `-refuse-01`.
  - Ids 4–6, from 15 Oct: `claude-test-a7-n8n-owner-01`, `-setpiece-01` and `-label-01`.
- **Vault:** 11 rows from 14 Oct (ids 1–11), plus about 16 rows from executions 388–390. The count of 16 comes from each run's event list (5, 5 and 6). I did not list the rows one by one.
- **Executions:** 382, 383, 384, 388, 389 and 390, all manual test runs with pinned data.
- **Workflow versions:** two new versions from 15 Oct 03:52, plus the earlier 15 Oct changes.
- No scratch workflows were made.
- The rows hold no keys and no real client data. Delete them when you like.

## Files (project `claude-outputs/claude-midas-a7-build/`)
- `js/`: the source of every Code node. Updated 15 Oct: `01_intent.js`, `02_ingest.js`, `04_evidence.js`, `hold.js`, `08_locks.js`, `v1_vault.js`.
- `prompts.py`: the four model prompts, matching n8n as of 15 Oct.
- `build_sdk.py`: builds the full workflow code (`workflow.ts`, about 60 KB, not saved because it can be rebuilt).
- `test/harness.js`, `test/run_tests.js`, `test/profiles.json` and `test/local_results.json`: the local tests (34).
- `test/replay_reader_test.js` and `test/replay_results.json`: the replay of the 10 real reader answers.
- `test/pin_ready.json` and `test/pin_hold.json` (14 Oct), `test/pin_owner.json`, `test/pin_setpiece.json` and `test/pin_label.json` (15 Oct): the pinned data for the n8n tests. They hold a 1×1 test image and no keys.
