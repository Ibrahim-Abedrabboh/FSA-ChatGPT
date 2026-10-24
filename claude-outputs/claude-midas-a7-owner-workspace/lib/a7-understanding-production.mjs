import {getStore} from '@netlify/blobs';
import {budgetPool} from './a7-database.mjs';
import {draftReferences} from './a7-projects.mjs';
import {sourceUnderstandingService} from './a7-understanding-service.mjs';
import {quoteSourceAnalysis} from './a7-analysis-quote.mjs';
import {openBudget} from './a7-budget.mjs';
import {verifiedAnalysisAnswers} from './a7-analysis-ledger.mjs';
import {observationFromVerifiedAnswers} from './a7-analysis-observation.mjs';
import {digest} from './a7-actions.mjs';
import {siteOrigin} from './a7-site-origin.mjs';
import {a7Webhook} from './a7-engine-base.mjs';

function productionReader(blob){
 if(Netlify.env.get('A7_ANALYSIS_READY')!=='true'||Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')!=='true')return null;
 const complete=async(owner,source,intent,reported)=>{
   const answers=await verifiedAnalysisAnswers(budgetPool(),owner,source,reported);
   return {receiptId:reported.receiptId,draftId:source.draftId,sourceSha256:source.sourceSha256,roomSha256:source.roomSha256,intentFingerprint:intent.fingerprint,readers:reported.readers,...observationFromVerifiedAnswers(source,answers)};
 };
 return {
  quote:async({source})=>quoteSourceAnalysis(source),
  recover:async({owner,source,intent})=>{
   const required=['03 Eye reads the product photo','05 Second count',...(source.roomSha256?['06 Room reader']:[]),'09 Conflict check'];
   const {rows}=await budgetPool().query('SELECT node_name,operation_key,status,receipt_ref FROM a7_paid_operations WHERE client_run_id=$1 AND run_id=$2 AND node_name = ANY($3)',[source.clientRunId,source.runId,required]);
   if(rows.length!==required.length||rows.some(r=>r.status!=='completed'||!r.receipt_ref))return null;
   const reported={receiptId:intent.requestId,clientRunId:source.clientRunId,runId:source.runId,sourceSha256:source.sourceSha256,referenceFingerprint:source.referenceFingerprint,readers:rows.map(r=>({node:r.node_name,status:r.status,operationKey:r.operation_key,receiptRef:r.receipt_ref}))};
   return complete(owner,source,intent,reported);
  },
  run:async({owner,source,intent,quote,timeoutMs=25000})=>{
   const auth=Netlify.env.get('A7_READ_AUTHORIZATION');if(!auth)throw Error('analysis_not_connected');
   await openBudget(budgetPool(),{clientId:source.clientRunId,ownerId:owner,limitUsd:source.budgetLimitUsd});
   const refs=await draftReferences(budgetPool(),owner,source.draftId),form=new FormData();
   const payload={purpose:'source_analysis_only',draftId:source.draftId,clientRunId:source.clientRunId,runId:source.runId,requestId:intent.requestId,sourceSha256:source.sourceSha256,roomSha256:source.roomSha256,referenceFingerprint:source.referenceFingerprint,quoteFingerprint:quote.fingerprint,intentFingerprint:intent.fingerprint,maxCostUsd:quote.maxCostUsd,budgetLimitUsd:source.budgetLimitUsd,instructions:source.instructions};
   const origin=siteOrigin();if(origin)payload.budgetOrigin=origin;
   form.set('payload',JSON.stringify(payload));
   for(const ref of refs){
    const bytes=await blob.get(ref.blob_key,{type:'arrayBuffer'});if(!bytes||digest(Buffer.from(bytes))!==ref.sha256)throw Error('reference_unavailable');
    form.append('files',new Blob([bytes],{type:ref.mime}),ref.role+'-'+ref.reference_id);
   }
   // Each failure carries a short, non-secret reason so the owner can see why a reading stopped.
   // A gateway timeout (524 from Cloudflare in front of n8n Cloud after about 100 s, or 504) ends only
   // this request: A7 keeps reading and records each read in the ledger, so it is pending, not stopped.
   const stopped=(error,upstreamStatus=null)=>Object.assign(Error('analysis_outcome_uncertain'),{detail:{upstreamStatus,error,pending:upstreamStatus===524||upstreamStatus===504}});
   let response;
   try{response=await fetch(a7Webhook('a7/owner-analyze'),{method:'POST',headers:{Authorization:auth},body:form,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}
   catch(error){throw stopped(error?.name==='TimeoutError'?'a7_no_answer_in_time':'a7_unreachable');}
   const raw=await response.text();
   let reported=null;try{reported=JSON.parse(raw);}catch{}
   const code=typeof reported?.error==='string'&&/^[a-z_]{1,80}$/.test(reported.error)?reported.error:null;
   if(!response.ok)throw stopped(code||'a7_http_error',response.status);
   if(raw.length>180000||!reported)throw stopped('a7_unreadable_answer',response.status);
   if(reported.accepted!==true)throw stopped(code||'a7_not_accepted',response.status);
   if(reported.intentFingerprint!==intent.fingerprint)throw stopped('a7_answer_for_other_request',response.status);
   return complete(owner,source,intent,reported);
  }
 };
}

export function productionSourceUnderstandingService(){
 const blob=getStore({name:'a7-owner-production',consistency:'strong'});
 return sourceUnderstandingService({
  references:(owner,draft)=>draftReferences(budgetPool(),owner,draft),
  draftRecord:async(owner,draft)=>{const {rows:[row]}=await budgetPool().query('SELECT brief,parent_id,note,direction FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[draft,owner]);if(!row)throw Error('not_found');return row;},
  store:{get:key=>blob.get(key,{type:'json',consistency:'strong'}),set:async(key,value,options)=>Boolean((await blob.setJSON(key,value,options)).modified)},
  reader:productionReader(blob) // Disabled until the analysis workflow and receipt route are deployed and explicitly enabled.
 });
}
