# Midas Virtual Studio client page: build report

Built by Claude on 5 October 2026 from build prompt version 2, then rebuilt the same day as the **studio workspace** (outcome tabs, one-panel brief, result stage, recent list) drawn on the design canvas. The page was run in mock mode only. No request was sent to the live studio addresses, and no access code appears in any file.

## If the page looks broken

`index.html` cannot be opened on its own. It needs `styles.css`, `app.js`, `taxonomy.js` and `atelier-hero.webp` beside it; without them it shows as unstyled, with no text, because every string is filled in by `app.js`. That is what happens when the file is viewed alone in a document preview.

To look at the design, open **`midas-studio-preview.html`** instead (delivered beside this folder). It is the same page as one self-contained file with mock mode switched on, so it opens anywhere and never sends a request. Host this folder, not the preview file, for the live page.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Every visible string is filled in by `app.js`. |
| `styles.css` | Midas colours on the landing design you approved. |
| `app.js` | `STUDIO_CONFIG`, the `STRINGS` object, sign-in, brief, submission, progress, results, recent requests, mock mode. |
| `taxonomy.js` | Unchanged copy of the project file (sha256 `76750387…b5b5e1`, 247 nodes). |
| `atelier-hero.webp` | Unchanged copy of the project file. |

## Try it

Open `index.html?mock=1`, from a web server or straight from disk. A black bar at the bottom says "Mock mode: no request is sent" and lets you pick the reply for sign-in, submission and result. Mock mode uses short timings (first check after 2.5 s, time-out after 9 to 12 s) so every state shows in seconds.

- **The page has two views.** The landing page, and the studio at `index.html#studio` ("Create a new request" and "The studio" go there). In the studio the landing sections and the footer are hidden.
- **Sign-in is skipped in mock mode by default**, so the inner screens open at once as "Demo client". To see the sign-in, choose any other option under "Sign-in" in the mock bar and press "Sign out", or open `index.html?mock=1&signin=limit#studio`. Any text works as the access code in mock mode.
- **Without `?mock=1` the sign-in is always there**, and the page calls the three addresses in `STUDIO_CONFIG`. The studio refuses every call without an access code, so the live page cannot skip it.

## The workspace

| Part | What it does |
|---|---|
| Outcome tabs | Lifestyle, White BK, Website. "New Composition", "Create with this item" and "Edit a result" are shown as "Coming later"; they cannot be chosen and nothing about them is sent. |
| Your brief (left) | One panel of cards: product photo, the item, number of images, views, proportions, resolution, room atmosphere, lighting, wall paint, floor, finishing touches, keep faithful. Each card shows its current value in its heading, so the panel is also the review. |
| Submit area | A line saying what to expect, "Submit request" with the image count, and the monthly usage. Locked while a request is in production. |
| Result (right) | Empty stage, then progress, then the images, in the same place. |
| Recent requests | The last 20 requests sent from this browser, with "Check result". |

## Before it works live

1. Publish the workflow `Claude · Midas job request pipeline variations 2` in n8n. It was unpublished when I read it on 5 October.
2. Host the five files together on one address.
3. In n8n, set `allowedOrigins` on the webhooks to that address. It is `*` now.
4. If you change the addresses in `STUDIO_CONFIG`, change `connect-src` in the Content Security Policy line of `index.html` to match.
5. Do one real sign-in and one real one-image request. That is the first test of everything listed under "Checks not run".

## Checks run

All in headless Chromium, mock mode, with every request to anything but localhost blocked and recorded.

