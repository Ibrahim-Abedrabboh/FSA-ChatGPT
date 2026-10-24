// Scenes from an approved white image (20 Oct 2026): a new job that starts its scenes from the owner-approved white master of an
// earlier run instead of making a new one. Runs the live workflow's own Code nodes (n8n/claude-midas-a7/live/). No network, no AI
// call, no paid call.
// Run: node --test tests/claude-midas-a7-edit-phase-2/
const test = require('node:test');
const assert = require('node:assert/strict');
const { run, clone, workflow } = require('./harness.cjs');
const W = require('./world.cjs');

const draft = '11111111-2222-4333-8444-555555555555';
const whiteBase = (patch = {}) => ({ assetId: 'x', runId: W.parentRun, outputId: 'white_master', kind: 'white', driveFileId: 'DRIVEmaster123', sha256: W.M, px: '2048x2048', fileName: 'white.png', ...patch });
const payload = (base, scope = { outcomes: ['Lifestyle'], view: 'Wide view + close-up' }, options = []) => ({ clientRunId: 'owner-' + draft, runId: 'claude-a7-' + draft, jobMode: 'edit', parentRunId: W.parentRun, scope,
  item: { inventory: [{ item: 'sofa', count: 1 }] }, ownerWorkspace: { versionId: draft, requestId: 'r' }, sourceUnderstanding: { confirmationFingerprint: 'f', sourceSha256: W.A },
  edit: { source: 'saved', changes: 'New lifestyle scenes made from white.png. No new white master.', preserve: 'The product exactly as in the approved white image.', parentVersionId: 'p', options, base } });
const intent = async p => (await run('01 Intent & scope', {}, { json: { body: { payload: p } } }))[0].json;

// The earlier run: a white-only job whose white master the owner approved at go 2 and whose package is finished.
const release = { run_id: W.parentRun, output_id: 'white_master', classification: 'reviewed_owner_approved', candidate_sha256: W.M, at: '2026-10-18T03:20:22.587Z' };
const master = { output_id: 'white_master', attempt: 1, drive_file_id: 'DRIVEmaster123', folder_id: 'FOLDER', link: 'https://drive.google.com/file/d/DRIVEmaster123/view', sha256: W.M, px: '2048x2048', bytes: 1899002, file_name: 'white.png' };
const whiteRow = (pkg = {}) => ({ run_id: W.parentRun, required_outputs: JSON.stringify([{ id: 'white_master', kind: 'white' }]), references: JSON.stringify([{ name: 'sofa.jpg', role: 'product', sha256: W.A }]),
  package: JSON.stringify({ outcome: 'white_package_ready', master, release, ...pkg }), scenes: '' });
// This run after go 1: the planner's two scenes (no white master), waiting for E2.
const runState = () => ({ run_id: 'claude-a7-' + draft, client_run_id: 'owner-' + draft, status: 'edit_base_due', stage: '03 Retrieve & style', product_key: 'ref_0',
  references: [{ key: 'ref_0', name: 'sofa.jpg', role: 'product', sha256: W.A, bytes: 1000, mime: 'image/jpeg', image: true }],
  brief: { edit: { changes: 'New scenes', preserve: 'The product', options: [], base: { run_id: W.parentRun, output_id: 'white_master', kind: 'white', drive_file_id: 'DRIVEmaster123', sha256: W.M, px: '2048x2048', file_name: 'white.png' } }, preferences: { people: 'none' }, product_type: 'sofa' },
  outputs: [{ id: 'wide', kind: 'wide', outcome: 'lifestyle', camera: 'Reference view', light: '', from: '', mode: 'creative_room', locks: [], free: [] }, { id: 'detail', kind: 'detail', outcome: 'lifestyle', camera: 'Reference view', light: '', from: '', mode: 'fidelity_locked', locks: [], free: [] }],
  shots: [{ n: 1, output_id: 'wide', kind: 'wide', frame: 'square, 1:1', plan: { setting: 'living room', midas_pieces: [] } }, { n: 2, output_id: 'detail', kind: 'detail', frame: 'square, 1:1', plan: { setting: 'living room', midas_pieces: [] } }],
  go1_last: { decision: 'go', by: 'owner' }, contract: { a: 1 }, contract_stamp: 'stamp1', inventory: [{ item: 'sofa', count: 1 }], profile: { id: 'sofa' },
  retrieval: { shortlist: [], rejected: [], notes: [] }, trail: [], observation: { category_seen: 'sofa' } });
const e2 = async (row = whiteRow(), state = runState()) =>
  (await run('E2 Edit base', { 'V1 Vault events': { json: state }, 'E1 Load earlier run': [{ json: row }], '10a Load Midas catalogue': [] }, []))[0].json;
const settingsP = run('04 Settings', { '01 Intent & scope': { json: { client_run_id: 'owner-' + draft } } }, {}).then(r => r[0].json);

