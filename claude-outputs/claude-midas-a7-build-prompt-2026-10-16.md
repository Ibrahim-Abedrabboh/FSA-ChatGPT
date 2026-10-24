# Claude · Midas A7: build prompt for the prompt and intake fixes

16 Oct 2026, 06:45 Amman. Written by Claude. It replaces the "Prompt for the next session" in section 08 of the F1 Options page, which should not be run (see `claude-midas-a7-prompt-check-2026-10-16.md`, section "The F1 page's build prompt (section 08) against A7 today"). Paste everything below the line into the session that will build it.

---

You are continuing the Midas Virtual Studio work on the n8n draft "Claude · Midas A7 (stages 01–07)", id `1cgZc9rmBOrPdKIe`. The last known version is `a22b6f1a` (16 Oct 2026, 05:09 Amman): not published, never run, no paid call ever made by A7.

## Read first, in this order

1. The project instructions (Project "Midas Furniture styling").
2. `claude-outputs/claude-midas-a7-prompt-check-2026-10-16.md`. **This is your work list.** It names every defect (P1–P6, S1–S8, C1–C4, F1–F4), the evidence for each, and the owner's open decisions (D1–D8).
3. `claude-outputs/claude-midas-a7-coverage-register-2026-10-15.md` (owner decisions 1–21 and open points).
4. `claude-outputs/claude-midas-a7-views-framing-README-2026-10-16.md`, `claude-midas-a7-stage-07-README-2026-10-16.md`, `claude-midas-a7-scene-files-README-2026-10-16.md` and `claude-outputs/claude-midas-a7-page/README.md`.
5. The repo: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, branch `main`, commit `13deb8a` or later (it holds the helper scripts used below). Clone it.
6. A7 itself, from n8n, with `get_workflow_details`. n8n is the authority. Read the version history and the last-saved time. If the version is not `a22b6f1a`, or another session saved it in the last hour, stop and ask the owner before editing.

The F1 Options page (`https://claude.ai/artifact/Y5i4pMHDQ5shvZcvtGLUWp`) is a reference only. Its sections 07 and 08 are out of date. Do not port its prompt builder: it conflicts with the owner's decisions. Use from it only what this prompt names.

## Ask the owner once, at the start

Put decisions D1 to D8 from the prompt-check doc to the owner in one message. If no answer arrives, build with the default below and list the decision as open. Each default keeps today's behaviour or is the stricter choice, and each sits behind a setting in 04 Settings so it can be changed without code.

| # | Decision | Default if no answer |
|---|---|---|
| D1 | People in scenes | None. The planner is told "no people". The page shows Human presence as "Coming later". |
| D2 | Warm, night and twilight light without generic lamps | The planner is told the light preset as a fixed fact. No lamp is added unless a Midas lamp is confirmed in stock. The lamp conflict (P4) stays listed as open. |
| D3 | Camera tilt for dining sets and sectionals | 0° pitch, unchanged. |
| D4 | Midas cushions on a seating product | 10 Retrieve does not offer cushions or throws for seating products (sofa, recliner, chair, bench). |
| D5 | An A7 copy of the handling profiles in general wording | Build it as a new table; leave the shared table `KTTMJZ0Wh84cAyDm` unchanged. The owner reviews the wording in the README. |
| D6 | Side views | Not built. Hold, as decision 3 says. |
| D7 | Pre-order Midas pieces | No change to the code. Listed as open, with the code/README disagreement. |
| D8 | Scene approval | Each scene keeps its own go 2, as built. |

## Build: part A, prompt fixes (13 Compile, 04, 11, 11a, 11c, 12, 16a, 16x, 16b, 07a)

