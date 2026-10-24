// Step 11d · Plan verdict: read the plan critic, apply its rewrites, decide whether to check again. Code only.
// Styling loop limit: 2 rewrite rounds for the job, then hold for the owner. An unreadable critic answer is asked once more, then held.
// A passed plan check is a checked plan, not an approval: the owner's go 1 comes next.
// P1.8 (16 Oct 2026): the replies are no longer simplified, so each call's token counts can be recorded. bodyOf picks the answer
// part of a reply (so an echoed instruction is never read as the answer); textCall records the provider's own token counts.
function bodyOf(o) {
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
function textCall(state, step, node, model, raw) {
  if (!raw) return state;
  const P = state.text_prices || {};
  const u = usageOf(raw);
  const pr = P.models && P.models[model] ? P.models[model] : null;
  const usd = u && pr ? Number(((u.input * pr.input + u.output * pr.output) / 1e6).toFixed(5)) : null;
  const e = raw.error ? (typeof raw.error === 'string' ? raw.error : String((raw.error && raw.error.message) || JSON.stringify(raw.error))).split('\n')[0].slice(0, 120) : '';
  const rec = { step, node, model, at: new Date().toISOString(), tokens: u, usd, error: e, basis: u ? (pr ? 'provider token counts x prices read ' + (P.read_on || '?') + ' (' + (pr.source || '') + '); an estimate, not an invoice' : 'provider token counts; no price recorded for this model') : 'the provider reported no token counts (the call may still be charged)' };
  state.text_calls = (Array.isArray(state.text_calls) ? state.text_calls : []).concat([rec]);
  state.text_calls_new = (Array.isArray(state.text_calls_new) ? state.text_calls_new : []).concat([rec]);
  return state;
}
function findJson(value, marker, depth) {
  depth = depth || 0;
  if (depth > 10 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const a = value.indexOf('{'), z = value.lastIndexOf('}');
    if (a === -1 || z <= a) return null;
    try { const p = JSON.parse(value.slice(a, z + 1)); return p && typeof p === 'object' && marker in p ? p : null; } catch (e) { return null; }
  }
  if (Array.isArray(value)) { for (const v of value) { const f = findJson(v, marker, depth + 1); if (f) return f; } return null; }
  if (typeof value === 'object') { if (marker in value) return value; for (const k of Object.keys(value)) { const f = findJson(value[k], marker, depth + 1); if (f) return f; } }
  return null;
}
const txt = (v, n) => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, n || 600);
const MAX_REWRITES = 2;
// 20 Oct 2026: 11b flags any lamp or rug word, so "without an added rug" or "no lamps" counted as a planned rug or lamp and held the run
// (claude-a7-aec04faf). Such a finding stands only when the plan mentions the item outside a negated clause.
const LAMP_WORDS = /\b(table lamps?|floor lamps?|desk lamps?|lamps?|sconces?|lanterns?|candles?|chandeliers?|pendant lights?|pendants?)\b/gi;
const RUG_WORDS = /\b(rugs?|carpets?|runners? rug)\b/gi;
const NEGATION = /\b(no|not|without|never|avoid|avoids|avoiding|exclude|excludes|excluded|excluding|free of|omit|omits|omitted|instead of|rather than)\b/i;
function placed(re, text) {
  const s = String(text || ''); re.lastIndex = 0; let m;
  while ((m = re.exec(s))) { const clause = s.slice(Math.max(0, m.index - 80), m.index).split(/[.;:!?,]/).pop(); if (!NEGATION.test(clause)) return true; }
  return false;
}
function stillFound(finding, plan) {
  const words = [plan && plan.setting, plan && plan.light, plan && plan.presentation, plan && plan.person].join(' ');
  if (/^a lamp or other light fitting is planned/.test(finding)) return placed(LAMP_WORDS, words);
  if (/^a rug is planned/.test(finding)) return placed(RUG_WORDS, words);
  return true;
}
const NAMES = ['product_unchanged', 'handedness_kept', 'shown_with_kept', 'frame_respected', 'client_choices_respected', 'product_visible', 'props_clean', 'midas_pieces_ok', 'room_rules', 'lead_respected'];
const st = JSON.parse(JSON.stringify($('11b Stylist check').first().json));
const reply = findJson(bodyOf($input.first().json), 'plans');
textCall(st, 11, '11c Plan critic', 'claude-sonnet-5-5', $input.first().json); // P1.8
const plans = reply && Array.isArray(reply.plans) ? reply.plans : [];
const pending = st.shots.filter(x => x.plan && !x.plan_ok);
const said = [];
const holds = [];
let rewrite = false, askAgain = false;
for (const shot of pending) {
  const e = plans.find(p => p && Number(p.shot) === shot.n);
  const body = e && e.checks && typeof e.checks === 'object' ? e.checks : null;
  if (!body) { askAgain = true; said.push('shot ' + shot.n + ': no readable check'); continue; }
  const checks = []; const failed = [];
  for (const k of NAMES) {
    const one = body[k] && typeof body[k] === 'object' ? body[k] : {};
    const result = txt(one.result, 10).toLowerCase() === 'pass' ? 'pass' : 'fail'; // a missing answer is not a pass
    checks.push({ check: k, result, evidence: txt(one.evidence, 200) });
    if (result !== 'pass') failed.push(k + (one.evidence ? ': ' + txt(one.evidence, 160) : ' (no answer)'));
  }
  shot.check = { round: st.plan_round, checks, failed };
  const findings = (shot.code_findings || []).filter(x => stillFound(x, shot.plan));
  if (findings.length < (shot.code_findings || []).length) shot.code_findings_dismissed = (shot.code_findings || []).filter(x => !findings.includes(x));
  if (!failed.length && !findings.length) { shot.plan_ok = true; said.push('shot ' + shot.n + ' passed'); continue; }
  if (!failed.length) failed.push('code findings not resolved: ' + findings.join('; '));
  const fix = e.rewrite && typeof e.rewrite === 'object' ? e.rewrite : null;
  if (fix && (st.rewrites_used || 0) < MAX_REWRITES) {
    const p = shot.plan;
    for (const k of ['setting', 'light', 'camera', 'presentation']) if (txt(fix[k])) p[k] = txt(fix[k]);
    // 16 Oct 2026: the person and the room fields can be rewritten too; generic props stay empty (only Midas pieces appear in scenes),
    // and a person is kept only when the brief allows one.
    if (typeof fix.person === 'string') p.person = st.people_max === 1 ? txt(fix.person, 240) : '';
    if (fix.room && typeof fix.room === 'object') { p.room = p.room || {}; for (const k of ['walls', 'floor', 'windows', 'zone']) if (typeof fix.room[k] === 'string') p.room[k] = txt(fix.room[k], 160); }
    if (Array.isArray(fix.supporting_props)) p.supporting_props = [];
    if (Array.isArray(fix.midas_pieces)) p.midas_pieces = fix.midas_pieces.slice(0, 6).map(m => ({ sku: txt(m && m.sku, 20), count: Math.max(1, Math.min(2, Math.round(Number(m && m.count) || 1))), purpose: txt(m && m.purpose, 160), rests_on: txt(m && m.rests_on, 120) }));
    if (fix.palette_roles && typeof fix.palette_roles === 'object') for (const k of ['dominant_60', 'secondary_30', 'accent_10']) if (txt(fix.palette_roles[k])) p.palette_roles[k] = txt(fix.palette_roles[k], 120);
    shot.rewritten = (shot.rewritten || 0) + 1;
    rewrite = true;
    said.push('shot ' + shot.n + ' rewritten (' + failed.length + ' checks failed)');
  } else {
    holds.push('Shot ' + shot.n + ' (' + shot.output_id + '): the plan still fails ' + (fix ? 'after ' + (shot.rewritten || 0) + ' rewrite(s) of this shot; the job limit of ' + MAX_REWRITES + ' rewrite rounds is used' : 'and the check gave no rewrite') + ': ' + failed.join('; ') + '.');
  }
}
if (!reply) { askAgain = true; said.push('plan check unreadable'); }
const now = new Date().toISOString();
if (askAgain && !holds.length) {
  st.critic_unread = (st.critic_unread || 0) + 1;
  if (st.critic_unread >= 2) holds.push('The plan check could not be read after two tries, so no plan goes forward unchecked.');
}
if (rewrite && !holds.length) st.rewrites_used = (st.rewrites_used || 0) + 1;
if (holds.length) {
  st.critical = (st.critical || []).concat([{ what: 'plan_check', who: 'owner', why: holds.join(' ') }]);
  st.hold_step = 11;
}
st.plan_again = !holds.length && (rewrite || askAgain);
st.trail = st.trail.concat([{ step: 11, name: 'Plan verdict', at: now, note: 'round ' + st.plan_round + ': ' + (said.join('; ') || (holds.length ? 'checks still fail' : 'nothing to check')) + (holds.length ? '; HOLD for the owner' : '') + '; rewrites used ' + (st.rewrites_used || 0) + ' of ' + MAX_REWRITES }]);
return [{ json: st }];
