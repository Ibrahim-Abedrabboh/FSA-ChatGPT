// Stage 04 tests (15 Oct 2026). Every Google, Drive and table answer is simulated. No network, no paid call.
const { scenario, autoPlan, REGISTRY, approved, done, IMG } = require('./harness');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const prod = () => ({ photo: { data: PNG, mimeType: 'image/png', fileName: 'sofa.png' } });
const sofaInv = [{ item: 'left-arm piece', count: 1 }, { item: 'armless piece', count: 4 }, { item: 'corner piece', count: 1 }, { item: 'right-arm piece', count: 1 }];
const piece = (k, role) => ({ label: k, kind: k, box: [100, 100, 400, 300], seen_whole: true, role: role || 'product' });
const sevenEye = { category: 'sectional sofa', pieces: [piece('left-arm piece'), piece('armless'), piece('armless'), piece('armless'), piece('armless'), piece('corner'), piece('right-arm piece'), piece('rug', 'context')], signs: [], printed_counts: [], colour_observed: 'warm grey', design_locks: ['boucle grey upholstery'], sided_parts: ['left-arm piece', 'right-arm piece'], unknowns: ['back of the sofa'], cropped: false };
// 16 Oct 2026 (owner, 04:16): the base job asks for "Wide view + close-up" (white master, wide, detail), see run_tests.js.
const base = (extra) => Object.assign({ clientRunId: 'claude-test-a7-0004', mode: 'manual', job: { type: 'New Project', workOn: 'one_by_one' }, item: { productType: 'Sectional sofa', inventory: sofaInv }, scope: { outcomes: ['Lifestyle'], view: 'Wide view + close-up', imageCount: 3 }, references: [{ name: 'sofa.png', role: 'Product' }] }, extra);
const job = (s04, extra) => ({ payload: base(extra || {}), binary: prod(), eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'go' }], s04 });
const today = new Date().toISOString().slice(0, 10);
const SECRET = 'AIzaFAKEKEY1234567890';
const noSecret = r => !JSON.stringify(r.vault).includes(SECRET) && !JSON.stringify(r.rows).includes(SECRET) && !JSON.stringify(r.s04 || {}).includes(SECRET);
const ev = (r, k) => r.vault.filter(e => e.kind === k && e.stage === '04');
const pay = r => JSON.parse(ev(r, 'operation')[0].payload);
const holdNoPay = r => r.path === 'hold' && r.out.hold_for === 'owner' && r.out.stage === '04 Compile & dispatch' && r.out.stage04.paid_call === 'no' && /No paid image call was made/.test(r.out.next) && r.row.stage === '04 Compile & dispatch';
const tests = [
  { name: 'T1 go with the settings as shipped (no Drive folder, both models trial) → hold before reserving, nothing sent', sc: job({ settings: { drive_root_folder_id: '' } }),
    check: r => holdNoPay(r) && /No Google Drive folder/.test(r.out.hold_reason) && r.out.critical.some(c => /No image model is approved yet/.test(c.why)) && !r.s04.reserved && ev(r, 'compile').length === 1 && !ev(r, 'operation').length
      && r.events.filter(k => k === 'brief').length === 1 && r.vault.find(e => e.kind === 'status' && e.stage === '04') },
  { name: 'T2 Drive folder set, models still trial → hold "no image model is approved"', sc: job({}),
    check: r => holdNoPay(r) && /No image model is approved yet/.test(r.out.hold_reason) && /gemini-nano-banana-2\.1 \(trial\)/.test(r.out.hold_reason) },
  { name: 'T3 approved model: reserve, send, two checks, candidate saved to Drive → awaiting review', sc: job({ registry: approved() }),
    check: r => {
      const o = r.out, b = r.s04.body, w = o.stage04.orders.find(x => x.output_id === 'white_master');
      return r.path === 'awaiting_review' && /candidate: not reviewed and not approved/.test(o.next) && /Stage 05 reviews it next/.test(o.next)
        && b.model === 'gemini-nano-banana-2.1' && b.input[0].type === 'text' && b.input[1].type === 'image' && b.input[1].data === PNG && b.input.length === 2 && b.background === undefined && b.store === false && b.response_format.aspect_ratio === '1:1' && b.response_format.image_size === '2K' && !b.generation_config
        && /Total product pieces: 7\. No more and no fewer\./.test(b.input[0].text) && /Handedness, fixed\..*left-arm piece; right-arm piece/.test(b.input[0].text) && /shown with: rug/.test(b.input[0].text) && /Not confirmed from the photos or the brief: back of the sofa/.test(b.input[0].text) && /boucle grey upholstery/.test(b.input[0].text)
        && w.dispatch_now && o.stage04.orders.filter(x => !x.dispatch_now).length === 2 && o.stage04.orders.filter(x => !x.dispatch_now).every(x => /go 2 on the white master/.test(x.waits_for))
        && r.s04.polls === 2 && r.s04.op_update.status === 'completed' && r.s04.op_update.actual_usd === 0.0567 && /not an invoice/.test(r.s04.op_update.cost_basis) && r.s04.op_update.image_px === '2048x2048' && r.s04.op_update.drive_file_id === 'file-55'
        && r.s04.receipt_binary && r.s04.receipt_binary.image.fileName === 'claude-test-a7-0004_white_master_try1.png'
        && ev(r, 'candidate').length === 1 && JSON.parse(ev(r, 'candidate')[0].payload).drive_sha256_matches === true && pay(r).status === 'completed' && pay(r).provider_request_id === 'int_abc123'
        && r.row.status === 'awaiting_review' && JSON.parse(r.row.stage04).candidate.drive_file_id === 'file-55' && !/Total product pieces/.test(r.row.stage04)
        && r.s04.op_row.operation_key === o.run_id + ':white_master:try1' && r.s04.op_row.status === 'reserved' && r.s04.op_row.reserved_usd > 0.05 && r.s04.op_row.reserved_usd < 0.1
        && !r.vault.some(e => e.payload.indexOf(IMG) !== -1) && !JSON.stringify(r.row).includes(IMG);
    } },
  { name: 'T4 Google refuses (HTTP 400) → failed_not_started, not charged, hold, not resent', sc: job({ registry: approved(), submit: { statusCode: 400, body: { error: { status: 'INVALID_ARGUMENT', message: 'bad aspect ratio' } } } }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'failed_not_started' && r.s04.op_update.actual_usd === 0 && /refused/.test(r.out.hold_reason) && /^refused before start/.test(r.out.stage04.paid_call) && /A request was sent, and Google refused it before starting/.test(r.out.next) && r.s04.polls === 0 },
  { name: 'T5 no answer, error text holds the key → uncertain, may be charged, key removed everywhere', sc: job({ registry: approved(), submit: { error: { message: 'request to https://generativelanguage.googleapis.com/v1beta/interactions?key=' + SECRET + ' failed, reason: socket hang up' } } }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'uncertain_no_id' && /may be charged/.test(r.out.hold_reason) && /key=\[removed\]/.test(r.out.hold_reason) && /^yes/.test(r.out.stage04.paid_call) && /made or may have been made/.test(r.out.next) && noSecret(r) },
  { name: 'T6 still running after the last check → uncertain, request id kept, never resent', sc: job({ registry: approved(), settings: { max_polls: 3 }, polls: [{ statusCode: 200, body: { id: 'int_abc123', status: 'in_progress' } }] }),
    check: r => r.path === 'hold' && r.s04.polls === 3 && r.s04.op_update.status === 'uncertain' && /int_abc123/.test(r.out.hold_reason) && /not sent again/.test(r.out.hold_reason) && r.s04.op_update.actual_usd === r.s04.op_row.reserved_usd },
  { name: 'T7 daily limit reached → hold before the Drive folder and the reservation', sc: job({ registry: approved(), settings: { daily_image_limit: 2 }, ops: [{ id: 101, operation_key: 'a:x:try1', run_id: 'a', day: today, status: 'completed', actual_usd: 0.05 }, { id: 102, operation_key: 'b:x:try1', run_id: 'b', day: today, status: 'uncertain', reserved_usd: 0.07 }, { id: 103, operation_key: 'c:x:try1', run_id: 'c', day: today, status: 'failed_not_started' }] }),
    check: r => holdNoPay(r) && /daily limit of 2/.test(r.out.hold_reason) && /2 used today/.test(r.out.hold_reason) && !r.s04.reserved },
  { name: 'T8 the same operation key already exists → never sent twice', sc: job({ registry: approved(), ops: [] }), pre: (sc) => { sc.s04.opsFn = true; },
    check: null },
  { name: 'T9 job estimate already used up → hold before reserving', sc: null, check: null },
  { name: 'T10 vendor photo changed after intake → not sent, reservation marked not_sent', sc: job({ registry: approved(), tamper: true }),
    check: r => holdNoPay(r) && /checksum differs/.test(r.out.hold_reason) && r.s04.op_update.status === 'not_sent' && r.s04.reserved },
  { name: 'T11 frame not listed for the approved model → hold, frame not changed', sc: job({ registry: approved({ ratios: '16:9|9:16' }) }),
    check: r => holdNoPay(r) && /does not list the frame 1:1/.test(r.out.hold_reason) },
  { name: 'T12 Drive folder could not be made → not sent, not paid', sc: job({ registry: approved(), folder: { error: { message: 'File not found: root-folder-1' } } }),
    check: r => holdNoPay(r) && /run folder could not be made in Google Drive/.test(r.out.hold_reason) && r.s04.op_update.status === 'not_sent' },
  { name: 'T13 image made but the Drive upload failed → paid, completed_not_stored, hold', sc: job({ registry: approved(), upload: { error: { message: 'quota exceeded' } } }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'completed_not_stored' && /^yes/.test(r.out.stage04.paid_call) && /only in this n8n execution/.test(r.out.hold_reason) && !ev(r, 'candidate').length },
  { name: 'T14 completed with no image → completed_no_image, hold', sc: job({ registry: approved(), polls: [{ statusCode: 200, body: { id: 'int_abc123', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'I cannot' }] }], usage: { total_input_tokens: 2000, total_output_tokens: 10 } } }] }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'completed_no_image' && r.s04.op_update.actual_usd > 0 },
  { name: 'T15 Google ends as failed with usage → failed, charge kept, no retry', sc: job({ registry: approved(), polls: [{ statusCode: 200, body: { id: 'int_abc123', status: 'failed', errors: [{ code: 'x', message: 'safety block' }], usage: { total_input_tokens: 2600, total_output_tokens: 0 } } }] }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'failed' && /confirmed failure keeps its charge/.test(r.out.hold_reason) && r.s04.op_update.actual_usd === 0.0039 && r.s04.polls === 1 },
  { name: 'T16 reservation not saved → nothing sent', sc: job({ registry: approved(), insert: { error: 'table locked' } }),
    check: r => holdNoPay(r) && /reservation could not be saved/.test(r.out.hold_reason) && !r.s04.body },
  { name: 'T17 Google answers "completed" at once → no checks, candidate saved', sc: job({ registry: approved(), submit: done() }),
    check: r => r.path === 'awaiting_review' && r.s04.polls === 0 && ev(r, 'candidate').length === 1 },
  { name: 'T18 image returned as a link only → paid, hold, download not built', sc: job({ registry: approved(), polls: [{ statusCode: 200, body: { id: 'int_abc123', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'image', uri: 'https://x/img' }] }], usage: { total_input_tokens: 2000, total_output_tokens: 1680 } } }] }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'completed_not_stored' && /link only/.test(r.out.hold_reason) },
  { name: 'T19 operations table unreadable → hold, nothing sent', sc: job({ registry: approved(), opsError: true }),
    check: r => holdNoPay(r) && /operations table could not be read/.test(r.out.hold_reason) },
  { name: 'T20 Drive checksum differs from the image → hold', sc: job({ registry: approved(), upload: { id: 'file-55', sha256Checksum: 'f'.repeat(64), webViewLink: 'x' } }),
    check: r => r.path === 'hold' && /checksum differs/.test(r.out.hold_reason) && r.s04.op_update.drive_file_id === 'file-55' },
  { name: 'T21 white background only, 4K brief, thinking set → size 4K, thinking sent, candidate', sc: { payload: base({ scope: { outcomes: ['White BK'], resolution: '4K' } }), binary: prod(), eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'go' }], s04: { registry: approved(), settings: { thinking_level: 'minimal' } } },
    check: r => r.path === 'awaiting_review' && r.s04.body.response_format.image_size === '4K' && r.s04.body.generation_config.thinking_level === 'minimal' && r.out.stage04.orders.length === 1 },
  { name: 'T22 two approved rows → lower priority number wins', sc: job({ registry: [{ ...REGISTRY[0], status: 'approved', priority: 5 }, { ...REGISTRY[0], id: 3, model_id: 'gemini-x-image', status: 'approved', priority: 1 }] }),
    check: r => r.s04.body && r.s04.body.model === 'gemini-x-image' },
  { name: 'T23 registry row points to another address → hold (the address is fixed in the request node)', sc: job({ registry: approved({ endpoint: 'https://evil.example.com/v1beta/interactions' }) }),
    check: r => holdNoPay(r) && /names another address/.test(r.out.hold_reason) },
  { name: 'T24 owner says stop → stage 04 never runs', sc: { payload: base({}), binary: prod(), eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'stop' }], s04: { registry: approved() } },
    check: r => r.path === 'stopped_by_owner' && r.s04 === null && !r.events.includes('compile') }
  ,
  // --- 15 Oct 2026: regressions from the independent review of stage 04 ---
  { name: 'T25 vendor photo cropped → hold at compile, nothing reserved', sc: job({ registry: approved() }, {}), eyePatch: { cropped: true },
    check: r => holdNoPay(r) && /cropped/.test(r.out.hold_reason) && !r.s04.reserved },
  { name: 'T26 photo shows 5 pieces, contract holds 7 → hold, missing pieces are not invented', sc: null, check: null },
  { name: 'T27 operations read passes its input through (no error flag) → hold, nothing sent', sc: job({ registry: approved(), opsPassThrough: true }),
    check: r => holdNoPay(r) && /operations table could not be read/.test(r.out.hold_reason) && !r.s04.reserved },
  { name: 'T28 Drive upload passes its input through → completed_not_stored, hold', sc: job({ registry: approved(), uploadPassThrough: true }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'completed_not_stored' && /upload step failed/.test(r.out.hold_reason) && !ev(r, 'candidate').length },
  { name: 'T29 receipt update matches no row → hold, not awaiting review', sc: job({ registry: approved(), save: {} }),
    check: r => r.path === 'hold' && r.out.critical.some(c => /receipt could not be written/.test(c.why)) && r.out.stage04.operation.receipt_saved === false },
  { name: 'T30 receipt update passes its input through → hold', sc: job({ registry: approved(), savePassThrough: true }),
    check: r => r.path === 'hold' && r.out.stage04.operation.receipt_saved === false },
  { name: 'T31 Google returns a 3-byte "image" → completed_bad_image, paid, hold, no crash', sc: job({ registry: approved(), polls: [{ statusCode: 200, body: { id: 'int_abc123', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'image', data: Buffer.from('abc').toString('base64') }] }], usage: { total_input_tokens: 2000, total_output_tokens: 1680 } } }] }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'completed_bad_image' && /^yes/.test(r.out.stage04.paid_call) },
  { name: 'T32 error text with "key":"AIza..." → removed everywhere', sc: job({ registry: approved(), submit: { error: { message: '{"error":"bad","key":"' + SECRET + '","x":1} and ' + SECRET } } }),
    check: r => r.path === 'hold' && noSecret(r) && /\[removed\]/.test(r.out.hold_reason) },
  { name: 'T33 HTTP 408 at send → uncertain (may have started), never resent', sc: job({ registry: approved(), submit: { statusCode: 408, body: {} } }),
    check: r => r.path === 'hold' && r.s04.op_update.status === 'uncertain_no_id' && /^yes/.test(r.out.stage04.paid_call) },
  { name: 'T34 repair attempt 4 → hold (at most two repairs per image)', sc: job({ registry: approved(), repair: { white_master: { attempt: 4, corrections: ['x'], preserve: [] } } }),
    check: r => holdNoPay(r) && /at most two repairs/.test(r.out.hold_reason) },
  { name: 'T35 repair attempt 2 → corrections and preserve list in the prompt, key try2', sc: job({ registry: approved(), repair: { white_master: { attempt: 2, corrections: ['the right arm was missing'], preserve: ['seven pieces', 'boucle grey upholstery'] } } }),
    check: r => r.path === 'awaiting_review' && /:white_master:try2$/.test(r.s04.op_row.operation_key) && /Corrections required[\s\S]*the right arm was missing/.test(r.s04.body.input[0].text) && /Keep unchanged while correcting: seven pieces; boucle grey upholstery/.test(r.s04.body.input[0].text) },
  { name: 'T36 white prompt never asks to draw unseen parts; studio camera line', sc: job({ registry: approved() }),
    check: r => { const t = r.s04.body.input[0].text; return !/complete that part/.test(t) && !/fully visible/.test(t) && /Never draw a part of the product that the vendor photo does not show/.test(t) && /not turned to show sides the vendor photo does not show/.test(t) && !/three-quarter/.test(t) && /read from image 1/.test(t); } },
  { name: 'T37 an earlier try with this key stopped before payment → hold, send the job again', sc: job({ registry: approved(), opsFromRun: (runId) => [{ id: 120, operation_key: runId + ':white_master:try1', run_id: runId, day: today, status: 'not_sent' }] }),
    check: r => holdNoPay(r) && /stopped before payment/.test(r.out.hold_reason) && /send the job again/.test(r.out.hold_reason) }
];
// T8 and T9 need the run id, which is made inside the run: they use a guard that reads it from the state.
const t26 = tests.findIndex(t => /^T26/.test(t.name));
tests[t26] = { name: 'T26 photo shows 5 pieces, contract holds 7 → hold, missing pieces are not invented', sc: { ...job({ registry: approved() }), eye: { ...sevenEye, pieces: sevenEye.pieces.slice(0, 5) }, second: { total: 5 }, luna: { conflicts: [{ topic: 'piece_count', severity: 'minor', resolution: 'client_wins', reason: 'The client knows the set.' }], instruction_locks: [] } },
  check: r => holdNoPay(r) && /contract holds 7/.test(r.out.hold_reason) && !r.s04.reserved };
