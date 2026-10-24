// Stage 06 · Package ticket. Code only (16 Oct 2026).
// Runs only after the owner's go 2 "approve" (status white_master_approved). Builds what the package needs from recorded facts:
// the approved master (Drive file and checksum), the names of the delivery files, the identity key, a spec card and a draft description.
// Nothing here is guessed: a field with no supplied value says "not confirmed". Photo readings are model readings, kept internal only.
let source;try { source = $('Package · Restored approval').first().json; } catch { source = $('V1 Vault events').first().json; }
const st = JSON.parse(JSON.stringify(source));
delete st.events; delete st.row;
const arr = x => (Array.isArray(x) ? x : []);
const clean = (v, n) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 300));
const now = new Date().toISOString();
let set = {}, framing = {};
try { const s04 = $('04 Settings').first().json || {}; set = s04.package || {}; framing = s04.framing || {}; } catch (e) { set = {}; framing = {}; }
// fit_span_pct: the white-master framing setting, used by 18e3 only when a master is framed too tight to clean (20 Oct 2026).
const cfg = { size_px: Number(set.size_px) || 1125, formats: ['jpg', 'webp'], jpg_quality: Number(set.jpg_quality) || 92, square_tolerance_pct: Number(set.square_tolerance_pct) || 1, fit_span_pct: Number(framing.white_span_pct) || 76 };
const problems = [];
// 1. The approval must be the owner's recorded go 2 answer on this run.
const ap = st.approved || null;
const last = st.go2_last || {};
const cand = ap && ap.candidate ? ap.candidate : null;
if (st.status !== 'white_master_approved') problems.push('the run is not in the state "white master approved"');
// approve_unreviewed (owner, 16 Oct 2026, D3) is also the owner's approval; the package records that no automated review passed it.
if (!ap || ap.by !== 'owner' || ['approve', 'approve_unreviewed'].indexOf(last.decision) === -1 || last.by !== 'owner') problems.push('the owner\'s go 2 approval is not recorded on this run');
if (!cand || !cand.drive_file_id || !/^[0-9a-f]{64}$/.test(String(cand.sha256 || ''))) problems.push('the approved master has no Drive file or no checksum');
if (!st.contract_stamp) problems.push('the run has no locked contract');
// Packaging must not carry an approval onto changed bytes or a changed contract.
if (ap && (!ap.release || ap.release.candidate_sha256 !== (cand && cand.sha256) || ap.release.output_id !== ap.output_id || ap.release.contract_stamp !== st.contract_stamp || ap.release.run_id !== st.run_id)) problems.push('the approval release record is missing or belongs to different bytes, output, run or contract; obtain a fresh owner approval');
// 2. Identity key: the SKU when the client gave one, otherwise the checksum of the vendor photo (the same photo means the same product).
const brief = st.brief || {};
const sku = clean(brief.sku, 60);
const vendor = arr(st.references).find(r => r && r.key === st.product_key && r.sha256) || arr(st.references).find(r => r && r.role === 'product' && r.sha256) || null;
const identity_key = sku ? 'sku:' + sku : (vendor ? 'photo:' + vendor.sha256 : '');
if (!identity_key) problems.push('no SKU and no vendor photo checksum, so the product has no identity key');
const base = (sku || clean(st.client_run_id, 60) || 'midas').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'midas';
// 3. Spec card: confirmed facts only. Each field says where its value comes from.
const inv = arr(st.inventory).filter(x => x && x.item);
const total = inv.reduce((t, x) => t + (Number(x.count) || 0), 0);
const NC = 'not confirmed';
const supplied = (v, src) => (clean(v) ? { value: clean(v), source: src } : { value: NC, source: 'no value supplied' });
const invBasis = inv.length && inv.every(x => x.basis === 'supplied') ? 'supplied in the brief and locked in the contract' : 'locked in the contract at the owner\'s go 1';
const fields = [
  Object.assign({ field: 'Product' }, supplied(brief.product_type, 'supplied in the brief')),
  Object.assign({ field: 'SKU' }, supplied(sku, 'supplied in the brief')),
  { field: 'Pieces', value: inv.length ? total + ' (' + inv.map(x => x.count + ' x ' + clean(x.item, 80)).join('; ') + ')' : NC, source: inv.length ? invBasis : 'no inventory' },
  { field: 'Excluded pieces', value: arr(st.exclusions).map(x => clean((x && x.item) || x, 80)).filter(Boolean).join('; ') || 'none', source: 'the contract' },
  Object.assign({ field: 'Colour' }, supplied(brief.colour, 'supplied in the brief')),
  Object.assign({ field: 'Material' }, supplied(brief.material, 'supplied in the brief')),
  Object.assign({ field: 'Dimensions' }, supplied(brief.dimensions, 'supplied in the brief'))
];
const obs = st.observation || {};
const spec_card = {
  fields,
  // Model readings of the photo: never shown to clients and never written as product facts (owner, 21:48: photo dimensions are an internal estimate only).
  internal_only: { label: 'Photo readings by models; not product facts; internal only', colour_read: clean(obs.colour_observed, 120), material_read: clean(obs.material_appearance, 120), dimensions_from_photos: 'not made (owner setting: internal estimate only)' },
  unknowns: arr(st.unknowns).map(u => clean((u && u.what) || u, 120)).filter(Boolean)
};
// 4. Draft description: one paragraph from the confirmed fields only. English; not reviewed; no Arabic yet.
// Wording (owner, 16 Oct 01:40: "tidy wording only"): plurals, a capital first letter, "and" before the last item. Supplied values are
// copied as written (case and spelling unchanged); only the piece names get a plural ending when the count is above 1.
const val = f => fields.find(x => x.field === f).value;
const missing = ['Colour', 'Material', 'Dimensions'].filter(f => val(f) === NC).map(f => f.toLowerCase());
const andList = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const plural = (name, n) => {
  if (n === 1) return name;
  const m = name.match(/^(.*?)([A-Za-z]+)(\W*)$/);
  if (!m) return name;
  const w = m[2], lw = w.toLowerCase();
  // Adjectives used alone ("armless", "fitted") and words already plural stay as written.
  if (/(less|ed|ing|al|ic|ous|ful|ive)$/.test(lw) || /(ss|us|is)$/.test(lw) === false && /s$/.test(lw)) return name;
  const p = /(s|x|z|ch|sh)$/.test(lw) ? w + 'es' : (/[^aeiou]y$/.test(lw) ? w.slice(0, -1) + 'ies' : (/(shelf|leaf)$/.test(lw) ? w.slice(0, -1) + 'ves' : w + 's'));
  return m[1] + p + m[3];
};
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pieceList = inv.map(x => (Number(x.count) || 0) + ' ' + plural(clean(x.item, 80), Number(x.count) || 0));
const product = val('Product') !== NC ? val('Product') : 'Product';
const descParts = [];
if (!inv.length) descParts.push(cap(product) + '.');
else if (total === 1 && inv.length === 1 && clean(inv[0].item, 80).toLowerCase() === product.toLowerCase()) descParts.push(cap(product) + ', 1 piece.');
else descParts.push(cap(product) + (total === 1 ? ', 1 piece: ' : ' in ' + total + ' pieces: ') + andList(pieceList) + '.');
for (const f of ['Colour', 'Material', 'Dimensions']) if (val(f) !== NC) descParts.push(f + ': ' + val(f) + '.');
if (missing.length) descParts.push('Not confirmed: ' + andList(missing) + '.');
const description = { text: descParts.join(' '), label: 'Draft text from recorded facts only. English. Not reviewed for publication; Arabic not written.' };
const pk = {
  ok: problems.length === 0, problem: problems.length ? 'The package was not made: ' + problems.join('; ') + '.' : '',
  cfg, identity_key, base, at: now,
  master: cand ? { output_id: ap.output_id, attempt: ap.attempt, drive_file_id: cand.drive_file_id, folder_id: cand.folder_id || '', link: cand.link || '', sha256: cand.sha256, px: cand.px || '', bytes: cand.bytes || 0, file_name: cand.file_name || '' } : null,
  approval: ap ? { by: 'owner', at: ap.at, attempt: ap.attempt, note: clean(ap.note, 300), review_result: ap.review_result || 'unknown', without_review: ap.without_review === true, release: ap.release || null, approval_kind: ap.approval_kind || 'approved by the owner', shown_as: ap.shown_as || (ap.without_review === true ? 'Approved by the studio · not reviewed' : 'Approved'), client_shown_as: ap.client_shown_as || (ap.without_review === true ? 'Approved by the studio' : 'Approved') } : null,
  spec_card, description, // file names are made once the version is known (18e)
  // Review finding 1 (16 Oct 2026): the product box from the approved review; 18e3 changes nothing inside it, and holds without it.
  product_box_2d: ap && Array.isArray(ap.product_box_2d) ? ap.product_box_2d : null
};
pk.required_outputs = arr(st.outputs || brief.outputs).map(o => ({ id: o.id, kind: o.kind }));
pk.not_in_package = pk.required_outputs.filter(o => o.id !== (ap && ap.output_id)).map(o => o.id + ' (' + o.kind + '): ' + (o.kind === 'variation' ? 'not built yet' : 'a scene image, made in stage 07 after this package; not in this package'));
return [{ json: { st, pk } }];
