import {claimDraft,recordDraftReceipt,reopenRefusedDraft,draftReferences,DRAFT_BRIEF_KEYS} from '../../lib/a7-projects.mjs';
import {takeSend,settleUnsentFailure} from '../../lib/claude-a7-send-gate.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {openBudget,readBudget} from '../../lib/a7-budget.mjs';
import {estimateDraft,confirmEstimate} from '../../lib/a7-estimate.mjs';
import {productionSourceUnderstandingService} from '../../lib/a7-understanding-production.mjs';
import {requireConfirmedSource} from '../../lib/a7-understanding-service.mjs';
import {sharedRunIdentity} from '../../lib/a7-shared-run.mjs';
import {spendingHold,spendingHoldResponse} from '../../lib/a7-spending-policy.mjs';
import { getStore } from '@netlify/blobs';
import authenticate from './owner-me.mjs';
import { noStoreJson } from '../../lib/owner-auth.mjs';
import { validId } from '../../lib/a7-contract.mjs';
import {digest,sameOrigin,validateSubmission,validateImage,validateDecision,claimOnce,releaseClaim,DECISION_UNCONFIRMED,editRequest,EDIT_DISPATCH_HELP,DECISION_HELP,SUBMIT_HELP,sendRefusal,a7SendRefusal} from '../../lib/a7-actions.mjs';
import {bridgeShape} from '../../lib/a7-bridge-shape.mjs';
import {recordResults,editBase,parentRunIdOf} from '../../lib/a7-results.mjs';
import {siteOrigin} from '../../lib/a7-site-origin.mjs';
import {a7Webhook,a7Origin} from '../../lib/a7-engine-base.mjs';
// The engine address is read on every call, never once at load, so a changed or late setting cannot send a call elsewhere.
const base=()=>a7Webhook('a7/');
// The durable store of claims and receipts. Tests replace get() with an in-memory store.
export const actionStore={get:()=>getStore({name:'a7-owner-production',consistency:'strong'})};
// Why the estimate the owner confirmed cannot start paid work, in words.
const ESTIMATE_HELP={estimate_changed:'The estimate has expired (it is valid for 15 minutes) or no longer matches this saved version. Get the estimate again, then send. Nothing was sent to A7.',estimate_not_verified:'This scope has no calibrated cost yet, so it can be saved but not sent. Nothing was sent to A7.',price_verification_required:'Prices must be re-verified before new estimates; contact support. Nothing was sent to A7.'};
async function upstream(path,options={}) {
 const authorization=Netlify.env.get('A7_READ_AUTHORIZATION');
 if(!authorization)throw new Error('not_configured');
 const response=await fetch(base()+path,{...options,headers:{...options.headers,Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(32000)});
 // 401, 403 and 404 come from the engine itself (wrong secret, unknown webhook) before any run starts: a definite refusal,
 // so a send reopens its draft instead of sitting as an unknown outcome. Every other failure stays unknown.
 if([401,403,404].includes(response.status))return {accepted:false,forwarded:false,receiptKind:'rejected',upstreamStatus:response.status,error:'engine_http_'+response.status};
 if(!response.ok)throw new Error('upstream_http_'+response.status);
 const text=await response.text();if(text.length>180000)throw new Error('invalid_response');
 return JSON.parse(text);
}
function cleanContext(c,id) {
 if(c.runId!==id||!['go1','go2',null].includes(c.gate)||!Array.isArray(c.allowed)||!Array.isArray(c.shots)||!Array.isArray(c.warnings)||!/^[a-f0-9]{64}$/.test(c.revision))throw new Error('invalid_response');
 // The bridge is an authenticated allowlist projection, never a raw run or vault record.
 // Delivered files: only private file links, each with a short label, at most 30. n8n gives Google Drive links; the Python
 // service gives its own signed links (/files/<id>/view?sig=<64 hex>), accepted only from the engine this site is set to call.
 const drive=/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{10,100}\/view$/;
 const engineFile=new RegExp('^'+a7Origin().replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'\\/files\\/[A-Za-z0-9_-]{10,100}\\/view\\?sig=[a-f0-9]{64}$');
 const fileLink=link=>typeof link==='string'&&(drive.test(link)||engineFile.test(link));
 const deliveries=(Array.isArray(c.deliveries)?c.deliveries:[]).filter(d=>d&&fileLink(d.link)).slice(0,30).map(d=>({link:d.link,label:String(d.label||'File').slice(0,120),px:/^\d{2,5}x\d{2,5}$/.test(d.px||'')?d.px:null,kind:['master','file','manifest','scene'].includes(d.kind)?d.kind:'file'}));
 // An image the owner cannot open is never offered for approval: when the Go 2 candidate link is dropped, only Stop remains.
 const candidate=fileLink(c.candidate)?c.candidate:null,allowed=c.gate==='go2'&&!candidate?c.allowed.filter(a=>a==='stop'):c.allowed;
 return {...Object.fromEntries(['runId','clientId','status','gate','round','revision','decisionNeeded','shots','warnings','review','cost','asOf'].map(k=>[k,c[k]])),candidate,allowed,deliveries,paidReady:Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')==='true'};
}
export default async function handler(request,context) {
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;const owner=await auth.json();
 const id=context.params?.id;
 if(request.method==='GET'){
  if(!validId(id))return noStoreJson({error:'invalid_run'},400);
  try{
   const raw=await upstream('owner-context?id='+encodeURIComponent(id)),clean=cleanContext(raw,id);
   // Approved images are recorded once on the site, so an edit can name the exact image it starts from.
   // A failure here never hides the approval ticket.
   let results=[];try{results=await recordResults(budgetPool(),owner.id,id,raw.results);}catch(error){console.error('result-assets',id,error?.message);}
   return noStoreJson({...clean,results});
  }catch(error){return noStoreJson({error:'approval_context_unavailable',reason:/^upstream_http_\d{3}$/.test(error.message)?error.message:error.message==='not_configured'?'not_configured':'invalid_or_unreachable_response'},502);}
 }
 if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
 if(!sameOrigin(request))return noStoreJson({error:'origin_rejected'},403);
 if(context.deploy?.context!=='production')return noStoreJson({error:'actions_require_owner_preview_production'},403);
 // A release switch avoids accidentally enabling writes through a source-only deploy.
 if(Netlify.env.get('A7_OWNER_ACTIONS_ENABLED')!=='true')return noStoreJson({error:'owner_actions_not_enabled'},503);
 let operation,body,fingerprint,key,upload,input,submissionDraft,store,decisionClaim=null,submitClaim=null,reached=false,confirmedHere=false;
 try {
  if(id){
   if(!validId(id)||!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('invalid_request');
   const text=await request.text();if(text.length>4096)throw new Error('invalid_request');input=JSON.parse(text);
   if(spendingHold(input?.decision,Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')))return noStoreJson(spendingHoldResponse,503);
   const current=cleanContext(await upstream('owner-context?id='+encodeURIComponent(id)),id);
   body=validateDecision(input,current);
   if(input.decision!=='stop'){try{await readBudget(budgetPool(),owner.id,current.clientId);}catch(error){throw Error(error.message==='not_found'?'legacy_budget_missing':'budget_storage_unavailable');}}
   operation='decision';key='decision/'+digest(id+':'+current.revision);fingerprint=digest(JSON.stringify(body));
  }else{
   const length=Number(request.headers.get('content-length'));if(length>3300000)throw new Error('image_size');
   const form=await request.formData();const raw=form.get('payload');if(typeof raw!=='string'||raw.length>14000)throw new Error('invalid_request');input=JSON.parse(raw);if(['add','remove','replace'].includes(input.editOperation))throw Error('edit_flow_not_ready');body=validateSubmission(input);
    if(!input.draftId)throw Error('invalid_request');const identity=sharedRunIdentity(input.draftId);if(body.clientRunId!==identity.clientRunId||body.runId!==identity.runId)throw Error('invalid_request');upload=[];operation='submit';key='submit/'+input.requestId;
  }
 }catch(error){if(EDIT_DISPATCH_HELP[error.message])return noStoreJson({error:error.message,message:EDIT_DISPATCH_HELP[error.message]},409);const known=['edit_flow_not_ready','stale_decision','change_note_required','legacy_budget_missing','budget_storage_unavailable'];const code=known.includes(error.message)?error.message:'invalid_request';
  // Every refusal here is definite (nothing reached A7), so it carries words the owner can act on, never only a code.
  const field=!id&&SUBMIT_HELP[error.message]?{reason:error.message,message:SUBMIT_HELP[error.message]+' Get the estimate again and send. Nothing was sent to A7.'}:{message:DECISION_HELP[id&&error.message==='invalid_decision'?'invalid_decision':code]};
  return noStoreJson({error:code,...field},['budget_storage_unavailable','edit_flow_not_ready'].includes(code)?503:['stale_decision','legacy_budget_missing'].includes(code)?409:400);}
 try {
  if(upload&&spendingHold('submit',Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')))return noStoreJson(spendingHoldResponse,503);
  // Without the A7 connection secret a send cannot reach A7: refuse before any budget, claim or draft state changes.
  if(upload&&!Netlify.env.get('A7_READ_AUTHORIZATION'))return noStoreJson({error:'a7_connection_not_configured',message:'The A7 connection secret is not set on this site. Nothing was sent; your request stays saved.'},503);
  if(upload){
   const brief=Object.fromEntries(DRAFT_BRIEF_KEYS.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
   // A retried request with the same ID gets its stored receipt instead of being refused as a resend.
   const earlier=await actionStore.get().get('receipts/'+key,{type:'json',consistency:'strong'});if(earlier)return noStoreJson(earlier,earlier.accepted?200:502);
   try{
    const draft=await claimDraft(budgetPool(),owner.id,input.draftId,body.clientRunId,brief,input.instructions.trim(),false);
    submissionDraft=draft;
    body.ownerWorkspace={caseId:draft.case_id,versionId:draft.id,version:draft.version,parentVersionId:draft.parent_id,requestId:input.requestId};
    const origin=siteOrigin();if(origin)body.budgetOrigin=origin;
    const edit=editRequest(draft);
    body.jobMode=edit?'edit':'new_project';
    body.instructions=draft.direction||draft.note;
    if(edit)body.edit=edit;
    if(draft.parent_id){const {rows:[parent]}=await budgetPool().query('SELECT id,run_id,client_run_id FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[draft.parent_id,owner.id]);const parentRunId=parentRunIdOf(parent);if(parentRunId)body.parentRunId=parentRunId;}
    // Edit phase 2.4: an edit of an approved image sends that image's receipt; A7 makes one image from it.
    if(draft.brief?.resultAssetId){if(!edit)throw Error('result_asset_required');body.edit.base=await editBase(budgetPool(),owner.id,draft,body.parentRunId);}
    body.sourceUnderstanding=requireConfirmedSource(await productionSourceUnderstandingService().state(owner.id,draft.id),draft.brief);
   }catch(error){const {status,body:refusal}=sendRefusal(error.message,error.detail);return noStoreJson(refusal,status);}
  }
  if(upload){const refs=await draftReferences(budgetPool(),owner.id,input.draftId);try{body.costEstimate=confirmEstimate(estimateDraft(submissionDraft,refs),input.estimateConfirmation,new Date(),{allowProvisional:Netlify.env.get('A7_OWNER_TEST_ALL_SCOPES')==='true'});}catch(error){return noStoreJson({error:error.message,message:ESTIMATE_HELP[error.message]||'Review the current verified estimate before starting paid processing. Nothing was sent to A7.'},409);}if(!refs.some(r=>r.role==='product')||(input.startType==='existing_room'&&!refs.some(r=>r.role==='room')))return noStoreJson({error:'required_reference_missing',message:'Save the required product and room references first. Nothing was sent.'},409);if(refs.length!==1&&Netlify.env.get('A7_BRIDGE_MULTI_REFERENCE')!=='true')return noStoreJson({error:'bridge_single_reference',message:'The A7 owner bridge forwards one product image per job. This version has '+refs.length+' saved references, so nothing was sent. The bridge needs an update first.'},409);const shape=bridgeShape(refs);if(shape)return noStoreJson({error:'bridge_reference_limits',message:shape},409);if(String(input.outcomes||'').split('\n').includes('Variations'))return noStoreJson({error:'variations_not_available',message:'A7 cannot make Variations yet: they start from an approved result image, which A7 does not keep for earlier runs. Remove Variations and send again. Nothing was sent.'},409);const sourceStore=actionStore.get();for(const ref of [...refs].sort((a,b)=>(b.role==='product')-(a.role==='product'))){const data=await sourceStore.get(ref.blob_key,{type:'arrayBuffer'});if(!data||digest(Buffer.from(data))!==ref.sha256)throw Error('reference_unavailable');upload.push({bytes:Buffer.from(data),type:ref.mime,name:ref.role+'-'+ref.reference_id,role:ref.role});}body.references=upload.map(r=>({name:r.name,role:({room:'Room reference',product:'Product / vendor reference',other_view:'Other views',look:'Inspiration reference'})[r.role]||r.role}));fingerprint=digest(JSON.stringify(body)+upload.map(r=>digest(r.bytes)).join(':'));}
  if(upload){try{await openBudget(budgetPool(),{clientId:body.clientRunId,ownerId:owner.id,limitUsd:body.budgetLimitUsd});}catch(error){if(error.message==='budget_lowered')return noStoreJson({error:'budget_lowered',message:'This job budget is lower than the one already opened for this saved version. Keep it the same or raise it. Nothing was sent.'},409);throw error;}await claimDraft(budgetPool(),owner.id,input.draftId,body.clientRunId,Object.fromEntries(DRAFT_BRIEF_KEYS.filter(k=>input[k]!==undefined).map(k=>[k,input[k]])),input.instructions.trim());confirmedHere=true;}
  store=actionStore.get();
  const claimed=await claimOnce(store,key,fingerprint);if(claimed&&operation==='decision')decisionClaim=key;if(claimed&&upload)submitClaim=key;
  if(!claimed){const receipt=await store.get('receipts/'+key,{type:'json',consistency:'strong'});return noStoreJson(receipt||{accepted:false,outcome:'pending_or_unknown',message:'This request was already sent or is pending. Refresh the queue; do not create a new request.'},receipt?200:409);}
  // The source copy is kept for reader recovery; it is not a send guard (the database 'sending' state below is).
  if(upload){const primary=upload.find(r=>r.role==='product');await store.set('sources/'+input.draftId,primary.bytes,{onlyIfNew:true,metadata:{type:primary.type,clientId:body.clientRunId}});const form=new FormData();form.set('payload',JSON.stringify(body));for(const ref of upload)form.append('files',new Blob([ref.bytes],{type:ref.type}),ref.name);body=form;}

  // The one send that moves the version to 'sending' calls A7; an overlapping send of the same version stops here.
  if(upload){const busy=await takeSend(budgetPool(),{ownerId:owner.id,draftId:input.draftId,clientRunId:sharedRunIdentity(input.draftId).clientRunId,store,submitClaim});if(busy)return noStoreJson(busy,409);}
  reached=true;
  const result=await upstream('owner-'+operation,{method:'POST',headers:upload?{}:{'Content-Type':'application/json'},body:upload?body:JSON.stringify(body)});
  const accepted=result.accepted===true&&(operation==='submit'||result.forwarded===true);
  // Why a send was not taken: log the bridge's codes (never the job or a secret), so it can be traced.
  if(!accepted)console.error('owner-actions',operation,'not accepted',JSON.stringify({receiptKind:result.receiptKind??null,upstreamStatus:result.upstreamStatus??null,error:result.error??null}));
  if(decisionClaim&&!accepted){await releaseClaim(store,decisionClaim);return noStoreJson({accepted:false,forwarded:false,runId:null,clientId:result.clientId||null,outcome:'not_accepted',retryable:true,message:DECISION_UNCONFIRMED},502);}
  // A7 refused the job at its intake: the version becomes a draft again and the claim is released, so the owner can fix and
  // resend, instead of a version marked sent with an unknown outcome that no check could settle.
  const refused=upload?a7SendRefusal(result):null;
  if(refused){await reopenRefusedDraft(budgetPool(),owner.id,input.draftId);await releaseClaim(store,key);return noStoreJson(refused,422);}
  const receipt={accepted,forwarded:result.forwarded===true,runId:result.runId||null,clientId:operation==='submit'?sharedRunIdentity(input.draftId).clientRunId:result.clientId,outcome:result.outcome==='received'?'received':'outcome_unknown',message:accepted?'A7 received your request. Refresh the queue for the recorded result.':'Receipt is uncertain. Check the queue before taking another action.'};
  if(upload)await recordDraftReceipt(budgetPool(),owner.id,input.draftId,accepted?'received':'outcome_unknown',receipt.runId);
  await store.setJSON('receipts/'+key,receipt,{onlyIfNew:true});return noStoreJson(receipt,receipt.accepted?200:502);
 }catch(error){
  // Logged without the job or any secret, so a failed send can be traced (it used to leave no line at all).
  console.error('owner-actions',operation,'failed',reached?'after the request left this site':'before anything was sent',String(error?.message||error).slice(0,120));
  if(decisionClaim){await releaseClaim(store,decisionClaim);return noStoreJson({error:'outcome_unknown',retryable:true,message:DECISION_UNCONFIRMED},502);}
  // Nothing reached A7: the saved version becomes a draft again and the claim is released, so the owner can simply send again.
  if(upload&&!reached&&input?.draftId){
   const {status,body:answer}=await settleUnsentFailure(budgetPool,{ownerId:owner.id,draftId:input.draftId,clientRunId:sharedRunIdentity(input.draftId).clientRunId,store,submitClaim,confirmedHere});
   return noStoreJson(answer,status);
  }
  return noStoreJson({error:error.message==='request_conflict'?'request_conflict':'outcome_unknown',message:'The action was not confirmed. Check the queue before retrying.'},error.message==='request_conflict'?409:502);}
}
export const config={path:['/api/owner/submissions','/api/owner/jobs/:id/approval'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:12}};
