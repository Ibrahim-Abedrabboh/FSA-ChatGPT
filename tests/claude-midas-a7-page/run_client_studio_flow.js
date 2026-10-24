// Owner studio (Claude-final-midas-a7): the client-first-page experience at /owner/, end to end against a FAKE owner backend,
// in headless Chromium. Builds the owner workspace and serves dist/ from a private test address. Every /api/owner/* call is answered
// by the fake below and recorded; any other host is aborted and recorded. No network, no n8n, no paid call.
// Run: NODE_PATH=<playwright> node tests/claude-midas-a7-page/run_client_studio_flow.js [folder for screenshots]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'claude-outputs', 'claude-midas-a7-owner-workspace');
execFileSync('npm', ['run', 'build', '--silent'], { cwd: APP, stdio: 'inherit' });
const DIST = path.join(APP, 'dist');
const ORIGIN = 'https://studio.test';
const SHOTS = process.argv[2] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const PHOTO = path.join(__dirname, 'fixtures', 'product-on-white.png');
const ROOM = path.join(__dirname, 'fixtures', 'product-on-white.png');
const FORBIDDEN_OUT = /n8n\.cloud|webhook/i;

let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const RUN = 'claude-a7-20261018110000-test', REV1 = '1'.repeat(64), REV2 = '2'.repeat(64);

