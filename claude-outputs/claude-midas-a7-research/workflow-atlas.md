# Workflow atlas: requirements extraction (read-only), 2026-10-14

Sources. WP = /home/claude/research/text/workflow-pipelines.txt (2857 lines). XWP = x-workflow-pipelines.txt (mostly a duplicate of WP; its tab-click attempts all timed out, lines 1833-1869, so it adds nothing for the tabs). LINKS = workflow-pipelines.links.txt (113 lines, buttons and links only). SC = /home/claude/research/files/surgical-cases.html (the "A in four real cases" page).
SUPP = supplement from /home/claude/research/raw/workflow-pipelines.html (embedded JSON `evidence-data` and the page JS). This is NOT in the .txt files. It is the page's own data, used because the tab content was missing from the text exports. Items marked SUPP carry no WP line number.
"inference" = my reading, not a statement in the files.

## 0. Caveats the reader must know
- Snapshot id: visible text shows "a622b3fa", the JSON has `implementationRevision` "b05d8385b7cd6e22e90992ef6bae0764c4fbceea" (SUPP). They may be different things; not reconciled.
- Record counts: the page card says "89 indexed records". The JSON counts are different (live 7, historical 27, complex 7, registry 48, earlyRuns 12, and so on). 89 vs 82 was noted during reading; the disclaimer at WP 37 says the 89/204/240 numbers are not a claim of corpus coverage. Treat 89 as an index count only.
- SC is JS-rendered. The file holds only the page shell, so the names of its four cases are NOT in the file. Only the structure is (see section 2.4).
- Tab-click failures: the x-file could not open the tabs. Hence SUPP.
- Everything the page calls "I did" was assisted work by a model operator in sessions. The page says so itself (WP 1965, quoted in section 4). It is not an unattended deployment (SC line 5).

## 1. Pipeline (#pipeline)

### 1.1 Gate cards (WP 10-48)
- "01 · Breadth, 89 indexed records" (families, conditions and variations).
- "02 · Responsibility, Operator + critique" (real repairs and stop rules).
- "03 · Composition, 11 Midas products" (three sourced styling schemes).
- "04 · Continuity, Eye → item contract" (source, decision and output).
- WP 48: the assisted-production note. WP 37: the 89/204/240 disclaimer. (LINKS 10-13.)

### 1.2 Chain A, six layers: Eye → Brain → Agentic stylist → Engine/operator → Critique/operator ↺ → Vault & delivery
LINKS 18-23 give the labels: "1 · Eye, Observe, My multimodal interpretation"; "2 · Brain, Decide, My scope & routing decisions"; "3 · Agentic stylist, Compose, My design + catalogue selection"; "4 · Engine / operator, Execute, Recorded model & tool per run"; "5 · Critique / operator, Critique ↺, My source-to-output inspect"; "6 · Vault & delivery, Package, Export + final inspection". WP 50-112 is the Eye stage; WP 114-118 is the five-layers note; WP 126-130 is "WHAT CONTINUES WITHOUT THE BROWSER".

| Stage | Input | Work / decision | Output | Who or what | Evidence kept / status |
|---|---|---|---|---|---|
| Eye (observe) | Vendor photo(s), swatches, room, catalogue, inspiration, previous result | Records what is visible; separates observed / published / inferred / unknown / conflicted (WP 551-568) | Item contract (section 3) | Assisted model interpretation | SUPP status: "Assisted; evidence retained unevenly" |
| Brain (decide) | Item contract plus owner request | Compiles a case contract before choosing a tool; routes unresolved identity to clarification or an "illustrative" result; "12 chairs total overrides a photographed '12+2' caption" (SUPP; also WP 1015) | Scope, route, constraints | Assisted | SUPP: "Assisted; some rules implemented" |
| Agentic stylist (compose) | Contract, catalogue facts | Picks sourced Midas pieces or labelled generic context (section 5) | Design map, reference JSON | Assisted, with curated examples | SUPP: "Executed curated examples" |
| Engine/operator (execute) | Prompt, ordered references | One generation per output; model and tool recorded per run | Candidate image plus receipt | Magnific/Nano Banana runs (section 7) | SUPP: "Generated outputs and receipts" |
| Critique/operator ↺ | Candidate, originals, last accepted scene | Observe, classify, target one correction, regenerate, recheck (section 4) | Pass / repair / reject / hold | Assisted inspection | SUPP: `repair_budget: 2`; "approval: owner acceptance separate" |
| Vault & delivery | Selected candidate, receipts, hashes | Package and export, final inspection | "reviewed candidate or hold until accepted" (SUPP) | Export plus inspection | Vault is "a contract illustrated here", not a live service (SUPP) |

