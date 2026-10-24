import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {openBudget,reserveCall,settleCall,readBudget,quoteCall} from '../lib/a7-budget.mjs';
import {prepareReaderRecovery,beginReaderRecovery,readerRecoveryEligibility,resumePendingReaderRecovery} from '../lib/a7-reader-recovery.mjs';
const local=new NetlifyDB();let pool;const owner=randomUUID();
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;
 // The embedded local engine has one transaction context. Keep transactions on
 // one connection; concurrent callers still exercise unique claims and denials.
 pool.options.max=1;});
after(async()=>{if(pool)await pool.end();await local.stop();});
async function checkpoint(){const clientId='owner-'+randomUUID(),runId='test-reader-run';await openBudget(pool,{clientId,ownerId:owner,limitUsd:4.74});
 const call=(node,model,cap,inputTokens)=>({clientId,runId,node,model,outputTokens:cap,inputTokens,operationKey:node.split(' ')[0]+clientId,outputId:'job',requestSha256:'a'.repeat(64)});
 const eye=call('03 Eye reads the product photo','gemini-3.8-flash',16000,1048576),p=await reserveCall(pool,eye);await settleCall(pool,{clientId,operationKey:eye.operationKey,permit:p.permit,usage:null});
 const second=call('05 Second count','claude-sonnet-5-5',1500,1048576),q=await reserveCall(pool,second);await settleCall(pool,{clientId,operationKey:second.operationKey,permit:q.permit,usage:{input:1000,output:100}});
 return {clientId,runId,input:{requestId:randomUUID(),confirmed:true,revision:'b'.repeat(64),sourceSha256:'c'.repeat(64),additionalBudgetUsd:3.89}};}
