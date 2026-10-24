// Local check of 18e3 Clean background and the after-save check of 18h on real images (16 Oct 2026). No network, no AI, no paid call.
// It does what n8n Edit Image (GraphicsMagick) does in the workflow, with the local gm command: master -> 1125 BMP, the code node,
// BMP -> jpg (the package quality) and webp, then both read back to BMP for 18h's edge check.
// Run: node tests/claude-midas-a7-phase-1/claude-white-clean-check.js [master image] [out folder] [box_2d as ymin,xmin,ymax,xmax]
// The default box is the blind count's box on this master in execution 454: [336,97,698,902] (16 Oct 2026, review finding 1).
// Needs GraphicsMagick (gm) on the PATH.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const master = process.argv[2] || path.join(ROOT, 'claude-outputs', 'claude-midas-a7-live-test', 'claude-t10-06-white-master-try1.jpg');
const OUT = process.argv[3] || fs.mkdtempSync(path.join(require('os').tmpdir(), 'claude-wc-'));
const gm = (...a) => execFileSync('gm', a);
const BOX = (process.argv[4] || '336,97,698,902').split(',').map(Number);
async function runNode(file, nodes, input) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const $input = { first: () => input[0], all: () => input };
  const ctx = { helpers: { getBinaryDataBuffer: async (i, k) => input[i].binary[k]._buf, prepareBinaryData: async (buf, name, mime) => ({ _buf: buf, fileName: name, mimeType: mime }) } };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFn('$', '$input', 'require', fs.readFileSync(path.join(NODES, file), 'utf8')).call(ctx, $, $input, require);
}
function readBmp(buf) {
  const off = buf.readUInt32LE(10), w = buf.readInt32LE(18), rawH = buf.readInt32LE(22), h = Math.abs(rawH), bits = buf.readUInt16LE(28);
  const bytes = bits / 8, stride = Math.floor((bits * w + 31) / 32) * 4;
  const px = (x, y) => { const p = off + (rawH > 0 ? h - 1 - y : y) * stride + x * bytes; return [buf[p + 2], buf[p + 1], buf[p]]; };
  return { w, h, px };
}
(async () => {
  const size = 1125;
  gm('convert', master, '-resize', size + 'x' + size + '!', 'bmp3:' + path.join(OUT, 'pix.bmp'));
  const pix = fs.readFileSync(path.join(OUT, 'pix.bmp'));
  const pk = { cfg: { size_px: size, jpg_quality: 95 }, base: 'claude-test', ok: true, product_box_2d: BOX };
  const r = await runNode('18e3_Clean_background.js', { '18e Check master': [{ json: { pk } }] }, [{ json: { pk }, binary: { pix: { _buf: pix, mimeType: 'image/bmp' } } }]);
  const wc = r[0].json.pk.white_clean;
  console.log('18e3:', JSON.stringify(wc));
  if (!wc.done) process.exit(1);
  const clean = r[0].binary.clean._buf;
  fs.writeFileSync(path.join(OUT, 'clean.bmp'), clean);
  // The product: every pixel that changed must have been near-white before; the darker pixels (product and shadow core) are identical.
  const a = readBmp(pix), b = readBmp(clean);
  let changedDark = 0, changed = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const p = a.px(x, y), q = b.px(x, y); if (p[0] !== q[0] || p[1] !== q[1] || p[2] !== q[2]) { changed++; if (Math.min(...p) < Math.min(...wc.curve_starts_at)) changedDark++; } }
  // Inside the product box (widened as 18e3 widens it): no pixel may change. Measured here independently of the node.
  const [bx0, by0, bx1, by1] = wc.product_box_px;
  let changedInBox = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const p = a.px(x, y), q = b.px(x, y); if (p[0] !== q[0] || p[1] !== q[1] || p[2] !== q[2]) changedInBox++; }
  console.log('changed pixels:', changed, '; changed pixels darker than the knee (must be 0):', changedDark, '; changed inside the product box (must be 0):', changedInBox);
  gm('convert', path.join(OUT, 'clean.bmp'), '-quality', '95', path.join(OUT, 'clean.jpg'));
  gm('convert', path.join(OUT, 'clean.bmp'), path.join(OUT, 'clean.webp'));
  gm('convert', path.join(OUT, 'clean.jpg'), 'bmp3:' + path.join(OUT, 'jpgpix.bmp'));
  gm('convert', path.join(OUT, 'clean.webp'), 'bmp3:' + path.join(OUT, 'webppix.bmp'));
  for (const f of ['jpgpix.bmp', 'webppix.bmp', 'pix.bmp']) {
    const im = readBmp(fs.readFileSync(path.join(OUT, f)));
    let n = 0, white = 0, minV = 255;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      if (!(y < 2 || y >= im.h - 2 || x < 2 || x >= im.w - 2)) continue;
      const p = im.px(x, y); n++; const lo = Math.min(...p); if (lo === 255) white++; if (lo < minV) minV = lo;
    }
    console.log(f + ': edge rows (2 px) at 255: ' + (100 * white / n).toFixed(2) + '%, darkest edge value ' + minV);
  }
  // Owner, 16 Oct 2026, 19:26: the fade's three conditions, the grey-halo check and the jpg saved again at quality 100, through 18h itself.
  console.log('fade: margin ' + wc.fade_margin_px + ' px, reach ' + wc.fade_reach_px + ' px; partly changed beyond the margin (must be 0): ' + wc.partly_changed_beyond_margin + '; background beyond the margin below 255 (must be 0): ' + wc.background_beyond_margin_not_255);
  gm('convert', path.join(OUT, 'clean.bmp'), '-quality', '100', path.join(OUT, 'clean100.jpg'));
  gm('convert', path.join(OUT, 'clean100.jpg'), 'bmp3:' + path.join(OUT, 'jpg100pix.bmp'));
  const pk2 = Object.assign({}, r[0].json.pk, { files: [{ format: 'jpg', file_name: 'claude-test_white_1125_v1.jpg' }, { format: 'webp', file_name: 'claude-test_white_1125_v1.webp' }] });
  const B = f => ({ _buf: fs.readFileSync(path.join(OUT, f)), mimeType: 'application/octet-stream' });
  const h = await runNode('18h_Check_files.js', { '18e3 Clean background': [{ json: { pk: pk2 } }] }, [{ json: { pk: pk2 }, binary: { clean: B('clean.bmp'), jpg: B('clean.jpg'), jpg100: B('clean100.jpg'), webp: B('clean.webp'), jpgpix: B('jpgpix.bmp'), jpg100pix: B('jpg100pix.bmp'), webppix: B('webppix.bmp') } }]);
  const hp = h[0].json.pk;
  console.log('18h: files_ok ' + hp.files_ok + (hp.problem ? ' | ' + hp.problem : ''));
  for (const f of hp.files) console.log('  ' + f.format + ': quality ' + f.quality + (f.saved_again ? ' (' + f.saved_again + ')' : '') + '; edge ' + JSON.stringify(f.background_check && { pct: f.background_check.edge_255_pct, darkest: f.background_check.darkest_edge_value }) + '; halo ' + JSON.stringify(f.halo_check));
  // A crop at the product's edge for a look by eye: 4x enlarged, contrast stretched so 240 is black and 255 white (a grey halo would show as a band).
  const [x0, y0, x1, y1] = wc.product_box_px;
  for (const f of ['clean.jpg', 'clean.webp']) gm('convert', path.join(OUT, f), '-crop', '200x200+' + Math.max(0, x1 - 100) + '+' + Math.max(0, Math.round((y0 + y1) / 2) - 100), '-level', '240,255', '-filter', 'point', '-resize', '400%', path.join(OUT, 'halo-' + f.replace('.', '-') + '.png'));
  console.log('files in', OUT);
})();