const t25 = tests.findIndex(t => /^T25/.test(t.name));
// 16 Oct 2026 (live test): a crop flag counts only when a product box touches a frame edge, so the cropped case has one piece cut at the right edge.
tests[t25].sc.eye = { ...sevenEye, cropped: true, pieces: sevenEye.pieces.map((p, i) => i === 6 ? { ...p, box: [100, 760, 400, 1000] } : p) };
tests.push({ name: 'T41 reader says cropped but every product box is inside the frame (Test 10, execution 450) → not held, the flag is kept as a note', sc: { ...job({ registry: approved() }), eye: { ...sevenEye, cropped: true } },
  check: r => r.path === 'awaiting_review' && /treated as not cropped/.test(JSON.parse(r.row.observation).crop_note) && JSON.parse(r.row.observation).cropped === false });
tests.push({ name: 'T42 reader says cropped and gives no product box → still held (nothing to check it against)', sc: { ...job({ registry: approved() }), eye: { ...sevenEye, cropped: true, pieces: sevenEye.pieces.map(p => ({ ...p, box: null })) } },
  check: r => r.path === 'hold' && /cropped/.test(r.out.hold_reason) && !r.s04.reserved });
tests[7] = { name: 'T8 the same operation key already exists → never sent twice', sc: job({ registry: approved(), opsFromRun: (runId) => [{ id: 104, operation_key: runId + ':white_master:try1', run_id: runId, day: today, status: 'uncertain', provider_request_id: 'int_old', reserved_usd: 0.07 }] }),
  check: r => holdNoPay(r) && /already exists \(status uncertain, Google request int_old\)/.test(r.out.hold_reason) && /never sent twice/.test(r.out.hold_reason) };
