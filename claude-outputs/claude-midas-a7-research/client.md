# Client portal requirements: target client page vs live A6 page

Date of extraction: 14 Oct 2026. Read-only study. No web, no n8n, no paid calls.

Source key (all paths under /home/claude/research/text/ unless stated):
- F = client-first-page.txt (page as loaded; 27 lines)
- XF = x-client-first-page.txt (text revealed by clicking; 346 lines)
- G = client-guide.txt (guide page; 584 lines, "#guide-0" copy repeats from line 295)
- XG = x-client-guide.txt (same guide text, 162 lines)
- AH = arafat-home.txt, XA = x-arafat-home.txt (the "Midas Studio" chat site)
- A6 = /home/claude/claude-midas-studio-site-a6-go/site/app.js (and index.html)
- Screenshot client-first-page.png was read: default state is the Manual tab, step 01, "New Project" ticked, "One by one (same department)" ticked, a "Continue to the item" button. The arafat PNG is too small to read at the size shown; only text was used.

Conventions: quotes are exact. "Inference" marks anything not stated in a source.

Extraction gaps to know about (important):
1. XF could not click 01-05 step buttons after switching to Projects, and could not click Batch / One by one after choosing Single item (XF:41-49, 62-64). Reasonable inference: those controls are hidden in those modes. Not confirmed.
2. Step 03 (Scope), 04 (Preferences) and 05 (Suggestions) were never opened in the click capture. Their content is known only from (a) the guide text and (b) the button labels in F:49-73. The only step 03 text captured is the button label "Choose the outcomes" (XF:142).
3. The guide does not number a section 6 (goes 5 then 7), has "13 · Steering and…" unfinished (G:188-190) and uses "15" three times (G:196-206).

---

## 1. Projects vs Manual

### What each is
- Two tabs at the top of the first page: "Projects" and "Manual" (F:9-10). Manual is the tab shown on load (screenshot; XF:3-27 shows the Manual step flow on load).
- Projects, guide: "Start from a product or collection, an existing room, a new styled space, or saved work. These four starting options belong under Projects. The default automated workflow handles the process; input, category and the required result steer it." (G:24)
- Manual, guide: "Choose New Project, Edit or Single item, followed by the relevant option beneath it. Continue through The Item, Scope, Preferences and Suggestions. These sections organise your choices; the solution still handles the workflow. Optional controls can be left at their defaults." (G:28)

### Every choice in Projects (XF:30-39)
Heading "Project", prompt "Where would you like to begin?", four cards:
| Card | Sub-text on card | Guide meaning |
|---|---|---|
| Product or collection | "Images or catalogue products" | "Start with one product, several products, or a complete set. Upload vendor images, clean product images, lifestyle photographs, multiple views, or select catalogue references. Several photographs may describe one item; they are not automatically several products." (G:32) |
| Existing room | "Furnish, replace or restyle" | "Supply the room and the products to place, replace or restyle. The room reference defines the space to retain; product references define the items." (G:36) |
| New styled space | "Create a complete room" | "Start a new room composition from products and a room description. The space is created around the required pieces, with coordinated supporting products." (G:40) |
| Saved project | "Continue an existing direction" | "Continue saved work, refine selected elements or request variations while retaining the original references and accepted direction." (G:44) |

What happens after one of the four is chosen is not in the captures (inference: it opens an item/reference intake step; not confirmed).

### Every choice in Manual
Step 01 "What would you like to do?" (F:21-27; XF:20-27):
- Job: New Project | Edit | Single item (default New Project).
- "Work on" (visible with New Project): Batch | "One by one (same department)" (default One by one, per screenshot).
- Edit reveals: "Start from": "Choose from saving" | "New item"; empty text "No saved projects yet. Choose New item to attach a previous result." (XF:51-55)
- Single item reveals: "Item role": "Hero" | "Secondary" (XF:57-60).
- Then "Continue to the item" -> steps 02-05.

### Shared
- Same item hierarchy, reference types, outcomes, preferences and suggestions are the vocabulary of both. Guide: "Under Projects, choose product/collection, existing room, new styled space or saved project. Manual begins with its own Job choices and accepts the relevant reference types without asking this second starting question." (G:73)
- Both run "the default automated workflow" / "the solution still handles the workflow" (G:24, G:28): the same backend path, only the way of asking differs.

### Differs
- Projects asks one question ("Where would you like to begin?") with 4 start types. Manual asks job type (+ work-on / start-from / item role), then 4 more steps.
- Preferences "are optional and appear in Manual" (G:148). Inference: Projects mode does not show lighting/wall/floor/suggestions; the automated workflow chooses.
- Projects has "Existing room" and "New styled space" as explicit starts. Manual reaches them indirectly: Edit -> New item "+ room reference" (G:275), or reference type "Room / target space" (XF:132).
- Only Manual has Batch / One by one / Hero / Secondary.

### When to use each
The guide gives no explicit "use Projects when..." sentence. Closest quotes: Projects = "The default automated workflow handles the process; input, category and the required result steer it." (G:24). Manual = "Optional controls can be left at their defaults." (G:28). Inference: Projects for a fast start by intent, Manual for control over job type, role, preferences and suggestions.

