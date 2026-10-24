// Edit phases 2.4-2.6 (19 Oct 2026): the A7 path that edits an owner-approved image of an earlier run, run on the live
// workflow's own Code nodes (n8n/claude-midas-a7/live/, version fb783f15). No network, no AI call, no paid call.
// Run: node --test tests/claude-midas-a7-edit-phase-2/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { run, clone, workflow } = require('./harness.cjs');
const W = require('./world.cjs');
const { nonEditCases } = require('./cases.cjs');

const settingsP = run('04 Settings', { '01 Intent & scope': { json: { client_run_id: 'owner-11111111-2222-4333-8444-555555555555' } } }, {}).then(r => r[0].json);
const editBase = async (options, changes, row = W.parentRow, ticket = W.ticket) =>
  (await run('E2 Edit base', { 'V1 Vault events': { json: W.state(options, changes) }, 'E1 Load earlier run': [{ json: row }], '10a Load Midas catalogue': W.catalogue.map(json => ({ json })) }, [{ json: ticket }]))[0].json;
const sceneTicket = async e2 => { const s = clone(e2); s.status = 'edit_base_ready'; return (await run('19a Scene ticket', { 'V1 Vault events': { json: s }, '04 Settings': { json: await settingsP } }, {}))[0].json; };
const LIGHT_WALL = [[{ kind: 'lighting', value: 'Warm evening' }, { kind: 'wall', value: 'Sage' }], ['light', 'edit']];
const CAMERA_FEWER = [[{ kind: 'camera', value: '45° right' }, { kind: 'props', value: 'Fewer' }], ['camera', 'edit']];
const REMOVE_ALL = [[{ kind: 'props', value: 'Remove all' }], ['edit']];
const compile = async (a, settings) => {
  const s = clone(a); s.status = 'scene_due'; s.guidance_required = false;
  s.scene.refs = [{ n: 1, role: 'vendor photo', key: 'ref_0', name: 'sofa.jpg', mime: 'image/jpeg', bytes: 1000, sha256: W.A }, { n: 2, role: 'approved white master', key: 'scene_master', mime: 'image/png', bytes: 1, sha256: W.M }, { n: 3, role: 'room', key: 'scene_room', mime: 'image/png', bytes: 1, sha256: W.B }]
    .concat(s.scene.props.map((p, i) => ({ n: 4 + i, role: 'Midas piece', sku: p.sku, key: 'scene_prop_' + i, mime: 'image/jpeg', bytes: 1 })));
  s.observation = { category_seen: 'sofa', pieces_seen: [{ kind: 'sofa', role: 'product' }], count_eye: 1, design_locks: [], sided_parts: [] };
  return (await run('13 Compile', { 'V1 Vault events': { json: s } }, { json: settings }))[0].json.s04;
};

test('the snapshot is the published main workflow with the per-site budget routing', () => {
  assert.equal(workflow.versionId, 'fb783f15-7d51-4018-96fd-9f01d700a420');
  const routed = workflow.nodes.filter(n => typeof n.parameters.url === 'string' && n.parameters.url.includes('budgetOrigin'));
  assert.equal(routed.length, 26);
  assert.ok(routed.every(n => n.parameters.url.includes("o === 'https://claude-final-midas-a7.netlify.app' ? o : 'https://midas-a7-owner-preview.netlify.app'")));
});

test('01 reads an edit of an approved image: at most two options, one image, and the base must belong to the parent run', async () => {
  const draft = '11111111-2222-4333-8444-555555555555', parent = W.parentRun;
  const payload = { clientRunId: 'owner-' + draft, runId: 'claude-a7-' + draft, jobMode: 'edit', parentRunId: parent, scope: { outcomes: ['Lifestyle'], view: 'Wide view + close-up' }, item: { inventory: [{ item: 'sofa', count: 1 }] },
    ownerWorkspace: { versionId: draft, requestId: 'r' }, sourceUnderstanding: { confirmationFingerprint: 'f', sourceSha256: W.A },
    edit: { source: 'saved', changes: 'Lighting: change the light to the Warm evening preset. Walls: paint the walls Sage.', preserve: 'The product', parentVersionId: 'p',
      options: [{ kind: 'lighting', value: 'Warm evening' }, { kind: 'wall', value: 'Sage' }, { kind: 'floor', value: 'Marble' }],
      base: { assetId: 'x', runId: parent, outputId: 'wide', driveFileId: 'DRIVEbase12345', sha256: W.B, px: '1024x1024', fileName: 'wide.png' } } };
  const j = (await run('01 Intent & scope', {}, { json: { body: { payload } } }))[0].json;
  assert.equal(j.usable, 'ok'); assert.deepEqual(j.problems, []);
  assert.deepEqual(j.brief.edit.options.map(o => o.kind), ['lighting', 'wall']);
  assert.ok(j.not_applied.some(x => /At most two changes per edit: floor = Marble is not applied/.test(x)));
  assert.ok(j.not_applied.some(x => /starts from the approved image wide, so it makes one image/.test(x)));
  assert.equal(j.brief.outputs.length, 1);
  assert.deepEqual([j.brief.outputs[0].id, j.brief.outputs[0].light, j.brief.outputs[0].from, j.brief.outputs[0].edit_from_result], ['edit_1', 'night', 'base_wide', true]);
  assert.deepEqual([j.brief.edit.base.run_id, j.brief.edit.base.output_id, j.brief.edit.base.sha256], [parent, 'wide', W.B]);
  payload.edit.base.runId = 'claude-a7-other';
  assert.ok((await run('01 Intent & scope', {}, { json: { body: { payload } } }))[0].json.problems.length > 0, 'a base from another run is refused');
});

