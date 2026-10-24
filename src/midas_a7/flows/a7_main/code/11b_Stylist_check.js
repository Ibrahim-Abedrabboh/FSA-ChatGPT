// A7 step 11b · Stylist check. Engine: claude-stylist-check.code.js (stylist skill v0.3), sha256 72a14dab09f31fb0, wrapper replaced.
// Claude · Midas Stylist check — n8n Code node (JavaScript, "Run Once for All Items").
// Draft, 15 Oct 2026. Same rules as reference/stylist_engine.py and SKILL.md.
// Pure code: no network, no model, no paid call. Never approves anything.
// Input: one item whose json (or json.body, when it comes from a Webhook) is the styling request.
// Output: one item with the plan check. Invalid input returns status "invalid_input" with reasons.

const STYLE_MENU = ['Contemporary Elegance', 'Warm Minimalism', 'Modern Luxury', 'Modern Classic',
  'Japandi', 'Scandinavian', 'Mid-Century Modern', 'Mediterranean', 'Contemporary Arabesque', 'Eclectic Curated'];
const AMBIENCE_MENU = ['Calm / Restorative', 'Warm / Welcoming', 'Elegant / Formal', 'Airy / Fresh',
  'Intimate / Cozy', 'Expressive / Vibrant'];
const PRESET_MENU = ['Daylight overview', 'Editorial hero', 'Golden-hour atmosphere', 'Evening comfort'];

const ROLES = ['hero', 'midas_support', 'generic_context'];
const WEIGHTS_ = ['light', 'medium', 'heavy'];
const SILS = ['angular', 'curved', 'mixed'];
const FAMILIES = ['wood', 'metal', 'stone', 'glass', 'fabric', 'leather', 'other'];
const UNDERTONES = ['warm', 'cool', 'neutral'];
const TEXTURES = ['smooth', 'medium', 'rough'];
const PALETTE = ['dominant_60', 'secondary_30', 'accent_10'];
const AVAIL = ['in_stock', 'pre_order', 'out_of_stock', 'not_confirmed'];
const BASIS = ['vendor_stated', 'catalogue_stated', 'observed_in_photo', 'estimated_from_photo'];
const OUTPUTS = ['white_background', 'lifestyle', 'website_package'];
const DESCRIPTIVE = ['style', 'visual_weight', 'silhouette', 'finishes', 'texture', 'colour_hex', 'dimensions_cm'];
const PILLARS = ['scale_proportion', 'silhouette_lines', 'materials_finishes', 'colour_distribution',
  'texture_contrast', 'function_practicality', 'focal_point', 'style_cohesion'];
const DEFAULT_W = { scale_proportion: 20, silhouette_lines: 15, materials_finishes: 15, colour_distribution: 15,
  texture_contrast: 10, function_practicality: 10, focal_point: 10, style_cohesion: 5 };
const PROFILES = {
  balanced: DEFAULT_W,
  strict_match: { style_cohesion: 30, materials_finishes: 25, silhouette_lines: 10, scale_proportion: 15,
    colour_distribution: 10, texture_contrast: 5, function_practicality: 3, focal_point: 2 },
  eclectic_designer: { style_cohesion: 3, scale_proportion: 25, silhouette_lines: 25, texture_contrast: 17,
    colour_distribution: 10, materials_finishes: 10, function_practicality: 5, focal_point: 5 },
};
const VALUE = { pass: 1, partial: 0.5, fail: 0 };
const MIN_COVERAGE = 0.6;
const TABLE_TO_SOFA = [0.5, 0.75];
const SCORE_LABEL = 'Styling fit (rule-based judgement, not a measurement; not an approval)';

const isNil = (v) => v === null || v === undefined;
const filled = (v) => (Array.isArray(v) ? v.length > 0 : !isNil(v));

