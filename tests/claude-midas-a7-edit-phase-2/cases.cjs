// Jobs without an edit base. Phase 2.4 must leave their output as it was before 2.4; fixtures/non_edit.json holds the
// output of the pre-2.4 node code (workflow version 2c6966eb's predecessor, saved 19 Oct 2026 16:36) for these same inputs.
const W = require('./world.cjs');
const clone = x => JSON.parse(JSON.stringify(x));
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (['at', 'started_at', 'received_at', 'go1_token'].includes(k) ? 0 : v)));
// run(name, nodes, input) runs one Code node; scene is the 19a output of the light+wall edit (any scene of this world).
async function nonEditCases(run, scene, settings) {
  const out = {};
  // 01: a plain new project is read as before.
  const draft = '11111111-2222-4333-8444-555555555555';
  const plain = { clientRunId: 'owner-' + draft, runId: 'claude-a7-' + draft, jobMode: 'new_project', scope: { outcomes: ['Lifestyle'], view: 'Wide view + close-up' }, item: { inventory: [{ item: 'sofa', count: 1 }] },
    ownerWorkspace: { versionId: draft, requestId: 'r' }, sourceUnderstanding: { confirmationFingerprint: 'f', sourceSha256: W.A } };
  const i01 = (await run('01 Intent & scope', {}, { json: { body: { payload: plain } } }))[0].json;
  out.intake = strip({ usable: i01.usable, problems: i01.problems, not_applied: i01.not_applied, brief: i01.brief });
  // 12: a white-only job.
  const base = W.state([{ kind: 'wall', value: 'Sage' }], ['edit']);
  delete base.shots; base.trail = []; base.retrieval = { shortlist: [], notes: [], rejected: [] }; base.cost_estimate = { no_repair: 0.2 }; base.lead = 'product_leads';
  base.brief.edit = null; base.outputs = [{ id: 'white_master', kind: 'white', mode: 'fidelity_locked', locks: [] }];
  out.white_only_plan = strip((await run('12 Who leads the scene', {}, { json: base }))[0].json);
  // 13: a series image made from an approved base of the same job, and a plain placement in a stage-07 room.
  const mk = derived => { const s = clone(scene); s.status = 'scene_due'; s.guidance_required = false; delete s.scene.edit; s.scene.room.edit = false; s.scene.room.from_run = '';
    s.outputs[0] = { ...s.outputs[0], edit_from_result: false, edit_changes: undefined, locks: ['product identity as in the vendor photo'] };
    if (!derived) s.scene.room = { source: 'made in stage 07', drive_file_id: 'x', sha256: W.B, file_name: 'room.png' }; else s.scene.room.changes = ['light'];
    s.scene.refs = [{ n: 1, role: 'vendor photo', key: 'ref_0', mime: 'image/jpeg', bytes: 1, sha256: W.A }, { n: 2, role: 'approved white master', key: 'scene_master', mime: 'image/png', bytes: 1 }, { n: 3, role: 'room', key: 'scene_room', mime: 'image/png', bytes: 1 }, { n: 4, role: 'Midas piece', sku: 'M1', key: 'scene_prop_0', mime: 'image/jpeg', bytes: 1 }];
    s.observation = { category_seen: 'sofa', pieces_seen: [{ kind: 'sofa', role: 'product' }], count_eye: 1, design_locks: [], sided_parts: [] }; return s; };
  for (const derived of [true, false]) {
    const s04 = (await run('13 Compile', { 'V1 Vault events': { json: mk(derived) } }, { json: settings }))[0].json.s04;
    out[derived ? 'prompt_series_image' : 'prompt_placement'] = s04.dispatch ? s04.dispatch.prompt : { critical: s04.critical };
  }
  // 19a: a normal job after the white package: the wide base first, then the hero made from it.
  const st = clone(scene); delete st.scene; delete st.scenes; st.status = 'white_package_ready'; st.brief.edit = null;
  st.outputs = [{ id: 'white_master', kind: 'white' }, { id: 'wide', kind: 'wide', camera: 'Reference view', light: 'day', from: '' }, { id: 'hero', kind: 'hero', camera: 'Reference view', light: 'day', from: '' }];
  st.shots = [{ n: 2, output_id: 'wide', frame: '3:2', plan: { midas_pieces: [{ sku: 'M1' }] } }, { n: 3, output_id: 'hero', frame: '1:1', plan: { midas_pieces: [] } }];
  st.approved = { by: 'owner', candidate: { sha256: W.M, drive_file_id: 'm' } };
  out.scene_tickets = [];
  for (let step = 0; step < 2; step++) {
    const n = (await run('19a Scene ticket', { 'V1 Vault events': { json: st }, '04 Settings': { json: settings } }, {}))[0].json;
    out.scene_tickets.push(strip({ status: n.status, scene: n.scene, next: n.next }));
    st.scenes = n.scenes; st.scenes.done = { wide: { by: 'owner', candidate: { sha256: 'e'.repeat(64), drive_file_id: 'w' }, props: [{ sku: 'M1' }], files: { status: 'ready' } } }; st.scenes.current = null; st.status = 'scene_files_ready';
  }
  // 16a: the review of a scene that is not an edit.
  const r = clone(scene); r.status = 'awaiting_review'; delete r.scene.edit; delete r.scene.room.edit; delete r.scene.room.from_run;
  r.outputs[0].locks = ['product identity as in the vendor photo']; r.brief.edit = null;
  r.scene.refs = [{ role: 'vendor photo', key: 'ref_0' }, { role: 'approved white master', key: 'scene_master' }, { role: 'room', key: 'scene_room' }, { role: 'Midas piece', sku: 'M1', key: 'scene_prop_0', name: 'Arc lamp (SKU M1)' }];
  r.stage04 = { candidate: { output_id: 'edit_1', drive_file_id: 'cand', sha256: 'f'.repeat(64), scene: { phase: 'place' } }, operation: { attempt: 1 } };
  r.observation = { category_seen: 'sofa', sided_parts: [], design_locks: [], shown_with: [] };
  const bin = { data: 'x' };
  const t16 = (await run('16a Review ticket', { 'V1 Vault events': { json: r }, '02 Ingest files': { json: {}, binary: { ref_0: bin } }, '15m Receipt': { json: {}, binary: { image: bin } }, '19g Scene references': { json: {}, binary: { scene_prop_0: bin, scene_room: bin } }, '04 Settings': { json: settings } }, {}))[0];
  out.review_ticket = strip({ rv: t16.json.rv, binaries: Object.keys(t16.binary || {}) });
  return out;
}
module.exports = { nonEditCases, strip };
