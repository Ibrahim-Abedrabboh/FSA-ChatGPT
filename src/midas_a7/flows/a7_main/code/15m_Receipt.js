// Step 15 · Receipt: the image, its checksum, size and pixel size, and the cost worked out from Google's token counts. Code only (15 Oct 2026).
// The image is a candidate: not reviewed and not approved. A confirmed failure keeps its charge; nothing is retried here.
const crypto = require('crypto');
const g = $('15h Read submission').first().json;
const s04 = JSON.parse(JSON.stringify(g.s04));
const now = new Date().toISOString();
const inp = $input.first() ? $input.first().json : {};
const fromPoll = Boolean(inp && inp.poll);
const it = fromPoll ? inp.interaction : g.interaction;
const poll = fromPoll ? inp.poll : null;
const arr = x => (Array.isArray(x) ? x : []);
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
s04.store_image = false;
function hold(why) { s04.outcome = 'hold'; s04.hold_step = 15; s04.critical.push({ what: 'stage04', who: 'owner', why }); }
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
  const m = s04.model; const p = m.prices_usd_per_m;
  const byMod = (a, mod) => arr(a).filter(x => x && String(x.modality).toLowerCase() === mod).reduce((t, x) => t + (Number(x.tokens) || 0), 0);
  const inTok = Number(u && u.total_input_tokens) || 0;
  const outTok = Number(u && u.total_output_tokens) || 0;
  if (!inTok && !outTok) return { usd: s04.reserve_usd, basis: 'Google reported no token counts; the reserved estimate is kept (USD ' + s04.reserve_usd + '; estimate, not an invoice).', tokens: null };
  const img = byMod(u.output_tokens_by_modality, 'image');
  const thought = Number(u.total_thought_tokens) || 0;
  const text = Math.max(0, outTok - img);
  const usd = (inTok * p.input + img * p.image_out + (text + thought) * p.text_out) / 1e6;
  return { usd: Number(usd.toFixed(4)), basis: 'computed from Google\'s token counts x registry prices dated ' + m.price_date + '; not an invoice', tokens: { input: inTok, output: outTok, image_out: img, text_out: text, thought } };
}
const sub = s04.submission || {};
let imgBuf = null, imgMime = '';
let status = sub.status, problem = sub.problem || '', receipt = { at: now, provider_request_id: sub.provider_request_id || '', checks: poll ? poll.polls : 0 };
if (g.next === 'stop') { /* refused or uncertain at submission: 15h already holds */ }
else if (!it) {
  status = 'uncertain';
  problem = (poll && poll.problem ? poll.problem + ' ' : '') + 'The request (Google id ' + sub.provider_request_id + ') may still finish and may be charged. It is not sent again. Fetching a late result is not built yet.';
  hold(problem);
} else {
 try {
  const ps = String(it.status || '');
  const c = cost(it.usage);
  receipt.provider_status = ps; receipt.usage = it.usage || null; receipt.cost = c;
  s04.actual = c;
  if (ps === 'completed') {
    const img = findImage(it);
    const buf = img && img.data ? Buffer.from(String(img.data), 'base64') : null;
    const kind = !buf || buf.length < 32 ? '' : (buf.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '')));
    if (buf && (!kind || pixels(buf) === 'not read')) { status = 'completed_bad_image'; problem = 'Google finished, but what it returned is not a readable PNG, JPEG or WebP image (' + buf.length + ' bytes). The call is charged. It is not sent again.'; hold(problem); }
    else if (buf) {
      const mime = kind;
      const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
      const safe = t => String(t || '').replace(/[^A-Za-z0-9_.-]+/g, '-').slice(0, 80);
      receipt.image = { sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: buf.length, px: pixels(buf), mime,
        file_name: safe(s04.op_row.client_run_id) + '_' + safe(s04.dispatch.output_id) + '_try' + s04.dispatch.attempt + '.' + ext, label: 'Generated image. Candidate: not reviewed and not approved.' };
      status = 'completed';
      s04.store_image = true;
      s04.outcome = 'candidate';
      imgBuf = buf; imgMime = mime;
    } else if (img && img.uri) { status = 'completed_not_stored'; problem = 'Google finished but returned the image as a link only; downloading it is not built. The call is charged. Google request ' + sub.provider_request_id + '.'; hold(problem); }
    else { status = 'completed_no_image'; problem = 'Google finished but returned no image. The call may be charged (see the token counts). It is not sent again.'; hold(problem); }
  } else {
    status = 'failed';
    const errs = clean(arr(it.errors).map(e => String((e && (e.message || e.code)) || '')).filter(Boolean).join('; ')).slice(0, 200);
    problem = 'Google ended the request as "' + ps + '"' + (errs ? ' (' + errs + ')' : '') + '. A confirmed failure keeps its charge. It is not sent again; a repair or new try needs the owner.';
    hold(problem);
  }
 } catch (e) {
  status = 'receipt_unreadable'; s04.store_image = false; s04.outcome = 'hold';
  problem = 'Google\'s answer could not be read (' + clean(e && e.message) + '). A paid call may have been made; it is not sent again. Google request ' + sub.provider_request_id + '.';
  hold(problem);
 }
}
s04.receipt = receipt;
s04.op_update = { status, provider_request_id: sub.provider_request_id || '', provider_status: receipt.provider_status || sub.provider_status || '', problem,
  receipt: JSON.stringify({ ...receipt, usage: receipt.usage || null }).slice(0, 20000),
  actual_usd: s04.actual ? s04.actual.usd : (status === 'failed_not_started' ? 0 : s04.reserve_usd),
  cost_basis: s04.actual ? s04.actual.basis : (status === 'failed_not_started' ? 'refused before start; no charge expected (not confirmed)' : 'no token counts; reserved estimate kept (estimate, not an invoice)'),
  image_sha256: receipt.image ? receipt.image.sha256 : '', image_bytes: receipt.image ? receipt.image.bytes : 0, image_px: receipt.image ? receipt.image.px : '',
  drive_folder_id: (s04.drive_folder && s04.drive_folder.id) || '', drive_file_id: '', updated_at: now };
const out = { json: { s04 } };
if (s04.store_image && imgBuf) out.binary = { image: await this.helpers.prepareBinaryData(imgBuf, receipt.image.file_name, imgMime) };
return [out];
