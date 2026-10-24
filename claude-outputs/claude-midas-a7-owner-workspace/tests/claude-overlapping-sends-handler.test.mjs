// Overlapping sends through the send gate the handler uses (lib/claude-a7-send-gate.mjs) on the local database emulator.
// send() below repeats the handler's steps after the early checks (check, confirm, claim, gate, A7 call or failure) with the
// real database queries; where the handler places the gate is checked from its source in the last test.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {saveDraft, claimDraft} from '../lib/a7-projects.mjs';
import {claimOnce} from '../lib/a7-actions.mjs';
import {takeSend, settleUnsentFailure, SEND_IN_PROGRESS, NOT_SENT, NOT_SENT_CHECK_JOBS} from '../lib/claude-a7-send-gate.mjs';

const local = new NetlifyDB();
let pool;
const owner = randomUUID();
before(async () => {
  const connectionString = await local.start();
  await local.applyMigrations(new URL('../netlify/database/migrations/', import.meta.url).pathname);
  pool = getDatabase({connectionString}).pool;
});
after(async () => { if (pool) await pool.end(); await local.stop(); });

const memoryStore = () => {
  const values = new Map();
  return {
    values,
    setJSON: async (key, value, {onlyIfNew} = {}) => { if (onlyIfNew && values.has(key)) return {modified: false}; values.set(key, value); return {modified: true}; },
    get: async key => values.get(key) ?? null,
    delete: async key => { values.delete(key); },
  };
};
const state = async id => (await pool.query('SELECT dispatch_state FROM a7_job_versions WHERE id=$1', [id])).rows[0].dispatch_state;
async function draftFor() {
  const x = {requestId: randomUUID(), mode: 'project', title: 'Overlap test', caseTitle: 'Sofa', note: 'Keep the sofa.', brief: {product: 'Sofa', budgetUsd: '3.00'}};
  const {draft} = await saveDraft(pool, owner, x);
  return {id: draft.id, client: 'owner-' + draft.id, brief: x.brief, note: x.note};
}

// Waits for a version state, failing after two seconds instead of hanging.
async function until(id, wanted) {
  const end = Date.now() + 2000;
  while (await state(id) !== wanted) { if (Date.now() > end) assert.fail('version never reached ' + wanted); await new Promise(r => setTimeout(r, 5)); }
}
// One send as the handler runs it: each tab has its own request id, so the claim never stops a second tab; the gate must.
// The early check refusing a version that is no longer a draft is the handler's sendRefusal path (draft_already_submitted).
async function send(d, store, a7, {failBeforeGate = false, afterCheck = async () => {}, afterClaim = async () => {}} = {}) {
  const key = 'submit/' + randomUUID();
  let submitClaim = null, confirmedHere = false, reached = false;
  try {
    await claimDraft(pool, owner, d.id, d.client, d.brief, d.note, false);
  } catch (error) { return {status: 409, body: {error: error.message}, key}; }
  try {
    await afterCheck();
    await claimDraft(pool, owner, d.id, d.client, d.brief, d.note);
    confirmedHere = true;
    if (await claimOnce(store, key, 'fingerprint')) submitClaim = key;
    await afterClaim(key);
    if (failBeforeGate) throw new Error('blob_store_unavailable');
    const busy = await takeSend(pool, {ownerId: owner, draftId: d.id, clientRunId: d.client, store, submitClaim});
    if (busy) return {status: 409, body: busy, key};
    reached = true;
    await a7();
    return {status: 200, body: {accepted: true}, key};
  } catch {
    if (reached) return {status: 502, body: {error: 'outcome_unknown'}, key};
    return {...await settleUnsentFailure(() => pool, {ownerId: owner, draftId: d.id, clientRunId: d.client, store, submitClaim, confirmedHere}), key};
  }
}

test('of many overlapping sends of one version, exactly one calls A7; the others are told a send is on its way', async () => {
  const d = await draftFor(), store = memoryStore();
  // All eight pass the early check while the version is a draft before any confirms (eight tabs sent at once).
  let checked = 0, open, calls = 0;
  const allChecked = new Promise(resolve => { open = resolve; });
  const afterCheck = async () => { if (++checked === 8) open(); await allChecked; };
  const results = await Promise.all(Array.from({length: 8}, () => send(d, store, async () => { calls++; }, {afterCheck})));
  assert.equal(calls, 1, 'A7 is called once');
  assert.equal(results.filter(r => r.status === 200).length, 1);
  for (const r of results.filter(r => r.status !== 200)) {
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, SEND_IN_PROGRESS);
    assert.equal(store.values.has('claims/' + r.key), false, 'a stopped send releases its claim');
  }
  assert.equal(await state(d.id), 'sending');
});

test('a send that confirmed and claimed, then failed before its gate while another is sending, reopens nothing and says to check Jobs', async () => {
  const d = await draftFor(), store = memoryStore();
  // Both sends pass the early check while the version is a draft, then both confirm (two tabs).
  let checked = 0, open;
  const bothChecked = new Promise(resolve => { open = resolve; });
  const afterCheck = async () => { if (++checked === 2) open(); await bothChecked; };
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const first = send(d, store, () => held, {afterCheck});
  let claimedBeforeFailing = false;
  const failed = await send(d, store, async () => assert.fail('a failed send never calls A7'), {afterCheck, failBeforeGate: true,
    afterClaim: async key => { claimedBeforeFailing = store.values.has('claims/' + key); await until(d.id, 'sending'); }});
  assert.ok(claimedBeforeFailing, 'the failing send confirmed and took its claim before it failed');
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, NOT_SENT_CHECK_JOBS);
  assert.equal(store.values.has('claims/' + failed.key), false, 'its claim is released');
  assert.equal(await state(d.id), 'sending', 'the version on its way to A7 is not reopened');
  release();
  assert.equal((await first).status, 200);
});

test('a send that fails before its gate with no other send reopens its draft and can be sent again', async () => {
  const d = await draftFor(), store = memoryStore();
  const failed = await send(d, store, async () => assert.fail('never called'), {failBeforeGate: true});
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, NOT_SENT);
  assert.equal(await state(d.id), 'draft');
  let calls = 0;
  assert.equal((await send(d, store, async () => { calls++; })).status, 200);
  assert.equal(calls, 1);
});

test('the handler sends through this gate, so these tests cover its send path', async () => {
  const src = await readFile(new URL('../netlify/functions/owner-actions.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{takeSend,settleUnsentFailure\} from '\.\.\/\.\.\/lib\/claude-a7-send-gate\.mjs'/);
  assert.doesNotMatch(src, /markSending\(|reopenUnsentDraft\(/, 'the handler has no second, untested copy of the gate');
});
