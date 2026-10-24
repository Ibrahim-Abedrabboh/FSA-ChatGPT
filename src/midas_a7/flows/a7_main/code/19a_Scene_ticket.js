// Stage 07 · Scene ticket: which scene comes next and how it is shot. Code only, no model (16 Oct 2026).
// Runs after the owner approved the white master (and the package was made), after an empty room was made, and after each
// approved scene. One scene at a time: the empty room first (unless the client sent a room photo), then the product placed in it.
// Views (owner, 16 Oct 2026, 04:16): hero, wide and detail share one room. The widest view goes first; each later view is made
// from its approved image, with no new empty room. Framing is measured on the product's longest side (04 Settings, framing).
// Props are Midas pieces only (owner, 15 Oct 21:50): the plan's Midas pieces are re-checked on their live Midas page next;
// a spot whose piece is not confirmed stays empty. Nothing here is paid; the paid calls happen in stage 04's dispatch.
// 16 Oct 2026 (owner decisions 22-24, 27): each scene image has a fixed camera view and light preset (01). Series images after the first are
// made from an approved image of the same series (o.from), one thing changed. A Left side or Right side image runs only when a supplied
// photo shows that side (12 records it); otherwise that image is held with its reason and the queue moves on. A held image, and any image
// made from it, leaves the scene package incomplete: the run then waits for the owner and is never called complete.
const st = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete st.events; delete st.row; delete st.scene_files;
const arr = x => (Array.isArray(x) ? x : []);
const clean = (v, n) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 300));
const now = new Date().toISOString();
const SCENE_KINDS = ['lifestyle', 'hero', 'wide', 'detail', 'composition', 'scene'];
let settings = null;
try { settings = $('04 Settings').first().json; } catch (e) { settings = null; }
const cfg = settings && settings.scenes ? settings.scenes : null;
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = ''; st.hold_step = 19;
  st.critical = arr(st.critical).concat([{ what: 'scenes', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' No scene image was made or paid for in this step.';
}
const outs = arr(st.outputs).filter(o => SCENE_KINDS.indexOf(o.kind) !== -1);
// Views of one job (owner, 16 Oct 2026, 04:16): hero, wide and detail share one room, arrangement and light. Other scene kinds keep
// their order; the views follow, widest first, so the closer views can be made from its approved image (scenes.views_share_one_room).
const VIEW_ORDER = ['wide', 'hero', 'detail'];
const rank = (o, i) => (VIEW_ORDER.indexOf(o.kind) !== -1 ? 1000 + VIEW_ORDER.indexOf(o.kind) : i);
const sc = st.scenes && typeof st.scenes === 'object' ? st.scenes : { queue: outs.map((o, i) => ({ id: o.id, r: o.from || o.series ? 2000 + i : rank(o, i) })).sort((a, b) => a.r - b.r).map(x => x.id), done: {}, held: {}, log: [] };
sc.queue = arr(sc.queue); sc.done = sc.done || {}; sc.held = sc.held || {}; sc.log = arr(sc.log);
st.scenes = sc;
const ap = st.approved || null;
// White catalogue image on demand (20 Oct 2026): a job that makes none starts its scenes after go 1, with no white approval to check.
const noWhite = Boolean(st.brief && st.brief.white_master === 'not_asked') && !arr(st.outputs).some(o => o.kind === 'white');
const go1 = st.go1_last || {};
if (!cfg) hold('The scene settings could not be read (04 Settings did not run in this execution), so no scene is started.');
else if (cfg.enabled !== true) hold('Scenes are switched off in 04 Settings (scenes.enabled), so no scene is started.');
else if (!noWhite && (!ap || ap.by !== 'owner' || !ap.candidate || !/^[0-9a-f]{64}$/.test(String(ap.candidate.sha256 || '')))) hold('The owner\'s approval of the white master is not recorded with its checksum, so no scene is started.');
else if (!(go1.decision === 'go' && go1.by === 'owner')) hold('The owner\'s go 1 is not recorded for this run, so no scene is started.');
else if (!st.contract || !st.contract_stamp) hold('This run has no locked contract, so no scene is started.');
const shotsBy = Object.fromEntries(arr(st.shots).map(x => [x.output_id, x]));
const shortBy = Object.fromEntries(arr(st.retrieval && st.retrieval.shortlist).map(c => [String(c.sku), c]));
// Room family for the camera preset, from the handling profile.
const FAMILY = { bedroom: 'bedroom', bed: 'bedroom', mattress: 'bedroom', bedding: 'bedroom', dining: 'dining', 'dining-table': 'dining', dinnerware: 'dining', glassware: 'dining', 'table-linen': 'dining' };
function preset(o) {
  const fam = FAMILY[(st.profile && st.profile.id) || ''] || (['sofa', 'recliner', 'chair', 'centre-table', 'side-table'].indexOf((st.profile && st.profile.id) || '') !== -1 ? 'living' : 'default');
  // Camera height (owner, 16 Oct 2026, D9): the room presets are for room-scale furniture only. A tabletop accessory or a lamp is shot
  // with the camera near the product's mid-height (owner, 19:26), at the vendor photo's angle. A detail view gets no height line (13 Compile).
  const small = cfg.camera.small || {};
  const smallRe = new RegExp(small.pattern || '\\b(lamps?|lights?|lighting|vases?|candles?|candle holders?|candlesticks?|trays?|bowls?|clocks?|photo frames?|ornaments?|sculptures?|figurines?|bookends?|decor|accessor(?:y|ies)|tabletop|table top|planters?|jars?)\\b', 'i');
  const words = [st.profile && st.profile.id, st.profile && st.profile.name, st.brief && st.brief.product_type, st.brief && st.brief.category, st.observation && st.observation.category_seen].filter(Boolean).join(' ').replace(/-/g, ' ');
  // Review finding 4 (16 Oct 2026): the handling profile decides first (a "TV unit with LED lights" is storage, room-scale); the words
  // decide only when the profile is "general" or not a known one.
  const pid = String((st.profile && st.profile.id) || '');
  const smallIds = arr(small.profile_ids), roomIds = arr(small.room_scale_ids);
  const byProfile = smallIds.indexOf(pid) !== -1 ? 'small' : (roomIds.indexOf(pid) !== -1 ? 'room' : '');
  const isSmall = byProfile ? byProfile === 'small' : (smallRe.test(words) && !/\b(sofas?|beds?|wardrobes?|dining (?:sets?|tables?)|sectionals?|cabinets?)\b/i.test(words));
  // Review finding 3: the empty room's camera line (no images in that call): a small product's room at the height of its surface.
  // Owner, 16 Oct 2026, 19:26: camera near the product's mid-height, never 120 cm for a small product (the 75 cm and 55-60 cm values of
  // 19:26 are replaced by the 21:28 rule below). The surface is read from the plan's own words
  // for this shot (presentation, setting); without such words a tabletop profile stands on a table or console. Anything else (on the
  // floor, on a wall): near its mid-height, half its supplied height when the brief gives one, never a guessed number.
  const plan = (o && shotsBy[o.id] && shotsBy[o.id].plan) || {};
  const planWords = [plan.presentation, plan.setting].filter(Boolean).join(' ').toLowerCase();
  const onLow = new RegExp(small.low_table_pattern || '\\bon\\s+(?:a|the)?\\s*(?:coffee|centre|center|low)\\s+tables?\\b', 'i').test(planWords);
  const onTable = !onLow && new RegExp(small.table_pattern || '\\bon\\s+(?:a|the)?\\s*(?:tables?|consoles?)\\b', 'i').test(planWords);
  const tabletopProfile = byProfile ? arr(small.tabletop_ids).indexOf(pid) !== -1 : !/\b(floor|standing|wall|ceiling|pendant|chandeliers?|trees?)\b/i.test(words);
  const surface = !isSmall ? '' : (onLow ? 'low table' : (onTable ? 'table or console' : (tabletopProfile ? 'table or console' : 'floor or wall')));
  const dims = String((st.brief && st.brief.dimensions) || '');
  // A height is read only from an explicit "H" value with a unit; nothing is guessed (an unlabelled "a x b x c" is not read).
  const hOf = d => { const t = String(d || ''); const m = t.match(/\bH\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\b/i); if (!m) return null; const u = (m[2] || (/\bmm\b/i.test(t) ? 'mm' : (/\bcm\b/i.test(t) ? 'cm' : ''))).toLowerCase(); if (!u) return null; const v = Number(m[1].replace(',', '.')) * (u === 'mm' ? 0.1 : (u === 'm' ? 100 : 1)); return v > 0 ? v : null; };
  const hCm = hOf(dims);
  const mid = hCm && hCm > 0 && hCm < 400 ? Math.round(hCm / 2) : null;
  // Owner, 16 Oct 2026, 21:28 (replaces the fixed 75 cm and the 55-60 cm starting value): on a table, console or low table the camera
  // stands at the surface's height plus half the product's height, level (0 degrees tilt). The surface height is a Midas piece planned
  // for this shot that is such a surface and whose catalogue size names an "H" value (exactly one); otherwise the typical value in
  // 04 Settings (the owner's examples), marked as not measured. Without the product's own "H" value no camera number is given.
  const onSurface = surface === 'low table' || surface === 'table or console';
  const SURF = small.surface_cm || { 'table or console': 75, 'low table': 40 };
  let surfCm = null, surfFrom = '', surfShort = '';
  if (onSurface) {
    const kindRe = surface === 'low table' ? /\b(coffee|centre|center|cocktail|low)\s+tables?\b/i : /\b(console|side|end|accent|dining|dressing)\s+tables?\b|\b(consoles?|desks?|sideboards?|nightstands?|bedside|dressers?|cabinets?|tv\s+units?)\b/i;
    const withH = arr(plan.midas_pieces).map(m => shortBy[String(m.sku)]).filter(c => c && kindRe.test(String(c.kind || '') + ' ' + String(c.name || ''))).map(c => ({ c, h: hOf(c.dimensions) })).filter(x => x.h && x.h < 200);
    if (withH.length === 1) { surfCm = Math.round(withH[0].h); surfFrom = 'Midas SKU ' + withH[0].c.sku + ', its catalogue height'; surfShort = 'Midas SKU ' + withH[0].c.sku; }
    else { surfCm = Number(SURF[surface]) || (surface === 'low table' ? 40 : 75); surfFrom = small.surface_basis || 'typical height (owner example); not measured'; surfShort = 'typical, not measured'; }
  }
  const surfName = surface === 'low table' ? 'low coffee table' : 'table or console';
  // Rounded down to a whole cm, as in the owner's example (75 + 63/2 = 106.5, "about 106 cm").
  const camCm = onSurface && hCm && hCm < 400 ? Math.floor(surfCm + hCm / 2) : null;
  const roomRule = onSurface
    ? (camCm ? 'level (0 degrees tilt), at about ' + camCm + ' cm: the ' + surfName + ' top at about ' + surfCm + ' cm (' + surfShort + ') plus half the product\'s height of ' + Math.round(hCm) + ' cm'
      : 'level (0 degrees tilt), at the height of the ' + surfName + ' top (about ' + surfCm + ' cm, ' + surfShort + ') plus half the product\'s height, which is not confirmed')
    : (small.room_rule_other || 'level, near the mid-height of the product that will stand there') + (mid ? ' (about ' + mid + ' cm: half its supplied height of ' + Math.round(hCm) + ' cm)' : '');
  const heightRule = camCm ? 'level (0 degrees tilt), at about ' + camCm + ' cm (the ' + surfName + ' top plus half the product\'s height), seen from the same side as image 1 (the vendor photo)'
    : (small.rule || 'level (0 degrees tilt), near the product\'s mid-height, seen from the same side as image 1 (the vendor photo)');
  const cam = isSmall ? { family: 'tabletop or lamp', height_cm: '', height_rule: heightRule, room_rule: roomRule, tilt_deg: 0, camera_cm: camCm, surface, surface_from: onLow || onTable ? 'the plan\'s words for this shot' : (surface ? 'the handling profile' : ''), surface_cm: surfCm, surface_height_from: surfFrom, supplied_height_cm: hCm ? Math.round(hCm) : null, product_height: hCm ? Math.round(hCm) + ' cm (brief)' : 'not confirmed', decided_by: byProfile ? 'handling profile ' + pid : 'product words (profile ' + (pid || 'not set') + ')', basis: small.basis || 'owner 16 Oct 2026 (D9)' } : Object.assign({ family: fam, decided_by: byProfile ? 'handling profile ' + pid : 'product words (profile ' + (pid || 'not set') + ')' }, cfg.camera[fam] || cfg.camera.default);
  const want = String((st.brief && st.brief.preferences && st.brief.preferences.lighting) || '').toLowerCase();
  // The light preset fixed in 01 for this image (a series sets its own); older runs fall back to the client's words.
  const fixed = o && ['day', 'warm', 'night'].indexOf(o.light) !== -1 ? o.light : '';
  const key = fixed || (/night|evening|dark/.test(want) ? 'night' : (/warm|cosy|cozy|sunset|golden/.test(want) ? 'warm' : (/day|bright|natural|morning/.test(want) ? 'day' : cfg.kelvin.default || 'day')));
  const labels = cfg.kelvin.labels || {};
  // Camera view (owner, 16 Oct 2026, decision 24): 0 degrees tilt for Full frontal, Left side, 45° right and Right side; the Reference view
  // follows the vendor photo. The camera may be raised (still level) when the count cannot be read from chest height (cfg.camera.raise).
  const view = (o && o.camera) || 'Reference view';
  const views = cfg.camera.views || {};
  const raise = cfg.camera.raise || {};
  const total = arr(st.inventory).reduce((t, x) => t + (Number(x.count) || 0), 0);
  const raised = arr(raise.families).indexOf(fam) !== -1 && total >= (Number(raise.min_pieces) || 9) && view !== 'Reference view';
  return { camera: cam, camera_rules: cfg.camera.rules, view, view_rule: views[view] || '', raised: raised ? (raise.text || '') : '', raised_basis: raised ? (raise.basis || '') : '',
    light: { preset: key, label: labels[key] || key, kelvin: Number(cfg.kelvin[key]) || 4000, scene: (cfg.kelvin.scene && cfg.kelvin.scene[key]) || '', built_in: cfg.built_in_light || '', asked: fixed ? 'fixed for this image in the brief' + (o.series ? ' (' + o.series.label + ')' : '') : (want || 'nothing asked: studio default'), basis: cfg.kelvin.basis } };
}
// Framing (owner, 16 Oct 2026, 04:16): measured on the product's longest side, against the frame's side in the same direction.
// A styling check: the review reports the measured share; a miss never fails the image on its own (16b).
function band(v, d) { const a = arr(v).map(Number); return a.length === 2 && a.every(Number.isFinite) && a[0] < a[1] ? a : d; }
function framingFor(kind, plan) {
  const f = (settings && settings.framing) || {};
  const measure = 'Measure the product\'s bounding box on its longest side, against the frame\'s side in the same direction: the width for a wide piece, the height for a tall piece.';
  // P1.6 (16 Oct 2026): the first paid test's wide scene spanned about 79% against 40-55%, so the wide line names the upper limit
  // and the room left on each side of the product.
  if (kind === 'wide') { const b = band(f.wide_span_pct, [40, 55]); return { type: 'wide', measure: 'longest_side', band_pct: b, text: 'Wide view. ' + measure + ' The product\'s longest side spans only about ' + b[0] + '-' + b[1] + '% of the frame, never more than ' + b[1] + '%: the camera stands well back, so at least ' + Math.round((100 - b[1]) / 2) + '% of the frame on each side of the product, and the floor in front of it, show the room. The product stays whole in the frame and countable, never cut off.' }; }
  if (kind === 'detail') {
    const min = Number(f.detail_min_pct) || 50;
    const named = clean(plan && plan.camera, 200);
    return { type: 'detail', measure: 'named_detail', min_pct: min, detail: named || 'not named in the plan', text: 'Detail view. The named detail fills most of the frame (more than ' + min + '% of it)' + (named ? '; the plan names it: ' + named : '; the plan names no detail, so show a characteristic detail of the product as image 1 shows it') + '. The whole product is not required, but no product part may be invented.' };
  }
  const b = band(f.hero_span_pct, [60, 70]);
  return { type: 'hero', measure: 'longest_side', band_pct: b, text: 'Hero view. ' + measure + ' The product\'s longest side spans about ' + b[0] + '-' + b[1] + '% of the frame. The product is the clear subject, whole in the frame, never cut off.' };
}
let cur = sc.current || null;
if (st.status === 'hold') { /* held above */ }
else if (st.status === 'scene_room_ready') {
  const room = st.stage04 && st.stage04.candidate;
  if (!cur || cur.phase !== 'room' || !room || room.output_id !== cur.output_id + '_room') hold('An empty room was recorded, but it does not belong to the scene in progress, so the scene is not continued.');
  else {
    cur.phase = 'place'; cur.attempt = 1;
    cur.room = { source: 'made in stage 07', drive_file_id: room.drive_file_id, link: room.link, sha256: room.sha256, px: room.px, file_name: room.file_name, mime: /\.webp$/.test(room.file_name || '') ? 'image/webp' : (/\.png$/.test(room.file_name || '') ? 'image/png' : 'image/jpeg') };
    sc.log.push({ output_id: cur.output_id, event: 'room made', at: now, file: room.file_name });
  }
} else {
  // white_package_ready, scene_files_ready, scene_files_held or scenes_start (no white master): start the next scene that is neither done nor held.
  // A side view with no supplied photo of that side, or an image made from a held image, is held here and the queue moves on.
  const sideOf = x => arr(st.side_views).find(v => v.output_id === x) || null;
  let id = null;
  for (const x of sc.queue) {
    if (sc.done[x] || sc.held[x]) continue;
    const o = arr(st.outputs).find(y => y.id === x) || {};
    if (o.from && sc.held[o.from]) { sc.held[x] = { at: now, why: 'it is made from ' + o.from + ', which is held' }; sc.log.push({ output_id: x, event: 'held', at: now, why: sc.held[x].why }); continue; }
    // Review fix (16 Oct 2026): a scene placed in the client's own room photo keeps the light it was photographed in, so a series image that
    // asks for another light preset than the image it is made from cannot be made; that image is held and the queue moves on.
    if (o.from && o.mode === 'room_locked' && st.room_key) {
      const f = arr(st.outputs).find(y => y.id === o.from);
      if (f && preset(f).light.preset !== preset(o).light.preset) { sc.held[x] = { at: now, why: 'the scene uses the client\'s room photo, which keeps the light it was photographed in, so the ' + preset(o).light.label + ' version cannot be made' }; sc.log.push({ output_id: x, event: 'held', at: now, why: sc.held[x].why }); continue; }
    }
    if (o.camera === 'Left side' || o.camera === 'Right side') {
      const v = sideOf(x);
      if (!v || !v.photo) { const side = o.camera === 'Left side' ? 'left' : 'right'; sc.held[x] = { at: now, why: 'no supplied photo shows the product\'s ' + side + ' side, so the ' + o.camera + ' view would have to invent it (owner, 16 Oct 2026). Send the job again with a photo of that side to make it.' }; sc.log.push({ output_id: x, event: 'held', at: now, why: sc.held[x].why }); continue; }
    }
    id = x; break;
  }
  if (!id) {
    cur = null; sc.current = null; st.scene = null;
    // Step 20 (16 Oct 2026): every approved scene needs its delivery files (jpg and webp, short side 1125 px, and a manifest).
    // While any scene's files are held, the scene package is incomplete and the run waits for the owner; it is never called complete.
    const ids = Object.keys(sc.done);
    const held = ids.filter(k => !(sc.done[k].files && sc.done[k].files.status === 'ready'));
    const notMade = Object.keys(sc.held);
    // Full-job release is computed from the frozen requested outputs, never from the count of successes.
    const validHash = x => /^[0-9a-f]{64}$/.test(String(x || ''));
    const expected = arr(st.outputs);
    const matrix = expected.map(o => {
      const white = o.kind === 'white';
      const approval = white ? st.approved : sc.done[o.id];
      const delivery = white ? st.package : approval && approval.files;
      const release = approval && approval.release;
      const candidate = approval && approval.candidate;
      const reasons = [];
      if (!approval || approval.by !== 'owner') reasons.push('no owner approval for this output');
      if (!candidate || !candidate.drive_file_id || !validHash(candidate.sha256)) reasons.push('no immutable candidate receipt');
      if (!release || release.run_id !== st.run_id || release.output_id !== o.id || release.contract_stamp !== st.contract_stamp || release.candidate_sha256 !== (candidate && candidate.sha256)) reasons.push('approval is not bound to the current output, bytes and contract');
      if (!delivery || (white ? delivery.outcome !== 'white_package_ready' : delivery.status !== 'ready')) reasons.push('delivery is not ready');
      for (const format of ['jpg', 'webp']) {
        const f = arr(delivery && delivery.files).find(x => x.format === format);
        if (!f || !f.drive_file_id || !validHash(f.sha256) || !(Number(f.bytes) > 0)) reasons.push(format + ' has no complete saved receipt');
      }
      if (!delivery || !(white ? delivery.manifest && delivery.manifest.drive_file_id : delivery.manifest_drive_file_id) || !validHash(delivery.manifest_sha256)) reasons.push('no saved manifest receipt');
      return { output_id: o.id, kind: o.kind, complete: !reasons.length, classification: release && release.classification || 'unapproved', catalogue_eligible: Boolean(release && release.catalogue_eligible), reasons };
    });
    const missing = matrix.filter(x => !x.complete);
    const duplicateIds = new Set(expected.map(x => x.id)).size !== expected.length;
    const complete = expected.length > 0 && !duplicateIds && !missing.length;
    st.package_release = { at: now, run_id: st.run_id, contract_stamp: st.contract_stamp, complete,
      classification: !complete ? 'incomplete' : (matrix.every(x => x.classification === 'reviewed_owner_approved') ? 'reviewed_owner_approved' : 'owner_exception'),
      catalogue_eligible: complete && matrix.every(x => x.catalogue_eligible), outputs: matrix,
      problems: [].concat(!expected.length ? ['no output plan recorded'] : [], duplicateIds ? ['duplicate output IDs'] : [], missing.map(x => x.output_id + ': ' + x.reasons.join('; '))) };
    if (held.length || notMade.length || !complete) {
      hold([!complete ? 'Full package is incomplete: ' + st.package_release.problems.join(' | ') + '.' : '', held.length ? 'Approved scenes without their files: the delivery files of ' + held.length + ' scene(s) are not made: ' + held.map(k => k + ' (' + clean((sc.done[k].files && sc.done[k].files.problem) || 'no files were made', 240) + ')').join('; ') + '.' : '',
        notMade.length ? notMade.length + ' scene image(s) were held and not made: ' + notMade.map(k => k + ' (' + clean(sc.held[k].why, 240) + ')').join('; ') + '.' : '',
        ids.length ? ids.length + ' scene image(s) are approved' + (held.length ? '' : ', with their delivery files') + '.' : ''].filter(Boolean).join(' ') + ' The scene package is incomplete.');
      st.hold_step = held.length ? 20 : 19;
    } else {
      st.status = 'scenes_complete'; st.hold_reason = ''; st.critical = []; st.hold_for = '';
      const list = ids.map(k => { const f = sc.done[k].files; const jpg = arr(f.files).find(x => x.format === 'jpg') || {}; return k + ': ' + (jpg.px || '').replace('x', ' x ') + ' jpg and webp' + (jpg.link ? ' (' + jpg.link + ')' : ''); });
      st.next = ids.length ? 'All ' + ids.length + ' scene image(s) are approved by the owner, and their delivery files are in Google Drive with a manifest each: ' + list.join('; ') + '. Each image is a "Generated image".' + (ids.filter(k => sc.done[k].without_review).length ? ' Approved by eye, without an automated review: ' + ids.filter(k => sc.done[k].without_review).join(', ') + ' (shown as "Approved by the studio · not reviewed"; the client sees "Approved by the studio").' : '') : 'This job has no scene image to make.';
    }
  } else {
    const o = arr(st.outputs).find(x => x.id === id) || { id, kind: 'lifestyle' };
    const shot = shotsBy[id];
    // Edit phase 2.4 (19 Oct 2026): an edit from an approved image of the earlier version is made from that image (checked by E2 and kept
    // in scenes.edit_base), never from the client's room photo or an empty room.
    const eBase = o.edit_from_result && sc.edit_base && sc.edit_base.id === o.from ? sc.edit_base : null;
    const roomLocked = !o.edit_from_result && o.mode === 'room_locked' && st.room_key;
    // Shared room: the first view in the queue (the widest) is the base; a later view is made from the base's approved image.
    // A series image names the image it is made from (o.from, set in 01): that one is its base, whatever the setting says.
    const isView = VIEW_ORDER.indexOf(o.kind) !== -1 && !o.series;
    const baseId = o.from || sc.queue.find(q => { const x = arr(st.outputs).find(y => y.id === q); return x && VIEW_ORDER.indexOf(x.kind) !== -1 && !x.series; });
    const shared = Boolean(o.edit_from_result) || (!roomLocked && ((o.from && baseId) || (cfg.views_share_one_room === true && isView && baseId && baseId !== id)));
    const base = shared ? (o.edit_from_result ? eBase : sc.done[baseId]) : null;
    const baseKind = shared ? (eBase ? eBase.kind : ((arr(st.outputs).find(y => y.id === baseId) || {}).kind || '')) : '';
    if (!shot || !shot.plan) hold('Scene ' + id + ' has no checked plan from go 1, so it is not started.');
    else if (o.edit_from_result && !(base && base.by === 'owner' && base.candidate && /^[0-9a-f]{64}$/.test(String(base.candidate.sha256 || '')) && base.candidate.drive_file_id)) hold('Scene ' + id + ' is an edit of an approved image, but that image is not recorded as checked against the earlier run (E2), so the edit is not started.');
    else if (shared && !(base && base.by === 'owner' && base.candidate && /^[0-9a-f]{64}$/.test(String(base.candidate.sha256 || '')) && base.candidate.drive_file_id)) hold('Scene ' + id + ' shares its room with the ' + baseKind + ' view (' + baseId + '), but the owner\'s approval of that view is not recorded with its file and checksum, so this view is not started.');
    else {
      const bc = shared ? base.candidate : null;
      const baseOut = shared ? (eBase ? { kind: eBase.kind, camera: eBase.view, light: eBase.light } : (arr(st.outputs).find(y => y.id === baseId) || {})) : {};
      const pr = preset(o);
      // What changes from the image this one is made from: the camera view, the light preset, or (a closer view) the framing only.
      const basePr = shared ? preset(baseOut) : null;
      // An edit names its own changes (01, from the owner's options): the camera, the light, and the edit itself (up to two options).
      const changes = eBase ? arr(o.edit_changes) : (shared ? [basePr.view !== pr.view ? 'camera' : '', basePr.light.preset !== pr.light.preset ? 'light' : ''].filter(Boolean) : []);
      const v = (o.camera === 'Left side' || o.camera === 'Right side') ? arr(st.side_views).find(x => x.output_id === id) : null;
      // One thing changes from the approved image (16 Oct 2026, this build): 01 never plans both, so both differing is held, not guessed.
      if (!eBase && changes.length > 1) hold('Scene ' + id + ' is made from the approved image of ' + baseId + ', but both its camera view (' + basePr.view + ' to ' + pr.view + ') and its light (' + basePr.light.label + ' to ' + pr.light.label + ') differ from it. Only one may change, so this view is not started.');
      else cur = { output_id: id, kind: o.kind, mode: eBase ? 'edit_from_result' : (o.mode || 'creative_room'), phase: roomLocked || shared || cfg.architect_room_first !== true ? 'place' : 'room', attempt: 1, started_at: now,
        shot: { n: shot.n, frame: shot.frame, plan: shot.plan }, presets: pr, framing: framingFor(o.kind, shot.plan), series: o.series || null,
        side: v && v.photo ? { side: v.side, camera: o.camera, photo: v.photo } : null,
        room: roomLocked ? { source: 'client room photo', key: st.room_key }
          : (shared ? { source: 'made in stage 07', content: 'approved view', from_output: eBase ? eBase.output_id : baseId, from_kind: baseKind, from_view: basePr.view, from_light: basePr.light.preset, changes: changes.length ? changes : ['camera'], ...(eBase ? { edit: true, from_run: eBase.run_id } : {}), drive_file_id: bc.drive_file_id, link: bc.link || '', sha256: bc.sha256, px: bc.px || '', file_name: bc.file_name || '', mime: /\.webp$/.test(bc.file_name || '') ? 'image/webp' : (/\.png$/.test(bc.file_name || '') ? 'image/png' : 'image/jpeg') } : null) };
      if (eBase) cur.edit = { from_run: eBase.run_id, from_output: eBase.output_id, changes, options: arr(o.edit_options), change_text: clean(st.brief && st.brief.edit && st.brief.edit.changes, 600), keep_text: clean(st.brief && st.brief.edit && st.brief.edit.preserve, 600) };
      if (eBase || changes.length <= 1) sc.log.push({ output_id: id, event: eBase ? 'edit started' : 'scene started', at: now, phase: cur.phase, room: eBase ? 'the approved image ' + eBase.output_id + ' of the earlier run ' + eBase.run_id : (shared ? 'the approved ' + baseKind + ' view (' + baseId + ')' : (roomLocked ? 'client room photo' : 'its own')) });
    }
  }
}
if (cur && st.status !== 'hold') {
  // Scale: supplied sizes only (owner, 21:48: photo-read dimensions are internal only).
  cur.scale = { product: clean(st.brief && st.brief.dimensions, 120) || 'not confirmed', basis: st.brief && st.brief.dimensions ? 'supplied in the brief' : 'no size supplied; the scene keeps a plausible scale and the review reports an oversize' };
  // Props for the placement only: the plan's Midas pieces, at most N, each with its catalogue card. Checked live next (19b-19c).
  cur.props = [];
  cur.props_left_out = [];
  if (cur.phase === 'place') {
    const max = Number(cfg.max_midas_pieces_per_scene) || 3;
    // A view made from the approved base view keeps that view's Midas pieces: they are already in the image it is made from.
    // Its own plan's pieces are not added (16 Oct 2026, review finding). 19g holds the view if one of them is no longer confirmed.
    const isEdit = Boolean(cur.room && cur.room.edit && sc.edit_base);
    const baseDone = cur.room && cur.room.content === 'approved view' ? (isEdit ? sc.edit_base : sc.done[cur.room.from_output]) : null;
    let planned = arr(cur.shot.plan.midas_pieces);
    if (baseDone) {
      const basePlan = isEdit ? (sc.edit_base.plan || {}) : ((shotsBy[cur.room.from_output] && shotsBy[cur.room.from_output].plan) || {});
      const baseSkus = arr(baseDone.props).map(p => String(p.sku));
      for (const m of planned) if (baseSkus.indexOf(String(m.sku)) === -1) cur.props_left_out.push({ sku: String(m.sku), why: 'not in the approved ' + cur.room.from_kind + ' view, which this view is made from' });
      planned = baseSkus.map(sku => Object.assign({ sku }, arr(basePlan.midas_pieces).find(m => String(m.sku) === sku) || {}));
      // Edit phase 2.4: the props option removes the approved image's Midas pieces (Remove all) or keeps only the first (Fewer). A removed
      // piece is not sent and not checked; the image no longer shows it.
      const po = isEdit ? arr(cur.edit && cur.edit.options).find(x => x.kind === 'props') : null;
      if (po) { const keepN = po.value === 'Fewer' ? 1 : 0; for (const m of planned.slice(keepN)) cur.props_left_out.push({ sku: String(m.sku), why: 'removed by the owner\'s edit (' + po.value + ')' }); planned = planned.slice(0, keepN); }
      cur.base_props = planned.map(m => String(m.sku));
    }
    for (const m of planned) {
      const c = shortBy[String(m.sku)];
      if (!c) { cur.props_left_out.push({ sku: String(m.sku), why: 'not on this run\'s checked shortlist' }); continue; }
      if (cur.props.length >= max) { cur.props_left_out.push({ sku: c.sku, why: 'more than ' + max + ' Midas pieces in one scene' }); continue; }
      if (!/^https:\/\/midasfurniture\.com\//.test(String(c.url || '')) || !/^https:\/\/midasfurniture\.com\/media\//.test(String(c.catalogue_photo || ''))) { cur.props_left_out.push({ sku: c.sku, why: 'no Midas page or catalogue photo address on record' }); continue; }
      cur.props.push({ sku: c.sku, name: c.name, kind: c.kind, url: c.url, photo_url: c.catalogue_photo, purpose: clean(m.purpose, 160), rests_on: clean(m.rests_on, 120), catalogue_dimensions: c.dimensions || 'not confirmed', catalogue_read_on: c.retrieved_on });
    }
    // The person (owner, 16 Oct 2026, decision 22): only when the brief allows one; a view made from an approved image keeps that image's person.
    const allowPerson = st.brief && st.brief.preferences && st.brief.preferences.people === 'one';
    const personPlan = baseDone ? (isEdit ? (sc.edit_base.plan || {}) : ((shotsBy[cur.room.from_output] && shotsBy[cur.room.from_output].plan) || {})) : cur.shot.plan;
    cur.person = allowPerson ? clean(personPlan.person, 240) : '';
    const generic = baseDone ? [] : arr(cur.shot.plan.supporting_props);
    if (generic.length) cur.props_left_out.push({ sku: '', why: 'generic props are not used in Studio scenes (owner, 15 Oct 21:50): ' + generic.map(g => clean(g, 60)).join('; ') });
  }
  sc.current = cur;
  st.scene = cur;
  st.status = 'scene_preparing'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.next = 'Scene ' + cur.output_id + ': preparing the ' + (cur.phase === 'room' ? 'empty room' : (cur.edit ? 'edit of the approved image ' + cur.edit.from_output + ' of the earlier run (changes: ' + cur.edit.changes.join(', ') + ')' : (cur.room && cur.room.content === 'approved view' ? cur.kind + ' view, made from the approved image of ' + cur.room.from_output + ' (same room and pieces; ' + (cur.room.changes.indexOf('light') !== -1 ? 'only the light changes' : 'only the camera moves') + ')' : 'placement')) + (cur.props.length ? ' (live stock check of ' + cur.props.length + ' Midas piece(s) first)' : '')) + '. No paid call was made in this step.';
}
st.stage = '07 Scenes';
st.vault_only = ['scene_ticket', 'package_release', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 19, name: 'Scene ticket', at: now, note: st.status === 'scene_preparing' ? st.scene.output_id + ' · ' + st.scene.phase + (st.scene.props.length ? ' · ' + st.scene.props.length + ' Midas piece(s) to check' : '') : st.status }]);
return [{ json: st }];
