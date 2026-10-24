// Local tests for A7 Phase 1 (owner decisions D3-D10 and D12, findings P1.1-P1.10; 16 Oct 2026). Runs the n8n Code-node source with
// mocked node outputs and code-made images. No network, no AI call, no paid call.
// Run: node tests/claude-midas-a7-phase-1/run_tests_phase1.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const clone = x => JSON.parse(JSON.stringify(x));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let pass = 0, failN = 0;
function ok(cond, name, extra) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name + (extra !== undefined ? ' | ' + extra : '')); } }
const ref = (buf, mime) => ({ _buf: buf, mimeType: mime || 'application/octet-stream' });
async function run(file, nodes, input, execution) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = input || [];
  const $input = { first: () => items[0], all: () => items };
  const helpers = {
    getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b._buf) throw new Error('no binary ' + prop); return b._buf; },
    prepareBinaryData: async (buf, fileName, mimeType) => ({ _buf: buf, fileName, mimeType })
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFn('$', '$input', '$execution', 'require', fs.readFileSync(path.join(NODES, file), 'utf8'));
  return fn.call({ helpers }, $, $input, execution || { resumeUrl: 'https://n8n.example/webhook-waiting/999' }, require);
}
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
delete base.events; delete base.row;
const BIN = { mimeType: 'image/png', data: 'iVBORw0KGgo=' };
const WHITE_KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'framing', 'no_text_or_logo', 'realism'];
const SCENE_KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'framing', 'camera_level', 'light', 'no_text_or_logo', 'realism'];
// Replies in the providers' own (not simplified) shapes, with usage (P1.8).
const anthropic = (obj, usage) => ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'thinking', thinking: '', signature: 'abc' }, { type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn', usage: usage || { input_tokens: 5000, output_tokens: 1200 } });
const gemini = (obj, usage) => ({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(obj) + '\n```', thoughtSignature: 'xyz' }], role: 'model' }, finishReason: 'STOP' }], usageMetadata: usage || { promptTokenCount: 1300, candidatesTokenCount: 200, thoughtsTokenCount: 900, totalTokenCount: 2400 } });
const openai = (obj, usage) => ({ id: 'resp_1', object: 'response', status: 'completed', instructions: 'Return one JSON object only: {"example": true, "shots": []}', output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(obj) }] }], usage: usage || { input_tokens: 3000, output_tokens: 800 } });
const checksOf = (keys, over, seen) => Object.assign(Object.fromEntries(keys.map(k => [k, { result: 'pass', evidence: 'ok', ...(k === 'piece_count' ? { seen: seen || 7 } : {}) }])), over || {});
const critic = (keys, over, defects) => anthropic({ checks: checksOf(keys, over), defects: defects || [], scores: { fidelity: 90, integrity: 92, drift: 5, data_loss: 4 }, summary: 'ok' });
const blindObj = o => Object.assign({ pieces: [{ kind: 'sofa piece', count: 7 }], total: 7, background_white: true, text_or_logo: false, unclear: [], cropped: false, box_2d: [300, 120, 700, 880] }, o || {});
const PRICES = { read_on: '2026-10-16', assumed_image_tokens: 1600, output_caps: { review: 4000, blind: 8000, blind_fallback: 8000 }, models: { 'claude-sonnet-5-5': { input: 2, output: 10, source: 'x' }, 'gemini-3.8-flash': { input: 0.75, output: 3.75, source: 'y' }, 'gpt-6.1-sol': { input: 2, output: 10, source: 'z' }, 'gpt-6-luna': { input: 0.1, output: 0.5, source: 'z' } } };
const E503 = { error: 'Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)' };

