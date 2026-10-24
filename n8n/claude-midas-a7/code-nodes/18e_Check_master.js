// Stage 06 · Check the master before anything is made from it. Code only (16 Oct 2026).
// The file downloaded from Drive must be byte for byte the master the owner approved (same sha256). It must be square and at least
// 1125 px: it is never stretched, cropped or upscaled. Also reads the identity vault (package version, no double package) and the
// operations table (cost of the image calls for this run). Positive proof: a table must answer with real rows or with nothing.
const crypto = require('crypto');
const T = $('18a Package ticket').first().json;
const pk = JSON.parse(JSON.stringify(T.pk));
const arr = x => (Array.isArray(x) ? x : []);
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/(\b(authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const problems = [], notes = [];
function kindOf(b) { return !b || b.length < 32 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))); }
function pixels(b) {
  try {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let p = 2;
      while (p + 9 < b.length) {
        if (b[p] !== 0xff) { p++; continue; }
        const mk = b[p + 1];
        if (mk >= 0xc0 && mk <= 0xcf && [0xc4, 0xc8, 0xcc].indexOf(mk) === -1) return [b.readUInt16BE(p + 7), b.readUInt16BE(p + 5)];
        p += 2 + b.readUInt16BE(p + 2);
      }
    }
    if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const f = b.toString('ascii', 12, 16);
      if (f === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (f === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (f === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    }
  } catch (e) { /* not read */ }
  return null;
}
// 1. Identity vault: earlier packages of this product.
const idItems = $('18b Load identity').all().map(i => i.json);
const idOk = idItems.length > 0 && idItems.every(r => r && !r.error && (Object.keys(r).length === 0 || (r.identity_key && r.id !== undefined)));
const idRows = idOk ? idItems.filter(r => r && r.identity_key === pk.identity_key) : [];
if (!idOk) problems.push('the identity vault could not be read, so the package version and an earlier package of this master cannot be checked');
const same = idRows.find(r => String(r.master_sha256) === pk.master.sha256);
if (same) problems.push('this approved master is already packaged as version ' + same.package_version + ' (identity row ' + same.id + '); a package is not made twice');
const version = idRows.reduce((m, r) => Math.max(m, Number(r.package_version) || 0), 0) + 1;
// 2. Cost of the image calls of this run (operations table): every call that was or may have been charged, repairs included.
const opItems = $('18c Load operations').all().map(i => i.json);
const opOk = opItems.length > 0 && opItems.every(r => r && !r.error && (Object.keys(r).length === 0 || (r.operation_key && r.id !== undefined)));
const SENT = ['submitted', 'completed', 'failed', 'uncertain', 'uncertain_no_id', 'completed_no_image', 'completed_not_stored', 'completed_bad_image', 'receipt_unreadable'];
const ops = opOk ? opItems.filter(r => r && r.run_id === T.st.run_id && SENT.indexOf(String(r.status)) !== -1) : [];
const usd = r => (r.actual_usd !== null && r.actual_usd !== undefined && r.actual_usd !== '' ? Number(r.actual_usd) || 0 : Number(r.reserved_usd) || 0);
const cost = opOk ? {
  image_calls: ops.length, usd: Number(ops.reduce((t, r) => t + usd(r), 0).toFixed(4)), per_accepted_package_usd: Number(ops.reduce((t, r) => t + usd(r), 0).toFixed(4)),
  calls: ops.map(r => ({ operation_key: r.operation_key, attempt: r.attempt, status: r.status, usd: usd(r), basis: String(r.cost_basis || '').slice(0, 200) })),
  basis: 'Image calls of this run only (every attempt, repairs included), from Google\'s token counts x the registry prices; an estimate, not an invoice. The text and vision calls are counted apart (text_usd, below).'
} : { image_calls: null, usd: null, per_accepted_package_usd: null, calls: [], basis: 'not known: the operations table could not be read' };
if (!opOk) notes.push('The operations table could not be read, so the cost per package is not known.');
// P1.8 (16 Oct 2026): the text and vision calls of this run (readers, conflict check, planner, plan critic, reviews), from the providers'
// token counts. A call without token counts is listed as not priced, never counted as zero.
const tcs = arr(T.st.text_calls);
const priced = tcs.filter(c => c && c.usd !== null && c.usd !== undefined);
cost.text_calls = tcs.length;
cost.text_calls_priced = priced.length;
cost.text_usd = priced.length ? Number(priced.reduce((t, c) => t + Number(c.usd || 0), 0).toFixed(4)) : null;
cost.all_usd = cost.usd !== null && cost.text_usd !== null ? Number((cost.usd + cost.text_usd).toFixed(4)) : null;
cost.text_basis = tcs.length ? priced.length + ' of ' + tcs.length + ' text and vision call(s) priced from their token counts (prices read ' + ((T.st.text_prices && T.st.text_prices.read_on) || '?') + '); ' + (tcs.length - priced.length) + ' without token counts, not counted; an estimate, not an invoice' : 'no text or vision call was recorded on this run (runs before 16 Oct 2026, P1.8, do not record them)';
// A recovered continuation restores the authoritative complete historical ledger.
// It includes uncertain reservations without treating them as settled charges.
if (T.st.package_cost_history) {
  const h = T.st.package_cost_history;
  if (h.source !== 'A7 retained budget ledger' || h.currency !== 'USD' || !Array.isArray(h.operations) || new Set(h.operations.map(o=>o.operation_key)).size !== h.operation_count || !Number.isSafeInteger(Math.round(h.all_usd * 1e6)) || Math.round(h.operations.reduce((s,o)=>s+o.accounted_micro_usd,0)) !== Math.round(h.all_usd * 1e6)) problems.push('the restored historical cost ledger does not reconcile');
  else Object.assign(cost, h);
}
// 3. The master itself.
const inp = $input.first() ? $input.first().json : {};
let buf = null;
try { buf = await this.helpers.getBinaryDataBuffer(0, 'data'); } catch (e) { buf = null; }
let master = null;
if (!buf || !buf.length) problems.push('the approved master could not be downloaded from Drive (' + clean((inp && inp.error && (inp.error.message || inp.error)) || 'no file data') + ')');
else {
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const kind = kindOf(buf), px = kind ? pixels(buf) : null;
  master = { sha256: sha, bytes: buf.length, mime: kind, px: px ? px[0] + 'x' + px[1] : 'not read' };
  if (sha !== pk.master.sha256) problems.push('the file in Drive is not the master the owner approved (its checksum differs); it may have been changed or replaced');
  else if (!kind || !px) problems.push('the master is not a readable PNG, JPEG or WebP image');
  else {
    const [w, h] = px, size = pk.cfg.size_px;
    if (Math.abs(w - h) > Math.max(w, h) * pk.cfg.square_tolerance_pct / 100) problems.push('the master is ' + w + ' x ' + h + ', not square; making ' + size + ' x ' + size + ' from it would stretch or crop the product');
    else if (Math.min(w, h) < size) problems.push('the master is ' + w + ' x ' + h + ', smaller than ' + size + ' px; it is never upscaled');
    else if (Math.max(w, h) !== 2048) notes.push('The master is ' + w + ' x ' + h + ', not 2048 x 2048; it is resized as it is.');
  }
}
pk.version = version;
pk.files = pk.cfg.formats.map(f => ({ format: f, file_name: pk.base + '_white_' + pk.cfg.size_px + '_v' + version + '.' + f }));
pk.manifest_name = pk.base + '_manifest_v' + version + '.json';
pk.folder_name = pk.base + ' · package v' + version;
pk.master_check = master;
pk.cost = cost;
pk.notes = arr(pk.notes).concat(notes);
const ok = problems.length === 0;
pk.ok = ok;
pk.problem = ok ? '' : 'The package was not made: ' + problems.join('; ') + '. Nothing was resized or uploaded.';
const out = { json: { pk } };
if (ok) out.binary = { data: $input.first().binary.data };
return [out];
