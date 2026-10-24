// Owner studio (Claude-final-midas-a7): the connected Draft 3 page (now served at /owner/draft3/), end to end against a FAKE owner backend, in headless Chromium.
// Builds claude-outputs/claude-midas-a7-owner-workspace (npm run build) and serves its dist/ from a private test address. Every
// /api/owner/* call is answered by the fake below and recorded; any other host is aborted and recorded. No network, no n8n, no paid call.
// Run: NODE_PATH=<playwright> node tests/claude-midas-a7-page/run_owner_studio_flow.js [folder for screenshots]
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

let pass = 0, failN = 0;
function ok(cond, name) { if (cond) pass++; else { failN++; console.log('FAIL: ' + name); } }
const RUN = 'claude-a7-20261018090000-test';
const REV1 = '1'.repeat(64), REV2 = '2'.repeat(64);

function fakeBackend() {
  const s = { calls: [], me: 200, estimateStatus: 'verified', paidReady: true, phase: 'none', draft: null, refs: [], submission: null, decisions: [], clientId: '' };
  s.reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  s.job = () => ({ id: RUN, clientId: s.clientId, type: 'owner', status: { go1: 'awaiting_go_1', go2: 'awaiting_go_2', done: 'white_package_ready' }[s.phase], stage: 'Stage', summary: 'Recorded test summary.', createdAt: '2026-10-18T06:00:00.000Z', updatedAt: '2026-10-18T06:10:00.000Z',
    decisions: { go1: { decision: s.phase === 'go1' ? '' : 'go', at: s.phase === 'go1' ? null : '2026-10-18T06:05:00.000Z' }, go2: { decision: s.phase === 'done' ? 'approve' : '', at: s.phase === 'done' ? '2026-10-18T06:09:00.000Z' : null } }, history: [], historyAvailable: true, historyTruncated: false, observation: null });
  s.ticket = () => s.phase === 'go1'
    ? { runId: RUN, clientId: s.clientId, status: 'awaiting_go_1', gate: 'go1', round: 0, revision: REV1, allowed: ['go', 'change', 'stop'], decisionNeeded: 'Approve the plan for one white catalogue image?', shots: [{ number: 1, output: 'white_master', kind: 'white', frame: 'Square', check: 'ok', plan: { setting: 'Seamless white', light: 'Soft even light' } }], warnings: ['Two units must stay separate.'], candidate: null, review: { result: '', defects: [], uncertain: [] }, cost: { planning_usd: 0.02 }, asOf: '2026-10-18T06:01:00.000Z', paidReady: s.paidReady }
    : { runId: RUN, clientId: s.clientId, status: 'awaiting_go_2', gate: 'go2', round: 0, revision: REV2, allowed: ['approve', 'repair', 'stop'], decisionNeeded: 'Approve the white master?', shots: [], warnings: [], candidate: 'https://drive.google.com/file/d/TESTfile_123/view', review: { result: 'pass', defects: [], uncertain: ['Contact shadow is light.'] }, cost: {}, asOf: '2026-10-18T06:08:00.000Z', paidReady: s.paidReady };
  s.handle = async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method();
    const body = req.postDataBuffer();
    s.calls.push({ m, p, body: body ? body.toString('latin1') : '', headers: req.headers() });
    if (p === '/api/owner/me') return s.me === 200 ? s.reply(route, 200, { id: 'owner-1', email: 'owner@example.test', role: 'owner' }) : s.reply(route, s.me, { error: 'unauthorized' });
    if (p === '/api/logout') return s.reply(route, 200, { ok: true, revoked: true });
    if (p === '/api/owner/projects' && m === 'POST') { const j = JSON.parse(body.toString()); s.draft = j; return s.reply(route, 200, { saved: true, draft: { id: j.requestId, version: 1, brief: j.brief, note: j.note, direction: j.note } }); }
    if (p.startsWith('/api/owner/project-references/')) {
      if (m === 'GET') return s.reply(route, 200, { references: s.refs });
      s.refs.push({ id: 'ref-1', role: 'product', sha256: 'x', mime: 'image/png', bytes: body.length }); return s.reply(route, 200, { saved: true, role: 'product', sha256: 'x' });
    }
    if (p.startsWith('/api/owner/project-estimate/')) return s.reply(route, 200, { version: 'test', currency: 'USD', status: s.estimateStatus, outputs: ['White master'], noRepairUsd: 0.164, twoRepairsEachUsd: 0.38, basis: 'Test basis.', coverage: ['Test coverage'], exclusions: ['Test exclusion'], warnings: ['Test warning'], ceilingUsd: 5, expiresAt: '2030-01-01T00:15:00.000Z', fingerprint: 'f'.repeat(64), paidReady: s.paidReady, paidReleaseState: s.paidReady ? 'enabled' : 'disabled' });
    if (p === '/api/owner/submissions') {
      const raw = body.toString('latin1'); const at = raw.indexOf('name="payload"'); const json = raw.slice(raw.indexOf('{', at), raw.indexOf('\r\n--', at));
      s.submission = JSON.parse(json); s.clientId = 'owner-' + s.submission.requestId; s.phase = 'go1';
      return s.reply(route, 200, { accepted: true, forwarded: false, runId: null, clientId: s.clientId, outcome: 'received', message: 'A7 received your request.' });
    }
    if (p === '/api/owner/jobs') return s.reply(route, 200, { jobs: s.phase === 'none' ? [] : [s.job()], total: s.phase === 'none' ? 0 : 1, capped: false, nextOffset: null, asOf: '2026-10-18T06:10:00.000Z' });
    if (p === '/api/owner/jobs/' + RUN) return s.reply(route, 200, { job: s.job(), asOf: '2026-10-18T06:10:00.000Z' });
    if (p === '/api/owner/jobs/' + RUN + '/approval') {
      if (m === 'GET') return s.reply(route, 200, s.ticket());
      const d = JSON.parse(body.toString()); s.decisions.push(d);
      s.phase = s.phase === 'go1' ? 'go2' : 'done';
      return s.reply(route, 200, { accepted: true, forwarded: true, runId: RUN, clientId: s.clientId, outcome: 'received' });
    }
    return s.reply(route, 404, { error: 'not_found' });
  };
  return s;
}

