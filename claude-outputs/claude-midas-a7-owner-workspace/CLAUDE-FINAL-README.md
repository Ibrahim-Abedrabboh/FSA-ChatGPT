# Claude-final-midas-a7: the client-first-page experience as the owner studio

18 October 2026, Asia/Amman. Branch `Claude-final-midas-a7`, created from `codex/a7-owner-read-status` at `a5bf313`.
Netlify project `claude-final-midas-a7` (`42036d46-4294-490d-8c7f-b2bd02093a96`): https://claude-final-midas-a7.netlify.app

**Not merged to `main`.** The source branch `codex/a7-owner-read-status` and the Netlify project `midas-a7-owner-preview`
were not changed. Merge only after the acceptance checklist below passes.

## What changed

The owner studio now follows the experience at https://midas-client-studio.arafat312096.chatgpt.site/client-first-page:
- **Projects or Manual.**
- **The five steps:** The Job, The Item, Scope, Preferences and Suggestions.
- **More options** (items 7–15 of its guide).
- **Review your choices.**
- **The Guide.**

It is connected to the owner backend. Source: `client/`. Draft 3 (`claude-midas-a7-page-3`) stays the earlier design reference; its connected copy (`studio/`) stays available.

| Address | What it is | Access |
|---|---|---|
| `/` | Owner sign-in in the same design (Netlify Identity, invitation only) | public, no private data |
| `/owner/` | The studio: Projects/Manual → steps → Review → cost confirmation → send once → plan and image decisions → result | owner role |
| `/owner/guide/` | The first-page guide, with what is available now beside every option | owner role |
| `/owner/draft3/` | Draft 3, connected, kept for reference | owner role |
| `/owner/desk/` | The earlier owner workspace, unchanged: all jobs, spending ledger, recovery tools | owner role |

### How one request travels

1. **Brief:** the owner chooses Projects or Manual and works through the steps.
2. **Review your choices:** lists what will be made and what is still missing. Nothing can be sent while something is missing.
3. **Save and check the cost:** saves a project version (`/api/owner/projects`). The request reference is its id, so a retry never makes a second job.
4. **References:** every reference is stored privately with its role (product, room, inspiration, other views), at most once each.
5. **Cost:** the backend's own estimate is shown (`/api/owner/project-estimate/:id`). The owner must tick the confirmation before **Start processing**.
6. **Send:** the request goes once (`/api/owner/submissions`), bound to the confirmed estimate and the saved direction.
7. **Decisions:** the page follows the job. Plan and image decisions open in place, bound to the ticket revision (`/api/owner/jobs/:id/approval`).
8. **Result:** read through `midas-result/1`. "Approved" appears only after your recorded decision, and "Package complete" only when A7 records the package.

### What each choice does (revised 18 Oct 2026 to the full first-page guide)

Every option of the guide can be chosen on `/owner/`. Nothing is "Coming later" any more. Each option is either **applied by A7**,
meaning A7's own intake code (`n8n/claude-midas-a7/code-nodes/01_Intent_scope.js`) reads it, or **recorded**. A recorded option is
saved and sent, but A7 does not apply it yet; A7 lists it back itself under "not applied", and the page marks it
"Recorded · not applied by A7 yet".

| Applied by A7 | Recorded · not applied by A7 yet |
|---|---|
| **Projects:** product or collection (one or several items), existing room, new styled space, saved project | Room description (new styled space) |
| **Manual:** New Project → Batch / One by one; Edit → Choose from saving / New item; Single item → **Hero / Secondary** (`job.itemRole`) | Choose from Midas (catalogue references by SKU or link) |
| **References:** department / category / sub-category or Automatic; product, room, inspiration, previous result, other views, specification (text, CSV, JSON; PDF and Excel are stored, and A7 says it has not read them) | Product links |
| **Outcomes, combined:** White BK, Lifestyle, Website, New Composition, Create with this item, Variations (from a saved version A7 already received), and Others (sent as an explicit instruction) | Plants; Mood / Vibes |
| **View & delivery:** views, nine proportions, 2K / 4K, five camera views, three-view and views-by-light series, number of variations (what to vary is written into the instructions) | Fidelity / Styling / Cluttering strengths |
| Lighting, wall paint, floor, workflow defaults; Human | Proceed without; semantic grounding (the plan approval always stays on) |
| Specific items (Midas SKUs → `midas_picks`), additional input data, previous generation (space / look) with a sent parent, other pieces, custom prompting, details to keep, things to exclude | Description and meta: No (the package still carries a draft description) |

