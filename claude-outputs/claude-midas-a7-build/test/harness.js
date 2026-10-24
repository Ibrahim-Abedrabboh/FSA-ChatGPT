// Local harness: runs the A7 Code nodes in order with simulated reader outputs. No network.
// 15 Oct 2026: sc.eyeRaw / sc.secondRaw / sc.roomRaw pass a reader node's raw output (an error, a cut-off answer).
const fs = require('fs');
const path = require('path');
const JS = n => fs.readFileSync(path.join(__dirname, '..', 'js', n), 'utf8');
const outs = {};
const runs = {};
async function run(name, file, inputItems) {
  const $input = { first: () => inputItems[0], all: () => inputItems };
  const $ = nm => { if (!(nm in outs)) throw new Error('node not run: ' + nm); return { first: () => outs[nm][0], all: () => outs[nm], item: outs[nm][0] }; };
  const ctx = { helpers: { getBinaryDataBuffer: async (i, key) => Buffer.from(inputItems[i].binary[key].data, 'base64'),
    prepareBinaryData: async (buf, fileName, mimeType) => ({ data: buf.toString('base64'), fileName, mimeType, fileSize: String(buf.length) }) } };
  const runIndex = runs[name] === undefined ? 0 : runs[name] + 1; runs[name] = runIndex;
  const fn = new Function('$input', '$', 'require', '$execution', '$runIndex', 'return (async function(){' + JS(file) + '\n}).call(this);');
  const res = await fn.call(ctx, $input, $, require, { id: 'test', resumeUrl: 'https://test.app.n8n.cloud/webhook-waiting/test' }, runIndex);
  outs[name] = res;
  return res;
}
function reset() { for (const k of Object.keys(outs)) delete outs[k]; for (const k of Object.keys(runs)) delete runs[k]; }
async function scenario(sc) {
  reset();
  const wh = [{ json: { body: { payload: JSON.stringify(sc.payload) } }, binary: sc.binary }];
  outs['A7 job webhook'] = wh;
  let r = await run('01 Intent & scope', '01_intent.js', wh);
  r = await run('02 Ingest files', '02_ingest.js', r);
  if (r[0].json.usable !== 'ok') { const ref = await run('Refuse with reasons', 'refuse.js', r); return { path: 'refused', out: ref[0].json }; }
  outs['03 Eye reads the product photo'] = [{ json: sc.eyeRaw !== undefined ? sc.eyeRaw : (sc.eye === undefined ? { error: 'credential problem' } : { content: { parts: [{ text: '```json\n' + JSON.stringify(sc.eye) + '\n```' }] }, finishReason: 'STOP' }) }];
  outs['05 Second count'] = [{ json: sc.secondRaw !== undefined ? sc.secondRaw : (sc.second === undefined ? { error: 'credential problem' } : { content: [{ type: 'text', text: JSON.stringify(sc.second) }] }) }];
  if (sc.roomRaw !== undefined) outs['06 Room reader'] = [{ json: sc.roomRaw }];
  else if (sc.room !== undefined) outs['06 Room reader'] = [{ json: { content: { parts: [{ text: JSON.stringify(sc.room) }] } } }];
  // 16 Oct 2026: fallback readers (gpt-6.1-sol). sc.eyeBack / sc.roomBack are the fallback node's raw output; an object is wrapped as OpenAI text.
  const wrapBack = v => (v && (v.error || v.raw) ? (v.raw || v) : [{ type: 'text', text: JSON.stringify(v) }]);
  if (sc.eyeBack !== undefined) outs['03b Eye fallback (OpenAI)'] = [{ json: Array.isArray(wrapBack(sc.eyeBack)) ? { content: wrapBack(sc.eyeBack) } : wrapBack(sc.eyeBack) }];
  if (sc.roomBack !== undefined) outs['06b Room fallback (OpenAI)'] = [{ json: Array.isArray(wrapBack(sc.roomBack)) ? { content: wrapBack(sc.roomBack) } : wrapBack(sc.roomBack) }];
  r = await run('04-06 Evidence', '04_evidence.js', [{ json: {} }, { json: {} }, { json: {} }]);
  let final; let contractReady = false;
  if (r[0].json.critical.length > 0) final = await run('Hold and ask the client', 'hold.js', r);
  else {
    const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json'), 'utf8')).map(p => ({ json: p }));
    outs['07a Load handling profiles'] = profiles;
    r = await run('07 Route', '07_route.js', profiles);
    r = await run('08 Locks and freedoms', '08_locks.js', r);
    outs['09a Find earlier contracts'] = sc.earlier ? sc.earlier.map(e => ({ json: e })) : [{ json: {} }];
    if (r[0].json.has_open_conflicts) outs['09 Conflict check'] = [{ json: sc.luna === undefined ? { error: 'x' } : { output: [{ content: [{ text: JSON.stringify(sc.luna) }] }] } }];
    r = await run('09b Contract', '09_contract.js', [{ json: {} }]);
    if (r[0].json.critical.length === 0) { contractReady = true; final = await stage03(sc, r); }
    else final = await run('Hold and ask the client', 'hold.js', r);
  }
  let v = await run('V1 Vault events', 'v1_vault.js', final);
  outs['V1 Vault events'] = v;
  let ev = await run('V2 One row per event', 'v2_split.js', [{ json: {} }]);
  const vault = ev.map(e => e.json); const rows = [v[0].json.row];
  // Go 1 (15 Oct 2026): sc.go1 lists the owner's answers in order; 'timeout' means the 24-hour wait ran out.
  let answers = 0;
  while (final[0].json.status === 'awaiting_go_1' && Array.isArray(sc.go1) && answers < sc.go1.length) {
    const a = sc.go1[answers++];
    const st12 = outs['12 Who leads the scene'][0].json;
    const row = v[0].json.row;
    let item;
    if (a === 'timeout') item = { json: { ...row } };
    else {
      const ans = typeof a === 'function' ? a(st12, row) : { ...a };
      if (!('go1_token' in ans)) ans.go1_token = row.go1_token;
      if (!('run_id' in ans)) ans.run_id = st12.run_id;
      if (!('round' in ans)) ans.round = st12.go1_rounds || 0;
      item = { json: { headers: {}, params: {}, query: {}, body: ans } };
    }
    outs['Wait for go 1'] = [item];
    let g = await run('G1 Go 1 verdict', 'g1_verdict.js', outs['Wait for go 1']);
    const route = g[0].json.go1_route;
    if (route === 'rewait') { final = g; continue; } // "Wait again?" → back to the Wait node; nothing is written
    if (route !== 'rewait') { rows.push({ ...g[0].json.go1_row, resume_url: '', go1_token: '', recorded_by: 'G1 Record answer' }); g = await run('G1 Restore state', 'g1_restore.js', [{ json: {} }]); }
    if (route === 'replan') final = await planFrom11a(sc, g);
    else if (route === 'recheck') final = await checkLoop(sc, await run('11b Stylist check', '11b_check.js', g));
    else final = g;
    v = await run('V1 Vault events', 'v1_vault.js', final);
    outs['V1 Vault events'] = v;
    ev = await run('V2 One row per event', 'v2_split.js', [{ json: {} }]);
    vault.push(...ev.map(e => e.json)); rows.push(v[0].json.row);
  }
  // Stage 04 (15 Oct 2026): runs after a genuine go 1 when the scenario gives sc.s04 (simulated Google, Drive and table answers).
  let s04trace = null;
  if (final[0].json.status === 'go_1_given' && sc.s04) {
    s04trace = {};
    final = await stage04(sc, s04trace);
    v = await run('V1 Vault events', 'v1_vault.js', final);
    outs['V1 Vault events'] = v;
    ev = await run('V2 One row per event', 'v2_split.js', [{ json: {} }]);
    vault.push(...ev.map(e => e.json)); rows.push(v[0].json.row);
  }
  return { path: final[0].json.status, contract_ready: contractReady, out: final[0].json, events: vault.map(e => e.kind), row: v[0].json.row, rows, vault, s04: s04trace };
}

