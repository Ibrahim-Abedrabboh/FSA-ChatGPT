# Owner web app

*Technical documentation · checked against commit `2bd6550` (21 Oct 2026). `npm test` at this commit: 371 tests, 370 pass, 1 skipped (it needs a real PostgreSQL).*

Folder: `claude-outputs/claude-midas-a7-owner-workspace/`. Static HTML and JS with no framework, plus Netlify Functions. Node 24 (`.nvmrc`).

## Screens (as built by `build.mjs`)

| Route | Page | What it does |
|---|---|---|
| `/` | `login.html` | Invite-only owner sign-in; accept an invitation and set a password (12+ characters) |
| `/owner/`, `/owner/start/`, `/owner/start/results/`, `/owner/results/` | `start.html` + `start-connected.js` | "New case" wizard: New Project, Edit or Single Product → photos → details → what to create → source facts → estimate → send → Go 1 / Go 2. Also Saved work, Jobs and Previous work |
| `/owner/overview/` | `overview.html` | Read-only home: counts, what needs the owner, recent jobs |
| `/owner/catalogue/` | catalogue | Import up to 10 products from the public Midas catalogue into the wizard |
| `/owner/controls/` | `index.html` + `app.js` | Desk: job queue, detail, history, Go decisions, billing reconciliation, reader recovery. Its new-job form is hidden (22 Oct 2026) and points to `/owner/` |
| `/owner/client/`, `/owner/guide/`, `/owner/draft3/`, `/owner/desk/` | `client/`, `studio/` (sources kept) | **Retired 22 Oct 2026** (owner's decision): not built; `netlify.toml` redirects them to `/owner/`. They could never send, because only `/owner/` confirms the photo facts the server requires |
| `/owner/model-tests/` | `model-tests.html` | Compare model setups per stage on one photo (stage 03 connected) |
| `/consumer/` | `consumer.html` | "See it in your room" concept; local UI only, no API calls; not behind sign-in |

## Functions (`netlify/functions/`)

| Group | Routes |
|---|---|
| Session | `/api/session`, `/api/logout` (Identity, HttpOnly cookies, 10 req/min/IP) |
| Read | `/api/owner/me`, `/api/owner/jobs[/:id]`, `/api/owner/connection` |
| Drafts and references | `/api/owner/projects[/:id]`, `/api/owner/project-references/:id[/:role]`, `/api/owner/sources/:id` |
| Estimate and budget | `/api/owner/project-estimate/:id`, `/api/owner/budgets/:id`, `/api/owner/source-understanding/:id` |
| Actions | `/api/owner/submissions`, `/api/owner/jobs/:id/approval` (12/min), `/api/owner/jobs/:id/reader-recovery` |
| Catalogue and tests | `/api/owner/midas-import[/:sku/:index]`, `/api/owner/midas-picks`, `/api/owner/model-tests…`, plus two background functions |
| Engine to ledger (server to server) | `/api/a7/budget/:action`, `/api/a7/budget-diagnostic` |

Every owner function re-checks the `owner` role. POSTs check the request origin. `lib/a7-engine-base.mjs` builds every upstream URL. A value of `A7_ENGINE_BASE_URL` that is not a bare https origin is ignored, and calls stay on n8n.

## Settings (names only; anything other than exactly `true` is off)

| Variable | Use |
|---|---|
| `A7_READ_AUTHORIZATION` | Key to reach the engine |
| `A7_ENGINE_BASE_URL` | Engine address (see [architecture](claude-architecture.md)) |
| `A7_OWNER_ACTIONS_ENABLED` | Emergency stop for every owner action |
| `A7_PAID_BUDGET_GUARDS_READY` | Emergency stop for spending |
| `A7_ANALYSIS_READY` | Enables source analysis |
| `A7_OWNER_TEST_ALL_SCOPES` | Lets unverified estimates start paid work; testing only |
| `A7_BRIDGE_MULTI_REFERENCE` | Allows several reference files per job |

The per-site table is in `SETTINGS.md`. A change takes effect only after the next deploy.

## Storage and security

- **Netlify Database** (Postgres, 10 migrations): budget ledger, projects, references, results. **Netlify Blobs** store `a7-owner-production` keeps private originals.
- **Strict CSP.** `default-src 'self'` with no inline script or style. `/owner/*` is sent `private, no-store` and is noindex.
- **Root `netlify.toml` is a guard.** It fails a build from the repo root. A root build on 18 Oct 2026 briefly published repository files.

## Build, test and deploy

`npm ci` · `npm test` (`node --test tests/*.test.mjs`) · `npm run build` (copies to `dist/` and bundles `login-client.mjs` with esbuild).

There are two Netlify sites, `midas-a7-owner-preview` and `claude-final-midas-a7`, built from this folder. The CI job `owner-controls` in `.github/workflows/a7-guidance.yml` tests and builds but does not deploy.

## Page rules from the 22 Oct site fixes

From the supervised run `ff0aa7e5` (report sections 4.1 and 4.4). Details: `claude-outputs/claude-midas-a7-site-fixes-README-2026-10-22.md`.

- **Estimate after an edit (`start-connected.js`).**
  - Typing in the new-case form clears the estimate and disables "7. Send", but no longer disables "6. Get estimate".
  - Each save records the form it was saved from (`draft.formKey`). Pressing "6. Get estimate":
    - If the form differs from the saved version, the page asks for "5. Save all details" first. No estimate request is made.
    - If the form matches again (a change undone), the page asks the server for a fresh estimate of the saved version.
  - The server rules are unchanged: the estimate is bound to the saved version's fingerprint, is valid for 15 minutes, and sending needs the confirmation dialog.
- **Reopening a saved version (`openSavedVersion`).** `savedProblems()` checks the saved pieces (quantity and name, at most 20 lines) and the budget (USD 0.25–10.00) with the same rules as saving. A saved value that would be refused is never left locked:
  - **Never sent, not an edit of an approved image:** the version is treated as incomplete. Its fields are unlocked and corrected in place (PATCH, same version).
  - **Sent, or an edit of an approved image:** only the refused field is unlocked (`opened.fix`). Its correction goes into the new version this edit saves. The other recorded facts stay locked, and the sent version is not changed.
- **No decision wording without a decision (`start-connected.js`, `owner-actions.js`, `studio/app.js`).**
  - The approval context of a held run still carries the last Go 2 ticket's `decisionNeeded`, with `allowed: []`.
  - The pages show `decisionNeeded`, and the plan shots on `/owner/controls/`, only while `allowed` is not empty.
  - A held run shows "On hold:" and its recorded hold reason.
- **One message, shown once.** When an answer appears beside its button, the status line at the top of the estimate panel (`#connectedStatus`) is hidden. It still holds the text.

## Not done (from the app's own docs)

- **Not connected:**
  - batch dispatch;
  - secondary or accessory-led composition;
  - PDF and Excel reading;
  - generated-asset downloads (the jobs API returns no asset URL);
  - resumable uploads, retention policy and recovery dashboard;
  - consumer try-on.
- **Recorded but not applied by A7:** room description, catalogue references, product links, plants, mood, strengths, description and meta.
- **Estimates:** only White BK alone, square 2K and one product image counts as a verified estimate.
- **Unchecked `claude-final-midas-a7` acceptance list:**
  - owner sign-in on that site;
  - live status;
  - one bounded paid run;
  - phone and screen-reader checks;
  - the owner's review of look and wording.

## UI review findings (assessment, 21 Oct 2026)

These come from reading the code and are not browser-tested. Prioritise them before adding screens.

1. ~~Three generations of the same flow are live side by side.~~ **Resolved 22 Oct 2026:** `/owner/` is the only new-job screen; the client studio, draft 3 and the `/owner/desk/` alias are retired and redirect to `/owner/`. `CLAUDE-FINAL-README.md` still describes `/owner/` as the client studio.
2. **Duplicated output.** `start.html` is emitted at four paths and `index.html` at two, with `start.js` and its siblings copied to each.
3. **Two visual systems.**
   - `palette.js` (six palettes; light, dark or system) themes start, overview, catalogue, consumer and model tests. `model-tests.css` builds on the `start.css` tokens.
   - The client studio (`client/styles.css`), draft 3 (`studio/styles.css`, navy and gold) and the desk (`styles.css`, terracotta) each have their own look, with no dark mode.
4. **Very large single files.** `start-connected.js` is about 130 KB, `start.css` about 135 KB and `studio/app.js` about 2,000 lines.
5. **Concept and mock screens in the real navigation.** "Consumer VTON concept" is linked from Overview. Options that are "recorded, not applied" can still be picked.
6. **Stale docs.**
   - `README.md` says "No submission, approval … is connected", and `AUTH_FOUNDATION.md` and `VERIFICATION.md` describe a mock.
   - `CLAUDE-FINAL-README.md` says "Not merged to main" and "138 tests".
   - A `build.mjs` string replace targets text no longer in `index.html`.
7. **Accessibility and locale.**
   - Accessibility is partly built (skip link, dialogs, aria) but not verified with a screen reader or on a phone.
   - Dates are hard-coded to Asia/Amman. Right-to-left support exists only in draft 3.
