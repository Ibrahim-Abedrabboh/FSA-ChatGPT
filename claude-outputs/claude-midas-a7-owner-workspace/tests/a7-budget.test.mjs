import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {randomUUID} from 'node:crypto';
import {openBudget,reserveCall,settleCall,readBudget,quoteCall} from '../lib/a7-budget.mjs';
const local=new NetlifyDB();let pool;
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;});
after(async()=>{if(pool)await pool.end();await local.stop();});
const owner=randomUUID();
function call(clientId,slot='one'){return {clientId,runId:'test-run',operationKey:'test:'+clientId+':'+slot,node:'16 Critic review',model:'claude-sonnet-5-5',outputId:'white_master',requestSha256:'a'.repeat(64),inputTokens:1048576,outputTokens:4000};}
async function budget(limitUsd=5){const clientId='owner-'+randomUUID();await openBudget(pool,{clientId,ownerId:owner,limitUsd});return clientId;}
test('simultaneous reader reservations cannot overcommit the job budget',async()=>{
 const client=await budget();const results=await Promise.all(['a','b','c'].map(slot=>reserveCall(pool,call(client,slot))));assert.equal(results.filter(x=>x.send).length,2);assert.equal(results.filter(x=>x.reason==='budget_limit').length,1);
 const record=await readBudget(pool,owner,client);assert.ok(Number(record.budget.committed_micro_usd)<=5000000);
});
test('duplicate operation gets no permission to send again',async()=>{const client=await budget();const first=await reserveCall(pool,call(client));assert.equal(first.send,true);assert.equal((await reserveCall(pool,call(client))).send,false);await assert.rejects(reserveCall(pool,{...call(client),requestSha256:'b'.repeat(64)}),/operation_conflict/);});
test('complete usage receipt settles once and frees unused reservation',async()=>{
 const client=await budget();const request=call(client);const permit=await reserveCall(pool,request);const receipt={clientId:client,operationKey:request.operationKey,permit:permit.permit,usage:{input:1000,output:500},receiptRef:'provider-test-receipt'};
 assert.equal((await settleCall(pool,receipt)).accountedMicroUsd,7000);await settleCall(pool,receipt);const record=await readBudget(pool,owner,client);assert.equal(Number(record.budget.committed_micro_usd),7000);await assert.rejects(settleCall(pool,{...receipt,usage:{input:1,output:1}}),/settlement_conflict/);
});
test('missing usage remains uncertain and retains the entire reservation',async()=>{const client=await budget();const request=call(client);const permit=await reserveCall(pool,request);await settleCall(pool,{clientId:client,operationKey:request.operationKey,permit:permit.permit,usage:null});const record=await readBudget(pool,owner,client);assert.equal(record.operations[0].status,'uncertain');assert.equal(Number(record.budget.committed_micro_usd),permit.reservedMicroUsd);assert.equal((await reserveCall(pool,request)).send,false);});
test('owner and run boundaries hold',async()=>{const client=await budget();await reserveCall(pool,call(client));await assert.rejects(readBudget(pool,randomUUID(),client),/not_found/);await assert.rejects(reserveCall(pool,{...call(client,'new'),runId:'other-run'}),/budget_run_mismatch/);});
test('unverified models, expired prices and invalid numeric bounds cannot reserve',()=>{
 const request=call('owner-'+randomUUID());for(const patch of [{model:'unknown'},{inputTokens:-1},{inputTokens:1048577},{outputTokens:NaN}])assert.throws(()=>quoteCall({...request,...patch}));assert.throws(()=>quoteCall(request,new Date('2027-01-01')),/price_verification_required/);
});
test('uncertain charges can be explicitly reconciled once without resending',async()=>{
 const {reconcileCall}=await import('../lib/a7-budget.mjs');const client=await budget(),request=call(client),permit=await reserveCall(pool,request);await settleCall(pool,{clientId:client,operationKey:request.operationKey,permit:permit.permit,usage:null});
 const report={requestId:randomUUID(),operationKey:request.operationKey,confirmed:true,note:'Checked provider billing',evidence:'Synthetic receipt for local testing',chargedUsd:.02};
 await assert.rejects(reconcileCall(pool,randomUUID(),client,report),/not_found/);await reconcileCall(pool,owner,client,report);await reconcileCall(pool,owner,client,report);await assert.rejects(reconcileCall(pool,owner,client,{...report,chargedUsd:.03}),/reconciliation_conflict/);assert.equal(Number((await readBudget(pool,owner,client)).budget.committed_micro_usd),20000);assert.equal((await reserveCall(pool,request)).send,false);
});
test('diagnostic exercises actual SQL but rolls back every synthetic budget and charge',async()=>{
 const {probeBudget}=await import('../lib/a7-budget-probe.mjs');
 const before=await pool.query('SELECT count(*) AS count FROM a7_owner_budgets');
 const result=await probeBudget(pool);assert.equal(result.verified,true);assert.equal(result.paidCalls,0);assert.equal(result.rolledBack,true);assert.equal(result.checks.length,8);
 const after=await pool.query('SELECT count(*) AS count FROM a7_owner_budgets');assert.equal(after.rows[0].count,before.rows[0].count);
});

