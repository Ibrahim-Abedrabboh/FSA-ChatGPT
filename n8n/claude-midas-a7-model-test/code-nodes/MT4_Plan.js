// Model test · Plan: one call per confirmed test case and model, with the same white-master prompt as stage 04. Code only (15 Oct 2026).
// The inventory comes from the owner's answer sheet. The photo reading comes from the latest first-reader answer in the reader test table.
// The prompt lines are copied unchanged from "13 Compile" (stage 04). Nothing is sent from here.
// 15 Oct 2026, 23:30: the framing line added to the white-master prompt, as in "13 Compile" (owner: about 12% margin, about 76% span).
// 15 Oct 2026, 21:20: owner answers applied to the reading before the prompt is built (the prompt function is unchanged):
//   prompt_edits per folder (drop the reader's relation lines; drop words from the colour line),
//   (replaced 16 Oct 2026, 01:40, see below) a context entry that names a piece of the confirmed inventory is not told to be left out,
//   no_reading_ok lets a listed folder run from the sheet alone, expected_counts skips a case whose sheet count differs from the owner's answer.
// 16 Oct 2026, 01:40 (owner answer "Align to hold and ask"): the same HOLD AND ASK rule as A7 "13 Compile" (16 Oct, 00:50). When the
//   inventory lists something the first reader marked as room context (and the reader's product pieces do not already cover it),
//   A7 makes nothing and asks the owner, so this test does not plan a call for that case either. Every room-context entry is now told
//   to be left out of the white master, as in A7. The head-word matching (a7Head, SYN) is copied unchanged from "13 Compile".
const crypto = require('crypto');
const cfg = $('MT1 Config').first().json;
const nl = String.fromCharCode(10);
const arr = x => (Array.isArray(x) ? x : []);
const dot = v => { const t = String(v || '').trim(); if (!t) return ''; return /[.!?]$/.test(t) ? t : t + '.'; };
const uniq = a => a.filter((x, i) => x && a.findIndex(y => String(y).toLowerCase() === String(x).toLowerCase()) === i);
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const str = x => (typeof x === 'string' ? x : (x && (x.label || x.name || x.text || x.what)) ? String(x.label || x.name || x.text || x.what) : JSON.stringify(x));
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const WHITE_PLAN = { light: 'Soft, even, neutral professional studio light that shows the real colour of the product.', camera: 'The camera angle and perspective of the vendor photo. The product is not turned to show sides the vendor photo does not show. The whole product in frame with white space on every side.', presentation: 'The complete product as arranged in the vendor photo; every piece the vendor photo shows stays countable.' };
const RATIO_NAMES = { '1:1': 'square, 1:1', '4:5': 'portrait, 4:5, taller than wide', '5:4': 'landscape, 5:4, wider than tall', '16:9': 'landscape, 16:9, wider than tall', '9:16': 'portrait, 9:16, taller than wide', '3:2': 'landscape, 3:2, wider than tall', '2:3': 'portrait, 2:3, taller than wide', '4:3': 'landscape, 4:3, wider than tall', '3:4': 'portrait, 3:4, taller than wide' };
function ratioOf(frame) { const m = String(frame || '').match(/(\d+)\s*:\s*(\d+)/); return m ? m[1] + ':' + m[2] : '1:1'; }

function buildPrompt(s, inv, total, frame) {
  const list = [{ key: 'vendor' }];
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
  L.push('Framing: the product is centred with a white margin of about 12% of the frame on every side, so its widest or tallest extent fills about 76% of the frame. Never crop the product to fill the frame.');
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
  return whitePrompt({ locks: [] }, { frame }, list, null);
}

