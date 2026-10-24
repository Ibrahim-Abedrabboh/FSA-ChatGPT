// Step 12 · Who leads the scene, checked against the plan, and the ticket for the owner's go 1. Code only.
// Ends stage 03. Nothing is paid here. The owner's go 1 is a separate decision; this run stops and waits for it.
const s = JSON.parse(JSON.stringify($input.first().json));
const now = new Date().toISOString();
const shortBy = Object.fromEntries((s.retrieval.shortlist || []).map(c => [c.sku, c]));
// White-only jobs reach here without a planner call: the white master plan is fixed by the studio.
// Edit phase 2.4 (19 Oct 2026): so does an edit that starts from an owner-approved image. Its plan is that image; after go 1, E2 checks the
// image against the earlier run and takes that run's plan for it. Until then the shot says what the edit changes and keeps.
// Scenes from an approved white image (20 Oct 2026) are planned as in any job; only the Go 1 wording and the start image differ.
const wb = s.brief && s.brief.edit && s.brief.edit.base && s.brief.edit.base.kind === 'white' ? s.brief.edit : null;
const eb = s.brief && s.brief.edit && s.brief.edit.base && !wb ? s.brief.edit : null;
const nw = Boolean(s.brief && s.brief.white_master === 'not_asked'); // no white catalogue image (owner unticked it, 20 Oct 2026)
const editPlan = o => ({ room_size: '', setting: 'Edit of the owner-approved image ' + eb.base.output_id + ' of the earlier version (' + eb.base.run_id + '): the room, the product, the Midas pieces and their places stay as in that image.',
  light: o.light ? 'Changes to the ' + (o.light_label || o.light) + ' preset.' : 'As in the approved image.', camera: o.camera ? 'Changes to the ' + o.camera + ' view.' : 'As in the approved image.',
  presentation: 'Requested change: ' + (eb.changes || 'none named') + (eb.preserve ? ' Keep unchanged: ' + eb.preserve : ''), supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' },
  rationale: 'An edit of an approved image. No planner call was needed.' });
