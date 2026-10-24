// Step 7 · Brain route: choose the handling profile and the gates for this item and these outputs. Code only.
// 16 Oct 2026 (owner decision 26, prompt check P2): profiles come from A7's own table "Claude Midas A7 handling profiles"
// (FZJg1MHUh2lcIV1H); the shared table is not changed. Its category guidance (`guide`) is F1's sentence for the family, edited only where
// A7 needs it (each edit is in the row's a7_edit). The guidance goes to the planner, the plan critic and the scene placement prompt,
// with F1's qualifier; it is never written as a fact about this product, and the white master prompt does not carry it.
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
const s = out('04-06 Evidence');
const profiles = $input.all().map(i => i.json).filter(r => r && r.profile_id);
const b = s.brief;
const hay = [b.product_type, b.category, s.observation.category_seen].filter(Boolean).join(' | ').toLowerCase();
let best = null, bestLen = 0;
for (const p of profiles) {
  for (const l of String(p.labels || '').split('|').map(x => x.trim().toLowerCase()).filter(Boolean)) {
    if (hay.indexOf(l) !== -1 && l.length > bestLen) { best = p; bestLen = l.length; }
  }
}
if (!best) best = profiles.find(p => p.profile_id === 'general') || { profile_id: 'general', name: 'Identify from reference', family: 'Automatic', checks: '', guide: '', scene: '' };
const total = s.inventory.reduce((t, r) => t + (r.count || 0), 0);
const gates = {
  count_gate: total > 1 || (s.observation.count_eye || 0) > 1,
  selection_gate: s.exclusions.length > 0,
  colour_hold: s.conflicts.some(c => c.topic === 'colour' && c.severity !== 'minor'),
  room_lock: Boolean(s.observation.room),
  parent_link: Boolean(b.parent_run_id),
  item_role: b.item_role
};
// Cost estimate in USD (A7 cost model, 14 Oct 2026). An estimate, not a quote: real cost comes from receipts.
const imgs = b.outputs.length;
const white = b.outputs.some(o => o.kind === 'white') ? 1 : 0;
// Stage 07 (16 Oct 2026): each scene output adds one empty-room image call before the placement call (upper bound: a client room photo skips it).
// A series image made from another approved image (16 Oct 2026) needs no empty room of its own.
const rooms = b.outputs.filter(o => o.kind !== 'white' && o.kind !== 'variation' && !o.from).length;
const base = 0.0607 + imgs * (0.0639 + 0.0447) + imgs * 0.0229 + 0.0084 + white * 0.018 + rooms * 0.0639;
const perRepair = 0.1086;
const estimate = { currency: 'USD', label: 'estimate', no_repair: Number(base.toFixed(3)), max_two_repairs_each: Number((base + imgs * 2 * perRepair).toFixed(3)), basis: 'A7 cost model 14 Oct 2026, plus one empty-room call per scene (16 Oct 2026); Google image price; token sizes estimated' };
const now = new Date().toISOString();
return [{ json: { ...s, profile: { id: best.profile_id, name: best.name, family: best.family || '', prop_policy: best.prop_policy || 'none', checks: String(best.checks || '').split(';').map(x => x.trim()).filter(Boolean), guide: best.guide || '', guide_source: best.guide_source || '', a7_edit: best.a7_edit || '', source_rules: '', scene: best.scene || '' }, gates, cost_estimate: estimate,
  trail: s.trail.concat([{ step: 7, name: 'Route', at: now, note: 'profile ' + best.profile_id + '; gates ' + Object.keys(gates).filter(k => gates[k] === true).join(', ') }]) } }];
