// Stage 05 · Review verdict: code decides from the two readings. Code only (15 Oct 2026).
// A passed review is a reviewed candidate, never an approval: only the owner's go 2 approves.
// The reviewer's scores are its judgement, not a measurement, and never stand for the 90 to 95 target.
// At most two repairs per image (attempts 1 to 3). A repair is a paid image call: it runs without asking only when
// 04 Settings has auto_repair true; otherwise the owner orders it at go 2. A reader that did not answer is an owner hold.
// Framing (owner, 16 Oct 2026, 04:16) is a styling check, not an identity check: it is measured on the product's longest side and
// reported with the share; a miss never fails the image on its own and is never repaired automatically. The owner may order a
// framing repair at go 2 (the proposed repair carries the correction). A product cut off by the frame (not in a detail view) is
// still a defect: the image then does not show the whole product.
function deepText(o) {
  if (o === null || o === undefined) return '';
  if (typeof o === 'string') return o.indexOf('{') !== -1 ? o : '';
  if (Array.isArray(o)) { for (const x of o) { const t = deepText(x); if (t) return t; } return ''; }
  if (typeof o === 'object') {
    if (typeof o.text === 'string' && o.text.indexOf('{') !== -1) return o.text;
    for (const k of Object.keys(o)) { const t = deepText(o[k]); if (t) return t; }
  }
  return '';
}
function parse(t) { if (!t) return null; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
function short(v, n) { const t = typeof v === 'string' ? v : (v && v.message) ? String(v.message) : JSON.stringify(v); return String(t || '').split('\n')[0].slice(0, n); }
function clean(v, n) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 300); }
function num(v) { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; }
const arr = v => (Array.isArray(v) ? v : []);
function reading(raw, label) {
  if (!raw) return { data: null, fail: label + ' did not answer.' };
  if (raw.error) return { data: null, fail: label + ' did not answer (' + short(raw.error, 120) + ').' };
  const data = parse(deepText(raw));
  if (!data) return { data: null, fail: label + ' answered, but not in the expected format.' };
  return { data, fail: '' };
}
const MAX_ATTEMPT = 3; // the first try and at most two repairs
const WHITE_CHECKS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'no_text_or_logo', 'realism'];
// Stage 07 (16 Oct 2026): a placed scene has its own checks (see 16a).
// 16 Oct 2026 (owner decisions 22 and 23): people_ok and no_unplanned_lamp; a fail on either fails the image like any other check.
const SCENE_CHECKS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'camera_level', 'light', 'no_text_or_logo', 'realism'];
const NAMES = { piece_count: 'piece count', pieces_match: 'each piece present once', shape: 'shape', colour: 'colour', material_texture: 'material and texture', details: 'identifying details', handedness: 'left/right handedness', not_mirrored: 'not mirrored', nothing_added: 'nothing invented or added', excluded_absent: 'excluded pieces absent', context_removed: 'room context left out', background: 'pure white background', contact_shadow: 'subtle contact shadow', whole_in_frame: 'whole product in frame', framing: 'framing (about 12% white margin, about 76% span)', no_text_or_logo: 'no text, logo or watermark', realism: 'photographic realism',
  only_listed_props: 'only the product, the listed Midas pieces and the room shell', midas_pieces_match: 'Midas pieces exactly as catalogued', people_ok: 'people as ordered (none, or one adult beside or behind the product)', no_unplanned_lamp: 'no lamp except a listed Midas lamp', scale: 'plausible scale', grounding: 'grounded, natural contact shadows', camera_level: 'camera as ordered, straight verticals', light: 'consistent light' };

