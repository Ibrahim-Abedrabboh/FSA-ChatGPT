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

// ---- n8n wrapper ----
const first = $input.first().json;
const request = first && first.body && first.body.pieces ? first.body : first;
return [{ json: checkPlan(request) }];