Fix each item exactly as the prompt-check doc describes it:
- **P1** the rug framing guide only when a Midas rug is a confirmed piece of that scene; otherwise "the floor meets the bottom edge of the frame".
- **P2** a new data table "Claude Midas A7 handling profiles" with the same columns and rows, the rule text in general wording (no motif, swatch, colour or pattern of one particular product), and F1's kind of qualifier: these are rules for this kind of product, not facts about this product. Fix the duplicate "trolley" row. Point 07a at the new table.
- **P3** the planner (11 instructions, 11a message) and the plan critic (11c) follow the stage 07 rules: Midas pieces only, no generic props, plants or rugs that are not Midas pieces, people per D1, the white master at the vendor photo's angle only. The go 1 ticket (12) says that anything not a confirmed Midas piece is left out at scene time.
- **P4** per D2.
- **P5** the repair keep list headed "Keep unchanged while correcting:".
- **P6** an unconditional placement line: the camera sees the product from the same side and angle as image 1; the room may stand square to the camera while the product stands at an angle in it.
- **S1** the white framing line: "about 12% white margin at each end of its longest side".
- **S2** the empty-room prompt carries only walls, floor, windows, room size and the clear floor zone; it names neither the product nor any furniture, and its palette line keeps only wall and floor items.
- **S3** "no textiles except plain sheer curtains or blinds at the windows".
- **S4** per D4.
- **S5** a detail view drops the room camera height and the framing guide; it keeps "level, verticals straight".
- **S6** the blind count asks for `box_2d` as `[ymin, xmin, ymax, xmax]` on 0–1000 (Gemini's own format, as the 03 Eye prompt already does); 16b converts it. Keep the old percentage reading as a fallback.
- **S7** the blind count, still not told the target: "A sectional or modular piece counts once per module where a joint or gap shows; seat cushions are not pieces."
- **S8** the planner's risks go to the 16 reviewer as extra things to check, never into the image prompt.
- **C1** a layout line written by code from the 03 Eye reader's product boxes: "Left to right, as seen from the front: …, as image 1 shows."
- **C2** a closing self-check line in the white and placement prompts.

Do not change: framing as a styling note (decision 19), views sharing one room (decision 21), at most two repairs, `auto_repair` false, the nine shapes, the delivery sizes.

## Build: part B, intake and page (before any page is connected)

- **F2** 01 Intent & scope reads the A7 page draft's `metadata.color`, `metadata.material`, `metadata.locks` and `metadata.must_not` as well as `item.*`. Every field the page sends that A7 does not use is listed back to the client under "not applied".
- **Client first page shape** 01 also accepts the client first page's brief shape: top-level `outcomes`; `delivery.ratio`, `delivery.views`, `delivery.resolution`; `preferences.wall`, `preferences.human`; `details.sku`, `details.dimensions`, `details.colour`, `details.fabric`, `details.inventory`, `details.customPrompt`.
  - Shape and resolution labels are translated as 01 already does for `aspect` ("Square · 1:1" → 1:1, "Standard for category" → 1:1); never fall back to 16:9.
  - Views use A7's own mapping (owner decision 21), not the F1 page's proposed mapping.
  - `details.inventory` is free text: parse only lines of the form "number piece" (for example "2 chairs"); anything else becomes a "not applied" note, never a guessed count.
  - `preferences.plants`, `preferences.mood`, `strengths` and `validation` are listed as "not applied".
  - A request without a job id is still refused.
- **F3** a new A7 page draft (copy `claude-outputs/claude-midas-a7-page/` to a new numbered folder; the current draft stays unchanged): Plants, Human presence, Mood / Vibes and the Midas supporting pieces switch show "Coming later" and are not sent, until A7 uses them. Mock mode only.
- F4 (room photo and other views on the page) is **not** in this build. List it.

## Not in this build

Series, F1's five light moods and room styles, F1's prop sets and the 7 missing SKUs, the image cap above 8, side views, the same-room check, the missing scene-manifest fields, image conversion and resizing, the result address, the paid run and publishing. List them in the README as next.

## Standing rules

- No publish, unpublish or paid call (OpenAI, fal.ai, Google) unless the owner says so in that message. Test with pinned or code-made data only.
- Build changes as new draft versions of A7. Never edit a published workflow or an earlier pipeline in place. Prefix anything new with "Claude ·" or "claude-". No keys, codes or tokens in any file, payload, log, screenshot or test.
- Before the first change, record the starting version id. Read A7 again right before each save; if it changed since your last read, stop and report.
- After every n8n change: push the code with `update_workflow` (`setNodeParameter` on `/jsCode`); save the `get_workflow_details` output; re-export with `python3 tools/claude-midas-a7-export.py <file>` into `n8n/claude-midas-a7/`; byte-check every Code node against the repo; sync the copies in `claude-outputs/claude-midas-a7-build/js/`; run every test suite (views-framing 79, page mock 36, stage 07 86, scene files 65, stage 06 56, stage 05 58, MT4 9, refresh 1, the two older suites 86 and 37 on a scratch copy).
- Add tests for every fix. Render the white, empty-room and placement prompts before and after with `node tests/claude-midas-a7-prompt-check/render_prompts.js <dir>`, and run `node tests/claude-midas-a7-prompt-check/intake_shapes.js` before and after; put the before/after differences in the README.
- If the session's safety check refuses a step, do not work around it; ask the owner to run it.
- A passed review is a reviewed candidate, not an approval. Scores are model judgements; never present the 90–95 target as achieved. At most two repairs per image, then hold. An incomplete package is never called complete.
- Client-facing text: no internal terms (Eye, Brain, Critic, n8n, model or provider names); results labelled "Generated image"; "Approved" only from the owner's recorded decision; no promised delivery time, pixel size, retention or human stylist. English first, right-to-left ready; no Arabic copy without a native review.
- No advertising work of any kind unless the owner asks in that message.
- Before reporting, have a separate agent that did not write the code review the diffs and run probes. Check each of its findings against the code before changing anything.
- Never claim something was built, tested or verified without evidence you can show: version id, test result or execution id.

## Report

Write one dated, plain-language README beside the build (`claude-outputs/claude-midas-a7-prompt-fixes-README-2026-10-<day>.md`), with project_write and mirrored in the repo. Update the coverage register and the prompt-check doc rather than adding near-duplicates. Commit with the session's own Co-Authored-By and Claude-Session lines. The README holds:

1. Status: version before and after, published or not, any run made.
2. Every node and table added or changed, one line each.
3. Each item (P1–P6, S1–S8, C1–C2, F2, client first page shape, F3) as done, partly done or not done, with the reason and the test that shows it.
4. The rendered prompts before and after, as differences.
5. The owner's answers to D1–D8, or the default used.
6. What was not checked; assumptions; what is not built; leftovers. Keep listing the earlier ones: runs table `l0roUCBwIQL3h9Eq` rows 23–30; vault rows from those runs; identity row 1; archived workflows `UPIDK9W2UkJgQdBA` and `KWeP7dIqnUyvbGlL`; executions 426–436.