### How a project groups jobs and items
The guide never defines a project as a container with a data model. What is stated:
- A Manual "New Project" with Batch: "Prepare several items together. Keep each item or set separate, group its different reference views, and keep category-specific output packages. A batch is not a single collage or a room made from unrelated products." (G:49)
- New Project with One by one: "Work on one item or set at a time, with the department carried forward to the next item. Each item can have multiple input references and several required output images." (G:52)
- Case 08: "Each item or set has its own references, category and package. A towel, a lamp and a dining set remain separate jobs within the batch. Multiple angles of one product stay together." (G:284)
- So the stated hierarchy is: project (batch or sequence) > job per item or set > several reference images per item > several output images per job.
- Saved work: Edit -> Choose from saving: "Use a saved project as the starting point. Carry its references and accepted direction forward; describe only the requested change." (G:57)

### What is common in a project (guide-0)
Guide-0 (G:295-336) is the "Start with Projects or Manual" block only. It lists no project-level shared fields. Things the guide says carry across the project/saved work:
- "the department" is carried forward to the next item in One by one (G:52).
- "the original references and accepted direction" are retained for Saved project (G:44), Edit/Choose from saving (G:57), and case 09 "Reuse the accepted space and original product references." (G:291).
- Inference: the project-level common data are department, accepted direction (room/look), and the original references. Per-item data are category, references, role, outcomes, package.
- Terminology trap: "New Project" is a Job button inside Manual; "Projects" is a separate tab. Arafat's equivalent is "case" ("New case", "Case history", AH:8, XA:238).

---

## 2. Steps 01-05

### 01 The Job (F:11-27, XF:20-60)
| Field | Options | Default | Rule / help text |
|---|---|---|---|
| Job | New Project, Edit, Single item | New Project (screenshot) | Heading "What would you like to do?" |
| Work on (New Project) | Batch; One by one (same department) | One by one | Batch: items kept separate, not a collage (G:49). One by one: department carried to next item (G:52) |
| Edit: Start from | Choose from saving; New item | not captured | Choose from saving: saved project as start, "describe only the requested change" (G:57). New item: "Bring an image or item into an editing task. It may be a product image, a composition or a room. Supply the relevant reference and the change you need. Choosing this option does not force a room-furnishing scenario." (G:61). Empty state: "No saved projects yet. Choose New item to attach a previous result." (XF:55) |
| Single item: Item role | Hero; Secondary | not captured | Hero: "Make the supplied item the main subject. A small accessory can be the hero: select appropriate Midas furniture and supporting objects around it, with a readable product view and detail image." (G:65). Secondary: "Use the item inside a composition supporting the main furniture or room. Keep it recognisable and correctly placed, without forcing it to become the largest object in the image." (G:69) |
| Button | "Continue to the item" | | |

### 02 The Item (XF:66-143, "Add your item.")
- Department (select). First option "Automatic from references", then 29 labelled entries in XF:70-96: Home Furniture, Office Furniture, Accessories, Outdoor Furniture, New Arrival, Ashley Homestore, AR & 3D, Best seller, Dining Table Collection, Shop by Space, "Shop by Purpose, Executive!", "Shop by Meeting Room!", Elegant Lighting, "Exclusive Deals (20% Flat Sale)", "Big Savings Are Here (50% Flat Sale)", "Snag The Best Deals (30% Flat Sale)", KARE Design, Last Chance, FURNITURE, "LIGHTING & AMBIANCE", "HOME DECOR", "STORAGE & ORGANIZATION", All Kare, Online Exclusive, Special Product, "48Hrs Flash Deal", "New arrivals · category view". Guide: "Website collections and sections are labelled separately from the main departments." (G:78). Inference: the first four (Home Furniture, Office Furniture, Accessories, Outdoor Furniture) are the real departments; A6 does the same split: "the four product departments; website sections are left out" (A6:456).
- Category (select): same list shown before a department is chosen (XF:97-125). Dependent on department (inference; A6 does this).
- Sub-category (select): "Automatic from references" (XF:126-127).
- Guide: "Use the predefined product hierarchy ... It covers furniture and other home categories, including accessories, textiles and lighting. The selected item determines relevant treatment and outputs." (G:78). "Automatic from references: Leave an unknown category for the intake process to determine from the supplied image and product information. Recognition and interpretation are part of normal intake for every item, not a special case reserved for difficult products." (G:82). "Item defines the workflow: The category changes what to preserve, how to place the item, what details need review and which images belong in its package." (G:86).
- Reference source toggle: "Bring your references" | "Choose from Midas" (XF:128-129).
- Reference type (select, 6): Product / vendor reference; Room / target space; Inspiration / look; Previous result; Other views / pieces; Specifications / Excel (XF:130-136). Guide: vendor raw images, clean packshots, products photographed in a room, multi-view sheets and set components are all references; "Assign roles and describe set relationships. Insets, arrows, crosses and colour swatches are evidence to interpret, not extra physical items." (G:90). "Room images define an existing space. Previous results carry forward an accepted composition or look. Inspiration communicates style. Text, PDF or the client's Excel supplies product facts and instructions. An item can have several reference types at once." (G:94)
- Upload: "Add images or product files" / "Choose files from your device" / "JPG, PNG, WebP, PDF, XLS/XLSX or CSV · up to 25 MB each" (XF:137-139). No file-count limit stated.
- Buttons: "Back", "More options", "Choose the outcomes" (XF:140-142). Inference: "More options" reveals the optional continuation 7-15; "Choose the outcomes" goes to step 03.
- Choose from Midas (modal): title "Midas product references"; text "Choose from the existing reference library. Product source links are available on each card."; "Search products"; 46 cards, each with product name, "SKU nnnnnn", "View Midas source", "Add reference" (XF:145-331); footer "Use 0 selections" / "Close". After one add: "Your Midas selections", "Midas source", "Selected", "Use 1 selection" (XF:342-345). Multi-select is implied by "Use N selections". Card names are accessories and furniture (e.g. White king bedding SKU 175658, ALARO sofa set SKU 165826, CASARRA king bedroom SKU 160689, RUMN dining set SKU 161107, ORGANIC dinner plate SKU 173765). SKU 174781 (OAKLYNN table lamp) appears twice in the list (XF:184-185 and 312-313): a data defect to handle (de-duplicate by SKU).

