# Midas A7: test harness past Go 1 (22 Oct 2026)

Written by Claude. **Tests only.** No flow, engine or site behaviour changes, and no paid call. This extends the Phase 1 test harness (PR #88) past Go 1, so Phase 1 items 1.2, 1.3 and 1.6 can be tested on whole runs (`claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md`).

## What changed

| File | What changed |
|---|---|
| `tests/py/claude_a7_harness.py` | Run 1591 ends at Go 1, so past it the harness now makes up its answers (stand-ins): a budget permit and a settlement for every paid step after Go 1; a stand-in image for each image call; a passing blind count; a passing review for the white master or a scene (an Anthropic call reserved as a stage 16 step; the plan critic keeps its run 1591 answer); an in-stock Midas page for each planned piece. A test can replace any of them. New helpers: `to_go2()`, `to_scene_go2()`, `delivered(...)` (reads a delivered file through its signed link), `image_calls()`, `reserves()`, `image_requests`. `submit()` takes a vendor photo. |
| `tests/py/test_claude_phase1_past_go1.py` | New tests past Go 1 (below). |
| `docs/technical/claude-build-test-deploy.md` | The test list now describes both baseline files. |

**One harness fix.** Before this change, a call nobody answered raised an error inside the stand-in network. The engine caught that error and turned it into a hold or a skipped step, so the test could still pass. That is how the Midas page reads went unnoticed at first. Now every unanswered call is recorded, and the test fails when the service stops. The existing baseline tests still pass with this check, so none of them had an unanswered call.

## What the new tests show (mocked; nothing paid)

**Kept by Phase 1 (plain tests):**
- After Go 1 there is exactly one image call. Every provider call has its own budget reserve before it (`15g Send to Google`, `16x Blind count`, `16 Critic review`). Go 2 offers approve, stop or repair, and a passed review is called "not an approval".
- Approving the white master produces the package: 1125×1125 JPG and WebP. The first scene then reaches its own Go 2 after three image calls (white master, empty room, placement), with no retries. The planned pieces are read on their Midas pages, and the placement request carries the approved master.
- An uncertain image outcome holds with "not sent again", and the image call is made once. This was tested two ways: no answer, and HTTP 503 without a request id (rule 22).

**Gaps, as they behave today (`test_today_*`), each with a strict expected failure:**

| Item | Today | Expected failure, passes when fixed |
|---|---|---|
| 1.2 (FL-4) | A package that holds (here: a grey halo in the saved WebP) offers no decision (`allowed: []`). A decision is rejected (409), and no scene starts | The held package opens a Go 2 decision that includes Stop. This works for any wording of the choices. The package hold is checked on the package record, not on the run's status, so the test can pass once 1.2 opens Go 2 |
| 1.3 (FL-5) | A white master at 90% is delivered at 90.6% on the 1125 JPG. Rule 20's 76% is not enforced | The delivered file spans 76 ± 3 points. The tolerance is the design's proposal and is still your decision |
| 1.3 (FL-5) | When the review fails `whole_in_frame` and you approve anyway, 18e3 fits the cut-off product (`white_clean.fit.done = true`) and delivers it as a ready package (`white_package_ready`) | Nothing is delivered. The hold names the cut-off, the product is never fitted, and no other image call is made (rule 17). This does not depend on the run's status, so it holds whether 1.2 or 1.3 lands first |
| 1.6 (FL-10) | A 2.8 MB vendor photo plus a 2600 px, 19 MB room is about 22 MB, above the 14 MB limit. The scene holds with "Resizing is not built" after the room was made (and, in a real run, paid) | The placement reaches the scene's Go 2 and still carries the approved master. The room is above 2048 px, so a fix that shrinks only larger images (the proposed 2048 px) satisfies the test |

## Review
An independent review (the `a7-reviewer` prompt, run as a separate read-only agent because the agent type is not registered in the cloud session) found:
- the 1.2 test could never pass, because it required a run status that the fix removes;
- the 1.3 cut-off test depended on the run status and accepted any hold;
- the 1.6 test would not pass with a fix that shrinks only images above 2048 px;
- the 76% test had a thin margin;
- the review stand-in was chosen by prompt words;
- the budget test did not show "first".

All six were checked against the code and fixed. Each expected failure was then run with `--runxfail` and fails on the gap it names.

## Verified (locally, on `Claude-final-midas-a7` from `main` at `3d35328`)
- `python -m pytest -q` (after the review fixes): 228 passed, 2 skipped, 7 xfailed. Before this change: 220 passed, 2 skipped, 3 xfailed.
- `ruff 0.8.4` on `src tests/py tools/n8n_to_flow.py tools/extract_prompt_catalog.py`: clean.
- `midas-a7 check`: all node types handled.
- `python tools/n8n_to_flow.py`, then `git diff --exit-code -- src/midas_a7/flows src/midas_a7/data`: identical.
- All 21 `node`/`python3` steps in `.github/workflows/a7-guidance.yml`: pass.
- `tests/py/test_replay_run_1591.py` is unchanged and passes.

## Limits
- The stand-in answers are made up, not recorded. They show that the flows accept answers in this shape. They say nothing about what the models would really return. The image is a blurred light grey block, chosen so the package's grey-halo check passes at any width from 60% to 90%. Spans are measured at the middle of its blurred edge, so the blur does not widen the reading. A sharp dark block (`sharp=True`) makes the package hold.
- Midas pieces get no catalogue photos here, so the placement carries three images: vendor photo, master and room.
- The new file adds about 2 minutes to the Python test run (the full run took 170 s), mostly real package and scene image work on 2048 px files.

## Owner actions
Review and merge when ready. Nothing here needs a deploy or a paid call.
