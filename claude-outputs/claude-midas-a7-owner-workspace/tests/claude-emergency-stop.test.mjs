import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/a7-budget.mjs';

const call = (action, flag) => {
  const previous = globalThis.Netlify;
  globalThis.Netlify = {env: {get: key => ({A7_READ_AUTHORIZATION: 'synthetic-bridge', A7_PAID_BUDGET_GUARDS_READY: flag})[key]}};
  const request = new Request('https://example.test/api/a7/budget/' + action, {method: 'POST', headers: {authorization: 'synthetic-bridge', 'content-type': 'application/json'}, body: JSON.stringify({clientId: 'owner-x', operationKey: 'k'})});
  return handler(request, {deploy: {context: 'production'}, params: {action}}).finally(() => { globalThis.Netlify = previous; });
};

test('with the emergency stop on, the ledger refuses every new reservation without touching the database', async () => {
  for (const flag of [undefined, 'false', '']) {
    const response = await call('reserve', flag);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {send: false, reason: 'paid_guards_not_ready'});
  }
});

test('with spending allowed, a reservation reaches the ledger (here: no database, so it fails past the stop)', async () => {
  const response = await call('reserve', 'true');
  const body = await response.json();
  assert.notEqual(body.reason, 'paid_guards_not_ready');
});
