// Fallback readers (16 Oct 2026, owner go after the first paid test and reader test 2). Simulated answers only; no network, no paid call.
// Gemini reads first; gpt-6.1-sol is read only when the Gemini node of this run returned an error.
const fs = require('fs');
const path = require('path');
const { scenario } = require(path.join(__dirname, '..', '..', 'claude-outputs', 'claude-midas-a7-build', 'test', 'harness.js'));
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const prod = () => ({ photo: { data: PNG, mimeType: 'image/png', fileName: 'sofa.png' } });
const sofaInv = [{ item: 'left-arm piece', count: 1 }, { item: 'armless piece', count: 4 }, { item: 'corner piece', count: 1 }, { item: 'right-arm piece', count: 1 }];
const piece = (k, role) => ({ label: k, kind: k, box: [100, 100, 400, 300], seen_whole: true, role: role || 'product' });
const sevenEye = { category: 'sectional sofa', pieces: [piece('left-arm piece'), piece('armless'), piece('armless'), piece('armless'), piece('armless'), piece('corner'), piece('right-arm piece'), piece('rug', 'context')], signs: [], printed_counts: [], colour_observed: 'warm grey', design_locks: ['boucle grey upholstery'], sided_parts: ['left-arm piece', 'right-arm piece'], unknowns: ['back of the sofa'], cropped: false };
// 16 Oct 2026 (owner, 04:16): the base job asks for "Wide view + close-up" (white master, wide, detail), see run_tests.js.
const base = (extra) => Object.assign({ clientRunId: 'claude-test-a7-0004', mode: 'manual', job: { type: 'New Project', workOn: 'one_by_one' }, item: { productType: 'Sectional sofa', inventory: sofaInv }, scope: { outcomes: ['Lifestyle'], view: 'Wide view + close-up', imageCount: 3 }, references: [{ name: 'sofa.png', role: 'Product' }] }, extra);
const job = (s04, extra) => ({ payload: base(extra || {}), binary: prod(), eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'go' }], s04 });
const fjob = (extra) => ({ payload: base({}), binary: prod(), eye: sevenEye, second: { total: 7 }, ...(extra || {}) });
const E503 = { error: { message: 'Service unavailable - try again later' } };
let pass = 0, failN = 0;
function ok(cond, name, info) { if (cond) { pass++; console.log('PASS ' + name); } else { failN++; console.log('FAIL ' + name + (info ? '\n     ' + info : '')); } }
const obsOf = r => (r.out && r.out.observation) || (r.row && r.row.observation ? JSON.parse(r.row.observation) : {});

// 16b, run as stage 05's tests do.
const NODES = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-a7', 'code-nodes');
const S05 = path.join(__dirname, '..', 'claude-midas-a7-stage-05');
const v1 = JSON.parse(fs.readFileSync(path.join(S05, 'v1_404.json'), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
function run(file, nodes, input) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const $input = { first: () => (input || [])[0], all: () => input || [] };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFn('$', '$input', '$execution', 'require', 'helpers', fs.readFileSync(path.join(NODES, file), 'utf8'))($, $input, { resumeUrl: 'https://n8n.example/webhook-waiting/999' }, require, {});
}
const BIN = { mimeType: 'image/png', data: 'iVBORw0KGgo=' };
const CHECKS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'framing', 'no_text_or_logo', 'realism'];
const critic = () => ({ content: [{ type: 'text', text: JSON.stringify({ checks: Object.assign(Object.fromEntries(CHECKS.map(k => [k, { result: 'pass', evidence: 'ok' }])), { piece_count: { result: 'pass', evidence: '7 pieces', seen: 7 }, framing: { result: 'pass', evidence: 'ok', share: 76 } }), defects: [], scores: { fidelity: 88, integrity: 90, drift: 5, data_loss: 5 }, summary: 'ok' }) }] });
const gemBlind = t => ({ content: { parts: [{ text: JSON.stringify({ pieces: [{ kind: 'piece', count: t }], total: t, background_white: true, text_or_logo: false, unclear: [], cropped: false }) }] } });
const oaBlind = t => ({ content: [{ type: 'text', text: JSON.stringify({ pieces: [{ kind: 'piece', count: t }], total: t, background_white: true, text_or_logo: false, unclear: [], cropped: false }) }] });

