# A7 revision flow: motion version (14 Oct 2026)

## Status
- A video explainer only. Nothing in n8n was changed, published or run. No paid calls were made.
- Pipeline A7 is still a design and is not built. The video says this at the start, throughout (corner badge) and at the end.

## What changed from the original recording
- Source: `claude-midas-a7-revision-2026-10-14.mp4` (20 s, 1280×1180, a screen recording of the sequence diagram).
- New file: `claude-midas-a7-revision-motion-2026-10-14.mp4` (42.2 s, 1920×1080, 30 fps, H.264, no audio).
- The sequence diagram is now three animated nodes (Client page, Pipeline (A7), Owner). Each message draws in as a curved arrow, and a token travels along it. Return messages are dashed, as in the original.
- Each step has a large step number, a route label, the step text and a progress rail. Earlier arrows fade to grey so the history builds up on screen.
- Step props: the four change axes (step 1), parent X linked to brief v+1 with the old plan and review struck through (step 2), a plan preview card (step 3), image frames with checks and two repair slots each (step 6), "approve or hold" shown with no choice made (step 7), and a generated image with "Approved only after the owner decision" (step 8).
- The ending shows the version chain (result X → brief v+1 → v+2) with the closing note from the original.
- Brand: white page, ink, red as the single accent, gold for decoration only (from `midas-furniture-brand/DESIGN.md`). Type: Playfair Display, Manrope and Space Grotesk, as on the client page. Nord is not available here.

## Wording
- All eight step texts and the closing note match the original. Some long lines were split into a heading and a subline.
- Three short sublines are new: "The client sees the plan before anything is made" (3), "Nothing runs until the client confirms" (4), and "then hold" added to step 6. The plan card says "Locked: the product as photographed". These restate project rules. Check them before you share the video.

## How it was checked
- 28 stills and a 16-frame contact sheet of the final file were inspected for overlaps, clipped text and timing.
- ffprobe confirms 42.2 s, 1920×1080, 30 fps.

## Not checked
- I have not watched it end to end in real time. Frame sampling can miss a short glitch.
- Not tested on mobile players or social platforms.

## How to rebuild
- Use `scene.html`, which has a timeline driven by `window.render(t)`, and `render.py` (Playwright and ffmpeg). Run `npm i @fontsource/playfair-display@5.0.8 @fontsource/manrope@5.0.8 @fontsource/space-grotesk@5.0.8`, then `python3 render.py video out.mp4`.

---

# Version B: card feed (added 14 Oct 2026)

## Status
- A second, separate video from the same source. Nothing in n8n was changed or run, and no paid calls were made.
- New file: `claude-midas-a7-revision-motion-b-2026-10-14.mp4` (42.8 s, 1920×1080, 30 fps, H.264, no audio).

## How it differs from version A
- **Layout:** version A is a node-and-arrow diagram. Version B shows the flow as a product-style feed on a light grey page.
- **Left column:** three chapters that switch one at a time: "Ask and plan" (steps 1–4), "The owner's go" (5) and "Make and decide" (6–8). Below them are a vertical progress rail with all 8 steps and a "Current version" panel. That panel swaps from result X to "brief v+1 · parent: result X" at step 2.
- **Right column:** one card per step, showing the route, title and subline. When a step ends, its card shrinks to a one-line row and moves up, and then the next card enters. Each card's contents appear one after another: chips, version cards, the plan-preview drop-down, the Confirm press, the owner's reply message, image checks, and the "Approved" stamp.
- **Ending:** a dialog with the version chain and the closing note.
- **Animation:** built with the motion-patterns approach: stagger, paired enter and exit, one chapter at a time, collapsing cards, a shared-element swap, a dialog and a progress bar. One set of timing and spring values is used throughout.

## Wording
- **Kept:** the step texts and the closing note match the original.
- **Added in version B:**
  - three chapter names
  - short rail labels
  - "one axis per change"
  - "Shown to the client before anything is made"
  - "The owner replies before images are made"
  - "two repair slots per image"
- Check these before you share the video.

## How it was checked
- I inspected stills at the intro, steps, card changes and outro, plus a 16-frame contact sheet of the final file.
- A first draft let the new card overlap the collapsing one. I fixed it so the old card collapses first and the new one enters about 0.38 s later.

## Not checked
- I have not watched it end to end in real time.

## Rebuild
- Run `SCENE=scene2.html python3 render.py video out.mp4`.

---

# Version C: one picture through the flow (added 15 Oct 2026)

## Status
- New file: `claude-midas-a7-revision-motion-c-2026-10-15.mp4` (46.6 s, 1920×1080, 30 fps, H.264, no audio).
- No paid calls. Nothing in n8n was changed, run, published or unpublished.
- **Status update:** I checked n8n on 15 Oct 2026.
  - "Claude · Midas A7 (stages 01–03)" (1cgZc9rmBOrPdKIe) and "Claude · Midas A7 reader test" (4Ev84j0HwluPpACo) are drafts. Neither is published.
  - The refine flow is still not built.
  - The video's status labels now say this. Versions A and B said "not built yet" with no detail.
- Design source: the refine flow in `a7-revision.mmd`. It has not changed since 14 Oct.

## The idea
- Versions A and B show the steps as a diagram and as cards. Version C shows what the change does to an image.
- A line-drawn room is labelled "Illustration only, not a Midas product".
  - Result X slides back into history, and brief v+1 comes forward.
  - The plan preview marks the window "Changes: light" and the sofa "Locked: the product as photographed".
  - At step 6 only the light changes, and check marks appear on the sofa's corners.
- The owner's "go" is a gold stamp.
- At step 7 the picture shrinks into a package. "approve or hold" is shown with neither picked.
- At step 8 the picture returns inside a client page labelled "Generated image". A dashed "Approved" placeholder says it appears only after the owner's decision.
- It opens and closes on an ink panel. The intro reads "One change. A new version." The outro shows the version stack and the closing note.

## Motion system (motion-foundations)
- One set of timing values is used throughout: durations 0.08/0.18/0.35/0.6/1.0 s, four easing curves, distances and scales.
- Five spring presets are used: snappy, gentle, bouncy, instant and release.
- No other timing values appear in `scene3.html`. Distances are doubled for the 1920 frame.
- Only position, scale, rotation and opacity are animated. Line draws and the light wipe use scaling, not width.
- The skill's reduced-motion rule applies to live pages. A video can't detect it, so no reduced-motion cut was made.

## Wording
- Kept: the eight step texts and the closing note match the original.
- New in version C:
  - "One change. A new version."
  - "How a refine request on result X becomes brief v+1…"
  - "The change and the locks, side by side"
  - "voided · result X stays as history"
  - "Shown on the client page as 'Generated image'"
  - "Changes: light". This is an example axis, not a real job.
  - the status lines
- Check these before you share the video.

## How it was checked
- I inspected 20 stills (intro, every step, the seal, the package, the stamp and both ink transitions) and a 16-frame sheet of the final file.
- ffprobe confirms 46.6 s, 1920×1080, 30 fps.

## Not checked
- I have not watched it end to end in real time.

## Rebuild
- Run `SCENE=scene3.html python3 render.py video out.mp4`.