// Framing reading (owner, 16 Oct 2026, 04:16): the product's bounding box on its longest side, against the frame's side in the same
// direction. The share comes from the blind count's box (it is not told the target) and the candidate's pixel size; the reviewer's
// own share is kept beside it. Both are model readings of the image, not a pixel measurement.
function framingReading(crit, blind) {
  const f = settings.framing || {};
  const fr = rv.framing || { type: isScene ? ((rv.scene && rv.scene.framing) || 'hero') : 'white' };
  const type = fr.type || (isScene ? 'hero' : 'white');
  const bandOf = (v, d) => { const a = arr(v).map(Number); return a.length === 2 && a.every(Number.isFinite) && a[0] < a[1] ? a : d; };
  const reviewer = crit ? { result: clean(crit.result, 10).toLowerCase() || 'not answered', evidence: clean(crit.evidence, 240), share: num(crit.share) } : { result: 'not answered', evidence: '', share: null };
  const out = { view: type, rule: '', rule_short: '', band_pct: null, min_pct: null, measured_share_pct: null, side: '', source: '', within: null, reviewer, note: '', fix: '', label: 'A reading of the image by the review models, not a pixel measurement. Framing is a styling check: it never fails the image on its own.' };
  if (type === 'detail') {
    const min = Number(fr.min_pct) || Number(f.detail_min_pct) || 50;
    out.min_pct = min; out.rule = 'the named detail (' + (fr.detail || 'not named') + ') fills most of the frame, more than ' + min + '%'; out.rule_short = 'more than ' + min + '%';
    if (reviewer.share !== null && reviewer.share <= 100) { out.measured_share_pct = reviewer.share; out.source = 'the reviewer\'s estimate (the reviewer is told the target)'; out.within = reviewer.share > min; }
    out.fix = 'Reframe the detail view: move the camera closer so the named detail fills most of the frame (more than ' + min + '%), keeping the room, the pieces and the light.';
  } else {
    const b = type === 'white' ? bandOf(f.white_note_band_pct, [72, 80]) : bandOf(fr.band_pct, type === 'wide' ? bandOf(f.wide_span_pct, [40, 55]) : bandOf(f.hero_span_pct, [60, 70]));
    out.band_pct = b;
    out.rule = (type === 'white' ? 'white master: about ' + (Number(f.white_span_pct) || 76) + '% (a note outside ' + b[0] + '-' + b[1] + '%)' : type + ' view: ' + b[0] + '-' + b[1] + '%') + ' of the frame, on the product\'s longest side';
    out.rule_short = b[0] + '-' + b[1] + '%';
    // S6 (prompt check, 16 Oct 2026): the blind count now gives "box_2d" [ymin, xmin, ymax, xmax] on 0-1000 (Gemini's own format);
    // it is turned into left, top, right, bottom percentages here. The older percentage box is still read when box_2d is missing.
    const b2 = blind && Array.isArray(blind.box_2d) ? blind.box_2d.map(Number) : [];
    const ok2 = b2.length === 4 && b2.every(x => Number.isFinite(x) && x >= 0 && x <= 1000) && b2[0] < b2[2] && b2[1] < b2[3] && !b2.every(x => x <= 1);
    const bx = ok2 ? null : (blind && blind.box && typeof blind.box === 'object' ? blind.box : null);
    const e = ok2 ? [b2[1] / 10, b2[0] / 10, b2[3] / 10, b2[2] / 10] : (bx ? ['left', 'top', 'right', 'bottom'].map(k => Number(bx[k])) : []);
    const okBox = e.length === 4 && e.every(x => Number.isFinite(x) && x >= 0 && x <= 100) && e[0] < e[2] && e[1] < e[3] && !e.every(x => x <= 1); // edges all at or under 1 look like fractions, not percentages: not used
    const m = String((rv.candidate && rv.candidate.px) || '').match(/^(\d+)\s*x\s*(\d+)$/);
    const W = m ? Number(m[1]) : 0, H = m ? Number(m[2]) : 0;
    if (okBox) {
      const wPct = e[2] - e[0], hPct = e[3] - e[1];
      const wide = W && H ? wPct * W >= hPct * H : wPct >= hPct;
      out.side = wide ? 'width' : 'height';
      out.measured_share_pct = Math.round(wide ? wPct : hPct);
      out.source = 'the blind count\'s box' + (ok2 ? ' (box_2d, 0-1000)' : '') + (W && H ? ' and the image size ' + W + ' x ' + H : ' (image size not recorded: the frame was taken as square)');
    } else if (reviewer.share !== null && reviewer.share <= 100) { out.measured_share_pct = reviewer.share; out.source = 'the reviewer\'s estimate (the reviewer is told the target; the blind count gave no usable box)'; }
    if (out.measured_share_pct !== null) out.within = out.measured_share_pct >= b[0] && out.measured_share_pct <= b[1];
    const dir = out.side ? ' (its ' + out.side + ')' : '';
    out.fix = type === 'white'
      ? 'Reframe the white master: the product\'s longest side should span about ' + (Number(f.white_span_pct) || 76) + '% of the frame, with about ' + (Number(f.white_margin_pct) || 12) + '% white margin at each end of that side' + (out.measured_share_pct !== null ? '; it spans about ' + out.measured_share_pct + '% now' : '') + '.'
      : 'Reframe the ' + type + ' view: the product\'s longest side' + dir + ' should span about ' + b[0] + '-' + b[1] + '% of the frame' + (out.measured_share_pct !== null ? '; it spans about ' + out.measured_share_pct + '% now, so move the camera ' + (out.measured_share_pct < b[0] ? 'closer' : 'further back') : '') + ', keeping the room, the pieces and the light.';
  }
  const view = type === 'white' ? 'white master' : type + ' view';
  if (out.within === true) out.note = 'Framing (' + view + '): about ' + out.measured_share_pct + '%, within ' + out.rule_short + '.';
  else if (out.within === false) out.note = 'Framing (' + view + '): about ' + out.measured_share_pct + '%' + (out.side ? ' of the frame ' + out.side : '') + '; the rule is ' + out.rule_short + '. A styling note: the image is not failed for it. A reframe runs only if the owner orders a repair.';
  else out.note = 'Framing (' + view + '): the share could not be read from the review. A styling note, not a failure.';
  return out;
}
const st = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete st.events; delete st.row;
const rv = $('16a Review ticket').first().json.rv;
const isScene = rv.kind === 'scene';
const CHECKS = isScene ? SCENE_CHECKS : WHITE_CHECKS;
if (isScene) NAMES.framing = 'framing (' + ((rv.scene && rv.scene.framing) || 'hero') + ' view as ordered)';
const CODE_ONLY = isScene ? ['whole_in_frame'] : []; // set by code only (the blind count), never asked of the reviewer for a scene
let settings = {};
try { settings = $('04 Settings').first().json || {}; } catch (e) { settings = {}; }
const autoRepair = settings.auto_repair === true;
const now = new Date().toISOString();
const attempt = Number(rv.attempt) || 1;
const obs = st.observation || {};
const review = { output_id: rv.output_id, attempt, at: now, candidate: rv.candidate, result: '', checks: {}, defects: [], unsure: [], counts: {}, framing: null, styling_notes: [], scores: null, score_label: 'Reviewer judgement, not a measurement. Never the 90 to 95 fidelity target.', summary: '', readers: 'claude-sonnet-5-5 (review against the vendor photo) + gemini-3.8-flash (blind count) + code' };
let fail = '';
if (!rv.ready) fail = rv.why;
let critic = null, blind = null;
if (!fail) {
  const c = reading(out('16 Critic review'), 'The reviewer');
  // Fallback blind count (owner, 16 Oct 2026): gpt-6.1-sol counts only when Gemini's blind count of this round returned an error.
  const bMain = out('16x Blind count');
  const bBack = bMain && bMain.error ? out('16xb Blind count fallback (OpenAI)') : null;
  const b = bBack ? reading(bBack, 'The fallback blind count (gpt-6.1-sol, after Gemini did not answer)') : reading(bMain, 'The blind count');
  review.blind_reader = bBack ? 'gpt-6.1-sol (fallback; Gemini did not answer)' : 'gemini-3.8-flash';
  if (bBack) review.readers = 'claude-sonnet-5-5 (review against the vendor photo) + gpt-6.1-sol (blind count, fallback after Gemini did not answer) + code';
  if (c.fail || b.fail) fail = [c.fail, b.fail].filter(Boolean).join(' ') + ' The candidate is not reviewed.';
  critic = c.data; blind = b.data;
}
if (!fail) {
  const checks = critic && typeof critic.checks === 'object' && critic.checks ? critic.checks : {};
  for (const k of CHECKS) {
    const x = checks[k] && typeof checks[k] === 'object' ? checks[k] : null;
    const r = x ? clean(x.result, 10).toLowerCase() : '';
    review.checks[k] = { result: ['pass', 'fail', 'unsure'].indexOf(r) !== -1 ? r : 'not answered', evidence: x ? clean(x.evidence, 240) : '' };
  }
  // Counts: the contract, the reviewer (who knew the contract) and the blind count (who did not). Code compares them.
  const expected = Number(rv.total) || 0;
  const criticSeen = num(checks.piece_count && checks.piece_count.seen);
  const blindSeen = num(blind && blind.total);
  review.counts = { contract: expected, reviewer: criticSeen, blind: blindSeen };
  const fixes = {};
  for (const d of arr(critic && critic.defects).slice(0, 12)) {
    const k = clean(d && d.check, 40);
    if (!k) continue;
    fixes[k] = { what: clean(d.what, 240), where: clean(d.where, 120), fix: clean(d.fix, 240) };
  }
  function codeDefect(k, what, fix) {
    review.checks[k] = { result: 'fail', evidence: (review.checks[k] && review.checks[k].result === 'fail' ? review.checks[k].evidence + ' ' : '') + 'Code: ' + what };
    if (!fixes[k]) fixes[k] = { what, where: '', fix };
  }
  // A detail view need not show the whole product (owner, 16 Oct 2026, 04:16): fewer pieces in the frame is not a defect; more is.
  const isDetail = Boolean(isScene && rv.scene && rv.scene.framing === 'detail');
  review.counts.detail_view = isDetail;
  const countWrong = n => n !== null && (isDetail ? n > expected : n !== expected);
  const countFix = isDetail ? 'Show no more than the ' + expected + ' product pieces of the vendor photo, with none duplicated or invented; a detail view may show fewer.' : 'Show exactly ' + expected + ' product pieces, as in the vendor photo: no more and no fewer.';
  if (countWrong(blindSeen)) codeDefect('piece_count', 'the blind count found ' + blindSeen + ' product pieces; the contract holds ' + expected + (isDetail ? ' (a detail view may show fewer, never more)' : '') + '.', countFix);
  if (countWrong(criticSeen)) codeDefect('piece_count', 'the reviewer counted ' + criticSeen + ' product pieces; the contract holds ' + expected + (isDetail ? ' (a detail view may show fewer, never more)' : '') + '.', countFix);
  if (!isScene && blind && blind.background_white === false) codeDefect('background', 'the blind count reports a background that is not pure white.', 'Make the background pure white (#FFFFFF) at every edge, with no grey tone, gradient, floor line or horizon.');
  if (blind && blind.text_or_logo === true) codeDefect('no_text_or_logo', 'the blind count reports text, a logo or a watermark.', 'Remove all text, logos and watermarks.');
  if (!isScene && blind && blind.cropped === true) codeDefect('whole_in_frame', 'the blind count reports the product cut off by the frame.', 'Show the whole product inside the frame with white space on every side.');
  if (isScene && blind && blind.cropped === true && !(rv.scene && rv.scene.framing === 'detail')) codeDefect('whole_in_frame', 'the blind count reports the product cut off by the frame.', 'Show the whole product inside the frame.');
  review.framing = framingReading(checks.framing && typeof checks.framing === 'object' ? checks.framing : null, blind);
  if (review.framing.within === false || review.framing.within === null) review.styling_notes.push(review.framing.note);
  for (const k of CHECKS.concat(CODE_ONLY.filter(k => review.checks[k]))) {
    const r = review.checks[k].result;
    if (r === 'fail') review.defects.push({ check: k, name: NAMES[k], what: (fixes[k] && fixes[k].what) || review.checks[k].evidence, where: (fixes[k] && fixes[k].where) || '', fix: (fixes[k] && fixes[k].fix) || '' });
    else if (r !== 'pass') review.unsure.push({ check: k, name: NAMES[k], result: r, evidence: review.checks[k].evidence });
  }
  const sc = critic && critic.scores && typeof critic.scores === 'object' ? critic.scores : null;
  if (sc) { review.scores = {}; for (const k of ['fidelity', 'integrity', 'drift', 'data_loss']) { const v = num(sc[k]); review.scores[k] = v !== null && v <= 100 ? v : null; } }
  review.summary = clean(critic && critic.summary, 300);
  review.result = review.defects.length ? 'failed' : (review.unsure.length ? 'unsure' : 'passed');
}
// What a scene repair keeps of the room. A view made from the approved base view keeps its room, pieces and light, not its camera.
function roomKeep() {
  const sc0 = st.scene || {};
  const r = arr(sc0.refs).find(x => x.role === 'room');
  const n = r && r.n ? r.n : 3;
  // A series image changes one thing from the approved image it is made from (16 Oct 2026): the light, or the camera.
  if (sc0.room && sc0.room.content === 'approved view' && arr(sc0.room.changes).indexOf('light') !== -1 && arr(sc0.room.changes).indexOf('camera') === -1) return 'the room, every Midas piece where it stands, and the camera of the approved image of ' + (sc0.room.from_output || 'the base view') + ' (image ' + n + ' of the scene request); only the light differs';
  if (sc0.room && sc0.room.content === 'approved view') return 'the room, every Midas piece where it stands, and the light of the approved ' + (sc0.room.from_kind || 'base') + ' view (image ' + n + ' of the scene request); only the camera differs';
  return 'the room as it is (image ' + n + ' of the scene request)';
}
// The repair order: corrections from the review, written against the vendor photo, plus what must not change.
function repairOrder(withFraming) {
  const corr = review.defects.map(d => d.fix || ('Correct the ' + d.name + ': ' + d.what)).filter(Boolean).map(t => clean(t, 300)).slice(0, 8);
  if (withFraming && review.framing && review.framing.within === false && review.framing.fix) corr.push(review.framing.fix);
  const preserve = ['the exact inventory: ' + arr(st.inventory).map(x => x.count + ' x ' + x.item).join('; ')]
    .concat(isScene ? [roomKeep()].concat(arr(st.scene && st.scene.props).map(p => 'the Midas piece ' + p.name + ' (SKU ' + p.sku + ') exactly as catalogued')) : [])
    .concat(obs.colour_observed ? ['the colour as in the vendor photo (' + clean(obs.colour_observed, 120) + ')'] : [])
    .concat(arr(obs.sided_parts).map(x => 'handedness: ' + clean(x, 120)))
    .concat(arr(obs.design_locks).slice(0, 8).map(x => clean(x, 160)))
    .concat(review.checks ? Object.keys(review.checks).filter(k => review.checks[k].result === 'pass').map(k => NAMES[k] + ' (passed in the review)') : []);
  return { attempt: attempt + 1, corrections: corr, preserve, from_review_at: now };
}
st.review = review;
st.review_log = arr(st.review_log).concat([{ attempt, result: review.result || 'not reviewed', defects: review.defects.length, unsure: review.unsure.length, at: now, file: rv.candidate ? rv.candidate.file_name : '' }]);
st.stage = '05 Review & go 2';
st.hold_step = 16;
st.go2_route = '';
const link = rv.candidate && rv.candidate.link ? ' Candidate: ' + rv.candidate.link : '';
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = '';
  st.critical = arr(st.critical).concat([{ what: 'stage05', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' Nothing is sent again automatically.' + link;
}
let repairNow = false;
if (fail) hold(fail + (rv.candidate ? ' Look at the candidate yourself before anything else is made.' : ''));
else if (review.result === 'failed' && autoRepair && attempt < MAX_ATTEMPT) repairNow = true; // framing is never repaired automatically
else if (review.result === 'failed' && attempt >= MAX_ATTEMPT) hold('The review found ' + review.defects.length + ' problem(s) on attempt ' + attempt + ', and the two repairs for this image are used: ' + review.defects.map(d => d.name).join(', ') + '. The image is held; it is not approved.');
if (repairNow) {
  st.repair_orders = { [rv.output_id]: repairOrder(false) };
  st.status = 'repair_ordered'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
  st.next = 'The review found ' + review.defects.length + ' problem(s) on attempt ' + attempt + '. Repair ' + attempt + ' of 2 is ordered (auto_repair is on in 04 Settings): one more paid image call within the job budget.';
} else if (st.status !== 'hold') {
  // Every reviewed candidate goes to the owner. Passed, unsure and failed all wait for go 2; nothing is released without it.
  // A framing miss alone gives a proposed repair too, so the owner can order it at go 2; it never runs without the owner.
  const framingMiss = Boolean(review.framing && review.framing.within === false);
  const proposed = review.result === 'failed' || framingMiss ? repairOrder(true) : null;
  st.status = 'awaiting_go_2'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
  st.go2_round = attempt;
  st.go2_token = require('crypto').randomBytes(16).toString('hex');
  st.go2_proposed_repair = proposed;
  const can = ['approve', 'stop'].concat(attempt < MAX_ATTEMPT ? ['repair'] : []);
  const thing = isScene ? 'scene ' + rv.output_id : 'white master';
  // Scenes of one series (or of one job) are shown together for consistency (owner, 16 Oct 2026, decision 29); each is approved on its own.
  let together = null;
  if (isScene) {
    const me = arr(st.outputs).find(o => o.id === rv.output_id) || {};
    const scn = st.scenes || {};
    const group = arr(st.outputs).filter(o => o.kind !== 'white' && o.kind !== 'variation' && (me.series ? o.series && o.series.name === me.series.name : true));
    // Review fix (16 Oct 2026): an image already certain to be held (a side view with no photo of that side, or one made from such an image)
    // says so now, as 19a will hold it, instead of "not made yet".
    const willHold = (o, depth) => {
      if (!o || depth > 12) return '';
      const h = (scn.held || {})[o.id]; if (h) return clean(h.why, 200);
      if (o.camera === 'Left side' || o.camera === 'Right side') { const v = arr(st.side_views).find(x => x.output_id === o.id); if (!v || !v.photo) return 'no supplied photo shows the product\'s ' + (o.camera === 'Left side' ? 'left' : 'right') + ' side'; }
      if (o.from) { const f = arr(st.outputs).find(x => x.id === o.from); if (f && o.mode === 'room_locked' && st.room_key && o.light && f.light && o.light !== f.light) return 'the scene uses the client\'s room photo, which keeps the light it was photographed in'; if (f && !(scn.done || {})[f.id] && willHold(f, depth + 1)) return 'it is made from ' + f.id + ', which is held'; }
      return '';
    };
    together = group.map(o => { const d = (scn.done || {})[o.id]; const h = (scn.held || {})[o.id]; const w = !d && !h && o.id !== rv.output_id ? willHold(o, 0) : '';
      return { output_id: o.id, camera: o.camera || '', light: o.light_label || o.light || '', status: o.id === rv.output_id ? 'this image: waiting for your go 2' : (d ? 'approved by the owner' : (h ? 'held: ' + clean(h.why, 200) : (w ? 'will be held: ' + w : 'not made yet'))), link: d && d.candidate ? d.candidate.link || '' : '' }; });
  }
  st.go2 = {
    for: 'owner', output_id: rv.output_id, attempt, label: 'Generated image. Candidate: reviewed, not approved.',
    kind: isScene ? 'scene' : 'white', scene: rv.scene || null,
    decision_needed: 'go 2: approve this ' + thing + ', ' + (attempt < MAX_ATTEMPT ? 'order a repair, ' : '') + 'or stop. Approval is yours only; the review is not an approval.',
    candidate: rv.candidate,
    review_result: review.result === 'passed' ? 'passed: a reviewed candidate, not an approval' : (review.result === 'unsure' ? 'not passed: the reviewer was unsure on ' + review.unsure.length + ' check(s)' : 'failed: ' + review.defects.length + ' problem(s) found'),
    defects: review.defects, unsure: review.unsure, framing: review.framing, styling_notes: review.styling_notes, counts: review.counts, scores: review.scores, score_label: review.score_label, summary: review.summary,
    shown_together: together,
    repairs_left: MAX_ATTEMPT - attempt, proposed_repair: proposed ? { corrections: proposed.corrections } : null,
    answer_with: { id: st.client_run_id, run_id: st.run_id, round: attempt },
    how_to_answer: 'Send id, run_id and round exactly as in answer_with, plus decision ' + can.join(', ') + ', to the A7 decision address. repair may carry a note; the note is added to the corrections as data. The run waits 24 hours.',
    reminders: ['A passed review is a reviewed candidate, not an approval.', 'Scores are the reviewer\'s judgement, not measurements, and never stand for the 90 to 95 fidelity target.', 'Framing is a styling check: a miss is reported with its share and never fails the image on its own. A framing repair runs only if you order it.', isScene ? 'An approval records this scene only; the next scene starts after it.' : 'An approval records the white master; the package and the scenes follow.']
      .concat(isScene && st.scene && arr(st.scene.props_left_out).length ? ['Planned pieces left out of this scene: ' + arr(st.scene.props_left_out).map(x => (x.sku ? 'SKU ' + x.sku + ': ' : '') + x.why).join('; ') + '.'] : [])
  };
  st.next = 'Waiting for the owner\'s go 2 on the ' + thing + ' (attempt ' + attempt + ', review ' + review.result + '). Nothing is approved until the owner answers.' + link;
}
st.vault_only = ['review', 'repair_order', 'go2_ticket', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 16, name: 'Review', at: now, note: 'attempt ' + attempt + ': ' + (fail ? 'not reviewed' : review.result + ', ' + review.defects.length + ' defect(s), ' + review.unsure.length + ' unsure' + (review.framing && review.framing.measured_share_pct !== null ? ', framing ' + review.framing.measured_share_pct + '% (' + (review.framing.within ? 'within' : 'outside') + ' ' + review.framing.rule_short + ')' : '')) + ' → ' + st.status }]);
return [{ json: st }];
