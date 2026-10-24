// Stage 07 · Master check: the approved white master, downloaded from Drive, is the file the owner approved. Code only (16 Oct 2026).
const crypto = require('crypto');
const st = $('19c Prop verdict').first().json;
const ap = st.approved || {};
const want = String((ap.candidate && ap.candidate.sha256) || '');
// White catalogue image on demand (20 Oct 2026): a job that makes none has no master to download or check (19d's error item is expected).
if (Boolean(st.brief && st.brief.white_master === 'not_asked') && !(Array.isArray(st.outputs) ? st.outputs : []).some(o => o.kind === 'white')) return [{ json: { master: { ok: true, none: true, sha256: '', bytes: 0, mime: '', why: 'this job makes no white master' } } }];
const item = $input.first() || {};
let buf = null;
if (item.binary && item.binary.data) { try { buf = await this.helpers.getBinaryDataBuffer(0, 'data'); } catch (e) { buf = null; } }
const kind = b => (!b || b.length < 12 ? '' : (b.readUInt32BE(0) === 0x89504e47 ? 'image/png' : (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''))));
const master = { ok: false, sha256: '', bytes: 0, mime: '', why: '' };
if (!buf || !buf.length) master.why = 'the approved white master could not be downloaded from Google Drive' + (item.json && item.json.error ? ' (' + String(item.json.error.message || item.json.error).slice(0, 160) + ')' : '');
else {
  master.sha256 = crypto.createHash('sha256').update(buf).digest('hex'); master.bytes = buf.length; master.mime = kind(buf);
  if (master.sha256 !== want) master.why = 'the file in Google Drive is not the master the owner approved (checksum differs)';
  else if (!master.mime) master.why = 'the approved master is not a readable PNG, JPEG or WebP image';
  else master.ok = true;
}
return [{ json: { master } }];
