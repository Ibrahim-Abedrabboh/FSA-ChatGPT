// Scratch test only (16 Oct 2026). Makes a one-bit PNG of the asked shape in code (stored deflate, no zlib) and the small ticket that
// A7's exact "20c Check scene master" reads. Used in "Claude · scratch · A7 scene files test" to run A7's real 20c, 20d, 20e and 20f in n8n.
const crypto = require('crypto');
const SIZES = { '16:9': [2048, 1152], '4:5': [1638, 2048], '9:16': [1152, 2048], '1:1': [2048, 2048] };
const shape = String(($input.first() && $input.first().json && $input.first().json.shape) || '16:9');
const [W, H] = SIZES[shape] || SIZES['16:9'];
const rowBytes = Math.ceil(W / 8);
const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc32 = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const raw = Buffer.alloc(H * (rowBytes + 1), 0xff);
const x0 = Math.round(W * 0.25), x1 = Math.round(W * 0.75), y0 = Math.round(H * 0.5), y1 = Math.round(H * 0.75);
for (let y = 0; y < H; y++) { raw[y * (rowBytes + 1)] = 0; if (y >= y0 && y < y1) for (let x = x0; x < x1; x++) raw[y * (rowBytes + 1) + 1 + (x >> 3)] &= ~(0x80 >> (x & 7)); }
let s1 = 1, s2 = 0; for (const x of raw) { s1 = (s1 + x) % 65521; s2 = (s2 + s1) % 65521; }
const blocks = [];
for (let i = 0; i < raw.length; i += 65535) { const part = raw.subarray(i, Math.min(i + 65535, raw.length)); const hdr = Buffer.alloc(5); hdr[0] = i + 65535 >= raw.length ? 1 : 0; hdr.writeUInt16LE(part.length, 1); hdr.writeUInt16LE(part.length ^ 0xffff, 3); blocks.push(hdr, part); }
const adler = Buffer.alloc(4); adler.writeUInt32BE(((s2 << 16) | s1) >>> 0);
const idat = Buffer.concat([Buffer.from([0x78, 0x01])].concat(blocks, [adler]));
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 1;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
const sha = crypto.createHash('sha256').update(png).digest('hex');
const sf = { ok: true, cfg: { short_side_px: 1125, formats: ['jpg', 'webp'], jpg_quality: 92, shape_tolerance_pct: 2 }, at: new Date().toISOString(), output_id: 'lifestyle_1', kind: 'lifestyle', base: 'claude-scratch',
  planned: { shape, w: Number(shape.split(':')[0]), h: Number(shape.split(':')[1]) },
  master: { drive_file_id: 'scratch', folder_id: '', link: '', sha256: sha, px: W + 'x' + H, bytes: png.length, file_name: 'claude-scratch-scene.png' }, approval: null, midas_pieces: [], midas_pieces_left_out: [] };
return [{ json: { st: {}, sf }, binary: { data: await this.helpers.prepareBinaryData(png, 'claude-scratch-scene.png', 'image/png') } }];
