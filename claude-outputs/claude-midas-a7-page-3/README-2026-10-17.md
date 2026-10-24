# Midas Virtual Studio client page: draft 3 for "Claude · Midas A7" (Phase 5)

17 Oct 2026, Amman. Written by Claude. This is a new numbered copy. Draft 2 (`claude-outputs/claude-midas-a7-page-2/`) is unchanged, byte for byte: the test checks it against the last commit.

## Status

- **Draft. Not connected. Mock mode only.**
  - `STUDIO_CONFIG` has no addresses and `mock: true`.
  - The page's Content-Security-Policy is `connect-src 'none'`, so the browser itself refuses any request the page tries to send.
  - **The fonts are hosted with the page** (`fonts/`: Bodoni Moda and Jost, latin subset, SIL OFL 1.1, licences included). The page asks no other host for anything; the test checks that no request is tried at all. Draft 2 still asks Google Fonts.
- **Not published.** No paid call. No n8n change.
  - n8n was only read, on 17 Oct 2026: A7 `1cgZc9rmBOrPdKIe`, draft `eefd6c42-ea05-4de8-8a1b-3a7a1008ff4c`, not published.
  - The live `01 Intent & scope` and `02 Ingest files` code is identical to `n8n/claude-midas-a7/code-nodes/` in the repo. The test runs that repo copy.
- **Checked in mock mode:** `node tests/claude-midas-a7-page/run_page3_mock.js`: **256 of 256 passed** (17 Oct 2026, 02:0x), after the independent review's fixes and your 01:49 revision.
  - 17 payloads went through A7's own 01 and 02.
  - A deliberate break (sending the hero item, and accepting any approval label) made 54 checks fail. So the test does catch these faults.
- Draft 2's own test still passes: `run_page2_mock.js`, 78 of 78 on 17 Oct 2026. Its README records 100 of 100 on 16 Oct; I did not trace why the count differs.
- **F4 was not ticked in the start prompt.** I kept the room photo and photos of other sides as "Coming later". This is the "keep them as now" option, and it can be reversed.
- **Live page, pipeline 3, A7 and published workflows:** not touched.

## Revision, 17 Oct 2026, 01:49 (your notes: wider leaves I and II, a real product)

**Wider leaves**
- At 1440 px, leaves I and II are about 400 and 460 px wide; before, they were capped at 410 and 480 and shared space with the plan.
  - Leaf I: 390–500 px.
  - Leaf II: 430–560 px.
  - The plan takes the rest, at least 400 px.
- Groups have more padding.
- The three leaves stand side by side from 1,240 px; below that they stack, so the plan never gets squeezed.
- Frames scale with the screen, so two still sit side by side at 1,280 px.

**A real product in the frames**
- **Before a photo is added:** the frames show a real Midas product. It is the FAUVA reception chair in dark yellow (SKU 169741), from its catalogue photo on midasfurniture.com (`16-169741_f`), cut out from its white background.
  - The file is `sample/fauva-169741.webp`.
  - A line in the plan names it as a sample.
- **After the client adds a photo:** the frames show that product instead.
  - If the photo is on a white background, the page cuts the background away in the browser. Only white that touches the edges is removed, so white parts of the product stay. Nothing is sent.
  - If the photo is not on white, it is shown as it is.
  - The plan says the photo was "placed by this page to preview the plan. The studio makes the real images."
- The product sits at the scale of each view: whole on white, standing in the room for the hero, small for a wide view, and cropped for a close-up. It is turned for 45° right, and the chosen light falls over it.
- **Mock results** are now drawn from the same set and product, each marked "Mock picture n" on the image itself. They are still stand-ins, never studio results.

**A bug I found while checking by eye:** "Package complete" had a stray "null" printed beside it. I fixed it, and the test now checks the exact text.

**Test change:** the test now serves the page from a private test address (`https://studio.test/`) that is answered from the scratch copy. Every other request is aborted, and none was tried. A real address lets the page read its own pixels, so the cut-out is tested on a product-on-white fixture: it is cropped, and the white cushion inside it is kept.

