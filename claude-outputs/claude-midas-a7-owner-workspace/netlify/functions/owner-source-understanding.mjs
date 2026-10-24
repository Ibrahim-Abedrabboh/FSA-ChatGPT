import authenticate from './owner-me.mjs';
import {sourceUnderstandingService} from '../../lib/a7-understanding-service.mjs';
import {productionSourceUnderstandingService} from '../../lib/a7-understanding-production.mjs';
import {sameOrigin,requestId} from '../../lib/a7-actions.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {scopeWarnings} from '../../lib/a7-send-check.mjs';

// dispatch(request,draft) starts the background reader for a claimed analysis and resolves once
// it is accepted. Without it, analyze runs the reads inside this request (tests, local use).
export function createSourceUnderstandingHandler(dependencies,{dispatch,multiReference=()=>globalThis.Netlify?.env?.get?.('A7_BRIDGE_MULTI_REFERENCE')==='true'}={}){
 return async function handler(request,context){
  const auth=await authenticate(new Request(request.url,{method:'GET',headers:request.headers}),context);
  if(!auth.ok)return auth;
  const owner=(await auth.json()).id,draft=context.params?.id;
  if(!requestId(draft))return noStoreJson({error:'not_found'},404);
  if(request.method!=='GET'&&request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
  if(request.method==='POST'&&(!sameOrigin(request)||context.deploy?.context!=='production'))return noStoreJson({error:'origin_rejected'},403);
  const supplied=dependencies(),service=typeof supplied.state==='function'?supplied:sourceUnderstandingService(supplied);
  try{
   if(request.method==='GET'){
    const action=new URL(request.url).searchParams.get('action');
    if(action!=='quote')return noStoreJson(await service.state(owner,draft));
    // The quote says, before the owner pays, what would still stop this version from being sent.
    const quote=await service.quote(owner,draft);
    return noStoreJson(quote.status==='verified'?{...quote,warnings:scopeWarnings(quote.source,{multiReference:multiReference()})}:quote);
   }
   const raw=await request.text();if(raw.length>5000)throw Error('invalid_request');
   const input=JSON.parse(raw);
   if(input.action==='analyze'){
    if(!dispatch)return noStoreJson(await service.analyze(owner,draft,input));
    const started=await service.begin(owner,draft,input);
    if(await service.needsDispatch(owner,draft))await startReader(dispatch,request,draft);
    return noStoreJson({...started,message:'Analysis started. This page checks for the readings; do not start another analysis.'},202);
   }
   if(input.action==='recover'){
    // A background claim whose start was lost is started here, still at most once.
    if(dispatch&&await service.needsDispatch(owner,draft))await startReader(dispatch,request,draft);
    return noStoreJson(await service.recover(owner,draft));
   }
   if(input.action==='confirm')return noStoreJson(await service.confirm(owner,draft,input));
   throw Error('invalid_request');
  }catch(error){
   const {status,body}=mapSourceUnderstandingError(error instanceof SyntaxError?'invalid_request':error?.message,error?.detail);
   // Log the internal reason for unexpected failures; never a secret or request body.
   if(status>=500||body.error==='analysis_receipt_unverified')console.error('source-understanding',draft,error?.message);
   // A refused confirmation logs which rule refused it: codes and lengths only (lib/a7-source-understanding.mjs confirmUnderstanding).
   if(CONFIRM_REFUSALS.includes(body.error))console.error('source-understanding confirm refused',draft,body.error,JSON.stringify(error?.detail||{}));
   return noStoreJson(body,status);
  }
 };
}
// A failed start leaves the claim undispatched, so the next recover starts it; it is never an error to the page.
async function startReader(dispatch,request,draft){try{await dispatch(request,draft);}catch(error){console.error('source-understanding dispatch',draft,error?.message);}}
// The background function authenticates the same owner session, so only its cookie is forwarded.
export async function dispatchBackgroundReader(request,draft){
 const target=new URL('/.netlify/functions/owner-source-analysis-background',request.url);
 const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Cookie:request.headers.get('cookie')||''},body:JSON.stringify({draftId:draft}),redirect:'error',signal:AbortSignal.timeout(8000)});
 if(response.status!==202)throw Error('dispatch_rejected_'+response.status);
}
const EXPOSED=['not_found','analysis_inherited','analysis_not_connected','analysis_outcome_uncertain','analysis_already_claimed','analysis_source_changed','analysis_quote_changed','analysis_already_confirmed','analysis_receipt_missing','analysis_receipt_unverified','analysis_confirmation_incomplete','analysis_correction_reason_required','analysis_conflict_unresolved','source_roles_unresolved','invalid_request','analysis_budget_exceeds_limit','invalid_budget','analysis_quote_unavailable','invalid_route_case','saved_version_required','hero_product_reference','batch_dispatch','price_verification_required'];
// Refusals the owner can fix from the page; each says what to change. Nothing was paid when any of them is returned.
const CONFLICT=['analysis_inherited','analysis_already_claimed','analysis_source_changed','analysis_quote_changed','analysis_already_confirmed','analysis_receipt_unverified','analysis_budget_exceeds_limit','invalid_budget','invalid_route_case','saved_version_required','hero_product_reference','batch_dispatch'];
const CONFIRM_REFUSALS=['analysis_confirmation_incomplete','analysis_correction_reason_required','analysis_conflict_unresolved'];
const usd=value=>Number(value).toFixed(2);
const HELP={
 analysis_budget_exceeds_limit:d=>Number.isFinite(d?.requiredUsd)?`Reading the originals${d.room?' (the product and the room photo)':''} reserves up to USD ${usd(d.requiredUsd)}, more than this job's USD ${usd(d.budgetUsd)} budget. Raise the job budget under The product to at least USD ${usd(d.requiredUsd)}, plus what planning and images need, save, then check analysis availability again. Nothing was paid.`:'Reading the originals costs more than this job\'s budget. Raise the job budget under The product, save, then check analysis availability again. Nothing was paid.',
 invalid_budget:()=>'This saved version has no valid job budget. Set one from USD 0.25 to USD 10.00 under The product, save, then check analysis availability again. Nothing was paid.',
 analysis_quote_unavailable:()=>'The cost of reading the originals could not be confirmed just now, so no reading can start. Try again in a few minutes. Nothing was paid.',
 invalid_route_case:()=>'This saved version has no clear work type and route. Choose them under Type of work, save the originals again, then check analysis availability. Nothing was paid.',
 saved_version_required:()=>'This edit is not linked to a saved version. Open the saved version from Saved work and start the edit there. Nothing was paid.',
 hero_product_reference:()=>'A secondary product needs the hero product it supports, and this site cannot send that yet, so its reading is not offered: it would be paid for nothing. Choose Main item (hero) under Type of work and save the originals as a new version. Nothing was paid.',
 batch_dispatch:()=>'A collection is read and sent one product at a time. Save each product as its own case. Nothing was paid.',
 price_verification_required:()=>'Prices must be re-verified before new estimates; contact support. Your draft is saved and nothing was paid.',
 analysis_confirmation_incomplete:()=>'Fill in the product category, the physical piece count and, when there is a room photo, the room type, then confirm again. Nothing was recorded.',
 analysis_correction_reason_required:()=>'You changed what the readers saw. Explain why in "Explain disputed facts", then confirm again. Nothing was recorded.',
 analysis_conflict_unresolved:d=>d?.resolution&&d.resolution!=='given'?`The reading found a conflict. ${d.resolution==='too_long'?'Shorten the explanation in "Explain disputed facts" to 600 characters':'Explain how you resolved it in "Explain disputed facts"'}, then confirm again. Nothing was recorded.`:Array.isArray(d?.unresolved)&&d.unresolved.length?`The explanation was not matched to every finding of the current reading (${d.unresolved.map(code=>code.replace(/_/g,' ')).join(', ')}). The page has reloaded the reading: check the findings, then confirm again. Nothing was recorded.`:'The reading found a conflict. Explain how you resolved it in "Explain disputed facts", then confirm again. Nothing was recorded.'
};
export function mapSourceUnderstandingError(code,detail){
 // The analysis was handed to A7 but no verified result came back in time (Netlify
 // functions cannot wait for every reader). It is pending, not a gateway failure:
 // the claim is recorded, and recover reads completed answers without a new paid call.
 if(code==='analysis_outcome_uncertain')return {status:202,body:{status:'pending_or_uncertain',error:code,message:'Analysis was sent and may still be running. Do not start another analysis; check this saved version again shortly.'}};
 if(!EXPOSED.includes(code))return {status:503,body:{error:'source_understanding_unavailable'}};
 const body={error:code,...(HELP[code]?{message:HELP[code](detail)}:{})};
 if(code==='analysis_budget_exceeds_limit'&&Number.isFinite(detail?.requiredUsd))Object.assign(body,{requiredUsd:detail.requiredUsd,budgetUsd:detail.budgetUsd});
 return {status:code==='not_found'?404:['analysis_not_connected','analysis_quote_unavailable','price_verification_required'].includes(code)?503:CONFLICT.includes(code)?409:400,body};
}
export default createSourceUnderstandingHandler(()=>productionSourceUnderstandingService(),{dispatch:dispatchBackgroundReader});
export const config={path:'/api/owner/source-understanding/:id',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:15}};
