# Midas A7: session briefing

The Briefer mod adds this file to the system prompt of every Claude Code session in this repo. Keep it short: under 6,000 characters. When a phase, a blocker or an ID's status changes, update it in the same PR.

Last updated: 22 Oct 2026 (BE-6 PR A). Merged: Phase 0 (PR #84), The Shield (PR #85), the supervised-run checklist (PR #86), the overlapping-sends test and the Phase 1 design proposal (PR #87), the Phase 1 harness (PR #88), the harness past Go 1 (PR #89), the BE-6 proposal (PR #90), the run report for `ff0aa7e5` (PR #91), Phase 1.1 (PR #92). Live when last checked: Railway deployment `b8bab968` (`3d35328`), since 11:10; whether later merges are deployed is the owner's step and was not re-checked here. Open draft: BE-6 PR A.

## Where things run
- **Engine.** The Python service on Railway (`https://midas-a7-production.up.railway.app`, one replica) runs the A7 flows. `midas-a7.up.railway.app` is wrong and returns 404.
- **Owner sites.** `midas-a7-owner-preview` calls the Python service. `claude-final-midas-a7` still calls n8n, and `A7_ANALYSIS_READY` is off there, so the final site cannot send any job.
- **Job screen.** Only `/owner/` sends jobs. `/owner/client/`, `/owner/guide/`, `/owner/draft3/` and `/owner/desk/` are retired and redirect to `/owner/` (FE-1, owner's decision 22 Oct). `/owner/controls/` keeps the queue, reconciliation and reader recovery, with no new-job form.
- **Run status.** `GET /status` on the service, with the bridge secret, lists runs by state and recent failures.
- **Anthropic.** `ANTHROPIC_WORKSPACE_ID` is set (`/health` reports `anthropicWorkspaceId: true`).

## Plan
`claude-outputs/claude-midas-a7-audit-and-automation-plan-2026-10-21.md` holds the full plan and the finding IDs:
- **Phase 0:** stop silent failures. **Merged 22 Oct (PR #84):** FE-1, FE-3/4/5/6/7/14/15/18, BE-2, BE-5, BE-6 first half, plus a database `sending` state so only one send of a version reaches A7. The send gate lives in `lib/claude-a7-send-gate.mjs` and is tested with overlapping sends (PR #87).
- **Phase 1:** let a job reach the end. Flow changes, one draft PR each, each needing the owner's go. Design: `claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md`. **1.1 merged (22 Oct, PR #92):** a crash ends as a hold naming the step. **1.2 merged (22 Oct, PR #95):** a package held by the background rule gets a go 2 decision (deliver as exception, repair, stop). **1.5 built (22 Oct, draft PR; Python service only):** the image model comes from the registry (the ledger still allows one model); non-owner job ids are refused at intake. **1.3 merged (22 Oct, PR #97):** only a whole product is fitted, and the white files keep 76% ± 3. Follow-up in a draft PR: an image approved without a review is judged by the review's own box test. **1.6 built (22 Oct, draft PR #100; Python service only):** scene references above the request size are shrunk in code to a 2048 px long side before the placement call (FL-10). 1.7, 1.4 wait for a yes or no. **BE-6 approved** with the proposed defaults, built as three PRs. **PR A (own file-link secret, `FILE_LINK_SECRET`) merged 22 Oct (PR #93);** PR B (expiring links, re-signed on read) and PR C (cut-off for old links) follow one at a time.
- **Phase 2:** a durable engine.
- **Phase 3:** automate the process around Go 1 and Go 2.
- **Phase 4:** cleanup and security.

**Supervised run done (22 Oct, run `ff0aa7e5`):** Go 1, one image call, review and Go 2 worked; charged USD 0.22 against a USD 5.00 ceiling. The review failed the image: cut off at the edge, framing 97% (FL-5). The owner approved it, and the package then held on a 2-pixel grey halo, which blocked the scene (FL-4). A USD 3.00 job ceiling cannot work, because the ledger holds worst cases (USD 4.32 for planning), so the run ran under a USD 5.00 ceiling. Report: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md`. Next: the owner's yes or no per Phase 1 item.

## Open findings to keep in mind
- **Critical:**
  - FL-4: a package on hold blocks scenes and edits (fixed by 1.2, merged 22 Oct, for holds on the background rule; live once deployed).
  - FL-1: a Code node that throws ends the run with no hold (fixed by 1.1 once merged).
  - FE-2: the final site cannot send.
- **High:**
  - BE-1: a restart wipes active runs.
  - BE-2: there are no alerts yet (`/status` exists after Phase 0).
  - FL-3: model tests spend without the ledger.
  - FL-12: the image model is hard-coded (fixed by 1.5 once merged; the ledger still prices one model).
  - FL-5: fit-on-white can hide a cut-off product (fixed by 1.3, merged 22 Oct: fit only a whole product, 76% ± 3 on delivery; live once deployed).
  - FL-2: non-`owner-` job ids crash (refused at intake by 1.5 once merged).
  - FL-10: a scene request over the size limit holds after the room was paid (fixed by 1.6 once merged: references above 2048 px are shrunk in code first).
  - BE-6: file links never expire, and they share the resume secret (log redaction is done in Phase 0).

## Who does what
- **Claude** writes the fixes on branch `Claude-final-midas-a7`, one draft PR per work package, with tests and a dated README.
- **Mods in `tools/claude-mods/`:** The Briefer (this text), The Specialist (reviewer), The Shield (masks secrets in session output), The Dashboard (`/health`, `/status` and Railway logs in a pane).
- **The `midas-a7-specialist:a7-reviewer` agent** reviews every diff before the owner sees it (rule 12). Check each of its findings against the code before acting on it.
- **The owner** approves flow changes and every paid run, merges, deploys, sets or rotates variables, deletes and switches engines. Go 1 and Go 2 are always the owner's.

## Hard stops (CLAUDE.md is the full list)
- No paid call without the owner's go and a stated cap.
- Never retry the image call; never resend an uncertain outcome.
- Flow changes only as patches in `tools/n8n_to_flow.py`, never by editing `src/midas_a7/flows/`. Keep `tests/py/test_replay_run_1591.py` matching unless the change is deliberate and said so.
- No secrets in files, commits, logs or chat. Report variable names only.
- Do not merge, deploy, delete, publish or switch an engine yourself. Ask the owner.
- If a safety check refuses a step, do not work around it.
- Claims need evidence: a commit, a test result, a run or execution id.

## Session reminders
- **Railway.** The owner reconnected the connector on 22 Oct; a session started before that does not see the Railway tools and falls back to `curl` on `/health` and `/status`.
- **Netlify.** Deploy previews are cancelled for docs-only PRs. That is expected.
