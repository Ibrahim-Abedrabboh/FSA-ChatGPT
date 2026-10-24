import {test,before,after,beforeEach} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {NetlifyDB} from '@netlify/database-dev';import {getDatabase} from '@netlify/database';
import {REPLACEMENT as P,replacementKey,replacementEligible,replacementState,prepareReplacement,beginReplacement,readPreservedReplacement,preparePreservedContinuation,beginPreservedContinuation} from '../lib/a7-reader-replacement.mjs';
import {openBudget,readBudget,transaction,reserveCall,settleCall,readReaderResponse} from '../lib/a7-budget.mjs';
const local=new NetlifyDB(),owner=randomUUID(),brief=JSON.parse(await readFile(new URL('./fixtures/approved-reader-replacement-brief.json',import.meta.url)));let pool;
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;pool.options.max=1;});after(async()=>{await pool?.end();await local.stop();});
beforeEach(async()=>{await pool.query('TRUNCATE a7_budget_audit,a7_paid_operations,a7_owner_budgets CASCADE');await openBudget(pool,{clientId:P.clientId,ownerId:owner,limitUsd:4.739996});await pool.query('UPDATE a7_owner_budgets SET run_id=$2,committed_micro_usd=$3 WHERE client_run_id=$1',[P.clientId,P.runId,P.committedMicro]);
 for(const [key,node,model,cost,status,ref] of [['primary','03 Eye reads the product photo','gemini-3.8-flash',846432,'uncertain',''],['counter','05 Second count','claude-sonnet-5-5',3564,'completed','msg_test'],['oldfallback','03b Eye fallback (OpenAI)','gpt-6.1-sol',17494,'completed',P.oldResponseId]])await pool.query('INSERT INTO a7_paid_operations(operation_key,client_run_id,run_id,node_name,model,output_id,request_sha256,permit,pricing,reserved_micro_usd,accounted_micro_usd,status,receipt_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12)',[key,P.clientId,P.runId,node,model,'job','a'.repeat(64),randomUUID(),'{}',cost,status,ref]);
 await pool.query("INSERT INTO a7_budget_audit(event_id,client_run_id,event,actor,detail) VALUES($1,$2,'reader_recovery_started','synthetic-test',$3)",[randomUUID(),P.clientId,JSON.stringify({started:true})]);});
