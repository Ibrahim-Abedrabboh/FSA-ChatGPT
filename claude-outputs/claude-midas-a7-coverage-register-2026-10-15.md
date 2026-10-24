# Claude · Midas A7: coverage register for the owner's three documents

15 Oct 2026, 21:45 Amman; updated 22:40 (stage 05 build, sheet answers of 22:30), 23:40 (framing) 16 Oct 2026, 01:30 (stage 06 Package built; hold-and-ask rule; open points 1–4 closed; see `claude-midas-a7-stage-06-README-2026-10-16.md`) and 16 Oct 2026, 02:45 (stage 07 Scenes built; accessories catalogue imported; model test aligned; see `claude-midas-a7-stage-07-README-2026-10-16.md` and `claude-midas-catalogue-import-README-2026-10-16.md`), 16 Oct 2026, 03:50 (scene shapes and scene delivery files built; see `claude-midas-a7-scene-files-README-2026-10-16.md`), 16 Oct 2026, 05:05 (framing on the longest side, view mapping, nine-shape page draft; see `claude-midas-a7-views-framing-README-2026-10-16.md`), 16 Oct 2026, 05:45 (prompt check and F1 Options intake, no n8n change; see `claude-midas-a7-prompt-check-2026-10-16.md`), and 16 Oct 2026, 09:05 (prompt and intake fixes, owner decisions 22–29, page draft 2; A7 version `64545f4f`; see `claude-midas-a7-prompt-fixes-README-2026-10-16.md`). Code, tests and exports now live in the private GitHub repo `Ibrahim-Abedrabboh/claude-midas-studio`. Written by Claude. A checklist; rows marked **Built** are in the A7 draft and tested with pinned data only.

Sources (all pages read):
- **WA**: "Wrong Assumptions" (3 pages, 41 points).
- **MI**: "Missing in HF Studio and VTON", titled "Missing in Suggested Studio Solutions" (20 pages, 87 points).
- **MS**: "Suggested Midas Item measurements and studio Suggested workflows" (20 pages, 94 points; mostly an assistant chat the owner pasted, so its methods and numbers are suggestions unless the owner asked for them).

