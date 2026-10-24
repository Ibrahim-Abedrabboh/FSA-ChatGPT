// Stage 07 · Scene manifest (step 20): what the scene's files are, where each one is, its checksum, the approval it rests on, and
// the Midas pieces in the scene with their SKU and page. Code only (16 Oct 2026). Saved next to the images as JSON.
const crypto = require('crypto');
const T = $('20a Scene files ticket').first().json;
const sf = JSON.parse(JSON.stringify($('20f Check scene files').first().json.sf));
const sent = $('20h Scene files to upload').all().map(i => i.json);
const ups = $input.all().map(i => i.json || {});
const problems = [];
const files = sf.files.map((f, i) => {
  const u = ups[i] || {};
  const s = sent[i] || {};
  const stored = Boolean(u.id && !u.error && s.name === f.file_name);
  if (!stored) problems.push('the ' + f.format + ' file was not saved in Google Drive (' + String((u.error && (u.error.message || u.error)) || 'no file id returned').slice(0, 200) + ')');
  const drive_sha256_matches = stored && u.sha256Checksum ? String(u.sha256Checksum).toLowerCase() === f.sha256 : null;
  if (drive_sha256_matches === false) problems.push('Google Drive reports a different checksum for the ' + f.format + ' file');
  return { format: f.format, file_name: f.file_name, px: f.px, bytes: f.bytes, sha256: f.sha256, mime: f.mime, drive_file_id: stored ? String(u.id) : '', link: stored ? String(u.webViewLink || '') : '', drive_sha256_matches, label: 'Generated image' };
});
const st = T.st;
const manifest = {
  manifest_version: 2,
  release: sf.approval && sf.approval.release || null,
  scene: { output_id: sf.output_id, kind: sf.kind, planned_shape: sf.planned ? sf.planned.shape : 'not recorded', made_at: new Date().toISOString(), label: 'Generated image' },
  run: { run_id: st.run_id, client_run_id: st.client_run_id, contract_stamp: st.contract_stamp, contract_version: st.contract_version || 0 },
  // Owner, 16 Oct 2026, 21:28: a scene approved by eye is shown as "Approved by the studio · not reviewed" here and in the owner's view;
  // the client sees "Approved by the studio" (client_shown_as). approval_kind stays the audit wording.
  approval: Object.assign({ decision: sf.approval && sf.approval.without_review ? 'approve_unreviewed' : 'approve', gate: 'go 2', shown_as: sf.approval && sf.approval.without_review ? 'Approved by the studio · not reviewed' : 'Approved', client_shown_as: sf.approval && sf.approval.without_review ? 'Approved by the studio' : 'Approved', note_on_review: sf.approval && sf.approval.without_review ? 'Approved by owner without an automated review: no review passed this image (the review did not answer, twice). The approval is the owner\'s recorded go 2 answer.' : 'The owner approval and automated review are separate. See release.classification and release.review_result; an exception is not a passed review.' }, sf.approval),
  master: { drive_file_id: sf.master.drive_file_id, link: sf.master.link, sha256: sf.master.sha256, px: sf.master_check ? sf.master_check.px : sf.master.px, bytes: sf.master_check ? sf.master_check.bytes : sf.master.bytes, stays_in_vault: true },
  files,
  method: sf.method,
  midas_pieces: sf.midas_pieces,
  midas_pieces_note: sf.midas_pieces.length ? 'Every piece is a Midas product with its SKU and page, confirmed in stock on its live Midas page at scene time (stock reading and time per piece). Availability may have changed since.' : 'No Midas piece is in this scene.',
  midas_pieces_left_out: sf.midas_pieces_left_out,
  notes: sf.notes || []
};
const text = JSON.stringify(manifest, null, 1);
const sha = crypto.createHash('sha256').update(text).digest('hex');
sf.files = files;
sf.images_ok = problems.length === 0;
sf.manifest_sha256 = sha;
if (!sf.images_ok) { sf.ok = false; sf.problem = 'The scene files are incomplete: ' + problems.join('; ') + '. The manifest was not saved.'; }
const out = { json: { sf, manifest_name: sf.manifest_name, folder_id: (sent[0] || {}).folder_id || '' } };
if (sf.images_ok) out.binary = { file: await this.helpers.prepareBinaryData(Buffer.from(text, 'utf8'), sf.manifest_name, 'application/json') };
return [out];
