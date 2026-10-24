# Testing models per stage

Owner page: `/owner/model-tests/` (linked as **Testing models** in the studio masthead).

It sends one photo to several model setups of the same A7 stage and shows the answers side by side:
- time;
- the number of product pieces counted, and whether that matches the correct count;
- estimated cost;
- category;
- the full answer.

Nothing on the page changes a job, a draft or the live A7 workflows.

## Stages
| Stage | State |
|---|---|
| 03 Eye · photo reading | Connected |
| 14 Generation · white master image | Next |
| 16 Verdict · image review | Next |

## Eye setups
| Arm | Model | Prompt | Default |
|---|---|---|---|
| A | gemini-3.8-flash | current live 03 Eye prompt (16000 output tokens) | off |
| B | gpt-6.1-sol | enhanced | on |
| C | gemini-3.8-flash | enhanced | on |
| D | gemini-3.5-flash | enhanced | on |
| E | claude-opus-5-5 | enhanced | on |

- Arm A is off by default because the first test took 227.6 s on it. n8n Cloud's gateway returns 524 after about 100 s, so A usually shows **Cut off at ~100 s by n8n Cloud**.
- Since 19 Oct 2026 the "enhanced" setups (B–E) use prompt v3, the prompt now live on 03 Eye (see `analysis-reader-prompts-live.md`). Sol (B) answers under a strict JSON schema, and every v3 answer is checked against that schema; problems come back as `schemaErrors` in the full answer.
- The prompts are in the n8n workflow "A7 · Model tests per stage (owner page)" (`jYkKQ2NOreSG0t97`, webhook `POST /webhook/a7/model-test`). That workflow runs one arm per call.

## Photos
The page offers two sources:
- **Midas test photo:** five lifestyle photos with a counted answer (`MIDAS_PHOTOS` in `lib/model-tests.mjs`). The server fetches them only from the fixed URLs held there.
- **My own photo:** JPEG, PNG or WebP. If a photo is over 3 MB, the browser reduces it before sending. The correct count is optional.

## Cost and limits
- **Cost basis:** estimated from the tokens each provider reports, using the prices in `claude-midas-a7-design/cost_model.json`.
  - Gemini thinking tokens are billed as output.
  - For OpenAI, reasoning tokens are already included in the output count.
- **No recorded price:** Gemini 3.5 Flash and Claude Opus 5.5 have no price there, so the page shows **price not recorded** and no figure.
- **Daily limit:** 20 runs per owner per UTC day. Each run makes one paid call per chosen setup.
- **Where runs are allowed:** POST runs only on the production deploy, from the same origin, when both of these are set:
  - `A7_PAID_BUDGET_GUARDS_READY=true`;
  - `A7_READ_AUTHORIZATION`, which is sent to n8n as the webhook's header credential.

## Code
- `lib/model-tests.mjs`: stages, arms, prices, test photos, validation, cost estimate and Eye summary.
- `netlify/functions/owner-model-tests.mjs`: owner API (`/api/owner/model-tests`, `/:id`, `/:id/photo`). It stores runs in the Blobs store `a7-model-tests`.
- `netlify/functions/owner-model-tests-background.mjs`: the paid calls.
  - A one-time dispatch marker comes before any call.
  - Setups run in parallel, with a 110 s timeout each.
  - Each answer is stored as it arrives.
- `model-tests.html`, `model-tests.css`, `model-tests.js`: the page.
- `tests/model-tests.test.mjs`: tests for the above.
