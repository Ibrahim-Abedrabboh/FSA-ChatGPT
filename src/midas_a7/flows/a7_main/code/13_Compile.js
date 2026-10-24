// Step 13 · Compile: one order per output, from the contract and the checked plan. Code only (15 Oct 2026).
// Round 1 makes the white master only. Scene outputs wait for the review of the white master (stage 05), the owner's go 2, and then
// stage 07 Scenes (16 Oct 2026), which sends each scene back here, one paid call at a time (empty room, then placement).
// 16 Oct 2026, 04:16: a later view of one job (hero, wide, detail) is made from the owner-approved image of the widest view, so the
// room, the pieces and the light stay the same; only the camera moves. The view's framing line comes from 19a (longest-side rule).
// 15 Oct 2026, 23:30: white-master framing set by the owner: about 12% white margin on every side, the product spans about 76% of the frame.
// (16 Oct 2026, 04:16: the 76% is measured on the product's longest side, which the white line below already says.)
// Stage 05 (15 Oct 2026): a repair ordered by the review (auto_repair) or by the owner at go 2 comes back here as status repair_ordered.
// Prompt lines for the white master are ported from the "06 Render ticket" node of pipelines 3 and 5, with "furniture" made general.
// 15 Oct review: nothing in the prompt asks the model to draw a part the vendor photo does not show. A cropped photo, or fewer pieces seen than the contract holds, stops here for the owner.
// 16 Oct 2026, prompt check fixes and owner decisions 22-29: white framing on the longest side (S1); a layout line from the reader's boxes
// (C1) and a closing self-check (C2) in the white and placement prompts; repair keep list "Keep unchanged while correcting:" (P5); the
// white master no longer carries category text. Scenes: the empty room names no product or furniture (S2); curtains or blinds are the only
// textiles (S3); the rug guide only with a Midas rug (P1); a camera line per camera view (decision 24; P6 for the Reference view; S5 for a
// detail view); the light preset is fixed, warm light comes from built-in light and a lamp only as a Midas lamp (decision 23); one adult
// only when the brief asks (decision 22); a side view carries the supplied photo of that side (decision 27); series images change one
// thing from the approved image they are made from; category guidance from A7's own profiles table, with F1's qualifier (P2).
const crypto = require('crypto');
const settings = $input.first().json;
const s = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete s.events; delete s.row;
const now = new Date().toISOString();
const nl = String.fromCharCode(10);
const arr = x => (Array.isArray(x) ? x : []);
function sidedText(x) {
  if (typeof x === 'string') return x.trim();
  if (!x || typeof x !== 'object') return '';
  if (typeof x.piece === 'string' && typeof x.side === 'string') return x.piece.trim() + ': ' + x.side.trim();
  return JSON.stringify(x);
}
const dot = v => { const t = String(v || '').trim(); if (!t) return ''; return /[.!?]$/.test(t) ? t : t + '.'; };
const uniq = a => a.filter((x, i) => x && a.findIndex(y => String(y).toLowerCase() === String(x).toLowerCase()) === i);
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const s04 = { started_at: now, settings, orders: [], dispatch: null, go: false, outcome: '', critical: [], notes: [], hold_step: 0 };
// Edit phase 1 (19 Oct 2026): the owner's edit (set per output by 08) is given as its own lines, not as a generic constraint. It changes
// the scene, never the product: image 1 still decides the product, so the "match the reference exactly" rule above stays true.
const EDIT_RE = /^(requested edit|keep unchanged) \(owner\):\s*/i;
function editLine(out) {
  const ls = arr(out && out.locks).map(String);
  const change = (ls.find(l => /^requested edit \(owner\):/i.test(l)) || '').replace(EDIT_RE, '').trim();
  const keep = (ls.find(l => /^keep unchanged \(owner\):/i.test(l)) || '').replace(EDIT_RE, '').trim();
  if (!change && !keep) return '';
  return [change ? 'Owner-requested edit for this image: ' + dot(change) + ' Apply it clearly.' : '', keep ? 'Keep unchanged while making it: ' + dot(keep) : '',
    'The edit changes only what it names. It never changes the product: if it asks for a different design, shape, colour, material or number of pieces, keep the product exactly as in image 1. Everything it does not name stays as ordered here.'].filter(Boolean).join(' ');
}
function stop(why) { s04.go = false; s04.outcome = 'hold'; if (!s04.hold_step) s04.hold_step = 13; s04.critical.push({ what: 'stage04', who: 'owner', why }); }