Handoff contract JSON (WP 551-568): `references` roles are product_identity, target_room, specification, catalogue_support, inspiration, previous_result. `facts` are observed, published, inferred, unknown, conflicted. `instructions_are_not_image_labels: true`.

### 1.3 Chain B, five stages: 1 · Intake, 2 · Contract, 3 · Composition, 4 · Execution, 5 · Review & delivery
LINKS 85-89 are the tab labels only. The text of these tabs is not in the .txt files; their detail is the same as the layers above (inference: Intake = Eye input collection; Contract = Eye record plus Brain compile; Composition = Stylist; Execution = Engine; Review & delivery = Critique plus Vault). Do not treat this mapping as stated by the page.

### 1.4 The three recorded paths (SUPP `paths` object)
**U2, "Three-model validation" (Magnific Flow rlUwxtcFH6).** Receive → Observe → Direct → Generate → Save → Evaluate. One reference image in, one output per run.
- Receive: preserve source SHA-256, check the credit ceiling, acquire an execution claim. "An uncertain receipt is held for reconciliation; a timeout does not authorize a duplicate paid run."
- Observe: GEMINI38_FLASH.
- Direct: GEMINI31_PRO (Brain and Stylist combined in one call).
- Generate: `imagen-nano-banana-2`, 7 results saved, all 2048 x 2048.
- Save: server checks bytes, dimensions and hash.
- Evaluate: conditional OpenRouter Gemini 3.1 Pro structured critic, 7 strict checks (inventory, geometry, details, appearance, placement, lighting, composition). No automatic repair.

**F1, "Existing studio" (schema 3).** Collect → Plan → Style → Execute → Review → Deliver. Supports multiple references, compiled prompts, one isolated generator per output, a unique output key per planned output, 2K and 1:1, one image node. Candidates enter `review_pending`; a repair is a new version. No extra prompt-generator or critic node.

**UI, "New client experience" (/client-first-page).** Job → Item → Scope → Preferences → Suggestions → Connect. Preview only; it does not dispatch generation ("Connect" is the gap). 6 reference roles, 7 outcome choices.

## 2. Cases (#cases, "Stress cases")

### 2.1 Assisted production, full history (button LINKS 14)
Case chooser (WP 1091-1097) and collections (WP 1075-1089). Collections named: Website execution (7); Original seven, inventory and extraction; Four room/set cases; Accessories, 6 mood variations; Lifestyle, 7 refinements; Sofas (3); Complex vendor sheets (7); Room placement and selective edits (6); Whole sets and camera views (7); First Gold selection (7); Complex sheets → wide/close/upscale (7); Fresh direct-Space tests (7); Additional accessories (7); Earlier website QA (7).

Stress matrix: 48 rows, WP 975-1071 (e.g. "Clean product input", "Timber mosaic surface", "Transparent low accessory"). Disclaimer at WP 1073. Row examples quoted: "Inventory / 12 chairs total / 5+5+1+1, with two end armchairs; owner requirement overrides printed 12+2" (WP 1015); "Execution / Website launches and uncertain status / Uncertain receipt does not authorize automatic duplicate launch. Job state is not visual quality." (WP 1069).

### 2.2 01 Three-model validation: seven live U2 cases
All run 2026-10-01 on workflow rlUwxtcFH6, 75 image credits each, estimatedCredits 90 (SUPP). Case names in the chooser: Towel sheet · soft bathroom daylight; Bookends · functional study composition; Jewellery box · close dressing-table view; Dining · twelve chairs total; Sofa set · five seats in a full living room; Selected chairs · exclude the crossed table; Sculptural glass · reflection and transparency.

