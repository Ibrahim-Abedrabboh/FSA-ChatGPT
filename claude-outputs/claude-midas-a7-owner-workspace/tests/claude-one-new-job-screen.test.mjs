import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const here = path => new URL('../' + path, import.meta.url);
const RETIRED = ['client', 'guide', 'draft3', 'desk'];

test('only /owner/ is published as a new-job screen; the retired screens are not built', () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: here('.').pathname });
  assert.ok(existsSync(here('dist/owner/index.html')));
  for (const name of RETIRED) assert.equal(existsSync(here(`dist/owner/${name}/index.html`)), false, name);
});

test('the desk keeps its tools but hides its new-job form and points to /owner/', () => {
  const desk = readFileSync(here('dist/owner/controls/index.html'), 'utf8');
  assert.match(desk, /<div class="composer-wrap" hidden>/);
  assert.match(desk, /desk-new-job-note[^>]*>New jobs are sent from <a href="\/owner\/">/);
  for (const id of ['jobsView', 'detailView', 'actionDialog']) assert.ok(desk.includes(`id="${id}"`), id);
});

test('retired addresses redirect to /owner/ before the owner-role rule', () => {
  const toml = readFileSync(here('netlify.toml'), 'utf8');
  const roleRule = toml.indexOf('conditions = {Role = ["owner"]}');
  for (const name of RETIRED) for (const from of [`/owner/${name}`, `/owner/${name}/*`]) {
    const at = toml.indexOf(`from = "${from}"\n  to = "/owner/"\n  status = 302\n  force = true`);
    assert.ok(at >= 0, from);
    assert.ok(at < roleRule, `${from} must come before the role rule`);
  }
});
