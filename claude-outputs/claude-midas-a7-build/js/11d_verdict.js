// Step 11d · Plan verdict: read the plan critic, apply its rewrites, decide whether to check again. Code only.
// Styling loop limit: 2 rewrite rounds for the job, then hold for the owner. An unreadable critic answer is asked once more, then held.
// A passed plan check is a checked plan, not an approval: the owner's go 1 comes next.
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
const NAMES = ['product_unchanged', 'handedness_kept', 'shown_with_kept', 'frame_respected', 'client_choices_respected', 'product_visible', 'props_clean', 'midas_pieces_ok', 'room_rules', 'lead_respected'];
const st = JSON.parse(JSON.stringify($('11b Stylist check').first().json));
const reply = findJson($input.first().json, 'plans');
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
  if (!failed.length && !(shot.code_findings || []).length) { shot.plan_ok = true; said.push('shot ' + shot.n + ' passed'); continue; }
  if (!failed.length) failed.push('code findings not resolved: ' + shot.code_findings.join('; '));
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
