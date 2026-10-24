# Midas Virtual Studio client page: draft for "Claude · Midas A7"

16 Oct 2026. Written by Claude. Full build notes: `claude-outputs/claude-midas-a7-views-framing-README-2026-10-16.md`.

## Status

- A copy of `claude-outputs/claude-midas-studio-page/` (the job variations 2 page). That page is unchanged.
- **Not connected, mock mode only.** A7 has no sign-in or result address for a page yet. So the addresses in `STUDIO_CONFIG` are empty and `mock` is `true`. Nothing is sent anywhere.
- Checked in mock mode only: `node tests/claude-midas-a7-page/run_page_mock.js` (36 of 36, 16 Oct 2026).

## What changed from the copied page (owner, 16 Oct 2026, 04:16)

- **Image shape:** one list with all nine shapes, grouped:
  - "Standard for category (Square 1:1)": first and the default;
  - Square: 1:1;
  - Portrait: 4:5, 3:4, 2:3, 9:16;
  - Landscape: 5:4, 4:3, 3:2, 16:9.
- **Bare values:** the page sends `scope.aspect` as a bare value, such as `4:5`. "Standard for category" is sent as `1:1`.
- **White BK:**
  - the shape list is disabled and shows "White catalogue is always 1:1";
  - the views are locked, with a note;
  - one image;
  - no view is sent.
- **Website:** square, set for the package; four images.
- **Lifestyle:** the views decide the images: the white catalogue image first, then one image for each view.

  | View | Images |
  |---|---|
  | Category template | 4 |
  | Wide view | 2 |
  | Close-up | 2 |
  | Wide view + close-up | 3 |

- **Images in this request:** this card lists the images before submit. The hint and the button show the same number. The old 1-to-4 chooser is removed.
- **Results:** each result is titled by its view and labelled "Generated image".
- **Stored drafts:** they use their own keys (`midas.a7.*`). Old shape labels in a draft are read as bare values.

## To look at it

Host this folder with `taxonomy.js` and `atelier-hero.webp` beside `index.html`: unchanged copies of the project files, as for the earlier page. Then open `index.html#studio`. Mock mode is always on, so a bar at the bottom says that no request is sent.

## Before it goes live

1. A7 needs an address the page can use to check a result.
2. The page must be changed to send to A7.
3. Then `mock` can be set to `false`.

Each step needs the owner's go. Arabic copy needs a native review before use.
