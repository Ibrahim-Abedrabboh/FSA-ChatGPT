# Claude · Midas job request pipeline 4

Written by Claude on 5 October 2026. Status: built and saved in n8n, **not published**, **no real (paid) run made yet**.

- n8n workflow: `Claude · Midas job request pipeline 4`, id `uQohJ5O117QOXV7h`, 124 nodes, personal project
- Run log table: `Claude job runs v4`, id `omYsQyVJTVcfNgSs`
- Lessons table: `Claude Midas lessons`, id `ZzfORylwjLlCcY1N` (empty)
- Pipeline 3 (`LCkfLFMQS5MjA5FQ`) and its table were not changed by this work.
- Source of the gaps: the comparison of pipeline 3 with `midas-studio-workflows.html` (artifact "Pipeline 3 vs Studio Map").

## What version 4 adds to version 3

### The seven points that pipeline 3 did not have

| Point in the Studio map | Version 4 | New form field |
| --- | --- | --- |
| White master by cut-out for a single product shot | For a clean W1 photo (front, level, plain background, no faults, no second route) the master is the vendor photo with only its background removed, placed on a white square. It is reviewed and audited like any image. If it fails or cannot be made, the image model makes the master, with all three tries left. | `scope.cutout: false` turns it off |
| Lighting series with colour temperature | One scene in daylight (5000 to 5500 K), twilight (3000 to 3500 K) and warm night (2200 to 2700 K). Images 3 and 4 are made from image 2, and the final inspector checks that only the light changed. | `scope.series: "lighting"` |
| Client room | A photo of the client's room becomes the setting of every lifestyle image. The final inspector compares each image with the room photo. | a file with the role `room` |
| Description and metadata | Title, short text, bullets and alt text, written only from recorded facts, with a list of points to verify. English, Arabic or both. | `scope.description: true`, `scope.language: "en"`, `"ar"` or `"both"` |
| Measured coverage and margins | Counted from the pixels of the 1125 delivery file of white images: width, height, four margins, and a warning when the product reaches an edge. No pass mark is applied. | none |
| Several views of one product | Up to 2 more photos of the same product go to the Eye and to the image model. | files with the role `view`, or more files marked product |
| Receipt, fingerprint and duplicate | SHA-256 of the product photo, a list of the files received, and a check on the form id. A second job with the same form id is not run. The same photo under another id runs and is flagged on the run card. | none |

### Points that were partly there

- **Second route as a treatment.** The Eye names other routes that also fit. Their rules are added to the plan, the image prompt and the review.
- **Handling per fault.** Twelve kinds of photo fault each get their own instruction. A render or illustration as source makes the job a concept.
- **Three angles.** `scope.series: "angles"` with White BK makes front, left side and 45 degrees right.
- **Approval of the master.** `approval: "master"` adds a second stop after the white master passes.
- **Correcting the reading.** At the go stop, send `reading` with the go: `inventory` (line or item, and count), `excluded_add`, `sided_parts`, `unknowns_add`.
- **Stricter verdict.** Colour is a hard check on white images. Set relations are a hard check when recorded. Checks the reviewer could not settle are listed as unverified.
- **Contract.** Sizes with their basis (client or printed in the file, never estimated), SKU, notes, sheet panels, printed text, what may change and what never changes, the operation planned for each image.
- **WebP.** A WebP copy of each delivery file. The file address takes `fmt=webp`.
- **Lessons.** Active rows of `Claude Midas lessons` (columns `rule`, `applies_to`, `stage`, `active`) are added to the plan, the image prompt and the review. `applies_to` is `all`, a profile id or a product word. `stage` is `plan`, `render`, `review` or `all`.
- **Progress.** The run log gets a row per stage. The status address returns `progress.label` while the run works.
- **Ledger.** The run card and the package keep the fingerprint, the file list and the link and model of every attempt.

## Addresses (live only after publishing)

