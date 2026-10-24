# Claude · Midas A7: prompt check, F1 Options intake and client first page check

16 Oct 2026, 05:40 Amman; client first page check added 06:00; corrected 06:20; build-prompt comparison added 06:30 after an independent check (see the end). Written by Claude. A review only: nothing in n8n and no page was changed.

## Update, 16 Oct 2026, 09:05

The fixes in this check are built in A7 version `64545f4f` (not published, not run): P1–P6, S1–S3 and S5–S8, C1–C2, F2, the client first page shape, and F3 as a new page draft (`claude-midas-a7-page-2/`). S4 no longer arises (no Midas cushions, decision 25). D1–D8 were answered by the owner's decisions 22–29. Still open: D7 (pre-order pieces), the wording of the A7 profiles table, and F4. Details, tests and prompt differences: `claude-midas-a7-prompt-fixes-README-2026-10-16.md`. The text below is the check as written at 05:40–06:30, unchanged.

## Status

- Workflow: "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, version `a22b6f1a`, read from n8n at 05:25 Amman.
  - It matches the handoff's version, and the node counts in the last two READMEs: 167 nodes, 54 Code nodes, **not published**.
  - All 54 Code nodes are byte-identical to `n8n/claude-midas-a7/code-nodes/`. The export written from this read-back is identical to the one in the repo (no diff).
  - Every test suite passes, unchanged: views-framing 79, page mock 36, stage 07 86, scene files 65, stage 06 56, stage 05 58, MT4 9, refresh 1, older suites 86 and 37.