**Please confirm:** is it fine to use Midas's own catalogue photo as the sample on this page?

## Design: what is new

The structure, colours and type are all new. Draft 2 was a landing page with a brief beside a result panel. The other design you sent was a sidebar with a chat box.

- **Concept: a folding screen.** It comes from the studio's reference photo: navy velvet panels with brass inlay.
  - The page opens on a **closed screen**: three velvet leaves with gold seams, the centre one arched. Sign-in sits on it.
  - On sign-in, the screen **folds open**. This is the only motion that plays on its own, and it is skipped when the browser asks for reduced motion.
- **Three leaves joined by gold hinges:**
  - **I The piece:** the photo, the item, the pieces in the photo, and Keep faithful.
  - **II The setting:** outcome, views, series, camera view, proportions, resolution, light, wall, floor, finishing touches and instructions.
  - **III The plan:** this becomes the result.
- **The plan is drawn, not listed.**
  - Each image in the request hangs from a brass picture rail as an empty frame, at its real proportions.
  - Each frame is tinted with the chosen wall paint, floor and light.
  - The piece is drawn at the scale of its view: small in a wide view, cropped in a close-up, turned for 45° right.
  - When results come back, the same frames fill in. Images that arrive early fill their frames while the request is still in production.
- **After sending,** leaves I and II fold into narrow spines with vertical titles, so the result gets the width. "Request a change" opens them again.
- **Narrower than 1,100 px,** the leaves stack and fold like an accordion. A dock at the bottom shows the image count and links to the plan.
- **"How it works"** is a dialog. It holds the five steps, the outcomes, every label's meaning, and questions.
- **Colours (your references of 17 Oct):**

  | Colour | Hex | Used for |
  |---|---|---|
  | Navy | `#0D1B2A` | ground |
  | Midnight | `#122C4F` | velvet |
  | Pearl Perfect | `#FBF9E4` | the lit plan and result |
  | Antique Gold | `#C99A47` | seams, choices, actions |
  | Champagne | `#E6C17A` | gold text on navy |
  | Ocean | `#5B88B2` | the "Passed automatic checks" pill |
  | Noir | `#000` | text on pearl, the mock bar |

  - Bronze `#8A6526` is gold darkened, so gold text on pearl passes contrast (5:1).
  - The text pairs I checked by calculation are 4.5:1 or better.
- **Type:** Bodoni Moda for display, Jost for text. Both are new to this project; draft 2 used Playfair and Manrope, and the zip used Newsreader and Manrope.
- I could not read either `DESIGN.md`. They are Project files, not in the repo. The wording rules from the start prompt are applied. The colours follow your references of 17 Oct, which replace the brand file's colours for this draft. **Please check against both files.**

## What changed from draft 2

### P5.1 Result address: contract and mock only

- `result-contract.md` defines `midas-result/1`:
  - how the page asks;
  - refusals;
  - request states `not_finished` / `finished`;
  - the per-image states `in_production`, `passed_checks`, `on_hold`, `not_made`, `approved`, `changes_requested`, `not_approved`;
  - `client_shown_as`;
  - how the package is marked complete.
- The page reads it in `readResult()`. The labels follow your rules:
  - **Generated image** is on every picture.
  - **Approved** and **Approved by the studio** show only when all of these hold:
    - `state` is `approved`;
    - a decision time is recorded;
    - `client_shown_as` is exactly one of those two strings.

    The page never picks between them. Any other label, such as "Approved by the studio · not reviewed", shows **Decision not readable**, never approval.
  - Passing the checks is never shown as approval.
  - A held image is **Not made**, with a plain reason and no picture.
  - **Package complete** shows only when all of these hold:
    - the studio says the package is complete;
    - every planned image is approved;
    - the request is finished.

    Otherwise it shows **Package incomplete**, with one line on why.
