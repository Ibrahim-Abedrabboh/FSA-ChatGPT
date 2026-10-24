// Local tests for the owner's answers of 16 Oct 2026, 04:16: framing on the longest side (a styling check), the view mapping,
// and one shared room for the views of a job. Runs the n8n Code-node source with mocked node outputs. No network, no AI, no paid call.
// Run: node tests/claude-midas-a7-views-framing/run_tests_views_framing.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const FIX6 = path.join(ROOT, 'tests', 'claude-midas-a7-stage-06', 'fixtures');
const clone = x => JSON.parse(JSON.stringify(x));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const ref = (buf, mime) => ({ _buf: buf, mimeType: mime || 'application/octet-stream' });
async function run(file, nodes, input) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = input || [];
  const $input = { first: () => items[0], all: () => items };
  const helpers = {
    getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b._buf) throw new Error('no binary ' + prop); return b._buf; },
    prepareBinaryData: async (buf, fileName, mimeType) => ({ _buf: buf, fileName, mimeType })
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFn('$', '$input', '$execution', 'require', fs.readFileSync(path.join(NODES, file), 'utf8'));
  return fn.call({ helpers }, $, $input, { resumeUrl: '' }, require);
}
const intake = async scope => (await run('01_Intent_scope.js', {}, [{ json: { body: { payload: JSON.stringify({ clientRunId: 'claude-test-views-0001', item: { inventory: [{ item: 'sofa', count: 1 }] }, scope }) } } }]))[0].json;
const ids = r => r.brief.outputs.map(o => o.id).join();
const kinds = r => r.brief.outputs.map(o => o.kind).join();
const ROOM = fs.readFileSync(path.join(FIX6, 'out_1125.jpg'));
const MASTER = fs.readFileSync(path.join(FIX6, 'master_2048.png'));

