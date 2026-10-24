// Local tests for the A7 prompt and intake fixes and the owner's decisions of 16 Oct 2026 (06:24, revised 06:49).
// Runs the n8n Code-node source with mocked node outputs. No network, no AI, no paid call.
// Run: node tests/claude-midas-a7-prompt-fixes/run_tests_prompt_fixes.js [OUT_DIR]   (OUT_DIR: also writes sample prompts)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const NODES = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');
const FIX6 = path.join(ROOT, 'tests', 'claude-midas-a7-stage-06', 'fixtures');
const OUT = process.argv[2] || '';
const clone = x => JSON.parse(JSON.stringify(x));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const ref = (buf, mime) => ({ _buf: buf, mimeType: mime || 'application/octet-stream' });
async function run(file, nodes, input) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = input || [];
  const $input = { first: () => items[0], all: () => items };
  const helpers = {
    getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b._buf) throw new Error('no binary ' + prop); return b._buf; },
    prepareBinaryData: async (buf, fileName, mimeType) => ({ _buf: buf, fileName, mimeType })
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFn('$', '$input', '$execution', 'require', fs.readFileSync(path.join(NODES, file), 'utf8'));
  return fn.call({ helpers }, $, $input, { resumeUrl: '' }, require);
}
const intake = async payload => (await run('01_Intent_scope.js', {}, [{ json: { body: { payload: JSON.stringify(payload) } } }]))[0].json;
const ids = r => r.brief.outputs.map(o => o.id).join();
const MASTER = fs.readFileSync(path.join(FIX6, 'master_2048.png'));
const ROOM = fs.readFileSync(path.join(FIX6, 'out_1125.jpg'));
const SIDE = fs.readFileSync(path.join(FIX6, 'out_1125.webp'));
const PROFILES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claude-midas-a7-profiles-2026-10-16.json'), 'utf8'));
const write = (name, text) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), text); } };

