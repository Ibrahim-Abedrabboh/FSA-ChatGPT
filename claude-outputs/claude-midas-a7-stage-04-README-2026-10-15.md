# Claude · Midas A7, stage 04 (Compile & dispatch): README

15 Oct 2026, Amman time. Written by Claude. Updated 15 Oct 2026, 15:45 and 16:06 (see "Updates").

## Status

- Workflow: "Claude · Midas A7 (stages 01–04)", id `1cgZc9rmBOrPdKIe`. It was called "(stages 01–03)" until today.
- Version `7d4469ca-0291-429e-8ece-a895ac3a135a` (15:40), 93 nodes. Before that: `071bf2bd-9d24-4d61-8f82-0ea6b53e51e3`.
- **Not published.** No real run. No paid call was made.
- Every n8n test pinned the Google and Drive nodes.
- **Both stage 04 holds are now cleared** (Drive folder set; Nano Banana 2.1 approved). A real run that gets the owner's go 1 will now make one paid image call. Not yet tried.

## Updates

**15:45**
- **04 Settings:** `drive_root_folder_id` = `1vF0lKW_qRRzUg3OMCi5a5iSvmtz-QwQw`, the owner's new folder "Claude · Midas A7 images" in My Drive > Claude · Midas Drive. Checked with Google Drive: the folder exists, its parent is Claude · Midas Drive, the owner owns it. Nothing else in 04 Settings changed.
- **Sticky notes:** the top note and the go 1 note no longer say stage 04 is unbuilt.
- **Model test:** the paid Test 10 run was not started. A permission check blocked it before anything ran. The paid switch is off again (model test version `d16acd78-7772-437b-be78-c05022043c69`). No new executions after 15:30.

**16:06**
- **Owner decision, 15:40:** "Nano Banana 2.1 is the approved model." The owner set the registry row `gemini-nano-banana-2.1` to `status` = `approved`, evidence "approved by owner 15 Oct 2026 without the model test". Read back by Claude at 16:06. `gemini-3-pro-image` stays "trial".
- Checked by reading the row against 14 Choose model's rules: plain model id, the fixed Google address, frame 1:1 listed, size 2K listed, reference limit 14, complete prices dated 2026-10-14. All pass. Not checked by an n8n run.
- **Approved without the model test.** The first real stage 04 call will be the first real Google call on this route. Its request shape is not confirmed.

## What stage 04 does

Stage 04 starts only after the owner's genuine go 1 on the run.

