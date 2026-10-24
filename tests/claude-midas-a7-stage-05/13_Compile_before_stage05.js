// Step 13 · Compile: one order per output, from the contract and the checked plan. Code only (15 Oct 2026).
// Round 1 makes the white master only. Scene outputs wait for the review of the white master (stage 05, not built) and the owner's go 2.
// Prompt lines for the white master are ported from the "06 Render ticket" node of pipelines 3 and 5, with "furniture" made general.
// 15 Oct review: nothing in the prompt asks the model to draw a part the vendor photo does not show. A cropped photo, or fewer pieces seen than the contract holds, stops here for the owner.
const crypto = require('crypto');
const settings = $input.first().json;
const s = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete s.events; delete s.row;
const now = new Date().toISOString();
const nl = String.fromCharCode(10);
const arr = x => (Array.isArray(x) ? x : []);
const dot = v => { const t = String(v || '').trim(); if (!t) return ''; return /[.!?]$/.test(t) ? t : t + '.'; };
const uniq = a => a.filter((x, i) => x && a.findIndex(y => String(y).toLowerCase() === String(x).toLowerCase()) === i);
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const s04 = { started_at: now, settings, orders: [], dispatch: null, go: false, outcome: '', critical: [], notes: [], hold_step: 0 };
function stop(why) { s04.go = false; s04.outcome = 'hold'; if (!s04.hold_step) s04.hold_step = 13; s04.critical.push({ what: 'stage04', who: 'owner', why }); }

// Never pay without the owner's recorded go 1 on this run.
const last = s.go1_last || {};
if (!(s.status === 'go_1_given' && last.decision === 'go' && last.by === 'owner')) stop('The owner\'s go 1 is not recorded for this run, so nothing is made.');
if (!s.contract || !s.contract_stamp) stop('This run has no locked contract, so nothing is made.');
const inv = arr(s.inventory);
const total = inv.reduce((t, x) => t + (Number(x.count) || 0), 0);
if (!inv.length || !total) stop('The contract has no inventory, so nothing is made.');
const obs0 = s.observation || {};
if (obs0.cropped === true) stop('The vendor photo is cropped: part of the product is outside the frame. A white master that shows the whole product would have to invent that part, so nothing is made. Ask the client for a photo that shows the whole product.');
const seen = Math.max(Number(obs0.count_eye) || 0, Number(obs0.count_second) || 0);
if (seen && total > seen) stop('The photo shows ' + seen + ' product pieces and the contract holds ' + total + '. Drawing the ' + (total - seen) + ' missing pieces would invent how they look and where they stand, so nothing is made. Ask the client for a photo that shows every piece.');
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
const repairs = s.repair_orders || {}; // set by stage 05 (not built): { output_id: { attempt, corrections: [], preserve: [] } }

