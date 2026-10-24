if($input.first().json.reader_recovery===true)return [$input.first()];
// Step 2 · Eye ingest: register every file with its role and sha256. Permanent storage is not connected yet.
const crypto = require('crypto');
function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function roleOf(label) {
  const r = text(label).toLowerCase();
  if (!r) return '';
  if (r.indexOf('room') !== -1 || r.indexOf('space') !== -1 || r.indexOf('target') !== -1) return 'room';
  if (r.indexOf('look') !== -1 || r.indexOf('inspiration') !== -1) return 'look';
  if (r.indexOf('previous') !== -1 || r.indexOf('result') !== -1 || r.indexOf('generation') !== -1) return 'previous';
  if (r.indexOf('view') !== -1 || r.indexOf('angle') !== -1) return 'other_view';
  if (r.indexOf('spec') !== -1 || r.indexOf('sheet') !== -1 || r.indexOf('excel') !== -1 || r.indexOf('document') !== -1) return 'spec';
  if (r.indexOf('product') !== -1 || r.indexOf('vendor') !== -1) return 'product';
  return 'other';
}
const item = $input.first();
const s = item.json;
if (s.usable !== 'ok') return [{ json: s, binary: item.binary }];
const bin = item.binary || {};
const keys = Object.keys(bin);
const roles = s.brief.reference_roles || [];
const taken = {};
const refs = [];
const written = [];
const notApplied = s.not_applied.slice();
const problems = s.problems.slice();
for (const key of keys) {
  const b = bin[key] || {};
  const name = text(b.fileName) || key;
  let label = '';
  for (let r = 0; r < roles.length; r++) if (!label && !taken[r] && roles[r].name === name) { label = roles[r].role; taken[r] = true; }
  let role = roleOf(label);
  const mime = text(b.mimeType);
  const isImage = mime.indexOf('image/') === 0;
  if (!role) role = (isImage && !refs.some(x => x.role === 'product')) ? 'product' : 'unassigned';
  let sha = '', bytes = 0;
  try { const buf = await this.helpers.getBinaryDataBuffer(0, key); bytes = buf.length; sha = crypto.createHash('sha256').update(buf).digest('hex'); } catch (e) { sha = ''; }
  const ref = { key, name, role, mime, bytes, sha256: sha, image: isImage, stored: 'not stored: permanent storage is not connected yet' };
  if (!isImage && role !== 'spec') ref.note = 'not an image';
  // Written files about the product are read when they are text. PDF, Excel and Word need an extract step that is not built yet.
  const textLike = mime.indexOf('text/') === 0 || mime === 'application/json' || /\.(txt|csv|tsv|md|json)$/i.test(name);
  if (!isImage && (role === 'spec' || role === 'unassigned' || role === 'other') && textLike) {
    let t = '';
    try { const buf = await this.helpers.getBinaryDataBuffer(0, key); t = buf.toString('utf8'); } catch (e) { t = ''; }
    let o = ''; for (let i = 0; i < t.length && o.length < 8000; i++) { const c = t.charCodeAt(i); o += (c < 32 && c !== 10) ? ' ' : t.charAt(i); }
    if (o.trim()) { written.push({ name, text: o.trim() }); ref.read = 'read as text'; if (role === 'unassigned') role = ref.role = 'spec'; }
  }
  if (role === 'spec' && !ref.read) { ref.read = 'not read'; notApplied.push('Written file registered but not read yet (PDF, Excel and Word need an extract step): ' + name); }
  if (role === 'unassigned') notApplied.push('File has no role and was not used: ' + name);
  if (bytes > 25 * 1024 * 1024) { ref.note = 'larger than 25 MB'; problems.push('A file is larger than 25 MB: ' + name); }
  refs.push(ref);
}
const product = refs.find(r => r.role === 'product' && r.image && r.sha256);
const room = refs.find(r => r.role === 'room' && r.image && r.sha256);
if (!product) problems.push('Add at least one product photo.');
const stamp = new Date().toISOString();
return [{
  json: {
    ...s, references: refs, written_files: written, product_key: product ? product.key : '', room_key: room ? room.key : '',
    usable: problems.length ? 'refuse' : 'ok', problems, not_applied: notApplied,
    trail: s.trail.concat([{ step: 2, name: 'Ingest', at: stamp, note: refs.length + ' files registered; ' + written.length + ' written files read; storage not connected' }])
  },
  binary: item.binary
}];
