// New case as one vertical timeline: the phase rules (case-timeline.js) and how start.js and start.html use them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const model = read('case-timeline.js'), start = read('start.js'), html = read('start.html');
const load = () => { const context = {}; vm.runInNewContext(model, context); return context.CaseTimeline; };
const KEYS = ['work', 'photos', 'edit', 'product', 'create', 'settings', 'notes', 'review', 'check', 'send'];
const phases = KEYS.map(key => ({ key }));

test('one phase is open at a time; Next checks it, marks it done and opens the next that applies', () => {
  let isEdit = false;
  const t = load().create(phases, { applies: key => key !== 'edit' || isEdit });
  assert.equal(t.open, 'work');
  assert.equal(t.state('edit'), 'skipped');
  assert.deepEqual(JSON.parse(JSON.stringify(t.next(() => false))), { moved: false, open: 'work', failed: 'work' }, 'a failed check stays put');
  assert.equal(t.next().open, 'photos');
  assert.equal(t.state('work'), 'done');
  assert.equal(t.next().open, 'product', 'The edit is skipped when the work is not an edit');
  assert.equal(t.number('product'), 3);
  isEdit = true;
  assert.equal(t.number('product'), 4, 'choosing Edit adds its phase back into the numbering');
  assert.equal(t.back(), 'edit');
  assert.equal(t.previous(), 'photos');
});

test('Next re-checks earlier answers, so a changed answer reopens where it must be fixed', () => {
  const t = load().create(phases, { applies: key => key !== 'edit' });
  t.next(); t.next(); t.next(); t.next();
  assert.equal(t.open, 'settings');
  const result = t.next(key => key !== 'photos');
  assert.equal(result.failed, 'photos');
  assert.equal(t.open, 'photos');
  assert.equal(t.state('photos'), 'open');
});

test('Change reopens a done phase; the last phase has no Next; a jump marks the phases before it done', () => {
  const t = load().create(phases, { applies: () => true });
  t.jumpTo('edit');
  assert.equal(t.state('work'), 'done'); assert.equal(t.state('photos'), 'done'); assert.equal(t.open, 'edit');
  assert.equal(t.reopen('work'), 'work');
  assert.equal(t.reopen('nope'), 'work', 'an unknown phase is ignored');
  for (let i = 0; i < 12; i++) t.next();
  assert.equal(t.open, 'send'); assert.ok(t.isLast('send')); assert.equal(t.following(), '');
  assert.equal(t.next().moved, false);
});

test('start.js lays the flow out in this order, with the two paid steps last and only the photo, edit and outcome steps required', () => {
  const keys = [...start.matchAll(/\{ key: '(\w+)', title: '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(keys, KEYS);
  const line = key => start.split('\n').find(l => l.includes(`{ key: '${key}',`));
  for (const key of ['check', 'send']) assert.match(line(key), /paid: true/, key + ' is marked paid');
  for (const key of ['product', 'settings', 'notes']) assert.match(line(key), /optional: true/, key + ' is optional');
  assert.match(start, /const PHASE_CHECKS = \{ work: validateChoice, photos: validateSource, edit: validateEdit, create: validateCreate \};/);
  assert.match(line('edit'), /applies: \(\) => state\.intent === 'edit'/);
  assert.match(html, /<script src="\.\/case-timeline\.js" defer><\/script>\s*<script src="\.\/start\.js" defer><\/script>/);
});

test('every pop-up on the studio page has a close button, help bubbles included', () => {
  for (const match of html.matchAll(/<dialog\b[^>]*id="(\w+)"[^>]*>([\s\S]*?)<\/dialog>/g)) {
    assert.match(match[2], /<button[^>]*(aria-label="Close[^"]*"|id="\w*[Cc]lose\w*")[^>]*>/, `${match[1]} has a close button`);
  }
  const bubbles = [...html.matchAll(/class="help-pop" hidden>([\s\S]*?)<\/span><\/span>/g)];
  assert.equal(bubbles.length, 9);
  for (const bubble of bubbles) assert.match(bubble[1], /<button type="button" class="help-close" aria-label="Close help">×<\/button>$/);
  assert.match(start, /for \(const button of document\.querySelectorAll\('\.help-close'\)\) button\.addEventListener\('click'/);
});

test('every pop-up on every owner and client page has a close button', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const root = new URL('../', import.meta.url).pathname, pages = [];
  const walk = dir => { for (const name of readdirSync(dir)) { if (['node_modules', 'dist', 'tests', 'previous-work'].includes(name)) continue; const path = dir + name; if (statSync(path).isDirectory()) walk(path + '/'); else if (name.endsWith('.html')) pages.push(path); } };
  walk(root);
  let dialogs = 0;
  for (const page of pages) for (const match of readFileSync(page, 'utf8').matchAll(/<dialog\b[^>]*id="([\w-]+)"[^>]*>([\s\S]*?)<\/dialog>/g)) {
    dialogs++;
    assert.match(match[2], /<button[^>]*(aria-label="Close[^"]*"|id="[\w-]*[Cc]lose[\w-]*")[^>]*>|<button[^>]*>\s*Close\s*<\/button>/, `${page.slice(root.length)} #${match[1]} has a close button`);
  }
  assert.ok(dialogs >= 15, `found ${dialogs} pop-ups`);
});
