import html, sys
# Revised 18 Oct 2026 to the full first-page guide (Midas Furniture Studio guide). Every option can be chosen on /owner/.
A,R,F,I='Applied by A7','Recorded · not applied by A7 yet','Always on','Note'
sections=[
 ('Start with Projects or Manual',[
  ('Projects','Start from a product or collection, an existing room, a new styled space, or saved work. These four starting options belong under Projects. The default automated workflow handles the process; input, category and the required result steer it.',A),
  ('Manual','Choose New Project, Edit or Single item, followed by the relevant option beneath it. Continue through The Item, Scope, Preferences and Suggestions. These sections organise your choices; the solution still handles the workflow. Optional controls can be left at their defaults.',A),
  ('Product or collection','Start with one product, several products, or a complete set. Upload vendor images, clean product images, lifestyle photographs, multiple views, or select catalogue references. Several photographs may describe one item; they are not automatically several products. Add another item only for a different product or set: each item is its own job.',A),
  ('Existing room','Supply the room and the products to place, replace or restyle. The room reference defines the space to retain; product references define the items.',A),
  ('New styled space','Start a new room composition from products and a room description. The space is created around the required pieces, with coordinated supporting products. The room description itself is recorded; A7 does not read it yet.',A),
  ('Saved project','Continue saved work, refine selected elements or request variations while retaining the original references and accepted direction.',A)]),
 ('1 · The Job',[
  ('New Project → Batch','Prepare several items together. Keep each item or set separate, group its different reference views, and keep category-specific output packages. A batch is not a single collage or a room made from unrelated products. Each item is saved as its own version in one collection and sent as its own job.',A),
  ('New Project → One by one (same department)','Work on one item or set at a time, with the department carried forward to the next item. Each item can have multiple input references and several required output images.',A),
  ('Edit → Choose from saving','Use a saved project as the starting point. Carry its references and accepted direction forward; describe only the requested change.',A),
  ('Edit → New item','Bring an image or item into an editing task. It may be a product image, a composition or a room. Supply the relevant reference and the change you need. Choosing this option does not force a room-furnishing scenario.',A),
  ('Single item → Hero','Make the supplied item the main subject. A small accessory can be the hero: select appropriate Midas furniture and supporting objects around it, with a readable product view and detail image.',A),
  ('Single item → Secondary','Use the item inside a composition supporting the main furniture or room. Keep it recognisable and correctly placed, without forcing it to become the largest object in the image.',A),
  ('What are you starting with?','Under Projects, choose product/collection, existing room, new styled space or saved project. Manual begins with its own Job choices and accepts the relevant reference types without asking this second starting question.',I)]),
 ('2 · The Item',[
  ('Department → Category → Sub-category','Use the predefined product hierarchy to identify the department, category and sub-category. It covers furniture and other home categories, including accessories, textiles and lighting. The selected item determines relevant treatment and outputs. Here it uses the Midas Kuwait English catalogue snapshot of 29 September 2026.',A),
  ('Automatic from references','Leave an unknown category for the intake process to determine from the supplied image and product information. Recognition and interpretation are part of normal intake for every item.',A),
  ('Item defines the workflow','The category changes what to preserve, how to place the item, what details need review and which images belong in its package. Input content and item role steer that same workflow.',I),
  ('Product images / other views or pieces','Vendor raw images, clean packshots, products photographed in a room, multi-view sheets, and set components can all be references. Assign roles and describe set relationships. Insets, arrows, crosses and colour swatches are evidence to interpret, not extra physical items.',A),
  ('Pieces in the photo','How many of each piece the photo shows, for example 2 dining chair. The studio checks its own count against yours before anything is made, so at least one line is required.',A),
  ('Room / previous result / inspiration','Room images define an existing space. Previous results carry forward an accepted composition or look. Inspiration communicates style. An item can have several reference types at once.',A),
  ('Specification files','Text, PDF or the client’s Excel supplies product facts and instructions. A7 reads text, CSV and JSON files; PDF and Excel are stored and listed as not read yet.',A),
  ('Choose from Midas','Midas products named as references (SKU or link). To place Midas pieces in the scene, list their SKUs under Specific items, which A7 applies.',R)]),
 ('3 · The Scope and the solution',[
  ('White BK','A clean white-background catalogue result. Preserve product shape, pieces, finish and relevant details. Room paint, flooring, plants, people and room styling are set aside for this output.',A),
  ('Lifestyle','Place the product in a complete, believable styled setting. Coordinate scale, contact shadows, lighting and supporting pieces while keeping the product readable.',A),
  ('Website','Prepare the product’s website image set using the relevant category template: the white catalogue image, then hero, wide and close-up views.',A),
  ('New Composition','Create a coordinated arrangement of products in a space. Respect the exact item inventory, relationships, room constraints and any chosen Midas combinations.',A),
  ('Variations','Create related alternatives with controlled changes in lighting, style or camera view. Keep the original product identity and set inventory. Variations start from a saved version A7 already received; the variables to change are sent as an instruction.',A),
  ('Create with this item','Use the selected item as the design anchor. For an accessory, choose furniture that complements it; for a furniture hero, select supporting Midas accessories. Role still determines prominence.',A),
  ('Others','Describe an outcome not covered by the predefined choices. It becomes an explicit brief instruction, sent with at least one other outcome.',A),
  ('View and delivery','Category template by default; a wider view or close-up when needed; nine image proportions; 2K or 4K; five camera views; a three-view or views-by-light series; and the number of variations.',A),
  ('More than one outcome','Combine relevant deliverables for one product, for example white background + lifestyle + website package. Room controls apply only to the outputs that use a room.',A)]),
 ('4 · Preferences',[
  ('Lighting · 3 options','Soft daylight: clear, natural product readability. Golden afternoon: directional warmth and softer mood. Warm evening: a lit interior with controlled contrast.',A),
  ('Wall paint · 8 options','White, Ivory, Sand, Greige, Taupe, Sage, Charcoal and Terracotta steer the room palette. They are visual directions, not paint codes or claims about the product colour.',A),
  ('Floor · 4 options','Light oak, Dark walnut, Limestone and Marble steer the surrounding floor finish. They are not vendor material specifications.',A),
  ('Category and scope relevance','Preferences are optional and appear in Manual. White-background-only work does not need a wall or floor. Existing rooms should retain their actual architecture unless the brief requests a change.',I)]),
 ('5 · Suggestions',[
  ('Plants','Optional greenery supporting the composition, without covering key product features.',R),
  ('Human','Optional lifestyle presence for scale or use context: at most one person, never hiding the product or becoming the main subject.',A),
  ('Mood / Vibes','Automatic, Calm & natural, Warm & inviting, Refined & elegant, or Bold & expressive.',R)]),
 ('Optional continuation · 7–15 (More options)',[
  ('7 · Specific items / Combo','Specify particular Midas items by SKU. The studio places them when confirmed in stock; product links are recorded but not read yet.',A),
  ('8 · Additional input data','SKU identifies a product. Dimensions guide plausible scale when provided. Colour and fabric/material hold supplier facts. Item count and relationships protect cases such as twelve chairs, five seats or excluding a photographed table.',A),
  ('9 · Include description and meta','Yes adds a product description and useful metadata to the package. No is recorded; the package still carries a draft description.',F),
  ('10 · Use previous generation (space, look)','Continue from a saved version A7 already received and say whether to retain its space, its look or both. It does not replace the original product reference.',A),
  ('11 · Other pieces images','Add companion pieces and additional views with the reference type “Other views / pieces”. A reverse view or a detail inset is not a new saleable item.',A),
  ('12 · Custom prompting','Instructions such as “keep the original windows” or “show the two chairs without the table”, plus details to keep and things to exclude. Instructions, notes and details to keep share 1,200 characters.',A),
  ('13 · Steering and…','This heading is unfinished in the source document. No fields are assigned to it; revision instructions belong under Custom prompting.',I),
  ('14 · Fidelity / Styling / Cluttering','Steering strength out of 100, not a measured score. The studio keeps the product exactly as photographed.',R),
  ('15 · Share description first','The studio shares its plan and waits for your plan decision before any image is made; every image then waits for your image decision.',F),
  ('15 · Proceed without','Recorded. The plan checkpoint stays on, and the output review always checks inventory, identity, placement and composition.',R),
  ('15 · Use semantic grounding','Visual recognition remains part of every job; the explicit grounding option is recorded.',R)]),
 ('How the page passes a brief forward',[
  ('1 · Capture','Collect references, category if known, item role, requested outcomes and only the relevant steering.',I),
  ('2 · Prepare','The workflow interprets the references, preserves counts and product facts, and selects appropriate Midas supporting pieces or furniture.',I),
  ('3 · Compose and generate','Produce the category-specific image package, composition or controlled variations requested, preserving the original item and set relationships.',I),
  ('4 · Review and deliver','Check the result against the original references and requested scope, wait for your image decision, and deliver the package with unresolved issues made clear.',I)]),
]
cases=[('A 12-chair dining set','New Project → One by one → Dining Rooms → Lifestyle + Variations','Keep twelve chairs and the table as one set. Create distinct daylight and evening compositions, with selected Midas dining accessories. Deliver the whole-set view and useful details; do not omit chairs to simplify the shot.','Lifestyle (or a views-by-light series) first; once A7 has the accepted result, continue it with Variations and name the Midas accessories by SKU.'),
 ('A five-seat modular corner','New Project → One by one → Living Rooms → New Composition + Website','Several source images describe three modules forming five seats. Keep their arrangement and upholstery, style the room with coordinated Midas tables and accessories, and request wide and close-up views.','Choose both outcomes and list “3 module” with the five seats in the notes.'),
 ('Two chairs, excluding the table','Single item → Hero → Dining Chairs → Lifestyle','The source may contain a table or selection marks. Explicitly include only the two chairs. Place them in a relevant setting, with their form visible, plus a detail view.','Pieces “2 dining chair”, exclude “table”, view Wide view + close-up.'),
 ('An accessory as the starting point','Single item → Hero → Relevant accessory category → Create with this item','A bowl, jewellery box or bookend becomes the main subject. Select suitable Midas furniture around it. A box may need open and closed views; a bookend should be shown performing its actual function.','Hero role with Create with this item; describe the open and closed views in Custom prompting.'),
 ('An accessory supporting a room','Single item → Secondary → Accessories → New Composition','Place the same item on an appropriate supporting surface in a furniture-led composition. Keep it at credible scale, physically supported, and coordinated with the palette.','Secondary role with New Composition.'),
 ('Towels, bedding and textiles','New Project → One by one → Relevant textile category → Website','Read swatches, pattern repeats, alternate views and supplier data as references. Show the product in use and close up. A colour swatch is not another physical item, and exact fibre content needs product data.','Website, with the supplier sheet as a specification file.'),
 ('Restyle an existing room','Edit → New item + room reference → Lifestyle','Supply the room, the new product and a placement instruction. Retain room features requested by the user, replace only the selected pieces, and keep a consistent view for comparison.','Room and product references, with the placement in Custom prompting.'),
 ('A mixed vendor batch','New Project → Batch → Product or collection','Each item or set has its own references, category and package. A towel, a lamp and a dining set remain separate jobs within the batch. Multiple angles of one product stay together.','Add one item per product; each is saved and sent as its own job.'),
 ('Continue an accepted look','Edit → Choose from saving → Previous generation → Variations','Reuse the accepted space and original product references. Vary only the chosen dimensions, such as lighting or camera view.','Choose the sent version, retain its space or look, and pick what the variations change.')]
