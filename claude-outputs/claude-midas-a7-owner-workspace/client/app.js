/* Midas owner studio: the "client first page" experience, connected (Claude-final-midas-a7).
   Revised 18 Oct 2026 to the full first-page guide (Midas Furniture Studio guide, "Options & workflows"): every option can be chosen.
   Flow: Projects or Manual -> The Job / Project -> The Item (one or several items) -> Scope -> Preferences -> Suggestions -> Review
   -> save one project version per item -> store its references privately -> the backend's own cost estimate -> the owner confirms
   -> send each item once -> plan and image decisions -> result.
   Options A7 records but does not apply yet are marked "Recorded · not applied by A7 yet" and are listed in the review; A7 lists them
   back itself under "not applied". It talks only to this site's /api/owner/* (same origin; the server checks the owner session). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const LINK = window.MIDAS_OWNER_LINK;
  const TAX = window.MIDAS_TAXONOMY || { nodes: [] };
  const MAX_BYTES = 3 * 1024 * 1024, MAX_REFS = 12, MAX_ITEMS = 10;
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const PICK_EXTRA = ['image/heic', 'image/heif', 'image/avif', '.heic', '.heif'];   // offered in the picker; converted before saving
  const SPEC_TYPES = ['text/plain', 'text/csv', 'application/json', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const INSTRUCTION_LIMIT = 1200, KEEP_PREFIX = 'Details to keep exactly as in the vendor photo: ';
  const POLL = { firstMs: 15000, everyMs: 15000, maxFailures: 3 };
  const DRAFT_KEY = 'midas.owner.cf.draft.v2', RUNS_KEY = 'midas.a7owner.runs';
  const REC = 'Recorded · not applied by A7 yet';

  /* ------------------------------------------------------------------ options (the guide's own names) */
  const ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><path d="M3.5 11h17"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9Z"/><path d="M19 3.5v3M17.5 5h3"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };
  const JOBS = [['new', 'New Project', ICON.plus], ['edit', 'Edit', ICON.folder], ['single', 'Single item', ICON.spark]];
  const STARTS = [
    ['product_collection', 'Product or collection', 'One product, several products or a complete set'],
    ['existing_room', 'Existing room', 'Furnish, replace or restyle'],
    ['new_space', 'New styled space', 'Create a complete room'],
    ['saved_project', 'Saved project', 'Continue an existing direction']
  ];
  const REF_TYPES = [['product', 'Product / vendor reference'], ['room', 'Room / target space'], ['look', 'Inspiration / look'],
    ['previous', 'Previous result'], ['other_view', 'Other views / pieces'], ['spec', 'Specifications / Excel']];
  // [id, guide name (sent to A7), description]
  const OUTCOMES = [
    ['white', 'White BK', 'Clean catalogue imagery'], ['lifestyle', 'Lifestyle', 'The item in a styled setting'],
    ['website', 'Website', 'A complete product image set'], ['composition', 'New Composition', 'Arrange a coordinated space'],
    ['variations', 'Variations', 'Explore light, style and views'], ['anchor', 'Create with this item', 'Let this item lead the design'],
    ['others', 'Others', 'Describe a different outcome']
  ];
  const VIEWS = ['Category template', 'Wide view', 'Close-up', 'Wide view + close-up'];
  const VIEW_IMAGES = { 'Category template': ['hero'], 'Wide view': ['wide'], 'Close-up': ['detail'], 'Wide view + close-up': ['wide', 'detail'] };
  const ASPECTS = [['standard', 'Standard for category (1:1)'], ['1:1', 'Square · 1:1'], ['4:5', 'Portrait · 4:5'], ['5:4', 'Landscape · 5:4'], ['3:4', 'Portrait · 3:4'],
    ['4:3', 'Landscape · 4:3'], ['2:3', 'Portrait · 2:3'], ['3:2', 'Landscape · 3:2'], ['16:9', 'Wide · 16:9'], ['9:16', 'Tall · 9:16']];
  const RESOLUTIONS = [['2K', 'Standard for category (2K)'], ['4K', '4K']];
  const CAMERAS = ['Reference view', 'Full frontal', 'Left side', '45° right', 'Right side'];
  const SERIES = [['Single image', 'Single image per view'], ['Three views', 'Three views (front, left, 45° right)'], ['Views by light', 'Views by light (3 views × 3 lights)']];
  const AXES = ['Lighting', 'Style', 'Camera view'];
  const LIGHTS = ['Soft daylight', 'Golden afternoon', 'Warm evening'];
  const WALLS = [['White', '#eeeae3'], ['Ivory', '#e7ddc8'], ['Sand', '#cfb996'], ['Greige', '#b7aea1'], ['Taupe', '#938074'], ['Sage', '#a3ad91'], ['Charcoal', '#575652'], ['Terracotta', '#b4745d']];
  const FLOORS = ['Light oak', 'Dark walnut', 'Limestone', 'Marble'];
  const MOODS = ['Automatic', 'Calm & natural', 'Warm & inviting', 'Refined & elegant', 'Bold & expressive'];
  const RETAIN = ['Space', 'Look', 'Space and look'];
  const STRENGTHS = [['fidelity', 'Fidelity'], ['styling', 'Styling'], ['clutter', 'Cluttering']];
  const NAMES = { catalogue: 'White catalogue image', hero: 'Hero scene', wide: 'Wide scene', detail: 'Close-up scene', composition: 'New composition', scene: 'Scene with this item' };
  const LIGHT_KEY = { 'Soft daylight': 'day', 'Golden afternoon': 'warm', 'Warm evening': 'night' };
  const nameOfImage = r => NAMES[r.role] || r.label || r.role;

  /* ------------------------------------------------------------------ state */
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  const newItem = () => ({ key: uuid(), name: '', department: '', category: '', subCategory: '', pieces: [{ count: 1, item: '' }], sku: '', dimensions: '', color: '', material: '', description: '', catalogue: '' });
  const blank = () => ({
    mode: 'manual', stage: 'job', job: 'new', workOn: 'one_by_one', role: 'hero', start: 'product_collection', editFrom: 'saved', parentId: '', roomBrief: '',
    refType: 'product', items: [newItem()], active: 0, showCatalogue: false,
    outcomes: ['lifestyle'], other: '', view: 'Category template', aspect: 'standard', resolution: '2K', camera: 'Reference view', series: 'Single image', varCount: '2', varAxes: [],
    lighting: '', wall: '', floor: '', defaults: false, human: false, plants: false, mood: 'Automatic',
    picks: '', links: '', includeMeta: true, whiteMaster: true, prevUse: '', strengths: { fidelity: null, styling: null, clutter: null }, reviewFirst: 'share_first', grounding: false,
    instructions: '', locks: '', mustNot: '', budget: '5'
  });
  let s = blank();
  const files = [];               // { file, role, url, item } — never stored in the browser
  let ids = {}, sending = false, saved = [], me = null;
  let run = null;                 // the request being followed
  const watch = { timer: 0, failures: 0, token: 0 };

  /* ------------------------------------------------------------------ small helpers */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const k of kids) if (k !== null && k !== undefined && k !== false) n.append(k);
    return n;
  }
  const show = (n, on) => { n.hidden = !on; };
  function announce(text) { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = text; }, 50); }
  const read = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
  const lines = t => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const squash = (t, n) => String(t || '').replace(/[\u0000-\u001f]/g, ' ').split(' ').filter(Boolean).join(' ').slice(0, n);
  const money = v => (Number.isFinite(Number(v)) ? 'USD ' + Number(v).toFixed(3) : '—');
  const when = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', dateStyle: 'medium', timeStyle: 'short' }).format(d); };
  const rec = () => el('b', { class: 'cf-rec', text: REC });
  const pill = (label, on, onclick, extra) => el('button', Object.assign({ type: 'button', 'aria-pressed': String(!!on), onclick }, extra || {}), label);

  async function call(url, o) {
    o = o || {};
    const init = { method: o.method || 'GET', cache: 'no-store', credentials: 'same-origin', headers: {} };
    if (o.json !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.json); } else if (o.body) init.body = o.body;
    try { init.signal = AbortSignal.timeout(init.method === 'POST' ? 60000 : 20000); } catch (e) { /* older browser */ }
    let r; try { r = await fetch(url, init); } catch (e) { return { network: true, ok: false, status: 0, data: {} }; }
    let d = null; try { d = await r.json(); } catch (e) { d = null; }
    if (r.status === 401) { location.replace('/'); }
    return { ok: r.ok, status: r.status, data: d && typeof d === 'object' ? d : {} };
  }
  const why = r => (r && r.data && (r.data.message || r.data.error)) ? String(r.data.message || r.data.error) : (r && r.network ? 'The connection failed.' : 'Unknown error.');

  /* ------------------------------------------------------------------ taxonomy */
  const cats = TAX.nodes.filter(n => n.kind === 'category'), byId = new Map(cats.map(n => [n.id, n]));
  const nameOf = id => (byId.get(id) || {}).name || '';
  const isUnder = (n, anc) => { let p = n.parentId; while (p) { if (p === anc) return true; p = (byId.get(p) || {}).parentId || ''; } return false; };
  function pathLabel(n, root) { const parts = [n.name]; let p = n.parentId; while (p && p !== root) { const a = byId.get(p); if (!a) break; parts.unshift(a.name); p = a.parentId; } return parts.join(' / '); }
  function fill(sel, pairs, value) { sel.replaceChildren(...pairs.map(([v, t]) => el('option', { value: v, text: t }))); sel.value = pairs.some(([v]) => v === value) ? value : pairs[0][0]; }
  function fillCategories(it) {
    const auto = [['', 'Automatic from references']];
    fill($('department'), auto.concat(cats.filter(n => !n.parentId).map(n => [n.id, n.name])), it.department);
    it.department = $('department').value;
    const kids = cats.filter(n => it.department && n.parentId === it.department);
    if (!kids.some(n => n.id === it.category)) it.category = '';
    fill($('category'), auto.concat(kids.map(n => [n.id, n.name])), it.category); $('category').disabled = !kids.length;
    const subs = cats.filter(n => it.category && isUnder(n, it.category));
    if (!subs.some(n => n.id === it.subCategory)) it.subCategory = '';
    fill($('sub-category'), auto.concat(subs.map(n => [n.id, pathLabel(n, it.category)])), it.subCategory); $('sub-category').disabled = !subs.length;
  }

  /* ------------------------------------------------------------------ derived values */
  const item = () => s.items[s.active] || s.items[0];
  const has = id => s.outcomes.includes(id);
  const life = () => has('lifestyle');
  // White catalogue image on demand (owner, 20 Oct 2026): White BK and Website always make it; a Lifestyle job may leave it out.
  const whiteOptional = () => life() && !has('white') && !has('website');
  const whiteOff = () => whiteOptional() && s.whiteMaster === false;
  const scene = () => s.outcomes.some(o => !['white', 'others'].includes(o));   // any outcome that makes a scene image
  const guideOutcomes = () => OUTCOMES.filter(o => o[0] !== 'others' && has(o[0])).map(o => o[1]);
  const stages = () => (s.mode === 'projects' ? [['project', 'Project'], ['item', 'The Item'], ['scope', 'Scope']]
    : [['job', 'The Job'], ['item', 'The Item'], ['scope', 'Scope'], ['preferences', 'Preferences'], ['suggestions', 'Suggestions']]);
  const isEdit = () => (s.mode === 'manual' && s.job === 'edit') || (s.mode === 'projects' && s.start === 'saved_project');
  const fromSaved = () => isEdit() && (s.mode === 'projects' || s.editFrom === 'saved');
  const multi = () => (s.mode === 'manual' && s.job === 'new' && s.workOn === 'batch') || (s.mode === 'projects' && s.start === 'product_collection');
  const useDefaults = () => s.mode === 'projects' || s.defaults;
  const parent = () => saved.find(v => v.version_id === s.parentId) || null;
  const parentSent = () => { const p = parent(); return !!(p && (p.run_id || p.client_run_id)); };
  const itemRole = () => (s.mode === 'manual' && s.job === 'single' ? s.role : 'hero');
  const filesOf = it => files.filter(f => f.item === it.key);
  const validPieces = it => it.pieces.map(p => ({ count: Number(p.count), item: squash(p.item, 60) })).filter(p => p.item && Number.isInteger(p.count) && p.count > 0 && p.count < 200);
  const extraLines = () => [has('others') && squash(s.other, 300) ? 'Other outcome requested: ' + squash(s.other, 300) + '.' : '',
    has('variations') && s.varAxes.length ? 'For the variations, change only: ' + s.varAxes.join(', ').toLowerCase() + '.' : ''].filter(Boolean);
  const note = () => [squash(s.instructions, INSTRUCTION_LIMIT)].concat(extraLines()).filter(Boolean).join(' ') || LINK.NO_INSTRUCTIONS;
  const joined = () => [note() === LINK.NO_INSTRUCTIONS ? '' : note(), lines(s.locks).length ? KEEP_PREFIX + lines(s.locks).map(x => squash(x, 160)).join('; ') + '.' : ''].filter(Boolean).join(' ');
  const productName = it => {
    if (squash(it.name, 80)) return squash(it.name, 80);
    const sub = byId.get(it.subCategory); if (sub) return sub.name;
    return nameOf(it.category) || nameOf(it.department) || (validPieces(it)[0] || {}).item || 'Product';
  };
  const itemLabel = (it, i) => squash(it.name, 40) || (byId.get(it.subCategory) || {}).name || 'Item ' + (i + 1);

  // The images A7's "01 Intent & scope" plans (n8n/claude-midas-a7/code-nodes/01_Intent_scope.js): the white master first, then each
  // outcome's images; at most 8 (10 for the views-by-light series).
  function planned(o) {
    o = o || { outcomes: guideOutcomes(), view: s.view, series: s.series, varCount: s.varCount, camera: s.camera, lighting: useDefaults() ? '' : s.lighting, whiteMaster: !whiteOff() };
    const out = [], add = r => { if (!out.some(x => x.role === r.role)) out.push(Object.assign({ camera: '', light: '' }, r)); };
    const light = LIGHT_KEY[o.lighting] || '';
    const cams = ['Full frontal', 'Left side', '45° right'];
    for (const g of o.outcomes) {
      if (g === 'Variations') { const n = Math.min(4, Math.max(1, Number(o.varCount) || 2)); for (let i = 1; i <= n; i++) add({ role: 'variation_' + i, label: 'Variation ' + i }); continue; }
      if (o.whiteMaster !== false || ['White BK', 'Website'].includes(g) || o.outcomes.some(x => ['White BK', 'Website'].includes(x))) add({ role: 'catalogue' });
      if (g === 'Lifestyle') {
        if (o.series === 'Three views') cams.forEach(c => add({ role: 'view_' + c, label: 'Series · ' + c, camera: c, light }));
        else if (o.series === 'Views by light') ['Daylight', 'Golden afternoon', 'Warm evening'].forEach(l => cams.forEach(c => add({ role: l + '_' + c, label: l + ' · ' + c, camera: c })));
        else (VIEW_IMAGES[o.view] || ['hero']).forEach(r => add({ role: r, camera: o.camera || 'Reference view', light }));
      }
      if (g === 'Website') ['hero', 'wide', 'detail'].forEach(r => add({ role: r }));
      if (g === 'New Composition') add({ role: 'composition' });
      if (g === 'Create with this item') add({ role: 'scene' });
    }
    const cap = o.series === 'Views by light' && o.outcomes.includes('Lifestyle') ? 10 : 8;
    return out.slice(0, cap);
  }
  const outcomeLabel = list => (list && list.length ? list.join(' + ') : 'White BK');

  // What A7 records but does not apply yet (its own "not applied" list), and what the A7 owner bridge cannot carry today.
  function recorded() {
    const r = [];
    if (scene() && s.plants) r.push('Plants');
    if (scene() && s.mood !== 'Automatic') r.push('Mood: ' + s.mood);
    const st = STRENGTHS.filter(([k]) => s.strengths[k] !== null);
    if (st.length) r.push('Strengths: ' + st.map(([k, n]) => n + ' ' + s.strengths[k]).join(', '));
    if (s.reviewFirst === 'proceed_without') r.push('Proceed without the description first (the plan approval stays on)');
    if (s.grounding) r.push('Semantic grounding');
    if (squash(s.links, 300)) r.push('Product links');
    if (!s.includeMeta) r.push('Description and meta: No (the package still carries a draft description)');
    if (s.items.some(it => lines(it.catalogue).length)) r.push('Midas products as references (to use Midas pieces, list their SKUs under Specific items)');
    if (s.mode === 'projects' && s.start === 'new_space' && squash(s.roomBrief, 600)) r.push('Room description');
    if (files.some(f => f.role === 'spec' && !/^(text\/|application\/json)/.test(f.file.type) && !IMAGE_TYPES.includes(f.file.type))) r.push('PDF and Excel specification files are stored; A7 reads text, CSV and JSON files only');
    if (fromSaved() && s.prevUse && !parentSent()) r.push('Previous generation: the chosen version was never sent, so A7 has no result to reuse');
    return r;
  }
  // The most one job may spend, in USD (lib/a7-limits.mjs MAX_JOB_BUDGET_USD); the server refuses anything else (lib/a7-actions.mjs).
  const MAX_BUDGET_USD = 10;
  function validBudget(v) { const n = Number(v); return String(v).trim() !== '' && Number.isFinite(n) && n >= 0.25 && n <= MAX_BUDGET_USD && Math.abs(Math.round(n * 100) - n * 100) < 1e-6; }
  function blockers() {
    const b = [];
    if (!multi() && s.items.length > 1) b.push('Several items are listed. Choose Batch (or Projects → Product or collection), or remove the extra items.');
    s.items.forEach((it, i) => {
      const who = s.items.length > 1 ? itemLabel(it, i) + ': ' : '';
      if (!filesOf(it).some(f => f.role === 'product')) b.push(who + 'add at least one product reference (Reference type: Product / vendor reference).');
      if (s.mode === 'projects' && s.start === 'existing_room' && !filesOf(it).some(f => f.role === 'room')) b.push(who + 'add a room reference for an existing room.');
      if (!validPieces(it).length) b.push(who + 'add how many pieces are in the photo.');
      it.pieces.forEach(p => { const n = Number(p.count); if (squash(p.item, 60) && !(Number.isInteger(n) && n > 0 && n < 200)) b.push(who + 'use a whole number from 1 to 199 for “' + squash(p.item, 40) + '”.'); });
      if (lines(it.catalogue).length > 6) b.push(who + 'list at most 6 Midas product references.');
    });
    if (fromSaved() && !s.parentId) b.push('Choose the saved version to continue.');
    if (!guideOutcomes().length) b.push(has('others') ? 'Others is added as an instruction: choose at least one more outcome with it.' : 'Choose at least one outcome.');
    if (has('others') && !squash(s.other, 300)) b.push('Describe the other outcome.');
    if (has('variations') && !(fromSaved() && parentSent())) b.push('Variations start from an accepted result: choose Edit → Choose from saving (or Projects → Saved project) and a version that was sent.');
    if (lines(s.picks).length > 12 || lines(s.picks).some(x => x.length > 40)) b.push('List at most 12 Midas SKUs, each under 40 characters.');
    if (lines(s.locks).some(x => x.length > 160)) b.push('Keep each detail to keep under 160 characters.');
    if (lines(s.locks).length > 12 || lines(s.mustNot).length > 12) b.push('Use at most 12 lines for details to keep and for things to exclude.');
    if (lines(s.mustNot).some(x => x.length > 80)) b.push('Keep each thing to exclude under 80 characters.');
    if (!validBudget(s.budget)) b.push('Enter a job budget from USD 0.25 to USD ' + MAX_BUDGET_USD.toFixed(2) + ', in whole cents.');
    if (joined().length > INSTRUCTION_LIMIT) b.push('Shorten the instructions: with the other outcome, the variation note and the details to keep they are over ' + INSTRUCTION_LIMIT + ' characters.');
    return b;
  }

  /* ------------------------------------------------------------------ the brief sent to the owner backend (one per item) */
  function briefFor(it) {
    const sc = scene(), L = life(), d = useDefaults(), outs = guideOutcomes();
    const strength = k => (s.strengths[k] === null ? '' : String(s.strengths[k]));
    const b = {
      page: 'studio', product: squash(productName(it), 80), sku: squash(it.sku, 40), outcome: sc ? 'Lifestyle' : 'White background',
      view: L ? s.view : 'Category template', aspect: sc && s.aspect !== 'standard' ? s.aspect : '1:1', resolution: s.resolution,
      lighting: sc && !d ? s.lighting : '', dimensions: squash(it.dimensions, 120), inventory: validPieces(it).map(p => p.count + ' ' + p.item).join('\n'),
      budgetUsd: Number(s.budget), startType: s.mode === 'projects' ? s.start : (isEdit() ? 'saved_project' : 'product_collection'),
      camera: L && s.series === 'Single image' ? s.camera : 'Reference view', human: sc && s.mode === 'manual' && s.human ? 'yes' : 'no', studioChoice: sc && d ? 'yes' : 'no',
      wallPaint: sc && !d ? s.wall : '', floor: sc && !d ? s.floor : '',
      color: squash(it.color, 60), material: squash(it.material, 80), locks: lines(s.locks).join('\n'), mustNot: lines(s.mustNot).join('\n'),
      department: nameOf(it.department), category: nameOf(it.category), subCategory: (byId.get(it.subCategory) ? pathLabel(byId.get(it.subCategory), it.category) : ''),
      description: squash(it.description, 1200),
      outcomes: outs.join('\n'), otherOutcome: has('others') ? squash(s.other, 300) : '', itemRole: itemRole(), workOn: multi() ? 'batch' : 'one_by_one',
      series: L ? s.series : '', variationCount: has('variations') ? s.varCount : '', variationAxes: has('variations') ? s.varAxes.join('\n') : '',
      plants: sc && s.plants ? 'yes' : 'no', mood: sc ? s.mood : 'Automatic', midasPicks: lines(s.picks).join('\n'), catalogueRefs: lines(it.catalogue).join('\n'),
      links: squash(s.links, 300), includeMeta: s.includeMeta ? 'yes' : 'no', previousGeneration: fromSaved() ? s.prevUse : '',
      fidelityStrength: strength('fidelity'), stylingStrength: strength('styling'), clutterStrength: strength('clutter'),
      reviewFirst: s.reviewFirst, grounding: s.grounding ? 'yes' : 'no', roomBrief: s.mode === 'projects' && s.start === 'new_space' ? squash(s.roomBrief, 600) : ''
    };
    if (whiteOff()) b.whiteMaster = 'no';   // sent only when unticked, so other briefs stay as they were
    if (isEdit()) b.editSource = fromSaved() ? 'saved' : 'new';
    if (isEdit() && !fromSaved()) b.startType = 'product_collection';
    return b;
  }

  /* ------------------------------------------------------------------ rendering: steps */
  function renderNav() {
    const list = stages();
    $('stage-nav').replaceChildren(...list.map(([id, label], i) => el('button', { type: 'button', 'aria-current': s.stage === id ? 'step' : null, onclick: () => go(id) },
      el('b', { text: String(i + 1).padStart(2, '0') }), label)));
    $('mode-projects').setAttribute('aria-pressed', String(s.mode === 'projects'));
    $('mode-manual').setAttribute('aria-pressed', String(s.mode === 'manual'));
  }
  const NEXT_LABEL = { job: 'Continue to the item', project: 'Continue to the item', item: 'Choose the outcomes', scope: 'Continue to preferences', preferences: 'Continue to suggestions', suggestions: 'Review choices' };
  function render() {
    const running = s.stage === 'run';
    show($('stage-nav'), !running); show(document.querySelector('.cf-tabs'), !running);
    for (const id of ['job', 'project', 'item', 'scope', 'preferences', 'suggestions', 'run']) $('s-' + id).classList.toggle('is-on', s.stage === id);
    show($('flow-actions'), !running);
    const list = stages().map(x => x[0]), at = list.indexOf(s.stage);
    show($('back'), at > 0);
    $('next').textContent = at === list.length - 1 ? 'Review choices' : NEXT_LABEL[s.stage] || 'Continue';
    renderNav(); renderJob(); renderProject(); renderItem(); renderScope(); renderBudget(); renderPrefs(); renderSuggestions();
    saveDraft();
  }
  function go(stage) { if (sending) return; s.stage = stage; render(); const h = document.querySelector('#s-' + stage + ' h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  function next() { const list = stages().map(x => x[0]), at = list.indexOf(s.stage); if (at === list.length - 1) openReview(); else go(list[at + 1]); }
  function back() { const list = stages().map(x => x[0]), at = list.indexOf(s.stage); if (at > 0) go(list[at - 1]); }
  function setMode(m) { if (sending || s.mode === m) return; s.mode = m; s.stage = m === 'projects' ? 'project' : 'job'; forgetRun(); render(); }
  const change = fn => () => { fn(); forgetRun(); render(); };

  function renderJob() {
    $('job-grid').replaceChildren(...JOBS.map(([id, label, icon]) => el('button', { type: 'button', class: 'cf-card', 'aria-pressed': String(s.job === id), onclick: change(() => { s.job = id; }) },
      el('span', { class: 'cf-check', html: ICON.check }), el('span', { class: 'cf-icon', html: icon }), el('strong', { text: label }))));
    const d = $('job-detail');
    if (s.job === 'new') d.replaceChildren(el('span', { class: 'cf-field-label', text: 'Work on' }), el('div', { class: 'cf-pills' },
      pill('Batch', s.workOn === 'batch', change(() => { s.workOn = 'batch'; })),
      pill('One by one (same department)', s.workOn === 'one_by_one', change(() => { s.workOn = 'one_by_one'; }))),
      el('p', { class: 'cf-help', text: s.workOn === 'batch' ? 'Several items or sets, each with its own references, category and package. Each item is saved and sent as its own job; one item’s angles stay together.' : 'One item or set at a time; the department carries forward to your next request.' }));
    else if (s.job === 'edit') d.replaceChildren(el('span', { class: 'cf-field-label', text: 'Start from' }), el('div', { class: 'cf-pills' },
      pill('Choose from saving', s.editFrom === 'saved', change(() => { s.editFrom = 'saved'; })),
      pill('New item', s.editFrom === 'new', change(() => { s.editFrom = 'new'; s.parentId = ''; }))),
      s.editFrom === 'saved' ? savedPicker() : null,
      el('p', { class: 'cf-help', text: s.editFrom === 'saved' ? 'Carries the saved references and accepted direction forward; describe only the change under More options → Custom prompting.' : 'Bring a product image, a composition or a room into an edit. Supply the reference and describe the change.' }));
    else d.replaceChildren(el('span', { class: 'cf-field-label', text: 'Item role' }), el('div', { class: 'cf-pills' },
      pill('Hero', s.role === 'hero', change(() => { s.role = 'hero'; })),
      pill('Secondary', s.role === 'secondary', change(() => { s.role = 'secondary'; }))),
      el('p', { class: 'cf-help', text: s.role === 'hero' ? 'The item is the main subject. A small accessory can be the hero, with Midas furniture chosen around it.' : 'The item supports the main furniture or room: recognisable and correctly placed, without becoming the largest object.' }));
  }
  function savedPicker() {
    const versions = saved.filter(v => v.version_id);
    if (!versions.length) return el('p', { class: 'cf-help', text: 'No saved projects yet. Choose New item, or save a request first.' });
    const sel = el('select', { id: 'parent', 'aria-label': 'Saved version', onchange: e => { s.parentId = e.target.value; forgetRun(); render(); } },
      el('option', { value: '', text: 'Choose a saved version' }),
      ...versions.map(v => el('option', { value: v.version_id, text: v.title + ' · ' + v.case_title + ' · version ' + v.version + ' · ' + (v.run_id || v.client_run_id ? 'sent' : 'not sent') })));
    sel.value = versions.some(v => v.version_id === s.parentId) ? s.parentId : '';
    return el('label', { class: 'cf-field cf-saved-field' }, el('span', { text: 'Saved version' }), sel);
  }
  function renderProject() {
    $('start-grid').replaceChildren(...STARTS.map(([id, t, d]) => el('button', { type: 'button', class: 'cf-source', 'aria-pressed': String(s.start === id), onclick: change(() => { s.start = id; }) },
      el('span', { class: 'cf-check', html: ICON.check }), el('strong', { text: t }), el('span', { text: d }))));
    const pick = $('saved-pick');
    const notes = { product_collection: 'Several photographs may describe one item. Add another item only for a different product or set; each item is sent as its own job.', existing_room: 'Add the room photo with the reference type “Room / target space”, and the products to place, replace or restyle.', new_space: 'The space is created around your pieces, with coordinated Midas supporting products.' };
    if (s.start === 'saved_project') pick.replaceChildren(savedPicker(), el('p', { class: 'cf-help', text: 'Continue saved work, refine selected elements or request variations, keeping the original references and accepted direction.' }));
    else pick.replaceChildren(el('p', { class: 'cf-help', text: notes[s.start] }));
    show(pick, true);
    show($('room-brief-field'), s.start === 'new_space'); $('room-brief').value = s.roomBrief;
  }
  function renderItem() {
    const it = item(), many = multi() || s.items.length > 1;
    $('item-lead').textContent = many ? 'Each item keeps its own category, references and pieces. Scope and preferences apply to every item.' : '';
    show($('item-tabs'), many); show($('item-name-field'), many);
    if (many) {
      $('item-tabs').replaceChildren(...s.items.map((x, i) => pill(itemLabel(x, i), i === s.active, () => { s.active = i; render(); })),
        s.items.length < MAX_ITEMS && multi() ? el('button', { type: 'button', class: 'cf-add-item', text: '+ Add an item', onclick: change(() => { s.items.push(newItem()); s.active = s.items.length - 1; }) }) : null,
        s.items.length > 1 ? el('button', { type: 'button', text: 'Remove this item', onclick: change(() => { filesOf(it).forEach(f => { URL.revokeObjectURL(f.url); files.splice(files.indexOf(f), 1); }); s.items.splice(s.active, 1); s.active = Math.max(0, s.active - 1); }) }) : null);
      $('item-name').value = it.name;
    }
    fillCategories(it);
    fill($('ref-type'), REF_TYPES, s.refType);
    $('upload-note').textContent = s.refType === 'spec' ? 'Text, CSV, JSON, PDF or Excel (.xlsx), or a photo of the sheet · up to 3 MB each. A7 reads text, CSV and JSON; PDF and Excel are stored and listed as not read.' : 'JPG, PNG or WebP · larger photos are reduced to 3 MB in this browser · up to 12 references per item.';
    $('files').setAttribute('accept', s.refType === 'spec' ? IMAGE_TYPES.concat(PICK_EXTRA, SPEC_TYPES, ['.csv', '.txt', '.json', '.pdf', '.xlsx']).join(',') : IMAGE_TYPES.concat(PICK_EXTRA).join(','));
    $('file-list').replaceChildren(...filesOf(it).map(f => el('div', { class: 'cf-file' },
      IMAGE_TYPES.includes(f.file.type) ? el('img', { src: f.url, alt: '' }) : el('span', { class: 'cf-icon', text: 'DOC' }),
      el('div', {}, el('strong', { text: f.file.name }), el('select', { 'aria-label': 'Role of ' + f.file.name, onchange: e => { f.role = e.target.value; forgetRun(); render(); } },
        ...REF_TYPES.filter(([v]) => IMAGE_TYPES.includes(f.file.type) || v === 'spec').map(([v, t]) => el('option', { value: v, text: t, selected: f.role === v })))),
      el('button', { type: 'button', 'aria-label': 'Remove ' + f.file.name, text: 'Remove', onclick: () => { URL.revokeObjectURL(f.url); files.splice(files.indexOf(f), 1); forgetRun(); render(); } }))));
    show($('catalogue-field'), s.showCatalogue || lines(it.catalogue).length > 0);
    $('choose-midas').setAttribute('aria-expanded', String(!$('catalogue-field').hidden));
    $('catalogue').value = it.catalogue;
    $('pieces').replaceChildren(...it.pieces.map((p, i) => el('div', { class: 'cf-piece', role: 'group', 'aria-label': 'Piece ' + (i + 1) },
      el('input', { type: 'number', min: '1', max: '199', step: '1', inputmode: 'numeric', value: String(p.count), 'aria-label': 'How many, piece ' + (i + 1), oninput: e => { p.count = e.target.value === '' ? '' : Number(e.target.value); forgetRun(); saveDraft(); } }),
      el('input', { type: 'text', maxlength: '60', value: p.item, placeholder: 'Piece, for example dining chair', 'aria-label': 'Piece name ' + (i + 1), oninput: e => { p.item = e.target.value; forgetRun(); saveDraft(); } }),
      it.pieces.length > 1 ? el('button', { type: 'button', text: 'Remove', 'aria-label': 'Remove piece ' + (i + 1), onclick: change(() => { it.pieces.splice(i, 1); }) }) : el('span'))));
    $('add-piece').disabled = it.pieces.length >= 12;
  }
  function renderScope() {
    $('scope-grid').replaceChildren(...OUTCOMES.map(([id, t, d]) => el('button', { type: 'button', class: 'cf-scope', 'aria-pressed': String(has(id)),
      onclick: change(() => { s.outcomes = has(id) ? s.outcomes.filter(x => x !== id) : s.outcomes.concat(id); }) },
      el('span', { class: 'cf-box', html: ICON.check }), el('span', {}, el('strong', { text: t }), el('small', { text: d })))));
    show($('other-field'), has('others')); $('other-outcome').value = s.other;
    show($('white-master-field'), whiteOptional()); $('white-master').checked = s.whiteMaster !== false;
    const vn = $('variations-note');
    show(vn, has('variations'));
    vn.textContent = fromSaved() && parentSent() ? 'Variations reuse the accepted result of the saved version and change only what you choose under View & delivery.' : 'Variations start from an accepted result: choose Edit → Choose from saving (or Projects → Saved project) and a version that was sent.';
    fill($('view'), VIEWS.map(v => [v, v]), s.view); $('view').disabled = !life() || s.series !== 'Single image';
    fill($('aspect'), ASPECTS, s.aspect); $('aspect').disabled = !scene();
    fill($('resolution'), RESOLUTIONS, s.resolution);
    fill($('camera'), CAMERAS.map(c => [c, c]), s.camera); $('camera').disabled = !life() || s.series !== 'Single image';
    fill($('series'), SERIES, s.series); $('series').disabled = !life();
    fill($('var-count'), ['1', '2', '3', '4'].map(n => [n, n + (n === '1' ? ' variation' : ' variations')]), s.varCount); $('var-count').disabled = !has('variations');
    show($('var-axes-box'), has('variations'));
    $('var-axes').replaceChildren(...AXES.map(a => pill(a, s.varAxes.includes(a), change(() => { s.varAxes = s.varAxes.includes(a) ? s.varAxes.filter(x => x !== a) : s.varAxes.concat(a); }))));
    $('view-note').textContent = !scene() ? 'White BK makes one square catalogue image, so views, camera and proportions are fixed.'
      : (life() ? 'Views, camera and series apply to the Lifestyle images; proportions to every scene image. The white catalogue image is always square.' : 'Proportions apply to the scene images. Website always makes hero, wide and close-up; the white catalogue image is always square.');
    const p = planned();
    $('plan-line').textContent = guideOutcomes().length ? 'Expect ' + p.length + (p.length === 1 ? ' image' : ' images') + (s.items.length > 1 ? ' per item' : '') + ': ' + p.map(nameOfImage).join(', ') + '.' + (p.some(x => x.role === 'catalogue') && scene() ? ' Every package starts with the white catalogue image.' : '') : 'Choose at least one outcome.';
  }
  function renderBudget() {
    if (document.activeElement !== $('budget')) $('budget').value = s.budget;
    const ok = validBudget(s.budget);
    $('budget').setAttribute('aria-invalid', String(!ok));
    $('budget-help').textContent = ok ? 'The most this job may spend on reading, planning and images. A run pauses before it would go over.' : 'Enter an amount from USD 0.25 to USD ' + MAX_BUDGET_USD.toFixed(2) + ', in whole cents.';
    $('budget-help').classList.toggle('cf-error', !ok);
  }
  function renderPrefs() {
    const off = !scene() || s.mode === 'projects';
    $('prefs').disabled = off || s.defaults;
    $('prefs-note').textContent = !scene() ? 'Room preferences are not used on a white background.' : (s.defaults ? 'The studio chooses the lighting, wall paint and floor.' : 'Optional. Leave any of them for the studio to choose. Existing rooms keep their real architecture unless you ask otherwise.');
    $('lighting').replaceChildren(...LIGHTS.map(v => pill(v, s.lighting === v, change(() => { s.lighting = s.lighting === v ? '' : v; }))));
    $('wall').replaceChildren(...WALLS.map(([v, hex]) => { const b = pill(v, s.wall === v, change(() => { s.wall = s.wall === v ? '' : v; })); b.prepend(el('i')); b.querySelector('i').style.setProperty('--swatch', hex); return b; }));
    $('floor').replaceChildren(...FLOORS.map(v => pill(v, s.floor === v, change(() => { s.floor = s.floor === v ? '' : v; }))));
    $('defaults').checked = s.defaults; $('defaults').disabled = !scene();
  }
  function renderSuggestions() {
    $('human').checked = s.human && scene(); $('human').disabled = !scene();
    $('human-note').textContent = scene() ? 'Lifestyle presence · at most one person, never hiding the item' : 'Scene images only';
    $('plants').checked = s.plants && scene(); $('plants').disabled = !scene();
    fill($('mood'), MOODS.map(m => [m, m]), s.mood); $('mood').disabled = !scene();
    show($('mood-rec'), s.mood !== 'Automatic');
  }

  /* ------------------------------------------------------------------ files */
  // Photos over 3 MB, or HEIC/AVIF the browser can open, are reduced in this browser to fit (../preview-image.js).
  // Specification documents are kept as chosen and must already be within 3 MB.
  async function takeFiles(list) {
    const err = [], notes = [], it = item(), picked = [...(list || [])], fit = window.a7PreviewImage;
    $('files').value = '';
    for (const file of picked) {
      if (filesOf(it).length >= MAX_REFS) { err.push('At most ' + MAX_REFS + ' references per item.'); break; }
      if (s.refType === 'spec' && SPEC_TYPES.includes(file.type)) {
        if (file.size > MAX_BYTES) { err.push(file.name + ': larger than 3 MB.'); continue; }
        files.push({ file, role: 'spec', url: URL.createObjectURL(file), item: it.key }); continue;
      }
      let fitted;
      try { fitted = await fit.fit(file); }
      catch (e) {
        err.push(file.name + (e.message === 'image_too_large' ? ': still larger than 3 MB after reducing it in this browser.' : s.refType === 'spec' ? ': use text, CSV, JSON, PDF, Excel (.xlsx) or an image.' : ': this browser could not open it. Use JPG, PNG or WebP (HEIC opens in Safari). Choose “Specifications / Excel” for documents.'));
        continue;
      }
      if (filesOf(it).length >= MAX_REFS) { err.push('At most ' + MAX_REFS + ' references per item.'); break; }
      const note = fit.describe(fitted); if (note) notes.push(note);
      files.push({ file: fitted.file, role: s.refType, url: URL.createObjectURL(fitted.file), item: it.key });
    }
    $('files-error').textContent = err.concat(notes).join(' '); show($('files-error'), err.length + notes.length > 0);
    forgetRun(); render();
  }

  /* ------------------------------------------------------------------ draft (this device; no files) */
  function saveDraft() { const copy = JSON.parse(JSON.stringify(s)); if (copy.stage === 'run') copy.stage = stages()[0][0]; write(DRAFT_KEY, { s: copy, at: Date.now() }); $('draft-note').textContent = 'Choices saved on this device. Photos are kept only in this tab until you send.'; }
  function loadDraft() {
    const d = read(DRAFT_KEY); if (!d || !d.s) return;
    const base = blank();
    for (const k of Object.keys(base)) if (typeof d.s[k] === typeof base[k] && Array.isArray(d.s[k]) === Array.isArray(base[k])) base[k] = d.s[k];
    base.outcomes = base.outcomes.filter(x => OUTCOMES.some(o => o[0] === x));
    base.varAxes = base.varAxes.filter(x => AXES.includes(x));
    if (!VIEWS.includes(base.view)) base.view = 'Category template';
    if (!ASPECTS.some(a => a[0] === base.aspect)) base.aspect = 'standard';
    if (!CAMERAS.includes(base.camera)) base.camera = 'Reference view';
    if (!SERIES.some(x => x[0] === base.series)) base.series = 'Single image';
    if (!MOODS.includes(base.mood)) base.mood = 'Automatic';
    base.strengths = Object.fromEntries(STRENGTHS.map(([k]) => { const v = d.s.strengths && d.s.strengths[k]; return [k, Number.isInteger(v) && v >= 0 && v <= 100 ? v : null]; }));
    base.items = (Array.isArray(d.s.items) ? d.s.items : []).filter(x => x && typeof x === 'object').slice(0, MAX_ITEMS).map(x => {
      const it = newItem();
      for (const k of Object.keys(it)) if (k !== 'pieces' && typeof x[k] === 'string') it[k] = x[k];
      it.pieces = (Array.isArray(x.pieces) ? x.pieces : []).filter(p => p && typeof p === 'object').slice(0, 12).map(p => ({ count: p.count, item: String(p.item || '').slice(0, 60) }));
      if (!it.pieces.length) it.pieces = [{ count: 1, item: '' }];
      return it;
    });
    if (!base.items.length) base.items = [newItem()];
    base.active = Math.min(Math.max(0, base.active | 0), base.items.length - 1);
    s = base;
    if (!stages().some(x => x[0] === s.stage)) s.stage = stages()[0][0];
  }
  function forgetRun() { if (!sending) ids = {}; }

  /* ------------------------------------------------------------------ more options */
  function syncMore() {
    const it = item();
    for (const k of ['sku', 'dimensions', 'color', 'material', 'description']) $(k).value = it[k];
    $('data-for').textContent = s.items.length > 1 ? '· ' + itemLabel(it, s.active) : '';
    for (const k of ['instructions', 'locks', 'picks', 'links']) $(k).value = s[k];
    $('must-not').value = s.mustNot;
    $('include-meta').replaceChildren(pill('Yes', s.includeMeta, () => { s.includeMeta = true; forgetRun(); syncMore(); saveDraft(); }), pill('No', !s.includeMeta, () => { s.includeMeta = false; forgetRun(); syncMore(); saveDraft(); }));
    $('include-meta-note').replaceChildren(s.includeMeta ? 'The package carries a product description and useful metadata. Unsupported material, colour or measurements stay unknown.' : 'Visuals only. ', s.includeMeta ? '' : rec());
    const box = $('prev-box');
    if (fromSaved()) box.replaceChildren(el('p', { class: 'cf-help', text: 'Earlier result: ' + (parent() ? parent().title + ' · version ' + parent().version + (parentSent() ? ' · sent' : ' · not sent') : 'choose the saved version in ' + (s.mode === 'projects' ? 'Project' : 'The Job')) + '. It does not replace the original product reference.' }),
      el('span', { class: 'cf-field-label', text: 'Retain' }), el('div', { class: 'cf-pills' }, ...RETAIN.map(r => pill(r, s.prevUse === r, () => { s.prevUse = s.prevUse === r ? '' : r; forgetRun(); syncMore(); saveDraft(); }))));
    else box.replaceChildren(el('p', { text: 'Choose Edit → Choose from saving (or Projects → Saved project) to continue from an earlier result, then say what to retain here. You can also add an earlier image in The Item with the reference type “Previous result”.' }));
    $('strengths').replaceChildren(...STRENGTHS.map(([k, n]) => {
      const auto = s.strengths[k] === null;
      const range = el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(auto ? 50 : s.strengths[k]), disabled: auto, 'aria-label': n + ' strength', oninput: e => { s.strengths[k] = Number(e.target.value); forgetRun(); out.textContent = e.target.value + ' / 100'; saveDraft(); } });
      const out = el('span', { text: auto ? 'Automatic' : s.strengths[k] + ' / 100' });
      return el('div', { class: 'cf-strength' }, el('span', {}, el('strong', { text: n }), ' ', out), range,
        el('label', {}, el('input', { type: 'checkbox', checked: auto, onchange: e => { s.strengths[k] = e.target.checked ? null : 50; forgetRun(); syncMore(); saveDraft(); } }), 'Automatic'));
    }));
    $('review-first').replaceChildren(pill('Share description first', s.reviewFirst === 'share_first', () => { s.reviewFirst = 'share_first'; forgetRun(); syncMore(); saveDraft(); }),
      pill('Proceed without', s.reviewFirst === 'proceed_without', () => { s.reviewFirst = 'proceed_without'; forgetRun(); syncMore(); saveDraft(); }));
    $('review-first-note').replaceChildren(s.reviewFirst === 'share_first' ? 'Applied: the studio shares its plan and waits for your plan decision before any image is made; every image then waits for your image decision.' : 'Recorded. The studio still shares its plan and waits for your decision; the output review always checks inventory, identity, placement and composition. ', s.reviewFirst === 'share_first' ? '' : rec());
    $('grounding').checked = s.grounding;
    budgetNote();
  }
  function budgetNote() { const n = joined().length; $('budget-note').textContent = n + ' of ' + INSTRUCTION_LIMIT + ' characters used by the instructions, the other-outcome and variation notes and the details to keep.'; $('budget-note').classList.toggle('cf-error', n > INSTRUCTION_LIMIT); }

  /* ------------------------------------------------------------------ review */
  function working() {
    if (s.mode === 'projects') return 'Projects · ' + STARTS.find(x => x[0] === s.start)[1] + (fromSaved() && parent() ? ' · ' + parent().title : '');
    if (s.job === 'new') return 'New Project · ' + (s.workOn === 'batch' ? 'Batch' : 'One by one (same department)');
    if (s.job === 'edit') return 'Edit · ' + (fromSaved() ? 'Choose from saving' + (parent() ? ' · ' + parent().title : '') : 'New item');
    return 'Single item · ' + (s.role === 'hero' ? 'Hero' : 'Secondary');
  }
  function openReview() {
    const b = blockers(), p = planned(), sc = scene();
    const itemText = (it, i) => [itemLabel(it, i), [nameOf(it.department), nameOf(it.category), byId.get(it.subCategory) ? byId.get(it.subCategory).name : ''].filter(Boolean).join(' / ') || 'category automatic from references',
      validPieces(it).map(x => x.count + ' ' + x.item).join(', ') || 'pieces not listed', filesOf(it).length + ' reference' + (filesOf(it).length === 1 ? '' : 's') + ' (' + countRoles(it) + ')'].join(' · ');
    const rows = [['Working in', working()], [s.items.length > 1 ? 'Items (' + s.items.length + ', each sent as its own job)' : 'Item', s.items.map(itemText).join('\n')],
      ['Deliverables', outcomeLabel(guideOutcomes()) + (has('others') ? ' + Others (as an instruction)' : '') + ' · ' + p.length + (p.length === 1 ? ' image' : ' images') + (s.items.length > 1 ? ' per item' : '') + ': ' + p.map(nameOfImage).join(', ')],
      ['Job budget', validBudget(s.budget) ? 'USD ' + Number(s.budget).toFixed(2) + (s.items.length > 1 ? ' for each item’s job' : '') + ' · the most the job may spend' : 'not valid'],
      ['View & delivery', !sc ? 'Square · ' + s.resolution : [life() ? (s.series === 'Single image' ? s.view + ' · ' + s.camera : s.series) : '', (ASPECTS.find(a => a[0] === s.aspect) || [0, ''])[1], s.resolution, has('variations') ? s.varCount + ' variation' + (s.varCount === '1' ? '' : 's') + (s.varAxes.length ? ' (change only ' + s.varAxes.join(', ').toLowerCase() + ')' : '') : ''].filter(Boolean).join(' · ')],
      ['Direction', !sc ? 'Not used on white' : (useDefaults() ? 'Studio chooses lighting, wall and floor' : [s.lighting || 'studio lighting', s.wall || 'studio wall', s.floor || 'studio floor'].join(' · ')) + (s.human && s.mode === 'manual' ? ' · one person' : '') + (s.plants ? ' · plants' : '') + (s.mood !== 'Automatic' ? ' · ' + s.mood : '')],
      ['Midas items', lines(s.picks).join(', ') || 'Studio chooses up to three confirmed in stock, or none'],
      ['Human validation', s.reviewFirst === 'share_first' ? 'Share description first: plan approval, then every image' : 'Proceed without (recorded; the plan approval stays on)']];
    $('review-list').replaceChildren(...rows.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', {}, ...v.split('\n').flatMap((line, i) => (i ? [el('br'), line] : [line]))))));
    const r = recorded(), box2 = $('review-recorded');
    box2.replaceChildren(el('strong', { text: 'Recorded with the request · not applied by A7 yet' }), el('ul', {}, ...r.map(x => el('li', { text: x }))));
    show(box2, r.length > 0);
    const more = [['Instructions sent to the studio', note() === LINK.NO_INSTRUCTIONS ? 'None' : note()],
      ['Details to keep', lines(s.locks).join('; ') || 'None'], ['Things to exclude', lines(s.mustNot).join('; ') || 'None'],
      ['Additional input data', s.items.map((it, i) => (s.items.length > 1 ? itemLabel(it, i) + ': ' : '') + ([it.sku, it.dimensions, it.color, it.material].filter(Boolean).join(' · ') || '—')).join('\n')],
      ['Description and meta', s.includeMeta ? 'Yes' : 'No']];
    $('review-more').replaceChildren(...more.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', {}, ...v.split('\n').flatMap((line, i) => (i ? [el('br'), line] : [line]))))));
    const box = $('review-blockers');
    if (b.length) box.replaceChildren(el('strong', { text: 'To complete this brief' }), el('ul', {}, ...b.map(x => el('li', { text: x }))));
    show(box, b.length > 0);
    $('send').disabled = b.length > 0 || sending;
    $('send').textContent = s.items.length > 1 ? 'Save ' + s.items.length + ' items and check the cost' : 'Save and check the cost';
    show($('send-error'), false);
    $('review-dialog').showModal();
  }
  const countRoles = it => { const c = {}; filesOf(it).forEach(f => { c[f.role] = (c[f.role] || 0) + 1; }); return Object.entries(c).map(([r, n]) => n + ' ' + (REF_TYPES.find(x => x[0] === r) || [0, r])[1].split(' /')[0].toLowerCase()).join(', ') || 'none'; };

  /* ------------------------------------------------------------------ send: save -> store -> estimate -> confirm -> send once */
  async function sha256(file) { try { const d = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
  function sendError(text) { $('send-error').textContent = text; show($('send-error'), true); announce(text); }
  function step(text) { $('send').textContent = text; }
  async function send() {
    if (sending || blockers().length) return;
    sending = true; $('send').disabled = true; show($('send-error'), false);
    try { await sendInner(); } finally { sending = false; $('send').disabled = blockers().length > 0; step(s.items.length > 1 ? 'Save ' + s.items.length + ' items and check the cost' : 'Save and check the cost'); }
  }
  async function saveItem(it, i, projectId) {
    const id = ids[it.key] || (ids[it.key] = uuid()), b = briefFor(it), n = note(), edit = isEdit(), many = s.items.length > 1;
    const label = many ? itemLabel(it, i) + ': ' : '';
    step('Saving ' + (many ? 'item ' + (i + 1) + ' of ' + s.items.length : 'the request') + '…');
    const draft = { requestId: id, mode: edit ? 'edit' : (many ? 'collection' : 'project'), title: (many ? 'Batch · ' + productName(s.items[0]) + ' and ' + (s.items.length - 1) + ' more' : 'Studio · ' + b.product).slice(0, 120), caseTitle: b.product, note: n, brief: b };
    if (many && projectId) draft.projectId = projectId;
    if (edit) { draft.editSource = fromSaved() ? 'saved' : 'new'; if (fromSaved()) draft.parentId = s.parentId; }
    const sv = await call('/api/owner/projects', { method: 'POST', json: draft });
    if (!sv.ok) return { error: label + 'the request could not be saved, so nothing was sent. ' + why(sv) };
    step('Storing ' + (many ? 'item ' + (i + 1) + '’s' : 'your') + ' references privately…');
    const have = await call('/api/owner/project-references/' + encodeURIComponent(id));
    const existing = have.ok && Array.isArray(have.data.references) ? have.data.references : [];
    for (const f of filesOf(it)) {
      const hash = await sha256(f.file);
      if (hash && existing.some(r => r.role === f.role && r.sha256 === hash)) continue;
      const form = new FormData(); form.set('role', f.role); form.set('file', f.file, f.file.name);
      const st = await call('/api/owner/project-references/' + encodeURIComponent(id), { method: 'POST', body: form });
      if (!st.ok) return { error: label + f.file.name + ' could not be stored, so nothing was sent. ' + why(st) };
    }
    step('Preparing the cost estimate…');
    const est = await call('/api/owner/project-estimate/' + encodeURIComponent(id));
    const after = await call('/api/owner/project-references/' + encodeURIComponent(id));   // includes references carried from a saved version
    const refs = after.ok && Array.isArray(after.data.references) ? after.data.references.length : filesOf(it).length;
    return { id, it, b, n, projectId: sv.data.projectId || projectId || null, est: est.ok && est.data.fingerprint ? est.data : null, estError: est.ok ? '' : why(est), refs };
  }
  async function sendInner() {
    const done = [];
    let projectId = null;
    for (let i = 0; i < s.items.length; i++) {
      const r = await saveItem(s.items[i], i, projectId);
      if (r.error) { sendError(r.error + (done.length ? ' The items before it are saved.' : '')); return; }
      projectId = r.projectId; done.push(r);
    }
    $('review-dialog').close();
    const go = await confirmCost(done);
    if (!go.length) { announce('Nothing was sent. Your ' + (done.length > 1 ? 'items are' : 'request is') + ' saved.'); return; }
    const sentOk = [], failed = [];
    for (const r of go) {
      step('Sending ' + (done.length > 1 ? itemLabel(r.it, s.items.indexOf(r.it)) + ' ' : '') + 'once…');
      const body = new FormData();
      body.set('payload', JSON.stringify(Object.assign({}, r.b, { requestId: r.id, draftId: r.id, instructions: r.n, confirmed: true, estimateConfirmation: { fingerprint: r.est.fingerprint, expiresAt: r.est.expiresAt } })));
      const sent = await call('/api/owner/submissions', { method: 'POST', body });
      const ok = sent.ok && sent.data.accepted === true, pending = sent.status === 409 && sent.data.outcome === 'pending_or_unknown';
      if (ok || pending) { if (sent.data.runId) rememberRunId(r.id, sent.data.runId); sentOk.push(r); }
      else failed.push(itemLabel(r.it, s.items.indexOf(r.it)) + ': ' + (sent.status === 503 && sent.data.error === 'owner_actions_not_enabled' ? 'sending is switched off on this site; it is saved.' : sent.status === 503 && sent.data.error === 'a7_connection_not_configured' ? 'the A7 connection secret is not set on this site; nothing was sent and it is saved.' : sent.status === 502 ? 'the send was not confirmed; check Requests before sending again.' : 'nothing was sent. ' + why(sent)));
    }
    ids = {};
    if (sentOk.length) {
      const r = sentOk[0];
      startRun({ id: r.id, outcome: r.b.outcome === 'White background' ? 'White BK' : 'Lifestyle', outcomes: guideOutcomes(), planned: planned(), acceptedAt: Date.now(), product: r.b.product });
      if (sentOk.length > 1 || failed.length) $('run-lead').textContent = r.b.product + ' · ' + outcomeLabel(guideOutcomes()) + '. ' + (sentOk.length > 1 ? (sentOk.length - 1) + ' more item(s) were sent; follow them from Requests. ' : '') + (failed.length ? 'Not sent: ' + failed.join(' ') : '');
      return;
    }
    $('review-dialog').showModal();
    sendError(failed.join(' '));
  }
  let costAnswer = null;
  // Shows each item's own estimate. Only an item with a verified estimate, a single product image and paid processing switched on can
  // start; every other item stays saved.
  function confirmCost(list) {
    const edit = isEdit(), many = list.length > 1;
    const reason = r => {
      const e = r.est;
      if (!e) return 'The cost estimate is unavailable (' + r.estError + '). It is saved.';
      if (edit) return 'An edit or continuation has a provisional estimate, so it cannot start paid processing yet. It is saved.';
      if (e.status !== 'verified') return 'Only a square 2K White BK image of one product reference has a verified estimate, so this choice cannot start paid processing yet. It is saved.';
      if (r.refs > 1) return 'The A7 owner bridge forwards one product image per job; this item has ' + r.refs + ' references. It is saved.';
      if (e.paidReady !== true) return 'Paid processing is switched off on this site. It is saved; nothing will be sent.';
      return '';
    };
    const ready = list.filter(r => !reason(r));
    const first = list[0].est || {};
    $('cost-state').textContent = list.every(r => r.est && r.est.status === 'verified') ? 'Verified estimate' : 'Provisional estimate';
    $('cost-state').className = 'cf-pill-state ' + (list.every(r => r.est && r.est.status === 'verified') ? 'is-ok' : 'is-warn');
    const total = (k) => list.reduce((t, r) => t + (r.est ? Number(r.est[k]) || 0 : 0), 0);
    $('cost-facts').replaceChildren(...[[many ? 'Items' : 'Images', many ? String(list.length) : (first.outputs || []).join(', ')], ['Estimate without repairs' + (many ? ' (all items)' : ''), money(total('noRepairUsd'))],
      ['With up to two repairs per image' + (many ? ' (all items)' : ''), money(total('twoRepairsEachUsd'))], ['Spending ceiling per job', money(first.ceilingUsd)], ['Valid until', when(first.expiresAt)]]
      .map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
    $('cost-items').replaceChildren(...list.map(r => el('div', { class: 'cf-cost-item' }, el('strong', { text: (many ? itemLabel(r.it, s.items.indexOf(r.it)) + ' · ' : '') + (r.est ? (r.est.status === 'verified' ? 'verified' : 'provisional') + ' · ' + money(r.est.noRepairUsd) : 'no estimate') }),
      r.est ? el('small', { text: (r.est.outputs || []).join(', ') }) : null, reason(r) ? el('small', { text: reason(r) }) : el('small', { text: 'Can start once you confirm.' }))));
    show($('cost-items'), many || !!reason(list[0]));
    const list2 = (t, a) => (Array.isArray(a) && a.length ? [el('h4', { text: t }), el('ul', {}, ...a.map(x => el('li', { text: String(x) })))] : []);
    $('cost-more').replaceChildren(el('p', { text: String(first.basis || '') }), ...list2('Covers', first.coverage), ...list2('Not covered', first.exclusions), ...list2('Points to check', first.warnings));
    const blocked = ready.length ? '' : (many ? 'None of these items can start paid processing yet. They are all saved.' : reason(list[0]));
    $('cost-blocked').textContent = blocked; show($('cost-blocked'), !!blocked);
    show($('cost-check'), !blocked); show($('cost-go'), !blocked);
    $('cost-confirm-text').textContent = many ? 'I confirm these estimates and want the studio to start paid processing once for each of the ' + ready.length + ' item(s) that can start.' : 'I confirm this estimate and want the studio to start paid processing once.';
    $('cost-confirm').checked = false; $('cost-go').disabled = true;
    $('cost-cancel').textContent = blocked ? 'Close' : 'Not now';
    return new Promise(resolve => { costAnswer = v => resolve(v ? ready : []); $('cost-dialog').showModal(); });
  }
  function answerCost(v) { const f = costAnswer; costAnswer = null; if ($('cost-dialog').open) $('cost-dialog').close(); if (f) f(v); }

  /* ------------------------------------------------------------------ requests (saved versions and runs) */
  function rememberRunId(id, rid) { const m = read(RUNS_KEY) || {}; m[id] = rid; const k = Object.keys(m); if (k.length > 40) delete m[k[0]]; write(RUNS_KEY, m); }
  async function loadSaved() { const r = await call('/api/owner/projects'); saved = r.ok && Array.isArray(r.data.records) ? r.data.records : []; return r; }
  const briefOutcomes = b => (b && typeof b.outcomes === 'string' && b.outcomes.trim() ? lines(b.outcomes) : [b && b.outcome === 'Lifestyle' ? 'Lifestyle' : 'White BK']);
  const plannedFor = b => planned({ outcomes: briefOutcomes(b), view: b && b.view, series: b && b.series, varCount: b && b.variationCount, camera: b && b.camera, lighting: b && b.lighting });
  async function openRequests() {
    const box = $('requests-list'); box.replaceChildren(el('p', { class: 'cf-help', text: 'Loading…' })); $('requests-dialog').showModal();
    const r = await loadSaved();
    if (!r.ok) { box.replaceChildren(el('p', { class: 'cf-error', text: 'Saved requests could not be read. ' + why(r) })); return; }
    const versions = saved.filter(v => v.version_id);
    if (!versions.length) { box.replaceChildren(el('p', { class: 'cf-help', text: 'No saved requests yet.' })); return; }
    box.replaceChildren(...versions.map(v => el('div', { class: 'cf-request' },
      el('div', {}, el('strong', { text: v.title + (v.case_title && v.title.startsWith('Batch') ? ' · ' + v.case_title : '') + ' · version ' + v.version }), el('small', { text: outcomeLabel(briefOutcomes(v.brief)) + ' · ' + (v.dispatch_state || 'draft') + ' · ' + when(v.created_at) })),
      v.client_run_id ? el('button', { type: 'button', class: 'cf-secondary', text: 'Follow', onclick: () => { $('requests-dialog').close(); if (v.run_id) rememberRunId(v.version_id, v.run_id);
        startRun({ id: v.version_id, outcome: v.brief && v.brief.outcome === 'Lifestyle' ? 'Lifestyle' : 'White BK', outcomes: briefOutcomes(v.brief), planned: plannedFor(v.brief), acceptedAt: Date.parse(v.created_at) || Date.now(), product: v.case_title || v.title }); } }) : el('small', { text: 'Not sent' }))));
  }

  /* ------------------------------------------------------------------ following a request */
  function startRun(r) {
    run = r; s.stage = 'run'; render();
    $('run-ref').textContent = r.id; $('run-lead').textContent = r.product + ' · ' + outcomeLabel(r.outcomes);
    paintRun(LINK.toResult(r, null, null));
    stopWatch(); watch.failures = 0; schedule(POLL.firstMs);
    $('h-run').focus(); announce('Your request was received by the studio.');
  }
  function stopWatch() { clearTimeout(watch.timer); watch.token += 1; }
  function schedule(ms) { clearTimeout(watch.timer); watch.timer = setTimeout(check, ms); }
  async function readStatus(id) {
    const map = read(RUNS_KEY) || {}; let rid = map[id];
    if (!rid) {
      const l = await call('/api/owner/jobs');
      if (l.status === 503) return { error: 'Live job status is not connected on this site yet.' };
      if (!l.ok) return { error: 'The job list could not be read. ' + why(l) };
      const j = (l.data.jobs || []).find(x => x && x.clientId === 'owner-' + id);
      if (!j) return { result: LINK.toResult(run, null, null) };
      rid = j.id; rememberRunId(id, rid);
    }
    const one = await call('/api/owner/jobs/' + encodeURIComponent(rid));
    if (one.status === 503) return { error: 'Live job status is not connected on this site yet.' };
    if (!one.ok || !one.data.job) return { error: 'The job could not be read. ' + why(one) };
    let ctx = null;
    if (['awaiting_go_1', 'awaiting_go_2'].includes(one.data.job.status)) { const t = await call('/api/owner/jobs/' + encodeURIComponent(rid) + '/approval'); ctx = t.ok ? t.data : null; }
    return { result: LINK.toResult(run, one.data.job, ctx) };
  }
  async function check() {
    if (!run) return;
    const token = watch.token, out = await readStatus(run.id);
    if (token !== watch.token) return;
    if (out.error) {
      watch.failures += 1; $('run-error').textContent = out.error; show($('run-error'), true);
      if (watch.failures < POLL.maxFailures) schedule(POLL.everyMs); return;
    }
    watch.failures = 0; show($('run-error'), false);
    paintRun(out.result);
    if (out.result.state !== 'finished') schedule(POLL.everyMs);
  }
  const STATE = { in_production: 'In production', passed_checks: 'Passed automatic checks', on_hold: 'On hold', not_made: 'Not made', approved: '', changes_requested: 'Changes asked', not_approved: 'Not approved' };
  function paintRun(r) {
    const o = r.owner || {}, done = r.state === 'finished';
    const steps = [['Received', 'is-done', run ? when(run.acceptedAt) : ''], ['In production', done ? 'is-done' : 'is-now', o.gate ? 'Waiting for your decision' : o.status === 'hold' ? 'On hold' : o.waitingForRecord ? 'Waiting for the record' : o.stage || ''],
      ['Result', done ? 'is-done' : '', done ? (r.package.complete ? 'Package complete' : 'Package incomplete') : '']];
    $('timeline').replaceChildren(...steps.map(([t, c, m]) => el('li', { class: c }, t, el('small', { text: m }))));
    const plannedRoles = (run && run.planned) || [];
    $('shots').replaceChildren(...r.images.map((img, i) => {
      const label = img.state === 'approved' && img.decided_at && ['Approved', 'Approved by the studio'].includes(img.client_shown_as) ? img.client_shown_as : STATE[img.state] || 'Not made';
      const cls = img.state === 'approved' ? 'is-ok' : ['on_hold', 'changes_requested', 'passed_checks'].includes(img.state) ? 'is-warn' : ['not_made', 'not_approved'].includes(img.state) ? 'is-bad' : '';
      return el('article', { class: 'cf-shot' }, el('h4', { text: 'Image ' + (i + 1) + ' · ' + nameOfImage(plannedRoles[i] || img) }), el('span', {}, el('span', { class: 'cf-pill-state ' + cls, text: label })),
        img.reason ? el('p', { text: img.reason }) : null, img.note ? el('p', { text: img.note }) : null,
        img.link ? el('a', { href: img.link, target: '_blank', rel: 'noopener noreferrer', text: 'Open the image' }) : null);
    }));
    $('h-run').textContent = done ? (r.package.complete ? 'Approved and packaged.' : 'Finished.') : o.gate ? 'Your decision is needed.' : o.status === 'hold' ? 'On hold.' : 'Your request is with the studio.';
    if (done && r.package.limitations && r.package.limitations.length) $('run-lead').textContent = r.package.limitations.join(' ');
    paintDecision(o);
  }
  let decisionKey = '';
  function paintDecision(o) {
    const box = $('decision');
    if (!o || !(o.gate || o.status === 'hold')) { decisionKey = ''; show(box, false); box.replaceChildren(); return; }
    const c = o.context, key = [o.status, o.gate, c ? c.revision : 'none'].join('|');
    if (key === decisionKey) return;
    decisionKey = key; show(box, true);
    const desk = el('a', { class: 'cf-secondary', href: '/owner/desk/', text: 'Open the Studio desk' });
    if (!o.gate) { box.replaceChildren(el('h3', { text: 'On hold' }), el('p', { text: 'The studio paused this job. Recovery options are on the Studio desk.' }), desk); return; }
    const parts = [el('h3', { text: o.gate === 'go1' ? 'Your decision: the plan' : 'Your decision: the image' }),
      el('p', { text: o.gate === 'go1' ? 'The studio prepared the plan below. Nothing is made until you approve it.' : 'Review the image before it is packaged.' })];
    if (!c) { parts.push(el('p', { class: 'cf-help', text: 'The decision details could not be read right now. They load on the next check.' })); box.replaceChildren(...parts); return; }
    if (c.decisionNeeded && Array.isArray(c.allowed) && c.allowed.length) parts.push(el('p', { text: String(c.decisionNeeded) }));
    (c.shots || []).forEach((sh, i) => parts.push(el('details', {}, el('summary', { text: ['Image ' + (sh.number || i + 1), sh.output, sh.frame].filter(Boolean).join(' · ') }),
      el('dl', { class: 'cf-facts' }, ...Object.entries(sh.plan || {}).filter(([, v]) => v).flatMap(([k, v]) => [el('dt', { text: k.replace(/_/g, ' ') }), el('dd', { text: String(v) })])))));
    if (c.candidate) parts.push(el('a', { class: 'cf-primary', href: c.candidate, target: '_blank', rel: 'noopener noreferrer', text: 'Open the image' }));
    const rv = c.review || {}, finds = [].concat(rv.defects || [], rv.uncertain || []).map(String).filter(Boolean);
    if (rv.result || finds.length) parts.push(el('p', {}, el('strong', { text: 'Automatic review' + (rv.result ? ': ' + rv.result : '') })), finds.length ? el('ul', {}, ...finds.map(x => el('li', { text: x }))) : null);
    if ((c.warnings || []).length) parts.push(el('p', {}, el('strong', { text: 'Points to check' })), el('ul', {}, ...c.warnings.map(x => el('li', { text: String(x) }))));
    const allowed = Array.isArray(c.allowed) ? c.allowed : [];
    if (!allowed.length) { parts.push(el('p', { class: 'cf-help', text: 'This decision can no longer be answered safely here.' }), desk); box.replaceChildren(...parts.filter(Boolean)); return; }
    if (!c.paidReady) parts.push(el('p', { class: 'cf-help', text: 'Paid processing is switched off on this site, so only Stop is available.' }));
    const noteBox = el('textarea', { id: 'decision-note', rows: '3', maxlength: '1000' });
    const confirm = el('input', { type: 'checkbox', id: 'decision-confirm' });
    const status = el('p', { class: 'cf-help', role: 'status', id: 'decision-status' });
    const buttons = allowed.map(a => el('button', { type: 'button', class: a === 'stop' ? 'cf-secondary' : 'cf-primary', text: LINK.DECISIONS[a] || a, disabled: a !== 'stop' && !c.paidReady, onclick: () => decide(o, c, a, noteBox, confirm, status, buttons) }));
    parts.push(el('label', { class: 'cf-field' }, el('span', { text: 'Note for the studio (required when you ask for changes)' }), noteBox),
      el('label', { class: 'cf-check-line' }, confirm, 'I confirm this decision. It is sent once.'), el('div', { class: 'cf-decision-actions' }, ...buttons), status);
    box.replaceChildren(...parts.filter(Boolean));
  }
  async function decide(o, c, action, noteBox, confirm, status, buttons) {
    if (action === 'change' && !noteBox.value.trim()) { status.textContent = 'Write what should change first.'; noteBox.focus(); return; }
    if (!confirm.checked) { status.textContent = 'Tick the confirmation first.'; confirm.focus(); return; }
    buttons.forEach(b => { b.disabled = true; }); status.textContent = 'Sending your decision once…';
    const r = await call('/api/owner/jobs/' + encodeURIComponent(o.runId) + '/approval', { method: 'POST', json: { requestId: uuid(), revision: c.revision, decision: action, note: noteBox.value.trim(), confirmed: true } });
    if (r.ok && r.data.accepted === true) { status.textContent = 'Your decision was received. The page checks again now.'; announce(status.textContent); decisionKey = ''; schedule(400); return; }
    status.textContent = 'Your decision was not confirmed. ' + why(r);
    buttons.forEach((b, i) => { b.disabled = c.allowed[i] !== 'stop' && !c.paidReady; });
  }
  function newRequest() { stopWatch(); run = null; files.splice(0).forEach(f => URL.revokeObjectURL(f.url)); s = blank(); drop(DRAFT_KEY); render(); go(stages()[0][0]); }

  /* ------------------------------------------------------------------ start */
  async function init() {
    const who = await call('/api/owner/me');
    if (!who.ok || !who.data.email) { $('boot').textContent = 'The studio could not be opened. Reload the page or sign in again.'; return; }
    me = who.data; $('who').textContent = me.email;
    loadDraft(); await loadSaved();
    show($('boot'), false); show($('app'), true);
    $('mode-projects').addEventListener('click', () => setMode('projects'));
    $('mode-manual').addEventListener('click', () => setMode('manual'));
    $('next').addEventListener('click', next); $('back').addEventListener('click', back);
    $('more').addEventListener('click', () => { syncMore(); $('more-dialog').showModal(); });
    $('department').addEventListener('change', e => { const it = item(); it.department = e.target.value; it.category = ''; it.subCategory = ''; forgetRun(); render(); });
    $('category').addEventListener('change', e => { const it = item(); it.category = e.target.value; it.subCategory = ''; forgetRun(); render(); });
    $('sub-category').addEventListener('change', e => { item().subCategory = e.target.value; forgetRun(); render(); });
    // The tab label follows the name as it is typed; no re-render here, so focus and the next click are not disturbed.
    $('item-name').addEventListener('input', e => { item().name = e.target.value; forgetRun(); saveDraft(); const tab = $('item-tabs').children[s.active]; if (tab) tab.textContent = itemLabel(item(), s.active); });
    $('ref-type').addEventListener('change', e => { s.refType = e.target.value; render(); });
    $('choose-midas').addEventListener('click', () => { s.showCatalogue = $('catalogue-field').hidden; render(); if (!$('catalogue-field').hidden) $('catalogue').focus(); });
    $('catalogue').addEventListener('input', e => { item().catalogue = e.target.value; forgetRun(); saveDraft(); });
    $('files').addEventListener('change', e => takeFiles(e.target.files));
    const drop1 = $('drop');
    ['dragenter', 'dragover'].forEach(t => drop1.addEventListener(t, e => { e.preventDefault(); drop1.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(t => drop1.addEventListener(t, e => { e.preventDefault(); drop1.classList.remove('is-over'); }));
    drop1.addEventListener('drop', e => takeFiles(e.dataTransfer && e.dataTransfer.files));
    $('add-piece').addEventListener('click', () => { item().pieces.push({ count: 1, item: '' }); forgetRun(); render(); const ins = document.querySelectorAll('#pieces input[type=text]'); ins[ins.length - 1].focus(); });
    $('room-brief').addEventListener('input', e => { s.roomBrief = e.target.value; forgetRun(); saveDraft(); });
    $('other-outcome').addEventListener('input', e => { s.other = e.target.value; forgetRun(); saveDraft(); });
    $('white-master').addEventListener('change', e => { s.whiteMaster = e.target.checked; forgetRun(); render(); saveDraft(); });
    for (const [id, key] of [['view', 'view'], ['aspect', 'aspect'], ['resolution', 'resolution'], ['camera', 'camera'], ['series', 'series'], ['var-count', 'varCount'], ['mood', 'mood']])
      $(id).addEventListener('change', e => { s[key] = e.target.value; forgetRun(); render(); });
    $('budget').addEventListener('input', e => { s.budget = e.target.value; forgetRun(); renderBudget(); saveDraft(); });
    $('defaults').addEventListener('change', e => { s.defaults = e.target.checked; forgetRun(); render(); });
    $('human').addEventListener('change', e => { s.human = e.target.checked; forgetRun(); render(); });
    $('plants').addEventListener('change', e => { s.plants = e.target.checked; forgetRun(); render(); });
    $('grounding').addEventListener('change', e => { s.grounding = e.target.checked; forgetRun(); saveDraft(); });
    for (const k of ['sku', 'dimensions', 'color', 'material', 'description']) $(k).addEventListener('input', e => { item()[k] = e.target.value; forgetRun(); saveDraft(); });
    for (const k of ['instructions', 'locks', 'picks', 'links']) $(k).addEventListener('input', e => { s[k] = e.target.value; forgetRun(); budgetNote(); saveDraft(); });
    $('must-not').addEventListener('input', e => { s.mustNot = e.target.value; forgetRun(); saveDraft(); });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
    $('more-dialog').addEventListener('close', () => render());
    $('send').addEventListener('click', send);
    $('cost-confirm').addEventListener('change', e => { $('cost-go').disabled = !e.target.checked; });
    $('cost-go').addEventListener('click', () => answerCost($('cost-confirm').checked));
    $('cost-cancel').addEventListener('click', () => answerCost(false));
    $('cost-close').addEventListener('click', () => answerCost(false));
    $('cost-dialog').addEventListener('cancel', e => { e.preventDefault(); answerCost(false); });
    $('open-requests').addEventListener('click', openRequests);
    $('run-check').addEventListener('click', () => { watch.failures = 0; schedule(0); });
    $('run-new').addEventListener('click', newRequest);
    $('sign-out').addEventListener('click', async () => { try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* leave anyway */ } location.replace('/'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && run && s.stage === 'run') schedule(500); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
