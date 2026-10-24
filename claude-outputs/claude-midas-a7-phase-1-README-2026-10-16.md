# Claude · Midas A7: Phase 1 build (16 Oct 2026)

16 Oct 2026, 17:15 Amman. Written by Claude. Phase 1 of `claude-midas-a7-remaining-plan-2026-10-16.md`.

## Status

- **Workflow:** "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`.
- **Not published.** n8n shows `active: false` and no active version after the last change.
- **No run was made, and no paid call.** Nothing was executed in n8n in this chat. All tests ran locally on code-made or saved data.
- **Current draft:** `e584d5ed-52c0-4a49-9da2-5c833b5e1b48`. It holds all of Phase 1.
- **Built on:** `ad7d33eb` (fallback readers). That version was checked to match the repo before any change.
- **Repo:** `Ibrahim-Abedrabboh/claude-midas-studio`, branch `final`. Code is in `n8n/claude-midas-a7/code-nodes/`. The export is `n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json`.

The deploy took ten draft versions. Only the last one is complete. The ones before it were steps on the way and are not meant to run.

| Version | What it holds |
|---|---|
| `19af90fb` | 13 Compile |
| `7b1d5cd8` | 11b Stylist check |
| `25143389` | 16b Review verdict, 18p Package result |
| `67d64409` | 04-06 Evidence, 04 Settings, 20a Scene files ticket |
| `109adb83` | 19a Scene ticket, 12 Who leads the scene, 19c Prop verdict |
| `7555ffce` | 01 Intent & scope, 16a Review ticket |
| `49f9ce57` | 10, V1, G2, 18a, 15b, G1d |
| `fa6d40c5` | 11d, 18e, 18h, 09b, G1b, 18l |
| `6c7e23f8` | 20k, the five new nodes, the new wiring, simplify off on 11 AI nodes |
| `e584d5ed` | Canvas only: the "Stage 06 · Package" group restored (see Leftovers) |

## What changed

### Owner decisions applied

**D3: review again.**
- A candidate that no reader reviewed goes to go 2 with two choices: review again or stop.
- Review again reruns the review and the blind count on the stored image. It makes no image call. Its estimated cost is shown first.
- It is allowed once per candidate image, meaning once per output and attempt.
- If the second review also gets no answer, the choices are approve by eye or stop.
- Approving by eye is recorded as "approved by owner without an automated review". It is never shown as a passed review.
- Code: 16b, G2, G1b, G1d, 18a, 18l, 20a, 20k.

**D4: background set to 255 (P1.7).**
- This applies to the delivery files only. The approved master in Drive is not changed.
- **18e2 Master to pixels** (new Edit Image node) turns the master into a 1125 x 1125 BMP.
- **18e3 Clean background** (new Code node) sets the background to 255. It uses no AI.
  - It reuses the white clean-up workflow's edge sample, white point and soft curve. It does not reuse that workflow's paid cut-out.
  - The fill grows from the image border, only through pixels at or above the white point.
  - The soft curve is applied only to a 3 px band around the fill.
  - Nothing inside the product box changes. The box comes from the approved review's blind count.
  - It counts the pixels changed inside the box and the pixels darker than the knee that changed. If either count is above 0, it holds.
  - Without a usable box, it changes nothing and holds.
- **Cleaned?** (new IF) sends a clean picture to 18f. Anything else goes to 18p, which holds the package.
- 18f and 18g now write the jpg and the webp from the cleaned picture. The jpg quality is 95.
- **18g1 and 18g2** (new Edit Image nodes) read the saved jpg and webp back as BMP, with rotate 0. This does not resize, so a wrong-sized file is not hidden.
- 18h checks the edge rows of each saved file:
  - All edge pixels must be 255, or at least 99.9% with none darker than 254.
  - The file read back must be 1125 x 1125.
- The manifest says "background set to 255" and records the measurements.

**D5–D10 and D12 (P1.9).**
- D5: these scene checks are notes only: light, camera level, realism and framing. These still fail an image: a prop or piece not in the plan, poor grounding, and a clearly wrong scale.
- D6: a cut-off product is decided in code from the blind count's box.
- D8: Lifestyle with Category template gives the white master and the hero only.
- D9: tabletop pieces and lamps are shot near the product's height. Detail views get no camera-height line.
- D10: supporting pieces must be in stock, on midasfurniture.com/en/ pages only.
- D12: the side-view series show as "Coming later" on page draft 2.

**Finding 11 (owner, this chat):** scenes still fail on `no_text_or_logo`, `people_ok` and `midas_pieces_match`.

### Plan fixes

- **P1.2:** the go 1 ticket warns when stage 04 will hold the plan. The checks are a cropped photo, an inventory piece read as room context, and fewer pieces seen than the contract holds.
- **P1.3:** the operations row records the call as synchronous and not stored at Google.
- **P1.4:** the 19c size line keeps measurements only and decodes page symbols.
- **P1.5:** the old go 2 reply text is replaced.
- **P1.6:** the wide-framing line now names the 55% upper limit.
- **P1.8: token counts.**
  - 01 records the text model prices, read on 16 Oct 2026.
  - 04-06, 09b, 11b, 11d and 16b record each call's token counts.
  - V1 writes one `text_call` vault event per call.
  - 18e adds the text cost to the package cost.
  - Simplify is off on the 11 AI nodes so that token counts arrive: 03, 03b, 05, 06, 06b, 09, 11, 11c, 16, 16x and 16xb.
- **P1.10:** 16b keeps the critic's answer when the blind count fails.