- **157 scripted checks, 157 passed.** They cover:
  - The two views: landing to studio and back, focus on arrival, landing sections hidden in the studio, live mode still asks for the sign-in.
  - Sign-in: empty code, `access_denied`, `access_off`, network failure, accepted with and without a limit, sign out, mock preview.
  - Brief: four departments only, category cascade, wrong file type refused, photo preview, card headings follow the choices, "Coming later" tabs cannot be chosen, Website hides count and views and locks proportions and resolution, White BK hides wall, floor and finishing touches, "Let the studio choose" clears and locks, earlier choices return when the outcome is switched back.
  - Payload: compared field by field with the contract for Lifestyle, White BK, Website and studio choice. The access code is not in it.
  - Submission: missing photo, accepted, `duplicate`, `limit_reached`, `try_again`, `bad_request`, network failure, signed out. A retry keeps the same reference; a changed brief gets a new one. Submit is locked while a request is in production and opens again when the result arrives or the checks stop.
  - Progress: time-out, `unknown_request`, address unreachable after exactly three failed checks, signed out mid-run and resumed after sign-in, reload mid-run, no checks while the tab is hidden.
  - Results: all passed, partial, hold, Website complete and incomplete, approved, changes requested, not approved, expired image link, side-by-side comparison, comparison hidden after a reload, "Request a change" keeps the choices, "Start a new item" clears them.
  - Storage: the access code is in `sessionStorage` only, not in `localStorage`, the page or the address; the draft, the pending request and the recent list hold no code and no file.
- **Layout:** no horizontal scrolling on the landing page, the workspace and the results at 320, 390, 640, 768, 899, 900, 991, 992, 1024, 1099, 1100, 1280, 1440 and 1920 px wide. The two panes sit side by side from 992 px and stack below it (640 px is a 1280 px window at 200% zoom).
- **Short screens:** at 992 px and wider, a window 900 px tall or more gets the one-screen workspace with its own scrolling panes. A shorter window (most laptops) scrolls as a page, with Submit fixed to the bottom of the brief and the result held in view. Checked at 992×700, 1024×768, 1280×720 and 1366×650. On 1366×650 I tabbed through every brief control: none ended up under the Submit area.
- **Accessibility, automated:** axe-core 4 with the WCAG 2.0, 2.1 and 2.2 A and AA rule sets, on 43 screen states at 1440×900, 1366×650 and 390×800: 0 violations. It could not judge contrast over the hero photo and the gold glow.
- **Contrast, calculated** for the workspace colour pairs: red on white 6.7:1, muted text on the grey panel 5.8:1, muted text on the gold-tinted page 5.9:1, white on the red Submit button 6.7:1, white on a locked selected option 6.3:1, control borders 3.3:1 to 3.5:1.
- **Targets:** every button, tab, tile, chip, switch and select in the workspace is at least 24 by 24 px at 390 and 320 px.
- **Keyboard:** sign-in, outcome tabs (arrow keys never land on a "Coming later" tab), tiles, switches and Submit were worked with the keyboard only. Focus moves to the brief heading after sign-in, to the error summary on a failed submit, to the progress heading after submission and to the result heading when it arrives. Enter in a one-line field does not submit.
- **Single-file preview:** 22 checks passed with the file alone in an empty folder and inside a locked-down frame that has no storage, cannot change its address, blocks form submission and blocks browser dialogs (how in-app previews show a file). Landing page, workspace, the start-new question, submit, progress and results all worked.
- **Opened from disk:** the page loads from a `file://` address with the Content Security Policy in place.
- **No access code in any file:** searched the folder for long random strings and for the test code.

## Checks not run

- **Anything against the live addresses.** Unconfirmed: whether the browser can read a refusal from another site, how n8n receives the photo from a real upload, and the real HTTP status codes.
- **The real web fonts.** Google Fonts was not reachable from the test machine, so screenshots used fallback fonts.
- **Browsers other than Chromium**, real phones, a screen reader, and Windows high-contrast mode.
- **A 25 MB photo** and a slow connection.
- **Right-to-left.** The CSS uses logical properties, but the page was not switched to `dir="rtl"`. The hero scrim is drawn left to right and would need a second rule.
- **Hero contrast** was measured on the first build (small text at least 6.9:1, headline at least 4.0:1) and not measured again; the hero styles were not changed.
- **A security scan.** The HawkScan tool configured for this workspace is not installed here and has no API key. I did not run it; a crawler would also press "Sign in" against the live address. In its place I checked by hand: no `innerHTML`, every studio reply is written as text, image links are limited to `https:`, and the page carries a Content Security Policy.
- **WCAG conformance as a whole.** The checks above are what was tested; they are not a conformance claim.

## Where I departed from the prompt, and why