### 03 Scope (guide G:96-131; page text only "Choose the outcomes")
Seven outcome choices (inference: the 7 unlabelled BUTTONs at F:49-55 are these tiles; their count matches the guide):
| Outcome | Guide wording |
|---|---|
| White BK | "A clean white-background catalogue result. Preserve product shape, pieces, finish and relevant details. Room paint, flooring, plants, people and room styling are set aside for this output." (G:99) |
| Lifestyle | "Place the product in a complete, believable styled setting. Coordinate scale, contact shadows, lighting and supporting pieces while keeping the product readable." (G:103) |
| Website | "Prepare the product's website image set using the relevant category template. A bed, dining table, textile or accessory needs its own useful views and details; a set is not represented by only one image. The template and requested variations define the package." (G:107) |
| New Composition | "Create a coordinated arrangement of products in a space. Respect the exact item inventory, relationships, room constraints and any chosen Midas combinations." (G:111) |
| Variations | "Create related alternatives with controlled changes in lighting, style or camera view. Keep the original product identity and set inventory across the alternatives. Choose which variables change." (G:115) |
| Create with this item | "Use the selected item as the design anchor. For an accessory, choose furniture that complements it; for a furniture hero, select supporting Midas accessories. Role still determines prominence." (G:119) |
| Others | "Describe an outcome not covered by the predefined choices. It becomes an explicit brief instruction, not an unlabelled generic generation." (G:123) |
- "View and delivery: Use the category template by default. When needed, request a wider view or close-up, choose image proportions or resolution, and set the number of variations. These are output variables, not separate workflows." (G:127)
- "More than one outcome: Combine relevant deliverables for one product, for example white background + lifestyle + website package. Room controls apply only to the outputs that use a room." (G:131) -> outcomes are multi-select.
- Defaults and validation rules are not stated for step 03.

### 04 Preferences (F:56-71; G:133-148)
- Lighting (3): Soft daylight "clear, natural product readability"; Golden afternoon "directional warmth and softer mood"; Warm evening "a lit interior with controlled contrast". "These names are proposed defaults; your PDF specified three options without naming them." (G:136)
- Wall paint (8): White, Ivory, Sand, Greige, Taupe, Sage, Charcoal, Terracotta. "They are visual directions, not paint codes or claims about the product colour. The eight names are proposed defaults." (G:140)
- Floor (4): Light oak, Dark walnut, Limestone, Marble. "...not vendor material specifications." (G:144)
- "Use workflow defaults" button (F:71) = let the workflow choose (A6 equivalent: "Let the studio choose").
- Relevance: "Preferences are optional and appear in Manual. White-background-only work does not need a wall or floor. Existing rooms should retain their actual architecture unless the brief requests a change." (G:148)

### 05 Suggestions (G:150-161)
- Plants: "Optional greenery supporting the composition. Keep plant scale, placement and sight lines appropriate; do not cover key product features. Your document calls this 'Plantary'." (G:153)
- Human: "Optional lifestyle presence for scale or use context. Avoid hiding the product, changing its geometry or making the person the main subject unintentionally." (G:157)
- Mood / Vibes: Automatic, Calm & natural, Warm & inviting, Refined & elegant, Bold & expressive. "...they do not permit changing the product." (G:161)
- Defaults for plants/human not stated.

### Optional continuation 7-15 (G:163-206)
| # | Field | Guide text |
|---|---|---|
| 7 | Specific items / Combo | "Specify particular Midas items or a combination using product selections, links or SKUs. Furniture can lead the composition with supporting accessories, and an accessory can lead with supporting furniture. Selection should respect style, purpose, scale and the supplied product references." (G:166) |
| 8 | Additional input data | "SKU identifies a product. Dimensions guide plausible scale when provided. Colour and fabric/material hold supplier facts or clearly labelled observations. Item count and relationships protect cases such as twelve chairs, five seats or excluding a photographed table." (G:170) |
| 9 | Include description and meta | "Yes adds a product description and useful metadata to the requested package; No requests visuals only. Unsupported material, colour or measurements remain unknown." (G:174) |
| 10 | Use previous generation (space, look) | "Attach or select an earlier result and say whether to retain its room, composition or visual direction. It does not replace the original product reference." (G:178) |
| 11 | Other pieces images | "Add companion pieces and additional views, identifying their roles and relationships. Do not count a reverse view or a detail inset as a new saleable item." (G:182) |
| 12 | Custom prompting | "Add concise instructions such as 'keep the original windows' or 'show the two chairs without the table'. Instructions refine the shared workflow." (G:186) |
| 13 | Steering and... | Unfinished heading, "No extra fields or workflow requirements are assigned to it. Existing revision instructions belong under Custom prompting until its meaning is defined." (G:190) |
| 14 | Fidelity / Styling / Cluttering | "Fidelity sets preservation priority, Styling sets scene treatment, and Cluttering sets accessory density. Slider values are steering strength out of 100, not measured fidelity, pass scores or permission to alter the product identity. White-background-only output ignores room styling and accessory density." (G:194) -> three sliders 0-100. |
| 15a | Share description first | "Request a composition description before generation so the user can adjust direction. This is a review preference, not a promise that a description alone validates the image." (G:198) |
| 15b | Proceed without | "Skip that initial description checkpoint. The intended output review still checks inventory, product identity, placement and composition." (G:202) |
| 15c | Use semantic grounding | "Use product features, context and available references to support the interpretation and proposed composition. Visual recognition remains part of the standard workflow. This option adds explicit grounding to the review requested here." (G:206) |
Inference: 15a/15b are a two-way choice; 15c is a separate toggle.