- **Mock:** 15 result scenarios in the mock bar follow the contract, among them:
  - arriving one by one, partial, held / not made;
  - approved, approved by the studio, some approved, approved with the package still open;
  - changes asked, not approved, unreadable label;
  - Website complete and incomplete;
  - expired link.

  The mock bar also sets five non-contract states: not finished until timeout, unknown request, signed out mid-run, address unreachable, and the sign-in and sending replies. Mock pictures are plain navy stand-ins marked "Mock picture n". They are never the client's own photo.
- **A7 side: a proposal only.** See `result-contract.md` §5. **No webhook or node was added.**

### P5.2 Offer only what A7 delivers

I checked every option against `01_Intent_scope.js`.

| Page option | Sent as | 01 reads it as | Result |
|---|---|---|---|
| Outcome (3) | `scope.outcome(s)` | outcomes | kept |
| Views (4) | `scope.view` | `VIEWS` | kept |
| Camera: As photographed, Full frontal, 45° right | `scope.camera` | `cameraOf()` | kept |
| Camera: Left side, Right side | not sent | gated in 19a | Coming later (as draft 2) |
| Series: Single image | `scope.series` | series '' | kept |
| Series: Three views, Views by light | not sent | owner D12 | Coming later (as draft 2) |
| Proportions (9 + standard) | `scope.aspect` | `shapeOf()` | kept |
| Resolution | `scope.resolution` | resolution | kept |
| Lighting / wall / floor / studio choice | `preferences.*` | preferences | kept |
| Human presence | `styling.human` | people | kept |
| Colour, material | `metadata.color/material` | colour, material | kept |
| Details to preserve | `metadata.locks` | joined into instructions | kept |
| Things to exclude | `metadata.must_not` | exclusions | kept |
| **SKU** | `item.sku` | sku | **added** |
| **Dimensions** | `item.dimensions` | dimensions | **added** |
| **Pieces in the photo** (rows: how many + piece) | `item.inventory` | inventory, inventory_total | **added** |
| **About the product** | `item.description` | product_notes | **added** |
| **Instructions for the studio** | `instructions` | instructions | **added** |
| Hero item or focus | **no longer sent** | listed as "not used" | **now Coming later** |
| Plants, Mood, Midas supporting pieces | not sent | listed as "not used" | Coming later (as draft 2) |
| Room photo, photos of other sides | not sent | `room` / `other_view` in 02 | Coming later (F4 not chosen) |

Notes on the added fields and limits:

- **A truncation risk I found and closed.** 01 joins the instructions and the details to preserve into one text of at most 1,200 characters, instructions first, so long instructions could cut off details to preserve.
  - The page now limits instructions to 500 characters and details to preserve to 600.
  - It also checks the joined length exactly as 01 builds it. If the total is too long, it refuses to send, with a plain error.
  - Tested at the longest lengths.
- **Pieces:** a row with a name but no valid count (1 to 199) blocks sending, with a plain error.
- **Unchanged from draft 2:** `metadata.product_category`, `scene`, `light` and `delivery` are still sent. 01 does not read them, but they are not client options. I left them so the payload stays close to draft 2's tested shape.

### P5.3 (F4): Coming later

- The room photo and the photos of other sides show as two dashed slots beside the product photo, tagged "Coming later". They have no input and are never sent.
- With one photo and no `references` role other than the product, 02 registers the photo as `product` and sets no `room_key`. The test checks this on every payload.

### Wording and trust

- No internal terms anywhere a client can see. The test scans the whole visible page and the "How it works" dialog for:
  - Eye, Brain, Critic;
  - n8n, A7, workflow, pipeline;
  - go 1, go 2;
  - model and provider names;
  - "not reviewed".
- No promised delivery time, pixel size, retention period or human stylist. The test scans for these too.
- English first. Every visible string is in one `STRINGS` table, and layout uses logical properties only.
- Under `dir="rtl"`:
  - the three leaves run right to left;
  - the frames hang right to left;
  - the switches and tags mirror.

  The mock bar has a direction switch for checking this.

### P5.5 Arabic

