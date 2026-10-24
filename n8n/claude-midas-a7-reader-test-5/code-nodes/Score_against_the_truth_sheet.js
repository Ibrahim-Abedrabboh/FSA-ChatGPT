// Claude · Midas A7 reader test 5 · Score. Code only (21 Oct 2026). The reader test 4 scorer, unchanged in its checks, reading prompt v3's
// answer shape too: v3 gives no boxes (so crop after the box check is the reader's own flag), names covered parts `occluded`, lists
// membership doubts in `unclear_membership` (it has no uncertain role) and reports `upload_type`. Baselines: test 3 (D13) and test 4 (execution 465).
// Claude · Midas A7 reader test 4 · Score. Code only (16 Oct 2026).
// Owner, 16 Oct 2026 (Phase 2 start prompt): only the prompt changes from reader test 3. Same photos, model and settings.
// Scored against the corrected answer sheet (owner, 22:06). A piece with role "uncertain" is never counted; every uncertain piece is
// listed (in A7, code would hold for the owner). Pass (owner, 22:56) = Test 8 counts 1 with the nightstands context; Test 4 counts 4 with the
// dusty-rose chairs product; Test 5 kinds are 2 sofas + 2 armchairs; Test 3 counts 6 and the white piece is context or uncertain; no photo worse than reader test 3 (count, crop flag, crop after the box check, the apart rule on
// Tests 1, 2, 4, 5, cushions not counted). Nothing is written anywhere: the result stays in this execution.
const TRUTH = {
  'Test 1': { total: 2 }, 'Test 2': { total: 2 },
  'Test 3': { total: 6, note: '6 modules; the white piece outside the sectional is context (owner, 22:06)' },
  'Test 4': { total: 4, note: '2 sofas + 2 chairs (sheet)' },
  'Test 5': { total: 4, kinds: { sofa: 2, armchair: 2 }, note: '2 sofas and 2 armchairs' },
  'Test 6': { total: 6 }, 'Test 7': { total: 2 }, 'Test 8': { total: 1 },
  'Test 9': { total: 7, label: 15, cropped: true, note: '15 on the label, 7 visible; the only cropped photo' }, 'Test 10': { total: 7 }
};
const APART = { 'Test 1': 'separate shots in one image', 'Test 2': 'separate shots in one image', 'Test 4': 'standing separately in one shot', 'Test 5': 'standing separately in one shot' };
// Reader test 2 (execution 459, old prompt), from its README. Counts only.
const RT2 = { 'Test 1': 1, 'Test 2': 1, 'Test 3': 14, 'Test 4': 4, 'Test 5': 4, 'Test 6': 5, 'Test 7': 2, 'Test 8': 1, 'Test 9': 7, 'Test 10': 7 };
// Reader test 3 (execution 461, D13 prompt), from results-execution-461.json. crop = the reader's own flag; box = crop after the box check;
// apart = counted once each and a relation given; white = how the Test 3 white piece was labelled.
const RT3 = {
  'Test 1': { count: 2, kinds: '1 x chaise lounge; 1 x sofa', crop: false, box: false, apart: true, cushions: 0 },
  'Test 2': { count: 2, kinds: '1 x chaise module; 1 x one-arm sofa module', crop: false, box: false, apart: true, cushions: 0 },
  'Test 3': { count: 6, kinds: '5 x armless seat; 1 x corner seat', crop: false, box: false, cushions: 0, white: 'a view (views_not_pieces)' },
  'Test 4': { count: 4, kinds: '2 x sofa; 2 x chair', crop: false, box: false, apart: true, cushions: 0 },
  'Test 5': { count: 4, kinds: '1 x sofa; 3 x chair', crop: false, box: false, apart: true, cushions: 0 },
  'Test 6': { count: 6, kinds: '1 x bed; 2 x nightstand; 1 x dressing table; 1 x mirror; 1 x stool', crop: false, box: false, cushions: 0 },
  'Test 7': { count: 2, kinds: '2 x bookend', crop: false, box: false, cushions: 0 },
  'Test 8': { count: 3, kinds: '1 x bed; 2 x nightstand', crop: true, box: true, cushions: 0 },
  'Test 9': { count: 7, kinds: '1 x table; 4 x chair; 2 x armchair', crop: true, box: true, cushions: 0 },
  'Test 10': { count: 7, kinds: '1 x table; 6 x chair', crop: false, box: false, cushions: 0 }
};
const PRICE = { model: 'gpt-6.1-sol', input: 2, output: 10 };
const EDGE = 15;
const arr = v => (Array.isArray(v) ? v : []);
const TOGETHER = /(same set|belong|together|photographed apart|part of the (same )?set|matching|companion)/i;
const CUSHION = /(cushion|pillow)/i;
const WHITE = /(white|isolated|cut-?out|plain background|separate (view|shot|module)|outside the sectional|standalone|stand-alone|apart from the sectional)/i;
const SEAT = /(seat|module|sofa|armless|sectional|chair|corner|piece)/i; // so a white cup or vase is not taken for the white piece
const roleOf = p => String((p && p.role) || 'product').toLowerCase().trim();
const nameOf = p => String((p && (p.label || p.kind)) || 'piece');
function kindOf(p) {
  const s = String((p && p.kind) || (p && p.label) || '').toLowerCase();
  if (/arm\s*-?chair/.test(s)) return 'armchair';
  if (/(sofa|settee|loveseat|love seat|couch)/.test(s)) return 'sofa';
  if (/(ottoman|pouf)/.test(s)) return 'ottoman';
  if (/chair/.test(s)) return 'chair';
  return s || 'piece';
}
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
  const pieces = arr(d.pieces).filter(p => p && typeof p === 'object');
  const prod = pieces.filter(p => roleOf(p) === 'product');
  r.count = prod.length; // role product only; uncertain is never counted
  const k = {}; for (const p of prod) { const n = String(p.kind || p.label || 'piece').toLowerCase(); k[n] = (k[n] || 0) + 1; }
  r.by_kind = Object.keys(k).map(n => k[n] + ' x ' + n).join('; ');
  const nk = {}; for (const p of prod) { const n = kindOf(p); nk[n] = (nk[n] || 0) + 1; }
  r.kinds_normalised = nk;
  r.excluded = pieces.filter(p => roleOf(p) === 'excluded').map(nameOf);
  r.context = pieces.filter(p => roleOf(p) === 'context').map(nameOf);
  r.uncertain = pieces.filter(p => roleOf(p) === 'uncertain').map(p => ({ label: nameOf(p), kind: String(p.kind || ''), box: p.box || null }));
  r.other_roles = pieces.filter(p => ['product', 'excluded', 'context', 'uncertain'].indexOf(roleOf(p)) === -1).map(p => nameOf(p) + ' (' + roleOf(p) + ')');
  r.unclear_membership = arr(d.unclear_membership).map(x => String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200));
  r.upload_type = d.upload_type === undefined ? null : String(d.upload_type).slice(0, 40);
  r.unknowns = arr(d.unknowns).map(x => (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240));
  r.views_not_pieces = arr(d.views_not_pieces).map(x => String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200));
  r.printed_counts = arr(d.printed_counts).map(p => (p && (p.text || (p.count + ' ' + p.item))) || '').filter(Boolean);
  r.relations = arr(d.relations).map(x => (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200));
  r.cropped_flag = d.cropped === true;
  r.cut_off_pieces = prod.filter(p => p.cut_off === true).map(nameOf);
  r.hidden = arr(d.hidden !== undefined ? d.hidden : d.occluded).map(x => String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 160));
  r.hidden_pieces = prod.filter(p => p.hidden === true).map(nameOf);
  const boxes = prod.filter(p => Array.isArray(p.box) && p.box.length === 4 && p.box.every(v => v !== null && v !== '' && Number.isFinite(Number(v)))).map(p => p.box.map(Number));
  const near = boxes.length ? Math.min.apply(null, boxes.map(b => Math.min(b[0], b[1], 1000 - b[2], 1000 - b[3]))) : null;
  r.nearest_edge = near === null ? null : Math.round(near);
  const flagged = r.cropped_flag || r.cut_off_pieces.length > 0;
  r.cropped_after_box_check = flagged && (near === null || near <= EDGE); // the A7 04-06 rule
  r.count_ok = r.count === truth.total;
  r.crop_flag_ok = r.cropped_flag === (truth.cropped === true);
  r.crop_after_box_check_ok = r.cropped_after_box_check === (truth.cropped === true);
  if (APART[folder]) { r.apart_counted_once_each = r.count === truth.total; r.apart_relation_given = r.relations.some(x => TOGETHER.test(x)); }
  r.cushions_counted = prod.filter(p => CUSHION.test(String(p.kind || '') + ' ' + String(p.label || ''))).length;
  if (truth.kinds) { r.kinds_ok = Object.keys(nk).length === Object.keys(truth.kinds).length && Object.keys(truth.kinds).every(x => nk[x] === truth.kinds[x]); }
  if (folder === 'Test 4') {
    // Owner, 22:56: the dusty-rose chairs must be product. Product seating = 2 sofas + 2 chairs or armchairs; no chair left as context or uncertain.
    const seatOther = pieces.filter(p => roleOf(p) !== 'product' && /^(chair|armchair)$/.test(kindOf(p)));
    r.chairs_product = (nk.sofa || 0) === 2 && ((nk.chair || 0) + (nk.armchair || 0)) === 2 && seatOther.length === 0;
    r.chairs_not_product = seatOther.map(p => nameOf(p) + ' (' + roleOf(p) + ')');
  }
  if (folder === 'Test 8') {
    // Owner, 22:56: the nightstands must be context (uncertain is reported, not a pass).
    const ns = pieces.filter(p => /(nightstand|night stand|bedside|side table|night table)/i.test(String(p.kind || '') + ' ' + String(p.label || '')));
    r.nightstands = ns.map(p => nameOf(p) + ' (' + roleOf(p) + ')');
    r.nightstands_context = ns.length > 0 && ns.every(p => roleOf(p) === 'context');
  }
  if (folder === 'Test 3') {
    // The white piece outside the sectional: found by its words in any piece (any role) or in views_not_pieces. Claude also checks by eye
    // in the raw answer; a word match is a pointer, not proof.
    const text = p => String(p.label || '') + ' ' + String(p.kind || '') + ' ' + String(p.note || '') + ' ' + String(p.reason || '');
    const hits = pieces.filter(p => WHITE.test(text(p)) && SEAT.test(text(p)));
    const roles = hits.map(roleOf);
    const inViews = r.views_not_pieces.some(x => WHITE.test(x) && SEAT.test(x));
    const inUnclear = r.unclear_membership.some(x => WHITE.test(x) && SEAT.test(x)); // v3's place for membership doubts
    r.white_piece = { pieces: hits.map(p => nameOf(p) + ' (' + roleOf(p) + ')'), in_views_not_pieces: inViews, in_unclear_membership: inUnclear };
    r.white_piece_role = roles.indexOf('product') !== -1 ? 'product' : roles.indexOf('uncertain') !== -1 ? 'uncertain' : roles.indexOf('context') !== -1 ? 'context' : inUnclear ? 'uncertain (unclear_membership)' : inViews ? 'view' : hits.length ? roles.join(',') : 'not found';
  }
  return r;
}
function worse(folder, now) {
  // A photo is worse than reader test 3 when something that test 3 got right is now wrong, or the photo was not read.
  const b = RT3[folder]; const truth = TRUTH[folder] || {}; const w = [];
  if (!b) return w;
  if (now.error) { w.push('not read: ' + now.error); return w; }
  if (b.count === truth.total && now.count !== truth.total) w.push('count ' + b.count + ' -> ' + now.count + ' (owner ' + truth.total + ')');
  if (b.crop === (truth.cropped === true) && !now.crop_flag_ok) w.push('crop flag ' + b.crop + ' -> ' + now.cropped_flag);
  if (b.box === (truth.cropped === true) && !now.crop_after_box_check_ok) w.push('crop after box check ' + b.box + ' -> ' + now.cropped_after_box_check);
  if (APART[folder] && b.apart === true && !(now.apart_counted_once_each && now.apart_relation_given)) w.push('apart rule: counted once each ' + now.apart_counted_once_each + ', relation ' + (now.apart_relation_given ? 'given' : 'not given'));
  if ((now.cushions_counted || 0) > (b.cushions || 0)) w.push(now.cushions_counted + ' cushions counted');
  return w;
}
const rows = src.slice(0, got.length).map((s, i) => {
  const truth = TRUTH[s.folder] || { total: null };
  const now = readOne(got[i], s.folder);
  const b = RT3[s.folder] || {};
  return { folder: s.folder, file_name: s.file_name, owner: truth.total + (truth.label ? ' (label ' + truth.label + ')' : ''), owner_note: truth.note || '',
    test2_count: RT2[s.folder], test3_count: b.count, test3_kinds: b.kinds || '', test4_count: now.count === undefined ? null : now.count,
    change_from_test3: now.count === undefined ? 'no answer' : (b.count === now.count ? 'same' : b.count + ' -> ' + now.count),
    worse_than_test3: worse(s.folder, now), test4: now };
});
const R = f => rows.find(r => r.folder === f);
const ok = f => rows.filter(f).length + ' of ' + rows.length;
const tok = rows.reduce((t, r) => { const u = r.test4.tokens; return u ? { input: t.input + u.input, output: t.output + u.output } : t; }, { input: 0, output: 0 });
const usd = Number(rows.reduce((t, r) => t + (r.test4.usd || 0), 0).toFixed(4));
const t8 = R('Test 8'), t5 = R('Test 5'), t3 = R('Test 3'), t4 = R('Test 4');
const worseRows = rows.filter(r => r.worse_than_test3.length);
const pass = {
  test8_counts_1: t8 ? (t8.test4.error ? 'not read' : t8.test4.count === 1) : 'not reached',
  test5_kinds_2_sofas_2_armchairs: t5 ? (t5.test4.error ? 'not read' : t5.test4.kinds_ok === true) : 'not reached',
  test5_kinds_read: t5 && !t5.test4.error ? t5.test4.kinds_normalised : null,
  test4_count_4: t4 ? (t4.test4.error ? 'not read' : t4.test4.count === 4) : 'not reached',
  test4_chairs_product: t4 && !t4.test4.error ? t4.test4.chairs_product === true : false,
  test8_nightstands_context: t8 && !t8.test4.error ? t8.test4.nightstands_context === true : false,
  test8_nightstands_read: t8 && !t8.test4.error ? t8.test4.nightstands : null,
  test3_counts_6: t3 ? (t3.test4.error ? 'not read' : t3.test4.count === 6) : 'not reached',
  test3_white_piece_role: t3 && !t3.test4.error ? t3.test4.white_piece_role : 'not read',
  test3_white_piece_ok: t3 && !t3.test4.error ? ['context', 'uncertain', 'uncertain (unclear_membership)'].indexOf(t3.test4.white_piece_role) !== -1 : false,
  no_photo_worse_than_test3: rows.length === 10 && worseRows.length === 0,
  worse_than_test3: worseRows.map(r => r.folder + ': ' + r.worse_than_test3.join('; '))
};
pass.all_conditions_met = pass.test8_counts_1 === true && pass.test8_nightstands_context === true && pass.test4_count_4 === true && pass.test4_chairs_product === true && pass.test5_kinds_2_sofas_2_armchairs === true && pass.test3_counts_6 === true && pass.test3_white_piece_ok === true && pass.no_photo_worse_than_test3 === true;
const summary = {
  model: PRICE.model, answered: rows.filter(r => !r.test4.error).length + ' of ' + rows.length,
  count_right_test4: ok(r => r.test4.count_ok === true) + ' (corrected sheet)',
  count_right_test3: ok(r => r.test3_count === (TRUTH[r.folder] || {}).total) + ' (corrected sheet)',
  count_right_test2: ok(r => r.test2_count === (TRUTH[r.folder] || {}).total) + ' (corrected sheet)',
  prior_runs: { test2_old_prompt: '6 of 10', test3_D13: '9 of 10', test4_rt4_with_test4_clause_execution_465: '10 of 10 (crop flag wrong on Test 3; white piece a view)' },
  upload_types: rows.filter(r => r.test4.upload_type).map(r => r.folder + ': ' + r.test4.upload_type),
  unclear_membership: rows.filter(r => r.test4.unclear_membership && r.test4.unclear_membership.length).map(r => r.folder + ': ' + r.test4.unclear_membership.join('; ')),
  count_wrong_test4: rows.filter(r => !r.test4.error && r.test4.count_ok === false).map(r => r.folder + ': ' + r.test4.count + ' (owner ' + TRUTH[r.folder].total + ')'),
  uncertain_pieces: rows.filter(r => r.test4.uncertain && r.test4.uncertain.length).map(r => r.folder + ': ' + r.test4.uncertain.map(u => u.label + (u.kind ? ' [' + u.kind + ']' : '')).join('; ')),
  other_roles: rows.filter(r => r.test4.other_roles && r.test4.other_roles.length).map(r => r.folder + ': ' + r.test4.other_roles.join('; ')),
  apart_counted_once_each: Object.keys(APART).map(f => { const r = R(f); return f + ' (' + APART[f] + '): ' + (r ? (r.test4.error ? 'not read' : (r.test4.apart_counted_once_each ? 'yes' : 'no') + ', relation ' + (r.test4.apart_relation_given ? 'given' : 'not given')) : 'not reached'); }),
  cushions_counted_anywhere: rows.filter(r => r.test4.cushions_counted > 0).map(r => r.folder + ': ' + r.test4.cushions_counted),
  crop_flag_right: ok(r => r.test4.crop_flag_ok) + ' (the reader\'s own flag; only Test 9 is cropped)',
  crop_after_box_check_right: ok(r => r.test4.crop_after_box_check_ok),
  errors: rows.filter(r => r.test4.error).map(r => r.folder + ': ' + r.test4.error),
  tokens: tok, usd_estimate: usd, calls_without_token_counts: rows.filter(r => !r.test4.tokens).map(r => r.folder)
};
let runId = '', variant = '';
try { const c = $('Config').first().json; runId = c.run_id; variant = c.prompt_variant; } catch (e) { runId = ''; }
const notReached = src.slice(got.length).map(s => s.folder);
return [{ json: { run_id: runId, prompt_variant: variant, stopped_at_cap: stopped, budget_at_stop: stopped ? inp[0].budget : null, photos_read: got.length + ' of ' + src.length, not_reached: notReached, pass, summary,
  cost_basis: 'provider token counts x USD 2 input / 10 output per million (gpt-6.1-sol, the test 4 price; the site lists USD 4 / 15 since 19 Oct, see the README); an estimate, not an invoice. Retried calls are not in the counts.',
  truth_source: 'the owner\'s corrected answer sheet (16 Oct 2026, 22:06)', note: 'A passed check is a reviewed candidate, not an approval; the reader\'s answers are model judgements.' } }].concat(rows.map(r => ({ json: r })));
