# Claude · Midas A7: framing on the longest side, view mapping, and the nine-shape page

16 Oct 2026, 05:05 Amman; updated 05:15 with the independent review and its fixes. Written by Claude. Built on the owner's answers of 16 Oct, 04:16 (framing, the page's shape list, the view mapping).

Code, tests and exports: GitHub `Ibrahim-Abedrabboh/claude-midas-studio` (the commit with this README).

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, version `a22b6f1a` (saved 05:09 Amman, after the review fixes).
  - Still 167 nodes, 54 of them Code nodes. Seven Code nodes changed in this work: 01, 04, 13, 16a, 16b, 19a, 19g. No node was added or removed. Connections, settings and groups are unchanged.
- **Not published.** It was not published or unpublished in this work.
- **No A7 run, no n8n run of any kind, no paid call.** All checks were local tests and a mock-mode browser check.
- Client page: a **new draft** in `claude-outputs/claude-midas-a7-page/`. It is a copy of the job variations 2 page, which stays unchanged.
  - It is **not connected**: A7 has no sign-in or result address for a page yet. Its addresses are empty and mock mode is always on.
- A passed review is a reviewed candidate. Only the owner's go 2 approves. Framing scores and shares are model readings, not measurements.

## What changed

### 1. Framing on the product's longest side (04, 19a, 16a, 16b)

The rule now measures the product's bounding box on its longest side, against the frame's side in the same direction. That means the width for a wide piece and the height for a tall piece.

| Image | Rule | Source |
|---|---|---|
| White master | longest side about 76% (about 12% white margin at each end of that side) | owner |
| Hero view | longest side 60–70% of the frame | owner |
| Wide view | longest side 40–55% of the frame | owner |
| Detail view | the named detail fills most of the frame; the whole product is not required | owner |

Example: a sofa three times wider than tall, in a 1:1 frame. Its width is the longest side, so a hero at 65% of the frame width is possible. The old rule (60–70% of the frame height) was not.

How each step uses it:
- **04 Settings** holds the bands: `framing.hero_span_pct` 60–70, `wide_span_pct` 40–55, `white_span_pct` 76, `white_margin_pct` 12. Two values are mine, marked as assumptions:
  - `white_note_band_pct` 72–80. It decides when the white master gets a framing note.
  - `detail_min_pct` 50. I read "most of the frame" as more than half.
- **19a Scene ticket** writes the framing line for each view. A detail view names its detail from the plan's camera line. If the plan names none, the line asks for a characteristic detail as the vendor photo shows it.
- **13 Compile** puts that line into the image prompt. The white master's line already said "widest or tallest extent fills about 76%", so it is unchanged.
- **16a Review ticket** asks for the share:
  - The reviewer gives its own share on the framing check.
  - The blind count gives a box around the product. It is not told the target.
- **16b Review verdict** reports the framing beside the checks. It no longer decides the result.
  - The share comes from the blind count's box and the image's pixel size. Code picks the longest side in pixels.
  - If the box is missing or impossible, the reviewer's share is used, and the record says so.
  - The reviewer's own share is kept beside the box reading.
  - A miss is reported with the share. For example: "Framing (hero view): about 48% of the frame width; the rule is 60–70%. A styling note: the image is not failed for it."
  - A miss never fails the image. A reviewer "fail" or "unsure" on framing no longer counts either.
  - A miss is never repaired automatically, even if `auto_repair` is turned on.
  - The go 2 ticket shows the framing reading and the note. It also carries a proposed reframe, for example "move the camera closer". If the owner answers "repair", that reframe is the correction; no note is needed.
  - A product cut off by the frame still fails, as "whole product in frame". The exception is a detail view. My reason: the image then does not show the whole product (see the open points).

### 2. View mapping (01, 19a, 13)

**01 Intent & scope** now reads the view choice for a lifestyle job:

| The page sends | Images A7 plans |
|---|---|
| Category template, or "Studio decides" (the other page) | white master, hero, wide, detail |
| Wide view | white master, wide |
| Close-up | white master, detail |
| Wide view + close-up | white master, wide, detail |
| Nothing | as Category template |
| Anything else | as Category template, with a note |

- White BK ignores the view and makes the white master only. A view other than the default gets a note.
- Website stays white master, hero, wide and detail. A different view gets a note.
- A lifestyle job's image count now follows its views. A count sent by the page is checked, never used to add images. If it differs, a note says so.
- The 1-to-4 count still applies to variations, which the page does not offer.

**All views of one job share one room, arrangement and light.** The planner already asks for one room in its plan. Stage 07, though, made a separate empty room for each view from the same text, so the rooms could look different. That is now changed:
- **19a** queues the views widest first: wide, then hero, then detail. Other scene kinds keep their place before the views.
- The wide view is made as before: an empty room, then the placement, then review and the owner's go 2.
- Each later view is **made from the owner-approved wide image**. No new empty room is made.
  - The approved image is downloaded and checked against its approved checksum (the existing 19e2 room check).
  - It is sent as the room image.
  - If that approval is not recorded with its file and checksum, the view holds for the owner.
- **13 Compile** tells the model:
  - image 3 is the approved wide view of this job;
  - keep the room, every piece where it stands, and the light and its direction;
  - only the camera moves;
  - image 1, the vendor photo, still decides the product;
  - the product appears once.
- The base is the widest view, so the later views only move closer. No view extends a finished image (the "never outpaint" point, WA 32 and MI 43).
- A client room photo works as before: every view uses it.
- Switch: `scenes.views_share_one_room` in 04 Settings (on). Off means each view makes its own empty room again.
- Paid image calls for a Category template job, before repairs: 7 before (white, then a room and a placement for each of 3 views), 5 now (white, wide room, wide placement, hero, detail). The go 1 cost estimate still counts one room per view, so it is an upper bound.

### 3. The page's shape list, view and image count (new page draft)

`claude-outputs/claude-midas-a7-page/`, with `README.md` beside it.
- **One shape list**, grouped:
  - "Standard for category (Square 1:1)": first and chosen by default;
  - Square: 1:1;
  - Portrait: 4:5, 3:4, 2:3, 9:16;
  - Landscape: 5:4, 4:3, 3:2, 16:9.
- **Bare values are sent** (`scope.aspect`, for example `4:5`). "Standard for category" is sent as `1:1`.
- **White BK**:
  - the list is disabled and shows "White catalogue is always 1:1";
  - the views are locked, with the note "Views do not apply on white";
  - 1 image;
  - no view is sent.
- **Website**: square, set for the package; views hidden; 4 images.
- **Image count before submit**: a new card, "Images in this request", lists each image in order (for example "1. Catalogue on white, 2. Wide view, 3. Close-up (detail)"). The hint and the submit button show the same number. The old 1-to-4 chooser is gone, because the views decide the count.
- The outcome cards and the FAQ now say how many images each choice gives.
- Results are titled by view. Each is labelled "Generated image".
- Its saved draft uses its own storage keys, so it never mixes with the other page. A draft saved with an old label ("Portrait · 4:5") opens as 4:5.

## What was checked, and how

- **New suite** `tests/claude-midas-a7-views-framing/run_tests_views_framing.js`: **79 of 79** (68, then 11 more for the review fixes).
  - 04: the bands and the switch.
  - 01: every view, "Studio decides", spacing, unknown views, White BK, Website, both outcomes together, the count check, bare shapes.
  - 19a: queue order; the wide view's own room; the hero and the detail made from the approved wide image (file, checksum, type); the hold when that approval lacks a checksum; the switch off; a client room; a mixed old job.
  - 19e2 and 19g: the approved wide image passes the checksum check; another file is refused.
  - 13: the later view's prompt lines, and the unchanged prompt for a scene with its own room.
  - 16a: the share and the box are asked for; the blind count is not told the target.
  - 16b:
    - misses and hits for hero, wide and detail;
    - portrait and landscape frames;
    - a missing or impossible box;
    - nothing readable;
    - crop in hero and in detail;
    - `auto_repair` on with only a framing miss, and with a colour defect plus a framing miss;
    - the white master at 76% and at 40%;
    - G2 repair with no note.
