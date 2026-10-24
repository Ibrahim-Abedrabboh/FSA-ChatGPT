import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonical} from '../lib/a7-actions.mjs';
import {normalizeAnswer} from '../lib/a7-answer-checkpoints.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {verifiedAnalysisAnswers} from '../lib/a7-analysis-ledger.mjs';
import {observationFromVerifiedAnswers} from '../lib/a7-analysis-observation.mjs';
import {analysisIntent,analysisReceipt} from '../lib/a7-source-understanding.mjs';

const sha=value=>createHash('sha256').update(canonical(value)).digest('hex');
const photo={category:'Sofa',pieces:[{label:'left unit',kind:'seat module',role:'product'},{label:'right unit',kind:'seat module',role:'product'},{label:'plant',kind:'plant',role:'context'}],views_not_pieces:['side inset'],colour_observed:'cream',unknowns:['hidden rear','dimensions']};
const second={pieces:[{kind:'seat module',count:2}],total:2,excluded:[],unclear:[],cropped:false};
const room={room_type:'Living room',walls:'white',floor:'oak',windows:'one',doors:'one',built_ins:'none seen',fixed_objects:[],free_floor_zone:'center',unknowns:['exact dimensions']};
const conflict={conflicts:[],instruction_locks:[],summary:'No unresolved conflict'};

function provider(node,answer,index){
 if(node==='03 Eye reads the product photo'||node==='06 Room reader'){
  const raw={response:{candidates:[{content:{parts:[{text:JSON.stringify(answer)}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100+index,candidatesTokenCount:50}}};
  return {raw,usage:{input:100+index,output:50},receiptRef:'answer-'+index};
 }
 if(node==='05 Second count')return {raw:{content:[{type:'text',text:JSON.stringify(answer)}],usage:{input_tokens:200,output_tokens:60}},usage:{input:200,output:60},receiptRef:'answer-'+index};
 return {raw:{id:'resp-'+index,status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(answer)}]}],usage:{input_tokens:300,output_tokens:70}},usage:{input:300,output:70},receiptRef:'resp-'+index};
}

for(const withRoom of [false,true])test(`mocked analysis ${withRoom?'with typed room':'product only'} derives facts from immutable provider checkpoints`,async()=>{
 const forbidden=globalThis.fetch;globalThis.fetch=()=>{throw Error('network_forbidden_in_synthetic_harness');};
 try{
  const draftId=randomUUID(),owner=randomUUID(),ids=sharedRunIdentity(draftId),sourceSha256='a'.repeat(64),roomSha256=withRoom?'b'.repeat(64):null;
  const source={draftId,...ids,sourceSha256,roomSha256,referenceFingerprint:'c'.repeat(64),budgetLimitUsd:5};
  const quote=quoteSourceAnalysis(source),intent=analysisIntent({requestId:randomUUID(),draftId,sourceSha256,...(roomSha256?{roomSha256}:{}),maxCostUsd:quote.maxCostUsd,confirmed:true});
  const names=['03 Eye reads the product photo','05 Second count',...(withRoom?['06 Room reader']:[]),'09 Conflict check'];
  const data=[photo,second,...(withRoom?[room]:[]),conflict];
  const rows=names.map((node,i)=>{
   const output=provider(node,data[i],i),normalized=normalizeAnswer(output.raw,{node_name:node,model:quote.calls.find(c=>c.node===node).model,operation_key:'analysis-'+i},output.usage,output.receiptRef);
   return {operation_key:'analysis-'+i,client_run_id:ids.clientRunId,run_id:ids.runId,node_name:node,status:'completed',receipt_ref:output.receiptRef,reader_response:normalized.checkpoint,reader_response_sha256:normalized.sha256};
  });
  const pool={query:async sql=>({rows:sql.includes('FROM a7_owner_budgets')?[{owner_id:owner,client_run_id:ids.clientRunId,run_id:ids.runId,limit_micro_usd:5000000}]:rows})};
  const reported={receiptId:randomUUID(),...ids,draftId,sourceSha256,roomSha256,referenceFingerprint:source.referenceFingerprint,intentFingerprint:intent.fingerprint,readers:rows.map(r=>({node:r.node_name,status:r.status,operationKey:r.operation_key,receiptRef:r.receipt_ref}))};
  const answers=await verifiedAnalysisAnswers(pool,owner,source,reported),observed=observationFromVerifiedAnswers(source,answers);
  const receipt=analysisReceipt(intent,{...reported,...observed});
  assert.equal(receipt.observation.eyeCount,2);
  assert.equal(receipt.observation.secondCount,2);
  assert.equal(receipt.observation.pieces.filter(p=>p.role==='product').length,2);
  assert.equal(receipt.observation.visibleSeatCount,null);
  assert.equal(receipt.roomObservation?.sourceSha256||null,roomSha256);
  assert.ok(quote.totalMicroUsd<5000000);
  rows[0].reader_response.answer.candidates[0].content.parts[0].text='{"category":"forged"}';
  await assert.rejects(verifiedAnalysisAnswers(pool,owner,source,reported),/analysis_receipt_unverified/);
  rows[0].reader_response.answer.candidates[0].content.parts[0].text=JSON.stringify(photo);
  rows[1].status='uncertain';
  await assert.rejects(verifiedAnalysisAnswers(pool,owner,source,reported),/analysis_receipt_unverified/);
 }finally{globalThis.fetch=forbidden;}
});

test('pinned workflow uses product binary for 03/05 and room binary only for 06',async()=>{
 const text=await readFile(new URL('../a7-analysis-only-workflow.ts',import.meta.url),'utf8');
 for(const [stage,key] of [['03','product_key'],['05','product_key'],['06','room_key']]){
  const line=text.split('\n').find(x=>x.startsWith(`const n${stage}_`));
  assert.ok(line);
  assert.match(line,new RegExp(key));
 }
 assert.doesNotMatch(text,/15g Send to Google|11 Stylist plans the scenes/);
});
