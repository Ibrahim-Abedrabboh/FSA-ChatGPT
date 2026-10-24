# A7 decisions (14 Oct 2026, 22:30 Amman time)

## Decided by the owner
- **Architecture:** A, "Surgical replacement". Code decides each next stage; models do the reading, planning, image making and checking.
- **Design approved.** An animated stage-by-stage page was requested: `claude-midas-a7-stages-animated-2026-10-14.html`.
- **Images through Google, directly.** Fal.ai is not used for images.
- **Cost on the client page:** shown, and always labelled as an estimate.
- **Saved spaces and the chat box:** on hold until the workflow is shown to run as planned.

## Proposed, waiting for the owner
1. **Image model test.** The owner has said a budget is available. The test still needs a go in its own message, because it makes paid calls.
   - Run 10 products with known piece counts. Use the sectional sofa (cfdaefa8), the 12-chair dining set, the two chairs with the table crossed out, the towel and the bookends, plus 5 more.
   - For each product, make a white image and 1 lifestyle image with each model: `gemini-nano-banana-2.1` and `gemini-3-pro-image`, both at 2K. That is 40 images.
   - Use the same prompt and the same references for both models.
   - The owner judges each image blind, without knowing which model made it: piece count, shape, colour, handedness, then accept or reject. The two blind counters run on every image too, to measure them against the owner's counts.
   - Estimated cost is about $6.47:

     | Item | Estimate |
     |---|---|
     | 2.1 images | $1.28 |
     | Pro images | $2.79 |
     | Checks | $1.79 |
     | Planning | $0.61 |

     Proposed cap: $10.
   - Proposed rule for the decision: use 2.1 only if it makes no more count errors than Pro and its owner-accept rate is no more than 1 in 10 lower. Otherwise use Pro.
   - Setup needed first: a Gemini API key with billing, saved by the owner as an n8n credential. The key never goes into a file or a message.
2. **Image model until the test is done:** none goes live. The A7 build is tested with pinned data, so no model choice is needed to start building.
3. **Storage:** Google Drive, with one folder per project and job. It has a native n8n node, folders, sharing, and it stores a sha256 checksum per file. Google Photos is not suitable for this: since 31 Mar 2025 its Library API only reaches media the app itself uploaded, and it has no folders or file checksums. Google Cloud Storage is the fallback if volume grows.
4. **Client cost display.** Show a line such as "Estimated cost: X. The final cost may differ." Show the price before each paid step. Still to settle: the currency (KWD at 3 decimals?) and whether a markup applies.
