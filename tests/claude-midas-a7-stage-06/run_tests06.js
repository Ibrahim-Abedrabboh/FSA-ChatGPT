// Local tests for stage 06 · Package (16 Oct 2026). Runs the n8n Code-node source with mocked node outputs and real image bytes.
// No network, no AI call, no paid call. Run: node tests/claude-midas-a7-stage-06/run_tests06.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const NODES = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-a7', 'code-nodes');
const FIX = path.join(__dirname, 'fixtures');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const img = n => fs.readFileSync(path.join(FIX, n));
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
// A binary reference is { _buf } here; n8n keeps its own reference object. Code nodes only pass references on and read them with helpers.
const ref = buf => ({ _buf: buf, mimeType: 'application/octet-stream' });
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
const MASTER = img('master_2048.png');
// The approved state as G2 leaves it after the owner's "approve".
function approved(over) {
  const s = clone(base);
  delete s.events; delete s.row;
  s.status = 'white_master_approved'; s.stage = '05 Review & go 2';
  s.go2_round = 1; s.go2_last = { round: 1, decision: 'approve', note: '', at: '2026-10-16T00:00:00Z', by: 'owner', result: 'white_master_approved' };
  s.outputs = [{ id: 'white_master', kind: 'white' }, { id: 'lifestyle_1', kind: 'lifestyle' }];
  s.approved = { output_id: 'white_master', attempt: 1, by: 'owner', at: '2026-10-16T00:00:00Z', note: '', review_result: 'passed',
    candidate: Object.assign({}, s.stage04.candidate, { drive_file_id: 'drive-master-1', folder_id: 'drive-run-folder', sha256: sha(MASTER), px: '2048x2048', bytes: MASTER.length, link: 'https://drive.example/master' }) };
  s.approved.release = {run_id:s.run_id,output_id:s.approved.output_id,candidate_sha256:s.approved.candidate.sha256,contract_stamp:s.contract_stamp,classification:'reviewed_owner_approved',catalogue_eligible:true};
  return Object.assign(s, over || {});
}
const SETTINGS = { package: { size_px: 1125, formats: ['jpg', 'webp'], jpg_quality: 92, square_tolerance_pct: 1 } };
const ops = runId => [
  { id: 1, operation_key: 'k:white_master:try1', run_id: runId, attempt: 1, status: 'completed', actual_usd: 0.1342, reserved_usd: 0.2, cost_basis: 'token counts' },
  { id: 2, operation_key: 'k:white_master:try2', run_id: runId, attempt: 2, status: 'uncertain', actual_usd: null, reserved_usd: 0.2, cost_basis: 'reserved' },
  { id: 3, operation_key: 'k:white_master:try3', run_id: runId, attempt: 3, status: 'not_sent', actual_usd: 0, reserved_usd: 0.2 },
  { id: 4, operation_key: 'other', run_id: 'another-run', attempt: 1, status: 'completed', actual_usd: 9, reserved_usd: 9 }
];