### Independent review findings

| # | Fix |
|---|---|
| 1 | 18e3 rewritten as described under D4. Tests cover a soft-edged, off-centre ivory panel. |
| 2 | "Not reviewed" now needs a ready review ticket. Otherwise the image holds. |
| 3 | The empty-room camera line never names "image 1". A tabletop product's room is shot at about 75 cm; other small products at about 120 cm. |
| 4 | 19a decides "small product" from the handling profile first, and uses words only when the profile is unknown. |
| 5 | The reader flags "cropped" but the box is inside the frame: this is recorded as unsure, not passed. |
| 6 | 18h edge rule and size check, as described under D4. |
| 7 | `go2_decisions` is written first in the run row's review text. G1b can read it even if the text is cut. |
| 8 | Not-reviewed tickets list note-only checks as notes. The score label says "not a passed review". |
| 9 | 19c reads "in" as a unit only next to a number. cm or mm win. |
| 10 | Page draft 2 wording corrected. |
| 12 | Wording now says once per candidate image. |

## What was checked, and how

- **Byte check.** All 58 Code nodes in version `e584d5ed` are byte-identical to the repo files. There are no Code nodes without a file, and no files without a node. The two model prompts also match. Tool: `tools/claude-midas-a7-export.py`.
- **Comparison with `ad7d33eb`.** Five nodes were added and none removed.
  - The only other parameter changes are `simplify` on the 11 AI nodes and `dataPropertyName` on 18f and 18g.
  - Exactly 2 connections were removed and 8 added, as planned.
  - The 9 canvas groups are all present.
- **Settings of the new nodes.** 18e2, 18g1 and 18g2 continue on error. 18e3 continues on error and always outputs, so a failure reaches Cleaned? and the run holds.
- **Local test suites, all passing on the final code:** 87, 42, 13, 9, 78, 36, 103, 68, 58, 70, 88, 79, 1, and Phase 1 82/82.
- **Real master check.** `claude-white-clean-check.js` ran on the Test 10 white master with GraphicsMagick and box `[336,97,698,902]`.
  - Changed inside the product box: 0 pixels.
  - Changed pixels darker than the knee: 0.
  - Saved jpg and webp edge rows at 255: 100%.
  - The master's own edge rows at 255: 0.58% before the clean-up.
  - Previews for the owner: `claude-outputs/claude-midas-a7-phase-1/`.
- **Local GraphicsMagick: rotate 0 to BMP.** On a jpg, it gives the same pixels as a plain conversion, as a 24-bit BMP.
- **Key scan.** No access keys or tokens were found in the export.

## What was not checked (waits for a real run, Phase 4)

- The raw reply shapes of the 11 AI nodes with simplify off. The parsing is tested on saved shapes of all three providers, not on live replies.
- Edit Image writing and reading BMP on n8n Cloud. Only local GraphicsMagick was tested.
- Whether the stored candidate's picture is still available after the go 2 wait, when review again runs.
- Whether 18f's resize to the same size changes the edge pixels on n8n Cloud. 18h measures the saved files, so a change would hold the package, not pass it.
- 18e3's speed on n8n Cloud, for a 1125 x 1125 picture in a Code node.
- 18e2's resize uses ignoreAspectRatio. 18e already holds any master that is not square, so nothing is stretched.

## Assumptions (owner to confirm or change)

- **18h edge rule:** 99.9% with none darker than 254 is accepted as well as 100%.
- **18e3 values:**
  - The product box is widened by 15/1000 on the top, left and right, and not at the bottom.
  - Changes fade in over 6% of the side (68 px at 1125).
  - The soft-curve band is 3 px.
  - The run holds if less than 10% of the picture is found as background, or if less than 50% of the edge band is near-white.
- **Small products (04 Settings):** the profile id lists and the room heights of 75 cm (tabletop) and 120 cm (other small products). The lists were not re-checked against the live profiles table (`FZJg1MHUh2lcIV1H`) in this chat.
- **Review-again estimate:** 1,600 tokens per image. It is an estimate, not an invoice.
- **Text prices:** read from the providers' pricing pages on 16 Oct 2026. Gemini's price changes on 1 Jan 2027.

## Not built

- The client page is not connected to A7. A7 has no result address yet (P5.1).
- Phase 2 (reader prompt), Phase 3 (data) and Phase 4 (second paid test) are not started.

## Leftovers

- **In n8n:** only the ten draft versions listed above. No workflow, data table row or file was created, and nothing ran.
- **The group was dropped and restored.** Version `6c7e23f8` dropped the canvas group "Stage 06 · Package", because the new nodes sat outside it. Version `e584d5ed` restored it with the same id and the five new nodes.
- **Local only, in Claude's workspace:** GraphicsMagick installed, and scratch files under `/tmp/claude-0/`. Neither is in the repo or in n8n.
- **Pipeline 3 and white clean-up:** not touched. Both are still published.

## Decisions for the owner

1. **Approved by eye, with no product box.** The white master's box comes from the blind count. A white master approved by eye after the blind count failed twice has no box, so its package holds. Should such a master be packaged without the clean-up (edges about 253), or stay held?
2. **Room heights:** 75 cm for tabletop products and 120 cm for other small products. Keep?
3. **Ramp:** the 68 px ramp is visible only on the high-contrast preview (`claude-t10-white-clean-contrast-240-255.png`). Accept?
4. **Phase 4:** the go for the second paid test (suggested cap USD 3), when Phase 2 is settled.
