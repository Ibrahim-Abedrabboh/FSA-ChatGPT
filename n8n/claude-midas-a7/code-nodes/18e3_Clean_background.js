// Stage 06 · Clean background (P1.7; owner decision D4, 16 Oct 2026, 11:3x). Code only, no AI, no paid call.
// The delivery files only: the approved master in Drive stays untouched. Input: the master resized to the delivery size as a BMP
// ("pix", made by 18e2 with n8n Edit Image). Output: the same picture with its background set to 255 ("clean", BMP), from which
// 18f and 18g write the jpg and the webp. 18h then reads the saved files back and checks that their edge rows read 255.
// The owner's conditions:
// 1. Reuse the logic of "Claude · Midas white clean-up" (MSU2K5WKKfizCapW): its background sample from the outer edge band, its
//    near-white test (darkest channel at least 205, channels within 30), its white point from that sample (the value under which 5% of
//    the near-white pixels lie, minus 2, kept between 228 and 253) and its soft curve: from the knee (22 below the white point) up to the
//    white point, values rise smoothly to 255; at or above the white point they become 255. Not reused: its paid fal.ai cut-out
//    (BiRefNet) and its fal storage upload, because this step uses no AI (the owner's "no AI" for the package).
// 2. Only background pixels change (fixed 16 Oct 2026 after the independent review, finding 1):
//    - The fill grows from the image border only through pixels at or above the white point (every channel), so it never crosses a
//      shaded product surface, however soft its edge.
//    - The soft curve is applied only to a thin band (BAND px) around the filled area, so the edge of the fill blends in.
//    - Nothing inside the product's box changes. The box is the approved review's blind-count box (box_2d, 0-1000), widened by MARGIN on
//      the top, left and right; the strip below it (the contact shadow) is not widened, so the shadow edge can still be cleaned. Outside
//      the box, changes fade in over RAMP px, so no box-shaped step shows where background is visible inside the box.
//    - With no usable box from the review, nothing is changed: the product cannot be protected without it. The package is still made
//      with the master's own background, and the skipped steps are recorded (owner, 16 Oct 2026, 19:26).
//    - Product pixels changed is measured (pixels changed inside the box), not assumed.
// 3. The contact shadow stays: anything darker than the knee never changes (measured too); the faint edge of the shadow is lifted only
//    along the soft curve, inside the thin band.
// 4. The check after saving is in 18h (the saved jpg and webp, read back).
// 5. The manifest notes "background set to 255" (18l).
const pk = JSON.parse(JSON.stringify($('18e Check master').first().json.pk));
const item = $input.first() || {};
const bin = item.binary || {};
const BAND = 3;     // px around the filled background that get the soft curve (the review asked for 2-3 px)
const MARGIN = 15;  // of 1000: the product box is widened by this on the top, left and right (as the crop rule's edge limit), not below
const RAMP_PCT = 6; // changes fade in over 6% of the picture's side outside the product box (68 px at 1125), so the master's own
                    // near-white inside the box meets 255 by a gradient too gentle to see (ASSUMPTION, see README)