// ---------------------------------------------------------------- validation
function validate(req) {
  const e = [];
  const oneOf = (v, list, where) => { if (!isNil(v) && !list.includes(v)) e.push(`${where}: ${JSON.stringify(v)} is not allowed`); };
  if (!req || typeof req !== 'object') return ['request must be an object'];
  const pieces = Array.isArray(req.pieces) ? req.pieces : [];
  if (pieces.length < 2) e.push('pieces: at least 2 are required');
  const ids = pieces.map((p) => p && p.id);
  if (new Set(ids).size !== ids.length) e.push('piece ids must be unique (a piece shown twice in a photo is one piece)');
  if (pieces.filter((p) => p && p.role === 'hero').length !== 1) e.push('exactly one hero piece is required');
  pieces.forEach((p, i) => {
    const at = `pieces[${i}]${p && p.id ? ` (${p.id})` : ''}`;
    if (!p || typeof p !== 'object') { e.push(`${at}: must be an object`); return; }
    for (const f of ['id', 'name', 'category']) if (typeof p[f] !== 'string' || !p[f]) e.push(`${at}: ${f} is required`);
    oneOf(p.role, ROLES, `${at}.role`); if (isNil(p.role)) e.push(`${at}: role is required`);
    oneOf(p.availability, AVAIL, `${at}.availability`);
    oneOf(p.visual_weight, WEIGHTS_, `${at}.visual_weight`);
    oneOf(p.silhouette, SILS, `${at}.silhouette`);
    oneOf(p.texture, TEXTURES, `${at}.texture`);
    if (!isNil(p.style) && !STYLE_MENU.includes(p.style)) e.push(`${at}.style must be on the style menu`);
    (p.finishes || []).forEach((f, j) => {
      oneOf(f && f.family, FAMILIES, `${at}.finishes[${j}].family`);
      if (!f || !f.name) e.push(`${at}.finishes[${j}].name is required`);
      oneOf(f && f.undertone, UNDERTONES, `${at}.finishes[${j}].undertone`);
    });
    if (p.dimensions_cm) for (const k of ['width', 'depth', 'height']) {
      const v = p.dimensions_cm[k]; if (!isNil(v) && !(typeof v === 'number' && v > 0)) e.push(`${at}.dimensions_cm.${k} must be > 0`);
    }
    if (!isNil(p.colour_hex) && !/^#[0-9a-fA-F]{6}$/.test(String(p.colour_hex).trim())) e.push(`${at}.colour_hex must be # followed by 6 hex digits`);
    if (p.role === 'midas_support') {
      const miss = ['sku', 'catalogue_photo', 'retrieved_on'].filter((f) => !p[f]);
      if (miss.length) e.push(`${at}: a Midas supporting piece needs ${miss.join(', ')}; without them it can only be generic context`);
    }
    if (p.role === 'generic_context' && p.sku) e.push(`${at}: generic context cannot carry a SKU`);
    const basis = p.basis || {};
    for (const [k, v] of Object.entries(basis)) oneOf(v, BASIS, `${at}.basis.${k}`);
    for (const f of DESCRIPTIVE) if (filled(p[f]) && !(f in basis)) e.push(`${at}: '${f}' is filled but has no basis; leave it empty (not confirmed) or say where it came from`);
    if (p.colour_hex && basis.colour_hex === 'observed_in_photo') e.push(`${at}: a hex read from a photo is an estimate; use basis 'estimated_from_photo'`);
  });
  (req.surfaces || []).forEach((s, i) => {
    if (!s || !s.name || !s.colour) e.push(`surfaces[${i}]: name and colour are required`);
    oneOf(s && s.role, PALETTE, `surfaces[${i}].role`);
    if (s && !isNil(s.area_share) && !(s.area_share >= 0 && s.area_share <= 1)) e.push(`surfaces[${i}].area_share must be 0 to 1`);
  });
  oneOf(req.output, OUTPUTS, 'output');
  oneOf(req.style, STYLE_MENU, 'style');
  oneOf(req.ambience, AMBIENCE_MENU, 'ambience');
  oneOf(req.preset, PRESET_MENU, 'preset');
  if (!isNil(req.max_midas_pieces) && !(Number.isInteger(req.max_midas_pieces) && req.max_midas_pieces >= 0 && req.max_midas_pieces <= 6)) e.push('max_midas_pieces must be 0 to 6');
  if (req.weights) {
    for (const [k, v] of Object.entries(req.weights)) {
      if (!PILLARS.includes(k)) e.push(`weights.${k} is not a pillar`);
      else if (!(Number.isInteger(v) && v >= 0 && v <= 100)) e.push(`weights.${k} must be 0 to 100`);
    }
    const w = { ...DEFAULT_W, ...req.weights };
    if (PILLARS.every((k) => w[k] === 0)) e.push('at least one weight must be above 0');
  } else if (!isNil(req.profile) && !(req.profile in PROFILES)) e.push(`unknown profile ${JSON.stringify(req.profile)}`);
  return e;
}

// ---------------------------------------------------------------- pillars
const R = (pillar, result, reason, fix = null) => ({ pillar, result, reason, fix });
const known = (ps, a) => ps.filter((p) => !isNil(p[a]));
const pct = (r) => `${Math.round(r * 100)}%`;

function selectPieces(req, hero) {
  const kept = [hero]; const excluded = []; let midasUsed = 0;
  const max = isNil(req.max_midas_pieces) ? 3 : req.max_midas_pieces;
  for (const p of req.pieces) {
    if (p === hero) continue;
    if (req.output === 'white_background') { excluded.push([p.id, 'white background output shows the product alone']); continue; }
    if (p.category === hero.category) { excluded.push([p.id, `same kind as the product (${p.category})`]); continue; }
    if (p.role === 'midas_support') {
      if (p.availability === 'out_of_stock') { excluded.push([p.id, `out of stock as read on ${p.retrieved_on}`]); continue; }
      if (midasUsed >= max) { excluded.push([p.id, `over the limit of ${max} Midas pieces`]); continue; }
      midasUsed += 1;
    }
    kept.push(p);
  }
  return { kept, excluded };
}

function scaleProportion(ps, hero) {
  const k = known(ps, 'visual_weight'); const notes = []; const res = [];
  if (k.length >= 2) {
    const heavy = k.filter((p) => p.visual_weight === 'heavy').length;
    const light = k.filter((p) => p.visual_weight === 'light').length;
    if (heavy >= 2 && !light) { res.push('fail'); notes.push(`${heavy} heavy pieces and nothing light: the group will look crowded`); }
    else if (heavy >= 2) { res.push('partial'); notes.push('two heavy pieces, partly offset by a light one'); }
    else { res.push('pass'); notes.push('visual weight is balanced'); }
  }
  const hw = hero.dimensions_cm && hero.dimensions_cm.width;
  if (hero.category.includes('sofa') && hw) {
    for (const t of ps.filter((p) => p !== hero && p.category.includes('table'))) {
      const tw = t.dimensions_cm && t.dimensions_cm.width;
      if (tw) {
        const r = tw / hw; const ok = r >= TABLE_TO_SOFA[0] && r <= TABLE_TO_SOFA[1];
        res.push(ok ? 'pass' : 'partial');
        notes.push(`${t.name} is ${pct(r)} of the sofa width${ok ? '' : ' (rule of thumb: about half to three quarters)'}`);
      }
    }
  }
  if (!res.length) return R('scale_proportion', 'unknown', 'visual weight and sizes not confirmed');
  const worst = res.reduce((a, b) => (VALUE[b] < VALUE[a] ? b : a));
  return R('scale_proportion', worst, notes.join('; '),
    worst === 'pass' ? null : 'swap one heavy piece for a leggy or glass one, or resize the table');
}

function silhouetteLines(ps) {
  const k = known(ps, 'silhouette'); const s = new Set(k.map((p) => p.silhouette));
  if (k.length < 2) return R('silhouette_lines', 'unknown', 'silhouettes not confirmed');
  if (s.has('mixed') || (s.has('angular') && s.has('curved'))) return R('silhouette_lines', 'pass', 'straight and curved lines balance each other');
  if (s.size === 1 && s.has('angular')) return R('silhouette_lines', 'partial', 'all angular: the room may feel rigid', 'add one rounded piece: a round table, a curved lamp or an oval mirror');
  return R('silhouette_lines', 'partial', 'all curved: shapes may read as soft or busy', 'anchor with one straight-lined piece');
}

function materialsFinishes(ps) {
  const hard = ps.flatMap((p) => (p.finishes || []).filter((f) => f.family === 'wood' || f.family === 'metal')
    .map((f) => ({ fam: f.family, name: f.name.toLowerCase(), u: isNil(f.undertone) ? null : f.undertone })));
  if (!hard.length) return R('materials_finishes', 'unknown', 'wood and metal finishes not confirmed');
  const distinct = new Set(hard.map((h) => `${h.fam}|${h.name}`)).size;
  const tones = new Set(hard.filter((h) => h.fam === 'wood' && h.u).map((h) => h.u));
  if (distinct > 3) return R('materials_finishes', 'fail', `${distinct} different wood/metal finishes; the limit is 3`, 'drop or swap the piece that adds the fourth finish');
  if (tones.has('warm') && tones.has('cool')) return R('materials_finishes', 'partial', 'warm and cool wood undertones are mixed', 'keep wood undertones the same even if darkness differs');
  return R('materials_finishes', 'pass', `${distinct} finish(es), undertones consistent`);
}

function colourDistribution(req) {
  if (req.output === 'white_background') return R('colour_distribution', 'unknown', 'no scene on a white background');
  const sf = req.surfaces || [];
  if (!sf.length) return R('colour_distribution', 'unknown', 'room surfaces not planned yet');
  const roles = new Set(sf.map((s) => s.role));
  const missing = PALETTE.filter((r) => !roles.has(r));
  if (missing.length) return R('colour_distribution', 'partial', `no surface carries ${missing.join(', ')}`, 'give one surface or textile each role: 60 dominant, 30 secondary, 10 accent');
  if (sf.every((s) => !isNil(s.area_share))) {
    const bands = { dominant_60: [0.45, 0.75], secondary_30: [0.15, 0.45], accent_10: [0.03, 0.20] };
    const off = [];
    for (const r of PALETTE) {
      const share = sf.filter((s) => s.role === r).reduce((a, s) => a + s.area_share, 0);
      if (!(share >= bands[r][0] && share <= bands[r][1])) off.push(`${r} at ${pct(share)}`);
    }
    if (off.length) return R('colour_distribution', 'partial', `split is off: ${off.join(', ')}`, 'rebalance the rug, curtains or cushions; never recolour the product');
    return R('colour_distribution', 'pass', 'roughly 60/30/10 across the planned surfaces');
  }
  return R('colour_distribution', 'pass', 'all three roles present; shares not estimated');
}

function textureContrast(ps) {
  const k = known(ps, 'texture'); const s = new Set(k.map((p) => p.texture));
  if (k.length < 2) return R('texture_contrast', 'unknown', 'textures not confirmed');
  if (s.has('smooth') && s.has('rough')) return R('texture_contrast', 'pass', 'smooth and textured surfaces sit together');
  return R('texture_contrast', 'partial', `only ${[...s].sort().join(', ')} surfaces`, 'add one contrasting texture: linen or boucle against glass or lacquer, or the reverse');
}

function functionPracticality(req, ps) {
  if (req.output === 'white_background') return R('function_practicality', 'unknown', 'no scene on a white background');
  const support = ps.filter((p) => p.role !== 'hero');
  if (!support.length) return R('function_practicality', 'unknown', 'no supporting pieces planned');
  const lacking = support.filter((p) => !(p.purpose && p.rests_on)).map((p) => p.name);
  if (lacking.length) return R('function_practicality', 'partial', `no purpose or support surface for: ${lacking.join(', ')}`, 'give every supporting piece a use and a surface it stands on');
  return R('function_practicality', 'pass', 'every supporting piece has a use and a surface');
}

function focalPoint(ps, hero) {
  const rank = { light: 0, medium: 1, heavy: 2 };
  const support = ps.filter((p) => p !== hero);
  if (!support.length) return R('focal_point', 'pass', 'the product stands alone');
  const rivals = [];
  const hw = hero.dimensions_cm ? hero.dimensions_cm.width : null;
  for (const p of support) {
    if (hero.visual_weight && p.visual_weight && rank[p.visual_weight] > rank[hero.visual_weight]) rivals.push(`${p.name} is visually heavier`);
    const pw = p.dimensions_cm ? p.dimensions_cm.width : null;
    if (hw && pw && pw > hw) rivals.push(`${p.name} is wider (${Math.round(pw)} vs ${Math.round(hw)} cm)`);
  }
  if (rivals.length) return R('focal_point', 'partial', rivals.join('; '), 'keep the product the clear subject: smaller support, or move it back');
  if (isNil(hero.visual_weight) && !hw) return R('focal_point', 'unknown', 'product weight and size not confirmed');
  return R('focal_point', 'pass', 'nothing outweighs the product');
}

function styleCohesion(ps) {
  const k = known(ps, 'style'); const s = [...new Set(k.map((p) => p.style))];
  if (k.length < 2) return R('style_cohesion', 'unknown', 'styles not confirmed');
  if (s.length === 1) return R('style_cohesion', 'pass', `one style: ${s[0]}`);
  if (s.length === 2) return R('style_cohesion', 'partial', `two styles: ${s.sort().join(' + ')}`, 'fine for an eclectic brief; for a strict brief pick the requested style');
  return R('style_cohesion', 'fail', `${s.length} styles in one scene`, 'cut to the requested style plus at most one accent style');
}

// ---------------------------------------------------------------- main
function checkPlan(req) {
  const errors = validate(req);
  if (errors.length) return { status: 'invalid_input', errors, score: null, score_label: SCORE_LABEL };
  const hero = req.pieces.find((p) => p.role === 'hero');
  const { kept, excluded } = selectPieces(req, hero);
  const pillars = [scaleProportion(kept, hero), silhouetteLines(kept), materialsFinishes(kept), colourDistribution(req),
    textureContrast(kept), functionPracticality(req, kept), focalPoint(kept, hero), styleCohesion(kept)];
  const raw = req.weights ? { ...DEFAULT_W, ...req.weights } : PROFILES[req.profile || 'balanced'];
  const total = PILLARS.reduce((a, k) => a + raw[k], 0);
  const w = Object.fromEntries(PILLARS.map((k) => [k, raw[k] / total]));
  const kn = pillars.filter((p) => p.result !== 'unknown');
  const cov = kn.reduce((a, p) => a + w[p.pillar], 0);
  const clean = (x, d) => Math.round(x * 10 ** d) / 10 ** d; // remove float noise before half-up rounding
  const coverage = Math.floor(clean(cov * 1000, 6) + 0.5) / 1000;
  let score = null;
  if (kn.length && coverage >= MIN_COVERAGE) score = Math.floor(clean(100 * kn.reduce((a, p) => a + w[p.pillar] * VALUE[p.result], 0) / cov, 9) + 0.5);
  const results = new Set(pillars.map((p) => p.result));
  const status = coverage < MIN_COVERAGE ? 'needs_information'
    : results.has('fail') ? 'plan_needs_change' : results.has('partial') ? 'plan_ready_with_warnings' : 'plan_ready';
  return {
    status, score, coverage, score_label: SCORE_LABEL,
    profile: req.weights ? 'custom' : (req.profile || 'balanced'),
    kept: kept.map((p) => p.id), excluded, pillars,
    critique: {
      the_win: pillars.filter((p) => p.result === 'pass').map((p) => p.reason).slice(0, 2),
      the_conflict: pillars.filter((p) => p.result === 'fail' || p.result === 'partial').map((p) => p.reason),
      the_fix: pillars.filter((p) => p.fix && (p.result === 'fail' || p.result === 'partial')).map((p) => p.fix),
      not_confirmed: pillars.filter((p) => p.result === 'unknown').map((p) => p.pillar),
    },
  };
}

// ---- A7 step 11b · Stylist check (wrapper). The engine above is the stylist skill's engine, unchanged. ----
// First pass: the input is the planner's reply and the state comes from "11a Plan ticket".
// Loop pass: the input is the state from "11d Plan verdict" (plan_state = true) with rewritten plans.
// Code fixes only what code can fix without inventing anything; everything else goes to the plan critic.
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
const arrT = (v, n, max) => (Array.isArray(v) ? v : []).map(x => txt(x, n || 120)).filter(Boolean).slice(0, max || 8);
const nl = String.fromCharCode(10);
const inp = $input.first().json;
let st;
if (inp && inp.plan_state === true) st = JSON.parse(JSON.stringify(inp));
else {
  st = JSON.parse(JSON.stringify($('11a Plan ticket').first().json));
  st.plan_state = true;
  const reply = findJson(bodyOf(inp), 'shots');
  textCall(st, 11, '11 Stylist plans the scenes', 'gpt-6.1-sol', inp); // P1.8
  const got = reply && Array.isArray(reply.shots) ? reply.shots : [];
  st.plan_readable = got.length > 0;
  st.plan_risks = reply ? arrT(reply.risks, 160, 8) : [];
  st.planner_rejected = reply && Array.isArray(reply.catalogue_rejected) ? reply.catalogue_rejected.slice(0, 12).map(x => ({ sku: txt(x && x.sku, 20), reason: txt(x && x.reason, 160) })) : [];
  for (const shot of st.shots) {
    // Match by output_id; fall back to position only when the planner gave no output_id at that position.
    const e = got.find(x => x && x.output_id === shot.output_id) || (got[shot.n - 1] && !got[shot.n - 1].output_id ? got[shot.n - 1] : null);
    const rm = e && e.room && typeof e.room === 'object' ? e.room : {};
    shot.plan = e ? {
      room_size: txt(e.room_size, 20), room: { walls: txt(rm.walls, 160), floor: txt(rm.floor, 160), windows: txt(rm.windows, 160), zone: txt(rm.zone, 160) },
      setting: txt(e.setting), light: txt(e.light, 300), camera: txt(e.camera, 300), presentation: txt(e.presentation), person: txt(e.person, 240),
      supporting_props: arrT(e.supporting_props, 120, 8),
      midas_pieces: (Array.isArray(e.midas_pieces) ? e.midas_pieces : []).slice(0, 6).map(m => ({ sku: txt(m && m.sku, 20), count: Math.max(1, Math.min(2, Math.round(Number(m && m.count) || 1))), purpose: txt(m && m.purpose, 160), rests_on: txt(m && m.rests_on, 120) })),
      palette_roles: { dominant_60: txt(e.palette_roles && e.palette_roles.dominant_60, 120), secondary_30: txt(e.palette_roles && e.palette_roles.secondary_30, 120), accent_10: txt(e.palette_roles && e.palette_roles.accent_10, 120) },
      rationale: txt(e.rationale, 300)
    } : null;
    shot.plan_ok = false; shot.code_fixes = []; shot.code_findings = []; shot.code_warnings = [];
  }
  // A white master the planner left out gets the studio's fixed plan; a scene shot left out makes the reply unreadable.
  for (const shot of st.shots) if (!shot.plan && shot.kind === 'white') { shot.plan = { room_size: '', room: { walls: '', floor: '', windows: '', zone: '' }, setting: '', light: '', camera: '', presentation: '', person: '', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: '' }; shot.code_fixes.push('the planner gave no entry for the white master; the studio plan is used'); }
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
// The white master: the angle of the vendor photo only (16 Oct 2026, prompt check P3; 13 Compile already used it).
const WHITE = { room_size: '', room: { walls: '', floor: '', windows: '', zone: '' }, setting: 'Pure white seamless studio background and clean white floor, the product alone, with only a natural, subtle contact shadow directly beneath it.', light: 'Soft, even, neutral professional studio light that shows the real colour of the product.', camera: 'The camera angle and perspective of the vendor photo. The whole product in frame with white space on every side.', presentation: 'The complete product as arranged in the vendor photo, every piece fully visible and countable.', person: '', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: '', secondary_30: '', accent_10: '' }, rationale: 'Catalogue master, fixed by the studio.' };
// Stage 07 rules for scene plans (owner decisions 15 Oct 21:50 and 16 Oct 2026, 22-24; prompt check P3, P4): Midas pieces only; a lamp or
// rug only as a Midas piece; the light follows the fixed preset; people only when the brief asks; the room fields name no furniture.
const LAMP = /\b(table lamps?|floor lamps?|desk lamps?|lamps?|sconces?|lanterns?|candles?|chandeliers?|pendant lights?|pendants?)\b/i;
const RUG = /\b(rugs?|carpets?|runners? rug)\b/i;
const FURNITURE = /\b(sofa|sofas|couch|chair|chairs|armchair|table|tables|desk|bed|beds|bench|stool|ottoman|cabinet|dresser|sideboard|console|shelf unit|bookcase|lamp|lamps|rug|rugs|plant|plants|art|artwork|painting|cushion|cushions|vase|books?)\b/i;
const PRESET_CLASH = { Daylight: /\b(evening|night|dusk|sunset|candle ?light|lamplight|after dark)\b/i, 'Golden afternoon': /\b(night|after dark|midday|noon|overcast|cool daylight)\b/i, 'Warm evening': /\b(daylight|sunlit|sunny|morning|midday|noon|bright sun)\b/i };
const presetOf = shot => String(shot.light_preset || 'Daylight').replace(/ \(studio default\)$/, '');
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
    // Generic props are never used in Studio scenes (owner, 15 Oct 2026, 21:50): they are removed here and listed at go 1.
    if (p.supporting_props.length) {
      for (const g of p.supporting_props) if (namesMidas(g)) findings.push('generic prop "' + g + '" names a Midas product; plan it by SKU in midas_pieces');
      fixes.push('removed generic props (only Midas pieces appear in Studio scenes): ' + p.supporting_props.join('; '));
      shot.generic_removed = p.supporting_props.slice();
      p.supporting_props = [];
    }
    if (st.people_max === 0 && p.person) { fixes.push('removed the person (people: none): ' + p.person); p.person = ''; }
    if (st.people_max === 0 && PEOPLE.test(p.presentation) && /\b(sit|sits|sitting|stand|stands|standing|holding|reading)\b/i.test(p.presentation)) findings.push('the presentation seems to place a person in the scene; people are not allowed');
    if (st.people_max === 1 && p.person && /\bin front of\b|\bcover(s|ing)?\b|\bblock(s|ing)?\b/i.test(p.person)) findings.push('the person may stand in front of the product or cover a piece; a person stays beside or behind the product');
    const midasKinds = p.midas_pieces.map(m => String((bySku[m.sku] && bySku[m.sku].kind) || '').toLowerCase());
    const words = [p.setting, p.light, p.presentation, p.person].join(' ');
    if (LAMP.test(words) && !midasKinds.some(k => /lamp|light|sconce|chandelier|lantern|candle/.test(k))) findings.push('a lamp or other light fitting is planned that is not a Midas piece; warm light comes from the room\'s built-in light (recessed downlights, a cove light or a plain ceiling fixture), and a lamp appears only as a Midas lamp from the shortlist');
    if (RUG.test(words) && !midasKinds.some(k => /rug|carpet/.test(k))) findings.push('a rug is planned that is not a Midas piece; only a Midas rug from the shortlist may appear');
    const clash = PRESET_CLASH[presetOf(shot)];
    if (clash && clash.test(p.light)) findings.push('the light "' + p.light + '" does not fit the fixed light preset ' + presetOf(shot) + '; the preset of this shot cannot change');
    const rr = p.room || {}; // plans made before 16 Oct 2026 have no room fields
    const roomText = [rr.walls, rr.floor, rr.windows, rr.zone].join(' ');
    if (FURNITURE.test(roomText)) findings.push('the room fields name furniture or an object ("' + roomText.match(FURNITURE)[0] + '"); they describe only the walls, floor, windows and the free floor zone');
    if (!p.palette_roles.dominant_60 || !p.palette_roles.secondary_30 || !p.palette_roles.accent_10) warnings.push('palette roles for the room (60/30/10) are incomplete');
  }
  shot.code_fixes = (shot.code_fixes || []).concat(fixes);
  shot.code_findings = findings;
  shot.code_warnings = warnings;
}
// A shot made from the approved image of another shot repeats its Midas pieces and person (19a uses that shot's pieces anyway).
for (const shot of st.shots) {
  if (!shot.plan || shot.plan_ok || !shot.made_from) continue;
  const src = st.shots.find(x => x.output_id === shot.made_from);
  if (!src || !src.plan) continue;
  const same = JSON.stringify(src.plan.midas_pieces) === JSON.stringify(shot.plan.midas_pieces) && (src.plan.person || '') === (shot.plan.person || '');
  if (!same) { shot.plan.midas_pieces = JSON.parse(JSON.stringify(src.plan.midas_pieces)); shot.plan.person = src.plan.person || ''; shot.code_fixes = (shot.code_fixes || []).concat(['Midas pieces and person copied from ' + src.output_id + ', which this shot is made from']); }
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
  'Client choices, fixed for scene shots: ' + (choices.length ? choices.join('; ') : 'none given') + '. ' + (st.people_text || 'People: none in any shot.') + ' ' + (st.plant_text || ''),
  'Lead: ' + LEAD[st.lead] + '.',
  'A shot of kind white is the catalogue master, fixed by the studio: the product alone on plain white with neutral studio light, at the angle of the vendor photo, no props and no room; the client choices do not apply to it. Shots of kind hero, wide and detail show one and the same room on purpose. A shot made from another shot repeats its room, arrangement, Midas pieces and person on purpose.',
  'Scene rules, fixed by the studio: a scene shows only the product, the room shell (walls, floor, ceiling, windows with plain sheer curtains or blinds, doors, fixed architectural details and built-in light) and planned Midas pieces. No generic props. Each scene shot has a fixed light preset and a fixed camera view (below); the plan follows them. Warm or evening light comes from the built-in light; a lamp or a rug appears only as a planned Midas piece.',
  'Category guidance (' + st.profile.name + '): ' + (st.profile.guide ? st.profile.guide + ' These are composition guidelines, not evidence of the source inventory. Original images and explicit owner corrections take precedence.' : 'none recorded.'),
  'Midas shortlist (the only Midas products allowed; nothing else may appear): ' + (short.length ? short.map(c => c.sku + ' ' + c.name + ' (' + c.kind + (c.fixed ? ', client pick, must appear' : '') + ')').join('; ') : 'none') + '. At most ' + maxMidas + ' different Midas pieces across the job.',
  ...(st.shots.some(x => x.plan && x.plan_ok) ? ['Shots already checked, shown for consistency only (one room keeps one light direction; client picks and the Midas limit count across the job). Do not return entries for these:'].concat(st.shots.filter(x => x.plan && x.plan_ok).map(x => 'Shot ' + x.n + ' (output ' + x.output_id + ', kind ' + x.kind + '). Setting: ' + (x.plan.setting || 'none') + ' Light: ' + (x.plan.light || 'none') + ' Midas pieces: ' + (x.plan.midas_pieces.length ? x.plan.midas_pieces.map(m => m.count + ' x SKU ' + m.sku).join('; ') : 'none') + '.')) : []),
  'Plans to check:'
];
for (const x of pending) {
  const p = x.plan;
  const rm = p.room || {};
  lines.push('Shot ' + x.n + ' (output ' + x.output_id + ', kind ' + x.kind + '). Frame: ' + x.frame + '.' + (x.kind === 'white' ? '' : ' Fixed camera view: ' + (x.camera_view || 'Reference view') + '. Fixed light preset: ' + (x.light_preset || 'Daylight (studio default)') + '.' + (x.made_from ? ' Made from the approved image of ' + x.made_from + '.' : '')) + ' Room size: ' + (p.room_size || 'not given') + '. Room: walls ' + (rm.walls || 'not given') + '; floor ' + (rm.floor || 'not given') + '; windows ' + (rm.windows || 'not given') + '; zone ' + (rm.zone || 'not given') + '. Setting: ' + (p.setting || 'none') + ' Light: ' + (p.light || 'none') + ' Camera: ' + (p.camera || 'none') + ' Presentation: ' + (p.presentation || 'none') + ' Person: ' + (p.person || 'none') + '.' +
    ' Generic props: ' + (p.supporting_props.length ? p.supporting_props.join('; ') : 'none') + '. Midas pieces: ' + (p.midas_pieces.length ? p.midas_pieces.map(m => m.count + ' x SKU ' + m.sku + ' ' + (bySku[m.sku] ? bySku[m.sku].name : '') + ', purpose: ' + (m.purpose || 'not given') + ', rests on: ' + (m.rests_on || 'not given')).join('; ') : 'none') +
    '. Palette roles of the room: ' + (x.kind === 'white' ? 'not applicable' : JSON.stringify(p.palette_roles)) + '.' + (x.code_findings && x.code_findings.length ? ' Code found (must be fixed): ' + x.code_findings.join('; ') + '.' : '') + (x.code_warnings && x.code_warnings.length ? ' Code notes: ' + x.code_warnings.join('; ') + '.' : ''));
}
const now = new Date().toISOString();
st.plan_round = (st.plan_round || 0) + 1;
st.critic_request = lines.join(nl);
// Owner, 20 Oct 2026 (speed change 3): a white master's plan is the studio's fixed plan (WHITE above; 13 Compile uses its own
// WHITE_PLAN), so the paid plan critic adds nothing when every shot left to check is a white master and code found nothing to fix.
// Such a shot passes here; 12 shows its plan check as "fixed by the studio".
const codeMadeOnly = st.plan_readable !== false && pending.length > 0 && pending.every(x => x.kind === 'white' && !(x.code_findings || []).length);
if (codeMadeOnly) for (const x of pending) x.plan_ok = true;
st.critic_needed = st.plan_readable !== false && pending.length > 0 && !codeMadeOnly;
st.trail = st.trail.concat([{ step: 11, name: 'Stylist check', at: now, note: 'round ' + st.plan_round + ': ' + pending.length + ' shots to check; code fixes ' + st.shots.reduce((t, x) => t + (x.code_fixes || []).length, 0) + '; findings ' + st.shots.reduce((t, x) => t + (x.code_findings || []).length, 0) + (codeMadeOnly ? '; plan critic not called: white master only, plan written by code' : '') }]);
return [{ json: st }];
