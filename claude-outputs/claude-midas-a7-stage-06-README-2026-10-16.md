# Claude · Midas A7: stage 06 (package) and the hold-and-ask rule

16 Oct 2026, 01:30 Amman. Written by Claude. Built on the owner's "go" of 16 Oct, 00:50. Updated 02:45 (description wording tidied; stage 07 now built, see `claude-midas-a7-stage-07-README-2026-10-16.md`).

Code and exports: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, commits `a1b14c6` and `428f953`.

## Status

- Workflow: "Claude · Midas A7 (stages 01–06)", `1cgZc9rmBOrPdKIe`, version `7422e966`.
- **Not published.** It was not published or unpublished in this work.
- **No real run.** Every test used pinned or code-made data.
- **No paid call.** Stage 06 makes no AI call and no paid call by design.
- A package made by stage 06 is a set of "Generated image" files from an owner-approved master. Approval comes only from the owner's go 2. Stage 06 never approves anything.

## What changed

### Stage 06: Package (new, 18 nodes, group "Stage 06 · Package")

It runs only after the owner approves the white master at go 2.

1. **18a Package ticket** checks the approval is real. It needs:
   - status "white_master_approved";
   - the approval recorded by the owner at go 2;
   - the master's Drive file id and checksum;
   - the contract stamp.

   If any is missing, the run holds for the owner.
2. **18b, 18c** read the identity table (for the next version number) and the operations table (for cost).
3. **18d** downloads the master from Drive. **18e** checks it:
   - the checksum must equal the approved master's;
   - it must be square within 1%;
   - it must be at least 1125 px.

   If the same master already has a package, nothing is made twice.
4. **18f, 18g** resize the master to 1125 × 1125 jpg (quality 92) and webp with n8n Edit Image. This is one resize. There is no AI and nothing is redrawn.
5. **18h** checks both files: the right format, exactly 1125 × 1125, and not empty. Both formats are required. If one is missing, nothing is uploaded and the run holds.
6. **18i to 18k** make a versioned Drive folder ("… · package v1") and upload both files, named `<base>_white_1125_v<N>.jpg/.webp`.
7. **18l** builds the manifest and **18m** uploads it. The manifest holds:
   - the label "Generated image";
   - the approval record and the master's checksum (the master stays in the vault);
   - the files, with their Drive ids and checksums, and how they were made;
   - the spec card and the draft description;
   - the cost;
   - what is not in the package.
8. **18n, 18o** write the identity vault entry to the new table "Claude · Midas A7 identity" (`OpszBn1IWmYzWftI`). The key is `sku:<SKU>`; with no SKU it is `photo:<vendor photo checksum>`.
9. **18p** sets the result:
   - "white_package_ready" only when both images, the manifest and the identity entry are saved;
   - any other stop holds for the owner, with the reason. An incomplete package is never called complete.

**Spec card and description.** These come from facts only (brief and contract): product, SKU, pieces, excluded pieces, colour, material and dimensions.
- Anything not supplied reads "not confirmed".
- Model readings of the photo (such as "warm grey") are kept apart, marked "internal only, not product facts".
- The description is an English draft, labelled "not reviewed for publication". Arabic is not written.

**Description wording, tidied 16 Oct 02:45** (owner, 01:40: "tidy wording only"). Plurals, a capital first letter, and "and" before the last item. Supplied values are copied as written; only piece names get a plural ending. Facts are unchanged.
- Before: "Sectional sofa in 7 pieces: 1 x left-arm piece; 4 x armless piece; 1 x corner piece; 1 x right-arm piece. Not confirmed: colour, material, dimensions."
- Now: "Sectional sofa in 7 pieces: 1 left-arm piece, 4 armless pieces, 1 corner piece and 1 right-arm piece. Not confirmed: colour, material and dimensions."
- A single piece named like the product reads "Bed, 1 piece."
- The package now lists each scene output as "a scene image, made in stage 07 after this package; not in this package".

**Accessories.** `accessories_used` is empty, because the white master has no props. Accessory links will come with Scenes.

**Cost per accepted package.** This is the image-call cost of the run: every attempt, repairs included, from the operations table. It is an estimate, not an invoice. Readers, planners and reviewers have no receipts in A7, so they are not counted.

### Other changes

- **13 Compile: hold and ask** (open point 2, owner go 00:50). The old default counted a room-context piece as a product piece when the inventory named it. It is removed. Now, if the inventory lists something the photo reader marked as room context:
  - nothing is made;
  - the owner is asked to send the job again, with the piece named and a note, or without it.

  The coverage register is updated.
