// Replays reader test 3's real answers (execution 461, text and token counts only) through the reader test 4 scorer. No model call.
// Expected: the scorer reproduces test 3 (9 of 10 right, Test 8 = 3, Test 5 = 1 sofa + 3 chairs, the white piece only "a view"),
// finds no photo worse than test 3, and does not pass.
const fs = require('fs'), path = require('path');
const score = fs.readFileSync(path.join(__dirname, '../../n8n/claude-midas-a7-reader-test-5/code-nodes/Score_against_the_truth_sheet.js'), 'utf8');
const replies = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/execution-461-reader-replies.json'), 'utf8'));
const tests = Array.from({ length: 10 }, (_, i) => 'Test ' + (i + 1));
const data = { 'Pair photos with folders': tests.map(t => ({ folder: t, file_id: 'f', file_name: 'main.jpg' })), Config: [{ run_id: 'replay-461', prompt_variant: 'D13 (test 3)' }] };
const $ = n => ({ all: () => (data[n] || []).map(j => ({ json: j })), first: () => ({ json: (data[n] || [])[0] }) });
const $input = { all: () => replies.map(j => ({ json: j })), first: () => ({ json: replies[0] }) };
const out = new Function('$', '$input', '$runIndex', score)($, $input, 0);
const h = out[0].json, rows = out.slice(1).map(x => x.json);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(h.summary.count_right_test4.startsWith('9 of 10'), 'replay 9 of 10 ' + h.summary.count_right_test4);
ok(rows.find(r => r.folder === 'Test 8').test4.count === 3, 'T8 3');
ok(h.pass.test5_kinds_2_sofas_2_armchairs === false, 'T5 kinds wrong ' + JSON.stringify(h.pass.test5_kinds_read));
ok(h.pass.test3_white_piece_role === 'view', 'white piece = view ' + h.pass.test3_white_piece_role);
ok(h.pass.no_photo_worse_than_test3 === true, 'not worse than itself ' + h.pass.worse_than_test3);
ok(h.pass.all_conditions_met === false, 'test 3 does not pass the test 4 bar');
ok(h.summary.tokens.input === 15303 && h.summary.tokens.output === 14549 && h.summary.usd_estimate === 0.1761, 'tokens and cost ' + JSON.stringify(h.summary.tokens) + ' ' + h.summary.usd_estimate);
ok(h.summary.crop_flag_right.startsWith('9 of 10') && h.summary.crop_after_box_check_right.startsWith('9 of 10'), 'crop 9 of 10');
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
