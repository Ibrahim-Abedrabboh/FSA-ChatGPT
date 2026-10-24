# Midas Stylist skill · README · 15 Oct 2026

## Status

- Draft skill, version 0.1. Not saved as a skill until you save it from the review card.
- Nothing published. No n8n workflow touched. No image generated. No paid call made.
- Magnific boards were read only (two boards, six node searches).

## What was built

| File | What it is |
|---|---|
| `SKILL.md` | The skill: fixed rules, piece card, menus, workflow, eight pillars, score, outputs, critic, Magnific tool policy, language, hand-off checklist |
| `reference/stylist_schema.py` | Pydantic v2 input checks (replaces the draft schema from chat) |
| `reference/stylist_engine.py` | Pre-render rule engine: shortlist filters, eight pillars, score, status |
| `tests/test_stylist.py` | 25 tests |
| `tests/original_schema.py` | The chat draft schema, kept only to test its gaps |

## Sources used

- Your prompt (five pillars, output template), the Pydantic draft and the three sandbox screenshots, all from chat, 15 Oct 2026.
- A6 stylist and reviewer prompts: `claude-outputs/claude-midas-a6-prompts-by-phase-2026-10-14.md`.
- Client choices: `dropdown-options.json`.
- Repair, styling-loop and "best" rules: `two-architectures.txt`, `claude-outputs/claude-midas-a7-research/architecture.md`.
- Magnific board "Midas · 29 September casework · Working copy", read 15 Oct 2026: nodes "06 Creative Controls · Midas V3", "Styling options note", "C3 Styling comparison", "C01–C02 Preferences", "Q02 Operator decision", "i · Styling handoff".

Not read: the earlier `home-furniture-stylist` v1.2 skill and its three reference files. They are not in this project. This draft may overlap with or contradict them.

## What changed from the chat draft

1. **Eight pillars, not five.** Texture, function and focal point were in your list but missing from the schema and sliders.
2. **Material affinity split from texture contrast.** The sandbox slider "Material Texture Affinity" mixes two rules with opposite intent.
3. **Unknown is allowed.** The draft required every tag, which forces guesses. Every filled tag now needs a basis.
4. **Provenance in the schema.** Hero, Midas piece and generic context are separate roles. A Midas piece without SKU, photo and date is refused. Generic context cannot carry a SKU.
5. **Real hex check.** The draft accepted `#GGGGGG` (test proves it). Photo-read colours are marked as estimates.
6. **Weights normalised.** The draft's `"*"` validator did nothing (test shows weights summing to 500 pass). The sandbox profiles sum to 320, 310 and 370, so normalising fits them better than forcing 100.
7. **60-30-10 moved to room surfaces.** Assigning a colour role per furniture piece cannot work when the product's colour is locked.
8. **Score kept, but fenced.** Your template asks for 0–100%; the A6 reviewer and C3 critic forbid percentages. Resolution: the score ranks plans before rendering, shows coverage and profile, is a whole number, says "not an approval", and never reaches the client page or the critic.

## What was checked, and how

