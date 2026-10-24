// Local tests for the owner's answers of 16 Oct 2026, 19:26 Amman (Phase 1 questions 1-4 and D13). Runs the n8n Code-node source with
// mocked node outputs, code-made pictures and the stage 06 image fixtures. No network, no AI call, no paid call.
// Run: node tests/claude-midas-a7-phase-1b/run_tests_phase1b.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const PROMPTS = path.join(ROOT, 'n8n', 'claude-midas-a7', 'model-prompts');
const FIX = path.join(ROOT, 'tests', 'claude-midas-a7-stage-06', 'fixtures');
const clone = x => JSON.parse(JSON.stringify(x));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const img = n => fs.readFileSync(path.join(FIX, n));
const ref = buf => ({ _buf: buf, mimeType: 'application/octet-stream' });
let pass = 0, failN = 0;
function ok(cond, name, extra) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name + (extra !== undefined ? ' | ' + extra : '')); } }
async function run(file, nodes, input) {
  const $ = n => { if (!(n in nodes) || nodes[n] === undefined) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = input || [];
  const $input = { first: () => items[0], all: () => items };
  const helpers = {
    getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b._buf) throw new Error('no binary ' + prop); return b._buf; },
    prepareBinaryData: async (buf, fileName, mimeType) => ({ _buf: buf, fileName, mimeType })
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFn('$', '$input', '$execution', 'require', fs.readFileSync(path.join(NODES, file), 'utf8')).call({ helpers }, $, $input, { resumeUrl: 'https://n8n.example/webhook-waiting/999' }, require);
}
// A 24-bit BMP from a pixel function.
function bmp(w, h, f) { const st = Math.floor((24 * w + 31) / 32) * 4, b = Buffer.alloc(54 + st * h); b.write('BM', 0, 'latin1'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, bl] = f(x, y), p = 54 + (h - 1 - y) * st + x * 3; b[p] = bl; b[p + 1] = g; b[p + 2] = r; } return b; }
function readBmp(b) { const off = b.readUInt32LE(10), w = b.readInt32LE(18), rawH = b.readInt32LE(22), h = Math.abs(rawH), st = Math.floor((24 * w + 31) / 32) * 4; return (x, y) => { const p = off + (rawH > 0 ? h - 1 - y : y) * st + x * 3; return [b[p + 2], b[p + 1], b[p]]; }; }
const S = 1125;
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
delete base.events; delete base.row;
const MASTER = img('master_2048.png'), JPG = img('out_1125.jpg'), WEBP = img('out_1125.webp');
const LABEL = 'Approved by the studio · not reviewed';

