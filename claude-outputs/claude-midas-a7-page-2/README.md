# Midas Virtual Studio client page: draft 2 for "Claude · Midas A7" (F3)

16 Oct 2026. Written by Claude. Copied from `claude-outputs/claude-midas-a7-page/` and changed for the owner decisions of 16 Oct 2026. The earlier draft is unchanged, byte for byte.

## Status

- **Draft. Not connected. Mock mode only.** A7 has no sign-in or result address for a page yet. The addresses in `STUDIO_CONFIG` are empty and `mock` is `true`. Nothing is sent anywhere.
- **Not published.** Nothing in n8n was read, changed or run for this draft. No paid call was made.
- **Checked in mock mode only:** `node tests/claude-midas-a7-page/run_page2_mock.js`: 100 of 100 passed, 16 Oct 2026. The test sends each payload through A7's own `01 Intent & scope` code (read only) and compares the plan.
- The earlier page's test, `node tests/claude-midas-a7-page/run_page_mock.js`, still passes 36 of 36 (16 Oct 2026).
- **Connecting it needs the owner's go.**

## What changed from claude-midas-a7-page

All of these are for **Lifestyle only**. White BK and Website send none of the new fields.

### Human presence: offered

- The switch is kept. It is sent as `styling.human` (`true` or `false`). It is off by default.
- Client note: "At most one person, beside or behind the item, never in front of it. Off by default."
- A7 reads it as `brief.preferences.people`: `one` when on, `none` when off.
- On White BK the finishing touches are hidden. On Website the switch is locked off, with a note.

### Camera view: offered

- Sent as `scope.camera`, with one of three bare values:

  | Sent value | Client label |
  |---|---|
  | `Reference view` (default) | As photographed |
  | `Full frontal` | Full frontal |
  | `45° right` | 45° right |

- Left side and Right side show as disabled "Coming later" chips. Note: "Needs a photo of that side; this page takes one photo for now." They use a separate radio name, so they are never read and never sent.
- I checked all three values through 01's `cameraOf()`. Each one maps to itself, and every scene output is planned with that camera.
- With a single image, the camera now shows in the result title. For example: "Image 2, wide view, full frontal". With "As photographed", the title stays as before.

### Series: offered

- Sent as `scope.series`: `Single image` (default), `Three views` or `Views by light`.

  | Series | Images asked for | Made from this page |
  |---|---|---|
  | Single image | as the view decides (2 to 4) | all |
  | Three views: Full frontal, Left side, 45° right | 4 (white + 3) | 3 of 4 |
  | Views by light: those 3 cameras in daylight, golden afternoon, warm evening | 10 (white + 9) | 7 of 10 |

- When a series is chosen:
  - the Views and Camera view chips are locked and shown unselected, each with a plain note;
  - the card value says "Set by the series";
  - the page sends `scope.view: ""` and `scope.camera: "Reference view"`;
  - with Views by light the Lighting chips are locked too, and `preferences.lighting` and `metadata.light` are sent empty;
  - with Three views the lighting choice still applies.
- When the client goes back to Single image, the choices made before the series come back.
- `scope.imageCount` equals the number of outputs 01 plans. The test checks this for every payload it sends.
- For series requests, 01's `not_applied` has no note about camera, view, lighting, series or count.

### Left side: not made from this page

This page sends one photo. Stage 07 (`19a`) holds every Left side image when no photo of that side was supplied, and it never invents the side. In Views by light, the golden afternoon and warm evening Left side images are made from the daylight Left side image, so they are held too. The 45° right images do not depend on them.

The page says this before submit, in four places:

- The image list marks each one, for example: "Left side, golden afternoon: not made from this page yet (needs a photo of that side)".
- The count says "3 of 4 made" or "7 of 10 made". So does the button: "3 of 4 images".
- A note under the list says how many images will be made and why.
- The Series card says the studio never invents a side it cannot see.

In mock results, each Left side image appears as a card marked "Not made" with "Not made: needs a photo of the left side." No picture is shown. The request then shows as "Partly ready", never as complete. The lead line says how many images were not made.

### Coming later: Plants, Mood / Vibes, Midas supporting pieces

