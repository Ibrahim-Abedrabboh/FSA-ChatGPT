// Stage 07 · Photo check: each downloaded Midas catalogue photo is a readable image; its checksum is recorded. Code only (16 Oct 2026).
const crypto = require('crypto');
const list = $('19f0 Photo list').all().map(i => i.json);
const items = $input.all();
const kind = b => (!b || b.length < 12 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))));
const photos = [];
if (!(list.length === 1 && list[0].none)) {
  for (let i = 0; i < list.length; i++) {
    const it = items[i] || {};
    let buf = null;
    if (it.binary && it.binary.data) { try { buf = await this.helpers.getBinaryDataBuffer(i, 'data'); } catch (e) { buf = null; } }
    const mime = kind(buf);
    photos.push({ i, sku: list[i].sku, ok: Boolean(buf && buf.length && mime), sha256: buf ? crypto.createHash('sha256').update(buf).digest('hex') : '', bytes: buf ? buf.length : 0, mime,
      why: !buf || !buf.length ? 'the catalogue photo could not be downloaded' + (it.json && it.json.error ? ' (' + String(it.json.error.message || it.json.error).slice(0, 120) + ')' : '') : (!mime ? 'the catalogue photo is not a readable PNG, JPEG or WebP image' : '') });
  }
}
return [{ json: { photos } }];
