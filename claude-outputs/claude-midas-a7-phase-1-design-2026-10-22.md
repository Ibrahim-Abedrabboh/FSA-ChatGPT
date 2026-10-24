# Midas A7, Phase 1 design proposal: let a job reach the end (22 Oct 2026)

Written by Claude for the owner. **This is a proposal. No code is written for any item until you approve it.** Every item changes flow or engine behaviour, so rule 3 needs your go for each one. You can approve items one at a time.

The plan this comes from is `claude-outputs/claude-midas-a7-audit-and-automation-plan-2026-10-21.md` (section 4, Phase 1). The IDs (FL-…) come from that plan. Line numbers below are from `main` at `316a776`.

## How every item is built (same for all)

- **Flow changes** are patches in `tools/n8n_to_flow.py` (`PATCHES`, `NODE_PATCHES`, `SETTINGS_PATCHES`), each with its reason in the manifest. Generated files in `src/midas_a7/flows/` are never edited by hand (rule 6).
- **Parity:** `tests/py/test_replay_run_1591.py` must keep matching. Where an item deliberately changes a node that run 1591 passes through, the PR says so and updates the replay test on purpose (rule 7).
- **One draft PR per item.** Each has tests with mocks or pinned data, no paid call, a dated README, and a review by `midas-a7-specialist:a7-reviewer` before you see it.
- **The supervised run comes first.** I suggest starting Phase 1 only after the USD 3.00 run, because its result may change the order (for example, if the white framing holds again, 1.3 moves up).

## Summary

| # | What it fixes | Where | Size | Changes run 1591's path? | Paid test? |
|---|---|---|---|---|---|
| 1.1 | A crash ends a run silently (FL-1) | Engine (Python) | M | No | No |
| 1.2 | A held package blocks scenes and edits (FL-4, FL-15) | Flow patches + owner site | M | No | No |
| 1.3 | Fit-on-white can hide a cut-off product; 76% not enforced (FL-5) | Flow patch, `18e3` | M | Yes, if run 1591 reached 18e3 | No |
| 1.4 | Crop rule only partly enforced (FL-6/7/8) | Flow patches + reader prompt | M | Yes | **Yes, about USD 1** |
| 1.5 | Image model hard-coded; other job ids crash (FL-12, FL-2) | Flow patches | S | No | No |
| 1.6 | Scene request can exceed the size limit (FL-10) | Engine helper + flow patch | S | No | No |
| 1.7 | Holds have no "Continue" (FL-9) | Flow patches + owner site | M | No | No |

Suggested order: **1.1 → 1.5 → 1.2 → 1.3 → 1.6 → 1.7 → 1.4.** 1.1 first, because every later item is easier to test when a failure shows as a hold. 1.4 last, because it is the only one with a paid test.

---

## 1.1 Any error ends as a recorded hold (FL-1)

**Problem.** When a node throws, the engine marks the execution `error` (`src/midas_a7/engine/executor.py:196-201`) and stops. Nothing writes to the "Claude Midas A7 runs" table that the site reads, so the job page keeps showing the last status (for example "Go 1 given") forever. 150 of 151 Code nodes have no error path.

**Proposal.** One engine-level rule, not 150 node patches:
- When an `a7_main` execution ends in `error`, the engine finds the run's `run_id` (from the state item the failing node received) and updates that run's row: `status='hold'`, `hold_for='owner'`, `hold_reason='Stopped at <node>: <short reason>'`.
- The reason is cut short and passed through the same redaction as the logs (no `sig=`, no keys).
- If no `run_id` can be found, or the row update fails, the engine logs it with `[run <id>, <flow>]` and `/status` still lists the failure. It never retries a paid call.
- The rule is a setting on the flow (`SETTINGS_PATCHES`: `holdOnError`), so it applies only to the flows you choose (proposed: `a7_main` only).

**What it does not do.** It does not resume the run. "Continue" comes in 1.7.

**Tests.** A mocked run that throws in a `Budget_*` node shows `hold` with the node name on the row. A throw with no `run_id` logs and does not crash. The replay test is unchanged because run 1591 has no error.

**Decision for you:** approve the rule, and confirm `a7_main` only.

## 1.2 A held package gets a Go 2 decision (FL-4, FL-15)

**Problem.** `18p_Package_result.js:54-66` holds when the package is incomplete. "Scene due?" never accepts `hold`, and `E2_Edit_base.js:31-40` holds an edit with no ready white package. The only resume path is a webhook hard-wired to one run from 18 Oct. So run `4f80c2bf` can never reach scenes.

**Proposal.**
- A package hold opens a Go 2 ticket with three choices: **Deliver as exception** (you accept the package as it is, recorded as your decision with the problem text), **Regenerate** (counts as a repair, so the two-repair limit still applies, rule 16), **Stop**.
- "Deliver as exception" sets the package to `white_package_ready` with an `exception` note. Scenes and edits then accept it. A passed review is still never an approval (rule 15): only your recorded choice moves it on.
- Retire the 18 Oct one-off recovery webhooks (`Package · Webhook` and its siblings). **Retiring them is a deletion, so it needs its own yes.**

**Owner site.** The Go 2 screen shows the package problem and the three choices. The existing allowlist and the Phase 0 rule (no Approve without an image you can open) still apply.

**Tests.** Mocked run: package hold → Go 2 → "Deliver as exception" → scenes start. "Regenerate" twice → third time holds.

**Decisions for you:** approve the three choices and their wording; approve retiring the one-off webhooks.

## 1.3 Fit only a whole product; enforce 76% on delivery (FL-5)

