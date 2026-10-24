import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sourceUnderstandingService} from '../lib/a7-understanding-service.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {createSourceUnderstandingHandler} from '../netlify/functions/owner-source-understanding.mjs';
import {createSourceAnalysisBackground} from '../netlify/functions/owner-source-analysis-background.mjs';

const owner=randomUUID(),product='a'.repeat(64);
const READERS=['03 Eye reads the product photo','05 Second count','09 Conflict check'];
function harness({fail=false}={}){
 const draft=randomUUID(),values=new Map(),ref={reference_id:randomUUID(),role:'product',sha256:product},runs=[];
 const store={get:async k=>values.get(k)||null,set:async(k,v,{onlyIfNew}={})=>{if(onlyIfNew&&values.has(k))return false;values.set(k,v);return true;}};
 const reader={quote:async({source})=>quoteSourceAnalysis(source),
  run:async({source,intent,timeoutMs})=>{runs.push(timeoutMs);if(fail)throw Error('lost_ack');return {receiptId:randomUUID(),draftId:draft,sourceSha256:source.sourceSha256,roomSha256:null,intentFingerprint:intent.fingerprint,readers:READERS.map(node=>({node,status:'completed',operationKey:'ledger-'+node,receiptRef:'receipt-'+node})),observation:{category:'Sofa',eyeCount:1,secondCount:1,pieces:[{label:'sofa',kind:'sofa',role:'product'}]}};},
  recover:async()=>null};
 const record={brief:{routeIntent:'single',routeChoice:'hero',budgetUsd:5},parent_id:null};
 const deps=()=>({references:async()=>[ref],draftRecord:async()=>record,store,reader});
 return {draft,values,runs,deps,record,service:sourceUnderstandingService(deps())};
}
const intentFor=async(service,draft)=>{const q=await service.quote(owner,draft);return {requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true};};

test('begin claims without reading, and execute reads exactly once however often it is triggered',async()=>{
 const h=harness(),input=await intentFor(h.service,h.draft);
 const started=await h.service.begin(owner,h.draft,input);
 assert.equal(started.status,'pending_or_uncertain');assert.equal(started.analysis,'running');assert.equal(h.runs.length,0);
 assert.equal(await h.service.needsDispatch(owner,h.draft),true);
 const done=await h.service.execute(owner,h.draft,{timeoutMs:170000});
 assert.equal(done.status,'awaiting_confirmation');assert.deepEqual(h.runs,[170000]);
 await h.service.execute(owner,h.draft);await sourceUnderstandingService(h.deps()).execute(owner,h.draft);
 assert.equal(h.runs.length,1);assert.equal(await h.service.needsDispatch(owner,h.draft),false);
 assert.equal((await h.service.begin(owner,h.draft,input)).status,'awaiting_confirmation');assert.equal(h.runs.length,1);
});
test('a claim from the synchronous path is never dispatched again, since its reads may be paid',async()=>{
 const h=harness({fail:true}),input=await intentFor(h.service,h.draft);
 await assert.rejects(h.service.analyze(owner,h.draft,input),/analysis_outcome_uncertain/);
 assert.equal(await h.service.needsDispatch(owner,h.draft),false);
 assert.equal((await h.service.execute(owner,h.draft)).status,'pending_or_uncertain');
 assert.equal(h.runs.length,1);assert.equal((await h.service.state(owner,h.draft)).analysis,undefined);
});
test('a background read that fails is not retried and stays recoverable from the ledger',async()=>{
 const h=harness({fail:true}),input=await intentFor(h.service,h.draft);
 await h.service.begin(owner,h.draft,input);
 await assert.rejects(h.service.execute(owner,h.draft),/analysis_outcome_uncertain/);
 await h.service.execute(owner,h.draft);
 assert.equal(h.runs.length,1);assert.equal(await h.service.needsDispatch(owner,h.draft),false);
 assert.equal((await h.service.recover(owner,h.draft)).status,'pending_or_uncertain');
});

function authed(draft){
 return {params:{id:draft},cookies:{get:()=>'synthetic-test-token',delete:()=>{},set:()=>{}},site:{url:'https://example.test'},deploy:{context:'production'}};
}
async function asOwner(fn){const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:owner,app_metadata:{roles:['owner']}});try{return await fn();}finally{globalThis.fetch=old;}}
const post=(draft,body)=>new Request(`https://example.test/api/owner/source-understanding/${draft}`,{method:'POST',headers:{origin:'https://example.test'},body:JSON.stringify(body)});