// Never pay without the owner's recorded go 1 on this run.
const last = s.go1_last || {};
const repairing = s.status === 'repair_ordered' && s.repair_orders && typeof s.repair_orders === 'object' && Object.keys(s.repair_orders).length > 0;
// Stage 07 (16 Oct 2026): a scene comes here once its references are checked (status scene_due), or for a repair the owner ordered at go 2.
const sc = s.scene && typeof s.scene === 'object' ? s.scene : null;
const sceneMode = Boolean(sc && (s.status === 'scene_due' || (repairing && s.repair_orders[sc.output_id])));
if (!((s.status === 'go_1_given' || repairing || (sceneMode && s.status === 'scene_due')) && last.decision === 'go' && last.by === 'owner')) stop('The owner\'s go 1 is not recorded for this run, so nothing is made.');
// White catalogue image on demand (20 Oct 2026): a job that makes none (01 records it) has no white approval to wait for.
const noWhite = Boolean(s.brief && s.brief.white_master === 'not_asked') && !arr(s.outputs).some(o => o.kind === 'white');
if (sceneMode && !(s.approved && s.approved.by === 'owner') && !noWhite) stop('A scene was asked for, but the owner\'s approval of the white master is not recorded, so nothing is made.');
if (!s.contract || !s.contract_stamp) stop('This run has no locked contract, so nothing is made.');
if (s.guidance_required && (!s.contract || !s.contract.guidance || s.contract.guidance.baseline_id !== "a7-guidance-2026-10-17-v1" || s.contract.guidance.sha256 !== "d173694b13343173ba2a50e60c7797d9832af902a4555dc5a21bc6c4564455f9")) stop('This job has no matching reconciled guidance baseline. Reconcile the contract before image generation.');
const inv = arr(s.inventory);
const total = inv.reduce((t, x) => t + (Number(x.count) || 0), 0);
if (!inv.length || !total) stop('The contract has no inventory, so nothing is made.');
const obs0 = s.observation || {};
if (obs0.cropped === true) stop('The vendor photo is cropped: part of the product is outside the frame. A white master that shows the whole product would have to invent that part, so nothing is made. Ask the client for a photo that shows the whole product.');
// 16 Oct 2026, 00:50 (owner go to Claude's plan): the old "Test 8 rule" (a thing the reader marked as room context counted as a
// product piece when the confirmed inventory names it, and was then drawn) is replaced by HOLD AND ASK. Code never decides that
// room context is part of the product: when the inventory names something the reader marked as context, nothing is made and the
// owner says which it is (send the job again with the piece named in the inventory, or with it removed).
const SYN = { 'bedside table': 'nightstand', 'night stand': 'nightstand', 'side table': 'table', lamp: 'light', chandelier: 'light', pendant: 'light', sconce: 'light', lantern: 'light' };
const sing = w => { const x = String(w || '').toLowerCase(); if (/(ches|shes|xes)$/.test(x)) return x.slice(0, -2); if (/[^s]s$/.test(x)) return x.slice(0, -1); return x; };
function headOf(v) {
  const x = String(v || '').toLowerCase().split(':')[0].split(/\s+(?:on|in|at|with|featuring|placed|under|beside|near|of|for|from)\s+/)[0].replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = x.split(' ').filter(Boolean).map(sing);
  const y = words.join(' ');
  for (const k of Object.keys(SYN)) if (y === k || y.endsWith(' ' + k)) return SYN[k];
  const h = words.length ? words[words.length - 1] : '';
  return SYN[h] || h;
}
const invCount = {};
for (const x of inv) { const h = headOf(x.item); if (h) invCount[h] = (invCount[h] || 0) + (Number(x.count) || 0); }
const piecesSeen = arr(obs0.pieces_seen).filter(p => p && typeof p === 'object');
const prodCount = {}, ctxCount = {};
for (const p of piecesSeen) {
  const h = headOf(p.kind || p.label); const r = String(p.role || 'product').toLowerCase();
  if (r === 'product') prodCount[h] = (prodCount[h] || 0) + 1; else if (r === 'context') ctxCount[h] = (ctxCount[h] || 0) + 1;
}
const inventoryContext = []; // stays empty: a context piece is never counted or drawn as a product piece
let contextAsked = false;
for (const h of Object.keys(invCount)) {
  const missing = Math.max(0, invCount[h] - (prodCount[h] || 0));
  const c = ctxCount[h] || 0;
  if (!missing || !c) continue;
  contextAsked = true;
  stop('The inventory lists ' + invCount[h] + ' x ' + h + ', but the photo reader marked ' + c + ' such thing' + (c === 1 ? '' : 's') + ' as room context, not as part of the product. Code does not decide whether room context belongs to the product, so nothing is made. Owner: if it is part of the product, send the job again with it named in the inventory and a note; if it is not, send the job again without it in the inventory.');
}
if (contextAsked) s04.notes.push('Held and asked (owner rule, 16 Oct 2026): the inventory names something the reader marked as room context.');
const seen = Math.max(Number(obs0.count_eye) || 0, Number(obs0.count_second) || 0);
if (!contextAsked && seen && total > seen) stop('The photo shows ' + seen + ' product pieces and the contract holds ' + total + '. Drawing the ' + (total - seen) + ' missing pieces would invent how they look and where they stand, so nothing is made. Ask the client for a photo that shows every piece.');
// C1 (prompt check, 16 Oct 2026): where the pieces stand, from the photo reader's boxes ([ymin, xmin, ymax, xmax] on 0-1000). A model
// reading, so the line says "as image 1 shows". Only when every product piece has a usable box, there are 2 to 16 pieces, and their
// centres are clearly apart from left to right.
function layoutLine() {
  const ps = piecesSeen.filter(p => String(p.role || 'product').toLowerCase() === 'product');
  if (ps.length < 2 || ps.length > 16) return '';
  // Review fix (16 Oct 2026): only when the reader's product pieces are exactly the contract's pieces, and none is an excluded thing.
  if (ps.length !== total) return '';
  const exH = arr(s.exclusions).map(x => headOf(String((x && x.item) || x || ''))).filter(Boolean);
  if (ps.some(p => exH.indexOf(headOf(p.kind || p.label)) !== -1)) return '';
  const xs = [];
  for (const p of ps) {
    const b = Array.isArray(p.box) ? p.box.map(Number) : [];
    if (b.length !== 4 || !b.every(v => Number.isFinite(v) && v >= 0 && v <= 1000) || b[1] >= b[3]) return '';
    xs.push({ name: String(p.label || p.kind || 'piece').replace(/\s+/g, ' ').trim().slice(0, 60), x: (b[1] + b[3]) / 2 });
  }
  xs.sort((a, b) => a.x - b.x);
  // Pieces standing one behind another (centres closer than 1% of the width) give no clear left-to-right order: no line then.
  for (let i = 1; i < xs.length; i++) if (xs[i].x - xs[i - 1].x < 10) return '';
  return 'In image 1, from left to right, the pieces stand in this order: ' + xs.map(x => x.name).join(', ') + ', as image 1 shows. Keep this arrangement.';
}
const LAYOUT = layoutLine();
// The white master's light, camera and presentation are fixed by the studio; a planner's entry for the white master is not used.
const WHITE_PLAN = { light: 'Soft, even, neutral professional studio light that shows the real colour of the product.', camera: 'The camera angle and perspective of the vendor photo. The product is not turned to show sides the vendor photo does not show. The whole product in frame with white space on every side.', presentation: 'The complete product as arranged in the vendor photo; every piece the vendor photo shows stays countable.' };

function sizeOf(v) { const r = String(v || '').toUpperCase(); if (/4K|4096|3840/.test(r)) return '4K'; if (/1K|1024/.test(r)) return '1K'; if (/2K|2048/.test(r)) return '2K'; return ''; }
const size = sizeOf(s.brief && s.brief.resolution) || sizeOf(settings.image_size) || '2K';
const RATIO_NAMES = { '1:1': 'square, 1:1', '4:5': 'portrait, 4:5, taller than wide', '5:4': 'landscape, 5:4, wider than tall', '16:9': 'landscape, 16:9, wider than tall', '9:16': 'portrait, 9:16, taller than wide', '3:2': 'landscape, 3:2, wider than tall', '2:3': 'portrait, 2:3, taller than wide', '4:3': 'landscape, 4:3, wider than tall', '3:4': 'portrait, 3:4, taller than wide' };
function ratioOf(frame) { const m = String(frame || '').match(/(\d+)\s*:\s*(\d+)/); return m ? m[1] + ':' + m[2] : '1:1'; }

