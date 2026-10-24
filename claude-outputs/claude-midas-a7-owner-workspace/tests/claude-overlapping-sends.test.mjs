// Two sends of one saved version can overlap (two tabs, a quick resend). Only one may ever call A7 (rule 22).
// Runs the real dispatch-state queries on the local database emulator.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {saveDraft, claimDraft, markSending, reopenUnsentDraft, reopenRefusedDraft, recordDraftReceipt} from '../lib/a7-projects.mjs';

const local = new NetlifyDB();
let pool;
const owner = randomUUID();
before(async () => {
  const connectionString = await local.start();
  await local.applyMigrations(new URL('../netlify/database/migrations/', import.meta.url).pathname);
  pool = getDatabase({connectionString}).pool;
});
after(async () => { if (pool) await pool.end(); await local.stop(); });

const state = async id => (await pool.query('SELECT dispatch_state FROM a7_job_versions WHERE id=$1', [id])).rows[0].dispatch_state;
async function draftFor() {
  const x = {requestId: randomUUID(), mode: 'project', title: 'Overlap test', caseTitle: 'Sofa', note: 'Keep the sofa.', brief: {product: 'Sofa', budgetUsd: '3.00'}};
  const {draft} = await saveDraft(pool, owner, x);
  return {id: draft.id, client: 'owner-' + draft.id, brief: x.brief, note: x.note};
}
// Both sends pass the early check while the version is a draft, then both confirm.
async function bothConfirmed(d) {
  await claimDraft(pool, owner, d.id, d.client, d.brief, d.note, false);
  await claimDraft(pool, owner, d.id, d.client, d.brief, d.note, false);
  await claimDraft(pool, owner, d.id, d.client, d.brief, d.note);
  await claimDraft(pool, owner, d.id, d.client, d.brief, d.note);
}

test('only one of two overlapping sends may call A7', async () => {
  const d = await draftFor();
  await bothConfirmed(d);
  assert.equal(await markSending(pool, owner, d.id, d.client), true, 'send A takes the version');
  assert.equal(await markSending(pool, owner, d.id, d.client), false, 'send B stops before calling A7');
  assert.equal(await state(d.id), 'sending');
});

test('a send that fails before calling A7 never reopens a version another send is sending', async () => {
  const d = await draftFor();
  await bothConfirmed(d);
  await markSending(pool, owner, d.id, d.client);
  assert.equal(await reopenUnsentDraft(pool, owner, d.id, d.client), false);
  assert.equal(await state(d.id), 'sending');
  await claimDraft(pool, owner, d.id, d.client, d.brief, d.note);
  assert.equal(await state(d.id), 'sending', 'a late confirm cannot move a sending version back to confirmed');
});

test('when the failed send reopens first, the other send can no longer call A7', async () => {
  const d = await draftFor();
  await bothConfirmed(d);
  assert.equal(await reopenUnsentDraft(pool, owner, d.id, d.client), true);
  assert.equal(await state(d.id), 'draft');
  assert.equal(await markSending(pool, owner, d.id, d.client), false, 'send A finds no confirmed version and stops');
});

test('an outcome A7 has not confirmed is never reopened by a failed send; an A7 refusal still reopens a sending version', async () => {
  const d = await draftFor();
  await bothConfirmed(d);
  await markSending(pool, owner, d.id, d.client);
  await recordDraftReceipt(pool, owner, d.id, 'outcome_unknown', null);
  assert.equal(await reopenUnsentDraft(pool, owner, d.id, d.client), false);
  assert.equal(await state(d.id), 'outcome_unknown');
  const e = await draftFor();
  await bothConfirmed(e);
  await markSending(pool, owner, e.id, e.client);
  await reopenRefusedDraft(pool, owner, e.id);
  assert.equal(await state(e.id), 'draft', 'A7 refused at intake: nothing was read or paid, so the version is a draft again');
});
