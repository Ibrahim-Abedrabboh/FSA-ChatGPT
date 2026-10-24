// Owner Overview (/owner/overview/): the counting and naming rules match Saved work and Jobs, the page is read-only,
// it handles unavailable data honestly, it ships without inline code, and the MIDAS wordmark is never recoloured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const here = path => new URL('../' + path, import.meta.url);
const read = path => readFileSync(here(path), 'utf8');
const modelSource = read('overview-model.js'), pageSource = read('overview.js'), connected = read('start-connected.js');
const html = read('overview.html'), css = read('overview.css'), startCss = read('start.css');

function loadModel() { const context = {}; vm.runInNewContext(modelSource, context); return context.MidasOverview; }
const M = loadModel();
const plain = value => JSON.parse(JSON.stringify(value));
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const version = (n, extra = {}) => ({ version_id: uuid(n), id: 'p' + n, case_ref: `SOF-2610-0${n}`, case_title: 'Sofa ' + n, version: 1, dispatch_state: 'draft', created_at: `2026-10-1${n}T08:00:00Z`, ...extra });

test('status groups and dispatch states are the same as in Saved work and Jobs', () => {
  const setFrom = name => new Set(JSON.parse(connected.match(new RegExp(`const ${name}=new Set\\((\\[[^\\]]*\\])\\)`))[1].replace(/'/g, '"')));
  assert.deepEqual([...M.ATTENTION], [...setFrom('ATTENTION')]);
  assert.deepEqual([...M.PROGRESS], [...setFrom('PROGRESS')]);
  assert.deepEqual([...M.DONE], [...setFrom('DONE')]);
  const dispatch = vm.runInNewContext('(' + connected.match(/const DISPATCH=(\{[^;]*\});/)[1] + ')');
  assert.deepEqual(JSON.parse(JSON.stringify(M.DISPATCH)), JSON.parse(JSON.stringify(dispatch)));
});

test('counts follow the linked job when exactly one matches, else the saved dispatch state', () => {
  const records = [
    version(1),                                                             // draft
    version(2, { dispatch_state: 'received', run_id: 'run-2' }),            // job run-2 is on hold -> attention
    version(3, { dispatch_state: 'confirmed', client_run_id: 'owner-x3' }), // no job -> progress
    version(4, { dispatch_state: 'outcome_unknown' }),                      // attention
    version(5, { dispatch_state: 'received', run_id: 'run-5' }),            // job completed -> done
  ];
  const jobs = [{ id: 'run-2', clientId: 'owner-' + uuid(2), status: 'hold', stage: 'Go 2', updatedAt: '2026-10-19T10:00:00Z' }, { id: 'run-5', status: 'completed', stage: '07 Scenes', updatedAt: '2026-10-18T10:00:00Z' }];
  const data = M.overview(records, jobs);
  assert.deepEqual(plain(data.metrics), { drafts: 1, progress: 1, attention: 2, done: 1, versions: 5 });
  // Without the job queue the saved states are used: version 2 reads as progress and version 5 as progress.
  assert.deepEqual(plain(M.overview(records, null).metrics), { drafts: 1, progress: 3, attention: 1, done: 0, versions: 5 });
});

test('needs attention shows at most two items, latest first, with job links and the rest counted', () => {
  const records = [version(1, { dispatch_state: 'outcome_unknown', updated_at: '2026-10-10T00:00:00Z' }), version(2, { run_id: 'run-2', dispatch_state: 'received' }), version(3, { run_id: 'run-3', dispatch_state: 'received' })];
  const jobs = [
    { id: 'run-2', clientId: 'owner-' + uuid(2), status: 'failed', stage: '03 Eye', updatedAt: '2026-10-18T09:00:00Z', createdAt: '2026-10-18T08:00:00Z' },
    { id: 'run-3', clientId: 'owner-' + uuid(3), status: 'hold', stage: 'Go 1', updatedAt: '2026-10-19T09:00:00Z', createdAt: '2026-10-19T08:00:00Z' },
    { id: 'run-x', clientId: 'owner-unknown', status: 'waiting_for_owner', stage: 'Go 2', updatedAt: '2026-10-17T09:00:00Z', createdAt: '2026-10-17T08:00:00Z' },
  ];
  const data = M.overview(records, jobs, { when: value => value.slice(0, 10) });
  assert.equal(data.attention.length, 2);
  assert.deepEqual(plain(data.attention.map(item => item.title)), ['SOF-2610-03 v1', 'SOF-2610-02 v1']);
  assert.equal(data.attention[0].jobId, 'run-3');
  assert.match(data.attention[0].detail, /Go 1 · hold/);
  assert.equal(data.attentionMore, 2, 'the saved version with an unknown outcome and the unlinked job are counted, not dropped');
  const all = M.overview(records, jobs, { when: value => value.slice(0, 10), attentionLimit: 9 }).attention;
  assert.deepEqual(plain(all.map(item => item.title)), ['SOF-2610-03 v1', 'SOF-2610-02 v1', 'SOF-2610-01 v1', 'Unlinked job · 2026-10-17']);
  assert.equal(all[2].jobId, null, 'a version with no job opens Saved work instead');
});

test('a job that needs the owner is listed even when it is tied to its version only by name', () => {
  const v = version(8, { dispatch_state: 'draft' });
  const job = { id: 'run-8', clientId: 'owner-' + v.version_id, status: 'hold', stage: 'Go 2', updatedAt: '2026-10-19T00:00:00Z' };
  const data = M.overview([v], [job]);
  assert.equal(data.attention.length, 1);
  assert.equal(data.attention[0].title, 'SOF-2610-08 v1');
  assert.equal(data.attention[0].jobId, 'run-8');
});

test('recent jobs use the Jobs names, numbered runs and newest first', () => {
  const v = version(7, { case_ref: 'SOF-2610-07', version: 2, parent_id: 'p', case_title: 'Abali sofa' });
  const jobs = [
    { id: 'a', clientId: 'owner-' + v.version_id, status: 'completed', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z', stage: '07 Scenes' },
    { id: 'b', clientId: 'owner-' + v.version_id, status: 'running', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', stage: '04 Plan' },
    ...[1, 2, 3, 4].map(n => ({ id: 'old' + n, clientId: 'x' + n, status: 'completed', createdAt: `2026-09-0${n}T00:00:00Z`, updatedAt: `2026-09-0${n}T00:00:00Z` })),
  ];
  const data = M.overview([v], jobs, { when: value => value.slice(0, 10) });
  assert.equal(data.recent.length, 5);
  assert.deepEqual(plain(data.recent.slice(0, 2).map(item => item.title)), ['SOF-2610-07 v2 · Edited · Run 2', 'SOF-2610-07 v2 · Edited · Run 1']);
  assert.equal(data.recent[0].product, 'Abali sofa');
  assert.equal(data.recent[2].title, 'Unlinked job · 2026-09-04');
  assert.equal(data.recent[4].stage, 'Stage not recorded');
  assert.equal(M.jobLink('claude-a7-1 2'), '/owner/?job=claude-a7-1%202#jobsSection');
});

// The page itself, run against a fake DOM and fake owner APIs.
function page({ projects = { status: 200, body: { records: [] } }, jobs = { status: 200, body: { jobs: [], total: 0, nextOffset: null, asOf: '2026-10-20T00:00:00Z' } }, me = { status: 200, body: { role: 'owner' } } } = {}) {
  const nodes = new Map(), calls = [], replaced = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, fakeNode(id)); return nodes.get(id); };
  function fakeNode(id, tag = 'div') {
    const listeners = {};
    return { id, tag, textContent: '', hidden: false, disabled: false, href: '', className: '', children: [],
      classList: { set: new Set(), toggle(name, on) { on ? this.set.add(name) : this.set.delete(name); }, contains(name) { return this.set.has(name); } },
      append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; },
      addEventListener(type, fn) { listeners[type] = fn; }, fire(type) { return listeners[type]?.({}); } };
  }
  const document = { getElementById: node, createElement: tag => fakeNode('', tag) };
  const reply = ({ status, body }) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url === '/api/owner/me') return reply(me);
    if (url === '/api/owner/projects') return reply(projects);
    if (url.startsWith('/api/owner/jobs?offset=')) return reply(jobs);
    if (url === '/api/logout') return reply({ status: 200, body: {} });
    throw Error('unexpected ' + url);
  };
  const window = { location: { replace: to => replaced.push(to) } };
  vm.runInNewContext(modelSource, { window });
  vm.runInNewContext(pageSource, { window, document, fetch, Intl, Date, Promise, Number, Array, Set, Map, String, Error, Object, JSON, Math });
  const text = n => [n.textContent, ...n.children.map(text)].join(' ');
  return { ready: window.midasOverviewReady, node, calls, replaced, text };
}

