// Step 1 · Intent & scope: turn the portal request into brief v1. Code only, no model.
function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function clean(v, max) {
  const s = text(v); let o = '';
  for (let i = 0; i < s.length; i++) o += s.charCodeAt(i) < 32 ? ' ' : s.charAt(i);
  return o.split(' ').filter(Boolean).join(' ').slice(0, max);
}
function list(v, max) { return Array.isArray(v) ? v.map(x => clean(x, max || 120)).filter(Boolean) : []; }
const item = $input.first();
const body = (item.json && item.json.body) ? item.json.body : (item.json || {});
let p = body.payload;
const problems = [];
const notApplied = [];
if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; problems.push('The job details could not be read.'); } }
if (!p || typeof p !== 'object') { p = {}; if (!problems.length) problems.push('No job details were sent.'); }
// 16 Oct 2026 (prompt check F2 and the client first page check): two page shapes are read.
// - The A7 page draft sends colour, material, details to keep and things to exclude under `metadata`.
// - The client first page sends top-level `outcomes`, `delivery` (ratio, views, resolution) and `details` (sku, dimensions, colour, fabric,
//   inventory, customPrompt). Its shape labels are translated as `aspect` is; it never falls back to 16:9. A request without a job id is
//   still refused. Every field that A7 does not use is listed back under "not applied".
const job = p.job && typeof p.job === 'object' ? p.job : {};
const it = p.item || {};
const det = p.details && typeof p.details === 'object' ? p.details : {};
const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
const dl = p.delivery && typeof p.delivery === 'object' ? p.delivery : {};
const scope = Object.assign({}, p.scope || {});
if (!Array.isArray(scope.outcomes) && Array.isArray(p.outcomes)) scope.outcomes = p.outcomes;
if (!text(scope.view) && text(dl.views)) scope.view = dl.views;
if (!text(scope.aspect) && !text(scope.proportions) && text(dl.ratio)) scope.aspect = dl.ratio;
if (!text(scope.resolution) && text(dl.resolution)) scope.resolution = dl.resolution;
const pref = p.preferences || {};
const clientRunId = clean(p.clientRunId || p.client_run_id, 90);
if (clientRunId.length < 8 || clientRunId.length > 80) problems.push('The job id must be 8 to 80 characters.');
const parentRunId = clean(p.parentRunId || p.parent_run_id, 80);
const mode = text(p.mode).toLowerCase() === 'projects' ? 'projects' : 'manual';
const jobType = (clean(job.type || p.jobMode, 40) || 'new_project').toLowerCase().split(' ').join('_');
const workOn = clean(job.workOn, 40).toLowerCase();
const itemRole = (clean(job.itemRole || it.role, 20) || 'hero').toLowerCase();
if (workOn === 'batch') notApplied.push('Batch: this address takes one item; a batch is split into one job per item before it reaches here.');

// Outcomes: map client wording to A7 outcome keys. Unknown outcomes are refused with a reason, never sent on.
const MAP = [['white', 'white_bk'], ['website', 'website'], ['variation', 'variations'], ['new composition', 'new_composition'], ['composition', 'new_composition'], ['create with', 'create_with_item'], ['lifestyle', 'lifestyle']];
const asked = list(scope.outcomes, 60);
if (!asked.length && text(scope.outcome)) asked.push(clean(scope.outcome, 60));
const outcomes = [];
for (const a of asked) {
  const low = a.toLowerCase();
  let key = '';
  for (const [k, v] of MAP) { if (!key && low.indexOf(k) !== -1) key = v; }
  if (!key) notApplied.push('Outcome not offered: ' + a);
  else if (outcomes.indexOf(key) === -1) outcomes.push(key);
}
if (!outcomes.length) problems.push('Choose at least one outcome.');
if (outcomes.indexOf('variations') !== -1 && !parentRunId) problems.push('Variations need the approved result they start from.');