(async () => {
  // ---------- 04-06 Evidence ----------
  let r = await scenario(fjob());
  ok(obsOf(r).readers_used && obsOf(r).readers_used.photo === 'gemini-3.8-flash' && obsOf(r).count_eye === 7, 'F1 Gemini answers → Gemini is the photo reader', r.path);
  r = await scenario(fjob({ eyeRaw: E503, eyeBack: sevenEye }));
  ok(obsOf(r).count_eye === 7 && /fallback/.test(obsOf(r).readers_used.photo) && !/did not answer/.test(r.out.hold_reason || ''), 'F2 Gemini 503 → the fallback reads the photo, no reader hold', r.path + ' | ' + (r.out.hold_reason || ''));
  ok(JSON.stringify(r.out.trail || JSON.parse(r.row.trail || '[]')).indexOf('fallback gpt-6.1-sol') !== -1, 'F3 the trail names the fallback reader');
  r = await scenario(fjob({ eyeRaw: E503, eyeBack: { error: { message: 'Rate limit reached' } } }));
  ok(r.path === 'hold' && /fallback photo reader \(gpt-6\.1-sol, after Gemini did not answer: Service unavailable/.test(r.out.hold_reason) && /Rate limit/.test(r.out.hold_reason) && r.out.hold_for === 'owner' && !r.out.client_question, 'F4 both readers fail → owner hold naming both, the client is not asked', r.path + ' | ' + r.out.hold_reason);
  r = await scenario(fjob({ eyeBack: { ...sevenEye, pieces: sevenEye.pieces.slice(0, 2) } }));
  ok(obsOf(r).count_eye === 7 && obsOf(r).readers_used.photo === 'gemini-3.8-flash', 'F5 a fallback answer is ignored when Gemini answered (no stale read)', JSON.stringify(obsOf(r).readers_used));
  r = await scenario(fjob({ eyeRaw: E503, eyeBack: { ...sevenEye, pieces: sevenEye.pieces.slice(0, 5) }, second: { total: 7 } }));
  ok(obsOf(r).count_eye === 5 && /fallback/.test(obsOf(r).readers_used.photo), 'F6 a fallback that sees fewer pieces is recorded as seen (A7 then holds as for any reader)', r.path + ' | ' + (r.out.hold_reason || ''));

  const roomJob = x => fjob(Object.assign({ payload: base({ references: [{ name: 'sofa.png', role: 'Product / vendor reference' }, { name: 'room.png', role: 'Room photo' }] }), binary: { ...prod(), room: { data: PNG, mimeType: 'image/png', fileName: 'room.png' } } }, x));
  const ROOM = { walls: 'white plaster', floor: 'oak', windows: 'one on the left', light: 'daylight from the left', camera: 'eye level' };
  r = await scenario(roomJob({ roomRaw: E503, roomBack: ROOM }));
  ok(/fallback/.test((obsOf(r).readers_used || {}).room || '') && obsOf(r).room && !obsOf(r).room.unread && !/room reader/.test(r.out.hold_reason || ''), 'F12 room reader 503 → the fallback reads the room photo', r.path + ' | ' + (r.out.hold_reason || '') + ' | ' + JSON.stringify(obsOf(r).readers_used));
  r = await scenario(roomJob({ roomRaw: E503, roomBack: { error: { message: 'Rate limit' } } }));
  ok(r.path === 'hold' && /fallback room reader/.test(r.out.hold_reason), 'F13 both room readers fail → owner hold', r.path + ' | ' + (r.out.hold_reason || ''));

  // ---------- 16b Review verdict ----------
  const rvRes = await run('16a_Review_ticket.js', { 'V1 Vault events': [{ json: clone(v1) }], '02 Ingest files': [{ json: {}, binary: { photo: BIN } }], '15m Receipt': [{ json: {}, binary: { image: BIN } }] });
  const rv = rvRes[0].json.rv;
  const n16 = (b, back) => Object.assign({ 'V1 Vault events': [{ json: clone(v1) }], '16a Review ticket': [{ json: { rv: clone(rv) } }], '04 Settings': [{ json: { auto_repair: false } }], '16 Critic review': [{ json: critic() }], '16x Blind count': [{ json: b }] }, back ? { '16xb Blind count fallback (OpenAI)': [{ json: back }] } : {});
  let s = (await run('16b_Review_verdict.js', n16(gemBlind(7))))[0].json;
  ok(s.review.result === 'passed' && s.review.blind_reader === 'gemini-3.8-flash', 'F7 Gemini blind count answers → used');
  s = (await run('16b_Review_verdict.js', n16(E503, oaBlind(7))))[0].json;
  ok(s.status === 'awaiting_go_2' && s.review.counts.blind === 7 && /fallback/.test(s.review.blind_reader), 'F8 Gemini blind count 503 → the fallback counts, review completes', s.status + ' | ' + s.hold_reason);
  s = (await run('16b_Review_verdict.js', n16(gemBlind(7), oaBlind(5))))[0].json;
  ok(s.review.counts.blind === 7 && s.review.blind_reader === 'gemini-3.8-flash', 'F9 a stale fallback count is ignored when Gemini answered');
  s = (await run('16b_Review_verdict.js', n16(E503, { error: { message: 'Bad gateway' } })))[0].json;
  ok(s.status === 'awaiting_go_2' && s.go2.not_reviewed === true && /fallback blind count/.test(s.go2.review_result) && /not reviewed/.test(s.go2.review_result) && s.go2.decisions.join() === 'review_again,stop', 'F10 both blind counts fail → not reviewed; the owner may order a review again (D3)', s.go2 && s.go2.review_result);
  s = (await run('16b_Review_verdict.js', n16(E503, oaBlind(6))))[0].json;
  ok(s.review.result === 'failed' && s.review.defects.some(d => d.check === 'piece_count'), 'F11 a fallback count that differs from the contract fails the image like any blind count');
  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})();
