// Mock-mode check of the A7 client page draft 3 (claude-outputs/claude-midas-a7-page-3), 17 Oct 2026 (Phase 5, P5.4).
// Opens the page from a scratch copy in headless Chromium with ?mock=1. Every http(s) request is aborted, fonts included,
// and every attempt is recorded. Works the brief like a client, reads what the page would send
// (window.MIDAS_STUDIO_MOCK.lastPayload), and passes each payload through A7's own "01 Intent & scope" and "02 Ingest files"
// code (read only, from n8n/claude-midas-a7/code-nodes; identical to A7 draft eefd6c42 on 17 Oct 2026). Then checks the result
// view against the mock of the result contract (result-contract.md), at 1280 px and 375 px, with the keyboard, labels and RTL.
// No network, no n8n, no paid call. Run: node tests/claude-midas-a7-page/run_page3_mock.js [folder for screenshots]
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
// CLAUDE_A7_PAGE_SRC runs the same checks on a copy of draft 3 (the owner studio, Claude-final-midas-a7), in its mock mode.
const SRC = process.env.CLAUDE_A7_PAGE_SRC ? path.resolve(process.env.CLAUDE_A7_PAGE_SRC) : path.join(ROOT, 'claude-outputs', 'claude-midas-a7-page-3');
const CONNECTED_COPY = process.env.CLAUDE_A7_PAGE_CONNECTED === '1';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-a7-page3-'));
for (const f of ['index.html', 'styles.css', 'app.js', 'taxonomy.js', 'owner-link.js']) if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
fs.mkdirSync(path.join(TMP, 'fonts'));
for (const f of fs.readdirSync(path.join(SRC, 'fonts'))) fs.copyFileSync(path.join(SRC, 'fonts', f), path.join(TMP, 'fonts', f));
fs.mkdirSync(path.join(TMP, 'sample'));
for (const f of fs.readdirSync(path.join(SRC, 'sample'))) fs.copyFileSync(path.join(SRC, 'sample', f), path.join(TMP, 'sample', f));
// The page is served from a private test address that never reaches the network: every request to it is answered from the
// scratch copy, and every other request is aborted and recorded. A real origin lets the page read its own pixels (the cut-out).
const ORIGIN = 'https://studio.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const PAGE = path.join(TMP, 'index.html');
const SHOTS = process.argv[2] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const CODE = path.join(ROOT, 'n8n', 'claude-midas-a7', 'code-nodes');

let pass = 0, failN = 0;
const fails = [];
function ok(cond, name) { if (cond) pass++; else { failN++; fails.push(name); console.log('FAIL: ' + name); } }
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const FILE = { name: 'sofa-vendor.png', mimeType: 'image/png', buffer: PNG };

// A7's own code, run as n8n runs a Code node. Read only.
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
async function intake(payload) {
  const code = fs.readFileSync(path.join(CODE, '01_Intent_scope.js'), 'utf8');
  const item = { json: { body: { payload: JSON.stringify(payload) } }, binary: { files: { fileName: (payload.references && payload.references[0] && payload.references[0].name) || FILE.name, mimeType: FILE.mimeType } } };
  const fn = new AsyncFn('$', '$input', '$execution', 'require', code);
  return (await fn.call({}, () => { throw new Error('no node'); }, { first: () => item, all: () => [item] }, {}, require))[0];
}
async function ingest(first) {   // 02 reads the binary files and the reference roles 01 kept
  const code = fs.readFileSync(path.join(CODE, '02_Ingest_files.js'), 'utf8');
  const fn = new AsyncFn('$input', 'require', code);
  const ctx = { helpers: { getBinaryDataBuffer: async () => PNG } };
  return (await fn.call(ctx, { first: () => first }, require))[0].json;
}
function keysOf(x, out) { out = out || []; if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.push(k); keysOf(x[k], out); } return out; }
const FORBIDDEN = /\b(eye|brain|critic|n8n|a7|go 1|go 2|pipeline|workflow|model|models|openai|gpt|gemini|claude|anthropic|fal|flux|sonnet|seedream|imagen|midjourney|dall-e|stable diffusion|not reviewed)\b/i;
const PROMISE = /\b(within|in under|in about)\s+\d+\s*(seconds|minutes|hours|days)\b|\b\d{3,5}\s?(px|pixels)\b|\b\d{3,5}\s?x\s?\d{3,5}\b|\bstylist\b|\bkept for\b|\bdeleted after\b|\bstored for\b/i;
const LATER_KEYS = ['plants', 'mood', 'catalogue', 'hero', 'midasPicks', 'roomBrief', 'room', 'side', 'catalogueReferences'];