function fakeBackend() {
  const s = { me: 200, calls: [], estimateStatus: 'verified', paidReady: true, phase: 'none', drafts: [], refs: {}, submission: null, decisions: [], clientId: '', saved: [] };
  const reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  s.job = () => ({ id: RUN, clientId: s.clientId, type: 'owner', status: { go1: 'awaiting_go_1', go2: 'awaiting_go_2', done: 'white_package_ready' }[s.phase], stage: 'Stage', summary: 'Recorded test summary.', createdAt: '2026-10-18T08:00:00.000Z', updatedAt: '2026-10-18T08:10:00.000Z',
    decisions: { go1: { decision: s.phase === 'go1' ? '' : 'go', at: s.phase === 'go1' ? null : '2026-10-18T08:05:00.000Z' }, go2: { decision: s.phase === 'done' ? 'approve' : '', at: s.phase === 'done' ? '2026-10-18T08:09:00.000Z' : null } }, history: [], historyAvailable: true, historyTruncated: false, observation: null });
  s.ticket = () => s.phase === 'go1'
    ? { runId: RUN, clientId: s.clientId, status: 'awaiting_go_1', gate: 'go1', round: 0, revision: REV1, allowed: ['go', 'change', 'stop'], decisionNeeded: 'Approve the plan for one white catalogue image?', shots: [{ number: 1, output: 'white_master', kind: 'white', frame: 'Square', check: 'ok', plan: { setting: 'Seamless white' } }], warnings: ['Two units must stay separate.'], candidate: null, review: { result: '', defects: [], uncertain: [] }, cost: {}, asOf: '2026-10-18T08:01:00.000Z', paidReady: s.paidReady }
    : { runId: RUN, clientId: s.clientId, status: 'awaiting_go_2', gate: 'go2', round: 0, revision: REV2, allowed: ['approve', 'repair', 'stop'], decisionNeeded: 'Approve the white master?', shots: [], warnings: [], candidate: 'https://drive.google.com/file/d/TESTfile_123/view', review: { result: 'pass', defects: [], uncertain: [] }, cost: {}, asOf: '2026-10-18T08:08:00.000Z', paidReady: s.paidReady };
  s.handle = async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method(), body = req.postDataBuffer();
    s.calls.push({ m, p, body: body ? body.toString('latin1') : '' });
    if (p === '/api/owner/me') return s.me === 200 ? reply(route, 200, { id: 'owner-1', email: 'owner@example.test', role: 'owner' }) : reply(route, s.me, { error: 'unauthorized' });
    if (p === '/api/logout') return reply(route, 200, { ok: true });
    if (p === '/api/owner/projects' && m === 'GET') return reply(route, 200, { records: s.saved });
    if (p === '/api/owner/projects' && m === 'POST') { const j = JSON.parse(body.toString()); s.drafts.push(j); return reply(route, 200, { saved: true, draft: { id: j.requestId, version: 1, brief: j.brief, note: j.note }, projectId: j.projectId || 'p-' + s.drafts.length }); }
    if (p.startsWith('/api/owner/project-references/')) {
      const id = p.split('/').pop();
      if (m === 'GET') return reply(route, 200, { references: s.refs[id] || [] });
      const raw = body.toString('latin1'); const role = (raw.match(/name="role"\r\n\r\n([a-z_]+)/) || [])[1];
      (s.refs[id] = s.refs[id] || []).push({ id: 'r' + (s.refs[id].length + 1), role, sha256: 'x' + s.refs[id].length, mime: 'image/png', bytes: body.length });
      return reply(route, 200, { saved: true, role });
    }
    if (p.startsWith('/api/owner/project-estimate/')) return reply(route, 200, { version: 'test', currency: 'USD', status: s.estimateStatus, outputs: ['White master'], noRepairUsd: 0.164, twoRepairsEachUsd: 0.38, basis: 'Test basis.', coverage: ['c'], exclusions: ['e'], warnings: ['w'], ceilingUsd: 5, expiresAt: '2030-01-01T00:15:00.000Z', fingerprint: 'f'.repeat(64), paidReady: s.paidReady });
    if (p === '/api/owner/submissions') {
      const raw = body.toString('latin1'); const at = raw.indexOf('name="payload"');
      s.submission = JSON.parse(raw.slice(raw.indexOf('{', at), raw.indexOf('\r\n--', at))); s.clientId = 'owner-' + s.submission.requestId; s.phase = 'go1';
      return reply(route, 200, { accepted: true, forwarded: false, runId: null, clientId: s.clientId, outcome: 'received' });
    }
    if (p === '/api/owner/jobs') return reply(route, 200, { jobs: s.phase === 'none' ? [] : [s.job()], total: s.phase === 'none' ? 0 : 1, capped: false, nextOffset: null, asOf: '2026-10-18T08:10:00.000Z' });
    if (p === '/api/owner/jobs/' + RUN) return reply(route, 200, { job: s.job(), asOf: '2026-10-18T08:10:00.000Z' });
    if (p === '/api/owner/jobs/' + RUN + '/approval') {
      if (m === 'GET') return reply(route, 200, s.ticket());
      s.decisions.push(JSON.parse(body.toString())); s.phase = s.phase === 'go1' ? 'go2' : 'done';
      return reply(route, 200, { accepted: true, forwarded: true, runId: RUN, clientId: s.clientId, outcome: 'received' });
    }
    if (p === '/.netlify/identity/settings') return reply(route, 200, { disable_signup: true });
    return reply(route, 404, { error: 'not_found' });
  };
  return s;
}