(async () => {
  const browser = await chromium.launch();
  async function open(back, width) {
    const page = await browser.newPage({ viewport: { width: width || 1440, height: 1000 } });
    const errors = [], outside = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(ORIGIN)) outside.push(r.url()); });
    await page.route(/^https?:/, route => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN) return route.abort();
      if (url.pathname.startsWith('/api/')) return back.handle(route);
      if (url.pathname === '/.netlify/identity/settings') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: {}, disable_signup: true, autoconfirm: false }) });
      let file = path.join(DIST, decodeURIComponent(url.pathname));
      if (file.endsWith('/')) file = path.join(file, 'index.html');
      if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    return { page, errors, outside };
  }
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };
  const fast = page => page.evaluate(() => { STUDIO_CONFIG.poll.firstMs = 250; STUDIO_CONFIG.poll.everyMs = 250; });
  const calls = (back, p, m) => back.calls.filter(c => c.p.startsWith(p) && (!m || c.m === m));

  // ---- 1. The sign-in page is Draft 3's closed screen
  {
    const back = fakeBackend(); back.me = 401;
    const { page, errors } = await open(back);
    await page.goto(ORIGIN + '/');
    ok(await page.isVisible('.cf-workspace') && await page.isVisible('#email') && await page.isVisible('#password'), 'sign-in: email and password in the studio design');
    ok((await page.textContent('#submit')).trim() === 'Open the studio', 'sign-in: "Open the studio"');
    await shot(page, '01-signin');
    await page.goto(ORIGIN + '/owner/draft3/');
    await page.waitForURL(ORIGIN + '/', { timeout: 5000 }).catch(() => {});
    ok(page.url() === ORIGIN + '/', 'owner page without a session goes back to the sign-in');
    const real = errors.filter(e => !/status of 401/.test(e));   // the signed-out session check answers 401 by design
    ok(!real.length, 'sign-in: no page errors (' + real.join(' | ') + ')');
    await page.close();
  }

  // ---- 2. Signed in: the studio opens without an access code
  const back = fakeBackend();
  const { page, errors, outside } = await open(back);
  await page.goto(ORIGIN + '/owner/draft3/');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 });
  await fast(page);
  ok(await page.isHidden('#view-signin'), 'owner session: the studio opens, no access code asked');
  ok((await page.textContent('.rail__name')).includes('owner@example.test'), 'rail shows the owner account');
  ok(await page.isVisible('#open-desk') && (await page.getAttribute('#open-desk', 'href')) === '/owner/desk/' && await page.isVisible('#desk-note a'), 'the Studio desk is linked from the rail and leaf III');
  const laterOutcomes = await page.$$eval('.outcome--later strong', l => l.map(x => x.textContent));
  ok(laterOutcomes.includes('Website'), 'Website is shown as "Coming later"');
  ok(!(await page.$('input[name="outcome"][value="Website"]')), 'Website cannot be chosen');
  ok(await page.$eval('input[name="resolution-later"][value="4K"]', i => i.disabled), '4K is shown as "Coming later", disabled');
  ok(await page.$eval('input[name="resolution"][value="2K"]', i => i.checked), '2K is chosen');
  await shot(page, '02-open');

  // ---- 3. The piece: photo, White BK, pieces required
  await page.click('label:has(> input[name="outcome"][value="White BK"])');
  await page.setInputFiles('#photo', PHOTO);
  await page.click('#submit-btn');
  ok(await page.isVisible('#brief-errors') && /how many pieces/i.test(await page.textContent('#brief-errors')), 'no pieces: the error asks how many pieces are in the photo');
  ok(!calls(back, '/api/owner/projects', 'POST').length, 'no pieces: nothing is saved or sent');
  await page.click('#pieces-add');
  await page.fill('#pieces-list input[data-field="count"]', '2');
  await page.fill('#pieces-list input[data-field="item"]', 'corner sofa');
  await page.fill('#instructions', 'Keep both units separate.');

  // ---- 4. Send: save, store photo, estimate, confirm, send once
  await page.click('#submit-btn');
  await page.waitForSelector('#owner-cost[open]', { timeout: 8000 });
  const draft = back.draft;
  ok(draft && /^[0-9a-f-]{36}$/.test(draft.requestId) && draft.mode === 'project', 'save: one project version with the request reference as its id');
  ok(draft && draft.brief.page === 'draft3' && draft.brief.outcome === 'White background' && draft.brief.inventory === '2 corner sofa' && draft.brief.resolution === '2K' && draft.brief.aspect === '1:1', 'save: the brief carries the draft 3 choices');
  ok(draft && draft.note === 'Keep both units separate.', 'save: the instructions are the version direction');
  ok(calls(back, '/api/owner/project-references/', 'POST').length === 1 && /name="role"\r\n\r\nproduct/.test(calls(back, '/api/owner/project-references/', 'POST')[0].body), 'photo: stored once as the product reference');
  ok(!back.submission, 'estimate shown: nothing is sent before the owner confirms');
  ok((await page.textContent('#owner-cost-state')) === 'Verified estimate' && /USD 0\.164/.test(await page.textContent('#owner-cost-facts')), 'estimate: the backend figures are shown as they are');
  ok(await page.isDisabled('#owner-cost-go'), 'estimate: "Start processing" waits for the confirmation');
  await shot(page, '03-cost');
  await page.check('#owner-cost-confirm');
  await page.click('#owner-cost-go');
  await page.waitForSelector('#view-progress:not([hidden])', { timeout: 8000 });
  const sub = back.submission;
  ok(sub && sub.requestId === draft.requestId && sub.draftId === draft.requestId && sub.confirmed === true, 'send: the same reference, the saved draft, confirmed');
  ok(sub && sub.estimateConfirmation && sub.estimateConfirmation.fingerprint === 'f'.repeat(64) && sub.instructions === draft.note, 'send: bound to the confirmed estimate and the saved direction');
  ok(sub && Object.keys(draft.brief).every(k => String(sub[k]) === String(draft.brief[k])), 'send: the submission repeats the saved brief exactly');
  ok(calls(back, '/api/owner/submissions', 'POST').length === 1, 'send: exactly one submission');

  // ---- 5. Plan decision in leaf III
  await page.waitForSelector('#owner-panel:not([hidden]) h4', { timeout: 8000 });
  ok((await page.textContent('#owner-panel h4')) === 'Your decision: the plan', 'plan: the decision panel opens on leaf III');
  ok((await page.textContent('#progress-title')) === 'Your decision is needed.', 'plan: the headline says a decision is needed');
  ok(/Two units must stay separate/.test(await page.textContent('#owner-panel')), 'plan: the ticket warnings are shown');
  await shot(page, '04-plan');
  await page.click('#owner-panel button:has-text("Approve the plan")');
  ok(/Tick the confirmation/.test(await page.textContent('#owner-status')) && !back.decisions.length, 'plan: nothing is sent without the confirmation');
  await page.check('#owner-confirm');
  await page.click('#owner-panel button:has-text("Approve the plan")');
  await page.waitForFunction(() => document.querySelector('#owner-panel h4') && document.querySelector('#owner-panel h4').textContent === 'Your decision: the image', null, { timeout: 8000 });
  ok(back.decisions.length === 1 && back.decisions[0].decision === 'go' && back.decisions[0].revision === REV1 && back.decisions[0].confirmed === true, 'plan: one decision, bound to the ticket revision');

  // ---- 6. Image decision
  ok((await page.getAttribute('#owner-panel a.btn--gold', 'href')) === 'https://drive.google.com/file/d/TESTfile_123/view', 'image: the candidate opens in the private Drive');
  await shot(page, '05-image');
  await page.check('#owner-confirm');
  await page.click('#owner-panel button:has-text("Approve the image")');
  await page.waitForSelector('#view-results:not([hidden])', { timeout: 10000 });
  ok(back.decisions.length === 2 && back.decisions[1].decision === 'approve' && back.decisions[1].revision === REV2, 'image: one approval, bound to its revision');
  ok((await page.textContent('#results-package')).includes('Package complete'), 'result: the package is complete after the recorded approval');
  ok((await page.textContent('#results-grid')).includes('Approved'), 'result: the image shows the recorded "Approved"');
  await shot(page, '06-result');

  // ---- 7. Sign out
  await page.click('[data-action="signout"]');
  await page.waitForURL(ORIGIN + '/', { timeout: 5000 }).catch(() => {});
  ok(calls(back, '/api/logout', 'POST').length === 1 && page.url() === ORIGIN + '/', 'sign out: the session is ended on the server and the sign-in shows');
  ok(!errors.length, 'studio: no page errors (' + errors.join(' | ') + ')');
  ok(!outside.length, 'studio: no request to any other host (' + outside.join(', ') + ')');
  await page.close();

  // ---- 8. A provisional estimate never starts paid processing; cancel sends nothing
  {
    const back2 = fakeBackend(); back2.estimateStatus = 'provisional';
    const { page: p2, errors: e2 } = await open(back2, 375);
    await p2.goto(ORIGIN + '/owner/draft3/');
    await p2.waitForSelector('#view-app:not([hidden])', { timeout: 8000 });
    await p2.setInputFiles('#photo', PHOTO);
    await p2.click('#pieces-add');
    await p2.fill('#pieces-list input[data-field="count"]', '1');
    await p2.fill('#pieces-list input[data-field="item"]', 'chair');
    await p2.click('#submit-btn');
    await p2.waitForSelector('#owner-cost[open]', { timeout: 8000 });
    ok(await p2.isVisible('#owner-cost-blocked') && /only a square 2K White BK/.test(await p2.textContent('#owner-cost-blocked')), 'provisional: the dialog says paid processing cannot start');
    ok(await p2.isHidden('#owner-cost-go'), 'provisional: no start button');
    await shot(p2, '07-provisional-375');
    await p2.click('#owner-cost-cancel');
    await p2.waitForSelector('#submit-message:not([hidden])');
    ok(/Nothing was sent/.test(await p2.textContent('#submit-message')) && !back2.submission, 'cancel: nothing was sent, and the page says so');
    ok(back2.draft && back2.draft.brief.outcome === 'Lifestyle', 'Lifestyle is saved as a draft');
    const width = await p2.evaluate(() => document.documentElement.scrollWidth);
    ok(width <= 375, 'phone: no sideways scroll (' + width + ')');
    ok(!e2.length, 'phone: no page errors (' + e2.join(' | ') + ')');
    await p2.close();
  }
  // ---- 9. The desk is still served
  ok(fs.existsSync(path.join(DIST, 'owner', 'desk', 'index.html')) && /OWNER STUDIO/.test(fs.readFileSync(path.join(DIST, 'owner', 'desk', 'index.html'), 'utf8')), 'the earlier workspace is served as the Studio desk, linked back');

  await browser.close();
  console.log('\n' + pass + ' passed, ' + failN + ' failed.');
  process.exit(failN ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
