// Model test · one call · Read Google's answer: the image, its checksum and pixel size, and the cost from Google's token counts. Code only (15 Oct 2026).
// One synchronous call, not stored at Google. A refusal before start is not charged (not confirmed). Anything else may be charged and is never sent again.
const crypto = require('crypto');
const o = $('C1 Check order').first().json.order;
const R = $('C6 Ready check').first().json;
const nowD = new Date(); const now = nowD.toISOString();
const arr = x => (Array.isArray(x) ? x : []);
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const r = $input.first() ? $input.first().json : {};
const code = Number(r && r.statusCode) || 0;
const body = r && r.body && typeof r.body === 'object' ? r.body : {};
const seconds = Math.max(0, Math.round((nowD - new Date(R.sent_at)) / 1000));
const gErr = body.error ? (body.error.status ? body.error.status + ': ' : '') + (body.error.message || '') : '';
const rawId = String(body.id || '').replace(/^interactions\//, '');
const rid = /^[A-Za-z0-9_.\-]{1,200}$/.test(rawId) ? rawId : clean(rawId).slice(0, 120);
const TERMINAL = ['completed', 'failed', 'cancelled', 'incomplete', 'requires_action'];
function findImage(x) {
  const steps = arr(x && x.steps);
  for (let i = steps.length - 1; i >= 0; i--) {
    const st = steps[i];
    if (!st || st.type !== 'model_output') continue; // thoughts and other steps are skipped
    const blocks = arr(st.content);
    for (let j = blocks.length - 1; j >= 0; j--) { const b = blocks[j]; if (b && b.type === 'image' && (b.data || b.uri)) return b; }
  }
  if (x && x.output_image && (x.output_image.data || x.output_image.uri)) return x.output_image;
  return null;
}
function pixels(b) {
  try {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let p = 2;
      while (p + 9 < b.length) {
        if (b[p] !== 0xff) { p++; continue; }
        const mk = b[p + 1];
        if (mk >= 0xc0 && mk <= 0xcf && [0xc4, 0xc8, 0xcc].indexOf(mk) === -1) return b.readUInt16BE(p + 7) + 'x' + b.readUInt16BE(p + 5);
        p += 2 + b.readUInt16BE(p + 2);
      }
    }
    if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const f = b.toString('ascii', 12, 16);
      if (f === 'VP8X') return (1 + b.readUIntLE(24, 3)) + 'x' + (1 + b.readUIntLE(27, 3));
      if (f === 'VP8 ') return (b.readUInt16LE(26) & 0x3fff) + 'x' + (b.readUInt16LE(28) & 0x3fff);
      if (f === 'VP8L') { const v = b.readUInt32LE(21); return (1 + (v & 0x3fff)) + 'x' + (1 + ((v >> 14) & 0x3fff)); }
    }
  } catch (e) { /* not read */ }
  return 'not read';
}
function cost(u) {
  const p = o.prices;
  const byMod = (a, mod) => arr(a).filter(x => x && String(x.modality).toLowerCase() === mod).reduce((t, x) => t + (Number(x.tokens) || 0), 0);
  const inTok = Number(u && u.total_input_tokens) || 0;
  const outTok = Number(u && u.total_output_tokens) || 0;
  if (!inTok && !outTok) return { usd: Number(o.reserve_usd), basis: 'Google reported no token counts; the reserved estimate is kept (USD ' + o.reserve_usd + '; estimate, not an invoice).' };
  const img = byMod(u.output_tokens_by_modality, 'image');
  const thought = Number(u.total_thought_tokens) || 0;
  const text = Math.max(0, outTok - img);
  const usd = (inTok * p.input + img * p.image_out + (text + thought) * p.text_out) / 1e6;
  return { usd: Number(usd.toFixed(4)), basis: 'computed from Google\'s token counts (input ' + inTok + ', image ' + img + ', text ' + text + ', thinking ' + thought + ') x registry prices dated ' + o.price_date + '; not an invoice' };
}
let status = '', problem = '', it = null, c = null, img = null, imgBuf = null, imgMime = '';
if (code >= 200 && code < 300) {
  const ps = String(body.status || '');
  if (TERMINAL.indexOf(ps) !== -1) it = body;
  else if (!ps && findImage(body)) { it = Object.assign({}, body, { status: 'completed' }); problem = 'Google\'s answer had no status field but held an image. '; }
  else if (ps) { status = 'uncertain'; problem = 'Google answered with status "' + ps + '" and no final result. The call may be charged. It is not sent again; the request was not stored at Google, so it cannot be fetched later.'; }
  else { status = 'receipt_unreadable'; problem = 'Google answered (HTTP ' + code + ') with no status and no image. The call may be charged. It is not sent again.'; }
} else if (code >= 400 && code < 500 && [408, 409, 499].indexOf(code) === -1) { status = 'failed_not_started'; problem = 'Google refused the request before starting (HTTP ' + code + (gErr ? ', ' + clean(gErr) : '') + '). No charge is expected (not confirmed). It is not sent again by itself.'; }
else if (code >= 400) { status = 'uncertain'; problem = 'Google returned an error that does not prove the request never started (HTTP ' + code + (gErr ? ', ' + clean(gErr) : '') + '). The call may be charged. It is not sent again.'; }
else { status = 'uncertain'; problem = 'No answer from Google (a time-out or a connection error)' + (r && r.error ? ' (' + clean(r.error.message || r.error) + ')' : '') + '. The call may be charged. It is not sent again.'; }
if (it) {
  try {
    c = cost(it.usage);
    const ps = String(it.status);
    if (ps === 'completed') {
      const b = findImage(it);
      const buf = b && b.data ? Buffer.from(String(b.data), 'base64') : null;
      const kind = !buf || buf.length < 32 ? '' : (buf.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '')));
      if (buf && (!kind || pixels(buf) === 'not read')) { status = 'completed_bad_image'; problem += 'Google finished, but what it returned is not a readable PNG, JPEG or WebP image (' + buf.length + ' bytes). The call is charged. It is not sent again.'; }
      else if (buf) {
        const ext = kind === 'image/png' ? 'png' : (kind === 'image/webp' ? 'webp' : 'jpg');
        img = { sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: buf.length, px: pixels(buf), mime: kind,
          file_name: o.folder.replace(/\s+/g, '-') + '_' + o.model + '.' + ext };
        status = 'completed'; imgBuf = buf; imgMime = kind;
        const m = String(img.px).match(/^(\d+)x(\d+)$/), want = { '1K': 1024, '2K': 2048, '4K': 4096 }[o.size], rr = String(o.ratio).split(':').map(Number), chk = [];
        if (m && rr[0] && rr[1] && Math.abs(Number(m[1]) / Number(m[2]) - rr[0] / rr[1]) > 0.02) chk.push('the frame is ' + img.px + ', not the ' + o.ratio + ' asked for');
        if (m && want && (Math.max(Number(m[1]), Number(m[2])) < want * 0.75 || Math.max(Number(m[1]), Number(m[2])) > want * 1.25)) chk.push('the long side is ' + Math.max(Number(m[1]), Number(m[2])) + ' px, not about ' + want + ' px for ' + o.size);
        if (chk.length) problem += 'Check: ' + chk.join('; ') + '. Google may have ignored the frame or size setting. ';
      } else if (b && b.uri) { status = 'completed_not_stored'; problem += 'Google finished but returned the image as a link only; downloading it is not built. The call is charged.'; }
      else { status = 'completed_no_image'; problem += 'Google finished but returned no image. The call may be charged (see the token counts). It is not sent again.'; }
    } else {
      status = 'failed';
      const errs = clean(arr(it.errors).map(e => String((e && (e.message || e.code)) || '')).filter(Boolean).join('; ')).slice(0, 200);
      problem += 'Google ended the request as "' + ps + '"' + (errs ? ' (' + errs + ')' : '') + '. A confirmed failure keeps its charge. It is not sent again.';
    }
  } catch (e) { status = 'receipt_unreadable'; img = null; imgBuf = null; problem = 'Google\'s answer could not be read (' + clean(e && e.message) + '). A paid call may have been made; it is not sent again.'; }
}
const actual = c ? c.usd : (status === 'failed_not_started' ? 0 : Number(o.reserve_usd));
const basis = c ? c.basis : (status === 'failed_not_started' ? 'refused before start; no charge expected (not confirmed)' : 'no token counts; reserved estimate kept (estimate, not an invoice)');
const op_update = { status, provider_request_id: rid, http: code, seconds, usage: it && it.usage ? JSON.stringify(it.usage).slice(0, 2000) : '',
  actual_usd: actual, cost_basis: basis, image_sha256: img ? img.sha256 : '', image_bytes: img ? img.bytes : 0, image_px: img ? img.px : '',
  drive_file_id: '', drive_link: '', problem: problem.trim(), updated_at: now };
const out = { json: { operation_key: o.operation_key, store_image: Boolean(imgBuf), image_meta: img, op_update } };
if (imgBuf) out.binary = { image: await this.helpers.prepareBinaryData(imgBuf, img.file_name, imgMime) };
return [out];
