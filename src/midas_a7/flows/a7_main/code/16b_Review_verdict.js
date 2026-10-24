// Stage 05 · Review verdict: code decides from the two readings. Code only (15 Oct 2026).
// A passed review is a reviewed candidate, never an approval: only the owner's go 2 approves.
// The reviewer's scores are its judgement, not a measurement, and never stand for the 90 to 95 target.
// At most two repairs per image (attempts 1 to 3). A repair is a paid image call: it runs without asking only when
// 04 Settings has auto_repair true; otherwise the owner orders it at go 2. A reader that did not answer is an owner hold.
// Framing (owner, 16 Oct 2026, 04:16) is a styling check, not an identity check: it is measured on the product's longest side and
// reported with the share; a miss never fails the image on its own and is never repaired automatically. The owner may order a
// framing repair at go 2 (the proposed repair carries the correction). A product cut off by the frame (not in a detail view) is
// still a defect: the image then does not show the whole product.
// Phase 1 (owner, 16 Oct 2026, 11:3x-11:45):
// D5: in a scene, only identity checks and these styling checks fail the image: a prop or piece not in the plan (only_listed_props,
//   no_unplanned_lamp), floating or poorly grounded furniture (grounding), clearly wrong scale (scale). Light, camera level, realism and
//   framing are notes only. A failed scene still goes to the owner's go 2 with its reason. Nothing repairs itself: auto_repair is ignored.
// D6: "cut off by the frame" is checked in code from the blind count's box (a box edge within 15/1000 of the frame edge), not only by a
//   reader's flag; a flag with the box clearly inside makes the check "unsure", not passed (review finding 5, 16 Oct 2026). From 21:28
//   (owner, item 6) the blind count is told that a covered part is "hidden", not "cropped"; its hidden list is kept in review.crop.
// D3: a candidate that was not reviewed (a reader did not answer) goes to the owner, who may order one "review again" per candidate image
//   (review and blind count only, on the stored image, no image call; its estimated cost is shown first). If that review also
//   does not answer, the owner may approve by eye; that is recorded as "approved by owner without an automated review".
// P1.10: when one reader answers and the other does not, the answer that came is kept in the record.
// P1.8: the token counts of the review calls are recorded in st.text_calls (from the providers' usage fields).
function sidedText(x) {
  if (typeof x === 'string') return x.trim();
  if (!x || typeof x !== 'object') return '';
  if (typeof x.piece === 'string' && typeof x.side === 'string') return x.piece.trim() + ': ' + x.side.trim();
  return JSON.stringify(x);
}
function bodyOf(o) {
  // The answer part of a provider reply, so an echoed prompt or instruction is never read as the answer (P1.8: replies are not simplified).
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o.output)) return o.output;
  if (Array.isArray(o.candidates)) return o.candidates;
  if (o.content !== undefined) return o.content;
  if (o.message !== undefined) return o.message;
  return o;
}
function usageOf(o) {
  if (!o || typeof o !== 'object') return null;
  const u = o.usage || o.usageMetadata || (o.response && o.response.usage) || null;
  if (!u || typeof u !== 'object') return null;
  const n = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  if (u.promptTokenCount !== undefined || u.candidatesTokenCount !== undefined) return { input: n(u.promptTokenCount), output: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount) };
  if (u.input_tokens !== undefined || u.output_tokens !== undefined) return { input: n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens), output: n(u.output_tokens) };
  if (u.prompt_tokens !== undefined) return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
  return null;
}
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
  const data = parse(deepText(bodyOf(raw)));
  if (!data) return { data: null, fail: label + ' answered, but not in the expected format.' };
  return { data, fail: '' };
}
const MAX_ATTEMPT = 3; // the first try and at most two repairs
const WHITE_CHECKS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'context_removed', 'background', 'contact_shadow', 'whole_in_frame', 'no_text_or_logo', 'realism'];
// Stage 07 (16 Oct 2026): a placed scene has its own checks (see 16a).
// 16 Oct 2026 (owner decisions 22 and 23): people_ok and no_unplanned_lamp; a fail on either fails the image like any other check.
const SCENE_CHECKS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'camera_level', 'light', 'no_text_or_logo', 'realism'];
// D5 (owner, 16 Oct 2026, 11:45): in a scene these are notes only. A fail or unsure on them never fails the image; it is shown at go 2
// and goes into the proposed repair, which runs only if the owner orders it.
const SCENE_NOTE_ONLY = ['camera_level', 'light', 'realism'];
const EDGE = 15; // D6: a box edge within 15 of 1000 of the frame edge counts as cut off by the frame (as in 04-06 Evidence, fix 3)
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
// Edit phase 1 (19 Oct 2026): an owner edit adds its own check (16a asks it only then); a fail fails the image like any other check.
const CHECKS = (isScene ? SCENE_CHECKS : WHITE_CHECKS).concat(rv.edit ? ['edit_applied'] : [], rv.edit_base ? ['unchanged_from_base'] : []);
NAMES.edit_applied = 'requested edit applied, kept parts unchanged';
// Edit phase 2.4 (19 Oct 2026): an edit of an approved image is also checked against that image (16a sends it last); counted like edit_applied.
NAMES.unchanged_from_base = 'everything the edit does not name is as in the approved image';
if (isScene) NAMES.framing = 'framing (' + ((rv.scene && rv.scene.framing) || 'hero') + ' view as ordered)';
const CODE_ONLY = isScene ? ['whole_in_frame'] : []; // set by code only (the blind count), never asked of the reviewer for a scene
let settings = {};
try { settings = $('04 Settings').first().json || {}; } catch (e) { settings = {}; }
// "Nothing repairs itself" (owner, 16 Oct 2026, D5): a repair runs only when the owner orders it at go 2, whatever 04 Settings says.
const autoRepair = false;
const now = new Date().toISOString();
const attempt = Number(rv.attempt) || 1;
const obs = st.observation || {};
// Keep the category focus with the exact candidate review; existing verdict policy still decides.
const categoryRequirements = arr(rv.category_checks).filter(x => typeof x === 'string');
const review = { output_id: rv.output_id, attempt, at: now, candidate: rv.candidate, category_requirements: categoryRequirements, result: '', checks: {}, defects: [], unsure: [], counts: {}, framing: null, styling_notes: [], scores: null, score_label: 'Reviewer judgement, not a measurement. Never the 90 to 95 fidelity target.', summary: '', readers: 'claude-sonnet-5-5 (review against the vendor photo) + gemini-3.8-flash (blind count) + code' };
// Review again (D3): one per candidate image, that is per output and attempt (review finding 12: a repair makes a new candidate, which
// may have its own review again). It is recorded in the state when the owner orders it (G2).
const ra = st.review_again && st.review_again.output_id === rv.output_id && Number(st.review_again.attempt) === attempt ? st.review_again : null;
if (ra) review.review_again = { ordered_at: ra.ordered_at || '', by: 'owner' };
// Token counts of this round's calls (P1.8). Prices: st.text_prices, written at intake (01 Intent & scope).
const P = st.text_prices || {};
function textCall(node, model, raw) {
  if (!raw) return;
  const u = usageOf(raw);
  const pr = P.models && P.models[model] ? P.models[model] : null;
  const usd = u && pr ? Number(((u.input * pr.input + u.output * pr.output) / 1e6).toFixed(5)) : null;
  const rec = { step: 16, node, model, output_id: rv.output_id, attempt, at: now, tokens: u, usd, error: raw.error ? short(raw.error, 120) : '', basis: u ? (pr ? 'provider token counts x prices read ' + (P.read_on || '?') + ' (' + (pr.source || '') + '); an estimate, not an invoice' : 'provider token counts; no price recorded for this model') : 'the provider reported no token counts (the call may still be charged)' };
  st.text_calls = arr(st.text_calls).concat([rec]);
  st.text_calls_new = arr(st.text_calls_new).concat([rec]);
}
let fail = '';
if (!rv.ready) fail = rv.why;
let critic = null, blind = null, oneAnswered = '';
if (!fail) {
  const rawC = out('16 Critic review');
  const c = reading(rawC, 'The reviewer');
  // Fallback blind count (owner, 16 Oct 2026): gpt-6.1-sol counts only when Gemini's blind count of this round returned an error.
  const bMain = out('16x Blind count');
  const bBack = bMain && bMain.error ? out('16xb Blind count fallback (OpenAI)') : null;
  const b = bBack ? reading(bBack, 'The fallback blind count (gpt-6.1-sol, after Gemini did not answer)') : reading(bMain, 'The blind count');
  textCall('16 Critic review', 'claude-sonnet-5-5', rawC);
  textCall('16x Blind count', 'gemini-3.8-flash', bMain);
  if (bBack) textCall('16xb Blind count fallback (OpenAI)', 'gpt-6.1-sol', bBack);
  review.blind_reader = bBack ? 'gpt-6.1-sol (fallback; Gemini did not answer)' : 'gemini-3.8-flash';
  if (bBack) review.readers = 'claude-sonnet-5-5 (review against the vendor photo) + gpt-6.1-sol (blind count, fallback after Gemini did not answer) + code';
  if (c.fail || b.fail) fail = [c.fail, b.fail].filter(Boolean).join(' ') + ' The candidate is not reviewed.';
  critic = c.data; blind = b.data;
  if (fail && (critic || blind)) oneAnswered = critic ? 'reviewer' : 'blind count';
}
const isDetail = Boolean(isScene && rv.scene && rv.scene.framing === 'detail');
// D6: where the blind count's box lies against the frame (box_2d [ymin, xmin, ymax, xmax] on 0-1000).
function boxEdge(b) {
  const b2 = b && Array.isArray(b.box_2d) ? b.box_2d.map(Number) : [];
  if (!(b2.length === 4 && b2.every(x => Number.isFinite(x) && x >= 0 && x <= 1000) && b2[0] < b2[2] && b2[1] < b2[3] && !b2.every(x => x <= 1))) return null;
  return Math.min(b2[0], b2[1], 1000 - b2[2], 1000 - b2[3]);
}
// P1.10: the reviewer's checks are written into the record whenever the reviewer answered, even when the round is not reviewed.
function fillChecks(c) {
  const checks = c && typeof c.checks === 'object' && c.checks ? c.checks : {};
  for (const k of CHECKS) {
    const x = checks[k] && typeof checks[k] === 'object' ? checks[k] : null;
    const r = x ? clean(x.result, 10).toLowerCase() : '';
    review.checks[k] = { result: ['pass', 'fail', 'unsure'].indexOf(r) !== -1 ? r : 'not answered', evidence: x ? clean(x.evidence, 240) : '' };
  }
  return checks;
}
if (fail && critic) {
  const checks = fillChecks(critic);
  review.counts = { contract: Number(rv.total) || 0, reviewer: num(checks.piece_count && checks.piece_count.seen), blind: null };
  // Review finding 8 (16 Oct 2026): the D5 note-only checks (light, camera level, realism, framing) stay notes here too, never defects.
  const noteOnlyP = isScene ? SCENE_NOTE_ONLY : [];
  review.notes_only = [];
  for (const k of CHECKS) {
    const r = review.checks[k].result;
    if (noteOnlyP.indexOf(k) !== -1 && r !== 'pass') { review.notes_only.push({ check: k, name: NAMES[k], result: r, evidence: review.checks[k].evidence, fix: '' }); continue; }
    if (r === 'fail') review.defects.push({ check: k, name: NAMES[k], what: review.checks[k].evidence, where: '', fix: '' }); else if (r !== 'pass') review.unsure.push({ check: k, name: NAMES[k], result: r, evidence: review.checks[k].evidence });
  }
  const sc = critic.scores && typeof critic.scores === 'object' ? critic.scores : null;
  if (sc) { review.scores = {}; for (const k of ['fidelity', 'integrity', 'drift', 'data_loss']) { const v = num(sc[k]); review.scores[k] = v !== null && v <= 100 ? v : null; } }
  review.score_label = 'From an incomplete review (the blind count did not answer): the reviewer\'s judgement only, not a measurement, not a passed review, and never the 90 to 95 fidelity target.';
  review.summary = clean(critic.summary, 300);
  review.partial = 'Only the reviewer answered; the blind count did not. These findings are kept for the record; the candidate is not reviewed.';
}
if (fail && !critic && blind) {
  review.counts = { contract: Number(rv.total) || 0, reviewer: null, blind: num(blind.total) };
  review.partial = 'Only the blind count answered (' + (num(blind.total) === null ? 'no count' : num(blind.total) + ' pieces') + '); the reviewer did not. The candidate is not reviewed.';
}
if (fail) review.result = 'not reviewed';
if (!fail) {
  const checks = fillChecks(critic);
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
  review.counts.detail_view = isDetail;
  const countWrong = n => n !== null && (isDetail ? n > expected : n !== expected);
  const countFix = isDetail ? 'Show no more than the ' + expected + ' product pieces of the vendor photo, with none duplicated or invented; a detail view may show fewer.' : 'Show exactly ' + expected + ' product pieces, as in the vendor photo: no more and no fewer.';
  if (countWrong(blindSeen)) codeDefect('piece_count', 'the blind count found ' + blindSeen + ' product pieces; the contract holds ' + expected + (isDetail ? ' (a detail view may show fewer, never more)' : '') + '.', countFix);
  if (countWrong(criticSeen)) codeDefect('piece_count', 'the reviewer counted ' + criticSeen + ' product pieces; the contract holds ' + expected + (isDetail ? ' (a detail view may show fewer, never more)' : '') + '.', countFix);
  if (!isScene && blind && blind.background_white === false) codeDefect('background', 'the blind count reports a background that is not pure white.', 'Make the background pure white (#FFFFFF) at every edge, with no grey tone, gradient, floor line or horizon.');
  if (blind && blind.text_or_logo === true) codeDefect('no_text_or_logo', 'the blind count reports text, a logo or a watermark.', 'Remove all text, logos and watermarks.');
  // D6 (owner, 16 Oct 2026): cut off by the frame is decided in code from the blind count's box where it gives one; its "cropped" flag
  // alone decides only when no usable box came back. Not in a detail view (the whole product is not required there).
  if (!isDetail) {
    const edge = boxEdge(blind);
    const flagged = Boolean(blind && blind.cropped === true);
    const cut = edge !== null ? edge <= EDGE : flagged;
    review.crop = { box_edge: edge, edge_limit: EDGE, reader_flag: flagged, decided_by: edge !== null ? 'code, from the blind count\'s box (0-1000)' : (blind ? 'the blind count\'s flag (no usable box)' : 'not known'), cut_off: cut, hidden: blind && Array.isArray(blind.hidden) ? blind.hidden.slice(0, 12).map(x => String(x).slice(0, 160)) : [] };
    if (cut) codeDefect('whole_in_frame', edge !== null ? 'the product\'s box reaches the frame edge (' + edge + ' of 1000 from it; the limit is ' + EDGE + '), so part of the product is cut off by the frame.' : 'the blind count reports the product cut off by the frame and gave no usable box.', isScene ? 'Show the whole product inside the frame.' : 'Show the whole product inside the frame with white space on every side.');
    else if (flagged) {
      // Review finding 5 (16 Oct 2026): the box and the flag disagree, so the check is "unsure" (not passed), never a quiet note. The
      // owner still decides at go 2. A piece hidden behind another may be what the reader meant; that is not a crop.
      review.crop.disagree = true;
      const ev = 'Code: the blind count said "cropped", but its box is ' + edge + ' of 1000 from the nearest frame edge (the limit is ' + EDGE + '). The two disagree, so this is unsure, not passed. A piece hidden behind another is not a crop; please look at the frame edges.';
      if (!(review.checks.whole_in_frame && review.checks.whole_in_frame.result === 'fail')) review.checks.whole_in_frame = { result: 'unsure', evidence: ev };
    }
  }
  review.framing = framingReading(checks.framing && typeof checks.framing === 'object' ? checks.framing : null, blind);
  if (review.framing.within === false || review.framing.within === null) review.styling_notes.push(review.framing.note);
  const noteOnly = isScene ? SCENE_NOTE_ONLY : [];
  review.notes_only = [];
  for (const k of CHECKS.concat(CODE_ONLY.filter(k => review.checks[k]))) {
    const r = review.checks[k].result;
    if (noteOnly.indexOf(k) !== -1 && r !== 'pass') {
      // D5: noted, never a failure. Its fix goes into the proposed repair the owner may order.
      review.notes_only.push({ check: k, name: NAMES[k], result: r, evidence: review.checks[k].evidence, fix: (fixes[k] && fixes[k].fix) || '' });
      review.styling_notes.push('Styling note (' + NAMES[k] + ', ' + r + '): ' + (review.checks[k].evidence || 'no evidence given') + ' A note only: the image is not failed for it.');
      continue;
    }
    if (r === 'fail') review.defects.push({ check: k, name: NAMES[k], what: (fixes[k] && fixes[k].what) || review.checks[k].evidence, where: (fixes[k] && fixes[k].where) || '', fix: (fixes[k] && fixes[k].fix) || '' });
    else if (r !== 'pass') review.unsure.push({ check: k, name: NAMES[k], result: r, evidence: review.checks[k].evidence });
  }
  const sc = critic && critic.scores && typeof critic.scores === 'object' ? critic.scores : null;
  if (sc) { review.scores = {}; for (const k of ['fidelity', 'integrity', 'drift', 'data_loss']) { const v = num(sc[k]); review.scores[k] = v !== null && v <= 100 ? v : null; } }
  review.summary = clean(critic && critic.summary, 300);
  review.result = review.defects.length ? 'failed' : (review.unsure.length ? 'unsure' : 'passed');
}
// Review finding 1 (16 Oct 2026): the blind count's product box is kept with the review, so the delivery files (18e3) can leave the
// product untouched. Recorded whenever the blind count answered with a usable box, reviewed or not.
if (blind && boxEdge(blind) !== null) { review.product_box_2d = blind.box_2d.map(Number); review.product_box_flagged = blind.cropped === true; } // flag: Phase 1.3 follow-up
// What a scene repair keeps of the room. A view made from the approved base view keeps its room, pieces and light, not its camera.
function roomKeep() {
  const sc0 = st.scene || {};
  const r = arr(sc0.refs).find(x => x.role === 'room');
  const n = r && r.n ? r.n : 3;
  // Edit phase 2.4: an edit keeps everything in the approved image it starts from except what the owner's edit names.
  if (sc0.room && sc0.room.content === 'approved view' && sc0.room.edit) { const ch = arr(sc0.room.changes); return 'everything in the approved image ' + (sc0.room.from_output || '') + ' of the earlier version (image ' + n + ' of the scene request) except what the owner-requested edit names' + (ch.indexOf('camera') !== -1 ? ' and the camera view' : '') + (ch.indexOf('light') !== -1 ? ' and the light' : ''); }
  // A series image changes one thing from the approved image it is made from (16 Oct 2026): the light, or the camera.
  if (sc0.room && sc0.room.content === 'approved view' && arr(sc0.room.changes).indexOf('light') !== -1 && arr(sc0.room.changes).indexOf('camera') === -1) return 'the room, every Midas piece where it stands, and the camera of the approved image of ' + (sc0.room.from_output || 'the base view') + ' (image ' + n + ' of the scene request); only the light differs';
  if (sc0.room && sc0.room.content === 'approved view') return 'the room, every Midas piece where it stands, and the light of the approved ' + (sc0.room.from_kind || 'base') + ' view (image ' + n + ' of the scene request); only the camera differs';
  return 'the room as it is (image ' + n + ' of the scene request)';
}
// The repair order: corrections from the review, written against the vendor photo, plus what must not change.
// withNotes: the owner may order a repair for a styling note too (framing, and D5's light, camera level and realism); never automatic.
function repairOrder(withNotes) {
  const corr = review.defects.map(d => d.fix || ('Correct the ' + d.name + ': ' + d.what)).filter(Boolean).map(t => clean(t, 300)).slice(0, 8);
  if (withNotes && review.framing && review.framing.within === false && review.framing.fix) corr.push(review.framing.fix);
  if (withNotes) for (const x of arr(review.notes_only)) corr.push(clean(x.fix || ('Correct the ' + x.name + ': ' + x.evidence), 300));
  const preserve = ['the exact inventory: ' + arr(st.inventory).map(x => x.count + ' x ' + x.item).join('; ')]
    .concat(isScene ? [roomKeep()].concat(arr(st.scene && st.scene.props).map(p => 'the Midas piece ' + p.name + ' (SKU ' + p.sku + ') exactly as catalogued')) : [])
    .concat(obs.colour_observed ? ['the colour as in the vendor photo (' + clean(obs.colour_observed, 120) + ')'] : [])
    .concat(arr(obs.sided_parts).map(sidedText).filter(Boolean).map(x => 'handedness: ' + clean(x, 120)))
    .concat(arr(obs.design_locks).slice(0, 8).map(x => clean(x, 160)))
    .concat(review.checks ? Object.keys(review.checks).filter(k => review.checks[k].result === 'pass').map(k => NAMES[k] + ' (passed in the review)') : []);
  return { attempt: attempt + 1, corrections: corr.slice(0, 10), preserve, from_review_at: now };
}
// The estimated cost of one "review again" (D3), shown on the go 2 ticket before the owner orders it. An upper bound, not a quote.
function reviewAgainCost() {
  const m = P.models || {};
  const c = m['claude-sonnet-5-5'], g = m['gemini-3.8-flash'], o = m['gpt-6.1-sol'];
  if (!c || !g || !o) return { up_to_usd: null, basis: 'not known: no text prices were recorded at intake for this run.' };
  const imgTok = Number(P.assumed_image_tokens) || 1600;
  const cap = P.output_caps || {};
  const nImg = String(rv.binary_names || 'vendor,candidate').split(',').filter(Boolean).length;
  const critIn = nImg * imgTok + Math.ceil(String(rv.critic_text || '').length / 4);
  const blindIn = imgTok + Math.ceil(String(rv.blind_text || '').length / 4);
  const usd = (critIn * c.input + (Number(cap.review) || 4000) * c.output + blindIn * g.input + (Number(cap.blind) || 8000) * g.output + blindIn * o.input + (Number(cap.blind_fallback) || 8000) * o.output) / 1e6;
  return { up_to_usd: Number(usd.toFixed(3)), calls: '1 review (claude-sonnet-5-5) and 1 blind count (gemini-3.8-flash); the fallback blind count (gpt-6.1-sol) only if Gemini does not answer. No image call.', basis: 'upper bound: about ' + imgTok + ' tokens per image (an assumption), the prompt length / 4, and each call\'s full output cap, at prices read ' + (P.read_on || '?') + '; an estimate, not a quote' };
}
st.review = review;
st.review_log = arr(st.review_log).concat([{ attempt, result: review.result || 'not reviewed', defects: review.defects.length, unsure: review.unsure.length, notes: arr(review.notes_only).length, review_again: Boolean(ra), at: now, file: rv.candidate ? rv.candidate.file_name : '' }]);
st.stage = '05 Review & go 2';
st.hold_step = 16;
st.go2_route = '';
const link = rv.candidate && rv.candidate.link ? ' Candidate: ' + rv.candidate.link : '';
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = '';
  st.critical = arr(st.critical).concat([{ what: 'stage05', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' Nothing is sent again automatically.' + link;
}
const thing = isScene ? 'scene ' + rv.output_id : 'white master';
// A candidate that was stored but not reviewed (a reader did not answer) goes to the owner instead of ending the run (D3).
// Review finding 2 (16 Oct 2026): only when 16a was ready, so the readers were called. A ticket that was not ready (for example a
// missing image) would fail the same way on a review again, so it holds instead.
const notReviewed = Boolean(rv.ready && fail && rv.candidate);
if (fail && !notReviewed) hold(fail);
else if (!fail && review.result === 'failed' && attempt >= MAX_ATTEMPT) hold('The review found ' + review.defects.length + ' problem(s) on attempt ' + attempt + ', and the two repairs for this image are used: ' + review.defects.map(d => d.name).join(', ') + '. The image is held; it is not approved.');
if (st.status !== 'hold') {
  // Every candidate goes to the owner. Passed, unsure, failed and not reviewed all wait for go 2; nothing is released without it.
  // A styling note alone (framing, light, camera level, realism) gives a proposed repair too; it runs only if the owner orders it.
  const noteMiss = Boolean((review.framing && review.framing.within === false) || arr(review.notes_only).length);
  const proposed = !notReviewed && (review.result === 'failed' || noteMiss) ? repairOrder(true) : null;
  st.status = 'awaiting_go_2'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
  st.go2_round = attempt;
  st.go2_token = require('crypto').randomBytes(16).toString('hex');
  st.go2_proposed_repair = proposed;
  const can = notReviewed ? (ra ? ['approve_unreviewed', 'stop'] : ['review_again', 'stop']) : ['approve', 'stop'].concat(attempt < MAX_ATTEMPT ? ['repair'] : []);
  st.go2_allowed = can;
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
      return { output_id: o.id, camera: o.camera || '', light: o.light_label || o.light || '', status: o.id === rv.output_id ? 'this image: waiting for your go 2' : (d ? (d.without_review ? (d.shown_as || 'Approved by the studio · not reviewed') : 'approved by the owner') : (h ? 'held: ' + clean(h.why, 200) : (w ? 'will be held: ' + w : 'not made yet'))), link: d && d.candidate ? d.candidate.link || '' : '' }; });
  }
  const raCost = notReviewed && !ra ? reviewAgainCost() : null;
  const resultLine = notReviewed
    ? 'not reviewed: ' + fail + (review.partial ? ' ' + review.partial : '')
    : (review.result === 'passed' ? 'passed: a reviewed candidate, not an approval' : (review.result === 'unsure' ? 'not passed: the reviewer was unsure on ' + review.unsure.length + ' check(s)' : 'failed: ' + review.defects.length + ' problem(s) found: ' + review.defects.map(d => d.name).join(', ')));
  const needed = notReviewed
    ? (ra ? 'go 2: the review again did not answer either. Look at the ' + thing + ' yourself: approve it by eye (recorded as "approved by owner without an automated review", never as a passed review), or stop.'
          : 'go 2: this ' + thing + ' was not reviewed. Order one review again (one per candidate image; review and blind count of the stored image, no image call; up to about USD ' + (raCost && raCost.up_to_usd !== null ? raCost.up_to_usd : '?') + '), or stop.')
    : 'go 2: approve this ' + thing + ', ' + (attempt < MAX_ATTEMPT ? 'order a repair, ' : '') + 'or stop. Approval is yours only; the review is not an approval.';
  st.go2 = {
    for: 'owner', output_id: rv.output_id, attempt, label: notReviewed ? 'Generated image. Candidate: not reviewed, not approved.' : 'Generated image. Candidate: reviewed, not approved.',
    kind: isScene ? 'scene' : 'white', scene: rv.scene || null,
    not_reviewed: notReviewed, review_again_used: Boolean(ra), decisions: can,
    review_again_cost: raCost,
    decision_needed: needed,
    candidate: rv.candidate,
    review_result: resultLine,
    defects: review.defects, unsure: review.unsure, notes_only: review.notes_only || [], framing: review.framing, crop: review.crop || null, styling_notes: review.styling_notes, counts: review.counts, scores: review.scores, score_label: review.score_label, summary: review.summary, partial: review.partial || '',
    shown_together: together,
    repairs_left: MAX_ATTEMPT - attempt, proposed_repair: proposed ? { corrections: proposed.corrections } : null,
    answer_with: { id: st.client_run_id, run_id: st.run_id, round: attempt },
    how_to_answer: 'Send id, run_id and round exactly as in answer_with, plus decision ' + can.join(', ') + ', to the A7 decision address.' + (can.indexOf('repair') !== -1 ? ' repair may carry a note; the note is added to the corrections as data.' : '') + ' The run waits 24 hours.',
    reminders: (notReviewed ? ['Not reviewed means no automated check has passed or failed this image. The findings shown, if any, are from the one reader that answered.'] : ['A passed review is a reviewed candidate, not an approval.', 'Scores are the reviewer\'s judgement, not measurements, and never stand for the 90 to 95 fidelity target.'])
      .concat(['Styling notes (framing' + (isScene ? ', light, camera level, realism' : '') + ') never fail the image on their own. A repair for them runs only if you order it.', 'Nothing is repaired automatically.', isScene ? 'An approval records this scene only; the next scene starts after it.' : 'An approval records the white master; the package and the scenes follow.'])
      .concat(isScene && st.scene && arr(st.scene.props_left_out).length ? ['Planned pieces left out of this scene: ' + arr(st.scene.props_left_out).map(x => (x.sku ? 'SKU ' + x.sku + ': ' : '') + x.why).join('; ') + '.'] : [])
  };
  st.next = 'Waiting for the owner\'s go 2 on the ' + thing + ' (attempt ' + attempt + ', review ' + (review.result || 'not reviewed') + '). Nothing is approved until the owner answers.' + link;
}
st.vault_only = ['review', 'repair_order', 'go2_ticket', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 16, name: 'Review', at: now, note: 'attempt ' + attempt + (ra ? ' (review again)' : '') + ': ' + (fail ? 'not reviewed' + (oneAnswered ? ' (only the ' + oneAnswered + ' answered)' : '') : review.result + ', ' + review.defects.length + ' defect(s), ' + review.unsure.length + ' unsure' + (review.framing && review.framing.measured_share_pct !== null ? ', framing ' + review.framing.measured_share_pct + '% (' + (review.framing.within ? 'within' : 'outside') + ' ' + review.framing.rule_short + ')' : '')) + ' → ' + st.status }]);
return [{ json: st }];
