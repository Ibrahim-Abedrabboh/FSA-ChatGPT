---
name: midas-stylist
description: Plan and check Midas room styling around a locked vendor product. Pick real Midas SKUs; test scale, lines, finishes, 60-30-10 colour, texture, function and focal point.
---

# Midas Stylist

Version 0.4 draft, 16 Oct 2026. Aligned with the owner's decisions of 15 Oct (21:50) and 16 Oct (decisions 22–29), as built in the A7 draft (`Claude · Midas A7`, version `64545f4f`). Owner approval pending.

What changed from 0.3:
- Midas pieces only: no generic props.
- Lamps and rugs only as Midas pieces.
- No Midas cushions or throws.
- Plain sheer curtains or blinds are the only textiles.
- Built-in light, fixed light presets and camera views.
- People only when the brief asks.
- The colour check is based on the room shell and the Midas pieces.
- Side views only with a supplied photo.

This skill styles a space **around** a product. It never restyles the product.
It holds one copy of the stylist rules. They are also built into the A7 planner prompt (node 11), its checks (11b, 11c) and the scene prompts (13). When a copy disagrees with this file, raise it with the owner; do not silently pick one.

## When to use

- Planning a lifestyle or website-package scene for a Midas product.
- Choosing Midas supporting pieces (tables, Midas lamps, Midas rugs, mirrors, wall art) for a scene, from a checked shortlist.
- Checking whether a set of pieces works together before anything is rendered.
- Writing or reviewing the stylist step of an n8n pipeline.
- Reviewing a generated scene for styling (not product identity; that is the critic's job).

Not for: white-background catalogue shots beyond "product alone, soft contact shadow, no props". Not for pricing, stock promises or delivery claims.

Scope: this skill decorates. It does not do interior-design work: no moving walls, no building codes, no electrical or plumbing plans, no accessibility or safety compliance claims.

## 1. Rules that never bend

These come first. A beautiful scene never compensates for breaking one.

1. **The vendor photo is the only authority for the product.** Piece count, shape, pattern, colour, details and left/right handedness are fixed. Excluded pieces stay out.
2. **A piece shown more than once in one photo is one product**, not extra products (mirrored views, insets, reflections).
3. **Unknown stays unknown.** No guessed material, dimension, colour value or hidden geometry. Write "not confirmed".
4. **Never invent a Midas product.** A Midas supporting piece needs: SKU, catalogue photo, and the date the catalogue was read.
5. **Midas pieces only** (owner, 15 Oct 2026, 21:50). A Studio scene shows only the product, the room shell and confirmed Midas pieces, at most 3 per scene. There are no generic props: no books, vases, plants, throws, art or lamps unless each is a Midas SKU. If no Midas piece fits a spot, the spot stays empty.
6. **Never choose a supporting piece of the same kind as the product** (no second sofa beside a sofa).
7. **Stock.**
   - Out of stock is out.
   - A lamp or other light fitting needs "in stock" on its live Midas page.
   - Other pieces on pre-order are still used, with the status written next to them. Whether to allow pre-order at all is the owner's open decision 28.
   - The live page is read again at scene time; a piece that fails then leaves its spot empty.
8. **No Midas cushions or throws** (decision 25). The product's own cushions stay exactly as in the vendor photo.
9. **Never invent an unseen side.** A Left side or Right side view is made only when a supplied photo shows that side. Otherwise that image is held, never inferred (decision 27).
10. **The owner approves. The stylist never does.** No output from this skill is called "approved", "final" or "ready to publish".
11. **Colour from a photo is an estimate.** Catalogue photos are not colour-calibrated. A hex value read from a photo is marked as estimated.
12. **No material claims beyond the source.** Never call the product or a scene piece "solid wood", "marble", "genuine leather", "sustainable", "eco" or similar unless the vendor or catalogue states it. Describe looks ("oak-look", "marble-effect") only in internal notes, marked as observed.

## 2. Inputs to collect (the piece card)

Collect this for every piece before styling. Leave a field empty when it is not confirmed. Every filled descriptive field says where it came from: `vendor_stated`, `catalogue_stated`, `observed_in_photo` or `estimated_from_photo`.

| Field | Values | Notes |
|---|---|---|
| role | hero · midas_support | Exactly one hero. The 0.3 role `generic_context` is no longer used in Studio scenes |
| category | taxonomy profile (sofa, centre-table, lamp...) | From `taxonomy.json` (29 Sep 2026 snapshot) |
| sku, catalogue_photo, retrieved_on | text, URL or hash, date | Required for every midas_support piece |
| availability | in_stock · pre_order · out_of_stock · not_confirmed | Dated by retrieved_on; re-read live at scene time |
| dimensions_cm | width, depth, height | Vendor or catalogue only |
| style | one of the style menu (section 3) | |
| visual_weight | light · medium · heavy | Light = leggy, glass, open frame. Heavy = skirted, plinth, solid block |
| silhouette | angular · curved · mixed | |
| finishes | family (wood, metal, stone, glass, fabric, leather) + name + undertone (warm, cool, neutral) | |
| texture | smooth · medium · rough | Smooth = glass, lacquer, polished metal, leather. Rough = boucle, linen, open grain |
| purpose, rests_on | plan choices | Every supporting piece needs both |

Room surfaces (walls, floor, ceiling, window treatments) and the Midas pieces get a colour in words and a palette role: dominant 60, secondary 30 or accent 10. The product gets no role.

## 3. Menus

**Proposed canonical list** (Magnific board "Midas · 29 September casework", node "06 Creative Controls · Midas V3"):

- **Styles (10):** Contemporary Elegance, Warm Minimalism, Modern Luxury, Modern Classic, Japandi, Scandinavian, Mid-Century Modern, Mediterranean, Contemporary Arabesque, Eclectic Curated.
- **Ambiences (6):** Calm / Restorative, Warm / Welcoming, Elegant / Formal, Airy / Fresh, Intimate / Cozy, Expressive / Vibrant.

Owner decision pending: the same board holds a second, different list, and the client page and the older n8n form each use their own. The A7 client page offers no style or mood today: mood shows "Coming later".

**Fixed per image, never chosen by the stylist** (owner, 16 Oct 2026):

| What | Values in A7 | Notes |
|---|---|---|
| Light preset | Daylight (4000 K), Golden afternoon (3000 K), Warm evening (2700 K) | Set by the client's lighting choice or by the series; 3000 K and 2700 K are assumptions |
| Camera view | Reference view (default), Full frontal, 45° right, Left side, Right side | Reference view follows the vendor photo; the others are level, 0° tilt |
| Series | Single image, Three views, Views by light (9 images) | Each series image changes one thing (camera or light) from the approved image it is made from |
| People | none, or one adult | One adult only when the brief asks |

Client choices (lighting, wall paint, floor, view, camera view, series, people) are fixed once given and must appear in every shot. Plants and mood are not offered.

## 4. Workflow

1. **Read.** List the product's pieces, counts, sided parts and exclusions from the vendor photo. Note what is hidden as "not confirmed".
2. **Lock.** Write the hero lock: everything in step 1 is fixed. The light preset, camera view and people rule of each image are fixed too. Only the setting, the room shell, the presentation and the Midas pieces may change.
3. **Shortlist.** Apply hard filters to Midas candidates, in this order:
   - provenance: SKU, catalogue photo and date read;
   - not the same kind as the hero;
   - not a cushion or throw;
   - not out of stock, and a lamp only when in stock;
   - within the piece limit (3 per scene).

   Record every rejected piece with its reason.
4. **Check the eight pillars** (section 5) for the shortlist plus the planned room shell.
5. **Compose.** Build up to three candidate boards. Each board gives:
   - the selected pieces and their placement;
   - palette roles and room shell;
   - rejected alternatives and why.

   "Best" means best among the boards compared, never best in the whole catalogue.
6. **Plan.** Write the scene plan (section 7B) for the chosen board.
7. **Hand off.** The render step gets the original vendor photo, each Midas catalogue photo and, for a side view, the supplied side photo, as references. A text name alone is not enough identity evidence. After rendering, the critic reviews (section 8).

**Reverse role.** When the hero is an accessory or small table, build the room to serve it. It stands on a credible surface: a shortlisted Midas table when there is one, otherwise a built-in shelf, niche or counter of the room shell. It stays legible at its real scale. No generic books or objects are added around it.

## 5. The eight pillars

Each pillar returns **pass**, **partial**, **fail** or **unknown**. Unknown is never guessed into a result.

| # | Pillar | Pass | Partial | Fail | Typical fix |
|---|---|---|---|---|---|
| 1 | Scale & proportion | Weights balanced; centre table about 50–75% of sofa width | Two heavy pieces offset by a light one; table outside the band | Two or more heavy pieces and nothing light | Swap one heavy Midas piece for a leggy or glass one; resize the table |
| 2 | Silhouette & lines | Straight and curved lines both present | All angular (rigid) or all curved (soft, busy) | — | Add one rounded Midas piece, or one straight-lined anchor |
| 3 | Materials & finishes | Up to 3 wood/metal finishes; wood undertones consistent | Warm and cool wood undertones mixed | More than 3 wood/metal finishes | Drop the fourth finish; keep undertones the same even if darkness differs |
| 4 | Colour 60-30-10 | Dominant 45–75%, secondary 15–45%, accent 3–20% of planned surfaces | A role missing, or a share off its band | — | Rebalance walls, floor, window treatments or the Midas pieces. **Never recolour the product** |
| 5 | Texture contrast | Smooth and rough both present | One texture family only | — | Choose a Midas piece or a floor or wall finish with the contrasting texture. No added cushions or throws |
| 6 | Function & practicality | Every supporting piece has a use and a surface | A piece without a use or support | — | Give it a job and a surface, or remove it |
| 7 | Focal point | Nothing outweighs or out-sizes the product | A supporting piece is heavier or wider than the product | — | Smaller support, move it back, or crop it |
| 8 | Style cohesion | One style | Two styles (fine for an eclectic brief) | Three or more styles | Requested style plus at most one accent style |

Notes:
- The 60-30-10 split applies to the **room shell and the Midas pieces**, not to the product. The product keeps its own colour; it takes whichever role its size gives it.
- On a white-background output, pillars 4 and 6 are unknown: there is no scene to style.
- The 50–75% table band and the 60-30-10 bands are designer rules of thumb, not measurements. The owner may tune them.
- "Material affinity" and "texture contrast" are different rules with opposite intent: finishes should agree, textures should differ. Keep them separate.
- With few pieces (often 0 to 3 Midas pieces), several pillars are "unknown". That is expected, not a fault.

## 5b. Room, walls and architecture

These rules shape the room around the product. They feed pillars 1, 4, 5, 6 and 7; they are not a ninth scored pillar. The product is never changed to suit the room.

**The room shell** is walls, floor, ceiling, skirting, windows, doors, fixed architectural details and the built-in light. In the empty-room step it is described by walls, floor, windows, room size and a clear floor zone only. It never names the product or any furniture.

**Space and scale**
- Set the room size before styling: small, medium or large. The room must make the product's real size believable: no empty hall around one chair, no sofa running wall to wall.
- To keep a small room open, choose low-profile or leggy **Midas** supporting pieces. Never swap or reshape the hero for this.
- Plan a clear walking path, and put support pieces where they would be used: a side table within reach of a seat. Rules of thumb, to confirm: about 40–45 cm from sofa to centre table, about 75–90 cm for main walkways. Image models do not hold exact distances, so the critic checks that the layout is believable, not the centimetres.
- **Mirrors:** only a Midas mirror SKU, placed so it does not reflect the product, the camera or a person. A reflected product reads as a second piece and fails the count check.

**Walls and colour**
- A wall paint or floor chosen by the client is fixed and written as its own line. Build the palette of the Midas pieces around it (pillar 4).
- When the studio chooses, pick the wall colour with the light preset, and keep it from shifting the product's colour.
- Repainting, wallpaper and accent-wall advice for a client's own room is **not offered**.
- Wall art only as a Midas SKU: abstract or generic, with no readable or garbled text, no people, no recognisable existing artwork and no logos. Otherwise the wall stays plain.

**Architectural features**
- Fireplaces, built-ins, alcoves and large windows are quiet context. They must not become a second focal point (pillar 7).
- **Rugs:** only a Midas rug SKU. Then the rug defines the seating zone and must not hide legs, feet or base details. Without a Midas rug, the floor is bare and the floor meets the bottom edge of the frame.
- **Windows:** plain sheer curtains or blinds at most; no other textiles. Never in front of the product.
- **Shelves:** a built-in shelf or counter may carry an accessory hero (reverse role). It is never filled with generic objects or books.

## 5c. Light, balance and zones

Like 5b, these feed the existing pillars (mainly 4, 6 and 7) and are not scored on their own.

**Light** (decision 23)
- Each image's light preset is fixed. The stylist plans light within it and never changes it.
- Daylight comes through the windows. Golden afternoon is low, warm sun through the windows with the built-in light on. Warm evening has dark windows: the light comes from the room's built-in light.
- Built-in light means recessed downlights, a cove light or a plain ceiling fixture. It is shown as part of the architecture, not as a product.
- A table lamp, floor lamp or anything that reads as a saleable lighting product appears only as a Midas lamp, confirmed in stock and named in the plan. When the product itself is a lamp, it is the scene's only lamp unless a Midas lamp is planned.
- The product's colour must stay as in the vendor photo. Warm light may warm the room, but never turn the product a different colour, glare on it or throw a hard shadow across it.
- Light direction stays the same in every shot of one room.
- In a client's own room photo, the light is the photo's own; no preset is applied.

**Balance and rhythm**
- Balance the visual weight across the frame, either symmetric (pairs either side of the product) or offset (a tall piece on one side, a group of smaller ones on the other).
- Repeat the accent colour or one finish two or three times across the frame (Midas pieces, wall, window treatment) so the room reads as one. More repeats look staged.
- Leave empty space around the product so it reads first.

**Zones**
- One main zone per shot, built around the product and defined by the light and the arrangement (and a Midas rug when one is planned).
- Other zones appear only as soft, partial background and never pull the eye from the product.

## 5d. Camera, views and people

**Camera** (decision 24)
- Reference view: the camera sees the product from the same side, angle and perspective as the vendor photo. The room may stand square to the camera while the product stands at its photographed angle.
- Full frontal, 45° right, Left side and Right side: a level camera, 0° tilt, verticals straight, no fisheye.
- When the count cannot be read from chest height (for example a 12-chair dining set), the camera may be raised. It stays level and the verticals stay straight. In A7 this starts at 9 pieces for dining families, which is an assumption.
- A view other than the Reference view shows only what the photos show. A surface no photo shows stays out of view or plain.
- The left-to-right order of the pieces is the vendor photo's; keep it.

**Views and series**
- Hero, wide and detail views of one job share one room, arrangement and light; only the camera moves.
- In a series, each image is made from an approved image of the same series and changes only the camera or only the light.
- A detail view shows a named detail the photo actually shows; it never invents construction.

**People** (decision 22)
- None by default.
- When the brief asks, at most one natural adult. They stand beside or behind the product, never in front of it or covering any piece, and are clearly secondary.
- Never in the empty room or on the white master.

## 6. Styling-fit score

The score ranks candidate boards. It is a rule-based judgement, not a measurement, and never an approval.

- Pillar values: pass 1, partial 0.5, fail 0. Unknown pillars are left out.
- Weighted average using the active profile, normalised (weights need not sum to 100). Shown as a whole number, no decimals.
- **Coverage** = share of weight that could be evaluated. Below 60%: no score; status "needs information" with the list of what is not confirmed.
- Profiles:
  - **balanced** (default): scale 20, silhouette 15, materials 15, colour 15, texture 10, function 10, focal 10, style 5.
  - **strict_match**: style 30, materials 25, scale 15, silhouette 10, colour 10, texture 5, function 3, focal 2.
  - **eclectic_designer**: scale 25, silhouette 25, texture 17, colour 10, materials 10, function 5, focal 5, style 3.
- Weights only move the score when pillars disagree. If every pillar passes, every profile gives the same score.
- **Where it may appear:** internal stylist notes, run logs and the owner's go 1 as a warning. **Never** on the client page, never next to a product-fidelity result, never presented as the 90 to 95 target.
- In A7 the score blocks nothing: an engine "needs change" is shown at go 1 as a warning. Re-plans come from the plan critic, at most 2 rounds.
- **Known limit (16 Oct 2026):** the catalogue's style, finish, texture and weight tags are empty, and the product's tags are not read from the photo. So most plans read "not scored". Making the score work needs a tagging pass of the Midas catalogue (a paid model call, owner's go) and product tags from the photo reader (an A7 change).

Plan status: `plan_ready` (all known pillars pass), `plan_ready_with_warnings` (a partial), `plan_needs_change` (a fail), `needs_information` (coverage below 60%).

## 7. Outputs

### 7A. Stylist critique (internal)

```
Styling fit: 78 (balanced profile; coverage 85%; rule-based judgement, not an approval)
The win: <what works, one or two lines, e.g. "The round walnut table softens the boxy sofa">
The conflict: <each partial or fail, one line each>
The stylist's fix: <one concrete action per conflict, e.g. "Swap the chrome side table for brushed brass to stay within three finishes">
Not confirmed: <pillars or facts that could not be checked>
Excluded pieces: <SKU — reason>
```

### 7B. Scene plan (feeds the render step)

One JSON object per shot, the same keys as the A7 planner (node 11):

```json
{
  "output_id": "view_full_frontal",
  "frame": "square, 1:1",
  "room_size": "small | medium | large",
  "room": {"walls": "warm plaster", "floor": "light oak boards", "windows": "one tall window with plain sheer curtains", "zone": "centred against the long wall"},
  "setting": "one or two sentences, including the wall and the floor",
  "light": "one sentence within the fixed preset",
  "camera": "one sentence within the fixed camera view that keeps every product piece fully visible and countable, unless a detail view",
  "presentation": "how the product is placed, as a person would really use it",
  "person": "",
  "supporting_props": [],
  "midas_pieces": [{"sku": "167885", "count": 1, "purpose": "...", "rests_on": "..."}],
  "palette_roles": {"dominant_60": "...", "secondary_30": "...", "accent_10": "..."},
  "rationale": "one sentence"
}
```

Plus, once per plan:
- `risks`: what an image model is most likely to get wrong. These go to the reviewer, never into the image prompt.
- `catalogue_rejected`: shortlisted pieces considered and left out, with reasons.

Rules for the fields:
- The `room` fields name no furniture or object; `zone` says where the product will stand without naming it.
- `supporting_props` is always empty.
- `person` is an empty string unless the brief allows one adult.
- No scores or percentages in the plan.

White background: product alone on a plain pure white seamless background with a subtle contact shadow; the vendor photo's camera angle; no props, no Midas pieces, no room, no person; empty room fields and palette.

Website package or lifestyle views: the white master is approved first. Every later shot repeats the room, arrangement, Midas pieces, person and light of the first view with a different camera. A series image changes only its camera or only its light.

## 8. Critic and repairs

The critic compares the generated image with the original vendor photo (and, for a side view, the supplied side photo). It returns one of:

- **REJECT**: a clear mismatch (count, camera, construction, sided part, invented Midas piece, unplanned lamp, a person where none is allowed or in front of the product).
- **NEEDS_REFERENCE**: critical evidence is unreadable or an image role is missing.
- **PASS_CANDIDATE**: a reviewed candidate. Still needs the owner. Never "approved".

Each check returns pass, partial, fail or unknown with expected, observed and the image region. No percentages in the critic. Styling checks never change a product check. Framing is a styling note: a miss never fails the image on its own.

**Repairs:** only when the owner orders one at go 2 (`auto_repair` stays off). Fix only named defects; keep the original as the identity reference on every attempt; recheck the whole product, not just the repaired region. At most two repairs per image, then hold. A held image keeps the package incomplete; an incomplete package is never called complete.

## 9. Magnific tools on product images

- **Allowed:** upscale, remove background, expand (outpaint).
- **Not allowed on product images:** restyle, reimagine, relight, change camera. These redraw the product.
- **Not yet decided** (treat as not allowed): replace background, variations, retouch.

Generate only when the owner says so in that message. Reading boards and nodes is fine.

## 10. Language

- Internal notes may use pipeline terms. Client-facing text never shows internal names (Eye, Brain, Critic, n8n, model or provider names), scores or verdict codes.
- Client results are labelled "Generated image". "Approved" appears only from the owner's recorded decision.
- No promises on delivery time, pixel size, retention or a human stylist.
- English first, right-to-left ready. Arabic copy needs a native review before use.

## 11. Before handing off, check

- [ ] Hero lock written: pieces, counts, sided parts, exclusions.
- [ ] Every supporting piece is a Midas piece with SKU, catalogue photo, date read and stock status; `supporting_props` is empty.
- [ ] No piece of the hero's kind, no cushion or throw, nothing out of stock, a lamp only when in stock; at most 3 per scene.
- [ ] Light preset, camera view and people rule followed as fixed; nothing changes them.
- [ ] Each pillar has a result or "not confirmed"; no guessed facts.
- [ ] Score shown only with its profile, coverage and the "not an approval" label, or not shown.
- [ ] Camera keeps every product piece countable (unless a detail view); no view shows a side the photos do not show.
- [ ] Nothing in the plan recolours, reshapes, relights or re-angles the product.
- [ ] Rejected boards and pieces recorded with reasons.
- [ ] Room size makes the product's real size believable; a clear path is planned; the room fields name no furniture.
- [ ] No mirror reflects the product; a rug only as a Midas rug and never hiding legs or base details.
- [ ] Windows: plain sheer curtains or blinds at most; no other textiles.
- [ ] No lamp except a planned Midas lamp (or the product itself); warm light from the built-in light.
- [ ] No person unless the brief allows one adult, beside or behind the product.
- [ ] No fireplace, built-in or window competes with the product as a focal point.
- [ ] No material or sustainability claim that the vendor or catalogue does not state.

## Reference implementation

`claude-outputs/claude-midas-stylist-skill/reference/`: `stylist_schema.py` (Pydantic v2 input checks) and `stylist_engine.py` (the shortlist filters, eight pillars, score and status above, in code). Tests in `tests/`. Pure code, no model or paid call.

For n8n, use `n8n/claude-stylist-check.code.js` in a JavaScript Code node. It gives the same result as the Python engine (10,000-case parity test). In A7 it runs unchanged inside node `11b Stylist check`, behind an A7 wrapper that applies the rules of sections 1, 5b, 5c and 5d.

Known gap, 16 Oct 2026: the engine is still v0.3 code.
- Its fix texts for pillars 4 and 5 still suggest rugs, curtains, cushions and linen. A7's wrapper removes generic props and the plan critic checks the rules, so these texts only reach the owner as go-1 warnings.
- The schema still accepts the role `generic_context`.
- Aligning the engine is a separate, tested change (Python and JavaScript together, parity re-run).

Do not use the older Python snippet that reads `ndv.first()`: it cannot run in n8n and its score is 100 times too large.
