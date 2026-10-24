# Midas A7, BE-6 proposal: file links that expire and have their own secret (22 Oct 2026)

Written by Claude for the owner. **This is a proposal. Nothing is built until you approve it.** It changes how the service signs and checks file links. That is engine behaviour, so rule 3 needs your go. Setting a new variable on Railway is your step (rule 2).

Source: `claude-outputs/claude-midas-a7-audit-and-automation-plan-2026-10-21.md`, finding BE-6 (High) and Phase 4. The first half of BE-6, removing `sig=` from log lines, was merged in Phase 0 (PR #84; `src/midas_a7/cli.py:77`). Line numbers below are from `main` at `3d35328`.

## The problem today

Every stored image and manifest is served at `/files/<id>/view?sig=<64 hex>`.

| What | Where | Why it matters |
|---|---|---|
| The link is signed once, at upload, and is checked with no time limit | `src/midas_a7/nodes/google_drive.py:36-42`, `src/midas_a7/app.py:301-316` | A link that leaks (a forwarded message, a screenshot of the address bar, a browser history) opens the image for ever |
| File links and resume links share one secret, `RESUME_SIGNING_SECRET` | `google_drive.py:29-33`, `runtime.py:33-36` | Rotating it to cancel leaked file links also breaks the resume link of every run waiting at Go 1 or Go 2. So in practice it is never rotated |
| If the variable is missing, a random secret is made at start | `runtime.py:33-35` | Every link and waiting run breaks at each restart. Today the variable is set: its name was in the service's variable list read from Railway by Claude on 22 Oct 2026 at about 10:25 UTC (names only). `/health` cannot show it, because it does not report this variable (`config.py:80-86`) |
| Links are stored inside run records | `15o_Final_receipt.js:17`, `18n_Identity_entry.js:13`, `20k_Scene_manifest.js:16` | A link with a time limit would go stale inside old records, so the site would show broken images for older runs unless links are signed again when they are read |

What is already in place: file ids are a fixed "1" and 32 random characters (`google_drive.py:24-26`), the view answers 404 for a wrong signature, and it sends `no-store`, `nosniff`, `no-referrer` and a sandbox policy. Phase 0 keeps `sig=` out of logs.

Who reads the links: the owner site, through the approval context (`owner_bridge/code/Safe_approval_context.js:31,48`). That gives the Go 2 candidate and the deliveries. The site accepts only links of the exact form `/files/<id>/view?sig=<64 hex>` from the engine it is set to call (`netlify/functions/owner-actions.mjs:42`, `studio/app.js:367`). A Go 2 "Approve" needs a candidate link of that form (the Phase 0 rule). The status and history reader hides links (`owner_read/code/Project_safe_status_and_history.js:3`). No model request carries a link; images are sent inline.

## Proposal

### 1. A file-link secret of its own
- New variable **`FILE_LINK_SECRET`**. You set it on Railway yourself. I never see or ask for its value.
- File links are signed with it. Resume links keep `RESUME_SIGNING_SECRET`. Rotating one no longer touches the other.
- **Changeover without breaking anything:** while `FILE_LINK_SECRET` is not set, nothing changes. Once it is set, new links use it, and links signed with the old secret are still accepted until a cut-off date (step 3).
- `/health` reports only whether it is set: `"configured"` gains a flag such as `fileLinkSecret: true/false` (the existing keys are camelCase, `config.py:85`).

### 2. Links that expire, in the same form the site already accepts
- The link keeps its exact form `/files/<id>/view?sig=<64 hex>`. The site and its checks need no change.
- The signature now covers the file id **and a day number** (UTC). The view accepts a signature for today or yesterday. A link therefore works for **24 to 48 hours** after it was made, then answers 404.
- **Signed again when read.** When the service answers the approval context, it replaces the file links in two fields only, `candidate` and `deliveries[].link`, with freshly signed ones, using the file id already in the link. The owner always gets working links for old runs too, and a link copied out of the site stops working within two days.
- **What re-signing trusts.** It does not check the old signature: after a rotation the old one cannot be checked against the new secret. It mints a link from the file id alone. That is safe because those two fields only ever hold links the flows recorded. The approval context already removes every address from free text (`Safe_approval_context.js:6`) and accepts only the exact link form in those fields (`:19`). It is not a sweep over the whole answer.
- **The approval `revision` does not change.** The flow computes it over the stored ticket, before the service re-signs (`Safe_approval_context.js:23`). The site's stale check and idempotency key (`owner-actions.mjs:76`, `lib/a7-actions.mjs:127`) therefore keep working across days. PR B tests this.
- This happens in the service, between the flow's answer and the HTTP reply. No flow file and no Code node changes. No Code node reads either secret. Note: the JS sidecar that runs Code nodes inherits the service's whole environment (`engine/jsrunner.py:44-47`), so a Code node *could* read any variable. None does today (no `process.env` in `flows/*/code`). Narrowing that environment is a separate hardening item, not part of BE-6.
- PR B adds a test that sends every webhook a request, including `/webhook-waiting/*`. It fails if any answer still carries a link signed the old way, so no route is missed.

### 3. Retire the old links after a cut-off
- Links signed the old way (no day number, or the old secret) are accepted until a cut-off date set as a variable, **`LEGACY_FILE_LINKS_UNTIL`** (proposed: 14 days after the deploy).
- After that date only links with a day number and the new secret open. Re-signing on read means the site never shows an old link by then.
- **If `FILE_LINK_SECRET` is still not set at the cut-off,** the fallback secret *is* the old secret, so refusing old links would break every link. PR C therefore applies the cut-off only when `FILE_LINK_SECRET` is set. Until then it keeps accepting links and logs a warning.
- Removing the old-link code once the date has passed is a separate small PR, which needs your go.

### Rotating later (after this lands)
To cancel every file link in circulation: set a new `FILE_LINK_SECRET` **when no run is active**. Changing a variable redeploys the service, and an active run is lost at restart (BE-1, runbook; rule 10). The site keeps working, because it signs again on every read. Waiting runs are not affected. No old-secret overlap is needed, because the site never holds a link for more than two days.

## What it does not do
- It does not add login to the file view. The link is still the only key; it is just short-lived now.
- It does not change resume links. A resume signature itself never expires (`runtime.py:45-52`). Go 1 and Go 2 tickets older than 24 hours are refused by the approval context (`Safe_approval_context.js:33`) and by the Wait timeout (runbook). Short-lived resume links would be a separate item.
- It does not touch the budget ledger, any paid call, Go 1, Go 2 or the n8n workflows.

## How it would be built
Three draft PRs, one per step above, each with tests and no paid call:

| PR | Change | Tests |
|---|---|---|
| A (step 1) | `FILE_LINK_SECRET` with fallback to `RESUME_SIGNING_SECRET`; `/health` flag; runbook and docs | Without the variable, links are unchanged byte for byte. With it, new links verify and old links still verify. Rotating `RESUME_SIGNING_SECRET` no longer breaks file links |
| B (step 2) | Day-number signatures; re-sign on read for `candidate` and `deliveries[].link`; route sweep test | A link made yesterday opens; one made two days ago answers 404. The approval context always returns links that open. `revision` is the same across days. The site's link pattern still matches. The harness (`tests/py/claude_a7_harness.py`) runs to Go 2 and the scene with re-signed links |
| C (step 3) | `LEGACY_FILE_LINKS_UNTIL`; old links refused after it, only when `FILE_LINK_SECRET` is set | Before the date old links open; after it they answer 404; with `FILE_LINK_SECRET` unset nothing is refused |

`tests/py/test_replay_run_1591.py` is unaffected, because no node changes. The owner site needs no change. Its tests run in the same PR to show that.

## Risks
- **A link stops working while open.** A link made just before UTC midnight lasts about 24 hours, one made just after lasts about 48. So a Go 2 page left open for more than about 24 hours can show a broken image until it is refreshed. A refresh fetches fresh links. A Go 2 ticket older than 24 hours is already refused, so this adds no new failure at the gate.
- **Clock.** The day number uses the service clock (UTC). Accepting yesterday too covers a link made just before midnight.
- **A route that returns links is missed.** The sweep test in PR B guards against this.

## Review
An independent review (the `a7-reviewer` prompt, run as a separate read-only agent) found nine points, all checked against the code and fixed here:
- "Code nodes never see either secret" was too strong: the JS sidecar inherits the environment.
- The variable's presence had no stated evidence.
- Two steps were in the wrong order for the cut-off variable.
- What happens at the cut-off with `FILE_LINK_SECRET` unset was left open.
- The rotation step lacked "when no run is active".
- Re-signing by file id needed its trust stated and its scope limited.
- `revision` was not mentioned.
- The time-risk wording was wrong.
- There were small citation errors.

## Decisions for you
1. Approve the design (separate secret, day-number expiry, re-sign on read, cut-off).
2. Link life: **24–48 hours** (proposed), or longer, e.g. 7 days. This has no effect on the site, which signs again on every read.
3. Variable names: `FILE_LINK_SECRET` and `LEGACY_FILE_LINKS_UNTIL`.
4. Cut-off for old links: **14 days** after PR C is deployed (proposed).
5. Order: BE-6 is Phase 4 in the plan. Build it after Phase 1, or earlier if you prefer. It does not depend on any Phase 1 item.

## What you do, when approved
- After PR A is merged and deployed: set `FILE_LINK_SECRET` on Railway (Raw Editor, a long random value) when no run is active, then redeploy. I will check `/health` shows it as set.
- After PR C is merged and deployed: set `LEGACY_FILE_LINKS_UNTIL` to the cut-off date you chose, again when no run is active.
