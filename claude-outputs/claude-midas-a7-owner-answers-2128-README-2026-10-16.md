# Claude · Midas A7: owner answers of 21:28 and 22:06, built — README

16 Oct 2026, 22:3x Amman. Written by Claude.

## Status

- **Workflow:** "Claude · Midas A7 (stages 01–07)", id `1cgZc9rmBOrPdKIe`.
- **New draft version:** `eefd6c42`, 183 nodes. It was deployed in 4 parts on top of `b187e58d`.
- **Not published. Not run.** No paid call was made for this build.
- **Repo:** branch `final`.
  - The export is `n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json`.
  - The code is in `code-nodes/`; the prompts are in `model-prompts/`.

## What changed

**Item 3 (D11 guide fixes).** "07a Load handling profiles" now reads table **v2**, "Claude Midas A7 handling profiles v2" (`AgXKkFbIj5dQAnvn`, 44 rows).
- v2 is the old table with the owner's D11 fixes. Each fix is noted in the row's `a7_edit`.
- v2 adds one new row, `plant-large` ("artificial tree|trees", floor guide). **Assumption:** this split is my reading, for the owner to confirm.
- The old table `FZJg1MHUh2lcIV1H` is unchanged.

**Item 4 (scene approved by eye).** This now follows the same rule as the white master.
- **Manifest and owner view:** "Approved by the studio · not reviewed".
- **Client:** sees "Approved by the studio" (new field `client_shown_as`). The client never sees "not reviewed".
- **Audit:** the audit wording stays "approved by owner without an automated review".
- **Nodes:** G2, 18a, 18l, 20a, 20k, the 16b owner list and the 19a completion message.
- **Assumption:** a normal reviewed approval shows "Approved" to the client, as before. You did not name a client label for that case.

**Item 5 (tabletop camera height).** Camera height = surface height + half the product's height, tilt 0°. This replaces 75 cm and 55–60 cm.
- Example: a 63 cm lamp on a console gives 75 + 31.5 = about 106 cm. The value is rounded down, as in your example.
- Example: a 20 cm bowl on a coffee table gives 40 + 10 = 50 cm.
- **Surface height:**
  - It is read from a Midas piece planned for that shot that is such a surface, and only when its catalogue size names an "H" value.
  - Otherwise it uses the typical value: 75 cm for a table or console, 40 cm for a low table. These are your examples, and the prompt marks them "typical, not measured".
- **Product height:** it comes only from an "H" value in the brief. Without one, the prompt says the product's height is "not confirmed" and gives no number.
- **Reference view:** for these products, the view takes only the *side* from the vendor photo. The camera stays level even if the vendor photo was taken from above. The reviewer checks the same thing.
- **Nodes:** 04 Settings, 19a, 13 Compile, 16a.

**Item 6 (blind count, 16x and its fallback 16xb).**
- The blind count gets the reader's definitions:
  - "cropped" means cut off by the frame.
  - "hidden" means covered by another piece or object.
  - The module rule: one per module where a joint or gap shows; seat and back cushions are not pieces.
- It returns a `hidden` list, which 16b keeps in the review's crop record. A hidden piece is never treated as a crop.
- It is still never told the target count.

**Owner, 22:06 (reader prompt pending).** A7 keeps the reader prompt it had before D13, until reader test 4 passes.
- 03, 03b and 05 are back to the texts of version `e584d5ed`.
- The D13 texts moved to `model-prompts/pending/`, marked pending.
- The reader-test-4 candidate is in the same folder. It is not in any workflow.
- 04-06 Evidence works with both prompts: the D13-only fields are optional there.

## What was checked and how

- **Read-back of `eefd6c42`:**
  - All 58 Code nodes are byte-identical to the repo files.
  - The 5 model prompts are identical (03 and 03b match each other).
  - 07a points to `AgXKkFbIj5dQAnvn`.
  - The workflow is not active.
  - Script: `tools/claude-midas-a7-export.py`.
- **Local tests** (code-made data, no network, no model call): **769 checks pass in 13 suites, 0 fail.** The new checks:
  - **Camera:** 106 cm and 50 cm (your two examples), a Midas table with "H 45 cm", an unlabelled size, two possible tables, no product height, and the level Reference view in the prompt and the review.
  - **Labels:** G2, 18a, 18l and 20k, for both the white master and a scene, approved by eye and reviewed.
  - **Blind count:** the definitions in both blind prompts, no target count, and the hidden list in 16b.
  - **Prompts:** the A7 prompts are the pre-D13 texts.
  - **Old checks:** the ones that encoded 75 cm, 55–60 cm and the old module wording were updated to the new rules.

## Not checked

- No run in n8n, so there is no execution id. The new lines have not been seen by an image model.
- Whether the image model actually holds the camera height and the level tilt can only be seen in a paid scene test (plan Phase 4).

## Not built

- The "uncertain" role hold (owner, 22:06): when the reader marks a piece "uncertain", code holds for the owner and never counts it.
  - It belongs with the new reader prompt, so it is built only when that prompt enters A7, after reader test 4 passes.
- A client view: A7 only writes `client_shown_as` into the record. The client page is not changed.

## Leftovers

- Table `AgXKkFbIj5dQAnvn` (v2, new; A7 uses it).
- Table `FZJg1MHUh2lcIV1H` (old, unchanged, no longer read by A7).
