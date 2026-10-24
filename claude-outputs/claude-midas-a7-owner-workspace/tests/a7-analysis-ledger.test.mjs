import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {canonical} from '../lib/a7-actions.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {verifiedAnalysisAnswers} from '../lib/a7-analysis-ledger.mjs';

test('analysis facts require the owner budget, same run and complete immutable provider checkpoints',async()=>{
 const draftId=randomUUID(),ownerId=randomUUID(),ids=sharedRunIdentity(draftId);
 const source={draftId,sourceSha256:'a'.repeat(64),referenceFingerprint:'b'.repeat(64),budgetLimitUsd:5};
 const names=['03 Eye reads the product photo','05 Second count','09 Conflict check'];
 const rows=names.map((name,i)=>{
  const reader_response={schema:'a7-complete-answer-v1',node:name,answer:{content:[{text:JSON.stringify({value:i})}]}};
  return {operation_key:'analysis-'+i,client_run_id:ids.clientRunId,run_id:ids.runId,node_name:name,status:'completed',receipt_ref:'provider-'+i,reader_response,reader_response_sha256:createHash('sha256').update(canonical(reader_response)).digest('hex')};
 });
 const pool={query:async(sql)=>({rows:sql.includes('FROM a7_owner_budgets')?[{...ids,client_run_id:ids.clientRunId,run_id:ids.runId,owner_id:ownerId,limit_micro_usd:5000000}]:rows})};
 const reported={...ids,sourceSha256:source.sourceSha256,referenceFingerprint:source.referenceFingerprint,readers:rows.map(r=>({node:r.node_name,status:r.status,operationKey:r.operation_key,receiptRef:r.receipt_ref}))};
 assert.equal((await verifiedAnalysisAnswers(pool,ownerId,source,reported))[names[1]].value,1);
 rows[0].reader_response.answer.content[0].text='{"value":99}';
 await assert.rejects(verifiedAnalysisAnswers(pool,ownerId,source,reported),/analysis_receipt_unverified/);
 rows[0].reader_response.answer.content[0].text='{"value":0}';
 rows[1].status='uncertain';
 await assert.rejects(verifiedAnalysisAnswers(pool,ownerId,source,reported),/analysis_receipt_unverified/);
 rows[1].status='completed';
 await assert.rejects(verifiedAnalysisAnswers(pool,ownerId,{...source,budgetLimitUsd:4},reported),/analysis_receipt_unverified/);
});