A7 = "Claude · Midas A7 (stages 01–07)", `1cgZc9rmBOrPdKIe`, version `64545f4f` (16 Oct 2026, 08:58 Amman), not published, never run. Status words: **Built** (in A7 now, tested with pinned data), **05**, **06**, **Scenes**, **Package** (where it will be built), **Data** (a data task, not a workflow), **Not A7** (out of the Studio's scope), **Decide** (needs the owner).

## 1. Scope and identity

| Point | Source | A7 |
|---|---|---|
| Studio and VTON are two scopes, two users, two solutions; not one integrated workflow | WA 2–5, 7 | **Built** as scope: A7 is the Studio only. VTON (customer try-on in a customer room photo, MI 73) is **Not A7**. |
| Studio users are the in-house team; source is vendor raw images only | WA 7, 8 | **Built**: A7 starts from the vendor photo; the client page is the team's page. |
| Output: standardized 2D product images for a retailer's selling catalogue, not inspiration; not a room-design platform | WA 9, 10, 20, 31; MI 73 | **Built** as rule; 2D to 2D only. |
| Expected outcome: saving with higher capacity; cost per need, not per generation | WA 11, 34; MI 46 | **Partly**: cost estimate per job and receipts per call are built. Cost per accepted package: **Built** (stage 06; image calls of the run, repairs included; an estimate; readers and reviewers not counted). SKU tiering (Tier 1/2/3) to control spend (MI 69): **Decide** (tiers not defined). |
| Every approved product ends in an identity vault entry that VTON may read and nothing else | MI 13, 14 | **Partly**: the vault records every step. Per-SKU identity entry is **Built** (stage 06, table `OpszBn1IWmYzWftI`): approved master checksum and Drive id, package files and checksums, spec card, cost; keyed by SKU, or by the vendor photo checksum when there is no SKU. Albedo, roughness and normal maps are not produced by the image models A7 uses: **Decide** whether a later stage adds them. |
| Midas owns every asset and the vault from creation | WA 28 | **Built**: Drive and n8n tables owned by Midas. **Partly**: stage 06 stores each package in a versioned Drive folder; a separate permanent asset store is not built. |
| Agentic roles (orchestrator, Director, Critic, Stylist); several different foundation models | WA 35, 37 | **Built**: readers (Gemini, Claude), conflict check (GPT), planner and plan critic (GPT, Claude), stylist skill (code), image (Gemini), image review (Claude) and blind count (Gemini) in stage 05. Internal role names never shown to clients (project rule). |
| Single product and batch branches | MI 7 | **Partly**: one item per job; a batch is split into one job per item before A7. Batch queue: **Package**/ops. |
| Fully automated (no human in the loop) and semi-automated modes, in both branches | MI 8 | **Decided** (21:50): owner gates always. **Built**: go 1 and go 2. |
| System instructions can be steered; the user may override | WA 16 | **Built**: client instructions become locks (step 9); the owner can change the plan at go 1. |

## 2. Fidelity, quality control and release

| Point | Source | A7 |
|---|---|---|
| Fidelity and integrity target 90–95% (Studio); VTON 80–90% | WA 12; MI 65 | **Built** as target; never shown as achieved (project rule). Other pages say 99% / zero drift (MI 31, 32; WA 24): A7 keeps 90–95% as the target and reports scores as model judgements. |
| Every image scored and gated before release; fidelity reported, repairs, no drift | WA 24, 27; MI 4, 45 | **Built** (stage 05): review against the vendor photo and the contract, blind count, code verdict, at most two repairs, then hold; every candidate waits for the owner's go 2. Repairs run only when the owner orders them at go 2 (04 Settings `auto_repair` false). |
| Quality language: fidelity, integrity, drift, data loss (definitions) | MI 35 | **Built**: the review records these four scores, labelled as the reviewer's judgement. |
| SSIM above 0.98; denoising 0.15–0.35; CFG 1.5–3.5; attention layers 4–12 | MI 36, 39 | **Not applicable** to A7's hosted image API (no CFG or denoising controls). SSIM is a measurement A7 does not take; **Decide** if wanted as a code check. |
| Audit against a stored fingerprint of the product | MI 4, 14 | **Built**: the review compares each candidate with the vendor photo and the contract; the candidate's checksum is in the vault. |
| Prompt-only generation that alters geometry is not acceptable | MI 72; MS 77–83 | **Built**: identity-locked white-master prompt, vendor photo always image 1, no redesign. |
| Needs for retouching almost null; versioning | WA 38; MI 6f | **Built** (stage 06): versioned files (`_v1`, `_v2` …); earlier versions are kept, and the same approved master is never packaged twice. Rollback means re-delivering an earlier version. |
| Human reviewer for hero products | MI 69 | **Built** stronger: the owner reviews at go 1 and go 2. |

## 3. Vendor photo problems (stress cases)

| Case | Source | A7 |
|---|---|---|
| Cropped photo, missing parts, fewer pieces seen than ordered | MI 2e | **Built**: holds for the owner; nothing invented. |
| Crossed-out pieces, printed labels and counts, swatches, inset views, logos and watermarks | MI 2c, 2l; WA 30 | **Built** (readers, step 5 rules, prompt exclusions). |
| Lens distortion, extreme angles, foreshortening | MI 2a, 2k; MS 21 | **Partly**: the white master keeps the vendor camera and never turns the product. Frontal normalization of an angled photo would draw unseen sides: **Decide**. |
| Bad lighting, clutter, pale or wrong colour | MI 2b, 2f | **Built** in the prompt and checked in stage 05 (colour, background). |
| Low resolution, compression noise, blur, smudge | MI 2i, 2j | **Partly**: no restoration step yet. Restoration and upscale capped at 4× (MI 6b): **Scenes/Package** step, after review. |
| Missing or wrong data; no dimensions | MI 2h, 2l | **Built**: unknowns stay "not confirmed"; a critical unknown holds and asks the client one question. |
| Model returns the room context as product (e.g. nightstands) | Test 8 finding | **Decided** (16 Oct, 00:50) and **Built**: hold and ask. If the inventory lists something the photo reader marked as room context, 13 Compile makes nothing and asks the owner to send the job again with the piece named, or without it. The earlier default (count it as seen) is removed. The model test's MT4 now follows the same rule (16 Oct 01:50). |

## 4. Standards for every output

| Point | Source | A7 |
|---|---|---|
| Default two versions: white background, and lifestyle composition | MI 59 | **Built**: white master (stages 04–06) and scene outputs (stage 07, after the white package). Scene delivery files: **Built** (16 Oct, step 20): jpg and webp at each scene's own shape, short side 1125 px. |
| Default view: frontal full view; jpg and webp | MI 9 | **Built** (stage 06): jpg and webp. Frontal for angled photos: **Decide** (section 3). |
| Size: "always 1125×1125" (MI 15, 61, 68) vs "2000×2000" (MI 77) vs "Export 2K" (MI 76) | MI | **Decided** (21:50) and **Built** (stage 06): 1125×1125 jpg (quality 92) and webp, one resize from the approved master with n8n Edit Image, no AI. Checked on n8n Cloud with a test image (run 428); not yet on a real product photo. **Scenes** (owner, 16 Oct 03:25): keep the 2048-class master; jpg and webp at the image's own shape with the short side at 1125 px (1125 × 1125 for 1:1, 1125 × 1406 for 4:5, 2000 × 1125 for 16:9); never stretched, cropped, padded or upscaled; a smaller master holds for the owner. **Built** (step 20); checked on n8n Cloud with code-made test images (scratch runs 435 and 436). |
| Deterministic standard: backdrop, margins, ratio, colour profile, contact shadow; re-run gives the same file | MI 6a | **Partly**: one house spec in the prompt. Generative calls are not repeatable, so "same file" means re-delivering the stored master, not regenerating: **Built** (stage 06 resizes the stored master; colour profile after resizing not checked). |
| Camera standard per category: height (bedroom 135 cm, living 110–120, dining 130), distance, 0° pitch/roll/yaw, 1-point perspective, framing guides (bed bottom 35%, ceiling 85%, rug touches bottom) | MI 21–26 | **Built** (stage 07): presets in 04 Settings, written into the room and placement prompts as camera instructions; other rooms 120 cm (**assumption**). Distance is not set. White master keeps the vendor camera. |
| Main items % of frame (examples show hero furniture at 3–8%) | MI 17–20 | **Decided** (23:22, replaces 21:44): white master about 12% white margin on every side, product spans about 76% (**Built**: prompt line in 13 Compile and the model test, framing check in the stage 05 review). Scenes: lifestyle hero about 60–70% of frame height; wide view less; detail view more (**Built** in stage 07 prompts and the scene review's framing check). |
| Lighting by Kelvin presets, not mood words; day, night, warm | MI 6e, 34; MI 23 (4000K) | **Built** (stage 07): day 4000 K (MI 23); warm 3000 K and night 2700 K are **assumptions**; the client's lighting words pick the preset. Since 16 Oct (decision 23) the preset is fixed per image, warm light comes from the room's built-in light, and a lamp appears only as a Midas lamp confirmed in stock; a night image has dark windows. |

## 5. Props, accessories and Midas data

| Point | Source | A7 |
|---|---|---|
| Studio accessories mandatory from Midas; never generic look-alikes; exact SKU | WA 13, 22, 36; MI 27, 31 | **Built** (stage 07): only Midas pieces with SKU and catalogue photo, at most 3 per scene; each catalogue photo is sent with the request; generic props are dropped; an unconfirmed piece leaves its spot empty. |
| Stock and inventory are the truth; inventory gating | WA 25, 40; MI 6d | **Built**: availability in step 10, and each piece's own Midas page read again at scene time (stage 07). Whether n8n can read those pages live is not yet confirmed. |
| Every output lists the Midas accessories used, with product links | MI 28, 29 | **Built** (16 Oct, step 20): each scene's manifest lists its Midas pieces with SKU, page link and the live stock reading, and the pieces left out. Not yet run with real Midas pages. |
| Midas accessories catalogue (midasfurniture.com/en/accessories.html) loaded with SKU, photo, size, colour, availability | MI 27 | **Partly** (16 Oct): 412 rows imported (page 1 of 19 categories, about 20% of 2,082 listed); SKU, name, link, photo, price, stock. Size and finish "not confirmed". Refresh workflow built, not scheduled. |
| Grounding vocabulary: Midas facets for fabric, material, table top, colour family, handles | MI 41 | **Not built**: the stage 06 spec card uses supplied facts only. Facet metadata needs the **Data** task. Use the project's taxonomy snapshot. |
| Colour variants: no instant digital swaps; real finishes only, gated by inventory | MI 6d, 64, 66 | **Not built** and not offered ("Coming later" on the client page) until decided. |

## 6. Scenes and styling

| Point | Source | A7 |
|---|---|---|
| Space matches the product, not the product the space; build the room first, then place the product; never outpaint a finished image | WA 32; MS 85–90; MI 43 | **Built** (stage 07): empty room first, then placement into that room; no outpainting. Views of one job (16 Oct, 04:16) share one room: the widest view is made first, and the closer views are made from its approved image, so no view extends a finished image. |
| True physical scale; oversize reported, never hidden | WA 26 | **Built** (stage 07 + 05): supplied dimensions only, otherwise "not confirmed"; the scene review checks scale. |
| Home stylist and decorator skill (MENA, majlis, palettes, focal point) | MI 42, 43 | **Built** in stage 03 (stylist skill engine in code). |
| Localization: culture-related visuals | WA 39; MI 33 | **Scenes** (Kuwait/MENA). The skill's "Saudi price bands" (MI 44) do not apply to Midas Kuwait. |
| Context-, cognitive- and spatial-aware flow, not one template | WA 23 | **Built** in part (routing, profiles, locks per output). |
| Lighting physics: contact shadows, colour bleeding, material response | MI 51, 55; MS 18 | **Built**: placement prompt (grounding, contact shadows, light matches the room) and scene review (grounding, light). |
| Style consistency across one range (carving, tufting, palette) | MI 57 | **Scenes** (one collection, one style). |
| Extra workflows on demand: side views, close-ups, social ratios, human, video | MI 10 | **Wide views and close-ups built** (view mapping, 16 Oct 04:16). Camera views, the three-view series and the 9-image Views by light series: **Built** (16 Oct, decisions 24 and 27). A Left or Right side image is made only with a supplied photo of that side; otherwise that image is held. One adult in a scene only when the brief asks (decision 22). Video and 3D are outside the 2D-to-2D scope. Advertising formats are out of scope (owner, 16 Oct 03:24); if asked for later, they will be cut from the approved master, not generated separately. |
| Room defurnishing | MI 53, 62 | **Not A7** ("no core use", FAQ 5). |

## 7. Measurements and set relations

| Point | Source | A7 |
|---|---|---|
| Data usually comes with dimensions | MI 58 | **Built**: brief field `dimensions`; supplied facts win. |
| Inferring dimensions from the photo (homography, cushion 55–65 cm, set invariants, 95% accuracy) | MS 3–11, 26–27; MI 47–49 | **Decided** (21:48): internal estimate only by default, never shown to clients or used as fact. Stored in 04 Settings; stage 06 does not make an estimate (spec card says "not confirmed"). |
| Set relations ("dimensional continuity"): same depth, height, seat height and arm across set pieces | MS 59, 63–75 | **Partly**: inventory, handedness and relations are kept. A set-relations record in the metadata: **Not built** yet. |
| Generate missing set pieces (2-seater from 3-seater), pillow-free version, extra angles | MS 13–15, 36–39; MI 6c | **Decided** (21:50): hold and ask for a better photo. |
| Measurement infographic burned into images | MS 44, 54 | **Decide**: only from supplied dimensions. |
| Metadata: observe, infer, extract; description grounded in Midas data; no fixed template for measurements | WA 15, 33; MI 40, 60 | **Built** (stage 06): spec card and draft description from supplied facts only; unknown stays "not confirmed"; photo readings kept apart as internal only. English draft; Arabic not written. |

## Build order proposed

1. **Stage 05: review and go 2**: built 15 Oct 2026 (README `claude-midas-a7-stage-05-README-2026-10-15.md`). Critic review of the white master against the vendor photo and contract (count, shape, colour, handedness, nothing added, background, logo, frame and size); fidelity / integrity / drift / data-loss report as model judgements; at most two repairs; hold; go 2.
2. **Scenes**: built 16 Oct 2026 (README `claude-midas-a7-stage-07-README-2026-10-16.md`). Architect room, placement, camera and lighting presets, Midas accessories with a live stock check, scale; reviewed by stage 05. Scene delivery files built 16 Oct (README `claude-midas-a7-scene-files-README-2026-10-16.md`).
3. **Package**: built 16 Oct 2026 (README `claude-midas-a7-stage-06-README-2026-10-16.md`). 1125×1125 jpg and webp, versions, manifest, description and spec card, identity vault entry, cost per accepted package. Accessory links come with Scenes.
4. **Data**: accessories import done 16 Oct (README `claude-midas-catalogue-import-README-2026-10-16.md`); live stock read per piece at scene time; facet vocabulary not built.

## Owner decisions, 15 Oct 2026, 21:50

1. **Owner gates always.** No fully automated release; go 1 and go 2 stay. (MI 8 answered.)
2. **Midas-only props** in Studio scenes. If no Midas piece fits, the spot stays empty. This replaces the project rule's "labelled generic context" for the Studio.
3. **Never invent unseen parts.** Frontal normalization of angled photos, pillow-free versions, extra angles and missing set pieces hold and ask for a better photo.
4. **Delivery size 1125×1125**, resized from the 2048 master without AI, jpg and webp; the master stays in the vault.

5. **Framing** (23:22, replaces the 21:44 hero share of 25–40%): white master about 12% margin on every side, product about 76% of the frame; lifestyle hero about 60–70% of frame height; wide view less; detail view more.
6. **Test 8** (22:30): the bed only, 1 piece. Nightstands, lamps, rug, bedding and cushions are room context and are left out. Test 6 (22:30): 6 pieces (bed, 2 nightstands, dresser, mirror, stool); the sheet now says 6.
7. **Dimensions from photos** (21:48): internal estimate only by default.

## Owner decisions, 16 Oct 2026, 00:50

8. **Context rule**: hold and ask (replaces the 21:46 default). Built in 13 Compile.
9. **Model test**: `only_folders` = Test 6 and Test 8 (4 planned calls). Paid switch off; not run.
10. **Repairs**: `auto_repair` stays false; the owner orders each repair at go 2.
11. **Test 6 sheet**: E6 is now piece by piece (done by the owner).

## Owner decisions, 16 Oct 2026, 01:40

12. **Build order**: catalogue import first, then Scenes. Both built.
13. **Model test**: align MT4 to hold and ask. Done.
14. **Package description**: tidy wording only. Done.

## Owner decisions, 16 Oct 2026, 03:24 and 03:25

15. **Scene shapes**: 1:1 by default; the client may pick any of A7's nine shapes (1:1, 4:5, 5:4, 3:4, 4:3, 2:3, 3:2, 16:9, 9:16); the white master is always 1:1. Built.
16. **Client page**: A7's intake reads the shape from `aspect` or `proportions` and translates the page labels ("Square · 1:1" → 1:1; "Standard for category" → 1:1). The planning step and 13 Compile use the same nine shapes, 1:1 by default. Built.
17. **Scene delivery**: keep the 2048-class master; jpg and webp at the image's own shape, short side 1125 px; never stretched, cropped, padded or upscaled; a smaller master is held for the owner. Built (step 20).
18. **Scope**: the project has nothing to do with advertising. Ad formats (for example 1.91:1) and platform specs are out of scope; if asked for later, they are cut from the approved master.

## Owner decisions, 16 Oct 2026, 04:16

19. **Framing on the longest side**: measure the product's bounding box on its longest side against the frame's side in the same direction. Hero 60–70%, wide 40–55%, detail: the named detail fills most of the frame (whole product not required), white master stays 76%. Framing is a styling check: a miss is reported with the measured share and never fails an image on its own; repairs only when the owner orders them. Built (README `claude-midas-a7-views-framing-README-2026-10-16.md`). Replaces decision 5's scene rule.
20. **All nine shapes on the page**, one grouped list, "Standard for category (Square 1:1)" first; bare values sent; White BK shows "White catalogue is always 1:1". Built as a new page draft, mock mode only.
21. **View mapping**: Category template (or "Studio decides") → hero + wide + detail; Wide view → wide; Close-up → detail; Wide view + close-up → wide + detail. All views share one room, arrangement and light; White BK ignores the view; the page shows the image count. Built.

## Owner decisions, 16 Oct 2026, 06:24 (27 and 29 revised 06:49 and 07:16)

All built in A7 `64545f4f` (16 Oct, 08:58; README `claude-midas-a7-prompt-fixes-README-2026-10-16.md`), tested with code-made data only.

22. **People**: none by default; when the brief asks, at most one natural adult, beside or behind the product, never in front of it, clearly secondary; never in the empty room or the white master. Built.
23. **Light**: each image's preset is fixed; a lamp only as a Midas SKU confirmed in stock and named in the plan; otherwise built-in light shown as architecture; the review fails any other freestanding lamp. Built.
24. **Camera**: 0° tilt for Full frontal, Left side, 45° right and Right side; the Reference view follows the vendor photo; raised but level when the count cannot be read from chest height (from 9 pieces, dining: an assumption); no fisheye. Built.
25. **Cushions**: no Midas cushions or throws; the product's own cushions stay as photographed. Built.
26. **Category rules**: the A7-only profiles table `FZJg1MHUh2lcIV1H` (43 rows), F1's category sentences with its qualifier, edits marked in `a7_edit`. Built; the owner still reviews the wording.
27. **Side views**: the three-view and 9-image series are built; a side image runs only with a supplied photo of that side, otherwise only that image is held with its reason and the series continues; no option to accept inferred sides. Built.
28. **Pre-order**: no change; open (code keeps pre-order pieces, except lamps, which need "in stock").
29. **Scene approval**: no go 3; each scene has its own go 2 after the white master's; the go 2 ticket lists the other scenes of the series with their state; repairs only when ordered, at most two; an approved scene is packaged without waiting. Built.

## Owner decisions, 16 Oct 2026, 11:3x Amman (Phase 0 of the remaining plan)

Details: `claude-midas-a7-remaining-plan-2026-10-16.md`, "Decisions recorded".

30. **Live pipeline**: pipeline 3 (`LCkfLFMQS5MjA5FQ`) is live for clients. A7 replaces it at go-live. Finding: n8n reports that pipeline 3's credential `9Rrf1S4GHPgftmJA` cannot be found; not fixed, not tested.
31. **Retired**: five older workflows unpublished by Claude on the owner's go: `XvdiJKSllFsMyad5`, `nz0MH8SFeCFJpt0K`, `FPAF0QHltl8iIcdZ`, `BqIv4OKP4hSZcRvH`, `XwMygMivS6hNpeVg`. White clean-up stays published for pipeline 3.
32. **Review again**: once per image. It runs the review and the blind count on the stored image, with no image call, and shows its cost first. If the second review also fails, the owner may approve by eye, recorded as "approved by owner without an automated review". Cause of the execution 454 hold: Gemini 503 on all 3 tries (technical). The critic's answer in that run was dropped by 16b (to fix). Not built.
33. **White 255**: delivery files only. Only near-white pixels connected to the border are changed (a flood fill); the shadow and the product are kept. Reuses white clean-up's curve and checks, not its paid fal.ai cut-out. The jpg and webp are checked after saving; the manifest notes it. Not built.

34. **Styling checks (D5)**: fail only on a prop or piece not in the plan, floating or poorly grounded furniture, or clearly wrong scale. Light, camera level, realism and framing are notes only. A failed scene still comes to the owner's go 2 with its reason (approve, order a repair, or stop); nothing repairs itself. Replaces the "still open" point of 16 Oct 05:05.
35. **Cut-off product (D6)**: still a fail in hero and wide views, checked in code where possible (a product box from the blind count touching the frame edge), not only by the reviewer's opinion.
36. **Shared room (D7)**: kept. The approved wide image guides room, light and arrangement only; product identity always comes from the vendor photo and the approved white master.
37. **Lifestyle + Category template (D8)**: white master + hero (2 images). Wide and close-up only when chosen in Views. Replaces decision 21's Category template line for Lifestyle.
38. **Assumed values (D9)**: confirmed warm 3000 K, night 2700 K, white master band 72–80% (target 76%, longest side), detail > half the frame. Camera height: 120 cm for room-scale furniture only; tabletop accessories and lamps at about product height at the vendor photo's angle; no height line for detail views. Raised level camera from 9 dining pieces is a starting rule; a 12-chair dining set goes into the first paid scene test; if chair backs are hidden, a small downward tilt is allowed for large dining sets only.
39. **Stock (D10)**: in stock only for every supporting piece (pre-order excluded, lamps included), read from Midas Kuwait /en/ pages only. Closes decision 28.
40. **Side-view series (D12)**: Three views and Views by light show "Coming later" on the page until it takes photos of other sides.
41. **Identity and rule checks in scenes (review finding 11, owner, 16 Oct 2026)**: scenes still fail on `no_text_or_logo`, `people_ok` and `midas_pieces_match`. They are not styling notes.

**Phase 1 built, 16 Oct 2026, 17:15 Amman.**
- Decisions 32–40 and 41 are now in A7 draft `e584d5ed-52c0-4a49-9da2-5c833b5e1b48`, with the review fixes. That includes review again (32) and white 255 on the delivery files (33).
- The draft is not published. It has not run, and no paid call was made. Tested locally only.
- See `claude-midas-a7-phase-1-README-2026-10-16.md`.

## Still open

- Other styling checks (light, camera level, scale, grounding, realism, only listed props): still fail an image. Should they become notes like framing? (Raised 16 Oct, 05:05.)
- A product cut off by the frame in a hero or wide view still fails ("whole product in frame"). Agree? (Raised 16 Oct, 05:05.)
- Shared room: later views are made from the owner-approved wide image (`scenes.views_share_one_room`, on). Keep? (Raised 16 Oct, 05:05.)
- Lifestyle with Category template now plans the same four images as Website. Intended? (Raised 16 Oct, 05:05.)
- White framing note band 72–80% and detail "most" = more than half are assumptions. (Raised 16 Oct, 05:05.)
- The client page draft for A7 is not connected: A7 has no result address for a page yet.
- Kelvin warm 3000 K, night 2700 K and the 120 cm default camera height are assumptions: confirm or change.
- Older runs' cost estimates do not include the empty-room calls.
- Catalogue: schedule the refresh (needs publishing); a fuller source than page 1.
- Package description: English draft only. Arabic needs a native review before use.
- The real end-to-end paid A7 run: waits for the owner's go.
- Stages 06 and 07 have not run with real Google Drive, real Midas pages or a real product photo.
- Prompt check (16 Oct, 05:45): P1–P6, S1–S8 and C1–C2 are fixed in `64545f4f`; D1–D8 were answered by decisions 22–29. Still open from it: D7 / decision 28 (pre-order pieces); the owner's review of the profiles table wording (decision 26), including the bed guidance.
- Page draft 2 (`claude-midas-a7-page-2/`, mock mode only) offers the two series, but takes one photo, so every Left side image is held (Three views: 3 of 4 made; Views by light: 7 of 10). Keep them offered until F4 (room photo and other views on the page), or show them as "Coming later"?
- In a client room photo the light is the photo's own; a chosen light preset is not applied there, and nothing tells the client yet.
- The F1 page's build prompt (section 08) was compared with A7 (06:30): no session ran it; do not run it as written (same doc). A corrected build prompt for the prompt and intake fixes: `claude-midas-a7-build-prompt-2026-10-16.md` (06:45).
- Client page (same doc, 06:00): fixed in `64545f4f` and page draft 2. A7 now reads the "Keep faithful" fields and lists unused fields back; plants, mood and the Midas-pieces switch show "Coming later"; human presence is offered (decision 22). The client first page's request is now read, but still refused without a job id. F4 is not built.