| Case | Run | Seconds | Outcome (SUPP, review status) |
|---|---|---|---|
| towel | iVnwl73uKd | 58 | Candidate, limited verification |
| bookends | liybq3gv9E | 98 | Correction required (wave piece simplified) |
| jewellery-box | x4wQFpjfWK | 64 | Correction required (lid stripes changed) |
| dining-12 | s6OqkBl8e2 | 62 | Correction required: 10 chairs shown, 12 requested |
| sofa-five | 9cAgydNYZ7 | 72 | Correction required: separate seating, not a corner; the test prompt itself weakened the requested assembly |
| selected-chairs | IbEV80tvEN | 65 | Correction required: tan back upholstery lost |
| glass-platter | pCtnXvehwn | 86 | Candidate, limited verification |

Totals: 525 credits, 58-98 s each; `actualTotalCredits` null; token counts null; `automaticQualityApproval` false; releaseDecision "Not ready for unattended quality-approved delivery" (SUPP). Towel record: 08:15:13 to 08:16:10 UTC, 58 s, 75 credits (WP 1099-1172; saved direction WP 1149-1150; receipts JSON WP 1158-1172). The browser closed at 08:16:46 UTC; the page says 6 of 7 finished after the close and all 7 were retrieved on reopen.
Four failed comparison attempts: three Seedream runs (BFaTdjoQRm, ThBATZVNR8, 0mXAD1TfWv; workflow 1sSyr4rEVP; estimate 115 credits) plus a fixed-node diagnostic (VvonSVMMUe; workflow y6RYPW9xJI; estimate 116). All failed with no output; cause and charges "not established" (WP 2353-2361).

### 2.3 02 Existing studio and 03 New client experience
Described as paths in section 1.4. No stress outcomes are attached to them beyond the F1 website tests: the 23 Sep website dining test (site v9) completed upload, generation and download and "showed eight chairs; visual review still required changes because of an extra side cabinet" (WP 2417); `functional_result` pass, `visual_review` changes_needed; 1 paid generation (SUPP). Seven later website QA records are `needs_recovery` (six) or `review_pending` (one) (WP 2417, SUPP).

### 2.4 SC, "A in four real cases" (surgical-cases.html)
- Title "Midas · A in four real cases". Meta description (line 2): "Four source-led image cases, mapped to 21 responsibilities with prompts, actual outputs, review findings and a Vault sample."
- Four tabs (line 8): "Images & selection", "All 21 responsibilities", "Review & repair", "Vault · start → finish".
- Responsibility groups (line 10): 01-06 Understand, 07-09 Decide, 10-12 Style, 13-15 Generate, 16-18 Review, 19-21 Record & deliver.
- Line 5: "Execution boundary: New image calls and assistant reviews, with local routing, file and package checks. The production service replacement is shown at every step. This is not an unattended A deployment."
- Line 10: "These groups organise the responsibilities. They do not mean 21 sequential model calls. Memory and cost tracking span the job; repair returns to generation and review."
- Line 11: "The original remains the product authority. Review here is assistant-performed. No calibrated fidelity percentage, independent vision-service pass or whole-catalogue 'best' score is claimed."
- Line 13: "4 October 2026 · New assisted candidates, retained failures and explicit unknowns."
- Downloads (line 12): generation-ledger.json, source-manifest.json, check-report.json. The four case names are NOT in the file.

### 2.5 Eye cases (five difficult inputs; LINKS 78-82; WP 1277-1305)
Towel / swatch conflict; Bookend / function; Box / multiple states; Robe / colour ambiguity; Cushion / conflicting inset. Towel rule (WP 1303): "Pass observed colour with conflict flag. Never silently blend the two colours or claim cotton."