const GUARD = 8;    // px of fully white background kept at every image edge, for codec edge blocks
const FIT_SPAN_PCT = Number(pk.cfg && pk.cfg.fit_span_pct) || 76; // white-master framing setting: the longest side spans 76% of the frame
function bmpInfo(b) {
  if (b.length < 54 || b[0] !== 0x42 || b[1] !== 0x4d) throw new Error('not a BMP file');
  const off = b.readUInt32LE(10);
  const head = b.readUInt32LE(14);
  const w = b.readInt32LE(18);
  const rawH = b.readInt32LE(22);
  const h = Math.abs(rawH);
  const bits = b.readUInt16LE(28);
  const comp = b.readUInt32LE(30);
  if ((bits !== 24 && bits !== 32) || (comp !== 0 && comp !== 3)) throw new Error('unsupported BMP: ' + bits + ' bits, compression ' + comp);
  let ri = 2, gi = 1, bi = 0;
  if (comp === 3 && bits === 32) {
    const at = head >= 52 ? 54 : 14 + head;
    const byteOf = mask => (mask === 0xff ? 0 : (mask === 0xff00 ? 1 : (mask === 0xff0000 ? 2 : 3)));
    ri = byteOf(b.readUInt32LE(at)); gi = byteOf(b.readUInt32LE(at + 4)); bi = byteOf(b.readUInt32LE(at + 8));
  }
  const stride = Math.floor((bits * w + 31) / 32) * 4;
  if (w < 8 || h < 8 || off + stride * h > b.length) throw new Error('BMP size does not match its header');
  return { w, h, bytes: bits / 8, off, stride, bottomUp: rawH > 0, ri, gi, bi };
}
function boxOf(v) {
  const b = Array.isArray(v) ? v.map(Number) : [];
  return b.length === 4 && b.every(x => Number.isFinite(x) && x >= 0 && x <= 1000) && b[0] < b[2] && b[1] < b[3] && !b.every(x => x <= 1) ? b : null;
}
const wc = { done: false, method: 'background set to 255 in code (no AI): a fill from the image border through pixels at or above the white point only, the soft curve of the white clean-up workflow on a ' + BAND + ' px band around it, nothing changed inside the product box from the review; the contact shadow and the product are not changed (measured)', band_px: BAND, box_margin_of_1000: MARGIN, ramp_pct: RAMP_PCT };
let cleanBin = null;
const SKIP = { skip: true };
// Owner, 16 Oct 2026, 19:26 (Phase 1 question 1): with no product box the master is still packaged, but the background is NOT cleaned
// (the clean-up could eat into a white or cream product's edges without the box). The master's own background is delivered and the
// skip is recorded; 18h measures the saved files' edges and reports them, without the 255 rule. Every step that needs the box is listed.
const SKIPPED_NO_BOX = [
  { step: 'background set to 255 (the clean-up and its fade around the product)', why: 'it needs the product box, so the product\'s edges are not touched without it' },
  { step: 'framing band check (white master 72-80% on the longest side)', why: 'it needs the product box; not measured' }
];
try {
  let box = boxOf(pk.product_box_2d);
  wc.product_box_2d = box;
  if (!bin.pix) throw new Error('the master could not be turned into pixels (Edit Image gave no BMP' + (item.json && item.json.error ? ': ' + String(item.json.error.message || item.json.error).slice(0, 160) : '') + ')');
  const b = await this.helpers.getBinaryDataBuffer(0, 'pix');
  const m = bmpInfo(b);
  const w = m.w, h = m.h, N = w * h;
  if (w !== pk.cfg.size_px || h !== pk.cfg.size_px) throw new Error('the pixels are ' + w + ' x ' + h + ', not ' + pk.cfg.size_px + ' x ' + pk.cfg.size_px);
  if (!box) {
    wc.skipped = true; wc.done = false; wc.cleaned = false;
    wc.skip_reason = 'no usable product box (box_2d) from the review';
    wc.skipped_steps = SKIPPED_NO_BOX;
    wc.method = 'background not cleaned: no product box from the review, so the master\'s own background is delivered unchanged';
    cleanBin = await this.helpers.prepareBinaryData(b, pk.base + '_clean.bmp', 'image/bmp');
    throw SKIP; // leaves the try block: nothing below runs; the picture goes on unchanged
  }
  const R = new Uint8Array(N), G = new Uint8Array(N), B = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    const base = m.off + (m.bottomUp ? h - 1 - y : y) * m.stride;
    for (let x = 0; x < w; x++) { const p = base + x * m.bytes, i = y * w + x; R[i] = b[p + m.ri]; G[i] = b[p + m.gi]; B[i] = b[p + m.bi]; }
  }
  // 1. The background sample from the outer edge band (as the white clean-up's C9 does).
  const band = Math.max(2, Math.round(0.04 * Math.min(w, h)));
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let seen = 0, whitish = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!(y < band || y >= h - band || x < band || x >= w - band)) continue;
    const i = y * w + x, hi = Math.max(R[i], G[i], B[i]), lo = Math.min(R[i], G[i], B[i]);
    seen++;
    if (lo >= 205 && hi - lo <= 30) { whitish++; hist[0][R[i]]++; hist[1][G[i]]++; hist[2][B[i]]++; }
  }
  const whiteShare = seen ? Math.round(1000 * whitish / seen) / 10 : 0;
  wc.edge_band_near_white_pct = whiteShare;
  if (whiteShare < 50) throw new Error('the edge of the master is not near-white (' + whiteShare + '% of it), so its background was left as it is');
  const top = [0, 0, 0], knee = [0, 0, 0], lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let c = 0; c < 3; c++) {
    let acc = 0, v = 205;
    while (v < 255 && acc + hist[c][v] < 0.05 * whitish) { acc += hist[c][v]; v += 1; }
    top[c] = Math.max(228, Math.min(253, v - 2));
    knee[c] = top[c] - 22;
    for (let i = 0; i < 256; i++) lut[c][i] = i >= top[c] ? 255 : (i > knee[c] ? Math.round(knee[c] + (i - knee[c]) * (255 - knee[c]) / (top[c] - knee[c])) : i);
  }
  const kneeMin = Math.min(knee[0], knee[1], knee[2]);
  wc.white_from = top; wc.curve_starts_at = knee;
  // 1b. Fit (owner, 20 Oct 2026, run claude-a7-4f80c2bf): a master framed so tight that the protected box leaves no safe margin at an
  //     image edge used to hold the package. It is now placed on a white canvas in code: scaled down (never up) so the product's longest
  //     side spans the white-master framing setting (FIT_SPAN_PCT), and the product box centred. No AI, nothing redrawn: the picture is
  //     resampled once more (bilinear), like the resize before it, and the new canvas is 255. The white point above was read from the
  //     master's own edge before the canvas is added, so the fill still reaches the master's own background. Only a master that would
  //     otherwise hold is fitted; any other keeps its framing.
  const boxPx = bx => {
    const mg0 = MARGIN / 1000;
    return [Math.max(0, Math.floor((bx[1] / 1000 - mg0) * w)), Math.max(0, Math.floor((bx[0] / 1000 - mg0) * h)),
      Math.min(w - 1, Math.ceil((bx[3] / 1000 + mg0) * w)), Math.min(h - 1, Math.ceil(bx[2] / 1000 * h))];
  };
  const unsafe = bx => { const p = boxPx(bx); return Math.min(p[0], w - 1 - p[2], p[1], h - 1 - p[3]) <= GUARD; };
  if (unsafe(box)) {
    const spanBefore = Math.max(box[3] - box[1], box[2] - box[0]) / 10;
    const s = Math.min(1, FIT_SPAN_PCT / spanBefore);
    const cx = (box[1] + box[3]) / 2000 * w, cy = (box[0] + box[2]) / 2000 * h;
    const R2 = new Uint8Array(N), G2 = new Uint8Array(N), B2 = new Uint8Array(N);
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      const o = Y * w + X;
      const sx = cx + (X + 0.5 - w / 2) / s - 0.5, sy = cy + (Y + 0.5 - h / 2) / s - 0.5;
      if (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5) { R2[o] = 255; G2[o] = 255; B2[o] = 255; continue; }
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
      const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0)), fy = Math.max(0, Math.min(1, sy - y0));
      const a = y0 * w + x0, b1 = y0 * w + x1, c = y1 * w + x0, d = y1 * w + x1;
      const mix = A => Math.round((A[a] * (1 - fx) + A[b1] * fx) * (1 - fy) + (A[c] * (1 - fx) + A[d] * fx) * fy);
      R2[o] = mix(R); G2[o] = mix(G); B2[o] = mix(B);
    }
    R.set(R2); G.set(G2); B.set(B2);
    const to1000 = (v, side, c0) => Math.round(((v / 1000 * side - c0) * s + side / 2) / side * 1000);
    const fitted = [to1000(box[0], h, cy), to1000(box[1], w, cx), to1000(box[2], h, cy), to1000(box[3], w, cx)];
    wc.fit = { done: true, why: 'the product box left no safe background margin at an image edge', scale: Math.round(s * 1000) / 1000,
      span_before_pct: Math.round(spanBefore * 10) / 10, span_after_pct: Math.round(spanBefore * s * 10) / 10, target_span_pct: FIT_SPAN_PCT,
      box_2d_before: box, box_2d_after: fitted,
      method: 'scaled by ' + (Math.round(s * 1000) / 1000) + ' (bilinear) and centred on a white (255) canvas in code; no AI, nothing redrawn' };
    box = fitted;
    wc.product_box_2d = box;
  }
  // 2. The product box in pixels: widened by MARGIN on the top, left and right; the bottom edge (the contact shadow side) is not widened.
  const RAMP = Math.max(8, Math.round(RAMP_PCT / 100 * Math.min(w, h)));
  wc.ramp_px = RAMP;
  const mg = MARGIN / 1000;
  const bx0 = Math.max(0, Math.floor((box[1] / 1000 - mg) * w)), bx1 = Math.min(w - 1, Math.ceil((box[3] / 1000 + mg) * w));
  const by0 = Math.max(0, Math.floor((box[0] / 1000 - mg) * h)), by1 = Math.min(h - 1, Math.ceil(box[2] / 1000 * h));
  wc.product_box_px = [bx0, by0, bx1, by1];
  const inBox = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
  // Fit the fade to each available margin. A fixed 68 px fade left narrow borders
  // unfinished. Keep eight fully white background pixels for codec edge blocks.
  const guard = GUARD;
  const gaps = { left: bx0, right: w - 1 - bx1, top: by0, bottom: h - 1 - by1 };
  if (Object.values(gaps).some(v => v <= guard)) throw new Error('the protected product box leaves no safe background margin at an image edge');
  const ramps = Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, Math.min(RAMP, v - guard)]));
  wc.edge_guard_px = guard; wc.side_ramps_px = ramps;
  // None inside the box; every fade finishes before the codec edge band.
  const weight = (x, y) => {
    const dx = x < bx0 ? (bx0 - x) / ramps.left : (x > bx1 ? (x - bx1) / ramps.right : 0);
    const dy = y < by0 ? (by0 - y) / ramps.top : (y > by1 ? (y - by1) / ramps.bottom : 0);
    return Math.min(1, Math.hypot(dx, dy));
  };
  // 3. The fill from the border, only through pixels at or above the white point (every channel), never into the box.
  const white = i => R[i] >= top[0] && G[i] >= top[1] && B[i] >= top[2];
  const region = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const tryAdd = (i, x, y) => { if (!region[i] && !inBox(x, y) && white(i)) { region[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { tryAdd(x, x, 0); tryAdd((h - 1) * w + x, x, h - 1); }
  for (let y = 0; y < h; y++) { tryAdd(y * w, 0, y); tryAdd(y * w + w - 1, w - 1, y); }
  while (sp) {
    const i = stack[--sp], x = i % w, y = (i - x) / w;
    if (x > 0) tryAdd(i - 1, x - 1, y);
    if (x < w - 1) tryAdd(i + 1, x + 1, y);
    if (y > 0) tryAdd(i - w, x, y - 1);
    if (y < h - 1) tryAdd(i + w, x, y + 1);
  }
  let inRegion = 0;
  for (let i = 0; i < N; i++) inRegion += region[i];
  wc.background_pct = Math.round(1000 * inRegion / N) / 10;
  if (wc.background_pct < 10) throw new Error('only ' + wc.background_pct + '% of the image was found as background connected to the border; nothing was changed');
  // 4. The thin band around the fill (BAND px, 8 neighbours per step), outside the box: these get the soft curve. Only near-white, low
  //    colour pixels above the knee belong to it (the faint edge of the shadow, soft background); a darker or coloured pixel never does.
  const soft = j => { const hi = Math.max(R[j], G[j], B[j]), lo = Math.min(R[j], G[j], B[j]); return lo > kneeMin && hi - lo <= 30; };
  const ring = new Uint8Array(N);
  let front = region;
  for (let k = 0; k < BAND; k++) {
    const next = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!front[i]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!region[j] && !ring[j] && !inBox(xx, yy) && soft(j)) { ring[j] = 1; next[j] = 1; }
      }
    }
    front = next;
  }
  // 5. Write the picture. Every change is counted where it happens: inside the box, and on pixels darker than the knee.
  // Owner, 16 Oct 2026, 19:26 (Phase 1 question 3), the fade is accepted on three conditions, each measured here:
  // (a) the fade stays within a small margin outside the box (RAMP px): no pixel farther than RAMP from the box is only partly changed;
  // (b) beyond that margin every background pixel is exactly 255; (c) nothing inside the product box changes (boxChanged, below).
  // 18h then checks the saved files for a grey halo.
  let changed = 0, ringChanged = 0, boxChanged = 0, darkChanged = 0, white255After = 0, beyondNot255 = 0, partialBeyond = 0, fadeMax = 0;
  const stride = Math.floor((24 * w + 31) / 32) * 4;
  const ob = Buffer.alloc(54 + stride * h);
  ob.write('BM', 0, 'latin1'); ob.writeUInt32LE(ob.length, 2); ob.writeUInt32LE(54, 10); ob.writeUInt32LE(40, 14);
  ob.writeInt32LE(w, 18); ob.writeInt32LE(h, 22); ob.writeUInt16LE(1, 26); ob.writeUInt16LE(24, 28); ob.writeUInt32LE(stride * h, 34);
  ob.writeInt32LE(2835, 38); ob.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) {
    const obase = 54 + (h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = R[i], g = G[i], bl = B[i];
      if (region[i] || ring[i]) {
        const wt = weight(x, y);
        const nr = Math.round(r + (lut[0][r] - r) * wt), ng = Math.round(g + (lut[1][g] - g) * wt), nb = Math.round(bl + (lut[2][bl] - bl) * wt);
        if (nr !== r || ng !== g || nb !== bl) {
          changed++;
          if (ring[i]) ringChanged++;
          if (inBox(x, y)) boxChanged++;
          if (Math.min(r, g, bl) <= kneeMin) darkChanged++;
        }
        r = nr; g = ng; bl = nb;
        if (region[i] && r === 255 && g === 255 && bl === 255) white255After++;
        if (wt < 1 && wt > 0 && (nr !== R[i] || ng !== G[i] || nb !== B[i])) { const dx = x < bx0 ? bx0 - x : (x > bx1 ? x - bx1 : 0), dy = y < by0 ? by0 - y : (y > by1 ? y - by1 : 0); const dd = Math.sqrt(dx * dx + dy * dy); if (dd > fadeMax) fadeMax = dd; if (dd > RAMP) partialBeyond++; }
        if (region[i] && wt >= 1 && !(r === 255 && g === 255 && bl === 255)) beyondNot255++;
      }
      const q = obase + x * 3;
      ob[q] = bl; ob[q + 1] = g; ob[q + 2] = r;
    }
  }
  wc.pixels_changed_pct = Math.round(1000 * changed / N) / 10;
  wc.band_pixels_changed = ringChanged;
  wc.background_255_after_pct = inRegion ? Math.round(1000 * white255After / inRegion) / 10 : 0;
  // Measured, not assumed (review finding 1): pixels changed inside the product box, and pixels darker than the knee that changed.
  wc.product_box_pixels_changed = boxChanged;
  wc.darker_than_knee_changed = darkChanged;
  wc.fade_margin_px = RAMP;
  wc.fade_reach_px = Math.round(fadeMax);
  wc.partly_changed_beyond_margin = partialBeyond;
  wc.background_beyond_margin_not_255 = beyondNot255;
  if (boxChanged || darkChanged) throw new Error('the clean-up would have changed ' + boxChanged + ' pixels inside the product box and ' + darkChanged + ' pixels darker than the background; nothing was changed');
  if (partialBeyond || beyondNot255) throw new Error('the fade reached past its ' + RAMP + ' px margin (' + partialBeyond + ' pixels) or left ' + beyondNot255 + ' background pixels beyond the margin below 255; nothing was changed');
  wc.done = true; wc.cleaned = true;
  cleanBin = await this.helpers.prepareBinaryData(ob, pk.base + '_clean.bmp', 'image/bmp');
} catch (e) {
  if (e !== SKIP) { wc.done = false; wc.problem = String((e && e.message) || e).slice(0, 300); }
}
pk.white_clean = wc;
if (wc.skipped) {
  // Packaged without the clean-up (owner, 19:26): pk.ok stays as it was; the steps that need the box are listed as skipped.
  pk.skipped_steps = (Array.isArray(pk.skipped_steps) ? pk.skipped_steps : []).concat(wc.skipped_steps);
} else if (!wc.done) { pk.ok = false; pk.problem = 'The package was not made: the background could not be set to 255 (' + wc.problem + '). The approved master is unchanged. Nothing was uploaded.'; }
const out = { json: { pk } };
if (wc.done || wc.skipped) out.binary = { clean: cleanBin };
return [out];
