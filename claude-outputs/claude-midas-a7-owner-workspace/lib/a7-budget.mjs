import {enforceReplacementReservation} from './a7-reader-replacement.mjs';
import {BLIND,blindKey,authorizeBlindReservation} from './a7-blind-recovery.mjs';
import {normalizeAnswer,persistAnswerMedia} from './a7-answer-checkpoints.mjs';
import {readerResponseCheckpoint} from './a7-reader-response.mjs';
import {canonical} from './a7-actions.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {MAX_JOB_BUDGET_USD} from './a7-limits.mjs';
export const PRICING_VERSION='a7-standard-2026-10-17';
// Prices checked against provider model/pricing pages on 17 Oct 2026.
// OpenAI reservations use the higher long-context standard rate; no cached-input discount is assumed.
export const RATES=Object.freeze({
 'gemini-3.8-flash':{input:.75,output:3.75,inputLimit:1048576,outputLimit:65536,source:'https://ai.google.dev/gemini-api/docs/pricing',expires:'2027-01-01'},
 'claude-sonnet-5-5':{input:2,output:10,inputLimit:1048576,outputLimit:128000,source:'https://platform.claude.com/docs/en/models/sonnet-5-5/overview',expires:'2027-01-01'},
 'gpt-6.1-sol':{input:4,output:15,inputLimit:1050000,outputLimit:128000,source:'https://developers.openai.com/api/docs/pricing',expires:'2027-01-01'},
 'gpt-6-luna':{input:.2,output:.75,inputLimit:1050000,outputLimit:128000,source:'https://developers.openai.com/api/docs/pricing',expires:'2027-01-01'},
 'gemini-nano-banana-2.1':{input:1.5,output:30,inputLimit:131072,outputLimit:32768,source:'https://ai.google.dev/gemini-api/docs/pricing',expires:'2027-01-01'}
});
export const CALL_POLICY=Object.freeze({
 '03 Eye reads the product photo':['gemini-3.8-flash',16000],
 '05 Second count':['claude-sonnet-5-5',1500],
 '06 Room reader':['gemini-3.8-flash',8000],
 '09 Conflict check':['gpt-6-luna',2000],
 '11 Stylist plans the scenes':['gpt-6.1-sol',8000],
 '11c Plan critic':['claude-sonnet-5-5',8000],
 '16 Critic review':['claude-sonnet-5-5',4000],
 '16x Blind count':['gemini-3.8-flash',8000],
 '03b Eye fallback (OpenAI)':['gpt-6.1-sol',16000],
 '06b Room fallback (OpenAI)':['gpt-6.1-sol',8000],
 '16xb Blind count fallback (OpenAI)':['gpt-6.1-sol',8000],
 '15g Send to Google':['gemini-nano-banana-2.1',32768]
});
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const clientId=v=>typeof v==='string'&&/^owner-[a-f0-9-]{36}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(v);
export const usdToMicro=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>MAX_JOB_BUDGET_USD||Math.abs(v*1000000-Math.round(v*1000000))>1e-6)throw Error('invalid_usd');return Math.round(v*1000000);};
export function quoteCall(input,now=new Date()){
 if(!input||!clientId(input.clientId)||!id(input.runId)||!id(input.operationKey)||typeof input.node!=='string'||input.node.length>100||!id(input.outputId)||!(/^[a-f0-9]{64}$/.test(input.requestSha256||'')))throw Error('invalid_operation');
 const rate=RATES[input.model];if(!rate||now>=new Date(rate.expires))throw Error('price_verification_required');
 if(!integer(input.inputTokens,0,rate.inputLimit)||!integer(input.outputTokens,1,rate.outputLimit))throw Error('invalid_token_bounds');
 const counted=input.node==='03b Eye fallback (OpenAI)'&&input.inputBasis==='provider_counted_exact_request'&&/^[a-f0-9]{64}$/.test(input.countedRequestSha256||'')&&input.countedRequestSha256===input.requestSha256&&input.inputTokens>0;
 const blind=input.blindRecoveryId===BLIND.id&&input.node==='16xb Blind count fallback (OpenAI)'&&input.model==='gpt-6.1-sol'&&input.outputTokens===BLIND.outputCap&&input.inputBasis==='provider_counted_exact_request'&&input.countedRequestSha256===input.requestSha256&&input.inputTokens>0&&input.inputTokens<=BLIND.inputCap;
 const policy=CALL_POLICY[input.node];if(!blind&&(!policy||policy[0]!==input.model||policy[1]!==input.outputTokens||(!counted&&input.inputTokens!==rate.inputLimit)))throw Error('call_policy_mismatch');
 // USD/million tokens times token count gives micro-USD directly.
 const reserve=Math.ceil(input.inputTokens*rate.input+input.outputTokens*rate.output);
 if(reserve<1||reserve>5000000)throw Error('reservation_exceeds_preview_limit');
 return {reserve,rate:{...rate,inputLimit:input.inputTokens,outputLimit:input.outputTokens},fingerprint:hash([input.clientId,input.runId,input.node,input.model,input.outputId,input.requestSha256,input.inputTokens,input.outputTokens,PRICING_VERSION])};
}
export async function transaction(pool,fn){
 const client=await pool.connect();try{await client.query('BEGIN');const out=await fn(client);await client.query('COMMIT');return out;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function audit(db,clientId,operation,event,actor,detail){await db.query('INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),clientId,operation,event,actor,JSON.stringify(detail)]);}
export async function openBudget(pool,{clientId:client,ownerId,limitUsd}){
 if(!clientId(client)||typeof ownerId!=='string')throw Error('invalid_budget');const amount=usdToMicro(limitUsd);if(amount<250000)throw Error('invalid_budget');
 return transaction(pool,async db=>{
  await db.query('INSERT INTO a7_owner_budgets(client_run_id,owner_id,limit_micro_usd,pricing_version) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[client,ownerId,amount,PRICING_VERSION]);
  const {rows:[row]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[client]);
  if(row.owner_id!==ownerId||row.pricing_version!==PRICING_VERSION)throw Error('budget_conflict');
  const limit=Number(row.limit_micro_usd);if(amount===limit)return row;
  // The owner may raise a job's ceiling (from the saved preferences) after analysis has opened it;
  // the raise is audited. A lower ceiling is refused: reservations may already rely on the old one.
  if(amount<limit)throw Error('budget_lowered');
  const {rows:[raised]}=await db.query('UPDATE a7_owner_budgets SET limit_micro_usd=$2 WHERE client_run_id=$1 RETURNING *',[client,amount]);
  await audit(db,client,null,'owner_raised_limit',ownerId,{from_micro_usd:limit,to_micro_usd:amount});
  return raised;
 });
}
export async function reserveCall(pool,input){
 const q=quoteCall(input);
 return transaction(pool,async db=>{
  const {rows:[budget]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[input.clientId]);
  if(!budget)throw Error('budget_missing');if(budget.run_id&&budget.run_id!==input.runId)throw Error('budget_run_mismatch');if(budget.pricing_version!==PRICING_VERSION)throw Error('price_verification_required');
  const {rows:[old]}=await db.query('SELECT * FROM a7_paid_operations WHERE operation_key=$1',[input.operationKey]);
  if(old){if(old.client_run_id!==input.clientId||old.request_sha256!==q.fingerprint)throw Error('operation_conflict');return {send:false,reason:'operation_already_exists',status:old.status};}
  if(input.blindRecoveryId)await authorizeBlindReservation(db,input,q);else await enforceReplacementReservation(db,input,q);
  if(Number(budget.committed_micro_usd)+q.reserve>Number(budget.limit_micro_usd))return {send:false,reason:'budget_limit',availableMicroUsd:Math.max(0,Number(budget.limit_micro_usd)-Number(budget.committed_micro_usd))};
  // Keep the balance condition in the write itself, in addition to the transaction's row lock.
  const {rows:updated}=await db.query('UPDATE a7_owner_budgets SET run_id=$2,committed_micro_usd=committed_micro_usd+$3,updated_at=now() WHERE client_run_id=$1 AND committed_micro_usd+$3<=limit_micro_usd AND (run_id IS NULL OR run_id=$2) RETURNING committed_micro_usd',[input.clientId,input.runId,q.reserve]);
  if(!updated.length)return {send:false,reason:'budget_limit'};
  const permit=randomUUID();
  await db.query('INSERT INTO a7_paid_operations(operation_key,client_run_id,run_id,node_name,model,output_id,request_sha256,permit,reserved_micro_usd,accounted_micro_usd,status,pricing) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11)',[input.operationKey,input.clientId,input.runId,input.node,input.model,input.outputId,q.fingerprint,permit,q.reserve,'reserved',JSON.stringify(q.rate)]);
  await audit(db,input.clientId,input.operationKey,'reserved','engine',{reservedMicroUsd:q.reserve,model:input.model,pricingVersion:PRICING_VERSION});
  return {send:true,permit,reservedMicroUsd:q.reserve,pricingVersion:PRICING_VERSION};
 });
}
export async function settleCall(pool,input,answerStore){
 if(!input||!clientId(input.clientId)||!id(input.operationKey)||typeof input.permit!=='string')throw Error('invalid_settlement');
 return transaction(pool,async db=>{
  await db.query('SELECT client_run_id FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[input.clientId]);
  const {rows:[op]}=await db.query('SELECT * FROM a7_paid_operations WHERE operation_key=$1 AND client_run_id=$2 FOR UPDATE',[input.operationKey,input.clientId]);
  if(!op||op.permit!==input.permit)throw Error('operation_mismatch');
  if(input.completeAnswer!==undefined&&input.readerResponse!==undefined)throw Error('invalid_answer_checkpoint');
  if(input.checkpointRequired===true&&input.completeAnswer===undefined)throw Error('invalid_answer_checkpoint');
  const full=input.completeAnswer===undefined?null:normalizeAnswer(input.completeAnswer,op,input.usage,input.receiptRef);
  const checkpoint=full?{response:full.checkpoint,sha256:full.sha256}:input.readerResponse===undefined?null:readerResponseCheckpoint(input.readerResponse,input.receiptRef,input.usage);
  if(checkpoint&&!full&&op.node_name!=='03b Eye fallback (OpenAI)'&&!(op.node_name==='16xb Blind count fallback (OpenAI)'&&op.operation_key===blindKey))throw Error('invalid_reader_response');
  const fingerprint=hash([input.usage??null,input.receiptRef||'']);
  if(op.settle_sha256){if(op.settle_sha256!==fingerprint)throw Error('settlement_conflict');if(checkpoint&&op.reader_response_sha256!==checkpoint.sha256)throw Error('reader_response_conflict');if(full)await persistAnswerMedia(answerStore,full,op);return {recorded:true,status:op.status,responsePreserved:!!op.reader_response_sha256};}
  const r=op.pricing,u=input.usage;
  const valid=u&&integer(u.input,0,r.inputLimit)&&integer(u.output,0,r.outputLimit)&&(u.input>0||u.output>0);
  if(checkpoint&&!valid&&(!full||input.usage!==null))throw Error('invalid_reader_response');
  const cost=valid?Math.ceil(u.input*r.input+u.output*r.output):Number(op.reserved_micro_usd);
  // Image output uses the highest output rate for all output tokens. This is conservative accounting, not a provider invoice.
  const status=valid?'completed':'uncertain',ref=typeof input.receiptRef==='string'?input.receiptRef.slice(0,200):'';
  if(full)await persistAnswerMedia(answerStore,full,op);
  await db.query('UPDATE a7_paid_operations SET status=$2,accounted_micro_usd=$3,usage=$4,receipt_ref=$5,settle_sha256=$6,reader_response=$7,reader_response_sha256=$8,updated_at=now() WHERE operation_key=$1',[op.operation_key,status,cost,valid?JSON.stringify(u):null,ref,fingerprint,checkpoint?JSON.stringify(checkpoint.response):null,checkpoint?.sha256||null]);
  await db.query('UPDATE a7_owner_budgets SET committed_micro_usd=committed_micro_usd+$2,updated_at=now() WHERE client_run_id=$1',[input.clientId,cost-Number(op.accounted_micro_usd)]);
  await audit(db,input.clientId,op.operation_key,status,'engine',{accountedMicroUsd:cost,usage:valid?u:null,basis:valid?'provider token counts × conservative standard rates; estimate, not invoice':'No complete token receipt; full reservation retained. No automatic resend.'});
  return {recorded:true,status,accountedMicroUsd:cost,responsePreserved:!!checkpoint};
 });
}
export async function readReaderResponse(pool,input){
 if(!input||!clientId(input.clientId)||!id(input.operationKey)||typeof input.permit!=='string')throw Error('invalid_settlement');
 const {rows:[op]}=await pool.query('SELECT permit,status,reader_response FROM a7_paid_operations WHERE operation_key=$1 AND client_run_id=$2 AND node_name=$3',[input.operationKey,input.clientId,'03b Eye fallback (OpenAI)']);
 if(!op||op.permit!==input.permit)throw Error('operation_mismatch');
 return {preserved:!!op.reader_response,response:op.reader_response||null,status:op.status,resend:false};
}
export async function readBudget(pool,ownerId,client){
 if(!clientId(client))throw Error('invalid_budget');
 const {rows:[budget]}=await pool.query('SELECT client_run_id,run_id,limit_micro_usd,committed_micro_usd,pricing_version,created_at FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2',[client,ownerId]);
 if(!budget)throw Error('not_found');
 const {rows:operations}=await pool.query('SELECT operation_key,node_name,model,output_id,reserved_micro_usd,accounted_micro_usd,status,usage,receipt_ref,created_at FROM a7_paid_operations WHERE client_run_id=$1 ORDER BY created_at',[client]);
 return {budget,operations,basis:'Conservative token accounting and retained uncertain reservations; not provider invoices.'};
}
export async function reconcileCall(pool,ownerId,client,input){
 if(!clientId(client)||!input||!id(input.operationKey)||!(/^[a-f0-9-]{36}$/.test(input.requestId||''))||input.confirmed!==true||typeof input.note!=='string'||!input.note.trim()||input.note.length>1000||typeof input.evidence!=='string'||!input.evidence.trim()||input.evidence.length>200||typeof input.chargedUsd!=='number'||!Number.isFinite(input.chargedUsd)||input.chargedUsd<0||input.chargedUsd>10000)throw Error('invalid_reconciliation');
 const cost=Math.round(input.chargedUsd*1000000);if(Math.abs(cost-input.chargedUsd*1000000)>1e-6)throw Error('invalid_reconciliation');
 return transaction(pool,async db=>{
  const {rows:[budget]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2 FOR UPDATE',[client,ownerId]);if(!budget)throw Error('not_found');
  const {rows:[old]}=await db.query('SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2',[input.requestId,client]);
  const detail={operationKey:input.operationKey,chargedMicroUsd:cost,note:input.note.trim(),evidence:input.evidence.trim(),verification:'Owner-reported billing reconciliation; not independently verified by A7.'};
  if(old){if(hash(old.detail)!==hash(detail))throw Error('reconciliation_conflict');return {recorded:true,resend:false};}
  const {rows:[op]}=await db.query('SELECT * FROM a7_paid_operations WHERE operation_key=$1 AND client_run_id=$2 FOR UPDATE',[input.operationKey,client]);
  if(!op||op.status!=='uncertain')throw Error('operation_not_uncertain');
  await db.query('UPDATE a7_paid_operations SET status=$2,accounted_micro_usd=$3,updated_at=now() WHERE operation_key=$1',[op.operation_key,'owner_reconciled',cost]);
  await db.query('UPDATE a7_owner_budgets SET committed_micro_usd=committed_micro_usd+$2,updated_at=now() WHERE client_run_id=$1',[client,cost-Number(op.accounted_micro_usd)]);
  await db.query('INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,$4,$5,$6)',[input.requestId,client,op.operation_key,'owner_reconciled',ownerId,JSON.stringify(detail)]);
  return {recorded:true,resend:false};
 });
}