| Purpose | Method | Path |
| --- | --- | --- |
| Send a job | POST | `/webhook/claude-midas-studio-4` |
| Send a batch | POST | `/webhook/claude-midas-studio-4-batch` |
| Ask for progress, the plan or the result | GET | `/webhook/claude-midas-studio-4-status?id=` |
| Go, stop, accept, ask for changes, reject | POST | `/webhook/claude-midas-studio-4-decision` |
| Download a 1125 x 1125 file | GET | `/webhook/claude-midas-studio-4-file?id=&shot=&fmt=` |

When the file was imported, n8n attached the existing credential `Header Auth account` (header `X-Midas-Key`) to the five webhooks. Confirm that this is the credential you want.

## Behaviour that differs from version 3

- A job that repeats a form id is dropped without a second run. The form must send a new id for every job.
- The cut-out is on by default. It adds one fal.ai call for eligible photos and saves one image render when it passes. The cut-out master has no contact shadow, and its stored link is a PNG with a transparent background.
- Colour is a hard check on white images, so a white image can need more repair tries. The limits on tries and on images per job are unchanged.
- The run log holds several rows per run. The status and decision steps read the newest row.

## What was checked, and how

| Check | Result |
| --- | --- |
| Local mock runner over the real workflow file, no network: 16 scenario groups, about 130 assertions (cut-out pass, reject and four failures; lighting series with room, views and a corrected reading; three angles with master approval; master stop and timeout; website package with description; duplicate id; holds; repairs; room failure; concepts; six BMP variants; status, decision, file and batch) | all passed |
| The real n8n image steps on a made-up transparent image, in a temporary workflow (executions 98 to 101, workflow archived): cut-out placed on white, 1125 delivery file, WebP copy, file address path with `fmt=webp` | measured 50.4% x 37.9% for an expected 50% x 37.5% |
| Fingerprint and duplicate check on the real n8n tables (executions 104 and 105) | first run accepted, second run stopped as a duplicate |
| Pipeline 4 in n8n, hold path and status address, paid nodes replaced by fixed data (executions 102 and 103) | succeeded |
| Read back from n8n and compared with the built file | 124 nodes and 141 connections match |

## Not checked

- **No real run.** No real photo was read and no image was made.
- The background removal call. ASSUMPTION: endpoint `https://fal.run/fal-ai/birefnet/v2` with `model: "General Use (Light 2K)"`, `operating_resolution: "2048x2048"`, `output_format: "png"`. Its price was not checked.
- The new Eye fields (`cutout_safe`, `also_routes`, `panels`, `dimensions_read`, `printed_text`) on real photos.
- The real wait-and-resume steps, including the second stop.
- Whether the image model keeps the room, the camera and the product across a lighting series.
- The quality of the description and of the Arabic text. Arabic needs a review by a native reader.
- No form sends the new fields yet. `claude-midas-job-request-3.html` still posts to pipeline 3.

## Assumptions

- ASSUMPTION: the Kelvin ranges for daylight, twilight, warm night and the neutral studio light. They are instructions to the image model, not measurements.
- ASSUMPTION: a pixel counts as product when one colour value is below 240 of 255. A margin below 2% gives a warning.
- ASSUMPTION: a photo smaller than 1125 pixels on its long side is not used as a cut-out master.

## Not built

A look reference image, New Composition, Create with this item, Edit, a durable store for master files, one change per repair pass, pose plans for people, the nine-image set, social sizes, per-category repair rules, and correcting the route (W1 to W5) at the go stop.

## Test rows

The run log `Claude job runs v4` holds two test rows: `claude-test-v4-hold-0001` and `claude-test-v4-dup-0001`.

## Files

- `claude-midas-job-request-pipeline-4.workflow.json`: the workflow as saved in n8n, importable.
- `claude-midas-job-request-pipeline-4.source.zip`: the patches on pipeline 3, the code of the new steps, the build script and the tests.
