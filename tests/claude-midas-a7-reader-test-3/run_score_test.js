// Local tests of reader test 3 (Score, Budget check, Stopped at cap) with code-made replies; no model call. 16 Oct 2026.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../../n8n/claude-midas-a7-reader-test-3/code-nodes/');
const score = fs.readFileSync(dir + 'Score_against_the_truth_sheet.js', 'utf8');
const budget = fs.readFileSync(dir + 'Budget_check.js', 'utf8');
const stopped = fs.readFileSync(dir + 'Stopped_at_cap.js', 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tests = ['Test 1','Test 2','Test 3','Test 4','Test 5','Test 6','Test 7','Test 8','Test 9','Test 10'];
const counts = { 'Test 1': 2, 'Test 2': 2, 'Test 3': 7, 'Test 4': 4, 'Test 5': 4, 'Test 6': 6, 'Test 7': 2, 'Test 8': 1, 'Test 9': 7, 'Test 10': 7 };
const eye = (t, n) => JSON.stringify({
  pieces: Array.from({ length: n }, (_, i) => ({ label: 'p' + i, kind: t === 'Test 3' && i === 0 ? 'seat cushion' : 'chair', box: t === 'Test 9' && i === 0 ? [0, 100, 500, 400] : [100, 100, 900, 900], role: 'product', cut_off: t === 'Test 9' && i === 0, hidden: t === 'Test 10' })).concat([{ label: 'vase', kind: 'vase', role: 'context', box: [1, 1, 2, 2] }]),
  cropped: t === 'Test 9' || t === 'Test 6', hidden: t === 'Test 10' || t === 'Test 6' ? ['two chairs partly behind the table'] : [],
  relations: t === 'Test 1' || t === 'Test 4' ? ['chaise: same set as the sofa, photographed apart'] : [] });
const gpt = tests.map(t => t === 'Test 7' ? { error: { message: 'Rate limit' } } : { choices: [{ message: { content: eye(t, t === 'Test 2' ? 1 : counts[t]) } }], usage: { prompt_tokens: 3000, completion_tokens: 2500 } });
const pairs = tests.map(t => ({ folder: t, file_id: 'f' + t, file_name: 'main.jpg' }));
function run(code, input, runIndex, runs) {
  const data = { 'Pair photos with folders': pairs, Config: [{ run_id: 'claude-rt3-test' }] };
  const $ = n => ({ all: (b, r) => { if (n === 'OpenAI photo reader') { if (r === undefined || r >= runs.length) throw new Error('no run'); return [{ json: runs[r] }]; } return (data[n] || []).map(j => ({ json: j })); }, first: () => ({ json: (data[n] || [])[0] }) });
  const $input = { all: () => input.map(j => ({ json: j, binary: { data: { x: 1 } } })), first: () => ({ json: input[0] }) };
  return new Function('$', '$input', '$runIndex', code)($, $input, runIndex, runs);
}
// 1. Full run: Score from the loop's done output.
let out = run(score, gpt, 0, gpt);
let s = out[0].json.summary, rows = out.slice(1).map(x => x.json);
const R = f => rows.find(r => r.folder === f);
ok(rows.length === 10 && out[0].json.photos_read === '10 of 10' && out[0].json.stopped_at_cap === false, 'full run rows');
ok(s.count_right_test3.startsWith('7 of 9'), 'right 7 of 9 ' + s.count_right_test3);
ok(s.count_right_test2.startsWith('6 of 9'), 'test 2 right 6 of 9 ' + s.count_right_test2);
ok(R('Test 1').change === '1 -> 2' && R('Test 4').change === 'same' && R('Test 7').change === 'no answer', 'side by side');
ok(s.apart_counted_once_each.length === 4, 'four apart photos');
ok(/Test 1 \(separate shots in one image\): yes, relation given/.test(s.apart_counted_once_each[0]), 'T1 apart ' + s.apart_counted_once_each[0]);
ok(/Test 2 .*: no, relation not given/.test(s.apart_counted_once_each[1]), 'T2 apart ' + s.apart_counted_once_each[1]);
ok(/Test 4 \(standing separately in one shot\): yes, relation given/.test(s.apart_counted_once_each[2]), 'T4 apart ' + s.apart_counted_once_each[2]);
ok(/Test 5 .*: yes, relation not given/.test(s.apart_counted_once_each[3]), 'T5 apart ' + s.apart_counted_once_each[3]);
ok(/7 counted .* 1 cushions/.test(s.modules[0]), 'modules ' + s.modules[0]);
ok(s.crop_flag_right.startsWith('7 of 9') && s.crop_after_box_check_right.startsWith('8 of 9'), 'crop scores');
ok(JSON.stringify(s.hidden_reported_on) === JSON.stringify(['Test 6', 'Test 10']) && JSON.stringify(s.hidden_turned_into_cropped) === JSON.stringify(['Test 6']), 'hidden');
ok(Math.abs(s.usd_estimate - 9 * (3000 * 2 + 2500 * 10) / 1e6) < 1e-6, 'usd ' + s.usd_estimate);
// 2. Budget check: first photo allowed; after 6 calls at the worst case, a 7th is still allowed only if within 1.00.
let b = run(budget, [{ id: 'x' }], 0, [])[0];
ok(b.json.budget.ok === true && b.json.budget.spent_usd === 0 && b.binary && b.binary.data, 'first photo allowed, binary kept');
ok(Math.abs(b.json.budget.worst_next_usd - 0.144) < 1e-9, 'worst next 0.144');
const real = Array.from({ length: 9 }, () => ({ usage: { prompt_tokens: 3000, completion_tokens: 2500 } }));
b = run(budget, [{ id: 'x' }], 9, real)[0];
ok(b.json.budget.ok === true && Math.abs(b.json.budget.spent_usd - 0.279) < 1e-6, '10th allowed at 0.279 spent ' + b.json.budget.spent_usd);
const noCounts = Array.from({ length: 6 }, () => ({ error: { message: 'x' } }));
b = run(budget, [{ id: 'x' }], 6, noCounts)[0];
ok(b.json.budget.ok === false && b.json.budget.calls_counted_at_worst === 6, '7th stopped when 6 calls counted at worst (0.864 + 0.144 > 1)');
// 3. Stop path: Score reads the reader's runs so far.
const st = run(stopped, [b.json], 0, [])[0].json;
ok(st.stopped_at_cap === true && st.completed === 6, 'stopped item');
out = run(score, [st], 0, gpt.slice(0, 6));
ok(out[0].json.stopped_at_cap === true && out[0].json.photos_read === '6 of 10' && out[0].json.not_reached.join(',') === 'Test 7,Test 8,Test 9,Test 10', 'stop: what finished ' + out[0].json.photos_read);
ok(out.length === 7, 'six rows after stop');
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