- **04 Settings**:
  - `package` block: 1125 px, jpg and webp, jpg quality 92, square tolerance 1%;
  - settings date 16 Oct 2026.
- **G2 Go 2 verdict**: the approve text now says stage 06 makes the package next. Scene images are still not built.
- **V1 Vault events** records package and identity events (step 18).
- **Runs table** has a new `package` column, and Update run row writes it.
- **Model test** (`WvmDSrnX6lYdiKzZ`): `only_folders` is set to Test 6 and Test 8, which is 4 planned calls. The paid switch stays off, and it was not run.
- **18j fix** (found in pinned run 426): if a checked file does not reach the upload step, nothing is uploaded and the run holds. Before the fix, it errored.
- **A7 description** in n8n is updated to stages 01–06.

## What was checked, and how

- **Local tests:**
  - stage 06: 52 of 52 pass. They use real image files: 2048 and non-square masters, a too-small master, a jpg master, good and wrong-size outputs.
  - stage 05: 58 of 58 pass. The Test 8 section is rewritten for hold and ask.
  - the two older suites: 86 of 86 and 37 of 37, run on a scratch copy so the repo files were not rewritten.
- **Pinned run 426** (A7) found the 18j error above. It is now fixed.
- **Pinned run 427** (A7): success.
  - Ran for real: 18a, the manifest (checksum `85110d98…`), the identity entry, the identity row insert (row 1), the result, the vault events and the run-row update.
  - Pinned: Drive, the master check and the file check.
  - The result was "white_package_ready", and the second pass of "Package due?" correctly ended the run.
- **Scratch run 428**, in the workflow "Claude · scratch · A7 package resize test" (`UPIDK9W2UkJgQdBA`). It used the exact Edit Image settings of 18f and 18g and the exact 18h code, on a 2048 × 2048 PNG made in code. On n8n Cloud:
  - jpg: 1125 × 1125, 9,334 bytes;
  - webp: 1125 × 1125, 2,584 bytes;
  - 18h passed. So n8n Cloud can write webp.

  The workflow is archived. The result is in the repo: `tests/claude-midas-a7-stage-06/run_b_result_2026-10-16.json`.
- **Byte check.** A7 was read back from n8n after the last change. All 40 Code nodes match the repo files byte for byte, and the export matches n8n exactly.

## What was not checked

- Real Google Drive download and upload in stage 06. Drive was pinned, so the manifest's "Drive checksum matches" stays empty (not confirmed).
- A real end-to-end A7 run. It needs the owner's go, because stages 04–05 make paid calls.
- The resize on a real product photo. The test image was a flat black-and-white shape. Colour profile, metadata and visual quality after resizing are not checked.
- The webp quality setting. The tool's default is used and was not measured.

## Assumptions

- The identity key is the vendor photo's checksum when no SKU is supplied.
- jpg quality is 92; webp uses the tool's default quality.
- Cost counts image calls only.
- A master that is not exactly 2048 px gets a note, but is still packaged if it is square and at least 1125 px.

## Not built

- Scenes: built 16 Oct in stage 07 (not published, not run for real). Scene delivery files are not built.
- Data imports: the Midas accessories catalogue is imported (412 rows, 16 Oct). A live stock source is read per piece at scene time. The facet vocabulary is not built.
- Client page changes for packages.
- Arabic description.

## Open, for the owner

1. ~~The model test still uses the old context rule.~~ Answered 16 Oct 01:40 ("align to hold and ask") and done: see the model test README.
2. **Description language.** English only for now; wording tidied 16 Oct. Arabic needs a native review before use.
3. **The real end-to-end paid A7 run** is still waiting for your go.

## Leftovers (test data, all prefixed claude-)

- **Runs table** "Claude Midas A7 runs" (`l0roUCBwIQL3h9Eq`):
  - row 23 (`claude-a7-20261016-test-s06a`, the pinned approved test row);
  - rows 24 and 25 (intake rows from runs 426 and 427).
- Vault rows written by runs 426 and 427.
- **Identity table** `OpszBn1IWmYzWftI`, row 1. It is a test entry with fake Drive ids "claude-test-…". The table itself is new and is meant to stay.
- New `package` column in the runs table (meant to stay).
- **Archived scratch workflow** `UPIDK9W2UkJgQdBA`. It is safe to delete.
- No Drive files were made: Drive was pinned in run 427, and the scratch run had no Drive node.
