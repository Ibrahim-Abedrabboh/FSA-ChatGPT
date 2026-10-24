import authenticate from './owner-me.mjs';
import {modelTestStore} from './owner-model-tests.mjs';
import {modelTestWebhook,ARM_TIMEOUT_MS,armRecord,runId} from '../../lib/model-tests.mjs';

// A Netlify background function: the caller gets 202 at once and this runs for up to 15 minutes.
// It runs only a run the owner already created through /api/owner/model-tests, and a one-time dispatch
// marker is taken before any paid call, so a repeated start never pays twice. Setups run in parallel;
// each answer is stored as soon as it arrives so the page can show it.
export function createModelTestsBackground(deps){
 return async function handler(request,context){
  if(request.method!=='POST'||context.deploy?.context!=='production')return;
  const auth=await deps.authenticate(new Request(request.url,{method:'GET',headers:request.headers}),context);
  if(!auth.ok)return;
  const owner=(await auth.json()).id,store=deps.store();
  let id;try{id=JSON.parse(await request.text())?.runId;}catch{return;}
  if(!runId(id))return;
  const authorization=deps.env('A7_READ_AUTHORIZATION');
  const run=await store.get(`${owner}/runs/${id}`,{type:'json'});
  if(!run||run.status!=='queued'||!authorization)return;
  if(!(await store.setJSON(`${owner}/dispatch/${id}`,{at:deps.now().toISOString()},{onlyIfNew:true})).modified)return;
  const found=await store.getWithMetadata(`${owner}/photos/${id}`,{type:'arrayBuffer'});
  if(!found){await store.setJSON(`${owner}/runs/${id}`,{...run,status:'failed',error:'photo_missing'});return;}
  const image={mime:found.metadata?.mime,base64:Buffer.from(found.data).toString('base64')};
  const startedAt=deps.now().toISOString();
  await store.setJSON(`${owner}/runs/${id}`,{...run,status:'running',startedAt});
  await Promise.all(run.arms.map(async arm=>{
   const answer=await callArm(deps.fetch,authorization,{stage:run.stage,arm,image},{env:deps.env});
   await store.setJSON(`${owner}/arms/${id}/${arm}`,armRecord(arm,answer,run.expected));
  }));
  await store.setJSON(`${owner}/runs/${id}`,{...run,status:'done',startedAt,finishedAt:deps.now().toISOString()});
 };
}

export async function callArm(fetchImpl,authorization,body,{timeoutMs=ARM_TIMEOUT_MS,env}={}){
 const started=Date.now();
 try{
  const response=await fetchImpl(modelTestWebhook(env ? {get:env} : undefined),{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  let parsed=null;try{parsed=await response.json();}catch{}
  return {status:response.status,body:parsed,ms:Date.now()-started};
 }catch(error){
  return {error:error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'unreachable',ms:Date.now()-started};
 }
}

export default createModelTestsBackground({authenticate,store:modelTestStore,env:name=>Netlify.env.get(name),fetch:(...a)=>fetch(...a),now:()=>new Date()});
export const config={background:true};