// Owner-answer helpers (21:20; the context matching was replaced on 16 Oct 2026 by the A7 hold-and-ask check below).
const sing = w => { const t = String(w || '').toLowerCase(); if (/(ches|shes|xes)$/.test(t)) return t.slice(0, -2); if (/[^s]s$/.test(t)) return t.slice(0, -1); return t; };
const SYN = { 'bedside table': 'nightstand', 'night stand': 'nightstand', 'side table': 'table', lamp: 'light', chandelier: 'light', pendant: 'light', sconce: 'light', lantern: 'light' };
function a7Head(v) {
  const x = String(v || '').toLowerCase().split(':')[0].split(/\s+(?:on|in|at|with|featuring|placed|under|beside|near|of|for|from)\s+/)[0].replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = x.split(' ').filter(Boolean).map(sing);
  const y = words.join(' ');
  for (const k of Object.keys(SYN)) if (y === k || y.endsWith(' ' + k)) return SYN[k];
  const h = words.length ? words[words.length - 1] : '';
  return SYN[h] || h;
}
function contextHold(inv, pieces) {
  const invCount = {}, prodCount = {}, ctxCount = {};
  for (const x of inv) { const h = a7Head(x.item); if (h) invCount[h] = (invCount[h] || 0) + (Number(x.count) || 0); }
  for (const p of pieces) { const h = a7Head(p.kind || p.label); const r = String(p.role || 'product').toLowerCase(); if (r === 'product') prodCount[h] = (prodCount[h] || 0) + 1; else if (r === 'context') ctxCount[h] = (ctxCount[h] || 0) + 1; }
  for (const h of Object.keys(invCount)) { const missing = Math.max(0, invCount[h] - (prodCount[h] || 0)); const c = ctxCount[h] || 0; if (missing && c) return 'the sheet lists ' + invCount[h] + ' x ' + h + ', but the first reader marked ' + c + ' such thing' + (c === 1 ? '' : 's') + ' as room context; A7 holds and asks the owner here (rule of 16 Oct 2026), so no call is planned'; }
  return '';
}
function dropColour(text, drop) { const d = arr(drop).map(x => String(x).toLowerCase()); if (!d.length || !text) return text; const parts = String(text).split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean); const kept = parts.filter(x => !d.some(k => x.toLowerCase().indexOf(k) !== -1)); if (!kept.length) return ''; return kept.length === 1 ? kept[0] : kept.slice(0, -1).join(', ') + ' and ' + kept[kept.length - 1]; }