const refs = arr(s.references);
const vendor = refs.find(r => r.key === s.product_key && r.image && r.sha256);
if (!vendor) stop('The vendor photo of this run is missing or has no checksum, so nothing is made.');
const otherViews = refs.filter(r => r.role === 'other_view' && r.image && r.sha256 && r.key !== s.product_key).slice(0, 13);
const repairs = repairing ? s.repair_orders : {}; // set by stage 05: { output_id: { attempt, corrections: [], preserve: [] } }

function whitePrompt(o, shot, list, repair) {
  const obs = s.observation || {};
  const brief = s.brief || {};
  const plan = WHITE_PLAN;
  const L = [];
  L.push(list.length === 1 ? 'One image is attached: the vendor photo. It is the only authority for the product.' : list.length + ' images are attached. Image 1 is the vendor photo. It is the only authority for the product.');
  list.forEach((r, i) => { if (i > 0) L.push('Image ' + (i + 1) + ' is another photo of the same product from the vendor. Use it only to understand the product; image 1 decides wherever the two differ.'); });
  L.push('Use the vendor photo as the primary product reference.');
  L.push('This is a background-and-light normalization of the photographed arrangement, not an assembly or redesign task. Do not assemble separate units, close the visible gaps between them, or separate units that image 1 shows connected. Keep their relative positions, orientation, spacing and every visible joining face as photographed, even if these pieces could connect into a sectional.');
  L.push('Create a premium, photorealistic e-commerce catalog image of the exact product shown in the reference. Preserve its original design, silhouette, dimensions, proportions, material, upholstery or wood grain, color, texture, construction details, stitching, seams, handles, hardware, legs, trims, cushions, and all visible features.');
  L.push('Do not redesign, replace, simplify, stylize, or modify the product. The final product must match the reference image exactly.');
  const product = brief.product_type || obs.category_seen || '';
  if (product) L.push('Product: ' + product + '.');
  L.push('Exact inventory to show:');
  for (const x of inv) L.push('- ' + x.count + ' x ' + x.item);
  L.push('Total product pieces: ' + total + '. No more and no fewer.');
  if (obs.colour_observed) L.push('Product colour as read from image 1: ' + obs.colour_observed + '. Image 1 decides the exact shade; keep it.');
  if (brief.colour) L.push('The client calls this colour: ' + brief.colour + '. The vendor photo decides the exact shade.');
  if (obs.material_appearance) L.push('Material appearance as read from image 1: ' + obs.material_appearance + '.');
  if (brief.material) L.push('The client names the material: ' + brief.material + '. The vendor photo decides how it looks.');
  const locks = arr(obs.design_locks).map(String).filter(Boolean);
  if (locks.length) L.push('Identifying details read from image 1; keep each exactly as in the vendor photo, in the same place on the product: ' + locks.join('; ') + '.');
  L.push('Any exposed connector faces, unfinished side panels, brackets and attachment hardware visible in image 1 are identifying product details, not background defects. Do not upholster over, smooth away, conceal, replace or relocate them. Preserve their visible material, colour, shape and location; do not invent hardware on hidden sides. Existing cushions and covers kept on the product retain their photographed patterns and positions.');
  const shown = uniq(arr(obs.shown_with).map(String).concat(arr(obs.pieces_seen).filter(p => p && p.role === 'context').map(p => String(p.label || p.kind || '')))).filter(x => inventoryContext.indexOf(headOf(x)) === -1);
  if (shown.length) L.push('In the vendor photo the product is shown with: ' + shown.join('; ') + '. None of these things is a product piece. This photograph shows the product alone: leave each of them out, unless leaving it out would expose a part of the product that the vendor photo does not show; then keep it exactly as photographed; do not simplify its pattern, colour or construction. Something that rests on the product and covers part of it, such as a mattress and bedding on a bed, stays. Never draw a part of the product that the vendor photo does not show.');
  L.push('Where the presentation hides part of the product, leave it hidden. Do not invent details that the vendor photo does not show, and never remove something to reveal a part of the product that the vendor photo does not show.');
  const sided = arr(obs.sided_parts).map(sidedText).filter(Boolean);
  if (sided.length) L.push('Handedness, fixed. These parts sit on one side of the product, given as seen by a person standing in front of it: ' + sided.join('; ') + '. Never mirror the product and never swap its ends.');
  else L.push('Never mirror the product.');
  const rel = arr(obs.relations).map(String).filter(Boolean);
  if (rel.length) L.push('Reader relationship notes (may describe function rather than the photographed assembly): ' + rel.join('; ') + '. These notes do not authorize joining pieces. Preserve only the connections actually visible in image 1; the photographed gaps and exposed joining faces take precedence over inferred compatibility.');
  if (LAYOUT) L.push(LAYOUT);
  const unk = arr(s.unknowns).map(u => String((u && u.what) || u || '')).filter(Boolean);
  if (unk.length) L.push('Not confirmed from the photos or the brief: ' + unk.join('; ') + '. Do not invent these. Where the vendor photo hides them, keep them hidden.');
  const extra = arr(o.locks).map(String).filter(l => !/^(product identity|piece count|shape, pattern|sided part:|must not appear:|pure white background)/i.test(l) && !EDIT_RE.test(l) && locks.indexOf(l) === -1);
  if (extra.length) L.push('Also fixed for this image: ' + extra.join('; ') + '.');
  if (editLine(o)) L.push(editLine(o));
  const excl = arr(s.exclusions).map(x => String((x && x.item) || x || '')).filter(Boolean);
  const base = ['the vendor sheet layout', 'inset views', 'colour swatches', 'printed labels', 'text', 'logos', 'watermarks', 'collage panels', 'extra copies of any product piece', 'people', 'props', 'other objects', 'harsh shadows', 'dramatic reflections'];
  L.push('Do not show: ' + excl.concat(base).join('; ') + '.');
  L.push('Place the product alone, whole in the frame as the vendor photo shows it, centered, on a pure white seamless studio background (#FFFFFF). Use a clean white floor with a natural, subtle contact shadow directly beneath the product. Use soft, even professional studio lighting that accurately shows the real color, material, texture, and details of the product.');
  L.push('No props, no other objects, no room, no floor line, no horizon and no text. The white is the same pure white at every edge of the frame, with no grey tone and no gradient; the only tone on it is the subtle contact shadow directly beneath the product.');
  L.push('This is the catalogue master.');
  const ratio = ratioOf(shot.frame);
  L.push('Frame: ' + (RATIO_NAMES[ratio] || shot.frame || ratio) + '. The plain white background fills the whole frame from edge to edge: no borders, bars, frames or split panels.');
  // S1 (prompt check, 16 Oct 2026): the 76% and the 12% are measured on the product's longest side only, as the review measures them.
  const fw = settings.framing || {};
  L.push('Framing: the product is centred. Its longest side spans about ' + (Number(fw.white_span_pct) || 76) + '% of the frame side in the same direction (the width for a wide product, the height for a tall one), with about ' + (Number(fw.white_margin_pct) || 12) + '% white margin at each end of that side. Never crop the product to fill the frame.');
  if (plan.light) L.push('Light: ' + dot(plan.light));
  if (plan.camera) L.push('Camera: ' + dot(plan.camera));
  if (plan.presentation) L.push('Presentation of the product: ' + dot(plan.presentation));
  L.push('Realistic scale and perspective. The product stands upright and level on the white floor, grounded by the subtle contact shadow directly beneath it. It never floats.');
  L.push('High-end product photography, premium retail catalog style, sharp focus, realistic materials, accurate proportions, clean edges, balanced exposure, high resolution, e-commerce ready, no background distractions.');
  L.push('Negative prompt:');
  L.push('Do not change the product design, shape, size, proportions, color, fabric, wood finish, texture, stitching, seams, cushions, handles, hardware, trims, feet, legs, or any original detail.');
  L.push('Apart from the product itself and what the lines above keep on it: no people, hands, pets, mannequins, models, rooms, walls, windows, curtains, plants, artwork, mirrors, lamps, rugs, tables, accessories, decor, props, packaging, price tags, labels, text, logos, watermarks, brand marks, or borders.');
  L.push('No additional product pieces. No duplicate pieces. No missing parts that the vendor photo shows. No extra cushions. No altered upholstery. No distorted geometry. No warped lines. No floating product. No cropped legs or cropped product. No incorrect shadows. No harsh shadows. No dramatic reflections. No colored background. No grey background. No gradients. No lifestyle scene.');
  L.push('No illustration, CGI look, cartoon style, sketch, painting, low resolution, blur, noise, over-sharpening, oversaturation, unrealistic fabric, plastic-looking wood, incorrect grain, inaccurate material texture, fisheye lens, wide-angle distortion, extreme perspective, or unnatural camera angle.');
  if (repair && arr(repair.corrections).length) {
    L.push('Corrections required after the review of a rejected image. The rejected image is not a reference; work again from the attached photo:');
    for (const c of arr(repair.corrections)) L.push('- ' + String(c));
    // P5 (prompt check, 16 Oct 2026): the keep list is not only what the vendor photo shows.
    if (arr(repair.preserve).length) L.push('Keep unchanged while correcting: ' + arr(repair.preserve).map(String).join('; ') + '.');
  }
  // C2 (prompt check, 16 Oct 2026): a closing self-check, as F1's prefinal prompts ended. Its effect is not measured.
  L.push('Before returning the image, check it against image 1: exactly ' + total + ' product piece' + (total === 1 ? '' : 's') + ', each identifying detail in its place, the same connected or separate arrangement and visible gaps, exposed joining panels and hardware still visible, the existing cushion patterns, the handedness, the whole product inside the frame, and pure white at every edge. Correct anything that differs.');
  return L.join(nl);
}