### 2.6 Loop replays (the "Attempt" tabs and room cases)
**Centre table CT-R1 (28 Sep 2026)** (WP 1991-2027, 2289-2302; SUPP). Problem: the base became overlapping rings.
- Attempt 1: gOntKMiSXO, run 6044I5iJO3, Pro (`imagen-nano-banana-2`). Base became overlapping rings.
- Attempt 2: SyYmrziUb8, run nBAAxAYQDB, referenced attempt 1 plus the vendor original. Base error remained.
- Attempt 3: gOntxXrSXO, run TmWWR5VNR8, Flash (`imagen-nano-banana-2-flash`). Dropped the flawed room; used the vendor original plus the retained white view. Selected.
- Cost: 3 x 75 + a 40-credit non-AI resize (`images_resize`) = 265 credits. Scores before 90/90/40, after 90/90/90 (fidelity/integrity/styling). Model and references changed together, so there is no controlled benchmark.
- Prevention rules: use the original as identity authority; inspect any generated image before it becomes another step's reference; "If a defect survives one targeted edit, return to source-supported references; do not keep chaining the flawed result."

**Midas evening sofa, accessory topology** (S3 attempts, section 5): S3 rejected (third side-table tier, undersized vase, fireplace); S3-R2 rejected (fireplace gone, vase scale better, third tier remained); S3-R3 reviewed candidate, owner pending (two discs, but the lamp sits on the higher disc rather than the lower one requested).

**R2-A, Bed 1 in Space 2** (SUPP earlyRuns, 2026-09-16, all `imagen-nano-banana-2`, 2k, 75 credits per call):
- G01 initial (creation vQjM7wAa47, run CxiOaCEEyu): SUPERSEDED. Cover pattern drifted to dense houndstooth-like.
- G02 repair 1 (Lw3ucNZswO, JA8pzyOq4i): REJECTED. Split-screen comparison, changed room layout, changed bed. "Retained for traceability and was not used as the next repair input."
- G03 repair 2 (79nKXy6JAL, iTCta83uKd): SELECTED CONCEPT. Used the fixed saved initial creation plus the original product. Limits: pale motifs larger and brighter than the original; headboard width, panel extent and mounting inferred; room fit and scale are visual estimates.

**R2-B, Bed 2 in Space 1** (79nKDpmJAL, run 1Oc2kUr4rE): SELECTED CONCEPT at first attempt. Limits: the source crops the right side of the bed, so silhouette and hidden structure are inferred; no bed or room measurements supplied; textile folds are synthesized, "not a pixel-exact transfer".

**R2-C, Bed 1 cover changed to blue**: G01 (gO2H0c5SXO, BQwjXboQRm) turned both rear pillowcases blue too (SUPERSEDED). G02 (eIFAjQtdqL, m5PUkqhJQA) restored the pillows but replaced the cover with a different dense blue pattern (REJECTED). G03 (rgNfWsNxtc, m5PUOUhJQA) SELECTED CONCEPT. Limit quoted: "Medium blue was an execution assumption because no swatch was supplied."

**R2-D, Bed 2 side-view concept**: G01 (rgNfGzIxtc, OGIpJtynme) SUPERSEDED: unsupported visible base and feet. G02 (1l9az4Dr4r, l6pc3Dgv9E) REJECTED: split-screen, new rectangular headboard, changed camera. G03 (Lw3uTSbswO, Nca8hK6D9Q) "SELECTED INFERRED CONCEPT WITH PROFILE HOLD": an oblique side view, "not the near-90-degree profile targeted in the prompt"; a small unsupported rail edge remains; side depth, headboard thickness, hidden construction and dimensions inferred from one photograph.

**R3-A, Furnished Bed 1 in Space 2** (Bhbn3K4oQR, run hK4JbivqLJ, 75 credits): adds chrome smoked-glass chandelier, cream four-drawer chest, black-loop table lamp on the chest. SELECTED CONCEPT. Limits: chest depth inferred; lamp weave simplified; chandelier canopy outside frame; physical scale and colour unverified. Inputs: R2-A selected repair 2 plus ceiling light 2.png, chest of drawers.png, table lamp 1.png.
**R3-B, Furnished Bed 2 in Space 1** (SyAqfnaUb8, run nB5FdLYQDB): gold-and-white ring ceiling lamp replaces the central globe; cognac pommel bench at the foot. SELECTED CONCEPT. Limit: "The bench is on wood beyond the rug, failing the additional on-rug prompt constraint."