const input=()=>({requestId:randomUUID(),revision:'b'.repeat(64),replacementId:P.id,confirmed:true,sourceSha256:P.sourceSha256,additionalBudgetUsd:3.872506,readerBudgetUsd:.25});
const ledger=()=>readBudget(pool,owner,P.clientId);
const prepare=async(i=input())=>{const l=await ledger();return transaction(pool,db=>prepareReplacement(db,owner,l,'hold',i));};
const begin=async(claim)=>transaction(pool,db=>beginReplacement(db,{...claim,checkpoint:{brief,cached_second:{total:2}}}));
const request=(patch={})=>({clientId:P.clientId,runId:P.runId,operationKey:replacementKey,node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',outputId:'job',requestSha256:'a'.repeat(64),outputTokens:16000,inputTokens:1126,inputBasis:'provider_counted_exact_request',countedRequestSha256:'a'.repeat(64),replacementId:P.id,...patch});
test('one concurrent prepare and start; immutable old receipts and budget preserved',async()=>{
 const before=await ledger(),i=input();assert.equal(replacementEligible(before,'hold'),true);
 const results=await Promise.allSettled([prepare(i),prepare(i)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const claim=results.find(x=>x.status==='fulfilled').value;
 const starts=await Promise.allSettled([begin(claim),begin(claim)]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual(await ledger(),before);
 const s=await replacementState(pool,before,'hold');assert.equal(s.eligible,false);assert.equal(s.requested,true);assert.equal(s.started,true);
});
test('wrong source, budget, approval or owner cannot prepare',async()=>{
 for(const patch of [{sourceSha256:'f'.repeat(64)},{readerBudgetUsd:.26},{additionalBudgetUsd:5},{confirmed:false},{replacementId:'other'}])await assert.rejects(prepare({...input(),...patch}));
 const l=await ledger();await assert.rejects(transaction(pool,db=>prepareReplacement(db,randomUUID(),l,'hold',input())));
 assert.equal((await replacementState(pool,await ledger(),'hold')).eligible,true);
});
test('changed brief, count or claim cannot start; original claim remains unused',async()=>{
 const claim=await prepare();for(const patch of [{checkpoint:{brief:{...brief,inventory_total:3},cached_second:{total:2}}},{checkpoint:{brief,cached_second:{total:3}}},{requestId:randomUUID()},{sourceSha256:'f'.repeat(64)}])await assert.rejects(transaction(pool,db=>beginReplacement(db,{...claim,checkpoint:{brief,cached_second:{total:2}},...patch})));
 assert.equal((await begin(claim)).allowed,true);
});
test('recovered old response blocks replacement and preserves old accounting',async()=>{
 await pool.query("UPDATE a7_paid_operations SET reader_response=$1 WHERE operation_key='oldfallback'",[JSON.stringify({id:P.oldResponseId,output:[]})]);assert.equal((await replacementState(pool,await ledger(),'hold')).eligible,false);await assert.rejects(prepare());
});
test('reader reservation requires claim, enforces 25 cents and sends once',async()=>{
 await assert.rejects(reserveCall(pool,request()),/replacement_not_authorized/);const claim=await prepare();await begin(claim);
 await assert.rejects(reserveCall(pool,request({inputTokens:2501})),/replacement_reader_limit/);
 await assert.rejects(reserveCall(pool,request({operationKey:'another'})),/replacement_reader_limit/);
 const calls=await Promise.all([reserveCall(pool,request()),reserveCall(pool,request())]);assert.equal(calls.filter(x=>x.send).length,1);assert.equal(calls.find(x=>x.send).reservedMicroUsd,244504);
 await assert.rejects(reserveCall(pool,request({operationKey:'another'})),/replacement_duplicate_denied/);
});
test('forbidden primary, counter, planning, repair/output changes and duplicate reviews are blocked',async()=>{
 await begin(await prepare());
 for(const r of [request({operationKey:'primary-new',node:'03 Eye reads the product photo',model:'gemini-3.8-flash',inputTokens:1048576}),request({operationKey:'counter-new',node:'05 Second count',model:'claude-sonnet-5-5',inputTokens:1048576,outputTokens:1500}),request({operationKey:'scene-plan',node:'11 Stylist plans the scenes',inputTokens:1050000,outputTokens:8000}),request({operationKey:'review-room',node:'16 Critic review',model:'claude-sonnet-5-5',inputTokens:1048576,outputTokens:4000,outputId:'scene_1'})])await assert.rejects(reserveCall(pool,r));
 const review=request({operationKey:'review-white',node:'16 Critic review',model:'claude-sonnet-5-5',inputTokens:1048576,outputTokens:4000,outputId:'white_master'});assert.equal((await reserveCall(pool,review)).send,true);await assert.rejects(reserveCall(pool,{...review,operationKey:'review-again'}),/replacement_duplicate_denied/);
});
test('lost settlement acknowledgement reads the durable response without new send or reservation release',async()=>{
 await begin(await prepare());const permit=await reserveCall(pool,request()),response={id:'resp_new_synthetic_replacement',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'synthetic; not real product evidence'}]}],usage:{input_tokens:676,output_tokens:986}};
 const settlement={clientId:P.clientId,operationKey:replacementKey,permit:permit.permit,usage:{input:676,output:986},receiptRef:response.id,readerResponse:response};
 await settleCall(pool,settlement);assert.equal((await settleCall(pool,settlement)).responsePreserved,true);assert.equal((await readReaderResponse(pool,settlement)).preserved,true);const saved=await readPreservedReplacement(pool,{replacementId:P.id,clientId:P.clientId,runId:P.runId});assert.equal(saved.readerResponse.id,response.id);assert.equal(saved.checkpoint.cached_second.total,2);assert.equal(saved.permit,undefined);await assert.rejects(readPreservedReplacement(pool,{replacementId:P.id,clientId:'other',runId:P.runId}));assert.equal((await reserveCall(pool,request())).send,false);
 const after=await ledger();assert.equal(Number(after.budget.committed_micro_usd),P.committedMicro+17494);assert.equal(after.operations.find(o=>o.node_name==='03 Eye reads the product photo').status,'uncertain');
 const ci={...input(),resumePreserved:true};const attempts=await Promise.allSettled([transaction(pool,db=>preparePreservedContinuation(db,owner,after,'hold',ci)),transaction(pool,db=>preparePreservedContinuation(db,owner,after,'hold',ci))]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);const continueRequest=attempts.find(x=>x.status==='fulfilled').value;const starts=await Promise.allSettled([transaction(pool,db=>beginPreservedContinuation(db,{...continueRequest,checkpoint:saved.checkpoint})),transaction(pool,db=>beginPreservedContinuation(db,{...continueRequest,checkpoint:saved.checkpoint}))]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);assert.equal(starts.find(x=>x.status==='fulfilled').value.readerResponse.id,response.id);assert.deepEqual(await ledger(),after);assert.equal((await reserveCall(pool,request())).send,false);
});
test('insufficient shared budget blocks later operations and cannot open a new allowance',async()=>{
 await begin(await prepare());await pool.query('UPDATE a7_owner_budgets SET limit_micro_usd=900000 WHERE client_run_id=$1',[P.clientId]);assert.equal((await reserveCall(pool,request())).reason,'budget_limit');
 await pool.query('UPDATE a7_owner_budgets SET limit_micro_usd=5000000 WHERE client_run_id=$1',[P.clientId]);await assert.rejects(reserveCall(pool,request()),/replacement_scope_mismatch/);
});
