import test from 'node:test';
import assert from 'node:assert/strict';
import connection from '../netlify/functions/owner-connection.mjs';
import {modelTestWebhook} from '../lib/model-tests.mjs';

const withEnv = async (vars, fn) => {
  const previous = globalThis.Netlify, previousFetch = globalThis.fetch, calls = [];
  globalThis.Netlify = {env: {get: key => vars[key]}};
  globalThis.fetch = async url => { url = String(url); calls.push(url); return url.includes('owner-read') ? Response.json({jobs: [], total: 0, asOf: '2026-10-22T08:00:00Z'}) : Response.json({id: 'owner', app_metadata: {roles: ['owner']}}); };
  try { return await fn(calls); } finally { globalThis.Netlify = previous; globalThis.fetch = previousFetch; }
};
const ctx = {cookies: {get: () => 'synthetic-test-token'}, site: {url: 'https://example.test'}, deploy: {context: 'production'}};
const check = () => connection(new Request('https://example.test/api/owner/connection'), ctx).then(r => r.json());

test('the connection check names the configured runner host', async () => {
  await withEnv({A7_READ_AUTHORIZATION: 'synthetic', A7_ENGINE_BASE_URL: 'https://midas-a7-production.up.railway.app'}, async calls => {
    const body = await check();
    assert.equal(body.connected, true);
    assert.equal(body.engine, 'runner');
    assert.equal(body.engineHost, 'midas-a7-production.up.railway.app');
    assert.ok(calls.some(u => u.startsWith('https://midas-a7-production.up.railway.app/webhook/a7/owner-read')));
  });
  await withEnv({A7_READ_AUTHORIZATION: 'synthetic'}, async () => {
    const body = await check();
    assert.equal(body.connected, false);
    assert.equal(body.reason, 'a7_engine_not_configured');
    assert.equal(body.engine, 'unconfigured');
  });
});

test('the engine address is read when a call is made, not when the module loads', async () => {
  await withEnv({A7_ENGINE_BASE_URL: 'https://midas-a7-production.up.railway.app'}, async () => {
    assert.equal(modelTestWebhook(), 'https://midas-a7-production.up.railway.app/webhook/a7/model-test');
  });
  await withEnv({}, async () => {
    assert.throws(()=>modelTestWebhook(),/A7 engine not configured/);
  });
});
