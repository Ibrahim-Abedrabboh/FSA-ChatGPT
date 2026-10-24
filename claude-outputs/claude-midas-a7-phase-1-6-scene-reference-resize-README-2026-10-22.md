# Midas A7, Phase 1.6: shrink scene photos that are too large to send (22 Oct 2026)

Written by Claude for the owner. You said "go with the order" on 22 Oct, which covers 1.6. This changes flow behaviour on the **Python service only**, so it waits for your review and merge. Nothing is deployed. The owner site `claude-final-midas-a7` still calls n8n, where nothing changes.

## What it fixes (FL-10)
A room scene is made in two paid image calls: first the empty room, then the placement, where the product is put into that room. The placement sends several photos together in one request: the vendor photo, your approved white master, the room and the Midas pieces. The request has a size limit (14 MB, set in `04 Settings`).

Before this change, when the photos together were over that limit, the scene stopped with "Resizing is not built". By then the empty room had **already been made and paid for**, and it was wasted.

## What changes
When the photos for a placement are over the limit, the step that gathers them (`19g Scene references`) first makes the large ones smaller. Then it checks the size again.

| Situation | What happens |
|---|---|
| The photos fit the limit | Nothing is resized. Every photo is sent exactly as it was received or made, as before |
| Over the limit | Each photo whose longest side is above **2048 px** is shrunk to a 2048 px longest side. This is done in code, without AI. The shape is kept and nothing is cropped. Photos at or below 2048 px are never touched |
| Which photos go first | The room, a side-view photo, the Midas pieces and your approved master. The master is only ever made smaller. At the usual 2K it is already 2048 px and is not touched; a master made at 4K (a brief may ask for it) is shrunk too, and its new checksum replaces the approved one in the scene's list. Within this group the order is the list's order: master, room, side photo, Midas pieces. The vendor photo is shrunk **only if** the others were not enough |
| Still over the limit | As before: the master is left out (the vendor photo still decides the product), and if that is still not enough, the scene holds before the placement call. The hold now says the photos were resized first and are still too large. Nothing is reserved, sent or paid for the placement |

Each resize is recorded with the photo's role, its size before and after (pixels and bytes) and both checksums. It appears in the scene state (`scene.ref_resized`), the scene notes and the run trail. The image call itself is never retried.

The shrunk photo is written as a JPEG at quality 90. A photo with a transparent background is laid on white first, because a JPEG cannot be transparent. The review after the image still compares the result with the vendor photo and side photo **as you sent them**, not the shrunk copies. The Midas photos and, for an edit, the base image it reviews against are the copies this step sent, resized or not.

Very large files are not opened: a photo above 50 million pixels is left as it is (so it can still hold the scene as too large), because opening it could take most of the service's memory.

Design choices you approved: resize in code, never with AI, and 2048 px. One addition: the design note listed the room and Midas photos first, then the vendor photo. I also put the master and a side-view photo in the first group, because neither one decides the product.

## How it is built
- **Why an engine helper.** The flow's code steps run in a small JavaScript runner that has no image library. So they cannot shrink a photo themselves. The service already shrinks images for the n8n "Edit Image" step with Pillow (`src/midas_a7/nodes/edit_image.py`). I reused that resize.
- **Why not an extra Edit Image step.** Adding that step would mean new steps and new wiring in the flow. The flow-patch tool can only change code and step settings, not add steps. It would also need one step per photo. A helper is the smallest change.
- **How it works.** `src/midas_a7/nodes/claude_reference_resize.py` does the resize. The JavaScript runner and its Python client (`runner.mjs`, `jsrunner.py`) now let a code step ask the engine for a helper while it runs, and wait for the answer. Only plain data goes back and forth. The Code-node handler (`nodes/core.py`) gives the helper only to a step that uses it.
- **Where the flow changes.** The `19g` change is three patches in `tools/n8n_to_flow.py` (`PATCHES`), regenerated, with each reason in `manifest.json`. No generated file was edited by hand. `19g` checks that the helper exists; if it is missing (as in n8n), it holds as before.

## Verified (22 Oct 2026, dev container, mocked; no paid call)
- `tests/py/test_claude_phase1_past_go1.py`, the FL-10 tests (all pass):
  - A 2.8 MB vendor photo (980 px) plus a 2600 px, 19 MB room. The room is shrunk to 2048 × 2048 and the placement is sent with the master. The vendor photo and the master go out byte for byte unchanged. Three image calls are made, none repeated. The trail names the resize.
  - When the photos fit, all three placement photos are sent untouched, and nothing is recorded as resized.
  - With the limit set to 8 MB for the test, the room is shrunk and the master left out, and it is still too large. The scene holds before the placement: two image calls, no budget reserved for a third, and the trail names the resize.
- The "today" test for FL-10 was replaced, and the expected-failure marker was removed.
- New `tests/py/test_claude_reference_resize.py` (11 tests):
  - photos at or below 2048 px are left as they are;
  - wide and tall photos keep their shape;
  - transparency becomes white, and the camera's rotation flag is applied before measuring;
  - a file that is not an image is left alone;
  - the helper works when a code step calls it, and a failing helper reaches the step as an error it can handle.
- `python -m pytest -q`: **272 passed, 2 skipped, 1 xfailed**. The run 1591 replay is unchanged (that run ends at Go 1).
- ruff 0.8.4: all checks passed. `midas-a7 check`: all node types handled (exit 0). Regenerating the flows gives no diff. **All 21 A7 suite steps** in `.github/workflows/a7-guidance.yml` pass.

## Not verified
- A real scene. The tests use made-up images (random noise, which does not compress).
- The Docker build: no Docker daemon in this container. CI builds it.
- The size of real photos after shrinking. A 2048 px photo of random noise is about 6.5 MB as a JPEG. Real photos are much smaller.
- Two Code nodes calling the helper at the same moment. Each answer carries the number of the request that asked, so they cannot cross; there is no test that runs two at once.
- `15f Build request` still says "Resizing is not built" in its own size check. That check is now reached only if `19g`'s byte count were wrong; the wording is not changed in this PR (it would be one more flow patch).

## Review
An independent read-only review (the `a7-reviewer` prompt, run as a separate agent) found the flow patch correct and listed five points, all checked against the code:
1. **Fixed, was blocking.** If a code step hit the 300 s time limit while a resize was still running, the runner restarted, and the late answer could reach the new runner. The new runner numbers its requests from 1 again, so the answer could land in another run's step: in the worst case another job's photo in a paid placement. The answer now goes only to the runner process that asked. A new test reproduces the case; it fails on the old code ("the stopped run" answer arrived) and passes now.
2. **Fixed.** A photo above 50 million pixels is no longer opened (memory). Test added.
3. **Fixed.** New test: a 2400 px vendor photo under 3 MB is shrunk only after the room, and stays image 1.
4. **Fixed in this README.** The master and the order within the first group are described exactly (table above).
5. **Fixed in this README.** Which photos the review compares against is described exactly. The old `15f` wording is noted under "Not verified".

## What you do
Review and merge, then deploy when no run is active. Nothing changes on n8n. A paid room-scene test still needs your separate go and a cap.
