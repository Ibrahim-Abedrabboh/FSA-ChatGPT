import {canonical,digest} from './a7-actions.mjs';
// One owner-approved repair, not a general retry or a new independent budget.
export const REPLACEMENT=Object.freeze({id:'owner-reader-replacement-20261018-1',clientId:'owner-c999d3d0-348b-4bf2-b9f2-0bf8383ac4e6',runId:'claude-a7-20261017230527-1i4fxz',sourceSha256:'0936aa534965b928ef6a30f014f068c30fe91f2345e42983945212c3833c06b3',briefSha256:'feacf0e97918253891c4237508179f3e8b1e2a2d2130884efb1fb38ae4c61520',oldResponseId:'resp_0fa50fcd9c503b1c016ad423d1c9d887d281f0ee7a07ecd510',additionalMicro:3872506,readerMicro:250000,committedMicro:867490,limitMicro:4739996});
export const replacementKey='a7:replacement:'+digest(REPLACEMENT.id);
const claimId=digest(REPLACEMENT.id).slice(0,8)+'-'+digest(REPLACEMENT.id).slice(8,12)+'-4'+digest(REPLACEMENT.id).slice(13,16)+'-8'+digest(REPLACEMENT.id).slice(17,20)+'-'+digest(REPLACEMENT.id).slice(20,32);
const validId=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v||'');
export function replacementEligible(ledger,status){
 const ops=ledger.operations||[],one=(node,state,cost)=>ops.filter(o=>o.node_name===node&&o.status===state&&Number(o.accounted_micro_usd)===cost).length===1;
 return status==='hold'&&ledger.budget.client_run_id===REPLACEMENT.clientId&&ledger.budget.run_id===REPLACEMENT.runId&&Number(ledger.budget.limit_micro_usd)===REPLACEMENT.limitMicro&&Number(ledger.budget.committed_micro_usd)===REPLACEMENT.committedMicro&&ops.length===3&&one('03 Eye reads the product photo','uncertain',846432)&&one('05 Second count','completed',3564)&&one('03b Eye fallback (OpenAI)','completed',17494)&&ops.some(o=>o.receipt_ref===REPLACEMENT.oldResponseId);
}
export async function prepareReplacement(db,ownerId,ledger,status,input){
 if(!replacementEligible(ledger,status)||input?.confirmed!==true||input.replacementId!==REPLACEMENT.id||!validId(input.requestId)||!(/^[a-f0-9]{64}$/.test(input.revision||''))||input.sourceSha256!==REPLACEMENT.sourceSha256||input.additionalBudgetUsd!==3.872506||input.readerBudgetUsd!==.25)throw Error('replacement_not_available');
 const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2 FOR UPDATE',[REPLACEMENT.clientId,ownerId]);
 const {rows:ops}=await db.query('SELECT * FROM a7_paid_operations WHERE client_run_id=$1',[REPLACEMENT.clientId]);
 if(!b||!replacementEligible({budget:b,operations:ops},status)||ops.some(o=>o.reader_response))throw Error('replacement_not_available');
 const {rows:oldStarts}=await db.query("SELECT event_id FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_started'",[REPLACEMENT.clientId]);
 if(oldStarts.length!==1)throw Error('replacement_not_available');
 const detail={...REPLACEMENT,requestId:input.requestId,revision:input.revision,started:false,ledgerSnapshot:{budget:ledger.budget,operations:ledger.operations},note:'Owner approved intentional replacement reading; original receipts and uncertain reservation retained.'};
 const inserted=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,'reader_replacement_requested',$4,$5) ON CONFLICT DO NOTHING RETURNING event_id",[claimId,REPLACEMENT.clientId,replacementKey,ownerId,JSON.stringify(detail)]);
 if(inserted.rows.length!==1)throw Error('replacement_already_requested');
 return {replacementId:REPLACEMENT.id,requestId:input.requestId,clientId:REPLACEMENT.clientId,runId:REPLACEMENT.runId,sourceSha256:REPLACEMENT.sourceSha256,briefSha256:REPLACEMENT.briefSha256};
}
export async function beginReplacement(db,input){
 if(input?.resumePreserved===true)return beginPreservedContinuation(db,input);
 if(input?.replacementId!==REPLACEMENT.id||input.clientId!==REPLACEMENT.clientId||input.runId!==REPLACEMENT.runId||input.sourceSha256!==REPLACEMENT.sourceSha256||input.briefSha256!==REPLACEMENT.briefSha256||!validId(input.requestId)||!input.checkpoint||digest(canonical(input.checkpoint.brief))!==REPLACEMENT.briefSha256||input.checkpoint.cached_second?.total!==2)throw Error('invalid_replacement');
 const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[input.clientId]);
 const {rows:ops}=await db.query('SELECT * FROM a7_paid_operations WHERE client_run_id=$1',[input.clientId]);
 const {rows:[claim]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_replacement_requested' FOR UPDATE",[claimId,input.clientId]);
 if(!b||!replacementEligible({budget:b,operations:ops},'hold')||!claim||claim.detail.started||claim.detail.requestId!==input.requestId||ops.some(o=>o.reader_response))throw Error('replacement_not_available');
 const changed=await db.query("UPDATE a7_budget_audit SET detail=$2 WHERE event_id=$1 AND detail->>'started'='false' RETURNING event_id",[claimId,JSON.stringify({...claim.detail,started:true,startedAt:new Date().toISOString(),checkpoint:input.checkpoint})]);
 if(changed.rows.length!==1)throw Error('replacement_not_available');
 return {allowed:true,runId:input.runId,clientId:input.clientId,replacementId:REPLACEMENT.id};
}
export async function enforceReplacementReservation(db,input,quote){
 if(input.clientId!==REPLACEMENT.clientId)return;
 const {rows:[claim]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_replacement_requested'",[claimId,input.clientId]);
 if(!claim?.detail.started||input.runId!==REPLACEMENT.runId)throw Error('replacement_not_authorized');
 const {rows:[budget]}=await db.query('SELECT limit_micro_usd FROM a7_owner_budgets WHERE client_run_id=$1',[input.clientId]);
 if(!budget||Number(budget.limit_micro_usd)>REPLACEMENT.limitMicro)throw Error('replacement_scope_mismatch');
 const {rows:ops}=await db.query('SELECT node_name,operation_key,status,accounted_micro_usd FROM a7_paid_operations WHERE client_run_id=$1',[input.clientId]);
 if(!ops.some(o=>o.node_name==='03 Eye reads the product photo'&&o.status==='uncertain'&&Number(o.accounted_micro_usd)===846432))throw Error('replacement_scope_mismatch');
 const approved={'03b Eye fallback (OpenAI)':'job','09 Conflict check':'job','15g Send to Google':'white_master','16 Critic review':'white_master','16x Blind count':'white_master'};
 if(approved[input.node]!==input.outputId)throw Error('replacement_scope_mismatch');
 const maximum=input.node==='03b Eye fallback (OpenAI)'?1:0;
 if(ops.filter(o=>o.node_name===input.node).length>maximum)throw Error('replacement_duplicate_denied');
 if(input.node==='03b Eye fallback (OpenAI)'&&(input.operationKey!==replacementKey||input.replacementId!==REPLACEMENT.id||quote.reserve>REPLACEMENT.readerMicro))throw Error('replacement_reader_limit');
}
export async function replacementState(db,ledger,status){
 if(ledger.budget.client_run_id!==REPLACEMENT.clientId)return null;
 const {rows:claims}=await db.query("SELECT detail->>'started' AS started FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_replacement_requested'",[claimId,REPLACEMENT.clientId]);
 const {rows:responses}=await db.query('SELECT operation_key FROM a7_paid_operations WHERE client_run_id=$1 AND reader_response IS NOT NULL',[REPLACEMENT.clientId]);
 const {rows:continuations}=await db.query("SELECT event_id FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2",[continuationId,REPLACEMENT.clientId]);
 return {id:REPLACEMENT.id,continuationEligible:status==='hold'&&ledger.operations.length===4&&responses.length>0&&claims.some(c=>c.started==='true')&&!continuations.length,eligible:!claims.length&&!responses.length&&replacementEligible(ledger,status),requested:claims.length>0,started:claims.some(c=>c.started==='true'),readerCapUsd:.25,additionalBudgetUsd:3.872506};
}
// Read-only recovery of this attempt's durable answer; never returns a permit.
export async function readPreservedReplacement(db,input){
 if(input?.replacementId!==REPLACEMENT.id||input.clientId!==REPLACEMENT.clientId||input.runId!==REPLACEMENT.runId)throw Error('invalid_replacement');
 const {rows:[claim]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_replacement_requested'",[claimId,input.clientId]);
 const {rows:[op]}=await db.query('SELECT status,reader_response FROM a7_paid_operations WHERE operation_key=$1 AND client_run_id=$2',[replacementKey,input.clientId]);
 if(!claim?.detail.started||!claim.detail.checkpoint||op?.status!=='completed'||!op.reader_response)throw Error('replacement_response_unavailable');
 return {preserved:true,clientId:input.clientId,runId:input.runId,replacementId:REPLACEMENT.id,checkpoint:claim.detail.checkpoint,readerResponse:op.reader_response,resend:false};
}
const continuationId=(()=>{const h=digest(REPLACEMENT.id+':saved-answer-continuation');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);})();
export async function preparePreservedContinuation(db,ownerId,ledger,status,input){
 if(status!=='hold'||ledger.budget.client_run_id!==REPLACEMENT.clientId||input?.confirmed!==true||input.replacementId!==REPLACEMENT.id||!validId(input.requestId)||!(/^[a-f0-9]{64}$/.test(input.revision||''))||input.sourceSha256!==REPLACEMENT.sourceSha256)throw Error('replacement_not_available');
 const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2 FOR UPDATE',[REPLACEMENT.clientId,ownerId]);
 if(!b||Number(b.limit_micro_usd)>REPLACEMENT.limitMicro)throw Error('replacement_not_available');
 await readPreservedReplacement(db,{replacementId:REPLACEMENT.id,clientId:REPLACEMENT.clientId,runId:REPLACEMENT.runId});
 const {rows:ops}=await db.query('SELECT operation_key FROM a7_paid_operations WHERE client_run_id=$1',[REPLACEMENT.clientId]);if(ops.length!==4)throw Error('replacement_not_available');
 const inserted=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,'reader_preserved_continuation_requested',$4,$5) ON CONFLICT DO NOTHING RETURNING event_id",[continuationId,REPLACEMENT.clientId,replacementKey,ownerId,JSON.stringify({requestId:input.requestId,revision:input.revision,started:false})]);
 if(inserted.rows.length!==1)throw Error('replacement_already_requested');
 return {replacementId:REPLACEMENT.id,resumePreserved:true,requestId:input.requestId,clientId:REPLACEMENT.clientId,runId:REPLACEMENT.runId,sourceSha256:REPLACEMENT.sourceSha256,briefSha256:REPLACEMENT.briefSha256};
}
export async function beginPreservedContinuation(db,input){
 const saved=await readPreservedReplacement(db,input);
 if(input.sourceSha256!==REPLACEMENT.sourceSha256||input.briefSha256!==REPLACEMENT.briefSha256||digest(canonical(input.checkpoint?.brief))!==REPLACEMENT.briefSha256||input.checkpoint?.cached_second?.total!==2)throw Error('invalid_replacement');
 await db.query('SELECT client_run_id FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[REPLACEMENT.clientId]);
 const {rows:[claim]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_preserved_continuation_requested' FOR UPDATE",[continuationId,REPLACEMENT.clientId]);
 if(!claim||claim.detail.started||claim.detail.requestId!==input.requestId)throw Error('replacement_not_available');
 const changed=await db.query("UPDATE a7_budget_audit SET detail=$2 WHERE event_id=$1 AND detail->>'started'='false' RETURNING event_id",[continuationId,JSON.stringify({...claim.detail,started:true,startedAt:new Date().toISOString()})]);if(changed.rows.length!==1)throw Error('replacement_not_available');
 return {allowed:true,runId:REPLACEMENT.runId,clientId:REPLACEMENT.clientId,replacementId:REPLACEMENT.id,readerResponse:saved.readerResponse,resumePreserved:true};
}
