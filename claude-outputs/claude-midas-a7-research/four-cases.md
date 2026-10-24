# A in four real cases (cases.json, date 2026-10-04 )
Basis: Real assisted image runs and local artifact checks; not an autonomous A execution 
Counts: {"cases": 4, "responsibilityMappings": 84, "imageCalls": 11, "completeCandidatePackages": 4, "productionRuns": 0} 

## dining · Twelve chairs · count and source conflict
- route: {"profile": "counted_dining_set", "hero": "furniture", "countGate": true, "selectionGate": true, "colourHold": false}
- scope: one lifestyle composition and one scoped product/detail image | inventory: {"table": 1, "armless_chair": 10, "armchair": 2}
- precedence: Source annotation says TABLE+12CHAIRS + 2 ARMCHAIRS. The repeated user brief and supplied later composition specify 12 total. Contract uses 10 armless + 2 end armchairs; it does not silently use 14.
- locks: One table; 12 total chairs; Five chairs per long side; one armchair at each end; Champagne-gold finish, cream upholstery; Scalloped edge, fluted twin bases and stretcher; No added central medallion
- modes: identity_locked / creative_illustrative
- unknowns: Exact wood/metal composition and upholstery fibre; Measured table dimensions; Hidden carving and rear surfaces; Colour cannot be calibrated from this small JPEG | consequence: Incorrect chair count is a hard failure. A detail view never replaces the whole-set count check.
- midas selected: ORGANIC dinner plate SKU 173765; RIFFLE stemmed glass SKU 167602
- design: Restrained neoclassical room; warm late-afternoon light. Elevated frontal view keeps the five near and five far chair backs separate. Twelve place settings, mostly clear centre, visible pedestal bases.
- reverse role: Furniture-led: supporting tableware serves the dining set. Accessory-led reversal is evaluated and not selected.
- runs:
    dining-wide-1 wide initial 33.517s
    dining-repair wide repair 23.352s
    dining-repair-2 wide repair 55.752s
    dining-detail detail detail 19.071s
- reviews:
    dining-wide-1 → Fail · 11 chairs | Five far-side chair backs, four near-side backs and two end armchairs are visible: 11 total. / Scalloped apron, gold finish and fluted twin supports remain recognizable. / Dining context, separate seating and low tableware provide clear hierarchy.
    dining-repair → Count corrected · geometry regression | Five near + five far + two end chairs: 12 total. / Near row was re-spaced, and the original missing seat was added. / Right pedestal moved outward relative to the first image and source relationship; the repair changed more than the requested count.
    dining-repair-2 → Held · unresolved pedestal spacing | All 12 chairs remain individually visible. / The requested inward pedestal movement is not clearly present in the returned image. / Second permitted wide repair exhausted; retain the image as a held candidate.
    dining-detail → Detail candidate · package still held | One cream plate, one fluted stem glass and folded napkin are visible on the source-style gold scalloped tabletop. / Glass bowl is wider and more legible than the narrow glasses in the wide candidate. / The detail retains warm side light and cream/gold chair context.
- defects: D1: Initial image has eleven chairs rather than twelve. | D2: Chair-count correction displaced the right pedestal toward the end. | D3: Wide-view glasses are narrower than the supplied RIFFLE goblet reference.
- repair decision: Two wide-image repairs used. The chair count is corrected, but pedestal placement is not visibly restored. Hold the dining wide image; do not spend on a third repair or call it approved.
- benchmark: 12-seat selection now satisfied; source-specific pedestal spacing and supporting glass identity remain unresolved in the wide view. No numerical fidelity score assigned.
- package: complete True | status Held · table geometry needs review | released False | specHold False
- business: {"imageCalls": 4, "repairCalls": 2, "costCurrency": null, "monetaryCost": "Not supplied by tool; not treated as zero", "humanActiveMinutes": null, "businessSavings": "No comparable accepted-package baseline measured"}

