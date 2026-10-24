# Claude · Midas A7: scene shapes and scene delivery files

16 Oct 2026, 03:55 Amman. Written by Claude. Built on the owner's answers of 16 Oct, 03:24 and 03:25.

Code, tests and exports: GitHub `Ibrahim-Abedrabboh/claude-midas-studio` (the commit with this README).

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, version `de4de69a` (saved 03:45 Amman).
  - 167 nodes, of which 54 are Code nodes. It was 149 and 48.
- **Not published.** It was not published or unpublished in this work.
- **No A7 run and no paid call.** The checks were local tests and two scratch runs on code-made images (no credentials, no AI).
- A scene file is a "Generated image". A passed review is a reviewed candidate. Only the owner's go 2 approves a scene.
- Advertising formats are out of scope (owner, 03:24). If they are asked for later, they will be cut from the approved master, not generated separately.

## What changed

### 1. Scene shapes (owner, 03:24)

Scenes are 1:1 by default. The client may pick any of nine shapes: 1:1, 4:5, 5:4, 3:4, 4:3, 2:3, 3:2, 16:9, 9:16. The white master is always 1:1.

- **01 Intent & scope** reads the shape from `proportions` or from the page's `aspect`, and translates the page labels:

  | The page sends | A7 uses |
  |---|---|
  | Standard for category | 1:1 |
  | Square · 1:1 | 1:1 |
  | Portrait · 4:5 | 4:5 |
  | Landscape · 16:9 | 16:9 |
  | Nothing | 1:1 |

  - A bare shape such as "3:4" is read too.
  - A shape that is not offered (for example 21:9) becomes 1:1, with a note to the client.
  - If both fields arrive with different shapes, `proportions` is used, with a note.
  - The brief records where the shape came from (`proportions_source`).
- **11a Plan ticket** uses the same nine shapes, with 1:1 as the default. Before, it had five shapes and 16:9 as the default.
- **13 Compile** already named the nine shapes. A scene with no frame now falls back to 1:1 instead of 16:9.
- The approved image model's registry row (`gemini-nano-banana-2.1`) lists all nine shapes (read 16 Oct). The trial row lists none.

### 2. Scene delivery files (owner, 03:25): new step 20

Step 20 runs right after the owner approves a scene at go 2, before the next scene starts.

1. **20a Scene files ticket** checks that the owner's approval of this scene is recorded, with the scene's Drive file and checksum, and that the files were not made before.
2. **20b** downloads the approved scene from Drive.
3. **20c** checks that its checksum equals the approved one, then reads its size.
   - The short side becomes 1125 px. The long side is scaled by the same factor, so the image keeps its own shape.
   - Nothing is stretched, cropped, padded or upscaled.
   - If the short side is under 1125 px, the scene's files are **held for the owner**.
   - If the image is more than 2% off the planned shape, a note says so. The files still follow the image as approved.
4. **20d, 20e** (n8n Edit Image, no AI): one resize; jpg at quality 92 and webp. The 2048-class master stays in Drive unchanged.
5. **20f** checks that each file is the right format and exactly the planned size.
6. **20g to 20i** make one folder per scene inside the run's folder and upload both files.
7. **20k, 20l** write and upload a manifest (JSON). It holds:
   - the scene and the run;
   - the owner's go 2 approval, with the note that a review is a reviewed candidate;
   - the kept master (Drive id, checksum, size);
   - each file with its size, checksum and link, labelled "Generated image";
   - each Midas piece with its SKU, name, page, live stock reading and the time of that reading;
   - the pieces left out, with the reason.
8. **20m** records the result on the approved scene.
   - `scene_files_ready`: both files and the manifest are saved.
   - `scene_files_held`: anything else, with the reason. The scene stays approved and the next scene still starts.

Sizes for a master whose pixels are exactly the planned shape:

| Shape | Files |
|---|---|
| 1:1 | 1125 × 1125 |
| 4:5 | 1125 × 1406 |
| 5:4 | 1406 × 1125 |
| 3:4 | 1125 × 1500 |
| 4:3 | 1500 × 1125 |
| 2:3 | 1125 × 1688 |
| 3:2 | 1688 × 1125 |
| 9:16 | 1125 × 2000 |
| 16:9 | 2000 × 1125 |

The long side follows the master's own pixels. A 1638 × 2048 master (nearly 4:5) gives 1125 × 1407.

Other changes:
- **19a Scene ticket.** At the end of the queue, the run is called "scenes_complete" only when every approved scene has its files. Otherwise the run holds for the owner, says which scenes' files are held and why, and says the scene package is incomplete.
- **Routing.**
  - "Package due?" now leads to "Scene files due?", which sends an approved scene to step 20 and anything else to "Scene due?".
  - "Scene due?" starts the next scene after `scene_files_ready` or `scene_files_held` (before: after `scene_approved`).
- **V1 Vault events** logs a `scene_files` event at step 20.
- **04 Settings** has a new `scene_delivery` block (short side 1125, jpg and webp, quality 92, 2% shape note).
- **Group** "Stage 07 · Scene files (step 20)" added. The router "Scene files due?" stays outside it, because it also leads to "Scene due?".
- **Fix found by the export test.** n8n's add-node operation dropped the node settings of the new nodes (pass failures on, run once). Without them, a Drive failure would stop the run instead of being held with a reason. They were set again (version `de4de69a`), and a test now checks them.

