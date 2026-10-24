# Midas client page A6: Go / Stop for the studio team

Date: 14 Oct 2026, 14:45 Amman time.

## Status
- **Not published.** The live site (claude-midas-studio-a6-live.netlify.app) is unchanged.
- **No real request was sent.** All checks ran in mock mode or with simulated replies inside the browser.
- **No n8n change.** The page uses A6's existing decision address.

## What changed
This build starts from the files live on 14 Oct (app.js, index.html, styles.css, taxonomy.js, atelier-hero.webp). Only app.js, index.html and styles.css changed. The taxonomy and the hero image are byte-identical.

1. **A Go / Stop panel in the "Waiting for a go" view.** It is a closed section headed "For the Midas studio team: give the go". It appears only while the request waits for a go. It disappears once the request moves on, stops or finishes.
2. **At the first stop, the panel shows the plan:**
   - the product type and the pieces read from the photo
   - what is not confirmed
   - each image with its role, frame, setting, light, arrangement and props
   - whether the run will stop again
3. **At the second stop, the panel shows the white catalogue image.** The image is labelled "Generated image". The text says it is "a reviewed candidate, not an approval".
4. **The panel needs the owner key, not the studio key.**
   - The key is read from its own field for one call. The field is then cleared, whatever the outcome.
   - The key is never stored, never put in an address and never logged by the page.
   - The studio key stays in use for every other call.
5. **Answers are sent to the decision address** (`claude-midas-vton-a6-decision`) as `{"id": "<job id>", "decision": "go" | "stop", "note": "..."}`. The note is optional and left out when empty.
6. **Stop needs a second press within 8 seconds.** Enter in the key field sends nothing.
7. **Replies are shown in plain words:**
   - go recorded
   - stop recorded
   - owner key refused (the studio key session is kept)
   - not recorded, with the studio's reason
   - studio not reachable
8. **Reloading while a request waits checks at once.** The panel appears without the one-minute wait.
9. **Mock mode changes:**
   - The mock bar has a new "Owner go" choice: Recorded, Owner key refused, Not recorded, Network failure.
   - The "Result" choice has "Waits for one go" and "Waits for two goes".
   - Both now wait until you answer in the panel. Before, "Waits for a go" moved on by itself after a few checks.

## Checked, and how (14 Oct, headless Chromium 141, `tests/test_owner_go.py`): 45 of 45 passed
- **Two goes, end to end:** plan, then go, then the white image, then go, then results. The panel hides while images are made.
- **Plan content:**
  - pieces, image list, roles and frames are shown
  - the second-stop sentence appears only when the run will stop twice
  - no internal terms (n8n, provider, model, Eye, stylist, critic, webhook) appear in the panel
- **Sending:**
  - No key: nothing is sent.
  - Enter in the key field: nothing is sent.
  - The go sends the right job id, decision and note.
  - The key field is empty afterwards. The key is in neither local nor session storage.
- **Stop:**
  - The first press sends nothing. The second press sends "stop".
  - The page then shows "stopped before any image".
- **Failed answers** (key refused, problem, network): each shows a clear message. The form stays for another try, and the studio sign-in is kept.
- **Normal requests:** a request that never waits shows no panel and finishes as before.
- **Phone width (380 px):** no sideways scrolling.
- **Simulated studio replies, not mock mode** (every request to the studio address is answered inside the browser):
  - Exactly one go is sent, and it carries the owner key.
  - The body is `{"id": <reference shown on the page>, "decision": "go"}`.
  - Every other call keeps the studio key.
  - Nothing left the browser.
- Screenshots are in `shots/`. They contain no keys.

## Not checked
- **A real go against A6.** The decision address and its reply shapes were read from A6 in n8n on 14 Oct, but not called.
- **That your owner key works.** As of 14:29 it was still refused in Terminal. The page sends the same header, so it will be refused too until the owner credential in n8n holds the key you type.
- **Live CORS for the decision address.** It has the same setting (`*`) as the addresses the page already calls successfully.
- **Screen-reader use, a right-to-left layout, Arabic text.**

## Assumptions
- **The panel only covers the request this browser is tracking.** A request sent from another device or browser cannot be answered from here. For that, use the Terminal command or an owner page.
- **The owner key is typed into the client page.** You chose this over a separate owner page. A client can see the closed section, but cannot use it without the owner key.

## Not built
- A separate owner page, and answering any request by its reference.
- Owner decisions on finished results (accepted / changes requested / rejected). The address supports them; the page does not offer them.

## Known issues outside this page (unchanged)
- **n8n keeps the full request headers of every live run.** That includes the studio key and, once used, the owner key. Hiding run data for A6 is still waiting for your yes.
- **The white catalogue image is asked for with the client's lighting choice** (for example "Warm evening") as well as studio light.

## To publish (only on your word)
Upload the six files in `site/` to Netlify site d49957a3-e308-4ff1-bd5b-6bad2a61f167, then check that the live files match:

| File | sha256 |
|---|---|
| app.js | a4672b96c0a84c43a32d621d964aa6e83369a254396796c47a946c79c999dff1 |
| index.html | d8bc5b616c752aeb1c4fff3bd1c410fef621eef60ddd19e2eb2126452a51660d |
| styles.css | d109965c9bc58d59c1ca9dce26af16a9b18ad227d3582174f99c72fd92630827 |
| taxonomy.js | 76750387380a5cc61e9cef4edd5b9d49e934894b33e0b99063eb95cd90b5b5e1 |
| atelier-hero.webp | c2d27e0d87e593faa8ec1a56fbfa6b277c8f56dad47b2c76940fc6a04fbd9e68 |
| _headers | e941a51e4a3214b407bc19a87b1e334d5e34944394be80859d9396f456eb05cb |

## Leftovers
- **None in n8n or Netlify** from this build.
- **The project knowledge is almost full** (1,999,048 of 2,000,000). This build was not written into the project. Keep this folder, or free space and add it as `claude-outputs/claude-midas-studio-site-a6-go/`.
