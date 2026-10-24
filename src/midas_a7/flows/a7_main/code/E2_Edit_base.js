// E2 · Edit base (Edit phase 2.4, 19 Oct 2026): the owner-approved image an edit starts from, checked against the earlier run's own
// record. Code only; nothing is paid here. The owner site sent the image's receipt (run, output, Drive file, checksum); it is used only
// when the earlier run's row records the owner's approval of exactly that file and that checksum, and the same product photo. The file
// itself is checked against the checksum again in 19e2 before the paid call. The edit makes no white master: the earlier run's approved
// white master (from its package) is image 2 of the edit, as for any scene, and is checked against its checksum in 19d2.
const st = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete st.events; delete st.row;
const arr = x => (Array.isArray(x) ? x : []);
const now = new Date().toISOString();
const SHA = /^[0-9a-f]{64}$/;
const SCENE_KINDS = ['lifestyle', 'hero', 'wide', 'detail', 'composition', 'scene'];
const LIGHT_LABEL = { day: 'Daylight', warm: 'Golden afternoon', night: 'Warm evening' };
const parse = t => { if (t && typeof t === 'object') return t; try { return JSON.parse(String(t || '')); } catch (e) { return null; } };
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = ''; st.hold_step = 19;
  st.critical = arr(st.critical).concat([{ what: 'edit_base', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' No image was made or paid for.';
}
const eb = st.brief && st.brief.edit && st.brief.edit.base ? st.brief.edit.base : null;
// Scenes from an approved white image (20 Oct 2026): the base is the earlier run's white master, checked against that run's finished
// white package and the owner's go 2 release of exactly that file. It becomes this run's approved white master (image 2 of every
// scene); the scenes are planned (stage 03) and queued by 19a as in any job.
const white = Boolean(eb && eb.kind === 'white');
const o = white ? null : arr(st.outputs).find(x => x.edit_from_result);
const last = st.go1_last || {};
let rows = [];
try { rows = $('E1 Load earlier run').all().map(i => i.json).filter(r => r && eb && r.run_id === eb.run_id); } catch (e) { rows = []; }
let tickets = [];
try { tickets = $input.all().map(i => i.json).filter(r => r && eb && r.run_id === eb.run_id && r.kind === 'scene_ticket'); } catch (e) { tickets = []; }
let base = null, whiteBase = null;
if (!eb || (!white && !o)) hold('This run has no approved image to edit recorded, so nothing is made.');
else if (!(last.decision === 'go' && last.by === 'owner')) hold('The owner\'s go 1 is not recorded for this run, so nothing is made.');
else if (rows.length !== 1) hold('The earlier run ' + eb.run_id + ' was ' + (rows.length ? 'found more than once' : 'not found') + ' in the A7 runs table, so the approved image cannot be checked. Nothing is made.');
else if (white) {
  const row = rows[0];
  const pkg = parse(row.package) || {};
  const master = pkg.master || null, rel = pkg.release || {};
  const product = arr(st.references).find(r => r.key === st.product_key && r.sha256);
  const earlierRefs = arr(parse(row.references));
  if (!arr(st.outputs).some(x => SCENE_KINDS.indexOf(x.kind) !== -1)) hold('This run has no scene to make from the approved white image, so nothing is made.');
  else if (pkg.outcome !== 'white_package_ready' || !master) hold('The earlier run ' + eb.run_id + ' has no finished white package, so its white master cannot be checked. Nothing is made.');
  else if (eb.output_id !== 'white_master' || master.sha256 !== eb.sha256 || master.drive_file_id !== eb.drive_file_id || !SHA.test(String(master.sha256 || ''))) hold('The white image sent as the start of these scenes is not the white master of the earlier run\'s package (its Drive file or checksum differs). Nothing is made.');
  else if (rel.run_id !== eb.run_id || rel.output_id !== 'white_master' || rel.candidate_sha256 !== eb.sha256 || ['reviewed_owner_approved', 'owner_exception'].indexOf(rel.classification) === -1) hold('The earlier run has no owner go 2 release of exactly this white master, so scenes cannot start from it. Nothing is made.');
  else if (!product || !earlierRefs.some(r => r && r.sha256 === product.sha256 && r.role === product.role)) hold('The product photo of this job is not the one the earlier run used, so the approved white master may show another product. Nothing is made.');
  else whiteBase = { row, master, rel };
}
else {
  const row = rows[0];
  const scenes = parse(row.scenes) || {};
  const done = (scenes.done || {})[eb.output_id];
  const pkg = parse(row.package) || {};
  // An earlier run that was itself an edit has no package; its inherited master is in its scenes record (V1).
  const master = pkg.master || (scenes.edit_base && scenes.edit_base.master) || null;
  const product = arr(st.references).find(r => r.key === st.product_key && r.sha256);
  const earlierRefs = arr(parse(row.references));
  // The latest placement ticket of that image in the earlier run's vault: its camera view, light, frame, plan and Midas pieces.
  const tk = tickets.map(r => ({ at: String(r.at || ''), p: parse(r.payload) })).filter(x => x.p && x.p.scene && x.p.scene.output_id === eb.output_id && x.p.scene.phase === 'place')
    .sort((a, b) => (a.at < b.at ? -1 : (a.at > b.at ? 1 : 0))).map(x => x.p.scene).pop() || null;
  if (!done || done.by !== 'owner') hold('The earlier run has no owner approval recorded for ' + eb.output_id + ', so it cannot be edited. Nothing is made.');
  else if (!done.candidate || done.candidate.sha256 !== eb.sha256 || done.candidate.drive_file_id !== eb.drive_file_id) hold('The image sent as the start of this edit is not the one the owner approved in the earlier run (its Drive file or checksum differs). Nothing is made.');
  else if (!master || !SHA.test(String(master.sha256 || '')) || !master.drive_file_id) hold('The earlier run has no white master package recorded with its file and checksum, so the product cannot be checked in the edit. Nothing is made.');
  else if (!product || !earlierRefs.some(r => r && r.sha256 === product.sha256 && r.role === product.role)) hold('The product photo of this edit is not the one the earlier run used, so the approved image may show another product. Nothing is made.');
  else if (!tk || !tk.shot || !tk.shot.plan) hold('The earlier run\'s scene ticket for ' + eb.output_id + ' is not in the vault, so its camera, light and Midas pieces are not known. Nothing is made.');
  else base = { row, done, master, tk };
}
if (whiteBase) {
  const { master, rel } = whiteBase;
  st.approved = { by: 'owner', output_id: 'white_master', attempt: master.attempt || 1, at: now, without_review: rel.classification !== 'reviewed_owner_approved',
    candidate: { drive_file_id: master.drive_file_id, folder_id: master.folder_id || '', link: master.link || '', sha256: master.sha256, px: master.px || '', bytes: master.bytes || 0, file_name: master.file_name || '' },
    inherited_from: { run_id: eb.run_id, kind: 'white', approved_at: rel.at || '', classification: rel.classification, source: 'the earlier run\'s owner-approved white master package' } };
  st.edit_base = { at: now, run_id: eb.run_id, output_id: 'white_master', sha256: eb.sha256, drive_file_id: eb.drive_file_id, kind: 'white', master_sha256: master.sha256,
    scenes: arr(st.outputs).filter(x => SCENE_KINDS.indexOf(x.kind) !== -1).map(x => x.id),
    checks: ['finished white package of the earlier run', 'this file and checksum are its white master', 'the owner\'s go 2 release of exactly that file', 'same product photo as the earlier run'] };
  st.status = 'edit_base_ready'; st.stage = '07 Scenes'; st.hold_reason = ''; st.hold_for = ''; st.client_question = ''; st.critical = [];
  st.next = 'The approved white master of the earlier run ' + eb.run_id + ' is checked. Stage 07 makes the planned scenes from it next (no new white master), each with its own paid image calls and your go 2. No image was made yet.';
}
if (base) {
  const { row, done, master, tk } = base;
  const changes = arr(o.edit_changes);
  const pr = tk.presets || {};
  const earlierOut = arr(parse(row.required_outputs)).find(x => x && x.id === eb.output_id) || {};
  // The edited image is the same kind of view as the approved one; its camera view and light stay unless an option changes them.
  o.kind = SCENE_KINDS.indexOf(earlierOut.kind) !== -1 ? earlierOut.kind : (SCENE_KINDS.indexOf(tk.kind) !== -1 ? tk.kind : o.kind);
  if (!o.camera) o.camera = pr.view || 'Reference view';
  if (!o.light && pr.light && ['day', 'warm', 'night'].indexOf(pr.light.preset) !== -1) { o.light = pr.light.preset; o.light_label = LIGHT_LABEL[o.light]; }
  // The earlier plan, without the camera or light words when the edit changes them (the option decides those).
  const plan = JSON.parse(JSON.stringify(tk.shot.plan));
  if (changes.indexOf('camera') !== -1) plan.camera = '';
  if (changes.indexOf('light') !== -1) plan.light = '';
  const shot = arr(st.shots).find(x => x.output_id === o.id);
  if (shot) { shot.kind = o.kind; shot.frame = tk.shot.frame || shot.frame; shot.plan = plan; shot.camera_view = o.camera; shot.light_preset = o.light || ''; }
  const c = done.candidate;
  const edit_base = { id: o.from, output_id: eb.output_id, run_id: eb.run_id, kind: o.kind, by: 'owner', approved_at: done.at || '', without_review: Boolean(done.without_review),
    candidate: { drive_file_id: c.drive_file_id, link: c.link || '', sha256: c.sha256, px: c.px || '', file_name: c.file_name || '' },
    props: arr(done.props).map(p => ({ sku: String(p.sku), name: p.name || '' })), plan, view: pr.view || 'Reference view', light: (pr.light && pr.light.preset) || '', person: tk.person || '', frame: tk.shot.frame || '' };
  st.scenes = { queue: [o.id], done: {}, held: {}, log: [{ output_id: o.id, event: 'edit base checked', at: now, from: eb.run_id + ' / ' + eb.output_id }], edit_base };
  // The earlier run's approved white master: image 2 of the edit, as for any scene (19d downloads it, 19d2 checks its checksum).
  st.approved = { by: 'owner', output_id: master.output_id || 'white_master', attempt: master.attempt || 1, at: now,
    candidate: { drive_file_id: master.drive_file_id, folder_id: master.folder_id || '', link: master.link || '', sha256: master.sha256, px: master.px || '', bytes: master.bytes || 0, file_name: master.file_name || '' },
    inherited_from: { run_id: eb.run_id, source: 'the earlier run\'s white master package' } };
  // The approved image's Midas pieces are checked live again in 19b-19c, as for any scene. A piece that this run's shortlist does not hold
  // is taken from the A7 catalogue when it is in stock there today; otherwise 19a leaves it out and 19g holds the edit, because the image
  // would still show it. An edit that removes the pieces needs none of this.
  const added = [], missing = [];
  const removeAll = arr(o.edit_options).some(x => x.kind === 'props' && x.value === 'Remove all');
  st.retrieval = st.retrieval || { shortlist: [], rejected: [], notes: [] };
  st.retrieval.shortlist = arr(st.retrieval.shortlist);
  let catalogue = [];
  try { catalogue = $('10a Load Midas catalogue').all().map(i => i.json).filter(r => r && r.sku); } catch (e) { catalogue = []; }
  const inStock = t => String(t || '').trim().toLowerCase() === 'in stock';
  for (const p of removeAll ? [] : edit_base.props) {
    if (st.retrieval.shortlist.some(x => String(x.sku) === p.sku)) continue;
    const r = catalogue.find(x => String(x.sku) === p.sku);
    if (!r || !r.image_url || !r.retrieved || r.active === false || !inStock(r.availability) || !/^https:\/\/(www\.)?midasfurniture\.com\/en\//i.test(String(r.url || ''))) { missing.push(p.sku); continue; }
    st.retrieval.shortlist.push({ sku: String(r.sku), name: r.name || '', kind: r.kind || '', catalogue_photo: r.image_url, url: r.url || '', dimensions: r.dimensions || 'not confirmed', finish: r.finish || 'not confirmed',
      availability: 'in_stock', availability_text: r.availability || '', retrieved_on: r.retrieved, notes: r.notes || '', from_edit_base: true });
    added.push(p.sku);
  }
  st.edit_base = { at: now, run_id: eb.run_id, output_id: eb.output_id, sha256: eb.sha256, drive_file_id: eb.drive_file_id, kind: o.kind, view: o.camera, light: o.light || '',
    changes, options: arr(o.edit_options), master_sha256: master.sha256, props: edit_base.props.map(p => p.sku), props_added_from_catalogue: added, props_not_in_stock: missing,
    checks: ['owner approval of this file and checksum in the earlier run', 'same product photo as the earlier run', 'earlier white master package with its checksum', 'earlier scene ticket for this image'] };
  st.status = 'edit_base_ready'; st.stage = '07 Scenes'; st.hold_reason = ''; st.hold_for = ''; st.client_question = ''; st.critical = [];
  st.next = 'The approved image ' + eb.output_id + ' of the earlier run is checked. Stage 07 prepares the edit next (live check of its Midas pieces, then one paid image call). No image was made yet.';
}
st.vault_only = ['edit_base', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 19, name: 'Edit base', at: now, note: st.status === 'edit_base_ready' ? eb.run_id + ' / ' + eb.output_id + (white ? ' (white master) checked; scenes start from it' : ' checked') : st.status }]);
return [{ json: st }];