A7 versions saved in this work, oldest first:
- `324065c8`: shapes in 01 and 11a;
- `3d47051c`: 13 Compile;
- `eff53518`: step 20 nodes added;
- `4b943336`: step 20 wired, with 19a, V1 and 04;
- `43b0829b`: group;
- `de4de69a`: node settings.

## What was checked, and how

- **Local tests.** They read the Code-node files from the repo.
  - New suite `tests/claude-midas-a7-scene-files/run_tests_scene_files.js`: 65 of 65. It covers the page labels read from the page source, the nine shapes, the planner frames, the sizes for five shapes, the holds, the manifest, the result, 19a's end of queue, V1, and the routing and settings in the export.
  - Stage 07: 86 of 86 (was 83). One expectation changed: approved scenes without files are now held, not complete. Three tests were added.
  - Stage 06: 56 of 56. Stage 05: 58 of 58. Model test MT4: 9 of 9.
  - The two older suites: 86 of 86 and 37 of 37, run on a scratch copy. Their code copies (`claude-midas-a7-build/js/`) were updated to match the changed Code nodes.
  - Catalogue refresh: 1 of 1. Its parser tests need the saved listing pages, which are not in the repo, so they were skipped. That workflow was not changed.
- **Byte check.** A7 was read back from n8n after the last change. All 54 Code nodes match the repo files byte for byte.
  - The export `n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json` was written from that read-back (`tools/claude-midas-a7-export.py`).
  - Compared with the previous export: 18 nodes added, 7 changed, 1 connection removed, 25 added, 1 group added, settings unchanged.
- **Scratch runs 435 and 436** in "Claude · scratch · A7 scene files test" (`KWeP7dIqnUyvbGlL`, archived afterwards). They used A7's exact 20c code, 20d and 20e settings and 20f code, on code-made PNGs, on n8n Cloud:
  - 2048 × 1152 (16:9) → jpg and webp, both 2000 × 1125;
  - 1638 × 2048 (4:5) → jpg and webp, both 1125 × 1407;
  - 20f accepted both runs.

  Results: `tests/claude-midas-a7-scene-files/claude-scratch-runs-435-436.json`.

## What was not checked

- **Step 20 inside an A7 run**, pinned or real. Pin data carries JSON only, so a pinned Drive download cannot hand the image to 20c and the resize would not run. The scratch runs cover the resize; local tests cover the rest.
- **Real Google Drive:** downloading an approved scene, making the folder, the uploads, the manifest upload, and Drive's checksum field.
- **A real scene from the model.** Its pixel size for each shape at 2K is not known yet. The files follow whatever size it returns.
- Colour profile, metadata and visual quality after resizing a real scene.
- The client page sending a real job to A7. The page is not connected; mock mode only.

## Assumptions

- The long side follows the master's own pixels, not the nominal ratio, so it can differ by a pixel from the figures in the table.
- A scene whose files are held stays approved; the next scenes still run, and the run holds for the owner at the end.
- If `aspect` and `proportions` both arrive with different shapes, `proportions` wins, with a note.
- An unknown shape becomes 1:1 with a note, rather than refusing the job.
- A shape more than 2% off the plan gives a note, not a hold.
- One Drive folder per scene, inside the run's folder.
- "2048-class": a long side outside 1800–2400 px gives a note; the files are still made.

## Not built

- **The client page still offers four shape choices:** Standard for category, 1:1, 4:5 and 16:9. A7 now takes nine. The other six (5:4, 3:4, 4:3, 2:3, 3:2, 9:16) are not on the page. See open point 2.
- Advertising formats: out of scope.
- The client's view choice is not used (open point 3).
- Restoration or upscale of vendor photos. Arabic text.

## Open, for the owner

Update, 16 Oct 2026, 05:05: points 1 to 3 were answered by the owner at 04:16 and are built. See `claude-midas-a7-views-framing-README-2026-10-16.md`.

1. **Hero framing and the 1:1 default.** The hero rule says the product's height fills 60–70% of the frame height. A wide product cannot meet that in 1:1 or in portrait shapes.

   My calculation, with flat geometry and no perspective: a sofa three times wider than it is tall, kept whole in the frame, can fill at most about 33% of a square frame's height, and about 27% of a 4:5 frame's.

   Likely result: a failed framing check, paid repairs, then a hold. Should the rule be measured on the product's widest or tallest extent, as the white master's 76% rule is?
2. **The page's shape list.** Should the page offer all nine shapes? That is a page change, checked in mock mode only.
3. **The client's view choice** (Category template, Wide view, Close-up, Wide view + close-up) is stored but not used; every lifestyle scene is framed as a hero. Should it map to A7's hero, wide and detail framing?
4. Still open from before:
   - presets (warm 3000 K, night 2700 K, 120 cm default);
   - older runs' budgets;
   - the catalogue refresh schedule and a fuller source;
   - the Arabic description;
   - the real paid A7 run.

## Leftovers

- Scratch workflow "Claude · scratch · A7 scene files test" (`KWeP7dIqnUyvbGlL`): archived. It is safe to delete.
- Executions 435 and 436 (scratch runs).
- No data-table rows and no Drive files were written in this work.
- Earlier leftovers are unchanged:
  - runs table `l0roUCBwIQL3h9Eq` rows 23–30;
  - vault rows written by test runs;
  - identity table row 1;
  - archived workflow `UPIDK9W2UkJgQdBA`;
  - executions 426–434.
