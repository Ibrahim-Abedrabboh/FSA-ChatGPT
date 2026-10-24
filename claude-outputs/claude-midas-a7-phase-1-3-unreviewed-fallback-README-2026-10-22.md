# Midas A7, Phase 1.3 follow-up: images approved without a review (22 Oct 2026)

Written by Claude for the owner. You chose this in "go with the order" on 22 Oct (step 1). It changes flow behaviour on the Python service, so it waits for your review and merge. Nothing is deployed.

## The gap
Since Phase 1.3, a white image is fitted to 76% only when a review of that exact image found the whole product in the frame. An image you approve **without a review** has no such result. That choice is offered only when the reviewers did not answer twice. So if the image needed fitting, the job held and could not go further.

## What changes
When there is no review result, the package step uses **the same code test the review itself uses** (decision D6), applied to the blind count's product box:

| The blind count's box | Result |
|---|---|
| More than 15 of 1000 from every frame edge, and no "cropped" flag | Whole: fitted to 76% if needed, as for a reviewed image |
| 15 of 1000 or less from an edge | Cut off: holds with a plain reason, never scaled |
| Safe from the edges, but flagged "cropped" | Unsure: holds, never scaled |

With no box at all, nothing changes: the image is packaged with its own background, as before.

## How it is built
Two patches in `tools/n8n_to_flow.py`, regenerated, with reasons in `manifest.json`:
- `16b Review verdict` keeps the blind count's "cropped" flag beside the box it already keeps, reviewed or not.
- `18a Package ticket` applies the test when no review result exists.

## Verified (22 Oct 2026, dev container, mocked; no paid call)
- Three new tests in `tests/py/test_claude_phase1_past_go1.py`. In both the reviewer never answers, review again is used, then approve by eye:
  - a safe box at about 90% is fitted, and the delivered JPG measures 73–79%;
  - a box at the edge holds as cut off and is never fitted;
  - a safe box flagged "cropped" holds as unsure and is never fitted.
- `python -m pytest -q`: 258 passed, 2 skipped, 2 xfailed. The run 1591 replay is unchanged (it never reaches the review).
- ruff 0.8.4 clean; `midas-a7 check` reports all node types handled; regenerating the flows gives no diff; all 21 A7 suite steps pass.

## Review
An independent read-only review found three points, all checked against the code and fixed:
- The fallback now applies only when the review step recorded the flag beside the box. A box from the older 18 Oct recovery path, which has no flag, stays "unknown" and holds. The Python service does not serve that path, but the guard costs one line.
- A test for the flagged (unsure) case was added.
- The pipeline and status pages now mention the unreviewed case.

## What you do
Review and merge, then deploy when no run is active.