(async () => {
  const SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;
  const F = SETTINGS.framing;
  ok(F.measure === 'longest_side' && F.hero_span_pct.join() === '60,70' && F.wide_span_pct.join() === '40,55' && F.white_span_pct === 76 && F.white_margin_pct === 12, '04: framing on the longest side: hero 60-70, wide 40-55, white 76 (12% margin)');
  ok(F.white_note_band_pct.join() === '72,80' && F.detail_min_pct === 50 && !('lifestyle_hero_height_pct' in F), '04: note bands set (assumptions); the old height rule is gone');
  ok(SETTINGS.scenes.views_share_one_room === true && SETTINGS.auto_repair === false, '04: views share one room; auto_repair stays off');
  const src04 = fs.readFileSync(path.join(NODES, '04_Settings.js'), 'utf8');
  ok(/confirmed by the owner 16 Oct 2026 \(D9\)/.test(src04) && /never fails an image on its\s*\n?\s*\/\/?\s*own|never fails an image on its own/.test(src04), '04: the assumptions and the styling rule are written beside the values');

  // ---------- 01 Intent & scope: the view mapping ----------
  let r = await intake({ outcome: 'Lifestyle', view: 'Category template' });
  ok(ids(r) === 'white_master,hero' && kinds(r) === 'white,hero' && r.brief.view === 'Category template' && r.brief.views.join() === 'hero', '01: Category template → white master + hero (owner D8)');
  r = await intake({ outcome: 'Lifestyle', view: 'Studio decides' });
  ok(ids(r) === 'white_master,hero' && r.brief.view === 'Studio decides' && r.not_applied.length === 0, '01: "Studio decides" (the other page) → the same as Category template, no note');
  r = await intake({ outcome: 'Lifestyle', view: 'Wide view' });
  ok(ids(r) === 'white_master,wide' && r.brief.views.join() === 'wide', '01: Wide view → white master + wide');
  r = await intake({ outcome: 'Lifestyle', view: 'Close-up' });
  ok(ids(r) === 'white_master,detail' && kinds(r) === 'white,detail', '01: Close-up → white master + detail');
  r = await intake({ outcome: 'Lifestyle', view: 'Wide view + close-up' });
  ok(ids(r) === 'white_master,wide,detail', '01: Wide view + close-up → white master + wide + detail');
  r = await intake({ outcome: 'Lifestyle', view: 'wide view+close up' });
  ok(ids(r) === 'white_master,wide,detail' && r.brief.view === 'Wide view + close-up', '01: spacing and "close up" without a hyphen are read');
  r = await intake({ outcome: 'Lifestyle' });
  ok(ids(r) === 'white_master,hero' && r.brief.view === 'Category template' && r.not_applied.length === 0, '01: no view → Category template, no note');
  r = await intake({ outcome: 'Lifestyle', view: 'Bird view' });
  ok(ids(r) === 'white_master,hero' && r.not_applied.some(x => /View not offered: Bird view/.test(x) && /category template \(the hero view\) is used/.test(x)), '01: an unknown view → Category template, with a note');
  r = await intake({ outcome: 'White BK', view: 'Wide view' });
  ok(ids(r) === 'white_master' && r.brief.view === '' && r.brief.views.length === 0 && r.not_applied.some(x => /does not apply to a white background/.test(x)), '01: White BK ignores a view: white master only, noted');
  r = await intake({ outcome: 'White BK', view: 'Category template' });
  ok(ids(r) === 'white_master' && r.not_applied.length === 0, '01: White BK with the default view → no note');
  r = await intake({ outcome: 'White BK', view: '' });
  ok(ids(r) === 'white_master' && r.not_applied.length === 0, '01: White BK with no view (what the A7 page sends) → no note');
  r = await intake({ outcome: 'Website', view: 'Close-up' });
  ok(ids(r) === 'white_master,hero,wide,detail' && r.not_applied.some(x => /website package, which is always hero, wide and detail/.test(x)), '01: Website keeps its four views; a different view is noted');
  r = await intake({ outcomes: ['Lifestyle', 'Website'], view: 'Close-up' });
  ok(ids(r) === 'white_master,detail,hero,wide' && r.brief.outputs.filter(o => o.id === 'detail').length === 1, '01: Lifestyle and Website together → each view once');
  r = await intake({ outcome: 'Lifestyle', view: 'Wide view', imageCount: 2 });
  ok(r.not_applied.length === 0, '01: the page\'s count (2) matches the planned images → no note');
  r = await intake({ outcome: 'Lifestyle', view: 'Category template', imageCount: 1 });
  ok(ids(r) === 'white_master,hero' && r.not_applied.some(x => /counted 1 image\(s\); the chosen views give 2 \(white_master, hero\), so 2 are planned/.test(x)), '01: a count that differs from the views → the views decide, noted');
  r = await intake({ outcome: 'Lifestyle', imageCount: 9 });
  ok(!r.not_applied.some(x => /Asked for 9/.test(x)), '01: the 4-image cap note is for variations only');
  r = await intake({ outcome: 'Lifestyle', view: 'Wide view', aspect: '4:5' });
  ok(r.brief.proportions === '4:5' && r.brief.proportions_source === 'aspect', '01: a bare shape from the A7 page (4:5) is read');

  // ---------- 19a: views share one room; framing on the longest side ----------
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
  delete base.events; delete base.row; delete base.room_key;
  const plan = (cam) => ({ room_size: 'about 5 x 4 m', setting: 'A calm living room', light: 'soft afternoon light', camera: cam, presentation: 'the sofa against the long wall', supporting_props: [], midas_pieces: [], palette_roles: {} });
  function job(over) {
    const s = clone(base);
    s.outputs = s.outputs.concat(['hero', 'wide', 'detail'].map(k => ({ id: k, kind: k, outcome: 'website', mode: k === 'wide' ? 'creative_room' : 'fidelity_locked', locks: [], free: [] })));
    s.shots = s.shots.concat([
      { n: 2, output_id: 'hero', kind: 'hero', frame: 'square, 1:1', plan: plan('front view at seat height') },
      { n: 3, output_id: 'wide', kind: 'wide', frame: 'square, 1:1', plan: plan('wide front view showing the room') },
      { n: 4, output_id: 'detail', kind: 'detail', frame: 'square, 1:1', plan: plan('close on the boucle texture and the left arm') }]);
    s.status = 'white_package_ready'; s.stage = '06 Package';
    s.go1_last = { decision: 'go', by: 'owner', at: '2026-10-16T00:00:00Z' };
    s.approved = { output_id: 'white_master', attempt: 1, by: 'owner', at: '2026-10-16T00:00:00Z', candidate: { output_id: 'white_master', drive_file_id: 'drive-master', link: 'https://drive.example/m', sha256: sha(MASTER), px: '2048x2048', file_name: 'x_white_master_try1.png' } };
    return Object.assign(s, over || {});
  }
  const t19a = async (st, settings) => (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: st }], '04 Settings': [{ json: settings || SETTINGS }] }))[0].json;
  let a = await t19a(job());
  ok(a.scenes.queue.join() === 'wide,hero,detail' && a.scene.output_id === 'wide' && a.scene.phase === 'room' && a.scene.room === null, '19a: views queued widest first; the wide view starts with its own empty room');
  ok(a.scene.framing.type === 'wide' && a.scene.framing.band_pct.join() === '40,55' && /longest side spans only about 40-55% of the frame, never more than 55%/.test(a.scene.framing.text) && /at least 23% of the frame on each side/.test(a.scene.framing.text) && /whole in the frame and countable/.test(a.scene.framing.text), '19a: wide framing: longest side 40-55%, whole and countable');
  // The owner approves the wide view at go 2; its files are made (step 20).
  const wideCand = { output_id: 'wide', drive_file_id: 'drive-wide', link: 'https://drive.example/w', sha256: sha(ROOM), px: '2048x2048', file_name: 'x_wide_try1.jpg' };
  const afterWide = clone(a); afterWide.status = 'scene_files_ready'; afterWide.scenes.current = null; afterWide.scene = null;
  afterWide.scenes.done = { wide: { attempt: 1, by: 'owner', at: '2026-10-16T01:00:00Z', candidate: wideCand, props: [], props_left_out: [], files: { status: 'ready', files: [] } } };
  a = await t19a(afterWide);
  ok(a.status === 'scene_preparing' && a.scene.output_id === 'hero' && a.scene.phase === 'place', '19a: the hero starts straight at the placement (no new empty room)');
  ok(a.scene.room.content === 'approved view' && a.scene.room.from_output === 'wide' && a.scene.room.from_kind === 'wide' && a.scene.room.drive_file_id === 'drive-wide' && a.scene.room.sha256 === sha(ROOM) && a.scene.room.mime === 'image/jpeg' && a.scene.room.source === 'made in stage 07', '19a: its room is the owner-approved wide view, with file and checksum');
  ok(a.scene.framing.type === 'hero' && a.scene.framing.band_pct.join() === '60,70' && /width for a wide piece, the height for a tall piece/.test(a.scene.framing.text), '19a: hero framing: longest side 60-70%');
  ok(/hero view, made from the approved image of wide \(same room and pieces; only the camera moves\)/.test(a.next) && /the approved wide view \(wide\)/.test(a.scenes.log[a.scenes.log.length - 1].room), '19a: the next step and the log say where the room comes from');
  const heroSt = a;
  const afterHero = clone(a); afterHero.status = 'scene_files_ready'; afterHero.scenes.current = null; afterHero.scene = null;
  afterHero.scenes.done.hero = { attempt: 1, by: 'owner', candidate: Object.assign({}, wideCand, { output_id: 'hero', drive_file_id: 'drive-hero' }), files: { status: 'ready', files: [] } };
  a = await t19a(afterHero);
  ok(a.scene.output_id === 'detail' && a.scene.phase === 'place' && a.scene.room.from_output === 'wide' && a.scene.room.drive_file_id === 'drive-wide', '19a: the detail view is made from the wide view too (the base), not from the hero');
  ok(a.scene.framing.type === 'detail' && a.scene.framing.min_pct === 50 && a.scene.framing.detail === 'close on the boucle texture and the left arm' && /fills most of the frame \(more than 50% of it\)/.test(a.scene.framing.text) && /whole product is not required/.test(a.scene.framing.text), '19a: detail framing names the plan\'s detail; the whole product is not required');
  const noCam = job(); noCam.shots[3].plan.camera = '';
  const ncSt = clone(afterHero); ncSt.shots = noCam.shots;
  a = await t19a(ncSt);
  ok(/the plan names no detail, so show a characteristic detail of the product as image 1 shows it/.test(a.scene.framing.text), '19a: no detail named in the plan → a characteristic detail as image 1 shows it');
  const noBase = clone(afterWide); delete noBase.scenes.done.wide.candidate.sha256;
  a = await t19a(noBase);
  ok(a.status === 'hold' && /shares its room with the wide view \(wide\)/.test(a.hold_reason), '19a: the base view\'s approval without a checksum → hold, nothing made');
  a = await t19a(afterWide, Object.assign({}, SETTINGS, { scenes: Object.assign({}, SETTINGS.scenes, { views_share_one_room: false }) }));
  ok(a.scene.output_id === 'hero' && a.scene.phase === 'room' && a.scene.room === null, '19a: views_share_one_room off → the hero makes its own empty room');
  const locked = clone(afterWide); locked.room_key = 'room'; locked.outputs.forEach(o => { if (o.kind !== 'white') o.mode = 'room_locked'; });
  a = await t19a(locked);
  ok(a.scene.output_id === 'hero' && a.scene.phase === 'place' && a.scene.room.source === 'client room photo', '19a: a client room photo → every view uses it (no sharing logic)');
  const mixed = job(); mixed.outputs = mixed.outputs.filter(o => o.id === 'white_master').concat([{ id: 'lifestyle_1', kind: 'lifestyle', outcome: 'lifestyle', mode: 'creative_room' }, { id: 'wide', kind: 'wide', outcome: 'website', mode: 'creative_room' }]);
  mixed.shots = mixed.shots.filter(x => x.output_id !== 'hero' && x.output_id !== 'detail').concat([{ n: 5, output_id: 'lifestyle_1', kind: 'lifestyle', frame: 'square, 1:1', plan: plan('front') }]);
  a = await t19a(mixed);
  ok(a.scenes.queue.join() === 'lifestyle_1,wide' && a.scene.framing.type === 'hero', '19a: other scene kinds keep their place before the views; a lifestyle scene is framed as a hero');

  // Review finding 1 (16 Oct 2026, 05:20): a later view keeps the Midas pieces of the approved base view, not its own plan's.
  const PA = { sku: '141368', name: 'CHALLVOR centre table', kind: 'centre table', url: 'https://midasfurniture.com/en/challvor-center-table.html', catalogue_photo: 'https://midasfurniture.com/media/catalog/product/4/4/44-141368_a.jpg', dimensions: '90 x 90 x 28 cm', retrieved_on: '2026-09-28' };
  const PB = { sku: '162510', name: 'FERNLAY side table', kind: 'side table', url: 'https://midasfurniture.com/en/fernlay-end-table-living-rooms-midas.html', catalogue_photo: 'https://midasfurniture.com/media/catalog/product/4/4/44-162510_h.webp', dimensions: '60 x 60 x 55 cm', retrieved_on: '2026-09-28' };
  const pieces = clone(afterWide); pieces.retrieval = { shortlist: [PA, PB] };
  pieces.shots.find(x => x.output_id === 'wide').plan.midas_pieces = [{ sku: PA.sku, purpose: 'centre table in front of the sofa', rests_on: 'the rug' }];
  pieces.shots.find(x => x.output_id === 'hero').plan.midas_pieces = [{ sku: PB.sku, purpose: 'side table at the right arm', rests_on: 'the floor' }];
  pieces.shots.find(x => x.output_id === 'hero').plan.supporting_props = ['a plant'];
  pieces.scenes.done.wide.props = [{ sku: PA.sku, name: PA.name, page: PA.url, live: { stock: 'in_stock' } }];
  a = await t19a(pieces);
  ok(a.scene.output_id === 'hero' && a.scene.props.map(p => p.sku).join() === PA.sku && a.scene.props[0].purpose === 'centre table in front of the sofa' && a.scene.base_props.join() === PA.sku, '19a: the hero keeps the wide view\'s Midas piece (with its purpose), not its own plan\'s');
  ok(a.scene.props_left_out.some(x => x.sku === PB.sku && /not in the approved wide view, which this view is made from/.test(x.why)) && !a.scene.props_left_out.some(x => /generic props/.test(x.why)), '19a: the hero plan\'s own piece is left out with the reason; no generic-props line');
  const heroPieces = a;

  // ---------- 19e2 / 19g: the shared room is checked like any room ----------
  const V = { '19c Prop verdict': [{ json: heroSt }] };
  let rc = (await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(ROOM) } }]))[0].json.room;
  ok(rc.ok && rc.key === 'scene_room' && rc.sha256 === sha(ROOM), '19e2: the approved wide view from Drive matches its approved checksum');
  rc = (await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(MASTER) } }]))[0].json.room;
  ok(!rc.ok && /checksum differs/.test(rc.why), '19e2: another file in Drive → not used');
  const masterChk = await run('19d2_Master_check.js', V, [{ json: {}, binary: { data: ref(MASTER) } }]);
  const roomChk = await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(ROOM) } }]);
  const none = [{ json: { none: true } }];
  const N19 = Object.assign({}, V, { '04 Settings': [{ json: SETTINGS }], '19d2 Master check': masterChk, '19e2 Room check': roomChk, '19f2 Photo check': [{ json: { photos: [] } }], '19f0 Photo list': none,
    '19d Download master': [{ json: {}, binary: { data: ref(MASTER, 'image/png') } }], '19e Download room': [{ json: {}, binary: { data: ref(ROOM, 'image/jpeg') } }], '19f Prop photos': [] });
  const g = (await run('19g_Scene_references.js', N19, [{ json: {} }]))[0];
  ok(g.json.status === 'scene_due' && g.json.scene.refs.map(x => x.role).join('|') === 'vendor photo|approved white master|room' && g.binary.scene_room, '19g: images: vendor photo, white master, the approved wide view as the room');

  // Review finding 1: if a piece of the base view is no longer confirmed, the later view holds (it would still show the piece).
  const lostV = clone(heroPieces); lostV.scene.props = []; lostV.scene.props_left_out = lostV.scene.props_left_out.concat([{ sku: PA.sku, why: 'out of stock on its Midas page today; the spot stays empty' }]);
  const NL = Object.assign({}, N19, { '19c Prop verdict': [{ json: lostV }] });
  const gl = (await run('19g_Scene_references.js', NL, [{ json: {} }]))[0];
  ok(gl.json.status === 'hold' && /made from the approved wide view, which shows Midas piece\(s\) 141368; it is no longer confirmed \(out of stock/.test(gl.json.hold_reason) && !gl.binary, '19g: a base-view piece no longer in stock → the later view holds, nothing sent');

  // ---------- 13 Compile: the later view's prompt ----------
  const compile = async st => (await run('13_Compile.js', { 'V1 Vault events': [{ json: st }] }, [{ json: SETTINGS }]))[0].json;
  const c = await compile(g.json);
  const pp = c.s04.dispatch.prompt;
  ok(c.s04.go && c.s04.dispatch.output_id === 'hero' && c.s04.dispatch.references.map(x => x.role).join('|') === 'vendor photo|approved white master|room', '13: the hero order sends three images, vendor photo first');
  ok(/Image 3 is the room\. It is the approved image of wide of this same job, approved by the studio owner, with the product and the Midas pieces already in place\./.test(pp) && /This photograph shows that same scene/.test(pp) && /Only the camera moves/.test(pp), '13: image 3 is named as the approved wide view; only the camera moves');
  ok(/The product in image 3 is a generated picture, not an authority: image 1 decides the product/.test(pp) && /where it stands in image 3, once only: never add a second copy of it/.test(pp) && !/Place the exact product from image 1 into the room/.test(pp) && !/Keep the room exactly as it is: its walls, floor, windows, camera and light/.test(pp), '13: image 1 stays the product authority; no second copy; no "keep the camera" line');
  ok(/longest side spans about 60-70% of the frame/.test(pp) && /From the plan: front view at seat height/.test(pp), '13: the hero framing line and the hero camera from the plan');
  const lightSt = clone(g.json); lightSt.shots.find(x => x.output_id === 'wide').plan.light = 'morning daylight from the left window'; lightSt.shots.find(x => x.output_id === 'hero').plan.light = 'warm evening lamp light from the right';
  const lp = (await compile(lightSt)).s04.dispatch.prompt;
  ok(/As in the approved image: morning daylight from the left window/.test(lp) && !/warm evening lamp light/.test(lp), '13: review finding 3: the later view keeps the wide view\'s light, not its own plan\'s');
  const own = clone(g.json); own.scene.room = { source: 'made in stage 07', drive_file_id: 'drive-room', sha256: sha(ROOM), file_name: 'x_hero_room.jpg' };
  const ownP = (await compile(own)).s04.dispatch.prompt;
  ok(/Keep the room exactly as it is: its walls, floor, windows, camera and light/.test(ownP) && /Place the exact product from image 1 into the room/.test(ownP), '13: a scene with its own empty room keeps the earlier prompt');

  // ---------- 16a: the readers are asked for the share and the box ----------
  const s16 = clone(heroSt); s16.stage04 = Object.assign({}, s16.stage04, { candidate: { output_id: 'hero', drive_file_id: 'drive-hc', link: 'https://drive.example/hc', sha256: 'a'.repeat(64), px: '2048x2048', file_name: 'x_hero_try1.png', scene: { phase: 'place' } } });
  s16.scene.refs = g.json.scene.refs;
  const N16 = { 'V1 Vault events': [{ json: s16 }], '02 Ingest files': [{ json: {}, binary: { photo: ref(Buffer.from('v')) } }], '15m Receipt': [{ json: {}, binary: { image: ref(ROOM) } }], '19g Scene references': [{ json: {}, binary: {} }] };
  const t16 = (await run('16a_Review_ticket.js', N16))[0].json.rv;
  ok(t16.ready && t16.kind === 'scene' && t16.framing.type === 'hero' && t16.framing.band_pct.join() === '60,70', '16a: the ticket carries the view and its band');
  ok(/also give "share": for a hero or wide view, the whole-number percentage of the frame side in the same direction/.test(t16.critic_text) && /for a detail view, the whole-number percentage of the frame that the named detail fills/.test(t16.critic_text), '16a: the reviewer is asked for the share');
  ok(/smallest box around all pieces of the/.test(t16.blind_text) && /"box_2d": \[ymin, xmin, ymax, xmax\]/.test(t16.blind_text) && !/60|70|longest/.test(t16.blind_text), '16a: the blind count gives a box and is not told the target');
  const w16 = clone(base); w16.status = 'awaiting_review';
  const tw = (await run('16a_Review_ticket.js', { 'V1 Vault events': [{ json: w16 }], '02 Ingest files': [{ json: {}, binary: { photo: ref(Buffer.from('v')) } }], '15m Receipt': [{ json: {}, binary: { image: ref(MASTER) } }] }))[0].json.rv;
  ok(tw.framing.type === 'white' && /longest side spans about 76% of the frame side in the same direction/.test(tw.critic_text) && /"box_2d"/.test(tw.blind_text), '16a: white master: 76% on the longest side; box asked');

  const s16d = clone(s16); s16d.scene.framing = { type: 'detail', min_pct: 50, detail: 'close on the boucle', text: 'Detail view.' };
  const t16d = (await run('16a_Review_ticket.js', Object.assign({}, N16, { 'V1 Vault events': [{ json: s16d }] })))[0].json.rv;
  ok(/- Detail view: the whole product is not required\. Judge only what image 2 shows/.test(t16d.critic_text) && !/- Detail view:/.test(t16.critic_text) && !/\n\n/.test(t16d.critic_text), '16a: review finding 2: a detail view tells the reviewer that pieces outside the frame are no defect');

  // ---------- 16b: framing is reported, never fails on its own ----------
  const SCENE_KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'framing', 'camera_level', 'light', 'no_text_or_logo', 'realism']; // people_ok and no_unplanned_lamp added 16 Oct 2026 (owner decisions 22, 23)
  const WHITE_KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'framing', 'no_text_or_logo', 'realism'];
  const critic = (keys, over) => ({ checks: Object.assign(Object.fromEntries(keys.map(k => [k, { result: 'pass', evidence: 'ok', seen: k === 'piece_count' ? 7 : undefined }])), over || {}), defects: [], scores: { fidelity: 88, integrity: 90, drift: 10, data_loss: 5 }, summary: 'fine' });
  const rvScene = (fr, px) => ({ ready: true, attempt: 1, output_id: 'hero', total: 7, kind: 'scene', scene: { output_id: 'hero', kind: fr.type, framing: fr.type, props: [] }, framing: fr, candidate: { link: 'https://drive.example/hc', drive_file_id: 'drive-hc', sha256: 'a'.repeat(64), px: px || '2048x2048', file_name: 'x_hero_try1.png' } });
  const stScene = clone(heroSt);
  async function verdict(rv, crit, blind, settings, st) {
    return (await run('16b_Review_verdict.js', { 'V1 Vault events': [{ json: st || stScene }], '16a Review ticket': [{ json: { rv } }], '04 Settings': [{ json: settings || SETTINGS }],
      '16 Critic review': [{ json: { content: [{ text: JSON.stringify(crit) }] } }], '16x Blind count': [{ json: { content: { parts: [{ text: JSON.stringify(Object.assign({ total: 7, background_white: false, text_or_logo: false, cropped: false }, blind)) }] } } }] }))[0].json;
  }
  const HERO = { type: 'hero', band_pct: [60, 70] };
  // Wide sofa, square frame: box 20-68% wide, 40-70% tall → the width is the longest side: 48%.
  let v = await verdict(rvScene(HERO), critic(SCENE_KEYS, { framing: { result: 'fail', evidence: 'too small', share: 50 } }), { box: { left: 20, top: 40, right: 68, bottom: 70 } });
  ok(v.review.result === 'passed' && v.review.defects.length === 0 && v.review.unsure.length === 0 && v.status === 'awaiting_go_2', '16b: a framing miss alone (and the reviewer\'s own "fail") does not fail the image');
  ok(v.review.framing.measured_share_pct === 48 && v.review.framing.side === 'width' && v.review.framing.within === false && /blind count's box and the image size 2048 x 2048/.test(v.review.framing.source) && v.review.framing.reviewer.share === 50, '16b: share 48% of the frame width, from the blind count\'s box; the reviewer\'s 50% kept beside it');
  ok(v.review.styling_notes.length === 1 && /Framing \(hero view\): about 48% of the frame width; the rule is 60-70%\. A styling note: the image is not failed for it\./.test(v.review.styling_notes[0]), '16b: the miss is reported with the measured share');
  ok(v.go2.framing.within === false && v.go2.styling_notes.length === 1 && v.go2.reminders.some(x => /Styling notes \(framing/.test(x)) && /passed: a reviewed candidate, not an approval/.test(v.go2.review_result), '16b: go 2 shows the framing note; the result stays a reviewed candidate');
  ok(v.go2_proposed_repair && v.go2_proposed_repair.corrections.length === 1 && /Reframe the hero view: the product's longest side \(its width\) should span about 60-70% of the frame; it spans about 48% now, so move the camera closer/.test(v.go2_proposed_repair.corrections[0]) && !v.repair_orders, '16b: a reframe is proposed for the owner; nothing is ordered');
  const g2 = (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: v }] }, [{ json: { body: { decision: 'repair', go2_token: v.go2_token, run_id: v.run_id, round: v.go2_round } } }]))[0].json;
  ok(g2.status === 'repair_ordered' && g2.repair_orders.hero.corrections.some(x => /Reframe the hero view/.test(x)), 'G2: the owner orders the repair without a note → the reframe is the correction');
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS, { framing: { result: 'pass', evidence: 'ok', share: 64 } }), { box: { left: 18, top: 35, right: 83, bottom: 70 } });
  ok(v.review.framing.measured_share_pct === 65 && v.review.framing.within === true && v.review.styling_notes.length === 0 && v.go2_proposed_repair === null, '16b: 65% is within 60-70% → no note, no proposal');
  v = await verdict(rvScene(HERO, '1152x2048'), critic(SCENE_KEYS), { box: { left: 30, top: 10, right: 70, bottom: 76 } });
  ok(v.review.framing.side === 'height' && v.review.framing.measured_share_pct === 66 && v.review.framing.within === true, '16b: a tall frame: 40% of 1152 px wide (461 px) vs 66% of 2048 px tall (1352 px) → the height is the longest side: 66%');
  v = await verdict(rvScene(HERO, '2048x1152'), critic(SCENE_KEYS), { box: { left: 20, top: 10, right: 65, bottom: 90 } });
  ok(v.review.framing.side === 'width' && v.review.framing.measured_share_pct === 45, '16b: a wide frame: 45% of 2048 (922 px) beats 80% of 1152 (922 px, equal) → the width is used');
  v = await verdict(rvScene({ type: 'wide', band_pct: [40, 55] }), critic(SCENE_KEYS), { box: { left: 25, top: 50, right: 75, bottom: 70 } });
  ok(v.review.framing.view === 'wide' && v.review.framing.measured_share_pct === 50 && v.review.framing.within === true, '16b: wide view: 50% within 40-55%');
  v = await verdict(rvScene({ type: 'wide', band_pct: [40, 55] }), critic(SCENE_KEYS), { box: { left: 10, top: 50, right: 80, bottom: 70 } });
  ok(v.review.framing.within === false && /move the camera further back/.test(v.go2_proposed_repair.corrections[0]), '16b: wide view at 70% → too close: move the camera further back');
  const DETAIL = { type: 'detail', min_pct: 50, detail: 'close on the boucle texture' };
  v = await verdict(rvScene(DETAIL), critic(SCENE_KEYS, { framing: { result: 'pass', evidence: 'fills', share: 72 } }), { cropped: true });
  ok(v.review.result === 'passed' && v.review.framing.measured_share_pct === 72 && v.review.framing.within === true && /the reviewer's estimate \(the reviewer is told the target\)/.test(v.review.framing.source) && !v.review.checks.whole_in_frame, '16b: detail view: 72% from the reviewer, within; a crop is allowed in a detail view');
  v = await verdict(rvScene(DETAIL), critic(SCENE_KEYS, { framing: { result: 'fail', evidence: 'small', share: 30 } }), {});
  ok(v.review.result === 'passed' && v.review.framing.within === false && /named detail fills most of the frame \(more than 50%\)/.test(v.go2_proposed_repair.corrections[0]), '16b: detail at 30% → a note and a proposed reframe, not a failure');
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS), {});
  ok(v.review.framing.measured_share_pct === null && v.review.framing.within === null && /could not be read/.test(v.review.styling_notes[0]) && v.review.result === 'passed' && v.go2_proposed_repair === null, '16b: no share from either reader → noted as unread, not a failure');
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS, { framing: { result: 'pass', evidence: 'ok', share: 66 } }), { box: { left: 90, top: 10, right: 20, bottom: 50 } });
  ok(v.review.framing.measured_share_pct === 66 && /blind count gave no usable box/.test(v.review.framing.source), '16b: an impossible box → the reviewer\'s share is used, said so');
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS), { total: 7, cropped: true, box: { left: 0, top: 30, right: 70, bottom: 80 } });
  ok(v.review.result === 'failed' && v.review.checks.whole_in_frame.result === 'fail' && v.review.defects.some(d => d.check === 'whole_in_frame') && !v.review.defects.some(d => d.check === 'framing'), '16b: a product cut off by the frame (hero) still fails, as "whole product in frame"');
  const autoOn = Object.assign({}, SETTINGS, { auto_repair: true });
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS), { box: { left: 20, top: 40, right: 68, bottom: 70 } }, autoOn);
  ok(v.status === 'awaiting_go_2' && !v.repair_orders, '16b: auto_repair on and only a framing miss → no repair runs; it waits for the owner');
  const bad = critic(SCENE_KEYS, { colour: { result: 'fail', evidence: 'too red' } }); bad.defects = [{ check: 'colour', what: 'too red', where: 'seat', fix: 'Match the grey of image 1.' }];
  v = await verdict(rvScene(HERO), bad, { box: { left: 20, top: 40, right: 68, bottom: 70 } }, autoOn);
  // Owner, 16 Oct 2026 (D5): nothing repairs itself, even with auto_repair on. The proposed repair holds the colour fix and, because the owner may order it, the framing fix.
  ok(v.status === 'awaiting_go_2' && !v.repair_orders && v.go2_proposed_repair.corrections[0] === 'Match the grey of image 1.' && v.go2_proposed_repair.corrections.length === 2, '16b: auto_repair on and a colour defect → no automatic repair; the owner sees the proposed repair at go 2');
  v = await verdict(rvScene(HERO), bad, { box: { left: 20, top: 40, right: 68, bottom: 70 } });
  ok(v.review.result === 'failed' && v.go2_proposed_repair.corrections.length === 2 && /Reframe the hero view/.test(v.go2_proposed_repair.corrections[1]), '16b: a failed image with a framing miss → the owner\'s proposed repair carries both corrections');
  // Review finding 2: a detail view of a 7-piece product may show fewer pieces, never more.
  v = await verdict(rvScene(DETAIL), critic(SCENE_KEYS, { piece_count: { result: 'pass', evidence: '2 visible', seen: 2 }, framing: { result: 'pass', evidence: 'ok', share: 70 } }), { total: 2 });
  ok(v.review.result === 'passed' && v.review.counts.detail_view === true && v.review.counts.blind === 2 && !v.review.defects.length, '16b: detail view showing 2 of 7 pieces → not a count defect');
  v = await verdict(rvScene(DETAIL), critic(SCENE_KEYS, { framing: { result: 'pass', evidence: 'ok', share: 70 } }), { total: 8 });
  ok(v.review.result === 'failed' && v.review.checks.piece_count.result === 'fail' && /a detail view may show fewer, never more/.test(v.review.checks.piece_count.evidence) && /Show no more than the 7 product pieces/.test(v.go2_proposed_repair.corrections[0]), '16b: detail view with 8 pieces (more than 7) → still fails on count');
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS, { piece_count: { result: 'pass', evidence: 'x', seen: 6 } }), { total: 7 });
  ok(v.review.result === 'failed' && v.review.checks.piece_count.result === 'fail', '16b: a hero view with 6 of 7 pieces still fails on count');
  // Review finding 5: a box in 0-1 fractions is not used.
  v = await verdict(rvScene(HERO), critic(SCENE_KEYS, { framing: { result: 'pass', evidence: 'ok', share: 64 } }), { box: { left: 0.18, top: 0.35, right: 0.83, bottom: 0.7 } });
  ok(v.review.framing.measured_share_pct === 64 && v.review.framing.within === true && /the reviewer is told the target; the blind count gave no usable box/.test(v.review.framing.source), '16b: review findings 5 and 7: a 0-1 box is not used; the reviewer share is labelled as told the target');
  // Review finding 6: what a repair of a later view keeps.
  const stShared = clone(heroSt); stShared.scene.refs = [{ n: 1, role: 'vendor photo' }, { n: 2, role: 'approved white master' }, { n: 3, role: 'room' }];
  v = await verdict(rvScene(HERO), bad, {}, null, stShared);
  ok(v.go2_proposed_repair.preserve.some(x => /the room, every Midas piece where it stands, and the light of the approved wide view \(image 3 of the scene request\); only the camera differs/.test(x)) && !v.go2_proposed_repair.preserve.some(x => /the room as it is/.test(x)), '16b: review finding 6: a later view\'s repair keeps the room, pieces and light, not the camera');
  const stSmall = clone(stShared); stSmall.scene.room = { source: 'made in stage 07', drive_file_id: 'r' }; stSmall.scene.refs = [{ n: 1, role: 'vendor photo' }, { n: 2, role: 'room' }];
  v = await verdict(rvScene(HERO), bad, {}, null, stSmall);
  ok(v.go2_proposed_repair.preserve.some(x => x === 'the room as it is (image 2 of the scene request)'), '16b: the repair names the room\'s real image number (2 when the white master was left out for size)');

  // White master: 76% on the longest side; the note band 72-80 is an assumption.
  const rvWhite = { ready: true, attempt: 1, output_id: 'white_master', total: 7, kind: 'white', scene: null, framing: { type: 'white' }, candidate: { link: 'x', drive_file_id: 'd', sha256: 'b'.repeat(64), px: '2048x2048', file_name: 'x_white_master_try1.png' } };
  const wst = clone(base);
  v = await verdict(rvWhite, critic(WHITE_KEYS), { background_white: true, box: { left: 12, top: 30, right: 88, bottom: 70 } }, null, wst);
  ok(v.review.result === 'passed' && v.review.framing.view === 'white' && v.review.framing.measured_share_pct === 76 && v.review.framing.within === true && Object.keys(v.review.checks).length === 16 && !v.review.checks.framing, '16b: white master at 76% → within; 16 white checks, framing beside them');
  v = await verdict(rvWhite, critic(WHITE_KEYS, { framing: { result: 'fail', evidence: 'small', share: 40 } }), { background_white: true, box: { left: 30, top: 40, right: 70, bottom: 60 } }, null, wst);
  ok(v.review.result === 'passed' && v.review.framing.within === false && /Framing \(white master\): about 40% of the frame width; the rule is 72-80%/.test(v.review.styling_notes[0]) && /about 76% of the frame, with about 12% white margin at each end of that side; it spans about 40% now/.test(v.go2_proposed_repair.corrections[0]), '16b: white master at 40% → a note and a proposed reframe, not a failure');
  v = await verdict(rvWhite, critic(WHITE_KEYS), { background_white: true, cropped: true }, null, wst);
  ok(v.review.result === 'failed' && v.review.checks.whole_in_frame.result === 'fail', '16b: white master cut off by the frame → still fails (whole product in frame)');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