test('01 keeps the requested scenes and makes no new white master when the base is an approved white image', async () => {
  const j = await intent(payload(whiteBase()));
  assert.equal(j.usable, 'ok'); assert.deepEqual(j.problems, []);
  assert.deepEqual(j.brief.outputs.map(o => o.id), ['wide', 'detail'], 'the planned scenes stay; the white master is not made again');
  assert.ok(j.brief.outputs.every(o => !o.edit_from_result), 'they are new scenes, not an edit of an image');
  assert.equal(j.brief.edit.base.kind, 'white');
  assert.ok(j.not_applied.some(x => /start from the approved white image white\.png of the earlier version, so no new white master is made/.test(x)));
  const scene = await intent(payload(whiteBase({ kind: 'scene', outputId: 'wide' })));
  assert.deepEqual(scene.brief.outputs.map(o => o.id), ['edit_1'], 'a scene base is still an edit of that image');
  assert.equal(scene.brief.edit.base.kind, 'scene');
});

test('01 refuses a white base that is not the white master, and white-only scenes; edit options do not apply', async () => {
  assert.ok((await intent(payload(whiteBase({ outputId: 'hero' })))).problems.some(x => /must be the white master of the earlier run/.test(x)));
  assert.ok((await intent(payload(whiteBase(), { outcomes: ['White BK'] }))).problems.some(x => /need at least one lifestyle or website image/.test(x)));
  const j = await intent(payload(whiteBase(), undefined, [{ kind: 'lighting', value: 'Warm evening' }]));
  assert.deepEqual(j.brief.edit.options, []);
  assert.ok(j.not_applied.some(x => /Edit options apply to an edit of an approved scene.*lighting = Warm evening is not applied/.test(x)));
});

test('stage 03 plans the scenes from a white image (Scene to plan?), as for any job, and still skips the planner for a scene edit', () => {
  const expr = workflow.nodes.find(n => n.name === 'Scene to plan?').parameters.conditions.conditions[0].leftValue.replace(/^=\{\{|\}\}$/g, '');
  const decide = json => new Function('$json', 'return (' + expr + ');')(json);
  assert.equal(decide({ scene_outputs: 2, brief: { edit: { base: { kind: 'white' } } } }), true);
  assert.equal(decide({ scene_outputs: 1, brief: { edit: { base: { kind: 'scene' } } } }), false);
  assert.equal(decide({ scene_outputs: 1, brief: { edit: { base: { output_id: 'wide' } } } }), false, 'a base sent before kinds existed is a scene edit');
  assert.equal(decide({ scene_outputs: 2, brief: {} }), true);
  assert.equal(decide({ scene_outputs: 0, brief: { edit: { base: { kind: 'white' } } } }), false);
});

test('08 gives new scenes from a white image no edit locks, so the review asks for no "requested edit" check', async () => {
  const s = { observation: { design_locks: [], sided_parts: [], room: null }, exclusions: [], conflicts: [], profile: { checks: [] }, written_files: [], trail: [],
    brief: { outputs: [{ id: 'wide', kind: 'wide', camera: 'Reference view', light: '', from: '' }], edit: { changes: 'New scenes', preserve: 'The product', base: { kind: 'white' } }, preferences: { people: 'none' } } };
  const locks = async brief => (await run('08 Locks and freedoms', {}, { json: { ...s, brief: { ...s.brief, ...brief } } }))[0].json.outputs[0].locks;
  assert.ok(!(await locks({})).some(l => /^(requested edit|keep unchanged) \(owner\):/.test(l)));
  assert.ok((await locks({ edit: { changes: 'Warm light', preserve: 'The product', base: { kind: 'scene' } } })).some(l => /^requested edit \(owner\): Warm light/.test(l)), 'an edit keeps its locks');
});

test('E2 takes the earlier run\'s approved white master as this run\'s white master, without a scene queue of its own', async () => {
  const j = await e2();
  assert.equal(j.status, 'edit_base_ready'); assert.equal(j.stage, '07 Scenes');
  assert.deepEqual([j.approved.by, j.approved.output_id, j.approved.candidate.sha256, j.approved.candidate.drive_file_id, j.approved.without_review], ['owner', 'white_master', W.M, 'DRIVEmaster123', false]);
  assert.deepEqual([j.approved.inherited_from.run_id, j.approved.inherited_from.kind], [W.parentRun, 'white']);
  assert.equal(j.scenes, undefined, '19a queues the planned scenes as in any job');
  assert.deepEqual([j.edit_base.kind, j.edit_base.scenes], ['white', ['wide', 'detail']]);
  assert.deepEqual(j.vault_only, ['edit_base', 'hold', 'status']);
  assert.equal((await e2(whiteRow({ release: { ...release, classification: 'owner_exception' } }))).approved.without_review, true);
});

