// Local tests for the image shape mapping (01, 11a, 13) and the scene delivery files (step 20, 19a, V1). 16 Oct 2026.
// Owner answers of 16 Oct 2026: 03:24 (nine shapes, 1:1 by default; the page's `aspect` labels are read) and 03:25 (jpg and webp at
// the image's own shape, short side 1125 px; never stretched, cropped, padded or upscaled; a smaller master is held for the owner).
// Runs the n8n Code-node source with mocked node outputs and code-made images. No network, no AI call, no paid call.
// Run: node tests/claude-midas-a7-scene-files/run_tests_scene_files.js
// Fixtures: python3 tests/claude-midas-a7-scene-files/claude-make-fixtures.py
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const FIX = path.join(__dirname, 'fixtures');
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
const img = n => fs.readFileSync(path.join(FIX, n));
const SHAPES = ['1:1', '4:5', '5:4', '3:4', '4:3', '2:3', '3:2', '16:9', '9:16'];

(async () => {
  // ================= Part 1 · Shapes =================
  const SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;
  ok(SETTINGS.scene_delivery && SETTINGS.scene_delivery.short_side_px === 1125 && SETTINGS.scene_delivery.formats.join() === 'jpg,webp' && SETTINGS.scene_delivery.jpg_quality === 92, '04 Settings: scene delivery block (short side 1125, jpg and webp, quality 92)');
  const intent = async scope => (await run('01_Intent_scope.js', {}, [{ json: { body: { payload: JSON.stringify({ clientRunId: 'claude-test-shape-0001', job: { type: 'new_project' }, item: { category: 'Sofas' }, scope: Object.assign({ outcome: 'Lifestyle', outcomes: ['Lifestyle'], view: 'Category template', resolution: 'Standard for category', imageCount: 1 }, scope) }) } } }]))[0].json;
  const shapeNotes = r => r.not_applied.filter(x => /image shape/i.test(x));
  // The page's own option list, read from the page source (claude-outputs/claude-midas-studio-page/app.js, OPT.aspect).
  const page = fs.readFileSync(path.join(ROOT, 'claude-outputs', 'claude-midas-studio-page', 'app.js'), 'utf8');
  const optAspect = page.match(/const OPT = \{[\s\S]*?\n\s*aspect: \[([^\]]+)\]/);
  const pageValues = optAspect ? optAspect[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')) : [];
  ok(pageValues.length === 4 && pageValues[0] === 'Standard for category', 'page source: 4 aspect values read (' + pageValues.join(' | ') + ')');
  const EXPECT = { 'Standard for category': '1:1', 'Square · 1:1': '1:1', 'Portrait · 4:5': '4:5', 'Landscape · 16:9': '16:9' };
  for (const v of pageValues) {
    const r = await intent({ aspect: v });
    ok(r.usable === 'ok' && r.brief.proportions === EXPECT[v] && r.brief.proportions_source === 'aspect' && shapeNotes(r).length === 0, '01: page label "' + v + '" → ' + EXPECT[v]);
  }
  let r = await intent({});
  ok(r.brief.proportions === '1:1' && r.brief.proportions_source === 'default' && shapeNotes(r).length === 0, '01: no shape sent → 1:1 (default, not 16:9)');
  let allP = true, allA = true;
  for (const s of SHAPES) {
    const a = await intent({ proportions: s }); if (!(a.brief.proportions === s && a.brief.proportions_source === 'proportions' && shapeNotes(a).length === 0)) allP = false;
    const b = await intent({ aspect: s }); if (!(b.brief.proportions === s && b.brief.proportions_source === 'aspect')) allA = false;
  }
  ok(allP, '01: each of the nine shapes is read from `proportions`');
  ok(allA, '01: each of the nine shapes is read from `aspect` written bare (e.g. "3:4")');
  r = await intent({ aspect: 'Panorama · 21:9' });
  ok(r.brief.proportions === '1:1' && shapeNotes(r).length === 1 && /not offered: Panorama · 21:9/.test(shapeNotes(r)[0]) && /1:1 is used/.test(shapeNotes(r)[0]), '01: a shape that is not offered (21:9) → 1:1, with a note to the client');
  r = await intent({ aspect: 'Square · 1:1', proportions: '9:16' });
  ok(r.brief.proportions === '9:16' && r.brief.proportions_source === 'proportions' && shapeNotes(r).some(x => /Two image shapes were sent/.test(x)), '01: two different shapes sent → A7\'s own `proportions` is used, with a note');
  r = await intent({ aspect: 'Portrait · 4:5', proportions: '4:5' });
  ok(r.brief.proportions === '4:5' && shapeNotes(r).length === 0, '01: the same shape in both fields → no note');
  r = await intent({ outcome: 'Website', outcomes: ['Website'], aspect: 'Square · 1:1' });
  ok(r.brief.proportions === '1:1' && r.brief.outputs.map(o => o.id).join() === 'white_master,hero,wide,detail', '01: Website package as the page sends it → 1:1 for every scene');

  // 11a: the planner is told the same shape; the white master stays 1:1.
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
  delete base.events; delete base.row;
  base.outputs = base.outputs.concat([{ id: 'lifestyle_1', kind: 'lifestyle', outcome: 'lifestyle', mode: 'creative_room', locks: [], free: [] }]);
  const c13 = fs.readFileSync(path.join(NODES, '13_Compile.js'), 'utf8');
  const RATIO_NAMES = eval('(' + c13.match(/const RATIO_NAMES = (\{[^\n]+\});/)[1] + ')');
  const ratioOf = eval('(' + c13.match(/function ratioOf\(frame\) \{[^\n]+\}/)[0] + ')');
  ok(Object.keys(RATIO_NAMES).sort().join() === SHAPES.slice().sort().join(), '13 Compile names exactly the nine shapes');
  ok(/const frame = \(sc\.shot && sc\.shot\.frame\) \|\| 'square, 1:1';/.test(c13) && !/16:9, wider than tall';\n/.test(c13.split('const RATIO_NAMES')[1].split('\n').slice(1).join('\n')), '13 Compile: a scene with no frame falls back to square 1:1, not 16:9');
  let all11 = true, allRound = true;
  for (const s of SHAPES) {
    const st = clone(base); st.brief = Object.assign({}, st.brief, { proportions: s });
    const t = (await run('11a_Plan_ticket.js', {}, [{ json: st }]))[0].json;
    const w = t.shots.find(x => x.kind === 'white'), l = t.shots.find(x => x.output_id === 'lifestyle_1');
    if (!(w.frame === 'square, 1:1' && l.frame === RATIO_NAMES[s] && t.plan_request.indexOf('frame ' + RATIO_NAMES[s]) !== -1)) all11 = false;
    if (ratioOf(l.frame) !== s) allRound = false;
  }
  ok(all11, '11a: each of the nine shapes reaches the scene shot and the planner; the white master stays square 1:1');
  ok(allRound, '11a → 13: the frame text of each shape reads back as the same shape (the ratio sent to the model)');
  const st0 = clone(base); st0.brief = Object.assign({}, st0.brief, { proportions: '' });
  const t0 = (await run('11a_Plan_ticket.js', {}, [{ json: st0 }]))[0].json;
  ok(t0.shots.find(x => x.output_id === 'lifestyle_1').frame === 'square, 1:1', '11a: no shape in the brief → square 1:1 (was 16:9)');

  // ================= Part 2 · Scene delivery files =================
  const M169 = img('scene_2048x1152.png');
  const approvedState = (master, over) => {
    const s = clone(base);
    s.status = 'scene_approved'; s.stage = '05 Review';
    s.shots = [{ n: 1, output_id: 'white_master', kind: 'white', frame: 'square, 1:1' }, { n: 2, output_id: 'lifestyle_1', kind: 'lifestyle', frame: 'landscape, 16:9, wider than tall' }];
    const cand = { output_id: 'lifestyle_1', drive_file_id: 'drive-scene', folder_id: 'drive-run-folder', link: 'https://drive.example/s', sha256: sha(master), px: '', bytes: master.length, file_name: 'x_lifestyle_1_try1.png' };
    s.go2 = { kind: 'scene', output_id: 'lifestyle_1', candidate: cand };
    s.go2_last = { round: 1, decision: 'approve', note: '', at: '2026-10-16T01:00:00Z', by: 'owner', result: 'scene_approved' };
    s.scenes = { queue: ['lifestyle_1', 'wide'], done: { lifestyle_1: { attempt: 1, by: 'owner', at: '2026-10-16T01:00:00Z', note: '', candidate: cand, review_result: 'pass',
      props: [{ sku: '159304', name: 'Cushion', page: 'https://midasfurniture.com/en/cushion-159304.html', live: { stock: 'in_stock', read_at: '2026-10-16T00:50:00Z', size_on_page: '45 x 45 cm', page: 'https://midasfurniture.com/en/cushion-159304.html' } }],
      props_left_out: [{ sku: '173762', why: 'out of stock on its live Midas page' }] } }, log: [] };
    s.scenes.done.lifestyle_1.release = {run_id:s.run_id,output_id:'lifestyle_1',candidate_sha256:cand.sha256,contract_stamp:s.contract_stamp,classification:'reviewed_owner_approved'};
    return Object.assign(s, over || {});
  };
  const t20a = async st => (await run('20a_Scene_files_ticket.js', { 'V1 Vault events': [{ json: st }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  let A = await t20a(approvedState(M169));
  ok(A.sf.ok && A.sf.output_id === 'lifestyle_1' && A.sf.master.drive_file_id === 'drive-scene' && A.sf.planned.shape === '16:9' && A.sf.cfg.short_side_px === 1125, '20a: ticket for the scene the owner just approved');
  ok(A.sf.midas_pieces.length === 1 && A.sf.midas_pieces[0].page === 'https://midasfurniture.com/en/cushion-159304.html' && A.sf.midas_pieces[0].stock.reading === 'in stock' && A.sf.midas_pieces_left_out[0].sku === '173762', '20a: Midas pieces with SKU, page and live stock reading; the piece left out is listed');
  let bad = approvedState(M169); bad.go2_last.decision = 'repair';
  ok(!(await t20a(bad)).sf.ok, '20a: no owner approval recorded → no files');
  bad = approvedState(M169); bad.scenes.done.lifestyle_1.files = { status: 'ready' };
  ok(/not made twice/.test((await t20a(bad)).sf.problem), '20a: files already made → not made twice');
  bad = approvedState(M169); bad.status = 'awaiting_go_2';
  ok(!(await t20a(bad)).sf.ok, '20a: run not in "scene approved" → no files');

  const t20c = async (ticket, buf, mime) => (await run('20c_Check_scene_master.js', { '20a Scene files ticket': [{ json: ticket }] }, [{ json: {}, binary: buf ? { data: ref(buf, mime || 'image/png') } : {} }]))[0];
  const withPlan = (master, shape) => { const s = approvedState(master); s.shots[1].frame = shape; return s; };
  const CASES = [
    ['scene_2048x2048.png', 'square, 1:1', 1125, 1125],
    ['scene_1638x2048.png', 'portrait, 4:5, taller than wide', 1125, 1407],
    ['scene_2048x1152.png', 'landscape, 16:9, wider than tall', 2000, 1125],
    ['scene_1152x2048.png', 'portrait, 9:16, taller than wide', 1125, 2000],
    ['scene_1536x2048.png', 'portrait, 3:4, taller than wide', 1125, 1500]
  ];
  for (const [f, frame, W, H] of CASES) {
    const buf = img(f);
    const T = await t20a(withPlan(buf, frame));
    const out = await t20c(T, buf);
    const sf = out.json.sf;
    const [w, h] = f.match(/(\d+)x(\d+)/).slice(1).map(Number);
    const uniform = Math.abs(sf.target.w / sf.target.h - w / h) / (w / h) < 1 / 1125;
    ok(sf.ok && sf.target.w === W && sf.target.h === H && uniform && Math.min(sf.target.w, sf.target.h) === 1125 && sf.target.w <= w && sf.target.h <= h && out.binary && out.binary.data, '20c: ' + w + ' x ' + h + ' → ' + W + ' x ' + H + ' (short side 1125, same scale both ways, never larger than the master)');
    ok(sf.files.map(x => x.file_name).join() === [sf.base + '_lifestyle_1_' + W + 'x' + H + '.jpg', sf.base + '_lifestyle_1_' + W + 'x' + H + '.webp'].join() && sf.notes.length === 0, '20c: file names carry the size; no shape note when the image is the planned shape (' + f + ')');
  }
  let small = img('scene_1100x1956.png');
  let C = await t20c(await t20a(withPlan(small, 'portrait, 9:16, taller than wide')), small);
  ok(!C.json.sf.ok && C.json.sf.too_small === true && /under 1125 px/.test(C.json.sf.problem) && /upscaling, which is never done/.test(C.json.sf.problem) && !C.binary, '20c: short side 1100 px → held for the owner; nothing resized');
  small = fs.readFileSync(path.join(FIX6, 'master_1000.png'));
  C = await t20c(await t20a(withPlan(small, 'square, 1:1')), small);
  ok(!C.json.sf.ok && C.json.sf.too_small === true, '20c: 1000 x 1000 → held for the owner');
  const sq = img('scene_2048x2048.png');
  C = await t20c(await t20a(withPlan(sq, 'landscape, 16:9, wider than tall')), sq);
  ok(C.json.sf.ok && C.json.sf.target.w === 1125 && C.json.sf.target.h === 1125 && C.json.sf.notes.some(n => /not the planned 16:9 shape/.test(n) && /nothing is cropped or stretched/.test(n)), '20c: image not the planned shape → files follow the image as approved, with a note');
  C = await t20c(await t20a(withPlan(M169, 'landscape, 16:9, wider than tall')), img('scene_2048x2048.png'));
  ok(!C.json.sf.ok && /checksum differs/.test(C.json.sf.problem), '20c: Drive file is not the approved scene → nothing made');
  C = await t20c(await t20a(approvedState(M169)), null);
  ok(!C.json.sf.ok && /could not be downloaded/.test(C.json.sf.problem), '20c: download failed → nothing made');

  // 20f: the two files made by Edit Image (stood in by code-made files of the right and wrong sizes).
  const T169 = await t20a(approvedState(M169));
  const C169 = await t20c(T169, M169);
  const t20f = async (jpg, webp) => (await run('20f_Check_scene_files.js', { '20c Check scene master': [C169] }, [{ json: {}, binary: Object.assign({}, jpg ? { jpg: ref(jpg, 'image/jpeg') } : {}, webp ? { webp: ref(webp, 'image/webp') } : {}) }]))[0];
  let F = await t20f(img('out_2000x1125.jpg'), img('out_2000x1125.webp'));
  ok(F.json.sf.files_ok && F.json.sf.files.every(f => f.px === '2000x1125' && /^[0-9a-f]{64}$/.test(f.sha256)) && F.binary.jpg && F.binary.webp && /2000 x 1125/.test(F.json.sf.method) && /No AI/.test(F.json.sf.method), '20f: jpg and webp at exactly 2000 x 1125 → ready to upload');
  F = await t20f(img('out_1125x1406.jpg'), img('out_2000x1125.webp'));
  ok(!F.json.sf.files_ok && /1125x1406, not 2000 x 1125/.test(F.json.sf.problem) && !F.binary, '20f: a file of another size → nothing uploaded');
  F = await t20f(img('out_2000x1125.jpg'), null);
  ok(!F.json.sf.files_ok && /webp file was not made/.test(F.json.sf.problem), '20f: webp missing → nothing uploaded');
  F = await t20f(img('out_2000x1125.webp'), img('out_2000x1125.webp'));
  ok(!F.json.sf.files_ok && /jpg file is image\/webp/.test(F.json.sf.problem), '20f: wrong format in the jpg slot → nothing uploaded');
  const P45 = img('scene_1638x2048.png');
  const T45 = await t20a(withPlan(P45, 'portrait, 4:5, taller than wide'));
  const C45 = await t20c(T45, P45);
  const F45 = (await run('20f_Check_scene_files.js', { '20c Check scene master': [C45] }, [{ json: {}, binary: { jpg: ref(img('out_1125x1407.jpg')), webp: ref(img('out_1125x1407.webp')) } }]))[0];
  const F45b = (await run('20f_Check_scene_files.js', { '20c Check scene master': [C45] }, [{ json: {}, binary: { jpg: ref(img('out_1125x1406.jpg')), webp: ref(img('out_1125x1406.webp')) } }]))[0];
  ok(F45.json.sf.files_ok && !F45b.json.sf.files_ok, '20f: 4:5 master 1638 x 2048 → exactly 1125 x 1407 accepted; 1125 x 1406 refused (1 px off the image\'s own shape)');

  // 20h, 20k, 20m: upload, manifest and result.
  F = await t20f(img('out_2000x1125.jpg'), img('out_2000x1125.webp'));
  const t20h = async folder => run('20h_Scene_files_to_upload.js', { '20f Check scene files': [F], '20g Scene files folder': [{ json: folder }] });
  let H = await t20h({ id: 'drive-scene-folder' });
  ok(H.length === 2 && H[0].json.name.endsWith('.jpg') && H[1].json.name.endsWith('.webp') && H.every(x => x.binary.file && x.json.folder_id === 'drive-scene-folder'), '20h: one upload item per file, jpg then webp');
  const Hbad = await t20h({ error: { message: 'Drive down' } });
  ok(Hbad.length === 1 && Hbad[0].json.skip && Hbad[0].json.ticket_at === T169.sf.at && /Drive down/.test(Hbad[0].json.problem), '20h: folder not made → nothing uploaded; the stop names its ticket');
  const ups = F.json.sf.files.map((f, i) => ({ json: { id: 'drive-file-' + i, webViewLink: 'https://drive.example/f' + i, sha256Checksum: f.sha256 } }));
  const nodes20 = { '20a Scene files ticket': [{ json: T169 }], '20f Check scene files': [F], '20h Scene files to upload': H };
  let K = (await run('20k_Scene_manifest.js', nodes20, ups))[0];
  const man = K.binary ? JSON.parse(K.binary.file._buf.toString('utf8')) : null;
  ok(K.json.sf.images_ok && man && man.scene.label === 'Generated image' && man.files.length === 2 && man.files.every(f => f.drive_file_id && f.label === 'Generated image' && f.drive_sha256_matches === true), '20k: both files stored; manifest lists them as "Generated image"');
  ok(man && man.midas_pieces[0].sku === '159304' && man.midas_pieces[0].page.indexOf('https://midasfurniture.com/') === 0 && man.midas_pieces_left_out[0].sku === '173762' && man.master.stays_in_vault === true && /approval and automated review are separate/.test(man.approval.note_on_review) && man.approval.by === 'owner', '20k: manifest lists the Midas pieces with SKU and page, the piece left out, the kept master and the owner\'s approval');
  const Kbad = (await run('20k_Scene_manifest.js', nodes20, [ups[0], { json: { error: { message: 'quota' } } }]))[0];
  ok(!Kbad.json.sf.images_ok && /webp file was not saved/.test(Kbad.json.sf.problem) && !Kbad.binary, '20k: one file not stored → incomplete, no manifest');

  // Phase 1 review test gap (16 Oct 2026), run rather than word-matched: a scene approved by eye (approve_unreviewed) gets its files,
  // and its manifest says "approved by owner without an automated review", never a passed review.
  const eyeSt = approvedState(M169); eyeSt.go2_last.decision = 'approve_unreviewed';
  Object.assign(eyeSt.scenes.done.lifestyle_1, { review_result: 'not reviewed', without_review: true, approval_kind: 'approved by owner without an automated review' });
  const Teye = await t20a(eyeSt);
  ok(Teye.sf.ok === true, '20a (run): an approval by eye (approve_unreviewed) is accepted for the scene files');
  const Feye = clone(F); Feye.json.sf.approval = Teye.sf.approval; Feye.binary = F.binary;
  const Keye = (await run('20k_Scene_manifest.js', Object.assign({}, nodes20, { '20a Scene files ticket': [{ json: Teye }], '20f Check scene files': [Feye] }), ups))[0];
  const manEye = Keye.binary ? JSON.parse(Keye.binary.file._buf.toString('utf8')) : null;
  ok(manEye && /Approved by owner without an automated review/.test(JSON.stringify(manEye.approval)) && !/reviewed candidate/.test(JSON.stringify(manEye.approval)), '20k (run): the manifest names the approval by eye, not a reviewed candidate', manEye && JSON.stringify(manEye.approval));
  ok(manEye && manEye.approval.shown_as === 'Approved by the studio · not reviewed' && manEye.approval.client_shown_as === 'Approved by the studio' && !/not reviewed/.test(manEye.approval.client_shown_as), '20k (21:28): a scene approved by eye: manifest "Approved by the studio · not reviewed", client "Approved by the studio"', manEye && JSON.stringify(manEye.approval));
  ok(man && man.approval.shown_as === 'Approved' && man.approval.client_shown_as === 'Approved', '20k (21:28): a reviewed scene approval is shown as "Approved"');
  bad = approvedState(M169); bad.go2_last.decision = 'review_again';
  ok(!(await t20a(bad)).sf.ok, '20a (run): review_again is not an approval → no files');

  const res = async (inp, extra) => (await run('20m_Scene_files_result.js', Object.assign({ '20a Scene files ticket': [{ json: T169 }], '20f Check scene files': [F], '20k Scene manifest': [K] }, extra || {}), [inp]))[0].json;
  let R = await res({ json: { id: 'drive-manifest', webViewLink: 'https://drive.example/m' } });
  const fr = R.scenes.done.lifestyle_1.files;
  ok(R.status === 'scene_files_ready' && fr.status === 'ready' && fr.files.length === 2 && fr.manifest_drive_file_id === 'drive-manifest' && fr.target.w === 2000 && /2000 x 1125 jpg and webp/.test(R.next) && /Generated image/.test(R.next), '20m: images and manifest saved → scene_files_ready, recorded on the approved scene');
  ok(R.vault_only.indexOf('scene_files') !== -1 && R.scene_files.output_id === 'lifestyle_1' && R.trail[R.trail.length - 1].step === 20 && R.scenes.done.lifestyle_1.by === 'owner', '20m: vault event and trail for step 20; the owner\'s approval is untouched');
  R = await res({ json: { error: { message: 'Drive down' } } });
  ok(R.status === 'scene_files_held' && R.scenes.done.lifestyle_1.files.status === 'held' && /manifest could not be saved/.test(R.scenes.done.lifestyle_1.files.problem), '20m: manifest not saved → this scene\'s files held; never "ready"');
  const Csmall = await t20c(await t20a(withPlan(img('scene_1100x1956.png'), 'portrait, 9:16, taller than wide')), img('scene_1100x1956.png'));
  const Tsmall = await t20a(withPlan(img('scene_1100x1956.png'), 'portrait, 9:16, taller than wide'));
  Csmall.json.sf.at = Tsmall.sf.at;
  R = (await run('20m_Scene_files_result.js', { '20a Scene files ticket': [{ json: Tsmall }] }, [Csmall]))[0].json;
  ok(R.status === 'scene_files_held' && R.status !== 'hold' && R.scenes.done.lifestyle_1.files.too_small === true && /held for the owner/.test(R.next) && /next scene starts/.test(R.next), '20m: master too small → its files held for the owner; the scene stays approved and the next scene goes on');
  const stale = clone(C169); stale.json.sf.at = '2026-10-15T00:00:00.000Z';
  R = (await run('20m_Scene_files_result.js', { '20a Scene files ticket': [{ json: T169 }] }, [stale]))[0].json;
  ok(R.status === 'scene_files_held' && /does not belong to this scene/.test(R.scenes.done.lifestyle_1.files.problem), '20m: a result from an earlier pass (another ticket) is not used');
  R = (await run('20m_Scene_files_result.js', { '20a Scene files ticket': [{ json: T169 }], '20f Check scene files': [F] }, [Hbad[0]]))[0].json;
  ok(R.status === 'scene_files_held' && /folder could not be made/.test(R.scenes.done.lifestyle_1.files.problem), '20m: folder not made → held with that reason');
  const lost = approvedState(M169); lost.scenes.done = {};
  const Tlost = await t20a(lost);
  R = (await run('20m_Scene_files_result.js', { '20a Scene files ticket': [{ json: Tlost }] }, [{ json: Tlost }]))[0].json;
  ok(R.status === 'hold' && R.hold_for === 'owner' && R.hold_step === 20, '20m: the approved scene is not on record → the run holds for the owner');

  // 19a at the end of the queue, with one scene ready and one held.
  const end = clone(R); end.status = 'scene_files_ready'; end.hold_step = 0;
  end.scenes = { queue: ['lifestyle_1', 'wide'], log: [], done: { lifestyle_1: { by: 'owner', files: { status: 'ready', files: [{ format: 'jpg', px: '2000x1125', link: 'https://drive.example/a' }] } }, wide: { by: 'owner', files: { status: 'held', problem: 'the approved scene is 1100 x 1956 px; its short side is under 1125 px' } } } };
  end.approved = { by: 'owner', candidate: { sha256: 'a'.repeat(64) } }; end.go1_last = { decision: 'go', by: 'owner' }; end.contract = end.contract || {}; end.contract_stamp = end.contract_stamp || 'x';
  let E = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: end }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(E.status === 'hold' && E.hold_step === 20 && /delivery files of 1 scene/.test(E.hold_reason) && /wide \(/.test(E.hold_reason) && !/lifestyle_1 \(/.test(E.hold_reason) && /incomplete/.test(E.hold_reason) && !E.scene_files, '19a: end of queue with one scene\'s files held → run held for the owner; package called incomplete');
  end.scenes.done.wide.files = { status: 'ready', files: [{ format: 'jpg', px: '1125x2000', link: 'https://drive.example/b' }] };
  E = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: end }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(E.status === 'hold' && E.package_release.complete === false, '19a: ready flags without checksums, all formats and bound approvals do not complete the package');

  // V1: the scene files event is step 20.
  const ready = await res({ json: { id: 'drive-manifest' } });
  const v1 = (await run('V1_Vault_events.js', {}, [{ json: ready }], { resumeUrl: '' }))[0].json;
  ok(v1.events.some(e => e.kind === 'scene_files' && e.stage === '07' && e.step === 20) && v1.events.some(e => e.kind === 'status' && e.step === 20), 'V1: scene files event and status at step 20');

  // ================= Part 3 · The workflow export (routing and Edit Image settings) =================
  const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n', 'claude-midas-a7', 'workflow-1cgZc9rmBOrPdKIe.json'), 'utf8'));
  const N = Object.fromEntries(W.nodes.map(n => [n.name, n]));
  const outsOf = (n, i) => ((W.connections[n] && W.connections[n].main && W.connections[n].main[i || 0]) || []).map(c => c.node);
  const cond = n => N[n] ? N[n].parameters.conditions.conditions[0].leftValue : '';
  ok(outsOf('Package due?', 1).join() === 'Scene files due?' && /status === 'scene_approved'/.test(cond('Scene files due?')) && outsOf('Scene files due?', 0).join() === '20a Scene files ticket' && outsOf('Scene files due?', 1).join() === 'Scene due?', 'export: after go 2 approves a scene, its files are made before the next scene');
  ok(/'scene_files_ready', 'scene_files_held'/.test(cond('Scene due?')) && !/scene_approved/.test(cond('Scene due?')), 'export: the next scene starts after the files step (ready or held)');
  const jp = N['20d Make scene jpg'], wp = N['20e Make scene webp'];
  const rs = n => n && n.parameters.operations.operations[0];
  ok(jp && wp && rs(jp).operation === 'resize' && rs(jp).width === '={{ $json.sf.target.w }}' && rs(jp).height === '={{ $json.sf.target.h }}' && rs(wp).width === '={{ $json.sf.target.w }}' && rs(wp).height === '={{ $json.sf.target.h }}' && jp.parameters.options.format === 'jpeg' && wp.parameters.options.format === 'webp' && jp.parameters.options.destinationKey === 'jpg' && wp.parameters.options.destinationKey === 'webp', 'export: Edit Image resizes to the size worked out in 20c, jpg and webp');
  const chain = [['20a Scene files ticket', 'Scene ticket ok?'], ['20b Download scene', '20c Check scene master'], ['20c Check scene master', 'Scene master usable?'], ['20d Make scene jpg', '20e Make scene webp'], ['20e Make scene webp', '20f Check scene files'], ['20f Check scene files', 'Scene files ready?'], ['20g Scene files folder', '20h Scene files to upload'], ['20h Scene files to upload', 'Scene upload due?'], ['20i Upload scene files', '20k Scene manifest'], ['20k Scene manifest', 'Scene images stored?'], ['20l Upload scene manifest', '20m Scene files result'], ['20m Scene files result', 'V1 Vault events']];
  ok(chain.every(([a, b]) => outsOf(a).indexOf(b) !== -1), 'export: step 20 nodes are wired in order, ending at V1 Vault events');
  ok(['Scene ticket ok?', 'Scene master usable?', 'Scene files ready?', 'Scene upload due?', 'Scene images stored?'].every(n => outsOf(n, 1).join() === '20m Scene files result'), 'export: every stop of step 20 goes to the result node, never on to the next step');
  ok(['20b Download scene', '20g Scene files folder', '20i Upload scene files', '20l Upload scene manifest'].every(n => N[n] && N[n].credentials && N[n].credentials.googleDriveOAuth2Api && N[n].credentials.googleDriveOAuth2Api.name === 'Claude · Midas Drive' && N[n].onError === 'continueRegularOutput' && N[n].alwaysOutputData === true), 'export: the Drive nodes use "Claude · Midas Drive" and pass failures on to be checked');
  // Found 16 Oct 2026: n8n's addNode dropped these settings; set again with setNodeSettings.
  ok(['Scene files due?', '20b Download scene', '20g Scene files folder', '20l Upload scene manifest'].every(n => N[n] && N[n].executeOnce === true) && !N['20i Upload scene files'].executeOnce && ['20d Make scene jpg', '20e Make scene webp'].every(n => N[n].onError === 'continueRegularOutput'), 'export: one download, one folder and one manifest upload per scene; two file uploads; a failed resize is passed on to 20f');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR ' + (e && e.stack || e)); process.exit(1); });
