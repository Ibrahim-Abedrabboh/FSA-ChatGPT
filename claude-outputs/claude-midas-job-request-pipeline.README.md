# Claude · Midas job request pipeline

A third n8n workflow built by Claude on 4 October 2026. It receives the "Create a studio job" form and feeds every form choice into the prompts. The two earlier Claude workflows are unchanged, and the original form file was not edited.

## Where it is

- **n8n workflow:** `Claude · Midas job request pipeline`, id `nz0MH8SFeCFJpt0K`, in the personal project. Not published.
- **Run log:** n8n data table `Claude job runs`, id `ku3kwvpN6tGqeoBN`.
- **Connected form:** `claude-midas-job-request-connected.html` in this folder. It is a copy of the form with the n8n test address filled in and a type selector for each uploaded file.
- **Source:** `claude-midas-job-request-pipeline.sdk.mjs` in this folder.

## Addresses

- **Test:** `https://ibrahimnewaeon.app.n8n.cloud/webhook-test/claude-midas-job`. It accepts one job after you press Execute workflow in n8n.
- **Live:** `https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-job`. It works only after the workflow is published.

The webhook has no login. Anyone who has the live address could send jobs, and each accepted job spends OpenAI and fal.ai credit. Add authentication on the webhook node before publishing.

## How the form maps to the workflow

| Form field | Where it goes | Status |
|---|---|---|
| Reference files, product photo | Attached to the Eye, the image model and the reviewer | Used |
| Reference files, look image | Look reader, image model and reviewer | Used. Needs the per-file type in the connected form |
| Sub-category, then Category | Product type. Overrides the photo reading | Used |
| Department | Context for the Eye only, never the product type | Used |
| Product color, Product material | Eye, render prompt. The photo decides the exact shade; a disagreement is recorded as a conflict | Used |
| Hero item / focus | Eye and render prompt | Used |
| Locks | Render prompt and the reviewer's `client_rules` check | Used |
| Must not | "Do not show" list and the reviewer's `client_rules` check | Used |
| Lighting, Wall paint, Floor | Stylist and render prompt. With a look image, the client choice wins where they differ | Used |
| Use workflow defaults | Switches off Lighting, Wall paint and Floor | Used |
| Plants, Human | Allowed or forbidden in the render prompt | Used |
| Mood / Vibes | Stylist and render prompt. Automatic means no instruction | Used |
| Views | Wide or close-up camera instruction. Category template means no instruction | Used, one image only |
| Image proportions | 1:1, 4:5 or 16:9. Standard for category means the look image shape, else 3:2 for lifestyle and 1:1 for white | Used |
| Resolution | 2K or 4K. Standard for category means 1K | Used |
| Outcomes: Lifestyle, White BK | Chooses the run type. The first of these two in the list is made | Used |
| Outcomes: Website, New Composition, Variations, Create with this item, Others | Not built | Listed on the run card |
| Job: Edit. Work on: Batch | Not built. The job runs as one new image | Listed on the run card |
| Image size, exact pixels | The image model takes a proportion and a resolution, not pixel sizes | Listed on the run card |
| PDF, Excel and CSV files | Not read | Listed on the run card |
| Reference types Room, Previous result, Other views, Specifications | Not used | Listed on the run card |
| `metadata.scene`, `metadata.light`, `metadata.camera`, `metadata.product_category` | Copies of other fields. The workflow reads the originals | Not needed |

Nothing the form asks for is dropped silently. What cannot be done is written on the run card under "Asked for in the form but not applied".

## What it does

1. **Job intake.** Reads the payload and the files. Stops on hold, before any model is paid for, when there is no product photo, no built outcome or an unreadable payload.
2. **Eye.** Reads the product photo. It now describes bands and trims by where they sit on the product, never as vertical or horizontal.
3. **Contract.** Fixes the inventory and adds the client's colour, material, hero, locks and must-not list.
4. **Scene.** With a look image, the look reader describes it and lists the stand-in details that must not be copied. Without one, the stylist plans the scene from the form choices.
5. **Render.** Nano Banana 2 on fal.ai gets the product photo, plus the look image when there is one.
6. **Review.** A separate model compares the new image with the originals. Code decides: a wrong count or a failed hard check means repair, twice at most, then hold.
7. **Run card.** Summary, images and a row in the run log. A pass is `reviewed_candidate` with `owner_approved: false`.

Hard checks: piece counts, `inventory_count`, `identity_shape`, `excluded_absent`, `no_text_or_layout`, `client_rules`, and `reference_not_copied` when a look image is used. Soft checks: `colour_material`, `details`, `look_match` or `scene_match`, `lighting`.

## How to test

1. Open the workflow in n8n and press Execute workflow.
2. Open `claude-midas-job-request-connected.html` in a browser, add the files, set the type of each file, and submit.
3. In n8n, open the `12 Run card` step: the text is in `run_card` and the image is in the `render` file.

Each run makes up to 3 Nano Banana images and up to 5 OpenAI text calls. The cost per run has not been measured. 2K and 4K cost more than 1K.

## What has been checked, and what has not

- **Checked:** n8n accepted the workflow (23 nodes). The eight code steps were run locally on nine mock jobs. The connected form was opened in a browser and its submission, with two real images, was received by a local test server and passed through the intake step.
- **Not checked:** no live run. The n8n webhook has not received a form submission, so the way n8n names uploaded files, the fal.ai call with one image, the stylist and the two reviewers are untested here. The first live test is the real check.

## Showing the result in the form (4 October 2026, part applied)

The owner published the workflow on 4 October, so the live address works without pressing Execute workflow. The first full live runs were executions 44 and 45: one 4K image each, both passed.

**Done**

- `claude-midas-job-request-connected.html` now posts to the live address by default, uses a new id for every submission, and has a Result panel. After sending, it asks `…/webhook/claude-midas-job-status?id=<submission id>` every 5 seconds for up to 8 minutes, then shows the status, the image, the checks and the first 1,500 characters of the run card.
- The run log `Claude job runs` has two new empty columns, `image_url` and `checks`.

**Prepared, not applied in n8n**

- `claude-midas-job-request-pipeline-result-channel.sdk.mjs`: the main workflow with three changes. fal.ai returns a hosted image link (`sync_mode: false`); a new step `08b Fetch rendered image` downloads it for the reviewer; the run card and `Log result` save `image_url` and `checks`.
- `claude-midas-job-status.sdk.mjs`: a small second workflow that answers the form from the run log. It makes no model call.

Until both are in n8n and published, the Result panel says it could not reach the result address and points to the `12 Run card` step. `claude-midas-job-request-pipeline.sdk.mjs` still matches the published workflow.

**Checked:** the changed code steps on the mock jobs, including a failed image download; the status reply on eight mock rows; the form in a browser against a local mock server (pass, hold, missing result address, test address, phone width).

**Not checked:** a live run of the changed workflow. That fal.ai returns a link in this mode and that step 08b downloads it are untested here. How long fal.ai keeps the link is not confirmed, so treat the link as temporary; the image also stays in the n8n execution.

## Known limits

- One product photo, one optional look image, one image out per run.
- The published workflow cannot report results to the form yet. See the section above.
- The canvas is not grouped into stages, because the two paths rejoin and n8n groups need one way in and one way out.
- If a model step fails, the execution stops with the provider's error on that step.