### 2.7 Other recorded case sets (SUPP expansion; none is a live production result)
- Direct-Space D1-D7 (knives, Denise sofa, six-chair dining collage, botanical bedding, mirrored wardrobe, nesting tables, crystal pendant): "Assistant-operated Magnific Space; client UI bypassed". Scores vary from 75-80% to 100%.
- Accessories A1-A7 (rootwood glass bowl, napkin rings, etched goblet, fan bookends, woven cushion, tassel jewellery box, geometric runner), fidelity 80-90, integrity 90-97 as examples.
- Early baselines S1-S4, B1-B3, G01-G07.
- Complex vendor sheets N01-N07 (SUPP `complex`; evidenceDate 2026-09-29; status "Historical composition from the complex-case release; not generated by this software update."): N01 Equestrian dinnerware collection (profile dinnerware); N02 Bordered terry towel (towel; "Dusty taupe / muted rose-brown ... a conflicting olive-green swatch is also present"; provisional classification, might be a bath mat); N03 Belted terry bathrobe (robe; "XL occurs in the filename only"); N04 Olive leaf-pattern cushion (cushion; the inset has a different pattern and "is not assigned as the reverse without confirmation"); N05 Heart-tufted bedding (bedding; Pantone text unreadable; "appears to show 220 x 240 cm"); N06 Sculptural bookend pair (bookend; weight and support not tested); N07 Mirrored jewellery box (box; open and closed pictures are one item in two states; new views stay closed, hidden compartments not invented). For all seven: exactVendorColourName, exactVendorColourCode and verifiedMaterialComposition are null; "Pending matching client Excel; user says it exists but has not supplied it."; "Visual interpretation of vendor image; not an approved product specification."
- Seven website QA records (section 2.3).
- Bedroom completeness fix: native OpenAI edit 1254 x 1254, then a non-generative Magnific resize to 2000 x 2000 (SUPP).
- 12-chair dining set: 5+5+1+1 (WP 1015).

## 3. Vault (#vault, "Eye & Vault"; WP 1199 onward)

### 3.1 What the Eye records
Ten Eye roles at WP 1206-1274. WP 1209 (quoted): "Keep original bytes, hash, filename, dimensions, source, version and each file's role. A generated result can guide composition, never overwrite product truth." WP 1303: conflicting colours are passed "with conflict flag. Never silently blend the two colours or claim cotton." Five difficult inputs (towel, bookend, box, robe, cushion): WP 1277-1305. The Eye role list itself (10 roles) should be read at WP 1206-1274 if the exact role names are needed; I did not list them one by one here.

### 3.2 Item contract fields
Reconciled R2-A to R3-A item card: WP 1307-1388. 53 scene metadata fields: WP 1390-1886. Each field carries a "basis" tag from this set (SUPP): EXTRACTED, DERIVED, REPORTED, OWNER REQUEST, OBSERVED, INFERRED, UNKNOWN, MANUAL ESTIMATE, EXECUTION RECORD, ASSESSMENT, PENDING. Normalised bounding boxes are estimates only. Unknown stays unknown (the N01-N07 records above use null).
Downloads: "Download reconciled contract" and "Download actual R3-A record" (LINKS 91-92).
Unified-generation entity map: WP 1887-1905.

### 3.3 What the vault stores per job, versioning, hashes
- Per output (SUPP earlyRuns fields): file path, SHA-256, pixels, bytes, creation id and URL, provider status, run id, node id, created/completed time, model, resolution setting, aspect ratio, provider pixels, seed, credits reported, prompt, decision, finding, limits, inputs, reference mode, evidence file.
- Five vault phases appear in the JS; the hashes section is WP 2465-2525. Hosting previews, WP 2527-2855 (19 hosted representations, SUPP).
- Versioning: in F1 "a repair is a new version" (SUPP). Rejected images stay retained and rejected (WP 1967-1983 area; SUPP earlyRuns limits text).
- U2 Receive: preserve the source SHA-256 (SUPP).
- Retention: no retention period is stated in the files I read. Not confirmed.
- The vault is "a contract illustrated here", not a live unified service; the model call is stateless while the project record is stateful (SUPP). Not evidenced: a dynamic knowledge graph, live Visual RAG, pixel-exact extraction, latent harmonization, cross-attention injection.

