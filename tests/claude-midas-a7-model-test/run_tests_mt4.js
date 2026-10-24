// Local tests for the model test "MT4 Plan" hold-and-ask change (16 Oct 2026). No network, no AI call, no paid call.
// Run: node tests/claude-midas-a7-model-test/run_tests_mt4.js
// The two readings below are abridged from the real reader-test rows 17 (Test 8) and 15 (Test 6) in the n8n table
// "Claude Midas A7 reader test" (U0quiuvjYjGt3HpZ), read on 16 Oct 2026: the pieces with their roles, counts, colour and shown_with
// are copied; long description fields are left out. The sheet rows and the registry row are made up for the test.
const fs = require('fs');
const path = require('path');
const CODE = fs.readFileSync(path.join(__dirname, '..', '..', 'n8n', 'claude-midas-a7-model-test', 'code-nodes', 'MT4_Plan.js'), 'utf8');
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const eye8 = { category: 'upholstered bed', pieces: [
  { label: 'upholstered bed', kind: 'bed', seen_whole: true, role: 'product' },
  { label: 'left nightstand', kind: 'nightstand', seen_whole: false, role: 'context' }],
  colour_observed: 'light grey fabric upholstery with warm medium-brown wood frame', design_locks: [], sided_parts: [], relations: [],
  shown_with: ['white mattress and linens', 'ceramic base table lamp', 'textured flatweave area rug'], unknowns: [], cropped: false };
const eye6 = { category: 'bedroom furniture set', pieces: [
  { label: 'upholstered bed', kind: 'bed', role: 'product' }, { label: 'left nightstand', kind: 'nightstand', role: 'product' },
  { label: 'right nightstand', kind: 'nightstand', role: 'product' }, { label: 'tall chest of drawers', kind: 'chest of drawers', role: 'excluded' },
  { label: 'wardrobe', kind: 'wardrobe', role: 'excluded' }, { label: 'dresser', kind: 'dresser', role: 'product' },
  { label: 'vanity mirror', kind: 'mirror', role: 'product' }, { label: 'vanity stool', kind: 'stool', role: 'product' },
  { label: 'area rug', kind: 'rug', role: 'context' }],
  colour_observed: 'off-white with champagne gold accents', design_locks: [], sided_parts: ['left nightstand', 'right nightstand'], relations: [],
  shown_with: ['table lamps on nightstands', 'area rug at the foot of the bed'], unknowns: [], cropped: false };
const readings = [
  { id: 17, run_id: 'claude-rt-20261015002326', folder: 'Test 8', eye_count: 1, second_count: 1, cropped: false, eye_raw: JSON.stringify(eye8) },
  { id: 15, run_id: 'claude-rt-20261015002326', folder: 'Test 6', eye_count: 6, second_count: 6, cropped: false, eye_raw: JSON.stringify(eye6) }
];
const reg = { model_id: 'gemini-nano-banana-2.1', endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions', status: 'approved', sizes: '1K|2K', ratios: '1:1',
  max_refs: 14, input_usd_per_m: 0.5, text_out_usd_per_m: 3, image_out_usd_per_m: 60, input_image_tokens: 560, image_tokens_2k: 1680, price_date: '2026-10-14', label: 'test' };
