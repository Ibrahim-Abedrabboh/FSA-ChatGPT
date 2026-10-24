# Midas A7, BE-6 PR A: file links get their own secret (22 Oct 2026)

Written by Claude for the owner. This is step 1 of the BE-6 plan you approved (`claude-outputs/claude-midas-a7-be-6-file-links-proposal-2026-10-22.md`). Steps 2 (links that expire) and 3 (cut-off for old links) are separate PRs and come later, one at a time.

## What changes

- **A new optional variable, `FILE_LINK_SECRET`.** You set it on Railway yourself. I never see or ask for its value.
- **While it is not set, nothing changes.** File links are signed exactly as before, with `RESUME_SIGNING_SECRET`, byte for byte.
- **Once it is set:**
  - New file links are signed with `FILE_LINK_SECRET`.
  - Links made before (signed with `RESUME_SIGNING_SECRET`) still open, so the site keeps showing images of older runs.
  - Resume links (Go 1, Go 2) keep using `RESUME_SIGNING_SECRET`. Rotating that secret no longer breaks the new file links.
- **`/health`** now shows `configured.fileLinkSecret: true` or `false`. It never shows the value.
- **The Shield** (session redaction) now also masks `FILE_LINK_SECRET` values.

What it does not change: no flow file, no Code node, no paid call, no budget rule, Go 1 and Go 2 unchanged. Links still never expire; that is PR B.

## Review

An independent review (the `a7-reviewer` prompt, run as a separate read-only agent) found the change ready, with four points. All four were checked against the code:
- A start-up warning still said file links break after a restart when `RESUME_SIGNING_SECRET` is unset. That is no longer true once `FILE_LINK_SECRET` is set. Fixed.
- The same sentence in `docs/technical/claude-python-service.md`. Fixed.
- Without the runtime, the resume secret was tried before `FILE_LINK_SECRET`. Only tests are affected, but the order is fixed and has a test.
- The view still accepts resume-signed links while `FILE_LINK_SECRET` is set. This is intended until the PR C cut-off.

## Files

| File | Change |
|---|---|
| `src/midas_a7/config.py` | Reads `FILE_LINK_SECRET`; `/health` flag |
| `src/midas_a7/runtime.py` | Chooses the file-link secret at start and the list of secrets the view accepts |
| `src/midas_a7/nodes/google_drive.py` | Signs with the file-link secret; `accepted_secrets()` |
| `src/midas_a7/app.py` | `/files/<id>/view` accepts a link signed with any accepted secret, else 404 |
| `tests/py/test_claude_file_link_secret.py` | Six tests (below) |
| `tools/claude-mods/midas-a7-shield/hooks/redact.ts`, its README | Masks the new variable |
| Runbook, `docs/technical/claude-python-service.md`, `docs/technical/claude-architecture.md`, briefing | Variable documented; status |

## What was verified (22 Oct 2026, in this container)

- New tests, all pass: without the variable the link is identical to the old one; with it, new links use it, old links open, a wrong or missing signature gives 404; after a restart with a rotated `RESUME_SIGNING_SECRET`, links made with `FILE_LINK_SECRET` still open; resume links keep the resume secret; `/health` shows the flag and never a value.
- Full Python suite: 241 passed, 2 skipped, 6 xfailed (`python -m pytest -q`). This includes `test_replay_run_1591.py` (parity unchanged; no node changed) and the existing `test_file_store.py`.
- `ruff` 0.8.4: clean. `midas-a7 check`: all node types handled. Regenerating the flow packages gives no diff.
- All 21 A7 suite steps from `.github/workflows/a7-guidance.yml`: pass.
- The Shield rule was checked directly (`FILE_LINK_SECRET=…` and `"FILE_LINK_SECRET": "…"` both masked). The Shield's own test file could not be run here: it needs the Claude Code mod package, which is not installed in this container (it fails the same way on `main`).

Not verified: anything on Railway. Nothing was deployed and no variable was set.

## What you do, after you merge it

1. Deploy as usual, when no run is active.
2. Then, also when no run is active, set `FILE_LINK_SECRET` on Railway (Raw Editor, a long random value). Setting it redeploys the service.
3. Tell me, and I will check `/health` shows `fileLinkSecret: true` and that an older run's image still opens on the site.

You can also leave it unset for now; nothing changes until you set it.