## chairs · Two chairs · exclusion mark and visible faces
- route: {"profile": "selected_pair_from_scene", "hero": "chairs", "countGate": true, "selectionGate": true, "colourHold": false}
- scope: one contextual pair view and one closer pair/detail view | inventory: {"chair": 2, "source_table": 0}
- precedence: Large X overlays the brown table. Read together with the user instruction “2 chairs without the table”: exclude the source table and select exactly two chairs. X is not decoration or a crop guide.
- locks: Exactly two armless chairs; No original brown table; Cream front and camel/tan back inset; Slim tapered silver-grey legs; One front/three-quarter view and one rear view
- modes: identity_locked / creative_illustrative
- unknowns: Exact fibre blend; Metal alloy and finish specification; Actual seat and back dimensions; Occluded leg connections | consequence: Duplicate chair, missing chair, reintroduced source table or changed defining rear panel triggers repair.
- midas selected: WEX WALL ART - BEIGE SKU 170143
- design: Residential dressing/seating corner, soft morning light, pale oak floor, warm neutral walls. Two separated chairs are prominent. The full WEX relief sits behind them as a subordinate wall element.
- reverse role: Furniture-led: the chair pair is the hero. The artwork supports the room; it does not become the main subject.
- runs:
    chairs-wide-1 wide initial 77.88s
    chairs-detail detail detail 87.313s
    chairs-detail-repair detail repair 31.219s
- reviews:
    chairs-wide-1 → Visible selection check met | Exactly two armless chairs, with front and tan rear views. / Source brown dining table and X annotation are absent. / Slim grey metallic legs and grounded contact shadows are visible. / One WEX relief artwork supports the background; room architecture and other distant context are illustrative.
    chairs-detail → Repair required · invented pattern | The pair, tan rear panel and silver-grey legs remain. / Cream upholstery gains distinct leafy/scroll-like patterning that the original does not support.
    chairs-detail-repair → Targeted detail corrected | The front/seat now read as plain fine woven texture rather than a large decorative motif. / Both chair shapes, placement, tan rear panel and metallic legs remain. / WEX artwork and morning-light direction remain consistent with the wide composition.
- defects: C1: First close-up invented a large decorative upholstery pattern.
- repair decision: One targeted close-up correction removed the invented motif. Retain the first close-up in the attempt history. No further repair requested for the visible pair/count/exclusion checks.
- benchmark: Two selected chairs and excluded source table are preserved. The corrected close-up shows plain woven appearance; exact fibre, colour and dimensions remain unknown.
- package: complete True | status Review candidate · detail repaired | released False | specHold False
- business: {"imageCalls": 3, "repairCalls": 1, "costCurrency": null, "monetaryCost": "Not supplied by tool; not treated as zero", "humanActiveMinutes": null, "businessSavings": "No comparable accepted-package baseline measured"}

## towel · Terry textile · inset and swatch uncertainty
- route: {"profile": "textile_with_conflicting_swatch", "hero": "textile", "countGate": true, "selectionGate": false, "colourHold": true}
- scope: one provisional lifestyle view and one texture/border detail | inventory: {"textile": 1}
- precedence: Separate main photograph, detail inset and colour swatch. Do not multiply the towel by panel count. Green swatch conflicts with the main body colour; no colour code is legible.
- locks: One rectangular terry textile; Flat woven band near each short end; Looped pile and hemmed edge; Main photograph’s rosy-taupe appearance for this provisional candidate
- modes: identity_locked / creative_illustrative
- unknowns: Towel versus bath-mat classification remains provisional without dimensions; Intended approved colour: rose-taupe photograph versus olive swatch; Fibre composition, GSM and dimensions; Vendor-approved colour name/code | consequence: Publish as a provisional visual candidate only. Exact colour, fibre and product classification remain unresolved; no vendor-approved catalogue release.
- midas selected: CELATO VASE - WHITE SKU 170985
- design: Travertine bath vignette with soft window light and a bronze rail. One draped textile, visible lower band, cream CELATO in a recessed niche. Neutral illumination keeps the observed colour legible.
- reverse role: Textile-led: bath fittings and selected vase serve the single item. The room is illustrative; dimensions and wet-area installation are not being specified.
- runs:
    towel-wide-1 wide initial 59.671s
    towel-detail detail detail 45.226s
- reviews:
    towel-wide-1 → Provisional appearance candidate | One folded-over textile hangs from the rail; the two visible lower ends belong to that same draped item. / Rosy-taupe appearance follows the main source photograph; the olive swatch was not silently applied. / Flat border band and hem are visible. / A CELATO-like branching white vase sits on the dry
    towel-detail → Scoped texture detail | Close view shows looped pile, the flat woven band and hem on the same drape. / Band and edge remain visible rather than being cropped out. / Lighting and bathroom context continue from the wide view.