**Batch:** each item has its own references, category and pieces. Each item is saved as its own version in one collection
project and sent as its own job, because A7 takes one item per job. Scope and preferences apply to every item.

**Paid start:** every choice is saved with its references and gets a cost estimate. Paid processing can start only when all of these hold:
- the estimate is **verified**: one product image, White BK alone, square 2K
- the site's paid switch is on
- the job has one image (see the bridge below)

Every other choice keeps a provisional estimate (Route worksheet arithmetic, now covering every outcome A7 plans) until it is verified.

**The A7 owner bridge forwards one image per job.** The live n8n workflow "A7 · Owner submission and approval bridge"
(`Mo9c5GmTcx0K79F7`, node "Normalize owner upload") accepts exactly one binary file and renames it `owner-source.<ext>`.
- **Today:** room, other-view, inspiration, previous-result and specification references are saved but cannot reach A7. The backend refuses such a send with `bridge_single_reference` before anything is sent.
- **To lift this:** the bridge needs to accept several files and keep their names, so A7 can match their roles. Then set `A7_BRIDGE_MULTI_REFERENCE=true`. That is an n8n change and needs your go.

### Backend changes for the guide (18 Oct 2026, additive)

- **`lib/a7-actions.mjs`:** page `studio` may carry the guide's fields (`GUIDE_KEYS`), each strictly validated. They are mapped to what A7 reads:
  - `scope.outcomes`, `job.itemRole`, `scope.series`, `scope.imageCount`
  - five camera views, 4K
  - `midasPicks`, `catalogueReferences`, `details`, `styling.plants` / `mood`, `strengths`, `validation`, `roomBrief`
  - `job.type` is never set, so A7 still reads `jobMode` (new_project or edit).
  - Draft 3 and desk submissions are unchanged (tested).
- **References:** `validateReferenceFile` accepts specification files (text, CSV, JSON, PDF, .xlsx), checked by their bytes.
- **`lib/a7-projects.mjs`:**
  - saves the guide fields, with a brief of up to 9,000 characters
  - returns `projectId`, so batch items join one collection
- **`lib/a7-estimate.mjs`:** `plannedOutputs()` mirrors A7's image plan for every outcome. Only White BK alone, square 2K, with one product image stays "verified".
- **`owner-actions.mjs`:**
  - passes the parent version's `run_id` as `parentRunId`, which variations and previous generation need
  - refuses variations without a sent parent
  - refuses more than one reference while the bridge carries one image
- **Root `netlify.toml`:** a guard. A build started from the repository root fails, so the repository is never published again (see the 18 Oct exposure below).

### Backend changes (additive)

- `lib/a7-actions.mjs`: submissions marked `page: "studio"` (this studio) or `page: "draft3"` may carry Draft 3's choices. These are camera view, human presence, "studio choice", wall paint, floor, colour, material, details to keep, things to exclude, department, category, sub-category and product notes. Each is strictly validated, and each is one that A7's `01 Intent & scope` reads. Desk submissions are unchanged byte for byte (tested).
- `lib/a7-projects.mjs`: drafts keep those fields, so the submission matches the saved draft exactly.
- `owner-me` has its own route and rate limit, so the redirect was removed. The CSP allows `blob:` images for the photo preview.

### Kept honest

- **Recorded options:** whatever A7 does not apply yet can still be chosen. It is marked on the page, listed in the review, and A7 lists it back under "not applied".
- **Provisional estimates:** these cover everything except White BK alone, square 2K, with one product image, and they **cannot** start paid processing. Edits cannot start it either. The dialog says so, and the request stays saved.
- **Draft 3 copy:** its owner-only strings are English only. The Arabic draft covers the client page and still needs a native review.

