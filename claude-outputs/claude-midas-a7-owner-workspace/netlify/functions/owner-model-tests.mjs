import {getStore} from '@netlify/blobs';
import authenticate from './owner-me.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {sameOrigin,validateImage,digest} from '../../lib/a7-actions.mjs';
import {STAGES,ARMS,MIDAS_PHOTOS,DAILY_RUN_LIMIT,validateRunRequest,runId} from '../../lib/model-tests.mjs';

// Owner API for "Testing models per stage".
//   GET  /api/owner/model-tests            stages, setups, test photos, recent runs and today's count
//   GET  /api/owner/model-tests/:id        one run with each setup's answer so far
//   GET  /api/owner/model-tests/:id/photo  the photo that run read
//   POST /api/owner/model-tests            multipart: stage, arms (A,B,…), midas or photo, expected, note
// A POST stores the photo and starts owner-model-tests-background, which makes the paid model calls.
export const modelTestStore = () => getStore({name:'a7-model-tests',consistency:'strong'});
export const today = (now=new Date()) => now.toISOString().slice(0,10);

export function createModelTestsHandler(deps){
 return async function handler(request,context){
  const auth=await deps.authenticate(new Request(request.url,{method:'GET',headers:request.headers}),context);
  if(!auth.ok)return auth;
  const owner=(await auth.json()).id,store=deps.store(),id=context.params?.id;
  try{
   if(request.method==='GET'){
    if(!id)return noStoreJson(await overview(store,owner,deps));
    if(!runId(id))return noStoreJson({error:'not_found'},404);
    if(new URL(request.url).pathname.endsWith('/photo'))return await photo(store,owner,id);
    const run=await store.get(`${owner}/runs/${id}`,{type:'json'});
    if(!run)return noStoreJson({error:'not_found'},404);
    return noStoreJson({run:await withArms(store,owner,run)});
   }
   if(request.method!=='POST'||id)return noStoreJson({error:'method_not_allowed'},405);
   if(!sameOrigin(request)||context.deploy?.context!=='production')return noStoreJson({error:'origin_rejected'},403);
   if(deps.env('A7_PAID_BUDGET_GUARDS_READY')!=='true'||!deps.env('A7_READ_AUTHORIZATION'))return noStoreJson({error:'model_tests_not_enabled'},503);
   if(Number(request.headers.get('content-length')||0)>3.6*1024*1024)throw Error('photo_too_large');
   const form=await request.formData();
   const input=validateRunRequest(Object.fromEntries(['stage','arms','midas','expected','note'].map(k=>[k,typeof form.get(k)==='string'?form.get(k):undefined])));
   const day=today(deps.now()),used=(await store.list({prefix:`${owner}/daily/${day}/`})).blobs.length;
   if(used>=DAILY_RUN_LIMIT)return noStoreJson({error:'daily_limit_reached',limit:DAILY_RUN_LIMIT},429);
   const image=input.midas?await midasPhoto(deps.fetch,input.midas):await uploadedPhoto(form.get('photo'));
   const run={id:deps.uuid(),stage:input.stage,arms:input.arms,status:'queued',createdAt:deps.now().toISOString(),expected:input.expected,note:input.note,
    photo:{source:input.midas?'midas':'upload',midas:input.midas,name:input.midas?MIDAS_PHOTOS[input.midas].name:image.name,mime:image.mime,bytes:image.data.length,sha256:digest(image.data)}};
   await store.set(`${owner}/photos/${run.id}`,image.data,{metadata:{mime:image.mime}});
   await store.setJSON(`${owner}/runs/${run.id}`,run);
   await store.setJSON(`${owner}/daily/${day}/${run.id}`,{at:run.createdAt});
   try{await deps.dispatch(request,run.id);}
   catch(error){
    console.error('model-tests dispatch',run.id,error?.message);
    const failed={...run,status:'failed',error:'not_started'};await store.setJSON(`${owner}/runs/${run.id}`,failed);
    return noStoreJson({run:failed},502);
   }
   return noStoreJson({run},202);
  }catch(error){
   const code=error?.message;
   if(['invalid_stage','stage_not_connected','invalid_arms','invalid_photo','invalid_expected','invalid_note','photo_missing','photo_too_large','image_size','image_type','midas_photo_unavailable'].includes(code))return noStoreJson({error:code==='image_size'?'photo_too_large':code==='image_type'?'photo_type':code},400);
   if(error instanceof TypeError&&/form/i.test(code||''))return noStoreJson({error:'invalid_request'},400);
   console.error('model-tests',code);
   return noStoreJson({error:'model_tests_unavailable'},503);
  }
 };
}

async function overview(store,owner,deps){
 const {blobs}=await store.list({prefix:`${owner}/runs/`});
 const runs=(await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})))).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,25);
 const used=(await store.list({prefix:`${owner}/daily/${today(deps.now())}/`})).blobs.length;
 return {
  stages:STAGES,
  arms:Object.entries(ARMS).map(([id,a])=>({id,...a})),
  photos:Object.entries(MIDAS_PHOTOS).map(([id,p])=>({id,name:p.name,expected:p.expected,truth:p.truth})),
  runs:await Promise.all(runs.map(r=>withArms(store,owner,r))),
  today:{used,limit:DAILY_RUN_LIMIT},
  enabled:deps.env('A7_PAID_BUDGET_GUARDS_READY')==='true'&&!!deps.env('A7_READ_AUTHORIZATION')
 };
}
async function withArms(store,owner,run){
 const answers=await Promise.all(run.arms.map(arm=>store.get(`${owner}/arms/${run.id}/${arm}`,{type:'json'})));
 return {...run,answers:Object.fromEntries(run.arms.map((arm,i)=>[arm,answers[i]||null]))};
}
async function photo(store,owner,id){
 const found=await store.getWithMetadata(`${owner}/photos/${id}`,{type:'arrayBuffer'});
 if(!found)return noStoreJson({error:'not_found'},404);
 return new Response(found.data,{headers:{'Content-Type':found.metadata?.mime||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
async function uploadedPhoto(file){
 if(!file||typeof file==='string')throw Error('photo_missing');
 const data=Buffer.from(await file.arrayBuffer());
 validateImage(data,file.type);
 return {data,mime:file.type,name:String(file.name||'photo').slice(0,80)};
}
// Only the fixed Midas test photos are fetched, by the URL held on the server.
async function midasPhoto(fetchImpl,id){
 let response;
 try{response=await fetchImpl(MIDAS_PHOTOS[id].url,{redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('midas_photo_unavailable');}
 if(!response.ok)throw Error('midas_photo_unavailable');
 const mime=(response.headers.get('content-type')||'').split(';')[0].trim(),data=Buffer.from(await response.arrayBuffer());
 validateImage(data,mime);
 return {data,mime,name:MIDAS_PHOTOS[id].name};
}
// The background function authenticates the same owner session, so only the cookie is forwarded.
export async function dispatchModelTest(request,id){
 const target=new URL('/.netlify/functions/owner-model-tests-background',request.url);
 const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Cookie:request.headers.get('cookie')||''},body:JSON.stringify({runId:id}),redirect:'error',signal:AbortSignal.timeout(8000)});
 if(response.status!==202)throw Error('dispatch_rejected_'+response.status);
}
export default createModelTestsHandler({authenticate,store:modelTestStore,env:name=>Netlify.env.get(name),fetch:(...a)=>fetch(...a),dispatch:dispatchModelTest,now:()=>new Date(),uuid:()=>crypto.randomUUID()});
export const config={path:['/api/owner/model-tests','/api/owner/model-tests/:id','/api/owner/model-tests/:id/photo'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:60}};