cls={A:'is-ok',R:'is-warn',F:'is-ok',I:''}
e=html.escape
out=['<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">',
"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'\">",
'<title>Guide · Midas Virtual Studio</title><link rel="stylesheet" href="../styles.css"></head><body class="cf">',
'<header class="cf-header"><a class="cf-logo" href="/owner/">MIDAS<span>VIRTUAL STUDIO</span></a><nav class="cf-header-end"><a class="cf-link" href="/owner/">← Back to studio</a></nav></header>',
'<main id="main" class="cf-guide"><p class="cf-kicker">THE COMPLETE FIRST-PAGE GUIDE</p><h1>Options &amp; workflows</h1><p class="cf-guide-lead">What each choice does, how it steers the result, and what this owner studio can do with it today.</p>',
'<p class="cf-legend"><span class="cf-pill-state is-ok">Applied by A7</span> <span class="cf-pill-state is-warn">Recorded · not applied by A7 yet</span> <span class="cf-pill-state is-ok">Always on</span></p>',
'<p class="cf-guide-lead"><strong>Paid start today:</strong> every choice is saved as a project version with its references. Paid processing starts only for a verified estimate (one product image, White BK alone, square 2K) on a site where paid processing is switched on; every other choice keeps a provisional estimate until it is verified. The A7 owner bridge also forwards one image per job until it is updated.</p>',
'<nav class="cf-toc" aria-label="Sections">'+''.join(f'<a href="#g{i}">{e(t)}</a>' for i,(t,_) in enumerate(sections))+'<a href="#cases">Cases the page covers</a></nav>']
for i,(t,items) in enumerate(sections):
  out.append(f'<section class="cf-guide-section" id="g{i}"><h2>{e(t)}</h2>')
  for (h,txt,st) in items:
    badge='' if st==I else f'<span class="cf-pill-state {cls[st]}">{e(st)}</span>'
    out.append(f'<article class="cf-guide-item"><h3>{e(h)} {badge}</h3><p>{e(txt)}</p></article>')
  out.append('</section>')
out.append('<section class="cf-guide-section" id="cases"><h2>How choices combine</h2><p class="cf-guide-lead">Examples of how the same workflow adapts to different items and references.</p>')
for n,(t,path,txt,today) in enumerate(cases,1):
  out.append(f'<article class="cf-guide-item"><p class="cf-kicker">{n:02d}</p><h3>{e(t)}</h3><p class="cf-path">{e(path)}</p><p>{e(txt)}</p><p class="cf-today"><strong>On this page:</strong> {e(today)}</p></article>')
out.append('</section><p class="cf-foot">Source: the client first-page guide (midas-client-studio, chatgpt.site). What A7 applies reflects its intake code on 18 October 2026.</p></main></body></html>')
open(sys.argv[1],'w').write('\n'.join(out))