(async () => {
  const SETTINGS = (await run('04_Settings.js', { '01 Intent & scope': [{ json: {} }] }))[0].json;
  const SET = { '04 Settings': [{ json: SETTINGS }] };

  // ---------- 04 Settings ----------
  const cam = SETTINGS.scenes.camera;
  ok(cam.living.guides === 'the floor meets the bottom edge of the frame' && cam.living.guides_with_rug === 'the rug touches the bottom edge of the frame', '04: living-room guide names the floor; the rug guide is kept for a Midas rug only (P1)');
  ok(['Reference view', 'Full frontal', 'Left side', '45° right', 'Right side'].every(v => /no fisheye/.test(cam.views[v])) && /0 degrees tilt/.test(cam.views['Full frontal']) && /0 degrees tilt/.test(cam.views['Left side']) && /same side, angle and perspective as image 1/.test(cam.views['Reference view']), '04: camera views: 0 degrees tilt except the Reference view; no fisheye anywhere (decision 24)');
  ok(cam.raise.families.join() === 'dining' && cam.raise.min_pieces === 9 && /starting rule/.test(cam.raise.basis) && /stays level \(0 degrees tilt\)/.test(cam.raise.text) && /small downward tilt/.test(cam.raise.text) && /large dining set/.test(cam.raise.text), '04: raised camera for large dining sets, still level; a small tilt only if chair backs hide pieces; the 9-piece threshold is a starting rule (owner D9)');
  ok(SETTINGS.scenes.kelvin.labels.night === 'Warm evening' && /built-in light/.test(SETTINGS.scenes.kelvin.scene.night) && /recessed downlights, a cove light or a plain ceiling fixture/.test(SETTINGS.scenes.built_in_light) && /built-in light/.test(SETTINGS.scenes.room_shell), '04: built-in light is part of the room shell; presets carry their scene line (decision 23)');
  ok(SETTINGS.scenes.side_views.gate === 'supplied_photo_only' && SETTINGS.auto_repair === false && !/go 3/.test(fs.readFileSync(path.join(NODES, '04_Settings.js'), 'utf8')), '04: side views need a supplied photo; no "go 3"; auto_repair stays false (decisions 27 and 29, revised 06:49)');

  // ---------- 01 Intent & scope ----------
  const first = { clientRunId: 'claude-test-first-0001', version: 'Client first-page design · 2', mode: 'Manual', job: { type: 'New Project', option: 'One by one (same department)' },
    item: { department: 'Home Furniture', category: 'Dining Rooms', subCategory: 'Dining Chairs', role: 'Product / set' },
    outcomes: ['Lifestyle'], delivery: { views: 'Wide view + close-up', ratio: 'Portrait · 4:5', resolution: '2K', variations: 'Not requested' }, variationAxes: [], references: [], catalogueReferences: [], roomBrief: '',
    preferences: { lighting: 'Warm evening', wall: 'Sage', floor: 'Light oak', mood: 'Warm & inviting', plants: true, human: false },
    details: { links: '', sku: '161283', dimensions: '50 x 40 x 60 cm', colour: 'cream', fabric: 'boucle', inventory: '2 chairs\nsome cushions', includeDescriptionAndMetadata: true, previousGeneration: '', customPrompt: 'show the two chairs without the table' },
    strengths: { Fidelity: 100, Styling: 65, Cluttering: 30 } };
  let r = await intake(first);
  ok(r.usable === 'ok' && ids(r) === 'white_master,wide,detail' && r.brief.proportions === '4:5' && r.brief.resolution === '2K', '01: client first page shape: outcomes, delivery.views and delivery.ratio read; 4:5 kept');
  ok(r.brief.sku === '161283' && r.brief.dimensions === '50 x 40 x 60 cm' && r.brief.colour === 'cream' && r.brief.material === 'boucle' && r.brief.instructions === 'show the two chairs without the table' && r.brief.category === 'Dining Rooms' && r.brief.product_type === 'Dining Chairs', '01: details.sku, dimensions, colour, fabric and customPrompt read');
  ok(r.brief.inventory.length === 1 && r.brief.inventory[0].item === 'chairs' && r.brief.inventory[0].count === 2 && r.not_applied.some(x => /Piece count not understood: "some cushions"/.test(x)), '01: details.inventory: only "number piece" is read; anything else is listed back, never guessed');
  ok(['Plants: not offered', 'Mood: Warm & inviting', 'Fidelity, styling and clutter'].every(w => r.not_applied.some(x => x.indexOf(w) === 0)) && r.brief.preferences.people === 'none', '01: plants, mood and strengths listed as not applied; human off → no people');
  const noId = clone(first); delete noId.clientRunId;
  r = await intake(noId);
  ok(r.usable === 'refuse' && r.problems.some(x => /job id/.test(x)) && !r.problems.some(x => /outcome/.test(x)), '01: the client first page without a job id is still refused (only for the id)');
  r = await intake(Object.assign(clone(first), { delivery: { views: 'Close-up', ratio: 'Standard for category', resolution: 'Standard' } }));
  ok(r.brief.proportions === '1:1' && r.brief.resolution === '' && ids(r) === 'white_master,detail', '01: "Standard for category" → 1:1, never 16:9; "Standard" resolution → studio default');
  const pageDraft = { job: 'lifestyle', jobMode: 'new_project', workOn: 'one_by_one', clientRunId: 'claude-test-page-0001',
    scope: { outcome: 'Lifestyle', outcomes: ['Lifestyle'], view: 'Wide view + close-up', aspect: '4:5', resolution: '2K', imageCount: 3 },
    item: { department: 'Home Furniture', category: 'Dining Rooms', subCategory: 'Dining Chairs', referenceType: 'Product / vendor reference' },
    preferences: { lighting: 'Warm evening', wallPaint: 'Sage', floor: 'Light oak', useWorkflowDefaults: false },
    styling: { plants: true, human: true, mood: 'Warm & inviting', catalogue: false },
    metadata: { product_category: 'Dining Rooms', color: 'cream', material: 'boucle', hero: 'the two chairs', locks: ['exactly two chairs'], must_not: ['the wooden table in the photo'], delivery: { aspect: '4:5', resolution: '2K' } },
    references: [{ name: 'chairs.jpg', role: 'Product / vendor reference' }] };
  r = await intake(pageDraft);
  ok(r.brief.colour === 'cream' && r.brief.material === 'boucle' && r.brief.exclusions.join() === 'the wooden table in the photo' && /Details to keep exactly as in the vendor photo: exactly two chairs\./.test(r.brief.instructions), '01: A7 page draft: metadata colour, material, must_not and locks read (F2)');
  ok(r.brief.preferences.people === 'one' && ['Plants: not offered', 'Mood: Warm', 'Midas supporting pieces switch', 'Hero item'].every(w => r.not_applied.some(x => x.indexOf(w) === 0)) && r.brief.job_type === 'new_project', '01: human on → one adult allowed; plants, mood, Midas switch and hero listed back (F2, F3)');
  r = await intake({ clientRunId: 'claude-test-series-0001', scope: { outcomes: ['Lifestyle'], series: 'Three views' } });
  ok(ids(r) === 'white_master,view_full_frontal,view_left_side,view_45_right' && r.brief.outputs[1].from === '' && r.brief.outputs[2].from === 'view_full_frontal' && r.brief.outputs[3].camera === '45° right' && r.brief.outputs[2].series.k === 2, '01: Three views: Full frontal first; Left side and 45° right made from it');
  r = await intake({ clientRunId: 'claude-test-series-0002', scope: { outcomes: ['Lifestyle'], series: 'Views by light (9 images)' }, preferences: { lighting: 'Daylight' } });
  const o9 = r.brief.outputs;
  ok(o9.length === 10 && !r.not_applied.some(x => /capped/.test(x)) && o9.find(o => o.id === 'night_left_side').from === 'day_left_side' && o9.find(o => o.id === 'day_45_right').from === 'day_full_frontal' && o9.find(o => o.id === 'warm_full_frontal').light === 'warm' && o9.filter(o => o.light === 'night').length === 3, '01: Views by light: 9 images plus the white master (cap 10 for this series only); each changes one thing');
  ok(r.not_applied.some(x => /Lighting: Daylight does not apply to the views-by-light series/.test(x)), '01: a lighting choice is listed back for the views-by-light series');
  r = await intake({ clientRunId: 'claude-test-cap-0001', parentRunId: 'claude-a7-parent-0001', scope: { outcomes: ['Lifestyle', 'New Composition', 'Create with this item', 'Variations'], imageCount: 4, view: 'Wide view + close-up' } });
  ok(r.brief.outputs.length === 8 && r.not_applied.some(x => /capped at 8/.test(x)), '01: other jobs keep the cap of 8');
  r = await intake({ clientRunId: 'claude-test-cam-0001', scope: { outcomes: ['Lifestyle'], view: 'Wide view', camera: 'Left side' }, preferences: { lighting: 'Golden afternoon' } });
  ok(r.brief.outputs[1].camera === 'Left side' && r.brief.outputs[1].light === 'warm' && r.brief.camera_view === 'Left side', '01: a camera view and the light preset are fixed per scene image');
  r = await intake({ clientRunId: 'claude-test-cam-0002', scope: { outcomes: ['Lifestyle'], camera: 'Bird eye' } });
  ok(r.brief.outputs[1].camera === 'Reference view' && r.not_applied.some(x => /Camera view not offered: Bird eye/.test(x)), '01: an unknown camera view → Reference view, listed back');
  r = await intake({ clientRunId: 'claude-test-ppl-0001', scope: { outcomes: ['Lifestyle'] }, preferences: { people: 'Human lifestyle' } });
  ok(r.brief.preferences.people === 'one', '01: F1 "Human lifestyle" allows one adult');
  r = await intake({ clientRunId: 'claude-test-ppl-0002', scope: { outcomes: ['Lifestyle'] } });
  ok(r.brief.preferences.people === 'none', '01: no people by default (decision 22)');

  // ---------- 07 Route: A7's own profiles table ----------
  const ev = { brief: { product_type: 'Sectional sofa', category: 'Sofas', outputs: [{ id: 'white_master', kind: 'white' }, { id: 'view_full_frontal', kind: 'hero' }, { id: 'view_left_side', kind: 'hero', from: 'view_full_frontal' }], parent_run_id: '', item_role: 'hero' }, observation: { category_seen: 'sectional sofa', count_eye: 7, room: null }, inventory: [{ item: 'module', count: 7 }], exclusions: [], conflicts: [], trail: [] };
  r = (await run('07_Route.js', { '04-06 Evidence': [{ json: ev }] }, PROFILES.map(json => ({ json }))))[0].json;
  ok(r.profile.id === 'sofa' && /Preserve every module/.test(r.profile.guide) && r.profile.source_rules === '' && r.profile.family === 'Living & sofa sets', '07: profile from A7\'s table with F1\'s category guidance; no product-specific rule text');
  const ev2 = clone(ev); ev2.brief.product_type = 'Plain white dinner plate set'; ev2.brief.category = 'Tableware'; ev2.observation.category_seen = 'dinner plate';
  r = (await run('07_Route.js', { '04-06 Evidence': [{ json: ev2 }] }, PROFILES.map(json => ({ json }))))[0].json;
  ok(r.profile.id === 'dinnerware' && !/horse/.test(JSON.stringify(r.profile)) && /add none that it does not show/.test(r.profile.guide), '07: a plain plate gets general guidance, never "horse motif" (P2)');
  ok(PROFILES.length === 43 && PROFILES.filter(p => p.profile_id === 'trolley').length === 1 && PROFILES.find(p => p.profile_id === 'trolley').prop_policy === 'dining' && PROFILES.every(p => p.guide && p.basis && /F1 Options page/.test(p.guide_source)) && PROFILES.filter(p => /with A7 edits/.test(p.guide_source)).every(p => p.a7_edit), '07: 43 profiles, one trolley row; every edited guide says what changed');
  ok(r.cost_estimate.no_repair > 0 && (await run('07_Route.js', { '04-06 Evidence': [{ json: ev }] }, PROFILES.map(json => ({ json }))))[0].json.cost_estimate.basis.length > 0, '07: cost estimate still made');

  // ---------- 08 Locks ----------
  const s08 = { observation: { design_locks: [], sided_parts: [], room: null }, exclusions: [], profile: { checks: [] }, brief: { preferences: { people: 'none' }, outputs: [{ id: 'white_master', kind: 'white' }, { id: 'warm_left_side', kind: 'hero', camera: 'Left side', light: 'warm', light_label: 'Golden afternoon', from: 'day_left_side' }] }, written_files: [], conflicts: [], unknowns: [], trail: [] };
  r = (await run('08_Locks_and_freedoms.js', {}, [{ json: s08 }]))[0].json;
  const l2 = r.outputs[1].locks.join(' | ');
  ok(/camera view: Left side/.test(l2) && /light preset: Golden afternoon/.test(l2) && /no people/.test(l2) && /made from the approved image of day_left_side/.test(l2) && /only Midas pieces/.test(r.outputs[1].free.join(' ')), '08: camera view, light preset, people and made-from are locks; only Midas pieces may be added');

  // ---------- 10 Retrieve: no Midas cushions or throws ----------
  const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claude-midas-accessories-2026-10-16.json'), 'utf8')).rows;
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-05', 'v1_404.json'), 'utf8'));
  delete base.events; delete base.row;
  const s10 = clone(base); s10.profile = Object.assign({}, s10.profile, { prop_policy: 'living' }); s10.critical = []; s10.client_question = '';
  s10.outputs = s10.outputs.concat([{ id: 'hero', kind: 'hero', outcome: 'lifestyle' }]);
  r = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: s10 }] }, CATALOGUE.map(json => ({ json }))))[0].json;
  ok(!r.retrieval.shortlist.some(c => /cushion|throw/.test(c.kind)) && r.retrieval.rejected.filter(x => /cushion/.test(x.name)).length === 1 && r.retrieval.rejected.length < 80, '10: no Midas cushion or throw shortlisted; counted in one line (decision 25)');
  const cushion = CATALOGUE.find(c => c.kind === 'cushion');
  const s10b = clone(s10); s10b.brief.midas_picks = [String(cushion.sku)];
  r = (await run('10_Retrieve_Midas_pieces.js', { '09b Contract': [{ json: s10b }] }, CATALOGUE.map(json => ({ json }))))[0].json;
  ok(r.critical.some(c => c.what === 'midas_pick' && /not offered/.test(c.why)) && /cannot be shown/.test(r.client_question), '10: a client pick of a Midas cushion becomes one client question');

  // ---------- 11a plan ticket ----------
  const s11 = clone(base);
  s11.brief = Object.assign({}, s11.brief, { series: 'three_views', preferences: { lighting: '', people: 'none' } });
  s11.outputs = [s11.outputs[0], { id: 'view_full_frontal', kind: 'hero', camera: 'Full frontal', light: '', from: '', series: { name: 'three_views', label: 'Three views', k: 1, n: 3 }, locks: ['x'], free: [] }, { id: 'view_left_side', kind: 'hero', camera: 'Left side', light: '', from: 'view_full_frontal', series: { name: 'three_views', label: 'Three views', k: 2, n: 3 }, locks: ['x'], free: [] }];
  s11.profile = Object.assign({}, s11.profile, PROFILES.find(p => p.profile_id === 'sofa'), { id: 'sofa', checks: ['All seats'] });
  s11.retrieval = { shortlist: [], rejected: [], max_midas: 0, notes: [] };
  const t11 = (await run('11a_Plan_ticket.js', {}, [{ json: s11 }]))[0].json;
  const pr11 = t11.plan_request;
  ok(/camera view Full frontal \(fixed\), light preset Daylight \(studio default\) \(fixed\), Three views image 1 of 3/.test(pr11) && /made from the approved image of view_full_frontal/.test(pr11), '11a: each scene shot has a fixed camera view and light preset; made-from named');
  ok(/Nothing else: no generic props, plants, books, rugs, lamps, art or textiles that are not Midas pieces/.test(pr11) && /left out when the image is made/.test(pr11) && !/generic props only/.test(pr11) && /the scenes show only the product in the room shell/.test(pr11), '11a: Midas pieces only; no "generic props only" fallback (P3)');
  ok(/Warm or evening light comes from the room's built-in light/.test(pr11) && /A table lamp or floor lamp appears only as a Midas lamp/.test(pr11) && /People: none in any shot/.test(pr11) && /Plants: none, unless a Midas artificial plant/.test(pr11), '11a: light, lamps, people and plants as the owner decided (22, 23)');
  ok(/Category guidance: Create a residential lounge/.test(pr11) && /These are composition guidelines, not evidence of the source inventory/.test(pr11) && !/Rules for this kind of product/.test(pr11), '11a: category guidance with F1\'s qualifier (P2)');
  ok(!/bookends hold books/.test(fs.readFileSync(path.join(NODES, '11a_Plan_ticket.js'), 'utf8')), '11a: the accessory lead no longer asks for books');
  const s11h = clone(s11); s11h.brief.preferences.people = 'one';
  ok(/At most one natural adult per scene shot, in the person field/.test((await run('11a_Plan_ticket.js', {}, [{ json: s11h }]))[0].json.plan_request), '11a: one adult allowed only when the brief asks');

  // ---------- 11b stylist check ----------
  const planOf = over => Object.assign({ output_id: 'view_full_frontal', frame: 'square, 1:1', room_size: 'medium', room: { walls: 'warm plaster', floor: 'oak boards', windows: 'one tall window', zone: 'centred against the long wall' }, setting: 'A calm room.', light: 'Soft daylight from the left window.', camera: 'Level, facing the front.', presentation: 'Against the long wall.', person: '', supporting_props: [], midas_pieces: [], palette_roles: { dominant_60: 'a', secondary_30: 'b', accent_10: 'c' }, rationale: 'r' }, over || {});
  async function check11b(plans, st) {
    const reply = { shots: [{ output_id: 'white_master' }].concat(plans), risks: ['the corner module merges'], catalogue_rejected: [] };
    return (await run('11b_Stylist_check.js', { '11a Plan ticket': [{ json: st || t11 }] }, [{ json: { text: JSON.stringify(reply) } }]))[0].json;
  }
  let c = await check11b([planOf({ supporting_props: ['books', 'a green plant'], person: 'a man reading' }), planOf({ output_id: 'view_left_side', person: 'x' })]);
  const sh1 = c.shots[1];
  ok(sh1.plan.supporting_props.length === 0 && sh1.code_fixes.some(f => /removed generic props/.test(f) && /books/.test(f)) && sh1.code_fixes.some(f => /removed the person/.test(f)) && sh1.plan.person === '', '11b: generic props and an unallowed person removed by code');
  c = await check11b([planOf({ light: 'Warm evening glow from a floor lamp.', presentation: 'On a jute rug.' }), planOf({ output_id: 'view_left_side' })]);
  ok(c.shots[1].code_findings.some(f => /lamp or other light fitting is planned that is not a Midas piece/.test(f)) && c.shots[1].code_findings.some(f => /rug is planned that is not a Midas piece/.test(f)) && c.shots[1].code_findings.some(f => /does not fit the fixed light preset Daylight/.test(f)), '11b: a lamp, a rug and a light that breaks the preset are findings (decision 23, P4)');
  c = await check11b([planOf({ room: { walls: 'white', floor: 'oak', windows: 'tall', zone: 'beside the sofa' } }), planOf({ output_id: 'view_left_side' })]);
  ok(c.shots[1].code_findings.some(f => /room fields name furniture or an object \("sofa"\)/.test(f)), '11b: room fields that name furniture are a finding (S2)');
  c = await check11b([planOf({ midas_pieces: [] }), planOf({ output_id: 'view_left_side', person: '' })]);
  ok(c.shots[2].code_fixes.length === 0 || c.shots[2].code_fixes.every(f => !/copied/.test(f)), '11b: a made-from shot that already matches its source is left alone');
  ok(/Fixed camera view: Left side\. Fixed light preset: Daylight \(studio default\)\. Made from the approved image of view_full_frontal\./.test(c.critic_request) && /Scene rules, fixed by the studio/.test(c.critic_request) && /Category guidance \(/.test(c.critic_request), '11b: the plan critic sees camera view, preset, made-from, scene rules and the guidance');
  const st11h = clone(t11); st11h.people_max = 1;
  c = await check11b([planOf({ person: 'a woman standing in front of the sofa' }), planOf({ output_id: 'view_left_side' })], st11h);
  ok(c.shots[1].plan.person && c.shots[1].code_findings.some(f => /in front of the product/.test(f)), '11b: an allowed person in front of the product is a finding');

  // ---------- 11d plan verdict: rewrite of person and room ----------
  const pre = await check11b([planOf({ light: 'Evening light from a floor lamp.' }), planOf({ output_id: 'view_left_side' })]);
  const fail = { plans: [{ shot: 2, checks: { room_rules: { result: 'fail', evidence: 'lamp' } }, rewrite: { light: 'Soft daylight from the left window.', person: 'someone', room: { zone: 'centred on the long wall' }, supporting_props: ['a vase'] } }, { shot: 3, checks: Object.fromEntries(['product_unchanged', 'handedness_kept', 'shown_with_kept', 'frame_respected', 'client_choices_respected', 'product_visible', 'props_clean', 'midas_pieces_ok', 'room_rules', 'lead_respected'].map(k => [k, { result: 'pass', evidence: 'ok' }])) }] };
  const v11 = (await run('11d_Plan_verdict.js', { '11b Stylist check': [{ json: pre }] }, [{ json: { text: JSON.stringify(fail) } }]))[0].json;
  ok(v11.shots[1].plan.light === 'Soft daylight from the left window.' && v11.shots[1].plan.person === '' && v11.shots[1].plan.room.zone === 'centred on the long wall' && v11.shots[1].plan.supporting_props.length === 0, '11d: rewrite applies light and room; no person when none allowed; no generic props');

  // ---------- 12 go 1 ticket: side views ----------
  const s12 = clone(v11); s12.plan_again = false;
  for (const x of s12.shots) { x.plan_ok = true; x.check = { checks: [], failed: [] }; }
  s12.references = s12.references.concat([{ key: 'left', name: 'sofa-left.jpg', role: 'other_view', image: true, mime: 'image/jpeg', bytes: SIDE.length, sha256: sha(SIDE) }]);
  s12.brief.reference_roles = s12.brief.reference_roles.concat([{ name: 'sofa-left.jpg', role: 'Other views / pieces', side: '' }]);
  let g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: s12 }]))[0].json;
  ok(g12.side_views.length === 1 && g12.side_views[0].photo && g12.side_views[0].photo.key === 'left' && /its file name/.test(g12.side_views[0].photo.basis) && /a supplied photo shows the left side/.test(g12.side_views[0].gate), '12: a Left side view with a supplied photo of that side passes the gate; the basis is shown');
  const s12b = clone(s12); s12b.references = s12b.references.filter(r => r.key !== 'left');
  g12 = (await run('12_Who_leads_the_scene.js', {}, [{ json: s12b }]))[0].json;
  ok(!g12.side_views[0].photo && /will be held, and the other images continue/.test(g12.side_views[0].gate) && !/accept_inferred_sides/.test(JSON.stringify(g12.go1)) && /is held in stage 07; a go does not change that/.test(g12.go1.how_to_answer), '12: no photo of that side → held; no option to accept inferred sides (revised 06:49)');
  ok(g12.go1.reminders.some(x => /not a Midas piece confirmed in stock .* left out when the image is made/.test(x)) && g12.go1.shots[1].camera_view === 'Full frontal', '12: go 1 says that anything not a confirmed Midas piece is left out (P3)');

  // ---------- 13 Compile ----------
  const RISK = clone(base);
  const wh = (await run('13_Compile.js', { 'V1 Vault events': [{ json: Object.assign(clone(base), { status: 'go_1_given', go1_last: { decision: 'go', by: 'owner' }, profile: Object.assign({}, base.profile, { source_rules: 'Preserve horse motif.', guide: 'X' }) }) }] }, [{ json: SETTINGS }]))[0].json;
  const wp = wh.s04.dispatch.prompt;
  ok(/Its longest side spans about 76% of the frame side in the same direction/.test(wp) && !/margin of about 12% of the frame on every side/.test(wp) && !/horse motif|Category guidance|Rules for this kind/.test(wp) && /Before returning the image, check it against image 1: exactly 7 product pieces/.test(wp), '13 white: framing on the longest side (S1); no category text; self-check (C2)');
  const boxed = clone(base); boxed.status = 'go_1_given'; boxed.go1_last = { decision: 'go', by: 'owner' };
  boxed.observation.pieces_seen = boxed.observation.pieces_seen.map((p, i) => Object.assign({}, p, { box: [300, 50 + i * 130, 600, 160 + i * 130] }));
  const bp = (await run('13_Compile.js', { 'V1 Vault events': [{ json: boxed }] }, [{ json: SETTINGS }]))[0].json.s04.dispatch.prompt;
  ok(/In image 1, from left to right, the pieces stand in this order: left-arm piece, armless, armless, armless, armless, corner, right-arm piece, as image 1 shows\./.test(bp) && !/from left to right/.test(wp), '13: layout line from distinct reader boxes only (C1)');
  const rep = clone(boxed); rep.status = 'repair_ordered'; rep.repair_orders = { white_master: { attempt: 2, corrections: ['fix the arm'], preserve: ['seven pieces'] } };
  const rp13 = (await run('13_Compile.js', { 'V1 Vault events': [{ json: rep }] }, [{ json: SETTINGS }]))[0].json.s04.dispatch.prompt;
  ok(/Keep unchanged while correcting: seven pieces\./.test(rp13) && !/Keep exactly as in the vendor photo, and do not change/.test(rp13), '13: repair keep list heading (P5)');

  // Scene prompts: a packaged sofa run with a three-view series and a views-by-light pair.
  const sofaP = PROFILES.find(p => p.profile_id === 'sofa');
  function sceneState(over) {
    const s = clone(base);
    s.profile = Object.assign({}, s.profile, { family: sofaP.family, guide: sofaP.guide, source_rules: '', prop_policy: 'living' });
    s.status = 'scene_due'; s.go1_last = { decision: 'go', by: 'owner' };
    s.approved = { output_id: 'white_master', attempt: 1, by: 'owner', candidate: { sha256: sha(MASTER), drive_file_id: 'drive-master', file_name: 'm.png' } };
    s.brief.preferences = { lighting: '', wall: 'Sage', floor: 'Light oak', people: 'none' };
    s.outputs = s.outputs.concat([{ id: 'view_full_frontal', kind: 'hero', camera: 'Full frontal', light: '', from: '' }]);
    s.shots = s.shots.concat([{ n: 2, output_id: 'view_full_frontal', kind: 'hero', frame: 'landscape, 16:9, wider than tall', plan: planOf({ light: 'Soft morning daylight.', camera: 'Level at the centre of the sofa.' }) }]);
    return Object.assign(s, over || {});
  }
  const pres = (view, light, extra) => Object.assign({ camera: { family: 'living', height_cm: '110-120', guides: SETTINGS.scenes.camera.living.guides, guides_with_rug: SETTINGS.scenes.camera.living.guides_with_rug }, camera_rules: SETTINGS.scenes.camera.rules, view, view_rule: SETTINGS.scenes.camera.views[view],
    light: { preset: light, label: SETTINGS.scenes.kelvin.labels[light], kelvin: SETTINGS.scenes.kelvin[light], scene: SETTINGS.scenes.kelvin.scene[light], built_in: SETTINGS.scenes.built_in_light } }, extra || {});
  const framing = { type: 'hero', text: 'Hero view. The product\'s longest side spans about 60-70% of the frame.' };
  const compile = async st => (await run('13_Compile.js', { 'V1 Vault events': [{ json: st }] }, [{ json: SETTINGS }]))[0].json.s04;
  // Empty room
  let sc = { output_id: 'view_full_frontal', kind: 'hero', phase: 'room', attempt: 1, shot: { frame: 'landscape, 16:9, wider than tall', plan: sceneState().shots[1].plan }, presets: pres('Full frontal', 'night'), framing, scale: { product: 'not confirmed' }, props: [], refs: [] };
  let o13 = await compile(sceneState({ scene: sc }));
  const room = o13.dispatch.prompt;
  write('after_room_prompt.txt', room);
  ok(o13.go && /Walls: Sage \(the client's choice\); warm plaster\./.test(room) && /Floor: Light oak \(the client's choice\); oak boards\./.test(room) && /Leave this floor zone clear, empty and fully visible: centred against the long wall\./.test(room), '13 room: walls, floor and the clear zone only (S2), with the client\'s choices');
  ok(!/sofa|Sectional|A calm room|palette/i.test(room) && /no textiles except plain sheer curtains or blinds at the windows/.test(room) && !/Framing guide/.test(room), '13 room: names no product and no furniture; curtains are the only textiles (S3); no framing guide');
  ok(/about 2700 K colour temperature \(Warm evening preset\): evening: the windows are dark; warm light comes from the room's built-in light/.test(room) && /no lamps\./.test(room), '13 room: night preset uses built-in light, no lamps (decision 23)');
  // Placement, own room, Full frontal, with a Midas rug and a Midas lamp.
  const props = [{ sku: '111', name: 'VERAMOND RUG', kind: 'rug', purpose: 'under the front legs', rests_on: 'the floor', live: { size_on_page: '200 x 300 cm' } }, { sku: '222', name: 'TYNEXA TABLE LAMP', kind: 'table lamp', purpose: 'on the side table', rests_on: 'the side table', live: {} }];
  const refsPlace = [{ n: 1, role: 'vendor photo', key: 'photo', sha256: 'a' }, { n: 2, role: 'approved white master', key: 'scene_master', sha256: 'b' }, { n: 3, role: 'room', key: 'scene_room', sha256: 'c' }, { n: 4, role: 'Midas piece', sku: '111', key: 'scene_prop_0', sha256: 'd' }, { n: 5, role: 'Midas piece', sku: '222', key: 'scene_prop_1', sha256: 'e' }];
  sc = Object.assign({}, sc, { phase: 'place', presets: pres('Full frontal', 'night'), props, refs: refsPlace, room: { source: 'made in stage 07' }, person: '' });
  o13 = await compile(sceneState({ scene: sc }));
  let pp = o13.dispatch.prompt;
  write('after_place_full_frontal_night.txt', pp);
  ok(/Camera view, Full frontal: A level camera facing the front of the product at natural chest height, centred: 0 degrees tilt/.test(pp) && /Turn the product in the room so that the camera sees it this way/.test(pp) && /Framing guide: the rug touches the bottom edge of the frame/.test(pp), '13 place: Full frontal camera at 0 degrees; rug guide only because a Midas rug is placed (P1, decision 24)');
  // Changed 16 Oct 2026 (review fixes): the lamp sentence ends ', listed above.'; a night image has dark windows, so no daylight line.
  ok(/The only lamp is the Midas TYNEXA TABLE LAMP \(SKU 222\), listed above\./.test(pp) && /the windows are dark/.test(pp) && !/daylight through the windows/.test(pp) && /2700 K/.test(pp) && /From the plan: Soft morning daylight/.test(pp), '13 place: a confirmed Midas lamp is the only lamp');
  ok(/Category guidance: Create a residential lounge\..*These are composition guidelines, not evidence of the source inventory\. Original images and explicit owner corrections take precedence\./.test(pp) && /Before returning the image, check it against image 1: exactly 7 product pieces/.test(pp), '13 place: category guidance with F1\'s qualifier (P2); self-check (C2)');
  ok(/add nothing: no other furniture, rugs, lamps or light fittings, plants, books, art, textiles \(except plain sheer curtains or blinds at the windows\), decor, people/.test(pp) && !/One person/.test(pp), '13 place: nothing added; no people');
  // Reference view without a rug: P6 line, floor guide, no lamp.
  sc = Object.assign({}, sc, { presets: pres('Reference view', 'day'), props: [], refs: refsPlace.slice(0, 3) });
  pp = (await compile(sceneState({ scene: sc }))).dispatch.prompt;
  write('after_place_reference_day.txt', pp);
  ok(/The camera sees the product from the same side, angle and perspective as image 1/.test(pp) && /The room may stand square to the camera while the product stands at the angle image 1 shows/.test(pp) && /Framing guide: the floor meets the bottom edge of the frame/.test(pp) && /no table lamp, floor lamp or other freestanding or saleable light fitting/.test(pp) && !/turn the product only as far/.test(pp), '13 place: Reference view keeps the vendor angle (P6); floor guide; no lamp');
  // Detail view: no height, no guide (S5).
  sc = Object.assign({}, sc, { framing: { type: 'detail', text: 'Detail view.' } });
  pp = (await compile(sceneState({ scene: sc }))).dispatch.prompt;
  ok(/Camera: a close view of the named detail; level, vertical lines stay vertical/.test(pp) && !/eye height|Framing guide/.test(pp) && /no more than 7 product pieces/.test(pp), '13 place: a detail view drops the room height and the guide (S5)');
  // Raised camera for a 12-chair dining set (decision 24).
  sc = Object.assign({}, sc, { framing, presets: pres('Full frontal', 'day', { camera: { family: 'dining', height_cm: '130', guides: '' }, raised: SETTINGS.scenes.camera.raise.text }) });
  pp = (await compile(sceneState({ scene: sc }))).dispatch.prompt;
  ok(/The camera may be raised above chest height so that every piece stays countable; it stays level \(0 degrees tilt\)/.test(pp), '13 place: raised camera line when 19a sets it');
  // Person allowed and planned (decision 22).
  sc = Object.assign({}, sc, { presets: pres('Full frontal', 'day'), person: 'a woman reading in an armchair behind the sofa' });
  pp = (await compile(sceneState({ scene: sc }))).dispatch.prompt;
  ok(/One person, as planned: a woman reading in an armchair behind the sofa\. At most one natural adult, beside or behind the product, never in front of it or covering any piece, clearly secondary\./.test(pp) && /decor, other people, text/.test(pp) && /the product, the person and the listed Midas pieces/.test(pp), '13 place: one adult only when planned and allowed');
  // Side view made from the approved Full frontal, with the supplied side photo (decision 27).
  const sideRefs = [{ n: 1, role: 'vendor photo', key: 'photo' }, { n: 2, role: 'approved white master', key: 'scene_master' }, { n: 3, role: 'room', key: 'scene_room' }, { n: 4, role: 'side photo', side: 'left', key: 'left' }];
  sc = { output_id: 'view_left_side', kind: 'hero', phase: 'place', attempt: 1, shot: { frame: 'landscape, 16:9, wider than tall', plan: planOf() }, presets: pres('Left side', 'day'), framing, scale: { product: 'not confirmed' }, props: [], refs: sideRefs, person: '',
    side: { side: 'left', camera: 'Left side', photo: { key: 'left', name: 'sofa-left.jpg' } }, room: { source: 'made in stage 07', content: 'approved view', from_output: 'view_full_frontal', from_kind: 'hero', from_view: 'Full frontal', from_light: 'day', changes: ['camera'] } };
  const stSide = sceneState({ scene: sc }); stSide.outputs.push({ id: 'view_left_side', kind: 'hero', camera: 'Left side', from: 'view_full_frontal' });
  pp = (await compile(stSide)).dispatch.prompt;
  write('after_place_left_side_from_frontal.txt', pp);
  ok(/Image 4 is another vendor photo of the same product, showing its left side\. Use it for that side only/.test(pp) && /This is the Left side view\. Show the product's left side as image 4 shows it\. A surface that neither photo shows stays out of view or plain; never invent construction/.test(pp), '13 place: a side view uses the supplied photo of that side; nothing invented');
  ok(/It is the approved image of view_full_frontal of this same job/.test(pp) && /Only the camera moves, as the camera line below says/.test(pp) && /Camera: only the camera moves from image 3\. Camera view, Left side: The camera moves to the product's left side/.test(pp) && /Light: as in image 3, about 4000 K/.test(pp) && /As in the approved image: Soft morning daylight/.test(pp), '13 place: made from the approved Full frontal: only the camera moves; its light is kept');
  // Light change in a views-by-light series (camera kept).
  sc = Object.assign({}, sc, { output_id: 'night_left_side', presets: pres('Left side', 'night'), room: Object.assign({}, sc.room, { from_output: 'day_left_side', from_view: 'Left side', changes: ['light'] }) });
  const stLight = sceneState({ scene: sc }); stLight.outputs.push({ id: 'night_left_side', kind: 'hero', camera: 'Left side', light: 'night', from: 'day_left_side' });
  pp = (await compile(stLight)).dispatch.prompt;
  write('after_place_night_from_day.txt', pp);
  ok(/and the camera exactly\. Only the light changes, as the light line below says\./.test(pp) && /Light: change only the light, to about 2700 K colour temperature \(Warm evening preset\)/.test(pp) && /Camera: exactly as in image 3; the camera does not move\.$/m.test(pp) && /the windows are dark/.test(pp), '13 place: a series light change keeps the camera and changes only the light (changed 16 Oct 2026, review fixes: no \"keep the light direction\" for a night image; no raised-camera or guide text when the camera is kept)');
  const rk = (await run('16b_Review_verdict.js', { 'V1 Vault events': [{ json: Object.assign(clone(stLight), { status: 'awaiting_review' }) }], '16a Review ticket': [{ json: { rv: { ready: false, why: 'test', attempt: 1, output_id: 'night_left_side', kind: 'scene', scene: {}, framing: { type: 'hero' } } } }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(rk.status === 'hold', '16b: an unready review holds (fixture check)');

  // ---------- Independent review fixes, 16 Oct 2026 (13 Compile) ----------
  const boxedEx = clone(boxed); boxedEx.exclusions = [{ item: 'corner piece' }];
  const bpEx = (await run('13_Compile.js', { 'V1 Vault events': [{ json: boxedEx }] }, [{ json: SETTINGS }]))[0].json.s04.dispatch.prompt;
  const boxed8 = clone(boxed); boxed8.observation.pieces_seen = boxed8.observation.pieces_seen.concat([{ kind: 'ottoman', label: 'ottoman', role: 'product', box: [300, 960, 600, 1000] }]);
  const bp8 = (await run('13_Compile.js', { 'V1 Vault events': [{ json: boxed8 }] }, [{ json: SETTINGS }]))[0].json.s04;
  ok(!/from left to right/.test(bpEx) && !(bp8.dispatch && /from left to right/.test(bp8.dispatch.prompt || '')), 'review fix: no layout line when an excluded thing is among the boxes, or the boxes are more than the contract\'s pieces');
  const refs3 = refsPlace.slice(0, 3);
  const scRef = { output_id: 'view_full_frontal', kind: 'hero', phase: 'place', attempt: 1, shot: { frame: 'square, 1:1', plan: planOf({ light: 'Soft morning daylight.' }) }, presets: pres('Reference view', 'day'), framing, scale: { product: 'not confirmed' }, props: [], refs: refs3, room: { source: 'made in stage 07' }, person: '' };
  let ppR = (await compile(sceneState({ scene: scRef, observation: boxed.observation }))).dispatch.prompt;
  let ppF = (await compile(sceneState({ scene: Object.assign({}, scRef, { presets: pres('45° right', 'day') }), observation: boxed.observation }))).dispatch.prompt;
  ok(/from left to right/.test(ppR) && !/from left to right/.test(ppF), 'review fix: the layout line is given only in the Reference view, where the camera sees what image 1 shows');
  ok(/This is the 45° right view\. Show only what image 1 shows of the product\. A surface that the photos do not show stays out of view or plain; never invent construction/.test(ppF) && !/This is the Reference view view/.test(ppR), 'review fix: every camera view other than the Reference view carries the never-invent line');
  const lampSt = sceneState({ scene: scRef }); lampSt.brief.product_type = 'Table lamp'; lampSt.profile = Object.assign({}, lampSt.profile, { id: 'table-lamp', name: 'Table lamps' });
  ppR = (await compile(lampSt)).dispatch.prompt;
  ok(/no other furniture, rugs, other lamps or light fittings/.test(ppR) && /no lamp or light fitting other than the product itself/.test(ppR) && !/no table lamp, floor lamp/.test(ppR), 'review fix: a lighting product is not forbidden by its own prompt');
  const twoLamps = [{ sku: '222', name: 'TYNEXA TABLE LAMP', kind: 'table lamp', live: {} }, { sku: '333', name: 'ORLEN FLOOR LAMP', kind: 'floor lamp', live: {} }];
  ppR = (await compile(sceneState({ scene: Object.assign({}, scRef, { props: twoLamps, refs: refs3.concat([{ n: 4, role: 'Midas piece', sku: '222', key: 'p0' }, { n: 5, role: 'Midas piece', sku: '333', key: 'p1' }]) }) }))).dispatch.prompt;
  ok(/The only lamps are the Midas TYNEXA TABLE LAMP \(SKU 222\) and the Midas ORLEN FLOOR LAMP \(SKU 333\), listed above\./.test(ppR), 'review fix: every confirmed Midas lamp is named');
  ppR = (await compile(sceneState({ scene: Object.assign({}, scRef, { presets: pres('Full frontal', 'night'), room: { source: 'client room photo', key: 'room' } }) }))).dispatch.prompt;
  ok(/Light: as photographed in image 3, the client's room; light the product to match it/.test(ppR) && !/2700 K|the windows are dark/.test(ppR) && /Camera: exactly as in image 3, the client's room photo; the camera does not move\. Turn the product in the room so that this fixed camera sees it as a Full frontal view\./.test(ppR) && !/eye height/.test(ppR), 'review fix: a client room photo keeps its own camera and light');
  const oldDerived = Object.assign({}, scRef, { presets: pres('Full frontal', 'day'), room: { source: 'made in stage 07', content: 'approved view', from_output: 'wide', from_kind: 'wide' } });
  ppR = (await compile(sceneState({ scene: oldDerived }))).dispatch.prompt;
  ok(/Only the camera moves, as the camera line below says/.test(ppR) && /Camera: only the camera moves from image 3/.test(ppR) && !/Camera: exactly as in image 3/.test(ppR), 'review fix: a scene started before this build (no "changes" field) is read as a camera move, without contradiction');
  // ---------- 16a review ticket ----------
  const cand = { output_id: 'view_left_side', scene: { phase: 'place' }, link: 'https://drive.example/c', drive_file_id: 'drive-c', sha256: 'f'.repeat(64), px: '2048x1152', file_name: 'c.png' };
  const s16 = clone(stSide); s16.scene = clone(stSide.scene); s16.scene.props = [{ sku: '222', name: 'TYNEXA TABLE LAMP', kind: 'table lamp' }]; s16.scene.refs = sideRefs.concat([{ n: 5, role: 'Midas piece', sku: '222', key: 'scene_prop_0', name: 'TYNEXA' }]);
  s16.stage04 = { candidate: cand, operation: { attempt: 1 } }; s16.plan_risks = ['the corner module merges with its neighbour'];
  const N16 = { 'V1 Vault events': [{ json: s16 }], '02 Ingest files': [{ json: {}, binary: { photo: ref(MASTER), left: ref(SIDE) } }], '15m Receipt': [{ json: {}, binary: { image: ref(ROOM) } }], '19g Scene references': [{ json: {}, binary: { scene_prop_0: ref(SIDE) } }] };
  let t16 = (await run('16a_Review_ticket.js', N16))[0];
  const rv = t16.json.rv;
  ok(rv.ready && rv.binary_names === 'vendor,candidate,side,prop_0' && t16.binary.side && /Image 3 is another vendor photo of the same product, showing its left side/.test(rv.critic_text) && /Image 4 is the Midas catalogue photo of TYNEXA/.test(rv.critic_text), '16a: a side view is reviewed with the side photo as image 3; Midas photos follow');
  ok(/Known risks for this product, named by the planner before any image was made \(check each in image 2; they are not facts about image 2\): the corner module merges with its neighbour\./.test(rv.critic_text) && rv.risks.length === 1, '16a: the planner\'s risks go to the reviewer (S8)');
  ok(/- People: none\./.test(rv.critic_text) && /- Lamps: the only lamp is the Midas TYNEXA TABLE LAMP/.test(rv.critic_text) && /people_ok/.test(rv.critic_text) && /no_unplanned_lamp/.test(rv.critic_text) && /Left side: The camera moves/.test(rv.critic_text), '16a: people, lamps and the camera view are part of the order; two new checks asked');
  ok(/"box_2d": \[ymin, xmin, ymax, xmax\] in 0-1000/.test(rv.blind_text) && /counts once per module where a joint or gap between modules shows; the seat and back cushions of a sofa or chair are part of it, not separate pieces/.test(rv.blind_text) /* wording aligned with the photo reader, owner 21:28 item 6 */ && !/\b7\b/.test(rv.blind_text), '16a: the blind count gives box_2d (S6) and is told what a module is (S7), not the target');
  const s16w = clone(base); s16w.plan_risks = ['arms swapped'];
  const tw = (await run('16a_Review_ticket.js', { 'V1 Vault events': [{ json: s16w }], '02 Ingest files': [{ json: {}, binary: { photo: ref(MASTER) } }], '15m Receipt': [{ json: {}, binary: { image: ref(MASTER) } }] }))[0].json.rv;
  // Owner, 16 Oct 2026, 21:28 (item 6): the blind count gets the reader's "cropped" and "hidden" definitions and module rule; no target.
  const CROPDEF = /cropped: true only when part of the [^.]+ is cut off by the edge of the image \(the frame\)\. A part covered by another piece or object is not cropped: report it under hidden\./;
  ok(CROPDEF.test(rv.blind_text) && /hidden: one short string for each piece of the [^.]+ or part covered by another piece or object/.test(rv.blind_text) && /"hidden": \[short strings\]/.test(rv.blind_text) && !/\b7\b/.test(rv.blind_text), '16a (21:28) scene blind count: same cropped/hidden definitions as the reader, a hidden list, never the target count');
  ok(CROPDEF.test(tw.blind_text) && /hidden: one short string for each product piece or part covered/.test(tw.blind_text) && /"hidden": \[short strings\]/.test(tw.blind_text) && /the seat and back cushions of a sofa or chair are part of it, not separate pieces/.test(tw.blind_text) && !new RegExp('\\b' + tw.total + '\\b').test(tw.blind_text.replace(/0-1000/g, '')), '16a (21:28) white blind count: same definitions and module rule, never the target count');
  // Independent review fixes, 16 Oct 2026 (16a).
  const s16L = clone(s16); s16L.brief.product_type = 'Table lamp'; s16L.profile = Object.assign({}, s16L.profile, { id: 'table-lamp' }); s16L.scene.props = []; s16L.scene.refs = sideRefs; s16L.scene.presets = pres('Left side', 'night');
  const rvL = (await run('16a_Review_ticket.js', Object.assign({}, N16, { 'V1 Vault events': [{ json: s16L }] })))[0].json.rv;
  ok(/- Lamps: the only lamp is the product itself\./.test(rvL.critic_text) && /from the built-in light; the windows are dark\./.test(rvL.critic_text), 'review fix 16a: a lighting product is not an unplanned lamp; a night image is reviewed with dark windows');
  const s16c = clone(s16w); s16c.inventory = [{ item: 'square cushion', count: 4 }];
  const rvC = (await run('16a_Review_ticket.js', { 'V1 Vault events': [{ json: s16c }], '02 Ingest files': [{ json: {}, binary: { photo: ref(MASTER) } }], '15m Receipt': [{ json: {}, binary: { image: ref(MASTER) } }] }))[0].json.rv;
  ok(/Count each cushion or pillow of the product as one piece\./.test(rvC.blind_text) && !/cushions are not pieces|cushions that only sit on the product are not pieces/i.test(rvC.blind_text), 'review fix 16a: a cushion product\'s blind count is not told that cushions are not pieces');
  ok(/Known risks .*arms swapped/.test(tw.critic_text) && /"box_2d"/.test(tw.blind_text) && /once per module/.test(tw.blind_text) && !/\n\n/.test(tw.critic_text), '16a white: risks, box_2d and the module line too');

  // ---------- 16b review verdict ----------
  const KEYS = ['piece_count', 'pieces_match', 'shape', 'colour', 'material_texture', 'details', 'handedness', 'not_mirrored', 'nothing_added', 'excluded_absent', 'only_listed_props', 'midas_pieces_match', 'people_ok', 'no_unplanned_lamp', 'scale', 'grounding', 'framing', 'camera_level', 'light', 'no_text_or_logo', 'realism'];
  const critic = over => ({ checks: Object.assign(Object.fromEntries(KEYS.map(k => [k, { result: 'pass', evidence: 'ok', seen: k === 'piece_count' ? 7 : undefined }])), over || {}), defects: [], scores: { fidelity: 88, integrity: 90, drift: 10, data_loss: 5 }, summary: 'fine' });
  const rvS = { ready: true, attempt: 1, output_id: 'view_left_side', total: 7, kind: 'scene', scene: { output_id: 'view_left_side', kind: 'hero', framing: 'hero', props: [] }, framing: { type: 'hero', band_pct: [60, 70] }, candidate: cand };
  const st16 = clone(stSide); st16.status = 'awaiting_review';
  st16.outputs = st16.outputs.filter(o => o.id !== 'view_left_side').concat([{ id: 'view_left_side', kind: 'hero', camera: 'Left side', from: 'view_full_frontal', series: { name: 'three_views', label: 'Three views', k: 2, n: 3 } }, { id: 'view_45_right', kind: 'hero', camera: '45° right', from: 'view_full_frontal', series: { name: 'three_views', label: 'Three views', k: 3, n: 3 } }]);
  st16.outputs.find(o => o.id === 'view_full_frontal').series = { name: 'three_views', label: 'Three views', k: 1, n: 3 };
  st16.scenes = { queue: ['view_full_frontal', 'view_left_side', 'view_45_right'], done: { view_full_frontal: { by: 'owner', candidate: { link: 'https://drive.example/ff' } } }, held: {}, log: [] };
  const verdict = async (crit, blind) => (await run('16b_Review_verdict.js', { 'V1 Vault events': [{ json: st16 }], '16a Review ticket': [{ json: { rv: rvS } }], '16 Critic review': [{ json: { text: JSON.stringify(crit) } }], '16x Blind count': [{ json: { text: JSON.stringify(blind) } }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  let v = await verdict(critic(), { total: 7, box_2d: [200, 150, 800, 800], text_or_logo: false, cropped: false });
  ok(v.review.result === 'passed' && v.review.framing.measured_share_pct === 65 && /box_2d, 0-1000/.test(v.review.framing.source) && v.review.framing.within === true, '16b: box_2d [200,150,800,800] → 65% of the width, within 60-70% (S6)');
  ok(v.status === 'awaiting_go_2' && /^go 2: approve this scene view_left_side/.test(v.go2.decision_needed) && v.go2.shown_together.length === 3 && v.go2.shown_together.find(x => x.output_id === 'view_full_frontal').status === 'approved by the owner' && v.go2.shown_together.find(x => x.output_id === 'view_left_side').status === 'this image: waiting for your go 2' && v.go2.shown_together.find(x => x.output_id === 'view_full_frontal').link === 'https://drive.example/ff' && v.go2.shown_together.find(x => x.output_id === 'view_45_right').status === 'not made yet', '16b: each scene keeps its own go 2; the series is shown together (decision 29, revised)');
  // 16 Oct 2026 (this build): the series list shows a held image with its reason, as the go 2 ticket must.
  st16.scenes.held = { view_45_right: { at: 'x', why: 'no supplied photo shows the product\'s right side' } };
  v = await verdict(critic(), { total: 7, box_2d: [200, 150, 800, 800] });
  ok(/^held: no supplied photo shows the product's right side/.test(v.go2.shown_together.find(x => x.output_id === 'view_45_right').status) && v.go2.label === 'Generated image. Candidate: reviewed, not approved.', '16b: the go 2 ticket lists a held series image with its reason (decision 29)');
  st16.scenes.held = {};
  // Owner, 16 Oct 2026, 21:28 (item 5): a level tabletop camera is what the reviewer checks in the Reference view.
  const s16T = clone(s16L); s16T.scene.presets = Object.assign({}, s16T.scene.presets, { view: 'Reference view', camera: { family: 'tabletop or lamp', tilt_deg: 0, height_rule: 'level' } });
  const rvT = (await run('16a_Review_ticket.js', Object.assign({}, N16, { 'V1 Vault events': [{ json: s16T }] })))[0].json.rv;
  ok(/- Camera: the product seen from the same side as image 1, with a level camera \(0 degrees tilt/.test(rvT.critic_text), '16a (21:28): the reviewer checks a level camera for a tabletop product in the Reference view', (rvT.critic_text.match(/- Camera:[^\n]*/) || [''])[0]);
  // Owner, 16 Oct 2026, 21:28 (item 6): the blind count's hidden list is kept in the review's crop record; it is not a crop.
  v = await verdict(critic(), { total: 7, box_2d: [200, 150, 800, 800], cropped: false, hidden: ['two chairs partly behind the table'] });
  ok(v.review.crop && v.review.crop.cut_off === false && v.review.crop.hidden[0] === 'two chairs partly behind the table' && v.review.result === 'passed', '16b (21:28): a hidden piece is recorded under hidden and is not a crop');
  // Independent review fix, 16 Oct 2026 (16b): images certain to be held say so on the go 2 list.
  const st16b = clone(st16); st16b.side_views = [{ output_id: 'view_left_side', camera: 'Left side', side: 'left', photo: null }];
  st16b.outputs.push({ id: 'night_left_side', kind: 'hero', camera: 'Left side', light: 'night', from: 'view_left_side', series: { name: 'three_views', label: 'Three views', k: 4, n: 4 } }); st16b.outputs.push({ id: 'chain_test', kind: 'hero', camera: 'Full frontal', light: 'night', from: 'view_left_side', series: { name: 'three_views', label: 'Three views', k: 5, n: 5 } });
  const rvF = Object.assign({}, rvS, { output_id: 'view_full_frontal' });
  st16b.scenes.done = {};
  const v16b = (await run('16b_Review_verdict.js', { 'V1 Vault events': [{ json: st16b }], '16a Review ticket': [{ json: { rv: rvF } }], '16 Critic review': [{ json: { text: JSON.stringify(critic()) } }], '16x Blind count': [{ json: { text: JSON.stringify({ total: 7, box_2d: [200, 150, 800, 800] }) } }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  const lst = Object.fromEntries(((v16b.go2 && v16b.go2.shown_together) || []).map(x => [x.output_id, x.status]));
  ok(/^will be held: no supplied photo shows the product's left side/.test(lst.view_left_side) && /^will be held: no supplied photo shows the product's left side/.test(lst.night_left_side) && /^will be held: it is made from view_left_side, which is held/.test(lst.chain_test) && lst.view_45_right === 'not made yet', 'review fix 16b: the go 2 list says which images will be held, and why');
  v = await verdict(critic(), { total: 7, box: { left: 20, top: 10, right: 82, bottom: 90 }, text_or_logo: false, cropped: false });
  ok(v.review.framing.measured_share_pct === 62 && !/box_2d/.test(v.review.framing.source), '16b: the old percentage box is still read when box_2d is missing');
  v = await verdict(critic({ people_ok: { result: 'fail', evidence: 'a man stands in front of the sofa' }, no_unplanned_lamp: { result: 'fail', evidence: 'a floor lamp beside the sofa' } }), { total: 7, box_2d: [200, 150, 800, 800] });
  ok(v.review.result === 'failed' && v.review.defects.some(d => d.check === 'people_ok') && v.review.defects.some(d => d.check === 'no_unplanned_lamp' && /no lamp except a listed Midas lamp/.test(d.name)), '16b: a person in front, or an unplanned lamp, fails the image (decisions 22, 23)');
  ok(v.go2_proposed_repair && v.go2_proposed_repair.preserve.some(x => /only the camera differs/.test(x)), '16b: the repair keeps the room, the pieces and the light of the approved image');
  const stL = clone(st16); stL.scene = clone(stLight.scene);
  const vL = (await run('16b_Review_verdict.js', { 'V1 Vault events': [{ json: stL }], '16a Review ticket': [{ json: { rv: Object.assign({}, rvS, { output_id: 'night_left_side' }) } }], '16 Critic review': [{ json: { text: JSON.stringify(critic({ light: { result: 'fail', evidence: 'too bright' } })) } }], '16x Blind count': [{ json: { text: JSON.stringify({ total: 7 }) } }], '04 Settings': [{ json: SETTINGS }] }))[0].json;
  ok(vL.go2_proposed_repair.preserve.some(x => /and the camera of the approved image of day_left_side .* only the light differs/.test(x)), '16b: a light-change image\'s repair keeps the camera; only the light differs');

  // ---------- 19a scene ticket: series, presets, side gate ----------
  function packaged(over) {
    const s = clone(base);
    s.retrieval = { shortlist: [], rejected: [], max_midas: 0, notes: [] };
    s.status = 'white_package_ready'; s.stage = '06 Package';
    s.go1_last = { decision: 'go', by: 'owner' };
    s.approved = { output_id: 'white_master', attempt: 1, by: 'owner', candidate: { sha256: sha(MASTER), drive_file_id: 'drive-master', file_name: 'x.png' } };
    s.brief.preferences = { lighting: '', people: 'none' };
    const outs = [['day_full_frontal', 'Full frontal', 'day', ''], ['day_left_side', 'Left side', 'day', 'day_full_frontal'], ['day_45_right', '45° right', 'day', 'day_full_frontal'], ['night_full_frontal', 'Full frontal', 'night', 'day_full_frontal'], ['night_left_side', 'Left side', 'night', 'day_left_side']];
    s.outputs = s.outputs.concat(outs.map(([id, c, l, f], i) => ({ id, kind: 'hero', camera: c, light: l, light_label: l === 'day' ? 'Daylight' : 'Warm evening', from: f, series: { name: 'views_by_light', label: 'Views by light', k: i + 1, n: 9 } })));
    s.shots = s.shots.concat(outs.map(([id], i) => ({ n: i + 2, output_id: id, kind: 'hero', frame: 'square, 1:1', plan: planOf({ output_id: id, person: 'a man' }) })));
    s.side_views = [{ output_id: 'day_left_side', camera: 'Left side', side: 'left', photo: null }, { output_id: 'night_left_side', camera: 'Left side', side: 'left', photo: null }];
    return Object.assign(s, over || {});
  }
  const t19a = async st => (await run('19a_Scene_ticket.js', Object.assign({ 'V1 Vault events': [{ json: st }] }, SET)))[0].json;
  let a = await t19a(packaged());
  ok(a.scene.output_id === 'day_full_frontal' && a.scene.phase === 'room' && a.scene.presets.view === 'Full frontal' && a.scene.presets.light.preset === 'day' && a.scenes.queue.join() === 'day_full_frontal,day_left_side,day_45_right,night_full_frontal,night_left_side', '19a: the series base goes first with its own room; queue in series order');
  ok(a.scene.person === undefined || a.scene.person === '', '19a: no person when the brief allows none');
  const after1 = clone(a); after1.status = 'scene_files_ready'; after1.scenes.done.day_full_frontal = { by: 'owner', candidate: { sha256: 'a'.repeat(64), drive_file_id: 'd1', link: 'l', file_name: 'ff.png' }, props: [], files: { status: 'ready', files: [] } };
  a = await t19a(after1);
  ok(a.scene.output_id === 'day_45_right' && a.scenes.held.day_left_side && /no supplied photo shows the product's left side/.test(a.scenes.held.day_left_side.why) && a.scene.room.content === 'approved view' && a.scene.room.from_output === 'day_full_frontal' && a.scene.room.changes.join() === 'camera' && a.scene.phase === 'place', '19a: Left side without a photo is held; 45° right is made from the approved Full frontal, camera only');
  const after2 = clone(a); after2.status = 'scene_files_ready'; after2.scenes.done.day_45_right = { by: 'owner', candidate: { sha256: 'b'.repeat(64), drive_file_id: 'd2', link: 'l2', file_name: 'r.png' }, props: [], files: { status: 'ready', files: [] } };
  a = await t19a(after2);
  ok(a.scene.output_id === 'night_full_frontal' && a.scene.room.from_output === 'day_full_frontal' && a.scene.room.changes.join() === 'light' && a.scene.presets.light.preset === 'night' && a.scene.presets.light.kelvin === 2700, '19a: Warm evening Full frontal is made from the Daylight one: only the light changes');
  const after3 = clone(a); after3.status = 'scene_files_ready'; after3.scenes.done.night_full_frontal = { by: 'owner', candidate: { sha256: 'c'.repeat(64), drive_file_id: 'd3', link: 'l3', file_name: 'n.png' }, props: [], files: { status: 'ready', files: [{ format: 'jpg', px: '1125x1125' }] } };
  a = await t19a(after3);
  ok(a.status === 'hold' && a.scenes.held.night_left_side && /made from day_left_side, which is held/.test(a.scenes.held.night_left_side.why) && /2 scene image\(s\) were held and not made/.test(a.hold_reason) && /The scene package is incomplete/.test(a.hold_reason) && a.hold_step === 19, '19a: an image made from a held image is held too; the run ends incomplete, never complete');
  // 16 Oct 2026 (this build): an image whose camera and light both differ from the approved image it is made from is held, never guessed.
  const both = clone(after2); both.outputs.find(o => o.id === 'night_full_frontal').from = 'day_45_right';
  a = await t19a(both);
  ok(a.status === 'hold' && /both its camera view \(45° right to Full frontal\) and its light \(Daylight to Warm evening\) differ/.test(a.hold_reason) && !a.scenes.log.some(x => x.output_id === 'night_full_frontal' && x.event === 'scene started'), '19a: camera and light both changed from the source image → held, not started');
  // Independent review fix, 16 Oct 2026 (19a): with the client's room photo, a series image that changes the light is held; the queue continues.
  const rl = packaged(); rl.room_key = 'room'; rl.outputs = rl.outputs.map(o => o.series ? Object.assign({}, o, { mode: 'room_locked' }) : o);
  const rl1 = clone(await t19a(rl)); rl1.status = 'scene_files_ready'; rl1.scenes.done.day_full_frontal = after1.scenes.done.day_full_frontal; rl1.scenes.done.day_45_right = after2.scenes.done.day_45_right;
  a = await t19a(rl1);
  ok(a.scenes.held.night_full_frontal && /client's room photo, which keeps the light it was photographed in, so the Warm evening version cannot be made/.test(a.scenes.held.night_full_frontal.why) && a.status === 'hold' && /The scene package is incomplete/.test(a.hold_reason), 'review fix 19a: a light change in the client\'s room photo is held with its reason; the package stays incomplete');
  const withPhoto = packaged({ side_views: [{ output_id: 'day_left_side', camera: 'Left side', side: 'left', photo: { key: 'left', name: 'sofa-left.jpg', sha256: sha(SIDE) } }, { output_id: 'night_left_side', camera: 'Left side', side: 'left', photo: { key: 'left', name: 'sofa-left.jpg', sha256: sha(SIDE) } }] });
  const wp1 = clone(await t19a(withPhoto)); wp1.status = 'scene_files_ready'; wp1.scenes.done.day_full_frontal = after1.scenes.done.day_full_frontal;
  a = await t19a(wp1);
  ok(a.scene.output_id === 'day_left_side' && a.scene.side && a.scene.side.photo.key === 'left' && !Object.keys(a.scenes.held).length, '19a: with a supplied photo of the left side, the Left side view is made');
  const dining = packaged(); dining.profile = { id: 'dining', name: 'Dining sets' }; dining.inventory = [{ item: 'table', count: 1 }, { item: 'chair', count: 12 }];
  a = await t19a(dining);
  ok(a.scene.presets.camera.family === 'dining' && /may be raised/.test(a.scene.presets.raised), '19a: a 13-piece dining set with a Full frontal view gets the raised, level camera');
  const ppl = packaged(); ppl.brief.preferences.people = 'one';
  const pp1 = clone(await t19a(ppl)); pp1.status = 'scene_room_ready'; pp1.stage04 = { candidate: { output_id: 'day_full_frontal_room', drive_file_id: 'r', sha256: sha(ROOM), file_name: 'r.jpg' } };
  a = await t19a(pp1);
  ok(a.scene.phase === 'place' && a.scene.person === 'a man', '19a: the planned person is kept when the brief allows one');
  const lifestyle = clone(base); Object.assign(lifestyle, packaged()); lifestyle.outputs = lifestyle.outputs.slice(0, 1).concat([{ id: 'wide', kind: 'wide', camera: 'Reference view', light: 'warm' }, { id: 'hero', kind: 'hero', camera: 'Reference view', light: 'warm' }]);
  lifestyle.shots = lifestyle.shots.slice(0, 1).concat([{ n: 2, output_id: 'wide', kind: 'wide', frame: 'square, 1:1', plan: planOf() }, { n: 3, output_id: 'hero', kind: 'hero', frame: 'square, 1:1', plan: planOf() }]); lifestyle.side_views = [];
  a = await t19a(lifestyle);
  ok(a.scene.output_id === 'wide' && a.scene.presets.light.preset === 'warm' && a.scene.presets.view === 'Reference view', '19a: lifestyle views still start with the widest; the fixed preset is used');

  // ---------- 19c: lamps need "in stock" (decision 23) ----------
  const placeSt = { status: 'scene_preparing', scene: { output_id: 'x', phase: 'place', props: [{ sku: '1', name: 'TYNEXA', kind: 'table lamp', url: 'https://midasfurniture.com/en/a.html' }, { sku: '2', name: 'FERNLAY', kind: 'side table', url: 'https://midasfurniture.com/en/b.html' }], props_left_out: [] }, trail: [] };
  const list19 = [{ json: { i: 0, sku: '1', url: 'https://midasfurniture.com/en/a.html' } }, { json: { i: 1, sku: '2', url: 'https://midasfurniture.com/en/b.html' } }];
  const preorder = '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/PreOrder"}}</script>';
  const v19 = (await run('19c_Prop_verdict.js', { '19a Scene ticket': [{ json: placeSt }], '19b0 Prop page list': list19 }, [{ json: { statusCode: 200, body: preorder } }, { json: { statusCode: 200, body: preorder } }]))[0].json;
  ok(v19.scene.props.length === 0 && v19.scene.props_left_out.some(x => x.sku === '1' && /a lamp appears only when its Midas page says in stock/.test(x.why)) && v19.scene.props_left_out.some(x => x.sku === '2' && /pre-order today; only pieces in stock are used/.test(x.why)), '19c: a pre-order lamp and a pre-order side table are both left out (owner D10: in stock only)');

  // ---------- 19g: the side photo is sent with a side view ----------
  const st19g = { status: 'scene_preparing', product_key: 'photo', references: [{ key: 'photo', name: 'sofa.png', sha256: 'p', image: true, mime: 'image/png', bytes: 10 }, { key: 'left', name: 'sofa-left.jpg', sha256: sha(SIDE), image: true, mime: 'image/jpeg', bytes: SIDE.length }],
    approved: { candidate: { file_name: 'm.png' } }, scenes: { current: null }, scene: { output_id: 'view_left_side', phase: 'place', props: [], props_left_out: [], side: { side: 'left', camera: 'Left side', photo: { key: 'left', name: 'sofa-left.jpg', sha256: sha(SIDE) } }, room: { source: 'made in stage 07', content: 'approved view' }, base_props: [] }, trail: [] };
  const N19 = Object.assign({}, SET, { '19c Prop verdict': [{ json: st19g }], '19d2 Master check': [{ json: { master: { ok: true, mime: 'image/png', bytes: MASTER.length, sha256: sha(MASTER) } } }], '19e2 Room check': [{ json: { room: { ok: true, key: 'scene_room', name: 'r.jpg', mime: 'image/jpeg', bytes: ROOM.length, sha256: sha(ROOM) } } }], '19f2 Photo check': [{ json: { photos: [] } }], '19f0 Photo list': [{ json: { none: true } }],
    '19d Download master': [{ json: {}, binary: { data: ref(MASTER) } }], '19e Download room': [{ json: {}, binary: { data: ref(ROOM) } }], '19f Prop photos': [] });
  let g = (await run('19g_Scene_references.js', N19, [{ json: {} }]))[0];
  ok(g.json.status === 'scene_due' && g.json.scene.refs.map(x => x.role).join('|') === 'vendor photo|approved white master|room|side photo' && g.json.scene.refs[3].n === 4 && g.json.scene.refs[3].side === 'left', '19g: a side view sends the supplied photo of that side as image 4');
  const st19x = clone(st19g); st19x.references = st19x.references.filter(r => r.key !== 'left');
  g = (await run('19g_Scene_references.js', Object.assign({}, N19, { '19c Prop verdict': [{ json: st19x }] }), [{ json: {} }]))[0];
  ok(g.json.status === 'hold' && /not available with the checksum recorded at go 1/.test(g.json.hold_reason), '19g: the side photo missing → hold, nothing made');

  // ---------- Go 1: person and room edits; no generic props ----------
  const s12g = clone(g12); s12g.go1_token = 'tok'; s12g.go1_rounds = 0; s12g.people_max = 0;
  const go1 = (await run('G1_Go_1_verdict.js', { '12 Who leads the scene': [{ json: s12g }] }, [{ json: { body: { decision: 'change', go1_token: 'tok', run_id: s12g.run_id, round: 0, changes: [{ shot: 2, person: 'a woman', room: { zone: 'by the window' }, supporting_props: ['a vase'] }] } } }]))[0].json;
  const sh2 = go1.shots.find(x => x.n === 2);
  ok(go1.go1_route === 'recheck' && sh2.plan.person === '' && sh2.plan.room.zone === 'by the window' && go1.go1_last.changes.some(c => /supporting_props ignored/.test(c.result)), 'G1: room and person edits applied (person only when allowed); generic props ignored');
  const g1b = fs.readFileSync(path.join(NODES, 'G1b_Decision_check.js'), 'utf8');
  ok(/'person', 'room', 'midas_pieces'/.test(g1b) && !/accept_inferred_sides/.test(g1b) && !/go 3|go3|awaiting_go_3/.test(g1b), 'G1b: person and room can be edited; no inferred-sides answer; no go 3');

  // ---------- Model prompts (11 and 11c) kept in the repo ----------
  const p11 = fs.readFileSync(path.join(ROOT, 'n8n', 'claude-midas-a7', 'model-prompts', '11_Stylist_instructions.txt'), 'utf8');
  const p11c = fs.readFileSync(path.join(ROOT, 'n8n', 'claude-midas-a7', 'model-prompts', '11c_Plan_critic_system.txt'), 'utf8');
  ok(!/a few generic supporting props/.test(p11) && /supporting_props is always an empty array/.test(p11) && /room \(object with walls, floor, windows and zone/.test(p11) && /person \(one short sentence, or an empty string\)/.test(p11) && !/front three-quarter view when the vendor photo gives no clear single angle/.test(p11) && /A Left side or Right side camera view is made only when a supplied photo shows that side/.test(p11), '11: the stylist plans Midas pieces only, the room fields and a person field; white at the vendor angle (P3)');
  ok(/when the light contradicts the fixed light preset/.test(p11c) && /when the plan lists any generic prop/.test(p11c) && /depends on a lamp that is not a planned Midas lamp/.test(p11c) && /rewrite is an object with room, setting, light, camera, presentation, person/.test(p11c), '11c: the plan critic checks presets, generic props, lamps and the new fields');
  const runtimeSources = (fs.readdirSync(NODES).map(f => fs.readFileSync(path.join(NODES, f), 'utf8')).join('\n') + p11 + p11c).replaceAll('Existing Go1 and Go2; no new Go3', 'Existing Go1 and Go2 only');
  ok(!/go 3|go3|awaiting_go_3|accept_inferred_sides/i.test(runtimeSources), 'no third gate or inferred-side acceptance; the explicit provenance ban is permitted');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e && e.stack); process.exit(1); });
