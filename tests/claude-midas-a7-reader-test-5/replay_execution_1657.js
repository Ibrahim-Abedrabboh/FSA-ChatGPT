// Replays reader test 5's real answers (execution 1657, output and token counts only) through the reader test 5 scorer. No model call.
// Expected: the scorer reproduces test 5 (8 of 10 right: Test 1 = 1, Test 8 = 3 with the nightstands product; Test 5 = 1 sofa + 3 armchairs;
// the white piece only "a view"; crop flag true on Tests 3 and 8 with no box to clear it; an upload type on all ten; no relation that
// ties the apart pieces together), finds five photos worse than test 3, and does not pass.
const fs = require('fs'), path = require('path');
const score = fs.readFileSync(path.join(__dirname, '../../n8n/claude-midas-a7-reader-test-5/code-nodes/Score_against_the_truth_sheet.js'), 'utf8');
const replies = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/execution-1657-reader-replies.json'), 'utf8'));
const tests = Array.from({ length: 10 }, (_, i) => 'Test ' + (i + 1));
const data = { 'Pair photos with folders': tests.map(t => ({ folder: t, file_id: 'f', file_name: 'main.jpg' })), Config: [{ run_id: 'replay-1657', prompt_variant: 'v3 (test 5)' }] };
const $ = n => ({ all: () => (data[n] || []).map(j => ({ json: j })), first: () => ({ json: (data[n] || [])[0] }) });
const $input = { all: () => replies.map(j => ({ json: j })), first: () => ({ json: replies[0] }) };
const out = new Function('$', '$input', '$runIndex', score)($, $input, 0);
const h = out[0].json, rows = out.slice(1).map(x => x.json);
const row = f => rows.find(r => r.folder === f);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(h.photos_read === '10 of 10' && h.stopped_at_cap === false && h.summary.errors.length === 0, 'all ten read ' + h.photos_read);
ok(h.summary.count_right_test4.startsWith('8 of 10'), 'replay 8 of 10 ' + h.summary.count_right_test4);
ok(row('Test 1').test4.count === 1 && row('Test 1').test4.apart_counted_once_each === false, 'T1 1 (the upper shot read as a view)');
ok(row('Test 8').test4.count === 3 && h.pass.test8_counts_1 === false && h.pass.test8_nightstands_context === false, 'T8 3, nightstands product ' + JSON.stringify(h.pass.test8_nightstands_read));
ok(h.pass.test4_count_4 === true && h.pass.test4_chairs_product === true, 'T4 4, chairs product');
ok(h.pass.test5_kinds_2_sofas_2_armchairs === false && JSON.stringify(h.pass.test5_kinds_read) === '{"sofa":1,"armchair":3}', 'T5 kinds 1 sofa + 3 armchairs ' + JSON.stringify(h.pass.test5_kinds_read));
ok(h.pass.test3_counts_6 === true && h.pass.test3_white_piece_role === 'view' && h.pass.test3_white_piece_ok === false, 'T3 6, white piece = view ' + h.pass.test3_white_piece_role);
ok(row('Test 3').test4.cropped_flag === true && row('Test 3').test4.nearest_edge === null && row('Test 3').test4.cropped_after_box_check === true, 'T3 crop flag true and no box to clear it');
ok(h.summary.crop_flag_right.startsWith('8 of 10') && h.summary.crop_after_box_check_right.startsWith('8 of 10'), 'crop 8 of 10 ' + h.summary.crop_flag_right);
ok(h.summary.upload_types.length === 10 && h.summary.upload_types.slice(0, 5).every(x => x.endsWith('W4')) && h.summary.upload_types.slice(5).every(x => x.endsWith('W3')), 'upload types: W4 on Tests 1 to 5, W3 on 6 to 10');
ok(h.summary.unclear_membership.length === 3, 'unclear_membership on Tests 4, 5 and 9 ' + h.summary.unclear_membership.length);
ok(h.summary.apart_counted_once_each.every(x => x.endsWith('relation not given')), 'no relation ties the apart pieces together');
ok(h.pass.worse_than_test3.length === 5 && h.pass.no_photo_worse_than_test3 === false, 'five photos worse than test 3 ' + JSON.stringify(h.pass.worse_than_test3));
ok(h.summary.cushions_counted_anywhere.length === 0 && h.summary.uncertain_pieces.length === 0 && h.summary.other_roles.length === 0, 'no cushions, no uncertain role, no other roles');
ok(h.summary.tokens.input === 24983 && h.summary.tokens.output === 11956 && h.summary.usd_estimate === 0.1695, 'tokens and cost ' + JSON.stringify(h.summary.tokens) + ' ' + h.summary.usd_estimate);
ok(h.pass.all_conditions_met === false, 'v3 does not pass the owner\'s bar');
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
