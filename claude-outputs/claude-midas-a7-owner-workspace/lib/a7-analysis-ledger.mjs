import {createHash} from 'node:crypto';
import {canonical} from './a7-actions.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';

const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const nodes=room=>['03 Eye reads the product photo','05 Second count',...(room?['06 Room reader']:[]),'09 Conflict check'];

// Read one JSON object from a preserved provider answer the same way the A7
// engine's evidence step does: an object as returned, or the text between the
// first "{" and the last "}" (models often wrap JSON in fences or a sentence).
function answerTexts(a){
 const parts=a?.candidates?.flatMap(c=>c.content?.parts||[]).map(p=>p.text)
  ||a?.content?.map(c=>c.text)
  ||a?.output?.flatMap(m=>m.content||[]).map(c=>c.text)
  ||[];
 return parts.filter(v=>typeof v==='string'?v.trim():v&&typeof v==='object');
}
export function answerObject(a){
 const parts=answerTexts(a);
 const objects=parts.filter(v=>typeof v==='object'&&!Array.isArray(v));
 if(objects.length)return objects[0];
 const text=parts.filter(v=>typeof v==='string').join('');
 if(!text||text.length>120000)return null;
 const first=text.indexOf('{'),last=text.lastIndexOf('}');
 if(first<0||last<first)return null;
 try{const v=JSON.parse(text.slice(first,last+1));return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}
}

// A workflow response is only a pointer. Product facts are reconstructed from
// completed, immutable provider-answer checkpoints in the owner's budget row.
export async function verifiedAnalysisAnswers(pool,ownerId,source,reported){
 const identity=sharedRunIdentity(source.draftId),required=nodes(!!source.roomSha256);
 if(reported?.clientRunId!==identity.clientRunId||reported?.runId!==identity.runId||reported?.sourceSha256!==source.sourceSha256||reported?.referenceFingerprint!==source.referenceFingerprint||!Array.isArray(reported.readers)||reported.readers.length!==required.length)throw Error('analysis_receipt_unverified');
 const {rows:[budget]}=await pool.query('SELECT client_run_id,run_id,owner_id,limit_micro_usd FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2',[identity.clientRunId,ownerId]);
 if(!budget||budget.run_id!==identity.runId||Number(budget.limit_micro_usd)!==Math.round(source.budgetLimitUsd*1e6))throw Error('analysis_receipt_unverified');
 const {rows}=await pool.query('SELECT operation_key,client_run_id,run_id,node_name,status,receipt_ref,reader_response,reader_response_sha256 FROM a7_paid_operations WHERE client_run_id=$1 AND run_id=$2 AND node_name = ANY($3)',[identity.clientRunId,identity.runId,required]);
 if(rows.length!==required.length||new Set(rows.map(r=>r.node_name)).size!==required.length)throw Error('analysis_receipt_unverified');
 const answers={};
 for(const name of required){
  const row=rows.find(r=>r.node_name===name),pointer=reported.readers.find(r=>r.node===name);
  if(!pointer||row.status!=='completed'||pointer.status!=='completed'||pointer.operationKey!==row.operation_key||pointer.receiptRef!==row.receipt_ref||!row.receipt_ref||row.reader_response?.schema!=='a7-complete-answer-v1'||row.reader_response.node!==name||digest(row.reader_response)!==row.reader_response_sha256)throw Error('analysis_receipt_unverified');
  const parsed=answerObject(row.reader_response.answer);
  if(!parsed)throw Error('analysis_receipt_unverified');
  answers[name]=parsed;
 }
 return answers;
}
