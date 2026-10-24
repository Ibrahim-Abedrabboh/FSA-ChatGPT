import {createHash} from 'node:crypto';
import {transaction} from './a7-budget.mjs';
import {requestId,canonical} from './a7-actions.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';
import {sourceUnderstandingService,requireConfirmedSource} from './a7-understanding-service.mjs';
import {draftReferences} from './a7-projects.mjs';
import {verifiedAnalysisAnswers} from './a7-analysis-ledger.mjs';

function eventId(value){const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}

// Called only by the header-authenticated engine boundary, before main readers.
// The first proof claim wins; an uncertain main dispatch never starts another run.
export async function claimSourceContinuation(pool,store,input){
 if(!requestId(input?.draftId)||!requestId(input?.requestId)||typeof input?.clientRunId!=='string'||typeof input?.runId!=='string'||!/^[a-f0-9]{64}$/.test(input?.sourceSha256||''))throw Error('invalid_source_continuation');
 const ids=sharedRunIdentity(input.draftId);
 if(input.clientRunId!==ids.clientRunId||input.runId!==ids.runId)throw Error('invalid_source_continuation');
 const {rows:[draft]}=await pool.query('SELECT owner_id,brief,note,direction,parent_id,dispatch_state,client_run_id FROM a7_job_versions WHERE id=$1',[input.draftId]);
 if(!draft||draft.client_run_id!==ids.clientRunId||!['confirmed','sending','received','outcome_unknown'].includes(draft.dispatch_state))throw Error('source_confirmation_required');
 const service=sourceUnderstandingService({
  references:(owner,id)=>draftReferences(pool,owner,id),
  // An inherited analysis is read through the draft's parents, always within the same owner.
  draftRecord:async(owner,id)=>{if(id===input.draftId)return draft;const {rows:[row]}=await pool.query('SELECT brief,parent_id,note,direction FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[id,owner]);if(!row)throw Error('not_found');return row;},
  store:{get:key=>store.get(key,{type:'json',consistency:'strong'})},reader:null
 });
 const state=await service.state(draft.owner_id,input.draftId);
 if(state.source.sourceSha256!==input.sourceSha256)throw Error('analysis_source_changed');
 const proof=requireConfirmedSource(state,draft.brief);
 if(input.confirmationFingerprint!==proof.confirmationFingerprint||input.receiptFingerprint!==state.receipt.fingerprint)throw Error('analysis_confirmation_stale');
 // The paid answers are verified in the ledger of the run that paid for them: this draft's own run, or for an
 // inherited analysis the origin draft's run. Either way they are the answers the owner confirmed.
 const paid=state.inherited?.origin||state.source,paidIds=sharedRunIdentity(paid.draftId);
 const answers=await verifiedAnalysisAnswers(pool,draft.owner_id,paid,{clientRunId:paidIds.clientRunId,runId:paidIds.runId,sourceSha256:paid.sourceSha256,referenceFingerprint:paid.referenceFingerprint,readers:state.receipt.readers.map(r=>({...r,status:'completed'}))});
 const claim=eventId(canonical(['source-continuation',ids.clientRunId]));
 const claimed=await transaction(pool,async db=>{
  const {rows:[budget]}=await db.query('SELECT run_id,owner_id,limit_micro_usd FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[ids.clientRunId]);
  // A row opened at send has no run until its first paid call. An edit that reuses its parent's paid reading has
  // made none, so the proof binds the row to this run, as the first reservation would; another run is refused.
  if(!budget||(budget.run_id!==null&&budget.run_id!==ids.runId)||budget.owner_id!==draft.owner_id||Number(budget.limit_micro_usd)!==Math.round(state.source.budgetLimitUsd*1e6))throw Error('budget_run_mismatch');
  if(budget.run_id===null)await db.query('UPDATE a7_owner_budgets SET run_id=$2,updated_at=now() WHERE client_run_id=$1 AND run_id IS NULL',[ids.clientRunId,ids.runId]);
  const {rows}=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,event,actor,detail) VALUES($1,$2,'source_continuation_claimed','engine',$3) ON CONFLICT DO NOTHING RETURNING event_id",[claim,ids.clientRunId,JSON.stringify({draftId:input.draftId,requestId:input.requestId,confirmationFingerprint:proof.confirmationFingerprint,receiptFingerprint:state.receipt.fingerprint})]);
  return rows.length===1;
 });
 if(!claimed)throw Error('source_continuation_used');
 return {verified:true,inheritedFrom:proof.inheritedFrom,clientRunId:ids.clientRunId,runId:ids.runId,draftId:input.draftId,sourceSha256:state.source.sourceSha256,referenceFingerprint:state.source.referenceFingerprint,confirmationFingerprint:proof.confirmationFingerprint,receiptFingerprint:state.receipt.fingerprint,facts:proof.facts,answers};
}
