// Scratch test only (16 Oct 2026): makes a 2048 x 2048 one-bit PNG in code (stored deflate, no zlib) and the small pk that 18h reads.
// Used in the scratch workflow "Claude · scratch · A7 package resize test" to run the real Edit Image settings of 18f/18g in n8n.
const W = 2048, H = 2048, rowBytes = W / 8;
const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc32 = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const raw = Buffer.alloc(H * (rowBytes + 1), 0xff);
const m = Math.round(W * 0.12), top = Math.round(H * 0.3);
for (let y = 0; y < H; y++) { raw[y * (rowBytes + 1)] = 0; if (y >= top && y < H - m) for (let x = m; x < W - m; x++) raw[y * (rowBytes + 1) + 1 + (x >> 3)] &= ~(0x80 >> (x & 7)); }
let s1 = 1, s2 = 0; for (const x of raw) { s1 = (s1 + x) % 65521; s2 = (s2 + s1) % 65521; }
const blocks = [];
for (let i = 0; i < raw.length; i += 65535) { const part = raw.subarray(i, Math.min(i + 65535, raw.length)); const hdr = Buffer.alloc(5); hdr[0] = i + 65535 >= raw.length ? 1 : 0; hdr.writeUInt16LE(part.length, 1); hdr.writeUInt16LE(part.length ^ 0xffff, 3); blocks.push(hdr, part); }
const adler = Buffer.alloc(4); adler.writeUInt32BE(((s2 << 16) | s1) >>> 0);
const idat = Buffer.concat([Buffer.from([0x78, 0x01])].concat(blocks, [adler]));
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 1;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
const pk = { ok: true, cfg: { size_px: 1125, formats: ['jpg', 'webp'], jpg_quality: 92 }, files: [{ format: 'jpg', file_name: 'claude-scratch_white_1125_v1.jpg' }, { format: 'webp', file_name: 'claude-scratch_white_1125_v1.webp' }], master_check: { bytes: png.length, px: W + 'x' + H } };
return [{ json: { pk }, binary: { data: await this.helpers.prepareBinaryData(png, 'claude-scratch-master.png', 'image/png') } }];
