import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler, {actionStore} from '../netlify/functions/owner-actions.mjs';
import {a7SendRefusal, sendRefusal} from '../lib/a7-actions.mjs';

const memoryStore = () => {
  const values = new Map();
  return {
    setJSON: async (key, value, {onlyIfNew} = {}) => { if (onlyIfNew && values.has(key)) return {modified: false}; values.set(key, value); return {modified: true}; },
    get: async key => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value); return {modified: true}; },
    delete: async key => { values.delete(key); },
  };
};

test('a 401, 403 or 404 from the engine is a definite refusal, not an unknown outcome', async () => {
  for (const status of [401, 403, 404]) {
    const refusal = a7SendRefusal({accepted: false, forwarded: false, receiptKind: 'rejected', upstreamStatus: status, error: 'engine_http_' + status});
    assert.ok(refusal, String(status));
    assert.equal(refusal.refused, true);
    assert.match(refusal.message, new RegExp(`answer ${status}`));
    assert.match(refusal.message, /Nothing was read or paid by this send/);
  }
});

test('a decision the engine refuses with 401 is not confirmed, logged, and can be sent again', async () => {
  const context = {runId: 'claude-a7-run', clientId: 'owner-' + randomUUID(), status: 'awaiting_go_1', gate: 'go1', round: 1, revision: 'a'.repeat(64), allowed: ['go', 'change', 'stop'], shots: [], warnings: []};
  const previousFetch = globalThis.fetch, previousNetlify = globalThis.Netlify, previousStore = actionStore.get, previousError = console.error;
  const logged = [];
  let answer = 401, decisions = 0;
  globalThis.Netlify = {env: {get: key => ({A7_OWNER_ACTIONS_ENABLED: 'true', A7_READ_AUTHORIZATION: 'synthetic', A7_ENGINE_BASE_URL: 'https://runner.example'})[key]}};
  actionStore.get = (() => { const m = memoryStore(); return () => m; })();
  console.error = (...args) => logged.push(args.join(' '));
  globalThis.fetch = async url => {
    url = String(url);
    if (url.includes('owner-context')) return Response.json(context);
    if (url.includes('owner-decision')) { decisions++; return answer === 401 ? new Response('unauthorized', {status: 401}) : Response.json({accepted: true, forwarded: true, clientId: context.clientId, outcome: 'received'}); }
    return Response.json({id: 'owner', app_metadata: {roles: ['owner']}});
  };
  const send = () => handler(new Request('https://example.test/api/owner/jobs/claude-a7-run/approval', {method: 'POST', headers: {origin: 'https://example.test', 'content-type': 'application/json'}, body: JSON.stringify({requestId: randomUUID(), revision: context.revision, decision: 'stop', note: '', confirmed: true})}), {params: {id: 'claude-a7-run'}, cookies: {get: () => 'synthetic-test-token'}, site: {url: 'https://example.test'}, deploy: {context: 'production'}});
  try {
    const refused = await send();
    assert.equal(refused.status, 502);
    assert.match((await refused.json()).message, /did not confirm this decision/);
    assert.ok(logged.some(line => line.includes('not accepted') && line.includes('401')), 'the refusal is logged with its status');
    assert.ok(logged.every(line => !line.includes('synthetic')), 'no secret is logged');
    answer = 200;
    const retried = await send();
    assert.equal(retried.status, 200, 'the gate is not locked by the refused attempt');
    assert.equal(decisions, 2);
  } finally {
    globalThis.fetch = previousFetch; globalThis.Netlify = previousNetlify; actionStore.get = previousStore; console.error = previousError;
  }
});

test('an unexpected error during the send check is not blamed on the source facts, and is logged', () => {
  const previousError = console.error, logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const {status, body} = sendRefusal('connect ECONNREFUSED');
    assert.equal(status, 503);
    assert.equal(body.error, 'send_check_unavailable');
    assert.doesNotMatch(body.message, /source facts/);
    assert.match(body.message, /Nothing was sent to A7/);
    assert.ok(logged.some(line => line.includes('send check failed')));
    assert.equal(sendRefusal('source_verification_unavailable').body.error, 'source_verification_unavailable');
    assert.equal(sendRefusal('source_confirmation_required').status, 409);
  } finally { console.error = previousError; }
});