// Stage 07 · scene prompts (16 Oct 2026). The product lines repeat the white master's identity rules; the room, camera, light and
// framing come from the checked plan of go 1 and the presets in 04 Settings; props are only the Midas pieces confirmed in stock today.
function productLines(L, layout, output) {
  const obs = s.observation || {};
  const brief = s.brief || {};
  const product = brief.product_type || obs.category_seen || '';
  if (product) L.push('Product: ' + product + '.');
  L.push('Exact product inventory to show:');
  for (const x of inv) L.push('- ' + x.count + ' x ' + x.item);
  L.push('Total product pieces: ' + total + '. No more and no fewer.');
  if (obs.colour_observed) L.push('Product colour as read from image 1: ' + obs.colour_observed + '. Image 1 decides the exact shade; keep it under the scene light.');
  if (brief.colour) L.push('The client calls this colour: ' + brief.colour + '. The vendor photo decides the exact shade.');
  if (obs.material_appearance) L.push('Material appearance as read from image 1: ' + obs.material_appearance + '.');
  if (brief.material) L.push('The client names the material: ' + brief.material + '. The vendor photo decides how it looks.');
  const locks = arr(obs.design_locks).map(String).filter(Boolean);
  if (locks.length) L.push('Identifying details read from image 1; keep each exactly as in the vendor photo, in the same place on the product: ' + locks.join('; ') + '.');
  const sided = arr(obs.sided_parts).map(sidedText).filter(Boolean);
  if (sided.length) L.push('Handedness, fixed. These parts sit on one side of the product, given as seen by a person standing in front of it: ' + sided.join('; ') + '. Never mirror the product and never swap its ends.');
  else L.push('Never mirror the product.');
  const rel = arr(obs.relations).map(String).filter(Boolean);
  if (rel.length) L.push('Reader relationship notes (may describe function rather than photographed assembly): ' + rel.join('; ') + '. Compatibility is not evidence that separate modules physically connect.');
  L.push('The approved scene plan may reposition the source units, but it does not authorize redesigning them. Preserve each source module, seat, arm, open end, cushion pattern and visible connector detail. Keep source-visible connected versus separate construction unless this output\'s approved constraints explicitly request a proposed visual assembly. For such a request, arrange only the original modules; never invent a wedge-shaped connector, extra arm or joining hardware, or alter a module to force the assembly. A proposed visual arrangement is not verified physical compatibility. Inferred compatibility alone is never permission to join units.');
  const extra = arr(output && output.locks).filter(x => typeof x === 'string').filter(l => !/^(product identity|piece count|shape, pattern|sided part:|must not appear:|camera view:|light preset:|made from the approved image)/i.test(l) && !EDIT_RE.test(l) && locks.indexOf(l) === -1);
  if (extra.length) L.push('Approved constraints for this output: ' + extra.join('; ') + '. These are the output-specific contract constraints; preserve the stated changes and restrictions while keeping every unaffected source detail.');
  if (editLine(output)) L.push(editLine(output));
  // The order is as image 1 shows it, so it is given only when the camera sees the product as image 1 does (review fix, 16 Oct 2026).
  if (LAYOUT && layout) L.push(LAYOUT);
  // P2 (owner decision 26): category guidance from A7's own profiles table, with F1's qualifier; never a fact about this product.
  if (s.profile && s.profile.guide) L.push('Category guidance: ' + dot(s.profile.guide) + ' These are composition guidelines, not evidence of the source inventory. Original images and explicit owner corrections take precedence.');
  const unk = arr(s.unknowns).map(u => String((u && u.what) || u || '')).filter(Boolean);
  if (unk.length) L.push('Not confirmed from the photos or the brief: ' + unk.join('; ') + '. Do not invent these. Where the photos hide them, keep them hidden.');
  const shown = uniq(arr(obs.shown_with).map(String).concat(arr(obs.pieces_seen).filter(p => p && p.role === 'context').map(p => String(p.label || p.kind || ''))));
  if (shown.length) L.push('In image 1 the product is shown with: ' + shown.join('; ') + '. None of these is a product piece, and none is copied into the scene. Something that rests on the product and covers part of it, such as a mattress and bedding on a bed, stays.');
  const excl = arr(s.exclusions).map(x => String((x && x.item) || x || '')).filter(Boolean);
  if (excl.length) L.push('Excluded from the product and never shown: ' + excl.join('; ') + '.');
}
function scenePrompt(o, list, repair) {
  const plan = (sc.shot && sc.shot.plan) || {};
  const pr = sc.presets || {};
  const cam = pr.camera || {};
  const lt = pr.light || {};
  const view = pr.view || 'Reference view';
  const isDetail = Boolean(sc.framing && sc.framing.type === 'detail');
  const shell = (settings.scenes && settings.scenes.room_shell) || 'walls, floor, ceiling, windows, doors and fixed architectural details';
  const builtIn = lt.built_in || (settings.scenes && settings.scenes.built_in_light) || 'the room\'s built-in light: recessed downlights, a cove light or a plain ceiling fixture, shown as part of the architecture, not as a product';
  const pref = (s.brief && s.brief.preferences) || {};
  const rm = plan.room && typeof plan.room === 'object' ? plan.room : {};
  const props = arr(sc.props);
  // Review fix (16 Oct 2026): every confirmed Midas lamp is named, and a lighting product is never forbidden by its own prompt.
  const LIGHT_RE = /\b(lamps?|lights?|lighting|sconces?|chandeliers?|lanterns?|pendants?)\b/i;
  const lamps = props.filter(p => LIGHT_RE.test(String(p.kind || '')));
  const productIsLight = LIGHT_RE.test([s.profile && s.profile.id, s.profile && s.profile.name, s.brief && s.brief.product_type, s.observation && s.observation.category_seen].filter(Boolean).join(' ').replace(/-/g, ' '));
  const clientRoom = Boolean(sc.room && sc.room.source === 'client room photo');
  const rug = props.find(p => /\b(rugs?|carpets?)\b/i.test(String(p.kind || '')));
  const lightName = (lt.label || lt.preset || 'day') + ' preset';
  const L = [];
  let derived = false, changes = [], roomN = 0, sideN = 0;
  if (sc.phase === 'room') {
    // S2 (prompt check, 16 Oct 2026): the empty room names neither the product nor any furniture; only walls, floor, windows, size and a clear zone.
    L.push('No image is attached. Create a photograph of an empty room.');
    L.push('Build only the room shell: ' + shell + '. No furniture, no rugs, no lamps or other light fittings apart from the built-in light, no plants, no art, no mirrors, no textiles except plain sheer curtains or blinds at the windows, no decor, no products, no people, no text.');
    const walls = [pref.wall ? pref.wall + ' (the client\'s choice)' : '', rm.walls || ''].filter(Boolean);
    const floor = [pref.floor ? pref.floor + ' (the client\'s choice)' : '', rm.floor || ''].filter(Boolean);
    if (walls.length) L.push('Walls: ' + walls.join('; ') + '.');
    if (floor.length) L.push('Floor: ' + floor.join('; ') + '.');
    if (rm.windows) L.push('Windows: ' + dot(rm.windows));
    if (plan.room_size) L.push('Room size: ' + dot(plan.room_size));
    L.push('Leave this floor zone clear, empty and fully visible: ' + (rm.zone ? dot(rm.zone) : 'the middle of the floor in front of the camera.') + (sc.scale && sc.scale.product !== 'not confirmed' ? ' It must fit an object of about ' + sc.scale.product + ' with realistic clearance around it.' : ''));
  } else {
    L.push(list.length + ' images are attached. Image 1 is the vendor photo. It is the only authority for the product.');
    // A view made from an approved image of the same job (owner, 16 Oct 2026, 04:16; series, decision 27): one thing changes.
    derived = Boolean(sc.room && sc.room.content === 'approved view');
    changes = derived ? (arr(sc.room.changes).length ? arr(sc.room.changes) : ['camera']) : [];
    const lightOnly = derived && changes.indexOf('light') !== -1 && changes.indexOf('camera') === -1;
    list.forEach((r, i) => {
      if (r.role === 'approved white master') L.push('Image ' + (i + 1) + ' is the owner-approved catalogue master of the same product. Use it to read clean product detail; image 1 decides wherever the two differ.');
      if (r.role === 'room') {
        roomN = i + 1;
        L.push('Image ' + (i + 1) + ' is the room. ' + (sc.room && sc.room.source === 'client room photo' ? 'It is the client\'s own room: keep its walls, floor, windows, existing fixtures and light exactly as photographed.'
          : (derived && sc.room.edit ? 'It is the owner-approved image ' + (sc.room.from_output || '') + ' of the earlier version of this job, with the product and the Midas pieces already in place. This edit starts from it: keep everything in it exactly as it is (the room, its walls, floor, windows and materials, every piece where it stands' + (sc.person ? ', the person' : '') + (changes.indexOf('camera') === -1 ? ', the camera' : '') + (changes.indexOf('light') === -1 ? ', the light and its direction' : '') + ') except what the owner-requested edit below names' + (changes.indexOf('camera') !== -1 ? ' and the camera, as the camera line below says' : '') + (changes.indexOf('light') !== -1 ? ' and the light, as the light line below says' : '') + '. The product in image ' + (i + 1) + ' is a generated picture, not an authority: image 1 decides the product wherever the two differ.'
          : (derived ? 'It is the approved image of ' + (sc.room.from_output || 'the first image') + ' of this same job, approved by the studio owner, with the product and the Midas pieces already in place. This photograph shows that same scene: keep the room, its walls, floor, windows and materials, every piece where it stands' + (sc.person ? ', the person' : '') + (lightOnly ? ' and the camera exactly. Only the light changes, as the light line below says.' : ', and the light and its direction. Only the camera moves, as the camera line below says.') + ' The product in image ' + (i + 1) + ' is a generated picture, not an authority: image 1 decides the product wherever the two differ.'
            : 'Keep the room exactly as it is: its walls, floor, windows, camera and light. Do not redesign or extend it.'))));
      }
      if (r.role === 'side photo') { sideN = i + 1; L.push('Image ' + (i + 1) + ' is another vendor photo of the same product, showing its ' + (r.side || (sc.side && sc.side.side) || '') + ' side. Use it for that side only; image 1 decides everything else, and the two never merge into a new design.'); }
      if (r.role === 'Midas piece') { const p = props.find(x => String(x.sku) === String(r.sku)) || {}; L.push('Image ' + (i + 1) + ' is the Midas catalogue photo of ' + (p.name || 'a Midas piece') + ' (SKU ' + r.sku + '). Show exactly this item, unchanged in shape, colour, material and proportion' + (p.purpose ? '. Its role in the scene: ' + dot(p.purpose).replace(/\.$/, '') : '') + (p.rests_on ? ', resting on ' + p.rests_on : '') + '. Its listed size: ' + ((p.live && p.live.size_on_page) || 'not confirmed') + '.'); }
    });
    if (derived) L.push('Show the exact product from image 1 where it stands in image ' + (roomN || 3) + ', once only: never add a second copy of it.');
    else L.push('Place the exact product from image 1 into the room' + (plan.presentation ? ': ' + dot(plan.presentation) : '.'));
    productLines(L, view === 'Reference view', arr(s.outputs).find(x => x.id === o.output_id));
    if (!sc.side && !isDetail && view !== 'Reference view') L.push('This is the ' + view + ' view. Show only what image 1 shows of the product. A surface that the photos do not show stays out of view or plain; never invent construction (no new panels, legs, cushions, seams, hardware or decoration).');
    if (sc.side) L.push('This is the ' + sc.side.camera + ' view. Show the product\'s ' + sc.side.side + ' side as image ' + (sideN || 4) + ' shows it. A surface that neither photo shows stays out of view or plain; never invent construction (no new panels, legs, cushions, seams, hardware or decoration).');
    L.push('Scale: the product\'s supplied size is ' + (sc.scale ? sc.scale.product : 'not confirmed') + '. ' + (sc.scale && sc.scale.product !== 'not confirmed' ? 'Keep it true to that size against the room and the Midas pieces.' : 'Keep a realistic, plausible scale against the room, doors and the Midas pieces; never enlarge or shrink the product to fill space.'));
    // People (owner, 16 Oct 2026, decision 22): one natural adult only when the brief asks and the plan has one.
    const peopleLine = (settings.scenes && settings.scenes.people_text) || 'At most one natural adult, beside or behind the product, never in front of it or covering any piece, clearly secondary.';
    if (sc.person) L.push(derived ? 'The person in image ' + (roomN || 3) + ' stays as they are. ' + peopleLine : 'One person, as planned: ' + dot(sc.person) + ' ' + peopleLine);
    L.push('Apart from the room ' + (derived && sc.room.edit ? 'of image ' + (roomN || 3) + ' with the requested edit' : 'as it is') + ', the product' + (sc.person ? ', the person' : '') + ' and the Midas pieces listed above, add nothing: no other furniture, rugs, ' + (productIsLight ? 'other lamps or light fittings' : 'lamps or light fittings') + ', plants, books, art, textiles (except plain sheer curtains or blinds at the windows), decor, ' + (sc.person ? 'other people' : 'people') + ', text, logos or watermarks. Where the plan had a piece that is not listed here, that spot stays empty.');
    L.push('The product stands level on the floor or its correct surface, with natural contact shadows; it never floats. Light on the product matches the room light.');
    // Edit phase 2.4: an edit that keeps the camera keeps the approved image's framing; the view's framing band applies only when the camera moves.
    if (derived && sc.room.edit && changes.indexOf('camera') === -1) L.push('Framing: exactly as in image ' + (roomN || 3) + '; the product keeps its size and place in the frame.');
    else L.push(sc.framing ? sc.framing.text : 'Hero view: the product is the clear subject, whole in the frame.');
  }
  // Camera (owner, 16 Oct 2026, decision 24; prompt check P1, P6, S5).
  const fromPlan = plan.camera ? ' From the plan: ' + dot(plan.camera) : '';
  // Camera height (owner, 16 Oct 2026, D9): the preset height is for room-scale furniture; a tabletop accessory or lamp is shot near its
  // mid-height (cam.height_rule, set in 19a: from 21:28 the surface height plus half the product's height, 0 degrees tilt); a detail
  // view has no height line.
  const heightLine = cam.height_rule ? 'Camera: ' + cam.height_rule + '. ' : 'Camera: eye height about ' + (cam.height_cm || '120') + ' cm (' + (cam.family || 'default') + ' room preset). ';
  // Review finding 3 (16 Oct 2026): the empty room is made without images, so its camera line never names "image 1" (cam.room_rule).
  const roomHeightLine = cam.height_rule ? 'Camera: ' + (cam.room_rule || 'level, near the mid-height of the product that will stand there') + '. ' : heightLine;
  if (sc.phase === 'room') L.push((isDetail ? 'Camera: ' : roomHeightLine) + (pr.camera_rules || '') + (pr.raised ? ' ' + pr.raised : ''));
  else if (isDetail) L.push('Camera: a close view of the named detail; level, vertical lines stay vertical; no fisheye or wide-angle distortion.' + fromPlan);
  else {
    const guide = rug && cam.guides_with_rug ? cam.guides_with_rug : (cam.guides || '');
    const keepCam = derived && changes.indexOf('camera') === -1;
    if (keepCam) L.push('Camera: exactly as in image ' + (roomN || 3) + '; the camera does not move.');
    else if (clientRoom && !derived) {
      // A client room photo fixes the camera (review fix, 16 Oct 2026): the product is turned, never the room.
      L.push('Camera: exactly as in image ' + (roomN || 3) + ', the client\'s room photo; the camera does not move. ' + (view === 'Reference view' ? 'The product is seen from the same side and angle as image 1 (the vendor photo).' : 'Turn the product in the room so that this fixed camera sees it as a ' + view + ' view.') + ' Vertical lines stay vertical.');
    } else {
      // Owner, 16 Oct 2026, 21:28: a tabletop product or lamp keeps the camera level (0 degrees tilt); the vendor photo gives the side only.
      const levelSmall = cam.tilt_deg === 0 && cam.height_rule;
      const viewLine = view === 'Reference view' ? (levelSmall ? 'The camera sees the product from the same side as image 1 (the vendor photo), level at 0 degrees tilt even if image 1 was taken from above; vertical lines stay vertical; no fisheye or wide-angle distortion.' : (pr.view_rule || 'The camera sees the product from the same side, angle and perspective as image 1 (the vendor photo); vertical lines stay vertical; no fisheye or wide-angle distortion.')) + ' The room may stand square to the camera while the product stands at the angle image 1 shows.'
        : 'Camera view, ' + view + ': ' + (pr.view_rule || '') + (derived ? '' : ' Turn the product in the room so that the camera sees it this way.');
      const head = derived ? 'Camera: only the camera moves from image ' + (roomN || 3) + '. ' : heightLine.replace(/\. $/, ', as in the room image. ');
      L.push(head + viewLine + (pr.raised ? ' ' + pr.raised : '') + (guide ? ' Framing guide: ' + guide + '.' : '') + fromPlan);
    }
  }
  // Light (owner, 16 Oct 2026, decision 23): the preset of this image is fixed; warm light from built-in light; a lamp only as a Midas lamp.
  // Review fixes (16 Oct 2026): a night image has dark windows, so its only source is the built-in light; every Midas lamp is named; a
  // lighting product is not forbidden by its own light line; a client room photo keeps the light it was photographed in.
  const lampNames = lamps.map(l => 'the Midas ' + l.name + ' (SKU ' + l.sku + ')');
  const lampText = sc.phase === 'room' ? '; no lamps.'
    : (lampNames.length ? '. The only ' + (productIsLight || lampNames.length > 1 ? 'lamps are ' : 'lamp is ') + (productIsLight ? 'the product and ' : '') + lampNames.join(' and ') + ', listed above.'
      : (productIsLight ? '; no lamp or light fitting other than the product itself.' : '; no table lamp, floor lamp or other freestanding or saleable light fitting.'));
  const sources = (lt.preset === 'night' ? 'Light sources: ' + builtIn + '; the windows are dark' : 'Light sources: daylight through the windows and ' + builtIn) + lampText;
  const baseShot = derived ? arr(s.shots).find(x => x.output_id === sc.room.from_output) : null;
  if (clientRoom && sc.phase !== 'room') L.push('Light: as photographed in image ' + (roomN || 3) + ', the client\'s room; light the product to match it, with the same direction and colour. Add no light source' + (lampNames.length ? ' apart from ' + lampNames.join(' and ') + ', listed above' : (productIsLight ? ' apart from the product itself' : '')) + '.');
  else if (derived && sc.room.edit && changes.indexOf('light') === -1) L.push('Light: exactly as in image ' + (roomN || 3) + ': the same light sources, colour and direction. Add no new light source' + (lampNames.length ? ' apart from ' + lampNames.join(' and ') + ', listed above' : (productIsLight ? ' apart from the product itself' : '')) + '.');
  else if (derived && changes.indexOf('light') !== -1) L.push('Light: ' + (sc.room.edit ? 'change the light' : 'change only the light') + ', to about ' + (lt.kelvin || 4000) + ' K colour temperature (' + lightName + ')' + (lt.scene ? ': ' + lt.scene : '') + '. ' + (plan.light ? 'From the plan: ' + dot(plan.light) + ' ' : '') + sources);
  else if (derived) L.push('Light: as in image ' + (roomN || 3) + ', about ' + (lt.kelvin || 4000) + ' K colour temperature (' + lightName + '). ' + (baseShot && baseShot.plan && baseShot.plan.light ? 'As in the approved image: ' + dot(baseShot.plan.light) + ' ' : '') + sources);
  else L.push('Light: about ' + (lt.kelvin || 4000) + ' K colour temperature (' + lightName + ')' + (lt.scene ? ': ' + lt.scene : '') + '. ' + (plan.light && sc.phase !== 'room' ? 'From the plan: ' + dot(plan.light) + ' ' : '') + sources);
  const ratio = ratioOf(o.frame);
  L.push('Frame: ' + (RATIO_NAMES[ratio] || o.frame || ratio) + '. The photograph fills the whole frame: no borders, bars, frames or split panels.');
  L.push('Photorealistic interior photography, premium retail catalogue style, natural materials, accurate proportions, sharp focus, balanced exposure.');
  L.push('No illustration, CGI look, cartoon style, painting, fisheye lens, wide-angle distortion, tilted verticals, extreme perspective, oversaturation, blur or noise.');
  if (repair && arr(repair.corrections).length) {
    L.push('Corrections required after the review of a rejected image. The rejected image is not a reference; work again from the attached images:');
    for (const c of arr(repair.corrections)) L.push('- ' + String(c));
    // P5 (prompt check, 16 Oct 2026): the keep list holds the room and the Midas pieces too, which the vendor photo does not show.
    if (arr(repair.preserve).length) L.push('Keep unchanged while correcting: ' + arr(repair.preserve).map(String).join('; ') + '.');
  }
  if (sc.phase !== 'room') L.push('Before returning the image, check it against image 1: ' + (isDetail ? 'no more than ' + total + ' product pieces, none duplicated or invented' : 'exactly ' + total + ' product piece' + (total === 1 ? '' : 's')) + ', each identifying detail in its place, the handedness, nothing added beyond the room, the product' + (sc.person ? ', the person' : '') + ' and the listed Midas pieces, every piece standing on its surface with a contact shadow, and light that matches the room. Correct anything that differs.');
  return L.join(nl);
}
if (sceneMode) {
  const o = arr(s.outputs).find(x => x.id === sc.output_id) || { id: sc.output_id, kind: sc.kind };
  const repair = repairing ? repairs[sc.output_id] || null : null;
  const attempt = sc.phase === 'room' ? 1 : (repair ? Number(repair.attempt) || 0 : Number(sc.attempt) || 1);
  const list = arr(sc.refs);
  const frame = (sc.shot && sc.shot.frame) || 'square, 1:1';
  const order = { output_id: sc.phase === 'room' ? sc.output_id + '_room' : sc.output_id, kind: o.kind, mode: o.mode || sc.mode || '', attempt, dispatch_now: true, waits_for: '', frame, ratio: ratioOf(frame), size,
    references: list.map(r => ({ n: r.n, role: r.role, key: r.key, name: r.name, mime: r.mime, bytes: r.bytes, sha256: r.sha256, sku: r.sku || '' })),
    corrections: repair ? arr(repair.corrections).map(String) : [], preserve: repair ? arr(repair.preserve).map(String) : [],
    scene: { phase: sc.phase, scene_output_id: sc.output_id, props: arr(sc.props).map(p => p.sku) } };
  if (sc.phase === 'place' && (!list.length || list[0].role !== 'vendor photo')) stop('The placement for ' + sc.output_id + ' has no vendor photo as image 1, so nothing is made.');
  if (sc.phase === 'room' && list.length) stop('The empty room for ' + sc.output_id + ' must be made without images (the product is never in it), so nothing is made.');
  if (attempt < 1 || attempt > 3) stop('Attempt ' + attempt + ' for ' + sc.output_id + ' is outside the rule of at most two repairs per image, so nothing is made.');
  order.prompt = scenePrompt(order, list, repair);
  order.prompt_sha256 = sha(order.prompt);
  s04.orders.push(order);
  for (const x of arr(s.outputs)) if (x.id !== sc.output_id) s04.orders.push({ output_id: x.id, kind: x.kind, mode: x.mode || '', dispatch_now: false, waits_for: x.kind === 'white' ? 'done: approved by the owner' : (s.scenes && s.scenes.done && s.scenes.done[x.id] ? 'done: approved by the owner' : 'its turn in stage 07 (one scene at a time)'), frame: '' });
  if (!s04.critical.length) { s04.dispatch = order; s04.go = true; }
  return [{ json: { ...s, s04 } }];
}
const shotsBy = Object.fromEntries(arr(s.shots).map(x => [x.output_id, x]));
for (const o of arr(s.outputs)) {
  const shot = shotsBy[o.id] || { frame: 'square, 1:1', plan: {} };
  if (o.kind === 'white') {
    const repair = repairs[o.id] || null;
    const attempt = repair ? Number(repair.attempt) || 0 : 1;
    const list = vendor ? [vendor].concat(otherViews) : [];
    const order = { output_id: o.id, kind: o.kind, mode: o.mode || 'fidelity_locked', attempt, dispatch_now: true, waits_for: '', frame: shot.frame || 'square, 1:1', ratio: ratioOf(shot.frame), size,
      references: list.map((r, i) => ({ n: i + 1, role: i === 0 ? 'vendor photo' : 'other view', key: r.key, name: r.name, mime: r.mime, bytes: r.bytes, sha256: r.sha256 })),
      corrections: repair ? arr(repair.corrections).map(String) : [], preserve: repair ? arr(repair.preserve).map(String) : [] };
    if (attempt < 1 || attempt > 3) { order.dispatch_now = false; stop('Attempt ' + attempt + ' for ' + o.id + ' is outside the rule of at most two repairs per image, so nothing is made.'); }
    order.prompt = vendor ? whitePrompt(o, shot, list, repair) : '';
    order.prompt_sha256 = order.prompt ? sha(order.prompt) : '';
    s04.orders.push(order);
  } else {
    const planned = ['vendor photo'].concat(o.mode === 'room_locked' ? ['room photo'] : [], arr(shot.plan && shot.plan.midas_pieces).map(m => 'Midas catalogue photo ' + m.sku), noWhite ? [] : ['passed white master']);
    s04.orders.push({ output_id: o.id, kind: o.kind, mode: o.mode || '', dispatch_now: false,
      waits_for: o.kind === 'variation' ? 'the approved parent image, which earlier runs did not store' : (noWhite ? 'stage 07 Scenes, right after go 1 (no white master in this job)' : 'the owner\'s go 2 on the white master, then stage 07 Scenes'),
      frame: shot.frame || '', planned_references: planned });
  }
}
const now1 = s04.orders.filter(x => x.dispatch_now);
// No white master in this job: nothing is made in this compile. 15q hands the run to stage 07 (status scenes_start), which prepares the
// first scene's empty room and placement through 19a and 19g as for any scene; each paid call comes back here in scene mode.
if (noWhite && !now1.length && !repairing && s.status === 'go_1_given' && !s04.critical.length && !s04.orders.some(x => x.kind === 'variation')) {
  s04.go = false; s04.outcome = 'scenes_first'; s04.dispatch = null;
  s04.notes.push('This job makes no white master; stage 07 makes the first scene next.');
  return [{ json: { ...s, s04 } }];
}
if (!now1.length && !s04.critical.length) stop('This job has no white master to make in round 1' + (s04.orders.some(x => x.kind === 'variation') ? ': variations need the approved parent image, which earlier runs did not store' : '') + '. Nothing is made.');
if (now1.length > 1) { s04.notes.push('More than one white order was ready; round 1 sends only ' + now1[0].output_id + '.'); for (const x of now1.slice(1)) { x.dispatch_now = false; x.waits_for = 'round 1 sends one image only'; } }
if (repairing && now1.length && !repairs[now1[0].output_id]) stop('A repair was ordered for an image this job does not make in this round, so nothing is made.');
if (!s04.critical.length) { s04.dispatch = now1[0]; s04.go = true; }
return [{ json: { ...s, s04 } }];