test('recovery reserves the uncertain charge, tightens the cap and starts only once under concurrency',async()=>{const c=await checkpoint(),before=await readBudget(pool,owner,c.clientId);assert.equal(readerRecoveryEligibility(before,'hold'),true);const claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);const after=await readBudget(pool,owner,c.clientId);assert.equal(after.operations[0].status,'uncertain');assert.equal(after.budget.committed_micro_usd,before.budget.committed_micro_usd);assert.ok(Number(after.budget.limit_micro_usd)<=Number(after.budget.committed_micro_usd)+3890000);
 const starts=await Promise.allSettled([beginReaderRecovery(pool,claim),beginReaderRecovery(pool,claim)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',{...c.input,requestId:randomUUID()}),/recovery_already_requested/);
});
test('cross-owner, non-held, changed-source and unclaimed recovery are denied',async()=>{const c=await checkpoint();await assert.rejects(prepareReaderRecovery(pool,randomUUID(),c.clientId,c.runId,'hold',c.input),/not_found/);await assert.rejects(prepareReaderRecovery(pool,owner,c.clientId,c.runId,'awaiting_go_1',c.input),/recovery_not_available/);const claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);await assert.rejects(beginReaderRecovery(pool,{...claim,sourceSha256:'d'.repeat(64)}),/recovery_not_available/);await assert.rejects(beginReaderRecovery(pool,{...claim,requestId:randomUUID()}),/recovery_not_available/);});
test('only the exact-input-counted fallback may use a smaller input reservation',()=>{const req={clientId:'owner-'+randomUUID(),runId:'run',operationKey:'op',node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',outputId:'job',requestSha256:'a'.repeat(64),inputTokens:2000,outputTokens:16000,inputBasis:'provider_counted_exact_request',countedRequestSha256:'a'.repeat(64)};assert.equal(quoteCall(req).reserve,248000);assert.throws(()=>quoteCall({...req,countedRequestSha256:'b'.repeat(64)}),/call_policy_mismatch/);assert.throws(()=>quoteCall({...req,node:'11 Stylist plans the scenes',outputTokens:8000}),/call_policy_mismatch/);assert.throws(()=>quoteCall({...req,inputBasis:undefined}),/call_policy_mismatch/);});

test('pending recovery redispatch reuses claim once, keeps uncertain reservation and cannot raise cap',async()=>{
 const c=await checkpoint(),claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),before=await readBudget(pool,owner,c.clientId);
 const attempts=await Promise.allSettled([resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual(attempts.find(x=>x.status==='fulfilled').value,claim);
 const after=await readBudget(pool,owner,c.clientId);assert.equal(after.budget.committed_micro_usd,before.budget.committed_micro_usd);assert.equal(after.budget.limit_micro_usd,before.budget.limit_micro_usd);assert.equal(after.operations[0].status,'uncertain');
 const starts=await Promise.allSettled([beginReaderRecovery(pool,claim),beginReaderRecovery(pool,claim)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
});
test('pending redispatch denies wrong owner, changed revision or source, started claim and excess budget',async()=>{
 const c=await checkpoint();await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);
 await assert.rejects(resumePendingReaderRecovery(pool,randomUUID(),c.clientId,c.runId,'hold',c.input),/not_found/);
 for(const changed of [{revision:'d'.repeat(64)},{sourceSha256:'d'.repeat(64)},{additionalBudgetUsd:3.90},{confirmed:false}])await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',{...c.input,...changed}));
 const claim=await resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);await beginReaderRecovery(pool,claim);
 await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),/recovery_not_available/);
});
test('transport repair preserves existing claim and permits a single redispatch but no duplicate paid start',async()=>{
 const c=await checkpoint(),original=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);
 await resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);
 const input={...c.input,transportRepair:true};
 const attempts=await Promise.allSettled([resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual(attempts.find(x=>x.status==='fulfilled').value,original);
 const starts=await Promise.allSettled([beginReaderRecovery(pool,original),beginReaderRecovery(pool,original)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
 const ledger=await readBudget(pool,owner,c.clientId);assert.equal(ledger.operations.length,2);assert.equal(ledger.operations[0].status,'uncertain');
 await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),/recovery_not_available/);
});
test('verified bridge repair keeps the original request and denies a second repaired dispatch',async()=>{
 const c=await checkpoint(),original=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),input={...c.input,bridgeRepair:true};
 const attempts=await Promise.allSettled([resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual(attempts.find(x=>x.status==='fulfilled').value,original);
 await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),/recovery_not_available/);
 await beginReaderRecovery(pool,original);await assert.rejects(beginReaderRecovery(pool,original),/recovery_not_available/);
});
test('receipt repair reuses original claim and can never start paid recovery twice',async()=>{
 const c=await checkpoint(),claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),input={...c.input,receiptRepair:true};
 assert.deepEqual(await resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),claim);
 await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),/recovery_not_available/);
 await beginReaderRecovery(pool,claim);await assert.rejects(beginReaderRecovery(pool,claim),/recovery_not_available/);
});
test('buffered forward repair remains bound to one original claim and one paid start',async()=>{
 const c=await checkpoint(),claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input),input={...c.input,bufferedRepair:true};
 assert.deepEqual(await resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),claim);await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),/recovery_not_available/);
 await beginReaderRecovery(pool,claim);await assert.rejects(beginReaderRecovery(pool,claim),/recovery_not_available/);
});
test('routing repair keeps earlier delivery markers, reuses the original request and allows one delivery and one start',async()=>{
 const c=await checkpoint(),claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);
 await resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',{...c.input,bufferedRepair:true});
 const before=await readBudget(pool,owner,c.clientId),input={...c.input,routeRepair:true};
 const deliveries=await Promise.allSettled([resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input),resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',input)]);
 assert.equal(deliveries.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual(deliveries.find(x=>x.status==='fulfilled').value,claim);
 const {rows:[audit]}=await pool.query("SELECT detail FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_requested'",[c.clientId]);
 assert.equal(audit.detail.bufferedRepairDispatched,true);assert.equal(audit.detail.routeRepairDispatched,true);assert.equal(audit.detail.started,false);assert.equal(audit.detail.requestId,claim.requestId);
 const after=await readBudget(pool,owner,c.clientId);assert.equal(after.budget.limit_micro_usd,before.budget.limit_micro_usd);assert.equal(after.budget.committed_micro_usd,before.budget.committed_micro_usd);assert.equal(after.operations.length,2);assert.equal(after.operations[0].status,'uncertain');
 const starts=await Promise.allSettled([beginReaderRecovery(pool,claim),beginReaderRecovery(pool,claim)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
});
test('an existing start audit blocks repaired delivery even if requested detail incorrectly says unstarted',async()=>{
 const c=await checkpoint(),claim=await prepareReaderRecovery(pool,owner,c.clientId,c.runId,'hold',c.input);
 await beginReaderRecovery(pool,claim);
 await pool.query("UPDATE a7_budget_audit SET detail=jsonb_set(detail,'{started}','false'::jsonb) WHERE client_run_id=$1 AND event='reader_recovery_requested'",[c.clientId]);
 await assert.rejects(resumePendingReaderRecovery(pool,owner,c.clientId,c.runId,'hold',{...c.input,routeRepair:true}),/recovery_not_available/);
 const {rows}=await pool.query("SELECT event_id FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_route_repaired'",[c.clientId]);assert.equal(rows.length,0);
});