## 4. Loops (#loops; WP 1933-2034)

Role cards WP 1936-1946; diagram labels WP 1948-1963; loop, invariants and stop rules WP 1967-1983; centre-table replay WP 1991-2027; "What is actually automated?" table WP 2029-2034.

Loop (WP 1967-1971): "The recursive observation → decision → action loop": Observe against source → Classify defect → Target one correction → Generate candidate → Recheck all locks ↺.

Invariants (WP 1972-1975), quoted: "Original reference hashes and roles; rejected images stay rejected." "Unaffected product parts, selected room, accepted inventory and explicit user decisions." "Case-specific checks on every candidate, including features the repair was not meant to change." WP 1953: "Identity AND scene regression."

Stop rules, quoted:
- WP 1978: "No image / uncertain receipt: reconcile execution before any duplicate launch."
- WP 1980: "Repeated defect or exhausted repair budget: hold and change evidence/method rather than loop indefinitely."
- WP 1983: "The local decision function has a two-repair limit. These actual histories include bounded three-candidate sequences, but no live autonomous correction controller is established by them."

**The important point (WP 1981), quoted exactly:** "Passing a visual check produces a reviewed candidate; owner approval and complete package checks remain separate."

Scope warning (WP 1965), quoted: "These actions were performed by me during assisted sessions. They do not automatically run inside the client website when I am absent. A deployed replacement needs the same inputs, persisted decisions, evidence, execution privileges and release rules."

Two-repair limit: SUPP Critique stage `repair_budget: 2`. The R2 histories show initial + repair 1 + repair 2 (three candidates per case). The loops data in the JS covers table, sofa, R2-A, R2-C and R2-D.
Scoring rubric (SUPP): pass 1 / partial 0.5 / fail 0 / unknown null; 5 checks each for fidelity, integrity and styling; score = mean x 100 (sum x 20). It is subjective and disclosed, "not calibrated".
Release states in the data: REVIEW_REQUIRED, review_pending, ready, changes_needed, REVIEWED_CANDIDATE; owner acceptance always separate.

## 5. Styling (#styling; WP 2061-2245)

### 5.1 Three schemes (sofa, 28 Sep 2026, Midas /en Kuwait display)
- Coastal daylight (S1): CHALLVOR centre table 141368, CHALLVOR side table 141365, RENESMEE lamp 174770, MINA bowl 167722. Run frvJwHCDYB, creation ovrR6VO829. Rationale WP 2073-2087; product block WP 2093-2136. Source links: LINKS 104-107.
- Mediterranean sunset (S2): DUVAIRA set 158478, OAKLYNN lamp 174781, CIELO vase 167956. Creation 4RpbHqC9Aa.
- Walnut evening lounge (S3): VILARI centre table 160218, FERNLAY side table 162510, white/gold lamp 174788, black/gold floor vase 176249. Three attempts (section 2.6).
Total 4 + 3 + 4 = 11 Midas products (gate card "11 Midas products", WP gate cards 10-48).

### 5.2 Product facts carry dates and gaps
Examples: RENESMEE out of stock, depth missing; FERNLAY and DUVAIRA pre-order; CIELO out of stock; VILARI's page lists storage "No" despite visible trays (SUPP). Item scores WP 2138-2153 (fidelity 80-90, integrity 90-100 range).

