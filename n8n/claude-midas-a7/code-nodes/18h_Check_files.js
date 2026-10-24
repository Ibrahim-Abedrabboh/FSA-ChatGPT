// Stage 06 · Check the two delivery files made by Edit Image (no AI): each must be the right format, exactly 1125 x 1125, and not empty.
// Code only (16 Oct 2026). Both formats are required (owner decision, 15 Oct 21:50); if one is missing, nothing is uploaded and the
// run holds for the owner. An incomplete package is never called complete.
// P1.7 (owner D4, 16 Oct 2026): the files are made from the cleaned picture (18e3) and checked after saving: each saved file is read
// back (18g1, 18g2: n8n Edit Image to BMP) and its edge rows must read 255. JPG compression can turn 255 into 254 or 253, so this is
// measured on the saved files, never assumed. A file whose edge rows do not read 255 holds the package for the owner.
// Owner, 16 Oct 2026, 19:26 (Phase 1 questions 1, 3 and 4):
// - The 99.9% rule stays, measured on the saved jpg and webp. If the jpg fails only because of compression, it is saved again at a higher
//   quality (18f9, quality 100, read back by 18g3) rather than loosening the rule; the file that passes is delivered and its quality noted.
// - A grey halo is checked on the saved files: background pixels that are 255 in the cleaned picture and lie 2 px or more from anything
//   that is not 255 must read 250 or more after saving, and at least 99.9% of them 254 or more. The pixel right next to the product is
//   left out: compression always blends that one (measured on the Test 10 master, 16 Oct 2026). (ASSUMPTION for 2 px and 250, see README.)
// - With no product box the background was not cleaned (18e3): the saved files' edges are measured and reported, but neither the 255
//   rule nor the halo check is applied, and the package says so.
const crypto = require('crypto');
const pk = JSON.parse(JSON.stringify($('18e3 Clean background').first().json.pk));
// Review finding 6 (16 Oct 2026): every edge pixel must read 255, or at least 99.9% of them with none darker than 254; the read-back
// picture must be exactly the delivery size.
const EDGE_ROWS = 2, EDGE_ALL_PCT = 100, EDGE_NEAR_PCT = 99.9, EDGE_FLOOR = 254; // (ASSUMPTION for 99.9% and 254, see README)
function bmpEdge(b) {
  if (!b || b.length < 54 || b[0] !== 0x42 || b[1] !== 0x4d) return null;
  const off = b.readUInt32LE(10), head = b.readUInt32LE(14), w = b.readInt32LE(18), rawH = b.readInt32LE(22), h = Math.abs(rawH), bits = b.readUInt16LE(28), comp = b.readUInt32LE(30);
  if ((bits !== 24 && bits !== 32) || (comp !== 0 && comp !== 3)) return null;
  // A 32-bit BMP with colour masks (as GraphicsMagick writes for a picture with transparency): the masks say which byte holds which
  // colour, so the alpha byte is never read as a colour (test gap in the review).
  let ri = 2, gi = 1, bi = 0;
  if (comp === 3 && bits === 32) {
    const at = head >= 52 ? 54 : 14 + head;
    if (at + 12 > b.length) return null;
    const byteOf = mask => (mask === 0xff ? 0 : (mask === 0xff00 ? 1 : (mask === 0xff0000 ? 2 : (mask === 0xff000000 ? 3 : -1))));
    ri = byteOf(b.readUInt32LE(at)); gi = byteOf(b.readUInt32LE(at + 4)); bi = byteOf(b.readUInt32LE(at + 8));
    if (ri < 0 || gi < 0 || bi < 0) return null;
  }
  const bytes = bits / 8, stride = Math.floor((bits * w + 31) / 32) * 4;
  if (w < 1 || h < 1 || off + stride * h > b.length) return null;
  let n = 0, white = 0, darkest = 255;
  for (let y = 0; y < h; y++) {
    const base = off + (rawH > 0 ? h - 1 - y : y) * stride;
    const rowEdge = y < EDGE_ROWS || y >= h - EDGE_ROWS;
    for (let x = 0; x < w; x++) {
      if (!rowEdge && x >= EDGE_ROWS && x < w - EDGE_ROWS) { x = w - EDGE_ROWS - 1; continue; }
      const p = base + x * bytes; const lo = Math.min(b[p + ri], b[p + gi], b[p + bi]);
      n++; if (lo === 255) white++; if (lo < darkest) darkest = lo;
    }
  }
  return { w, h, px: w + 'x' + h, edge_rows: EDGE_ROWS, edge_255_pct: n ? Math.floor(10000 * white / n) / 100 : 0, darkest_edge_value: darkest };
}
function edgeOk(back) { return back.edge_255_pct >= EDGE_ALL_PCT || (back.edge_255_pct >= EDGE_NEAR_PCT && back.darkest_edge_value >= EDGE_FLOOR); }
const HALO_MIN_DIST = 2, HALO_FLOOR = 250, HALO_NEAR_PCT = 99.9, HALO_NEAR = 254;
// The darkest channel of every pixel of a 24- or 32-bit BMP (the same mask handling as bmpEdge).
function bmpLo(b) {
  if (!b || b.length < 54 || b[0] !== 0x42 || b[1] !== 0x4d) return null;
  const off = b.readUInt32LE(10), head = b.readUInt32LE(14), w = b.readInt32LE(18), rawH = b.readInt32LE(22), h = Math.abs(rawH), bits = b.readUInt16LE(28), comp = b.readUInt32LE(30);
  if ((bits !== 24 && bits !== 32) || (comp !== 0 && comp !== 3)) return null;
  let ri = 2, gi = 1, bi = 0;
  if (comp === 3 && bits === 32) {
    const at = head >= 52 ? 54 : 14 + head;
    const byteOf = mask => (mask === 0xff ? 0 : (mask === 0xff00 ? 1 : (mask === 0xff0000 ? 2 : (mask === 0xff000000 ? 3 : -1))));
    ri = byteOf(b.readUInt32LE(at)); gi = byteOf(b.readUInt32LE(at + 4)); bi = byteOf(b.readUInt32LE(at + 8));
    if (ri < 0 || gi < 0 || bi < 0) return null;
  }
  const bytes = bits / 8, stride = Math.floor((bits * w + 31) / 32) * 4;
  if (w < 1 || h < 1 || off + stride * h > b.length) return null;
  const lo = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const base = off + (rawH > 0 ? h - 1 - y : y) * stride; for (let x = 0; x < w; x++) { const p = base + x * bytes; lo[y * w + x] = Math.min(b[p + ri], b[p + gi], b[p + bi]); } }
  return { w, h, lo };
}
// Grey halo: background pixels of the cleaned picture (255) at least HALO_MIN_DIST px from anything that is not 255, read in the saved file.
function halo(clean, saved) {
  if (!clean || !saved || clean.w !== saved.w || clean.h !== saved.h) return null;
  const w = clean.w, h = clean.h, C = clean.lo, S = saved.lo, r = HALO_MIN_DIST - 1;
  let n = 0, near = 0, grey = 0, darkest = 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (C[y * w + x] !== 255) continue;
    let edge = false;
    for (let dy = -r; dy <= r && !edge; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && C[yy * w + xx] !== 255) { edge = true; break; } }
    if (edge) continue;
    const v = S[y * w + x]; n++;
    if (v >= HALO_NEAR) near++; if (v < HALO_FLOOR) grey++; if (v < darkest) darkest = v;
  }
  return { pixels_checked: n, at_254_or_more_pct: n ? Math.floor(10000 * near / n) / 100 : 100, below_250: grey, darkest, min_distance_px: HALO_MIN_DIST };
}
function haloOk(hc) { return hc && hc.below_250 === 0 && hc.at_254_or_more_pct >= HALO_NEAR_PCT; }
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
const size = pk.cfg.size_px;
const wc = pk.white_clean || {};
const skipped = wc.skipped === true;
const outBin = {};
// The cleaned picture (18e3), for the halo check.
let cleanLo = null;
if (!skipped && bin.clean) { try { cleanLo = bmpLo(await this.helpers.getBinaryDataBuffer(0, 'clean')); } catch (e) { cleanLo = null; } }
// The files to try for each format, in order: the jpg at the package quality, then the jpg at quality 100 (owner, 19:26).
const TRY = { jpg: [{ key: 'jpg', quality: pk.cfg.jpg_quality }, { key: 'jpg100', quality: 100 }], webp: [{ key: 'webp', quality: 'the tool\'s default' }] };
for (const f of pk.files) {
  const tries = [];
  let done = false, lastProblem = '';
  for (const t of (TRY[f.format] || [{ key: f.format, quality: '' }])) {
    let buf = null;
    if (bin[t.key]) { try { buf = await this.helpers.getBinaryDataBuffer(0, t.key); } catch (e) { buf = null; } }
    if (!buf || !buf.length) { if (!tries.length) lastProblem = 'the ' + f.format + ' file was not made' + (item.json && item.json.error ? ' (' + String(item.json.error.message || item.json.error).slice(0, 200) + ')' : ''); break; }
    const kind = kindOf(buf), px = kind ? pixels(buf) : null;
    const rec = { quality: t.quality, mime: kind, bytes: buf.length, px: px ? px[0] + 'x' + px[1] : 'not read', sha256: crypto.createHash('sha256').update(buf).digest('hex') };
    tries.push(rec);
    // A wrong format or size is not a compression problem: no second try.
    if (kind !== WANT[f.format]) { lastProblem = 'the ' + f.format + ' file is ' + (kind || 'not a readable image') + ', not ' + WANT[f.format]; break; }
    if (!px || px[0] !== size || px[1] !== size) { lastProblem = 'the ' + f.format + ' file is ' + rec.px + ', not ' + size + ' x ' + size; break; }
    // The saved file, read back.
    let raw = null;
    if (bin[t.key + 'pix']) { try { raw = await this.helpers.getBinaryDataBuffer(0, t.key + 'pix'); } catch (e) { raw = null; } }
    const back = raw ? bmpEdge(raw) : null;
    rec.background_check = back ? Object.assign({ checked: 'after saving: the saved ' + f.format + ' file read back' + (t.quality !== '' ? ' (quality ' + t.quality + ')' : '') }, back) : { checked: 'not possible', problem: 'the saved ' + f.format + ' file could not be read back' };
    if (!back) { lastProblem = 'the saved ' + f.format + ' file could not be read back, so its background was not confirmed' + (skipped ? '' : ' at 255'); break; }
    if (back.w !== size || back.h !== size) { lastProblem = 'the saved ' + f.format + ' file read back at ' + back.px + ', not ' + size + ' x ' + size + ', so its edge rows were not the file\'s own'; break; }
    if (skipped) {
      rec.background_check.rule = 'not applied: the background was not cleaned (no product box), so the master\'s own background is delivered';
      Object.assign(f, rec); done = true; outBin[f.format] = await this.helpers.prepareBinaryData(buf, f.file_name, kind); break;
    }
    const hc = halo(cleanLo, bmpLo(raw));
    rec.halo_check = hc || { problem: 'not possible: the cleaned picture or the saved file could not be read in full' };
    const edgePass = edgeOk(back), haloPass = haloOk(hc);
    if (edgePass && haloPass) { Object.assign(f, rec); done = true; outBin[f.format] = await this.helpers.prepareBinaryData(buf, f.file_name, kind); break; }
    lastProblem = !edgePass ? 'the saved ' + f.format + ' file\'s edge rows read 255 on only ' + back.edge_255_pct + '% (darkest ' + back.darkest_edge_value + '; needed: all of them, or at least ' + EDGE_NEAR_PCT + '% with none darker than ' + EDGE_FLOOR + ')'
      : (hc ? 'the saved ' + f.format + ' file shows a grey halo: ' + hc.below_250 + ' background pixels below ' + HALO_FLOOR + ', ' + hc.at_254_or_more_pct + '% at 254 or more (darkest ' + hc.darkest + '; needed: none below ' + HALO_FLOOR + ', at least ' + HALO_NEAR_PCT + '%)' : 'the saved ' + f.format + ' file could not be checked for a grey halo');
    // Only a compression problem gets the next try (the jpg at quality 100).
  }
  f.tries = tries;
  if (done && tries.length > 1) f.saved_again = 'saved again at quality ' + f.quality + ': at quality ' + tries[0].quality + ' compression broke the rule (' + (tries[0].background_check && tries[0].background_check.edge_255_pct !== undefined ? 'edge rows ' + tries[0].background_check.edge_255_pct + '% at 255' : 'read back') + (tries[0].halo_check && tries[0].halo_check.below_250 !== undefined ? ', ' + tries[0].halo_check.below_250 + ' halo pixels' : '') + ')';
  if (!done) { if (!tries.length) { f.px = 'not read'; } else Object.assign(f, tries[tries.length - 1]); problems.push(lastProblem + (tries.length > 1 ? ' (also at quality ' + tries[tries.length - 1].quality + ')' : '')); }
}
const jpgQ = (pk.files.find(f => f.format === 'jpg') || {}).quality;
if (skipped) {
  const e = pk.files.map(f => f.background_check && f.background_check.edge_255_pct !== undefined ? f.format + ' edge rows ' + f.background_check.edge_255_pct + '% at 255, darkest ' + f.background_check.darkest_edge_value : '').filter(Boolean).join('; ');
  pk.method = 'Resized from the owner-approved master with n8n Edit Image (GraphicsMagick): one resize to ' + size + ' x ' + size + ' px. The background was NOT cleaned: the review gave no product box, and without it the clean-up could eat into a white or cream product\'s edges, so the master\'s own background is delivered. jpg quality ' + (jpgQ || pk.cfg.jpg_quality) + ', webp at the tool\'s default quality; each saved file read back and its edges measured (' + (e || 'not measured') + '). No AI; nothing redrawn. The approved master in Drive is unchanged.';
  pk.background_note = 'background not set to 255: no product box from the review, so the master\'s own background is delivered (' + (e || 'edges not measured') + ')';
} else {
  pk.method = 'Resized from the owner-approved master with n8n Edit Image (GraphicsMagick): one resize to ' + size + ' x ' + size + ' px; ' + (wc.fit && wc.fit.done ? 'then, because the master was framed too tight to clean, ' + wc.fit.method + ', so the product spans ' + wc.fit.span_after_pct + '% instead of ' + wc.fit.span_before_pct + '%; ' : '') + 'then the background set to 255 in code (a fill from the border through pixels at or above the white point, a soft curve on a thin band around it, nothing changed inside the product box from the review, a fade of at most ' + (wc.fade_margin_px || '?') + ' px outside the box and exactly 255 beyond it; the product and the contact shadow unchanged, measured' + (wc.background_pct !== undefined ? '; ' + wc.background_pct + '% of the picture found as background, ' + wc.background_255_after_pct + '% of it now 255' : '') + '); jpg quality ' + (jpgQ || pk.cfg.jpg_quality) + ', webp at the tool\'s default quality; each saved file read back, its edge rows checked at 255 and the background checked for a grey halo. No AI; nothing redrawn. The approved master in Drive is unchanged.';
  pk.background_note = 'background set to 255' + (wc.fit && wc.fit.done ? '; framed in code on a white canvas (product ' + wc.fit.span_after_pct + '% of the side, was ' + wc.fit.span_before_pct + '%)' : '');
}
pk.files_ok = problems.length === 0;
if (!pk.files_ok) { pk.ok = false; pk.problem = 'The package was not made: ' + problems.join('; ') + '. Nothing was uploaded.'; }
const out = { json: { pk } };
if (pk.files_ok) out.binary = outBin;
return [out];
