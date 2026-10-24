// Stage 06 · Manifest: what the package holds, where each file is, its checksum, the approval it rests on, the spec card,
// the draft description and the cost. Code only (16 Oct 2026). Saved next to the images as JSON. It lists the Midas accessories
// used in the delivered images: the white master shows the product alone, so there are none (scenes are not built).
const crypto = require('crypto');
const T = $('18a Package ticket').first().json;
const pk = JSON.parse(JSON.stringify($('18h Check files').first().json.pk));
const sent = $('18j Files to upload').all().map(i => i.json);
const ups = $input.all().map(i => i.json || {});
const problems = [];
const files = pk.files.map((f, i) => {
  const u = ups[i] || {};
  const s = sent[i] || {};
  const stored = Boolean(u.id && !u.error && s.name === f.file_name);
  if (!stored) problems.push('the ' + f.format + ' file was not saved in Google Drive (' + String((u.error && (u.error.message || u.error)) || 'no file id returned').slice(0, 200) + ')');
  const drive_sha256_matches = stored && u.sha256Checksum ? String(u.sha256Checksum).toLowerCase() === f.sha256 : null;
  if (drive_sha256_matches === false) problems.push('Google Drive reports a different checksum for the ' + f.format + ' file');
  return { format: f.format, file_name: f.file_name, px: f.px, bytes: f.bytes, sha256: f.sha256, mime: f.mime, quality: f.quality, saved_again: f.saved_again || '', background_check: f.background_check || null, halo_check: f.halo_check || null, drive_file_id: stored ? String(u.id) : '', link: stored ? String(u.webViewLink || '') : '', drive_sha256_matches, label: 'Generated image' };
});
const st = T.st;
const manifest = {
  manifest_version: 2,
  release: pk.approval && pk.approval.release || null,
  package: { identity_key: pk.identity_key, version: pk.version, made_at: new Date().toISOString(), output_id: pk.master.output_id, kind: 'white background', label: 'Generated image' },
  run: { run_id: st.run_id, client_run_id: st.client_run_id, contract_stamp: st.contract_stamp, contract_version: st.contract_version || 0 },
  // Owner, 16 Oct 2026, 19:26: shown_as is what the manifest and the owner's view show; approval_kind stays the audit wording.
  // Owner, 21:28: client_shown_as is what the client sees: "Approved by the studio" for an image approved by eye (never "not reviewed").
  approval: Object.assign({ decision: pk.approval && pk.approval.without_review ? 'approve_unreviewed' : 'approve', gate: 'go 2', shown_as: pk.approval && pk.approval.without_review ? 'Approved by the studio · not reviewed' : 'Approved', client_shown_as: pk.approval && pk.approval.without_review ? 'Approved by the studio' : 'Approved', note_on_review: pk.approval && pk.approval.without_review ? 'Approved by owner without an automated review: no review passed this image (the review did not answer, twice). The approval is the owner\'s recorded go 2 answer.' : 'The owner approval and automated review are separate. See release.classification and release.review_result; an exception is not a passed review.' }, pk.approval),
  master: { drive_file_id: pk.master.drive_file_id, link: pk.master.link, sha256: pk.master.sha256, px: pk.master_check ? pk.master_check.px : pk.master.px, bytes: pk.master_check ? pk.master_check.bytes : pk.master.bytes, stays_in_vault: true },
  files,
  method: pk.method,
  // P1.7 (owner D4, 16 Oct 2026): the delivery files have their background set to 255; the master is unchanged. Without a product box
  // (owner, 19:26) the background is not cleaned, the master's own background is delivered, and each skipped step is listed.
  background: { note: pk.background_note || 'background set to 255', cleaned: !(pk.white_clean && pk.white_clean.skipped), master_unchanged: true, clean: pk.white_clean || null, saved_files_checked: pk.files.map(f => ({ format: f.format, quality: f.quality, saved_again: f.saved_again || '', background_check: f.background_check || null, halo_check: f.halo_check || null })) },
  skipped_steps: Array.isArray(pk.skipped_steps) ? pk.skipped_steps : [],
  accessories_used: [],
  accessories_note: 'None: the white master shows the product alone. Scene images, which may use Midas accessories, list them in their own manifests with SKU and product link.',
  spec_card: pk.spec_card,
  description: pk.description,
  cost: pk.cost,
  not_in_package: pk.not_in_package || [],
  notes: pk.notes || []
};
const text = JSON.stringify(manifest, null, 1);
const sha = crypto.createHash('sha256').update(text).digest('hex');
pk.files = files;
pk.images_ok = problems.length === 0;
pk.manifest_sha256 = sha;
if (!pk.images_ok) { pk.ok = false; pk.problem = 'The package is incomplete: ' + problems.join('; ') + '. The manifest and the identity entry were not saved.'; }
const out = { json: { pk, manifest_name: pk.manifest_name, folder_id: (sent[0] || {}).folder_id || '' } };
if (pk.images_ok) out.binary = { file: await this.helpers.prepareBinaryData(Buffer.from(text, 'utf8'), pk.manifest_name, 'application/json') };
return [out];