function whitePrompt(o, shot, list, repair) {
  const obs = s.observation || {};
  const brief = s.brief || {};
  const plan = WHITE_PLAN;
  const L = [];
  L.push(list.length === 1 ? 'One image is attached: the vendor photo. It is the only authority for the product.' : list.length + ' images are attached. Image 1 is the vendor photo. It is the only authority for the product.');
  list.forEach((r, i) => { if (i > 0) L.push('Image ' + (i + 1) + ' is another photo of the same product from the vendor. Use it only to understand the product; image 1 decides wherever the two differ.'); });
  L.push('Use the vendor photo as the primary product reference.');
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
  const shown = uniq(arr(obs.shown_with).map(String).concat(arr(obs.pieces_seen).filter(p => p && p.role === 'context').map(p => String(p.label || p.kind || ''))));
  if (shown.length) L.push('In the vendor photo the product is shown with: ' + shown.join('; ') + '. None of these things is a product piece. This photograph shows the product alone: leave each of them out, unless leaving it out would expose a part of the product that the vendor photo does not show; then keep it, plain and close to the vendor photo. Something that rests on the product and covers part of it, such as a mattress and bedding on a bed, stays. Never draw a part of the product that the vendor photo does not show.');
  L.push('Where the presentation hides part of the product, leave it hidden. Do not invent details that the vendor photo does not show, and never remove something to reveal a part of the product that the vendor photo does not show.');
  const sided = arr(obs.sided_parts).map(String).filter(Boolean);
  if (sided.length) L.push('Handedness, fixed. These parts sit on one side of the product, given as seen by a person standing in front of it: ' + sided.join('; ') + '. Never mirror the product and never swap its ends.');
  else L.push('Never mirror the product.');
  const rel = arr(obs.relations).map(String).filter(Boolean);
  if (rel.length) L.push('Keep how the pieces stand to each other: ' + rel.join('; ') + '.');
  if (s.profile && s.profile.source_rules) L.push('Rules for this kind of product: ' + dot(s.profile.source_rules));
  const unk = arr(s.unknowns).map(u => String((u && u.what) || u || '')).filter(Boolean);
  if (unk.length) L.push('Not confirmed from the photos or the brief: ' + unk.join('; ') + '. Do not invent these. Where the vendor photo hides them, keep them hidden.');
  const extra = arr(o.locks).map(String).filter(l => !/^(product identity|piece count|shape, pattern|sided part:|must not appear:|pure white background)/i.test(l) && locks.indexOf(l) === -1);
  if (extra.length) L.push('Also fixed for this image: ' + extra.join('; ') + '.');
  const excl = arr(s.exclusions).map(x => String((x && x.item) || x || '')).filter(Boolean);
  const base = ['the vendor sheet layout', 'inset views', 'colour swatches', 'printed labels', 'text', 'logos', 'watermarks', 'collage panels', 'extra copies of any product piece', 'people', 'props', 'other objects', 'harsh shadows', 'dramatic reflections'];
  L.push('Do not show: ' + excl.concat(base).join('; ') + '.');
  L.push('Place the product alone, whole in the frame as the vendor photo shows it, centered, on a pure white seamless studio background (#FFFFFF). Use a clean white floor with a natural, subtle contact shadow directly beneath the product. Use soft, even professional studio lighting that accurately shows the real color, material, texture, and details of the product.');
  L.push('No props, no other objects, no room, no floor line, no horizon and no text. The white is the same pure white at every edge of the frame, with no grey tone and no gradient; the only tone on it is the subtle contact shadow directly beneath the product.');
  L.push('This is the catalogue master.');
  const ratio = ratioOf(shot.frame);
  L.push('Frame: ' + (RATIO_NAMES[ratio] || shot.frame || ratio) + '. The plain white background fills the whole frame from edge to edge: no borders, bars, frames or split panels.');
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
    if (arr(repair.preserve).length) L.push('Keep exactly as in the vendor photo, and do not change while correcting: ' + arr(repair.preserve).map(String).join('; ') + '.');
  }
  return L.join(nl);
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
    const planned = ['vendor photo'].concat(o.mode === 'room_locked' ? ['room photo'] : [], arr(shot.plan && shot.plan.midas_pieces).map(m => 'Midas catalogue photo ' + m.sku), ['passed white master']);
    s04.orders.push({ output_id: o.id, kind: o.kind, mode: o.mode || '', dispatch_now: false,
      waits_for: o.kind === 'variation' ? 'the approved parent image, which earlier runs did not store' : 'the review of the white master (stage 05, not built) and the owner\'s go 2',
      frame: shot.frame || '', planned_references: planned });
  }
}
const now1 = s04.orders.filter(x => x.dispatch_now);
if (!now1.length && !s04.critical.length) stop('This job has no white master to make in round 1' + (s04.orders.some(x => x.kind === 'variation') ? ': variations need the approved parent image, which earlier runs did not store' : '') + '. Nothing is made.');
if (now1.length > 1) { s04.notes.push('More than one white order was ready; round 1 sends only ' + now1[0].output_id + '.'); for (const x of now1.slice(1)) { x.dispatch_now = false; x.waits_for = 'round 1 sends one image only'; } }
if (!s04.critical.length) { s04.dispatch = now1[0]; s04.go = true; }
return [{ json: { ...s, s04 } }];
