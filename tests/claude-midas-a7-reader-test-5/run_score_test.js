// Local tests of reader test 4 (Score, Budget check, Stopped at cap) with code-made replies; no model call. 16 Oct 2026.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../n8n/claude-midas-a7-reader-test-5/code-nodes/');
const score = fs.readFileSync(dir + 'Score_against_the_truth_sheet.js', 'utf8');
const budget = fs.readFileSync(dir + 'Budget_check.js', 'utf8');
const stopped = fs.readFileSync(dir + 'Stopped_at_cap.js', 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tests = ['Test 1','Test 2','Test 3','Test 4','Test 5','Test 6','Test 7','Test 8','Test 9','Test 10'];
const counts = { 'Test 1': 2, 'Test 2': 2, 'Test 3': 6, 'Test 4': 4, 'Test 5': 4, 'Test 6': 6, 'Test 7': 2, 'Test 8': 1, 'Test 9': 7, 'Test 10': 7 };
const P = (label, kind, role, extra) => Object.assign({ label, kind, role, box: [100, 100, 900, 900], cut_off: false, hidden: false }, extra || {});
// A "good" reading per photo; options change one photo.
function reading(t, o) {
  o = o || {};
  let pieces = [];
  const n = o.count !== undefined ? o.count : counts[t];
  if (t === 'Test 5') pieces = (o.t5 || ['sofa', 'sofa', 'armchair', 'armchair']).map((k, i) => P(k + i, k, 'product'));
  else if (t === 'Test 3') {
    pieces = Array.from({ length: n }, (_, i) => P('module ' + i, i === 0 ? 'corner seat' : 'armless seat', 'product'));
    pieces.push(P('small white vessel', 'vase', 'context'));
    if (o.white) pieces.push(P('armless module on white background', 'armless seat', o.white));
  } else if (t === 'Test 4') {
    pieces = (o.t4 || [['sofa', 'product'], ['sofa', 'product'], ['swivel chair', 'product'], ['swivel chair', 'product']]).map((k, i) => P(k[0] + i, k[0], k[1]));
  } else if (t === 'Test 8') {
    pieces = [P('bed', 'bed', 'product')].concat(o.t8 ? o.t8 : [P('left nightstand', 'nightstand', 'context', { box: [400, 0, 800, 150] }), P('right nightstand', 'nightstand', o.t8r || 'context')]);
  } else if (t === 'Test 9') {
    pieces = Array.from({ length: n }, (_, i) => P('chair ' + i, i === 0 ? 'table' : 'chair', 'product', i === 1 ? { box: [0, 100, 500, 400], cut_off: true } : {}));
  } else pieces = Array.from({ length: n }, (_, i) => P('p' + i, o.cushion && i === 0 ? 'seat cushion' : 'chair', 'product'));
  return JSON.stringify({ pieces, cropped: t === 'Test 9' || o.crop === true, hidden: [], relations: ['Test 1', 'Test 2', 'Test 4', 'Test 5'].indexOf(t) !== -1 && !o.noRel ? ['same set, photographed apart'] : [],
    views_not_pieces: t === 'Test 3' && o.whiteView ? ['Isolated white-background view at left shows an armless module'] : [], unknowns: [] });
}
const wrap = (t, o) => ({ choices: [{ message: { content: reading(t, o) } }], usage: { prompt_tokens: 1500, completion_tokens: 1400 } });
const pairs = tests.map(t => ({ folder: t, file_id: 'f' + t, file_name: 'main.jpg' }));
function run(code, input, runIndex, runs) {
  const data = { 'Pair photos with folders': pairs, Config: [{ run_id: 'claude-rt4-test', prompt_variant: 'test' }] };
  const $ = n => ({ all: (b, r) => { if (n === 'OpenAI photo reader') { if (r === undefined || r >= runs.length) throw new Error('no run'); return [{ json: runs[r] }]; } return (data[n] || []).map(j => ({ json: j })); }, first: () => ({ json: (data[n] || [])[0] }) });
  const $input = { all: () => input.map(j => ({ json: j, binary: { data: { x: 1 } } })), first: () => ({ json: input[0] }) };
  return new Function('$', '$input', '$runIndex', code)($, $input, runIndex, runs);
}
const sc = replies => { const out = run(score, replies, 0, replies); return { head: out[0].json, rows: out.slice(1).map(x => x.json) }; };
const base = o => tests.map(t => wrap(t, (o && o[t]) || {}));
// 1. All good, white piece as context: pass.
let r = sc(base({ 'Test 3': { white: 'context' } }));
ok(r.rows.length === 10 && r.head.photos_read === '10 of 10', 'ten rows');
ok(r.head.pass.all_conditions_met === true, 'all good passes ' + JSON.stringify(r.head.pass));
ok(r.head.summary.count_right_test4.startsWith('10 of 10'), 'count 10 of 10 ' + r.head.summary.count_right_test4);
ok(r.head.summary.count_right_test3.startsWith('9 of 10') && r.head.summary.count_right_test2.startsWith('6 of 10'), 'test 3 / test 2 baselines');
ok(r.head.pass.test3_white_piece_role === 'context', 'white context');
ok(r.head.pass.test4_chairs_product === true && r.head.pass.test8_nightstands_context === true, 'T4 chairs product, T8 nightstands context');
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 8': { t8r: 'uncertain' } }));
ok(r.head.summary.uncertain_pieces.length === 1 && /Test 8: right nightstand/.test(r.head.summary.uncertain_pieces[0]), 'uncertain listed ' + r.head.summary.uncertain_pieces);
ok(r.rows.find(x => x.folder === 'Test 8').test4.count === 1, 'uncertain never counted');
ok(r.head.pass.test8_nightstands_context === false && r.head.pass.all_conditions_met === false, 'uncertain nightstand is not a pass (owner: context)');
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 4': { t4: [['sofa', 'product'], ['sofa', 'product'], ['chair', 'context'], ['chair', 'context']] } }));
ok(r.head.pass.test4_chairs_product === false && r.head.pass.test4_count_4 === false && r.head.pass.all_conditions_met === false && /Test 4: count 4 -> 2/.test(r.head.pass.worse_than_test3.join('|')), 'T4 chairs as context fail');
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 4': { t4: [['sofa', 'product'], ['sofa', 'product'], ['armchair', 'product'], ['chair', 'uncertain'], ['chair', 'product']] } }));
ok(r.head.pass.test4_chairs_product === false, 'T4 an extra uncertain chair is not a pass');
r = sc(base({ 'Test 3': { white: 'context' } }));
ok(r.rows.find(x => x.folder === 'Test 8').test4.crop_flag_ok === true, 'T8 crop flag now right');
ok(Math.abs(r.head.summary.usd_estimate - 10 * (1500 * 2 + 1400 * 10) / 1e6) < 1e-6, 'usd ' + r.head.summary.usd_estimate);
// 2. White piece: uncertain passes; product fails; view only is not a pass; not found is not a pass; a white vase is not taken for it.
ok(sc(base({ 'Test 3': { white: 'uncertain' } })).head.pass.all_conditions_met === true, 'white uncertain passes');
r = sc(base({ 'Test 3': { white: 'product', count: 5 } }));
ok(r.head.pass.test3_white_piece_role === 'product' && r.head.pass.all_conditions_met === false, 'white product fails even at count 6');
r = sc(base({ 'Test 3': { whiteView: true } }));
ok(r.head.pass.test3_white_piece_role === 'view' && r.head.pass.test3_white_piece_ok === false, 'view is not a pass');
r = sc(base({ 'Test 3': {} }));
ok(r.head.pass.test3_white_piece_role === 'not found' && r.head.pass.all_conditions_met === false, 'not found is not a pass (vase ignored)');
// 3. Test 5 kinds.
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 5': { t5: ['sofa', 'chair', 'chair', 'chair'] } }));
ok(r.head.pass.test5_kinds_2_sofas_2_armchairs === false && r.head.pass.all_conditions_met === false, 'T5 1 sofa + 3 chairs fails');
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 5': { t5: ['3-seat sofa', 'loveseat', 'arm chair', 'armchair'] } }));
ok(r.head.pass.test5_kinds_2_sofas_2_armchairs === true, 'T5 kind words normalised ' + JSON.stringify(r.head.pass.test5_kinds_read));
// 4. Test 8 still 3.
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 8': { t8: [P('l', 'nightstand', 'product'), P('r', 'nightstand', 'product')] } }));
ok(r.head.pass.test8_counts_1 === false && r.head.pass.all_conditions_met === false, 'T8 3 fails');
// 5. Worse than test 3, per check.
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 4': { t4: [['sofa', 'product'], ['sofa', 'product']] } }));
ok(r.head.pass.no_photo_worse_than_test3 === false && /Test 4: count 4 -> 2/.test(r.head.pass.worse_than_test3[0]), 'T4 count worse ' + r.head.pass.worse_than_test3);
ok(/apart rule/.test(r.head.pass.worse_than_test3[0]), 'T4 apart worse too');
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 1': { noRel: true } }));
ok(/Test 1: apart rule: counted once each true, relation not given/.test(r.head.pass.worse_than_test3[0] || ''), 'apart relation lost ' + r.head.pass.worse_than_test3);
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 10': { crop: true } }));
ok(/Test 10: crop flag false -> true/.test(r.head.pass.worse_than_test3[0] || ''), 'crop flag worse ' + r.head.pass.worse_than_test3);
r = sc(base({ 'Test 3': { white: 'context' }, 'Test 7': { cushion: true } }));
ok(/Test 7: 1 cushions counted/.test(r.head.pass.worse_than_test3[0] || ''), 'cushion worse ' + r.head.pass.worse_than_test3);
const err = base({ 'Test 3': { white: 'context' } }); err[6] = { error: { message: 'Rate limit' } };
r = sc(err);
ok(/Test 7: not read/.test(r.head.pass.worse_than_test3[0] || '') && r.head.pass.all_conditions_met === false, 'error is worse');
// 6. Budget check: identical logic to test 3.
let b = run(budget, [{ id: 'x' }], 0, [])[0];
ok(b.json.budget.ok === true && Math.abs(b.json.budget.worst_next_usd - 0.144) < 1e-9 && b.binary && b.binary.data, 'budget first photo');
b = run(budget, [{ id: 'x' }], 6, Array.from({ length: 6 }, () => ({ error: { message: 'x' } })))[0];
ok(b.json.budget.ok === false && b.json.budget.calls_counted_at_worst === 6, 'stop after 6 at worst');
// 7. Stop path.
const st = run(stopped, [b.json], 0, [])[0].json;
const out = run(score, [st], 0, base({ 'Test 3': { white: 'context' } }).slice(0, 6));
ok(out[0].json.stopped_at_cap === true && out[0].json.photos_read === '6 of 10' && out[0].json.not_reached.join(',') === 'Test 7,Test 8,Test 9,Test 10', 'stop: what finished');
ok(out[0].json.pass.test8_counts_1 === 'not reached' && out[0].json.pass.all_conditions_met === false, 'incomplete run never passes');
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
