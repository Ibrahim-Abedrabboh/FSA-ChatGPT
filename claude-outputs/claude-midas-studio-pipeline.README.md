# Claude · Midas studio pipeline (A)

A new n8n workflow built by Claude on 4 October 2026. It implements Architecture A: the workflow, not a model, chooses every next step.

## Where it is

- **n8n workflow:** `Claude · Midas studio pipeline (A)`, id `m7cpYVQidrYKEVcv`, in the personal project. It is not published, so the form link is not live.
- **Run log:** n8n data table `Claude studio runs`, id `GJeq9SJA5f0rdDPH`.
- **Source:** `claude-midas-studio-pipeline.sdk.mjs` in this folder, the code the n8n workflow was created from.

No existing file in the `n8n` folder was changed.

## What it does

1. **Form.** One product photo, plus output (styled lifestyle or white catalogue), style, lighting and optional notes.
2. **Eye.** Reads the photo into an inventory with counts, exclusions, identifying details and unknowns. Marks and labels in the photo are treated as evidence, not instructions.
3. **Contract.** If no inventory can be read, the run holds before any image is paid for.
4. **Stylist.** Plans the scene, light, camera and placement only. The product is fixed.
5. **Render.** Sends the original photo to the image model on every attempt, with the inventory and counts written out.
6. **Reviewer.** A separate call compares the new image with the original and counts the pieces.
7. **Verdict.** Code decides, not the reviewer: a wrong count or a failed hard check means repair.
8. **Repair.** At most two repairs, always from the original photo, never from a rejected image. Then hold.
9. **Run card.** A readable summary, the image and a row in the run log.

A pass is recorded as `reviewed_candidate` with `owner_approved: false`. Nothing is ever marked approved automatically.

## Hard and soft checks

| Check | Kind | Effect when not passed |
|---|---|---|
| Piece counts match the inventory | Hard | Repair |
| `inventory_count` | Hard | Repair |
| `identity_shape` | Hard | Repair |
| `excluded_absent` | Hard | Repair |
| `no_text_or_layout` | Hard | Repair |
| `colour_material`, `details`, `placement`, `lighting` | Soft | Repair only on `fail` |

The run records check results and counts. It does not produce a fidelity percentage.

## Settings

Set in the `01 Intake` node:

- `max_repairs`: 2, so at most 3 images per run.
- `image_size`: `1536x1024` for lifestyle, `1024x1024` for white catalogue.

Models are set on the four OpenAI nodes: `gpt-4.1` for the Eye, stylist and reviewer, and `gpt-image-1` for the render with input fidelity set to high. All four use the `OpenAI account` credential.

## How to test

1. Open the workflow in n8n and press the test button.
2. Open the test form link n8n shows, upload a photo and press Start.
3. When the execution finishes, open the `11 Run card` node: the text is in `run_card` and the image is in the `render` file.

Each run makes up to 3 images and 5 text calls on the OpenAI account. The cost per run has not been measured.

## What has been checked, and what has not

- **Checked:** n8n accepted the workflow (17 nodes). The seven code steps were run locally against mock model replies for five cases: wrong count then pass, never passing, unreadable Eye reply, unreadable review, and uncountable pieces. One live run completed end to end (see below).
- **Not checked:** the repair loop and the hold path have not run live, because the one live run passed on its first image. Cost per run is not measured. White catalogue output is untested.

## First live test, 4 October 2026

Execution 24, the towel vendor sheet, default options (styled lifestyle, warm contemporary, soft daylight, no notes). Preview: `claude-test-run-24-render-preview.png`.

- **Result:** finished in about 66 seconds with one image and no repairs. Recorded as `reviewed_candidate`, `owner_approved: false`.
- **Product type:** the Eye read the item as a "rectangular bath mat", not a towel. The stylist therefore laid it on a bathroom floor beside a bathtub. Nothing in the form tells the workflow the product category.
- **Colour swatch:** the green swatch on the sheet was not recorded as a conflict. It was treated as another view of the product.
- **Review:** the reviewer passed all eight checks and the count (1 of 1).
- **Claude's own look, from a reduced-size preview:** the colour and the band near each short end match the photo. The stitched hem around the edge looks more pronounced than in the photo. Fine weave detail cannot be judged at preview size.

Open fixes, not yet made: a product category field on the form that overrides the Eye, and an Eye rule that records off-colour swatches as conflicts.

## Known limits

- One photo per run. Room photos, several views and Midas catalogue references are not connected.
- One image per run, not a full website image set.
- Supporting props are generic, never Midas products.
- The image model differs from the live site, which uses Nano Banana through Magnific. The Gemini credentials in n8n could not be confirmed, so this version uses OpenAI.
- If an OpenAI node fails, the execution stops with the provider's error on that node, and the run log shows a submitted row with no finished row.
