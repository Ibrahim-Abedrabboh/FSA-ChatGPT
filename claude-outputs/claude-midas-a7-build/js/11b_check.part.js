// ---- A7 step 11b · Stylist check (wrapper). The engine above is the stylist skill's engine, unchanged. ----
// First pass: the input is the planner's reply and the state comes from "11a Plan ticket".
// Loop pass: the input is the state from "11d Plan verdict" (plan_state = true) with rewritten plans.
// Code fixes only what code can fix without inventing anything; everything else goes to the plan critic.
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
const arrT = (v, n, max) => (Array.isArray(v) ? v : []).map(x => txt(x, n || 120)).filter(Boolean).slice(0, max || 8);
const nl = String.fromCharCode(10);
const inp = $input.first().json;
let st;
if (inp && inp.plan_state === true) st = JSON.parse(JSON.stringify(inp));
else {
  st = JSON.parse(JSON.stringify($('11a Plan ticket').first().json));
  st.plan_state = true;
  const reply = findJson(inp, 'shots');
  const got = reply && Array.isArray(reply.shots) ? reply.shots : [];
  st.plan_readable = got.length > 0;
  st.plan_risks = reply ? arrT(reply.risks, 160, 8) : [];
  st.planner_rejected = reply && Array.isArray(reply.catalogue_rejected) ? reply.catalogue_rejected.slice(0, 12).map(x => ({ sku: txt(x && x.sku, 20), reason: txt(x && x.reason, 160) })) : [];
  for (const shot of st.shots) {
    // Match by output_id; fall back to position only when the planner gave no output_id at that position.
    const e = got.find(x => x && x.output_id === shot.output_id) || (got[shot.n - 1] && !got[shot.n - 1].output_id ? got[shot.n - 1] : null);
    shot.plan = e ? {
      room_size: txt(e.room_size, 20), setting: txt(e.setting), light: txt(e.light, 300), camera: txt(e.camera, 300), presentation: txt(e.presentation),
      supporting_props: arrT(e.supporting_props, 120, 8),
      midas_pieces: (Array.isArray(e.midas_pieces) ? e.midas_pieces : []).slice(0, 6).map(m => ({ sku: txt(m && m.sku, 20), count: Math.max(1, Math.min(2, Math.round(Number(m && m.count) || 1))), purpose: txt(m && m.purpose, 160), rests_on: txt(m && m.rests_on, 120) })),
      palette_roles: { dominant_60: txt(e.palette_roles && e.palette_roles.dominant_60, 120), secondary_30: txt(e.palette_roles && e.palette_roles.secondary_30, 120), accent_10: txt(e.palette_roles && e.palette_roles.accent_10, 120) },
      rationale: txt(e.rationale, 300)
    } : null;
    shot.plan_ok = false; shot.code_fixes = []; shot.code_findings = []; shot.code_warnings = [];
  }
  // A white master the planner left out gets the studio's fixed plan; a scene shot left out makes the reply unreadable.
  for (const shot of st.shots) if (!shot.plan && shot.kind === 'white') { shot.plan = { room_size: '', setting: '', light: '', camera: '', presentation: '', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: '' }; shot.code_fixes.push('the planner gave no entry for the white master; the studio plan is used'); }
  const missing = st.shots.filter(x => !x.plan).map(x => x.output_id);
  if (missing.length) st.plan_readable = false;
  if (!st.plan_readable) {
    st.critical = (st.critical || []).concat([{ what: 'plan_unread', who: 'owner', why: 'The planner did not return a readable plan' + (missing.length && got.length ? ' (no plan for: ' + missing.join(', ') + ')' : ' (an error or a cut-off answer)') + '. Run the job again; the client was not asked anything.' }]);
    st.hold_step = 11;
  }
}
const short = st.retrieval.shortlist;
const bySku = Object.fromEntries(short.map(c => [c.sku, c]));
const maxMidas = st.retrieval.max_midas;
const WHITE = { room_size: '', setting: 'Pure white seamless studio background and clean white floor, the product alone, with only a natural, subtle contact shadow directly beneath it.', light: 'Soft, even, neutral professional studio light that shows the real colour of the product.', camera: 'The camera angle and perspective of the vendor photo; a front three-quarter view only when the vendor photo gives no clear single angle. The whole product in frame with white space on every side.', presentation: 'The complete product as arranged in the vendor photo, every piece fully visible and countable.', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: 'Catalogue master, fixed by the studio.' };
const PEOPLE = /\b(person|people|man|woman|men|women|child|children|boy|girl)\b/i;
const PERSON_PROP = /^(a |an |one |two |the )?(young |older |seated |standing )?(person|people|man|woman|men|women|child|children|boy|girl)\b(?!'s)/i; // a prop that IS a person, not "children's books"
const NAMES = short.map(c => { const nm = String(c.name || ''); const first = nm.split(' ')[0]; return { sku: c.sku, words: [nm.length >= 8 ? nm.toLowerCase() : '', /^[A-Z]{4,}$/.test(first) ? first.toLowerCase() : ''].filter(Boolean) }; });
const namesMidas = g => { const t = String(g).toLowerCase(); return /\bmidas\b/.test(t) || NAMES.some(n => t.indexOf(n.sku) !== -1 || n.words.some(w => t.indexOf(w) !== -1)); };
// Job-wide Midas limit: client picks first, then the order the planner used.
const used = [];
for (const c of short) if (c.fixed && used.indexOf(c.sku) === -1) used.push(c.sku); // client picks hold their places first
for (const x of st.shots) if (x.plan && x.plan_ok && x.kind !== 'white') for (const m of x.plan.midas_pieces) if (used.indexOf(m.sku) === -1) used.push(m.sku);
for (const shot of st.shots) {
  if (!shot.plan || shot.plan_ok) continue;
  const p = shot.plan; const fixes = []; const findings = []; const warnings = [];
  if (shot.kind === 'white') {
    const planned = p.supporting_props.length + p.midas_pieces.length;
    const lightNotNeutral = p.light && !/neutral|studio/i.test(p.light);
    shot.plan = Object.assign({}, WHITE, { camera: p.camera || WHITE.camera });
    if (planned) fixes.push('props and Midas pieces removed from the white master');
    if (lightNotNeutral) fixes.push('light set to neutral studio light (the client lighting choice never applies to the white master)');
  } else {
    const keep = [];
    for (const m of p.midas_pieces) {
      if (!bySku[m.sku]) { fixes.push('removed SKU ' + (m.sku || '(blank)') + ': not on the shortlist, so it cannot be called a Midas product'); continue; }
      if (used.indexOf(m.sku) === -1) {
        const room = maxMidas - used.length;
        if (room <= 0 && !bySku[m.sku].fixed) { fixes.push('removed SKU ' + m.sku + ': over the limit of ' + maxMidas + ' Midas pieces for the job'); continue; }
        used.push(m.sku);
      }
      if (!m.purpose || !m.rests_on) warnings.push('Midas piece ' + m.sku + ' has no ' + (!m.purpose ? 'purpose' : 'surface it rests on'));
      keep.push(m);
    }
    p.midas_pieces = keep;
    const before = p.supporting_props.length;
    if (st.people_max === 0) p.supporting_props = p.supporting_props.filter(x => !PERSON_PROP.test(x));
    if (p.supporting_props.length < before) fixes.push('removed a person from the props (people: none)');
    for (const g of p.supporting_props) if (namesMidas(g)) findings.push('generic prop "' + g + '" names a Midas product; plan it by SKU in midas_pieces or describe it generically');
    if (st.people_max === 0 && PEOPLE.test(p.presentation) && /\b(sit|sits|sitting|stand|stands|standing|holding|reading)\b/i.test(p.presentation)) findings.push('the presentation seems to place a person in the scene; people are not allowed');
    if (!p.palette_roles.dominant_60 || !p.palette_roles.secondary_30 || !p.palette_roles.accent_10) warnings.push('palette roles for the room (60/30/10) are incomplete');
  }
  shot.code_fixes = (shot.code_fixes || []).concat(fixes);
  shot.code_findings = findings;
  shot.code_warnings = warnings;
}
// Client picks must appear somewhere in the scene shots.
const scene = st.shots.filter(x => x.kind !== 'white' && x.plan);
const missingPicks = short.filter(c => c.fixed && !scene.some(x => x.plan.midas_pieces.some(m => m.sku === c.sku)));
if (missingPicks.length && scene.length) for (const x of scene) if (!x.plan_ok) x.code_findings.push('client pick(s) not planned in any scene shot: ' + missingPicks.map(c => c.sku + ' ' + c.name).join(', '));
// Styling engine per scene shot (stylist skill). Tags that are not confirmed stay empty, so pillars can be "unknown".
const BASIS_OK = ['vendor_stated', 'catalogue_stated', 'observed_in_photo', 'estimated_from_photo'];
const heroCat = txt(st.brief.product_type || st.observation.category_seen || 'product', 80).toLowerCase();
for (const shot of scene) {
  if (shot.plan_ok) continue;
  const p = shot.plan;
  const hero = { id: 'product', name: st.brief.product_type || 'the product', role: 'hero', category: heroCat };
  const pieces = [hero];
  for (const m of p.midas_pieces) {
    const c = bySku[m.sku]; const t = c.tags || {};
    const piece = { id: 'sku-' + c.sku, name: c.name || c.kind, role: 'midas_support', category: String(c.kind || 'piece').toLowerCase(), sku: c.sku, catalogue_photo: c.catalogue_photo, retrieved_on: c.retrieved_on,
      availability: c.availability, purpose: m.purpose || null, rests_on: m.rests_on || null };
    if (BASIS_OK.indexOf(t.basis) !== -1) {
      const basis = {};
      for (const k of ['visual_weight', 'silhouette', 'texture', 'style']) if (t[k]) { piece[k] = t[k]; basis[k] = t.basis; }
      piece.basis = basis;
    }
    pieces.push(piece);
  }
  p.supporting_props.forEach((g, i) => pieces.push({ id: 'generic-' + (i + 1), name: g, role: 'generic_context', category: 'generic prop', purpose: 'generic context', rests_on: 'as planned' }));
  const surfaces = ['dominant_60', 'secondary_30', 'accent_10'].filter(k => p.palette_roles[k]).map(k => ({ name: k, colour: p.palette_roles[k], role: k }));
  if (pieces.length < 2) { shot.styling = { status: 'not_run', reason: 'nothing planned beside the product', score: null, score_label: SCORE_LABEL }; shot.styling_line = 'Styling fit: not scored (nothing planned beside the product).'; continue; }
  const res = checkPlan({ pieces, surfaces, output: 'lifestyle', max_midas_pieces: Math.min(6, Math.max(0, maxMidas)), profile: 'balanced' });
  shot.styling = res;
  shot.styling_line = res.score === null
    ? 'Styling fit: not scored (coverage ' + Math.round((res.coverage || 0) * 100) + '%, below 60%). Not confirmed: ' + ((res.critique && res.critique.not_confirmed) || []).join(', ') + '. Rule-based judgement, not a measurement; not an approval.'
    : 'Styling fit: ' + res.score + ' (balanced profile; coverage ' + Math.round(res.coverage * 100) + '%). Rule-based judgement, not a measurement; not an approval.';
  if (res.status === 'invalid_input') shot.code_warnings.push('styling check could not read the plan: ' + (res.errors || []).slice(0, 2).join('; '));
}
// Message for the plan critic (another model family than the planner).
const b = st.brief, o = st.observation;
const pending = st.shots.filter(x => x.plan && !x.plan_ok);
const pref = b.preferences || {};
const choices = [pref.lighting ? 'Lighting: ' + pref.lighting : '', pref.wall ? 'Wall paint: ' + pref.wall : '', pref.floor ? 'Floor: ' + pref.floor : ''].filter(Boolean);
const LEAD = { product_leads: 'the product leads: the clear main subject, nothing outweighs it', accessory_leads: 'the product is an accessory and leads: the room serves it, it stands on a credible surface and does its real job at real scale', product_supports: 'the product supports a furniture-led scene: secondary, at true scale, still fully visible and countable' };
const lines = [
  'Check the written plan of each photograph below against these facts and return the JSON object. No image exists yet.',
  'Product: ' + (b.product_type || o.category_seen || 'not named') + '.',
  'Inventory of the real product, fixed:', st.inventory.map((x, i) => (i + 1) + '. ' + x.count + ' x ' + x.item).join(nl),
  'Total product pieces: ' + st.inventory.reduce((t, x) => t + (x.count || 0), 0) + '.',
  'In the vendor photo the product is shown with: ' + ((o.shown_with || []).length ? o.shown_with.join('; ') : 'nothing, it is shown bare') + '.',
  'Parts that sit on one side, as seen by a person standing in front of the product. Never mirrored: ' + ((o.sided_parts || []).length ? o.sided_parts.join('; ') : 'none recorded') + '.',
  'How the pieces of the set stand to each other, to be kept: ' + ((o.relations || []).length ? o.relations.join('; ') : 'not a set, or not recorded') + '.',
  'Must be absent: ' + (st.exclusions.length ? st.exclusions.map(x => x.item).join('; ') : 'nothing listed') + '.',
  'Client choices, fixed for scene shots: ' + (choices.length ? choices.join('; ') : 'none given') + '. ' + (st.people_text || 'People: none.') + ' ' + (st.plant_text || ''),
  'Lead: ' + LEAD[st.lead] + '.',
  'A shot of kind white is the catalogue master, fixed by the studio: the product alone on plain white with neutral studio light, no props and no room; the client choices do not apply to it. Shots of kind hero, wide and detail show one and the same room on purpose.',
  'Rules for this kind of product (' + st.profile.name + '): ' + (st.profile.source_rules || 'none recorded') + '.',
  'Midas shortlist (the only Midas products allowed; anything else is generic context): ' + (short.length ? short.map(c => c.sku + ' ' + c.name + ' (' + c.kind + (c.fixed ? ', client pick, must appear' : '') + ')').join('; ') : 'none') + '. At most ' + maxMidas + ' different Midas pieces across the job.',
  ...(st.shots.some(x => x.plan && x.plan_ok) ? ['Shots already checked, shown for consistency only (one room keeps one light direction; client picks and the Midas limit count across the job). Do not return entries for these:'].concat(st.shots.filter(x => x.plan && x.plan_ok).map(x => 'Shot ' + x.n + ' (output ' + x.output_id + ', kind ' + x.kind + '). Setting: ' + (x.plan.setting || 'none') + ' Light: ' + (x.plan.light || 'none') + ' Midas pieces: ' + (x.plan.midas_pieces.length ? x.plan.midas_pieces.map(m => m.count + ' x SKU ' + m.sku).join('; ') : 'none') + '.')) : []),
  'Plans to check:'
];
for (const x of pending) {
  const p = x.plan;
  lines.push('Shot ' + x.n + ' (output ' + x.output_id + ', kind ' + x.kind + '). Frame: ' + x.frame + '. Room size: ' + (p.room_size || 'not given') + '. Setting: ' + (p.setting || 'none') + ' Light: ' + (p.light || 'none') + ' Camera: ' + (p.camera || 'none') + ' Presentation: ' + (p.presentation || 'none') +
    ' Generic props: ' + (p.supporting_props.length ? p.supporting_props.join('; ') : 'none') + '. Midas pieces: ' + (p.midas_pieces.length ? p.midas_pieces.map(m => m.count + ' x SKU ' + m.sku + ' ' + (bySku[m.sku] ? bySku[m.sku].name : '') + ', purpose: ' + (m.purpose || 'not given') + ', rests on: ' + (m.rests_on || 'not given')).join('; ') : 'none') +
    '. Palette roles of the room: ' + (x.kind === 'white' ? 'not applicable' : JSON.stringify(p.palette_roles)) + '.' + (x.code_findings && x.code_findings.length ? ' Code found (must be fixed): ' + x.code_findings.join('; ') + '.' : '') + (x.code_warnings && x.code_warnings.length ? ' Code notes: ' + x.code_warnings.join('; ') + '.' : ''));
}
const now = new Date().toISOString();
st.plan_round = (st.plan_round || 0) + 1;
st.critic_request = lines.join(nl);
st.critic_needed = st.plan_readable !== false && pending.length > 0;
st.trail = st.trail.concat([{ step: 11, name: 'Stylist check', at: now, note: 'round ' + st.plan_round + ': ' + pending.length + ' shots to check; code fixes ' + st.shots.reduce((t, x) => t + (x.code_fixes || []).length, 0) + '; findings ' + st.shots.reduce((t, x) => t + (x.code_findings || []).length, 0) }]);
return [{ json: st }];