### 5.3 How catalogue pieces are selected, sourced and placed
- Prompt: WP 2159-2165. Reference JSON: WP 2166-2195. Agentic scope: WP 2196-2216. Stylist source: `Skills/home-furniture-stylist` v1.2 (SUPP).
- WP 2210 (quoted): "Pass the design map and each product reference into the image request; a text name alone is insufficient identity evidence."
- WP 2211 (quoted): "Check every supporting SKU, not only the main furniture. Count tiers, handles, trays, feet and shade structure."
- Composition benchmark WP 2218-2227: Hierarchy ("Hero visible, accents subordinate; purposeful negative space"), Harmony, Light, Provenance. WP 2225 provenance row: "SKU + catalogue image + dated facts for claimed Midas items"; failure example "Generated generic vase labelled a Midas SKU".
- "RECOGNIZE → GROUND → PRESERVE" WP 448-452; "STYLING IN BOTH DIRECTIONS" WP 454-458 (read these lines for the wording; not quoted here).
- Room-edit prompt pattern (SUPP): "Edit reference image 1 itself ... Preserve ..." with ONLY one change; room, product and baseline carry separate authority ("target_room" vs "original_product"). R2-A is "composition only".
- Generic vs Midas: only items with SKU + catalogue photo may be claimed as Midas; others are generic context and must not be labelled as Midas (WP 2225). D2/D6 notes WP 2229-2245.

## 6. Evidence and benchmarks (#evidence; WP 2273-2525)

Measured (a recorded receipt or count) vs claimed (a model or operator judgement):

| Number as written | Where | Measured or claimed |
|---|---|---|
| 89 indexed records | gate card; WP 37 disclaimer | Index count, explicitly not a coverage claim |
| 11 Midas products | gate card | Count of sourced products (4+3+4) |
| 247 taxonomy nodes, 43 handling profiles (release F1-CATEGORIES-2026-09-29, Kuwait English, source amsitemap, sourceCount 238) | WP 437, 898; SUPP | Snapshot counts |
| 75 credits per image; estimate 90; 7 runs = 525 credits | SUPP live | Reported by the receipts; `actualTotalCredits` null so not settled |
| 58-98 s per run | SUPP live; WP 1099-1172 | Timestamps from the receipts |
| 2048 x 2048 outputs (U2) | SUPP | Recorded file dimensions |
| Centre-table 265 credits (3 x 75 + 40) | WP 2304-2321 | Receipts, as computed by the page |
| Scores 90/90/40 then 90/90/90 | WP 2289-2302 | Claimed (model judgement; subjective rubric) |
| Scores 75-100% across D-, A-series | SUPP | Claimed |
| Views: 19 view generations at 150 credits each; 7 successful upscales at 1080; completed 10,410 credits; selectedOutputDirect 9,660; superseded 750; 3 failed upscales exposing 3,240 credits | SUPP viewsUsage | Receipts-based; "settlement unverified" |
| Upscale settings: `ultra-photo`, 2x, sharpness 7, grain 4, ultraDetail 3; N07 used `ultra-sublime` after two failures | SUPP | Recorded settings |
| 22 software checks, 32 live checks, 23 coverage rows, 5 limits | SUPP live | Counts of the page's own checks |

WP section anchors: gates 2279-2287; counts 2327-2337; time/credit 2339-2345; failed attempts 2353-2361; coverage matrix 2362-2391; provenance 2393-2407; boundaries and exceptions 2408-2464; hashes 2465-2525.
Gate wording (WP 2282-2287, quoted): "No universal 95% fidelity gate or proven 0% drift guarantee is operating across the current client routes. The new structured critic and bounded decision logic are implementation pieces; a connected, audited correction-and-release controller remains necessary." Also: "A higher styling score does not compensate for lower product fidelity." "One output cannot pass a multi-image website package." "Provider completion is not unattended production qualification or a verified photography cost saving."

