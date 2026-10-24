// Local tests for stage 07 · Scenes and the step 10 shortlist change (16 Oct 2026).
// Runs the n8n Code-node source with mocked node outputs and real image bytes. No network, no AI call, no paid call.
// Run: node tests/claude-midas-a7-stage-07/run_tests07.js
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
  return fn.call({ helpers }, $, $input, execution || { resumeUrl: '' }, require);
}
// Settings exactly as "04 Settings" returns them.
let SETTINGS;
const MASTER = fs.readFileSync(path.join(FIX6, 'master_2048.png'));
const ROOM = fs.readFileSync(path.join(FIX6, 'out_1125.jpg'));
const PROP = fs.readFileSync(path.join(FIX6, 'out_1125.webp'));
const VENDOR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claude-midas-accessories-2026-10-16.json'), 'utf8')).rows;
const HAND = [
  { sku: '141368', name: 'CHALLVOR centre table', kind: 'centre table', url: 'https://midasfurniture.com/en/challvor-center-table.html', image_url: 'https://midasfurniture.com/media/catalog/product/4/4/44-141368_a.jpg', dimensions: '90 × 90 × 28 cm', finish: 'Engineered wood', availability: 'In stock', retrieved: '2026-09-28', notes: '', active: true },
  { sku: '162510', name: 'FERNLAY side table', kind: 'side table', url: 'https://midasfurniture.com/en/fernlay-end-table-living-rooms-midas.html', image_url: 'https://midasfurniture.com/media/catalog/product/4/4/44-162510_h.webp', dimensions: '60 × 60 × 55 cm', finish: 'Mirrored tops', availability: 'Pre-Order', retrieved: '2026-09-28', notes: '', active: true }
];
(async () => {
  SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;
  ok(SETTINGS.scenes && SETTINGS.scenes.enabled === true && SETTINGS.scenes.camera.bedroom.height_cm === '135' && SETTINGS.scenes.kelvin.day === 4000, '04 Settings: scenes block with owner-document presets');
  ok(/room-scale furniture only/.test(SETTINGS.scenes.camera.default.basis) && /confirmed by the owner/.test(SETTINGS.scenes.kelvin.basis), '04 Settings: the values the owner confirmed on 16 Oct 2026 (D9) say so');

  // ---------- Base state: a sofa run with a white master and two scene outputs ----------
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
  delete base.events; delete base.row;
  base.profile = Object.assign({}, base.profile, { prop_policy: 'living' });
  base.outputs = base.outputs.concat([
    { id: 'lifestyle_1', kind: 'lifestyle', outcome: 'lifestyle', mode: 'creative_room', locks: [], free: [] },
    { id: 'wide', kind: 'wide', outcome: 'website', mode: 'room_locked', locks: [], free: [] }
  ]);
  base.room_key = 'room';
  base.references = base.references.concat([{ key: 'room', name: 'client-room.jpg', role: 'room', image: true, mime: 'image/jpeg', bytes: ROOM.length, sha256: sha(ROOM) }]);

  // ---------- 10 Retrieve: the 12 places are shared out by kind ----------
  const s10 = clone(base); s10.brief = Object.assign({}, s10.brief, { midas_picks: [] }); s10.critical = []; s10.client_question = '';
  const rows = HAND.concat(CATALOGUE);
  const r10 = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: s10 }] }, rows.map(json => ({ json }))))[0].json;
  const sl = r10.retrieval.shortlist;
  const byKind = sl.reduce((m, c) => { m[c.kind] = (m[c.kind] || 0) + 1; return m; }, {});
  ok(sl.length === 12 && Object.values(byKind).every(n => n <= 2), '10: 12 places, at most 2 per kind: ' + JSON.stringify(byKind));
  // Changed 16 Oct 2026 (owner decision 25): Midas cushions and throws are not offered; they are counted in one rejected line.
  ok(sl[0].kind === 'centre table' && !sl.some(c => c.kind === 'cushion' || c.kind === 'throw') && sl.some(c => c.kind === 'rug') && sl.some(c => c.kind === 'floor lamp') && r10.retrieval.rejected.some(x => /cushion/.test(x.name) && /not offered/.test(x.reason)), '10: living-room kinds first (centre table, rug, floor lamp); no Midas cushion or throw');
  ok(sl.every(c => c.availability !== 'out_of_stock') && sl.every(c => c.catalogue_photo && c.retrieved_on), '10: no out-of-stock piece; every piece has a photo and a reading date');
  ok(r10.retrieval.rejected.some(x => /more usable piece/.test(x.name) && /2 per kind/.test(x.reason)) && r10.retrieval.rejected.length < 80, '10: unplaced pieces counted in one line, not listed one by one (' + r10.retrieval.rejected.length + ' rejected lines)');
  ok(!sl.some(c => /sofa/i.test(c.kind)), '10: nothing of the product\'s own kind');
  const bed = clone(s10); bed.profile = { id: 'bed', name: 'Beds', prop_policy: 'bedroom', checks: [] }; bed.brief.product_type = 'Bed'; bed.observation = Object.assign({}, bed.observation, { category_seen: 'bed' }); bed.inventory = [{ item: 'bed', count: 1 }];
  const r10b = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: bed }] }, rows.map(json => ({ json }))))[0].json;
  ok(r10b.retrieval.shortlist[0].kind === 'bedding set' && r10b.retrieval.shortlist.some(c => c.kind === 'table lamp'), '10: bedroom order starts with bedding, then table lamps (no cushions)');
  const pol = clone(s10); pol.profile.prop_policy = 'none';
  const r10c = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: pol }] }, rows.map(json => ({ json }))))[0].json;
  ok(r10c.retrieval.notes.some(n => /has no kind order/.test(n)), '10: a profile with no prop policy uses the living order, noted');

  // ---------- The approved, packaged run that stage 07 starts from ----------
  const pick = k => sl.find(c => c.kind === k);
  const P1 = pick('centre table'), P2 = pick('rug'), P3 = pick('floor lamp'), P4 = pick('wall art'); // P1 was a cushion until 16 Oct 2026 (decision 25)
  const planScene = { room_size: 'about 5 x 4 m', setting: 'A calm Kuwaiti living room with warm plaster walls, a large window and a sofa vignette with a centre table', light: 'soft afternoon light', camera: 'front view, slightly off centre', presentation: 'the sofa against the long wall, all 7 modules visible', supporting_props: ['books', 'a green plant'],
    midas_pieces: [{ sku: P1.sku, purpose: 'centre table in front of the sofa', rests_on: 'the floor' }, { sku: P2.sku, purpose: 'rug under the front legs', rests_on: 'the floor' }, { sku: P3.sku, purpose: 'reading light', rests_on: 'the floor' }, { sku: P4.sku, purpose: 'art above the sofa', rests_on: 'the wall' }, { sku: '999999', purpose: 'not on the shortlist', rests_on: 'floor' }],
    palette_roles: { dominant_60: 'warm white walls', secondary_30: 'grey upholstery', accent_10: 'brass' }, rationale: 'test' };
  function packaged(over) {
    const s = clone(base);
    s.retrieval = r10.retrieval;
    s.shots = s.shots.concat([{ n: 2, output_id: 'lifestyle_1', kind: 'lifestyle', frame: 'landscape, 16:9, wider than tall', plan: planScene }, { n: 3, output_id: 'wide', kind: 'wide', frame: 'landscape, 16:9, wider than tall', plan: Object.assign({}, planScene, { midas_pieces: [] }) }]);
    s.status = 'white_package_ready'; s.stage = '06 Package';
    s.go1_last = { decision: 'go', by: 'owner', at: '2026-10-15T03:36:37Z' };
    s.approved = { output_id: 'white_master', attempt: 1, by: 'owner', at: '2026-10-16T00:00:00Z', candidate: { output_id: 'white_master', drive_file_id: 'drive-master', link: 'https://drive.example/m', sha256: sha(MASTER), px: '2048x2048', file_name: 'x_white_master_try1.png' } };
    s.cost_estimate = { currency: 'USD', label: 'estimate', no_repair: 1, max_two_repairs_each: 3 };
    return Object.assign(s, over || {});
  }
  const SET = { '04 Settings': [{ json: SETTINGS }] };
  const t19a = async st => (await run('19a_Scene_ticket.js', Object.assign({ 'V1 Vault events': [{ json: st }] }, SET)))[0].json;

  // ---------- 19a Scene ticket ----------
  let a = await t19a(packaged());
  ok(a.status === 'scene_preparing' && a.scene.output_id === 'lifestyle_1' && a.scene.phase === 'room' && a.scene.props.length === 0, '19a: first scene starts with the empty room; no props in the room phase');
  ok(a.scene.presets.camera.family === 'living' && a.scene.presets.camera.height_cm === '110-120' && a.scene.presets.light.kelvin === 4000 && a.scene.presets.light.preset === 'day', '19a: sofa → living-room camera preset; day light 4000 K by default');
  ok(a.scene.framing.type === 'hero' && /longest side spans about 60-70% of the frame/.test(a.scene.framing.text) && /width for a wide piece, the height for a tall piece/.test(a.scene.framing.text) && a.scene.framing.band_pct.join() === '60,70', '19a: lifestyle → hero framing: longest side 60-70% of the frame (owner, 16 Oct 04:16)');
  ok(a.scenes.queue.join(',') === 'lifestyle_1,wide' && a.stage === '07 Scenes' && a.vault_only.indexOf('scene_ticket') !== -1, '19a: scene queue and stage 07');
  ok(a.scene.scale.product === 'not confirmed' && /no size supplied/.test(a.scene.scale.basis), '19a: no size supplied → scale not confirmed');
  let b = packaged(); b.brief = Object.assign({}, b.brief, { dimensions: '320 x 180 x 85 cm', preferences: Object.assign({}, b.brief.preferences, { lighting: 'warm evening' }) });
  a = await t19a(b);
  ok(a.scene.scale.product === '320 x 180 x 85 cm' && a.scene.presets.light.preset === 'night' && a.scene.presets.light.kelvin === 2700, '19a: supplied size used; "evening" → night preset 2700 K');
  // After the room was made: placement with the plan's Midas pieces, at most 3, generic props left out.
  const roomCand = { output_id: 'lifestyle_1_room', drive_file_id: 'drive-room', link: 'https://drive.example/r', sha256: sha(ROOM), px: '1125x1125', file_name: 'x_lifestyle_1_room_try1.jpg', scene: { phase: 'room' } };
  const afterRoom = clone(await t19a(packaged()));
  afterRoom.status = 'scene_room_ready'; afterRoom.stage04 = Object.assign({}, base.stage04, { candidate: roomCand });
  a = await t19a(afterRoom);
  ok(a.status === 'scene_preparing' && a.scene.phase === 'place' && a.scene.room.drive_file_id === 'drive-room' && a.scene.room.mime === 'image/jpeg', '19a: after the room → placement into that room');
  ok(a.scene.props.length === 3 && a.scene.props.map(p => p.sku).join() === [P1.sku, P2.sku, P3.sku].join(), '19a: at most 3 Midas pieces, in plan order');
  ok(a.scene.props_left_out.some(x => x.sku === P4.sku && /more than 3/.test(x.why)) && a.scene.props_left_out.some(x => x.sku === '999999' && /shortlist/.test(x.why)) && a.scene.props_left_out.some(x => /generic props are not used/.test(x.why) && /books/.test(x.why)), '19a: 4th piece, unlisted SKU and generic props left out, with reasons');
  const wrongRoom = clone(afterRoom); wrongRoom.stage04.candidate.output_id = 'wide_room';
  a = await t19a(wrongRoom);
  ok(a.status === 'hold' && /does not belong to the scene/.test(a.hold_reason), '19a: a room from another scene → hold');
  // Client room photo: no empty-room call.
  const first = clone(await t19a(packaged()));
  first.scenes.done = { lifestyle_1: { by: 'owner' } }; first.status = 'scene_approved';
  a = await t19a(first);
  ok(a.scene.output_id === 'wide' && a.scene.phase === 'place' && a.scene.room.source === 'client room photo' && a.scene.framing.type === 'wide', '19a: room_locked scene → placement into the client room; wide framing');
  // Step 20 (16 Oct 2026): the next scene starts after the approved scene's files are made, and also when they are held.
  for (const stName of ['scene_files_ready', 'scene_files_held']) { const n = clone(first); n.status = stName; a = await t19a(n); ok(a.status === 'scene_preparing' && a.scene.output_id === 'wide', '19a: after ' + stName + ' the next scene starts'); }
  const all = clone(first); all.scenes.done.wide = { by: 'owner', candidate: { link: 'https://drive.example/w' } };
  a = await t19a(all);
  // Changed 16 Oct 2026 (step 20, scene delivery files): approved scenes without their files are not a complete set.
  ok(a.status === 'hold' && a.hold_step === 20 && /delivery files of 2 scene/.test(a.hold_reason) && /incomplete/.test(a.hold_reason) && a.scene === null, '19a: every scene approved but no delivery files → held for the owner, never "complete"');
  const allF = clone(all); for (const k of Object.keys(allF.scenes.done)) allF.scenes.done[k].files = { status: 'ready', files: [{ format: 'jpg', px: '1125x1125', link: 'https://drive.example/' + k }] };
  a = await t19a(allF);
  ok(a.status === 'hold' && a.package_release.complete === false && a.scene === null, '19a: ready flags without complete saved receipts and bound approvals cannot release a package');
  a = await t19a(packaged({ approved: null }));
  ok(a.status === 'hold' && /approval of the white master/.test(a.hold_reason), '19a: no owner approval of the white master → hold');
  a = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: packaged() }] }))[0].json;
  ok(a.status === 'hold' && /settings could not be read/.test(a.hold_reason), '19a: 04 Settings not run → hold');
  const noPlan = packaged(); noPlan.shots = noPlan.shots.filter(x => x.output_id !== 'lifestyle_1');
  a = await t19a(noPlan);
  ok(a.status === 'hold' && /no checked plan/.test(a.hold_reason), '19a: scene without a checked plan → hold');

  // ---------- 19b0 / 19c Prop verdict (live stock check) ----------
  const placeSt = await t19a(afterRoom);
  const list = await run('19b0_Prop_page_list.js', {}, [{ json: placeSt }]);
  ok(list.length === 3 && list.every(x => /^https:\/\/midasfurniture\.com\//.test(x.json.url)), '19b0: one page per Midas piece');
  const page = (stock, extra) => '<html><div class="product-info-main">' + (stock === 'in' ? '<div class="stock available" title="Availability"><span>In stock</span></div>' : (stock === 'out' ? '<div class="stock unavailable"><span>Out of stock</span></div>' : '')) + (extra || '') + '<div>Product Size : ♦ Table Lamp * W30 * D30 * H63 CM Product Color : SILVER</div></div></html>';
  const pages = [{ json: { statusCode: 200, body: page('in') } }, { json: { statusCode: 200, body: page('out') } }, { json: { statusCode: 406, body: '' } }];
  let v = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: placeSt }], '19b0 Prop page list': list }, pages))[0].json;
  ok(v.scene.props.length === 1 && v.scene.props[0].sku === P1.sku && v.scene.props[0].live.stock === 'in_stock' && v.scene.props[0].live.size_on_page === 'W 30 x D 30 x H 63 cm', '19c: in-stock piece kept with the size printed on its page, measurements only (P1.4)');
  ok(v.scene.props_left_out.some(x => x.sku === P2.sku && /out of stock/.test(x.why) && /spot stays empty/.test(x.why)) && v.scene.props_left_out.some(x => x.sku === P3.sku && /did not answer \(status 406\)/.test(x.why)), '19c: out of stock and a refused page → left out, spot empty');
  const conflict = [{ json: { statusCode: 200, body: page('in', '<div class="stock unavailable">x</div>') } }, { json: { statusCode: 200, body: page('none') } }, { json: { statusCode: 200, body: page('in', '<span>SKU: 12345</span>') } }];
  v = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: placeSt }], '19b0 Prop page list': list }, conflict))[0].json;
  ok(v.scene.props.length === 0 && /conflicting/.test(v.scene.props_left_out.find(x => x.sku === P1.sku).why) && /does not show the stock/.test(v.scene.props_left_out.find(x => x.sku === P2.sku).why) && /another SKU/.test(v.scene.props_left_out.find(x => x.sku === P3.sku).why), '19c: conflicting signals, no stock signal, another SKU → all left out');
  const jsonld = [{ json: { statusCode: 200, body: '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/InStock"}}</script>' } }, { json: { statusCode: 200, body: page('in') } }, { json: { statusCode: 200, body: page('in') } }];
  v = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: placeSt }], '19b0 Prop page list': list }, jsonld))[0].json;
  ok(v.scene.props.length === 3 && v.scene.props[0].live.size_on_page === 'not confirmed', '19c: schema.org InStock counts; a page with no size → size not confirmed');
  const noProps = clone(placeSt); noProps.scene.props = [];
  v = (await run('19c_Prop_verdict.js', {}, [{ json: noProps }]))[0].json;
  ok(v.scene.props.length === 0 && v.scene.prop_check.asked === 0 && /no Midas piece planned/.test(v.trail[v.trail.length - 1].note), '19c: no piece planned → reached straight from the ticket');

  // ---------- 19d2 / 19e2 / 19f2 checks and 19g references ----------
  const verdict = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: placeSt }], '19b0 Prop page list': list }, jsonld))[0].json;
  const V = { '19c Prop verdict': [{ json: verdict }] };
  let m = (await run('19d2_Master_check.js', V, [{ json: {}, binary: { data: ref(MASTER) } }]))[0].json.master;
  ok(m.ok && m.mime === 'image/png' && m.sha256 === sha(MASTER), '19d2: the downloaded master is the approved file');
  m = (await run('19d2_Master_check.js', V, [{ json: {}, binary: { data: ref(ROOM) } }]))[0].json.master;
  ok(!m.ok && /not the master the owner approved/.test(m.why), '19d2: another file in Drive → not used');
  m = (await run('19d2_Master_check.js', V, [{ json: { error: { message: 'not found' } } }]))[0].json.master;
  ok(!m.ok && /could not be downloaded/.test(m.why) && /not found/.test(m.why), '19d2: download failed → reason kept');
  let r = (await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(ROOM) } }]))[0].json.room;
  ok(r.ok && r.key === 'scene_room' && r.mime === 'image/jpeg', '19e2: the empty room from Drive matches its receipt');
  r = (await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(MASTER) } }]))[0].json.room;
  ok(!r.ok && /checksum differs/.test(r.why), '19e2: a different room file → not used');
  const clientV = clone(verdict); clientV.scene.room = { source: 'client room photo', key: 'room' };
  r = (await run('19e2_Room_check.js', { '19c Prop verdict': [{ json: clientV }] }, [{ json: {} }]))[0].json.room;
  ok(r.ok && r.key === 'room' && r.sha256 === sha(ROOM), '19e2: client room photo used as checked at intake');
  const photoList = await run('19f0_Photo_list.js', V);
  ok(photoList.length === 3 && photoList[0].json.photo_url === verdict.scene.props[0].photo_url, '19f0: one photo per kept piece');
  const photosIn = [{ json: {}, binary: { data: ref(PROP) } }, { json: { error: { message: '404' } } }, { json: {}, binary: { data: ref(Buffer.from('not an image at all, just text')) } }];
  const ph = (await run('19f2_Photo_check.js', { '19f0 Photo list': photoList }, photosIn))[0].json.photos;
  ok(ph[0].ok && ph[0].mime === 'image/webp' && !ph[1].ok && /could not be downloaded/.test(ph[1].why) && !ph[2].ok && /not a readable/.test(ph[2].why), '19f2: good webp kept; failed download and non-image refused');
  const masterChk = (await run('19d2_Master_check.js', V, [{ json: {}, binary: { data: ref(MASTER) } }]));
  const roomChk = (await run('19e2_Room_check.js', V, [{ json: {}, binary: { data: ref(ROOM) } }]));
  const photoChk = await run('19f2_Photo_check.js', { '19f0 Photo list': photoList }, photosIn);
  const N19 = Object.assign({}, V, SET, { '19d2 Master check': masterChk, '19e2 Room check': roomChk, '19f2 Photo check': photoChk, '19f0 Photo list': photoList,
    '19d Download master': [{ json: {}, binary: { data: ref(MASTER, 'image/png') } }], '19e Download room': [{ json: {}, binary: { data: ref(ROOM, 'image/jpeg') } }], '19f Prop photos': photosIn });
  let g = (await run('19g_Scene_references.js', N19, photoChk))[0];
  ok(g.json.status === 'scene_due' && g.json.scene.refs.map(x => x.role).join('|') === 'vendor photo|approved white master|room|Midas piece', '19g: image order vendor, master, room, Midas piece');
  ok(g.json.scene.refs.map(x => x.n).join() === '1,2,3,4' && g.binary.scene_master && g.binary.scene_room && g.binary.scene_prop_0 && !g.binary.scene_prop_1, '19g: binaries for master, room and the one good photo');
  ok(g.json.scene.props.length === 1 && g.json.scene.props_left_out.filter(x => /spot stays empty/.test(x.why)).length >= 2, '19g: pieces whose photo failed are left out');
  const small = Object.assign({}, N19, { '04 Settings': [{ json: Object.assign({}, SETTINGS, { max_inline_mb: (VENDOR.length + ROOM.length + PROP.length + 1000) / 1048576 }) }] });
  g = (await run('19g_Scene_references.js', small, photoChk))[0];
  ok(g.json.status === 'scene_due' && !g.json.scene.refs.some(x => x.key === 'scene_master') && /master is not sent/.test(g.json.scene.ref_notes[0]) && !g.binary.scene_master, '19g: over the request size → the master is left out first');
  const tiny = Object.assign({}, N19, { '04 Settings': [{ json: Object.assign({}, SETTINGS, { max_inline_mb: 0.001 }) }] });
  g = (await run('19g_Scene_references.js', tiny, photoChk))[0];
  ok(g.json.status === 'hold' && /Resizing is not built/.test(g.json.hold_reason) && !g.binary, '19g: still too large → hold, nothing sent');
  const badMaster = Object.assign({}, N19, { '19d2 Master check': [{ json: { master: { ok: false, why: 'checksum differs' } } }] });
  g = (await run('19g_Scene_references.js', badMaster, photoChk))[0];
  ok(g.json.status === 'hold' && /master cannot be used/.test(g.json.hold_reason), '19g: master not usable → hold');
  const roomSt = await t19a(packaged());
  g = (await run('19g_Scene_references.js', SET, [{ json: roomSt }]))[0];
  ok(g.json.status === 'scene_due' && g.json.scene.refs.length === 0 && !g.binary, '19g: empty room → no image sent');
  const clientRoom = clone(verdict); clientRoom.scene.room = { source: 'client room photo', key: 'room' };
  const NC = Object.assign({}, N19, { '19c Prop verdict': [{ json: clientRoom }], '19e2 Room check': await run('19e2_Room_check.js', { '19c Prop verdict': [{ json: clientRoom }] }, [{ json: {} }]) });
  g = (await run('19g_Scene_references.js', NC, photoChk))[0];
  ok(g.json.scene.refs[2].key === 'room' && !g.binary.scene_room, '19g: client room is the intake file (no Drive copy)');

  // ---------- 13 Compile: scene orders ----------
  const compile = async st => (await run('13_Compile.js', { 'V1 Vault events': [{ json: st }] }, [{ json: SETTINGS }]))[0].json;
  const roomDue = (await run('19g_Scene_references.js', SET, [{ json: roomSt }]))[0].json;
  let c = await compile(roomDue);
  ok(c.s04.go === true && c.s04.dispatch.output_id === 'lifestyle_1_room' && c.s04.dispatch.references.length === 0 && c.s04.dispatch.scene.phase === 'room', '13: empty-room order: own output id, no images');
  const rp = c.s04.dispatch.prompt;
  ok(/empty room/.test(rp) && /No furniture, no rugs/.test(rp) && /110-120 cm/.test(rp) && /4000 K/.test(rp) && /16:9/.test(rp) && !/Exact product inventory/.test(rp), '13: room prompt: shell only, camera and light presets, 16:9, no product lines');
  // Changed 16 Oct 2026 (prompt check S2): the empty room keeps a clear floor zone and names neither the product nor its size.
  ok(/Leave this floor zone clear, empty and fully visible/.test(rp) && !/Sectional sofa|size not confirmed|sofa/i.test(rp), '13: room prompt keeps a clear floor zone and names no product');
  ok(c.s04.orders.find(x => x.output_id === 'white_master').waits_for === 'done: approved by the owner' && c.s04.orders.find(x => x.output_id === 'wide').dispatch_now === false, '13: white master not sent again; other scenes wait their turn');
  const placeDue = (await run('19g_Scene_references.js', N19, photoChk))[0].json;
  c = await compile(placeDue);
  const pp = c.s04.dispatch.prompt;
  ok(c.s04.go && c.s04.dispatch.output_id === 'lifestyle_1' && c.s04.dispatch.attempt === 1 && c.s04.dispatch.references[0].role === 'vendor photo', '13: placement order, vendor photo is image 1');
  ok(/Image 1 is the vendor photo/.test(pp) && /Image 2 is the owner-approved catalogue master/.test(pp) && /Image 3 is the room/.test(pp) && /Image 4 is the Midas catalogue photo of .*SKU /.test(pp), '13: placement prompt names every image');
  ok(/7 \(1 x left-arm piece|1 x left-arm piece/.test(pp) && /Total product pieces: 7/.test(pp) && /Never mirror the product and never swap its ends/.test(pp), '13: placement prompt carries the inventory and handedness');
  ok(/add nothing: no other furniture/.test(pp) && /that spot stays empty/.test(pp) && /Hero view/.test(pp) && !/green plant/.test(pp), '13: Midas-only; generic props never named; hero framing');
  // Phase 1 review, finding 3 (16 Oct 2026): a lamp's empty room is made without images, so its prompt never names "image 1"; the
  // placement keeps the near-product-height line at the vendor photo's angle.
  const lampCam = { family: 'tabletop or lamp', height_cm: '', height_rule: 'near the product\'s own height, at the same angle as image 1 (the vendor photo)', room_rule: 'level, at about 75 cm, the height of the table or console top the product will stand on' };
  const lampRoom = clone(roomDue); lampRoom.scene.presets.camera = lampCam;
  c = await compile(lampRoom);
  ok(c.s04.go && /Camera: level, at about 75 cm, the height of the table or console top/.test(c.s04.dispatch.prompt) && !/image 1/i.test(c.s04.dispatch.prompt) && !/eye height/.test(c.s04.dispatch.prompt), '13: a lamp\'s empty-room prompt gives the surface height and never names image 1');
  const lampPlace = clone(placeDue); lampPlace.scene.presets.camera = lampCam;
  c = await compile(lampPlace);
  ok(c.s04.go && /Camera: near the product's own height, at the same angle as image 1 \(the vendor photo\)/.test(c.s04.dispatch.prompt) && !/eye height about/.test(c.s04.dispatch.prompt), '13: a lamp\'s placement prompt keeps the near-product-height line');
  // Owner, 16 Oct 2026, 21:28 (item 5): a tabletop product's camera is level (0 degrees tilt), so the Reference view takes only the side
  // from the vendor photo, never its tilt.
  const lampCam2128 = { family: 'tabletop or lamp', height_cm: '', tilt_deg: 0, camera_cm: 106, height_rule: 'level (0 degrees tilt), at about 106 cm (the table or console top plus half the product\'s height), seen from the same side as image 1 (the vendor photo)', room_rule: 'level (0 degrees tilt), at about 106 cm: the table or console top at about 75 cm (typical) plus half the product\'s height of 63 cm' };
  const lampPlace2 = clone(placeDue); lampPlace2.scene.presets.camera = lampCam2128; lampPlace2.scene.presets.view = 'Reference view';
  c = await compile(lampPlace2);
  const pp2 = c.s04.dispatch ? c.s04.dispatch.prompt : '';
  ok(c.s04.go && /Camera: level \(0 degrees tilt\), at about 106 cm/.test(pp2) && /from the same side as image 1 \(the vendor photo\), level at 0 degrees tilt even if image 1 was taken from above/.test(pp2) && !/same side, angle and perspective as image 1/.test(pp2), '13 (21:28): a lamp\'s placement gives about 106 cm, level, and takes only the side from image 1', pp2.slice(0, 400));
  const lampRoom2 = clone(roomDue); lampRoom2.scene.presets.camera = lampCam2128;
  c = await compile(lampRoom2);
  ok(c.s04.go && /Camera: level \(0 degrees tilt\), at about 106 cm: the table or console top at about 75 cm/.test(c.s04.dispatch.prompt) && !/image 1/i.test(c.s04.dispatch.prompt), '13 (21:28): the lamp\'s empty room is shot at about 106 cm, never naming image 1');
  const noAp = clone(placeDue); noAp.approved = null;
  c = await compile(noAp);
  ok(c.s04.go === false && c.s04.critical.some(x => /approval of the white master/.test(x.why)), '13: scene without the owner\'s approval of the white master → nothing made');
  const rep = clone(placeDue); rep.status = 'repair_ordered'; rep.repair_orders = { lifestyle_1: { attempt: 2, corrections: ['Put the rug fully under the front legs.'], preserve: ['the room as it is'] } };
  c = await compile(rep);
  ok(c.s04.go && c.s04.dispatch.attempt === 2 && /Put the rug fully under the front legs/.test(c.s04.dispatch.prompt) && c.s04.dispatch.scene.phase === 'place', '13: scene repair attempt 2 with the corrections');
  rep.repair_orders.lifestyle_1.attempt = 4;
  c = await compile(rep);
  ok(c.s04.go === false && c.s04.critical.some(x => /at most two repairs/.test(x.why)), '13: a 4th attempt for a scene is refused');
  const whiteRun = clone(base); whiteRun.status = 'go_1_given'; whiteRun.go1_last = { decision: 'go', by: 'owner' };
  c = await compile(whiteRun);
  ok(c.s04.dispatch && c.s04.dispatch.output_id === 'white_master' && !c.s04.dispatch.scene && /stage 07 Scenes/.test(c.s04.orders.find(x => x.output_id === 'lifestyle_1').waits_for), '13: round 1 still makes the white master only; scenes wait for stage 07');

  // ---------- 15e: scene images handed to the request ----------
  const s04 = clone((await compile(placeDue)).s04);
  s04.op_row = { operation_key: 'k' };
  const e = (await run('15e_Ready_check.js', { '15b Dispatch guard': [{ json: { s04 } }], '15c Drive run folder': [{ json: { id: 'f1', name: 'x' } }], '02 Ingest files': [{ json: {}, binary: { photo: ref(VENDOR, 'image/png'), room: ref(ROOM) } }], '19g Scene references': [{ json: {}, binary: { scene_master: ref(MASTER), scene_prop_0: ref(PROP) } }] }, [{ json: { id: 3, operation_key: 'k' } }]))[0];
  ok(e.binary.photo && e.binary.scene_master && e.binary.scene_prop_0 && e.binary.room, '15e: scene images merged with the intake files');
  const white04 = clone(s04); delete white04.dispatch.scene;
  const e2 = (await run('15e_Ready_check.js', { '15b Dispatch guard': [{ json: { s04: white04 } }], '15c Drive run folder': [{ json: { id: 'f1' } }], '02 Ingest files': [{ json: {}, binary: { photo: ref(VENDOR) } }], '19g Scene references': [{ json: {}, binary: { scene_master: ref(MASTER) } }] }, [{ json: { id: 3, operation_key: 'k' } }]))[0];
  ok(e2.binary.photo && !e2.binary.scene_master, '15e: a white-master call never carries scene images');

  // ---------- 15q: what a made image becomes ----------
  const q = async (compiled, outcome) => {
    const s4 = clone(compiled.s04); s4.outcome = outcome || 'candidate'; s4.op_row = { operation_key: 'k', attempt: s4.dispatch.attempt, model: 'm', reserved_usd: 0.07 };
    s4.op_update = { status: 'completed', actual_usd: 0.06, cost_basis: 'tokens' }; s4.permanent_copy = { stored: true, drive_file_id: 'd1', link: 'L', folder_id: 'f' };
    s4.receipt = { image: { sha256: sha(ROOM), bytes: ROOM.length, px: '1125x1125', file_name: 'x_' + s4.dispatch.output_id + '_try1.jpg', label: 'Generated image.' }, checks: 1 };
    return (await run('15q_Stage_04_result.js', { '13 Compile': [{ json: compiled }], '15o Final receipt': [{ json: { s04: s4 } }] }, [{ json: { operation_key: 'k' } }]))[0].json;
  };
  let res = await q(await compile(roomDue));
  ok(res.status === 'scene_room_ready' && res.stage04.candidate.output_id === 'lifestyle_1_room' && /working image/.test(res.next), '15q: empty room → straight to placement, not a deliverable');
  res = await q(await compile(placeDue));
  ok(res.status === 'awaiting_review' && /^Scene lifestyle_1 \(attempt 1\)/.test(res.next) && res.stage04.candidate.scene.phase === 'place', '15q: placed scene → review');
  // Found in pinned run 433: one execution holds several dispatches. An early stop must not read an older pass's receipt.
  {
    const placeC = await compile(placeDue);
    const oldPass = clone(placeC.s04); oldPass.started_at = '2026-10-15T00:00:00.000Z'; oldPass.outcome = 'candidate';
    oldPass.op_row = { operation_key: 'run:white_master:try1' }; oldPass.op_update = { status: 'completed', actual_usd: 0.06, cost_basis: 'tokens' };
    const stop = clone(placeC.s04); stop.go = false; stop.outcome = 'hold'; stop.hold_step = 15; stop.critical = [{ what: 'stage04', who: 'owner', why: 'This job has no cost estimate, so there is no budget to check against. Nothing was sent.' }];
    let r15 = (await run('15q_Stage_04_result.js', { '13 Compile': [{ json: placeC }], '15o Final receipt': [{ json: { s04: oldPass } }] }, [{ json: { s04: stop } }]))[0].json;
    ok(r15.status === 'hold' && /no cost estimate/.test(r15.hold_reason) && /No paid image call was made/.test(r15.next) && !/white_master/.test(r15.next) && r15.stage04.operation === null, '15q: an early stop uses its own reason, not an older receipt in the same run');
    r15 = (await run('15q_Stage_04_result.js', { '13 Compile': [{ json: placeC }], '15o Final receipt': [{ json: { s04: oldPass } }] }, [{ json: { operation_key: 'run:white_master:try1' } }]))[0].json;
    ok(r15.status === 'hold' && /could not be matched to its compile/.test(r15.hold_reason) && /not confirmed whether a paid image call/.test(r15.next) && r15.stage04.paid_call === 'not confirmed', '15q: a receipt from another compile → hold, paid call not confirmed');
  }
  // The loop: 15q room → 19a continues with the placement of the same scene.
  a = await t19a(await q(await compile(roomDue)));
  ok(a.status === 'scene_preparing' && a.scene.output_id === 'lifestyle_1' && a.scene.phase === 'place' && a.scene.room.sha256 === sha(ROOM), 'loop: room made → placement of the same scene');

  // ---------- 16a / 16b: scene review ----------
  const reviewSt = await q(await compile(placeDue));
  const N16 = { 'V1 Vault events': [{ json: reviewSt }], '02 Ingest files': [{ json: {}, binary: { photo: ref(VENDOR) } }], '15m Receipt': [{ json: {}, binary: { image: ref(ROOM) } }], '19g Scene references': [{ json: {}, binary: (await run('19g_Scene_references.js', N19, photoChk))[0].binary }] };
  const t16 = (await run('16a_Review_ticket.js', N16))[0];
  ok(t16.json.rv.ready && t16.json.rv.kind === 'scene' && t16.json.rv.binary_names === 'vendor,candidate,prop_0' && t16.binary.prop_0, '16a: scene review sends vendor, candidate and the Midas photo');
  ok(/Image 3 is the Midas catalogue photo/.test(t16.json.rv.critic_text) && /only_listed_props/.test(t16.json.rv.critic_text) && /scale/.test(t16.json.rv.critic_text) && !/pure white seamless studio background with only/.test(t16.json.rv.critic_text), '16a: scene checks, not white-background checks');
  ok(/interior photograph/.test(t16.json.rv.blind_text) && /Sectional sofa|sectional sofa/.test(t16.json.rv.blind_text) && !/how many there should be\..*7/.test(t16.json.rv.blind_text), '16a: blind count told the product kind, never the number');
  const N16b = Object.assign({}, N16, { '19g Scene references': [{ json: {}, binary: {} }] });
  ok((await run('16a_Review_ticket.js', N16b))[0].json.rv.ready === false, '16a: a missing Midas photo → scene not reviewed');
  const checksAll = r => Object.fromEntries(['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'framing', 'camera_level', 'light', 'no_text_or_logo', 'realism'].map(k => [k, { result: r, evidence: 'ok', seen: k === 'piece_count' ? 7 : undefined }]));
  const critic = { checks: checksAll('pass'), defects: [], scores: { fidelity: 88, integrity: 90, drift: 10, data_loss: 5 }, summary: 'fine' };
  const N16v = { 'V1 Vault events': [{ json: reviewSt }], '16a Review ticket': [{ json: t16.json }], '04 Settings': [{ json: SETTINGS }], '16 Critic review': [{ json: { content: [{ text: JSON.stringify(critic) }] } }], '16x Blind count': [{ json: { content: { parts: [{ text: JSON.stringify({ total: 7, background_white: false, text_or_logo: false, cropped: false }) }] } } }] };
  let vr = (await run('16b_Review_verdict.js', N16v))[0].json;
  ok(vr.status === 'awaiting_go_2' && vr.review.result === 'passed' && vr.go2.kind === 'scene' && /approve this scene lifestyle_1/.test(vr.go2.decision_needed), '16b: scene passes on scene checks; background "not white" is no defect in a room');
  // Changed 16 Oct 2026 (owner, 04:16): framing is a styling reading beside the checks, no longer one of the checks that decide the result.
  ok(Object.keys(vr.review.checks).length === 20 && !vr.review.checks.framing && vr.review.checks.only_listed_props.result === 'pass' && vr.review.framing && vr.review.framing.view === 'hero', '16b: 20 scene checks recorded (people_ok and no_unplanned_lamp added 16 Oct 2026); framing reported beside them');
  const bad = clone(critic); bad.checks.midas_pieces_match = { result: 'fail', evidence: 'the rug is a different pattern' }; bad.defects = [{ check: 'midas_pieces_match', what: 'rug differs', where: 'floor', fix: 'Use the rug exactly as in image 3.' }];
  vr = (await run('16b_Review_verdict.js', Object.assign({}, N16v, { '16 Critic review': [{ json: { content: [{ text: JSON.stringify(bad) }] } }] })))[0].json;
  ok(vr.review.result === 'failed' && vr.go2_proposed_repair.preserve.some(p => /the room as it is/.test(p)) && vr.go2_proposed_repair.preserve.some(p => /Midas piece .*exactly as catalogued/.test(p)), '16b: failed scene → repair proposal keeps the room and the Midas pieces');
  vr = (await run('16b_Review_verdict.js', Object.assign({}, N16v, { '16x Blind count': [{ json: { content: { parts: [{ text: JSON.stringify({ total: 6, text_or_logo: false, cropped: true }) }] } } }] })))[0].json;
  // Changed 16 Oct 2026: a product cut off by the frame is recorded as whole_in_frame (the image does not show the whole product), not as framing.
  ok(vr.review.result === 'failed' && vr.review.checks.piece_count.result === 'fail' && vr.review.checks.whole_in_frame.result === 'fail' && vr.review.defects.some(d => d.check === 'whole_in_frame'), '16b: blind count 6 of 7 and a cropped product fail the scene');

  // ---------- G2: the owner's go 2 on a scene ----------
  vr = (await run('16b_Review_verdict.js', N16v))[0].json;
  const g2 = async body => (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: vr }] }, [{ json: { body } }]))[0].json;
  const ans = d => ({ decision: d, go2_token: vr.go2_token, run_id: vr.run_id, round: vr.go2_round, note: d === 'repair' ? 'move the lamp left' : '' });
  let go = await g2(ans('approve'));
  ok(go.status === 'scene_approved' && go.scenes.done.lifestyle_1.by === 'owner' && go.scenes.done.lifestyle_1.props.length === 1 && go.approved.output_id === 'white_master' && go.scene === null, 'G2: scene approved by the owner; the white master approval unchanged');
  a = await t19a(go);
  ok(a.status === 'scene_preparing' && a.scene.output_id === 'wide', 'loop: after an approved scene the next one starts');
  go = await g2(ans('repair'));
  ok(go.status === 'repair_ordered' && go.repair_orders.lifestyle_1.attempt === 2 && go.repair_orders.lifestyle_1.corrections.some(x => /move the lamp left/.test(x)), 'G2: scene repair ordered by the owner');
  c = await compile(go);
  ok(c.s04.go && c.s04.dispatch.output_id === 'lifestyle_1' && c.s04.dispatch.attempt === 2, 'loop: the scene repair goes back to 13 as attempt 2');
  const goOk = await g2(ans('approve'));
  ok(goOk.scenes.done.lifestyle_1.shown_as.startsWith('Owner approved · review') && goOk.scenes.done.lifestyle_1.client_shown_as === 'Approved', 'G2: owner label reports review outcome separately from the approval');
  // Owner, 16 Oct 2026, 21:28 (item 4): a scene approved by eye, the same rule as the white master.
  const vrEye = clone(vr); vrEye.go2_allowed = ['approve_unreviewed', 'stop'];
  const goEye = (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: vrEye }] }, [{ json: { body: ans('approve_unreviewed') } }]))[0].json;
  const dEye = goEye.scenes && goEye.scenes.done && goEye.scenes.done.lifestyle_1;
  ok(goEye.status === 'scene_approved' && dEye && dEye.without_review === true && dEye.shown_as === 'Approved by the studio · not reviewed' && dEye.client_shown_as === 'Approved by the studio' && dEye.approval_kind === 'approved by owner without an automated review' && /the client sees "Approved by the studio"/.test(goEye.next), 'G2 (21:28): a scene approved by eye is shown as "Approved by the studio · not reviewed"; the client sees "Approved by the studio"; audit wording kept', goEye.next);
  go = await g2(ans('stop'));
  ok(go.status === 'stopped_by_owner' && /scene lifestyle_1 is not approved\. Scenes approved before stay approved/.test(go.next), 'G2: stop on a scene');
  go = (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: vr }] }, [{ json: {} }]))[0].json;
  ok(go.status === 'hold' && /scene lifestyle_1 is held/.test(go.hold_reason), 'G2: no answer in 24 hours → the scene is held');

  // ---------- V1: scene events and the run row ----------
  const v1 = (await run('V1_Vault_events.js', {}, [{ json: placeDue }], { resumeUrl: '' }))[0].json;
  ok(v1.events.some(x => x.kind === 'scene_ticket' && x.stage === '07' && x.step === 19) && v1.events.some(x => x.kind === 'status' && x.stage === '07'), 'V1: scene ticket and status events under stage 07');
  ok(JSON.parse(v1.row.scenes).current.output_id === 'lifestyle_1' && JSON.parse(v1.row.scenes).queue.length === 2, 'V1: the run row carries the scenes summary');
  // Found in pinned run 432: a stage 04 record without an orders list made V1 fail. It must log, not stop.
  const noOrders = clone(placeDue); noOrders.stage04 = { candidate: { output_id: 'lifestyle_1_room' } };
  const v1b = (await run('V1_Vault_events.js', {}, [{ json: noOrders }], { resumeUrl: '' }))[0].json;
  ok(JSON.parse(v1b.row.stage04).orders.length === 0 && v1b.events.length > 0, 'V1: a stage 04 record without orders is logged, not an error');

  // ---------- 18a: the package names the scenes as coming next ----------
  const pkSt = clone(base); pkSt.status = 'white_master_approved'; pkSt.go2_last = { decision: 'approve', by: 'owner' };
  pkSt.approved = { output_id: 'white_master', attempt: 1, by: 'owner', candidate: { drive_file_id: 'd', sha256: sha(MASTER) } };
  const pk = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: pkSt }], '04 Settings': [{ json: SETTINGS }] }))[0].json.pk;
  ok(pk.not_in_package.some(x => /lifestyle_1 \(lifestyle\): a scene image, made in stage 07/.test(x)), '18a: scenes listed as made in stage 07, not in the package');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR ' + e.stack); process.exit(1); });