test('analyze returns 202 at once and starts the background reader; recover restarts a lost start once',async()=>{
 const h=harness(),input=await intentFor(h.service,h.draft),dispatched=[];
 let failStart=true;
 const handler=createSourceUnderstandingHandler(h.deps,{dispatch:async(request,draft)=>{dispatched.push(draft);if(failStart)throw Error('dispatch_rejected_503');}});
 await asOwner(async()=>{
  const r=await handler(post(h.draft,{action:'analyze',...input}),authed(h.draft));
  assert.equal(r.status,202);const body=await r.json();assert.equal(body.analysis,'running');assert.equal(h.runs.length,0);
  assert.deepEqual(dispatched,[h.draft]);
  failStart=false;
  assert.equal((await handler(post(h.draft,{action:'recover'}),authed(h.draft))).status,200);
  assert.equal(dispatched.length,2);
  await h.service.execute(owner,h.draft);
  const after=await(await handler(post(h.draft,{action:'recover'}),authed(h.draft))).json();
  assert.equal(after.status,'awaiting_confirmation');assert.equal(dispatched.length,2);assert.equal(h.runs.length,1);
 });
});
test('the background function reads only for an authenticated owner in production',async()=>{
 const calls=[],service=()=>({execute:async(o,d,opts)=>calls.push([o,d,opts.timeoutMs])}),run=createSourceAnalysisBackground(service);
 const draft=randomUUID(),req=()=>new Request('https://example.test/.netlify/functions/owner-source-analysis-background',{method:'POST',body:JSON.stringify({draftId:draft})});
 await run(req(),{...authed(draft),cookies:{get:()=>undefined}});
 await run(req(),{...authed(draft),deploy:{context:'deploy-preview'}});
 await asOwner(()=>run(new Request('https://example.test/x',{method:'POST',body:JSON.stringify({draftId:'bad'})}),authed(draft)));
 assert.equal(calls.length,0);
 await asOwner(()=>run(req(),authed(draft)));
 assert.deepEqual(calls,[[owner,draft,305000]]);
});
test('a background reading that ends without readings reports stopped with its reason, not running',async()=>{
 const h=harness({fail:true}),input=await intentFor(h.service,h.draft);
 await h.service.begin(owner,h.draft,input);
 assert.equal((await h.service.state(owner,h.draft)).analysis,'running');
 await assert.rejects(h.service.execute(owner,h.draft),/analysis_outcome_uncertain/);
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'pending_or_uncertain');assert.equal(s.analysis,'stopped');assert.equal(s.analysisStopped.error,'reader_failed');
 assert.equal((await h.service.recover(owner,h.draft)).analysis,'stopped');
});
test('the stop reason keeps A7\'s error code and status but nothing else',async()=>{
 const h=harness(),input=await intentFor(h.service,h.draft);
 const deps=h.deps();deps.reader={...deps.reader,run:async()=>{throw Object.assign(Error('analysis_outcome_uncertain'),{detail:{upstreamStatus:409,error:'invalid_analysis_intake',secret:'x'}});}};
 const service=sourceUnderstandingService(deps);
 await service.begin(owner,h.draft,input);
 await assert.rejects(service.execute(owner,h.draft),/analysis_outcome_uncertain/);
 const s=await service.state(owner,h.draft);
 assert.deepEqual({error:s.analysisStopped.error,status:s.analysisStopped.upstreamStatus,keys:Object.keys(s.analysisStopped).sort()},{error:'invalid_analysis_intake',status:409,keys:['at','error','upstreamStatus']});
});

test('a gateway timeout leaves the reading running so its ledger reads can still be recovered',async()=>{
 const h=harness(),input=await intentFor(h.service,h.draft);
 const deps=h.deps();deps.reader={...deps.reader,run:async()=>{throw Object.assign(Error('analysis_outcome_uncertain'),{detail:{upstreamStatus:524,error:'a7_http_error',pending:true}});}};
 const service=sourceUnderstandingService(deps);
 await service.begin(owner,h.draft,input);
 await assert.rejects(service.execute(owner,h.draft),/analysis_outcome_uncertain/);
 const s=await service.state(owner,h.draft);
 assert.equal(s.status,'pending_or_uncertain');assert.equal(s.analysis,'running');assert.equal(s.analysisStopped,undefined);
});

test('a reading taken over ten minutes ago with no readings or outcome counts as stopped',async()=>{
 const h=harness(),input=await intentFor(h.service,h.draft);
 await h.service.begin(owner,h.draft,input);
 const dispatchKey=[...h.values.keys()].find(k=>k.endsWith('/claim')).replace(/claim$/,'dispatch');
 h.values.set(dispatchKey,{at:new Date(Date.now()-11*60*1000).toISOString()});
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.analysis,'stopped');assert.equal(s.analysisStopped.error,'no_answer_recorded');
 h.values.set(dispatchKey,{at:new Date(Date.now()-60*1000).toISOString()});
 assert.equal((await h.service.state(owner,h.draft)).analysis,'running');
});

test('a changed direction keeps a running or finished reading: it is bound to the photos it reads',async()=>{
 const h=harness();h.record.note='Keep the sofa as shown.';
 const input=await intentFor(h.service,h.draft);
 await h.service.begin(owner,h.draft,input);
 h.record.note='Show it in a garden.';
 const running=await h.service.state(owner,h.draft);
 assert.equal(running.analysis,'running');assert.equal(running.source.referenceFingerprint,input.referenceFingerprint);assert.equal(running.source.directionChanged,true);
 const done=await h.service.execute(owner,h.draft);
 assert.equal(done.status,'awaiting_confirmation');assert.equal(done.source.directionChanged,true);
 h.record.note='Keep the sofa as shown.';
 assert.equal((await h.service.state(owner,h.draft)).source.directionChanged,false);
});