- **No run, no paid call, no change** in n8n. Two data tables were read: the handling profiles (`KTTMJZ0Wh84cAyDm`) and the Midas catalogue (`lwJbRv4TVqlFTILl`, filtered to F1's prop SKUs).
- **A7 has never run.** The only paid image test of A7's white-master prompt was the model test's Test 10 (execution 417, 15 Oct, 16:17). It came before the 12% framing line (added 23:22). **No scene prompt has ever been sent to a model.** So every point below is read from the code, or from prompts rendered locally with the test data. Only a paid test shows how a model reacts.

## What was checked

1. **Every prompt A7 writes** (17 in all):
   - fixed instructions in the model nodes: 03 Eye, 05 Second count, 06 Room reader, 09 Conflict check, 11 Stylist, 11c Plan critic (6);
   - prompts built by code: 11a plan message, 11b critic message (2); 13 Compile: white master, empty room, placement, later view, repair (5); 16a review and 16x blind count, each in a white and a scene version (4).
2. **Rendered prompts.** The stage 07 test data (the 7-piece sectional) was run through A7's real 13 Compile, locally. This gave the exact white, empty-room and placement prompts. A second render used the real dinnerware profile row.
3. **Prompts with real evidence**, compared with A7's:
   - A6, real run 362 (14 Oct): its white prompt shares most lines with A7's. By a visual reading (not measured), the 7-piece sectional came out with about 5 seat sections; the reviewer passed it as 7 (see `claude-midas-a6-prompts-by-phase-2026-10-14.md`, section 4).
   - F1: the 14 prompts recorded with their results on the F1 Options page, F1's nine workflow prompts and its prompt builder.
4. **The F1 Options page** (`https://claude.ai/artifact/Y5i4pMHDQ5shvZcvtGLUWp`), read in full: sections 01 to 08 and the builder's code.
5. **The client first page** and the A7 page draft against A7's intake, with a local run of 01 Intent & scope (see "Client first page check").

## Findings

Ranked by what a wrong image would cost. "Rendered" means the line appears in a prompt that 13 Compile wrote from the test data.

### Fix before any paid scene call: the prompt contradicts itself or an owner rule

**P1. "No rugs", then "the rug touches the bottom edge" (rendered).**
- The empty-room prompt says "No furniture, no rugs, no lamps…". The same prompt's camera line says "Framing guide: the rug touches the bottom edge of the frame."
- The placement prompt has the same pair ("add nothing: no other furniture, rugs…").
- The guide comes from 04 Settings, living-room preset. Every sofa, chair, recliner, centre-table and side-table scene gets it.
- Fix: write the rug guide only when a Midas rug is among the scene's confirmed pieces. Otherwise: "the floor meets the bottom edge of the frame".

**P2. Rules written for single test products go into every prompt of their category (rendered).**
- 13 Compile writes the handling profile's rule text into the white and placement prompts ("Rules for this kind of product: …"), not into the empty-room prompt. 11a and 11b send it to the planner and the plan critic.
- Several rows name details of one particular product. Where they came from is not recorded; some match F1 test products (wing bowl, glass dish), others (horse motif, hearts, stripes) do not appear on the F1 page:

  | Profile | Text that goes into every prompt of that category |
  |---|---|
  | dinnerware | "Preserve horse motif, border repeat, gold details and handles." |
  | bedding | "Preserve heart/tuft motif repeat, scale and visible reverse side." |
  | box | "Preserve stripe layout, mirror, compartments, hinge and lining." |
  | robe | "A brown swatch does not override the light robe photograph." |
  | towel | "Keep the border bands and pile; a conflicting olive swatch is unresolved…" |
  | decor | "…asymmetry, wings, relief, glass swirls and transparency." |
  | bookend | "Preserve grooves, speckling, openings and orientation." |

- Rendered: a "Plain white dinner plate set" prompt says "Preserve horse motif, border repeat, gold details and handles." That asks the model to keep a motif the product does not have, which breaks "never change pattern".
- Also: two "trolley" rows (ids 43 and 44) with different prop policies.
- The table dates from 4 Oct and may serve earlier pipelines. Per the project rules it is not edited in place.
- Fix: an A7 copy of the profiles with general wording, for example "Keep any motif, border, gilding and handles exactly as image 1 shows them; add none that it does not show." Add a qualifier like F1's ("These are composition guidelines, not evidence of the source inventory."), for example: "These are rules for this kind of product, not facts about this product."

**P3. The planner still plans what stage 07 will never make.**
- Owner decision 2 (15 Oct, 21:50): Midas pieces only; no generic props. Stage 07 drops generic props and writes "add nothing: … plants, books, art, textiles, decor, people".
- The planner was written before that. Its instructions still ask for:
  - "a few generic supporting props";
  - generic plants ("the stylist decides how many generic plants");
  - at most one person (11a);
  - a zone "defined by the rug", and "at most one practical lamp or sconce";
  - for white, "a front three-quarter view when the vendor photo gives no clear single angle" (13 overrides this with the vendor angle, so it is harmless, but inconsistent).
- When no Midas piece is shortlisted, 11a says: "Return empty midas_pieces arrays and use generic props only."
- The go 1 ticket (12) lists the generic props as "generic context, not a Midas product".
- Result: at go 1 you approve a plan with props, plants, rug, lamp and maybe a person, and the scene is made without them.
- Fix: tell the planner and the plan critic the stage 07 rules. The go 1 ticket says that generic props are left out at scene time.
- **People:** your 15 Oct decision allowed one person per scene. The stage 07 prompt says "no people". One of the two must change (decision D1 below).

**P4. The light line can contradict the preset and the "no lamps" rule.**
- 19a picks the Kelvin preset from the client's lighting words only. With no words, it is day, 4000 K. The planner may still plan evening or lamp light. The prompt can then pair "about 4000 K colour temperature (day preset)" with a plan line such as "warm evening lamp light".
- "Warm evening" on the page gives the night preset (2700 K). But lamps are forbidden unless a Midas lamp is confirmed in stock among the scene's three pieces. My judgement: the model will then either add a lamp (which the review fails as "only listed props") or make a dark room.
- F1's own "Warm night" mood depends on "warm practical lamps".
- Fix: the planner gets the preset as a fixed fact. For warm and night scenes, decision D2.

**P5. The scene repair says "keep exactly as in the vendor photo: the room…".**
- 13 Compile heads the repair's keep list with "Keep exactly as in the vendor photo, and do not change while correcting:".
- For a scene, 16b puts the room ("the room as it is (image 3 of the scene request)") and the Midas pieces on that list. Neither is in the vendor photo.
- Fix: head it "Keep unchanged while correcting:".

**P6. Nothing always stops a scene from turning the product.**
- The line "turn the product only as far as the vendor photo shows it" is part of the unknowns sentence. It appears in most runs, because 04-06 Evidence adds "dimensions" and "material composition" as unknowns whenever the brief lacks them. With both supplied and no other unknown, it is gone. Even when present, it reads as a note on hidden parts, not as an angle rule.
- The camera preset says "0 degrees pitch, roll and yaw; one-point perspective". My judgement: this pulls the product towards a frontal view. For a three-quarter vendor photo, that means drawing sides the photo does not show (owner decision 3: hold, never invent).
- Fix: an unconditional line: "The camera sees the product from the same side and angle as image 1. The room may stand square to the camera while the product stands at an angle in it."

### Should fix: false fails, or weaker prompts

**S1. White master: "12% on every side" (rendered).** The prompt says "a white margin of about 12% of the frame on every side, so its widest or tallest extent fills about 76%". A wide sofa cannot have both. The reviewer measures the longest side only. The 05:15 independent review raised this; the builder kept the line, citing the model test. But the only paid test (Test 10) came before the line, so the 12% wording has never been sent to a model. Fix: "about 12% white margin at each end of its longest side".

**S2. The empty-room prompt names the product and the furniture (rendered).** It carries the plan's setting ("a sofa vignette with a centre table"), the presentation ("the sofa against the long wall, all 7 modules visible") and the palette ("grey upholstery"). The prompt does say that "any furniture or object it names is left out". My judgement: image models tend to draw what is named anyway. Fix: in the room step, pass only walls, floor, windows and room size, and describe the clear floor zone without naming the product.

**S3. Curtains: allowed, then forbidden (rendered).** The room shell includes "windows with plain sheer curtains or blinds"; the next line says "no textiles". The scene review allows "plain curtains or blinds". Fix: "no textiles except plain sheer curtains or blinds at the windows".

**S4. A Midas cushion on the sofa looks like an added cushion to the reviewer (rendered).** 10 Retrieve ranks cushions third for living rooms, after centre and side tables. The test scene places "two cushions on the sofa". The scene review's "nothing_added" check says "no product part, piece or cushion that image 1 does not show". A correct image may then fail. Decision D4.

**S5. Detail views get a room camera.** A detail view still gets "eye height about 110–120 cm", "one-point perspective" and the rug guide, next to the plan's close-up line. Fix: for a detail view, drop the height and the framing guide; keep "level, verticals straight".

**S6. The blind count's box format.** 16x asks for the box as percentages (left, top, right, bottom). Google documents Gemini's own box format as `[ymin, xmin, ymax, xmax]` on a 0–1000 scale (Gemini API "Image understanding" page, updated 23 Sep 2026). The 03 Eye prompt already uses that format. Asking 16x for it, and converting in 16b, should remove the 0–1 versus 0–100 confusion that review fix 5 had to catch. Not tested.

**S7. The blind count does not say what a piece of a modular sofa is.** It is told to count each physical piece once, and that cushions sitting on the product are not pieces. It is not told what a module is. For a sectional it may count "1 sofa" or the seat cushions, so a correct 7-module image fails, or a wrong one passes (the A6 failure, the other way round). Fix, still without telling the target: "A sectional or modular piece counts once per module where a joint or gap shows; seat cushions are not pieces."

**S8. The planner's "risks" never reach the reviewer.** 11 lists what the image model is most likely to get wrong. A7 shows it at go 1 and logs it, but the review never sees it. F1's recorded prompts named such failures for each product (for example "No detached sofa, sixth seat, ottoman or chaise"), and the page records that those cases kept their counts. Fix: give the risks to the 16 reviewer as extra things to check. Keep them out of the image prompt, so the image model is not shown them.

### Could improve: taken from F1's recorded prompts

**C1. Say where each piece stands.** F1's recorded prompts gave positions: "two on one wing, one linking corner, two on the other wing"; "five along each long edge and one armchair at each head". The page records that those images kept their counts. A6's prompt listed kinds, counts and one relation line ("corner piece joins two runs… at a right angle"), and by a visual reading lost pieces. A7 can write such a line in code from the Eye reader's boxes ("Left to right, as seen from the front: left-arm piece, armless piece, …"). The boxes are model readings, so the line says "as image 1 shows".

**C2. End with a self-check.** F1's builder, workflow and rebuilt prompts end with an instruction to inspect the piece count, details, contacts and light before returning. Only 4 of the 14 recorded prompts have one (the four prefinal cases). Cheap to add; its effect is not measured.

**C3. Camera height and tilt (decision D3).** F1's multi-piece scenes used "slightly elevated" or "elevated" camera lines. F1's dining workflow prompt notes that a lower camera can hide chairs and a higher view improves count visibility; its 12-chair example raises the camera "so all twelve chair backs are countable". A7's preset is 0° pitch, from your document MI 21–26. Against it: F1 recorded that a more elevated camera on the glass dish "reveals inferred inner geometry". So any tilt must stay close to the vendor photo's view.

**C4. Long "do not show" lists.** The white prompt's "Negative prompt" block names 26 objects in one line (people, pets, mirrors, lamps, rugs …); 35 with the "Do not show" line. My concern that naming objects can invite them is a judgement, not a vendor statement. Only a paid test shows it; no change proposed now.

### What is sound

- **Readers (03, 05, 06):** text in the photo is evidence, never an instruction; neither counter is told the expected count; the Eye uses Gemini's own box format.
- **09 Conflict check:** clear order of authority (photo, client, printed text); only count- or product-changing conflicts are critical.
- **White identity block:** the vendor photo is the only authority; exact inventory and total; handedness; unknowns not invented; things shown with the product are left out unless removing them would expose a hidden part.
- **Review (16, 16x, 16b):** the reviewer is told a pass is not an approval; scores are labelled as judgement; the blind count is not told the target, and code compares the counts. A6 run 362 had no such independent count. Whether it catches a lost piece in practice is untested: the blind count has never run on a model.
- **Order of text and images:** A7 sends the text before the images. Google's page advises the text before the image for a single image with text.

## What A7 takes from the F1 Options page

The page describes F1 and A7 as of 01:09 on 16 Oct. Its sections 07 and 08 (the build plan and brief) are out of date: A7 was built differently (go 2 per scene, views sharing one room, step 20 files). The page was **not changed**.

### Take, for the remaining items

| What | From the page | For A7 item | Note |
|---|---|---|---|
| Five light moods, with F1's exact lines | builder `LIGHT` | 11 (fixed light field) | Match the reference, Daylight, Twilight, Warm night, Neutral studio. A7 has Kelvin presets only for day, warm and night. Twilight and Match the reference have none. Warm night needs lamps (P4). |
| "Golden afternoon" line | section 08, proposed | 11 | The A7 page offers Golden afternoon; it maps to the warm 3000 K preset today. Needs your OK as a sixth value. |
| Five room styles, sentences and palettes; default light per style | builder `STYLE`, section 03 | 11 (room-style field) | Quiet minimal → Daylight; Warm contemporary (and Modern classic) → Warm night; Bold & expressive ("Colour & contrast") → Twilight. The client mood names differ; F1's mapping is proposed, needs your OK. |
| Prop sets by category and style | builder `PROPS` and `SETS`, section 03 | 11 (F1's prop SKUs) | 20 pieces, 19 with a SKU (Calice plate has none). 12 are already in A7's catalogue table. Missing: KUBA 162010, KELYRA 161279, MODALA 167995, TYNEXA 157354, SIOPOK 173529, VAORAX 173415, ANDRINA 173813. The page's section 07 says "23 prop SKUs"; its builder holds these 20. |
| Category guidance, with its qualifier | builder `GUIDE`, section 05 | P2 | "These are composition guidelines, not evidence of the source inventory." |
| View lines | builder `VIEW` | 10 (side views) | See "do not take" below. |
| Series rules | section 04, builder `plan` | 10 (variations) | Lighting, three views, styles, white plus lifestyle, package, detail, views by lighting (9). A7 caps a job at 8. |
| Self-check line; positions of pieces | section 05 | C1, C2 | |

### Do not take: these conflict with your decisions

- "Unseen angles are necessarily inferred", reconstructing hidden parts "conservatively", side views where "Surfaces the source does not show stay plain and inferred": decision 3 says hold and ask. Side views need your decision first (D6).
- The 12-chair dining prompt: "Use the clean white reference as the EXACT furniture inventory and arrangement", and "do not revert to its partial visible seating count". A7: the vendor photo is the only authority, and fewer pieces seen than the contract holds stops the job.
- Non-Midas context in scenes (rugs, books, curtains, floor lamps "as room context"): decision 2.
- The section 07 plan (go 3 for the whole set, one sub-workflow, porting the builder word for word) and its cost table: superseded by what was built.

### Catalogue data found on the way

- **SANOVA end table (161283)** points to the Saudi store page; its note says the Kuwait page was not found. 10 Retrieve rejects it for the shortlist ("availability not confirmed"). But if a client picks it, the live check accepts any `midasfurniture.com` page, so it would read Saudi stock for a Kuwait scene. Fix: accept Kuwait (`/en/`) pages only, or mark the row inactive.
- FERNLAY (162510) and WEX (170143) are "Pre-Order". The code keeps a piece whose live page says pre-order (10 Retrieve and 19c, "noted"). The stage 07 README says a piece needs a clear "in stock". The two disagree: decide which is intended (D7).

## Client first page check

Added 16 Oct 2026, 06:00 Amman, at your request.

### Sources

- The saved client first page in the repo, `claude-outputs/html/html/client-first-page.html` ("Client first-page design · 2"), and its guide `client-first-page-guide.html`.
- The brief the page keeps in its own markup (`data-brief`). This is the page's own record of what it collects. The page itself says "Interactive preview — no generation submitted": it sends nothing.
- The F1 page's section 08 describes the same page from its code bundle (`studio-D22ns9m9.js`). That bundle is not in the repo, so I did not read it. The field names below come from the stored brief.
- The A7 page draft, `claude-outputs/claude-midas-a7-page/app.js` (its `buildPayload`).
- **Test:** A7's real 01 Intent & scope was run locally on two requests: one as the A7 page draft writes it, one in the client first page's brief shape. Both asked for Lifestyle, Wide view + close-up, 4:5, Warm evening, Sage, Light oak, with colour, material and exclusions filled in.

### What the test showed

| | A7 page draft | Client first page (brief shape) |
|---|---|---|
| Accepted | Yes | **No.** Refused: "The job id must be 8 to 80 characters." and "Choose at least one outcome." |
| Images planned | white master, wide, detail | none |
| Shape | 4:5 | 1:1 (its `delivery.ratio` is not read) |
| View | Wide view + close-up | not read (`delivery.views`) |
| Colour, material | **empty** (sent as `metadata.color`, `metadata.material`; A7 reads `item.colour`, `item.material`) | empty (`details.colour`, `details.fabric` not read) |
| Things to exclude | **empty** (sent as `metadata.must_not`; A7 reads `item.exclusions` or `item.mustNot`) | not on that page as a field |
| Details to preserve | **dropped** (`metadata.locks` is not read) | `details.inventory` not read |
| SKU, dimensions, instructions | not on the page | `details.sku`, `details.dimensions`, `details.customPrompt` not read |
| Lighting, wall, floor | read | read |
| People | Human on → nothing recorded, so the planner may add a person, which stage 07 then forbids | Human off → "none" |
| A note telling the client what was not used | **none** | none |

### Findings

**F1. The client first page cannot go to A7 as it is.** A7 refuses its request. Its shape, views, SKU, dimensions, colour, fabric, piece count and written instructions all sit under keys A7 does not read. Connecting it needs a translation step, in the page or in 01 Intent & scope.

**F2. The A7 page draft drops "Keep faithful" without saying so.** Confirmed colour, confirmed material, details to preserve, things to exclude and the hero item all arrive under `metadata`, which A7 does not read. Nothing tells the client.
- "Things to exclude" is the client's way to say "not the table in my photo". Respecting excluded pieces is one of the rules that never bend. Today A7 relies only on its readers spotting a crossed-out piece.
- The 05:05 page check ran each payload through 01, but compared only the planned images, not these fields. It missed this.
- **Must be fixed before item 2 (connecting the page):** 01 reads `metadata.color`, `metadata.material`, `metadata.locks` and `metadata.must_not` as well (or the page sends `item.*`), and any field A7 does not use is listed back to the client as "not applied".

**F3. The A7 page draft offers things A7 does not deliver.** The project rule: offer only what the connected pipeline delivers; anything else shows "Coming later" and is not sent.
- **Plants** (on by default): A7 does not read the switch, and stage 07 forbids plants.
- **Human presence**: stage 07 forbids people (decision D1).
- **Midas supporting pieces** switch: not read. A7 always uses up to three confirmed Midas pieces, so switching it off changes nothing.
- **Mood / Vibes**: not read.
- Until A7 uses them, these four show "Coming later" and are not sent.

**F4. The page takes one photo; A7 takes more.** A7's 02 Ingest accepts a room photo (scene made in the client's room), other views of the product, and written files (CSV and text are read; PDF and Excel are registered but not read). The A7 page draft accepts one product photo only. The client first page offers all these reference types.

### The client first page, option by option

| Client first page | A7 today | A7 page draft | Proposal |
|---|---|---|---|
| Projects / Manual | read, no effect | not shown | keep hidden |
| Job: New Project, Edit, Single item; Batch, One by one | one item per job; Edit not built | Edit shown as coming later | keep |
| Department → Category → Sub-category | category read as text; routing comes from the photo readers | shown | keep |
| Reference types: product, room, inspiration, previous result, other views, specifications | product, room, other views, written files | product photo only | add room photo and other views (F4) |
| Outcomes: White BK, Lifestyle, Website | built | shown | keep |
| New Composition, Variations, Create with this item, Others | New Composition and Create with this item are planned as one ordinary scene each (stage 07 would make them like a lifestyle scene; their own rules, such as several supplied products or an accessory leading, are not built). Variations without a parent run are refused. Others is noted as "not offered". | coming later (Variations not shown) | keep |
| Views (4) | built | shown | keep |
| Image proportions: Standard, 1:1, 4:5, 16:9 | nine shapes | nine shapes | keep the nine |
| Resolution: Standard, 2K, 4K | read | shown | keep |
| Number of variations | not built | not shown | keep hidden |
| Lighting (3) | picks a Kelvin preset: daylight 4000 K, golden afternoon 3000 K (assumption), warm evening 2700 K (assumption) | shown | keep, after P4 |
| Wall paint (8), Floor (4) | given to the planner as fixed choices; they reach the room only through the planner's own sentence | shown | add a fixed "Walls: …" and "Floor: …" line to the room prompt |
| Plants, Human, Mood | not used (F3) | shown, plants on | "Coming later" |
| Specific Midas items or combination (section 7) | read as `midasPicks` | not sent | add later |
| SKU, dimensions, colour, fabric, piece count (section 8) | read from `item.*` | colour and material sent under `metadata` (F2); no SKU, dimensions or count fields | fix F2; add SKU, dimensions and a piece-count field |
| Description and metadata (section 9) | stage 06 always writes an English draft description | not shown | keep |
| Previous generation (section 10) | only as the parent of variations | not shown | keep hidden |
| Custom prompting (section 12) | read as `instructions`; the conflict check turns them into locks | not sent | add the field |
| Fidelity, Styling, Cluttering sliders (section 14) | not read; A7 holds fidelity fixed | not shown | keep hidden |
| Share description first (section 15) | A7's go 1 shows the plan to you, not to the client | not shown | keep hidden |

## The F1 page's build prompt (section 08) against A7 today

Added 16 Oct 2026, 06:30 Amman, at your request. That prompt asks a session to build Phase 1 of the page's section 07 (changes 1 to 12) in A7. **No session ran it.** The earlier sessions built A7's scenes along your handoff instead, and this session made no build at all (review only). The table compares each change with the A7 code read today.

| # | The prompt asks | A7 today (`a22b6f1a`) | Status |
|---|---|---|---|
| 1 | Five fixed fields with F1's names (light, camera view, framing, room style, series); series expansion; an unknown value gets one plain question; cap raised from 8 to 10; nine shapes, 1:1 default, one list for 11a and 13; client labels translated, including `delivery.ratio` | Built: nine shapes, 1:1 default, one list in 11a and 13, labels translated from `aspect` and `proportions`, four page views mapped to hero, wide and detail. Not built: the five F1 fields, series, the one-question refusal (A7 notes "not applied" instead), the cap (still 8), and the client first page's `delivery.*` keys (that page's request is refused; see "Client first page check") | Partly |
| 2 | Series locks in 08, sent to the reviewer | No series. Only the package-views case exists, in another form: views share one room (19a, 13). The reviewer gets no locks and there is no same-room check | Not done |
| 3 | F1's prop SKUs with direction tags; set picked by direction | A7 built its own shortlist: the accessories import, ranked by kind per room type. 12 of F1's 19 pieces with a SKU are in the catalogue; 7 are missing; no direction tags | Not done |
| 4 | Light, view, framing share and direction sent to the planner as fixed; the stylist check fails a plan that changes them | Shape and the client's lighting, wall and floor are sent as fixed. Framing share and direction are not; nothing fails a plan whose light contradicts the preset (P4) | Partly |
| 5 | A scene branch in 13 Compile, ported word for word from the builder | Built differently: two calls per scene (empty room, then placement), Midas pieces only, framing on the longest side. Not a port, and should not be: the builder allows unbranded context furniture, plants and a person, says "Unseen angles are necessarily inferred", measures hero framing on the frame height and keeps "12% on every side". Scenes wait for your approval of the white master, as asked | Built differently |
| 6 | A "make one image" sub-workflow for every paid call | Every paid call (white, room, placement, repair) runs through the same stage 04 nodes in the main workflow, under the same guard and receipts. Same aim; not a sub-workflow | Not done as asked |
| 7 | G2 saves the approved master's Drive id and checksum; scenes follow | Done in A7's form: the approval carries the Drive id and checksum. Stage 06 packages the white master first, then stage 07 starts the scenes | Done |
| 8 | 15f converts and resizes reference photos; more than 14 images refused | Not built: over 14 MB holds (your item 6). The white master sends at most 14 images (vendor photo plus 13 views); a scene sends at most 6 | Not done |
| 9 | Scene review: count and identity first, then light, view, framing share, direction, Midas SKUs seen, invented furniture, series continuity; no automatic repair | Built: blind count, identity checks, Midas pieces match, only listed props, scale, grounding, light, camera level, framing as a note; repairs only when you order them. Not built: direction, series or same-room continuity (your item 8) | Partly |
| 10 | Go 3, one decision for the scene set; ask you once at the start | Built instead: each scene is approved at its own go 2. No record shows the per-set or per-image question was put to you; the stage 07 build chose per image | Not done as asked: confirm (D8) |
| 11 | Stage 06 packages every approved scene at its own shape; manifest with light, view, framing, direction, Midas SKUs, review result and cost | Done in a separate step 20: jpg and webp, short side 1125 px, never upscaled, held if smaller, master kept, manifest with Midas SKUs and their stock reading. The scene manifest lacks light, view, framing, direction, review result and cost | Partly |
| 12 | Pinned tests: nine series, one white-only job, three shape groups, three refusals | Local suites pass (views-framing 79, stage 07 86, scene files 65, and others) and pinned runs 430 to 434 exist. The prompt's own test set does not, because series do not exist | Partly |

### The prompt's rules

- **Kept by A7:** no paid call; unpublished; version recorded before every change; one editor at a time; every decision in its rule 6 (white master first, 1:1, approved at go 2; nine shapes, 1:1 by default; repairs only when ordered, at most two; 2K, 4K only when chosen; delivery at each image's shape with the short side at 1125 px; held if smaller).
- **Not kept:** no record shows go 3 was asked (rule 7); the client first page's keys are not read (rule 8); the build order (rule 9) and the word-for-word port (task) were not followed.
- **Partly:** "Golden afternoon" is mapped to the warm 3000 K preset, labelled an assumption, rather than held open as a sixth value (rule 10). The mood mapping, several products in one scene, variation counts, model approval and the daily cap are left open, as the prompt asks.

### What is out of date or wrong in the prompt

- It names the workflow "stages 01–06". A7 is "stages 01–07", with scenes built.
- Its rule 6 lacks your later decisions: Midas pieces only (15 Oct, 21:50), never invent unseen parts (15 Oct, 21:50), framing on the longest side (16 Oct, 04:16), all views sharing one room (04:16), no advertising (03:24).
- The builder it says to port word for word contradicts those decisions (see change 5).
- It treats raising the cap from 8 to 10 as part of the change. That is your decision (your item 11).
- Its cost table predates the room-first design (an empty-room call per scene, shared by the views).
- It assumes the client first page is the page A7 will connect to. The A7 page draft sends a different request. Which page is connected is your decision.

### Recommendation

Do not run that prompt as written. It would rebuild stage 07 over tested work and against your decisions. Take from it, after your answers: the five light lines (with D2), the room styles and prop sets (after adding the 7 missing SKUs), the series rules (with your answer on the cap), reading the client first page's keys in 01 (rule 8), the missing scene-manifest fields (change 11) and the review additions (change 9).

A corrected build prompt for the prompt and intake fixes (parts A and B, with defaults for D1–D8) is in `claude-midas-a7-build-prompt-2026-10-16.md` (06:45).

## Decisions for you (new from this check)

Answered 16 Oct, 06:24 (revised 06:49 and 07:16): D1 → decision 22, D2 → 23, D3 → 24, D4 → 25, D5 → 26, D6 → 27, D7 → 28 (open), D8 → 29.


- **D1. People in scenes.** Your 15 Oct decision allowed one person; stage 07 says no people. Which one?
- **D2. Warm, night and twilight light without generic lamps.** Options: prefer a Midas lamp from the shortlist; allow concealed ceiling light (downlights, cove) as part of the room shell; or both.
- **D3. Camera tilt.** Keep 0° (your document MI 21–26), or allow a slight downward tilt for dining sets and sectionals, close to the vendor photo's view?
- **D4. Midas cushions on a seating product.** Allow them and tell the reviewer, or never pick cushions for seating products?
- **D5. Profile rules.** A new A7 profiles table in general wording (P2), leaving the shared table unchanged?
- **D6. Side views.** F1 infers unseen surfaces. A7 holds. Keep holding?
- **D7. Pre-order Midas pieces.** The code uses a piece whose page says pre-order; the stage 07 README says in stock only. Which is right?
- **D8. Scene approval.** A7 approves each scene at its own go 2. The F1 page planned one go 3 for the whole set. Keep per scene?

## What was not checked

- How any image model reacts to these prompts. Every fix above is a code reading; none is tested with a model.
- The earlier pipelines' render images in the project (runs 24, 29, 38, 42, 45, 52, 67): not opened.
- The 13 "rebuilt" prompts and the nine styling sheets on the F1 page: read, not used as evidence (the page says they are not the prompts that made the images).
- Whether the "Negative prompt" lists help or hurt (C4).

## Assumptions

- That the shared profiles table serves earlier pipelines. I did not trace which workflows read it; leaving it unchanged is the safe default.
- "Fix before any paid scene call" is my ranking, not yours.

## Proposed next build, if you pick it

A new A7 draft version for P1–P6, S1–S3, S5–S8 and C1–C2, after your answers on D1–D8. Pinned and local tests only; no paid call. Nodes it would touch: 04 Settings, 11 (instructions), 11c (instructions), 11a, 12, 13, 16a, 16x (prompt), 16b, 07a and a new A7 profiles table. Every suite is run again and every Code node byte-checked, as usual.

Before item 2 (connecting the page): F2 in 01 Intent & scope (read the page's "Keep faithful" fields, list anything unused back to the client), and F3 and F4 in a new page draft, checked in mock mode only.

## Leftovers

- Nothing new in n8n: no workflow, execution, data-table row or Drive file was created.
- Scratch files for the rendered prompts and the intake run are in this session's scratch folder only, not in the repo.
- Earlier leftovers are unchanged: runs table `l0roUCBwIQL3h9Eq` rows 23–30; vault rows from those runs; identity row 1; archived workflows `UPIDK9W2UkJgQdBA` and `KWeP7dIqnUyvbGlL`; executions 426–436.

## Independent check

A separate agent that had not written this document checked every claim against the code, the rendered prompts, the profiles table, the catalogue and the F1 page (06:10). It re-ran the prompt render and got byte-identical prompts. I checked each of its points against the sources before changing anything.

- **Corrected (14 points):** the model test did run once (Test 10, before the 12% line); profile rules do not reach the empty-room prompt; F1's qualifier quoted exactly; the origin of the profile rows is not on the F1 page; only 4 of 14 recorded F1 prompts end with a self-check; the page does say "23 prop SKUs"; pre-order pieces are kept by the code (new D7); SANOVA reaches the live check only as a client pick; cushions rank third, not second; the blind count is told about cushions; the negative list count (26, or 35); the prompt count (6 + 2 + 5 + 4 = 17); when the "turn the product" line appears; A6's loss is a visual reading. Four judgements are now labelled as mine (S2, P4, P6, the blind count's value), and three quotes were made exact.
- **Kept, with the source:** the F1 dining note on camera height. The checker found no such line; it is in F1's dining workflow prompt ("A lower intimate camera can hide chairs; a higher view improves count visibility.").
- **Confirmed:** workflow, version, node counts and byte check; P1, P3, P5; the light presets for the page's three words; which profiles get the living-room preset; S1, S3, S8; the profile quotes; the F1 prop counts and the 7 missing SKUs; the F1 light and style mappings; Google's box format.
- The client first page section was added after the check was started; its results come from the local run of 01 Intent & scope shown in that section.