## 7. Models and tools mentioned
- GEMINI38_FLASH (Observe) and GEMINI31_PRO (Direct) in U2 (SUPP).
- `imagen-nano-banana-2` (Pro), `imagen-nano-banana-2-flash` (Flash); described in the data as Google "Nano Banana Pro" (SUPP).
- OpenRouter Gemini 3.1 Pro structured critic (conditional).
- Magnific: Flow rlUwxtcFH6 (U2), Spaces/Creations (gOntKMiSXO and other ids), `images_resize` (non-generative), upscale (`ultra-photo`, `ultra-sublime`). Seedream (failed comparison runs).
- Native OpenAI image edit (bedroom completeness fix, 1254 x 1254).
- Assistant-operated Magnific Space for the Direct-Space tests; "client UI bypassed".
- Stylist skill `Skills/home-furniture-stylist` v1.2. Source site: midasfurniture.com /en (LINKS 104-107).

## 8. Costs, prices, credits, time per job or image
- 75 image credits per generation; estimatedCredits 90; U2 7 runs = 525; 58-98 s per run (section 2.2, 6).
- Non-AI resize 40 credits; centre-table loop total 265 (WP 2304-2321).
- View generation 150 credits each (19); upscale 1080 credits each (7 successful); totals in section 6.
- Failed comparison estimates: 115 and 116 credits; charges "not established" (WP 2353-2361).
- Human time per job: not recorded in the files I read; the gate "Autonomy & cost" says "every charged attempt and human time" must be counted and that no verified photography cost saving exists (WP 2282-2287). No prices in currency are given for models. Not confirmed.

## 9. Existing rooms/spaces, multiple products, batch, variations, chat
- Existing rooms: R2-A "Bed 1 in Space 2" and R2-B "Bed 2 in Space 1" place a vendor bed into a supplied room photo ("Space 2.png", "Space 1.png"); R3-A/R3-B add accessory products to the selected R2 room. Room is `target_room` authority (section 5.3). Limits repeat: scale, headboard mounting, hidden construction inferred; no room measurements.
- "Direct-Space" tests D1-D7 were run in an assistant-operated Magnific Space with the client UI bypassed (SUPP). That is evidence of the capability, not of a client flow.
- Selective edits: R2-C (change cover colour only) and R2-D (new camera view).
- Multiple products per scene: the sofa schemes (4, 3, 4 products), R3 (bed + chandelier + chest + lamp). Inventory counting is a defect class (12 chairs, five seats).
- Batch/variations: "Accessories, 6 mood variations", "Lifestyle, 7 refinements", "Whole sets and camera views, 7", shots per profile (hero, wide, detail; WP 439-446, 900-907). F1 plans one isolated generator per output. U2 is one reference and one output per run.
- Chat or conversational refinement: the client page preview has Preferences and Suggestions stages but "does not dispatch generation". No conversational refinement loop is evidenced as built. Not confirmed.
- The multi-reference client path (6 reference roles, 7 outcome choices) is preview only (WP 388-403, 849-864).

## 10. Gaps, contradictions, not built, historical only
- Not built or not established: no live autonomous correction controller (WP 1983); no calibrated fidelity percentage (SC line 11); no 95% fidelity gate or 0% drift guarantee (WP 2287); no unattended A deployment (SC line 5); vault is only illustrated (SUPP); client page does not dispatch generation (SUPP); no retained evidence uniformly (Eye "evidence retained unevenly").
- The model-generated reviews are assistant-performed, not independent (SC line 11).
- Historical only: complex-case N01-N07 (evidenceDate 2026-09-29, "not generated by this software update"); early R2/R3 runs of 2026-09-16; the 23 Sep website test; seven QA records `needs_recovery`/`review_pending`; Direct-Space and accessories series.
- Contradiction or tension (inference): the page shows two different counts (89 vs the JSON record groups) and two revision identifiers (section 0). U2's Observe/Direct are two models in one flow ("three-model") whereas the layered chain lists Brain and Stylist as separate layers; the U2 path combines them (SUPP).
- Open specification gaps: the client Excel for N01-N07 not supplied; vendor colour names and material composition null; sofa-five prompt weakened the assembly; selected sofa S3-R3 not confirmed by the owner.
- Release decision from the data: "Not ready for unattended quality-approved delivery" (SUPP).
- Spend risk: an uncertain receipt can hide a paid run; viewsUsage shows 3 failed upscales exposing 3,240 credits with settlement unverified.
