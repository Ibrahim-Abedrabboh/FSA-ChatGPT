const MAX_VIEWS = 4;
const $ = id => document.getElementById(id);
const state = { intent: '', route: '', routes: {}, primary: null, room: null, look: null, side: { left: null, right: null }, views: [], notes: [], step: 1 };
const labelledViews = () => [state.side.left && { ...state.side.left, role: 'Left side' }, state.side.right && { ...state.side.right, role: 'Right side' }, ...state.views.map((entry, i) => ({ ...entry, role: `Additional angle/detail ${i + 1}` }))].filter(Boolean);
const routes = {
  project: { legend: 'How many products?', options: [['one', 'One product or set', 'Several photos of the same product or set.'], ['collection', 'Several products', 'One product at a time; each gets its own case.']] },
  edit: { legend: 'What do you want to edit?', options: [['saved', 'Something saved', 'Open a version you saved before.'], ['new', 'A new photo', 'Start from a product photo you add now.']] },
  single: { legend: 'Is this the main item?', options: [['hero', 'Main item (hero)', 'This item leads the image.'], ['secondary', 'Supporting item (secondary)', 'Another item leads; this one stays recognisable. Cannot be sent yet.']] }
};
const labelFor = (type, route) => routes[type]?.options.find(item => item[0] === route)?.[1] || 'Not selected';
const imagePresets = { catalogue: ['Clean catalogue'], 'scene-set': ['Styled hero','Wider setting','Close-up / detail'] };
function imageChoiceNote() {
  const images = new Set([...document.querySelectorAll('input[name="imageChoice"]:checked')].map(input => input.value));
  const outcomes = new Set([...document.querySelectorAll('input[name="prefOutcome"]:checked')].map(input => input.value));
  if ($('imagePreset').value === 'category') return outcomes.has('Website') ? 'Website asks A7 for the usual set of website images for this product type.' : 'A7 chooses the images for this product type.';
  if (!images.size) return 'Choose at least one image, or let A7 choose for the product type.';
  const roomImage = images.has('Styled hero') || images.has('Wider setting');
  if (outcomes.size === 1 && outcomes.has('White BK') && roomImage) return 'White BK is a white-background outcome. Styled hero and wider setting are room images; add a room outcome or revise this image selection.';
  if (outcomes.has('Website')) return 'Website groups the requested images; category-specific package completeness has not been checked here. No website is published.';
  return '';
}
function renderImageChoices() { $('imageChoiceStatus').textContent = imageChoiceNote(); renderWhiteOption(); renderResults(); }
// "Also make the white catalogue image" (owner, 20 Oct 2026): offered only for Lifestyle without White BK or Website, which always make it.
function renderWhiteOption() { const asked = new Set([...document.querySelectorAll('input[name="prefOutcome"]:checked')].map(input => input.value)); const box = $('whiteMasterOption'); if (box) box.hidden = !(asked.has('Lifestyle') && !asked.has('White BK') && !asked.has('Website')); }
const preferenceFields = [['Department','prefDepartment'],['Category','prefCategory'],['Sub-category','prefSubcategory'],['Supplier facts','prefSupplierFacts'],['Outcomes','prefOutcome'],['Images to include','prefImages'],['Camera view','prefCamera'],['Image shape','prefAspect'],['Lighting','prefLighting'],['Resolution','prefResolution'],['Image proportions shortcut','prefProportions'],['Start with','prefStartMode'],['Work on','prefWorkOn'],['Project starting point','prefStartPoint'],['Wall paint','prefWall'],['Floor','prefFloor'],['Window position','prefWindow'],['Style direction','prefStyle'],['Mood / Vibes','prefMood'],['Plants','prefPlants'],['Human','prefHuman'],['Atlas variation request','prefSeries'],['Variation count','prefVariationCount'],['Previous generation for continuity','prefPrevious'],['Requested dimensions','prefDimensions'],['User supplied pieces and quantities','prefInventory'],['Requested changes','prefChanges'],['Details to preserve','prefPreserve'],['User resolution of a known conflict','prefConflictResolution'],['Specific items or combination','prefItems'],['Preservation mode','prefPreservation'],['Initial description checkpoint','prefDescriptionReview'],['Semantic grounding','prefGrounding'],['Description and meta','prefMetadata'],['Fidelity steering','prefFidelity'],['Styling steering','prefStyling'],['Cluttering steering','prefCluttering']];
function preferenceValue(id) {
  if (id === 'prefOutcome') return [...document.querySelectorAll('input[name="prefOutcome"]:checked')].map(input => input.value).join(', ');
  if (id === 'prefImages') return $('imagePreset').value === 'category' ? 'Category template requested · unresolved in this preview' : [...document.querySelectorAll('input[name="imageChoice"]:checked')].map(input => input.value).join(', ');
  const field = $(id);
  if (field.tagName === 'SELECT') {
    if (!field.value) return id === 'prefAspect' ? 'Standard for category' : id === 'prefLighting' ? 'Use workflow defaults' : '';
    const option = field.selectedOptions[0];
    return id === 'prefLighting' ? `${option.textContent} · ${option.parentElement.label}` : option.textContent;
  }
  return field.value.trim();
}
// Photos over 3 MB, or HEIC/AVIF the browser can open, are reduced in this browser to fit; see preview-image.js.
const fit = file => window.a7PreviewImage.fit(file);
// Upload messages appear beside the upload box, where the photo was chosen; the step status at the foot of the page is off screen.
function sourceNote(message, error = false) { const box = $('sourceStatus'); if (!box) return; box.textContent = message; box.hidden = !message; box.classList.toggle('error', !!message && error); }
const reducedNote = results => results.map(result => window.a7PreviewImage.describe(result)).filter(Boolean).map(line => line + ' ').join('');
const fitError = error => error?.message === 'image_too_large' ? 'This image is still larger than 3 MB after reducing it in this browser. Choose a smaller photo.' : 'This browser could not open that image. Choose a JPEG, PNG or WebP photo (HEIC opens in Safari; in Chrome, export it as JPEG first).';
function status(message, error = false) { $('setupStatus').textContent = message; $('setupStatus').classList.toggle('error', error); }
function release(entry) { if (entry?.url?.startsWith('blob:')) URL.revokeObjectURL(entry.url); }
let primaryRead = 0, viewsRead = 0;
const roleRead={room:0,look:0};
const sideRead = {left:0,right:0};
function preview(entry, label, remove) {
  const figure = document.createElement('figure'); figure.className = 'preview-card';
  const img = document.createElement('img'); img.src = entry.url; img.alt = `${label} preview: ${entry.file.name}`;
  const caption = document.createElement('figcaption'); const text = document.createElement('span'); text.textContent = `${label} · ${entry.file.name}`;
  const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Remove'; button.setAttribute('aria-label', `Remove ${label.toLowerCase()} ${entry.file.name}`); button.addEventListener('click', remove);
  caption.append(text, button); figure.append(img, caption); return figure;
}
function renderPreviews() {
  window.dispatchEvent(new Event('a7-source-change'));
  $('primaryPreview').replaceChildren(...(state.primary ? [preview(state.primary, 'Primary source', () => { primaryRead++; release(state.primary); state.primary = null; $('primaryInput').value = ''; renderPreviews(); })] : []));
  for(const [role,label] of [['room','Room reference'],['look','Inspiration reference']])$(''+role+'Preview').replaceChildren(...(state[role]?[preview(state[role],label,()=>{roleRead[role]++;release(state[role]);state[role]=null;$(role+'Input').value='';renderPreviews();})]:[]));
  const cards = [];
  for (const [side,label] of [['left','Left side'],['right','Right side']]) {
    const entry = state.side[side];
    const container = $(side + 'SidePreview');
    container.replaceChildren(...(entry ? [preview(entry,label,() => { sideRead[side]++; release(entry); state.side[side] = null; $(side + 'SideInput').value = ''; renderPreviews(); })] : []));
    if (!entry) { const empty = document.createElement('p'); empty.className = 'slot-empty'; empty.textContent = `${label} image not added`; container.append(empty); }
    if (entry) cards.push(preview(entry,label,() => { sideRead[side]++; release(entry); state.side[side] = null; $(side + 'SideInput').value = ''; renderPreviews(); }));
  }
  const extras = state.views.map((entry, i) => preview(entry, `Additional angle/detail ${i + 1}`, () => { release(entry); state.views.splice(i, 1); $('viewsInput').value = ''; renderPreviews(); }));
  $('extraViewsPreview').replaceChildren(...extras);
  $('viewsPreview').replaceChildren(...cards, ...state.views.map((entry, i) => preview(entry, `Additional angle/detail ${i + 1}`, () => { release(entry); state.views.splice(i, 1); $('viewsInput').value = ''; renderPreviews(); })));
  renderResults();
}
async function addSide(side, files) {
  if (!files[0]) return;
  if (!state.side[side] && state.views.length + Number(!!state.side.left) + Number(!!state.side.right) >= MAX_VIEWS) { $('drawerStatus').textContent = `Add at most ${MAX_VIEWS} side and additional views combined.`; return; }
  const ticket=++sideRead[side];
  try { const fitted=await fit(files[0]),url=await window.a7PreviewImage.read(fitted.file); if(ticket!==sideRead[side])return;
    release(state.side[side]); state.side[side] = { file: fitted.file, url };
    $('drawerStatus').textContent = `${side === 'left' ? 'Left' : 'Right'} side kept as labelled. ${reducedNote([fitted])}Nothing was uploaded.`;
    renderPreviews();
  } catch (error) { if(ticket===sideRead[side])$('drawerStatus').textContent=fitError(error); }
}
// addPrimary and addViews answer true only when the photo was added, so a caller (the Midas import) can report the real outcome.
async function addPrimary(files) {
  if (!files[0]) return false;
  const ticket=++primaryRead;
  try { const fitted=await fit(files[0]),url=await window.a7PreviewImage.read(fitted.file); if(ticket!==primaryRead)return false;
    release(state.primary); state.primary = { file: fitted.file, url }; renderPreviews(); sourceNote(reducedNote([fitted]).trim()); status(`Original image previewed locally. ${reducedNote([fitted])}Nothing was uploaded.`); return true;
  } catch (error) { if(ticket===primaryRead){sourceNote('Primary image not added. '+fitError(error),true);status(fitError(error),true);$('primaryInput').value='';} return false; }
}
async function addRole(role,files){
  if(!files[0])return;
  const ticket=++roleRead[role];
  try{const fitted=await fit(files[0]),url=await window.a7PreviewImage.read(fitted.file);if(ticket!==roleRead[role])return;release(state[role]);state[role]={file:fitted.file,url};renderPreviews();sourceNote(reducedNote([fitted]).trim());status(`${role==='room'?'Room':'Inspiration'} reference previewed locally. ${reducedNote([fitted])}Nothing was uploaded.`);}
  catch(error){if(ticket===roleRead[role]){sourceNote(`${role==='room'?'Room':'Inspiration'} reference not added. `+fitError(error),true);status(fitError(error),true);$(role+'Input').value='';}}
}
async function addViews(files) {
  const incoming = [...files];
  if (!incoming.length) return false;
  if (state.views.length + Number(!!state.side.left) + Number(!!state.side.right) + incoming.length > MAX_VIEWS) { $('drawerStatus').textContent = `Add at most ${MAX_VIEWS} side and additional views combined.`; return false; }
  const ticket=++viewsRead;
  try { const fitted=await Promise.all(incoming.map(fit)),urls=await Promise.all(fitted.map(entry=>window.a7PreviewImage.read(entry.file))); if(ticket!==viewsRead)return false;
    if(state.views.length + Number(!!state.side.left) + Number(!!state.side.right) + incoming.length > MAX_VIEWS){$('drawerStatus').textContent=`Add at most ${MAX_VIEWS} side and additional views combined.`;return false;}
    state.views.push(...fitted.map((entry,i)=>({file:entry.file,url:urls[i]})));
    $('viewsInput').value = ''; renderPreviews(); $('drawerStatus').textContent = `Additional views previewed locally. ${reducedNote(fitted)}Nothing was uploaded.`; return true;
  } catch (error) { if(ticket===viewsRead)$('drawerStatus').textContent=fitError(error); return false; }
}
function showRoutes(intent) {
  state.intent = intent; state.route = state.routes[intent] || ''; const spec = routes[intent], box = $('routeOptions'); box.replaceChildren();
  if (!spec) { $('routeFieldset').hidden = true; return; }
  $('routeLegend').textContent = spec.legend;
  for (const [value, title, detail] of spec.options) {
    const label = document.createElement('label'); label.className = 'route'; const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'route'; radio.value = value; radio.checked = value === state.route;
    const copy = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = title; const small = document.createElement('small'); small.textContent = detail; copy.append(strong, small); label.append(radio, copy); box.append(label);
    // A secondary product cannot be read or sent yet (it needs its hero product); say so here, before anything is saved or paid.
    radio.addEventListener('change', () => { state.route = value; state.routes[intent] = value; renderMode(); status(value === 'saved' ? 'Choose a saved version below and open it.' : value === 'secondary' ? 'Supporting item: this site cannot read or send it yet, because A7 needs the main item it supports. You can save it as a draft; choose Main item to make images.' : 'Good. Press Next to add the photos.'); renderResults(); if (value === 'saved') $('savedProjectPanel').scrollIntoView({block:'nearest'}); });
  }
  $('routeFieldset').hidden = false; renderMode(); renderResults();
}
function renderMode() {
  const savedRoute = state.intent === 'edit' && state.route === 'saved';
  $('projectSetup').hidden = state.intent !== 'project';
  $('savedProjectPanel').hidden = !savedRoute;
  setup.querySelector('.sources').hidden = savedRoute;
  setup.querySelector('.source-section').hidden = savedRoute;
  $('editSetup').hidden = state.intent !== 'edit';
  $('editSourceContext').hidden = state.intent !== 'edit';
  for (const id of ['prefStartMode','prefWorkOn','prefStartPoint']) $(id).closest('label').hidden = state.intent !== 'project';
  for (const id of ['prefChanges','prefPreserve']) $(id).closest('label').hidden = state.intent === 'edit';
  $('jobPreferencesTitle').textContent = state.intent === 'edit' ? 'Edit settings' : state.intent === 'single' ? 'Images for this item' : 'Images and settings';
  $('jobPreferences').querySelector(':scope > p:not(.eyebrow):not(.draft-note)').textContent = state.intent === 'edit' ? 'Choose the images the edit should produce. Everything else stays as saved.' : state.intent === 'single' ? 'Choose the images you want of this item. Its photos stay the reference for how it looks.' : 'Choose the images you want and how they should look. Every setting is optional except what to create.';
}
function renderResults() {
  $('resultIntent').textContent = {project:'New project', edit:'Edit', single:'Single item'}[state.intent] || '—';
  $('resultRoute').textContent = labelFor(state.intent, state.route);
  const views = labelledViews();
  $('resultCount').textContent = `${views.length} image${views.length === 1 ? '' : 's'} · Left side: ${state.side.left ? 'added' : 'empty'} · Right side: ${state.side.right ? 'added' : 'empty'}`;
  const images = [{ ...state.primary, role: 'Primary source' },state.room&&{...state.room,role:'Room reference'},state.look&&{...state.look,role:'Inspiration reference'}, ...views].filter(entry => entry?.file);
  $('resultImages').replaceChildren(...images.map(entry => { const wrap = document.createElement('figure'); const img = document.createElement('img'); img.src = entry.url; img.alt = `${entry.role}: ${entry.file.name}`; const caption = document.createElement('figcaption'); caption.textContent = `${entry.role} · ${entry.file.name}`; wrap.append(img, caption); return wrap; }));
  const coreFields = new Set(['prefOutcome','prefImages','prefCamera','prefAspect','prefLighting','prefResolution']);
  const items = preferenceFields.filter(([,id]) => !(state.intent === 'edit' && ['prefChanges','prefPreserve'].includes(id)) && !(state.intent !== 'project' && ['prefStartMode','prefWorkOn','prefStartPoint'].includes(id))).map(([label,id]) => [label, preferenceValue(id), coreFields.has(id)]).filter(([,value,core]) => core || value).map(([label,value]) => [label,value || 'Not selected']);
  if (state.intent === 'project') items.unshift(['Project name', $('projectName').value.trim() || 'Not named'],['Project scope', labelFor(state.intent,state.route)]);
  if (state.intent === 'edit') items.unshift(['Requested edit', $('editChanges').value.trim() || 'Not specified'],['Keep unchanged', $('editPreserve').value.trim() || 'Not specified']);
  const imageNote = imageChoiceNote(); if (imageNote) items.push(['Image selection note', imageNote]);
  const direction = [...state.notes, $('chatInput').value.trim()].filter(Boolean).join('\n\n');
  if (direction) items.push(['Creative direction instructions', direction]);
  $('resultPreferences').replaceChildren(...items.map(([label,value]) => { const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt,dd); return row; }));
}
const setup = $('setupPage');
// New case as one vertical timeline (21 Oct 2026). Each phase opens in turn: fill it in, press Next, and it folds into a
// one-line summary with a Change button while the page scrolls to the next phase. The paid steps, the photo check and the
// send, are the last two phases and each still asks for its own confirmation. The order and the done marks live in
// case-timeline.js; this file draws them.
// /owner/start/ is the new-case flow on its own; /owner/ keeps Saved work, Jobs and Previous work below it.
const caseOnly = location.pathname.startsWith('/owner/start');
if (caseOnly) document.body.classList.add('case-only');
// In the new-case flow those sections stay hidden until asked for: a link to one shows them in place, with no page load,
// so photos chosen on this page (kept only in this tab until saved) are not lost.
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href^="#"]'), id = link?.getAttribute('href').slice(1);
  if (!caseOnly || !['savedWorkSection','jobsSection','previousWorkSection'].includes(id)) return;
  document.body.classList.remove('case-only');
});
const intro = setup.querySelector('.page-intro');
const editSourceContext = document.createElement('section'); editSourceContext.id = 'editSourceContext'; editSourceContext.className = 'edit-source-context'; editSourceContext.hidden = true;
editSourceContext.innerHTML = '<div><strong>You are editing</strong><p id="editSourceCaption"></p><button id="changeEditSource" type="button">← Choose another</button></div><div id="editSourceThumbnail"></div>';
{ const photos = setup.querySelector('.source-section'); photos.insertBefore(setup.querySelector('.sources'), photos.querySelector('.upload-example-row')); }
// The photo check: save the photos, see its cost, run it, confirm what A7 found.
const sourceReview = document.createElement('section'); sourceReview.className = 'photo-check'; sourceReview.id = 'sourceReview';
sourceReview.innerHTML = '<h3 id="sourceReviewTitle">Photo check</h3><p id="sourceReviewStatus" role="status">Your photos are only in this browser so far. Save them to check the cost of the photo check.</p><button id="saveSourceDraft" type="button">1. Save the photos</button><p id="saveSourceStatus" class="source-status" role="status" hidden></p><div id="sourceReviewFacts"></div><button id="sourceReviewRefresh" type="button">2. See the cost of the photo check</button><button id="sourceReviewAnalyze" type="button" disabled>3. Run the photo check (paid)…</button><div id="sourceReviewCorrection" hidden><p id="sourceReviewNeeds"></p><label>Product type<input id="sourceReviewCategory" maxlength="120"></label><label>Number of pieces<input id="sourceReviewCount" type="number" min="1" max="199"></label><label>Room type, if there is a room photo<input id="sourceReviewRoom" maxlength="120"></label><label>Why you changed anything A7 found<textarea id="sourceReviewResolution" maxlength="600"></textarea></label><button id="sourceReviewConfirm" type="button">4. Confirm what A7 found</button><p id="sourceReviewConfirmStatus" class="source-status" role="status" hidden></p></div>';
$('photoCheckPanel').insertBefore(sourceReview, $('resultConflictPanel'));
// The review: photos and notes, each with a way back to change them.
const brief = document.createElement('div'); brief.className = 'brief-summary';
brief.innerHTML = '<div><small>PHOTOS</small><p id="briefSource"></p><button id="editSourceButton" type="button">Change photos</button></div><div><small>NOTES FOR THE STUDIO</small><p id="briefPrompt"></p><button id="editPromptButton" type="button">Change notes</button></div>';
$('summaryPanel').insertBefore(brief, $('resultPreferenceStatus'));
// The same facts as the photo check, kept for the adapter (start-connected.js writes both).
const sourceBrief = document.createElement('div'); sourceBrief.className = 'review-state'; sourceBrief.id='sourceBrief'; sourceBrief.dataset.state='blocked'; sourceBrief.hidden = true;
sourceBrief.innerHTML='<h3>Source facts and conflicts</h3><p id="briefFacts">The originals have not been analyzed or confirmed.</p><ul id="briefConflicts" class="state-list"></ul>';
$('summaryPanel').append(sourceBrief);
const previousStep = document.createElement('button'); previousStep.id = 'previousStep'; previousStep.type = 'button'; previousStep.textContent = '← Back';
const actions = setup.querySelector('.setup-actions'); actions.prepend(previousStep);
const outcomesBox = setup.querySelector('.outcome-choices'), imagesBox = setup.querySelector('.images-to-include');
const checked = name => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
const short = (text, max = 90) => { const value = String(text || '').replace(/\s+/g, ' ').trim(); return value.length > max ? value.slice(0, max - 1) + '…' : value; };
const fieldText = id => { const node = $(id); if (!node) return ''; return node.tagName === 'SELECT' ? (node.value ? node.selectedOptions?.[0]?.textContent || node.value : '') : node.value.trim(); };
// The phases, in order. Each names the existing sections it holds, how to check it before moving on, and its one-line summary.
const PHASES = [
  { key: 'work', title: 'Type of work', nodes: () => [setup.querySelector('.intents'), $('routeFieldset'), $('savedProjectPanel'), $('projectSetup')], check: () => validateChoice(),
    summary: () => [{project:'New project', edit:'Edit', single:'Single item'}[state.intent], state.route && labelFor(state.intent, state.route), state.intent === 'project' && $('projectName').value.trim()].filter(Boolean).join(' · ') },
  { key: 'photos', title: 'Photos', nodes: () => [editSourceContext, setup.querySelector('.source-section')], check: () => validateSource(),
    summary: () => state.primary?.file?.stored ? 'The saved photos of this version' : state.primary ? `Main photo${labelledViews().length ? ` + ${labelledViews().length} more view${labelledViews().length === 1 ? '' : 's'}` : ''}${state.room ? ' · room photo' : ''}${state.look ? ' · inspiration' : ''}` : '' },
  { key: 'edit', title: 'The edit', nodes: () => [$('editSetup')], check: () => validateEdit(), applies: () => state.intent === 'edit',
    summary: () => short('Change: ' + $('editChanges').value) },
  { key: 'product', title: 'The product', optional: true, nodes: () => [$('productDetails')],
    summary: () => [fieldText('connectedProduct'), short($('connectedInventory').value.split('\n').filter(Boolean).join(', '), 60), Number($('prefBudget').value) > 0 ? `up to USD ${Number($('prefBudget').value).toFixed(2)}` : ''].filter(Boolean).join(' · ') },
  { key: 'create', title: 'What to create', nodes: () => [outcomesBox, imagesBox], check: () => validateCreate(),
    summary: () => checked('prefOutcome').join(' + ') + ($('whiteMasterOption').hidden || $('prefWhiteMaster').checked ? '' : ' · no white catalogue image') },
  { key: 'settings', title: 'Look and settings', optional: true, nodes: () => [$('jobPreferences')],
    summary: () => [fieldText('prefCamera'), fieldText('prefAspect'), fieldText('prefLighting'), fieldText('prefResolution')].filter(Boolean).join(' · ') || 'Standard settings' },
  { key: 'notes', title: 'Notes for the studio', optional: true, nodes: () => [document.querySelector('.chat-section')],
    summary: () => short([...state.notes, $('chatInput').value.trim()].filter(Boolean).join(' · ')) || 'No notes' },
  { key: 'review', title: 'Review your choices', nodes: () => [$('summaryPanel')], summary: () => 'Checked',
    onOpen: () => { renderResults(); renderBriefSummary(); window.dispatchEvent(new Event('a7-results-open')); } },
  { key: 'check', title: 'Check the photos', paid: true, nodes: () => [$('photoCheckPanel')], summary: () => $('resultReviewState').textContent },
  { key: 'send', title: 'Estimate and send', paid: true, nodes: () => [setup.ownerDocument.querySelector('.estimate-review'), setup.ownerDocument.querySelector('.output-panel')], summary: () => '' },
];
const timeline = window.CaseTimeline.create(PHASES, { applies: key => PHASES.find(phase => phase.key === key)?.applies?.() ?? true });
const timelineList = document.createElement('ol'); timelineList.id = 'caseTimeline'; timelineList.className = 'timeline';
setup.insertBefore(timelineList, intro.nextSibling);
const phaseNodes = new Map();
for (const phase of PHASES) {
  const item = document.createElement('li'); item.className = 'phase'; item.id = 'phase-' + phase.key; item.dataset.phase = phase.key;
  item.innerHTML = `<div class="phase-head"><span class="phase-dot" aria-hidden="true"></span><div class="phase-heading"><h2 class="phase-title" id="phaseTitle-${phase.key}" tabindex="-1"></h2><p class="phase-summary"></p></div><button type="button" class="phase-change" hidden>Change</button></div><div class="phase-body" role="group" aria-labelledby="phaseTitle-${phase.key}"></div>`;
  const title = item.querySelector('.phase-title'); title.append(document.createTextNode(phase.title));
  if (phase.optional) { const tag = document.createElement('span'); tag.className = 'phase-tag'; tag.textContent = 'optional'; title.append(tag); }
  if (phase.paid) { const tag = document.createElement('span'); tag.className = 'phase-tag is-paid'; tag.textContent = 'paid · asks you to confirm'; title.append(tag); }
  const body = item.querySelector('.phase-body');
  for (const node of phase.nodes()) if (node) body.append(node);
  item.querySelector('.phase-change').setAttribute('aria-label', `Change ${phase.title}`);
  item.querySelector('.phase-change').addEventListener('click', () => openPhase(phase.key));
  timelineList.append(item); phaseNodes.set(phase.key, item);
}
// A new type of work can add or drop a phase (The edit), so the timeline is redrawn when the work or its option changes.
setup.addEventListener('change', event => { if (['intent','route'].includes(event.target?.name)) renderTimeline(); });
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function renderTimeline() {
  for (const phase of PHASES) {
    const item = phaseNodes.get(phase.key), phaseState = timeline.state(phase.key);
    item.hidden = phaseState === 'skipped'; item.dataset.state = phaseState;
    item.querySelector('.phase-dot').textContent = phaseState === 'done' ? '✓' : String(timeline.number(phase.key) || '');
    item.querySelector('.phase-body').hidden = phaseState !== 'open';
    const summary = item.querySelector('.phase-summary'); summary.textContent = phaseState === 'done' ? (phase.summary() || '') : '';
    summary.hidden = phaseState !== 'done' || !summary.textContent;
    item.querySelector('.phase-change').hidden = phaseState !== 'done';
    if (phaseState === 'open') {
      item.querySelector('.phase-body').append(actions);
      const following = timeline.following(), last = !following;
      $('continueButton').hidden = last;
      $('continueButton').textContent = following ? `Next: ${PHASES.find(p => p.key === following).title.toLowerCase()} →` : '';
      previousStep.hidden = !timeline.previous();
    }
  }
  if (timeline.open === 'photos' && state.intent === 'edit') renderEditSource();
}
// Opens a phase, folds the rest, and brings it into view (smoothly unless the owner asked for less motion).
function openPhase(key, { scroll = true, focus = true } = {}) {
  timeline.reopen(key); renderTimeline();
  PHASES.find(phase => phase.key === timeline.open)?.onOpen?.();
  if (!scroll) return;
  const item = phaseNodes.get(timeline.open);
  item.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (focus) item.querySelector('.phase-title').focus({ preventScroll: true });
}
function renderBriefSummary() {
  $('briefSource').textContent = state.primary ? [...(state.intent === 'project' ? [`Project · ${$('projectName').value.trim() || 'unnamed'}`] : []),...(state.intent === 'edit' && state.route !== 'saved' ? [`Change · ${$('editChanges').value.trim() || 'not specified'}`,`Keep · ${$('editPreserve').value.trim() || 'not specified'}`] : []),`Main photo · ${state.primary.file.name}`,`Room · ${state.room?.file.name||'none'}`,`Inspiration · ${state.look?.file.name||'none'}`,`Left side · ${state.side.left?.file.name || 'none'}`,`Right side · ${state.side.right?.file.name || 'none'}`,`Other angles · ${state.views.length}`].join('\n') : 'No main photo yet.';
  $('briefPrompt').textContent = [...state.notes, $('chatInput').value.trim()].filter(Boolean).join('\n\n') || 'No notes (optional).';
}
function renderEditSource() {
  if (!state.primary) return;
  $('editSourceCaption').textContent = [`Main photo · ${state.primary.file.name}`, ...labelledViews().map(entry => `${entry.role} · ${entry.file.name}`)].join('\n');
  const img = document.createElement('img'); img.src = state.primary.url; img.alt = `The photo you are editing: ${state.primary.file.name}`;
  $('editSourceThumbnail').replaceChildren(img);
}
// Phase 1 asks only for the type of work (and a name, or a saved version to open). Photos are checked in phase 2.
function validateChoice() {
  if (!state.intent) { status('Choose New project, Edit or Single item first.', true); document.querySelector('input[name="intent"]').focus(); return false; }
  if (!state.route) { status('Choose one of the options under your type of work.', true); document.querySelector('input[name="route"]').focus(); return false; }
  if (state.intent === 'edit' && state.route === 'saved' && !state.primary?.file?.stored) { status('Choose a saved version and open it first.', true); $('savedProjectPanel').scrollIntoView({block:'center'}); $('savedVersion').focus(); return false; }
  if (state.intent === 'project' && !$('projectName').value.trim()) { status('Give the project a name to continue.', true); $('projectName').focus(); return false; }
  return true;
}
function validateSource() {
  if (!state.primary) { status('Add the main product photo to continue. Other photos are optional.', true); $('primaryInput').focus(); return false; }
  return true;
}
function validateEdit() {
  if (state.intent !== 'edit') return true;
  if (!$('editChanges').value.trim()) { status('Say what should change to continue.', true); $('editChanges').focus(); return false; }
  if (!$('editPreserve').value.trim()) { status('Say what must stay the same to continue.', true); $('editPreserve').focus(); return false; }
  return true;
}
function validateCreate() {
  if (!document.querySelector('input[name="prefOutcome"]:checked')) { status('Choose at least one kind of image to create.', true); document.querySelector('input[name="prefOutcome"]').focus(); return false; }
  if ($('imagePreset').value === 'custom' && !document.querySelector('input[name="imageChoice"]:checked')) { status('Choose at least one image, or let A7 choose for the product type.', true); $('imagePreset').focus(); return false; }
  return true;
}
const PHASE_CHECKS = { work: validateChoice, photos: validateSource, edit: validateEdit, create: validateCreate };
function advance() {
  const result = timeline.next(key => (PHASE_CHECKS[key] || (() => true))());
  if (result.failed) { const message = $('setupStatus').textContent; openPhase(result.failed, { focus: false }); status(message, true); return; }
  if (!result.moved) return;
  status(PHASES.find(phase => phase.key === result.open).paid ? 'This step is paid: each paid button shows its cost and asks you to confirm before anything is charged.' : 'Noted. Continue below.');
  openPhase(result.open);
}
// The review used to be its own page (/owner/results/, /owner/start/results/). Those addresses now open the timeline: photos
// chosen before a reload are gone, so it starts again at the first phase.
function navigate(page) { if (page === 'results') { const result = timeline.next(key => (PHASE_CHECKS[key] || (() => true))()); openPhase(result.failed || 'review'); } else openPhase(timeline.open, { focus: false }); }
function pageFromPath() { return location.pathname.replace(/\/+$/, '').endsWith('/results') ? 'results' : 'setup'; }
document.querySelectorAll('input[name="intent"]').forEach(input => input.addEventListener('change', () => { showRoutes(input.value); status('Choose the route that matches your work.'); }));
for (const id of ['projectName','editChanges','editPreserve']) $(id).addEventListener('input', renderResults);
$('primaryInput').addEventListener('change', event => addPrimary(event.target.files));
for(const role of ['room','look'])$(role+'Input').addEventListener('change',event=>addRole(role,event.target.files));
$('viewsInput').addEventListener('change', event => addViews(event.target.files));
for (const side of ['left','right']) $(side + 'SideInput').addEventListener('change', event => addSide(side,event.target.files));
const viewsDrawer = $('viewsDrawer');
$('openViewsDrawer').addEventListener('click', () => { viewsDrawer.showModal(); $('closeViewsDrawer').focus(); });
for (const id of ['closeViewsDrawer','doneViewsDrawer']) $(id).addEventListener('click', () => viewsDrawer.close());
viewsDrawer.addEventListener('close', () => $('openViewsDrawer').focus());
$('prefProportions').addEventListener('change', event => { if (event.target.value) $('prefAspect').value = event.target.value === 'category' ? '' : event.target.value; });
$('sourceCatalogueRefs').addEventListener('input', () => {
  const target=$('prefItems');
  if(target.value!==$('sourceCatalogueRefs').value){target.value=$('sourceCatalogueRefs').value;target.dispatchEvent(new Event('input',{bubbles:true}));}
});
$('prefItems').addEventListener('input', () => {
  if($('sourceCatalogueRefs').value!==$('prefItems').value)$('sourceCatalogueRefs').value=$('prefItems').value;
});
$('prefAspect').addEventListener('change', () => { $('prefProportions').selectedIndex = 0; });
$('imagePreset').addEventListener('change', event => { const selected = new Set(imagePresets[event.target.value] || []); for (const input of document.querySelectorAll('input[name="imageChoice"]')) input.checked = selected.has(input.value); renderImageChoices(); });
for (const input of document.querySelectorAll('input[name="imageChoice"]')) input.addEventListener('change', () => { $('imagePreset').value = 'custom'; renderImageChoices(); });
for (const input of document.querySelectorAll('input[name="prefOutcome"]')) input.addEventListener('change', renderImageChoices);
const drop = $('primaryDrop');
for (const name of ['dragenter','dragover']) drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('dragging'); });
for (const name of ['dragleave','drop']) drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('dragging'); });
drop.addEventListener('drop', event => addPrimary(event.dataTransfer.files));
// A photo dropped anywhere else would make the browser leave this page to show it. Keep the page and say where to drop it.
const dropTarget = event => event.target?.closest?.('input[type="file"], #primaryDrop');
document.addEventListener('dragover', event => { if (!dropTarget(event)) event.preventDefault(); });
document.addEventListener('drop', event => { if (dropTarget(event)) return; event.preventDefault(); if (event.dataTransfer?.files?.length) sourceNote('That photo was not added. Drop it on “Add primary product image”, or use the Room, Inspiration or side-view buttons.', true); });
$('continueButton').addEventListener('click', advance);
previousStep.addEventListener('click', () => openPhase(timeline.back()));
// Buttons that send the owner back to an earlier answer open that phase.
const PHASE_BUTTONS = [['editPreferencesButton','settings'],['editSourceButton','photos'],['changeEditSource','work'],['editPromptButton','notes'],['reviewSourceButton','check']];
for (const [id, key] of PHASE_BUTTONS) $(id).addEventListener('click', () => openPhase(key));
function returnToStep(key) { openPhase(key); }
window.addEventListener('pagehide', event => { if (!event.persisted) { release(state.primary); release(state.side.left); release(state.side.right); state.views.forEach(release); } });
for (const chip of document.querySelectorAll('[data-prompt]')) chip.addEventListener('click', () => { const field = $('chatInput'); field.value = chip.dataset.prompt; field.dispatchEvent(new Event('input',{bubbles:true})); field.focus(); });
$('noteButton').addEventListener('click', () => { const value = $('chatInput').value.trim(); if (!value) { $('chatInput').focus(); return; } state.notes.push(value); const note = document.createElement('p'); note.className = 'note'; note.textContent = value; $('notes').append(note); $('chatInput').value = ''; $('chatInput').dispatchEvent(new Event('input',{bubbles:true})); });
$('preferencesButton').addEventListener('click', () => $('preferencesDialog').showModal());
$('closePreferences').addEventListener('click', () => $('preferencesDialog').close());
const helpTriggers = [...document.querySelectorAll('.help-trigger')];
const helpPinned = new WeakMap();
function renderCombinationHelp() {
  const selected = new Set([...document.querySelectorAll('input[name="prefOutcome"]:checked')].map(input => input.value));
  const notes = [];
  if (selected.has('New Composition') && selected.has('Website')) notes.push('New Composition + Website requests both a coordinated scene and a category-specific website image package. It does not publish a website.');
  if (selected.has('Lifestyle') && selected.has('Variations')) notes.push('Lifestyle + Variations requests related styled scenes with chosen light, style or view changes while product identity and item count stay consistent.');
  $('combineHelp').querySelector('.help-text').textContent = notes.join(' ') || 'You can combine outputs for one product or set, such as White BK + Lifestyle + Website. Room settings apply only to room outputs; multiple reference views are not extra items.';
}
for (const input of document.querySelectorAll('input[name="prefOutcome"]')) input.addEventListener('change', renderCombinationHelp);
renderCombinationHelp();
function setHelp(trigger, open) { trigger.setAttribute('aria-expanded', String(open)); $(trigger.getAttribute('aria-controls')).hidden = !open; }
function closeHelp(except = null) { for (const trigger of helpTriggers) if (trigger !== except) { helpPinned.set(trigger,false); setHelp(trigger,false); } }
for (const trigger of helpTriggers) {
  const wrap = trigger.closest('.help-wrap');
  wrap.addEventListener('mouseenter', () => { closeHelp(trigger); setHelp(trigger,true); });
  wrap.addEventListener('mouseleave', () => { if (!helpPinned.get(trigger) && document.activeElement !== trigger) setHelp(trigger,false); });
  trigger.addEventListener('focus', () => { closeHelp(trigger); setHelp(trigger,true); });
  trigger.addEventListener('blur', () => { if (!helpPinned.get(trigger)) setHelp(trigger,false); });
  trigger.addEventListener('click', () => { const pin = !helpPinned.get(trigger); closeHelp(trigger); helpPinned.set(trigger,pin); setHelp(trigger,pin); });
}
document.addEventListener('keydown', event => { if (event.key === 'Escape' && helpTriggers.some(trigger => trigger.getAttribute('aria-expanded') === 'true')) { closeHelp(); if (document.activeElement?.classList?.contains('help-trigger')) document.activeElement.blur(); event.stopPropagation(); } });
document.addEventListener('click', event => { if (!event.target.closest('.help-wrap')) closeHelp(); });
// Every help bubble has its own close button; it returns focus to the ? that opened it.
for (const button of document.querySelectorAll('.help-close')) button.addEventListener('click', event => { event.stopPropagation(); const trigger = button.closest('.help-wrap')?.querySelector('.help-trigger'); closeHelp(); trigger?.focus({preventScroll:true}); if (trigger) { helpPinned.set(trigger,false); setHelp(trigger,false); } });
$('openJobPreferences').addEventListener('click', () => { $('preferencesDialog').close(); openPhase('settings'); });
renderMode();
renderImageChoices();
renderPreviews();
renderTimeline();
// An old /results/ address: there is nothing to review after a reload, so start at the first phase on the plain address.
if (pageFromPath() === 'results') history.replaceState?.({}, '', caseOnly ? '/owner/start/' : '/owner/');
if (location.hash === '#jobs') setTimeout(() => document.getElementById('jobsSection').scrollIntoView(), 0);
// The authenticated adapter reads the same in-memory selections as this wizard.
// The next product of a collection: drop this product's originals but keep the project name and preferences.
function nextItem() {
  release(state.primary); release(state.room); release(state.look); release(state.side.left); release(state.side.right); state.views.forEach(release);
  state.primary = null; state.room = null; state.look = null; state.side = { left: null, right: null }; state.views = []; primaryRead++; viewsRead++;
  for (const id of ['primaryInput','roomInput','lookInput','viewsInput']) if ($(id)) $(id).value = '';
  renderPreviews(); timeline.reset('photos'); openPhase('photos');
}
window.a7Start = { state, preferenceFields, preferenceValue, addPrimary, addViews, nextItem, clearSaved() {
  if(state.primary?.file?.stored){state.primary=null;state.room=null;state.look=null;state.notes=[];$('notes').replaceChildren();$('chatInput').value='';renderPreviews();}
}, restoreSaved({version,reference}) {
  state.routes.edit='saved'; showRoutes('edit');
  state.primary={file:{name:'Saved original '+reference.role,stored:true},url:'/api/owner/project-references/'+version.version_id+'/'+reference.id};
  state.room=null;state.look=null;state.side={left:null,right:null};state.views=[];state.notes=[];$('notes').replaceChildren();
  $('chatInput').value=version.direction||version.note||'';
  $('editChanges').value=version.brief?.allowedChanges||'';$('editPreserve').value=version.brief?.protectedDetails||'';
  renderTimeline(); timeline.jumpTo('edit'); openPhase('edit');
} };

