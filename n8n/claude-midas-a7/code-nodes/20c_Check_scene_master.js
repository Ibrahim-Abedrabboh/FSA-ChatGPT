// Stage 07 · Check the approved scene before its delivery files are made (step 20). Code only (16 Oct 2026).
// The file downloaded from Drive must be byte for byte the scene the owner approved (same sha256). The delivery size follows the
// image's own shape: the short side becomes 1125 px and the long side keeps the image's proportion (owner, 16 Oct 03:25), so the
// image is scaled the same way in both directions. Never stretched, cropped, padded or upscaled: a scene whose short side is under
// 1125 px is held for the owner.
const crypto = require('crypto');
const T = $('20a Scene files ticket').first().json;
const sf = JSON.parse(JSON.stringify(T.sf));
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
const inp = $input.first() ? $input.first().json : {};
let buf = null;
try { buf = await this.helpers.getBinaryDataBuffer(0, 'data'); } catch (e) { buf = null; }
let master = null, target = null, tooSmall = false;
if (!buf || !buf.length) problems.push('the approved scene could not be downloaded from Drive (' + clean((inp && inp.error && (inp.error.message || inp.error)) || 'no file data') + ')');
else {
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const kind = kindOf(buf), px = kind ? pixels(buf) : null;
  master = { sha256: sha, bytes: buf.length, mime: kind, px: px ? px[0] + 'x' + px[1] : 'not read' };
  if (sha !== sf.master.sha256) problems.push('the file in Drive is not the scene the owner approved (its checksum differs); it may have been changed or replaced');
  else if (!kind || !px || !px[0] || !px[1]) problems.push('the approved scene is not a readable PNG, JPEG or WebP image');
  else {
    const [w, h] = px, s = sf.cfg.short_side_px, short = Math.min(w, h);
    if (short < s) { tooSmall = true; problems.push('the approved scene is ' + w + ' x ' + h + ' px; its short side is under ' + s + ' px, so the delivery files would need upscaling, which is never done'); }
    else {
      // One scale for both sides: the short side to s, the long side by the same factor, rounded to whole pixels.
      target = w <= h ? { w: s, h: Math.round(h * s / w) } : { w: Math.round(w * s / h), h: s };
      target.scale = Number((s / short).toFixed(6));
      if (Math.max(w, h) < 1800 || Math.max(w, h) > 2400) notes.push('The approved scene is ' + w + ' x ' + h + ' px, not a 2048-class image; its files are made from it as it is.');
      if (sf.planned && sf.planned.w && sf.planned.h) {
        const off = Math.abs((w / h) / (sf.planned.w / sf.planned.h) - 1) * 100;
        sf.shape_measured = { px: w + 'x' + h, off_planned_pct: Number(off.toFixed(2)) };
        if (off > sf.cfg.shape_tolerance_pct) notes.push('The approved scene is ' + w + ' x ' + h + ' px, which is not the planned ' + sf.planned.shape + ' shape (' + off.toFixed(1) + '% off). Its files follow the image as approved; nothing is cropped or stretched to the planned shape.');
      }
    }
  }
}
if (target) {
  const tag = target.w + 'x' + target.h;
  sf.files = sf.cfg.formats.map(f => ({ format: f, file_name: sf.base + '_' + sf.output_id + '_' + tag + '.' + f }));
  sf.manifest_name = sf.base + '_' + sf.output_id + '_manifest.json';
  sf.folder_name = sf.base + ' · scene ' + sf.output_id;
}
sf.target = target;
sf.too_small = tooSmall;
sf.master_check = master;
sf.notes = arr(sf.notes).concat(notes);
const ok = problems.length === 0;
sf.ok = ok;
sf.problem = ok ? '' : 'The scene files were not made: ' + problems.join('; ') + '. Nothing was resized or uploaded.';
const out = { json: { sf } };
if (ok) out.binary = { data: $input.first().binary.data };
return [out];