## Safety settings on the new Netlify project

| Setting | Value | Why |
|---|---|---|
| `A7_OWNER_ACTIONS_ENABLED` | `true` (Production, 18 Oct 2026 14:44, owner's request) | Sending is on. |
| `A7_PAID_BUDGET_GUARDS_READY` | `true` (Production, 18 Oct 2026 14:44, owner's request) | Paid processing is on for verified estimates. |
| `A7_ANALYSIS_READY` | `true` (Production, 19 Oct 2026 22:27, owner's request) | Source analysis is on. Its budget calls reach this project's ledger through `budgetOrigin` (option A). |
| `A7_BRIDGE_MULTI_REFERENCE` | **not set** (`true` on `midas-a7-owner-preview`) | Without it, a version with more than one saved reference is refused before sending (`bridge_single_reference`). |
| `A7_OWNER_TEST_ALL_SCOPES` | **not set** (`true` on `midas-a7-owner-preview`) | Without it, only verified estimates can start paid processing; provisional ones (most scopes, and edits) stay saved. |
| `A7_READ_AUTHORIZATION` | **new value, 18 Oct 2026 15:13** (secret, Production) | Rotated because the old value could not be recovered. The same new value is in the n8n credential "A7 GPT bridge inbound" and in `midas-a7-owner-preview` (Production). It is needed to send, to read live status and to receive A7's budget calls. |
| Database / file storage | separate | This project gets its own Netlify Database and Blobs. Nothing is shared with `midas-a7-owner-preview`. |

**Which budget A7 charges (option A, 19 Oct 2026):** each job, reader recovery and source analysis this site sends to A7 carries `budgetOrigin`, the site's main address (`lib/a7-site-origin.mjs`, from Netlify's runtime `URL`). A7's budget calls go to `https://claude-final-midas-a7.netlify.app/api/a7/budget/` only when `budgetOrigin` is exactly that address. Every other job, including one sent before this change, still goes to `https://midas-a7-owner-preview.netlify.app/api/a7/budget/`. A job whose budget sits in this project's database therefore reserves and settles here.
- Covered: 26 nodes in "Claude · Midas A7 (stages 01–07)" and 8 nodes in "A7 · Source analysis only".
- Not covered: the one-off Blind and Package recoveries of owner-preview runs, which keep the owner-preview address.
- Until those A7 versions are published, a paid job sent from here asks the owner-preview ledger. That ledger has no budget for this site's jobs, so the reservation is refused and the job holds before any paid call.
- The builders in `n8n/claude-midas-a7/budget-guards/` still write the fixed owner-preview address; rebuilding a workflow from them would undo this routing.

## Deployment record

- **Exposure, 18 Oct 2026 11:45–11:55 Asia/Amman:** after the branch was linked in the dashboard, the first Git build (`6ad4870ab169c15f32b4b06e`) ran from the repository root. It published the repository's files (code, n8n workflow builders, design pages) with no functions, access rules or headers.
  - A scan of all 599 files found no keys, tokens or private keys. The n8n webhook addresses were visible.
  - Fixed at about 11:55 by redeploying from the owner-app folder (`6ad487835a68e4b990c840cf`).
  - The base directory must be set in Build settings; the root `netlify.toml` guard now makes a root build fail instead of publishing.

- First deploy `6ad47905f0f8d814a590154a`, ready 18 Oct 2026 10:45 Asia/Amman, uploaded from this branch at `7584951`. Netlify built it with `npm run build` from this folder.
- The 5 existing database migrations were applied to the new project's own database. The secret scan found nothing (103 files).
- Live anonymous checks: `/` 200; `/owner/`, `/owner/app.js` and `/owner/desk/` return 401; all `/api/owner/*` reads and an anonymous POST to `/api/owner/submissions` return 401; a foreign-origin sign-in returns 403. The security headers are present.
- Sign-in shows "Sign-in is unavailable" until Identity is enabled (step 1 below).
- Second deploy `6ad4820cad23b05fe11871b4`, 18 Oct 2026 about 11:20 Asia/Amman, from `7b5b774`. It brought the client-first-page studio, the guide, the new sign-in and Draft 3 at `/owner/draft3/`. Live anonymous checks: `/` 200; `/owner/`, `/owner/guide/`, `/owner/draft3/` and `/owner/desk/` return 401; `/api/owner/*` returns 401.
- **Guide revision deploy `6ad4a52dad7a8fa78d302970`, 18 Oct 2026 about 13:54 Asia/Amman.**
  - The first Git build with the base directory set, from `b5230f0`.
  - Netlify reported 13 functions, 2 redirect rules, 2 header rules, and a secret scan of 108 files with no matches.
  - Live anonymous checks: `/` 200; `/owner/`, `/owner/app.js`, `/owner/guide/`, `/owner/draft3/` and `/owner/desk/` 401; `/api/owner/*` 401, including an anonymous POST to submissions; repository paths (`/README.md`, `/netlify.toml`, source files) 404.
- **Branch is linked to GitHub with base directory `claude-outputs/claude-midas-a7-owner-workspace`**, so each push to `Claude-final-midas-a7` deploys. An upload of the folder alone now fails by design; push instead.

## Setup steps only you can do (Netlify dashboard)

1. **Identity:** Project configuration → Identity → enable, set registration to **Invite only**, and turn on email confirmation.
2. **Invite yourself**, then set the role `owner` on your Identity user (app metadata roles).
3. **Live job status:** add `A7_READ_AUTHORIZATION` as a secret, Functions scope, Production context, and redeploy. Optional.
4. Leave `A7_OWNER_ACTIONS_ENABLED` and `A7_PAID_BUDGET_GUARDS_READY` at `false` until the budget address decision above.

## Checks run on this branch

| Command | Result |
|---|---|
| owner app `npm test` | 138 passed, 0 failed, 1 skipped (needs an isolated real PostgreSQL; unchanged) |
| `tests/studio-link.test.mjs` guide tests | every guide choice through A7 01 and 02: applied fields in the brief, and exactly six "not applied" lines for the recorded ones; wrong values refused; variations need the parent run |
| `tests/studio-link.test.mjs` (in the suite) | Studio and Draft 3 briefs pass A7's own 01 and 02 code with nothing "not applied"; desk submissions unchanged; result mapping cases |
| `run_client_studio_flow.js` (built site, fake owner backend, Chromium) | 88 / 88 (guide revision): every option selectable; Hero / Secondary; seven outcomes; 4K, proportions, camera, series; More options 7–15; recorded options listed in the review; specification PDF stored with its role; batch of two items in one collection, sent one job each; variations only from a sent version; existing room; provisional estimate blocks paid start; plan and image decisions; 375 px; guide |
| `run_owner_studio_flow.js` (Draft 3 at `/owner/draft3/`) | 43 / 43 |
| `run_page3_mock.js` on Draft 3 and on its connected copy (mock mode) | 256 / 256 each |
| Engine suites (guidance, release, instructions, fidelity, prompt fixes, phase 1, stage 06, budget) | all pass |

These are local and synthetic checks. No paid call, no n8n change, and no live job was made. The guide page is generated by `client/build-guide.py`.

## Acceptance checklist before any merge (open)

- [ ] Identity enabled and owner sign-in verified on `claude-final-midas-a7`.
- [ ] Decision on the engine's budget address (old project vs this one).
- [ ] Live read-only status verified with `A7_READ_AUTHORIZATION`.
- [ ] One bounded paid White BK acceptance run from the studio, with your Go.
- [ ] Lifestyle estimate verified before Lifestyle can be sent.
- [ ] Physical phone and screen-reader checks.
- [ ] Your review of the studio's look and wording on the live page, against the client-first-page reference.
- [ ] Base directory set to `claude-outputs/claude-midas-a7-owner-workspace` in Build settings, and one Git build checked.
- [ ] Bridge update for several references (n8n), with your go; then `A7_BRIDGE_MULTI_REFERENCE=true`.
- [ ] Verified estimates for the other outcomes, before they can start paid processing.