- defects: T1: Approved colour, dimensions and fibre absent; main photo conflicts with olive swatch.
- repair decision: No targeted visual correction requested. Keep the specification hold: a plausible towel visualization does not resolve whether the client intends the olive variant or whether dimensions would classify the item as a bath mat.
- benchmark: The candidate preserves one draped textile, a visible woven border and rosy-taupe appearance. The detail demonstrates texture intent, not measured textile reproduction.
- package: complete True | status Provisional · colour and category unresolved | released False | specHold True
- business: {"imageCalls": 2, "repairCalls": 0, "costCurrency": null, "monetaryCost": "Not supplied by tool; not treated as zero", "humanActiveMinutes": null, "businessSavings": "No comparable accepted-package baseline measured"}

## bookends · Bookends · accessory-led reverse styling
- route: {"profile": "functional_accessory", "hero": "bookends", "countGate": true, "selectionGate": false, "colourHold": false}
- scope: one accessory-led lifestyle view and one functional close-up | inventory: {"bookend": 2, "book": 3, "SANOVA_table": 1}
- precedence: Two separate physical objects; no inset or quantity overlay. The unequal forms are complementary, not duplicates or matching mirrored fans.
- locks: Exactly two asymmetric bookend pieces; Preserve narrow crescent and broad U silhouettes; Concentric grooves and ivory speckling; Three books between the supporting pieces; One blue SANOVA table, full footprint supported
- modes: identity_locked / creative_illustrative
- unknowns: Exact base material: stone/resin-like appearance only; Bookend dimensions and weight; Load capacity and anti-slip treatment; Product colour code | consequence: Generic mirrored replacement, extra pieces, unsupported books or a product hanging outside the tabletop triggers repair or a hold.
- midas selected: SANOVA END TABLE SKU 161283
- design: Library corner with subdued walnut shelving and warm side light. The whole blue table is visible; the accessory remains large enough to inspect. No repeated cream ornaments elsewhere.
- reverse role: Active: accessory is the hero, Midas furniture is its support. It remains the same pipeline with a changed hero/support relation, not a separate workflow engine.
- runs:
    bookends-wide-1 wide initial 100.699s
    bookends-detail detail detail 68.678s
- reviews:
    bookends-wide-1 → Accessory-led layout demonstrated | One narrow crescent at left and one broader U-like form at right; three upright books between them. / The pair rests on a blue wavy SANOVA-like table with tabletop edge and full floor contact visible. / Ivory hero against blue supporting furniture creates distinct product hierarchy. / No repeated he
    bookends-detail → Functional detail demonstrated | Both asymmetrical pieces and three books remain in the same order. / Concentric grooves, openings, speckling and contact surfaces can be inspected. / Blue scalloped tabletop and wave fluting remain visible as the supporting product.
- defects: B1: SANOVA blue finish appears deeper than the supplied light-blue reference; no exact colour approval.
- repair decision: No extra-piece or unsupported-object defect was found that warranted a targeted repair. Retain the visible finish and scale limitations rather than claiming an exact SKU-perfect render.
- benchmark: Two unequal carved forms and three books remain legible. The source silhouettes are recognizable; precise groove geometry, weight, real-world fit and supporting table colour are not validated.
- package: complete True | status Review candidate · supporting finish approximate | released False | specHold False
- business: {"imageCalls": 2, "repairCalls": 0, "costCurrency": null, "monetaryCost": "Not supplied by tool; not treated as zero", "humanActiveMinutes": null, "businessSavings": "No comparable accepted-package baseline measured"}