test('a zero-only usage receipt retains its reservation as uncertain',async()=>{const client=await budget(),request=call(client),permit=await reserveCall(pool,request);const result=await settleCall(pool,{clientId:client,operationKey:request.operationKey,permit:permit.permit,usage:{input:0,output:0}});assert.equal(result.status,'uncertain');assert.equal(Number((await readBudget(pool,owner,client)).budget.committed_micro_usd),permit.reservedMicroUsd);});

test('reader response is committed with usage, survives reread, and is private to the permit',async()=>{
 const {readReaderResponse}=await import('../lib/a7-budget.mjs');
 const client=await budget(),request={...call(client),node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',inputTokens:1050000,outputTokens:16000};
 // Exact provider-counted request keeps the synthetic reservation below USD 5.
 Object.assign(request,{inputBasis:'provider_counted_exact_request',countedRequestSha256:request.requestSha256,inputTokens:1000});
 const permit=await reserveCall(pool,request),usage={input:676,output:986};
 const response={id:'resp_synthetic_checkpoint',status:'completed',model:'gpt-6.1-sol',output:[{type:'message',content:[{type:'output_text',text:'{"pieces":[{"kind":"seat"},{"kind":"seat"}]}'}]}],usage:{input_tokens:676,output_tokens:986},request_photo:'MUST_NOT_RETAIN',headers:{authorization:'MUST_NOT_RETAIN'}};
 const receipt={clientId:client,operationKey:request.operationKey,permit:permit.permit,usage,receiptRef:response.id,readerResponse:response};
 assert.equal((await settleCall(pool,receipt)).responsePreserved,true);
 const saved=await readReaderResponse(pool,receipt);assert.equal(saved.preserved,true);assert.equal(saved.resend,false);assert.equal(saved.response.output[0].content[0].text,response.output[0].content[0].text);assert.equal(saved.response.headers,undefined);assert.equal(saved.response.request_photo,undefined);
 assert.equal((await settleCall(pool,receipt)).responsePreserved,true);
 await assert.rejects(readReaderResponse(pool,{...receipt,permit:randomUUID()}),/operation_mismatch/);
 await assert.rejects(readReaderResponse(pool,{...receipt,clientId:'owner-'+randomUUID()}),/operation_mismatch/);
 await assert.rejects(settleCall(pool,{...receipt,readerResponse:{...response,output:[{type:'message',content:[{type:'output_text',text:'changed answer'}]}]}}),/reader_response_conflict/);
 assert.equal((await reserveCall(pool,request)).send,false);
 const ledger=await readBudget(pool,owner,client);assert.equal(ledger.operations[0].reader_response,undefined);assert.equal(Number(ledger.budget.committed_micro_usd),17494);
});
test('invalid or failed response persistence cannot settle the reservation',async()=>{
 const client=await budget(),request={...call(client),node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',outputTokens:16000,inputTokens:1000,inputBasis:'provider_counted_exact_request',countedRequestSha256:'a'.repeat(64)};
 const permit=await reserveCall(pool,request),response={id:'resp_synthetic_failure',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'synthetic answer'}]}],usage:{input_tokens:676,output_tokens:986}};
 const receipt={clientId:client,operationKey:request.operationKey,permit:permit.permit,usage:{input:676,output:986},receiptRef:response.id,readerResponse:response};
 for(const readerResponse of [{...response,id:'other'}, {...response,status:'incomplete'}, {...response,usage:{input_tokens:1,output_tokens:986}}, {...response,output:[]}, {...response,output:[{type:'message',content:[{type:'output_text',text:'x'.repeat(140000)}]}]}])await assert.rejects(settleCall(pool,{...receipt,readerResponse}));
 // Exercise a storage failure after the actual operation SELECT and before commit.
 const failingPool={connect:async()=>{const db=await pool.connect();return {release:()=>db.release(),query:(sql,args)=>{if(sql.startsWith('UPDATE a7_paid_operations'))throw Error('synthetic_storage_failure');return db.query(sql,args);}};}};
 await assert.rejects(settleCall(failingPool,receipt),/synthetic_storage_failure/);
 const ledger=await readBudget(pool,owner,client);assert.equal(ledger.operations[0].status,'reserved');assert.equal(Number(ledger.budget.committed_micro_usd),permit.reservedMicroUsd);assert.equal((await reserveCall(pool,request)).send,false);
});
test('the owner can raise an opened job ceiling up to USD 10, audited, but never lower it',async()=>{
 const client=await budget(4.74);
 await openBudget(pool,{clientId:client,ownerId:owner,limitUsd:4.74});
 const raised=await openBudget(pool,{clientId:client,ownerId:owner,limitUsd:10});
 assert.equal(Number(raised.limit_micro_usd),10000000);
 const {rows}=await pool.query("SELECT event,detail FROM a7_budget_audit WHERE client_run_id=$1 AND event='owner_raised_limit'",[client]);
 assert.equal(rows.length,1);assert.equal(rows[0].detail.from_micro_usd,4740000);assert.equal(rows[0].detail.to_micro_usd,10000000);
 await assert.rejects(openBudget(pool,{clientId:client,ownerId:owner,limitUsd:6}),/budget_lowered/);
 await assert.rejects(openBudget(pool,{clientId:client,ownerId:randomUUID(),limitUsd:10}),/budget_conflict/);
 await assert.rejects(openBudget(pool,{clientId:client,ownerId:owner,limitUsd:10.01}),/invalid_usd/);
 const fresh=await budget(10);assert.equal(Number((await readBudget(pool,owner,fresh)).budget.limit_micro_usd),10000000);
});
