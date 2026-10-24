// Mock-mode check of the A7 client page draft (claude-outputs/claude-midas-a7-page), 16 Oct 2026.
// Opens the page from disk in headless Chromium with ?mock=1 (nothing leaves the browser), works the brief like a client, and reads
// what the page would send (window.MIDAS_STUDIO_MOCK.lastPayload). Then passes each payload through A7's own "01 Intent & scope"
// code to show which images A7 would plan. No network, no n8n, no paid call.
// Run: node tests/claude-midas-a7-page/run_page_mock.js [folder for screenshots]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
// The page runs from a scratch copy of its folder, with a stand-in for the hero picture (a test fixture), because mock results
// reuse the hero picture and the real one is not kept in the repo. The page folder itself is not changed.
const os = require('os');
const SRC = path.join(ROOT, 'claude-outputs', 'claude-midas-a7-page');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-a7-page-'));
for (const f of ['index.html', 'styles.css', 'app.js']) fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
fs.copyFileSync(path.join(ROOT, 'tests', 'claude-midas-a7-stage-06', 'fixtures', 'out_1125.webp'), path.join(TMP, 'atelier-hero.webp'));
const PAGE = path.join(TMP, 'index.html');
const SHOTS = process.argv[2] || '';
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
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/atelier-hero|taxonomy|ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + PAGE + '?mock=1#studio');
  await page.waitForSelector('#aspect');
  const tab = async name => { await page.click('#outcome-tabs label:has-text("' + name + '")'); };
  const view = async v => { await page.click('#view-choices label:has(input[value="' + v + '"])'); };
  const state = () => page.evaluate(() => ({
    select: { disabled: document.getElementById('aspect').disabled, value: document.getElementById('aspect').value,
      options: [...document.getElementById('aspect').options].map(o => ({ v: o.value, t: o.textContent, g: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '' })) },
    count: document.getElementById('val-count').textContent,
    list: [...document.querySelectorAll('#count-list li')].map(li => li.textContent),
    hint: document.getElementById('brief-hint').textContent,
    submit: document.getElementById('submit-count').textContent,
    valAspect: document.getElementById('val-aspect').textContent,
    valView: document.getElementById('val-view').textContent,
    viewLocked: [...document.querySelectorAll('#view-choices input')].every(i => i.disabled),
    viewNote: !document.getElementById('view-note').hidden,
    viewCard: !document.getElementById('card-view').hidden
  }));
  const submit = async () => {
    await page.click('#submit-btn');
    await page.waitForFunction(() => window.MIDAS_STUDIO_MOCK && window.MIDAS_STUDIO_MOCK.lastPayload);
    const p = await page.evaluate(() => { const x = window.MIDAS_STUDIO_MOCK.lastPayload; window.MIDAS_STUDIO_MOCK.lastPayload = null; return x; });
    await page.waitForSelector('#view-progress:not([hidden])', { timeout: 15000 });   // the new request is in production
    return p;
  };
  const newRequest = async () => {   // back to an empty result stage, with the photo and the brief kept
    await page.waitForSelector('#view-results:not([hidden])', { timeout: 15000 });
  };

  // 1. The shape list: one select, nine shapes grouped, "Standard for category" first and selected.
  let s = await state();
  ok(s.select.options.length === 10 && s.select.options[0].v === 'standard' && s.select.options[0].t === 'Standard for category (Square 1:1)' && s.select.value === 'standard', 'shape list: Standard for category (Square 1:1) first and selected');
  const groups = s.select.options.slice(1).reduce((m, o) => { (m[o.g] = m[o.g] || []).push(o.v); return m; }, {});
  ok(JSON.stringify(groups) === JSON.stringify({ Square: ['1:1'], Portrait: ['4:5', '3:4', '2:3', '9:16'], Landscape: ['5:4', '4:3', '3:2', '16:9'] }), 'shape list: grouped Square, Portrait (4:5, 3:4, 2:3, 9:16), Landscape (5:4, 4:3, 3:2, 16:9)');
  ok(!s.select.disabled && s.count === '4' && s.list.join('|') === 'Catalogue on white|Hero|Wide view|Close-up (detail)', 'Lifestyle + Category template: 4 images listed before submit');

  await page.setInputFiles('#photo', { name: 'sofa.png', mimeType: 'image/png', buffer: PNG });
  if (SHOTS) await page.locator('#card-view').screenshot({ path: path.join(SHOTS, 'claude-a7-page-lifestyle-views.png') }).catch(() => {});
  s = await state();
  ok(/Expect 4 images/.test(s.hint) && s.submit === '4 images', 'Lifestyle + Category template: the hint and the button say 4 images');

  // 2. Views → images.
  const expectList = { 'Wide view': ['2', 'Catalogue on white|Wide view'], 'Close-up': ['2', 'Catalogue on white|Close-up (detail)'], 'Wide view + close-up': ['3', 'Catalogue on white|Wide view|Close-up (detail)'], 'Category template': ['4', 'Catalogue on white|Hero|Wide view|Close-up (detail)'] };
  for (const [v, [n, l]] of Object.entries(expectList)) { await view(v); s = await state(); ok(s.count === n && s.list.join('|') === l && s.submit === n + ' images', 'view ' + v + ' → ' + n + ' images: ' + l); }

  // 3. White BK: shape disabled and shown in words; the view does not apply; 1 image.
  await tab('White BK');
  s = await state();
  ok(s.select.disabled && s.select.options.length === 1 && s.select.options[0].t === 'White catalogue is always 1:1' && s.valAspect === 'White catalogue is always 1:1', 'White BK: shape disabled, shows "White catalogue is always 1:1"');
  ok(s.viewLocked && s.viewNote && s.valView === 'Not applied on white' && s.count === '1' && s.list.join() === 'Catalogue on white' && /Expect 1 image/.test(s.hint), 'White BK: views locked with a note; 1 image');
  ok(await page.evaluate(() => [...document.querySelectorAll('#view-choices input')].every(i => !i.checked)), 'White BK: no view shown as chosen');
  if (SHOTS) { await page.locator('#card-view').screenshot({ path: path.join(SHOTS, 'claude-a7-page-white-views.png') }).catch(() => {}); await page.locator('#card-aspect').screenshot({ path: path.join(SHOTS, 'claude-a7-page-white-shape.png') }).catch(() => {}); }
  let p = await submit();
  ok(p.scope.aspect === '1:1' && p.scope.view === '' && p.scope.imageCount === 1 && p.metadata.delivery.aspect === '1:1', 'White BK sends aspect 1:1, no view, 1 image');
  let a7 = await intake(p);
  ok(a7.brief.outputs.map(o => o.id).join() === 'white_master' && a7.brief.proportions === '1:1' && !a7.not_applied.some(x => /View/.test(x)), 'A7 reads the White BK request: white master only, no note');
  await newRequest();

  // 4. Back to Lifestyle: the shape list returns with the client's own choice; pick 9:16 and Wide view + close-up.
  await tab('Lifestyle');
  s = await state();
  ok(!s.select.disabled && s.select.options.length === 10 && s.select.value === 'standard', 'Lifestyle again: the shape list returns, Standard still chosen');
  ok(await page.evaluate(() => document.querySelector('#view-choices input[value="Category template"]').checked && ![...document.querySelectorAll('#view-choices input')].some(i => i.disabled)), 'Lifestyle again: the view chosen before White BK is shown again, unlocked');
  await page.selectOption('#aspect', '9:16'); await view('Wide view + close-up');
  s = await state();
  ok(s.valAspect === 'Portrait · 9:16' && s.count === '3', 'Lifestyle: 9:16 chosen, 3 images');
  if (SHOTS) { await page.locator('#card-aspect').screenshot({ path: path.join(SHOTS, 'claude-a7-page-lifestyle-shape.png') }).catch(() => {}); await page.locator('#card-count').screenshot({ path: path.join(SHOTS, 'claude-a7-page-lifestyle-count.png') }).catch(() => {}); }
  p = await submit();
  ok(p.scope.aspect === '9:16' && p.scope.view === 'Wide view + close-up' && p.scope.imageCount === 3 && p.scope.outcome === 'Lifestyle', 'Lifestyle sends the bare shape 9:16, the view and 3 images');
  a7 = await intake(p);
  ok(a7.brief.outputs.map(o => o.id).join() === 'white_master,wide,detail' && a7.brief.proportions === '9:16' && a7.brief.proportions_source === 'aspect' && !a7.not_applied.some(x => /shape|view|image\(s\)|capped/i.test(x)) && a7.not_applied.some(x => /^Plants: not offered/.test(x)), 'A7 plans white master, wide and detail at 9:16, with no note on shape, view or count; the page\'s Plants switch is listed back as not applied (16 Oct 2026, F2)');
  await newRequest();
  const shots = await page.evaluate(() => [...document.querySelectorAll('#results-grid .shot__title')].map(h => h.textContent));
  ok(shots.join('|') === 'Image 1, catalogue on white|Image 2, wide view|Image 3, close-up (detail)', 'mock result: three images, titled by view: ' + shots.join('|'));
  const ratio = await page.evaluate(() => { const img = document.querySelector('#results-grid .shot__fig:not(.shot__fig--original) img'); return img ? img.style.getPropertyValue('--ratio') : ''; });
  ok(/9 \/ 16|\d+ \/ \d+/.test(ratio), 'mock result: picture frame uses the sent shape until the image loads (' + ratio + ')');
  const labels = await page.evaluate(() => [...document.querySelectorAll('#results-grid .tag--ink')].map(x => x.textContent));
  ok(labels.length === 3 && labels.every(x => x === 'Generated image'), 'mock result: every image labelled "Generated image"');

  // 5. Standard for category is sent as 1:1; every other shape as itself.
  for (const v of ['standard', '1:1', '4:5', '3:4', '2:3', '5:4', '4:3', '3:2', '16:9']) {
    await page.selectOption('#aspect', v); await view('Close-up');
    p = await submit();
    a7 = await intake(p);
    const want = v === 'standard' ? '1:1' : v;
    ok(p.scope.aspect === want && a7.brief.proportions === want && a7.brief.outputs.map(o => o.id).join() === 'white_master,detail', 'shape ' + v + ' → sent ' + p.scope.aspect + ' → A7 ' + a7.brief.proportions + ', white master + detail');
    await newRequest();
  }

  // 6. Website: square, set for the package; views hidden; 4 images.
  await tab('Website');
  s = await state();
  ok(s.select.disabled && s.select.value === '1:1' && /set for Website/.test(s.valAspect) && !s.viewCard && s.count === '4', 'Website: square and locked, views hidden, 4 images');
  p = await submit();
  a7 = await intake(p);
  ok(p.scope.aspect === '1:1' && p.scope.view === 'Category template' && p.scope.imageCount === 4 && a7.brief.outputs.map(o => o.id).join() === 'white_master,hero,wide,detail' && !a7.not_applied.some(x => /shape|view|image\(s\)|capped/i.test(x)), 'Website sends 1:1 and 4 images; A7 plans white master, hero, wide, detail, with no note on shape, view or count');
  await newRequest();

  // 7. A draft saved by the earlier page (labels) is read as bare values; client-visible text has no internal terms.
  await page.evaluate(() => { localStorage.setItem('midas.a7.draft', JSON.stringify({ brief: { outcome: 'Lifestyle', view: 'Wide view', aspect: 'Portrait · 4:5' }, savedAt: Date.now() })); });
  await page.reload(); await page.waitForSelector('#aspect');
  s = await state();
  ok(s.select.value === '4:5' && s.count === '2', 'an older draft with "Portrait · 4:5" opens as 4:5; Wide view → 2 images');
  const text = await page.evaluate(() => document.body.innerText);
  ok(!/\b(n8n|Eye|Brain|Critic|Gemini|OpenAI|fal\.ai|Claude|A7)\b/.test(text), 'no internal terms in the visible page text');

  // 8. RTL: the same brief renders right to left without errors.
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  if (SHOTS) await page.locator('#card-count').screenshot({ path: path.join(SHOTS, 'claude-a7-page-count-rtl.png') }).catch(() => {});
  const pad = await page.evaluate(() => getComputedStyle(document.getElementById('count-list')).paddingRight);
  ok(parseFloat(pad) > 0, 'RTL: the image list indents on the right (' + pad + ')');
  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
