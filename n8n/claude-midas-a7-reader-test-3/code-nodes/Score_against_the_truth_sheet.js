// Claude · Midas A7 reader test 3 · Score. Code only (16 Oct 2026).
// Owner, 16 Oct 2026, 21:07: change only the prompt. Same Test 1-10 photos, same answer sheet, same model (gpt-6.1-sol) and same
// settings as reader test 2 (execution 459), so the two compare directly. The new D13 fields are scored too: pieces photographed apart
// counted once each, modules counted per joint (cushions are not pieces), and "cropped" and "hidden" reported apart.
// Nothing is written anywhere: the result stays in this execution.
const TRUTH = {
  'Test 1': { total: 2 }, 'Test 2': { total: 2 },
  'Test 3': { total: 7, unclear: true, note: 'modules; the sheet note is unclear, so the count is shown but not scored' },
  'Test 4': { total: 4 }, 'Test 5': { total: 4, note: '2 sofas and 2 armchairs' }, 'Test 6': { total: 6 }, 'Test 7': { total: 2 },
  'Test 8': { total: 1 }, 'Test 9': { total: 7, label: 15, cropped: true, note: '15 on the label, 7 visible; the only cropped photo' }, 'Test 10': { total: 7 }
};
// Photos where pieces of one set stand separately (checked by Claude by eye on the Drive photos and against the owner's sheet,
// 16 Oct 2026, 21:3x; owner, 21:28: use only photos that actually show this). Tests 1 and 2: the two pieces in two separate shots
// stacked in one image (sheet: "pieces shown apart"). Tests 4 and 5: the set's pieces standing separately in one line-up (sheet: 2 sofas
// + 2 chairs; 2 sofas + 2 armchairs). Test 7 (two bookends) was not viewed and is not used for this rule.
const APART = { 'Test 1': 'separate shots in one image', 'Test 2': 'separate shots in one image', 'Test 4': 'standing separately in one shot', 'Test 5': 'standing separately in one shot' };
// Modular photos counted per joint (the owner's sheet: Test 3, 7 modules).
const MODULAR = ['Test 3'];
// Reader test 2 (execution 459, gpt-6.1-sol, the old prompt), from its README of 16 Oct 2026. Crop flags per photo are added from
// execution 459 when it can be read again (the README gives only "cropped on 8 of 10 photos").
const RT2 = {
  'Test 1': { count: 1, note: 'read the chaise photo as the sofa from the opposite angle' },
  'Test 2': { count: 1, note: 'read the second piece as an alternative configuration' },
  'Test 3': { count: 14, note: 'counted 7 cushions and the coffee table as product' },
  'Test 4': { count: 4, note: 'swatches kept apart' },
  'Test 5': { count: 4, note: 'kinds wrong: 1 sofa + 3 chairs' },
  'Test 6': { count: 5, note: 'missed the second nightstand; crossed chest and wardrobe excluded' },
  'Test 7': { count: 2, note: 'two different shapes kept different' },
  'Test 8': { count: 1, note: 'nightstands and lamps read as context' },
  'Test 9': { count: 7, note: '7 + the printed label' },
  'Test 10': { count: 7, note: 'the logo read as a printed label' }
};
// USD per million tokens, read 16 Oct 2026 (the same table as A7 01 Intent & scope). An estimate, not an invoice.
const PRICE = { model: 'gpt-6.1-sol', input: 2, output: 10 };
const EDGE = 15;
const arr = v => (Array.isArray(v) ? v : []);
const TOGETHER = /(same set|belong|together|photographed apart|part of the (same )?set|matching|companion)/i;
const CUSHION = /(cushion|pillow)/i;
function bodyOf(o) { if (!o || typeof o !== 'object') return o; if (Array.isArray(o.output)) return o.output; if (Array.isArray(o.choices)) return o.choices; if (o.content !== undefined) return o.content; if (o.message !== undefined) return o.message; return o; }
function usageOf(o) {
  if (!o || typeof o !== 'object') return null;
  const u = o.usage || (o.response && o.response.usage) || null;
  if (!u || typeof u !== 'object') return null;
  const n = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  if (u.input_tokens !== undefined || u.output_tokens !== undefined) return { input: n(u.input_tokens), output: n(u.output_tokens) };
  if (u.prompt_tokens !== undefined) return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
  return null;
}
function deepText(o) {
  if (o === null || o === undefined) return '';
  if (typeof o === 'string') return o.indexOf('{') !== -1 ? o : '';
  if (Array.isArray(o)) { for (const x of o) { const t = deepText(x); if (t) return t; } return ''; }
  if (typeof o === 'object') { if (typeof o.text === 'string' && o.text.indexOf('{') !== -1) return o.text; if (typeof o.content === 'string' && o.content.indexOf('{') !== -1) return o.content; for (const k of Object.keys(o)) { const t = deepText(o[k]); if (t) return t; } }
  return '';
}
function parse(t) { if (!t) return null; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function all(name) { try { return $(name).all().map(i => i.json); } catch (e) { return []; } }
const src = all('Pair photos with folders');
// The readings: from the loop's done output when every photo was read; after a stop at the cap, from the reader's runs so far.
const inp = $input.all().map(i => i.json);
const stopped = inp.length === 1 && inp[0].stopped_at_cap === true;
let got = inp;
if (stopped) { got = []; for (let r = 0; r < (inp[0].completed || 0); r++) { try { got = got.concat($('OpenAI photo reader').all(0, r).map(i => i.json)); } catch (e) { break; } } }
function readOne(raw, folder) {
  const truth = TRUTH[folder] || { total: null };
  const r = {};
  if (!raw) { r.error = 'no answer'; return r; }
  const u = usageOf(raw);
  r.tokens = u; r.usd = u ? Number(((u.input * PRICE.input + u.output * PRICE.output) / 1e6).toFixed(5)) : null;
  if (raw.error) { r.error = String((raw.error && raw.error.message) || raw.error).split('\n')[0].slice(0, 200); return r; }
  const t = deepText(bodyOf(raw)); const d = parse(t);
  if (!d) { r.error = 'no readable JSON'; r.raw = String(t || '').slice(0, 1500); return r; }
  const prod = arr(d.pieces).filter(p => p && String(p.role || 'product').toLowerCase() === 'product');
  r.count = prod.length;
  const k = {}; for (const p of prod) { const n = String(p.kind || p.label || 'piece').toLowerCase(); k[n] = (k[n] || 0) + 1; }
  r.by_kind = Object.keys(k).map(n => k[n] + ' x ' + n).join('; ');
  r.excluded = arr(d.pieces).filter(p => p && p.role === 'excluded').map(p => p.label || p.kind);
  r.context = arr(d.pieces).filter(p => p && p.role === 'context').map(p => p.label || p.kind);
  r.views_not_pieces = arr(d.views_not_pieces).map(x => String(x).slice(0, 120));
  r.printed_counts = arr(d.printed_counts).map(p => (p && (p.text || (p.count + ' ' + p.item))) || '').filter(Boolean);
  r.relations = arr(d.relations).map(x => (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200));
  // cropped and hidden, reported apart (D13)
  r.cropped_flag = d.cropped === true;
  r.cut_off_pieces = prod.filter(p => p.cut_off === true).map(p => p.label || p.kind);
  r.hidden = arr(d.hidden).map(x => String(x).slice(0, 160));
  r.hidden_pieces = prod.filter(p => p.hidden === true).map(p => p.label || p.kind);
  const boxes = prod.filter(p => Array.isArray(p.box) && p.box.length === 4 && p.box.every(v => v !== null && v !== '' && Number.isFinite(Number(v)))).map(p => p.box.map(Number));
  const near = boxes.length ? Math.min.apply(null, boxes.map(b => Math.min(b[0], b[1], 1000 - b[2], 1000 - b[3]))) : null;
  r.nearest_edge = near === null ? null : Math.round(near);
  const flagged = r.cropped_flag || r.cut_off_pieces.length > 0;
  r.cropped_after_box_check = flagged && (near === null || near <= EDGE); // the A7 04-06 rule
  // scores
  r.count_ok = truth.unclear ? null : r.count === truth.total;
  r.crop_flag_ok = r.cropped_flag === (truth.cropped === true);
  r.crop_after_box_check_ok = r.cropped_after_box_check === (truth.cropped === true);
  r.hidden_kept_apart = !(r.cropped_flag && !truth.cropped && (r.hidden.length || r.hidden_pieces.length)); // a covered piece did not turn into "cropped"
  if (APART[folder]) { r.apart_counted_once_each = r.count === truth.total; r.apart_relation_given = r.relations.some(x => TOGETHER.test(x)); }
  r.cushions_counted = prod.filter(p => CUSHION.test(String(p.kind || '') + ' ' + String(p.label || ''))).length;
  if (MODULAR.indexOf(folder) !== -1) r.modules_note = r.count + ' counted (owner 7, sheet note unclear); ' + r.cushions_counted + ' cushions counted as pieces';
  return r;
}
const rows = src.slice(0, got.length).map((s, i) => {
  const truth = TRUTH[s.folder] || { total: null };
  const now = readOne(got[i], s.folder);
  const before = RT2[s.folder] || {};
  return { folder: s.folder, file_name: s.file_name, owner: truth.total + (truth.label ? ' (label ' + truth.label + ')' : ''), owner_note: truth.note || '',
    test2_count: before.count, test2_note: before.note || '', test3_count: now.count === undefined ? null : now.count,
    change: now.count === undefined ? 'no answer' : (before.count === now.count ? 'same' : before.count + ' -> ' + now.count), test3: now };
});
const sc = rows.filter(r => !(TRUTH[r.folder] || {}).unclear);
const ok = f => sc.filter(f).length + ' of ' + sc.length;
const tok = rows.reduce((t, r) => { const u = r.test3.tokens; return u ? { input: t.input + u.input, output: t.output + u.output } : t; }, { input: 0, output: 0 });
const usd = Number(rows.reduce((t, r) => t + (r.test3.usd || 0), 0).toFixed(4));
const summary = {
  model: PRICE.model, answered: rows.filter(r => !r.test3.error).length + ' of ' + rows.length,
  count_right_test3: ok(r => r.test3.count_ok === true) + ' scored photos (Test 3 not scored)',
  count_right_test2: ok(r => r.test2_count === (TRUTH[r.folder] || {}).total) + ' scored photos (from the test 2 README)',
  count_wrong_test3: sc.filter(r => !r.test3.error && r.test3.count_ok === false).map(r => r.folder + ': ' + r.test3.count + ' (owner ' + TRUTH[r.folder].total + ')'),
  apart_counted_once_each: Object.keys(APART).map(f => { const r = rows.find(x => x.folder === f); return f + ' (' + APART[f] + '): ' + (r ? (r.test3.error ? 'not read' : (r.test3.apart_counted_once_each ? 'yes' : 'no') + ', relation ' + (r.test3.apart_relation_given ? 'given' : 'not given')) : 'not reached'); }),
  modules: MODULAR.map(f => { const r = rows.find(x => x.folder === f); return f + ': ' + (r ? (r.test3.modules_note || 'not read') : 'not reached'); }),
  cushions_counted_anywhere: rows.filter(r => r.test3.cushions_counted > 0).map(r => r.folder + ': ' + r.test3.cushions_counted),
  crop_flag_right: ok(r => r.test3.crop_flag_ok) + ' (the reader\'s own flag; only Test 9 is cropped)',
  crop_after_box_check_right: ok(r => r.test3.crop_after_box_check_ok),
  hidden_reported_on: rows.filter(r => r.test3.hidden && r.test3.hidden.length).map(r => r.folder),
  hidden_turned_into_cropped: rows.filter(r => r.test3.hidden_kept_apart === false).map(r => r.folder),
  errors: rows.filter(r => r.test3.error).map(r => r.folder + ': ' + r.test3.error),
  tokens: tok, usd_estimate: usd, calls_without_token_counts: rows.filter(r => !r.test3.tokens).map(r => r.folder)
};
let runId = '';
try { runId = $('Config').first().json.run_id; } catch (e) { runId = ''; }
const notReached = src.slice(got.length).map(s => s.folder);
return [{ json: { run_id: runId, stopped_at_cap: stopped, budget_at_stop: stopped ? inp[0].budget : null, photos_read: got.length + ' of ' + src.length, not_reached: notReached, summary, cost_basis: 'provider token counts x USD 2 input / 10 output per million (gpt-6.1-sol, read 16 Oct 2026); an estimate, not an invoice. Retried calls are not in the counts.', truth_source: 'the owner\'s truth sheet (16 Oct 2026)', apart_photos: 'Tests 1, 2 (separate shots in one image) and 4, 5 (standing separately in one shot), checked by eye on the Drive photos and the owner sheet, 16 Oct 2026' } }].concat(rows.map(r => ({ json: r })));
