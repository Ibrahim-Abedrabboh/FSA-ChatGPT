import {readdir,readFile} from 'node:fs/promises';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {randomUUID} from 'node:crypto';
import {saveDraft,claimDraft} from '../lib/a7-projects.mjs';
import {checkDispatch,DISPATCH_CHECK_WAIT_MS} from '../lib/a7-dispatch-check.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
const local=new NetlifyDB();let pool;const owner=randomUUID(),other=randomUUID();
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations/',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;});
after(async()=>{if(pool)await pool.end();await local.stop();});
const later=()=>new Date(Date.now()+DISPATCH_CHECK_WAIT_MS+60000);
// A saved version that was sent but whose receipt was never recorded.
async function unsettled(state='confirmed'){
 const {draft}=await saveDraft(pool,owner,{requestId:randomUUID(),mode:'project',title:'Owner test',caseTitle:'Sofa',note:'Original direction',brief:{product:'Sofa',budgetUsd:'4.74'}});
 await claimDraft(pool,owner,draft.id,sharedRunIdentity(draft.id).clientRunId,draft.brief,draft.note);
 if(state!=='confirmed')await pool.query('UPDATE a7_job_versions SET dispatch_state=$2 WHERE id=$1',[draft.id,state]);
 return draft.id;
}
const row=async id=>(await pool.query('SELECT dispatch_state,client_run_id,run_id FROM a7_job_versions WHERE id=$1',[id])).rows[0];
const never=()=>{throw Error('lookup_not_expected');};

test('nothing is decided while the send could still be in flight',async()=>{
 const id=await unsettled(),result=await checkDispatch(pool,owner,id,never);
 assert.equal(result.changed,false);assert.equal(result.state,'confirmed');assert.ok(Date.parse(result.checkAfter)>Date.now());
});

test('A7 has no record and the ledger is empty: the version returns to draft and can be sent again',async()=>{
 const id=await unsettled('outcome_unknown'),asked=[];
 const result=await checkDispatch(pool,owner,id,async runId=>{asked.push(runId);return 'not_found';},later());
 assert.deepEqual(asked,[sharedRunIdentity(id).runId]);
 assert.deepEqual(result,{state:'draft',changed:true});
 assert.deepEqual(await row(id),{dispatch_state:'draft',client_run_id:null,run_id:null});
});

test('A7 has the run: the version is marked received with its run id',async()=>{
 const id=await unsettled(),result=await checkDispatch(pool,owner,id,async()=>'found',later());
 assert.equal(result.state,'received');assert.equal((await row(id)).run_id,sharedRunIdentity(id).runId);
});

const paid=(id,node)=>{const {clientRunId,runId}=sharedRunIdentity(id);return pool.query("INSERT INTO a7_paid_operations(operation_key,client_run_id,run_id,node_name,model,output_id,request_sha256,permit,pricing,reserved_micro_usd,accounted_micro_usd,status) VALUES($1,$2,$3,$4,'m','o','r',$5,'{}',1000,1000,'completed')",[randomUUID(),clientRunId,runId,node,randomUUID()]);};
const budget=id=>{const {clientRunId,runId}=sharedRunIdentity(id);return pool.query("INSERT INTO a7_owner_budgets(client_run_id,owner_id,run_id,limit_micro_usd,pricing_version) VALUES($1,$2,$3,4740000,'test')",[clientRunId,owner,runId]);};
test('the ledger showing A7 worked on the job settles it as received without asking A7',async()=>{
 const id=await unsettled();await budget(id);
 for(const node of ['03 Eye reads the product photo','05 Second count','09 Conflict check'])await paid(id,node);
 await paid(id,'07 Route');
 assert.equal((await checkDispatch(pool,owner,id,never,later())).state,'received');
 const again=await unsettled();await budget(again);
 await paid(again,'03 Eye reads the product photo');await paid(again,'03 Eye reads the product photo');
 assert.equal((await checkDispatch(pool,owner,again,never,later())).state,'received');
});
test('a paid Step 2 source reading alone is not the job: A7 is asked, and no record returns the version to draft',async()=>{
 const id=await unsettled('outcome_unknown');await budget(id);
 for(const node of ['03 Eye reads the product photo','05 Second count','09 Conflict check'])await paid(id,node);
 const asked=[];
 assert.deepEqual(await checkDispatch(pool,owner,id,async runId=>{asked.push(runId);return 'not_found';},later()),{state:'draft',changed:true});
 assert.deepEqual(asked,[sharedRunIdentity(id).runId]);
});

test('an unclear answer, another owner or a settled version changes nothing',async()=>{
 const id=await unsettled();
 const unclear=await checkDispatch(pool,owner,id,async()=>'unknown',later());
 assert.equal(unclear.changed,false);assert.equal(unclear.a7,'unknown');assert.equal((await row(id)).dispatch_state,'confirmed');
 await assert.rejects(checkDispatch(pool,other,id,never,later()),/not_found/);
 await assert.rejects(checkDispatch(pool,owner,'not-an-id',never,later()),/not_found/);
 await pool.query("UPDATE a7_job_versions SET dispatch_state='received' WHERE id=$1",[id]);
 assert.deepEqual(await checkDispatch(pool,owner,id,never,later()),{state:'received',changed:false});
});

test('a version A7 refused at its intake is a draft again; a received one is never reopened',async()=>{
 const {reopenRefusedDraft}=await import('../lib/a7-projects.mjs');
 const id=await unsettled('outcome_unknown');
 await reopenRefusedDraft(pool,owner,id);
 assert.deepEqual(await row(id),{dispatch_state:'draft',client_run_id:null,run_id:null});
 const done=await unsettled();await pool.query("UPDATE a7_job_versions SET dispatch_state='received' WHERE id=$1",[done]);
 await reopenRefusedDraft(pool,owner,done);await reopenRefusedDraft(pool,other,id);
 assert.equal((await row(done)).dispatch_state,'received');
});