- **25 tests pass** (`python3 -m pytest tests`, pydantic 2.13.5, this session's machine).
- Original draft gaps reproduced: non-hex colour accepted, weight total not enforced, no way to say "unknown".
- Each filter and pillar has a test: same-kind, out-of-stock, piece limit, white background, two heavy pieces, four finishes, warm/cool wood clash, table-to-sofa ratio, missing purpose, colour split, low coverage.
- Profiles: when every pillar passes, all profiles give the same score. With three styles and all-angular lines: balanced 85, strict 53, eclectic 83.
- **Real board data** (Zura chair SKU167339, Corinne table SKU167885, Metro mirror SKU167879): coverage 35%, so no score and status "needs information". The engine flags that the mirror (100 cm) is wider than the hero chair (88 cm).
- **Sandbox screenshots:** the shown Room Harmony cannot be rebuilt from the shown pair scores. Balanced: pairs 77, 75, 71 average 74.33, shown 74.4. Max Contrast: 72, 74, 74 average 73.33, shown 73.5. Minimal Harmony: 77, 76, 70 average 74.33, shown 74.4. The formula is not plain averaging, or uses unrounded values. The three profiles also move the total by under one point despite very different sliders.

## What was not checked

- No image was styled, rendered or reviewed with this skill.
- Pillar thresholds (50–75% table width, 60-30-10 bands, three-finish limit) are design rules of thumb, not tested against owner-approved images.
- The client mood and lighting mapping is my proposal.
- The `home-furniture-stylist` v1.2 skill was not compared.

## Assumptions

- "Retrieved Sep 11" on the C01 node means 11 Sep 2026.
- The Corinne table is called both "W80 × D80" and "diameter 80 cm" on the board. Round or square is not confirmed.
- Default limit of three Midas pieces per scene, matching the C02 basket (anchor, table, mirror).

## Not built

- No n8n node or Magnific node uses this skill yet.
- No catalogue retrieval. Pieces must be supplied with their facts.
- No automatic tagging from photos. Tags come from the vendor, the catalogue or a reviewer.

## Decisions for the owner

1. **Which style list is canonical?** Board V3 list (used in this draft), the board's "Styling options note" list, or another.
2. **Repair cap:** project rule says two; the C3 critic says one. Which applies?
3. **Magnific:** may replace background, variations and retouch be used on product images?
4. Confirm or change the pillar thresholds and the three profiles.

## Leftovers

None in n8n or Magnific. Local files only, listed above.

---

## Update · 15 Oct 2026, 03:40 · Review of the supplied scoring engine, n8n node and API

### Status

- Nothing created, changed or run in n8n. No model call. Code was run only on this session's machine.
- New files: `n8n/claude-stylist-check.code.js`, `n8n/claude-stylist-writer-prompt.md`, `api/claude_main.py`, `tests/test_api.py`, `tests/parity_make_cases.py`, `tests/parity_check.js`.
- Changed: `reference/stylist_engine.py` (rounding fixes below).

### What was wrong in the supplied files (each reproduced by running it)

**n8n Python Code node snippet**
1. `ndv.first().json()` does not exist in n8n. n8n's own node definition (read 15 Oct 2026) says the only Python input global is `_items`; `_input`, `_json` and `$` helpers are undefined. The node fails on line 1.
2. The score is 100 times too large: it divides by 80, then multiplies by 100. Your mock pair returns **8500%**, a perfect pair **10000%**.
3. The divisor 80 is fixed. It ignores the weights actually sent, and the colour weight (20 by default) is read but never used: setting it to 100 changes nothing.
4. A partial `config` (for example only `style_match_weight`) crashes with `KeyError`.
5. Missing tags count as a style or material (`None` is treated as a value).

**`main.py` (FastAPI)**
1. Three heavy pieces plus one light piece score **94** and are called "excellent" balance.
2. Five different material categories score **90**, and the conflict text says "No immediate aesthetic or structural clashes". Only style and scale ever produce a conflict message.
3. Colour scores 100 whenever two pieces have different roles; the 60-30-10 split is never checked.
4. All weights at 0 silently returns 0.
5. Same hex and schema gaps as the chat draft (accepts `#GGGGGG`, cannot say "unknown", no SKU provenance).
6. `mock_run.py` runs and returns 87.0, consistent with the code as written.

**LLM prompt:** see `n8n/claude-stylist-writer-prompt.md` (table at the end). Main issues: it would receive the 8500% figure; it invites invented products; it has no product lock; it presents a human-stylist persona, which the project rules forbid.

### What was built

- **`n8n/claude-stylist-check.code.js`:** paste into a Code node, JavaScript, "Run Once for All Items". It reads the request from the webhook body or the item, validates it, and runs the same filters, eight pillars, score and status as the skill. Bad input returns `status: invalid_input` with readable reasons instead of crashing.
- **`n8n/claude-stylist-writer-prompt.md`:** optional wording step. The score line is built by code, so the model cannot misstate it.
- **`api/claude_main.py`:** FastAPI wrapper on the skill engine. `POST /api/v1/stylist/check`, `GET /api/v1/stylist/menus`. Invalid input returns 422 with reasons.

Proposed n8n flow, not built: Webhook → `Claude · Stylist check` (Code) → IF status starts with `plan_` → optional writer (paid call) → Respond to Webhook. `needs_information` and `invalid_input` go straight to Respond with no model call.

### What was checked, and how

- **28 tests pass** (25 skill tests + 3 API tests).
- **Parity:** 10,000 random requests run through the Python engine and the JavaScript node; **0 mismatching fields** across status, score, coverage, kept, excluded, every pillar result and reason, and the critique. 3,428 of them were invalid, and both sides rejected the same ones.
- The node was also run as n8n runs it: a fake `$input` holding a webhook-shaped item, with a top-level `return`. It returned one item with the expected status.
- Parity found two real bugs in my own Python engine, both fixed: it divided by the rounded coverage, and its rounding disagreed with JavaScript on exact ties (Python's `sum()` adds floats more precisely than JavaScript, and Python rounds halves to even). Both sides now clean float noise and round halves up.

### Not checked

- Not run inside n8n. Not run with real catalogue data beyond the C01–C02 board pieces. The writer prompt has not been sent to any model.

### Recommendation

The check node already writes "the win", "the conflict" and "the fix" from rules, at no cost. Start without the model step. Add the writer only if the wording needs polishing, and test it with pinned data first.

---

## Update · 15 Oct 2026, 03:35 · Skill v0.2: room, walls and architecture

- Added section 5b to `SKILL.md` and four checklist lines. No code changed; tests unaffected.
- Accepted with guards: room scale, walking path, leggy supporting pieces, wall palette, wall art, rugs, shelf styling, curtains.
- Guards added: mirrors must not reflect the product (a reflection reads as a second piece); art and book spines carry no text, logos, known artworks or disallowed people; fireplaces and built-ins never become a second focal point; rugs never hide legs or base details.
- Not added: repainting, wallpaper and accent-wall advice for a client's own room. It needs the client-room workflow, which is not connected ("Coming later").
- Distances (40–45 cm sofa to table, 75–90 cm walkways) and rug size are rules of thumb, not checked in code. Code checks would need room width and depth in the plan input.

---

## Update · 15 Oct 2026, 03:45 · Skill v0.3: light, balance, zones and two guards

- Source: an interior-design career article supplied in chat. Most of it (education, certification, CAD tools, budgeting, project management, unsourced statistics) was not used.
- Added section 5c (layered light, balance and rhythm, zones), a scope line (the skill decorates; no structural, code or compliance work) and rule 9 (no material or sustainability claim beyond the vendor or catalogue). Two checklist lines added.
- Guard on light: lamps and evening grades may warm the room but never change the product's colour.
- No code changed; tests unaffected. The saved skill was v0.2; the review card offers v0.3 as an improvement.

---

## Update · 15 Oct 2026, 03:55 · Where the stylist sits in A7

Checked in n8n (15 Oct, read only): `Claude · Midas A7 (stages 01–02)` (1cgZc9rmBOrPdKIe) is a draft, not published, and stops at "Contract ready". Stage 03 is not built.

| A7 step | Stylist part | Runs as |
|---|---|---|
| 10 Retrieve Midas pieces | Shortlist filters (provenance, not same kind, not out of stock, piece limit) | Code, free |
| 11 Plan + plan check | Plan up to 3 boards (sections 3, 5b, 5c, 7B); engine scores each board; another model family checks counts, locks and people | Model + code + model |
| 12 Who leads the scene | Reverse role, focal point (pillar 7) | Code |
| Owner go 1 | Critique 7A | Shown to owner |
| 13 Compile request | Scene plan; vendor + catalogue photos as references | Uses plan |
| 16 Review | Image guards from 5b/5c added to the five styling checks | Reviewer prompt |
| 20 Manifest + description | Rule 9, no unstated material claims | Description prompt |

Proposed routing in step 11: `plan_needs_change` re-plans (counts toward the max of 2); `plan_ready_with_warnings` and `needs_information` go to Owner go 1 with the not-confirmed list; `plan_ready` goes to Owner go 1.

Gaps before building stage 03:
1. Catalogue pieces have no style tags (weight, silhouette, finish, texture, style). Proposed: tag columns plus a one-time model tagging pass ("estimated"), spot-checked by the owner. Paid; needs a go.
2. The product's own tags must come from stage 01 as "observed in photo": a change to stage 01 output, built as a new A7 version.
3. Client Midas picks are fixed in the A7 design; a pick the filters reject should go to the "ask the client one question" hold, not be dropped. Engine change needed.

Nothing built or changed in n8n.

---

## Update · 15 Oct 2026, 04:50 · Stylist now runs inside A7 stage 03 (draft)

- Stage 03 is built in the A7 draft (`1cgZc9rmBOrPdKIe`, not published, pinned tests only). Details: `claude-outputs/claude-midas-a7-stage-03-README-2026-10-15.md`.
- The engine (`n8n/claude-stylist-check.code.js`, v0.3) runs **unchanged** inside node `11b Stylist check`; an A7 wrapper builds its input from each planned shot.
- Gap 3 above is closed: a client pick that cannot be used becomes one client question.
- Gap 1 is open: catalogue tag columns now exist in `Claude Midas A7 catalogue`, but they are empty, so every plan reads "not scored (coverage 25%)". Gap 2 (product tags from stage 01) is also open.
- Routing differs from the proposal above: an engine `plan_needs_change` is shown at go 1 as a warning instead of forcing a re-plan. Re-plans come from the plan critic (claude-sonnet-5-5), at most 2 rounds.

---

## Update · 16 Oct 2026, 09:25 · Skill v0.4: aligned with A7 and decisions 22–29

### Status
- `SKILL.md` rewritten as v0.4 in the repo (`claude-outputs/claude-midas-stylist-skill/SKILL.md`). It was offered to the owner as an update to the saved `midas-stylist` skill; it changes nothing until saved from the review card.
- No code changed: the engine (`claude-stylist-check.code.js`, Python twin, tests) is still v0.3. No n8n change, no model call.

### Why
v0.3 predated the owner's decisions of 15 Oct (21:50) and 16 Oct (22–29). It still suggested generic props, rugs, curtains and cushions as colour surfaces, a practical lamp, art, mirrors and plants. A7 (version `64545f4f`) forbids or narrows all of these, so the skill disagreed with the pipeline it describes.

### What changed
- Rules 5, 7, 8 and 9 are new:
  - Midas pieces only, at most 3 per scene, no generic props;
  - stock rules, with a lamp only when in stock and pre-order still open (decision 28);
  - no Midas cushions or throws;
  - no invented side views.
- The piece card drops the `generic_context` role.
- The menus show what is fixed per image and never chosen by the stylist: light preset, camera view, series, people.
- Pillars 4 and 5:
  - the colour split is based on the room shell and the Midas pieces;
  - the texture fix uses Midas pieces or wall and floor finishes, not cushions or throws.
- 5b:
  - room shell defined;
  - mirrors, art and rugs only as Midas SKUs;
  - plain sheer curtains or blinds only;
  - shelves carry an accessory hero without generic objects.
- 5c: fixed light presets, built-in light, dark windows at night, lamps only as Midas lamps (or the product itself), client room photo keeps its light.
- New 5d: camera views, raised camera, views and series, people (decisions 22, 24, 27).
- 6: the score blocks nothing in A7; it is a known limit that empty tags make most plans "not scored".
- 7B: the scene plan uses A7's current keys (`room`, `person`, empty `supporting_props`, `count`, `risks`, `catalogue_rejected`).
- 8: repairs only when the owner orders them; framing is a note.
- 11: the checklist is updated to match.

### Not done
- Engine alignment (pillar 4 and 5 fix texts; `generic_context` in the schema). This is a separate change: Python and JavaScript together, with the parity test re-run.
- The style list and pillar thresholds are still owner decisions, as in v0.1.
- The tagging pass of the Midas catalogue, which would make the score usable. It is a paid model call and needs the owner's go.
