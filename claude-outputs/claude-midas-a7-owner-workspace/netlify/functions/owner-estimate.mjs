import authenticate from './owner-me.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {draftReferences} from '../../lib/a7-projects.mjs';
import {estimateDraft} from '../../lib/a7-estimate.mjs';
import {sendBlockers} from '../../lib/a7-send-check.mjs';
import {requestId} from '../../lib/a7-actions.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
export default async function handler(request,context) {
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;
 if(request.method!=='GET')return noStoreJson({error:'method_not_allowed'},405);
 if(!requestId(context.params?.id))return noStoreJson({error:'invalid_draft'},400);
 const owner=await auth.json();
 try {
  const pool=budgetPool(),{rows:[draft]}=await pool.query('SELECT id,parent_id,brief,direction,note FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[context.params.id,owner.id]);
  if(!draft)return noStoreJson({error:'not_found'},404);
  const paidFlag=Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY'),refs=await draftReferences(pool,owner.id,draft.id),estimate=estimateDraft(draft,refs);
  const paidReady=paidFlag==='true',testMode=Netlify.env.get('A7_OWNER_TEST_ALL_SCOPES')==='true';
  // sendable and blockers come from the checks the send runs (lib/a7-send-check.mjs), so the page's button agrees with the server.
  const blockers=sendBlockers(draft,refs,{estimate,paidReady,testMode,multiReference:Netlify.env.get('A7_BRIDGE_MULTI_REFERENCE')==='true'});
  return noStoreJson({...estimate,paidReady,testMode,paidReleaseState:paidFlag===undefined?'missing':paidFlag==='true'?'enabled':'disabled',sendable:blockers.length===0,blockers});
 }catch(error){
  const {status,body,unexpected}=estimateRefusal(error);
  // An unexpected failure: log its internal reason (never a secret or the brief) so it can be traced.
  if(unexpected)console.error('owner-estimate',context.params.id,error?.message);
  return noStoreJson(body,status);
 }
}
// Why no estimate was given, in words. Prices carry a verification date (lib/a7-cost-calibration.mjs, lib/a7-budget.mjs): after it, no
// estimate is made until they are re-verified against provider receipts, which needs a person, not a later date.
export function estimateRefusal(error){
 if(error?.message==='estimate_scope_unsupported')return {status:503,body:{error:error.message,reason:error.reason||null,message:SCOPE_HELP[error.reason]||SCOPE_HELP.outputs}};
 if(error?.message==='price_verification_required')return {status:503,body:{error:error.message,message:'Prices must be re-verified before new estimates; contact support. Your draft is saved; nothing was sent or paid.'}};
 return {status:503,unexpected:true,body:{error:'estimate_unavailable',message:'The cost estimate is unavailable just now. Your draft is saved; paid processing cannot start. Try again shortly.'}};
}
// What to change when a saved version is outside the estimate's scope. The draft is unchanged and nothing was sent.
const SCOPE_HELP={
 outcome:'No estimate: this saved version has no outcome. Under What to create, tick White BK or Lifestyle, save the version, then get the estimate again.',
 resolution:'No estimate: choose 2K or 4K resolution under Look and settings, save the version, then get the estimate again.',
 view:'No estimate: this saved version has no supported camera view. Save it again from this page, then get the estimate again.',
 budget:'No estimate: set a job budget from USD 0.25 to USD 10.00 under The product, save the version, then get the estimate again.',
 outputs:'No estimate: the chosen outcomes plan no image. Under What to create, tick White BK or Lifestyle, save the version, then get the estimate again.'
};
export const config={path:'/api/owner/project-estimate/:id',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
