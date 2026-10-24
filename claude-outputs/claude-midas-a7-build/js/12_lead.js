// Step 12 · Who leads the scene, checked against the plan, and the ticket for the owner's go 1. Code only.
// Ends stage 03. Nothing is paid here. The owner's go 1 is a separate decision; this run stops and waits for it.
const s = JSON.parse(JSON.stringify($input.first().json));
const now = new Date().toISOString();
const shortBy = Object.fromEntries((s.retrieval.shortlist || []).map(c => [c.sku, c]));
// White-only jobs reach here without a planner call: the white master plan is fixed by the studio.
if (!s.shots) {
  s.lead = s.lead || 'product_leads';
  s.shots = s.outputs.map((o, i) => ({ n: i + 1, output_id: o.id, kind: o.kind, frame: 'square, 1:1', mode: o.mode, locks: o.locks, free: o.free, plan_ok: true, code_fixes: [], code_findings: [], code_warnings: [],
    plan: { room_size: '', setting: 'Pure white seamless studio background and clean white floor, the product alone, with only a natural, subtle contact shadow directly beneath it.', light: 'Soft, even, neutral professional studio light that shows the real colour of the product.', camera: 'The camera angle and perspective of the vendor photo. The product is not turned to show sides the vendor photo does not show. The whole product in frame with white space on every side.', presentation: 'The complete product as arranged in the vendor photo; every piece the vendor photo shows stays countable.', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: 'Catalogue master, fixed by the studio. No planner call was needed.' } }));
  s.plan_round = 0; s.rewrites_used = 0;
}
const scene = s.shots.filter(x => x.kind !== 'white' && x.plan);
const warnings = [];
if (s.lead === 'accessory_leads' && scene.length) {
  const SURFACE = /\b(table|shelf|shelves|console|sideboard|desk|tray|mantel|cabinet|stand|bench|ledge)\b/i;
  for (const x of scene) if (!SURFACE.test(x.plan.presentation + ' ' + x.plan.midas_pieces.map(m => m.rests_on).join(' '))) warnings.push('Shot ' + x.n + ': the accessory leads, but the plan names no surface for it to stand on.');
}
if (s.lead === 'product_supports' && scene.length) warnings.push('The product supports the scene: check that it stays fully visible and countable.');
for (const x of scene) for (const w of (x.code_warnings || [])) warnings.push('Shot ' + x.n + ': ' + w);
for (const n of (s.retrieval.notes || [])) warnings.push(n);
const midas = [];
for (const x of scene) for (const m of x.plan.midas_pieces) {
  const c = shortBy[m.sku];
  if (!c) continue;
  const have = midas.find(y => y.sku === m.sku);
  if (have) { have.shots.push(x.n); continue; }
  midas.push({ sku: c.sku, name: c.name, kind: c.kind, client_pick: Boolean(c.fixed), availability: c.availability_text || c.availability, read_on: c.retrieved_on, catalogue_photo: c.catalogue_photo, page: c.url, purpose: m.purpose, rests_on: m.rests_on, shots: [x.n] });
}
// Side views (owner, 16 Oct 2026, decision 27, as revised 06:49): a Left side or Right side image is made only when a supplied photo shows
// that side; otherwise that image is held in stage 07 and the other images continue. Unseen parts are never invented (owner, 15 Oct 2026,
// 21:50), so there is no option to accept inferred sides. A supplied photo counts when its role is "Other views / pieces" and its client
// label, its file name or its "side" field names that side; that is the client's own label, shown here so the owner can check it at go 1.
// 45° right runs normally.
const roleOf = r => { const x = ((s.brief && s.brief.reference_roles) || []).find(y => y.name === r.name) || {}; return x; };
function sidePhoto(side) {
  for (const r of (s.references || [])) {
    if (r.role !== 'other_view' || !r.image || !r.sha256) continue;
    const lab = roleOf(r);
    const by = lab.side === side ? 'its "side" field' : (new RegExp('\\b' + side + '\\b', 'i').test(lab.role || '') ? 'its client label "' + lab.role + '"' : (new RegExp('\\b' + side + '\\b', 'i').test(r.name || '') ? 'its file name' : ''));
    if (by) return { key: r.key, name: r.name, sha256: r.sha256, basis: 'the client\'s own label: ' + by };
  }
  return null;
}
const sideViews = s.outputs.filter(o => o.camera === 'Left side' || o.camera === 'Right side').map(o => {
  const side = o.camera === 'Left side' ? 'left' : 'right';
  const photo = sidePhoto(side);
  return { output_id: o.id, camera: o.camera, side, photo, gate: photo ? 'a supplied photo shows the ' + side + ' side (' + photo.name + '; ' + photo.basis + ')' : 'no supplied photo shows the ' + side + ' side: this image will be held, and the other images continue. To make it, send the job again with a photo of the ' + side + ' side (role "Other views / pieces", named for that side).' };
});
const notConfirmed = [];
for (const x of scene) if (x.styling && x.styling.critique) for (const k of (x.styling.critique.not_confirmed || [])) if (notConfirmed.indexOf(k) === -1) notConfirmed.push(k);
const go1 = {
  for: 'owner', decision_needed: 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. A go lets stage 04 make the white master: one paid image call, only if an image model is approved and the Drive folder is set.',
  contract_version: s.contract_version, contract_stamp: s.contract_stamp, lead: s.lead,
  shots: s.shots.map(x => ({ n: x.n, output_id: x.output_id, kind: x.kind, frame: x.frame, camera_view: x.camera_view || '', light_preset: x.light_preset || '', made_from: x.made_from || '', series: x.series || null, plan: x.plan, plan_check: !x.check ? (x.kind === 'white' ? 'fixed by the studio' : 'not checked') : (x.rewritten ? 'passed after ' + x.rewritten + ' rewrite(s)' : 'passed'),
    rewritten: x.rewritten || 0, code_fixes: x.code_fixes || [], styling_line: x.styling_line || (x.kind === 'white' ? 'No scene to style on white.' : 'Styling fit: not scored.'),
    // Prompt check P3 (16 Oct 2026): generic props are not used in Studio scenes; anything that is not a confirmed Midas piece is left out.
    left_out_at_scene_time: (x.generic_removed || x.plan.supporting_props || []).map(g => g + ' (not a Midas piece: left out when the image is made)') })),
  side_views: sideViews,
  midas_pieces: midas,
  shortlist_size: (s.retrieval.shortlist || []).length,
  rejected: (s.retrieval.rejected || []).slice(0, 20),
  planner_left_out: s.planner_rejected || [],
  risks: s.plan_risks || [],
  not_confirmed: notConfirmed,
  warnings,
  rewrites_used: s.rewrites_used || 0,
  cost_estimate: s.cost_estimate,
  answer_with: { id: s.client_run_id, run_id: s.run_id, round: s.go1_rounds || 0 },
  how_to_answer: 'Send id, run_id and round exactly as in answer_with, plus decision go, change or stop, to the A7 decision address. change takes either field edits per scene shot (shot number, then setting, light, camera, presentation, person, room or midas_pieces) or a note for a new plan, not both. The white master is fixed; light presets and camera views are fixed by the brief. At most 3 change rounds.' + (sideViews.some(v => !v.photo) ? ' A Left side or Right side image that no supplied photo shows is held in stage 07; a go does not change that.' : '') + ' The run waits 24 hours.',
  owner_answers_so_far: s.go1_log || [],
  reminders: ['A checked plan is not an approval.', 'Anything in a plan that is not a Midas piece confirmed in stock on its live page is left out when the image is made, and its spot stays empty.', 'Styling fit is a rule-based judgement, not a measurement.', 'Scores never stand for the 90 to 95 fidelity target.']
};
// A one-time run token: the decision address reads it from the run row and sends it with the answer, so only that address can answer this run.
// It is kept in the run row only, never in the vault.
const go1_token = require('crypto').randomBytes(16).toString('hex');
return [{ json: { ...s, side_views: sideViews, go1, go1_token, go1_route: '', status: 'awaiting_go_1', stage: '03 Retrieve & style', hold_reason: '', client_question: '',
  next: 'Waiting for the owner\'s go 1 on the plan. After a go, stage 04 makes the white master only (one paid image call, if a model is approved and storage is set). No paid image was made.',
  trail: s.trail.concat([{ step: 12, name: 'Lead and go 1 ticket', at: now, note: s.lead + '; ' + scene.length + ' scene shots; ' + midas.length + ' Midas pieces; ' + warnings.length + ' warnings' }]) } }];