(async () => {
  const st0 = clone(base); st0.text_prices = PRICES;
  const SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;
  // ---------- 16a ticket (white) ----------
  const t16 = await run('16a_Review_ticket.js', { 'V1 Vault events': [{ json: clone(st0) }], '02 Ingest files': [{ json: {}, binary: { photo: BIN } }], '15m Receipt': [{ json: {}, binary: { image: BIN } }] });
  const rvW = t16[0].json.rv;
  const n16 = (c, b, opts) => Object.assign({ 'V1 Vault events': [{ json: clone((opts && opts.st) || st0) }], '16a Review ticket': [{ json: { rv: Object.assign(clone(rvW), (opts && opts.rv) || {}) } }], '04 Settings': [{ json: { auto_repair: Boolean(opts && opts.auto) } }], '16 Critic review': [{ json: c }], '16x Blind count': [{ json: b }] }, opts && opts.back ? { '16xb Blind count fallback (OpenAI)': [{ json: opts.back }] } : {});
  const v16 = async (c, b, opts) => (await run('16b_Review_verdict.js', n16(c, b, opts)))[0].json;

  // ---------- P1.8: raw (not simplified) replies are read, token counts recorded ----------
  let s = await v16(critic(WHITE_KEYS), gemini(blindObj()));
  ok(s.status === 'awaiting_go_2' && s.review.result === 'passed', 'P1.8 16b reads the raw Anthropic and Gemini replies');
  const tc = s.text_calls_new;
  ok(tc.length === 2 && tc[0].model === 'claude-sonnet-5-5' && tc[0].tokens.input === 5000 && tc[0].tokens.output === 1200 && tc[0].usd === 0.022 && tc[1].tokens.output === 1100 && tc[1].usd === Number(((1300 * 0.75 + 1100 * 3.75) / 1e6).toFixed(5)), 'P1.8 16b records both calls with token counts and an estimated cost (Gemini output includes thinking)', JSON.stringify(tc));
  ok(/not an invoice/.test(tc[0].basis), 'P1.8 the cost is labelled an estimate');
  s = await v16(anthropic({ checks: checksOf(WHITE_KEYS), defects: [], scores: {}, summary: 'ok' }, {}), gemini(blindObj(), {}));
  ok(s.text_calls_new.every(c => c.tokens === null && c.usd === null && /no token counts/.test(c.basis)), 'P1.8 a reply without usage is recorded as "no token counts", never as zero');
  const v1 = (await run('V1_Vault_events.js', {}, [{ json: clone(s) }]))[0].json;
  ok(v1.events.filter(e => e.kind === 'text_call').length === 2 && v1.text_calls_new.length === 0, 'P1.8 V1 writes one text_call event per call and clears the list');

  // ---------- P1.10 + D3: not reviewed → go 2 with review again ----------
  s = await v16(critic(WHITE_KEYS, { colour: { result: 'fail', evidence: 'too beige' } }), E503);
  ok(s.status === 'awaiting_go_2' && s.go2.not_reviewed === true && s.go2.decisions.join() === 'review_again,stop' && s.go2_allowed.join() === 'review_again,stop', 'D3 blind count 503 → go 2 offers review_again or stop');
  ok(s.review.checks.colour.result === 'fail' && s.review.defects.some(d => d.check === 'colour') && /Only the reviewer answered/.test(s.review.partial) && s.review.result === 'not reviewed', 'P1.10 the reviewer\'s answer is kept when the blind count fails');
  ok(s.go2.review_again_cost && s.go2.review_again_cost.up_to_usd > 0 && s.go2.review_again_cost.up_to_usd < 0.5 && /No image call/.test(s.go2.review_again_cost.calls) && /estimate, not a quote/.test(s.go2.review_again_cost.basis), 'D3 the go 2 ticket shows the estimated cost of a review again before it runs: USD ' + (s.go2.review_again_cost && s.go2.review_again_cost.up_to_usd));
  ok(/not reviewed, not approved/.test(s.go2.label) && /review again/.test(s.go2.decision_needed) && !s.go2_proposed_repair, 'D3 the ticket says "not reviewed"; no repair is proposed for an unreviewed image');
  const notRev = s;
  // V1 row tells the decision address which decisions this ticket offers.
  const v1nr = (await run('V1_Vault_events.js', {}, [{ json: clone(notRev) }]))[0].json;
  ok(JSON.parse(v1nr.row.review).go2_decisions.join() === 'review_again,stop', 'D3 the run row carries the ticket\'s decisions');
  const row = { client_run_id: notRev.client_run_id, status: 'awaiting_go_2', run_id: notRev.run_id, go2_round: 1, go2_token: notRev.go2_token, resume_url: 'https://n8n.example/webhook-waiting/999', review: v1nr.row.review, required_outputs: '[]' };
  const g1b = async (body) => (await run('G1b_Decision_check.js', { 'A7 owner decision webhook': [{ json: { body, webhookUrl: 'https://n8n.example/webhook/claude-midas-a7-decision' } }] }, [{ json: row }]))[0].json;
  let d = await g1b({ id: notRev.client_run_id, run_id: notRev.run_id, round: 1, decision: 'approve' });
  ok(d.ok === 'no' && /review_again, stop/.test(d.reply.problem), 'D3 the decision address refuses "approve" on a not-reviewed ticket');
  d = await g1b({ id: notRev.client_run_id, run_id: notRev.run_id, round: 1, decision: 'review_again' });
  ok(d.ok === 'yes' && d.answer.decision === 'review_again', 'D3 the decision address forwards review_again');
  const f = (await run('G1d_Forward_result.js', { 'G1b Decision check': [{ json: { gate: 'go2', id: 'x', decision: 'review_again', at: 't' } }] }, [{ json: {} }]))[0].json;
  ok(/run once more on the stored image \(no image call\)/.test(f.reply.next), 'D3 the forward reply explains review again');
  // G2: review again → awaiting_review, recorded once.
  notRev.text_calls_new = [];
  const g2 = async (stx, body) => (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: clone(stx) }] }, [{ json: { body: Object.assign({ run_id: stx.run_id, round: 1, go2_token: stx.go2_token }, body) } }]))[0].json;
  s = await g2(notRev, { decision: 'approve' });
  ok(s.go2_route === 'rewait' && !s.go2_last, 'D3 G2 ignores a decision the ticket does not offer');
  s = await g2(notRev, { decision: 'review_again' });
  ok(s.status === 'awaiting_review' && s.review_again.output_id === 'white_master' && s.review_again.attempt === 1 && s.go2_last.decision === 'review_again' && s.go2_last.by === 'owner' && s.review_again.cost_shown.up_to_usd > 0, 'D3 G2 review_again → back to the review (awaiting_review), recorded with the cost shown');
  // The second review does not answer either → approve by eye offered.
  const afterRa = s;
  s = await v16(critic(WHITE_KEYS), E503, { st: afterRa });
  ok(s.status === 'awaiting_go_2' && s.go2.not_reviewed && s.go2.review_again_used === true && s.go2.decisions.join() === 'approve_unreviewed,stop' && !s.go2.review_again_cost && /approve it by eye/.test(s.go2.decision_needed) && s.review.review_again && /\(review again\)/.test(s.trail[s.trail.length - 1].note), 'D3 the review again also fails → approve_unreviewed or stop; no second review again');
  // The second review answers → a normal go 2.
  const ok2 = await v16(critic(WHITE_KEYS), gemini(blindObj()), { st: afterRa });
  ok(ok2.status === 'awaiting_go_2' && !ok2.go2.not_reviewed && ok2.go2.decisions.join() === 'approve,stop,repair' && ok2.review.result === 'passed', 'D3 the review again answers → a normal go 2 (approve, stop, repair)');
  const twice = s; twice.text_calls_new = [];
  s = await g2(twice, { decision: 'approve_unreviewed', note: 'looked at it, fine' });
  ok(s.status === 'white_master_approved' && s.approved.without_review === true && s.approved.review_result === 'not reviewed' && s.approved.approval_kind === 'approved by owner without an automated review' && s.go2_last.decision === 'approve_unreviewed', 'D3 approve_unreviewed → approved, recorded "approved by owner without an automated review"');
  const pk18 = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: Object.assign(clone(s), { approved: Object.assign(clone(s.approved), { candidate: Object.assign({}, s.approved.candidate, { drive_file_id: 'd', sha256: s.approved.candidate.sha256 }) }) }) }], '04 Settings': [{ json: SETTINGS }] }))[0].json.pk;
  ok(pk18.ok === true && pk18.approval.without_review === true && pk18.approval.approval_kind === 'approved by owner without an automated review', 'D3 the package accepts the approval by eye and carries its label');
  const g2a = await g2(ok2, { decision: 'approve_unreviewed' });
  ok(g2a.go2_route === 'rewait', 'D3 approve_unreviewed is refused on a reviewed ticket');

  // ---------- D5: scene checks: fail vs note ----------
  const rvS = { kind: 'scene', output_id: 'hero', scene: { output_id: 'hero', kind: 'hero', framing: 'hero' }, framing: { type: 'hero', band_pct: [60, 70] }, candidate: Object.assign({}, rvW.candidate, { px: '2048x2048' }) };
  const stS = clone(st0); stS.outputs = [{ id: 'white_master', kind: 'white' }, { id: 'hero', kind: 'hero' }]; stS.scene = { output_id: 'hero', props: [], refs: [] };
  const vS = (over, b, defects) => v16(critic(SCENE_KEYS, over, defects), gemini(b || blindObj({ box_2d: [300, 150, 700, 820] })), { rv: rvS, st: stS });
  s = await vS({ light: { result: 'fail', evidence: 'too cold' }, camera_level: { result: 'fail', evidence: 'slight tilt' }, realism: { result: 'unsure', evidence: 'render look' } }, null, [{ check: 'light', fix: 'Warm the light to 4000 K.' }]);
  ok(s.review.result === 'passed' && s.review.defects.length === 0 && s.review.unsure.length === 0 && s.review.notes_only.map(x => x.check).join() === 'camera_level,light,realism', 'D5 light, camera level and realism are notes only: the scene passes', JSON.stringify(s.review.defects));
  ok(s.go2.notes_only.length === 3 && s.go2_proposed_repair && s.go2_proposed_repair.corrections.indexOf('Warm the light to 4000 K.') !== -1 && !s.repair_orders, 'D5 the notes are shown at go 2 and go into the proposed repair, which runs only if the owner orders it');
  for (const k of ['only_listed_props', 'no_unplanned_lamp', 'grounding', 'scale']) {
    s = await vS({ [k]: { result: 'fail', evidence: 'x' } });
    ok(s.review.result === 'failed' && s.review.defects.some(x => x.check === k) && s.status === 'awaiting_go_2' && !s.repair_orders, 'D5 a ' + k + ' fail fails the scene; it still goes to the owner\'s go 2, nothing repairs itself');
  }
  s = await v16(critic(SCENE_KEYS, { scale: { result: 'fail', evidence: 'x' } }), gemini(blindObj({ box_2d: [300, 150, 700, 820] })), { rv: rvS, st: stS, auto: true });
  ok(s.status === 'awaiting_go_2' && !s.repair_orders, 'D5 auto_repair true in 04 Settings is ignored: no automatic repair');
  const src16a = fs.readFileSync(path.join(NODES, '16a_Review_ticket.js'), 'utf8');
  ok(/fail only when the product is clearly the wrong size/.test(src16a) && /fail when any piece floats or is poorly grounded/.test(src16a), 'D5 the scene reviewer is told: scale fails only when clearly wrong; grounding when a piece floats');

  // D3 for a scene: not reviewed → review again → not reviewed again → approved by eye, recorded per scene.
  let sc = await v16(critic(SCENE_KEYS), E503, { rv: rvS, st: stS });
  ok(sc.go2.kind === 'scene' && sc.go2.not_reviewed && sc.go2.decisions.join() === 'review_again,stop', 'D3 scene: not reviewed → review again offered');
  sc.text_calls_new = [];
  sc = await g2(sc, { decision: 'review_again' });
  sc = await v16(critic(SCENE_KEYS), E503, { rv: rvS, st: sc });
  sc.text_calls_new = [];
  sc = await g2(sc, { decision: 'approve_unreviewed' });
  ok(sc.status === 'scene_approved' && sc.scenes.done.hero.without_review === true && sc.scenes.done.hero.approval_kind === 'approved by owner without an automated review' && /without an automated review/.test(sc.scenes.log[sc.scenes.log.length - 1].event), 'D3 scene: approved by eye is recorded per scene as "approved by owner without an automated review"');
  ok(/\['approve', 'approve_unreviewed'\]\.indexOf\(last\.decision\)/.test(fs.readFileSync(path.join(NODES, '20a_Scene_files_ticket.js'), 'utf8')) && /Approved by owner without an automated review/.test(fs.readFileSync(path.join(NODES, '20k_Scene_manifest.js'), 'utf8')), 'D3 scene files accept the approval by eye and the manifest says so');

  // ---------- D6: cut off by the frame, from the box ----------
  s = await vS({}, blindObj({ cropped: true, box_2d: [300, 150, 700, 820] }));
  ok(s.review.result === 'unsure' && !s.review.defects.some(x => x.check === 'whole_in_frame') && s.review.unsure.some(x => x.check === 'whole_in_frame' && /disagree, so this is unsure/.test(x.evidence)) && s.review.crop.box_edge === 150 && s.review.crop.disagree === true && !s.review.styling_notes.some(x => /cropped/.test(x)) && s.status === 'awaiting_go_2', 'D6 + review finding 5: "cropped" with the box well inside → unsure (not passed), never a quiet note; still to go 2');
  s = await vS({}, blindObj({ cropped: false, box_2d: [300, 5, 700, 820] }));
  ok(s.review.result === 'failed' && s.review.defects.some(x => x.check === 'whole_in_frame') && s.review.crop.cut_off === true && /reaches the frame edge \(5 of 1000/.test(s.review.checks.whole_in_frame.evidence), 'D6 a box at the frame edge fails "whole product in frame" even when the reader did not flag it');
  s = await vS({}, blindObj({ cropped: true, box_2d: undefined }));
  ok(s.review.result === 'failed' && s.review.crop.decided_by === 'the blind count\'s flag (no usable box)', 'D6 no usable box → the flag decides');
  s = await v16(critic(SCENE_KEYS), gemini(blindObj({ box_2d: [0, 0, 1000, 1000], cropped: true })), { rv: Object.assign(clone(rvS), { scene: { output_id: 'detail', kind: 'detail', framing: 'detail' }, framing: { type: 'detail', min_pct: 50 } }), st: stS });
  ok(!s.review.defects.some(x => x.check === 'whole_in_frame') && !s.review.crop, 'D6 a detail view is never failed for a crop');
  s = await v16(critic(WHITE_KEYS), gemini(blindObj({ cropped: true, box_2d: [330, 96, 700, 900] })));
  ok(s.review.result === 'unsure' && s.review.crop.box_edge === 96 && s.review.unsure.some(x => x.check === 'whole_in_frame'), 'D6 + finding 5: the same rule for the white master: flag and box disagree → unsure, not passed');
  s = await v16(critic(WHITE_KEYS), gemini(blindObj({ cropped: false, box_2d: [330, 96, 700, 900] })));
  ok(s.review.result === 'passed' && !s.review.crop.disagree && JSON.stringify(s.review.product_box_2d) === '[330,96,700,900]', 'D6 no flag and the box inside → passed; the product box is kept with the review (finding 1)');

  // ---------- D9: camera height; D10 stock; P1.6 wide framing ----------
  const pkgd = clone(st0);
  pkgd.status = 'white_package_ready'; pkgd.stage = '06 Package'; pkgd.go1_last = { decision: 'go', by: 'owner' };
  pkgd.approved = { output_id: 'white_master', attempt: 1, by: 'owner', candidate: { sha256: 'a'.repeat(64), drive_file_id: 'drive-master', file_name: 'x.png' } };
  pkgd.retrieval = { shortlist: [], rejected: [], notes: [] };
  pkgd.outputs = [{ id: 'white_master', kind: 'white' }, { id: 'wide', kind: 'wide', camera: 'Reference view', light: 'day', light_label: 'Daylight', from: '' }];
  pkgd.shots = [{ n: 1, output_id: 'white_master', kind: 'white', frame: 'square, 1:1', plan: {} }, { n: 2, output_id: 'wide', kind: 'wide', frame: 'square, 1:1', plan: { room: {}, midas_pieces: [], supporting_props: [] } }];
  let a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: clone(pkgd) }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.scene && a.scene.presets.camera.height_cm && !a.scene.presets.camera.height_rule, 'D9 room-scale furniture keeps the preset eye height (' + (a.scene && a.scene.presets.camera.family) + ', ' + (a.scene && a.scene.presets.camera.height_cm) + ' cm)');
  ok(/spans only about 40-55% of the frame, never more than 55%/.test(a.scene.framing.text) && /at least 23% of the frame on each side/.test(a.scene.framing.text), 'P1.6 the wide line names the upper limit and the room left on each side');
  const lamp = clone(pkgd); lamp.brief.product_type = 'Table lamp'; lamp.observation.category_seen = 'table lamp'; lamp.profile = { id: 'lighting', name: 'Lamps' };
  a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: lamp }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.scene.presets.camera.family === 'tabletop or lamp' && /level \(0 degrees tilt\), near the product's mid-height, seen from the same side as image 1/.test(a.scene.presets.camera.height_rule) && !a.scene.presets.camera.height_cm, 'D9 (owner 19:26) a lamp is shot near its mid-height at the vendor angle');
  const c13 = (await run('13_Compile.js', { 'V1 Vault events': [{ json: Object.assign(clone(a), { status: 'scene_due' }) }] }, [{ json: Object.assign({}, SETTINGS, { image_size: '2K' }) }]))[0].json.s04;
  const roomPrompt = c13.dispatch ? c13.dispatch.prompt : '';
  ok(/Camera: level \(0 degrees tilt\), at the height of the table or console top \(about 75 cm/.test(roomPrompt) && !/image 1/i.test(roomPrompt) && !/eye height about/.test(roomPrompt), 'D9 + finding 3: a table lamp\'s empty room (no images) is shot at the surface height and never names image 1', (c13.critical || []).map(x => x.why).join(' ') || roomPrompt.slice(0, 300));
  ok(a.scene.presets.camera.decided_by === 'product words (profile lighting)', 'Finding 4: an unknown profile id falls back to the product words');
  // Finding 4: the handling profile decides before the words.
  const tv = clone(pkgd); tv.brief.product_type = 'TV unit with LED lights'; tv.observation.category_seen = 'TV unit'; tv.profile = { id: 'storage', name: 'Cabinets, dressers & storage' };
  a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: tv }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.scene.presets.camera.family !== 'tabletop or lamp' && a.scene.presets.camera.height_cm && a.scene.presets.camera.decided_by === 'handling profile storage', 'Finding 4: a "TV unit with LED lights" (profile storage) is room-scale, not a lamp');
  const fl = clone(pkgd); fl.brief.product_type = 'Arc floor lamp'; fl.observation.category_seen = 'floor lamp'; fl.profile = { id: 'floor-lamp', name: 'Floor lamps' };
  a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: fl }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.scene.presets.camera.family === 'tabletop or lamp' && a.scene.presets.camera.room_rule === 'level, near the mid-height of the product that will stand there' && !/120/.test(a.scene.presets.camera.room_rule) && a.scene.presets.camera.decided_by === 'handling profile floor-lamp', 'Finding 3/4 (owner 19:26): a floor lamp is small by its profile; its empty room is shot near its mid-height, never at 120 cm');
  const vs = clone(pkgd); vs.brief.product_type = 'Sofa with lights'; vs.profile = { id: 'vase', name: 'Vases & pots' };
  a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: vs }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.scene.presets.camera.family === 'tabletop or lamp' && /75 cm/.test(a.scene.presets.camera.room_rule), 'Finding 4: the profile (vase) decides even when the words say "sofa"');
  const raise = SETTINGS.scenes.camera.raise;
  ok(/small downward tilt of a few degrees is allowed/.test(raise.text) && /large dining set/.test(raise.text), 'D9 a small downward tilt only for large dining sets, if chair backs hide pieces');
  // D10: retrieval offers in-stock pieces on midasfurniture.com/en/ only.
  const s10 = clone(base); s10.critical = []; s10.client_question = ''; s10.profile = Object.assign({}, s10.profile, { prop_policy: 'living' });
  s10.outputs = s10.outputs.concat([{ id: 'hero', kind: 'hero', outcome: 'lifestyle' }]);
  const rows = [
    { sku: '1001', name: 'VASE A', kind: 'vase', image_url: 'https://midasfurniture.com/media/a.jpg', url: 'https://midasfurniture.com/en/vase-a.html', availability: 'In stock', retrieved: '2026-10-16' },
    { sku: '1002', name: 'VASE B', kind: 'vase', image_url: 'https://midasfurniture.com/media/b.jpg', url: 'https://midasfurniture.com/en/vase-b.html', availability: 'Pre-order', retrieved: '2026-10-16' },
    { sku: '1003', name: 'TRAY C', kind: 'tray', image_url: 'https://midasfurniture.com/media/c.jpg', url: 'https://midasfurniture.com.sa/en/tray-c.html', availability: 'In stock', retrieved: '2026-10-16' }];
  const r10 = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: s10 }] }, rows.map(json => ({ json }))))[0].json;
  ok(r10.retrieval.shortlist.map(c => c.sku).join() === '1001' && r10.retrieval.rejected.some(x => /pre-order/.test(JSON.stringify(x))) && r10.retrieval.rejected.some(x => /Midas Kuwait English site/.test(JSON.stringify(x))), 'D10 retrieval: in stock on midasfurniture.com/en/ only; pre-order and other sites left out', JSON.stringify(r10.retrieval.rejected));
  const ps = { status: 'scene_preparing', scene: { output_id: 'x', phase: 'place', props: [{ sku: '1', name: 'A', kind: 'vase', url: 'https://midasfurniture.com.sa/en/a.html' }, { sku: '2', name: 'B', kind: 'tray', url: 'https://midasfurniture.com/en/b.html' }], props_left_out: [] }, trail: [] };
  const inStock = '<div class="stock available"><span>In stock</span></div><div>Product Size : &diams; Tray * W40 * D30 * H5 CM Qty Add to Cart Add Wishlist</div>';
  const v19 = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: ps }], '19b0 Prop page list': [{ json: { sku: '1', url: ps.scene.props[0].url } }, { json: { sku: '2', url: ps.scene.props[1].url } }] }, [{ json: { statusCode: 200, body: inStock } }, { json: { statusCode: 200, body: inStock } }]))[0].json;
  ok(v19.scene.props.map(p => p.sku).join() === '2' && v19.scene.props_left_out.some(x => x.sku === '1' && /Kuwait English site/.test(x.why)), 'D10 19c: a page outside midasfurniture.com/en/ is left out');
  ok(v19.scene.props[0].live.size_on_page === 'W 40 x D 30 x H 5 cm', 'P1.4 the size line keeps the measurements only (no "&diams;", no "Qty Add to Cart"): ' + v19.scene.props[0].live.size_on_page);
  const src13 = fs.readFileSync(path.join(NODES, '13_Compile.js'), 'utf8');
  ok(/Its role in the scene: /.test(src13) && !/\(p\.purpose \? ', as ' \+ p\.purpose/.test(src13), 'P1.4 the Midas piece line reads "Its role in the scene: …", not "as Provide …"');

  // ---------- P1.2: go 1 warns about a stage 04 hold ----------
  const s12 = clone(base); delete s12.shots; s12.retrieval = { shortlist: [], rejected: [], notes: [] }; s12.outputs = [{ id: 'white_master', kind: 'white' }]; s12.go1_rounds = 0;
  let g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: clone(s12) }]))[0].json;
  ok(g12.go1.stage04_precheck.will_hold.length === 0 && !/WARNING/.test(g12.go1.decision_needed) && /approved image model, the Drive folder, the daily image limit and the job budget/.test(g12.go1.stage04_precheck.also_checked_in_stage_04), 'P1.2 a clean plan: no warning; the settings checks are named');
  const crop = clone(s12); crop.observation.cropped = true;
  g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: crop }]))[0].json;
  ok(/WARNING: stage 04 will hold this plan before the paid call/.test(g12.go1.decision_needed) && /cropped/.test(g12.go1.stage04_precheck.will_hold[0]), 'P1.2 a cropped vendor photo is warned about at go 1');
  const fewer = clone(s12); fewer.observation.count_eye = 5; fewer.observation.count_second = 5;
  g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: fewer }]))[0].json;
  ok(g12.go1.stage04_precheck.will_hold.some(x => /shows 5 product pieces and the contract holds 7/.test(x)), 'P1.2 fewer pieces seen than the contract is warned about at go 1');

  // Run, not word-matched (review test gap): an inventory piece the photo reader marked as room context.
  const ctxS = clone(s12); ctxS.inventory = [{ item: 'dining chair', count: 6 }, { item: 'dining table', count: 1 }];
  ctxS.observation.pieces_seen = [{ kind: 'dining table', role: 'product' }].concat([1, 2, 3, 4].map(() => ({ kind: 'dining chair', role: 'product' }))).concat([{ kind: 'dining chair', role: 'context' }, { kind: 'dining chair', role: 'context' }]);
  g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: ctxS }]))[0].json;
  ok(g12.go1.stage04_precheck.will_hold.some(x => /lists 6 x chair, but the photo reader marked 2 such things as room context/.test(x)) && /WARNING/.test(g12.go1.decision_needed), 'P1.2 (run): inventory pieces read as room context are warned about at go 1', JSON.stringify(g12.go1.stage04_precheck.will_hold));

  // ---------- P1.3: the operations record says synchronous ----------
  // Run, not word-matched (review test gap): the operations row 15b writes for a paid call.
  const s04x = { settings: { daily_image_limit: 10, thinking_level: 'high' }, critical: [], reserve_usd: 0.07, reserve_basis: 'test', model: { model_id: 'gemini-nano-banana-2.1-agent', price_date: '2026-10-16' },
    dispatch: { output_id: 'white_master', attempt: 1, ratio: '1:1', size: '2K', prompt: 'p', prompt_sha256: 'a'.repeat(64), references: [{ n: 1, role: 'vendor photo', name: 'photo', sha256: 'b'.repeat(64) }] } };
  const g15 = (await run('15b_Dispatch_guard.js', { '13 Compile': [{ json: { run_id: 'claude-a7-test-0001', client_run_id: 'c', contract_stamp: 'x', cost_estimate: { max_two_repairs_each: 1 } } }], '14 Choose model': [{ json: { s04: s04x } }] }, [{ json: {} }]))[0].json.s04;
  const set15 = g15.op_row ? JSON.parse(g15.op_row.settings) : {};
  ok(g15.go === true && set15.background === false && set15.store === false && set15.mode === 'synchronous, not stored at Google' && set15.aspect_ratio === '1:1' && g15.op_row.status === 'reserved', 'P1.3 (run): 15b writes background false, store false, synchronous in the operations row', JSON.stringify(set15));

  // ---------- P1.7: background set to 255 (code-made images) ----------
  function bmp(w, h, f) { const st = Math.floor((24 * w + 31) / 32) * 4, b = Buffer.alloc(54 + st * h); b.write('BM', 0, 'latin1'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, bl] = f(x, y), p = 54 + (h - 1 - y) * st + x * 3; b[p] = bl; b[p + 1] = g; b[p + 2] = r; } return b; }
  function readBmp(b) { const off = b.readUInt32LE(10), w = b.readInt32LE(18), rawH = b.readInt32LE(22), h = Math.abs(rawH), st = Math.floor((24 * w + 31) / 32) * 4; return (x, y) => { const p = off + (rawH > 0 ? h - 1 - y : y) * st + x * 3; return [b[p + 2], b[p + 1], b[p]]; }; }
  const S = 1125;
  // A white-ish background at 250-252 with slight noise, a dark product, a soft shadow below it, and an ivory (240) product edge band.
  const noise = (x, y) => ((x * 7 + y * 13) % 3);
  const scene = (x, y) => {
    if (x > 300 && x < 825 && y > 350 && y < 760) { if (x < 306 || x > 819 || y < 356) return [238, 236, 228]; return [110, 120, 80]; }   // ivory rim, dark body
    if (x > 280 && x < 845 && y >= 760 && y < 800) { const t = (y - 760) / 40; const v = Math.round(170 + t * 78); return [v, v, v]; }        // contact shadow fading to 248
    const v = 250 + noise(x, y); return [v, v, v - 1];
  };
  const PIX = bmp(S, S, scene);
  // The approved review's box (box_2d, 0-1000) around the product (x 300-825, y 350-760 of 1125); the shadow lies below it.
  const toBox = (x0, y0, x1, y1) => [Math.round(y0 / S * 1000), Math.round(x0 / S * 1000), Math.round(y1 / S * 1000), Math.round(x1 / S * 1000)];
  const pkx = { cfg: { size_px: S, jpg_quality: 95 }, base: 'claude-test', ok: true, product_box_2d: toBox(300, 350, 825, 760) };
  const clean18 = async (pix, pk0) => (await run('18e3_Clean_background.js', { '18e Check master': [{ json: { pk: pk0 || pkx } }] }, [{ json: { pk: pk0 || pkx }, binary: pix ? { pix: ref(pix, 'image/bmp') } : {} }]))[0];
  // Measured by the test, independently of the node: pixels that differ inside a pixel rectangle.
  const diffIn = (A0, B0, x0, y0, x1, y1) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A0(x, y).join() !== B0(x, y).join()) n++; return n; };
  let e3 = await clean18(PIX);
  const wc = e3.json.pk.white_clean;
  ok(wc.done === true && e3.binary.clean && wc.background_255_after_pct > 85 && wc.product_box_pixels_changed === 0 && wc.darker_than_knee_changed === 0, 'P1.7 the background is set to 255 (' + wc.background_255_after_pct + '% of it); product-box and dark-pixel changes measured at 0', JSON.stringify(wc));
  const A = readBmp(PIX), B = readBmp(e3.binary.clean._buf);
  ok([[0, 0], [S - 1, S - 1], [100, 900], [1000, 200]].every(([x, y]) => B(x, y).join() === '255,255,255'), 'P1.7 corners and open background read 255');
  ok([[310, 400], [700, 700], [302, 500], [500, 352]].every(([x, y]) => B(x, y).join() === A(x, y).join()) && diffIn(A, B, 300, 350, 825, 760) === 0, 'P1.7 the product and its ivory rim are unchanged (every pixel of the product rectangle compared)');
  ok(B(500, 765).join() === A(500, 765).join() && B(500, 775).join() === A(500, 775).join(), 'P1.7 the contact shadow core is unchanged');
  // Review finding 1: the reviewer's case. An ivory side panel away from the centre, its outer edge soft, shaded from 251 down to 236,
  // on a background of 250-252. Before the fix the fill crossed it (steps of 6 or less) and brightened all of it.
  const ivory = (x, y) => {
    if (x > 250 && x < 600 && y > 300 && y < 800) return [95, 80, 70];                                   // dark body, left of centre
    if (x >= 600 && x < 980 && y > 300 && y < 800) { const v = Math.round(236 + 15 * (x - 600) / 379); return [v, v, Math.max(0, v - 2)]; } // panel 236 → 251 at its outer edge
    const v = 250 + noise(x, y); return [v, v, v - 1];
  };
  const IV = bmp(S, S, ivory);
  const pkIv = Object.assign({}, pkx, { product_box_2d: toBox(250, 300, 980, 800) });
  e3 = await clean18(IV, pkIv);
  const Ai = readBmp(IV), Bi = e3.binary ? readBmp(e3.binary.clean._buf) : null;
  ok(e3.json.pk.white_clean.done === true && Bi && diffIn(Ai, Bi, 600, 301, 979, 799) === 0 && e3.json.pk.white_clean.product_box_pixels_changed === 0, 'Finding 1: a soft-edged, off-centre ivory panel (251 to 236) is not changed at all (every panel pixel compared)', JSON.stringify(e3.json.pk.white_clean));
  ok(Bi && Bi(1100, 100).join() === '255,255,255' && Bi(1100, 1100).join() === '255,255,255', 'Finding 1: the background around it is still set to 255');
  // Outside the box the change fades in: a pixel just outside the widened box is changed less than one well away from it.
  const nearX = 980 + Math.ceil(15 / 1000 * S) + 3;
  ok(Bi && Bi(nearX, 550)[0] < 255 && Bi(nearX, 550)[0] >= Ai(nearX, 550)[0] && Bi(nearX + e3.json.pk.white_clean.ramp_px + 2, 550).join() === '255,255,255', 'Finding 1: the change fades in outside the box (no box-shaped step), ' + (Bi ? Bi(nearX, 550)[0] : '?') + ' then 255');
  // The same panel with the box wrongly missing it: the fill still only takes pixels at or above the white point plus a 3 px band.
  e3 = await clean18(IV, Object.assign({}, pkx, { product_box_2d: toBox(250, 300, 600, 800) }));
  const Bm = e3.binary ? readBmp(e3.binary.clean._buf) : null;
  // Residual risk, measured (README): only panel pixels already at or above the white point (248 here), and the 3 px band beside them
  // (247 and up on this gradient), can change; the shaded part below that never does.
  const top0 = e3.json.pk.white_clean.white_from ? e3.json.pk.white_clean.white_from[0] : 248;
  // Rows 301-303 and 797-799 touch the background, so they are in the 3 px band; deeper rows may change only at the white point.
  let deepChanged = 0, nearChanged = 0, edgeRows = 0; if (Bm) for (let y = 301; y < 800; y++) for (let x = 600; x < 980; x++) if (Ai(x, y).join() !== Bm(x, y).join()) { if (y < 304 || y > 796) edgeRows++; else if (Ai(x, y)[0] < top0 - 1) deepChanged++; else nearChanged++; }
  ok(Bm && deepChanged === 0 && nearChanged > 0, 'Finding 1 (residual risk, box missing the part): changes stay at the white point (' + nearChanged + ' px) or in the 3 px band at its edges (' + edgeRows + ' px); none deeper (' + deepChanged + ')');
  // Production regression: the approved 90%-wide box leaves margins narrower than 68 px.
  const widePk = { ...pkx, product_box_2d: [170, 56, 842, 955] };
  const widePix = bmp(S, S, (x,y) => x > 65 && x < 1070 && y > 192 && y < 947 ? [240,238,232] : [253,253,253]);
  e3 = await clean18(widePix, widePk);
  const Bw = e3.binary ? readBmp(e3.binary.clean._buf) : null;
  let badBorder = 0;
  if (Bw) for (let t=0;t<S;t++) for (let z=0;z<8;z++) for (const [x,y] of [[z,t],[S-1-z,t],[t,z],[t,S-1-z]]) if (Bw(x,y).join() !== '255,255,255') badBorder++;
  ok(Bw && badBorder === 0 && e3.json.pk.white_clean.side_ramps_px.right < 68 && diffIn(readBmp(widePix),Bw,65,192,1070,947) === 0, 'Narrow margins: eight edge pixels are fully white; every product pixel stays unchanged');
  ok(!e3.json.pk.white_clean.fit, 'Narrow but safe margins: the master keeps its own framing (no fit)');
  // No safe margin (owner, 20 Oct 2026, run claude-a7-4f80c2bf): the master is placed on a white canvas in code instead of holding.
  e3 = await clean18(widePix, { ...widePk, product_box_2d: [170,0,842,1000] });
  ok(e3.json.pk.ok === true && e3.binary && e3.json.pk.white_clean.done === true && e3.json.pk.white_clean.fit && e3.json.pk.white_clean.fit.scale === 0.76 && e3.json.pk.white_clean.fit.span_after_pct === 76, 'No safe margin: fitted on a white canvas (scale 0.76, span 76%) and cleaned, not held', JSON.stringify(e3.json.pk.white_clean.fit));
  // The production case: three sofas spanning 1.5% to 99.1% of the width, low in the frame, with a contact shadow below.
  const sofaBox = [516, 15, 736, 991];
  const sofa = (x, y) => {
    const X = x / S * 1000, Y = y / S * 1000;
    if (X > 16 && X < 990 && Y > 517 && Y < 735 && !(X > 330 && X < 345) && !(X > 660 && X < 675)) return [118, 112, 126];   // three sofas, gaps between
    if (X > 16 && X < 990 && Y >= 735 && Y < 760) { const v = Math.round(150 + (Y - 735) * 4); return [v, v, v]; }      // contact shadow
    const v = 251 + noise(x, y); return [v, v, v - 1];
  };
  const SOFA = bmp(S, S, sofa);
  e3 = await clean18(SOFA, { ...pkx, cfg: { ...pkx.cfg, fit_span_pct: 76 }, product_box_2d: sofaBox });
  const fit = e3.json.pk.white_clean.fit || {}, Bs = e3.binary ? readBmp(e3.binary.clean._buf) : null;
  let edgeNot255 = 0, greyBefore = 0, greyAfter = 0;
  if (Bs) for (let t = 0; t < S; t++) for (let z = 0; z < 8; z++) for (const [x, y] of [[z, t], [S - 1 - z, t], [t, z], [t, S - 1 - z]]) if (Bs(x, y).join() !== '255,255,255') edgeNot255++;
  const As = readBmp(SOFA);
  if (Bs) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { if (As(x, y).join() === '118,112,126') greyBefore++; if (Bs(x, y).join() === '118,112,126') greyAfter++; }
  const ratio = greyAfter / greyBefore, s2 = fit.scale * fit.scale;
  ok(e3.json.pk.ok === true && fit.done === true && fit.span_before_pct === 97.6 && fit.span_after_pct === 76 && fit.scale === 0.779, 'Production case (claude-a7-4f80c2bf): the 97.6%-wide master is fitted to 76% (scale 0.779), not held', JSON.stringify(fit));
  ok(Bs && edgeNot255 === 0 && Bs(Math.round(S / 2), Math.round(S / 2) - 20).join() === '118,112,126', 'Production case: eight edge pixels on every side are 255; the centre of the product keeps its exact colour');
  ok(Bs && Math.abs(ratio - s2) < 0.03 && e3.json.pk.white_clean.product_box_pixels_changed === 0 && e3.json.pk.white_clean.darker_than_knee_changed === 0, 'Production case: no product is cut off (product area ' + Math.round(ratio * 1000) / 10 + '% of before, scale squared ' + Math.round(s2 * 1000) / 10 + '%); the clean-up changed nothing inside the fitted box or darker than the background');
  const fb = fit.box_2d_after || [0, 0, 0, 0];
  ok(Math.abs((fb[1] + fb[3]) / 2 - 500) <= 1 && Math.abs((fb[0] + fb[2]) / 2 - 500) <= 1 && JSON.stringify(e3.json.pk.white_clean.product_box_2d) === JSON.stringify(fb), 'Production case: the fitted product box is centred and is the box the clean-up protects', JSON.stringify(fb));
  // No usable box → nothing changed, the package holds.
  e3 = await clean18(PIX, Object.assign({}, pkx, { product_box_2d: null }));
  ok(e3.json.pk.ok === true && e3.json.pk.white_clean.skipped === true && /no usable product box/.test(e3.json.pk.white_clean.skip_reason) && e3.binary && e3.binary.clean._buf === PIX && e3.json.pk.skipped_steps.length === 2, 'Owner 19:26: no product box → nothing cleaned, the master\'s own pixels go on unchanged, the package is made, two skipped steps listed');
  // A pale product (247) with no outline against a 250 background: the box keeps it untouched; the background still becomes 255.
  const pale = bmp(S, S, (x, y) => (x > 200 && x < 925 && y > 250 && y < 875 ? [247, 247, 246] : [250, 250, 249]));
  e3 = await clean18(pale, Object.assign({}, pkx, { product_box_2d: toBox(200, 250, 925, 875) }));
  const Bp = e3.binary ? readBmp(e3.binary.clean._buf) : null;
  ok(e3.json.pk.white_clean.done === true && Bp && diffIn(readBmp(pale), Bp, 201, 251, 924, 874) === 0 && Bp(20, 20).join() === '255,255,255', 'P1.7 a pale product with no outline: not changed; the background around it is 255');
  const grey = bmp(S, S, () => [200, 200, 200]);
  e3 = await clean18(grey);
  ok(e3.json.pk.ok === false && /not near-white/.test(e3.json.pk.white_clean.problem), 'P1.7 a background that is not near-white is left as it is; the package holds');
  e3 = await clean18(null);
  ok(e3.json.pk.ok === false && /could not be turned into pixels/.test(e3.json.pk.white_clean.problem), 'P1.7 no BMP from Edit Image → the package holds');
  const src18l = fs.readFileSync(path.join(NODES, '18l_Manifest.js'), 'utf8');
  ok(/note: pk.background_note \|\| 'background set to 255', cleaned: /.test(src18l) && /master_unchanged: true/.test(src18l), 'P1.7 the manifest notes the background ("background set to 255", or why not) and that the master is unchanged');

  // ---------- P1.8: early readers, planner, critic; package cost ----------
  const src = n => fs.readFileSync(path.join(NODES, n), 'utf8');
  ok(['04_06_Evidence.js', '09b_Contract.js', '11b_Stylist_check.js', '11d_Plan_verdict.js', '16b_Review_verdict.js'].every(n => /function bodyOf/.test(src(n)) && /function usageOf/.test(src(n))), 'P1.8 every reader of a model reply picks the answer part and the usage');
  const pf = { plans: [{ shot: 1, checks: {} }] };
  // The OpenAI raw reply echoes its instructions with a JSON-looking example: bodyOf skips it.
  const bo = (() => { const s2 = src('11b_Stylist_check.js'); const i = s2.indexOf('function bodyOf'); const j = s2.indexOf('function usageOf'); return new Function(s2.slice(i, j) + '; return bodyOf;')(); })();
  ok(JSON.stringify(bo(openai(pf))).indexOf('instructions') === -1 && /plans/.test(JSON.stringify(bo(openai(pf)))), 'P1.8 an echoed instruction in an OpenAI reply is not read as the answer');
  const e18src = src('18e_Check_master.js');
  ok(/cost.text_usd = /.test(e18src) && /without token counts, not counted/.test(e18src), 'P1.8 the package cost adds the text and vision calls, and says which had no token counts');
  const intake = (await run('01_Intent_scope.js', {}, [{ json: { body: { payload: JSON.stringify({ clientRunId: 'claude-test-phase1-0001', scope: { outcomes: ['Lifestyle'] } }) } } }]))[0].json;
  ok(intake.text_prices && intake.text_prices.models['claude-sonnet-5-5'].input === 2 && intake.text_prices.models['gemini-3.8-flash'].output === 3.75 && intake.text_prices.models['gpt-6.1-sol'].output === 10 && intake.text_prices.read_on === '2026-10-16', 'P1.8 intake records the text prices with their date and source');
  ok(intake.brief.outputs.map(o => o.id).join() === 'white_master,hero', 'D8 Lifestyle with no view → white master + hero');

  // ---------- Phase 1 review findings 7, 8, 9 and the box hand-off (16 Oct 2026) ----------
  // Finding 7: the decisions come first in the run row's review text, and G1b reads them even from a text cut at 60,000 characters.
  ok(/^\{"go2_decisions":\["review_again","stop"\]/.test(v1nr.row.review), 'Finding 7: go2_decisions is the first field of the run row\'s review text');
  const cutRow = Object.assign({}, row, { review: v1nr.row.review.slice(0, 40) });
  d = (await run('G1b_Decision_check.js', { 'A7 owner decision webhook': [{ json: { body: { id: notRev.client_run_id, run_id: notRev.run_id, round: 1, decision: 'approve' }, webhookUrl: 'https://n8n.example/webhook/claude-midas-a7-decision' } }] }, [{ json: cutRow }]))[0].json;
  ok(d.ok === 'no' && /review_again, stop/.test(d.reply.problem), 'Finding 7: from a cut review text G1b still reads review_again, stop and refuses "approve"');
  // Finding 8: a not-reviewed scene keeps light, camera level and realism as notes, and its scores are labelled.
  sc = await v16(critic(SCENE_KEYS, { light: { result: 'fail', evidence: 'cold' }, camera_level: { result: 'fail', evidence: 'tilt' }, realism: { result: 'unsure', evidence: 'cg' }, scale: { result: 'fail', evidence: 'too big' } }), E503, { rv: rvS, st: stS });
  ok(sc.go2.not_reviewed && sc.review.defects.map(x => x.check).join() === 'scale' && sc.review.notes_only.map(x => x.check).join() === 'camera_level,light,realism' && sc.review.unsure.length === 0 && /incomplete review/.test(sc.go2.score_label) && /not a passed review/.test(sc.go2.score_label), 'Finding 8: not-reviewed scene: note-only checks stay notes, the scale fail stays a finding, the scores are labelled');
  // Finding 2: a ticket that was not ready holds (no review again).
  s = await v16(critic(WHITE_KEYS), gemini(blindObj()), { rv: { ready: false, why: 'The candidate image is not available in this run.' } });
  ok(s.status === 'hold' && !s.go2_allowed && /not available/.test(s.hold_reason), 'Finding 2: not ready → hold, no review again');
  // Finding 1 hand-off: the box goes from the review (16b) through the approval (G2) to the package ticket (18a).
  const okBox = await v16(critic(WHITE_KEYS), gemini(blindObj({ box_2d: [336, 97, 698, 902] })));
  okBox.text_calls_new = [];
  const apd = await g2(okBox, { decision: 'approve' });
  const pkBox = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: Object.assign(clone(apd), { approved: Object.assign(clone(apd.approved), { candidate: Object.assign({}, apd.approved.candidate, { drive_file_id: 'd', sha256: apd.approved.candidate.sha256 }) }) }) }], '04 Settings': [{ json: SETTINGS }] }))[0].json.pk;
  ok(JSON.stringify(apd.approved.product_box_2d) === '[336,97,698,902]' && JSON.stringify(pkBox.product_box_2d) === '[336,97,698,902]', 'Finding 1: the product box goes from the review through the owner\'s approval to the package ticket');
  ok(pkBox.cfg.fit_span_pct === 76, 'Fit: the package ticket carries the white-master framing setting (76%) for a master framed too tight to clean');
  // Finding 9: the size unit is read next to a number; cm or mm wins; "in" as a word is never the unit.
  const v19b = async body => (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: { status: 'scene_preparing', scene: { output_id: 'x', phase: 'place', props: [{ sku: '2', name: 'B', kind: 'tray', url: 'https://midasfurniture.com/en/b.html' }], props_left_out: [] }, trail: [] } }], '19b0 Prop page list': [{ json: { sku: '2', url: 'https://midasfurniture.com/en/b.html' } }] }, [{ json: { statusCode: 200, body } }]))[0].json.scene.props[0].live.size_on_page;
  const st19 = '<div class="stock available"><span>In stock</span></div>';
  ok(await v19b(st19 + '<div>Product Size : Made in Turkey, W 40 x D 30 x H 5 cm Qty</div>') === 'W 40 x D 30 x H 5 cm', 'Finding 9: "Made in" is not read as inches; cm is');
  ok(await v19b(st19 + '<div>Product Size : 120 x 60 in stock Qty</div>') === '120 x 60', 'Finding 9: "in stock" after the size gives no unit');
  ok(await v19b(st19 + '<div>Product Size : 45in x 30in Qty</div>') === '45 x 30 in', 'Finding 9: inches written next to the number are kept');
  // Finding 10: page draft 2 wording (copy text, so read as text).
  const page2 = fs.readFileSync(path.join(ROOT, 'claude-outputs', 'claude-midas-a7-page-2', 'app.js'), 'utf8');
  ok(!/2 to 10 images/.test(page2) && !/camera view or a series/.test(page2) && /label: '2 or 3 images', title: 'Lifestyle'/.test(page2), 'Finding 10: page draft 2 says "2 or 3 images" and no longer offers a series');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