- **Page in mock mode** `tests/claude-midas-a7-page/run_page_mock.js`: **36 of 36**.
  - Headless Chromium opens the page from disk with `?mock=1`, so nothing leaves the browser. The mock pictures use a test image in place of the hero picture.
  - It checks:
    - the grouped list and its default;
    - each view's count and list;
    - White BK (disabled list with the text, locked views, 1 image) and switching back;
    - Website;
    - the payload of every shape;
    - an old draft;
    - no internal terms in the visible text;
    - the image list in right-to-left mode;
    - no page errors.
  - Each payload was also passed through A7's real 01 Intent & scope. The planned images matched, for example 9:16 with Wide view + close-up gives white master, wide and detail at 9:16, with no note.
- **Existing suites, all passing:**
  - scene files 65/65;
  - stage 07 86/86;
  - stage 06 56/56;
  - stage 05 58/58;
  - model test MT4 9/9;
  - catalogue refresh 1/1 (its parser tests need saved pages that are not in the repo);
  - the two older suites 86/86 and 37/37, run on a scratch copy.
- **Expectations I changed, all because the behaviour changed on purpose:**
  - Stage 07: three expectations.
    - The scene review records 18 checks, with framing beside them.
    - A cropped scene fails as "whole product in frame".
    - The hero framing text.
  - The two older suites: their base job now asks for "Wide view + close-up". That still gives three outputs, as their two lifestyle scenes did, so their scenarios keep their meaning. Two expected names changed: `lifestyle_2` → `detail`, `lifestyle_1` → `wide`.
- **Code copies.** The suites' copies in `claude-midas-a7-build/js/` were updated to match.
- **Byte check:**
  - A7 was read back from n8n after the last change. All 54 Code nodes match the repo files byte for byte.
  - The export was written from that read-back. Compared with the previous export: 6 nodes changed, none added or removed; connections, settings and groups unchanged.
- **Independent review** (a separate agent that had not written the code, 05:00): it read the diffs and the code around them, and ran probe scripts. It found nine points. I checked each against the code before changing anything; the fixes are in A7 version `a22b6f1a`, with tests:

  | # | Finding | Done |
  |---|---|---|
  | 1 | A later view took its Midas pieces from its own plan, but the approved wide image already shows the wide view's pieces. The review would then fail the image, and a repair could not fix it. | **Fixed (19a, 19g).** A later view keeps the wide view's approved pieces, re-checked live. Its own plan's other pieces are left out, with the reason. If a wide-view piece is no longer confirmed, the view holds for you: it would still show the piece. |
  | 2 | A detail view of a multi-piece product failed on piece count: a close-up shows fewer pieces than the contract. | **Fixed (16a, 16b).** In a detail view, fewer pieces is not a defect; more pieces still fails. The reviewer is told so. |
  | 3 | A later view's light line came from its own plan, while the prompt says to keep the wide view's light. | **Fixed (13).** It uses the wide view's light line. |
  | 4 | A cut-off hero or wide view still fails. | Kept. **Open point 2** for you. |
  | 5 | A box given as 0–1 fractions passed the box check and gave a false note. | **Fixed (16b).** Such a box is not used. |
  | 6 | A repair's "keep" list said "the room as it is (image 3)". For a later view that contradicts the camera move, and the room is image 2 when the white master was left out for size. | **Fixed (16b).** It names the room's real image number. For a later view it keeps the room, the pieces and the light, not the camera. |
  | 7 | The detail share and the fallback share come from the reviewer, who is told the target. | **Fixed (16b).** The record now says so. |
  | 8 | A run already in progress keeps its old scene order. | No change: no A7 run is in progress. |
  | 9 | Wording: the page's "one room" promise holds only while the switch is on. The white prompt still says "12% margin on every side", which a wide piece cannot meet. | Page wording kept; it holds with finding 1 fixed and the switch on. White prompt left as is: it is the prompt the white-master model test used. Noted here. |

  - The reviewer also confirmed, by reading or by probe:
    - the queue order and base view for every view set;
    - the room reference surviving a go 2 repair (by reading; not run in n8n);
    - framing never repaired automatically;
    - the width-or-height choice;
    - the page's state when switching outcomes, and its payloads;
    - no internal terms in the page text.
  - After the fixes, A7 was read back again: 54 of 54 Code nodes byte-identical. Every suite passes again.

