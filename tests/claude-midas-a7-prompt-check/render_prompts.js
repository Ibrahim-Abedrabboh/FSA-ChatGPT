// Renders the prompts A7's real 13 Compile writes for the stage 07 test data (7-piece sectional): white master, empty room, placement.
// Local only: no network, no AI call, no paid call. Written 16 Oct 2026 for the prompt check (claude-midas-a7-prompt-check-2026-10-16.md).
// Run: node tests/claude-midas-a7-prompt-check/render_prompts.js OUT_DIR   (writes white_prompt.txt, room_prompt.txt, place_prompt.txt)
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
  ok(/ASSUMPTION/.test(SETTINGS.scenes.camera.default.basis) && /assumptions/.test(SETTINGS.scenes.kelvin.basis), '04 Settings: values not in the owner documents are labelled as assumptions');

  // ---------- Base state: a sofa run with a white master and two scene outputs ----------
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
  delete base.events; delete base.row;
  base.profile = Object.assign({}, base.profile, { prop_policy: 'living' });
  // 16 Oct 2026 (owner decision 26): the profile as A7's own table gives it (07 Route), with F1's category guidance.
  const A7P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claude-midas-a7-profiles-2026-10-16.json'), 'utf8')).find(r => r.profile_id === 'sofa');
  if (A7P) base.profile = Object.assign({}, base.profile, { family: A7P.family, guide: A7P.guide, source_rules: '', scene: A7P.scene });
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
  // The plan now carries the room fields and a person field (16 Oct 2026, 11 Stylist); everything else as before.
  const planScene = { room_size: 'about 5 x 4 m', room: { walls: 'warm plaster', floor: 'light oak boards', windows: 'a large window on the left with plain sheer curtains', zone: 'centred against the long wall' }, person: '', setting: 'A calm Kuwaiti living room with warm plaster walls, a large window and a sofa vignette with a centre table', light: 'soft afternoon light', camera: 'front view, slightly off centre', presentation: 'the sofa against the long wall, all 7 modules visible', supporting_props: ['books', 'a green plant'],
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
  ok(a.status === 'scenes_complete' && /All 2 scene image/.test(a.next) && /1125 x 1125 jpg and webp/.test(a.next) && a.scene === null, '19a: every scene approved with its delivery files → scenes complete');
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
  ok(v.scene.props.length === 1 && v.scene.props[0].sku === P1.sku && v.scene.props[0].live.stock === 'in_stock' && /W30 \* D30 \* H63 CM/.test(v.scene.props[0].live.size_on_page), '19c: in-stock piece kept with the size printed on its page');
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
  ok(/Leave this floor zone clear, empty and fully visible/.test(rp) && !/sofa|size not confirmed/i.test(rp), '13: room prompt keeps a clear floor zone and names no product (S2)');
  ok(c.s04.orders.find(x => x.output_id === 'white_master').waits_for === 'done: approved by the owner' && c.s04.orders.find(x => x.output_id === 'wide').dispatch_now === false, '13: white master not sent again; other scenes wait their turn');
  const placeDue = (await run('19g_Scene_references.js', N19, photoChk))[0].json;
  c = await compile(placeDue);
  const pp = c.s04.dispatch.prompt;
  fs.writeFileSync(process.argv[2] + '/room_prompt.txt', rp);
  fs.writeFileSync(process.argv[2] + '/place_prompt.txt', pp);
  const wr = await compile(whiteRun0());
  function whiteRun0(){ const w = clone(base); w.status = 'go_1_given'; w.go1_last = { decision: 'go', by: 'owner' }; return w; }
  fs.writeFileSync(process.argv[2] + '/white_prompt.txt', wr.s04.dispatch.prompt);
  console.log('pass', pass, 'fail', failN);
})().catch(e => { console.error(e); process.exit(1); });