test('E2 checks the approved image against the earlier run and holds when it differs', async () => {
  const e2 = await editBase(...LIGHT_WALL);
  assert.equal(e2.status, 'edit_base_ready');
  assert.deepEqual([e2.edit_base.run_id, e2.edit_base.output_id, e2.edit_base.sha256, e2.edit_base.master_sha256], [W.parentRun, 'wide', W.B, W.M]);
  assert.deepEqual(e2.edit_base.checks, ['owner approval of this file and checksum in the earlier run', 'same product photo as the earlier run', 'earlier white master package with its checksum', 'earlier scene ticket for this image']);
  assert.deepEqual([e2.outputs[0].kind, e2.outputs[0].camera, e2.outputs[0].light], ['wide', 'Full frontal', 'night']);
  assert.deepEqual(e2.edit_base.props_not_in_stock, ['M2']);
  assert.deepEqual([e2.retrieval.shortlist.map(x => x.sku), e2.edit_base.props_added_from_catalogue], [['M1'], ['M1']]);
  const none = await editBase(...REMOVE_ALL);
  assert.deepEqual([none.retrieval.shortlist, none.edit_base.props_added_from_catalogue, none.edit_base.props_not_in_stock], [[], [], []], 'an edit that removes every piece checks no stock');
  const tampered = await editBase([{ kind: 'wall', value: 'Sage' }], ['edit'], { ...W.parentRow, scenes: W.parentRow.scenes.replace(W.B, 'd'.repeat(64)) });
  assert.equal(tampered.status, 'hold');
  assert.match(tampered.hold_reason, /not the one the owner approved in the earlier run/);
});

test('each option type reaches the scene ticket as an edit of the approved image', async () => {
  const lw = await sceneTicket(await editBase(...LIGHT_WALL));
  assert.equal(lw.scene.mode, 'edit_from_result'); assert.equal(lw.scene.room.content, 'approved view'); assert.equal(lw.scene.room.sha256, W.B);
  assert.deepEqual([lw.scene.presets.view, lw.scene.presets.light.preset], ['Full frontal', 'night']);
  assert.deepEqual(lw.scene.props.map(p => p.sku), ['M1']);
  assert.deepEqual(lw.scene.props_left_out, [{ sku: 'M2', why: "not on this run's checked shortlist" }]);
  const cf = await sceneTicket(await editBase(...CAMERA_FEWER));
  assert.deepEqual([cf.scene.presets.view, cf.scene.presets.light.preset], ['45° right', 'warm']);
  assert.deepEqual(cf.scene.props_left_out, [{ sku: 'M2', why: "removed by the owner's edit (Fewer)" }]);
  const ra = await sceneTicket(await editBase(...REMOVE_ALL));
  assert.deepEqual(ra.scene.props, []);
  assert.deepEqual(ra.scene.props_left_out.map(p => p.why), ["removed by the owner's edit (Remove all)", "removed by the owner's edit (Remove all)"]);
  for (const t of [lw, cf, ra]) assert.match(t.next, /No paid call was made in this step/);
});