test('the page shows the counts, two attention items with job links, and recent jobs, and only reads', async () => {
  const records = [version(1), version(2, { run_id: 'run-2', dispatch_state: 'received' }), version(3, { dispatch_state: 'outcome_unknown' }), version(4, { run_id: 'run-4', dispatch_state: 'received' })];
  const list = [{ id: 'run-2', status: 'hold', stage: 'Go 2', updatedAt: '2026-10-19T09:00:00Z' }, { id: 'run-4', status: 'failed', stage: '03 Eye', updatedAt: '2026-10-18T09:00:00Z' }];
  const p = page({ projects: { status: 200, body: { records } }, jobs: { status: 200, body: { jobs: list, total: 2, nextOffset: null, asOf: '2026-10-20T00:00:00Z' } } });
  await p.ready;
  assert.equal(p.node('metricDrafts').textContent, '1');
  assert.equal(p.node('metricProgress').textContent, '0');
  assert.equal(p.node('metricAttention').textContent, '3');
  assert.ok(p.node('metricAttentionBox').classList.contains('is-attention'));
  const items = p.node('attentionList').children;
  assert.equal(items.length, 2);
  const link = items[0].children[2];
  assert.equal(link.href, '/owner/?job=run-2#jobsSection');
  assert.match(p.text(link), /Open job\s+· SOF-2610-02 v1/);
  assert.equal(p.node('attentionMore').hidden, false);
  assert.match(p.node('attentionMore').textContent, /1 more/);
  assert.equal(p.node('recentList').children.length, 2);
  assert.match(p.node('overviewStatus').textContent, /4 saved versions · 2 recorded jobs/);
  assert.deepEqual(p.calls.map(call => call.method), ['GET', 'GET', 'GET'], 'the Overview never writes');
  assert.equal(p.replaced.length, 0);
});