const problems = [];
// The model registry: a failed read stops every call.
const regItems = $('MT2 Load registry').all().map(i => i.json);
const regOk = regItems.length > 0 && regItems.every(r => r && !r.error && r.model_id);
if (!regOk) problems.push('The model registry could not be read, so no call is planned.');
const registry = regOk ? regItems : [];
// The owner's answer sheet.
const sheet = $('Read answer sheet').first().json;
if (sheet.sheet_problem) problems.push(sheet.sheet_problem);
const rowOf = f => arr(sheet.sheet_rows).find(r => String(r.folder || '').trim() === f) || null;
const col = (r, start) => { const k = Object.keys(r || {}).find(h => h.indexOf(start) === 0); return k ? String(r[k] || '').trim() : ''; };
// The latest usable first-reader answer for each folder (reader test table).
const readAll = $('MT3 Load reader readings').all().map(i => i.json);
const readOk = readAll.length > 0 && readAll.every(r => r && !r.error && !r.model_id && (Object.keys(r).length === 0 || r.folder));
if (!readOk) problems.push('The reader test table could not be read, so no photo reading is known. No call is planned.');
const readItems = readOk ? readAll.filter(r => r && r.folder) : [];
function parseEye(t) { const s1 = String(t || ''); const a = s1.indexOf('{'), b = s1.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(s1.slice(a, b + 1)); } catch (e) { return null; } }
function readingOf(f) {
  const rows = readItems.filter(r => String(r.folder).trim() === f).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  for (const r of rows) { const eye = parseEye(r.eye_raw); if (eye) return { row: r, eye }; }
  return null;
}
function inventoryFrom(text, n) {
  const parts = String(text || '').split(/\s*;\s*|\s+\+\s+/).map(x => x.trim()).filter(Boolean);
  const items = parts.map(p => { const m = p.match(/^(\d+)\s+(.+)$/); const item = (m ? m[2] : p).replace(/\s*\([^)]*\)/g, '').trim(); return { count: m ? Number(m[1]) : 1, item }; });
  const sum = items.reduce((t, x) => t + x.count, 0);
  if (items.length && sum === n && items.every(x => x.item)) return { inv: items, how: 'piece by piece from the sheet' };
  return { inv: [{ count: n, item: 'product pieces, as the owner lists them: ' + String(text || '').trim() }], how: 'one line: the sheet text does not add up to ' + n + ' piece by piece' };
}
function modelCheck(id) {
  const m = registry.find(r => r.model_id === id);
  const num = k => Number(m && m[k]) || 0;
  const size = String(cfg.image_size || '').toUpperCase();
  const ratio = ratioOf(cfg.frame);
  const notes = [];
  if (!m) return { ok: false, why: id + ' is not in the model registry.' };
  if (!/^[a-z0-9][a-z0-9.\-]*$/.test(String(m.model_id))) return { ok: false, why: 'The registry model id "' + String(m.model_id).slice(0, 60) + '" is not a plain model id.' };
  if (String(m.endpoint || '') !== ENDPOINT) return { ok: false, why: 'The registry row for ' + id + ' names another address; only ' + ENDPOINT + ' is built.' };
  if (['trial', 'approved'].indexOf(String(m.status || '').toLowerCase()) === -1) return { ok: false, why: id + ' has registry status "' + (m.status || 'none') + '"; only trial or approved models are tested.' };
  const sizes = String(m.sizes || '').split('|').map(x => x.trim().toUpperCase()).filter(Boolean);
  if (sizes.indexOf(size) === -1) return { ok: false, why: id + ' does not list the size ' + size + '.' };
  const ratios = String(m.ratios || '').split('|').map(x => x.trim()).filter(Boolean);
  if (ratios.length && ratios.indexOf(ratio) === -1) return { ok: false, why: id + ' does not list the frame ' + ratio + '.' };
  if (!ratios.length) notes.push('the registry does not list frames for ' + id + '; this test checks ' + ratio);
  if (num('max_refs') < 1) notes.push('the registry does not confirm that ' + id + ' takes a reference photo; this test checks it');
  if (!(num('input_usd_per_m') > 0 && num('text_out_usd_per_m') > 0 && num('image_out_usd_per_m') > 0 && num('input_image_tokens') > 0 && num('image_tokens_' + size.toLowerCase()) > 0 && m.price_date))
    return { ok: false, why: 'The registry row for ' + id + ' has no complete, dated price for ' + size + ', so no cost can be reserved.' };
  return { ok: true, m, num, size, ratio, notes };
}
const token = String(cfg.go_token || '').trim();
const models = arr(cfg.models).map(String);
const checks = Object.fromEntries(models.map(id => [id, modelCheck(id)]));
const pairs = $input.all().map(i => i.json).filter(p => p && !p.none);
if (!pairs.length) problems.push(($input.first() && $input.first().json.problem) || 'No test folder was found.');
const skip = cfg.skip_folders || {};
const expected = cfg.expected_counts || {};
const cases = [], orders = [];
for (const p of pairs) {
  const c = { folder: p.folder, status: 'skipped', reason: '', notes: [] };
  cases.push(c);
  if (skip[p.folder]) { c.reason = 'on the skip list: ' + skip[p.folder]; continue; }
  if (!p.file_id) { c.reason = p.problem || 'no photo in the folder'; continue; }
  const r = rowOf(p.folder);
  if (!r) { c.reason = 'the folder is not on the answer sheet'; continue; }
  const answer = col(r, 'answer'), countText = col(r, 'true piece count'), confirmedCol = col(r, 'confirmed by owner').toLowerCase();
  const n = /^\d+$/.test(countText) ? Number(countText) : 0;
  const yes = /^yes\b/i.test(answer) || confirmedCol === 'yes';
  const yesN = answer.match(/^yes\s+(\d+)\b/i);
  if (!n) { c.reason = 'the sheet gives no plain piece count ("' + countText.slice(0, 60) + '")'; continue; }
  if (!yes) { c.reason = 'the owner has not confirmed this case (answer: "' + (answer || 'blank') + '")'; continue; }
  if (yesN && Number(yesN[1]) !== n) { c.reason = 'the owner answered ' + yesN[1] + ' but the count column says ' + n; continue; }
  if (expected[p.folder] !== undefined && Number(expected[p.folder]) !== n) { c.reason = 'the owner answered ' + expected[p.folder] + ' pieces in chat, but the sheet count says ' + n + '; fix the sheet first'; continue; }
  const rd = readingOf(p.folder);
  const eye = rd ? rd.eye : {};
  const okNoReading = cfg.allow_no_reading === true || arr(cfg.no_reading_ok).indexOf(p.folder) !== -1;
  if (rd) {
    const seen = Math.max(Number(rd.row.eye_count) || 0, Number(rd.row.second_count) || 0);
    if (rd.row.cropped === true || eye.cropped === true) { c.reason = 'the reading says the photo is cropped; stage 04 holds such a photo'; continue; }
    // As in A7 "13 Compile": the hold-and-ask check comes before the count check.
    const heldFirst = contextHold(inventoryFrom(col(r, 'pieces that belong'), n).inv, arr(eye.pieces).filter(x => x && typeof x === 'object'));
    if (heldFirst) { c.reason = heldFirst; continue; }
    if (seen && n > seen) { c.reason = 'the photo shows ' + seen + ' pieces and the sheet holds ' + n + '; stage 04 holds this'; continue; }
  } else if (!okNoReading) { c.reason = 'no usable first-reader answer for this photo; stage 04 never sends without one (no_reading_ok in MT1 Config tests it from the sheet alone)'; continue; }
  else c.notes.push('no usable first-reader answer: the prompt uses the sheet only (no colour, details or context from the photo)');
  const iv = inventoryFrom(col(r, 'pieces that belong'), n);
  const piecesText = col(r, 'pieces that belong');
  const sheetSided = piecesText.split(/\s*;\s*|\s+\+\s+/).filter(x => /\b(LEFT|RIGHT)\b/.test(x)).map(x => x.trim());
  const excl = col(r, 'excluded pieces');
  const ed = (cfg.prompt_edits || {})[p.folder] || {};
  const shownRaw = arr(eye.shown_with).map(str);
  const ctxRaw = arr(eye.pieces).filter(x => x && typeof x === 'object');
  const shownKept = shownRaw;
  const ctxKept = ctxRaw;
  const colourRaw = str(eye.colour_observed || '');
  const colour = dropColour(colourRaw, ed.colour_drop);
  if (colour !== colourRaw) c.notes.push('owner edit: colour line without "' + arr(ed.colour_drop).join('", "') + '"');
  if (ed.drop_relations && arr(eye.relations).length) c.notes.push('owner edit: the reader\'s relation lines are left out');
  const s = {
    brief: { product_type: col(r, 'product type').replace(/\s*\([^)]*\)/g, '').trim(), colour: rd ? '' : col(r, 'true colour') },
    observation: {
      category_seen: eye.category || '', colour_observed: colour, material_appearance: str(eye.material_appearance || ''),
      design_locks: arr(eye.design_locks).map(str), shown_with: shownKept,
      pieces_seen: ctxKept, relations: ed.drop_relations ? [] : arr(eye.relations).map(str),
      sided_parts: sheetSided.length ? sheetSided : arr(eye.sided_parts).map(str)
    },
    exclusions: /^(none|no|)$/i.test(excl) ? [] : excl.split(/\s*;\s*/).filter(Boolean).map(x => ({ item: x })),
    unknowns: arr(eye.unknowns).map(str)
  };
  const total = iv.inv.reduce((t, x) => t + x.count, 0);
  const prompt = buildPrompt(s, iv.inv, total, cfg.frame);
  c.status = 'planned';
  c.sheet_count = n;
  c.inventory = iv.inv.map(x => x.count + ' x ' + x.item);
  c.inventory_how = iv.how;
  c.handedness_from = sheetSided.length ? 'the answer sheet' : (arr(eye.sided_parts).length ? 'the first reader' : 'none listed');
  c.reading_source = rd ? 'reader test ' + rd.row.run_id + ', row ' + rd.row.id : 'none';
  c.case_note = col(r, 'what this case tests');
  c.prompt_chars = prompt.length;
  c.prompt_sha256 = sha(prompt);
  for (const id of models) {
    const k = checks[id];
    if (!k.ok) { c.notes.push(id + ' not planned: ' + k.why); continue; }
    const inTok = Math.ceil(prompt.length / 4) + 1 * k.num('input_image_tokens');
    const imgTok = k.num('image_tokens_' + k.size.toLowerCase());
    const thoughtTok = 2000;
    const prices = { input: k.num('input_usd_per_m'), text_out: k.num('text_out_usd_per_m'), image_out: k.num('image_out_usd_per_m') };
    const reserve = Number(((inTok * prices.input + imgTok * prices.image_out + thoughtTok * prices.text_out) / 1e6).toFixed(4));
    orders.push({
      operation_key: 'claude-mt:' + token + ':' + p.folder + ':' + id,
      run_id: cfg.run_id, go_token: token, paid_calls_allowed: cfg.paid_calls_allowed === true,
      folder: p.folder, file_id: p.file_id, file_name: p.file_name, drive_mime: p.mime,
      model: id, model_label: k.m.label || '', registry_status: k.m.status, price_date: k.m.price_date, prices, image_tokens: imgTok,
      reserve_usd: reserve, reserve_basis: 'estimate: about ' + inTok + ' input tokens, ' + imgTok + ' image tokens and a ' + thoughtTok + '-token thinking margin, at registry prices dated ' + k.m.price_date,
      ratio: k.ratio, size: k.size, thinking_level: String(cfg.thinking_level || '').trim().toLowerCase(),
      prompt, prompt_sha256: c.prompt_sha256, case_note: c.case_note, sheet_count: n, reading_source: c.reading_source,
      model_notes: k.notes, max_inline_mb: Number(cfg.max_inline_mb) || 14, max_calls: Number(cfg.max_calls) || 0, max_spend_usd: Number(cfg.max_spend_usd) || 0
    });
  }
}
const byModel = {};
for (const o of orders) { const b = byModel[o.model] || (byModel[o.model] = { calls: 0, reserve_usd: 0 }); b.calls++; b.reserve_usd = Number((b.reserve_usd + o.reserve_usd).toFixed(4)); }
const reserve_usd = Number(orders.reduce((t, o) => t + o.reserve_usd, 0).toFixed(4));
if (regOk) for (const id of models) if (!checks[id].ok) problems.push(checks[id].why);
return [{ json: {
  run_id: cfg.run_id, mode: cfg.paid_calls_allowed === true ? 'paid' : 'preview', go_token_set: Boolean(token),
  caps: { max_calls: Number(cfg.max_calls) || 0, max_spend_usd: Number(cfg.max_spend_usd) || 0 },
  totals: { calls: orders.length, reserve_usd, by_model: byModel, basis: 'estimates from registry prices; not an invoice' },
  cases, orders, problems
} }];