| Prompt | What I did | Why |
|---|---|---|
| A brief in six steps with a review step | One workspace: outcome tabs, a single brief panel, the result beside it | You asked for the layout of the reference screen. Each card heading shows its current value, which replaces the review step. |
| Job cards: new project, edit, single item; one by one or batch | Three "Coming later" tabs next to the outcomes | Only one job type works today. The page still sends `jobMode: new_project` and `workOn: one_by_one`. |
| Sign-in section on the landing page | Sign-in lives in the studio view; mock mode skips it by default | You asked to drop it while reviewing the inner screens. Live mode keeps it because the studio refuses calls without a code. |
| Progress and results as their own screens | Shown in the result panel; the brief stays beside them | Same reason as the first row. Submit is locked while a request is in production so a second paid request cannot be sent by accident. |
| Recent requests as a page section | A panel under the result | It belongs with the result it reopens. |
| Nearly square inputs | Inputs are 10 px, panels 12 px, actions are pills | You asked for Midas colours on the `DESIGN.md` and `LAYOUT.md` structure; shapes follow that file. One CSS value changes it. |
| Nord for interface text | Manrope, with Space Grotesk for labels; Playfair Display for headings | No Nord files were supplied, and the Midas design system notes that Nord is capitals-only. These match the landing page. |
| No shadows | One soft shadow, on the floating navigation only | It is the brand's own dropdown shadow; everything else is flat. |
| Header, hero, How it works, then sign-in | Three more public sections: Outcomes, Review, Questions | Carried over from the landing page you saw. |
| Scrim behind hero text at all widths | Below 900 px the photo moves under the text | A scrim strong enough for 4.5:1 there would hide the photo. |
| Put the rest of `package` in the details panel | Views passed and missing, limitations, and Midas pieces are shown; cost, lineage and profile are not | Those three carry model and provider names, which the prompt bans from client view. |
| Check names from the prompt's list | Mapped from the 11 names the workflow really sends; two extra labels added ("Product type checks", "Midas supporting pieces") | Read from the workflow definition. The top-level `checks` field is always empty; checks are per image. |
| "Image 2, close-up" | Website images are titled by role: catalogue on white, hero, wide view, detail | The reply carries the role, and it is clearer for a package. |
| Poll at 30 s then 15 s | Same in live mode; mock mode uses 2.5 s and 1.5 s | So the time-out can be seen without waiting 8 minutes. |
| Usage from the sign-in reply | After an accepted request the page adds the images asked to the count it shows | The studio only reports usage at sign-in. The next sign-in corrects it. |
| Code in `sessionStorage` | The client name and usage are kept there too | Saves one paid sign-in call on every reload. |
| "Download" per image | A link with the `download` attribute | For a file on another site the browser may open it in a new tab instead. A true download needs the image host to allow it. |
| Not in the prompt | Content Security Policy line in `index.html` | Limits scripts to this folder and network calls to the studio address. |
| Browser confirm box before clearing a draft | A small dialog in the page: "Keep my draft" or "Start new" | Browser confirm boxes are blocked inside embedded previews, where the button then did nothing. |
| Not in the prompt | In-page links switch the view in script; "Sign in" and "Submit request" are plain buttons | So the page also works where the address cannot change and form submission is blocked. Browser Back still works on a normal address. |
| Not in the prompt | Mock bar; Enter in a one-line field does not submit the brief | Testing aid; avoids a paid request by accident. |

## Notes for whoever maintains it

- A sub-category is sent as its visible path, for example `Sofas / Sectional Sofas`.
- For White BK the page sends empty wall and floor, no plants, no people, no supporting pieces and mood `Automatic`. The cards are hidden and a note says why. The client's own choices come back when the outcome is switched back.
- "Wide view + close-up" alternates the two views; it does not double the number of images. The line above Submit says so.
- A request reference is created when "Submit request" is pressed, stored before sending, and kept until the request is accepted or the brief changes.
- "Start a new item", "Create a new request" and signing out stop the checks for the request on screen. It stays in "Recent requests on this device" with "Check result".
- One request at a time: the page watches a single request. An earlier one is reopened from the recent list.
- On a phone the brief is one long column and Submit is at its end. A fixed Submit bar there would cover fields while typing, so I left it out.