1. **13 Compile** builds one order per output. Round 1 sends only the white master. Scene images wait for the review (stage 05) and the owner's go 2. Variations wait for a stored parent image.
2. **14 Choose model** uses only a model whose registry row says "approved". It checks that the Drive folder is set, and that the frame, size, reference count and dated price are known. It then reserves a cost.
3. **15b Dispatch guard** checks the daily limit, the job budget (the job's cost estimate with two repairs) and the operation key. The key is `run_id:output_id:tryN`, and it is never used twice.
4. Before anything is sent, the Drive run folder is made and a "reserved" row is saved. The vendor photo's checksum is checked against intake.
5. **15g** makes one POST to Google with no automatic retry. Image 1 is always the vendor photo.
6. The request id is saved. Status checks follow every 15 s, 20 at most. Checks cost nothing.
7. **15m Receipt** records the image checksum, bytes and pixel size. It works out the cost from Google's token counts and labels it "not an invoice".
8. The image is uploaded to Drive, the Drive checksum is compared, and the receipt row is updated.
9. The result is **awaiting_review**: "a candidate: not reviewed and not approved". Anything else is an owner hold. The hold says whether a paid call was or may have been made.

The vault gets new events: `compile` (with the exact prompt), `operation` and `candidate`. The run row gets a `stage04` field.

## Never paying twice

- Google refuses (4xx, except 408, 409 and 499): status `failed_not_started`. A request was sent. No charge is expected (not confirmed). Not sent again.
- No answer, 5xx, 408, 409, 499, an answer with no id, or still running after the last check: status `uncertain` or `uncertain_no_id`. It may be charged. The request id is kept. Not sent again.
- Google ends the request as failed: status `failed`. It keeps its charge, so no retry.
- Made but not saved to Drive: `completed_not_stored`. Not a readable image: `completed_bad_image`. The answer could not be read: `receipt_unreadable`. Each one holds.
- Each node result needs positive proof before the flow trusts it. The operations read must return real rows or nothing. The reservation and the receipt must come back with this operation key. A Drive upload must return a file id. A step that fails and passes its input on counts as a failure.
- The Google address is fixed in the request nodes. A registry row with another address holds.
- The Google key sits on the credential only. Error texts are scrubbed before they are stored or shown (`?key=`, `"key":`, `AIza…`). n8n's own execution history is outside the code's control.

## The white-master prompt

- The lines are ported from the pipeline 3/5 "06 Render ticket", with "furniture" made general.
- The prompt is built from the contract: inventory, exclusions, colour and design locks (marked "read from image 1"), handedness, relations, the not-confirmed list, the client's colour and material ("the vendor photo decides"), and output locks.
- Nothing in the prompt asks the model to draw a part the vendor photo does not show. A context object that hides part of the product is kept, not removed.
- Camera, light and presentation are fixed studio lines. The product is never turned to show unseen sides.
- **A cropped vendor photo holds**, and so does one that shows fewer pieces than the contract holds.
- Repair orders (corrections plus a preserve list, attempts 2 and 3) are supported for stage 05. Attempt 4 holds.

## What changed (first build, 15 Oct morning)

- **New nodes (28):** Go 1 given?, 04 Settings, 13 Compile, 14a Load model registry, 14 Choose model, Model and storage ready?, 15a Load operations, 15b Dispatch guard, Clear to reserve?, 15c Drive run folder, 15d Reserve operation, 15e Ready check, 15f Build request, Send to Google?, 15g Send to Google, 15h Read submission, 15i Save request id, Poll?, 15j Wait, 15k Ask Google, 15l Read status, Still running?, 15m Receipt, Image to store?, 15n Drive upload, 15o Final receipt, 15p Save receipt, 15q Stage 04 result.
- **Changed nodes:** V1 Vault events, Update run row, 12 Who leads the scene, G1 Go 1 verdict, G1d Forward result.
- **New tables:** "Claude Midas A7 model registry" (`eso9cF84jXYIGu5S`) and "Claude Midas A7 operations" (`cw86pzlOSjKSrU01`).
- Runs table (`l0roUCBwIQL3h9Eq`): new column `stage04`.

## What was checked, and how (first build)

- **Local tests:** 86/86 older tests and 37/37 stage 04 tests pass.
- **Byte comparison:** all 30 Code nodes matched `js/` at version 071bf2bd. Since 15:40, `js/04_settings.js` holds the new folder id and matches n8n.
- **Pinned n8n runs 404–407:** 404 happy path (older code); 405 held for no Drive folder and no approved model; 406 my pin-data mistake (not a stage 04 test); 407 guard stopped a reused key.
- **Independent review** by a separate agent: one must-fix (inventing hidden parts) and six should-fixes, all fixed except those under "Not built".

## Not checked

- A real Google call. The request and response field names come from Google's docs (read 14–15 Oct). They are not confirmed.
- Whether the `googlePalmApi` credential works as a predefined credential on the HTTP Request node.
- Google's inline image size limit. The 14 MB cap is an assumption.
- Reading the vendor photo from 02 Ingest after a real 24-hour wait.
- How n8n really shapes errors from the data table and Drive nodes.
- The run-row update in n8n with a real run row.
- The full happy path after the review fixes, in n8n.
- Making a run folder inside the new images folder (no run yet).

## Assumptions

- Daily limit of 20 paid calls. The simulated operations row dated today counts as 1 of 20 for today (UTC).
- Status checks every 15 s, 20 at most. Inline cap of 14 MB.
- Model 2.1 input image = 1120 tokens. A 2000-token thinking margin in the reserve.
- A 4xx refusal is not charged (not confirmed).

## Not built

- Stage 05 (review) and go 2. Scene images. Midas catalogue photos as references. Variations (the parent image).
- Fetching a late result after "uncertain". An error workflow for a crash after payment.
- Resizing or converting reference photos. Deleting the stored request at Google.
- A recount after the reservation. Two runs at the very same moment could both pass the daily limit.
- The go 1 page and the client page.

## Owner decisions

1. ~~The Google Drive folder for images.~~ Done 15:40: "Claude · Midas A7 images", My Drive.
2. ~~The image model.~~ Done: Nano Banana 2.1, approved in the registry (read back 16:06).
3. The daily image limit (now 20, an assumption).
4. Google keeps each background request for 55 days (`store: true` is required for background). Accept, or delete after the receipt?
5. Cropped photos, and photos showing fewer pieces than the contract, hold. Keep this?

## Leftovers (test data)

- Operations table: 1 simulated row, `claude-a7-20261015-test-s04a:white_master:try1` (completed).
- Vault table: rows for `claude-a7-20261015-test-s04a` and `claude-a7-20261015-test-s04b`, from executions 404–407.
- Runs table: intake rows for `claude-test-a7-n8n-s04-01` (404, 406, 407) and `claude-test-a7-n8n-s04-02` (405).
- Executions 404–407 (manual, pinned). No scratch workflows.
- The registry rows are real settings, not test rows.

## Files (project `claude-outputs/claude-midas-a7-build/`)

- `js/`: `04_settings.js` (updated 15:45), `13_compile.js`, `14_choose.js`, `15b_guard.js`, `15e_ready.js`, `15f_request.js`, `15h_submission.js`, `15l_status.js`, `15m_receipt.js`, `15o_final.js`, `15q_result.js`, `v1_vault.js`, `12_lead.js`, `g1_verdict.js`, `g1_forward.js`.
- `test/harness.js`, `test/run_tests.js`, `test/run_tests04.js`.