// Views (owner, 16 Oct 2026, 04:16): the client's view choice decides the scene images of a lifestyle job. Each view is its own
// paid image; all views of one job share one room, arrangement and light (stage 07). A white background ignores the view.
const VIEWS = { 'category template': ['hero', 'wide', 'detail'], 'studio decides': ['hero', 'wide', 'detail'], 'wide view': ['wide'], 'close-up': ['detail'], 'wide view + close-up': ['wide', 'detail'] };
// Camera views (owner, 16 Oct 2026, decisions 24 and 27): the direction the camera looks from, separate from the framing view above.
// Reference view (the vendor photo's angle) unless the client names another. Left side and Right side are gated in stage 07 (19a).
const CAMERAS = ['Reference view', 'Full frontal', 'Left side', '45° right', 'Right side'];
function cameraOf(v) {
  const t = clean(v, 40).toLowerCase();
  if (!t) return '';
  if (/reference|vendor|as photographed/.test(t)) return 'Reference view';
  if (/45|three[\s-]*quarter/.test(t) && /right/.test(t)) return '45° right';
  if (/\bleft\b/.test(t)) return 'Left side';
  if (/\bright\b/.test(t)) return 'Right side';
  if (/front/.test(t)) return 'Full frontal';
  return '?';
}
let cameraGiven = clean(scope.camera || scope.cameraView || scope.camera_view || scope.angle || dl.camera, 40);
if (!cameraGiven && cameraOf(scope.view) && cameraOf(scope.view) !== '?') { cameraGiven = clean(scope.view, 40); scope.view = ''; }
let camera = cameraOf(cameraGiven);
if (camera === '?') { notApplied.push('Camera view not offered: ' + cameraGiven + '. Camera views offered: ' + CAMERAS.join(', ') + '; Reference view is used.'); camera = ''; }
camera = camera || 'Reference view';
// Series (owner, 16 Oct 2026, decision 27): Three views (Full frontal, Left side, 45° right; same light) and Views by light (those three
// views in three lights: 9 images). The three lights are A7's own presets (Daylight, Golden afternoon, Warm evening): F1's Twilight has no
// A7 preset, so it is not used (an assumption, listed in the README). Other F1 series (lighting, styles, collection, package) are not built.
const seriesGiven = clean(scope.series || dl.series || (typeof p.series === 'string' ? p.series : ''), 40);
let series = '';
{
  const t = seriesGiven.toLowerCase();
  if (!t || /^(single|single image|none|no series|one image)$/.test(t)) series = '';
  else if (/by light|by lighting|matrix|\b9\b|nine/.test(t)) series = 'views_by_light';
  else if (/three views|3 views|angles|view series/.test(t)) series = 'three_views';
  else notApplied.push('Series not offered: ' + seriesGiven + '. Series offered: Single image, Three views, Views by light (9 images); a single image per view is planned.');
}
const viewGiven = clean(scope.view, 40);
const viewKey = viewGiven.toLowerCase().replace(/close\s*-?\s*up/g, 'close-up').replace(/\s*\+\s*/g, ' + ');
const viewKnown = Boolean(VIEWS[viewKey]);
const viewDefault = !viewKey || viewKey === 'category template' || viewKey === 'studio decides';
const viewName = viewKnown ? viewKey.charAt(0).toUpperCase() + viewKey.slice(1) : 'Category template';
const views = viewKnown ? VIEWS[viewKey] : VIEWS['category template'];
const wantsViews = outcomes.indexOf('lifestyle') !== -1;
if (viewKey && !viewKnown && wantsViews) notApplied.push('View not offered: ' + viewGiven + '. Views offered: Category template, Wide view, Close-up, Wide view + close-up; the category template (hero, wide and detail) is used.');
// Light preset of each scene image (owner, 16 Oct 2026, decision 23): fixed before planning; the planner may not change it.
// From the client's lighting words, as 19a did before (night | warm | day); a series sets its own lights.
const lightWords = clean(pref.lighting, 40).toLowerCase();
const lightKey = /night|evening|dark/.test(lightWords) ? 'night' : (/warm|cosy|cozy|sunset|golden/.test(lightWords) ? 'warm' : (/day|bright|natural|morning/.test(lightWords) ? 'day' : ''));
const LIGHT_LABEL = { day: 'Daylight', warm: 'Golden afternoon', night: 'Warm evening' };
// Required outputs (the package). The white master anchors every package that shows the product.
let n = Math.round(Number(scope.imageCount));
if (!Number.isFinite(n) || n < 1) n = 2;
if (n > 4) { if (outcomes.indexOf('variations') !== -1) notApplied.push('Asked for ' + n + ' variations; at most 4, so 4 are planned.'); n = 4; } // used by variations only; a lifestyle job's count follows its views
const outputs = [];
function add(id, kind, outcome, extra) {
  if (outputs.some(o => o.id === id)) return;
  const o = { id, kind, outcome };
  if (kind !== 'white' && kind !== 'variation') Object.assign(o, { camera: 'Reference view', light: lightKey, light_label: lightKey ? LIGHT_LABEL[lightKey] : '', from: '' }, extra || {});
  outputs.push(o);
}
const slug = c => c.toLowerCase().replace(/°/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const SERIES_CAMS = ['Full frontal', 'Left side', '45° right'];
const SERIES_LIGHTS = ['day', 'warm', 'night'];
const seriesKind = views.length === 1 && views[0] === 'wide' ? 'wide' : 'hero';
for (const o of outcomes) {
  if (o === 'white_bk') add('white_master', 'white', o);
  if (o === 'lifestyle') {
    add('white_master', 'white', o);
    if (series === 'three_views') {
      // The first image is the base; the others are made from its approved image with only the camera moved (13, 19a).
      SERIES_CAMS.forEach((c, i) => add('view_' + slug(c), seriesKind, o, { camera: c, from: i ? 'view_' + slug(SERIES_CAMS[0]) : '', series: { name: 'three_views', label: 'Three views', k: i + 1, n: 3 } }));
    } else if (series === 'views_by_light') {
      // Each image changes one thing from the image it is made from: in Daylight the camera moves from Full frontal; in the other two
      // lights only the light changes from the Daylight image of the same camera.
      let k = 0;
      for (const l of SERIES_LIGHTS) for (const c of SERIES_CAMS) {
        k++;
        const from = l === 'day' ? (c === SERIES_CAMS[0] ? '' : 'day_' + slug(SERIES_CAMS[0])) : 'day_' + slug(c);
        add(l + '_' + slug(c), seriesKind, o, { camera: c, light: l, light_label: LIGHT_LABEL[l], from, series: { name: 'views_by_light', label: 'Views by light', k, n: 9 } });
      }
    } else for (const v of views) add(v, v, o, { camera });
  }
  if (o === 'website') { add('white_master', 'white', o); add('hero', 'hero', o); add('wide', 'wide', o); add('detail', 'detail', o); }
  if (o === 'new_composition') { add('white_master', 'white', o); add('composition_1', 'composition', o); }
  if (o === 'create_with_item') { add('white_master', 'white', o); add('scene_1', 'scene', o); }
  if (o === 'variations') { for (let i = 1; i <= Math.max(1, n); i++) add('variation_' + i, 'variation', o); }
}
// Cap: 8 images per job. The views-by-light series is the one exception, at 10 (the white master and its 9 images), because the
// owner asked for that series to be built (16 Oct 2026). Raising the cap for other jobs is still the owner's decision.
const CAP = series === 'views_by_light' && outcomes.indexOf('lifestyle') !== -1 ? 10 : 8;
if (outputs.length > CAP) { notApplied.push('Package capped at ' + CAP + ' images.'); outputs.length = CAP; }
if (series && outcomes.indexOf('lifestyle') === -1) notApplied.push('Series: ' + seriesGiven + ' applies to lifestyle images only.');
if (series && outcomes.indexOf('lifestyle') !== -1) {
  if (viewKey && !viewDefault && seriesKind !== 'wide') notApplied.push('View: ' + viewGiven + ' does not apply to a series; each series image shows the whole product (hero framing).');
  if (cameraGiven && camera !== 'Reference view') notApplied.push('Camera view: ' + camera + ' does not apply to a series; the series sets the camera of each image.');
  if (series === 'views_by_light' && lightKey) notApplied.push('Lighting: ' + clean(pref.lighting, 40) + ' does not apply to the views-by-light series; it sets the light of each image (Daylight, Golden afternoon, Warm evening).');
}
if (!wantsViews && camera !== 'Reference view') notApplied.push('Camera view: ' + camera + ' applies to lifestyle images only.');
if (!wantsViews && !viewDefault) notApplied.push('View: ' + viewGiven + ' does not apply to ' + (outcomes.length === 1 && outcomes[0] === 'white_bk' ? 'a white background, which makes the white catalogue image only' : (outcomes.indexOf('website') !== -1 ? 'a website package, which is always hero, wide and detail' : 'these outcomes')) + '.');
// A lifestyle job's image count follows its views: a count sent by the page is checked against the plan, never used to add images.
const askedN = Math.round(Number(scope.imageCount));
if (wantsViews && Number.isFinite(askedN) && askedN > 0 && askedN !== outputs.length && !series) notApplied.push('The request counted ' + askedN + ' image(s); the chosen views give ' + outputs.length + ' (' + outputs.map(o => o.id).join(', ') + '), so ' + outputs.length + ' are planned.');

// Scene shape (owner, 16 Oct 2026, 03:24): nine shapes, 1:1 by default. Older client pages send `aspect` with labels such as
// "Portrait · 4:5"; the A7 page sends bare values such as "4:5" (owner, 04:16); A7's own field is `proportions`. All are read;
// "Standard for category" means 1:1. The white master is always 1:1 (11a).
const SHAPES = ['1:1', '4:5', '5:4', '3:4', '4:3', '2:3', '3:2', '16:9', '9:16'];
function shapeOf(v) {
  const s = clean(v, 40);
  if (!s) return { given: '', shape: '' };
  if (/^standard\b/i.test(s)) return { given: s, shape: '1:1' };
  const m = s.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  const r = m ? Number(m[1]) + ':' + Number(m[2]) : '';
  return { given: s, shape: SHAPES.indexOf(r) !== -1 ? r : '' };
}
const fromProportions = shapeOf(scope.proportions);
const fromAspect = shapeOf(scope.aspect);
let shape = '1:1', shapeSource = 'default';
if (fromProportions.shape) { shape = fromProportions.shape; shapeSource = 'proportions'; }
else if (fromAspect.shape) { shape = fromAspect.shape; shapeSource = 'aspect'; }
for (const x of [fromProportions, fromAspect]) if (x.given && !x.shape) notApplied.push('Image shape not offered: ' + x.given + '. Shapes offered: ' + SHAPES.join(', ') + '; ' + shape + ' is used.');
if (fromProportions.shape && fromAspect.shape && fromProportions.shape !== fromAspect.shape) notApplied.push('Two image shapes were sent (' + fromAspect.given + ' and ' + fromProportions.given + '); ' + shape + ' is used.');

// Inventory and exclusions as the client stated them (supplied facts).
const inventory = [];
const inv = Array.isArray(it.inventory) ? it.inventory : [];
for (const r of inv) {
  const name = clean(r && (r.item || r.name), 60);
  const c = Math.round(Number(r && r.count));
  if (name && Number.isFinite(c) && c > 0 && c < 200) inventory.push({ item: name, count: c });
  else if (name) notApplied.push('Piece count not understood for: ' + name);
}
// The client first page's piece count is free text (details.inventory). Only parts of the form "number piece" are read, for example
// "2 chairs"; anything else is listed back, never turned into a guessed count.
if (!inv.length && text(det.inventory)) {
  for (const part of text(det.inventory).split(/[\n,;]+/).map(x => clean(x, 80)).filter(Boolean)) {
    const m = part.match(/^(\d{1,3})\s*(?:x\s+)?([A-Za-z][A-Za-z '\-]{0,58})$/);
    const c = m ? Number(m[1]) : 0;
    if (m && c > 0 && c < 200) inventory.push({ item: clean(m[2], 60), count: c });
    else notApplied.push('Piece count not understood: "' + part + '". Write one piece per line as "number piece", for example "2 chairs".');
  }
}
const exclusions = list(it.exclusions || it.mustNot || meta.must_not || meta.mustNot, 80);
// Details the client asks to keep (A7 page draft: metadata.locks) go to the conflict check with the written instructions, which turns
// them into locks for every image (09). They are data, never instructions to a model.
const keepLines = list(meta.locks, 160);

// People (owner, 16 Oct 2026, decision 22): none by default. One natural adult is allowed only when the brief asks: Human presence on
// (A7 page styling.human, client first page preferences.human), people "one", "yes" or F1's "Human lifestyle".
const humanAsk = [pref.human, p.styling && p.styling.human, pref.people, job.humanLifestyle];
const peopleAsked = humanAsk.some(v => v === true || /^(yes|one|1|human lifestyle|human|on|true)$/i.test(clean(v, 30))) || outcomesHuman(scope.outcomes);
function outcomesHuman(v) { return (Array.isArray(v) ? v : []).some(x => /human lifestyle/i.test(String(x))); }
const people = peopleAsked ? 'one' : 'none';
// Fields that A7 does not use are listed back to the client (16 Oct 2026, prompt check F2 and F3).
const styling = p.styling && typeof p.styling === 'object' ? p.styling : {};
if (styling.plants === true || pref.plants === true) notApplied.push('Plants: not offered yet. Scenes show only the product, the room and confirmed Midas pieces.');
if (clean(styling.mood || pref.mood, 60)) notApplied.push('Mood: ' + clean(styling.mood || pref.mood, 60) + ' is not used yet.');
if (styling.catalogue === false) notApplied.push('Midas supporting pieces switch: not used yet. Scenes use up to three Midas pieces confirmed in stock, or none.');
if (clean(meta.hero, 120)) notApplied.push('Hero item: "' + clean(meta.hero, 120) + '" is not used; the vendor photo and the inventory decide the product.');
if (p.strengths && typeof p.strengths === 'object' && Object.keys(p.strengths).length) notApplied.push('Fidelity, styling and clutter settings: not used; the studio keeps the product exactly as photographed.');
if (p.validation !== undefined && p.validation !== null && p.validation !== '') notApplied.push('Validation settings: not used.');
if (clean(det.links, 300)) notApplied.push('Product links: not read.');
if (clean(det.previousGeneration, 120) && !parentRunId) notApplied.push('Previous generation: not used without the approved run it comes from.');
if (det.includeDescriptionAndMetadata === false) notApplied.push('Description and metadata: the package always carries a draft description; it is not switched off.');
if (clean(dl.variations, 40) && !/not requested|none|^no$/i.test(clean(dl.variations, 40))) notApplied.push('Variations: ' + clean(dl.variations, 40) + ' is not used here; variations start from an approved result.');
if (Array.isArray(p.variationAxes) && p.variationAxes.length) notApplied.push('Variation axes: not used here.');
if (Array.isArray(p.catalogueReferences) && p.catalogueReferences.length) notApplied.push('Catalogue references: not read; name Midas items by SKU instead.');
if (clean(p.roomBrief, 200)) notApplied.push('Room description: not read yet.');
const brief = {
  version: 1,
  mode, job_type: jobType, work_on: workOn || 'one_by_one', item_role: itemRole,
  start: clean(p.start || job.startFrom, 40),
  parent_run_id: parentRunId,
  category: clean(it.category || it.department, 80),
  product_type: clean(it.productType || it.product_type || it.subCategory, 80),
  sku: clean(it.sku || det.sku, 40),
  dimensions: clean(it.dimensions || det.dimensions, 120),
  colour: clean(it.colour || it.color || meta.color || meta.colour || det.colour || det.color, 60),
  material: clean(it.material || meta.material || det.fabric || det.material, 80),
  inventory, inventory_total: inventory.reduce((s, r) => s + r.count, 0), exclusions,
  outcomes, outputs,
  view: wantsViews ? (series ? (series === 'three_views' ? 'Three views' : 'Views by light') : viewName) : '', views: wantsViews ? (series ? [] : views.slice()) : [], view_given: viewGiven,
  camera_view: wantsViews && !series ? camera : (wantsViews ? 'set by the series' : ''), series, series_given: seriesGiven,
  proportions: shape, proportions_source: shapeSource, resolution: /^standard/i.test(clean(scope.resolution, 20)) ? '' : clean(scope.resolution, 10),
  preferences: { lighting: clean(pref.lighting, 40), light_preset: lightKey, wall: clean(pref.wallPaint || pref.wall, 40), floor: clean(pref.floor, 40), people, use_defaults: Boolean(pref.useWorkflowDefaults) },
  midas_picks: list(p.midasPicks || it.midasPicks, 40),
  instructions: clean([p.instructions || meta.instructions || '', det.customPrompt || ''].concat(keepLines.length ? ['Details to keep exactly as in the vendor photo: ' + keepLines.join('; ') + '.'] : []).map(x => clean(x, 1200)).filter(Boolean).join(' '), 1200),
  product_notes: clean(it.description || it.notes || it.details || p.notes || (p.metadata && p.metadata.notes), 1200),
  reference_roles: Array.isArray(p.references) ? p.references.map(r => ({ name: clean(r && r.name, 160), role: clean(r && r.role, 40), side: clean(r && r.side, 10).toLowerCase() })) : []
};
const stamp = new Date().toISOString();
const runId = 'claude-a7-' + stamp.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
return [{
  json: {
    run_id: runId, client_run_id: clientRunId, parent_run_id: parentRunId,
    usable: problems.length ? 'refuse' : 'ok', problems, not_applied: notApplied, brief,
    received_at: stamp,
    trail: [{ step: 1, name: 'Intent & scope', at: stamp, note: problems.length ? problems.join(' ') : outputs.length + ' outputs planned for ' + outcomes.join(', ') }]
  },
  binary: item.binary
}];
