# Midas A7: overlapping-sends test (22 Oct 2026)

Written by Claude. **Built and tested locally. Not deployed.** This closes the item the reviewer deferred in Phase 0: a test of overlapping sends through the send gate the site uses, with the real database queries, not only the queries one by one. The test repeats the handler's steps around the gate rather than calling the whole handler (which needs sign-in, the source check and stored photos); where the handler places the gate is checked from its source.

## What changed

| Change | Where |
|---|---|
| The send gate (a send may call A7 only after it moves the saved version from `confirmed` to `sending`) and the handling of a send that fails before leaving the site moved out of the handler into a small library. Behaviour, status codes and messages are unchanged | `lib/claude-a7-send-gate.mjs`, `netlify/functions/owner-actions.mjs` |
| New test: eight overlapping sends of one version run through the gate on the local database emulator; exactly one calls A7, the others get `send_in_progress` and release their claim. A send that confirmed and took its claim, then failed before its gate while another send is `sending`, reopens nothing, releases its claim and answers `not_sent_check_jobs`; with no other send it reopens the draft and answers `not_sent` | `tests/claude-overlapping-sends-handler.test.mjs` |
| Source-order checks updated for the moved gate | `tests/claude-send-failures.test.mjs` |
| Note on where the gate lives | `OWNER_ACTIONS.md` |

All paths are in `claude-outputs/claude-midas-a7-owner-workspace/`. No flow, engine or paid call is touched.

## Verified (locally)

- `npm test`: 397 passed, 0 failed, 1 skipped.
- `npm run build`: passes.
- Mutation checks (each made, run, then restored): with the gate removed, the eight-sends test fails (8 calls to A7 instead of 1); with the `confirmed` condition removed from `reopenUnsentDraft`, the failed-send test fails. No test hangs: waits stop after 2 seconds.
- An independent review (`midas-a7-specialist:a7-reviewer`) found the failed-send test first stopped at the early draft check and never reached its case; fixed, and the review's other three points addressed.

## Not verified

- Nothing is deployed; no live send was made.

## Owner actions

Review and merge the PR when you are ready. It does not need to wait for the supervised run, and the run does not need it.
