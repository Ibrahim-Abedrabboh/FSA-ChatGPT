// Model test · Plan: one call per confirmed test case and model, with the same white-master prompt as stage 04. Code only (15 Oct 2026).
// The inventory comes from the owner's answer sheet. The photo reading comes from the latest first-reader answer in the reader test table.
// The prompt lines are copied unchanged from "13 Compile" (stage 04). Nothing is sent from here.
const crypto = require('crypto');
const cfg = $('MT1 Config').first().json;
const nl = String.fromCharCode(10);
const arr = x => (Array.isArray(x) ? x : []);
const dot = v => { const t = String(v || '').trim(); if (!t) return ''; return /[.!?]$/.test(t) ? t : t + '.'; };
const uniq = a => a.filter((x, i) => x && a.findIndex(y => String(y).toLowerCase() === String(x).toLowerCase()) === i);
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const str = x => (typeof x === 'string' ? x : (x && (x.label || x.name || x.text || x.what)) ? String(x.label || x.name || x.text || x.what) : JSON.stringify(x));
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
//@@STAGE04_LINES@@

function buildPrompt(s, inv, total, frame) {
  const list = [{ key: 'vendor' }];
//@@WHITEPROMPT@@
  return whitePrompt({ locks: [] }, { frame }, list, null);
}

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
  const rd = readingOf(p.folder);
  const eye = rd ? rd.eye : {};
  if (rd) {
    const seen = Math.max(Number(rd.row.eye_count) || 0, Number(rd.row.second_count) || 0);
    if (rd.row.cropped === true || eye.cropped === true) { c.reason = 'the reading says the photo is cropped; stage 04 holds such a photo'; continue; }
    if (seen && n > seen) { c.reason = 'the photo shows ' + seen + ' pieces and the sheet holds ' + n + '; stage 04 holds this'; continue; }
  } else if (cfg.allow_no_reading !== true) { c.reason = 'no usable first-reader answer for this photo; stage 04 never sends without one (allow_no_reading in MT1 Config tests it from the sheet alone)'; continue; }
  else c.notes.push('no usable first-reader answer: the prompt uses the sheet only (no colour, details or context from the photo)');
  const iv = inventoryFrom(col(r, 'pieces that belong'), n);
  const piecesText = col(r, 'pieces that belong');
  const sheetSided = piecesText.split(/\s*;\s*|\s+\+\s+/).filter(x => /\b(LEFT|RIGHT)\b/.test(x)).map(x => x.trim());
  const excl = col(r, 'excluded pieces');
  const s = {
    brief: { product_type: col(r, 'product type').replace(/\s*\([^)]*\)/g, '').trim() },
    observation: {
      category_seen: eye.category || '', colour_observed: str(eye.colour_observed || ''), material_appearance: str(eye.material_appearance || ''),
      design_locks: arr(eye.design_locks).map(str), shown_with: arr(eye.shown_with).map(str),
      pieces_seen: arr(eye.pieces).filter(x => x && typeof x === 'object'), relations: arr(eye.relations).map(str),
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