const row = (folder, n, pieces, type) => ({ folder, 'answer': 'yes', 'true piece count': String(n), 'confirmed by owner': 'yes', 'pieces that belong to the product': pieces, 'excluded pieces': 'none', 'product type': type, 'true colour': '', 'what this case tests': 'test' });
async function plan(sheetRows, expected) {
  const cfg = { run_id: 'claude-mt-test', paid_calls_allowed: false, go_token: '', models: ['gemini-nano-banana-2.1'], frame: 'square, 1:1', image_size: '2K', thinking_level: '',
    only_folders: ['Test 6', 'Test 8'], skip_folders: {}, expected_counts: expected || { 'Test 6': 6, 'Test 8': 1 }, prompt_edits: {}, no_reading_ok: [], allow_no_reading: false, max_calls: 12, max_spend_usd: 3, max_inline_mb: 14 };
  const nodes = { 'MT1 Config': [{ json: cfg }], 'MT2 Load registry': [{ json: reg }], 'MT3 Load reader readings': readings.map(json => ({ json })), 'Read answer sheet': [{ json: { sheet_rows: sheetRows } }] };
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = [{ json: { folder: 'Test 6', file_id: 'f6', file_name: 'main.jpg', mime: 'image/jpeg' } }, { json: { folder: 'Test 8', file_id: 'f8', file_name: 'main.jpg', mime: 'image/png' } }];
  const $input = { first: () => items[0], all: () => items };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const out = await new AsyncFn('$', '$input', 'require', CODE).call({}, $, $input, require);
  return out[0].json;
}
(async () => {
  // 1. The owner's sheet today: Test 8 = the bed only; Test 6 = 6 pieces.
  let r = await plan([row('Test 8', 1, '1 bed', 'bed'), row('Test 6', 6, '1 bed; 2 nightstands; 1 dresser; 1 mirror; 1 stool', 'bedroom set')]);
  const c8 = r.cases.find(c => c.folder === 'Test 8'), c6 = r.cases.find(c => c.folder === 'Test 6');
  ok(c8.status === 'planned' && c6.status === 'planned', 'sheet of 16 Oct: Test 6 and Test 8 planned (' + c8.reason + ' / ' + c6.reason + ')');
  ok(r.orders.length === 2 && r.orders.every(o => o.paid_calls_allowed === false), '2 orders (one model in this test), paid switch off');
  const p8 = r.orders.find(o => o.folder === 'Test 8').prompt;
  ok(/nightstand/i.test(p8) && /leave out|left out|not part|do not show|not in the image/i.test(p8), 'Test 8: the context nightstand is told to be left out, as in A7');
  ok(/1 x bed/.test(p8), 'Test 8: inventory 1 x bed in the prompt');
  ok(c6.inventory.join('; ') === '1 x bed; 2 x nightstands; 1 x dresser; 1 x mirror; 1 x stool', 'Test 6: piece-by-piece inventory from E6: ' + c6.inventory.join('; '));
  ok(!c8.notes.some(n => /not told to be left out/.test(n)), 'old rule note is gone');
  // 2. The old 21:46 sheet ("bed + nightstands"): the reader marked the nightstand as room context, so A7 holds and asks; no call is planned.
  r = await plan([row('Test 8', 3, '1 bed; 2 nightstands', 'bed'), row('Test 6', 6, '1 bed; 2 nightstands; 1 dresser; 1 mirror; 1 stool', 'bedroom set')], { 'Test 6': 6 });
  const h8 = r.cases.find(c => c.folder === 'Test 8');
  ok(h8.status === 'skipped' && /room context; A7 holds and asks the owner/.test(h8.reason), 'context named in the inventory → held, no call: ' + h8.reason);
  ok(r.orders.every(o => o.folder !== 'Test 8') && r.orders.some(o => o.folder === 'Test 6'), 'only Test 6 planned when Test 8 is held');
  // 3. A context piece whose kind is already covered by product pieces does not hold (same as A7: nothing is missing).
  const eye6b = JSON.parse(JSON.stringify(eye6)); eye6b.pieces.push({ label: 'nightstand in the background', kind: 'nightstand', role: 'context' });
  readings[1].eye_raw = JSON.stringify(eye6b);
  r = await plan([row('Test 8', 1, '1 bed', 'bed'), row('Test 6', 6, '1 bed; 2 nightstands; 1 dresser; 1 mirror; 1 stool', 'bedroom set')]);
  ok(r.cases.find(c => c.folder === 'Test 6').status === 'planned', 'extra context nightstand while 2 product nightstands are seen → planned, as in A7');
  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR ' + e.stack); process.exit(1); });
