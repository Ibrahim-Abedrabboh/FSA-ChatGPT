# Claude · Midas A7: prompt and intake fixes, owner decisions 22–29, page draft 2

16 Oct 2026, 09:05 Amman. Written by Claude. Built on the owner decisions of 16 Oct, 06:24 (points 27 and 29 revised 06:49 and 07:16), the prompt check (`claude-midas-a7-prompt-check-2026-10-16.md`) and the build prompt (`claude-midas-a7-build-prompt-2026-10-16.md`).

Two sessions built this. The first saved versions 1/4 to 3/5 (05:09 to 07:14) and left parts 4 and 5 as unsaved drafts. This session (from 07:20) checked those versions, checked and finished the drafts, had them reviewed, saved them, and built the page draft.

Code, tests and exports: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, branch `main` (the commit with this README).

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`.
  - Before this build: `a22b6f1a` (05:09).
  - This session started from `98f04a96` ("Prompt fixes 3/5", 07:14).
  - Saved by this session:
    - `cee6f613` "Prompt fixes 4/5" (08:53);
    - `44d79e45` "Prompt fixes 5/5 (1 of 2)" (08:56);
    - `64545f4f` "Prompt fixes 5/5 (2 of 2)" (08:58). This is the current version.
- **Not published.** Nothing was published or unpublished.
- **No run of any kind and no paid call.** No n8n execution was started (none exists for 16 Oct). Every check was a local test with code-made data, plus a mock-mode browser check of the page.
- Read-back of `64545f4f`:
  - 167 nodes, 54 of them Code nodes. All 54 are byte-identical to `n8n/claude-midas-a7/code-nodes/`.
  - The two model prompts (11 Stylist, 11c Plan critic) are identical to `n8n/claude-midas-a7/model-prompts/`.
  - Against `a22b6f1a`: 20 nodes changed, none added or removed, connections and settings unchanged.
- Client page: a **new draft**, `claude-outputs/claude-midas-a7-page-2/`. The earlier draft `claude-midas-a7-page/` is unchanged. Not connected; mock mode only.
- A passed review is a reviewed candidate, not an approval. Scores are model judgements. The 90–95 target is not claimed anywhere.

## Who was editing (step 0)

At 07:20 the newest version (`98f04a96`) was five minutes old, so I stopped and asked.

- I found no other reachable Claude session and no n8n execution.
- A branch `claude/a7-prompt-fixes-wip-0720` had been pushed at 07:18. The owner confirmed it came from the session updating the F1 Options page, not from an A7 builder.
- I re-read A7's history before each save. No other version appeared.

## Nodes and tables changed (a22b6f1a → 64545f4f)

Saved in versions 1/4 to 3/5 (first session; checked byte for byte today):

| Node or table | Change |
|---|---|
| 01 Intent & scope | Reads the A7 page `metadata.*` and the client first page shape; lists unused fields as "not applied"; camera view, light preset, people and series per image; cap 8, or 10 for Views by light. |
| 04 Settings | Camera views, raised camera, built-in light, people text, side-view gate. |
| 07a Load handling profiles | Now reads the A7 table `FZJg1MHUh2lcIV1H` (was the shared `KTTMJZ0Wh84cAyDm`). |
| 07 Route | Category guidance from the A7 table. |
| 08 Locks and freedoms | Camera view, light preset, people and made-from as locks. |
| 10 Retrieve Midas pieces | No Midas cushions or throws. |
| 11a Plan ticket | Fixed camera view and light preset per shot; Midas pieces only; guidance with F1's qualifier. |
| 11 Stylist (model prompt) | Midas pieces only; room fields; person field; built-in light. |
| 11b Stylist check | Removes generic props and unallowed people; flags lamps, rugs, preset clashes and furniture in room fields. |
| 11c Plan critic (model prompt) | Checks the same. |
| 11d Plan verdict | Rewrites keep the rules above. |
| 12 Who leads the scene | Side-view gate; lists what is left out at go 1. |
| G1 Go 1 verdict, G1b Decision check | Person and room edits at go 1; no inferred-sides answer. |
| Table `FZJg1MHUh2lcIV1H` | New A7 handling profiles table, 43 rows (first session; not changed today). |

Saved by this session (4/5 and 5/5):

| Node | Change |
|---|---|
| 13 Compile | White, empty-room and placement prompts (items below). |
| 16a Review ticket | Blind count box and module rule; risks to the reviewer; people, lamp, camera, side-photo checks. |
| 16b Review verdict | box_2d conversion; people and lamp checks fail the image; the go 2 series list. |
| 19a Scene ticket | Series made from approved images; side gate; held images; client-room light hold. |
| 19c Prop verdict | A Midas lamp only when its page says in stock. |
| 19g Scene references | Sends the supplied side photo with a side view. |

## Each item

Test names are in `tests/claude-midas-a7-prompt-fixes/run_tests_prompt_fixes.js` (103 of 103) unless another suite is named.

### Prompt check

| Item | Status | Shown by |
|---|---|---|
| P1 rug guide only with a confirmed Midas rug | Done | "04: … rug guide is kept for a Midas rug only"; "13 place: Full frontal camera at 0 degrees; rug guide only because a Midas rug is placed" |
| P2 category guidance from A7's table, with F1's qualifier | Done | "07: profile from A7's table …"; "13 place: category guidance with F1's qualifier" |
| P3 Midas pieces only, no generic props | Done | "11a: Midas pieces only"; "11b: generic props … removed by code" |
| P4 light preset fixed; lamps only as Midas pieces | Done | "11b: a lamp, a rug and a light that breaks the preset are findings" |
| P5 "Keep unchanged while correcting:" | Done | "13: repair keep list heading (P5)" |
| P6 Reference view keeps the vendor angle | Done | "13 place: Reference view keeps the vendor angle (P6)" |
| S1 white framing on the longest side, 12% each end | Done | "13 white: framing on the longest side (S1)" |
| S2 empty room: walls, floor, windows, size, clear zone; no product or furniture; client's wall and floor as fixed lines | Done | "13 room: walls, floor and the clear zone only (S2)"; "13 room: names no product and no furniture" |
| S3 only plain sheer curtains or blinds | Done | same test |
| S4 a Midas cushion on the sofa looks added to the reviewer | Done by decision 25: Midas cushions are not offered, so the case no longer arises | "10: no Midas cushion or throw shortlisted" |
| S5 detail view without room height or guide | Done | "13 place: a detail view drops the room height and the guide (S5)" |
| S6 blind count box as box_2d, converted in 16b, old box kept | Done | "16a: the blind count gives box_2d (S6)"; "16b: box_2d [200,150,800,800] → 65%"; "16b: the old percentage box is still read" |
| S7 module rule for the blind count, not told the target | Done | "16a: … told what a module is (S7), not the target" |
| S8 planner's risks to the reviewer only | Done | "16a: the planner's risks go to the reviewer (S8)" |
| C1 left-to-right layout line, "as image 1 shows" | Done, narrowed by the review (only when the boxes match the contract, no excluded thing, Reference view only) | "13: layout line from distinct reader boxes only (C1)"; "review fix: no layout line when an excluded thing …"; "review fix: the layout line is given only in the Reference view" |
| C2 closing self-check in white and placement prompts | Done | "13 white: … self-check (C2)"; "13 place: … self-check" |

### F items and the client first page

| Item | Status | Shown by |
|---|---|---|
| F2 A7 page "Keep faithful" fields read; unused fields listed back | Done | "01: A7 page draft: metadata colour, material, must_not and locks read (F2)"; `intake_shapes.js` (below) |
| Client first page shape (`outcomes`, `delivery.*`, `details.*`, `preferences.wall/human`) | Done. Still refused without a job id, as decided | "01: client first page shape …" (6 tests) |
| `details.inventory` parsed only as "number piece" | Done | "01: details.inventory: only "number piece" is read" |
| F3 page draft | Done (new copy) | `tests/claude-midas-a7-page/run_page2_mock.js`, 100 of 100 |
| F4 room photo and other views on the page | Not built (out of scope) | — |

### Owner decisions 22–29

| Decision | Status | Shown by |
|---|---|---|
| 22 People: none by default; one adult beside or behind when asked; never in the empty room or white master | Done | "01: no people by default"; "19a: the planned person is kept when the brief allows one"; "13 place: one adult only when planned and allowed"; "16b: a person in front … fails the image" |
| 23 Light preset fixed; Midas lamp only if in stock and planned; built-in light; review fails other lamps | Done | "13 room: night preset uses built-in light, no lamps"; "13 place: a confirmed Midas lamp is the only lamp"; "19c: a pre-order lamp is left out"; "16b: … an unplanned lamp fails the image" |
| 24 Camera: 0° tilt; Reference view follows the vendor photo; raised but level for large sets; no fisheye | Done | "04: camera views: 0 degrees tilt …"; "19a: a 13-piece dining set … raised, level camera"; "13 place: raised camera line" |
| 25 No Midas cushions or throws | Done | "10: no Midas cushion or throw shortlisted" |
| 26 A7-only profiles table, edits marked | Done (table built by the first session). The owner still has to review the wording | "07: 43 profiles … every edited guide says what changed" |
| 27 Three views and Views by light; side views only with a supplied photo; held image, series continues; no inferred sides | Done | "19a: Left side without a photo is held; 45° right is made …"; "19a: an image made from a held image is held too"; "19a: with a supplied photo of the left side, the Left side view is made"; "no node or prompt mentions go 3 or accepting inferred sides" |
| 28 Pre-order: no change, listed as open | Done (kept open) | "19c: … a pre-order side table is still kept" |
| 29 No go 3; go 2 per scene; white master first; series shown together; repairs only when ordered; packaged on approval | Done | "16b: each scene keeps its own go 2; the series is shown together"; "16b: the go 2 ticket lists a held series image with its reason"; "review fix 16b: the go 2 list says which images will be held, and why"; `04` keeps `auto_repair` false |

## What this session changed in the drafted parts 4–5

My own reading:

- 16a: on a side view, the reviewer was told that Midas pieces start at image 3. They start at image 4. Fixed.
- 16b: the series list now shows the current scene as "this image: waiting for your go 2".
- 19a: an image whose camera and light both differ from its source is held instead of sent with a self-contradicting prompt. 01 never plans this; it is a guard.

The independent review found no blocker. It made 7 "should fix" and 8 "minor" findings. I checked each against the code first.

- **Fixed:**
  1. A lamp product was forbidden by its own prompt and review. Now "other lamps or light fittings", and the reviewer is told the product is the lamp.
  2. A night image said "daylight through the windows". Night now says the windows are dark and the light comes from the built-in light.
  3. Only the first of two Midas lamps was named. Now every one is named, in 13 and 16a.
  4. A client room photo got a light preset and a moving camera. Now the camera is fixed and the light is "as photographed". A series image that changes the light is held in 19a.
  5. The layout line could list an excluded table, or more pieces than the contract. It now appears only when the boxes match the contract and no excluded thing is among them.
  6. Full frontal and 45° right had no never-invent line. Every camera view other than the Reference view now has one.
  7. A scene started by an older version, repaired at go 2, got "only the camera moves" next to "camera exactly as in image 3". It is now read as a camera move.
  8. The layout line also went into side and 45° views. It is now given in the Reference view only.
  9. The go 2 list showed images that will be held as "not made yet". It now says "will be held: <reason>".
  10. Wording:
      - a light-only image no longer carries the raised-camera and framing-guide text;
      - a double space is gone;
      - a missing full stop is added in 16a.
  12. A cushion product's blind count was told that cushions are not pieces. That line is now left out for cushion products.
  - Also: 19c used narrower lamp words than 13 and 16a. They are now the same.
- **Kept, with the reason:**
  - 11 (box_2d with x and y swapped): it cannot be told apart from a real box. Inverted or 0–1 boxes already fall back to the reviewer's share, which is labelled.
  - 13 (two cases hold the whole run, not one image):
    - 19a holds the run when camera and light both differ. 01 never plans that.
    - 19g holds the run when a side photo recorded at go 1 is missing at scene time. That is a data fault, not "no photo", so the owner should see it.
  - 14 (the run row's `scenes` JSON does not store `held`): V1 is outside this build. The held events are in the run log.
  - 15 (the bed guidance says "including both nightstands … when present"): part of the profile wording the owner reviews under decision 26.

Each fix has a test, listed in the suite under "review fix".

## Prompt differences

Renders are in `tests/claude-midas-a7-prompt-fixes/rendered-2026-10-16/`:

- `before-a22b6f1a/` (rendered from the code of `a22b6f1a`, commit 5d5cf51);
- `after-64545f4f/` (the current code);
- `scenarios/` (Full frontal at night, Reference view by day, a Left side from the approved Full frontal, a night image made from the daylight one).

The renderer uses one test product, a 7-piece sectional sofa.

**White master** (2 lines changed):
- Framing now reads: "Its longest side spans about 76% of the frame side in the same direction … with about 12% white margin at each end of that side."
- New last line: "Before returning the image, check it against image 1: exactly 7 product pieces, each identifying detail in its place, the handedness, the whole product inside the frame, and pure white at every edge."
- The profile's rule line is no longer in the white prompt. In this test it was empty before too.

**Empty room:**
- "an empty room that a piece of furniture will be placed into later" → "an empty room".
- The shell now includes built-in light. Lamps are excluded except the built-in light. The only allowed textiles are plain sheer curtains or blinds.
- The planner's setting sentence (which named a sofa vignette) is gone. Separate lines now give:
  - "Walls: …", "Floor: …", "Windows: …", each with the client's choice first when given;
  - "Leave this floor zone clear …".
- Gone: the palette line (it named upholstery) and the "product to be placed later" line.
- Camera: the framing guide is gone from the room; "no fisheye or wide-angle distortion" is added.
- Light: the preset's own words, then the light sources (daylight and built-in light; no lamps).

**Placement:**
- The Midas piece is now a centre table. The test data changed because Midas cushions are no longer offered (decision 25).
- New "Category guidance: …" line, followed by F1's qualifier.
- "Turn the product only as far as the vendor photo shows it" is removed from the unknowns line. The never-invent rule is now its own line for every view except the Reference view.
- The add-nothing line now names light fittings, and textiles except plain sheer curtains or blinds.
- Camera: "as in the room image", the Reference view rule and the floor guide. In this test the old rug guide was used without any Midas rug, which was defect P1.
- Light: preset name, then sources, then "no table lamp, floor lamp or other freestanding or saleable light fitting".
- New last line: the closing self-check.

**Intake shapes** (`node tests/claude-midas-a7-prompt-check/intake_shapes.js`, before vs after):
- A7 page draft:
  - colour "cream" and material "boucle" are now read;
  - exclusion "the wooden table in the photo" is read;
  - "Details to keep … exactly two chairs" now reaches the conflict check;
  - people is now "one", from the page's Human switch;
  - plants, mood, the Midas pieces switch and the hero item are listed back as not applied.
- Client first page:
  - still refused, now only for the missing job id;
  - otherwise it now gives white master, wide and detail at 4:5;
  - SKU 161283, dimensions, "2 x chairs" and the written instruction are read.

## Tests (16 Oct 2026, 09:00, on the code saved as `64545f4f`)

| Suite | Result | Before this build |
|---|---|---|
| views-framing | 79 / 79 | 79 |
| page mock (old page) | 36 / 36 | 36 |
| page 2 mock (new) | 100 / 100 | new |
| stage 07 | 86 / 86 | 86 |
| scene files | 65 / 65 | 65 |
| stage 06 | 56 / 56 | 56 |
| stage 05 | 58 / 58 | 58 |
| MT4 | 9 / 9 | 9 |
| catalogue refresh | 1 / 1 | 1 |
| prompt fixes (new) | 103 / 103 | new |
| older suite `run_tests.js` (scratch copy) | 87 / 87 | 86 (one test added: S59b) |
| older suite `run_tests04.js` (scratch copy) | 37 / 37 | 37 |
| prompt render | 53 / 53 | — |

Changed expectations in older suites. Each one carries a dated comment in the file.

- `run_tests.js` (planner tests):
  - S49, S58: generic props are now removed by code and listed at go 1 (P3). Before, they were kept.
  - S59: no person by default (decision 22). It replaces the 15 Oct rule of one person allowed. S59b is new: "Human presence" asked → one adult allowed.
  - The plan fixture: no lamp or generic props; it has room and person fields.
- `run_tests04.js`: the white prompt now has the longest-side framing line, the layout line and the self-check, and no profile rule line (S1, C1, C2, P2).
- `run_tests04.js` and stage 05: the repair heading is now "Keep unchanged while correcting:" (P5).
- stage 07:
  - Midas cushions are no longer shortlisted (25), so the test's first piece is now a centre table.
  - The room prompt names no product (S2).
  - 20 scene checks instead of 18 (`people_ok`, `no_unplanned_lamp`).
- views-framing:
  - The room line now reads "the approved image of wide"; the light line now reads "As in the approved image".
  - The blind box is now `box_2d`.
- prompt fixes (this session):
  - the lamp sentence now ends ", listed above.";
  - a night light change no longer says "keep the light direction", because the windows go dark;
  - a light-only image's camera line is "Camera: exactly as in image 3; the camera does not move."

## The page draft (F3)

New folder `claude-outputs/claude-midas-a7-page-2/`. Its own README has the details. Changes from draft 1:

- Offered:
  - human presence (Lifestyle only, off by default);
  - camera view: As photographed (Reference view), Full frontal, 45° right;
  - series: Single image, Three views, Views by light.
- Left side and Right side show "Coming later" and are never sent.
- Plants, Mood / Vibes and the Midas supporting pieces switch show "Coming later" and are not sent.
- A series locks the camera and view choices. Views by light also locks lighting.
- **Left side images in a series:** this page takes one photo, so the studio holds every Left side image. Before submit, the page says so:
  - Three views: 3 of 4 images made;
  - Views by light: 7 of 10;
  - mock results show "Not made: needs a photo of the left side" and "Partly ready", never complete.
- I changed one sentence the page builder wrote. It said pieces are "confirmed in stock"; it now says "up to three Midas pieces from the current catalogue, or none", because pre-order pieces are still used (decision 28).
- Mock mode only. No request leaves the page; the test aborts every network call.

## What was not checked

- No real image call, so the effect of any prompt line on an image is unknown:
  - the self-check;
  - the layout line;
  - the dark-window night line;
  - the side-photo use;
  - the "turn the product" line.
- The two model prompts (11, 11c) were not run against a model in this build.
- Real Google Drive, real Midas pages and a real vendor or side photo in stages 06 and 07.
- The page: real network, phone widths, browsers other than Chromium, screen readers beyond basic labels, Arabic.
- How a page will show a held image once A7 has a result address. The mock's "not made" shape is a guess.

## Assumptions (still open for the owner)

- The three series lights are A7's Daylight (4000 K), Golden afternoon (3000 K) and Warm evening (2700 K). The two warm values are assumptions.
- The raised camera starts at 9 pieces, for dining families.
- A built-in shelf or counter counts as room shell for accessories.
- The lamp words (lamp, light, lighting, sconce, chandelier, lantern, pendant) decide what counts as a lamp in 13, 16a and 19c.
- A product whose profile, type or category names a light is treated as a lighting product. It may be its own scene's only lamp.
- In a client room photo the light is the photo's own. A chosen light preset is not applied there, and nothing tells the client yet.

## Not built

- F4: room photo and other views on the page. Without it, the page cannot give a Left side photo.
- F1's five light moods and room styles (Twilight has no A7 preset).
- F1's prop sets and the 7 missing SKUs.
- The image cap for other jobs (still 8).
- The same-room check, the missing scene-manifest fields, image conversion and resizing.
- The result address, connecting a page, the paid run, publishing.
- 01's "Midas supporting pieces switch" note still says "confirmed in stock"; pre-order pieces are kept (decision 28). Change it once decision 28 is settled.

## Open points for the owner

1. Showing the two series on a page that cannot take a side photo. They deliver 3 of 4 and 7 of 10, and the page says so. The project rule says offer only what is delivered. Keep them offered until F4, or show them as "Coming later"?
2. Decision 28 (pre-order pieces) is still open.
3. Decision 26: the wording of the A7 profiles table, including the bed guidance, needs the owner's review.
4. The page wording to review is listed in the page README: count lines, notes, "Partly ready".

## Leftovers

- Runs table `l0roUCBwIQL3h9Eq` rows 23–30; vault rows from those runs; identity row 1.
- Archived workflows `UPIDK9W2UkJgQdBA` and `KWeP7dIqnUyvbGlL`.
- Executions 426–436.
- Profiles table `FZJg1MHUh2lcIV1H`: in use by A7, not scratch.
- Git branches:
  - `claude/a7-prompt-fixes-wip-0720` (the 07:18 snapshot from the page session);
  - `claude/a7-prompt-fixes-4-5-wip` (this session's in-progress commits).
  - Both can be deleted once this commit is on `main`.
- A local worktree of 5d5cf51 in this session's scratch folder (render "before" set); not in the repo.
- No n8n test rows or scratch workflows were made in this session.

## Next, with the owner's go in that message

The first paid test: one white master and one scene of a known product, with the owner watching go 1 and go 2.
