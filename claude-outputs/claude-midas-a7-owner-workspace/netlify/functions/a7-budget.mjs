import {getStore} from '@netlify/blobs';
import {readAnswerCheckpoint} from '../../lib/a7-answer-checkpoints.mjs';
import {timingSafeEqual} from 'node:crypto';
import {budgetPool} from '../../lib/a7-database.mjs';
import {reserveCall,settleCall,readReaderResponse} from '../../lib/a7-budget.mjs';
import {beginReplacement,readPreservedReplacement} from '../../lib/a7-reader-replacement.mjs';
import {transaction} from '../../lib/a7-budget.mjs';
import {beginReaderRecovery} from '../../lib/a7-reader-recovery.mjs';
import {blindContext,beginBlindContinuation} from '../../lib/a7-blind-recovery.mjs';
import {packageContext,beginPackageContinuation} from '../../lib/a7-package-recovery.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {claimSourceContinuation} from '../../lib/a7-source-continuation.mjs';
import {spendingHold} from '../../lib/a7-spending-policy.mjs';
export default async function handler(request,context){
 if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
 if(context.deploy?.context!=='production')return noStoreJson({error:'production_required'},403);
 const expected=Netlify.env.get('A7_READ_AUTHORIZATION'),actual=request.headers.get('authorization')||'';
 if(!expected||actual.length>4096||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return noStoreJson({error:'unauthorized'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return noStoreJson({error:'invalid_request'},400);
 const action=context.params?.action;
 let body;try{const text=await request.text();if(Buffer.byteLength(text)>(action==='settle'?5500000:150000))throw Error('too_large');body=JSON.parse(text);}catch{return noStoreJson({error:'invalid_request'},400);}
 try{
  const answerStore=()=>getStore({name:'a7-owner-production',consistency:'strong'});
  if(action==='source-continuation')return noStoreJson(await claimSourceContinuation(budgetPool(),answerStore(),body));
  if(action==='package-context')return noStoreJson(await packageContext(budgetPool(),body));
  if(action==='package-continue')return noStoreJson(await transaction(budgetPool(),db=>beginPackageContinuation(db,body)));
  if(action==='blind-context')return noStoreJson(await blindContext(budgetPool(),body));
  if(action==='blind-continue')return noStoreJson(await transaction(budgetPool(),db=>beginBlindContinuation(db,body)));
  // The emergency stop (A7_PAID_BUDGET_GUARDS_READY off) also stops runs already past Go 1: no new reservation, so the
  // engine holds at its next paid call. Settling calls already made keeps working.
  if(action==='reserve'&&spendingHold('reserve',Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')))return noStoreJson({send:false,reason:'paid_guards_not_ready'});
  if(action==='reserve')return noStoreJson(await reserveCall(budgetPool(),body));
  if(action==='settle')return noStoreJson(await settleCall(budgetPool(),body,body.completeAnswer?answerStore():undefined));
  if(action==='answer-response')return noStoreJson(await readAnswerCheckpoint(budgetPool(),answerStore(),body));
  if(action==='replacement-checkpoint')return noStoreJson(await readPreservedReplacement(budgetPool(),body));
  if(action==='reader-response')return noStoreJson(await readReaderResponse(budgetPool(),body));
  if(action==='reader-recovery')return noStoreJson(body.replacementId?await transaction(budgetPool(),db=>beginReplacement(db,body)):await beginReaderRecovery(budgetPool(),body));
  return noStoreJson({error:'not_found'},404);
 }catch(error){
  const known=['replacement_response_unavailable','invalid_replacement','replacement_not_available','replacement_not_authorized','replacement_scope_mismatch','replacement_duplicate_denied','replacement_reader_limit','invalid_recovery','recovery_not_available','invalid_operation','invalid_token_bounds','call_policy_mismatch','price_verification_required','reservation_exceeds_preview_limit','budget_missing','budget_run_mismatch','operation_conflict','invalid_settlement','operation_mismatch','settlement_conflict','invalid_reader_response','reader_response_too_large','reader_response_conflict'];
  const safe=['invalid_answer_checkpoint','answer_checkpoint_too_large','answer_storage_unavailable','answer_storage_unverified','package_evidence_mismatch','package_ledger_mismatch','package_checkpoint_mismatch','package_continuation_used','invalid_source_continuation','source_confirmation_required','analysis_source_changed','analysis_confirmation_stale','source_continuation_used'].includes(error.message)||known.includes(error.message)||['blind_evidence_mismatch','blind_ledger_mismatch','blind_checkpoint_missing','blind_outcome_uncertain','blind_scope_mismatch','blind_response_missing','blind_continuation_used'].includes(error.message);
  return noStoreJson({error:safe?error.message:'budget_storage_unavailable'},safe?409:503);
 }
}
export const config={path:'/api/a7/budget/:action',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:120}};
