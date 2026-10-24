import authenticate from './owner-me.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {listProjects,saveDraft,reviseDraft,projectRefusal} from '../../lib/a7-projects.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {sameOrigin} from '../../lib/a7-actions.mjs';
import {checkDispatch} from '../../lib/a7-dispatch-check.mjs';
import {a7Webhook} from '../../lib/a7-engine-base.mjs';
const upstream=()=>a7Webhook('a7/'); // read per call, never once at load
// A7's own record of a run: 'found' (one or more rows), 'not_found', or 'unknown' for anything else.
async function a7RunRecord(runId){
 const authorization=Netlify.env.get('A7_READ_AUTHORIZATION');if(!authorization)return 'unknown';
 try{const r=await fetch(upstream()+'owner-context?id='+encodeURIComponent(runId),{headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(18000)});
  if(r.status===200||r.status===409)return 'found';
  if(r.status===404){const b=await r.json().catch(()=>null);return b?.error==='not_found'?'not_found':'unknown';}
  return 'unknown';
 }catch{return 'unknown';}
}
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;const owner=await auth.json();
 try{
 if(request.method==='GET'&&!context.params?.id)return noStoreJson(await listProjects(budgetPool(),owner.id));
 if(request.method!=='POST'&&request.method!=='PATCH')return noStoreJson({error:'method_not_allowed'},405);
 if(!sameOrigin(request)||context.deploy?.context!=='production')return noStoreJson({error:'origin_rejected'},403);
 const raw=await request.text();if(raw.length>14000)return noStoreJson({error:'invalid_project'},400);
 // A source reading is bound to the photos it read, not to the direction, so a changed direction never discards it
 // (lib/a7-understanding-service.mjs current()): the save needs no guard against a running or finished reading.
 if(request.method==='PATCH'&&context.params?.id)return noStoreJson(await reviseDraft(budgetPool(),owner.id,context.params.id,JSON.parse(raw)));
 if(request.method==='POST'&&!context.params?.id)return noStoreJson(await saveDraft(budgetPool(),owner.id,JSON.parse(raw)));
 // Edit phase 2.5: settle a send whose receipt was never recorded (lib/a7-dispatch-check.mjs).
 if(request.method==='POST'&&context.params?.id&&JSON.parse(raw)?.action==='dispatch_check')return noStoreJson(await checkDispatch(budgetPool(),owner.id,context.params.id,a7RunRecord));
 return noStoreJson({error:'method_not_allowed'},405);
 }catch(error){const {status,body}=projectRefusal(error.message,error.detail);return noStoreJson(body,status);}
}
export const config={path:['/api/owner/projects','/api/owner/projects/:id'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
