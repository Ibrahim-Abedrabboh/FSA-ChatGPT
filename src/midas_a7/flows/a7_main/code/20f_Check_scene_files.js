// Stage 07 · Check the two scene delivery files made by Edit Image (no AI, step 20). Code only (16 Oct 2026).
// Each must be the right format, exactly the size worked out in 20c (short side 1125 px, the image's own shape), and not empty.
// Both formats are required; if one is missing, nothing is uploaded and the scene's files are held for the owner.
const crypto = require('crypto');
const sf = JSON.parse(JSON.stringify($('20c Check scene master').first().json.sf));
const item = $input.first() || {};
const bin = item.binary || {};
const problems = [];
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
const WANT = { jpg: 'image/jpeg', webp: 'image/webp' };
const t = sf.target || {};
const outBin = {};
for (const f of sf.files || []) {
  let buf = null;
  if (bin[f.format]) { try { buf = await this.helpers.getBinaryDataBuffer(0, f.format); } catch (e) { buf = null; } }
  if (!buf || !buf.length) { problems.push('the ' + f.format + ' file was not made' + (item.json && item.json.error ? ' (' + String(item.json.error.message || item.json.error).slice(0, 200) + ')' : '')); continue; }
  const kind = kindOf(buf), px = kind ? pixels(buf) : null;
  f.mime = kind; f.bytes = buf.length; f.px = px ? px[0] + 'x' + px[1] : 'not read';
  f.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  if (kind !== WANT[f.format]) problems.push('the ' + f.format + ' file is ' + (kind || 'not a readable image') + ', not ' + WANT[f.format]);
  else if (!px || px[0] !== t.w || px[1] !== t.h) problems.push('the ' + f.format + ' file is ' + f.px + ', not ' + t.w + ' x ' + t.h);
  else outBin[f.format] = await this.helpers.prepareBinaryData(buf, f.file_name, kind);
}
if (!(sf.files || []).length) problems.push('no delivery file was planned');
sf.method = 'Resized from the owner-approved scene with n8n Edit Image (GraphicsMagick): one resize to ' + t.w + ' x ' + t.h + ' px (short side ' + sf.cfg.short_side_px + ' px, the image\'s own shape; the same scale on both sides), jpg quality ' + sf.cfg.jpg_quality + ', webp at the tool\'s default quality. No AI; nothing redrawn, cropped, padded or upscaled.';
sf.files_ok = problems.length === 0;
if (!sf.files_ok) { sf.ok = false; sf.problem = 'The scene files were not made: ' + problems.join('; ') + '. Nothing was uploaded.'; }
const out = { json: { sf } };
if (sf.files_ok) out.binary = outBin;
return [out];