## The 21 steps: actor / production-A replacement / handoff (from case dining)
1. Intent & scope | actor now: Assistant + local contract | A replacement: Typed intake compiler + conflict-resolution model call. | handoff: Send the agreed inventory and exclusions to ingestion. A conflicting printed count never silently overrides the user.
2. Eye · ingest | actor now: Local file checks + assistant vision | A replacement: File parsers, image decoding, OCR and vision calls behind a stable observation schema. | handoff: Original files remain immutable; every image call receives them as references. Image decoding is real; OCR/vision extraction is assistant-performed here.
3. Eye · recognize | actor now: Assistant vision | A replacement: Taxonomy matcher + visual classifier; uncertainty routes to a richer perception call. | handoff: Classify the product and separate physical pieces from panels before styling. No deployed visual classifier is claimed.
4. Eye · interpret signs | actor now: Assistant interpretation | A replacement: Region detection + relation extraction + intent precedence rules. | handoff: Selection meaning passes into the contract; ambiguity cannot be erased by a prettier rendering.
5. Eye · preserve uncertainty | actor now: Assistant + explicit unknown fields | A replacement: Typed evidence fields and a critical-unknown gate. | handoff: Unverified composition, dimensions and colours stay unknown. Provisional visuals can be reviewed without publishing those facts as specifications.
6. Eye · scene & time | actor now: Assistant spatial reasoning | A replacement: Scene graph extraction and correspondence checks against reference roles. | handoff: Spatial placement and wide/detail consistency are checked. No temporal model or hidden-view reconstruction has been exercised.
7. Brain · route | actor now: Local deterministic routing function | A replacement: Rule-based plan compiler chooses a graph from capability-tested operations. | handoff: The route() function selects this profile from the explicit observation fields. It does not classify the input pixels itself.
8. Brain · modes | actor now: Assistant + contract flags | A replacement: Two explicit policy modes: fidelity-locked and creative-room, independent of architecture A/B. | handoff: Room invention is allowed; product redesign and inventory changes are not. A creative room is not a measured customer-room fit.
9. Brain · semantic grounding | actor now: Assistant relation record | A replacement: Versioned ontology and relational graph; retrieval uses metadata and visual similarity when implemented. | handoff: Attach meaning to the image regions and references. Unknown physical properties cannot be recovered merely by naming an ontology.
10. Stylist · retrieve | actor now: Assistant catalogue retrieval | A replacement: Catalogue indexing and retrieval service; hard filters before visual ranking. | handoff: These are curated source-backed choices with stated reasons. They are not the winner of an exhaustive catalogue-ranking experiment.
11. Stylist · compose | actor now: Assistant composition plan | A replacement: Structured scene proposals; composition evaluator ranks candidates before rendering. | handoff: Composition is checked against product visibility, hierarchy, palette and usable support before and after rendering.
12. Stylist · reverse role | actor now: Role parameter in the same route | A replacement: Hero/support relation is a parameter in the same scene planner. | handoff: Accessory-led generation changes who is the hero and which objects support it; it does not require another agent.
13. Engine · compile | actor now: Local prompt artifact + hash | A replacement: Prompt/schema compiler and adapter capability checks. | handoff: The saved executable prompt names every input role and preserves the original locks. Detail prompts additionally refer to the selected wide image.
14. Engine · choose models | actor now: Assistant tool selection | A replacement: Per-task model registry selected by measured quality, cost and limits. | handoff: One image tool is used here. Do not translate the responsibility list into a claim of 21 models or measured model superiority.
15. Operator · execute | actor now: Image tool invoked by assistant | A replacement: Durable queue + worker + transactional lease/outbox + provider receipt reconciliation. | handoff: These are real calls made during this chat. A server queue, durable provider integration and unattended operation remain unproven.
16. Critique · assess | actor now: Assistant visual review | A replacement: Separate structured vision-review invocation plus deterministic count/schema checks. | handoff: Count/identity/placement and style are separate. The reviewer here is this assistant, not the proposed A review service.
17. Critique · repair | actor now: Assistant correction + local attempt bound | A replacement: Bounded controller selects local edit, fresh render from originals, or hold. | handoff: A named defect triggers a targeted edit; reread the original and previous correct regions. A need for a repair is not itself a new success case.
18. Critique · benchmark | actor now: Assistant reference comparison | A replacement: Fixed evaluation corpus and versioned graders; paired runs with actual provider receipts. | handoff: Evaluate visible differences against the source. Historical outputs supply context only; new generations are never substituted for failed earlier jobs.
19. Vault · memory | actor now: Local filesystem and JSON records | A replacement: Structured database + immutable assets + append-only events + versioned retrieval. | handoff: Saved files, hashes, prompts and findings form the Vault sample. This is actual local persistence, not a deployed database or cross-session retrieval service.
20. Package & release | actor now: Local package completeness check | A replacement: Package manifest + checksums/dimensions + current review gates + release policy. | handoff: Release here means a reviewable walkthrough containing candidates and defects. No commercial catalogue approval or autonomous release is asserted.
21. Business operator | actor now: Local metrics; no invoice supplied | A replacement: Queue scheduling, bounded retries, caching valid results and package-level metrics. | handoff: The business measure is cost and human time per accepted complete package. This run records calls and elapsed generation times without inventing savings.
