// Stage 07 · Scene files result (step 20): the state that goes to the vault and the run row. Code only (16 Oct 2026).
// "scene_files_ready" only when both images and the manifest are saved. Any other stop records the scene's files as held for the
// owner, with the reason, and the next scene still starts; at the end the run holds for the owner while any scene's files are held
// (19a). An incomplete set of files is never called complete. This step makes no AI call and no paid call.
// These nodes run once per approved scene in the same execution, so only results stamped with this ticket's time are used.
const get = n => { try { return $(n).first().json; } catch (e) { return null; } };
const T = get('20a Scene files ticket');
const st = JSON.parse(JSON.stringify(T.st));
const ticket = T.sf;
const inp = $input.first() ? $input.first().json : {};
const now = new Date().toISOString();
const arr = x => (Array.isArray(x) ? x : []);
const mine = j => Boolean(j && j.sf && j.sf.at === ticket.at && j.sf.output_id === ticket.output_id);
let sf = ticket;
let manifestSaved = false;
if (inp && inp.sf) sf = mine(inp) ? inp.sf : Object.assign({}, ticket, { ok: false, problem: 'The scene files step returned a result that does not belong to this scene, so nothing is recorded as made.' });
else if (inp && inp.skip) {
  const f = get('20f Check scene files');
  sf = mine(f) ? f.sf : ticket;
  sf = Object.assign({}, sf, { ok: false, problem: inp.ticket_at === ticket.at ? inp.problem : 'The upload step returned a result that does not belong to this scene, so nothing is recorded as made.' });
} else {
  // Coming from the manifest upload.
  const k = get('20k Scene manifest');
  if (mine(k)) {
    sf = k.sf;
    manifestSaved = Boolean(inp && inp.id && !inp.error);
    if (!manifestSaved) sf = Object.assign({}, sf, { ok: false, problem: 'The scene files are incomplete: the two images are in Google Drive, but the manifest could not be saved (' + String((inp && inp.error && (inp.error.message || inp.error)) || 'no file id returned').slice(0, 200) + ').' });
  } else sf = Object.assign({}, ticket, { ok: false, problem: 'The manifest step did not run for this scene, so nothing is recorded as made.' });
}
sf = JSON.parse(JSON.stringify(sf));
const ready = Boolean(manifestSaved && sf.ok !== false && sf.images_ok === true);
const id = ticket.output_id;
const record = {
  release: sf.approval && sf.approval.release || null,
  status: ready ? 'ready' : 'held', at: now, problem: ready ? '' : (sf.problem || 'The scene files stopped without a recorded reason.'),
  too_small: Boolean(sf.too_small),
  master: sf.master, master_check: sf.master_check || null, target: sf.target || null, planned_shape: sf.planned ? sf.planned.shape : '',
  folder_name: sf.folder_name || '', files: arr(sf.files).map(f => ({ format: f.format, file_name: f.file_name, px: f.px || '', bytes: f.bytes || 0, sha256: f.sha256 || '', drive_file_id: f.drive_file_id || '', link: f.link || '', label: 'Generated image' })),
  manifest_name: sf.manifest_name || '', manifest_sha256: ready ? sf.manifest_sha256 : '', manifest_drive_file_id: ready ? String(inp.id) : '',
  midas_pieces: arr(sf.midas_pieces), method: sf.method || '', notes: arr(sf.notes), ai_or_paid_calls: 'none'
};
st.scene_files = Object.assign({ output_id: id }, record);
if (id && st.scenes && st.scenes.done && st.scenes.done[id]) {
  st.scenes.done[id].files = record;
  st.scenes.log = arr(st.scenes.log).concat([{ output_id: id, event: ready ? 'delivery files made' : 'delivery files held', at: now }]);
}
const size = sf.target ? sf.target.w + ' x ' + sf.target.h : '';
if (ready) {
  st.status = 'scene_files_ready'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.next = 'Scene ' + id + ': its delivery files are in Google Drive: ' + size + ' jpg and webp (short side 1125 px, the image\'s own shape, resized without AI) and a manifest' + (record.midas_pieces.length ? ' listing the ' + record.midas_pieces.length + ' Midas piece(s) in the scene with their SKU and page' : '') + '. Each image is a "Generated image". The next scene starts, if any is left.';
} else if (id && st.scenes && st.scenes.done && st.scenes.done[id]) {
  // The scene stays approved; only its files are held. The run goes on to the next scene and holds at the end (19a).
  st.status = 'scene_files_held'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.next = 'Scene ' + id + ' is approved, but its delivery files are held for the owner: ' + record.problem + ' The approved scene is unchanged in Google Drive. The next scene starts, if any is left; the run then waits for the owner about these files.';
} else {
  st.status = 'hold'; st.hold_for = 'owner'; st.client_question = ''; st.hold_step = 20; st.hold_reason = record.problem;
  st.critical = [{ what: 'scene_files', who: 'owner', why: record.problem }];
  st.next = 'Waiting for the owner: ' + record.problem + ' No AI or paid call was made in this step.';
}
st.stage = '07 Scenes';
st.vault_only = ['scene_files', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 20, name: 'Scene files', at: now, note: (id || 'no scene') + ': ' + (ready ? size + ' jpg + webp + manifest' : 'held: ' + String(record.problem).slice(0, 160)) }]);
return [{ json: st }];
