# Claude · Midas look reference pipeline

A second n8n workflow built by Claude on 4 October 2026. It renders the real product in the look of a reference image, using Nano Banana for the image. The first workflow, `Claude · Midas studio pipeline (A)`, is unchanged.

## Where it is

- **n8n workflow:** `Claude · Midas look reference pipeline`, id `nqYDjY0MapNqyOpn`, in the personal project. It is not published, so the form link is not live.
- **Run log:** n8n data table `Claude look runs`, id `FSu0qB61Iap0zVCL`.
- **Source:** `claude-midas-look-reference-pipeline.sdk.mjs` in this folder.

No existing file in the `n8n` folder was changed.

## What goes in

| Field | Required | Use |
|---|---|---|
| Product photo | Yes | The only authority for the product. |
| Look reference image | Yes | Scene, light, camera and presentation only. |
| Product type | No | When filled in, it decides what the product is, for example "bath towel". |
| Notes | No | Counts or exclusions. |

## What it does

1. **Eye.** Reads the product photo into an inventory with counts. A typed product type overrides the photo reading. A swatch in another colour is recorded as a conflict, not as another view.
2. **Contract.** If no inventory can be read, the run holds before any image is paid for.
3. **Look reader.** Sees both images. Describes the scene, light, camera and presentation of the reference, and lists the details of its stand-in object that must not be copied onto the product, for example gold lines in a towel band.
4. **Render.** Sends both images to Nano Banana 2 on every attempt, with the inventory and the do-not-copy list written out. The image shape follows the reference: square, landscape or portrait.
5. **Reviewer.** A separate call compares three images: product photo, look reference and the new image.
6. **Verdict.** Code decides, not the reviewer.
7. **Repair.** At most two repairs, always from the two original images, never from a rejected image. Then hold.
8. **Run card.** A readable summary, the image and a row in the run log.

A pass is recorded as `reviewed_candidate` with `owner_approved: false`.

## Checks

| Check | Kind | Effect when not passed |
|---|---|---|
| Piece counts match the inventory | Hard | Repair |
| `inventory_count` | Hard | Repair |
| `identity_shape` | Hard | Repair |
| `excluded_absent` | Hard | Repair |
| `no_text_or_layout` | Hard | Repair |
| `reference_not_copied` | Hard | Repair |
| `colour_material`, `details`, `look_match`, `lighting` | Soft | Repair only on `fail` |

`reference_not_copied` is the new check. It fails when the product in the new image carries a detail that exists only on the stand-in of the look reference.

The run records check results and counts. It does not produce a fidelity percentage.

## Models and settings

- **Image:** Nano Banana 2 through fal.ai, endpoint `https://fal.run/fal-ai/nano-banana-2/edit`, on the node `08 Render with Nano Banana`. It uses the n8n credential `Simplified Custom Auth account`, the same one the existing workflow `Magnific towel hero - N8N` uses for fal.ai. To use Nano Banana Pro, change the URL on that node to `https://fal.run/fal-ai/nano-banana-pro/edit`; this was not tested.
- **Text:** `gpt-4.1` for the Eye, the look reader and the reviewer, with the `OpenAI account` credential.
- **Settings in `01 Intake`:** `max_repairs` 2, so at most 3 images per run; `resolution` `1K`. The aspect ratio is set by the look reader: `1:1`, `3:2` or `2:3`.

## How to test

1. Open the workflow in n8n and press the test button.
2. Open the test form link n8n shows, upload the two images, type the product type and press Start.
3. When the execution finishes, open the `12 Run card` node: the text is in `run_card` and the image is in the `render` file.

Each run makes up to 3 Nano Banana images and 5 OpenAI text calls. The cost per run has not been measured.

## What has been checked, and what has not

- **Checked:** n8n accepted the workflow (18 nodes). The eight code steps were run locally against mock replies for nine cases, including a copied gold band that is repaired, a product type that overrides the photo reading, an unreadable look reply, an unreadable review, a missing image and an empty Nano Banana reply.
- **Not checked:** no live run has been made. The fal.ai call, the credential, the image quality and the cost are unconfirmed. The two n8n helper calls that turn images into the fal.ai request and back were only mocked locally.

## Known limits

- One product photo and one look reference per run, one image out.
- If the look reference shows a product very close to the real one, the image model may still copy its details. The reviewer is there to catch that, and it can miss.
- Parts of the product hidden by the presentation, for example the second band of a rolled towel, cannot be verified in that image.
- If the fal.ai or an OpenAI node fails, the execution stops with the provider's error on that node, and the run log shows a submitted row with no finished row.