(async () => {
  // ---------- 18a Package ticket ----------
  const a1 = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: approved() }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  const pk = a1.pk;
  ok(pk.ok === true && pk.master.sha256 === sha(MASTER) && pk.approval.by === 'owner', '18a approved run → ticket ok');
  ok(/^photo:[0-9a-f]{64}$/.test(pk.identity_key), '18a no SKU → identity key from the vendor photo checksum: ' + pk.identity_key);
  const fv = f => pk.spec_card.fields.find(x => x.field === f).value;
  ok(fv('Colour') === 'not confirmed' && fv('Material') === 'not confirmed' && fv('Dimensions') === 'not confirmed' && fv('SKU') === 'not confirmed', '18a unknowns say "not confirmed"');
  ok(pk.description.text === 'Sectional sofa in 7 pieces: 1 left-arm piece, 4 armless pieces, 1 corner piece and 1 right-arm piece. Not confirmed: colour, material and dimensions.', '18a description from facts only, tidy wording: ' + pk.description.text);
  ok(!/grey/i.test(pk.description.text) && !/grey/i.test(JSON.stringify(pk.spec_card.fields)), '18a photo colour reading kept out of the client-facing fields');
  ok(/internal only/.test(pk.spec_card.internal_only.label), '18a photo readings labelled internal only');
  ok(pk.not_in_package.length === 1 && /lifestyle_1/.test(pk.not_in_package[0]), '18a scenes listed as not in the package');
  let a = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: approved({ status: 'awaiting_go_2' }) }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.pk.ok === false && /not in the state "white master approved"/.test(a.pk.problem), '18a not approved → no package');
  const forged = approved(); forged.go2_last.decision = 'repair';
  a = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: forged }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.pk.ok === false && /go 2 approval is not recorded/.test(a.pk.problem), '18a go 2 answer not approve → no package');
  const bySku = approved(); bySku.brief = Object.assign({}, bySku.brief, { sku: 'MID-123 45', dimensions: '320 x 180 x 85 cm (vendor sheet)', colour: 'Stone grey' });
  a = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: bySku }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(a.pk.identity_key === 'sku:MID-123 45' && a.pk.base === 'mid-123-45' && /Dimensions: 320 x 180 x 85 cm/.test(a.pk.description.text) && /Colour: Stone grey/.test(a.pk.description.text) && /Not confirmed: material\./.test(a.pk.description.text), '18a SKU and supplied facts used');
  // Wording (owner, 16 Oct 01:40): plurals, capital first letter, supplied values unchanged.
  const desc = async (over, inv) => { const s0 = approved(); s0.brief = Object.assign({}, s0.brief, over); if (inv) s0.inventory = inv; return (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: s0 }], '04 Settings': [{ json: SETTINGS }] }))[0].json.pk.description.text; };
  let d = await desc({ product_type: 'Bed', colour: 'walnut' }, [{ item: 'bed', count: 1, basis: 'supplied' }]);
  ok(d === 'Bed, 1 piece. Colour: walnut. Not confirmed: material and dimensions.', '18a one piece named like the product; supplied colour kept as written: ' + d);
  d = await desc({ product_type: 'bedroom set', colour: '', material: 'Oak veneer' }, [{ item: 'bed', count: 1, basis: 'supplied' }, { item: 'nightstand', count: 2, basis: 'supplied' }, { item: 'dresser', count: 1, basis: 'supplied' }, { item: 'mirror', count: 1, basis: 'supplied' }, { item: 'stool', count: 1, basis: 'supplied' }]);
  ok(d === 'Bedroom set in 6 pieces: 1 bed, 2 nightstands, 1 dresser, 1 mirror and 1 stool. Material: Oak veneer. Not confirmed: colour and dimensions.', '18a set: plurals, capital first letter, "and": ' + d);
  d = await desc({ product_type: 'Shelving unit' }, [{ item: 'shelf', count: 3, basis: 'supplied' }, { item: 'bench', count: 2, basis: 'supplied' }, { item: 'accessory', count: 2, basis: 'supplied' }, { item: 'drawers', count: 2, basis: 'supplied' }, { item: 'armless', count: 4, basis: 'supplied' }]);
  ok(d === 'Shelving unit in 13 pieces: 3 shelves, 2 benches, 2 accessories, 2 drawers and 4 armless. Not confirmed: colour, material and dimensions.', '18a plural rules (ves, es, ies, already plural, adjective): ' + d);
  d = await desc({ product_type: 'Desk lamp' }, [{ item: 'table lamp', count: 1, basis: 'supplied' }]);
  ok(d === 'Desk lamp, 1 piece: 1 table lamp. Not confirmed: colour, material and dimensions.', '18a one piece named differently: ' + d);
  a = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: approved() }] }))[0].json;
  ok(a.pk.ok === true && a.pk.cfg.size_px === 1125 && a.pk.cfg.jpg_quality === 92, '18a settings default when 04 Settings did not run');

  // ---------- 18e Check master ----------
  const st = a1.st;
  const n18e = (bin, idRows, opRows, dl) => ({ '18a Package ticket': [{ json: a1 }], '18b Load identity': (idRows || [{}]).map(json => ({ json })), '18c Load operations': (opRows || ops(st.run_id)).map(json => ({ json })) });
  const e18 = async (buf, idRows, opRows, json) => (await run('18e_Check_master.js', n18e(buf, idRows, opRows), [{ json: json || {}, binary: buf ? { data: ref(buf) } : undefined }]))[0];
  let r = await e18(MASTER);
  ok(r.json.pk.ok === true && r.json.pk.version === 1 && r.binary.data._buf === MASTER, '18e master matches → ok, version 1, binary passed on');
  ok(r.json.pk.files[0].file_name === pk.base + '_white_1125_v1.jpg' && r.json.pk.files[1].file_name === pk.base + '_white_1125_v1.webp' && r.json.pk.manifest_name === pk.base + '_manifest_v1.json', '18e versioned file names');
  ok(r.json.pk.cost.image_calls === 2 && r.json.pk.cost.usd === 0.3342 && r.json.pk.cost.per_accepted_package_usd === 0.3342 && /not an invoice/.test(r.json.pk.cost.basis), '18e cost: sent calls of this run only (not_sent and other runs left out): ' + r.json.pk.cost.usd);
  r = await e18(img('master_1000.png'));
  ok(r.json.pk.ok === false && /not the master the owner approved/.test(r.json.pk.problem) && !r.binary, '18e different file in Drive → hold');
  const swap = async (file, test, name) => { const b = img(file); const t = clone(a1); t.pk.master.sha256 = sha(b); const x = (await run('18e_Check_master.js', Object.assign(n18e(), { '18a Package ticket': [{ json: t }] }), [{ json: {}, binary: { data: ref(b) } }]))[0]; ok(test(x), name + ': ' + x.json.pk.problem + ' ' + (x.json.pk.notes || []).join(' ')); };
  await swap('master_2048x1536.png', x => x.json.pk.ok === false && /not square/.test(x.json.pk.problem), '18e non-square master → hold, never stretched');
  await swap('master_1000.png', x => x.json.pk.ok === false && /never upscaled/.test(x.json.pk.problem), '18e small master → hold, never upscaled');
  await swap('master_2000.jpg', x => x.json.pk.ok === true && /not 2048 x 2048/.test(x.json.pk.notes.join()), '18e 2000 px jpeg master → resized, with a note');
  r = await e18(MASTER, [{ id: 7, identity_key: pk.identity_key, package_version: 1, master_sha256: sha(MASTER) }]);
  ok(r.json.pk.ok === false && /already packaged as version 1/.test(r.json.pk.problem), '18e same master already packaged → no double package');
  r = await e18(MASTER, [{ id: 7, identity_key: pk.identity_key, package_version: 2, master_sha256: 'a'.repeat(64) }, { id: 9, identity_key: 'sku:other', package_version: 5, master_sha256: 'b'.repeat(64) }]);
  ok(r.json.pk.ok === true && r.json.pk.version === 3 && /_v3\.jpg$/.test(r.json.pk.files[0].file_name), '18e earlier package of this product → next version (3)');
  r = await e18(MASTER, [{ error: { message: 'table down' } }]);
  ok(r.json.pk.ok === false && /identity vault could not be read/.test(r.json.pk.problem), '18e identity vault unreadable → hold');
  r = await e18(null, null, null, { error: { message: 'File not found key=AIzaSyA1234567890abcdef' } });
  ok(r.json.pk.ok === false && /could not be downloaded/.test(r.json.pk.problem) && !/AIza/.test(r.json.pk.problem), '18e download failed → hold, key-like text removed');
  r = await e18(MASTER, null, [{ error: { message: 'x' } }]);
  ok(r.json.pk.ok === true && r.json.pk.cost.usd === null && /cost per package is not known/.test(r.json.pk.notes.join()), '18e operations unreadable → package still made, cost "not known"');

  // ---------- 18h Check files ----------
  const e18ok = (await e18(MASTER)).json;
  const JPG = img('out_1125.jpg'), WEBP = img('out_1125.webp');
  // P1.7 (16 Oct 2026): 18h reads its ticket from 18e3 Clean background and checks the saved files read back as BMP (jpgpix, webppix).
  // Code-made 24-bit BMPs stand for the saved files read back: white with a grey product in the middle; GREY has edge rows at 254.
  const bmp = (edge) => { const w = 1125, h = 1125, st = Math.floor((24 * w + 31) / 32) * 4, b = Buffer.alloc(54 + st * h, 255); b.write('BM', 0, 'latin1'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(0, 30);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = 54 + (h - 1 - y) * st + x * 3; if (x > 300 && x < 800 && y > 400 && y < 700) b.fill(110, p, p + 3); else if (edge !== 255 && y < 2) b.fill(edge, p, p + 3); } return b; };
  const JB = bmp(255), WB = bmp(255), GREY = bmp(254);
  const e3ok = clone(e18ok); e3ok.pk.white_clean = { done: true, background_pct: 70, background_255_after_pct: 99 };
  const h18 = async bins => (await run('18h_Check_files.js', { '18e Check master': [{ json: e18ok }], '18e3 Clean background': [{ json: e3ok }] }, [{ json: clone(e3ok), binary: Object.assign({ clean: ref(JB), jpgpix: ref(JB), webppix: ref(WB) }, bins) }]))[0]; // clean: the cleaned picture 18e3 hands on (halo check, owner 19:26)
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP) });
  ok(r.json.pk.files_ok === true && r.binary.jpg._buf === JPG && r.binary.webp._buf === WEBP && r.binary.jpg.fileName === e18ok.pk.files[0].file_name, '18h both files 1125 x 1125 → ok, named');
  ok(r.json.pk.files[0].sha256 === sha(JPG) && r.json.pk.files[1].px === '1125x1125' && r.json.pk.files[1].mime === 'image/webp' && /No AI/.test(r.json.pk.method), '18h checksums, sizes and method recorded');
  ok(r.json.pk.files.every(f => f.background_check && f.background_check.edge_255_pct === 100 && f.background_check.darkest_edge_value === 255 && /after saving/.test(f.background_check.checked)) && /background set to 255/.test(r.json.pk.method) && r.json.pk.background_note === 'background set to 255', '18h saved files read back: edge rows 255 on both (P1.7)');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(GREY) });
  ok(r.json.pk.ok === false && /saved jpg file's edge rows read 255 on only/.test(r.json.pk.problem) && !r.binary, '18h saved jpg edge rows not 255 → hold, nothing uploaded (P1.7)');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), webppix: undefined });
  ok(r.json.pk.ok === false && /webp file could not be read back/.test(r.json.pk.problem), '18h saved webp not read back → hold (P1.7)');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG) });
  ok(r.json.pk.ok === false && /webp file was not made/.test(r.json.pk.problem) && !r.binary, '18h webp missing → nothing uploaded');

  // Phase 1 review, finding 6 and the 32-bit test gap (16 Oct 2026): all edge pixels at 255, or at least 99.9% with none below 254;
  // the read-back picture must be 1125 x 1125; a 32-bit BMP with colour masks is read by its masks, never by the alpha byte.
  const bmpX = (o) => { const w = o.w || 1125, h = o.h || 1125, bits = o.bits || 24, st = Math.floor((bits * w + 31) / 32) * 4, hd = bits === 32 ? 124 : 40, off = 14 + hd, b = Buffer.alloc(off + st * h, 0);
    b.write('BM', 0, 'latin1'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(off, 10); b.writeUInt32LE(hd, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(bits, 28); b.writeUInt32LE(bits === 32 ? 3 : 0, 30);
    const order = o.order || ['b', 'g', 'r', 'a']; // byte order of one pixel
    if (bits === 32) { const mask = c => (0xff << (8 * order.indexOf(c))) >>> 0; b.writeUInt32LE(mask('r'), 54); b.writeUInt32LE(mask('g'), 58); b.writeUInt32LE(mask('b'), 62); b.writeUInt32LE(mask('a'), 66); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = o.f(x, y), px = { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 255 }, p = off + (h - 1 - y) * st + x * (bits / 8);
      if (bits === 24) { b[p] = px.b; b[p + 1] = px.g; b[p + 2] = px.r; } else order.forEach((c, k) => { b[p + k] = px[c]; }); }
    return b; };
  const bodyAt = (x, y) => x > 300 && x < 800 && y > 400 && y < 700;
  const few = (v, n) => (x, y) => (bodyAt(x, y) ? [110, 110, 110] : (y === 0 && x >= 100 && x < 100 + n ? [v, v, v] : [255, 255, 255]));
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ f: few(254, 5) })) });
  ok(r.json.pk.ok !== false && r.json.pk.files_ok === true && r.json.pk.files[0].background_check.edge_255_pct >= 99.9 && r.json.pk.files[0].background_check.edge_255_pct < 100 && r.json.pk.files[0].background_check.darkest_edge_value === 254, '18h 5 edge pixels at 254 (99.9% or more, none below 254) → ok');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ f: few(253, 5) })) });
  ok(r.json.pk.ok === false && /none darker than 254/.test(r.json.pk.problem) && !r.binary, '18h 5 edge pixels at 253 → hold (the floor is 254)');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ f: few(254, 40) })) });
  ok(r.json.pk.ok === false && /edge rows read 255 on only 99\.5/.test(r.json.pk.problem), '18h 40 edge pixels at 254 (under 99.9%) → hold', r.json.pk.problem);
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), webppix: ref(bmpX({ w: 1124, h: 1124, f: few(255, 0) })) });
  ok(r.json.pk.ok === false && /read back at 1124x1124, not 1125 x 1125/.test(r.json.pk.problem), '18h read-back picture of the wrong size → hold');
  // 32-bit with masks, alpha first in each pixel (A, R, G, B in bytes 0-3): a white edge with alpha 0 passes; a grey edge fails.
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ bits: 32, order: ['a', 'r', 'g', 'b'], f: (x, y) => (bodyAt(x, y) ? [110, 110, 110, 255] : [255, 255, 255, 0]) })) });
  ok(r.json.pk.files_ok === true && r.json.pk.files[0].background_check.edge_255_pct === 100, '18h 32-bit BMP with masks (alpha first, alpha 0): colour bytes read by the masks → ok');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ bits: 32, order: ['a', 'r', 'g', 'b'], f: (x, y) => (bodyAt(x, y) ? [110, 110, 110, 255] : (y < 2 ? [240, 240, 240, 255] : [255, 255, 255, 255])) })) });
  ok(r.json.pk.ok === false && /darkest 240/.test(r.json.pk.problem), '18h 32-bit BMP with masks: a grey edge is read as grey, not as the alpha byte → hold');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP), jpgpix: ref(bmpX({ bits: 32, order: ['b', 'g', 'r', 'a'], f: (x, y) => (bodyAt(x, y) ? [110, 110, 110, 255] : [255, 255, 255, 255]) })) });
  ok(r.json.pk.files_ok === true, '18h 32-bit BMP with masks in the usual order (B, G, R, A) → ok');
  r = await h18({ data: ref(MASTER), jpg: ref(img('out_1124.jpg')), webp: ref(WEBP) });
  ok(r.json.pk.ok === false && /1124x1124, not 1125 x 1125/.test(r.json.pk.problem), '18h wrong size → hold');
  r = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(JPG) });
  ok(r.json.pk.ok === false && /webp file is image\/jpeg/.test(r.json.pk.problem), '18h jpeg in the webp slot → hold');

  // ---------- 18j Files to upload ----------
  const h18ok = await h18({ data: ref(MASTER), jpg: ref(JPG), webp: ref(WEBP) });
  let j = await run('18j_Files_to_upload.js', { '18h Check files': [h18ok], '18i Package folder': [{ json: { id: 'drive-pkg-folder', name: 'x' } }] });
  ok(j.length === 2 && j[0].json.format === 'jpg' && j[1].binary.file === h18ok.binary.webp && j[0].json.folder_id === 'drive-pkg-folder' && j[0].json.skip === false, '18j one item per file');
  const j2 = await run('18j_Files_to_upload.js', { '18h Check files': [h18ok], '18i Package folder': [{ json: { error: { message: 'quota' } } }] });
  ok(j2.length === 1 && j2[0].json.skip === true && /could not be made/.test(j2[0].json.problem), '18j folder failed → skip, nothing uploaded');
  const noBin = { json: h18ok.json };
  const j3 = await run('18j_Files_to_upload.js', { '18h Check files': [noBin], '18i Package folder': [{ json: { id: 'drive-pkg-folder' } }] });
  ok(j3.length === 1 && j3[0].json.skip === true && /jpg and webp file did not reach the upload step/.test(j3[0].json.problem), '18j files missing → skip, nothing uploaded (found in pinned run 426)');

  // ---------- 18l Manifest ----------
  const up = [{ json: { id: 'drive-jpg', webViewLink: 'https://drive.example/jpg', sha256Checksum: sha(JPG) } }, { json: { id: 'drive-webp', webViewLink: 'https://drive.example/webp' } }];
  const nl = { '18a Package ticket': [{ json: a1 }], '18h Check files': [h18ok], '18j Files to upload': j };
  r = (await run('18l_Manifest.js', nl, up))[0];
  const man = JSON.parse(r.binary.file._buf.toString('utf8'));
  ok(r.json.pk.images_ok === true && r.binary.file.mimeType === 'application/json' && r.json.pk.manifest_sha256 === sha(r.binary.file._buf), '18l manifest made, checksum of its bytes');
  ok(man.package.label === 'Generated image' && man.files.every(f => f.label === 'Generated image') && man.approval.by === 'owner' && man.master.stays_in_vault === true, '18l labels, approval and master in the manifest');
  ok(Array.isArray(man.accessories_used) && man.accessories_used.length === 0 && /own manifests/.test(man.accessories_note) && !/not built yet/.test(man.accessories_note), '18l no accessories in a white master (no stale "not built yet")');
  ok(man.files[0].drive_sha256_matches === true && man.files[1].drive_sha256_matches === null && man.cost.usd === 0.3342 && man.spec_card.fields.length === 7, '18l Drive checksums, cost, spec card');
  ok(!/approved image|is approved/i.test(JSON.stringify(man.files)), '18l files never called approved');
  r = (await run('18l_Manifest.js', nl, [up[0], { json: { error: { message: 'rate limit' } } }]))[0];
  ok(r.json.pk.images_ok === false && /webp file was not saved/.test(r.json.pk.problem) && !r.binary, '18l one upload failed → incomplete, no manifest');
  r = (await run('18l_Manifest.js', nl, [{ json: { id: 'drive-jpg', sha256Checksum: 'f'.repeat(64) } }, up[1]]))[0];
  ok(r.json.pk.images_ok === false && /different checksum/.test(r.json.pk.problem), '18l Drive checksum differs → incomplete');

  // ---------- Phase 1 review test gaps (16 Oct 2026): run, not word-matched ----------
  // 18e: the text and vision calls are added to the package cost; a call without token counts is left out and said so.
  const aTxt = clone(a1); aTxt.st.text_calls = [{ step: 16, node: '16 Critic review', model: 'claude-sonnet-5-5', usd: 0.022 }, { step: 16, node: '16x Blind count', model: 'gemini-3.8-flash', usd: 0.0051 }, { step: 6, node: '06 Room reader', model: 'gemini-3.8-flash', usd: null }];
  const e18t = (await run('18e_Check_master.js', Object.assign(n18e(), { '18a Package ticket': [{ json: aTxt }] }), [{ json: {}, binary: { data: ref(MASTER) } }]))[0].json.pk;
  ok(e18t.cost.text_calls === 3 && e18t.cost.text_calls_priced === 2 && e18t.cost.text_usd === 0.0271 && e18t.cost.all_usd === Number((0.3342 + 0.0271).toFixed(4)) && /without token counts, not counted/.test(JSON.stringify(e18t.cost) + (e18t.notes || []).join(' ')), '18e (run): text and vision calls added to the cost, USD ' + e18t.cost.text_usd + '; the unpriced call is left out and said so');
  // 18a: the product box of the approved review reaches the package ticket (for 18e3).
  const apBox = approved(); apBox.approved.product_box_2d = [336, 97, 698, 902];
  const aBox = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: apBox }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(JSON.stringify(aBox.pk.product_box_2d) === '[336,97,698,902]' && a1.pk.product_box_2d === null, '18a (run): the approved review\'s product box is carried to the package; none when the approval has none');
  // 18l: an approval by eye is written as such in the manifest, and the background note is there.
  const apEye = approved(); apEye.go2_last.decision = 'approve_unreviewed'; Object.assign(apEye.approved, { review_result: 'not reviewed', without_review: true, approval_kind: 'approved by owner without an automated review' });
  const aEye = (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: apEye }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  const hEye = clone(h18ok); hEye.json.pk.approval = aEye.pk.approval; hEye.binary = h18ok.binary;
  const lEye = (await run('18l_Manifest.js', Object.assign({}, nl, { '18a Package ticket': [{ json: aEye }], '18h Check files': [hEye] }), up))[0];
  const manEye = lEye.binary ? JSON.parse(lEye.binary.file._buf.toString('utf8')) : {};
  ok(manEye.approval && manEye.approval.decision === 'approve_unreviewed' && /Approved by owner without an automated review/.test(manEye.approval.note_on_review) && manEye.approval.without_review === true && /background set to 255/.test(JSON.stringify(manEye)) && !/review passed|passed review/i.test(manEye.approval.note_on_review.replace('no review passed', '')), '18l (run): approval by eye named as such in the manifest; background set to 255 recorded');
  ok(man.approval.decision === 'approve' && /approval and automated review are separate/.test(man.approval.note_on_review) && /background set to 255/.test(JSON.stringify(man)), '18l (run): a normal approval keeps its own wording; background set to 255 recorded');

  // ---------- 18n Identity entry ----------
  const l18 = (await run('18l_Manifest.js', nl, up))[0];
  const nn = { '18a Package ticket': [{ json: a1 }], '18l Manifest': [l18] };
  let n = (await run('18n_Identity_entry.js', nn, [{ json: { id: 'drive-manifest', webViewLink: 'https://drive.example/m' } }]))[0].json;
  ok(n.entry_ready === true && n.row.identity_key === pk.identity_key && n.row.package_version === 1 && n.row.master_sha256 === sha(MASTER) && n.row.jpg_drive_id === 'drive-jpg' && n.row.webp_sha256 === sha(WEBP) && n.row.manifest_drive_id === 'drive-manifest' && n.row.approved_by === 'owner' && n.row.sku === 'not confirmed', '18n identity row');
  n = (await run('18n_Identity_entry.js', nn, [{ json: { error: { message: 'x' } } }]))[0].json;
  ok(n.entry_ready === false && /manifest was not saved/.test(n.pk.problem), '18n manifest not saved → no identity entry');

  // ---------- 18p Package result ----------
  const n18ok = (await run('18n_Identity_entry.js', nn, [{ json: { id: 'drive-manifest', webViewLink: 'https://drive.example/m' } }]))[0].json;
  const all = { '18a Package ticket': [{ json: a1 }], '18e Check master': [{ json: e18ok }], '18h Check files': [h18ok], '18j Files to upload': j, '18l Manifest': [l18], '18n Identity entry': [{ json: n18ok }], '18o Save identity': [{ json: {} }] };
  let p = (await run('18p_Package_result.js', all, [{ json: Object.assign({ id: 31 }, n18ok.row) }]))[0].json;
  ok(p.status === 'white_package_ready' && p.identity.row_id === 31 && p.package.version === 1 && p.package.files.length === 2 && p.stage === '06 Package', '18p everything saved → white_package_ready');
  ok(/Generated image/.test(p.next) && /resized without AI/.test(p.next) && /lifestyle_1/.test(p.next) && /USD 0.3342/.test(p.next) && !/complete/i.test(p.next) && p.package.ai_or_paid_calls === 'none', '18p message: label, method, what is not in it, cost; never "complete"');
  ok(p.vault_only.join() === 'package,identity,package_release,hold,status' && p.trail[p.trail.length - 1].step === 18, '18p vault kinds and trail');
  p = (await run('18p_Package_result.js', all, [{ json: { error: { message: 'insert failed' } } }]))[0].json;
  ok(p.status === 'hold' && p.hold_for === 'owner' && /identity vault entry could not be saved/.test(p.hold_reason) && !p.identity, '18p identity insert failed → hold');
  p = (await run('18p_Package_result.js', { '18a Package ticket': [{ json: (await run('18a_Package_ticket.js', { 'V1 Vault events': [{ json: approved({ status: 'awaiting_go_2' }) }] }))[0].json }] }, [{ json: {} }]))[0].json;
  ok(p.status === 'hold' && /not in the state/.test(p.hold_reason) && /No AI or paid call/.test(p.next), '18p ticket refused → hold');
  const e18bad = (await e18(img('master_1000.png'))).json;
  p = (await run('18p_Package_result.js', { '18a Package ticket': [{ json: a1 }], '18e Check master': [{ json: e18bad }] }, [{ json: e18bad }]))[0].json;
  ok(p.status === 'hold' && /not the master the owner approved/.test(p.hold_reason) && /approved master is unchanged/.test(p.next), '18p master check failed → hold');
  p = (await run('18p_Package_result.js', { '18a Package ticket': [{ json: a1 }], '18e Check master': [{ json: e18ok }], '18h Check files': [h18ok], '18j Files to upload': j2 }, [{ json: j2[0].json }]))[0].json;
  ok(p.status === 'hold' && /folder could not be made/.test(p.hold_reason), '18p Drive folder failed → hold');
  const n18bad = (await run('18n_Identity_entry.js', nn, [{ json: { error: { message: 'x' } } }]))[0].json;
  p = (await run('18p_Package_result.js', Object.assign({}, all, { '18n Identity entry': [{ json: n18bad }], '18o Save identity': undefined }), [{ json: n18bad }]))[0].json;
  ok(p.status === 'hold' && /manifest was not saved/.test(p.hold_reason) && /two images are in Drive/.test(p.hold_reason), '18p manifest failed → hold, says the images are in Drive');

  // The white-only route has no scene gate. It must still validate the whole requested package.
  const single = clone(all); single['18a Package ticket'][0].json.st.outputs = [{id:'white_master',kind:'white'}];
  let whiteOnly = (await run('18p_Package_result.js', single, [{json:Object.assign({id:31},n18ok.row)}]))[0].json;
  ok(whiteOnly.package_release.complete === true && whiteOnly.package_release.classification === 'reviewed_owner_approved', '18p white-only complete release uses saved receipts and current approval');
  single['18a Package ticket'][0].json.st.outputs.push({id:'variation',kind:'variation'});
  whiteOnly = (await run('18p_Package_result.js', single, [{json:Object.assign({id:31},n18ok.row)}]))[0].json;
  ok(whiteOnly.status === 'hold' && whiteOnly.package_release.complete === false && /variation/.test(whiteOnly.hold_reason), '18p unsupported pending output cannot bypass the whole-package gate');
  // ---------- V1 Vault events with stage 06 ----------
  const pOk = (await run('18p_Package_result.js', all, [{ json: Object.assign({ id: 31 }, n18ok.row) }]))[0].json;
  let v = (await run('V1_Vault_events.js', {}, [{ json: clone(pOk) }]))[0].json;
  ok(v.events.map(e => e.kind).join() === 'package,identity,package_release,status' && v.events.every(e => e.stage === '06' && e.step === 18), 'V1 stage 06 events: ' + v.events.map(e => e.kind).join());
  ok(JSON.parse(v.row.package).version === 1 && v.row.status === 'white_package_ready' && v.row.go2_token === '' && v.row.resume_url === '', 'V1 row package column');
  v = (await run('V1_Vault_events.js', {}, [{ json: clone(p) }]))[0].json;
  ok(v.events.map(e => e.kind).join() === 'package,package_release,hold,status' && v.events[1].stage === '06', 'V1 stage 06 hold events: ' + v.events.map(e => e.kind).join());

  // Execution 432 reached G2 with a candidate-only stage04. Synthetic values
  // reproduce that saved shape without retaining owner data or approval tokens.
  const candidateOnly = approved({ status: 'scene_room_ready', stage: '05 Review & go 2', vault_only: ['status'] });
  candidateOnly.stage04 = { candidate: { sha256: 'synthetic-432', file_id: 'synthetic-file' } };
  const beforeCandidateOnly = JSON.stringify(candidateOnly);
  const candidateVault = (await run('V1_Vault_events.js', {}, [{ json: candidateOnly }]))[0].json;
  const savedStage04 = JSON.parse(candidateVault.row.stage04);
  ok(Array.isArray(savedStage04.orders) && savedStage04.orders.length === 0, 'V1 candidate-only stage04 without orders serializes safely (execution 432)');
  ok(savedStage04.candidate.sha256 === 'synthetic-432' && candidateVault.row.status === 'scene_room_ready', 'V1 preserves candidate and job status when orders are absent');
  ok(JSON.stringify(candidateOnly) === beforeCandidateOnly, 'V1 does not mutate the recovery state');
  candidateOnly.stage04.orders = [{ output_id: 'synthetic-output', prompt: 'private synthetic prompt' }];
  const orderVault = (await run('V1_Vault_events.js', {}, [{ json: candidateOnly }]))[0].json;
  const savedOrder = JSON.parse(orderVault.row.stage04).orders[0];
  ok(savedOrder.output_id === 'synthetic-output' && !('prompt' in savedOrder) && candidateOnly.stage04.orders[0].prompt === 'private synthetic prompt', 'V1 retains order metadata and omits row prompts without changing source orders');

  // ---------- G2 approve text ----------
  const G2 = fs.readFileSync(path.join(NODES, 'G2_Go_2_verdict.js'), 'utf8');
  ok(/Stage 06 makes the delivery package next/.test(G2) && !/delivery package \(1125 x 1125 jpg and webp from the 2048 master\) are not built yet/.test(G2), 'G2 approve message names stage 06');

  console.log('\n' + pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