test('13 prompts an edit to keep everything in the approved image except what the edit names', async () => {
  const settings = await settingsP;
  const ra = await compile(await sceneTicket(await editBase(...REMOVE_ALL)), settings);
  const p = ra.dispatch.prompt;
  assert.match(p, /This edit starts from it: keep everything in it exactly as it is \(the room, its walls, floor, windows and materials, every piece where it stands, the camera, the light and its direction\) except what the owner-requested edit below names/);
  assert.match(p, /Owner-requested edit for this image: props Remove all\./);
  assert.match(p, /Framing: exactly as in image 3/); assert.match(p, /Camera: exactly as in image 3; the camera does not move/); assert.match(p, /Light: exactly as in image 3/);
  const lw = (await compile(await sceneTicket(await editBase(...LIGHT_WALL)), settings)).dispatch.prompt;
  assert.match(lw, /except what the owner-requested edit below names and the light, as the light line below says/);
  assert.match(lw, /Light: change the light, to about 2700 K colour temperature \(Warm evening preset\)/);
  const cf = (await compile(await sceneTicket(await editBase(...CAMERA_FEWER)), settings)).dispatch.prompt;
  assert.doesNotMatch(cf, /Camera: exactly as in image 3/, 'a camera option moves the camera');
});

test('floor and defect edits change only what they name: camera, framing and light stay as in the approved image', async () => {
  const settings = await settingsP;
  for (const [option, line] of [[{ kind: 'floor', value: 'Marble' }, 'floor Marble'], [{ kind: 'defect', value: 'the left arm is too short' }, 'defect the left arm is too short']]) {
    const e2 = await editBase([option], ['edit']);
    assert.equal(e2.status, 'edit_base_ready', option.kind);
    const p = (await compile(await sceneTicket(e2), settings)).dispatch.prompt;
    assert.match(p, new RegExp('Owner-requested edit for this image: ' + line + '\\.'), option.kind);
    for (const keep of [/Framing: exactly as in image 3/, /Camera: exactly as in image 3; the camera does not move/, /Light: exactly as in image 3/]) assert.match(p, keep, option.kind);
  }
});

test('12 and 16a: go 1 offers the edit only as approve or stop, and the review compares against the approved image', async () => {
  const base = W.state([{ kind: 'wall', value: 'Sage' }], ['edit']);
  delete base.shots; base.trail = []; base.retrieval = { shortlist: [], notes: [], rejected: [] }; base.cost_estimate = { no_repair: 0.2 }; base.lead = 'product_leads';
  const plan = (await run('12 Who leads the scene', {}, { json: base }))[0].json;
  assert.match(plan.go1.decision_needed, /^go 1: approve the edit, or stop\./); assert.match(plan.go1.decision_needed, /A change at go 1 is not offered for an edit/);
  assert.deepEqual(plan.shots[0].plan.midas_pieces, []);
  assert.equal(plan.go1.edit.starts_from.output_id, 'wide');
  const a = await sceneTicket(await editBase(...CAMERA_FEWER)), settings = await settingsP, bin = { data: 'x' };
  const s = clone(a); s.status = 'awaiting_review';
  s.scene.refs = [{ role: 'vendor photo', key: 'ref_0' }, { role: 'approved white master', key: 'scene_master' }, { role: 'room', key: 'scene_room' }, { role: 'Midas piece', sku: 'M1', key: 'scene_prop_0', name: 'Arc lamp (SKU M1)' }];
  s.stage04 = { candidate: { output_id: 'edit_1', drive_file_id: 'cand', sha256: 'f'.repeat(64), scene: { phase: 'place' } }, operation: { attempt: 1 } };
  s.observation = { category_seen: 'sofa', sided_parts: [], design_locks: [], shown_with: [] };
  const t = (await run('16a Review ticket', { 'V1 Vault events': { json: s }, '02 Ingest files': { json: {}, binary: { ref_0: bin } }, '15m Receipt': { json: {}, binary: { image: bin } }, '19g Scene references': { json: {}, binary: { scene_prop_0: bin, scene_room: bin } }, '04 Settings': { json: settings } }, {}))[0].json.rv;
  assert.equal(t.ready, true); assert.ok(t.edit_base);
  assert.equal(t.binary_names, 'vendor,candidate,prop_0,base');
  assert.match(t.critic_text, /Image 4 is the owner-approved image this edit starts from/);
  assert.match(t.critic_text, /unchanged_from_base \(everything the edit does not name is as in image 4/);
});

test('an edit of an edit starts from the child run approved image with the original white master', async () => {
  const a = await sceneTicket(await editBase(...LIGHT_WALL));
  const child = clone(a); child.run_id = W.parentRun.replace('99999999', '77777777'); child.status = 'scene_files_ready'; child.stage = '07 Scenes'; child.vault_only = ['status'];
  child.scenes.done = { edit_1: { by: 'owner', candidate: { drive_file_id: 'DRIVEedit1xyz', sha256: 'e'.repeat(64) }, props: [{ sku: 'M1' }] } };
  const v1 = (await run('V1 Vault events', {}, { json: child }))[0].json;
  const row = { run_id: child.run_id, ...v1.row };
  assert.equal(JSON.parse(row.scenes).edit_base.master.sha256, W.M);
  const gs = W.state([{ kind: 'floor', value: 'Marble' }], ['edit']);
  gs.brief.edit.base = { run_id: child.run_id, output_id: 'edit_1', drive_file_id: 'DRIVEedit1xyz', sha256: 'e'.repeat(64) };
  const tk = { run_id: child.run_id, kind: 'scene_ticket', at: '2026-10-19T09:00:00Z', payload: JSON.stringify({ scene: a.scene }) };
  const e2 = (await run('E2 Edit base', { 'V1 Vault events': { json: gs }, 'E1 Load earlier run': [{ json: row }], '10a Load Midas catalogue': W.catalogue.map(json => ({ json })) }, [{ json: tk }]))[0].json;
  assert.equal(e2.status, 'edit_base_ready', e2.hold_reason);
  assert.equal(e2.approved.candidate.sha256, W.M);
});

test('jobs without an edit base give the same intake, plan, tickets, prompts and review as before phase 2.4', async () => {
  const settings = await settingsP, scene = await sceneTicket(await editBase(...LIGHT_WALL));
  const now = await nonEditCases(run, scene, settings);
  const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'non_edit.json'), 'utf8'));
  for (const key of Object.keys(before)) assert.deepEqual(JSON.parse(JSON.stringify(now[key])), before[key], key);
});