(async () => {
  const browser = await chromium.launch();
  async function open(back, width) {
    const page = await browser.newPage({ viewport: { width: width || 1440, height: 1000 } });
    const errors = [], outside = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(m.text()); });
    page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(ORIGIN)) outside.push(r.url()); });
    await page.route(/^https?:/, route => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN) return route.abort();
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return back.handle(route);
      let file = path.join(DIST, decodeURIComponent(url.pathname));
      if (file.endsWith('/')) file = path.join(file, 'index.html');
      if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    return { page, errors, outside };
  }
  const shot = async (page, name, full) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); };
  const calls = (back, p, m) => back.calls.filter(c => c.p.startsWith(p) && (!m || c.m === m));
  const fast = page => page.evaluate(() => { window.__fast = true; });

  // ---- 1. sign-in page in the same design
  {
    const back = fakeBackend(); back.me = 401;
    const { page, errors } = await open(back);
    await page.goto(ORIGIN + '/');
    await page.waitForFunction(() => !/Checking/.test(document.getElementById('status').textContent));
    ok(await page.isVisible('.cf-logo') && await page.isVisible('#email') && await page.isVisible('#password'), 'sign-in: client-first-page design with email and password');
    await shot(page, 'c01-signin');
    ok(!errors.length, 'sign-in: no page errors (' + errors.join(' | ') + ')');
    await page.close();
  }

  // ---- 2. Manual: The Job — every option of the guide can be chosen
  const back = fakeBackend();
  const { page, errors, outside } = await open(back);
  await page.goto(ORIGIN + '/owner/');
  await page.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  ok((await page.textContent('#page-title')) === 'Start creating.', 'opens on "Start creating."');
  ok((await page.getAttribute('#mode-manual', 'aria-pressed')) === 'true', 'Manual is the default');
  ok((await page.$$eval('#stage-nav button', b => b.map(x => x.textContent))).join('|') === '01The Job|02The Item|03Scope|04Preferences|05Suggestions', 'five steps in Manual');
  ok((await page.$$eval('#job-grid .cf-card strong', b => b.map(x => x.textContent))).join('|') === 'New Project|Edit|Single item', 'New Project, Edit, Single item');
  ok(await page.$$eval('#job-detail button', b => b.length === 2 && b.every(x => !x.disabled) && /Batch/.test(b[0].textContent)), 'Batch and One by one can both be chosen');
  ok(!(await page.$$('.cf-soon')).length && !/Coming later/.test(await page.textContent('body')), 'nothing on the page is "Coming later"');
  ok((await page.textContent('#who')) === 'owner@example.test', 'the owner account is shown');
  await shot(page, 'c02-job');
  await page.click('#job-grid .cf-card:has-text("Single item")');
  ok(await page.$$eval('#job-detail button', b => b.length === 2 && b.every(x => !x.disabled) && b[0].textContent === 'Hero' && b[1].textContent === 'Secondary'), 'Single item: Hero and Secondary can be chosen');
  ok((await page.getAttribute('#job-detail button:has-text("Hero")', 'aria-pressed')) === 'true', 'Hero is the default role');
  await shot(page, 'c02b-single-item');

  // ---- 3. The Item
  await page.click('#next');
  ok((await page.textContent('#h-item')) === 'Add your item.', 'The Item');
  ok(await page.$$eval('#ref-type option', o => o.length === 6 && o.every(x => !x.disabled)), 'all six reference types can be chosen');
  await page.click('#choose-midas');
  ok(await page.isVisible('#catalogue') && /Recorded · not applied by A7 yet/.test(await page.textContent('#catalogue-field')), 'Choose from Midas opens, marked as recorded');
  await page.click('#choose-midas');
  const dept = await page.$$eval('#department option', o => o.map(x => x.textContent));
  ok(dept[0] === 'Automatic from references' && dept.includes('Home Furniture'), 'department list from the Midas catalogue');
  await page.selectOption('#department', { label: 'Home Furniture' });
  ok(!(await page.isDisabled('#category')), 'category opens after the department');
  await page.setInputFiles('#files', PHOTO);
  ok((await page.$$('#file-list .cf-file')).length === 1, 'the photo is listed with its role');
  await page.fill('#pieces input[type=number]', '2');
  await page.fill('#pieces input[type=text]', 'corner sofa');
  await shot(page, 'c03-item', true);

  // ---- 4. Scope: seven outcomes, all selectable
  await page.click('#next');
  ok((await page.$$eval('.cf-scope strong', b => b.map(x => x.textContent))).join('|') === 'White BK|Lifestyle|Website|New Composition|Variations|Create with this item|Others', 'the seven outcomes of the guide');
  ok(await page.$$eval('.cf-scope', b => b.every(x => !x.disabled)), 'every outcome can be chosen');
  await page.click('.cf-scope:has-text("Lifestyle")');   // deselect Lifestyle
  await page.click('.cf-scope:has-text("White BK")');
  ok(/Expect 1 image: White catalogue image/.test(await page.textContent('#plan-line')), 'White BK: one white catalogue image planned');
  await page.click('#delivery summary');
  ok(await page.$eval('#resolution option[value="4K"]', o => !o.disabled) && (await page.$$('#aspect option')).length === 10 && (await page.$$('#camera option')).length === 5, '4K, nine proportions and five camera views offered');
  await page.click('.cf-scope:has-text("Others")');
  ok(await page.isVisible('#other-outcome'), 'Others asks for a description');
  await page.click('.cf-scope:has-text("Others")');
  await shot(page, 'c04-scope', true);

  // ---- 5. Preferences and Suggestions on white
  await page.click('#next');
  ok(await page.$eval('#prefs', f => f.disabled) && /not used on a white background/.test(await page.textContent('#prefs-note')), 'preferences are off on white');
  await page.click('#next');
  ok(await page.isDisabled('#plants') && await page.isDisabled('#mood') && await page.isDisabled('#human'), 'plants, mood and human are for scene images');
  await shot(page, 'c05-suggestions');

  // ---- 6. More options: the guide's items 7 to 15
  await page.click('#more');
  ok(await page.isVisible('#more-dialog'), 'More options opens');
  ok((await page.$$eval('#more-dialog .cf-option-group summary', s => s.map(x => x.childNodes[0].textContent.trim()))).join('|') === '7 · Specific items / Combo|8 · Additional input data|9 · Include description and meta|10 · Use previous generation (space, look)|11 · Other pieces images|12 · Custom prompting|13 · Steering|14 · Fidelity / Styling / Cluttering|15 · Human validation', 'items 7 to 15 of the guide');
  await page.click('#opt-data summary'); await page.fill('#sku', '174770');
  await page.click('#opt-prompt summary'); await page.fill('#instructions', 'Keep both units separate.'); await page.fill('#locks', 'Brass feet');
  await page.click('#opt-strength summary');
  ok((await page.$$('#strengths input[type=range]')).length === 3 && await page.$$eval('#strengths input[type=range]', r => r.every(x => x.disabled)), 'three strength sliders, Automatic by default');
  await page.click('#opt-validation summary');
  ok((await page.getAttribute('#review-first button:has-text("Share description first")', 'aria-pressed')) === 'true', 'Share description first is the default');
  await shot(page, 'c06-more');
  await page.click('#more-dialog .cf-wide');

  // ---- 7. Review, save, store, estimate, confirm, send once
  await page.click('#next');
  await page.waitForSelector('#review-dialog[open]');
  const rv = await page.textContent('#review-list');
  ok(/White BK · 1 image/.test(rv) && /1 reference \(1 product\)/.test(rv) && /Single item · Hero/.test(rv), 'review lists the job, deliverables and references');
  ok(await page.isHidden('#review-blockers') && await page.isHidden('#review-recorded') && !(await page.isDisabled('#send')), 'nothing blocks this brief and nothing is only recorded');
  await shot(page, 'c07-review');
  await page.click('#send');
  await page.waitForSelector('#cost-dialog[open]', { timeout: 8000 });
  const d = back.drafts[0];
  ok(d && d.mode === 'project' && d.brief.page === 'studio' && d.brief.outcome === 'White background' && d.brief.outcomes === 'White BK' && d.brief.itemRole === 'hero' && d.brief.inventory === '2 corner sofa' && d.brief.sku === '174770' && d.brief.department === 'Home Furniture' && d.brief.locks === 'Brass feet', 'saved: one version with the studio brief');
  ok(d && d.note === 'Keep both units separate.', 'saved: the instructions are the direction');
  ok(calls(back, '/api/owner/project-references/', 'POST').length === 1, 'photo stored once');
  ok(!back.submission && await page.isDisabled('#cost-go'), 'nothing sent before the confirmation');
  await shot(page, 'c08-cost');
  await page.check('#cost-confirm'); await page.click('#cost-go');
  await page.waitForSelector('#s-run.is-on', { timeout: 8000 });
  const sub = back.submission;
  ok(sub && sub.requestId === d.requestId && sub.draftId === d.requestId && sub.confirmed === true && sub.estimateConfirmation.fingerprint === 'f'.repeat(64), 'sent once, bound to the saved draft and the estimate');
  ok(sub && Object.keys(d.brief).every(k => String(sub[k]) === String(d.brief[k])) && sub.instructions === d.note, 'the submission repeats the saved brief exactly');
  ok(calls(back, '/api/owner/submissions', 'POST').length === 1, 'exactly one submission');

  // ---- 8. Plan and image decisions
  await page.evaluate(() => document.getElementById('run-check').click());
  await page.waitForSelector('#decision:not([hidden]) h3', { timeout: 8000 });
  ok((await page.textContent('#decision h3')) === 'Your decision: the plan' && (await page.textContent('#h-run')) === 'Your decision is needed.', 'plan decision opens');
  await shot(page, 'c09-plan', true);
  await page.click('#decision button:has-text("Approve the plan")');
  ok(/Tick the confirmation/.test(await page.textContent('#decision-status')) && !back.decisions.length, 'nothing sent without the confirmation');
  await page.check('#decision-confirm'); await page.click('#decision button:has-text("Approve the plan")');
  await page.waitForFunction(() => document.querySelector('#decision h3') && document.querySelector('#decision h3').textContent === 'Your decision: the image', null, { timeout: 8000 });
  ok(back.decisions[0].decision === 'go' && back.decisions[0].revision === REV1, 'plan approved once, bound to its revision');
  ok((await page.getAttribute('#decision a.cf-primary', 'href')) === 'https://drive.google.com/file/d/TESTfile_123/view', 'the candidate opens in the private Drive');
  await page.check('#decision-confirm'); await page.click('#decision button:has-text("Approve the image")');
  await page.waitForFunction(() => document.getElementById('h-run').textContent === 'Approved and packaged.', null, { timeout: 8000 });
  ok(back.decisions[1].decision === 'approve' && back.decisions[1].revision === REV2, 'image approved once');
  ok(/Approved/.test(await page.textContent('#shots')) && /Package complete/.test(await page.textContent('#timeline')), 'result: approved and packaged');
  await shot(page, 'c10-result', true);
  ok(!errors.length, 'no page errors (' + errors.join(' | ') + ')');
  ok(!outside.length, 'no request to another host (' + outside.join(', ') + ')');
  await page.close();

  // ---- 9. Single item → Secondary, several outcomes, 4K, plants, mood, Midas SKUs, strengths: saved with every choice, recorded ones listed
  {
    const b4 = fakeBackend(); b4.estimateStatus = 'provisional';
    const { page: p, errors: e4 } = await open(b4);
    await p.goto(ORIGIN + '/owner/');
    await p.waitForSelector('#app:not([hidden])');
    await p.click('#job-grid .cf-card:has-text("Single item")');
    await p.click('#job-detail button:has-text("Secondary")');
    await p.click('#next');
    await p.setInputFiles('#files', PHOTO);
    await p.fill('#pieces input[type=text]', 'bowl');
    await p.selectOption('#ref-type', 'spec');
    await p.setInputFiles('#files', { name: 'specs.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n') });
    ok((await p.$$('#file-list .cf-file')).length === 2, 'a PDF specification is accepted as a reference');
    await p.click('#next');
    for (const o of ['Website', 'New Composition', 'Create with this item']) await p.click('.cf-scope:has-text("' + o + '")');
    await p.click('#delivery summary');
    await p.selectOption('#resolution', '4K'); await p.selectOption('#aspect', '4:5'); await p.selectOption('#camera', 'Left side');
    ok(/Expect 5 images: White catalogue image, Hero scene, Wide scene, Close-up scene, New composition, Scene with this item|Expect 6 images/.test(await p.textContent('#plan-line')), 'the plan lists every outcome’s images');
    await p.click('#next');
    await p.click('#lighting button:has-text("Warm evening")'); await p.click('#wall button:has-text("Sage")');
    await p.click('#next');
    await p.check('#plants'); await p.selectOption('#mood', 'Warm & inviting');
    ok(await p.isVisible('#mood-rec'), 'mood is marked as recorded');
    await p.click('#more');
    await p.click('#opt-picks summary'); await p.fill('#picks', '174788\n161283');
    await p.click('#opt-strength summary'); await p.click('#strengths label:first-of-type input'); 
    await p.click('#more-dialog .cf-wide');
    await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    const rec = await p.textContent('#review-recorded');
    ok(/Plants/.test(rec) && /Mood: Warm & inviting/.test(rec) && /Strengths: Fidelity 50/.test(rec) && /PDF and Excel/.test(rec), 'review lists what A7 records but does not apply yet');
    ok(/Single item · Secondary/.test(await p.textContent('#review-list')), 'review shows Secondary');
    await shot(p, 'c14-secondary-review');
    await p.click('#send');
    await p.waitForSelector('#cost-dialog[open]');
    const br = b4.drafts[0].brief;
    ok(br.itemRole === 'secondary' && br.outcomes === 'Lifestyle\nWebsite\nNew Composition\nCreate with this item' && br.outcome === 'Lifestyle' && br.resolution === '4K' && br.aspect === '4:5' && br.camera === 'Left side', 'saved: role, outcomes, 4K, proportions and camera');
    ok(br.plants === 'yes' && br.mood === 'Warm & inviting' && br.midasPicks === '174788\n161283' && br.fidelityStrength === '50' && br.lighting === 'Warm evening' && br.wallPaint === 'Sage', 'saved: plants, mood, Midas SKUs, strength and preferences');
    ok(/name="role"\r\n\r\nspec/.test(calls(b4, '/api/owner/project-references/', 'POST')[1].body), 'the specification file is stored with its role');
    ok(await p.isVisible('#cost-blocked') && await p.isHidden('#cost-go'), 'a provisional estimate cannot start paid processing');
    await shot(p, 'c15-secondary-cost');
    await p.click('#cost-cancel');
    ok(!b4.submission, 'nothing sent');
    ok(!e4.length, 'secondary: no page errors (' + e4.join(' | ') + ')');
    await p.close();
  }

  // ---- 10. Batch: two items, each its own references and version in one collection
  {
    const b5 = fakeBackend();
    const { page: p, errors: e5 } = await open(b5);
    await p.goto(ORIGIN + '/owner/');
    await p.waitForSelector('#app:not([hidden])');
    await p.click('#job-detail button:has-text("Batch")');
    await p.click('#next');
    ok(await p.isVisible('#item-tabs') && await p.isVisible('#item-name'), 'batch: item tabs and item names');
    await p.fill('#item-name', 'Towel set'); await p.setInputFiles('#files', PHOTO); await p.fill('#pieces input[type=text]', 'towel');
    await p.click('#item-tabs button:has-text("+ Add an item")');
    ok((await p.$$('#file-list .cf-file')).length === 0, 'the new item starts without references');
    await p.fill('#item-name', 'Table lamp'); await p.setInputFiles('#files', PHOTO); await p.fill('#pieces input[type=text]', 'lamp');
    await p.click('#item-tabs button:has-text("Towel set")');
    ok((await p.$$('#file-list .cf-file')).length === 1 && (await p.inputValue('#item-name')) === 'Towel set', 'each item keeps its own references');
    await p.click('#next'); await p.click('.cf-scope:has-text("Lifestyle")'); await p.click('.cf-scope:has-text("White BK")');
    await p.click('#next'); await p.click('#next'); await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    ok(/Items \(2, each sent as its own job\)/.test(await p.textContent('#review-list')), 'review: two items, each its own job');
    await shot(p, 'c16-batch-review');
    await p.click('#send');
    await p.waitForSelector('#cost-dialog[open]');
    ok(b5.drafts.length === 2 && b5.drafts[0].mode === 'collection' && !b5.drafts[0].projectId && b5.drafts[1].projectId === 'p-1' && b5.drafts[0].brief.workOn === 'batch', 'saved: two versions in one collection');
    ok(b5.drafts[0].caseTitle === 'Towel set' && b5.drafts[1].caseTitle === 'Table lamp' && b5.drafts[0].requestId !== b5.drafts[1].requestId, 'each item has its own case and request');
    ok(calls(b5, '/api/owner/project-references/', 'POST').length === 2, 'one reference stored for each item');
    ok((await p.$$('#cost-items .cf-cost-item')).length === 2, 'cost: one line per item');
    await p.check('#cost-confirm'); await p.click('#cost-go');
    await p.waitForSelector('#s-run.is-on', { timeout: 8000 });
    ok(calls(b5, '/api/owner/submissions', 'POST').length === 2, 'each item sent once');
    ok(/1 more item\(s\) were sent/.test(await p.textContent('#run-lead')), 'the page says the other item was sent');
    ok(!e5.length, 'batch: no page errors (' + e5.join(' | ') + ')');
    await p.close();
  }

  // ---- 11. Variations: only from a saved version A7 already received
  {
    const b6 = fakeBackend();
    b6.saved = [{ id: 'p-0', title: 'Studio · Sofa', version_id: '11111111-1111-4111-8111-111111111111', case_title: 'Sofa', version: 1, run_id: 'claude-a7-20261018090000-abcdef', client_run_id: 'owner-11111111-1111-4111-8111-111111111111', dispatch_state: 'received', brief: { outcome: 'Lifestyle', outcomes: 'Lifestyle' }, created_at: '2026-10-18T07:00:00.000Z' }];
    const { page: p, errors: e6 } = await open(b6);
    await p.goto(ORIGIN + '/owner/');
    await p.waitForSelector('#app:not([hidden])');
    await p.click('#next'); await p.setInputFiles('#files', PHOTO); await p.fill('#pieces input[type=text]', 'sofa');
    await p.click('#next'); await p.click('.cf-scope:has-text("Lifestyle")'); await p.click('.cf-scope:has-text("Variations")');
    ok(await p.isVisible('#variations-note') && /accepted result/.test(await p.textContent('#variations-note')), 'variations explain they need an accepted result');
    await p.click('#next'); await p.click('#next'); await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    ok(/Variations start from an accepted result/.test(await p.textContent('#review-blockers')) && await p.isDisabled('#send'), 'variations without a sent version are blocked');
    await p.click('#review-dialog .cf-secondary');
    await p.click('#stage-nav button:has-text("The Job")');
    await p.click('#job-grid .cf-card:has-text("Edit")');
    await p.selectOption('#parent', '11111111-1111-4111-8111-111111111111');
    await p.click('#stage-nav button:has-text("Scope")');
    await p.click('#delivery summary'); await p.selectOption('#var-count', '3'); await p.click('#var-axes button:has-text("Lighting")');
    await p.click('#more'); await p.click('#opt-previous summary'); await p.click('#prev-box button:has-text("Look")'); await p.click('#more-dialog .cf-wide');
    await p.click('#next'); await p.click('#next'); await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    ok(await p.isHidden('#review-blockers'), 'from a sent version the variations are complete');
    await p.click('#send');
    await p.waitForSelector('#cost-dialog[open]');
    const dv = b6.drafts[0];
    ok(dv.mode === 'edit' && dv.parentId === '11111111-1111-4111-8111-111111111111' && dv.brief.outcomes === 'Variations' && dv.brief.variationCount === '3' && dv.brief.previousGeneration === 'Look', 'saved: an edit of the sent version with 3 variations');
    ok(/change only: lighting/.test(dv.note), 'the varied variable is written into the instructions');
    ok(/edit or continuation/.test(await p.textContent('#cost-blocked')), 'an edit cannot start paid processing yet');
    await p.click('#cost-cancel');
    ok(!e6.length, 'variations: no page errors (' + e6.join(' | ') + ')');
    await p.close();
  }

  // ---- 12. Projects: existing room needs a room photo; Lifestyle stays provisional; phone width
  {
    const b2 = fakeBackend(); b2.estimateStatus = 'provisional';
    const { page: p, errors: e2 } = await open(b2, 375);
    await p.goto(ORIGIN + '/owner/');
    await p.waitForSelector('#app:not([hidden])');
    await p.click('#mode-projects');
    ok((await p.$$eval('#stage-nav button', b => b.map(x => x.textContent))).join('|') === '01Project|02The Item|03Scope', 'Projects: three steps');
    ok((await p.$$eval('#start-grid strong', b => b.map(x => x.textContent))).join('|') === 'Product or collection|Existing room|New styled space|Saved project', 'four starting points');
    await p.click('#start-grid .cf-source:has-text("New styled space")');
    ok(await p.isVisible('#room-brief'), 'new styled space asks for a room description');
    await p.click('#start-grid .cf-source:has-text("Existing room")');
    await shot(p, 'c11-projects-375');
    await p.click('#next');
    await p.setInputFiles('#files', PHOTO);
    await p.fill('#pieces input[type=text]', 'armchair');
    await p.click('#next'); await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    ok(/add a room reference/.test(await p.textContent('#review-blockers')) && await p.isDisabled('#send'), 'existing room: blocked until a room photo is added');
    await p.click('#review-dialog .cf-secondary');
    await p.click('#stage-nav button:has-text("The Item")');
    await p.selectOption('#ref-type', 'room');
    await p.setInputFiles('#files', ROOM);
    await p.click('#next'); await p.click('#next');
    await p.waitForSelector('#review-dialog[open]');
    ok(await p.isHidden('#review-blockers'), 'with a room photo the brief is complete');
    await p.click('#send');
    await p.waitForSelector('#cost-dialog[open]');
    ok(b2.drafts[0].brief.startType === 'existing_room' && b2.drafts[0].brief.studioChoice === 'yes' && b2.drafts[0].brief.outcome === 'Lifestyle', 'Projects: existing room, Lifestyle with studio defaults');
    ok(calls(b2, '/api/owner/project-references/', 'POST').length === 2 && /name="role"\r\n\r\nroom/.test(calls(b2, '/api/owner/project-references/', 'POST')[1].body), 'product and room references stored with their roles');
    ok(await p.isVisible('#cost-blocked') && /square 2K White BK/.test(await p.textContent('#cost-blocked')) && await p.isHidden('#cost-go'), 'provisional estimate: no paid start');
    await shot(p, 'c12-provisional-375');
    await p.click('#cost-cancel');
    ok(!b2.submission, 'nothing sent');
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 375, 'phone: no sideways scroll (' + w + ')');
    ok(!e2.length, 'phone: no page errors (' + e2.join(' | ') + ')');
    await p.close();
  }

  // ---- 13. the guide
  {
    const b3 = fakeBackend();
    const { page: p, errors: e3 } = await open(b3);
    await p.goto(ORIGIN + '/owner/guide/');
    const text = await p.textContent('main');
    ok(/Options & workflows/.test(text) && !/Coming later/.test(text) && /Applied by A7/.test(text) && /Recorded/.test(text) && /A 12-chair dining set/.test(text), 'guide: sections, what A7 applies and cases');
    await shot(p, 'c13-guide');
    ok(!e3.length, 'guide: no page errors (' + e3.join(' | ') + ')');
    await p.close();
  }
  ok(!/n8n\.cloud|webhook/i.test(fs.readFileSync(path.join(DIST, 'owner', 'app.js'), 'utf8')), 'no outside address in the studio code');
  await browser.close();
  console.log('\n' + pass + ' passed, ' + failN + ' failed.');
  process.exit(failN ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