### Brief pass-through (G:208-223)
1 Capture ("Collect references, category if known, item role, requested outcomes and only the relevant steering."), 2 Prepare, 3 Compose and generate, 4 Review and deliver ("Correct specific problems and deliver the requested package, with unresolved issues made clear.").

---

## 3. "How choices combine" - 9 cases (G:225-291; same in XG:124-162)

Guide intro: "Examples of how the same workflow adapts to different items and references." (G:228). Count: 9 (numbered 01-09).

| # | Choices (verbatim path) | Behaviour / outcome | Images produced | Notes |
|---|---|---|---|---|
| 01 A 12-chair dining set | New Project -> One by one -> Dining Rooms -> Lifestyle + Variations | "Keep twelve chairs and the table as one set. Create distinct daylight and evening compositions, with selected Midas dining accessories." | "Deliver the whole-set view and useful details" - at least two distinct compositions (daylight, evening) each with whole-set view plus details. Exact count not stated. | "do not omit chairs to simplify the shot." Category "Dining Rooms" is not in the 29-entry department list; it is a category/sub-category name (inference). Uses the Midas dining accessories (see arafat 12 chairs example). |
| 02 A five-seat modular corner | New Project -> One by one -> Living Rooms -> New Composition + Website | "Several source images describe three modules forming five seats. Keep their arrangement and upholstery, style the room with coordinated Midas tables and accessories, and request wide and close-up views." | A composition plus a website package; wide and close-up views. Count not stated. | Multiple reference images = one item. "Living Rooms" as category (inference). |
| 03 Two chairs, excluding the table | Single item -> Hero -> Dining Chairs -> Lifestyle | "The source may contain a table or selection marks. Explicitly include only the two chairs. Place them in a relevant setting, with their form visible, plus a detail view." | Lifestyle image + a detail view (2 views; count not stated). | Needs an explicit include/exclude statement (maps to must_not / locks). |
| 04 An accessory as the starting point | Single item -> Hero -> Relevant accessory category -> Create with this item | "A bowl, jewellery box or bookend becomes the main subject. Select suitable Midas furniture around it. A box may need open and closed views; a bookend should be shown performing its actual function." | Main-subject image with Midas furniture; per-category extra views (open and closed for a box). | The workflow selects Midas furniture; must be real SKU products. |
| 05 An accessory supporting a room | Single item -> Secondary -> Accessories -> New Composition | "Place the same item on an appropriate supporting surface in a furniture-led composition. Keep it at credible scale, physically supported, and coordinated with the palette." | One composition (count not stated). | Accessory is not the largest object. |
| 06 Towels, bedding and textiles | New Project -> One by one -> Relevant textile category -> Website | "Read swatches, pattern repeats, alternate views and supplier data as references. Show the product in use and close up." | Website package for a textile: in use + close up. | "A colour swatch is not another physical item, and exact fibre content needs product data." |
| 07 Restyle an existing room | Edit -> New item + room reference -> Lifestyle | "Supply the room, the new product and a placement instruction. Retain room features requested by the user, replace only the selected pieces, and keep a consistent view for comparison." | Lifestyle image in the client's room, same camera view as the room reference. | Needs room reference + product reference + placement instruction text. |
| 08 A mixed vendor batch | New Project -> Batch -> Product or collection | "Each item or set has its own references, category and package. A towel, a lamp and a dining set remain separate jobs within the batch. Multiple angles of one product stay together." | One package per item; each item may have a different category package. | Batch = N independent jobs under one project. |
| 09 Continue an accepted look | Edit -> Choose from saving -> Previous generation -> Variations | "Reuse the accepted space and original product references. Vary only the chosen dimensions, such as lighting or camera view, while carrying the preserved details forward." | Variations (count chosen by client). | Needs a saved/accepted previous result. "accepted" has to come from the owner's recorded decision (project rule). |

---

## 4. Chat box, conversational refinement, variations

### Target client page (client-first-page + guide)
- There is no chat box on the target first page and no mention of chat in the guide. Refinement is by form: "12 · Custom prompting - Add concise instructions such as 'keep the original windows'... Instructions refine the shared workflow." (G:184-186); "Existing revision instructions belong under Custom prompting" (G:190); Saved project "refine selected elements or request variations while retaining the original references and accepted direction" (G:44); Variations outcome (G:115) and case 09 (G:291).
- Effect on the workflow (re-plan / re-render / new job) is not stated in the guide. Closest: "Review and deliver ... Correct specific problems" (G:223), and "describe only the requested change" (G:57). Inference: a refinement or variation is a new job linked to a parent result.
- "15 · Share description first" is a pre-generation chat-like checkpoint: description shown, "so the user can adjust direction" (G:198). It needs a pause/approve step after planning. (A6 already has a plan-and-go gate, but for the owner, not the client.)