test('16b fails an edit whose untouched parts changed, and still sends it to the owner at go 2', async () => {
  const settings = await settingsP, a = await sceneTicket(await editBase(...REMOVE_ALL)), bin = { data: 'x' };
  const s = clone(a); s.status = 'awaiting_review'; s.scene.refs = [{ role: 'vendor photo', key: 'ref_0' }, { role: 'approved white master', key: 'scene_master' }, { role: 'room', key: 'scene_room' }];
  s.stage04 = { candidate: { output_id: 'edit_1', drive_file_id: 'cand', sha256: 'f'.repeat(64), scene: { phase: 'place' } }, operation: { attempt: 1 } };
  s.observation = { category_seen: 'sofa', sided_parts: [], design_locks: [], shown_with: [], count_eye: 1 };
  const rv = (await run('16a Review ticket', { 'V1 Vault events': { json: s }, '02 Ingest files': { json: {}, binary: { ref_0: bin } }, '15m Receipt': { json: {}, binary: { image: bin } }, '19g Scene references': { json: {}, binary: { scene_room: bin } }, '04 Settings': { json: settings } }, {}))[0].json.rv;
  const KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'framing', 'camera_level', 'light', 'no_text_or_logo', 'realism', 'edit_applied', 'unchanged_from_base'];
  // Replies in the providers' own shapes: Anthropic for the reviewer, Gemini for the blind count.
  const critic = over => ({ content: [{ type: 'text', text: JSON.stringify({ checks: Object.assign(Object.fromEntries(KEYS.map(k => [k, { result: 'pass', evidence: 'ok', ...(k === 'piece_count' ? { seen: 1 } : {}), ...(k === 'framing' ? { share: 50 } : {}) }])), over || {}), defects: [], scores: { fidelity: 90 }, summary: 'ok' }) }], usage: { input_tokens: 1, output_tokens: 1 } });
  const blind = { candidates: [{ content: { parts: [{ text: JSON.stringify({ pieces: [{ kind: 'sofa', count: 1 }], total: 1, unclear: [], cropped: false, box_2d: [300, 200, 700, 800] }) }] } }] };
  const verdict = async over => (await run('16b Review verdict', { 'V1 Vault events': { json: s }, '16a Review ticket': { json: { rv } }, '04 Settings': { json: settings }, '16 Critic review': { json: critic(over) }, '16x Blind count': { json: blind } }, {}))[0].json;
  const ok = await verdict();
  assert.deepEqual([ok.status, ok.review.result, ok.review.checks.unchanged_from_base.result], ['awaiting_go_2', 'passed', 'pass']);
  const moved = await verdict({ unchanged_from_base: { result: 'fail', evidence: 'the rug moved' } });
  assert.deepEqual([moved.status, moved.review.result], ['awaiting_go_2', 'failed']);
  assert.deepEqual(moved.review.defects.map(d => [d.check, d.what]), [['unchanged_from_base', 'the rug moved']]);
});
