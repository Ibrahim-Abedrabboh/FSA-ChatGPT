// Step 15 · Build the image request: the prompt and the reference photos, checked against what was reserved. Code only (15 Oct 2026).
// The vendor photo is image 1. Each photo is checked against the checksum taken when it was received. No key is in this body.
const crypto = require('crypto');
const s04 = JSON.parse(JSON.stringify($input.first().json.s04));
const now = new Date().toISOString();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function notSent(why) {
  s04.send = false; s04.ready = false; s04.outcome = 'hold'; s04.hold_step = 15; s04.paid = false;
  s04.critical.push({ what: 'stage04', who: 'owner', why });
  s04.op_update = { status: 'not_sent', problem: why, drive_folder_id: (s04.drive_folder && s04.drive_folder.id) || '', updated_at: now };
  return [{ json: { s04 } }];
}
if (!s04.ready) { s04.send = false; return [{ json: { s04 } }]; }
const o = s04.dispatch;
const set = s04.settings || {};
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
if (sha(o.prompt) !== o.prompt_sha256 || o.prompt_sha256 !== s04.op_row.prompt_sha256) return notSent('The prompt differs from the one reserved, so nothing was sent.');
const kindOf = b => (!b || b.length < 32 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))));
const typeNotes = [];
const parts = [];
let total = 0;
for (const r of o.references) {
  let buf = null;
  try { buf = await this.helpers.getBinaryDataBuffer(0, r.key); } catch (e) { buf = null; }
  if (!buf || !buf.length) return notSent('Reference ' + r.n + ' (' + r.name + ') is missing from this run, so nothing was sent.');
  if (sha(buf) !== r.sha256) return notSent('Reference ' + r.n + ' (' + r.name + ') is not the file received at intake (checksum differs), so nothing was sent.');
  // The type is read from the bytes when they say PNG, JPEG or WebP (live test, 16 Oct 2026: Drive called main.jpg image/png);
  // otherwise the type recorded at intake is used and checked below.
  const byBytes = kindOf(buf);
  const mime = byBytes || String(r.mime || '').toLowerCase();
  if (byBytes && String(r.mime || '').toLowerCase() !== byBytes) typeNotes.push('Reference ' + r.n + ' (' + r.name + ') was recorded as ' + (r.mime || 'unknown') + '; its bytes are ' + byBytes + ', which was sent.');
  if (ALLOWED.indexOf(mime) === -1) return notSent('Reference ' + r.n + ' (' + r.name + ') is ' + (mime || 'of unknown type') + '; Google takes PNG, JPEG, WebP, HEIC or HEIF. Converting is not built, so nothing was sent.');
  total += buf.length;
  parts.push({ type: 'image', mime_type: mime, data: buf.toString('base64') });
}
const cap = (Number(set.max_inline_mb) || 14) * 1024 * 1024;
if (total > cap) return notSent('The reference photos total ' + (total / 1048576).toFixed(1) + ' MB, above the ' + (cap / 1048576) + ' MB set for one request. Resizing is not built, so nothing was sent.');
// One synchronous call, not stored at Google (live test, 16 Oct 2026): with background: true Google answered HTTP 400 "Image input
// modality is not enabled for models/gemini-nano-banana-2.1-agent", so background mode cannot take the reference photos. This is the
// request shape the model test made on 15 Oct (execution 418, completed in 18 s). 15h reads a finished answer at once; polling stays
// for an answer that is not finished.
const body = { model: s04.model.model_id, input: [{ type: 'text', text: o.prompt }].concat(parts), store: false,
  response_format: { type: 'image', aspect_ratio: o.ratio, image_size: o.size } };
const tl = String(set.thinking_level || '').trim().toLowerCase();
body.generation_config = { max_output_tokens: 32768 };
if (['minimal', 'medium', 'high'].indexOf(tl) !== -1) body.generation_config.thinking_level = tl;
s04.send = true;
s04.request = { images: parts.length, reference_bytes: total, thinking_level: body.generation_config.thinking_level || 'model default', max_output_tokens: 32768, mode: 'synchronous, not stored at Google', type_notes: typeNotes, built_at: now };
return [{ json: { s04, body: JSON.stringify(body) } }];