- `strings-ar.draft.js` is marked **"NEEDS A NATIVE REVIEW BEFORE USE"**. The page does not load it.
- It has the same 451 keys and the same placeholders as English (tested). I wrote the Arabic for the 7 keys added after the first draft myself; they need the same native check. It keeps SKU, JPG/PNG/WebP, 2K/4K, ratios, MIDAS and White BK in English.
- **Points for the reviewer first:**
  1. **Approval labels.** "Approved" is «معتمدة». "Approved by the studio" is «معتمدة بقرار من الاستوديو». Do they read as distinct, and the second not as "unreviewed"?
  2. **Plurals.** Arabic numbers need forms for 1, 2, 3–10 and 11+. Strings like «{n} صور» are wrong for 2 and 11+. This needs a plural function in the code before Arabic can be used.
  3. **Gender agreement.** The statuses are feminine.
  4. **Outcome names.** «نمط الحياة» for Lifestyle and «الموقع الإلكتروني» for Website, or keep them in English?
  5. **Colour names and time units.**
  6. **«قريبًا» for "Coming later".** It can read as a timing promise.

## Independent review (17 Oct 2026)

A separate agent reviewed draft 3 against the start prompt, A7's 01 and 02, and draft 2. It made no edits. It reported 20 findings: 15 confirmed, 4 plausible, and 1 a wording judgement. I fixed 18 and left 2 for your decision.

**Label rules**
- A picture that arrives during production now carries "Generated image". Only ready pictures fill their frames, and "So far x of n" counts only those.
- An unknown image state shows no picture; the image is read as Not made.
- An on-hold image always shows a reason, with a fallback if none was sent.
- "Package complete" also needs the page's own planned count.

**Data the page sends**
- 01 cuts each detail to preserve at 160 characters and each thing to exclude at 80. The page now refuses longer lines with a plain error instead of letting them be cut.
- A file with no file type is refused, because 02 would not see it as a photo.
- Lighting and "Let the studio choose" are hidden for White BK and not sent, because 01 gives the white image no light.

**Sending and checking**
- While a request is being sent, the brief, "New request" and "Sign out" are locked. What was sent is fixed before the reply arrives.
- Checks for results are paced across every button, and "Check result" waits while a request is in production.

**Privacy**
- Signing out clears the photo and the unsent reference from the tab.

**Wording**
- The announcement and the lead follow the real outcome, never a fixed "ready".

**Other**
- Unknown check ids are not shown.
- The fonts are now hosted with the page.
- The pieces list markup was corrected.
- The RTL chevron and the opening fold now mirror.
- The "one not made" mock is now consistent.
- The New-request dialog says that a request already sent stays in the list.

**Left for you:**
1. **On-hold pictures.** Should a picture that failed review (on hold) be shown to the client with its reason, as draft 2 did? Today it is shown.
2. **"2K" / "4K".** These are resolution options carried over from draft 2, and A7 uses them. The start prompt bans promising a pixel size. Is "2K" acceptable wording?

**Not changed:**
- The extra draft-2 payload fields that 01 ignores are kept, and the code comment now says so.
- Drafts and earlier requests are still kept per device and matched by client name, not by account id. A real account id needs the sign-in that does not exist yet.

**Fixed but not tested:** the lock while sending and the pacing of checks. I traced both in the code; the test does not exercise them.

## What was checked, and how

Headless Chromium ran a scratch copy of this folder with `?mock=1`. Every http(s) request was set to be aborted, and **the page tried none**.

**Payloads (17 sent), each through A7's own 01 and 02, read only**
- Every view, every camera, three shapes (4:5, 16:9, standard), every lighting, wall and floor, studio choice, human on and off, White BK and Website, all the new fields, and the longest texts. All 10 shape values were also checked in the drawn plan.
- For each payload:
  - 01 accepts it;
  - 01's "not applied" list is **empty**;
  - the page's image count equals 01's planned outputs;
  - 02 registers the photo as the product, with no room photo and no file without a role;
  - no "Coming later" key appears anywhere in it.

**Coming later**
- Every "Coming later" choice is disabled, and a forced click selects nothing.
- The later rows and slots have no inputs.

