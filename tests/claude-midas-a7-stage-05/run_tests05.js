// Local tests for stage 05 (15 Oct 2026). Runs the n8n Code-node source with mocked node outputs. No network, no paid call.
const fs = require('fs');
const path = require('path');
// In the repo the code is read from the n8n export (n8n/claude-midas-a7/code-nodes), the authority.
const NODES = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-a7', 'code-nodes');
const MAP = { '16a_review_ticket.js': '16a_Review_ticket.js', '16b_review_verdict.js': '16b_Review_verdict.js', 'G2_go2_verdict.js': 'G2_Go_2_verdict.js',
  'mod/V1_Vault_events.js': 'V1_Vault_events.js', 'mod/13_Compile.js': '13_Compile.js', 'mod/G1b_Decision_check.js': 'G1b_Decision_check.js', 'mod/G1d_Forward_result.js': 'G1d_Forward_result.js' };
const src = f => f === '../nodes/13_Compile.js' ? fs.readFileSync(path.join(__dirname, '13_Compile_before_stage05.js'), 'utf8') : fs.readFileSync(path.join(NODES, MAP[f] || f), 'utf8');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'v1_404.json'), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
function run(file, nodes, input, opts) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const $input = { first: () => (input || [])[0], all: () => input || [] };
  const code = src(file);
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFn('$', '$input', '$execution', 'require', 'helpers', code);
  return fn($, $input, (opts && opts.execution) || { resumeUrl: 'https://n8n.example/webhook-waiting/999' }, require, {});
}
const BIN = { mimeType: 'image/png', data: 'iVBORw0KGgo=' };
const critic = (over, defects, scores) => ({ content: [{ type: 'text', text: JSON.stringify({ checks: Object.assign(Object.fromEntries(['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'framing', 'no_text_or_logo', 'realism'].map(k => [k, { result: 'pass', evidence: 'ok', ...(k === 'piece_count' ? { seen: 7 } : {}) }])), over || {}), defects: defects || [], scores: scores || { fidelity: 88, integrity: 90, drift: 5, data_loss: 4 }, summary: 'ok' }) }] });
const blind = o => ({ content: { parts: [{ text: '```json\n' + JSON.stringify(Object.assign({ pieces: [{ kind: 'sofa piece', count: 7 }], total: 7, background_white: true, text_or_logo: false, unclear: [], cropped: false }, o || {})) + '\n```' }] } });

(async () => {
  // ---------- 16a Review ticket ----------
  let r = await run('16a_review_ticket.js', { 'V1 Vault events': [{ json: clone(base) }], '02 Ingest files': [{ json: {}, binary: { photo: BIN } }], '15m Receipt': [{ json: {}, binary: { image: BIN } }] });
  const rv = r[0].json.rv;
  ok(rv.ready === true && r[0].binary.vendor && r[0].binary.candidate, '16a ready with both images');
  ok(rv.total === 7 && /Total product pieces: 7/.test(rv.critic_text) && /left-arm piece; right-arm piece/.test(rv.critic_text), '16a contract in critic text');
  ok(!/7/.test(rv.blind_text), '16a blind text names no count');
  r = await run('16a_review_ticket.js', { 'V1 Vault events': [{ json: clone(base) }], '02 Ingest files': [{ json: {}, binary: { photo: BIN } }], '15m Receipt': [{ json: {} }] });
  ok(r[0].json.rv.ready === false && !r[0].binary && /not available/.test(r[0].json.rv.why), '16a candidate binary missing → not ready');
  const noCand = clone(base); noCand.stage04.candidate = null;
  r = await run('16a_review_ticket.js', { 'V1 Vault events': [{ json: noCand }], '02 Ingest files': [{ json: {}, binary: { photo: BIN } }], '15m Receipt': [{ json: {}, binary: { image: BIN } }] });
  ok(r[0].json.rv.ready === false && /no stored candidate/.test(r[0].json.rv.why), '16a no candidate → not ready');

  // ---------- 16b Review verdict ----------
  const nodes16 = (c, b, st, autoRepair, rvOver) => ({ 'V1 Vault events': [{ json: clone(st || base) }], '16a Review ticket': [{ json: { rv: Object.assign(clone(rv), rvOver || {}) } }], '04 Settings': [{ json: { auto_repair: Boolean(autoRepair) } }], '16 Critic review': [{ json: c }], '16x Blind count': [{ json: b }] });
  let s = (await run('16b_review_verdict.js', nodes16(critic(), blind())))[0].json;
  ok(s.status === 'awaiting_go_2' && s.review.result === 'passed' && s.go2.answer_with.round === 1 && /^[0-9a-f]{32}$/.test(s.go2_token), '16b pass → awaiting go 2');
  ok(/not an approval/.test(s.go2.review_result) && !/approved/i.test(s.status), '16b pass is never an approval');
  ok(s.review.scores.fidelity === 88 && /not a measurement/.test(s.review.score_label), '16b scores labelled as judgement');
  ok(s.vault_only.indexOf('review') !== -1 && s.stage.indexOf('05') === 0, '16b vault kinds and stage');
  ok(s.go2.how_to_answer.indexOf('approve, stop, repair') !== -1, '16b attempt 1 offers repair');
  // failed, owner decides
  s = (await run('16b_review_verdict.js', nodes16(critic({ handedness: { result: 'fail', evidence: 'chaise on the wrong side' } }, [{ check: 'handedness', what: 'ends swapped', where: 'left end', fix: 'Put the left-arm piece on the left as in the vendor photo.' }]), blind())))[0].json;
  ok(s.status === 'awaiting_go_2' && s.review.result === 'failed' && s.go2.proposed_repair.corrections[0].indexOf('left-arm') !== -1 && !s.repair_orders, '16b fail, auto off → go 2 with proposed repair');
  // failed, auto repair on in 04 Settings: still the owner's go 2 (owner, 16 Oct 2026, D5: nothing repairs itself)
  s = (await run('16b_review_verdict.js', nodes16(critic({ colour: { result: 'fail', evidence: 'too beige' } }, [{ check: 'colour', what: 'beige', fix: 'Keep the warm grey of the vendor photo.' }]), blind(), null, true)))[0].json;
  ok(s.status === 'awaiting_go_2' && !s.repair_orders && s.go2_proposed_repair.attempt === 2 && s.go2_proposed_repair.preserve.some(p => /handedness/.test(p)), '16b fail, auto on → still go 2, repair only proposed');
  // failed on attempt 3
  s = (await run('16b_review_verdict.js', nodes16(critic({ colour: { result: 'fail', evidence: 'too beige' } }), blind(), null, true, { attempt: 3 })))[0].json;
  ok(s.status === 'hold' && /two repairs/.test(s.hold_reason) && !s.repair_orders, '16b fail on attempt 3 → hold');
  // blind count disagrees with the contract although the reviewer passed everything
  s = (await run('16b_review_verdict.js', nodes16(critic(), blind({ total: 6 }))))[0].json;
  ok(s.review.result === 'failed' && s.review.defects[0].check === 'piece_count' && s.review.counts.blind === 6, '16b blind count mismatch → code defect');
  // blind sees grey background
  s = (await run('16b_review_verdict.js', nodes16(critic(), blind({ background_white: false }))))[0].json;
  ok(s.review.defects.some(d => d.check === 'background'), '16b blind background → defect');
  // unsure only
  s = (await run('16b_review_verdict.js', nodes16(critic({ details: { result: 'unsure', evidence: 'hard to see' } }), blind())))[0].json;
  ok(s.status === 'awaiting_go_2' && s.review.result === 'unsure' && /unsure on 1/.test(s.go2.review_result), '16b unsure → go 2, not passed');
  // a missing check counts as unsure
  const c2 = critic(); const t = JSON.parse(c2.content[0].text); delete t.checks.realism; c2.content[0].text = JSON.stringify(t);
  s = (await run('16b_review_verdict.js', nodes16(c2, blind())))[0].json;
  ok(s.review.result === 'unsure' && s.review.unsure[0].check === 'realism', '16b missing check → unsure');
  // reader error
  s = (await run('16b_review_verdict.js', nodes16({ error: { message: 'overloaded' } }, blind())))[0].json;
  ok(s.status === 'awaiting_go_2' && s.go2.not_reviewed === true && /reviewer did not answer/.test(s.go2.review_result) && s.go2.decisions.join() === 'review_again,stop' && s.review.result === 'not reviewed', '16b reviewer error → owner go 2, not reviewed, review again offered');
  s = (await run('16b_review_verdict.js', nodes16(critic(), { content: [{ text: 'sorry' }] })))[0].json;
  ok(s.status === 'awaiting_go_2' && s.go2.not_reviewed === true && /blind count answered, but not in the expected format/.test(s.go2.review_result) && s.review.checks.shape.result === 'pass' && /Only the reviewer answered/.test(s.review.partial), '16b blind bad format → not reviewed; the reviewer\'s answer is kept (P1.10)');
  // ticket not ready: stale reader outputs must be ignored
  s = (await run('16b_review_verdict.js', nodes16(critic(), blind(), null, true, { ready: false, why: 'The candidate image is not available in this run.' })))[0].json;
  // Phase 1 review, finding 2 (16 Oct 2026): a ticket that was not ready called no reader, so a review again would fail the same way:
  // it holds for the owner instead of offering review again.
  ok(s.status === 'hold' && !s.go2_allowed && /not available/.test(s.hold_reason) && s.review.result === 'not reviewed' && Object.keys(s.review.checks).length === 0, '16b not ready → hold (no review again), old readings ignored');
  // injected instruction in evidence stays data and is trimmed
  s = (await run('16b_review_verdict.js', nodes16(critic({ shape: { result: 'fail', evidence: 'x'.repeat(900) } }, [{ check: 'shape', fix: 'y'.repeat(900) }]), blind())))[0].json;
  ok(s.review.checks.shape.evidence.length <= 240 && s.go2.proposed_repair.corrections[0].length <= 300, '16b long texts trimmed');

  // ---------- V1 with stage 05 states ----------
  const go2State = (await run('16b_review_verdict.js', nodes16(critic(), blind())))[0].json;
  let v = (await run('mod/V1_Vault_events.js', {}, [{ json: clone(go2State) }]))[0].json;
  const kinds = v.events.map(e => e.kind);
  ok(kinds.join() === 'review,go2_ticket,text_call,text_call,status' && v.events.every(e => e.stage === '05') && v.text_calls_new.length === 0, 'V1 go 2 events: ' + kinds.join());
  ok(v.row.resume_url.indexOf('/webhook-waiting/') !== -1 && v.row.go2_token === go2State.go2_token && v.row.go2_round === 1 && v.row.go1_token === '', 'V1 row resume url + go 2 token');
  ok(!JSON.stringify(v.events).includes(go2State.go2_token), 'V1 go 2 token never in the vault');
  ok(JSON.parse(v.row.review).result === 'passed', 'V1 row review column');
  // A repair is always the owner's order at go 2 (16 Oct 2026, D5), so the repair state comes from G2.
  const forRep = (await run('16b_review_verdict.js', nodes16(critic({ colour: { result: 'fail', evidence: 'beige' } }, [{ check: 'colour', fix: 'Keep the warm grey.' }]), blind(), null, true)))[0].json;
  forRep.text_calls_new = []; // in a run, V1 clears these before the run waits for go 2
  const repState = (await run('G2_go2_verdict.js', { 'V1 Vault events': [{ json: clone(forRep) }] }, [{ json: { body: { decision: 'repair', run_id: base.run_id, round: 1, go2_token: forRep.go2_token } } }]))[0].json;
  v = (await run('mod/V1_Vault_events.js', {}, [{ json: clone(repState) }]))[0].json;
  ok(v.events.map(e => e.kind).join() === 'repair_order,go2_decision,status' && v.events.find(e => e.kind === 'repair_order').actor === 'owner' && v.row.resume_url === '', 'V1 owner repair events: ' + v.events.map(e => e.kind).join());
  // the stage 04 state still gives the stage 04 events
  v = (await run('mod/V1_Vault_events.js', {}, [{ json: clone(base) }]))[0].json;
  ok(v.events.map(e => e.kind).join() === 'compile,operation,candidate,status' && v.events[3].stage === '04', 'V1 stage 04 unchanged: ' + v.events.map(e => e.kind).join());

  // ---------- G2 Go 2 verdict ----------
  const tok = go2State.go2_token;
  const g2 = (body, prev, st) => run('G2_go2_verdict.js', Object.assign({ 'V1 Vault events': [{ json: clone(st || go2State) }] }, prev ? { 'G2 Go 2 verdict': [{ json: prev }] } : {}), body === null ? [] : [{ json: { body } }]);
  const good = (decision, extra) => Object.assign({ decision, run_id: base.run_id, round: 1, go2_token: tok }, extra || {});
  s = (await g2(good('approve')))[0].json;
  ok(s.status === 'white_master_approved' && s.approved.by === 'owner' && s.go2_last.decision === 'approve' && s.vault_only.indexOf('go2_decision') !== -1, 'G2 approve → approved by owner');
  s = (await g2(good('repair', { note: 'make the grey a touch warmer' })))[0].json;
  ok(s.status === 'repair_ordered' && s.repair_orders.white_master.attempt === 2 && /touch warmer/.test(s.repair_orders.white_master.corrections.join()) && s.go2_route === 'repair', 'G2 repair with note');
  s = (await g2(good('repair')))[0].json;
  ok(s.status === 'hold' && /no problem to correct/.test(s.hold_reason), 'G2 repair with nothing to correct → hold');
  const failedGo2 = (await run('16b_review_verdict.js', nodes16(critic({ colour: { result: 'fail', evidence: 'beige' } }, [{ check: 'colour', fix: 'Keep the warm grey.' }]), blind())))[0].json;
  s = (await run('G2_go2_verdict.js', { 'V1 Vault events': [{ json: clone(failedGo2) }] }, [{ json: { body: { decision: 'repair', run_id: base.run_id, round: 1, go2_token: failedGo2.go2_token } } }]))[0].json;
  ok(s.status === 'repair_ordered' && s.repair_orders.white_master.corrections[0] === 'Keep the warm grey.', 'G2 repair uses the proposed corrections');
  const r3 = clone(go2State); r3.go2_round = 3;
  s = (await g2(Object.assign(good('repair', { note: 'x' }), { round: 3 }), null, r3))[0].json;
  ok(s.status === 'hold' && /two repairs/.test(s.hold_reason), 'G2 repair on round 3 → hold');
  s = (await g2(good('stop')))[0].json;
  ok(s.status === 'stopped_by_owner', 'G2 stop');
  s = (await g2(good('maybe')))[0].json;
  ok(s.go2_route === 'rewait' && s.status === 'awaiting_go_2' && !s.go2_last, 'G2 decision the ticket does not offer → ignored, waits again');
  s = (await g2(null))[0].json;
  ok(s.status === 'hold' && /24 hours/.test(s.hold_reason), 'G2 timeout → hold');
  s = (await g2(Object.assign(good('approve'), { go2_token: 'wrong' })))[0].json;
  ok(s.go2_route === 'rewait' && s.status === 'awaiting_go_2' && !s.go2_last && s.go2_ignored === 1, 'G2 wrong token → wait again, nothing recorded');
  s = (await g2(Object.assign(good('approve'), { round: 2 })))[0].json;
  ok(s.go2_route === 'rewait', 'G2 wrong round → wait again');
  s = (await g2(Object.assign(good('approve'), { go2_token: 'wrong' }), { go2_route: 'rewait', go2_token: tok, go2_ignored: 5 }))[0].json;
  ok(s.status === 'hold' && /stopped for safety/.test(s.hold_reason), 'G2 sixth ignored call → hold');

  // ---------- 13 Compile with a repair ----------
  const repV1 = clone(repState); // status repair_ordered, go1_last from the real run
  let c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: repV1 }] }, [{ json: { image_size: '2K' } }]))[0].json.s04;
  ok(c.go === true && c.dispatch.attempt === 2 && /Corrections required/.test(c.dispatch.prompt) && c.dispatch.corrections.length === 1, '13 repair → attempt 2 with corrections');
  const noGo1 = clone(repState); noGo1.go1_last = { decision: 'change', by: 'owner' };
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: noGo1 }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false && /go 1 is not recorded/.test(c.critical[0].why), '13 repair without go 1 → stop');
  const a4 = clone(repState); a4.repair_orders.white_master.attempt = 4;
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: a4 }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false && /at most two repairs/.test(c.critical.map(x => x.why).join()), '13 attempt 4 → stop');
  const stale = clone(base); stale.status = 'awaiting_review'; stale.repair_orders = { white_master: { attempt: 2, corrections: ['x'] } };
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: stale }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false, '13 wrong status → stop');
  const go1 = clone(base); go1.status = 'go_1_given'; delete go1.stage04;
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: go1 }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === true && c.dispatch.attempt === 1 && !/Corrections required/.test(c.dispatch.prompt), '13 first attempt unchanged');
  const orig = (await run('../nodes/13_Compile.js', { 'V1 Vault events': [{ json: go1 }] }, [{ json: {} }]))[0].json.s04;
  // Changed 16 Oct 2026 (prompt check S1, C1, C2, P2): the framing line is measured on the longest side; the layout line and the closing
  // self-check are added; the white master no longer carries the profile's rule line. Everything else stays the stage 04 prompt.
  const FRAMING = 'Framing: the product is centred. Its longest side spans about 76% of the frame side in the same direction (the width for a wide product, the height for a tall one), with about 12% white margin at each end of that side. Never crop the product to fill the frame.';
  // Changed 17 Oct 2026 (commit f5148f1, fidelity tests): two lines protect the photographed arrangement and the connector details.
  // They are checked here as present once each, then set aside so the rest still compares line for line with the stage 04 prompt.
  const FIDELITY = ['This is a background-and-light normalization of the photographed arrangement', 'Any exposed connector faces'];
  { const all = c.dispatch.prompt.split('\n');
    const a = orig.dispatch.prompt.split('\n').filter(l => l.indexOf('Rules for this kind of product:') !== 0), b = all.filter(l => l.indexOf('In image 1, from left to right') !== 0 && l.indexOf('Before returning the image, check it against image 1') !== 0 && !FIDELITY.some(p => l.indexOf(p) === 0)); const i = a.findIndex(l => l.indexOf('Frame: ') === 0);
    ok(FIDELITY.every(p => all.filter(l => l.indexOf(p) === 0).length === 1), '13 first-attempt prompt carries each fidelity line once (arrangement, connector faces; 17 Oct 2026)');
    ok(b.length === a.length + 1 && b[i + 1] === FRAMING && b.slice(0, i + 1).concat(b.slice(i + 2)).join('\n') === a.join('\n') && /Before returning the image, check it against image 1/.test(c.dispatch.prompt), '13 first-attempt prompt = the stage 04 prompt plus the framing line (owner, 23:22; longest side 16 Oct 2026), the fidelity lines, the layout line when boxes allow, and the self-check'); }

  // ---------- 13 Compile, context named by the inventory: hold and ask (owner go, 16 Oct 2026 00:50; replaces the Test 8 rule) ----------
  const t8 = clone(go1);
  t8.inventory = [{ count: 1, item: 'upholstered bed' }, { count: 1, item: 'pendant light' }];
  t8.observation = Object.assign({}, t8.observation, { count_eye: 1, count_second: 1, sided_parts: [], shown_with: ['nightstands', 'rug', 'bedding'], pieces_seen: [
    { label: 'bed', kind: 'bed', role: 'product' }, { label: 'nightstand', kind: 'nightstand', role: 'context' }, { label: 'nightstand', kind: 'nightstand', role: 'context' }, { label: 'pendant lamp', kind: 'lamp', role: 'context' }, { label: 'rug', kind: 'rug', role: 'context' }] });
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: t8 }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false && c.critical.length === 1 && /inventory lists 1 x light, but the photo reader marked 1 such thing as room context/.test(c.critical[0].why) && /send the job again/.test(c.critical[0].why) && !c.dispatch, '13 inventory names a context piece → hold and ask, nothing drawn');
  ok(/Held and asked/.test(c.notes.join()) && !/Test 8 rule/.test(c.notes.join()), '13 hold-and-ask note, no Test 8 rule note');
  const t8b = clone(t8); t8b.observation.pieces_seen.push({ label: 'table lamp', kind: 'lamp', role: 'context' });
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: t8b }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false && /marked 2 such things as room context/.test(c.critical.map(x => x.why).join()), '13 two context lights → hold and ask');
  const t8c = clone(t8); t8c.inventory = [{ count: 1, item: 'upholstered bed' }];
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: t8c }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === true && /pendant lamp/.test(c.dispatch.prompt) && !c.notes.length, '13 a light not in the inventory stays context and is left out (Test 8 now: the bed only)');
  const t8d = clone(t8); t8d.observation.pieces_seen = t8d.observation.pieces_seen.filter(p => p.kind !== 'lamp');
  c = (await run('mod/13_Compile.js', { 'V1 Vault events': [{ json: t8d }] }, [{ json: {} }]))[0].json.s04;
  ok(c.go === false && /shows 1 product pieces and the contract holds 2/.test(c.critical.map(x => x.why).join()), '13 light not seen at all → hold, never invented');

  // ---------- G1b Decision check, go 2 gate ----------
  const rowGo2 = { client_run_id: base.client_run_id, status: 'awaiting_go_2', run_id: base.run_id, go2_round: 1, go2_token: tok, go1_token: '', go1_rounds: 0, resume_url: 'https://n8n.example/webhook-waiting/999', required_outputs: '[{"id":"white_master","kind":"white"}]' };
  const g1b = (body, rows) => run('mod/G1b_Decision_check.js', { 'A7 owner decision webhook': [{ json: { body, webhookUrl: 'https://n8n.example/webhook/claude-midas-a7-decision' } }] }, (rows || [rowGo2]).map(x => ({ json: x })));
  let d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 1, decision: 'approve' }))[0].json;
  ok(d.ok === 'yes' && d.gate === 'go2' && d.answer.go2_token === tok && !('go1_token' in d.answer), 'G1b go 2 approve forwarded');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 1, decision: 'go' }))[0].json;
  ok(d.ok === 'no' && /approve, repair, stop/.test(d.reply.problem), 'G1b go on a go 2 gate refused');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 0, decision: 'approve' }))[0].json;
  ok(d.ok === 'no' && d.code === 409, 'G1b go 2 wrong round refused');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 3, decision: 'repair' }, [Object.assign({}, rowGo2, { go2_round: 3 })]))[0].json;
  ok(d.ok === 'no' && /two repairs/.test(d.reply.problem), 'G1b repair at round 3 refused');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 1, decision: 'repair', changes: [{ shot: 1 }] }))[0].json;
  ok(d.ok === 'no' && /no field edits/.test(d.reply.problem), 'G1b go 2 with field edits refused');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 1, decision: 'approve' }, [Object.assign({}, rowGo2, { status: 'white_master_approved' })]))[0].json;
  ok(d.ok === 'no' && /No run is waiting/.test(d.reply.problem), 'G1b answered run refused');
  // go 1 still works
  const rowGo1 = Object.assign({}, rowGo2, { status: 'awaiting_go_1', go1_token: 'abc', go1_rounds: 0, go2_token: '', go2_round: 0 });
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 0, decision: 'go' }, [rowGo1]))[0].json;
  ok(d.ok === 'yes' && d.gate === 'go1' && d.answer.go1_token === 'abc', 'G1b go 1 still forwarded');
  d = (await g1b({ id: base.client_run_id, run_id: base.run_id, round: 0, decision: 'approve' }, [rowGo1]))[0].json;
  ok(d.ok === 'no', 'G1b approve on a go 1 gate refused');
  // G1d texts
  let f = (await run('mod/G1d_Forward_result.js', { 'G1b Decision check': [{ json: { gate: 'go2', id: 'x', decision: 'approve', at: 't' } }] }, [{ json: {} }]))[0].json;
  ok(f.reply.gate === 'go 2' && /records your approval/.test(f.reply.next) && /passed to the waiting run/.test(f.reply.next) && !/not built yet/.test(f.reply.next), 'G1d go 2 reply (no stale "not built yet", P1.5)');

  // ---------- 15q round from the attempt ----------
  console.log('\n' + pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