if (!s.shots) {
  s.lead = s.lead || 'product_leads';
  s.shots = s.outputs.map((o, i) => (o.edit_from_result && eb ? { n: i + 1, output_id: o.id, kind: o.kind, frame: 'as the approved image', mode: o.mode, locks: o.locks, free: o.free, plan_ok: true, code_fixes: [], code_findings: [], code_warnings: [], made_from: eb.base.output_id, camera_view: o.camera || '', light_preset: o.light || '', plan: editPlan(o) } : { n: i + 1, output_id: o.id, kind: o.kind, frame: 'square, 1:1', mode: o.mode, locks: o.locks, free: o.free, plan_ok: true, code_fixes: [], code_findings: [], code_warnings: [],
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
// P1.2 (16 Oct 2026): the go 1 ticket says when stage 04 will hold this plan before the paid call. These are the evidence checks of
// 13 Compile, copied here (keep both in step): a cropped vendor photo, an inventory piece the reader marked as room context, and fewer
// pieces seen than the contract holds. The settings checks (model, Drive folder, daily limit, budget) run in stage 04 only.
function stage04Precheck() {
  const arrX = v => (Array.isArray(v) ? v : []);
  const inv = arrX(s.inventory);
  const total = inv.reduce((t, x) => t + (Number(x.count) || 0), 0);
  const obs0 = s.observation || {};
  const holds = [];
  if (!inv.length || !total) holds.push('the contract has no inventory');
  if (obs0.cropped === true) holds.push('the vendor photo is cropped (part of the product is outside the frame)');
  const SYN = { 'bedside table': 'nightstand', 'night stand': 'nightstand', 'side table': 'table', lamp: 'light', chandelier: 'light', pendant: 'light', sconce: 'light', lantern: 'light' };
  const sing = w => { const x = String(w || '').toLowerCase(); if (/(ches|shes|xes)$/.test(x)) return x.slice(0, -2); if (/[^s]s$/.test(x)) return x.slice(0, -1); return x; };
  const headOf = v => {
    const x = String(v || '').toLowerCase().split(':')[0].split(/\s+(?:on|in|at|with|featuring|placed|under|beside|near|of|for|from)\s+/)[0].replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = x.split(' ').filter(Boolean).map(sing);
    const y = words.join(' ');
    for (const k of Object.keys(SYN)) if (y === k || y.endsWith(' ' + k)) return SYN[k];
    const h = words.length ? words[words.length - 1] : '';
    return SYN[h] || h;
  };
  const invCount = {};
  for (const x of inv) { const h = headOf(x.item); if (h) invCount[h] = (invCount[h] || 0) + (Number(x.count) || 0); }
  const prodCount = {}, ctxCount = {};
  for (const q of arrX(obs0.pieces_seen).filter(q => q && typeof q === 'object')) {
    const h = headOf(q.kind || q.label); const r = String(q.role || 'product').toLowerCase();
    if (r === 'product') prodCount[h] = (prodCount[h] || 0) + 1; else if (r === 'context') ctxCount[h] = (ctxCount[h] || 0) + 1;
  }
  let ctx = false;
  for (const h of Object.keys(invCount)) { const missing = Math.max(0, invCount[h] - (prodCount[h] || 0)); const c = ctxCount[h] || 0; if (missing && c) { ctx = true; holds.push('the inventory lists ' + invCount[h] + ' x ' + h + ', but the photo reader marked ' + c + ' such thing' + (c === 1 ? '' : 's') + ' as room context'); } }
  const seen = Math.max(Number(obs0.count_eye) || 0, Number(obs0.count_second) || 0);
  if (!ctx && seen && total > seen) holds.push('the photo shows ' + seen + ' product pieces and the contract holds ' + total);
  return { will_hold: holds, also_checked_in_stage_04: 'an approved image model, the Drive folder, the daily image limit and the job budget; any of these also holds the run before the paid call', basis: 'the evidence checks of 13 Compile, run here on the same readings' };
}
const precheck = stage04Precheck();
const go1 = {
  for: 'owner', decision_needed: (precheck.will_hold.length ? 'WARNING: stage 04 will hold this plan before the paid call, even after a go: ' + precheck.will_hold.join('; ') + '. Stop, or send the job again with the fix. ' : '') + (eb
    ? 'go 1: approve the edit, or stop. No image has been made or paid for yet. A go makes one image: the approved image ' + eb.base.output_id + ' with the requested change, after A7 checks that image against the earlier run (one paid image call, only if an image model is approved and the Drive folder is set). A change at go 1 is not offered for an edit: save a new edit instead.'
    : wb ? 'go 1: approve the scene plan, or stop. No image has been made or paid for yet. No new white master is made: a go starts from the approved white image ' + (wb.base.file_name || wb.base.output_id) + ' of the earlier run, after A7 checks it against that run\'s package. Stage 07 then makes the ' + scene.length + ' planned scene(s), each with its own paid image calls and your go 2, only if an image model is approved and the Drive folder is set. A change at go 1 is not offered here: save a new version instead.'
    : nw ? 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. This job makes no white catalogue image: a go lets stage 07 make the first scene (an empty room, then the product placed in it; paid image calls, only if an image model is approved and the Drive folder is set).'
    : 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. A go lets stage 04 make the white master: one paid image call, only if an image model is approved and the Drive folder is set.'),
  ...(wb ? { scenes_from_white: { starts_from: { output_id: wb.base.output_id, run_id: wb.base.run_id, file_name: wb.base.file_name, px: wb.base.px } } } : {}),
  ...(eb ? { edit: { starts_from: { output_id: eb.base.output_id, run_id: eb.base.run_id, file_name: eb.base.file_name, px: eb.base.px }, changes: eb.changes, preserve: eb.preserve, options: eb.options || [] } } : {}),
  stage04_precheck: precheck,
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
  next: eb ? 'Waiting for the owner\'s go 1 on the edit of the approved image ' + eb.base.output_id + '. After a go, A7 checks that image against the earlier run and makes one image with the requested change (one paid image call, if a model is approved and storage is set). No paid image was made.'
    : wb ? 'Waiting for the owner\'s go 1 on the scene plan. After a go, A7 checks the approved white image ' + (wb.base.file_name || wb.base.output_id) + ' against the earlier run and stage 07 makes the planned scenes from it (no new white master). No paid image was made.'
    : nw ? 'Waiting for the owner\'s go 1 on the plan. After a go, stage 07 makes the first scene (this job makes no white catalogue image). No paid image was made.'
    : 'Waiting for the owner\'s go 1 on the plan. After a go, stage 04 makes the white master only (one paid image call, if a model is approved and storage is set). No paid image was made.',
  trail: s.trail.concat([{ step: 12, name: 'Lead and go 1 ticket', at: now, note: s.lead + '; ' + scene.length + ' scene shots; ' + midas.length + ' Midas pieces; ' + warnings.length + ' warnings' }]) } }];
