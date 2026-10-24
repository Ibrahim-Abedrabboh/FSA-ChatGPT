# Claude · Midas A7: stage 07 (scene images)

16 Oct 2026, 02:45 Amman. Written by Claude. Built on the owner's answer of 16 Oct, 01:40 ("C then A": catalogue import first, then Scenes).

**Update, 16 Oct 2026, 03:50 Amman.** The owner answered the scene shape and delivery question (03:24 and 03:25). Scene shapes and scene delivery files are now built: see `claude-midas-a7-scene-files-README-2026-10-16.md`. The version numbers below are those of this README's build, not the current ones. Advertising formats are out of scope for this project (owner, 03:24); the notes on them were removed from this README.

Code and exports: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, commit `79a03aa`.

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, version `9acd0525`, 149 nodes.
- **Not published.** It was not published or unpublished in this work.
- **No real run and no paid call.** Every test used pinned or code-made data. No image was made.
- A scene image is a "Generated image". A passed review is a reviewed candidate, not an approval. Only the owner's go 2 approves a scene.
- The Midas accessories catalogue that stage 07 draws from was imported first. See `claude-midas-catalogue-import-README-2026-10-16.md`.

## What stage 07 does

It starts after the white package is ready (stage 06). It makes the job's scene outputs (lifestyle, hero, wide, detail) one at a time, in two steps: the empty room first, then the product placed in that room.

1. **19a Scene ticket** picks the next scene. It holds for the owner if any of these is missing:
   - the scene settings in 04 Settings (`scenes.enabled`);
   - the owner's recorded approval of the white master, with its checksum;
   - the owner's go 1;
   - a locked contract;
   - a checked plan for that scene from go 1.
2. **Empty room** (owner documents: build the room first, then place the product). The room prompt carries the plan's room, the camera and light presets, and nothing else: no product, no props. It goes through stage 04's dispatch: one paid image call. The room is a working image, not a deliverable. It is not reviewed and not shown as a result.
3. **Placement.** 19a moves the same scene to the placement step.
   - **Midas pieces only** (owner, 15 Oct 21:50). The plan's Midas pieces are kept only if they are on this run's checked shortlist, up to 3 per scene. Generic props from the plan are dropped, with the reason recorded.
   - **19b, 19c: live check on midasfurniture.com.** Each piece's own Midas page is read at scene time, one page every 10 seconds. A piece stays only with a clear "in stock" signal on its page. Out of stock, no stock signal, conflicting signals, another SKU on the page, or no answer: the piece is left out and its spot stays empty. The size printed on the page is recorded.
   - **19d, 19d2:** the approved master is downloaded from Drive. Its checksum must equal the approved one.
   - **19e, 19e2:** the room is checked. A room made in stage 07 must match its receipt. A client room photo is used as checked at intake.
   - **19f, 19f2:** each kept piece's catalogue photo is downloaded and checked as an image.
   - **19g Scene references** fixes the image order: 1 vendor photo (the only authority for the product), 2 approved white master, 3 room, 4+ Midas pieces. If the images are too large for one request (14 MB), the master is left out first. If they are still too large, the scene holds. Resizing references is not built.
4. **13 Compile** writes the placement prompt. Among its lines:
   - keep the room exactly as it is;
   - show each Midas piece exactly as its catalogue photo, with its listed size;
   - the exact inventory, colour, identifying details and handedness of the product;
   - "add nothing" else; where the plan had a piece that is not listed, that spot stays empty;
   - scale from supplied dimensions only, otherwise "not confirmed" and a plausible scale;
   - framing, camera height and light preset.
5. **Stage 04** dispatches it (one paid call). **Stage 05** reviews the placed scene with scene checks:
   - piece count, shape, colour, details, handedness, not mirrored;
   - only listed props; the Midas pieces match their photos;
   - scale, grounding, framing, camera level, light, no text or logo, realism.

   A blind count is also made. The background check and the white-background crop rule apply to the white master only. At most two repairs; a repair keeps the room and the Midas pieces. The owner decides at go 2.
6. **Go 2** on a scene: approve records the scene as done and moves to the next one. When every scene is approved, the status is "scenes_complete". Stop and "no answer in 24 hours" behave as for the white master.

### Presets (in 04 Settings)

| Setting | Value | Basis |
|---|---|---|
| Camera height, bedroom | 135 cm | Owner document MI 21–26 |
| Camera height, living room | 110–120 cm | Owner document MI 21–26 |
| Camera height, dining | 130 cm | Owner document MI 21–26 |
| Camera height, other rooms | 120 cm | **Assumption** |
| Camera rules | Level, 0° pitch/roll/yaw, one-point perspective | Owner document |
| Light, day (default) | 4000 K | Owner document MI 23 |
| Light, warm | 3000 K | **Assumption** |
| Light, night | 2700 K | **Assumption** |
| Framing | Hero 60–70% of frame height; wide less; detail more | Owner decision 15 Oct 23:22 |
| Midas pieces per scene | At most 3 | Owner decision (Midas-only props) |

The client's lighting choice picks the preset: "evening", "night" or "dark" → night; "warm", "cosy", "sunset" or "golden" → warm; "day", "bright", "natural" or "morning" → day.

### Other changes