test('E2 holds, before anything is paid, when the white image is not exactly the earlier run\'s released white master', async () => {
  const held = async (row, state) => { const j = await e2(row, state); assert.equal(j.status, 'hold'); assert.equal(j.approved, undefined); return j.hold_reason; };
  assert.match(await held(whiteRow({ outcome: 'hold' })), /has no finished white package/);
  assert.match(await held(whiteRow({ master: { ...master, sha256: W.B } })), /is not the white master of the earlier run's package/);
  assert.match(await held(whiteRow({ master: { ...master, drive_file_id: 'DRIVEother123' } })), /is not the white master of the earlier run's package/);
  assert.match(await held(whiteRow({ release: { ...release, candidate_sha256: W.B } })), /no owner go 2 release of exactly this white master/);
  assert.match(await held(whiteRow({ release: { ...release, classification: 'incomplete' } })), /no owner go 2 release/);
  assert.match(await held({ ...whiteRow(), references: JSON.stringify([{ role: 'product', sha256: W.B }]) }), /product photo of this job is not the one the earlier run used/);
  const noScenes = runState(); noScenes.outputs = [];
  assert.match(await held(whiteRow(), noScenes), /no scene to make/);
  const noGo = runState(); noGo.go1_last = {};
  assert.match(await held(whiteRow(), noGo), /go 1 is not recorded/);
});

test('19a starts the first planned scene from the inherited white master, and the run is not held for its own package', async () => {
  const s = clone(await e2());
  const j = (await run('19a Scene ticket', { 'V1 Vault events': { json: s }, '04 Settings': { json: await settingsP } }, {}))[0].json;
  assert.notEqual(j.status, 'hold', j.hold_reason);
  assert.deepEqual(j.scenes.queue, ['wide', 'detail'], 'widest first, as in any job');
  assert.equal(j.scene.output_id, 'wide');
  assert.ok(!j.scene.edit, 'not an edit of an image');
});

test('V1 keeps the inherited white master in the run row, so a later edit of these scenes can check it', async () => {
  const s = clone(await e2());
  s.scenes = { queue: ['wide', 'detail'], done: {}, held: {}, log: [] };
  const row = (await run('V1 Vault events', {}, { json: s }))[0].json.row;
  const scenes = JSON.parse(row.scenes);
  assert.deepEqual([scenes.edit_base.run_id, scenes.edit_base.output_id, scenes.edit_base.sha256, scenes.edit_base.master.sha256, scenes.edit_base.master.drive_file_id], [W.parentRun, 'white_master', W.M, W.M, 'DRIVEmaster123']);
});

test('12 says at go 1 that no new white master is made and which approved white image the scenes start from', async () => {
  const code = workflow.nodes.find(n => n.name === '12 Who leads the scene').parameters.jsCode;
  assert.match(code, /No new white master is made: a go starts from the approved white image/);
  assert.match(code, /scenes_from_white: \{ starts_from:/);
});

// Live run claude-a7-070cc289 (20 Oct 2026, 14:12): after go 1, E2 passed but 19a held, "The scene settings could not be read (04 Settings
// did not run in this execution)". An edit or scenes from an approved image skip stage 04, so 04 Settings now runs before E1.
test('an edit base goes through 04 Settings before E1, so 19a can read the scene settings; other jobs reach 13 Compile as before', () => {
  const out = (name, i = 0) => ((workflow.connections[name] || {}).main || [])[i] || [];
  assert.deepEqual(out('Edit base due?').map(t => t.node), ['04 Settings']);
  assert.deepEqual(out('Blind · Settings recovery?', 1).map(t => t.node), ['Edit base after settings?']);
  assert.deepEqual([out('Edit base after settings?', 0).map(t => t.node), out('Edit base after settings?', 1).map(t => t.node)], [['E1 Load earlier run'], ['13 Compile']]);
  const node = workflow.nodes.find(n => n.name === 'Edit base after settings?');
  const expr = node.parameters.conditions.conditions[0].leftValue.replace(/^=\{\{|\}\}$/g, '');
  const decide = v1 => new Function('$', 'return (' + expr + ');')(name => { if (name !== 'V1 Vault events' || !v1) throw Error('node not run'); return { first: () => ({ json: v1 }) }; });
  assert.equal(decide({ status: 'edit_base_due' }), true);
  assert.equal(decide({ status: 'go_1_given' }), false);
  assert.equal(decide({ status: 'scene_due' }), false);
  assert.equal(decide(null), false, 'a path where V1 did not run goes on to 13 Compile');
  const reached = new Set(), next = ['04 Settings'];
  while (next.length) { const n = next.shift(); if (reached.has(n) || n === 'V1 Vault events') continue; reached.add(n); for (const br of (workflow.connections[n] || {}).main || []) for (const t of br || []) next.push(t.node); }
  assert.ok(reached.has('E2 Edit base'), '04 Settings leads to E2 on the edit path');
});
