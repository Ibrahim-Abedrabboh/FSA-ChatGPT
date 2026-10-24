// Stage 07 · Room check: the room the product is placed into. Code only (16 Oct 2026).
// Either the empty room made in this stage (downloaded from Drive, checked against its receipt checksum) or the client's room photo
// from intake (checked at intake). The client's room is used as it is: it is never redrawn before the placement.
const crypto = require('crypto');
const st = $('19c Prop verdict').first().json;
const r = (st.scene && st.scene.room) || null;
const kind = b => (!b || b.length < 12 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))));
const room = { ok: false, source: r ? r.source : '', key: '', sha256: '', bytes: 0, mime: '', name: '', why: '' };
if (!r) room.why = 'the scene has no room recorded';
else if (r.source === 'client room photo') {
  const ref = (st.references || []).find(x => x.key === r.key && x.sha256);
  if (!ref) room.why = 'the client room photo is not among this run\'s checked files';
  else Object.assign(room, { ok: true, key: ref.key, sha256: ref.sha256, bytes: ref.bytes || 0, mime: ref.mime || '', name: ref.name || 'client room photo' });
} else {
  const item = $input.first() || {};
  let buf = null;
  if (item.binary && item.binary.data) { try { buf = await this.helpers.getBinaryDataBuffer(0, 'data'); } catch (e) { buf = null; } }
  if (!buf || !buf.length) room.why = 'the empty room could not be downloaded from Google Drive' + (item.json && item.json.error ? ' (' + String(item.json.error.message || item.json.error).slice(0, 160) + ')' : '');
  else {
    room.sha256 = crypto.createHash('sha256').update(buf).digest('hex'); room.bytes = buf.length; room.mime = kind(buf); room.key = 'scene_room'; room.name = r.file_name || 'empty room';
    if (room.sha256 !== r.sha256) room.why = 'the room file in Google Drive is not the one stage 04 stored (checksum differs)';
    else if (!room.mime) room.why = 'the room file is not a readable PNG, JPEG or WebP image';
    else room.ok = true;
  }
}
return [{ json: { room } }];