- **07 Route:** the cost estimate now counts one empty-room call per scene (about USD 0.064 each). It is an estimate.
- **10 Retrieve Midas pieces:** the shortlist is ranked by kind for each room type (living, bedroom, dining, chairs, tables, accessories), at most 2 pieces per kind across 12 places. Out-of-stock pieces are never offered. With 428 catalogue rows, this keeps the shortlist varied.
- **18a Package ticket:** the package lists scene images as "made in stage 07 after this package; not in this package". The English description is tidied (see the stage 06 README).
- **15q Stage 04 result** (fix, found in pinned run 433). One run can make several dispatches: white master, room, placement, repairs. When a later dispatch stopped early, 15q read the white master's older receipt and reported the wrong problem and operation key. Now it uses only the receipt of the current compile. A result it cannot match holds, with "paid call not confirmed".
- **V1 Vault events** (fix, found in pinned run 432): a stage 04 record without an orders list no longer stops the run. V1 also records scene events (stage 07, step 19).
- **Runs table** (`l0roUCBwIQL3h9Eq`): new column `scenes`.
- **Groups:** "Stage 07 · Scene images" added; "Stage 06 · Package" rebuilt.

## What was checked, and how

- **Local tests** (they read the Code node files from the repo):
  - stage 07: 83 of 83 pass;
  - stage 06: 56 of 56; stage 05: 58 of 58;
  - the two older suites: 86 of 86 and 37 of 37, run on a scratch copy;
  - model test MT4: 9 of 9.
- **Pinned runs in n8n** (430 to 434). The trigger, the model and Drive nodes, and the operations rows were pinned.
  - 430 and 431: the pin set was wrong (the planner pin had no scene plans), so the run held at stage 03 as designed. Fixed the pins.
  - 432: V1 stopped on a test record without orders. Fixed V1.
  - 433: everything up to the scene references worked. Then the budget guard held correctly, because the test state had no cost estimate. 15q reported that hold wrongly. Fixed 15q.
  - **434 (after both fixes):**
    - the scene went from "room ready" to the placement;
    - the live check kept the cushion (SKU 159304) and left out the rug (SKU 173762, pinned page "Out of stock"), so its spot stays empty;
    - the master, room and photo checks passed;
    - the images were set in order (vendor, master, room, cushion photo);
    - 13 Compile wrote the placement prompt;
    - the budget guard passed;
    - 15e attached all four images;
    - the run then held at 15e, because the pinned reservation returns the white master's key. This is expected in the test. Nothing was sent or paid, and 15q reported its own operation key.
- **Byte check.** A7 was read back from n8n after the last change. All 48 Code nodes match the repo files byte for byte, and the export matches n8n (nodes, connections, groups).

## What was not checked

- A real empty-room call and a real placement call (both paid).
- Whether n8n can read midasfurniture.com product pages live. This shell got "406" from those pages; another reader could read them. In n8n, 19b was pinned.
- Real Google Drive downloads of the master and the room (pinned).
- The 4-image request as built by n8n (15f). The pinned run stopped at the reservation check before it. It is covered by local tests only.
- The empty-room step inside n8n: the pinned run started at "room ready". Covered by local tests only.
- The placement review with the real models, and the quality of the prompts.
- The `scenes` column in the runs table: the pinned run id has no row, so nothing was written to it.

## Assumptions

- Warm 3000 K, night 2700 K and the 120 cm default camera height are not in the owner documents.
- The order of kinds per room type in 10 Retrieve is mine.
- If a request is too large, the master is left out before anything else.
- Every scene's cost estimate counts one room call.
- A client room photo is used as the room without a new empty-room call.

## Not built

- Scene delivery files (resize and package per scene, with the list of Midas pieces and their links). **Built 16 Oct 2026, 03:50 (step 20)**: see `claude-midas-a7-scene-files-README-2026-10-16.md`.
- Restoration or upscale of vendor photos.
- Client page changes for scenes.
- Arabic text.

## Open, for the owner

1. **Older runs' budgets** do not include the room calls. A scene in a run estimated before today may stop at the budget guard. Send those jobs again, or accept the hold?
2. **Scene shape and delivery format.** Answered by the owner on 16 Oct, 03:24 and 03:25, and built. Scenes are 1:1 by default; the client may pick any of the nine shapes A7 offers (1:1, 4:5, 5:4, 3:4, 4:3, 2:3, 3:2, 16:9, 9:16); the white master is always 1:1. A7 reads the shape from the page's `aspect` or from `proportions`. Each approved scene is delivered as jpg and webp at its own shape, short side 1125 px; the 2048-class master is kept; nothing is stretched, cropped, padded or upscaled; a smaller master is held for the owner. See `claude-midas-a7-scene-files-README-2026-10-16.md`.
3. **Presets:** confirm or change warm 3000 K, night 2700 K and the 120 cm default.
4. **Catalogue refresh schedule** (needs publishing): see the catalogue README.
5. **The real paid run** of A7 still waits for your go.

## Leftovers (test data)

- **Runs table** "Claude Midas A7 runs" (`l0roUCBwIQL3h9Eq`): rows 26 to 30 (executions 430 to 434). Rows 26 and 27 are held at stage 03; rows 28 to 30 are intake rows.
- Vault rows (`Tyn4UT6BmIYMHAYl`) written by executions 430 to 434.
- Executions 430 to 434 (pinned).
- New `scenes` column in the runs table (meant to stay).
- No Drive files were made; no operations rows were reserved (15d was pinned).
- Earlier leftovers are listed in the stage 06 README.