### Arafat site (the chat box lives here)
- Header texts: "Chat connected" (AH:11). "Add a reference and describe the result. Review the generation estimate before creating a candidate. Critique has a separate quote and approval." (AH:14)
- Composer: "Your message", "Add images", "Send" (AH:324-326). Six quick-start chips: Accessories, Spaces, Views, White background, Lighting, Variations (AH:319-323). Limits: "Send uses paid OpenAI chat. Image generation requires a separate Magnific credit confirmation; visual critique requires its own exact quote and approval." (AH:328). "5 images per chat message · 10 MiB each · Midas can prepare one product reference with connected catalogue accessories. Sent messages and images go to OpenAI; generation requests also send the chosen reference to Magnific." (AH:329)
- Chip templates found as "Saved · not sent" drafts and sent messages (inference: chip -> template text):
  - Accessories: "Style the main product with suitable accessories from the connected Midas catalogue. Choose a restrained selection that complements it. Preserve its identity, established room, materials and every confirmed furniture piece; keep them prominent. Prepare the references automatically and show me the selected products and cost." (AH:19)
  - Spaces: "Place the main product in a suitable lifestyle space. Use my room reference if attached and preserve its architecture. Otherwise propose a space that complements the product." (AH:125)
  - Variations: "Create a variation while preserving the product identity. Change only this aspect:" (AH:118)
  - Lighting: "Change only the lighting and mood. Preserve the furniture, materials, camera view and room architecture. Desired lighting:" (AH:158)
  - Views: "Prepare another view of this product. Preserve its construction and materials; explain any hidden surfaces that the references do not establish. Desired view:" (AH:242)
  - White background: template not captured.
- Conversation pattern: user asks -> assistant answers with a plan (selected SKUs and quantities, "The brief preserves...") and a cost estimate -> "Use the inline 'Generate this version' cost confirmation to proceed. Generation has not started." (AH:36). Assistant can ask a clarifying question: "Which view would you like: straight-on front, left three-quarter, or right-side?" (AH:248); user answers "right-side" (AH:256) -> "Your right-side version is prepared ... Estimated generation cost: 95 credits, subject to variation. Select 'Generate this version' ..." (AH:262-266). Missing reference: "Please upload the main product image and, if you have one, your room reference." (AH:131).
- What the chat can change: accessories (catalogue), space/room, view (camera), lighting and mood, variations of one aspect, white background. Each message produces a new "version" (a new image direction and reference sheet), not an edit of the old one. Each version is a new generation after its own cost confirmation. Inference: re-plan + new render = new job linked to the original; the earlier version stays in the conversation (AH:28 "Earlier workflow", AH:130 "Earlier or blocked quote · prepare a new version").
- Variations: "Variations require approved-parent evidence and remain gated." (AH:315). So a variation needs a parent result that is approved (owner decision), consistent with the project rule that only the owner approves.
- Critique: separate step: "Exact critic token quote is required before paid review." (AH:70) with a "Get critic quote" button; "The review request could not be confirmed. It will not be repeated automatically." (AH:285).
- Repair: "Repair attempts: 0/2." (AH:77) and "Only a verified repair decision may request a repair." (AH:79). Matches the "at most two repairs" project rule.

---

## 5. Multiple products

- One job, several products: "Start with one product, several products, or a complete set." (G:32). Several photographs of one item are one item (G:32, G:90, G:182).
- One scene with several products: New Composition ("Create a coordinated arrangement of products in a space. Respect the exact item inventory, relationships, room constraints and any chosen Midas combinations." G:111); Specific items / Combo with SKUs (G:166); Midas catalogue picker multi-select (XF:332, 345); Create with this item (G:119).
- Item count protection: "Item count and relationships protect cases such as twelve chairs, five seats or excluding a photographed table." (G:170). Arafat shows count arithmetic: 12 plates, 12 glasses, 3 cutlery sets = 12 settings, "Four place settings per set, not sixteen. Twelve full settings need three sets." (AH:48).
- Batch vs one by one: Batch prepares several items together, each separate with own package (G:49, case 08 G:284). One by one: sequential, department carried forward, each item may have multiple references and several output images (G:52).
- Department rule: only "One by one" states "(same department)". Batch states no department rule (inference: batch may mix departments; case 08 mixes towel, lamp and dining set).
- A batch "is not a single collage or a room made from unrelated products." (G:49)
- Limits: file size "up to 25 MB each" (XF:139). No limit stated on number of references, items per batch or catalogue selections on the target page. Arafat: 5 images per chat message, 10 MiB each, "one product reference" per preparation (AH:329). A6: one photo, up to 25 MB, 1-4 images (A6:12-22, 889-896).

---

## 6. Existing rooms / spaces

