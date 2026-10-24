// Model test · one call · Build the request: the stage 04 prompt and the vendor photo as image 1. Code only (15 Oct 2026).
// The photo type is read from its bytes. No key is in this body. The request is not stored at Google (store: false).
const crypto = require('crypto');
const o = $('C1 Check order').first().json.order;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const now = new Date().toISOString();
const inp = $input.first() ? $input.first().json : {};
let buf = null;
try { buf = await this.helpers.getBinaryDataBuffer(0, 'data'); } catch (e) { buf = null; }
const kindOf = b => (!b || b.length < 32 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))));
let send = false, problem = '', note = '', body = '', photo = null;
if (!buf || !buf.length) problem = 'The vendor photo could not be downloaded from Drive (' + clean((inp && inp.error && (inp.error.message || inp.error)) || 'no file data') + '). Nothing was sent.';
else {
  const kind = kindOf(buf);
  const cap = (Number(o.max_inline_mb) || 14) * 1048576;
  photo = { sha256: sha(buf), bytes: buf.length, mime: kind };
  if (kind && o.drive_mime && kind !== String(o.drive_mime).toLowerCase()) note = 'Drive calls the photo ' + o.drive_mime + '; its bytes are ' + kind + ', which was sent.';
  if (!kind) problem = 'The vendor photo is not PNG, JPEG or WebP by its bytes (Drive calls it ' + (o.drive_mime || 'unknown') + '). Converting is not built. Nothing was sent.';
  else if (buf.length > cap) problem = 'The vendor photo is ' + (buf.length / 1048576).toFixed(1) + ' MB, above the ' + (cap / 1048576) + ' MB set for one request. Resizing is not built. Nothing was sent.';
  else if (sha(o.prompt) !== o.prompt_sha256) problem = 'The prompt differs from the one planned. Nothing was sent.';
  else {
    const b = { model: o.model, input: [{ type: 'text', text: o.prompt }, { type: 'image', mime_type: kind, data: buf.toString('base64') }],
      response_format: { type: 'image', aspect_ratio: o.ratio, image_size: o.size }, store: false };
    if (['minimal', 'medium', 'high'].indexOf(o.thinking_level) !== -1) b.generation_config = { thinking_level: o.thinking_level };
    body = JSON.stringify(b); send = true;
  }
}
const row = { run_id: o.run_id, go_token: o.go_token, operation_key: o.operation_key, folder: o.folder, model: o.model,
  status: send ? 'reserved' : 'not_sent', case_note: String(o.case_note || '').slice(0, 500), sheet_count: Number(o.sheet_count) || 0,
  reserved_usd: Number(o.reserve_usd), cost_basis: o.reserve_basis, price_date: o.price_date, reading_source: o.reading_source,
  photo_sha256: photo ? photo.sha256 : '', prompt_sha256: o.prompt_sha256, prompt: o.prompt, problem: [problem, note].filter(Boolean).join(' '), at: now, updated_at: now };
return [{ json: { send, problem, note, photo, row, body } }];
