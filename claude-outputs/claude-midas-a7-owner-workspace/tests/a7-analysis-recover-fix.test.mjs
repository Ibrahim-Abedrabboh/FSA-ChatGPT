import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {canonical} from '../lib/a7-actions.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {verifiedAnalysisAnswers} from '../lib/a7-analysis-ledger.mjs';

const sha=v=>createHash('sha256').update(canonical(v)).digest('hex');
function ledger(answers){
 const draftId=randomUUID(),ownerId=randomUUID(),ids=sharedRunIdentity(draftId);
 const source={draftId,sourceSha256:'a'.repeat(64),referenceFingerprint:'b'.repeat(64),budgetLimitUsd:4.74};
 const rows=Object.entries(answers).map(([name,answer],i)=>{
  const reader_response={schema:'a7-complete-answer-v1',node:name,answer};
  return {operation_key:'op-'+i,client_run_id:ids.clientRunId,run_id:ids.runId,node_name:name,status:'completed',receipt_ref:'r-'+i,reader_response,reader_response_sha256:sha(reader_response)};
 });
 const pool={query:async sql=>({rows:sql.includes('FROM a7_owner_budgets')?[{client_run_id:ids.clientRunId,run_id:ids.runId,owner_id:ownerId,limit_micro_usd:4740000}]:rows})};
 const reported={...ids,sourceSha256:source.sourceSha256,referenceFingerprint:source.referenceFingerprint,readers:rows.map(r=>({node:r.node_name,status:'completed',operationKey:r.operation_key,receiptRef:r.receipt_ref}))};
 return {pool,ownerId,source,reported};
}

test('recovery reads reader answers the way the A7 engine does: fenced or prefixed JSON objects',async()=>{
 const eye={category:'bedroom set',pieces:[{label:'bed',kind:'bed',role:'product'}]};
 const l=ledger({
  '03 Eye reads the product photo':{candidates:[{content:{role:'model',parts:[{text:'```json\n'+JSON.stringify(eye)+'\n```'}]},finishReason:'STOP'}]},
  '05 Second count':{content:[{type:'text',text:'Here is the count:\n{"pieces":[{"kind":"bed","count":1}],"total":1}'}]},
  '09 Conflict check':{output:[{type:'message',role:'assistant',content:[{type:'output_text',text:{conflicts:[]}}]}]}
 });
 const a=await verifiedAnalysisAnswers(l.pool,l.ownerId,l.source,l.reported);
 assert.equal(a['03 Eye reads the product photo'].category,'bedroom set');
 assert.equal(a['05 Second count'].total,1);
 assert.deepEqual(a['09 Conflict check'].conflicts,[]);
});

test('recovery still rejects answers without one JSON object',async()=>{
 for(const text of ['no json here','[1,2,3]','{not json}']){
  const l=ledger({'03 Eye reads the product photo':{candidates:[{content:{parts:[{text}]}}]},'05 Second count':{content:[{type:'text',text:'{"total":1}'}]},'09 Conflict check':{output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}});
  await assert.rejects(verifiedAnalysisAnswers(l.pool,l.ownerId,l.source,l.reported),/analysis_receipt_unverified/);
 }
});

test('an analysis that is still running reports pending (202), not a gateway error',async()=>{
 const {mapSourceUnderstandingError}=await import('../netlify/functions/owner-source-understanding.mjs');
 assert.deepEqual(mapSourceUnderstandingError('analysis_outcome_uncertain'),{status:202,body:{status:'pending_or_uncertain',error:'analysis_outcome_uncertain',message:'Analysis was sent and may still be running. Do not start another analysis; check this saved version again shortly.'}});
 assert.deepEqual(mapSourceUnderstandingError('analysis_receipt_unverified'),{status:409,body:{error:'analysis_receipt_unverified'}});
 assert.deepEqual(mapSourceUnderstandingError('not_found'),{status:404,body:{error:'not_found'}});
 assert.deepEqual(mapSourceUnderstandingError('invalid_request'),{status:400,body:{error:'invalid_request'}});
 assert.deepEqual(mapSourceUnderstandingError('something_internal'),{status:503,body:{error:'source_understanding_unavailable'}});
});
