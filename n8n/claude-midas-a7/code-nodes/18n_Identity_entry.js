// Stage 06 · Identity vault entry: one row per package of a product, keyed by SKU (or by the vendor photo checksum when there is no SKU).
// Code only (16 Oct 2026). Written only when both images and the manifest are saved; it records the approved master and the delivery
// files by checksum, so a later stage (or VTON) can read exactly what the owner approved and nothing else.
const T = $('18a Package ticket').first().json;
const pk = JSON.parse(JSON.stringify($('18l Manifest').first().json.pk));
const u = $input.first() ? $input.first().json : {};
const stored = Boolean(u.id && !u.error);
if (!stored) {
  pk.ok = false;
  pk.problem = 'The package is incomplete: the manifest was not saved in Google Drive (' + String((u.error && (u.error.message || u.error)) || 'no file id returned').slice(0, 200) + '). The two images are in Drive; the identity entry was not written.';
  return [{ json: { entry_ready: false, pk } }];
}
pk.manifest = { file_name: pk.manifest_name, drive_file_id: String(u.id), link: String(u.webViewLink || ''), sha256: pk.manifest_sha256 };
const f = fmt => pk.files.find(x => x.format === fmt) || {};
const st = T.st;
const row = {
  identity_key: pk.identity_key, package_version: pk.version, run_id: st.run_id, client_run_id: st.client_run_id,
  sku: (pk.spec_card.fields.find(x => x.field === 'SKU') || {}).value || 'not confirmed',
  product_type: (pk.spec_card.fields.find(x => x.field === 'Product') || {}).value || 'not confirmed',
  contract_stamp: st.contract_stamp || '', approved_by: 'owner', approved_at: pk.approval.at, approved_attempt: Number(pk.approval.attempt) || 0,
  master_sha256: pk.master.sha256, master_drive_id: pk.master.drive_file_id,
  jpg_sha256: f('jpg').sha256 || '', jpg_drive_id: f('jpg').drive_file_id || '', webp_sha256: f('webp').sha256 || '', webp_drive_id: f('webp').drive_file_id || '',
  manifest_sha256: pk.manifest_sha256, manifest_drive_id: pk.manifest.drive_file_id,
  spec_card: JSON.stringify(pk.spec_card).slice(0, 20000),
  cost_usd: pk.cost && pk.cost.usd !== null ? pk.cost.usd : null, cost_basis: pk.cost ? String(pk.cost.basis).slice(0, 500) : '',
  status: 'white_package_ready', at: new Date().toISOString()
};
return [{ json: { entry_ready: true, pk, row } }];