**Problem.** `18e3_Clean_background.js` scales the product to `FIT_SPAN_PCT` (76%, line 33). If the product is really cut off, the scaled master is a cut-off sofa marked "ready". A master at about 85–95% that clears the edge guard is delivered unchanged, so rule 20's 76% is not enforced on delivery. Run `4f80c2bf` held at 97.6%.

**Proposal.**
- Fit only when the review records the product as whole (no crop flag, product box inside the margin). Otherwise hold with a plain reason. Never scale a cut-off product (rule 17).
- After fitting, measure the longest side again and deliver only within **76% ± 3 points** (the tolerance is a setting in `04_Settings.js`; 3 is my proposal). Outside it, hold.

**Tests.** Pinned fixtures: a whole wide set is fitted to 76%; a cut-off product holds; a master at 90% is fitted, not delivered unchanged. If run 1591 passed through 18e3, its replay output changes, and the PR says so.

**Decision for you:** approve the rule and the ±3 tolerance.

## 1.4 One reader prompt with boxes; checks on the confirmed path; a code-only crop rule (FL-6/7/8)

**Problem.** Rule 17 is only partly enforced:
- The preview site's confirmed-photo path skips the 04–06 checks.
- The photo-check prompt (v3) returns no boxes, so a false crop flag cannot be cleared.
- The job prompt does not ask for the fields the code reads.
- A product box at the frame edge alone never holds.

**Proposal.**
- Use one reader prompt for both paths. Candidate: rt4, which scored 10/10 on the reader test sheet; it returns product boxes.
- Run the 04–06 checks on the confirmed path too.
- Add a code-only crop rule: a product box within the edge margin holds, whatever the model says (rule 14: code decides).

**Paid test.** The reader test sheet must reach at least 9 of 10. This is a paid run, **cap about USD 1.00**, and needs your go when we get there.

**Decisions for you:** approve the design now; approve the paid test separately later.

## 1.5 Allowed image model from the registry; job-id forms (FL-12, FL-2)

**Problem.**
- `Budget_15g_Ticket.js:65` and `:71` hard-code `gemini-nano-banana-2.1`. Choosing any other approved model in the registry throws `image_call_policy_mismatch`.
- `Budget_15g_Ticket.js:9` (and every `Budget_*_Ticket.js`) accepts only `owner-<uuid>` client ids. Client-page jobs and test senders crash at their first paid call.

**Proposal.**
- The ticket reads the model that `14_Choose_model.js` picked (already checked there against the registry, `approved` only) and checks the request against that model's registry row. The other policy checks (token limit, no tools) stay.
- For job ids, I recommend **refusing at intake (step 01) with a clear reason** rather than widening the ticket check. That keeps the budget identity rule strict and stops non-owner jobs before any paid call. Client-page jobs stay unsupported until the client page has a result address (audit 3.5, item 10).

**Tests.** A run with a second approved model id builds a matching ticket. An unknown id is refused. A `client-…` job holds at 01 with a reason, before any reservation.

**Decision for you:** approve; choose "refuse at intake" (recommended) or "accept more id forms".

## 1.6 Resize scene references below the request limit (FL-10)

**Problem.** `19g_Scene_references.js:62-70` drops the white master when the images are over the request cap, then holds if they are still too large: "Resizing is not built". The Test 8 photo alone is 6.8 MB, and base64 adds about 33%.

**Proposal.** Resize references in code, never with AI (rule 19's spirit): before dropping anything, shrink the room and Midas-piece photos to a long side of 2048 px (JPEG quality 90), then the vendor photo only if still needed. Each resize is recorded in the scene notes with the old and new size. The vendor photo is never cropped.

This needs a small engine helper, because the Code-node runner has no image library (its only dependency is `luxon`). The service already depends on Pillow (`pyproject.toml`), so the helper uses it, and the flow calls it through a patch.

**Tests.** The 6.8 MB Test 8 photo plus a room fits under the cap without dropping the master; the order of shrinking is checked.

**Decision for you:** approve; confirm 2048 px.

## 1.7 "Continue" for budget and timeout holds; Go 2 at attempt 3 (FL-9)

**Problem.** Every hold ends the run with no way to continue: gate timeouts (a paid image is thrown away), budget holds, uncertain images, scene holds. A failed attempt 3 holds without opening Go 2.

**Proposal.**
- **Budget hold → Continue:** offered only after you raise the job budget on the site. The run resumes at the held step with a new reservation.
- **Gate timeout → Continue:** reopens the same Go 1 or Go 2 ticket with the image already made. Nothing is generated again.
- **Uncertain image outcome:** no Continue. Rule 22 says it is never resent; you only get Stop or "Check manually".
- **Attempt 3 failed:** opens Go 2 with the best attempt and its review, choices Approve as exception or Stop. No fourth repair (rule 16).

**Tests.** Mocked runs for each case, including a check that an uncertain image outcome never offers Continue.

**Decision for you:** approve the list of holds that get Continue.

---

## What I need from you

1. After the supervised run: confirm Phase 1 starts, in the suggested order or yours.
2. For each item, a yes, a no, or changes. The open choices are:
   - 1.1: `a7_main` only.
   - 1.2: the wording of the three choices, and retiring the 18 Oct webhooks (a deletion).
   - 1.3: ±3 points.
   - 1.5: refuse at intake.
   - 1.6: 2048 px.
   - 1.7: which holds get Continue.
3. Later, separately: the USD 1.00 reader test for 1.4.

## Not covered here

Phase 2 (a durable engine: runs survive a restart, BE-1), Phase 3 (automation around Go 1 and Go 2) and Phase 4 (cleanup and security) are in the audit plan and are not part of this proposal.
