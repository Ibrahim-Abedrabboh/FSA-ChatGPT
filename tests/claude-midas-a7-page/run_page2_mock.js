// Mock-mode check of the A7 client page draft 2 (claude-outputs/claude-midas-a7-page-2), 16 Oct 2026 (F3).
// Modelled on run_page_mock.js. Opens the page from disk in headless Chromium with ?mock=1 (nothing leaves the browser), works the
// brief like a client, and reads what the page would send (window.MIDAS_STUDIO_MOCK.lastPayload). Then passes each payload through
// A7's own "01 Intent & scope" code (read only) to show which images A7 would plan. No network, no n8n, no paid call.
// Covers: human presence, camera view, series (Three views, Views by light), the Left side limitation, the "Coming later" touches,
// White BK and Website, client-visible wording, RTL and console errors.
// Run: node tests/claude-midas-a7-page/run_page2_mock.js [folder for screenshots]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
// The page runs from a scratch copy of its folder, with a stand-in for the hero picture (a test fixture), because mock results
// reuse the hero picture and the real one is not kept in the repo. The page folder itself is not changed.
const SRC = path.join(ROOT, 'claude-outputs', 'claude-midas-a7-page-2');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-a7-page2-'));
for (const f of ['index.html', 'styles.css', 'app.js']) fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
fs.copyFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-06', 'fixtures', 'out_1125.webp'), path.join(TMP, 'atelier-hero.webp'));
const PAGE = path.join(TMP, 'index.html');
const SHOTS = process.argv[2] || '';
const SHOW = process.env.SHOW_PAYLOADS === '1';
let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function intake(payload) {
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const code = fs.readFileSync(path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes', '01_Intent_scope.js'), 'utf8');
  const item = { json: { body: { payload: JSON.stringify(Object.assign({}, payload, { item: { inventory: [{ item: 'sofa', count: 1 }] } })) } } };
  const fn = new AsyncFn('$', '$input', '$execution', 'require', code);
  return (await fn.call({}, () => { throw new Error('no node'); }, { first: () => item, all: () => [item] }, {}, require))[0].json;
}
// Every key anywhere in a payload, to prove the "Coming later" fields are never sent.
function keysOf(x, out) { out = out || []; if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.push(k); keysOf(x[k], out); } return out; }
const payloads = [];
// 01's notes that would mean the page and the studio disagree about camera, view, lighting, series or count.
const PLAN_NOTE = /camera|view|lighting|series|image\(s\)|capped|plants|mood|supporting pieces/i;
const LEFT_NOTE = 'Left side: not made from this page yet (needs a photo of that side)';
const FORBIDDEN = /\b(eye|brain|critic|n8n|a7|go 1|go 2|pipeline|model|models|openai|gpt|gemini|claude|anthropic|fal|fal\.ai|flux|sonnet|seedream|imagen|midjourney|dall-e|stable diffusion)\b/i;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/atelier-hero|taxonomy|ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  await page.route(/^https?:/, route => route.abort());   // mock mode: nothing may leave the browser (fonts included)
  await page.goto('file://' + PAGE + '?mock=1#studio');
  await page.waitForSelector('#aspect');
  const tab = async name => { await page.click('#outcome-tabs label:has-text("' + name + '")'); };
  const choose = async (group, v) => { await page.click('#' + group + '-choices label:has(input[value="' + v + '"])'); };
  const state = () => page.evaluate(() => {
    const vis = id => { const n = document.getElementById(id); return !!n && !n.hidden && !n.closest('[hidden]'); };
    const group = name => [...document.querySelectorAll('input[name="' + name + '"]')];
    return {
      count: document.getElementById('val-count').textContent,
      list: [...document.querySelectorAll('#count-list li')].map(li => li.textContent),
      countMade: vis('count-made') ? document.getElementById('count-made').textContent : '',
      hint: document.getElementById('brief-hint').textContent,
      submit: document.getElementById('submit-count').textContent,
      valView: document.getElementById('val-view').textContent,
      valCamera: document.getElementById('val-camera').textContent,
      valSeries: document.getElementById('val-series').textContent,
      valLighting: document.getElementById('val-lighting').textContent,
      viewLocked: group('view').every(i => i.disabled), viewChecked: group('view').filter(i => i.checked).map(i => i.value),
      cameraLocked: group('camera').every(i => i.disabled), cameraChecked: group('camera').filter(i => i.checked).map(i => i.value),
      seriesLocked: group('series').every(i => i.disabled), seriesChecked: group('series').filter(i => i.checked).map(i => i.value),
      lightingLocked: group('lighting').every(i => i.disabled), lightingChecked: group('lighting').filter(i => i.checked).map(i => i.value),
      notes: { viewSeries: vis('view-series-note'), cameraSeries: vis('camera-series-note'), lightingSeries: vis('lighting-series-note'), side: vis('series-side-note'), cameraWhite: vis('camera-note-white') },
      cards: { series: vis('card-series'), camera: vis('card-camera'), view: vis('card-view') },
      human: { checked: document.getElementById('human').checked, disabled: document.getElementById('human').disabled, note: document.getElementById('human-note').textContent, visible: vis('human') }
    };
  });
  const submit = async () => {
    await page.click('#submit-btn');
    await page.waitForFunction(() => window.MIDAS_STUDIO_MOCK && window.MIDAS_STUDIO_MOCK.lastPayload);
    const p = await page.evaluate(() => { const x = window.MIDAS_STUDIO_MOCK.lastPayload; window.MIDAS_STUDIO_MOCK.lastPayload = null; return x; });
    await page.waitForSelector('#view-progress:not([hidden])', { timeout: 15000 });   // the new request is in production
    payloads.push(p);
    const a7 = await intake(p);
    if (SHOW) console.log(JSON.stringify({ payload: p, outputs: a7.brief.outputs, not_applied: a7.not_applied, people: a7.brief.preferences.people }, null, 1));
    ok(a7.usable === 'ok', 'A7 accepts the request (' + p.scope.outcome + '): ' + a7.problems.join(' '));
    ok(a7.brief.outputs.length === p.scope.imageCount, 'imageCount ' + p.scope.imageCount + ' equals what A7 plans (' + a7.brief.outputs.length + ')');
    return { p, a7 };
  };
  const results = async () => {
    await page.waitForSelector('#view-results:not([hidden])', { timeout: 15000 });
    return page.evaluate(() => [...document.querySelectorAll('#results-grid .shot')].map(s => ({
      title: s.querySelector('.shot__title').textContent,
      generated: [...s.querySelectorAll('.tag--ink')].map(x => x.textContent),
      img: !!s.querySelector('.shot__fig:not(.shot__fig--original) img'),
      text: s.textContent
    })));
  };
  const visibleText = () => page.evaluate(() => document.body.innerText);

  // 1. Defaults: Lifestyle, Single image, As photographed (Reference view), human off; Left side and Right side shown as Coming later.
  let s = await state();
  ok(s.seriesChecked.join() === 'Single image' && s.cameraChecked.join() === 'Reference view' && s.valCamera === 'As photographed' && s.valSeries === 'Single image', 'defaults: Single image and "As photographed" chosen');
  ok(!s.human.checked && !s.human.disabled && s.human.note === 'At most one person, beside or behind the item, never in front of it. Off by default.', 'human presence: offered, off by default, with the owner\'s note');
  ok(s.count === '2' && s.list.join('|') === 'Catalogue on white|Hero' && !s.countMade, 'defaults: Category template = 2 images (white catalogue and hero, owner D8), nothing marked not made');
  const later = await page.evaluate(() => [...document.querySelectorAll('#camera-choices input[name="camera-later"]')].map(i => ({ v: i.value, disabled: i.disabled, text: i.closest('label').textContent })));
  ok(later.length === 2 && later.every(x => x.disabled && /Coming later/.test(x.text)) && later.map(x => x.v).join() === 'Left side,Right side', 'Left side and Right side: disabled, labelled Coming later');
  ok(await page.evaluate(() => document.getElementById('camera-later-note').textContent === 'Left side and Right side: coming later. Needs a photo of that side; this page takes one photo for now.'), 'camera: the Coming later note is shown in plain words');
  const cameraLabels = await page.evaluate(() => [...document.querySelectorAll('#camera-choices input[name="camera"]')].map(i => i.value + '=' + i.closest('label').textContent));
  ok(cameraLabels.join('|') === 'Reference view=As photographed|Full frontal=Full frontal|45° right=45° right', 'camera: three offered values with client labels: ' + cameraLabels.join('|'));
  const touches = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#touches-later li')].map(li => li.textContent),
    controls: document.querySelectorAll('#touches-later input, #touches-later button, #touches-later select, #touches-later textarea').length,
    old: ['plants', 'catalogue'].filter(id => document.getElementById(id)).length + document.querySelectorAll('input[name="mood"]').length
  }));
  ok(touches.rows.length === 3 && touches.rows.every(x => /Coming later/.test(x)) && /^Plants/.test(touches.rows[0]) && /^Mood \/ Vibes/.test(touches.rows[1]) && /^Midas supporting pieces/.test(touches.rows[2]), 'Plants, Mood / Vibes and Midas supporting pieces: shown as Coming later');
  ok(touches.controls === 0 && touches.old === 0, 'Plants, Mood / Vibes and Midas supporting pieces: not interactive (no control left)');

  // 2. Left side and Right side cannot be chosen, even with a forced click.
  await page.click('#camera-choices label:has(input[value="Left side"])', { force: true });
  await page.click('#camera-choices label:has(input[value="Right side"])', { force: true });
  s = await state();
  ok(s.cameraChecked.join() === 'Reference view' && s.valCamera === 'As photographed' && await page.evaluate(() => ![...document.querySelectorAll('input[name="camera-later"]')].some(i => i.checked)), 'a click on Left side or Right side changes nothing');

  await page.setInputFiles('#photo', { name: 'sofa.png', mimeType: 'image/png', buffer: PNG });
  if (SHOTS) await page.locator('#card-camera').screenshot({ path: path.join(SHOTS, 'claude-a7-page2-camera.png') }).catch(() => {});
  let r = await submit();
  ok(r.p.scope.camera === 'Reference view' && r.p.scope.series === 'Single image' && JSON.stringify(r.p.styling) === '{"human":false}', 'default request sends scope.camera "Reference view", scope.series "Single image", styling {human:false}');
  ok(r.a7.brief.outputs.map(o => o.id).join() === 'white_master,hero' && r.a7.brief.outputs.filter(o => o.kind !== 'white').every(o => o.camera === 'Reference view') && r.a7.brief.preferences.people === 'none', 'A7 plans white master and hero from the reference view, no people (owner D8)');
  ok(r.a7.not_applied.length === 0, 'default request: A7 lists nothing as not applied (' + r.a7.not_applied.join(' | ') + ')');
  let shots = await results();
  ok(shots.map(x => x.title).join('|') === 'Image 1, catalogue on white|Image 2, hero' && shots.every(x => x.generated.join() === 'Generated image' && x.img), 'mock result: two images, titled by view, each labelled "Generated image"');

  // 3. Human presence on and off → A7's people.
  await page.click('label.switch:has(#human)');
  s = await state();
  ok(s.human.checked, 'human presence switched on');
  r = await submit();
  ok(r.p.styling.human === true && r.a7.brief.preferences.people === 'one', 'human on → styling.human true → A7 people "one"');
  await results();
  await page.click('label.switch:has(#human)');
  r = await submit();
  ok(r.p.styling.human === false && r.a7.brief.preferences.people === 'none', 'human off → styling.human false → A7 people "none"');
  await results();

  // 4. Each offered camera view → A7 plans every scene image from that camera; no note.
  await choose('view', 'Wide view + close-up');
  for (const [v, label, word] of [['Full frontal', 'Full frontal', 'full frontal'], ['45° right', '45° right', '45° right'], ['Reference view', 'As photographed', '']]) {
    await choose('camera', v);
    s = await state();
    ok(s.valCamera === label && s.cameraChecked.join() === v, 'camera ' + v + ' chosen, shown as "' + label + '"');
    r = await submit();
    const scenes = r.a7.brief.outputs.filter(o => o.kind !== 'white');
    ok(r.p.scope.camera === v && r.p.scope.series === 'Single image' && r.p.scope.view === 'Wide view + close-up', 'camera ' + v + ' sent as scope.camera "' + r.p.scope.camera + '"');
    ok(scenes.length === 2 && scenes.every(o => o.camera === v) && r.a7.brief.camera_view === v && !r.a7.not_applied.some(x => PLAN_NOTE.test(x)), 'A7 plans wide and detail with camera ' + v + ', no note: ' + r.a7.not_applied.join(' | '));
    shots = await results();
    const want = word ? ['Image 1, catalogue on white', 'Image 2, wide view, ' + word, 'Image 3, close-up (detail), ' + word] : ['Image 1, catalogue on white', 'Image 2, wide view', 'Image 3, close-up (detail)'];
    ok(shots.map(x => x.title).join('|') === want.join('|'), 'mock result titles for camera ' + v + ': ' + shots.map(x => x.title).join('|'));
  }

  // 5-7. The two series are "Coming later" (owner D12, 16 Oct 2026): shown, disabled, never chosen, never sent.
  await choose('camera', 'Full frontal'); await choose('view', 'Close-up'); await choose('lighting', 'Golden afternoon');
  const seriesLater = await page.evaluate(() => [...document.querySelectorAll('#series-choices input[name="series-later"]')].map(i => ({ v: i.value, disabled: i.disabled, text: i.closest('label').textContent })));
  ok(seriesLater.length === 2 && seriesLater.every(x => x.disabled && /Coming later/.test(x.text)) && seriesLater.map(x => x.v).join() === 'Three views,Views by light', 'Three views and Views by light: disabled, labelled Coming later (D12)');
  ok(await page.evaluate(() => [...document.querySelectorAll('#series-choices input[name="series"]')].map(i => i.value).join()) === 'Single image', 'series: only Single image can be chosen');
  ok(await page.evaluate(() => /Three views and Views by light: coming later/.test(document.getElementById('series-later-note').textContent)), 'series: the Coming later note is shown in plain words');
  await page.click('#series-choices label:has(input[value="Three views"])', { force: true });
  await page.click('#series-choices label:has(input[value="Views by light"])', { force: true });
  s = await state();
  ok(s.seriesChecked.join() === 'Single image' && s.cameraChecked.join() === 'Full frontal' && s.viewChecked.join() === 'Close-up' && s.lightingChecked.join() === 'Golden afternoon' && !s.cameraLocked && !s.viewLocked && await page.evaluate(() => ![...document.querySelectorAll('input[name="series-later"]')].some(i => i.checked)), 'a click on a series changes nothing');
  if (SHOTS) await page.locator('#card-series').screenshot({ path: path.join(SHOTS, 'claude-a7-page2-series.png') }).catch(() => {});
  r = await submit();
  ok(r.p.scope.series === 'Single image' && r.p.scope.camera === 'Full frontal' && r.p.scope.view === 'Close-up' && r.a7.brief.outputs.map(o => o.id + ':' + (o.camera || '')).join() === 'white_master:,detail:Full frontal', 'Single image: Full frontal close-up planned; no series sent');
  await results();
  const threeViews = null, viewsByLight = null;

  // 8. White BK: no camera, series or human is sent, even with human on and a series chosen before.
  await page.click('label.switch:has(#human)');
  await tab('White BK');
  s = await state();
  ok(s.seriesLocked && s.cameraLocked && !s.seriesChecked.length && !s.cameraChecked.length && s.notes.cameraWhite && s.valCamera === 'Not applied on white' && s.valSeries === 'Not applied on white' && !s.human.visible, 'White BK: series and camera locked with a note; human presence not shown');
  ok(s.count === '1' && s.list.join() === 'Catalogue on white' && !s.countMade, 'White BK: 1 image, no Left side note');
  r = await submit();
  ok(!('camera' in r.p.scope) && !('series' in r.p.scope) && !('styling' in r.p) && r.p.scope.view === '' && r.p.scope.imageCount === 1, 'White BK sends no camera, no series, no human');
  ok(r.a7.brief.outputs.map(o => o.id).join() === 'white_master' && r.a7.brief.preferences.people === 'none' && r.a7.not_applied.length === 0, 'A7 reads White BK: white master only, no people, nothing listed back');
  await results();

  // 9. Website: no camera, series or human; the human switch is locked with a note.
  await tab('Website');
  s = await state();
  ok(!s.cards.series && !s.cards.camera && !s.cards.view && s.human.disabled && !s.human.checked && s.count === '4', 'Website: series, camera and views hidden; human presence locked; 4 images');
  r = await submit();
  ok(!('camera' in r.p.scope) && !('series' in r.p.scope) && !('styling' in r.p) && r.a7.brief.outputs.map(o => o.id).join() === 'white_master,hero,wide,detail' && r.a7.brief.preferences.people === 'none' && !r.a7.not_applied.some(x => PLAN_NOTE.test(x)), 'Website sends no camera, series or human; A7 plans the four-image package');
  await results();

  // 10. Lifestyle again: the series and the human choice come back as the client left them.
  await tab('Lifestyle');
  s = await state();
  ok(s.seriesChecked.join() === 'Single image' && s.human.checked && s.count === '2', 'Lifestyle again: Single image and human presence on, as left');
  r = await submit();
  ok(r.p.styling.human === true && r.a7.brief.preferences.people === 'one' && r.a7.brief.outputs.length === 2, 'Lifestyle again: one person, 2 images');
  await results();

  // 11. A draft that still carries plants, mood, catalogue and a Left side camera opens without them.
  await page.evaluate(() => { localStorage.setItem('midas.a7p2.draft', JSON.stringify({ brief: { outcome: 'Lifestyle', series: 'Views by light', camera: 'Left side', plants: true, mood: 'Bold & expressive', catalogue: true, view: 'Wide view' }, savedAt: Date.now() })); });
  await page.reload(); await page.waitForSelector('#aspect');
  s = await state();
  ok(s.seriesChecked.join() === 'Single image' && s.count === '2', 'an older draft with Views by light opens as Single image (the series is Coming later)');
  await page.setInputFiles('#photo', { name: 'sofa.png', mimeType: 'image/png', buffer: PNG });
  r = await submit();
  ok(r.p.scope.camera === 'Reference view' && r.p.scope.series === 'Single image' && r.a7.brief.outputs.length === 2, 'the draft\'s Left side camera and series are never sent');
  s = await state();
  ok(s.cameraChecked.join() === 'Reference view', 'the draft\'s Left side camera opens as "As photographed"');
  await results();

  // 12. Across every payload: plants, mood and catalogue never sent; Left side and Right side never sent as a value.
  ok(payloads.every(p => !keysOf(p).some(k => /^(plants|mood|catalogue)$/.test(k))), 'plants, mood and catalogue absent from all ' + payloads.length + ' payloads');
  ok(payloads.every(p => !/Left side|Right side/.test(JSON.stringify(p))), 'Left side and Right side never sent in any payload');
  ok(payloads.every(p => !p.scope.series || p.scope.series === 'Single image' || p.scope.camera === 'Reference view'), 'no series is sent with a camera other than Reference view');
  ok(payloads.every(p => !('camera' in p.metadata)), 'metadata.camera is no longer sent (the camera view travels in scope.camera)');

  // 13. Client-visible text: no internal terms in any state; "Approved" only from a recorded decision (none in mock "passed").
  const texts = [];
  texts.push(await visibleText());
  await tab('White BK'); texts.push(await visibleText());
  await tab('Website'); texts.push(await visibleText());
  await tab('Lifestyle'); await submit(); await results(); texts.push(await visibleText());
  await page.evaluate(() => { location.hash = ''; }); await page.waitForTimeout(200); texts.push(await visibleText());
  const hits = texts.map(x => (x.match(FORBIDDEN) || [''])[0]).filter(Boolean);
  ok(!hits.length, 'no internal terms in the visible page text (6 states): ' + hits.join(', '));
  const resultText = await page.evaluate(() => document.getElementById('ws-right').innerText);
  ok(!/approved/i.test(resultText.replace(/awaiting approval/gi, '')), 'mock result: "Approved" is not shown without a recorded decision');
  ok(texts.every(x => !/\b(\d+\s*(minutes?|hours?|days?)|\d{3,4}\s*(px|pixels)|stylist)\b/i.test(x)), 'no delivery time, pixel size or stylist promised in the visible text');

  // 14. RTL: the brief renders right to left; the image list and the side note mirror.
  await page.evaluate(() => { location.hash = '#studio'; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const rtl = await page.evaluate(() => ({ pad: getComputedStyle(document.getElementById('count-list')).paddingRight, border: getComputedStyle(document.getElementById('count-made')).borderRightWidth }));
  ok(parseFloat(rtl.pad) > 0 && parseFloat(rtl.border) >= 3, 'RTL: the image list indents on the right and the note\'s bar is on the right (' + rtl.pad + ', ' + rtl.border + ')');
  if (SHOTS) await page.locator('#card-count').screenshot({ path: path.join(SHOTS, 'claude-a7-page2-count-rtl.png') }).catch(() => {});
  // Every http(s) request is aborted by this test. The only ones the page may even try are the Google Fonts stylesheet and fonts.
  const others = requests.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  ok(!others.length, 'mock mode: no request to anything but Google Fonts, and those were blocked (' + requests.length + ' font requests; other: ' + others.join(', ') + ')');
  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  if (process.env.SHOW_EXAMPLES === '1') console.log(JSON.stringify({ threeViews, viewsByLight }, null, 1));
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