tests[8] = { name: 'T9 job estimate already used up → hold before reserving', sc: job({ registry: approved(), opsFromRun: (runId) => [{ id: 105, operation_key: runId + ':white_master:try0', run_id: runId, day: '2026-10-01', status: 'completed', actual_usd: 50 }] }),
  check: r => holdNoPay(r) && /past its estimate/.test(r.out.hold_reason) };
// 16 Oct 2026 (first paid test, execution 444): Google refused background mode with reference photos, so A7 now sends one synchronous
// call that is not stored at Google, as the model test did. Such an answer is finished and carries no request id.
const doneNoId = () => { const d = done(); delete d.body.id; return d; };
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]).toString('base64');
tests.push({ name: 'T38 synchronous answer, finished, no request id → read at once, no checks, candidate saved, no id recorded', sc: job({ registry: approved(), submit: doneNoId() }),
  check: r => r.path === 'awaiting_review' && r.s04.polls === 0 && ev(r, 'candidate').length === 1 && r.s04.op_update.status === 'completed' && pay(r).provider_request_id === '' && r.s04.body.store === false && r.s04.body.background === undefined });
tests.push({ name: 'T39 synchronous answer without id that is not finished → uncertain, never resent', sc: job({ registry: approved(), submit: { statusCode: 200, body: { status: 'in_progress' } } }),
  check: r => r.path === 'hold' && /without a request id/.test(r.out.hold_reason) && r.s04.polls === 0 && !ev(r, 'candidate').length });