test('a send that fails before leaving the site reopens only a still-confirmed version; the A7 call is gated on sending', async () => {
  const {reopenUnsentDraft} = await import('../lib/a7-projects.mjs');
  const queries = [];
  const pool = rows => ({query: async (sql, params) => { queries.push({sql, params}); return {rowCount: rows}; }});
  assert.equal(await reopenUnsentDraft(pool(1), 'owner', 'v1', 'owner-run'), true);
  assert.match(queries[0].sql, /dispatch_state='confirmed' AND client_run_id=\$3/);
  assert.doesNotMatch(queries[0].sql, /outcome_unknown/, 'an unknown outcome is never reopened (rule 22)');
  assert.deepEqual(queries[0].params, ['v1', 'owner', 'owner-run']);
  assert.equal(await reopenUnsentDraft(pool(0), 'owner', 'v1', 'owner-run'), false);
  const src = await readFile(new URL('../netlify/functions/owner-actions.mjs', import.meta.url), 'utf8');
  const reachedAt = src.indexOf('reached=true;'), callAt = src.indexOf("const result=await upstream('owner-'+operation");
  assert.ok(reachedAt > 0 && reachedAt < callAt, 'the request is marked as having left only right before the engine call');
  assert.ok(src.indexOf('input.instructions.trim());confirmedHere=true;') > 0, 'confirmedHere is set only after this send confirms');
  const gateAt = src.indexOf('const busy=await takeSend(');
  assert.ok(gateAt > 0 && gateAt < reachedAt, 'only the send that moves the version to sending calls A7');
  assert.ok(src.indexOf('settleUnsentFailure(') > callAt, 'a failure before the send left settles through the gate library');
});

test('the background photo reader logs why it did not start, instead of stopping silently', async () => {
  const {createSourceAnalysisBackground} = await import('../netlify/functions/owner-source-analysis-background.mjs');
  const calls = [], handlerFn = createSourceAnalysisBackground(() => ({execute: async () => calls.push(1)}));
  const previousError = console.error, logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    await handlerFn(new Request('https://example.test/x', {method: 'GET'}), {deploy: {context: 'production'}});
    await handlerFn(new Request('https://example.test/x', {method: 'POST', body: '{}'}), {deploy: {context: 'deploy-preview'}});
    assert.equal(calls.length, 0, 'no paid read starts');
    assert.ok(logged.some(line => line.includes('not started') && line.includes('method_GET')));
    assert.ok(logged.some(line => line.includes('not started') && line.includes('deploy_context_deploy-preview')));
  } finally { console.error = previousError; }
});

test('engine file links are kept only from the configured engine; Drive links still pass; anything else is dropped', async () => {
  const {readFile: read} = await import('node:fs/promises'), {runInNewContext} = await import('node:vm');
  const source = await read(new URL('../netlify/functions/owner-actions.mjs', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function cleanContext'), source.indexOf('export default async function handler'));
  const sig = 'b'.repeat(64), id = '1' + 'a'.repeat(32);
  const good = `https://midas-a7-production.up.railway.app/files/${id}/view?sig=${sig}`;
  const drive = 'https://drive.google.com/file/d/abcdefghijklmn/view';
  const context = {runId: 'run', gate: 'go2', allowed: ['approve'], shots: [], warnings: [], revision: 'a'.repeat(64), candidate: good,
    deliveries: [{link: good, label: 'Master'}, {link: drive, label: 'Old'}, {link: `https://evil.example/files/${id}/view?sig=${sig}`}, {link: `${good}&x=1`}, {link: `https://midas-a7-production.up.railway.app/files/${id}/view`}]};
  const run = (origin, ctx) => runInNewContext(`const a7Origin=()=>${JSON.stringify(origin)};const Netlify={env:{get:()=>'true'}};` + code + ';cleanContext(ctx,"run")', {ctx});
  const on = run('https://midas-a7-production.up.railway.app', context);
  assert.deepEqual(on.deliveries.map(d => d.link), [good, drive]);
  assert.equal(on.candidate, good);
  const off = run('https://ibrahimnewaeon.app.n8n.cloud', context);
  assert.deepEqual(off.deliveries.map(d => d.link), [drive], 'a site still on n8n does not accept service links');
  assert.equal(off.candidate, null);
  assert.equal(run('https://midas-a7-production.up.railway.app', {...context, candidate: 'javascript:alert(1)'}).candidate, null);
});

test('at Go 2 an image the owner cannot open is never offered for approval', async () => {
  const {readFile: read} = await import('node:fs/promises'), {runInNewContext} = await import('node:vm');
  const source = await read(new URL('../netlify/functions/owner-actions.mjs', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function cleanContext'), source.indexOf('export default async function handler'));
  const run = ctx => runInNewContext('const a7Origin=()=>"https://midas-a7-production.up.railway.app";const Netlify={env:{get:()=>"true"}};' + code + ';cleanContext(ctx,"run")', {ctx});
  const base = {runId: 'run', shots: [], warnings: [], revision: 'a'.repeat(64)};
  const go2 = {...base, gate: 'go2', allowed: ['approve', 'repair', 'stop'], candidate: 'https://other.example/files/1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/view?sig=' + 'b'.repeat(64)};
  assert.deepEqual(run(go2).allowed, ['stop']);
  const good = {...go2, candidate: 'https://midas-a7-production.up.railway.app/files/1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/view?sig=' + 'b'.repeat(64)};
  assert.deepEqual(run(good).allowed, ['approve', 'repair', 'stop']);
  assert.deepEqual(run({...base, gate: 'go1', allowed: ['go', 'change', 'stop']}).allowed, ['go', 'change', 'stop'], 'Go 1 has no candidate image');
});