**Blocking**
- Each of these blocks sending, with an error beside the field and a summary that takes focus:
  - no photo;
  - a piece count of 0;
  - instructions too long together;
  - a detail over 160 characters;
  - a thing to exclude over 80 characters.
- A file with no type is refused, and the earlier photo stays.
- Signing out clears the photo.

**Result view against the mock contract**
- All 15 contract scenarios listed above, including held and partly ready packages.
- Production while images arrive: "So far 1 of 3…", with no headline and no "complete".
- Unknown request and address unreachable, each with "Check again" and/or "Back to your brief".
- Signed out mid-run.

**Phone width (375 px)**
- No sideways scroll in the brief, the result (alone and beside the photo), RTL, or the notes.
- The dock is visible.

**Keyboard**
- Tab reaches "Open the studio" and Enter opens it.
- Arrow keys move through the outcomes, and the focused choice shows a ring.
- Enter folds and opens a leaf.
- Submit by keyboard puts focus on the error summary.

**Basic labels**
- Every control has a name.
- Every radio group is labelled.
- Every image has alt text.
- The fold buttons carry `aria-expanded` and `aria-controls`.

**RTL at 1280 and 375 px:** the layout mirrors, as listed above.

**Other**
- No page errors or console errors.
- Draft 2 is unchanged against the last commit.
- `taxonomy.js` is an unchanged copy (same sha256).
- No key, token or secret is in the page files.

**Independent review:** see the section below.

## What was not checked

- **The real network.** Nothing was sent anywhere, and the page cannot reach A7. There is no result address.
- **Real result data.** The contract is mine. How A7 will report each state (for example, a 19a hold as `not_made`) is a proposal, not built.
- **Screen readers.** Only basic labels and focus were checked, not NVDA or VoiceOver.
- **Browsers other than Chromium,** and real phones.
- **Arabic in the page.** The Arabic draft is not loaded, and RTL was checked with English text only. Mixed-direction punctuation then looks odd, which is expected.
- **Contrast** was calculated for the main pairs, not measured on every state.
- **The mock "Not finished until timeout" case** was not run in the test. Its code path is the same as draft 2's.

## Assumptions

- **F4 = Coming later,** because the start prompt left it unticked.
- **A reviewed approval is "Approved"** to the client, and approval by eye is "Approved by the studio". This follows your 21:28 answers and A7's G2/18l code.
- **"Package complete"** means every image has your approval and the package step says complete. Passing the checks alone is not complete.
- **Your reference colours of 17 Oct replace the brand file's colours** for this draft.

## A7 changes this page needs (proposal; your go for each)

1. A separate result-address workflow: access-code auth, a lookup by `client_run_id`, and the mapping to `midas-result/1`. See `result-contract.md` §5.
2. **Decision P5.1-a:** how the access code is checked. A7 has no client sign-in yet. Its webhooks use the `X-Midas-Key` header, which must never be in a public page.
3. **Decision P5.1-b:** where the run record is stored, so the result address can read it. Today 02 says permanent storage is not connected.
4. **Then:** `STUDIO_CONFIG` addresses, `mock: false`, and `connect-src` set to that one address.

## Leftovers

- **New files:**
  - this folder (`index.html`, `app.js`, `styles.css`, `fonts/`, `sample/`, `taxonomy.js` as an unchanged copy, `result-contract.md`, `strings-ar.draft.js`, this README);
  - `tests/claude-midas-a7-page/fixtures/product-on-white.png`, a drawn test fixture;
  - `tests/claude-midas-a7-page/run_page3_mock.js`;
  - a copy of this README at `claude-outputs/claude-midas-a7-page-3-README-2026-10-17.md`.
- **Committed and pushed to a new branch, `claude/phase-5-page-3`.** `final` is not touched; merging is your call.
- **No n8n workflows, executions or test rows were made.**
- The test deletes its scratch copy of the page when it finishes.

## To look at it

Open `index.html?mock=1` from this folder. Choose **Open the studio**. Use the mock bar at the bottom to switch the result scenario and the text direction.