- Projects start "Existing room: Furnish, replace or restyle" (XF:33-34): "Supply the room and the products to place, replace or restyle. The room reference defines the space to retain; product references define the items." (G:36)
- Reference type "Room / target space" (XF:132); "Room images define an existing space." (G:94)
- "Existing rooms should retain their actual architecture unless the brief requests a change." (G:148)
- Edit -> New item "may be a product image, a composition or a room" (G:61). Case 07 restyle (G:277): replace only selected pieces, keep a consistent view for comparison.
- Custom prompting examples: "keep the original windows" (G:186).
- New styled space: "Start a new room composition from products and a room description. The space is created around the required pieces" (G:40). So the client can describe a room in text (a room description field; not captured).
- Reuse a space: "10 · Use previous generation (space, look) ... say whether to retain its room, composition or visual direction." (G:178) and case 09 "Reuse the accepted space" (G:291).
- Wall/floor choices apply to created rooms; "Room controls apply only to the outputs that use a room." (G:131)
- Arafat "Spaces" chip: use client's room reference and preserve architecture, "Otherwise propose a space that complements the product." (AH:125). Reply examples preserve "room architecture, large left windows, recessed illuminated wall shelves, wood flooring, rug and woven pouf" (AH:273).
- No saved named room library or "create a space and reuse it" feature is described. The only reuse path is a previous generation / saved project. (Arafat's "Space & workflows" link and magnific.com/app/spaces URL is a provider workspace, not a client room; AH:316, 365. Do not expose.)

---

## 7. Extra on the arafat site ("Midas Studio", team preview)

Features and rules worth considering:
1. Case history and cases: "Case history - Originals, previous versions and your conversations." Entries "Cream corner sofa", "Wood & warm white", "Full bedroom", "Dining with 12 chairs", "Grey modern sofa", each "2 existing views · 0 messages", plus a chat case. "Includes the five supplied furniture cases. Earlier project archives are not imported." (XA:238-260). Header buttons: History, New case (AH:7-8).
2. Cost visibility before generation: credit estimates ("91 credits, subject to variation", "95 credits"), "Product purchase prices aren't included in the catalogue snapshot." (AH:34); explicit confirm "Generate this version"; critique has its own quote and approval. Conflicts with project rule "Promise no delivery time, pixel size, retention period"; costs are not forbidden, but internal credits are provider-linked. Decide whether the portal shows a price (inference).
3. Catalogue accessories with SKU and links to midasfurniture.com; "Catalogue references verified 2026-10-09. Availability and prices are not checked." (AH:59). Matches the rule "A supporting piece needs its SKU and catalogue photo".
4. Reference sheet prompt rules (internal): "the upper panel is the owner's original main product and is authoritative for its geometry, materials and furniture count... Match the accessory reference images; never invent a branded replacement. Create ONE finished photograph, not a sheet. Do not reproduce reference labels or SKU text" (AH:45).
5. Status vocabulary: "Candidate preview · not released", "Release held · fidelity validation incomplete", "Critic: unverified. Repair attempts: 0/2.", "Needs correction", "Image saved · review unconfirmed", "Earlier or blocked quote · prepare a new version", "Release unavailable". Decision trace rows: authority, stylist, package, critic, repair, release (AH:81-87). "package: unconfigured · No owner-confirmed requested-output manifest is bound to this candidate." -> an owner-confirmed requested-output manifest per job is a concept to carry.
6. Independent visual review shown to the viewer with inventory counts and a correction brief (AH:89-101). Shows how a held result is explained: counted chairs (9 of 12), geometry mismatch, camera change. Good model for the "on hold, reason shown" panel, but written in internal language.
7. Evidence: "Run evidence", "Download evidence" (receipt), run IDs. "Recorded delivery default: 1125 × 1125. Native master retained. Delivery formatting is not implemented in this adapter. Native render dimensions are not delivery acceptance." (AH:68). A6 also has "Download 1125 × 1125" (A6 results.file).
8. Sharing/privacy: "Shared test history · anyone with this link can view uploads and requests." (AH:13). Data disclosure: "Sent messages and images go to OpenAI; generation requests also send the chosen reference to Magnific." (AH:329). A client portal needs its own privacy stance and must not name providers (project rule).
9. Roles: "Team preview", "Owner setup" (/owner), "Space & workflows" (/workflows) (AH:5, 316-317). Owner-only connection of the image provider (AH:150). Matches A6's owner key.
10. Error states shown in the open: provider not connected, "Some workflows could not be verified. Retry shortly; the owner can check authorization if this persists." (XA:221), review request unconfirmed and not repeated automatically.
11. Workflow tag shown on a result: "W2 Lifestyle" (AH:269); and "The New Clone of Midas Studio · Input-led Workflows v1 · 30 Sep 2026" (AH:305). Internal. Do not show.
12. Internal words visible on this site that must NOT reach clients: Engine / Brain / Eye (AH:111-113), Critic, Stylist, Magnific, OpenAI, "GPT-6 Astra", "Saved Midas Flow", hash-bound evidence.
13. No pricing tariff, subscription, delivery time or approval-by-client appears. Approval is not shown anywhere as granted; every result is "not released".

---

## 8. Gap list: target client experience vs live A6 page

A6 today (app.js): one product photo (JPG/PNG/WebP, 25 MB, A6:157, 893); fixed `jobMode: 'new_project'`, `workOn: 'one_by_one'` (A6:512-513, no UI); outcomes Lifestyle, White BK, Website enabled, others disabled (A6:410-412); "Coming later" tags for New Composition, Create with this item, "Edit a result" (A6:120, 765-767) and text "Edit, Single item, Batch, New Composition and Create with this item" (A6:75); department/category/sub-category from the Midas Kuwait snapshot with four departments only (A6:456); image count 1-4, view, aspect, resolution; lighting/wall/floor + "Studio choice" switch; plants, human, "Midas supporting pieces" (boolean), mood; fields colour, material, hero, locks, must-not; owner go gate; results with status; no chat; Re-generate off (A6:20).

### Must
| # | Gap | Target source | A6 state |
|---|---|---|---|
| M1 | Multiple reference images per item, with a role per image (Product/vendor, Room/target space, Inspiration/look, Previous result, Other views/pieces, Specifications/Excel) | XF:130-136; G:90, 94, 182 | One photo, one role `PRODUCT_ROLE` (A6:422, 524, 889-899 "Only one photo is used") |
| M2 | File types PDF, XLS/XLSX, CSV in addition to images | XF:139 | Images only (A6:423-424) |
| M3 | Projects tab with the four starts (Product or collection, Existing room, New styled space, Saved project) | XF:30-39; G:24 | None |
| M4 | Edit job: Choose from saving / New item; saved projects list | XF:51-55; G:57, 61 | Not selectable (A6:410 `['edit', false]`) |
| M5 | Single item job with Hero / Secondary role | XF:57-60; G:65, 69 | Not selectable (A6:410) |
| M6 | Batch (several items, one package each) | G:49, 284 | Not selectable (A6:411). Needs per-item job rows and one run per item |
| M7 | Multi-outcome selection per item (White BK + Lifestyle + Website) | G:131 | One outcome only (A6:514 `outcomes: [b.outcome]` already an array) |
| M8 | Existing room as a first-class input (room reference retained, only selected pieces replaced, consistent view) | G:36, 148, 277 | Not offered |
| M9 | Item inventory and exclusions as structured fields: item count, set relationships, include/exclude (twelve chairs, five seats, exclude table) | G:170; cases 01-03 | Free-text `locks`/`must_not` lines only (A6:521) |
| M10 | Product facts input: SKU, dimensions, colour, fabric/material, with "not confirmed" kept as unknown | G:170, 174 | Colour, material, hero only; no SKU or dimensions |
| M11 | Variations outcome with a parent result and chosen variables (lighting, style, camera view) | G:115, 291 | No Variations at all (not even in A6:412 outcome list) |
| M12 | Pick Midas SKUs (catalogue picker with search, "Add reference", "Use N selections", source link) | XF:145-345; G:166 | Boolean "Midas supporting pieces" (A6:188, 517) |
| M13 | Hold the whole page to wording rules for new options (no internal names, "Generated image", "Approved" only from owner record) | project instructions | Already met in A6; must be kept as options are added |

### Should
| # | Gap | Source |
|---|---|---|
| S1 | New Composition outcome | G:111 (A6 later tab) |
| S2 | Create with this item (design anchor) | G:119 |
| S3 | Others (free-text outcome as explicit instruction) | G:123 |
| S4 | Include description and meta: Yes/No | G:174 |
| S5 | Use previous generation (space, look) with a retain choice (room, composition, visual direction) | G:178 |
| S6 | Custom prompting free text | G:186 |
| S7 | Fidelity / Styling / Cluttering sliders 0-100 as steering only | G:194 |
| S8 | Share description first / Proceed without / Use semantic grounding | G:198-206. Needs a client-facing description checkpoint; A6 only has an owner go |
| S9 | Projects "New styled space" with a room description field | G:40 |
| S10 | Saved project / history list across devices (A6 keeps recents on one device only) | G:44; XA:238-260 |
| S11 | Item role and department carried forward in One by one | G:52 |
| S12 | Cost or usage visibility if wanted | AH:34, 266 (A6 shows "{used} of {limit} images used this month" A6:108) |
| S13 | Dining Rooms / Living Rooms etc. category choices for room-type items | G:233, 242 (names not in the 29-entry department list; check taxonomy) |
| S14 | Departments list: ensure website sections stay out of the product choice | G:78; A6:456 |

### Later
| # | Gap | Source |
|---|---|---|
| L1 | Chat box with chips (Accessories, Spaces, Views, White background, Lighting, Variations) | AH:319-329 (not in the target first page) |
| L2 | Per-version cost confirm and separate review quote | AH:36, 70 |
| L3 | Client-visible case history with originals, previous versions, conversations | XA:238-260 |
| L4 | Evidence download / receipt for clients | AH:114 (A6 has no receipt) |
| L5 | Item 13 "Steering and..." once defined | G:190 |
| L6 | Arabic / RTL for all new copy (project rule; native review first) | project instructions |
| L7 | Pricing, delivery time, retention: do not add (project rule) | n/a |

### Top-level mismatches to flag
- A6 STRINGS and OPT disagree on later options: A6:75 lists "Edit, Single item, Batch, New Composition and Create with this item"; A6:120 lists "New Composition", "Create with this item", "Edit a result"; A6:412 lists New Composition, Create with this item, Others. The target has Variations and Others as outcomes.
- A6 default `plants: true` (A6:431); the target gives no default.
- A6 hard-codes `jobMode` and `workOn` regardless of the form (A6:512-513). The submit code never reads a job UI because none exists.
- A6 sends one file in FormData field `files` and the JSON in `payload` (A6:553-557); multi-file needs the same field repeated plus a per-file role map.

---

## 9. Payload fields the target page implies (inference unless noted)

Existing A6 payload (A6:507-527, verified): `job`, `jobMode`, `workOn`, `scope{outcome, outcomes[], view, aspect, resolution, imageCount}`, `item{department, category, subCategory, referenceType}`, `preferences{lighting, wallPaint, floor, useWorkflowDefaults}`, `styling{plants, human, mood, catalogue}`, `metadata{product_category, color, material, scene, light, camera, hero, locks[], must_not[], delivery{image_size, aspect, resolution}}`, `references[{name, role}]`, `approval: 'ask'`, `clientRunId`. Files: FormData `payload` (JSON string) + `files`.

Fields the target implies the backend must accept (names are proposals, marked inference):

| Field | Type | Allowed values / rule | Source |
|---|---|---|---|
| `entry` (inference) | string | `projects` \| `manual` | G:24, 28 |
| `start` (inference, Projects only) | string | `product_or_collection` \| `existing_room` \| `new_styled_space` \| `saved_project` | XF:30-39 |
| `jobMode` (exists) | string | `new_project` \| `edit` \| `single_item` | F:22-24 |
| `workOn` (exists) | string | `batch` \| `one_by_one` (only when jobMode is new_project; "same department" for one_by_one) | F:25-27 |
| `editSource` (inference) | string | `saved_project` \| `new_item` (Edit only) | XF:52-54 |
| `savedProjectId` (inference) | string | id of an earlier project; none exist yet ("No saved projects yet") | XF:55; G:57 |
| `itemRole` (inference) | string | `hero` \| `secondary` (Single item only) | XF:58-60 |
| `projectId` / `batch[]` (inference) | string / array of items | one entry per item or set; each with its own references, category, outcomes | G:49, 284 |
| `item.department` / `category` / `subCategory` (exists) | string | from taxonomy snapshot, or empty = "Automatic from references" | XF:68-127; A6:509-515 |
| `references[]` (extend) | array of `{name, role, fileIndex or url}` | role in: `Product / vendor reference`, `Room / target space`, `Inspiration / look`, `Previous result`, `Other views / pieces`, `Specifications / Excel` | XF:130-136 |
| files | binary | JPG, PNG, WebP, PDF, XLS, XLSX, CSV; up to 25 MB each; file-count limit unknown | XF:139 |
| `references[].source` (inference) | string | `upload` \| `midas_catalogue` | XF:128-129 |
| `midasSelections[]` (inference) | array of `{sku, name, sourceUrl}` | from the 46-card library (de-duplicate SKU 174781); `View Midas source` link per card | XF:145-345 |
| `scope.outcomes` (exists as array) | array of string | `White BK`, `Lifestyle`, `Website`, `New Composition`, `Variations`, `Create with this item`, `Others` | G:99-123 |
| `scope.othersText` (inference) | string | required when `Others` chosen: "an explicit brief instruction" | G:123 |
| `scope.view` / `aspect` / `resolution` / `imageCount` (exist) | string / string / string / int | A6 values: view Category template, Wide view, Close-up, Wide view + close-up; aspect Standard for category, Square 1:1, Portrait 4:5, Landscape 16:9; resolution Standard, 2K, 4K; count 1-4. Target says only "wider view or close-up, image proportions or resolution, number of variations" (G:127) | A6:413-415 |
| `variations` (inference) | object `{parentId, vary: ['lighting','style','camera view'], count}` | parent must be a prior result; "Choose which variables change"; gated by approved parent (AH:315) | G:115, 291 |
| `preferences.lighting` | string | `Soft daylight` \| `Golden afternoon` \| `Warm evening` \| '' | G:136 |
| `preferences.wallPaint` | string | `White`, `Ivory`, `Sand`, `Greige`, `Taupe`, `Sage`, `Charcoal`, `Terracotta` \| '' (ignored for White BK only) | G:140 |
| `preferences.floor` | string | `Light oak`, `Dark walnut`, `Limestone`, `Marble` \| '' | G:144 |
| `preferences.useWorkflowDefaults` | bool | "Use workflow defaults" | F:71 |
| `styling.plants`, `styling.human` | bool | defaults not stated | G:153, 157 |
| `styling.mood` | string | `Automatic`, `Calm & natural`, `Warm & inviting`, `Refined & elegant`, `Bold & expressive` | G:161 |
| `specificItems` / combo (inference) | array | SKUs, links or product selections; lead = furniture or accessory | G:166 |
| `product.sku` (inference) | string | identifies a product | G:170 |
| `product.dimensions` (inference) | string or `{w,d,h,unit}` | "guide plausible scale when provided"; unknown stays "not confirmed" | G:170 |
| `product.colour`, `product.material` | string | "supplier facts or clearly labelled observations" (exists as `metadata.color`/`material`) | G:170 |
| `product.itemCount`, `product.relationships` (inference) | int / string | protects "twelve chairs, five seats, excluding a photographed table"; A6 only has locks[] / must_not[] | G:170 |
| `includeDescription` (inference) | bool | Yes/No: "Yes adds a product description and useful metadata" | G:174 |
| `previousGeneration` (inference) | object `{resultId, retain: 'room'\|'composition'\|'visual direction'}` | "does not replace the original product reference" | G:178 |
| `otherPieces[]` (inference) | array `{file, role, relationship}` | "Do not count a reverse view or a detail inset as a new saleable item." | G:182 |
| `customPrompt` (inference) | string | concise instruction; length limit unknown (A6 uses 1200 for locks, 120 for single-line fields: A6 index.html:266-270) | G:186 |
| `steering.fidelity`, `steering.styling`, `steering.cluttering` (inference) | int 0-100 | "steering strength out of 100, not measured fidelity" | G:194 |
| `review.descriptionFirst` (inference) | string | `share_first` \| `proceed_without` | G:198, 202 |
| `review.semanticGrounding` (inference) | bool | | G:206 |
| `roomDescription` (inference) | string | for New styled space | G:40 |
| `approval` (exists) | string | `ask` (A6 always) | A6:525 |
| `clientRunId` (exists) | string | one id per request | A6:526 |

Arafat chat message (if a chat is ever added): `message` text (<= unknown), up to 5 images, 10 MiB each (AH:329), plus `confirmGeneration` per version, separate `criticQuoteConfirm`. All inference.

---

Pointers for the next step:
- Open question to resolve before building: confirm with the owner whether Projects mode hides steps 03-05 (inference only).
- Step 03/04/05 live behaviour (defaults, validation) is not captured; re-capture the page with clicks on the seven tiles if exact defaults matter.
