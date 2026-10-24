# Claude · Midas job request pipeline variations

A new n8n workflow built by Claude on 4 October 2026. It takes one product photo and makes several different scenes of the same product. The one-image workflow, `Claude · Midas job request pipeline`, is unchanged and still published.

## Where it is

- **n8n workflow:** `Claude · Midas job request pipeline variations`, id `XvdiJKSllFsMyad5`, in the personal project. **Published by the owner on 4 October 2026.**
- **Source:** `claude-midas-job-request-pipeline-variations.sdk.mjs` in this folder. The code steps in n8n match this file.
- **Form:** `claude-midas-job-request-one-or-many.html` in this folder, with two buttons: One image and Multiple images.
- **Run log:** the same data table as the one-image workflow, `Claude job runs`, with one new column, `images`.

## Addresses

| Purpose | Test address | Live address, after publishing |
|---|---|---|
| Send a job | `/webhook-test/claude-midas-job-variations` | `/webhook/claude-midas-job-variations` |
| Ask for the result | not usable for polling | `/webhook/claude-midas-job-variations-status?id=<submission id>` |

All on `https://ibrahimnewaeon.app.n8n.cloud`. Neither address has a login. Every accepted job spends OpenAI and fal.ai credit, so protect the addresses before sharing the form.

## What it does

1. **Job intake.** Reads the form. `scope.imageCount` sets the number of images: 1 to 4, and 3 when the form gives none.
2. **Eye and contract, once.** The product photo is read once. Every image is held to the same inventory and details.
3. **Stylist.** Plans one scene per image, each clearly different. If the stylist cannot be read, a default plan is used for the missing scenes.
4. **Render.** One Nano Banana 2 request per scene, each with the product photo attached. fal.ai returns a hosted link, and step 08b downloads the image for the reviewer.
5. **Review.** Each image is reviewed on its own against the product photo.
6. **Verdict.** Code decides for each image. A failed image is repaired without touching the others.
7. **Run card and log.** One run card for the job, with every image, and one row in the run log.

## Rules

- **Repairs:** at most 2 per image, so at most 3 tries for one image.
- **Job limit:** a job makes at most twice the number of images asked for. With 3 asked, that is 6. When the limit is reached, images that have not passed go on hold.
- **Job status:** `reviewed_candidate` when every image passed, `partial` when some passed, `hold` when none did. Nothing is ever approved automatically.
- **A failed render or download** counts as a failed try for that image only.
- **Wide view + close-up:** the images alternate, starting wide. For a close-up, pieces outside the frame are not a failure; showing more pieces than the inventory is.

## What is different from the one-image workflow

- **Counted parts.** The Eye is told to count repeated parts such as seat cushions and legs, and never to write "multiple". The reviewer compares those numbers.
- **People in front of the product.** The render prompt says the person stays beside or behind the product. The reviewer is told that any part of a person or prop in front of a product piece fails `client_rules`.
- **Category as context.** When Sub-category is filled in, the form's Category, for example Living Room, is given to the stylist as context.
- **No look image.** A file marked as a look is listed as not used. Use the one-image workflow for a look reference.

These three prompt changes have not been tried on a real image yet.

## What has been checked, and what has not

- **Checked, without spending image credit:**
  - n8n accepted the workflow, 23 nodes.
  - The nine code steps were run locally on 11 mock jobs: all pass, one repair, never passes, job limit, failed render, failed download, unreadable review, wide plus close-up, white background, unreadable stylist, no product photo.
  - Three test runs inside n8n with the paid steps replaced by fixed sample data: execution 46 (two images, both pass), execution 48 (two rounds, job limit reached, on hold) and execution 49 (the status address read the result of 46 from the run log). Execution 47 stopped with an error by design of the test data.
  - The form was run in a browser against a local mock server.
- **Not checked:** a real run. That fal.ai returns a hosted link in this mode, that step 08b downloads it, how the new prompts change the images, how long a job with four 4K images takes, and the cost are all unconfirmed. How long fal.ai keeps an image link is also not confirmed; the images stay in the n8n execution.

The test runs left two rows in `Claude job runs` with a form id starting `claude-pin-test`. Their image links are placeholders.

## How to use it

1. Open `claude-midas-job-request-one-or-many.html`, add the product photo, pick the number of images, and press Multiple images. The form posts to the live address, so the run starts straight away.
2. The Result panel shows every image when the run finishes.
3. The same result is in n8n, in the step `12 Run card`: the text is in `run_card` and the images are the files `render_1`, `render_2` and so on.

After publishing, the live result address was checked from the Netlify site's origin: it returned the result of test run 46 and "not finished" for an unknown id. No real job has run on the live address yet.

## Settings to change

In `01 Job intake`: the largest count (4), `max_repairs` (2) and `max_renders_total` (twice the count).
