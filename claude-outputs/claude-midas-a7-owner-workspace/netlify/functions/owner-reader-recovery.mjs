import {getStore} from '@netlify/blobs';
import authenticate from './owner-me.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {REPLACEMENT,replacementState,prepareReplacement,preparePreservedContinuation} from '../../lib/a7-reader-replacement.mjs';
import {transaction} from '../../lib/a7-budget.mjs';
import {readBudget} from '../../lib/a7-budget.mjs';
import {readerRecoveryEligibility,prepareReaderRecovery,resumePendingReaderRecovery} from '../../lib/a7-reader-recovery.mjs';
import {digest,sameOrigin} from '../../lib/a7-actions.mjs';
import {validId} from '../../lib/a7-contract.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {recoveryUpload,recoveryReceipt,transportFailure} from '../../lib/a7-recovery-transport.mjs';
import {siteOrigin} from '../../lib/a7-site-origin.mjs';
import {a7Webhook} from '../../lib/a7-engine-base.mjs';
const upstream=()=>a7Webhook('a7/'); // read per call, never once at load
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;const owner=await auth.json();
 const id=context.params?.id;if(!validId(id))return noStoreJson({error:'invalid_run'},400);
 if(!['GET','POST'].includes(request.method))return noStoreJson({error:'method_not_allowed'},405);
 if(request.method==='POST'&&(!sameOrigin(request)||context.deploy?.context!=='production'))return noStoreJson({error:'origin_rejected'},403);
 let phase='context';
 try{
  const authorization=Netlify.env.get('A7_READ_AUTHORIZATION');if(!authorization)throw Error('not_configured');
  const r=await fetch(upstream()+'owner-context?id='+encodeURIComponent(id),{headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('context_unavailable');
  const c=await r.json();if(c.runId!==id||!/^owner-[a-f0-9-]{36}$/.test(c.clientId||'')||!/^[a-f0-9]{64}$/.test(c.revision||''))throw Error('context_unavailable');
  const ledger=await readBudget(budgetPool(),owner.id,c.clientId),ready=Netlify.env.get('A7_PAID_BUDGET_GUARDS_READY')==='true';
  const {rows:claims}=await budgetPool().query("SELECT detail->>'started' AS started,detail->>'redispatched' AS redispatched,detail->>'bufferedRepairDispatched' AS buffered,detail->>'routeRepairDispatched' AS repaired FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_requested'",[c.clientId]);
  const {rows:starts}=await budgetPool().query("SELECT event_id FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_started'",[c.clientId]);
  const checkpointReady=ready&&readerRecoveryEligibility(ledger,c.status);
  const resumable=checkpointReady&&!starts.length&&claims.length===1&&claims[0].started==='false'&&claims[0].repaired!=='true';
  const eligible=checkpointReady&&!claims.length&&!starts.length;
  let connection;
  if(checkpointReady&&!starts.length&&claims.length===1&&claims[0].started==='false'){
   const original=await getStore({name:'a7-owner-production',consistency:'strong'}).getWithMetadata('sources/'+c.clientId.slice(6),{type:'arrayBuffer'});
   if(!original?.data||original.metadata?.clientId!==c.clientId)throw Error('source_unavailable');
   const probe=recoveryUpload(Buffer.from(original.data),original.metadata.type,c.clientId,{},true);
   try{connection=await recoveryReceipt(await fetch(upstream()+'owner-submit',{method:'POST',headers:{Authorization:authorization,...probe.headers},body:probe.body,redirect:'error',signal:AbortSignal.timeout(12000)}),true);}catch(error){connection=transportFailure(error);}
  }
  const replacement=ready?await replacementState(budgetPool(),ledger,c.status):null;
  if(request.method==='GET')return noStoreJson({replacement,eligible,resumable:resumable&&connection?.accepted===true,connection,recoveryRequested:claims.length>0,recoveryStarted:starts.length>0||claims.some(x=>x.started==='true'),claimSummary:{requests:claims.length,starts:starts.length,bufferedDeliveryUsed:claims.some(x=>x.buffered==='true'),routeRepairDeliveryUsed:claims.some(x=>x.repaired==='true')},revision:c.revision,clientId:c.clientId,availableMicroUsd:Math.max(0,Number(ledger.budget.limit_micro_usd)-Number(ledger.budget.committed_micro_usd))});
  const text=await request.text();if(text.length>2000)throw Error('invalid_recovery');const input=JSON.parse(text);if(input.revision!==c.revision)throw Error('stale_recovery');
  const replacing=input.replacementId===REPLACEMENT.id,replaying=replacing&&input.resumePreserved===true;
  if(Netlify.env.get('A7_OWNER_ACTIONS_ENABLED')!=='true'||(replacing?!(replaying?replacement?.continuationEligible:replacement?.eligible):(!eligible&&(!resumable||connection?.accepted!==true))))return noStoreJson({error:'recovery_not_available'},409);
  phase='source';const sourceStore=getStore({name:'a7-owner-production',consistency:'strong'}),source=await sourceStore.getWithMetadata('sources/'+c.clientId.slice(6),{type:'arrayBuffer'});
  if(!source?.data||source.metadata?.clientId!==c.clientId)throw Error('source_unavailable');const bytes=Buffer.from(source.data);
  if(!bytes.length||bytes.length>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(source.metadata.type))throw Error('source_unavailable');
  phase='claim';const recovery=replacing?await transaction(budgetPool(),db=>(replaying?preparePreservedContinuation:prepareReplacement)(db,owner.id,ledger,c.status,{...input,sourceSha256:digest(bytes)})):await (resumable?resumePendingReaderRecovery:prepareReaderRecovery)(budgetPool(),owner.id,c.clientId,id,c.status,{...input,sourceSha256:digest(bytes),routeRepair:resumable});
  const upload=recoveryUpload(bytes,source.metadata.type,c.clientId,recovery,false,siteOrigin());
  phase='dispatch';let receipt;
  try{receipt=await recoveryReceipt(await fetch(upstream()+'owner-submit',{method:'POST',headers:{Authorization:authorization,...upload.headers},body:upload.body,redirect:'error',signal:AbortSignal.timeout(32000)}));}catch(error){receipt=transportFailure(error);}
  if(!receipt.accepted)return noStoreJson({error:'outcome_unknown',...receipt,message:'Recovery dispatch was not confirmed ('+(receipt.upstreamStatus||receipt.transportCode||'unknown')+' / '+receipt.receiptKind+(receipt.error?' / '+receipt.error:'')+'). Check the same job; do not resend.'},502);
  return noStoreJson({accepted:true,clientId:c.clientId,runId:id,message:replaying?'Saved replacement answer received for continuation. No reader call is repeated. Go 1 and Go 2 await your decisions.':replacing?'Replacement attempt received. Counter reused; reader capped at USD 0.25; old charges held. Go 1 and Go 2 await your decisions.':'Recovery received for this same job. Completed counter evidence is reused; the uncertain charge remains reserved.'});
 }catch(error){const known=['replacement_not_available','replacement_already_requested','not_found','invalid_recovery','recovery_not_available','recovery_already_requested','stale_recovery','source_unavailable'];const reason=known.includes(error.message)?error.message:'recovery_unavailable';return noStoreJson({error:reason,phase,message:'Recovery was not confirmed at '+phase+' ('+reason+'). Check the same job before taking another action.'},error.message==='not_found'?404:409);}
}
export const config={path:'/api/owner/jobs/:id/reader-recovery',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:12}};