- They are shown as plain rows tagged "Coming later". The rows have no controls.
- `plants`, `mood` and `catalogue` are no longer in the brief, in the draft or in any payload. Plants no longer default to on.
- A stored draft that still carries them opens without them.
- `metadata.camera` is no longer sent. The earlier page put the view there; the camera view now travels in `scope.camera`.

### Other changes

- Mock result titles for series images name the camera and the light, for example "Image 2, full frontal, daylight". With Three views and "Let the studio choose", the title ends "light chosen by the studio". Every image is labelled "Generated image".
- Landing text, FAQ and Coming-later lines mention camera views, series and the left side limitation. The Lifestyle card says "2 or 3 images" (updated 16 Oct 2026 after the Phase 1 review, finding 10: with both series "Coming later", a Lifestyle request is the white image plus one or two views); "or a series" was removed from the Direction step and the Lifestyle card.
- Stored drafts use their own keys (`midas.a7p2.*`). They never mix with the earlier draft's `midas.a7.*` keys.
- Language: the page has one language table, `STRINGS`, in English only. All new keys are English. No Arabic was written. When other languages are added, keys without a translation will need to fall back to English; today `t()` shows the key name for a missing string.

## What was checked, and how

All of this was run in headless Chromium, from a scratch copy of this folder, with `?mock=1`. Every http(s) request was aborted. The only ones the page tried were the Google Fonts files.

- Human on and off: A7 reads `people` as `one` and `none`.
- Each camera value: A7 plans every scene output with that camera, with no note. Mock titles name the camera.
- Left side and Right side: disabled, tagged Coming later, and unchanged by a forced click. Never in any payload.
- Three views: 4 asked for. A7 plans `white_master`, `view_full_frontal`, `view_left_side`, `view_45_right`. The list marks Left side and the count says 3 of 4.
- Views by light: 10 asked for. A7 plans `white_master` plus 9 outputs, 3 cameras by 3 lights. The count says 7 of 10.
- A series locks the camera and the view. Views by light also locks the lighting. 01 has no camera, view, lighting or count note.
- White BK and Website: no `scope.camera`, no `scope.series`, no `styling`. A7 plans no people.
- Plants, mood and catalogue: absent from all 13 payloads the test checks. These include an old draft that still carried them.
- Visible text scanned in six states, case-insensitive and word-bounded. No internal terms found (Eye, Brain, Critic, n8n, A7, go 1, go 2, pipeline, model, provider names). No "Approved" without a recorded decision. No delivery time, pixel size or stylist promised.
- RTL: the image list and the notes mirror.
- No console or page errors.

## What was not checked

- **The real network.** Nothing was sent to n8n. The page does not reach A7.
- **The real result reply for a held image.** In mock mode a Left side image comes back as `status: "not_made"`. This is a mock shape I chose. How A7's result address will report an image held in stage 07 is not built and not confirmed.
- **Arabic and other languages.** None were written. Arabic copy needs a native review before use.
- **Screen readers.** I checked only basic labels: each card has a group or radiogroup label, and the Series and Camera cards point to their notes. Nothing was tested with a real screen reader.
- **Phone widths and browsers other than Chromium.** The test viewport was 1280 x 900.

## Assumptions

- The three series lights are A7's own presets: daylight, golden afternoon and warm evening. This follows 01.
- With Three views, the client's lighting choice (or the studio's choice) applies to all three images. 01 does the same.
- A Left side image is never made from this page. Stage 07 holds it, and its later images are held with it.

## Not built

- Left side and Right side camera views, which need a second photo upload.
- Plants, Mood / Vibes, and choosing Midas supporting pieces.
- Connecting to A7. That needs, each with the owner's go:
  1. an address for checking a result;
  2. the page changed to send to A7;
  3. `mock` set to `false`, and connect-src checked.

## To look at it

Host this folder with `taxonomy.js` and `atelier-hero.webp` beside `index.html`. These are unchanged copies of the project files, as for the earlier page. Then open `index.html#studio`. Mock mode is always on, so a bar at the bottom says that no request is sent.

## Leftovers

- New files: this folder, and `tests/claude-midas-a7-page/run_page2_mock.js`.
- Nothing was committed or pushed.
- No n8n workflows, executions or test rows were made.
- The test deletes its scratch copy of the page when it finishes.