test('unavailable data is said plainly instead of shown as zero', async () => {
  const noProjects = page({ projects: { status: 503, body: { error: 'down' } } });
  await noProjects.ready;
  assert.equal(noProjects.node('metricDrafts').textContent, '—');
  assert.equal(noProjects.node('attentionList').children.length, 0);
  assert.match(noProjects.node('attentionEmpty').textContent, /Saved work is unavailable/);
  assert.match(noProjects.node('overviewStatus').textContent, /Saved work is unavailable/);
  const noJobs = page({ projects: { status: 200, body: { records: [version(1)] } }, jobs: { status: 502, body: {} } });
  await noJobs.ready;
  assert.equal(noJobs.node('metricDrafts').textContent, '1');
  assert.match(noJobs.node('overviewStatus').textContent, /Jobs are unavailable; counts use saved states only/);
  assert.match(noJobs.node('recentEmpty').textContent, /Jobs are unavailable/);
});

test('a signed-out visitor is sent to sign-in and nothing is read', async () => {
  const p = page({ me: { status: 401, body: { error: 'unauthorized' } } });
  await p.ready;
  assert.deepEqual(p.replaced, ['/']);
  assert.deepEqual(p.calls.map(call => call.url), ['/api/owner/me']);
});

test('the page ships as files only (no inline script or style) and links into the studio', () => {
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/, 'no inline script');
  assert.doesNotMatch(html, /<style|\sstyle=|\son[a-z]+=/i, 'no inline style or handler');
  for (const href of ['/owner/start/', '/owner/#savedWorkSection', '/owner/#jobsSection', '/owner/#previousWorkSection', '/owner/catalogue/', '/owner/model-tests/', '/consumer/', '/owner/controls/']) assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /<a href="\/owner\/overview\/" aria-current="page">Overview<\/a>/);
  execFileSync(process.execPath, ['build.mjs'], { cwd: here('.').pathname });
  for (const file of ['index.html', 'overview.css', 'overview.js', 'overview-model.js', 'palette.js']) assert.ok(existsSync(here('dist/owner/overview/' + file)), file);
});

test('every palette and appearance has Overview colours, and the MIDAS wordmark is never recoloured', () => {
  const palettes = JSON.parse(read('palette.js').match(/const PALETTES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  for (const name of palettes) {
    assert.match(css, new RegExp(`:root\\[data-palette="${name}"\\]\\{--o-bg:#`), `${name} light`);
    assert.match(css, new RegExp(`:root\\[data-mode="dark"\\]\\[data-palette="${name}"\\]\\{--o-bg:#`), `${name} dark`);
  }
  assert.doesNotMatch(css, /data-palette="[^"]+"\][^{]*\{[^}]*--o-brand/, 'no palette sets the wordmark colour');
  assert.match(css, /\.wordmark strong\{[^}]*color:var\(--o-brand\)/);
  assert.doesNotMatch(startCss, /data-palette="(glacier|fjord|frost)"[^{]*\.wordmark/, 'cold palettes leave the studio wordmark alone');
});
