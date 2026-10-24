// The budget and image-call rules (CLAUDE.md rule 22) checked on the workflow the Python service actually runs:
// n8n/baseline/1cgZc9rmBOrPdKIe.json (version 4669b0d7, 362 nodes). The older budget suites read the 183-node
// export in n8n/claude-midas-a7/ that their build scripts patch; this suite reads the frozen baseline itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CALL_POLICY} from '../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-budget.mjs';

const baseline = JSON.parse(await readFile(new URL('../../n8n/baseline/1cgZc9rmBOrPdKIe.json', import.meta.url), 'utf8'));
const node = name => baseline.nodes.find(n => n.name === name);
const incoming = target => Object.entries(baseline.connections).flatMap(([from, types]) =>
  Object.values(types).flatMap(outputs => outputs.flatMap((group, branch) => (group || []).filter(e => e.node === target).map(() => ({from, branch})))));
const IMAGE_CALL = '15g Send to Google';
const PROVIDERS = /generativelanguage\.googleapis\.com|api\.openai\.com|api\.anthropic\.com/;
const MODEL_TYPES = /lmChat|openAi|anthropic|googleGemini/i;

test('the baseline is the version the service runs', () => {
  assert.equal(baseline.versionId, '4669b0d7-fc52-4b76-94a7-63fd52a0ae58');
  assert.equal(baseline.nodes.length, 362);
});

test('each of the 12 paid calls is entered only through its own budget permit', () => {
  assert.equal(Object.keys(CALL_POLICY).length, 12);
  for (const name of Object.keys(CALL_POLICY)) {
    const prefix = 'Budget · ' + name.split(' ')[0] + ' · ';
    assert.ok(node(name), name);
    assert.deepEqual(incoming(name), [{from: prefix + 'Allowed', branch: 0}], name);
    for (const step of ['Reserve', 'Settle']) assert.ok(!node(prefix + step).retryOnFail, prefix + step + ' must not retry');
  }
});

test('the image call never retries; text and vision calls retry at most once', () => {
  assert.ok(!node(IMAGE_CALL).retryOnFail, 'the image call is never retried');
  assert.equal(node(IMAGE_CALL).maxTries, undefined);
  for (const name of Object.keys(CALL_POLICY)) {
    if (name === IMAGE_CALL || !node(name).retryOnFail) continue;
    assert.ok(node(name).maxTries <= 2, `${name}: at most one retry inside one reservation (maxTries ${node(name).maxTries})`);
  }
});

test('every model node in the main flow is one of the 12 budgeted calls', () => {
  const models = baseline.nodes.filter(n => MODEL_TYPES.test(n.type)).map(n => n.name);
  assert.ok(models.length > 0);
  for (const name of models) assert.ok(name in CALL_POLICY, `${name} calls a model without a budget permit`);
});

test('provider HTTP calls outside the 12 are known: the unpaid image poll and the one-off recovery calls, none retried but the poll', () => {
  const known = new Set(['15k Ask Google', 'Recovery · Count fallback input', 'Blind · Count input', 'Blind · OpenAI once']);
  for (const n of baseline.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest' && PROVIDERS.test(JSON.stringify(n.parameters || {})))) {
    if (n.name in CALL_POLICY) continue;
    assert.ok(known.has(n.name), `${n.name} calls a provider and is neither budgeted nor known`);
    if (n.name !== '15k Ask Google') assert.ok(!n.retryOnFail, `${n.name} must not retry`);
  }
});
