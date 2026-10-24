# A7 edit path tests (edit phases 2.4 to 2.6)

`edit_path.test.cjs` runs the Code nodes of the **published** main A7 workflow on a saved edit of an owner-approved image. It uses mocked node outputs: no network, no AI call and no paid call. CI runs it in the `guidance-and-release` job:

```bash
node --test tests/claude-midas-a7-edit-phase-2/*.test.cjs
```

## What it covers

| Node | Checked |
|---|---|
| 01 Intent & scope | An edit keeps at most two options and makes one image. A base from another run is refused. |
| E2 Edit base | Checks the approved image against the earlier run: owner approval with checksum, same product photo, white master, scene ticket. Holds when the file or checksum differs. With `props = Remove all`, checks no stock. |
| 19a Scene ticket | Each option type becomes an edit of the approved image, with the right view, light and Midas pieces (`Fewer` keeps one, `Remove all` none). |
| 13 Compile | Keeps everything in the approved image except what the edit names. Camera, framing and light stay unless an option changes them. Covers lighting, wall, floor, camera, props and defect. |
| 12 / 16a | Go 1 offers approve or stop only. The review gets the approved image as image 4 and asks `unchanged_from_base`. |
| 16b Review verdict | A failed `unchanged_from_base` fails the image, which still goes to the owner at go 2. |
| V1 + E2 | An edit of an edit starts from the child run's approved image, with the original white master. |
| Jobs without an edit base | Intake, white-only plan, scene tickets, the series-image and placement prompts, and the review ticket equal `fixtures/non_edit.json`. That fixture was written by the node code from before phase 2.4 and checked equal to the live output on 19 Oct 2026. |

## The workflow snapshot

`n8n/claude-midas-a7/live/workflow-1cgZc9rmBOrPdKIe.json` is main workflow version `fb783f15` (2.4 plus the per-site budget routing), published 19 Oct 2026. It is version `56a75cc0` plus the 26 budget URL changes, which `get_workflow_versions_diff` confirmed. The first test fails if the file is not that version.

The older `n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json` (`eefd6c42`) stays as it is: the budget suites install their guards onto that pre-guard copy.

After you publish a new main version:
1. Save the new version to the live file.
2. Update the version id in the first test.
3. Run the suite.

Regenerate `fixtures/non_edit.json` only for a deliberate change to jobs without an edit base, and say so in the commit.

## Paid checks (owner)

One real edit per option type. Each starts from an image the owner approved in a finished job: in **Saved work**, open the version and choose **Edit this result**. Choose one option, save, estimate, send, give go 1 and check the result at go 2. Each run makes one paid image call plus the review. The estimate is shown before you send.

| # | Option | Value | At go 2, check |
|---|---|---|---|
| 1 | Lighting | Warm evening | Windows dark, warm room light. Room, pieces and camera unchanged. |
| 2 | Wall colour | Sage | Only the walls changed. |
| 3 | Floor | Marble | Only the floor changed; the rug as before or gone with the floor. |
| 4 | Camera view | 45° right | New angle of the same room, pieces and light. |
| 5 | Props | Fewer | One Midas piece kept, the others gone, nothing else moved. |
| 6 | Props | Remove all | Only the product and the room. |
| 7 | Fix a defect | Name one visible defect | The defect is fixed; the product still matches the vendor photo. |

For every run:
- The product matches the vendor photo.
- The review shows `edit_applied` and `unchanged_from_base`.
- The job's cost stays within the estimate.

Record each job id and verdict in the PR or a reply.