## What was not checked

- **Any n8n run**, pinned or real, and any paid call.
- **Whether the image model keeps the room** when it is given the approved wide image and asked for a closer camera. This is new behaviour; only a paid test shows it.
- **How accurate the readers' box and share are.** They are model readings of the image, not pixel measurements.
- **The review of a later view does not compare it with the wide view.** No "same room" check is built.
- **The page connected to A7.** Real `taxonomy.js` and hero picture were not used in the check (stand-ins). Arabic copy: none. Right-to-left was checked for the new image list only.
- A Midas piece that goes out of stock between the wide view and a later view now holds the later view for you (review finding 1). That hold was checked in a local test only.

## Assumptions

- White master note band 72–80%, and "most of the frame" means more than 50%. Both are in 04 Settings.
- A detail view's detail is the one the plan's camera line names.
- A product cut off by the frame is a completeness defect (it fails), not a framing miss.
- "Studio decides" means the same as Category template.
- **Lifestyle with Category template now plans the same four images as Website** (white, hero, wide, detail). Website still locks 1:1 and 2K.
- The page's image count includes the white catalogue image.
- Only framing became a note. Light, camera level, scale, grounding, realism and the Midas-piece checks still fail an image as before (see open point 1).

## Not built

- A "same room" check between views.
- Lowering the go 1 cost estimate when views share a room.
- The page's connection to A7 (a sign-in and a result address).
- Arabic copy for the page.
- Advertising formats (out of scope).

## Open, for the owner

1. **Other styling checks.** You wrote: "only count and identity defects fail it". I applied that to framing only. Light, camera level, scale, grounding, realism and "only listed props" still fail an image. Should they also become notes?
2. **A product cut off by the frame** in a hero or wide view still fails, as "whole product in frame". Agree?
3. **Shared room.** Later views are made from your approved wide image. The switch is in 04 Settings. Keep it on?
4. **Lifestyle with Category template = the Website set** (4 images). Is that what you want, or should Lifestyle make fewer by default?
5. **Note bands.** Confirm or change the white 72–80% band and "most" = more than half.
6. Still open from before:
   - presets (warm 3000 K, night 2700 K, 120 cm default);
   - older runs' budgets;
   - the catalogue refresh schedule and a fuller source;
   - Arabic;
   - the real paid A7 run.

## Leftovers

- **Nothing new in n8n:** no workflow, execution, data-table row or Drive file was created in this work.
- **Earlier leftovers are unchanged:**
  - runs table `l0roUCBwIQL3h9Eq` rows 23–30;
  - vault rows from test runs;
  - identity table row 1;
  - archived workflows `UPIDK9W2UkJgQdBA` and `KWeP7dIqnUyvbGlL`;
  - executions 426–436.

A7 versions saved in this work, oldest first:
- `a723618d`: 04 Settings, 01 Intent & scope, 19a Scene ticket;
- `122d0857`: 13 Compile;
- `c7ff855f`: 16a and 16b;
- review fixes:
  - `921f8f8e`: 19a and 19g. Its version note also names 16a, but 16a was changed in the next version.
  - `1b6b3a00`: 16a and 16b;
  - `a22b6f1a`: 13 Compile.