(async () => {
  // ---- static checks: draft 2 unchanged, taxonomy unchanged, mock only, no addresses
  let draft2Clean = false;
  try { execFileSync('git', ['-C', ROOT, 'diff', '--quiet', 'HEAD', '--', 'claude-outputs/claude-midas-a7-page-2']); draft2Clean = true; } catch (e) { draft2Clean = false; }
  ok(draft2Clean, 'page draft 2 is unchanged against the last commit');
  ok(sha(path.join(SRC, 'taxonomy.js')) === sha(path.join(ROOT, 'claude-outputs', 'claude-midas-studio-site-a6-go', 'site', 'taxonomy.js')), 'taxonomy.js is an unchanged copy');
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
  if (!CONNECTED_COPY) {
    ok(/connect-src 'none'/.test(html) && !/googleapis|gstatic/.test(html), 'CSP: connect-src is none, and no font host');
    ok(/signInUrl: ''/.test(js) && /submitUrl: ''/.test(js) && /statusUrl: ''/.test(js) && /mock: true/.test(js), 'no addresses in STUDIO_CONFIG and mock is on');
  } else {   // the owner studio: same origin only, no outside address anywhere in the page
    ok(/connect-src 'self'/.test(html) && !/connect-src[^;"]*https?:/.test(html) && !/googleapis|gstatic/.test(html), 'owner studio CSP: connect-src is this site only, and no font host');
    ok(/signInUrl: ''/.test(js) && /submitUrl: ''/.test(js) && /statusUrl: ''/.test(js) && /connected: true/.test(js) && !/https?:\/\/(?!drive\.google\.com\/file|www\.w3\.org\/2000\/svg)/.test(js.replace(/\/\*[\s\S]*?\*\//g, '')), 'owner studio: no outside address in the code');
  }
  ok(!/strings-ar/.test(html), 'the Arabic draft is not loaded by the page');
  ok(!/(api[_-]?key|token|secret|X-Midas-Key)\s*[:=]\s*['"][^'"]+/i.test(js + html), 'no key, token or secret in the page files');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) errors.push('missing file: ' + r.url()); });
  page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(ORIGIN)) requests.push(r.url()); });
  await page.route(/^https?:/, route => {
    const url = route.request().url();
    if (!url.startsWith(ORIGIN)) return route.abort();
    const file = path.join(TMP, decodeURIComponent(new URL(url).pathname));
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto(ORIGIN + 'index.html?mock=1');
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

  // ---- the closed screen, then open it with the keyboard
  ok(await page.isVisible('#view-signin') && await page.isHidden('#view-app'), 'the closed screen shows first');
  await shot('01-closed');
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'mock-open'); }
  ok(reached, 'keyboard: Tab reaches "Open the studio"');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#view-app:not([hidden])');
  ok(await page.isHidden('#view-signin'), 'the screen opens');

  // ---- helpers
  const choose = async (name, v) => { await page.click('label:has(> input[name="' + name + '"][value="' + v + '"])'); };
  const fill = async (sel, v) => { await page.fill(sel, v); };
  const submit = async () => {
    await page.click('#submit-btn');
    await page.waitForFunction(() => window.MIDAS_STUDIO_MOCK && window.MIDAS_STUDIO_MOCK.lastPayload);
    const p = await page.evaluate(() => { const x = window.MIDAS_STUDIO_MOCK.lastPayload; window.MIDAS_STUDIO_MOCK.lastPayload = null; return x; });
    await page.waitForSelector('#view-progress:not([hidden])', { timeout: 15000 });
    return p;
  };
  const backToBrief = async () => { await page.click('#view-results [data-action="request-change"]'); await page.waitForSelector('#view-plan:not([hidden])'); };
  const waitResults = async () => page.waitForSelector('#view-results:not([hidden])', { timeout: 20000 });
  const setMock = async (id, v) => { await page.selectOption('#' + id, v); };
  const cleanNotes = r => r.json.not_applied;
  const payloads = [];
  async function run(label, expect) {
    const p = await submit();
    payloads.push([label, p]);
    const one = await intake(p);
    const j = one.json;
    ok(j.usable === 'ok', label + ': 01 accepts it (' + j.problems.join(' ') + ')');
    ok(cleanNotes(one).length === 0, label + ': 01 lists nothing as not applied (' + cleanNotes(one).join(' | ') + ')');
    ok(p.scope.imageCount === j.brief.outputs.length, label + ': the page counts ' + p.scope.imageCount + ', 01 plans ' + j.brief.outputs.length);
    if (expect) expect(p, j.brief);
    const two = await ingest(one);
    ok(two.usable === 'ok' && two.product_key === 'files' && !two.room_key, label + ': 02 registers the photo as the product, no room photo');
    ok(!two.not_applied.some(n => /no role|not used/i.test(n)), label + ': 02 finds a role for every file');
    const keys = keysOf(p);
    ok(!LATER_KEYS.some(k => keys.includes(k)), label + ': nothing "Coming later" is sent (' + LATER_KEYS.filter(k => keys.includes(k)).join(',') + ')');
    await waitResults();
    await backToBrief();
    return { p, brief: j.brief };
  }

  // ---- validation before a photo: keyboard submit shows the error summary
  await page.focus('#submit-btn'); await page.keyboard.press('Enter');
  ok(await page.isVisible('#brief-errors') && await page.evaluate(() => document.activeElement.id === 'brief-errors'), 'no photo: the error summary shows and takes focus');
  ok(await page.isVisible('#photo-error'), 'no photo: the error shows beside the field');
  ok(await page.evaluate(() => !window.MIDAS_STUDIO_MOCK.lastPayload), 'no photo: nothing is sent');
  await page.waitForFunction(() => document.querySelectorAll('#count-list .frame__product').length > 0);
  ok(await page.$$eval('#count-list .frame__product', l => l.every(i => i.getAttribute('src') === 'sample/fauva-169741.webp' && i.complete && i.naturalWidth > 0)), 'before a photo: the frames show the sample product');
  ok(/sample Midas product.*SKU 169741/.test(await page.textContent('#plan-sample')), 'before a photo: the sample is named as a sample');
  await page.setInputFiles('#photo', path.join(__dirname, 'fixtures', 'product-on-white.png'));
  await page.waitForFunction(() => { const i = document.querySelector('#count-list .frame__product'); return i && i.src.startsWith('data:image/png'); }, null, { timeout: 10000 });
  const cut = await page.evaluate(async () => {
    const im = new Image(); im.src = document.querySelector('#count-list .frame__product').src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const at = (px, py) => x.getImageData(Math.round(px * c.width), Math.round(py * c.height), 1, 1).data;
    return { corner: at(0.01, 0.99)[3], cushion: Array.from(at(0.5, 0.25)), w: c.width, h: c.height };
  });
  ok(cut.w < 300 && cut.h < 300, 'your photo on white: cropped to the product (' + cut.w + ' x ' + cut.h + ')');
  ok(cut.cushion[3] === 255 && cut.cushion[0] > 230, 'your photo on white: white inside the product is kept');
  ok(/Shown with your photo/.test(await page.textContent('#plan-sample')), 'after a photo: the plan says it shows your photo');
  ok(await page.isVisible('#photo-preview'), 'photo added');

  // ---- Lifestyle defaults
  await run('Lifestyle default', (p, b) => {
    ok(JSON.stringify(b.outputs.map(o => o.id)) === '["white_master","hero"]', 'default plans white + hero');
    ok(p.scope.camera === 'Reference view' && p.scope.series === 'Single image', 'default camera and series');
    ok(p.metadata.hero === undefined, 'hero item is not sent');
    ok(b.preferences.people === 'none', 'human presence off: people none');
  });
  ok(await page.evaluate(() => document.querySelectorAll('#count-list .frame').length) === 2, 'the plan draws 2 frames');

  // ---- views
  for (const [v, ids] of [['Wide view', 'white_master,wide'], ['Close-up', 'white_master,detail'], ['Wide view + close-up', 'white_master,wide,detail'], ['Category template', 'white_master,hero']]) {
    await choose('view', v);
    const frames = await page.evaluate(() => document.querySelectorAll('#count-list .frame').length);
    ok(frames === ids.split(',').length, 'view ' + v + ': the plan draws ' + frames + ' frames');
    await run('View ' + v, (p, b) => ok(b.outputs.map(o => o.id).join(',') === ids, 'view ' + v + ': 01 plans ' + ids));
  }
  // ---- cameras
  for (const c of ['Full frontal', '45° right', 'Reference view']) {
    await choose('camera', c);
    await run('Camera ' + c, (p, b) => ok(b.outputs.filter(o => o.kind !== 'white').every(o => o.camera === c) && b.camera_view === c, 'camera ' + c + ' reaches every scene image'));
  }
  // ---- Coming later controls cannot be chosen
  for (const name of ['series-later', 'camera-later', 'outcome-later']) {
    const all = await page.$$eval('input[name="' + name + '"]', list => list.map(i => i.disabled));
    ok(all.length > 0 && all.every(Boolean), name + ': every choice is disabled');
    await page.$$eval('input[name="' + name + '"]', list => list.forEach(i => i.click()));
    ok(await page.$$eval('input[name="' + name + '"]', list => list.every(i => !i.checked)), name + ': a forced click selects nothing');
  }
  ok(await page.$$eval('#refs-later input, #touches-later input, #later-hero input', l => l.length) === 0, 'room photo, side photos, plants, mood, pieces and hero item have no input');

  // ---- shapes, lighting, wall, floor, human, studio choice
  for (const a of ['1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9', 'standard']) {
    await page.selectOption('#aspect', a);
    const ratio = await page.$eval('#count-list .frame:last-child', n => n.style.getPropertyValue('--ratio'));
    ok(a === 'standard' ? ratio === '1 / 1' : ratio === a.replace(':', ' / '), 'shape ' + a + ': the scene frame is drawn at ' + ratio);
    if (['4:5', '16:9', 'standard'].includes(a)) await run('Shape ' + a, (p, b) => ok(b.proportions === (a === 'standard' ? '1:1' : a), 'shape ' + a + ': 01 reads ' + b.proportions));
  }
  for (const [l, key] of [['Soft daylight', 'day'], ['Golden afternoon', 'warm'], ['Warm evening', 'night']]) {
    await choose('lighting', l);
    ok(await page.$eval('#count-list .frame:last-child .frame__set', n => n.dataset.light) === key, 'lighting ' + l + ': the frame shows ' + key);
  }
  await choose('wallPaint', 'Sage'); await choose('floor', 'Marble');
  await page.click('label.switch:has(#human)');
  await run('Setting', (p, b) => {
    ok(b.preferences.light_preset === 'night' && b.preferences.wall === 'Sage' && b.preferences.floor === 'Marble', 'lighting, wall and floor reach 01');
    ok(b.preferences.people === 'one', 'human presence on: people one');
  });
  await page.click('label.switch:has(#studio-choice)');
  ok(await page.$$eval('input[name="lighting"], input[name="wallPaint"], input[name="floor"]', l => l.every(i => i.disabled)), 'studio choice locks lighting, wall and floor');
  await run('Studio choice', (p, b) => ok(b.preferences.use_defaults === true && !b.preferences.lighting && !b.preferences.wall && !b.preferences.floor, 'studio choice: defaults on, nothing chosen'));
  await page.click('label.switch:has(#studio-choice)');
  await page.click('label.switch:has(#human)');

  // ---- new fields 01 reads (P5.2)
  await fill('#sku', 'MF-TEST-0001'); await fill('#dimensions', '220 x 95 x 80 cm');
  await page.click('#pieces-add'); await fill('#pieces-list li:nth-child(1) input[data-field="count"]', '4'); await fill('#pieces-list li:nth-child(1) input[data-field="item"]', 'dining chairs');
  await page.click('#pieces-add'); await fill('#pieces-list li:nth-child(2) input[data-field="item"]', 'table');
  await fill('#color', 'Navy velvet'); await fill('#material', 'Velvet and brushed brass');
  await fill('#locks', 'Brass trim on the arms\nScalloped side panel');
  await fill('#must-not', 'The vase in the photo');
  await fill('#about', 'Legs are solid brass.');
  await fill('#instructions', 'Keep the room calm and uncluttered.');
  await run('New fields', (p, b) => {
    ok(b.sku === 'MF-TEST-0001' && b.dimensions === '220 x 95 x 80 cm', 'SKU and dimensions reach 01');
    ok(JSON.stringify(b.inventory) === '[{"item":"dining chairs","count":4},{"item":"table","count":1}]' && b.inventory_total === 5, 'pieces reach 01 as inventory (5 in all)');
    ok(b.colour === 'Navy velvet' && b.material === 'Velvet and brushed brass', 'colour and material reach 01');
    ok(JSON.stringify(b.exclusions) === '["The vase in the photo"]', 'things to exclude reach 01');
    ok(b.product_notes === 'Legs are solid brass.', 'about the product reaches 01 as product notes');
    ok(b.instructions.startsWith('Keep the room calm and uncluttered.') && b.instructions.includes('Brass trim on the arms; Scalloped side panel'), 'instructions and details to preserve reach 01 together');
  });
  // a piece with no valid count blocks the request
  await fill('#pieces-list li:nth-child(2) input[data-field="count"]', '0');
  await page.click('#submit-btn');
  ok(await page.isVisible('#pieces-error') && await page.isVisible('#brief-errors'), 'a piece count of 0 shows an error');
  ok(await page.evaluate(() => !window.MIDAS_STUDIO_MOCK.lastPayload), 'a piece count of 0: nothing is sent');
  await fill('#pieces-list li:nth-child(2) input[data-field="count"]', '1');
  // longest texts: every detail to preserve survives 01's 1,200-character limit, or the page refuses to send
  const lockLines = Array.from({ length: 12 }, (_, i) => ('Detail ' + (i + 1) + ' ').padEnd(44, 'x'));
  await fill('#instructions', 'i'.repeat(500)); await fill('#locks', lockLines.join('\n'));
  await run('Longest texts', (p, b) => ok(b.instructions.includes(lockLines[11].trim()) && b.instructions.length <= 1200, 'the last detail to preserve survives (' + b.instructions.length + ' characters)'));
  await fill('#locks', Array.from({ length: 280 }, (_, i) => 'k' + (i % 10)).join('\n').slice(0, 600));
  await page.click('#submit-btn');
  ok(await page.isVisible('#brief-errors') && /too long together/.test(await page.textContent('#brief-errors')), 'too long together: the page refuses with a plain error');
  ok(await page.evaluate(() => !window.MIDAS_STUDIO_MOCK.lastPayload), 'too long together: nothing is sent');
  await fill('#instructions', ''); await fill('#locks', ''); await fill('#about', ''); await fill('#must-not', '');
  await fill('#locks', 'x'.repeat(170)); await page.click('#submit-btn');
  ok(/longer than 160 characters/.test(await page.textContent('#brief-errors')) && await page.evaluate(() => !window.MIDAS_STUDIO_MOCK.lastPayload), 'a detail over 160 characters is refused, never cut');
  await fill('#locks', ''); await fill('#must-not', 'y'.repeat(90)); await page.click('#submit-btn');
  ok(/longer than 80 characters/.test(await page.textContent('#brief-errors')) && await page.evaluate(() => !window.MIDAS_STUDIO_MOCK.lastPayload), 'a thing to exclude over 80 characters is refused, never cut');
  await fill('#must-not', '');
  await page.evaluate(() => { const input = document.getElementById('photo'); const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([1, 2])], 'no-type.jpg', { type: '' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(/has no file type/.test(await page.textContent('#photo-error')) && await page.$eval('#photo-name', n => n.textContent) === 'product-on-white.png', 'a file with no type is refused; the photo stays');

  // ---- White BK and Website
  await page.click('label:has(> input[name="outcome"][value="White BK"])');
  ok(await page.$$eval('input[name="view"], input[name="camera"], input[name="series"]', l => l.every(i => i.disabled)), 'White BK locks views, camera and series');
  ok(await page.isHidden('#card-lighting') && await page.isHidden('#card-atmosphere'), 'White BK hides lighting and the studio-choice switch');
  await run('White BK', (p, b) => {
    ok(b.outputs.map(o => o.id).join() === 'white_master', 'White BK: 01 plans the white master only');
    ok(p.scope.camera === undefined && p.scope.series === undefined && p.styling === undefined, 'White BK: no camera, series or styling sent');
    ok(p.preferences.lighting === '' && p.preferences.useWorkflowDefaults === false && !b.preferences.lighting, 'White BK: no lighting sent (01 gives the white image no light)');
  });
  await page.click('label:has(> input[name="outcome"][value="Website"])');
  await run('Website', (p, b) => {
    ok(b.outputs.map(o => o.id).join() === 'white_master,hero,wide,detail', 'Website: 01 plans 4 images');
    ok(p.scope.aspect === '1:1' && p.scope.resolution === '2K', 'Website: square and 2K');
  });
  await page.click('label:has(> input[name="outcome"][value="Lifestyle"])');
  await choose('view', 'Wide view + close-up');
  await page.selectOption('#aspect', '4:5');
  await shot('02-brief-1280');

  // ---- results against the mock contract
  const view = () => page.evaluate(() => ({
    title: document.getElementById('results-title').textContent,
    lead: document.getElementById('results-lead').textContent,
    pkg: document.getElementById('results-package').textContent,
    pills: [...document.querySelectorAll('#results-grid .pill')].map(n => n.textContent),
    generated: [...document.querySelectorAll('#results-grid .shot')].map(s => !!s.querySelector('.shot__fig:not(.shot__fig--original) .tag') && s.querySelector('.shot__fig:not(.shot__fig--original) .tag').textContent),
    imgs: [...document.querySelectorAll('#results-grid .shot')].map(s => s.querySelectorAll('.shot__fig:not(.shot__fig--original) img').length),
    srcs: [...document.querySelectorAll('#results-grid .shot__fig:not(.shot__fig--original) img')].map(i => i.getAttribute('src') || ''),
    text: document.getElementById('view-results').innerText
  }));
  async function result(scenario, check) {
    await setMock('mock-result', scenario);
    const p = await submit();
    await waitResults();
    const v = await view();
    check(v, p);
    const shots = v.generated.filter((g, i) => v.imgs[i] > 0);
    ok(shots.every(g => g === 'Generated image'), scenario + ': every picture says "Generated image"');
    if (SHOTS && ['approved_studio', 'not_made', 'bad_label'].includes(scenario)) await shot('03-result-' + scenario);
    await backToBrief();
    return v;
  }
  await result('passed', v => {
    ok(true, 'passed: shown');
    ok(v.title === 'Ready for review.', 'passed: Ready for review');
    ok(v.pills.every(x => x === 'Passed automatic checks') && !/\bApproved\b/.test(v.text.replace(/studio's approval/g, '')), 'passed: no image says Approved');
    ok(v.pkg.startsWith('Package incomplete'), 'passed: the package is incomplete');
  });
  await result('approved', v => {
    ok(v.title === 'Approved.' && v.pills.every(x => x === 'Approved') && v.pills.length === 3, 'approved: every image says Approved');
    ok(v.srcs.every(src => src.startsWith('data:image/jpeg')), 'mock pictures are drawn from the set and the product');
    ok(v.pkg === 'Package complete', 'approved: the package is complete, and nothing else is printed beside it (' + v.pkg + ')');
  });
  await result('approved_studio', v => {
    ok(v.pills.join('|') === 'Approved|Approved|Approved by the studio', 'approved by the studio: the label comes from client_shown_as');
    ok(!/not reviewed/i.test(v.text), 'approved by the studio: never "not reviewed"');
  });
  await result('approved_some', v => {
    ok(v.title === 'Ready for review.' && /1 of 3 images have the studio's approval/.test(v.lead), 'some approved: says how many');
    ok(v.pkg.startsWith('Package incomplete'), 'some approved: the package is incomplete');
  });
  await result('approved_open', v => ok(v.title === 'Partly approved.' && v.pkg.startsWith('Package incomplete'), 'all approved but the studio says the package is open: incomplete'));
  await result('not_made', v => {
    ok(v.pills[2] === 'Not made' && v.imgs[2] === 0, 'not made: labelled "Not made" and no picture');
    ok(/Why it was not made: It is made from image 2 of this request, which is on hold\./.test(v.text) && v.pills[1] === 'On hold', 'not made: a plain reason, and the image it depends on is on hold');
    ok(v.title === 'Partly ready.' && /1 image was not made\./.test(v.lead) && v.pkg.startsWith('Package incomplete'), 'not made: partly ready, never complete');
  });
  await result('partial', v => ok(v.title === 'Partly ready.' && v.pills[2] === 'On hold' && /Why it is on hold:/.test(v.text), 'partial: one on hold with its reason'));
  await result('hold', v => ok(v.title === 'On hold.' && v.pills.every(x => x === 'On hold'), 'hold: all on hold'));
  await result('changes', v => ok(v.title === 'Partly approved.' && v.pills[2] === 'The studio has asked for changes' && /brighter/.test(v.text), 'changes: the studio\'s note is shown'));
  await result('rejected', v => ok(v.pills.every(x => x === 'Not approved by the studio') && v.pkg.startsWith('Package incomplete'), 'rejected: not approved, incomplete'));
  await result('bad_label', v => {
    ok(!v.pills.some(x => /^Approved/.test(x)) && v.pills.every(x => x === 'Decision not readable'), 'unreadable label: never shown as approved');
    ok(v.pkg.startsWith('Package incomplete') && !/without an automated review/.test(v.text), 'unreadable label: incomplete, audit wording never shown');
  });
  await result('expired', v => ok(/This image link has expired/.test(v.text), 'expired link: a plain notice'));
  await page.click('label:has(> input[name="outcome"][value="Website"])');
  await result('website_complete', v => ok(v.pills.length === 4 && v.pkg.startsWith('Package complete'), 'Website complete: 4 approved, complete'));
  await result('website_incomplete', v => ok(v.pkg.startsWith('Package incomplete') && v.pills[3] === 'On hold', 'Website incomplete: never complete'));
  await page.click('label:has(> input[name="outcome"][value="Lifestyle"])');
  // arriving one by one: partial frames while in production, never complete
  await setMock('mock-result', 'arriving');
  await submit();
  await page.waitForSelector('#progress-sofar:not([hidden])', { timeout: 15000 });
  ok(/So far 1 of 3 images are ready\. The request is not complete yet\./.test(await page.textContent('#progress-sofar')), 'arriving: says how many so far, not complete');
  ok(await page.$$eval('#progress-frames .frame.is-back', l => l.length) === 1, 'arriving: one frame filled');
  ok(await page.$$eval('#progress-frames .frame.is-back figcaption', l => l.length === 1 && l[0].textContent === 'Generated image'), 'arriving: the picture says "Generated image"');
  ok(await page.isHidden('#view-results'), 'arriving: no result headline while in production');
  await shot('04-arriving');
  await waitResults();
  ok((await view()).title === 'Ready for review.', 'arriving: then ready for review');
  await backToBrief();
  // failures
  await setMock('mock-result', 'unknown'); await submit();
  await page.waitForFunction(() => document.getElementById('progress-title').textContent === 'Request not found.', null, { timeout: 15000 });
  ok(true, 'unknown request: "Request not found."');
  ok(await page.isVisible('#progress-back'), 'unknown request: a way back to the brief');
  await page.click('#progress-back');
  ok(await page.isVisible('#view-plan') && await page.isVisible('#leaf-setting-body'), 'back to the brief: the plan and the leaves are open');
  await setMock('mock-result', 'unreachable'); await submit();
  await page.waitForFunction(() => document.getElementById('progress-title').textContent === 'No result yet.', null, { timeout: 20000 });
  ok(await page.isVisible('#progress-retry'), 'unreachable: "Check again" after three failures');
  await page.click('#progress-back');

  // ---- wording: visible text in several states, and the notes
  await page.click('#open-notes');
  const notes = await page.innerText('#notes');
  await page.click('#notes-close');
  const visible = await page.evaluate(() => document.body.innerText);
  const allText = visible + '\n' + notes;
  const bad = (allText.match(FORBIDDEN) || [])[0];
  ok(!bad, 'no internal term is visible (' + bad + ')');
  ok(!PROMISE.test(allText), 'no delivery time, pixel size, retention period or stylist promised (' + (allText.match(PROMISE) || [''])[0] + ')');

  // ---- basic labels
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button')].filter(n => {
    if (n.closest('[hidden]') || n.closest('.mockbar')) return false;
    const label = n.labels && n.labels.length && [...n.labels].some(l => l.textContent.trim());
    return !(label || n.getAttribute('aria-label') || n.getAttribute('aria-labelledby') || (n.tagName === 'BUTTON' && n.textContent.trim()));
  }).map(n => n.id || n.name || n.outerHTML.slice(0, 60)));
  ok(unnamed.length === 0, 'every control has a name (' + unnamed.join(', ') + ')');
  ok(await page.$$eval('[role=radiogroup]', l => l.every(g => g.getAttribute('aria-labelledby') && document.getElementById(g.getAttribute('aria-labelledby')))), 'every radio group is labelled');
  ok(await page.$$eval('img', l => l.every(i => i.hasAttribute('alt'))), 'every image has alt text');
  ok(await page.$$eval('.leaf__fold', l => l.every(b => b.getAttribute('aria-controls') && b.hasAttribute('aria-expanded'))), 'fold buttons say what they control and whether open');

  // ---- keyboard: radio groups by arrow keys, visible focus, folding
  await page.focus('input[name="outcome"][value="Lifestyle"]');
  await page.keyboard.press('ArrowRight');
  ok(await page.$eval('input[name="outcome"][value="White BK"]', i => i.checked), 'keyboard: arrow keys move through the outcomes');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement.nextElementSibling).outlineStyle);
  ok(ring && ring !== 'none', 'keyboard: the focused choice shows a focus ring');
  await page.keyboard.press('ArrowLeft');
  await page.focus('#fold-piece'); await page.keyboard.press('Enter');
  ok(await page.$eval('#fold-piece', b => b.getAttribute('aria-expanded')) === 'false' && await page.isHidden('#leaf-piece-body'), 'keyboard: Enter folds a leaf');
  await page.keyboard.press('Enter');
  ok(await page.isVisible('#leaf-piece-body'), 'keyboard: Enter opens it again');

  // ---- RTL at 1280: the screen mirrors
  await setMock('mock-dir', 'rtl');
  const order = await page.evaluate(() => ['leaf-piece', 'leaf-setting', 'leaf-plan'].map(id => document.getElementById(id).getBoundingClientRect().left));
  ok(order[0] > order[1] && order[1] > order[2], 'RTL: the three leaves run right to left');
  const frames = await page.$$eval('#count-list .frame', l => l.map(f => f.getBoundingClientRect().left));
  ok(frames.length > 1 && frames[0] > frames[1], 'RTL: the frames hang right to left');
  await shot('05-rtl-1280');
  await setMock('mock-dir', 'ltr');

  // ---- phone width 375
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(await overflow() <= 0, '375 px: no sideways scroll in the brief (' + await overflow() + ')');
  ok(await page.isVisible('#dock'), '375 px: the plan count stays in reach');
  await page.$eval('#leaf-plan', n => n.scrollIntoView());
  await shot('06-plan-375');
  await setMock('mock-result', 'approved_studio');
  await page.click('#submit-btn');
  await waitResults();
  ok(await overflow() <= 0, '375 px: no sideways scroll in the result (' + await overflow() + ')');
  await page.$eval('#results-grid', n => n.scrollIntoView());
  await shot('07-result-375');
  await page.click('#compare-side');
  ok(await overflow() <= 0, '375 px: no sideways scroll beside your photo');
  await setMock('mock-dir', 'rtl');
  ok(await overflow() <= 0, '375 px RTL: no sideways scroll');
  await shot('08-result-375-rtl');
  await setMock('mock-dir', 'ltr');
  await page.click('#open-notes');
  ok(await overflow() <= 0, '375 px: the notes fit');
  await page.click('#notes-close');

  // ---- signed out mid-run returns to the closed screen
  await page.setViewportSize({ width: 1280, height: 900 });
  await backToBrief();
  await setMock('mock-result', 'signedout');
  await submit();
  await page.waitForSelector('#view-signin:not([hidden])', { timeout: 15000 });
  ok(await page.isHidden('#view-app'), 'signed out mid-run: back to the closed screen');
  await setMock('mock-result', 'passed');   // with the code still refused, the page would resume the request and sign out again
  await page.click('#mock-open'); await page.waitForSelector('#view-app:not([hidden])');
  ok(await page.isHidden('#photo-preview'), 'after sign-out the photo is not kept in the tab');

  // ---- no network, no errors
  const hosts = [...new Set(requests.map(u => new URL(u).host))];
  ok(hosts.length === 0, 'the page tried no request to any host (' + hosts.join(', ') + ')');
  ok(errors.length === 0, 'no page or console errors (' + errors.join(' | ').slice(0, 300) + ')');

  // ---- the Arabic draft, if present: same keys and placeholders as English
  const arFile = path.join(SRC, 'strings-ar.draft.js');
  if (fs.existsSync(arFile)) {
    const en = new Function(js.slice(js.indexOf('const STRINGS'), js.indexOf('(() => {')) + ';return STRINGS;')();
    // Read as a plain script: inside the owner workspace (a "type": "module" package) require() would load it as an ES module.
    const arBox = { exports: {} }; new Function('module', fs.readFileSync(arFile, 'utf8'))(arBox); const ar = arBox.exports;
    const flat = (o, p) => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, (p || '') + k + '.') : [[(p || '') + k, v]]));
    // The owner studio's owner-only strings (owner.*, rail.desk) are English only: the Arabic draft covers the client page.
    const ownerOnly = k => CONNECTED_COPY && (k.startsWith('owner.') || k === 'rail.desk');
    const A = new Map(flat(en).filter(([k]) => !ownerOnly(k))), B = new Map(flat(ar));
    ok([...A.keys()].every(k => B.has(k)) && [...B.keys()].every(k => A.has(k)), 'Arabic draft: the same keys as English');
    const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
    ok([...A.keys()].every(k => ph(A.get(k)) === ph(B.get(k))), 'Arabic draft: the same placeholders');
    ok(/NEEDS A NATIVE REVIEW/.test(fs.readFileSync(arFile, 'utf8')), 'Arabic draft: marked as needing a native review');
  } else ok(false, 'Arabic draft file exists');

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  if (process.env.SHOW_PAYLOADS === '1') console.log(JSON.stringify(payloads, null, 1));
  console.log('\n' + pass + ' passed, ' + failN + ' failed, ' + payloads.length + ' payloads through 01 and 02.');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
