# Midas A7, Phase 1.2: a held package gets a Go 2 decision (22 Oct 2026)

Written by Claude for the owner. You said yes to 1.2 on 22 Oct ("fix the docs, then start 1.2"). This changes flow behaviour, so it waits for your review and merge. Nothing is deployed.

## The problem it fixes (FL-4)
On run `ff0aa7e5` you approved the white image. The package then stopped on 2 background pixels at 249 of 255 in the WebP file. A held package ended the run: no decision, no scene, no way to go on.

## What changes
When the package stops **only on the background rule** (the edge rows or a grey halo in a saved JPG or WebP), the run now waits at Go 2 with three choices:

| Choice (button on the site today) | What happens | Paid? |
|---|---|---|
| **Deliver as exception** ("Approve") | The package is made again from the same approved image, in code. The files are delivered as they are, and the problem is recorded with your note. The release is marked "owner exception" and never counts as a reviewed catalogue release. Then the scenes start. | No |
| **Make a new image** ("Repair") | One new image call and a new review, then Go 2 again. It counts as one of the two repairs. | Yes, one image call (about USD 0.13 with its review, as on 22 Oct; an estimate) |
| **Stop** | The job ends. No package is delivered; the approved white image is unchanged. | No |

What stays the same:
- Any other package problem (the file changed, the wrong size, already packaged, storage failed) is still a plain hold.
- No answer in 24 hours still holds.
- A passed review is still never an approval, and only your choice moves the job on.
- The 18 Oct one-off recovery webhooks are untouched. Retiring them is a deletion, so it needs its own yes.

**Not in this PR:** the site's button still reads "Approve"; only the text above the buttons explains the choice. Renaming the buttons to the prototype's wording is an owner-site change, best done with the job-page redesign.

## How it is built
Flow patches in `tools/n8n_to_flow.py`, regenerated, with each reason in `src/midas_a7/flows/manifest.json`:
- `18h Check files` records when only the background rule failed. With your exception, it delivers such a file and records the problem.
- `18p Package result` opens the Go 2 ticket (the package problem, the approved image, the choices) instead of holding. With an exception, it records it, and the release is never catalogue-eligible.
- `18a Package ticket` carries your exception only when it is bound to the same image and the same locked contract.
- `G2 Go 2 verdict`: Approve on a package ticket means deliver as exception. Repair and Stop use the existing paths.

## Verified (22 Oct 2026, in the dev container, mocked; no paid call)
- New tests in `tests/py/test_claude_phase1_past_go1.py` (all pass), on the mocked service with a stand-in image that has a grey halo:
  - the held package opens Go 2 with approve, stop and repair, with the image link, and no paid call;
  - Deliver as exception delivers both files with the exception recorded, then the first scene reaches its Go 2. That makes 3 image calls in all (white, empty room, placement), each reserved first;
  - the release is never `reviewed_owner_approved` and never catalogue-eligible;
  - Repair makes exactly one new image and returns to Go 2 (round 2);
  - Stop ends the job with no new call.
  - A package problem other than the background rule (a master smaller than 1125 px) stays a plain hold, with no choice offered.
  - The exception does not carry over to a repaired image: its package is checked again and asks again, with its own problem.
  - The audit record of "deliver as exception" carries the exception, not the white image's release label.
- The "today" test and the xfail marker for this gap were removed, as the harness requires.
- `python -m pytest -q`: 247 passed, 2 skipped, 5 xfailed (after the review fixes). The run 1591 replay is unchanged (it never reaches the package).
- ruff 0.8.4 clean; `midas-a7 check` reports all node types handled; regenerating the flows gives no diff; all 21 A7 suite steps pass.

**Not verified:** a real run. The next paid run (white package plus one scene, your go and cap) is the live check.

## Review
An independent read-only review (the `a7-reviewer` prompt, run as a separate agent) found five points. All were checked against the code:
1. **Fixed.** When packaging ran a second time in the same run, the package result could read an earlier attempt's checks and show an old problem. It now uses only results made from that attempt's own ticket.
2. **Fixed.** A JPG whose quality-100 retry failed for a different reason could still be offered as an exception, under the wrong problem. Now only a file whose last try failed the background rule is offered, and that rule problem is what is recorded.
3. **Fixed.** The audit record of "deliver as exception" repeated the white image's release label. It now records the exception instead.
4. **Fixed.** Tests were added for a non-rule hold and for a repaired image.
5. **Not in this PR, as above.** The site still labels the decision "Approve image". The approval context does not yet pass the ticket kind to the site.

## What you do
Review and merge, then deploy when no run is active.