// ---- Stage 04 (15 Oct 2026): compile, model, guard, Drive folder, reserve, request, submission, polls, receipt, Drive upload, result. ----
const REGISTRY = [
  { id: 1, model_id: 'gemini-nano-banana-2.1', label: 'Gemini Nano Banana 2.1', status: 'trial', priority: 1, endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions', input_usd_per_m: 1.5, text_out_usd_per_m: 7.5, image_out_usd_per_m: 30, input_image_tokens: 1120, image_tokens_1k: 1120, image_tokens_2k: 1680, image_tokens_4k: 3780, max_refs: 14, ratios: '1:1|1:4|1:8|2:3|3:2|3:4|4:1|4:3|4:5|5:4|8:1|9:16|16:9|21:9', sizes: '1K|2K|4K', price_date: '2026-10-14' },
  { id: 2, model_id: 'gemini-3-pro-image', label: 'Nano Banana Pro', status: 'trial', priority: 2, endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions', input_usd_per_m: 2, text_out_usd_per_m: 12, image_out_usd_per_m: 120, input_image_tokens: 560, image_tokens_1k: 1120, image_tokens_2k: 1120, image_tokens_4k: 2000, max_refs: 0, ratios: '', sizes: '1K|2K|4K', price_date: '2026-10-14' }
];
const approved = (patch) => REGISTRY.map(r => r.model_id === 'gemini-nano-banana-2.1' ? { ...r, status: 'approved', ...(patch || {}) } : r);
// A PNG header for a 2048 x 2048 image (enough for the size check; not a full image).
function fakePng(w, h) { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }
const IMG = fakePng(2048, 2048).toString('base64');
const USAGE = { total_input_tokens: 2700, total_output_tokens: 1680, total_thought_tokens: 300, output_tokens_by_modality: [{ modality: 'image', tokens: 1680 }] };
const done = (extra) => ({ statusCode: 200, body: { id: 'int_abc123', status: 'completed', steps: [{ type: 'user_input', content: [] }, { type: 'thought', summary: [{ type: 'text', text: 'thinking' }] }, { type: 'model_output', content: [{ type: 'image', mime_type: 'image/png', data: IMG }] }], usage: USAGE, ...(extra || {}) } });
async function stage04(sc, trace) {
  const o = sc.s04 || {};
  let r = await run('04 Settings', '04_settings.js', [{ json: {} }]);
  outs['04 Settings'] = r = [{ json: { ...r[0].json, drive_root_folder_id: 'root-folder-1', ...(o.settings || {}) } }];
  if (o.repair) { outs['V1 Vault events'][0].json.repair_orders = o.repair; outs['V1 Vault events'][0].json.status = 'repair_ordered'; } // set by stage 05 (15 Oct 2026)
  r = await run('13 Compile', '13_compile.js', r);
  const reg = o.registry || REGISTRY;
  outs['14a Load model registry'] = reg.length ? reg.map(x => ({ json: x })) : [{ json: {} }];
  r = await run('14 Choose model', '14_choose.js', outs['14a Load model registry']);
  const result = async (inp) => run('15q Stage 04 result', '15q_result.js', inp);
  if (!r[0].json.s04.go) { trace.stopped_at = 14; return result(r); }
  const opsList = o.opsFromRun ? o.opsFromRun(outs['13 Compile'][0].json.run_id) : (o.ops || []);
  outs['15a Load operations'] = o.opsError ? [{ json: { error: 'table unavailable' } }] : (o.opsPassThrough ? r : (opsList.length ? opsList.map(x => ({ json: x })) : [{ json: {} }]));
  r = await run('15b Dispatch guard', '15b_guard.js', outs['15a Load operations']);
  if (!r[0].json.s04.go) { trace.stopped_at = 15; return result(r); }
  trace.op_row = r[0].json.s04.op_row;
  outs['15c Drive run folder'] = [{ json: o.folder !== undefined ? o.folder : { id: 'run-folder-9', name: 'x', kind: 'drive#file' } }];
  // The data table insert returns the saved row (seen in execution 404).
  outs['15d Reserve operation'] = [{ json: o.insert !== undefined ? o.insert : { ...trace.op_row, id: 7, createdAt: 'x', updatedAt: 'x' } }];
  trace.reserved = true;
  r = await run('15e Ready check', '15e_ready.js', outs['15d Reserve operation']);
  if (o.tamper) r[0].binary = { ...r[0].binary, photo: { ...r[0].binary.photo, data: Buffer.from('changed').toString('base64') } };
  r = await run('15f Build request', '15f_request.js', r);
  const saved = () => [{ json: o.save !== undefined ? (typeof o.save === 'function' ? o.save(outs) : o.save) : { ...trace.op_row, ...trace.op_update, id: 7 } }];
  if (!r[0].json.s04.send) { r = await run('15o Final receipt', '15o_final.js', r); trace.op_update = r[0].json.s04.op_update; outs['15p Save receipt'] = o.insert !== undefined ? [{ json: {} }] : saved(); return result(outs['15p Save receipt']); }
  trace.body = JSON.parse(r[0].json.body);
  outs['15g Send to Google'] = [{ json: o.submit !== undefined ? o.submit : { statusCode: 200, body: { id: 'int_abc123', status: 'in_progress' } } }];
  r = await run('15h Read submission', '15h_submission.js', outs['15g Send to Google']);
  outs['15i Save request id'] = [{ json: { id: 7 } }];
  trace.polls = 0;
  if (r[0].json.next === 'poll') {
    const polls = o.polls || [{ statusCode: 200, body: { id: 'int_abc123', status: 'in_progress' } }, done()];
    for (let i = 0; ; i++) {
      outs['15k Ask Google'] = [{ json: polls[Math.min(i, polls.length - 1)] }];
      r = await run('15l Read status', '15l_status.js', outs['15k Ask Google']);
      trace.polls = i + 1;
      if (r[0].json.poll.next !== 'wait') break;
      if (i > 60) throw new Error('poll loop did not stop');
    }
  } else r = outs['15i Save request id'];
  r = await run('15m Receipt', '15m_receipt.js', r);
  trace.receipt_binary = r[0].binary || null;
  if (r[0].json.s04.store_image) {
    const im = r[0].json.s04.receipt.image;
    outs['15n Drive upload'] = o.uploadPassThrough ? r : [{ json: o.upload !== undefined ? o.upload : { id: 'file-55', sha256Checksum: im.sha256, webViewLink: 'https://drive.google.com/file/d/file-55/view' } }];
    r = await run('15o Final receipt', '15o_final.js', outs['15n Drive upload']);
  } else r = await run('15o Final receipt', '15o_final.js', r);
  trace.op_update = r[0].json.s04.op_update;
  outs['15p Save receipt'] = o.savePassThrough ? r : saved();
  return result(outs['15p Save receipt']);
}

// ---- Stage 03 (15 Oct 2026): retrieve, plan, plan check, lead, go 1 ticket. Model replies are simulated. ----
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogue.json'), 'utf8'));
const PALETTE = { dominant_60: 'warm white walls and pale oak floor', secondary_30: 'oatmeal linen curtains and rug', accent_10: 'muted terracotta cushions and vase' };
// A plan that should pass: one entry per output, at most one shortlisted Midas piece. Changed 16 Oct 2026 (prompt check P3, owner
// decisions 22-23): no lamp or rug that is not a Midas piece, no generic props unless a test sends them, and the new room and person fields.
function autoPlan(state, opts) {
  opts = opts || {};
  const pick = (state.retrieval.shortlist[0] || {}).sku;
  return { shots: state.shots.map(x => x.kind === 'white'
    ? { output_id: x.output_id, frame: x.frame, room_size: '', setting: 'Pure white seamless background.', light: 'Neutral studio light.', camera: 'As the vendor photo.', presentation: 'Product alone.', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: 'master' }
    : { output_id: x.output_id, frame: x.frame, room_size: 'medium', room: { walls: 'warm white plaster', floor: 'pale oak boards', windows: 'one tall window on the left with plain sheer curtains', zone: 'centred against the long wall' }, setting: 'A calm living room with warm white walls and a pale oak floor.', light: /Warm evening/.test(x.light_preset || '') ? 'Warm evening light from the cove light and the downlights.' : (/Golden/.test(x.light_preset || '') ? 'Low warm late-afternoon sun from the left window.' : 'Soft daylight from the left window.'), camera: 'Eye level, three-quarter front, whole product in frame.', presentation: 'The product stands centred against the long wall as it would be used.', person: opts.person || '',
        supporting_props: opts.props || [], midas_pieces: opts.midas !== undefined ? opts.midas : (pick ? [{ sku: pick, count: 1, purpose: 'surface for a vase', rests_on: 'the floor beside the product' }] : []), palette_roles: PALETTE, rationale: 'balanced room' }),
    risks: ['piece count drift'], catalogue_rejected: [] };
}
const passAll = st => ({ plans: st.shots.filter(x => x.plan && !x.plan_ok).map(x => ({ shot: x.n, checks: Object.fromEntries(['product_unchanged', 'handedness_kept', 'shown_with_kept', 'frame_respected', 'client_choices_respected', 'product_visible', 'props_clean', 'midas_pieces_ok', 'room_rules', 'lead_respected'].map(k => [k, { result: 'pass', evidence: 'ok' }])), rewrite: null })) });
let criticCall = 0, plannerCall = 0;
async function stage03(sc, r) {
  criticCall = 0; plannerCall = 0;
  outs['10a Load Midas catalogue'] = (sc.catalogue || CATALOGUE).map(x => ({ json: x }));
  if (sc.catalogue && !sc.catalogue.length) outs['10a Load Midas catalogue'] = [{ json: {} }];
  r = await run('10 Retrieve Midas pieces', '10_retrieve.js', outs['10a Load Midas catalogue']);
  if (r[0].json.critical.length) return run('Hold and ask the client', 'hold.js', r);
  if (r[0].json.scene_outputs > 0) return planFrom11a(sc, r);
  return run('12 Who leads the scene', '12_lead.js', r);
}
// 11a → planner → 11b → critic loop → 12 (or hold). Also the "replan" route after go 1.
async function planFrom11a(sc, r) {
  r = await run('11a Plan ticket', '11a_ticket.js', r);
  const st0 = r[0].json;
  const pl = Array.isArray(sc.planners) ? sc.planners[plannerCall] : undefined;
  plannerCall += 1;
  const plan = pl !== undefined ? (typeof pl === 'function' ? pl(st0) : pl) : (typeof sc.planner === 'function' ? sc.planner(st0) : (sc.planner || autoPlan(st0, sc.planOpts)));
  const plannerRaw = sc.plannerRaw !== undefined && plannerCall === 1 ? sc.plannerRaw : { output: [{ content: [{ type: 'output_text', text: JSON.stringify(plan) }] }] };
  outs['11 Stylist plans the scenes'] = [{ json: plannerRaw }];
  r = await run('11b Stylist check', '11b_check.js', outs['11 Stylist plans the scenes']);
  return checkLoop(sc, r);
}
// From the output of 11b: critic → verdict → (again → 11b) → 12 or hold. Also the "recheck" route after go 1 (enters at 11b).
async function checkLoop(sc, r) {
  let round = 0;
  while (true) {
    if (!r[0].json.critic_needed) break;
    const c = (sc.critic || [])[criticCall];
    criticCall += 1;
    const reply = c === undefined ? passAll(r[0].json) : (typeof c === 'function' ? c(r[0].json) : c);
    outs['11c Plan critic'] = [{ json: reply && reply.__raw ? reply.__raw : { content: [{ type: 'text', text: JSON.stringify(reply) }] } }];
    round += 1;
    r = await run('11d Plan verdict', '11d_verdict.js', outs['11c Plan critic']);
    if (!r[0].json.plan_again) break;
    if (round > 6) throw new Error('plan loop did not stop');
    r = await run('11b Stylist check', '11b_check.js', r);
  }
  if (r[0].json.critical.length) return run('Hold and ask the client', 'hold.js', r);
  return run('12 Who leads the scene', '12_lead.js', r);
}
// A critic reply that fails one check on every pending scene shot and offers a rewrite.
function failWith(st, check, rewrite) {
  const r = passAll(st);
  for (const p of r.plans) { const sh = st.shots.find(x => x.n === p.shot); if (sh && sh.kind !== 'white') { p.checks[check] = { result: 'fail', evidence: 'simulated fail' }; p.rewrite = rewrite || null; } }
  return r;
}
// Decision address check, run alone: body = what the owner sent, rows = what "G1a Find waiting run" returned.
async function decisionCheck(body, rows, webhookUrl) {
  reset();
  outs['A7 owner decision webhook'] = [{ json: { headers: {}, body, webhookUrl: webhookUrl || 'https://test.app.n8n.cloud/webhook/claude-midas-a7-decision' } }];
  const r = await run('G1b Decision check', 'g1_decision_check.js', rows.length ? rows.map(x => ({ json: x })) : [{ json: {} }]);
  return r[0].json;
}
async function forwardResult(checkJson, httpJson) {
  reset();
  outs['G1b Decision check'] = [{ json: checkJson }];
  const r = await run('G1d Forward result', 'g1_forward.js', [{ json: httpJson }]);
  return r[0].json;
}
module.exports = { scenario, autoPlan, failWith, decisionCheck, forwardResult, REGISTRY, approved, done, IMG, USAGE };
