import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRunRequest,estimateCost,summarizeEye,armRecord,modelTestWebhook} from '../lib/model-tests.mjs';
import {createModelTestsHandler} from '../netlify/functions/owner-model-tests.mjs';
import {createModelTestsBackground} from '../netlify/functions/owner-model-tests-background.mjs';

const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(64)]);
const RUN_ID='3f2b8c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f';

function memoryStore(){
 const data=new Map();
 return {data,
  async get(key,{type}={}){if(!data.has(key))return null;const v=data.get(key).value;return type==='json'?JSON.parse(v):v;},
  async getWithMetadata(key){if(!data.has(key))return null;const e=data.get(key);return {data:e.value,metadata:e.metadata};},
  async set(key,value,{metadata,onlyIfNew}={}){if(onlyIfNew&&data.has(key))return {modified:false};data.set(key,{value,metadata});return {modified:true};},
  async setJSON(key,value,options={}){return this.set(key,JSON.stringify(value),options);},
  async list({prefix}){return {blobs:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
 };
}
const owner=async()=>Response.json({id:'owner-1'});
const env=values=>name=>values[name];
const ENABLED={A7_PAID_BUDGET_GUARDS_READY:'true',A7_READ_AUTHORIZATION:'Bearer test'};
const production={deploy:{context:'production'},params:{}};
const post=(form,origin='https://site.example')=>new Request('https://site.example/api/owner/model-tests',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin'},body:form});
const midasFetch=async()=>new Response(PNG,{headers:{'content-type':'image/png'}});

test('a run request accepts only the Eye stage and known setups, and takes the known count for a Midas photo',()=>{
 assert.deepEqual(validateRunRequest({stage:'eye',arms:'E,B',midas:'160689',note:' x '}),{stage:'eye',arms:['B','E'],midas:'160689',expected:6,note:'x'});
 assert.throws(()=>validateRunRequest({stage:'generation',arms:'B'}),/stage_not_connected/);
 assert.throws(()=>validateRunRequest({stage:'eye',arms:'B,Z'}),/invalid_arms/);
 assert.throws(()=>validateRunRequest({stage:'eye',arms:'B,B'}),/invalid_arms/);
 assert.throws(()=>validateRunRequest({stage:'eye',arms:'B',midas:'999'}),/invalid_photo/);
 assert.throws(()=>validateRunRequest({stage:'eye',arms:'B',expected:'2.5'}),/invalid_expected/);
});

test('cost counts Gemini thinking as output, never doubles OpenAI reasoning, and is unknown without a recorded price',()=>{
 assert.equal(estimateCost('gemini-3.8-flash',{input:1e6,output:1e6,thinking:1e6}),.75+3.75*2);
 assert.equal(estimateCost('gpt-6.1-sol',{input:1e6,output:1e6,thinking:5e5}),12);
 assert.equal(estimateCost('claude-opus-5-5',{input:3194,output:1991}),null);
});

test('the Eye summary counts product pieces only and marks the count right or wrong',()=>{
 const s=summarizeEye({category:'bedroom set',pieces:[{label:'bed',kind:'bed',role:'product'},{label:'left',kind:'nightstand',role:'product'},{label:'right',kind:'nightstand',role:'product'},{label:'lamp',kind:'lamp',role:'context'}],unclear_membership:['stool']},3);
 assert.equal(s.productCount,3);assert.equal(s.correct,true);
 assert.deepEqual(s.kinds,[{kind:'bed',count:1},{kind:'nightstand',count:2}]);
 assert.deepEqual(s.context,['lamp']);assert.deepEqual(s.unclear,['stool']);
 assert.equal(summarizeEye({pieces:'x'}),null);
});

test('a 524 from n8n Cloud is recorded as a gateway timeout, not as a model failure',()=>{
 assert.equal(armRecord('A',{status:524,ms:100500},6).error,'gateway_timeout');
 assert.equal(armRecord('B',{error:'timeout',ms:110000},6).error,'no_answer_in_time');
 const done=armRecord('B',{status:200,body:{ok:true,ms:16700,tokens:{input:1000,output:500,thinking:200},result:{category:'set',pieces:[{label:'bed',role:'product'}]}}},1);
 assert.equal(done.status,'done');assert.equal(done.summary.correct,true);assert.equal(done.costUsd,.007);
});

test('starting a run stores the photo, counts it for today and starts the background reader once',async()=>{
 const store=memoryStore(),dispatched=[];
 const handler=createModelTestsHandler({authenticate:owner,store:()=>store,env:env(ENABLED),fetch:midasFetch,dispatch:async(_,id)=>dispatched.push(id),now:()=>new Date('2026-10-19T10:00:00Z'),uuid:()=>RUN_ID});
 const form=new FormData();form.set('stage','eye');form.set('arms','B,C,D,E');form.set('midas','160689');
 const response=await handler(post(form),production);
 assert.equal(response.status,202);
 const {run}=await response.json();
 assert.equal(run.expected,6);assert.equal(run.status,'queued');assert.deepEqual(dispatched,[RUN_ID]);
 assert.ok(store.data.has(`owner-1/photos/${RUN_ID}`));assert.ok(store.data.has(`owner-1/daily/2026-10-19/${RUN_ID}`));
 const listed=await (await handler(new Request('https://site.example/api/owner/model-tests'),production)).json();
 assert.equal(listed.runs.length,1);assert.deepEqual(listed.today,{used:1,limit:20});
});

test('a run is refused outside production, without the budget guard, from another origin, and past the daily limit',async()=>{
 const store=memoryStore();
 const make=values=>createModelTestsHandler({authenticate:owner,store:()=>store,env:env(values),fetch:midasFetch,dispatch:async()=>{},now:()=>new Date('2026-10-19T10:00:00Z'),uuid:()=>crypto.randomUUID()});
 const form=()=>{const f=new FormData();f.set('stage','eye');f.set('arms','B');f.set('midas','160689');return f;};
 assert.equal((await make(ENABLED)(post(form()),{deploy:{context:'deploy-preview'},params:{}})).status,403);
 assert.equal((await make(ENABLED)(post(form(),'https://evil.example'),production)).status,403);
 assert.equal((await make({A7_READ_AUTHORIZATION:'x'})(post(form()),production)).status,503);
 for(let i=0;i<20;i++)await store.setJSON(`owner-1/daily/2026-10-19/run-${i}`,{});
 const limited=await make(ENABLED)(post(form()),production);
 assert.equal(limited.status,429);assert.equal((await limited.json()).error,'daily_limit_reached');
});

test('an uploaded file that is not the image it claims to be is refused before any call',async()=>{
 const store=memoryStore();
 const handler=createModelTestsHandler({authenticate:owner,store:()=>store,env:env(ENABLED),fetch:midasFetch,dispatch:async()=>{throw Error('must not dispatch');},now:()=>new Date(),uuid:()=>RUN_ID});
 const form=new FormData();form.set('stage','eye');form.set('arms','E');form.set('photo',new File([Buffer.from('not an image at all')],'x.jpg',{type:'image/jpeg'}));
 const response=await handler(post(form),production);
 assert.equal(response.status,400);assert.equal((await response.json()).error,'photo_type');
 assert.equal(store.data.size,0);
});

test('the background reader calls each setup once, stores every answer and never runs a run twice',async()=>{
 const store=memoryStore(),calls=[];
 await store.setJSON(`owner-1/runs/${RUN_ID}`,{id:RUN_ID,stage:'eye',arms:['A','E'],status:'queued',expected:1,createdAt:'2026-10-19T10:00:00Z'});
 await store.set(`owner-1/photos/${RUN_ID}`,PNG,{metadata:{mime:'image/png'}});
 const fetchImpl=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,arm:body.arm,auth:init.headers.Authorization,mime:body.image.mime});
  if(body.arm==='A')return new Response('gateway',{status:524});
  return Response.json({ok:true,ms:22000,tokens:{input:3194,output:1991},result:{category:'set',pieces:[{label:'bed',role:'product'}]}});
 };
 const background=createModelTestsBackground({authenticate:owner,store:()=>store,env:env(ENABLED),fetch:fetchImpl,now:()=>new Date('2026-10-19T10:01:00Z')});
 const request=()=>new Request('https://site.example/.netlify/functions/owner-model-tests-background',{method:'POST',body:JSON.stringify({runId:RUN_ID})});
 await background(request(),production);
 await background(request(),production);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.url===modelTestWebhook()&&c.auth==='Bearer test'&&c.mime==='image/png'));
 assert.equal((await store.get(`owner-1/arms/${RUN_ID}/A`,{type:'json'})).error,'gateway_timeout');
 const e=await store.get(`owner-1/arms/${RUN_ID}/E`,{type:'json'});
 assert.equal(e.status,'done');assert.equal(e.summary.correct,true);assert.equal(e.costUsd,null);
 assert.equal((await store.get(`owner-1/runs/${RUN_ID}`,{type:'json'})).status,'done');
});