(async () => {
  const SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;

  // ================= Question 1: a white master approved by eye, with no product box =================
  // G2: approve_unreviewed on a white master whose review has no product box (the blind count did not answer).
  const w = clone(base);
  Object.assign(w, { status: 'awaiting_go_2', stage: '05 Review & go 2', go2_round: 2, go2_token: 'tok-1', go2_allowed: ['approve_unreviewed', 'stop'],
    go2: { kind: 'white', output_id: 'white_master', candidate: Object.assign({}, base.stage04.candidate, { drive_file_id: 'drive-master-1', sha256: sha(MASTER), px: '2048x2048', bytes: MASTER.length, link: 'https://drive.example/master' }) },
    review: { result: 'not reviewed', product_box_2d: undefined } });
  let g = (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: w }] }, [{ json: { body: { decision: 'approve_unreviewed', go2_token: 'tok-1', run_id: w.run_id, round: 2 } } }]))[0].json;
  ok(g.status === 'white_master_approved' && g.approved.without_review === true && g.approved.shown_as === LABEL && g.approved.product_box_2d === null && g.approved.approval_kind === 'approved by owner without an automated review', 'Q1 G2: approved by eye → shown as "' + LABEL + '", the audit wording kept, no product box', JSON.stringify(g.approved));
  ok(g.next.indexOf(LABEL) !== -1 && /master's own background is delivered/.test(g.next), 'Q1 G2: the owner\'s view names the label and says what happens without a box');
  ok(g.approved.client_shown_as === 'Approved by the studio', 'Q1 (21:28) G2: the client sees "Approved by the studio" for a master approved by eye');
  // 18a carries the label; 18e checks the master; 18e3 skips the clean-up.
  const a = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: g }], '04 Settings': [{ json: { package: { size_px: 1125, jpg_quality: 95 } } }] }))[0].json;
  ok(a.pk.ok === true && a.pk.product_box_2d === null && a.pk.approval.shown_as === LABEL && a.pk.approval.without_review === true, 'Q1 18a: the package ticket is made, with the label and no box');
  const e = (await run('18e_Check_master.js', { '18a Package ticket': [{ json: a }], '18b Load identity': [{ json: {} }], '18c Load operations': [{ json: {} }] }, [{ json: {}, binary: { data: ref(MASTER) } }]))[0];
  ok(e.json.pk.ok === true && e.binary && e.binary.data, 'Q1 18e: the approved master is checked as usual', e.json.pk.problem);
  // The master's own background, as 18e2 would hand it on: 252 everywhere outside a grey product, so not 255.
  const OWN = bmp(S, S, (x, y) => (x > 300 && x < 800 && y > 400 && y < 700 ? [120, 110, 100] : [252, 252, 251]));
  const e3 = (await run('18e3_Clean_background.js', { '18e Check master': [{ json: e.json }] }, [{ json: e.json, binary: { data: e.binary.data, pix: ref(OWN) } }]))[0];
  const wc = e3.json.pk.white_clean;
  ok(e3.json.pk.ok === true && wc.skipped === true && wc.cleaned === false && e3.binary.clean._buf === OWN, 'Q1 18e3: no box → the clean-up is skipped and the master\'s own pixels go on unchanged (byte for byte)');
  const steps = e3.json.pk.skipped_steps.map(x => x.step).join(' | ');
  ok(e3.json.pk.skipped_steps.length === 2 && /background set to 255/.test(steps) && /framing band/.test(steps) && e3.json.pk.skipped_steps.every(x => x.why), 'Q1 18e3: each skipped step is noted with its reason: ' + steps);
  // 18h on the skipped path: the saved files' edges read 252; measured and reported, not held.
  const own252 = ref(OWN);
  const h = (await run('18h_Check_files.js', { '18e3 Clean background': [{ json: e3.json }] }, [{ json: e3.json, binary: { clean: e3.binary.clean, jpg: ref(JPG), webp: ref(WEBP), jpgpix: own252, webppix: own252 } }]))[0];
  const hp = h.json.pk;
  ok(hp.files_ok === true && h.binary.jpg._buf === JPG && h.binary.webp._buf === WEBP, 'Q1 18h: without the clean-up the files are delivered (the 255 rule is not applied)', hp.problem);
  ok(hp.files.every(f => f.background_check && f.background_check.edge_255_pct === 0 && f.background_check.darkest_edge_value === 251 && /not applied/.test(f.background_check.rule) && !f.halo_check), 'Q1 18h: each file\'s edges measured (0% at 255, darkest 251: the darkest channel of 252,252,251) and marked "rule not applied"; no halo check');
  ok(/background not set to 255/.test(hp.background_note) && /master's own background is delivered/.test(hp.background_note) && /darkest 251/.test(hp.background_note) && /was NOT cleaned/.test(hp.method), 'Q1 18h: the background note and method say it was not cleaned, with the measured edges: ' + hp.background_note);
  // 18l manifest and 18p owner view.
  const up = [{ json: { id: 'drive-jpg', webViewLink: 'https://drive.example/jpg', sha256Checksum: sha(JPG) } }, { json: { id: 'drive-webp', webViewLink: 'https://drive.example/webp' } }];
  const j = await run('18j_Files_to_upload.js', { '18h Check files': [h], '18i Package folder': [{ json: { id: 'drive-pkg-folder', name: 'x' } }] });
  const l = (await run('18l_Manifest.js', { '18a Package ticket': [{ json: a }], '18h Check files': [h], '18j Files to upload': j }, up))[0];
  const man = JSON.parse(l.binary.file._buf.toString('utf8'));
  ok(man.approval.shown_as === LABEL && man.approval.decision === 'approve_unreviewed' && man.approval.approval_kind === 'approved by owner without an automated review', 'Q1 18l: the manifest shows "' + LABEL + '" and keeps the audit wording');
  ok(man.approval.client_shown_as === 'Approved by the studio' && a.pk.approval.client_shown_as === 'Approved by the studio', 'Q1 (21:28) 18a/18l: the manifest carries the client label "Approved by the studio" (never "not reviewed")');
  ok(man.background.cleaned === false && /background not set to 255/.test(man.background.note) && man.skipped_steps.length === 2 && man.background.master_unchanged === true, 'Q1 18l: the manifest says the background was not cleaned and lists the skipped steps');
  const n18 = (await run('18n_Identity_entry.js', { '18a Package ticket': [{ json: a }], '18l Manifest': [l] }, [{ json: { id: 'drive-manifest', webViewLink: 'https://drive.example/m' } }]))[0].json;
  const p = (await run('18p_Package_result.js', { '18a Package ticket': [{ json: a }], '18e Check master': [{ json: e.json }], '18e3 Clean background': [{ json: e3.json }], '18h Check files': [h], '18j Files to upload': j, '18l Manifest': [l], '18n Identity entry': [{ json: n18 }], '18o Save identity': [{ json: {} }] }, [{ json: Object.assign({ id: 41 }, n18.row) }]))[0].json;
  ok(p.status === 'white_package_ready' && p.next.indexOf('"' + LABEL + '"') !== -1 && /The background was not set to 255/.test(p.next) && /Skipped: background set to 255/.test(p.next) && /framing band/.test(p.next), 'Q1 18p: packaged; the owner\'s view says "' + LABEL + '", that the background was not set to 255, and each skipped step', p.status + ' | ' + p.next);
  ok(p.package.approval_shown_as === LABEL && p.package.skipped_steps.length === 2 && !/complete/i.test(p.next), 'Q1 18p: the package record carries the label and the skipped steps; never called complete');
  // A normal approval with a box is not changed by this: the client sees "Approved" and the clean-up runs (18e3 tests below).
  // Changed 17 Oct 2026 (commit 63cf543, release tests): a review counts only when bound to this candidate (sha256, output, attempt),
  // and the owner's label names the review result ("Owner approved · review passed"); the client label stays "Approved".
  const gN = clone(w); gN.go2_allowed = ['approve', 'repair', 'stop'];
  gN.review = { result: 'passed', product_box_2d: [300, 100, 700, 900], output_id: 'white_master', attempt: 2, candidate: { sha256: w.go2.candidate.sha256 } };
  g = (await run('G2_Go_2_verdict.js', { 'V1 Vault events': [{ json: gN }] }, [{ json: { body: { decision: 'approve', go2_token: 'tok-1', run_id: w.run_id, round: 2 } } }]))[0].json;
  ok(g.approved.shown_as === 'Owner approved · review passed' && g.approved.client_shown_as === 'Approved' && g.approved.release.review_bound === true && g.approved.without_review === false && JSON.stringify(g.approved.product_box_2d) === '[300,100,700,900]', 'Q1 a reviewed approval bound to its candidate is shown as "Owner approved · review passed" (client: "Approved") and keeps its box');

  // ================= Question 2: small-product camera heights =================
  const pkgd = clone(base);
  Object.assign(pkgd, { status: 'white_package_ready', stage: '06 Package', go1_last: { decision: 'go', by: 'owner' }, retrieval: { shortlist: [], rejected: [], notes: [] },
    approved: { output_id: 'white_master', attempt: 1, by: 'owner', candidate: { sha256: 'a'.repeat(64), drive_file_id: 'drive-master', file_name: 'x.png' } },
    outputs: [{ id: 'white_master', kind: 'white' }, { id: 'hero', kind: 'hero', camera: 'Reference view', light: 'day', light_label: 'Daylight', from: '' }] });
  const cam = async (profile, presentation, dims) => {
    const s0 = clone(pkgd); s0.profile = profile; s0.brief = Object.assign({}, s0.brief, { product_type: profile.name, dimensions: dims || '' });
    s0.shots = [{ n: 1, output_id: 'white_master', kind: 'white', frame: 'square, 1:1', plan: {} }, { n: 2, output_id: 'hero', kind: 'hero', frame: 'square, 1:1', plan: { presentation: presentation || '', setting: 'A calm living room.', room: {}, midas_pieces: [], supporting_props: [] } }];
    const t = (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: s0 }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
    return t;
  };
  let t = await cam({ id: 'vase', name: 'Vases & pots' }, 'The vase stands on the low walnut coffee table in front of the sofa.');
  // Updated for the owner's rule of 21:28 (surface height + half the product's height; replaces 55-60 cm and 75 cm).
  ok(t.scene.presets.camera.surface === 'low table' && /low coffee table top \(about 40 cm/.test(t.scene.presets.camera.room_rule) && /not confirmed/.test(t.scene.presets.camera.room_rule) && t.scene.presets.camera.surface_from === 'the plan\'s words for this shot', 'Q2 (21:28) a vase on a low coffee table, no height supplied → the low table top (about 40 cm) plus half its height, not confirmed', JSON.stringify(t.scene.presets.camera));
  const c13 = (await run('13_Compile.js', { 'V1 Vault events': [{ json: Object.assign(clone(t), { status: 'scene_due' }) }] }, [{ json: Object.assign({}, SETTINGS, { image_size: '2K' }) }]))[0].json.s04;
  const roomPrompt = c13.dispatch ? c13.dispatch.prompt : '';
  ok(/Camera: level \(0 degrees tilt\), at the height of the low coffee table top \(about 40 cm/.test(roomPrompt) && !/120 cm/.test(roomPrompt) && !/55-60/.test(roomPrompt) && !/image 1/i.test(roomPrompt), 'Q2 (21:28) 13 Compile: the empty room\'s camera line gives the low table top plus half the height, never 120 cm, never image 1', (c13.critical || []).map(x => x.why).join(' ') || roomPrompt.slice(0, 200));
  t = await cam({ id: 'table-lamp', name: 'Table lamps' }, 'The lamp on the console behind the sofa.');
  ok(t.scene.presets.camera.surface === 'table or console' && /table or console top \(about 75 cm/.test(t.scene.presets.camera.room_rule), 'Q2 (21:28) a table lamp on the console → the console top (about 75 cm) plus half its height');
  t = await cam({ id: 'table-lamp', name: 'Table lamps' }, 'The lamp on top of the round marble coffee table.');
  ok(t.scene.presets.camera.surface === 'low table', 'Q2 "on top of the round marble coffee table" is read as a low table');
  t = await cam({ id: 'candle', name: 'Candles' }, 'A warm evening scene.');
  ok(t.scene.presets.camera.surface === 'table or console' && /about 75 cm/.test(t.scene.presets.camera.room_rule) && t.scene.presets.camera.surface_from === 'the handling profile', 'Q2 (21:28) a tabletop profile with no surface words → the table top (about 75 cm) plus half its height, from the profile');
  t = await cam({ id: 'floor-lamp', name: 'Floor lamps' }, 'The floor lamp stands beside the armchair.', 'W40 x D40 x H160 cm');
  ok(t.scene.presets.camera.surface === 'floor or wall' && /near the mid-height of the product/.test(t.scene.presets.camera.room_rule) && /about 80 cm: half its supplied height of 160 cm/.test(t.scene.presets.camera.room_rule) && t.scene.presets.camera.supplied_height_cm === 160, 'Q2 a floor lamp with a supplied height of 160 cm → near its mid-height, about 80 cm', t.scene.presets.camera.room_rule);
  t = await cam({ id: 'floor-lamp', name: 'Floor lamps' }, 'The floor lamp stands beside the armchair.');
  ok(/near the mid-height of the product/.test(t.scene.presets.camera.room_rule) && !/\d/.test(t.scene.presets.camera.room_rule), 'Q2 a floor lamp without a supplied size → near its mid-height, no guessed number');
  t = await cam({ id: 'floor-lamp', name: 'Floor lamps' }, '', 'Height about 1.6 m');
  ok(!/\d/.test(t.scene.presets.camera.room_rule), 'Q2 a size without an "H" value is not read as a height (nothing guessed)');
  ok(/level \(0 degrees tilt\), near the product's mid-height, seen from the same side as image 1/.test(t.scene.presets.camera.height_rule), 'Q2 (21:28) the placement rule: level, near the product\'s mid-height, from the vendor photo\'s side');
  // ---- Owner, 16 Oct 2026, 21:28 (item 5): camera height = surface height + half the product's height; tilt 0 ----
  t = await cam({ id: 'table-lamp', name: 'Table lamps' }, 'The lamp on the console behind the sofa.', 'W 30 x D 30 x H 63 cm');
  let k = t.scene.presets.camera;
  ok(k.camera_cm === 106 && k.surface_cm === 75 && k.tilt_deg === 0 && /level \(0 degrees tilt\), at about 106 cm: the table or console top at about 75 cm \(typical, not measured\) plus half the product's height of 63 cm/.test(k.room_rule) && /at about 106 cm/.test(k.height_rule), '21:28 the owner\'s example: a 63 cm lamp on a 75 cm console → about 106 cm, level', JSON.stringify(k));
  t = await cam({ id: 'serveware', name: 'Serveware' }, 'The bowl stands on the low walnut coffee table.', 'Ø 30 x H 20 cm');
  k = t.scene.presets.camera;
  ok(k.surface === 'low table' && k.surface_cm === 40 && k.camera_cm === 50 && /about 50 cm: the low coffee table top at about 40 cm/.test(k.room_rule), '21:28 the owner\'s example: a 20 cm bowl on a 40 cm coffee table → 50 cm', JSON.stringify(k));
  const withTable = async (pieces, dims) => { const s0 = clone(pkgd); s0.profile = { id: 'vase', name: 'Vases' }; s0.brief = Object.assign({}, s0.brief, { product_type: 'Vase', dimensions: dims });
    s0.retrieval = { shortlist: pieces.map(p => Object.assign({ name: p.kind.toUpperCase(), url: 'https://midasfurniture.com/x', catalogue_photo: 'https://midasfurniture.com/media/x.jpg', availability: 'in_stock', retrieved_on: '2026-10-16', finish: 'not confirmed' }, p)), rejected: [], notes: [] };
    s0.shots = [{ n: 1, output_id: 'white_master', kind: 'white', frame: 'square, 1:1', plan: {} }, { n: 2, output_id: 'hero', kind: 'hero', frame: 'square, 1:1', plan: { presentation: 'The vase on the coffee table.', setting: 'A living room.', room: {}, midas_pieces: pieces.map(p => ({ sku: p.sku, purpose: 'surface' })), supporting_props: [] } }];
    return (await run('19a_Scene_ticket.js', { 'V1 Vault events': [{ json: s0 }], '04 Settings': [{ json: SETTINGS }] }))[0].json.scene.presets.camera; };
  k = await withTable([{ sku: '901', kind: 'coffee table', dimensions: 'W 120 x D 60 x H 45 cm' }], 'H 30 cm');
  ok(k.surface_cm === 45 && k.camera_cm === 60 && /Midas SKU 901, its catalogue height/.test(k.surface_height_from), '21:28 a planned Midas coffee table with "H 45 cm" sets the surface: 45 + 30/2 = 60 cm', JSON.stringify(k));
  k = await withTable([{ sku: '902', kind: 'coffee table', dimensions: '120 × 60 × 45 cm' }], 'H 30 cm');
  ok(k.surface_cm === 40 && /not measured/.test(k.surface_height_from) && /typical, not measured/.test(k.room_rule), '21:28 an unlabelled catalogue size is not read as a height: the typical 40 cm is used and marked not measured');
  k = await withTable([{ sku: '903', kind: 'coffee table', dimensions: 'H 45 cm' }, { sku: '904', kind: 'centre table', dimensions: 'H 38 cm' }], 'H 30 cm');
  ok(k.surface_cm === 40, '21:28 two possible tables: no guess between them, the typical value is used');
  t = await cam({ id: 'vase', name: 'Vases' }, 'The vase on the console.');
  k = t.scene.presets.camera;
  ok(k.camera_cm === null && k.product_height === 'not confirmed' && /plus half the product's height, which is not confirmed/.test(k.room_rule) && !/\d+ cm:/.test(k.room_rule), '21:28 without the product\'s height: "not confirmed", no camera number');
  ok(!/55-60/.test(JSON.stringify(SETTINGS.scenes.camera.small)) && !SETTINGS.scenes.camera.small.room_rule_tabletop && !SETTINGS.scenes.camera.small.room_rule_low_table && SETTINGS.scenes.camera.small.profile_ids.indexOf('plant-large') !== -1, '21:28 settings: the 75 cm and 55-60 cm rules are gone; plant-large is a small (floor) product');
  const allSmall = JSON.stringify(SETTINGS.scenes.camera.small);
  ok(!/120/.test(allSmall), 'Q2 no 120 cm anywhere in the small-product settings');
  t = await cam({ id: 'sofa', name: 'Sofas' }, 'The sofa on the rug.');
  ok(!t.scene.presets.camera.height_rule && t.scene.presets.camera.height_cm, 'Q2 room-scale furniture keeps its room preset (unchanged)');

  // ================= Question 3: the fade, measured =================
  const noise = (x, y) => ((x * 7 + y * 13) % 3);
  const scene = (x, y) => {
    if (x > 300 && x < 825 && y > 350 && y < 760) { if (x < 306 || x > 819 || y < 356) return [238, 236, 228]; return [110, 120, 80]; }
    if (x > 280 && x < 845 && y >= 760 && y < 800) { const v = Math.round(170 + (y - 760) / 40 * 78); return [v, v, v]; }
    const v = 250 + noise(x, y); return [v, v, v - 1];
  };
  const PIX = bmp(S, S, scene);
  const toBox = (x0, y0, x1, y1) => [Math.round(y0 / S * 1000), Math.round(x0 / S * 1000), Math.round(y1 / S * 1000), Math.round(x1 / S * 1000)];
  const pkx = { cfg: { size_px: S, jpg_quality: 95 }, base: 'claude-test', ok: true, product_box_2d: toBox(300, 350, 825, 760) };
  const c = (await run('18e3_Clean_background.js', { '18e Check master': [{ json: { pk: pkx } }] }, [{ json: { pk: pkx }, binary: { pix: ref(PIX) } }]))[0];
  const wc3 = c.json.pk.white_clean;
  ok(wc3.done === true && wc3.cleaned === true && wc3.fade_margin_px === 68 && wc3.fade_reach_px <= 68 && wc3.partly_changed_beyond_margin === 0 && wc3.background_beyond_margin_not_255 === 0 && wc3.product_box_pixels_changed === 0, 'Q3 18e3 measures the three conditions: fade within ' + wc3.fade_margin_px + ' px, background beyond it 255, nothing inside the box changed', JSON.stringify(wc3));
  // Independently of the node: every background pixel farther than the margin from the widened box is exactly 255.
  const [bx0, by0, bx1, by1] = wc3.product_box_px, A = readBmp(PIX), B = readBmp(c.binary.clean._buf);
  let beyond = 0, beyondBad = 0, inBoxChanged = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x < bx0 ? bx0 - x : (x > bx1 ? x - bx1 : 0), dy = y < by0 ? by0 - y : (y > by1 ? y - by1 : 0), d = Math.sqrt(dx * dx + dy * dy);
    const shadow = x > 280 && x < 845 && y >= 760 && y < 800;
    if (!dx && !dy) { if (A(x, y).join() !== B(x, y).join()) inBoxChanged++; continue; }
    if (d > wc3.fade_margin_px && !shadow) { beyond++; if (B(x, y).join() !== '255,255,255') beyondBad++; }
  }
  ok(beyond > 500000 && beyondBad === 0 && inBoxChanged === 0, 'Q3 (measured by the test): ' + beyond + ' background pixels beyond the margin, ' + beyondBad + ' not 255; ' + inBoxChanged + ' changed inside the box');

  // ================= Questions 3 and 4: the saved files (18h): grey halo, 99.9% rule, jpg saved again at quality 100 =================
  const body = (x, y) => x > 300 && x < 800 && y > 400 && y < 700;
  const CLEAN = bmp(S, S, (x, y) => (body(x, y) ? [110, 110, 110] : [255, 255, 255]));
  const ringAt = (from, to, v) => bmp(S, S, (x, y) => { if (body(x, y)) return [110, 110, 110]; const dx = x <= 300 ? 301 - x : (x >= 800 ? x - 799 : 0), dy = y <= 400 ? 401 - y : (y >= 700 ? y - 699 : 0), d = Math.max(dx, dy); return x > 300 - to && x < 800 + to && y > 400 - to && y < 700 + to && d >= from && d <= to ? [v, v, v] : [255, 255, 255]; });
  const tk = { pk: Object.assign(clone(pkx), { white_clean: { done: true, cleaned: true, fade_margin_px: 68 }, files: [{ format: 'jpg', file_name: 'claude-test_white_1125_v1.jpg' }, { format: 'webp', file_name: 'claude-test_white_1125_v1.webp' }] }) };
  const h18 = async bins => (await run('18h_Check_files.js', { '18e3 Clean background': [{ json: tk }] }, [{ json: clone(tk), binary: Object.assign({ clean: ref(CLEAN), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(CLEAN), webppix: ref(CLEAN) }, bins) }]))[0];
  let r = await h18({});
  ok(r.json.pk.files_ok === true && r.json.pk.files.every(f => f.halo_check && f.halo_check.below_250 === 0 && f.halo_check.at_254_or_more_pct === 100) && r.json.pk.files[0].quality === 95 && !r.json.pk.files[0].saved_again, 'Q3 18h: clean saved files → no halo; the jpg is kept at quality 95');
  r = await h18({ webppix: ref(ringAt(3, 6, 240)) });
  ok(r.json.pk.ok === false && /webp file shows a grey halo/.test(r.json.pk.problem) && !r.binary, 'Q3 18h: a grey ring 3-6 px around the product (240) in the saved webp → hold, nothing uploaded', r.json.pk.problem);
  r = await h18({ webppix: ref(ringAt(1, 1, 220)) });
  ok(r.json.pk.files_ok === true, 'Q3 18h: compression blending in the one pixel next to the product is not a halo (measured on the Test 10 master)');
  // Question 4: the jpg fails only by compression at quality 95 → saved again at quality 100.
  const GREYROWS = bmp(S, S, (x, y) => (body(x, y) ? [110, 110, 110] : (y < 2 ? [253, 253, 253] : [255, 255, 255])));
  const JPG100 = Buffer.concat([JPG, Buffer.from([0])]); // the same picture with one more byte, so the test can tell the two files apart
  r = await h18({ jpgpix: ref(GREYROWS), jpg100: ref(JPG100), jpg100pix: ref(CLEAN) });
  const f0 = r.json.pk.files[0];
  ok(r.json.pk.files_ok === true && r.binary.jpg._buf === JPG100 && f0.quality === 100 && /saved again at quality 100/.test(f0.saved_again) && /at quality 95 compression broke the rule/.test(f0.saved_again) && f0.sha256 === sha(JPG100) && f0.tries.length === 2, 'Q4 18h: the jpg at 95 breaks the edge rule → the jpg at quality 100 passes and is delivered, with the reason noted');
  ok(/jpg quality 100/.test(r.json.pk.method), 'Q4 18h: the method names the quality actually delivered');
  r = await h18({ jpgpix: ref(GREYROWS), jpg100: ref(JPG100), jpg100pix: ref(GREYROWS) });
  ok(r.json.pk.ok === false && /edge rows read 255 on only/.test(r.json.pk.problem) && /also at quality 100/.test(r.json.pk.problem) && !r.binary, 'Q4 18h: both qualities break the rule → hold; the rule is never loosened');
  r = await h18({ jpg: ref(img('out_1124.jpg')), jpg100: ref(JPG100), jpg100pix: ref(CLEAN) });
  ok(r.json.pk.ok === false && /1124x1124, not 1125 x 1125/.test(r.json.pk.problem) && r.json.pk.files[0].tries.length === 1, 'Q4 18h: a wrong size is not a compression problem → no second try, hold');
  r = await h18({ jpgpix: ref(GREYROWS) });
  ok(r.json.pk.ok === false && /edge rows read 255 on only/.test(r.json.pk.problem), 'Q4 18h: no quality-100 jpg was made → hold with the first reason');

  // ================= D13: photo reader and second count prompts =================
  // Owner, 16 Oct 2026, 22:06: the D13 texts are pending (not in the A7 draft) until reader test 4 passes; they are checked where they now live.
  const p03 = fs.readFileSync(path.join(PROMPTS, 'pending', '03_Eye_photo_reader.D13-pending.txt'), 'utf8'), p05 = fs.readFileSync(path.join(PROMPTS, 'pending', '05_Second_count.D13-pending.txt'), 'utf8');
  const a03 = fs.readFileSync(path.join(PROMPTS, '03_Eye_photo_reader.txt'), 'utf8'), a05 = fs.readFileSync(path.join(PROMPTS, '05_Second_count.txt'), 'utf8');
  ok(/cropped: true when part of the product is cut off by the frame or hidden behind something\.$/.test(a03) && !/photographed apart/.test(a03) && !/"hidden"/.test(a05), '22:06: A7 keeps the reader prompts from before D13 (03 and 05 active files)');
  ok(/Pieces of one set may be photographed apart in one image/.test(p03) && /each physical piece counts once, and a relation says they belong together/.test(p03) && /same set as the sofa, photographed apart/.test(p03), 'D13 03: pieces photographed apart count once each, with a relation');
  ok(/counts once per module where a joint or gap between modules shows; the seat and back cushions of a sofa or chair are part of it, not separate pieces/.test(p03) && /counts once per module/.test(p05) && /seat and back cushions/.test(p05), 'D13 03 and 05: the module rule; seat cushions are not pieces');
  ok(/cropped: true only when part of the product is cut off by the edge of the photo/.test(p03) && /hidden: array of short strings, one for each product piece or part covered by another piece or object/.test(p03) && /"cut_off"/.test(p03) && /"hidden": true when another piece or object covers part of it/.test(p03), 'D13 03: cropped (the frame) and hidden (covered) reported apart, overall and per piece');
  ok(/"cropped" means part of the product is cut off by the edge of the photo; a part covered by another piece or object is "hidden", not cropped/.test(p05) && /"hidden": \[short strings\], "relations": \[short strings\]/.test(p05), 'D13 05: the second count reports hidden and relations apart from cropped');
  ok(!/or hidden behind something/.test(p03), 'D13 03: the old definition (cropped = cut off or hidden) is gone');
  // 04-06 Evidence on the new answers: hidden parts become unknowns; a hidden piece is not a crop; a cut-off piece at the edge is.
  const ingest = { run_id: 'claude-a7-t', client_run_id: 'claude-test-0001', brief: { version: 1, product_type: 'Dining set', category: '', sku: '', dimensions: '', colour: '', material: '', inventory: [{ item: 'table', count: 1 }, { item: 'chair', count: 6 }], inventory_total: 7, exclusions: [], instructions: '', product_notes: '', reference_roles: [] }, references: [{ key: 'photo', name: 'p.jpg', role: 'product', sha256: 'c'.repeat(64) }], written_files: [], critical: [], trail: [], text_prices: {}, text_calls: [], text_calls_new: [] };
  const pc = (k, box, extra) => Object.assign({ label: k, kind: k, box, seen_whole: true, role: 'product' }, extra || {});
  const eyeAns = (extra, pieces) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(Object.assign({ category: 'dining set', pieces: pieces || [pc('table', [359, 225, 652, 871])].concat([1, 2, 3, 4, 5, 6].map(i => pc('chair', [300, 100 + i * 100, 700, 180 + i * 100], i > 4 ? { hidden: true, seen_whole: false } : {}))), signs: [], printed_counts: [], colour_observed: 'oak', design_locks: [], sided_parts: [], relations: [], shown_with: [], unknowns: [], cropped: false, hidden: ['two chairs partly behind the table'] }, extra || {})) }] } }] });
  const second = (extra) => ({ content: [{ type: 'text', text: JSON.stringify(Object.assign({ pieces: [{ kind: 'table', count: 1 }, { kind: 'chair', count: 6 }], excluded: [], total: 7, unclear: [], cropped: false, hidden: ['chairs behind the table'], relations: [] }, extra || {})) }] });
  const ev = async (eye, sec) => (await run('04_06_Evidence.js', { '02 Ingest files': [{ json: clone(ingest) }], '03 Eye reads the product photo': [{ json: eye }], '05 Second count': [{ json: sec }] }))[0].json;
  let o = await ev(eyeAns(), second());
  ok(o.observation.cropped === false && o.observation.hidden.length === 2 && o.unknowns.some(u => /^hidden in the photo: two chairs partly behind the table/.test(u.what) && /not confirmed/.test(u.basis)), 'D13 04-06: hidden parts are recorded as unknowns ("not confirmed"), not as a crop', JSON.stringify(o.observation.hidden));
  o = await ev(eyeAns({ hidden: [] }, [pc('table', [359, 225, 652, 871]), pc('chair', [300, 0, 700, 80], { cut_off: true, seen_whole: false })]), second({ hidden: [] }));
  ok(o.observation.cropped === true, 'D13 04-06: a product piece the reader marks cut_off, with its box at the frame edge → cropped');
  o = await ev(eyeAns({ hidden: [] }, [pc('table', [359, 225, 652, 871]), pc('chair', [300, 300, 700, 380], { cut_off: true })]), second({ hidden: [] }));
  ok(o.observation.cropped === false && /treated as not cropped/.test(o.observation.crop_note), 'D13 04-06: a cut_off flag whose box is inside the frame stays a note (the box decides, as before)');
  o = await ev(eyeAns({ relations: ['ottoman: same set as the sofa, photographed apart'] }), second({ relations: ['ottoman belongs with the sofa'] }));
  ok(o.observation.relations[0] === 'ottoman: same set as the sofa, photographed apart' && o.observation.relations_second[0] === 'ottoman belongs with the sofa', 'D13 04-06: the readers\' relations are kept (photographed apart, same set)');
  o = await ev(eyeAns({ relations: [{ a: 'x', b: 'y' }] }), second());
  ok(typeof o.observation.relations[0] === 'string', 'D13 04-06: a relation given as an object is kept as text, so later prompts can join it');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e && e.stack || e); process.exit(1); });