tests.push({ name: 'T40 photo recorded as image/png whose bytes are JPEG → sent as image/jpeg, noted', sc: { ...job({ registry: approved() }), binary: { photo: { data: JPG, mimeType: 'image/png', fileName: 'main.jpg' } } },
  check: r => r.s04.body && r.s04.body.input[1].mime_type === 'image/jpeg' && r.path === 'awaiting_review' });
(async () => {
  let pass = 0; const rows = [];
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  for (const t of tests) {
    if (only && !only.test(t.name)) continue;
    let ok = false, info = '';
    try {
      const r = await scenario(t.sc); ok = Boolean(t.check(r));
      info = r.path + ' | ' + (r.out.hold_reason || r.out.next || '').slice(0, 220) + (r.s04 && r.s04.op_update ? ' | op ' + r.s04.op_update.status : '');
    } catch (e) { info = 'ERROR ' + e.stack.split('\n').slice(0, 3).join(' / '); }
    if (ok) pass++;
    rows.push({ test: t.name, ok, info });
    console.log((ok ? 'PASS ' : 'FAIL ') + t.name + '\n     ' + info);
  }
  console.log(pass + '/' + rows.length + ' passed');
  require('fs').writeFileSync(__dirname + '/local_results04.json', JSON.stringify(rows, null, 1));
})();
