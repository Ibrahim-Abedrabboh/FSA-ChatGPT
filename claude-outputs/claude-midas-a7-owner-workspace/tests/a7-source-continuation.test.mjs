import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {canonical} from '../lib/a7-actions.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {sourceUnderstandingService} from '../lib/a7-understanding-service.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {claimSourceContinuation} from '../lib/a7-source-continuation.mjs';

test('main continuation verifies current owner receipt once, while a duplicate stays held',async()=>{
 const owner=randomUUID(),draftId=randomUUID(),ids=sharedRunIdentity(draftId),sourceSha256='a'.repeat(64),referenceId=randomUUID(),values=new Map(),audit=new Set();
 const brief={routeIntent:'single',routeChoice:'hero',budgetUsd:5,product:'Sofa',inventory:'1 sofa'};
 const refs=[{reference_id:referenceId,role:'product',sha256:sourceSha256,blob_key:'synthetic',mime:'image/png',bytes:200}];
 const names=['03 Eye reads the product photo','05 Second count','09 Conflict check'];
 const readers=names.map((name,i)=>({node:name,status:'completed',operationKey:'reader-'+i,receiptRef:'answer-'+i}));
 const provider=[{category:'Sofa',pieces:[{label:'sofa',kind:'sofa',role:'product'}]},{total:1},{conflicts:[]}];
 const operations=names.map((name,i)=>{const reader_response={schema:'a7-complete-answer-v1',node:name,answer:{content:[{text:JSON.stringify(provider[i])}]}};return {operation_key:readers[i].operationKey,client_run_id:ids.clientRunId,run_id:ids.runId,node_name:name,status:'completed',receipt_ref:readers[i].receiptRef,reader_response,reader_response_sha256:createHash('sha256').update(canonical(reader_response)).digest('hex')};});
 const draft={owner_id:owner,brief,note:'Use original',parent_id:null,dispatch_state:'confirmed',client_run_id:ids.clientRunId};
 let rowRun=ids.runId;
 const pool={connect:async()=>({query:query,release:()=>{}}),query};
 async function query(sql,args=[]){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.includes('FROM a7_job_versions WHERE id=$1 AND owner_id=$2'))return {rows:args[1]===owner?[{id:draftId}]:[]};
  if(sql.includes('FROM a7_job_versions WHERE id=$1'))return {rows:[draft]};
  if(sql.includes('FROM a7_version_references'))return {rows:refs};
  if(sql.includes('FROM a7_owner_budgets')&&sql.includes('FOR UPDATE'))return {rows:[{client_run_id:ids.clientRunId,run_id:rowRun,owner_id:owner,limit_micro_usd:5000000}]};
  if(sql.includes('FROM a7_owner_budgets'))return {rows:[{client_run_id:ids.clientRunId,run_id:ids.runId,owner_id:owner,limit_micro_usd:5000000}]};
  if(sql.includes('FROM a7_paid_operations'))return {rows:operations};
  if(sql.includes('INSERT INTO a7_budget_audit')){if(audit.has(args[0]))return {rows:[]};audit.add(args[0]);return {rows:[{event_id:args[0]}]};}
  throw Error('unexpected_sql');
 }
 const store={get:async key=>values.get(key)||null,set:async(key,value)=>{values.set(key,value);return true}};
 const service=sourceUnderstandingService({references:async()=>refs,draftRecord:async()=>draft,store,reader:{quote:async({source})=>quoteSourceAnalysis(source),run:async({source,intent})=>({receiptId:randomUUID(),draftId,sourceSha256,roomSha256:null,intentFingerprint:intent.fingerprint,readers,observation:{category:'Sofa',eyeCount:1,secondCount:1,pieces:[{label:'sofa',kind:'sofa',role:'product'}]}})}});
 const q=await service.quote(owner,draftId),observed=await service.analyze(owner,draftId,{requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true});
 const confirmed=await service.confirm(owner,draftId,{confirmed:true,receiptFingerprint:observed.receipt.fingerprint});
 const input={draftId,requestId:randomUUID(),...ids,sourceSha256,receiptFingerprint:confirmed.receipt.fingerprint,confirmationFingerprint:confirmed.confirmation.fingerprint};
 // A budget row already bound to another run is never taken over.
 rowRun='claude-a7-'+randomUUID();
 await assert.rejects(claimSourceContinuation(pool,store,input),/budget_run_mismatch/);
 rowRun=ids.runId;
 const proof=await claimSourceContinuation(pool,store,input);
 assert.equal(proof.verified,true);assert.equal(proof.runId,ids.runId);assert.equal(proof.answers[names[1]].total,1);
 await assert.rejects(claimSourceContinuation(pool,store,{...input,requestId:randomUUID()}),/source_continuation_used/);
 operations[0].status='uncertain';
 await assert.rejects(claimSourceContinuation(pool,store,input),/analysis_receipt_unverified/);
});
