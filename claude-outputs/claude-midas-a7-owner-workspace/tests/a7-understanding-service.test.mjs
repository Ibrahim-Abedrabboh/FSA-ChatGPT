import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sourceUnderstandingService,requireConfirmedSource} from '../lib/a7-understanding-service.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {createSourceUnderstandingHandler} from '../netlify/functions/owner-source-understanding.mjs';

const owner=randomUUID(),draft=randomUUID(),other=randomUUID(),product='a'.repeat(64),room='b'.repeat(64);
function harness(withReader=true,readerFailure=false){
 const values=new Map(),refs=[{reference_id:randomUUID(),role:'product',sha256:product},{reference_id:randomUUID(),role:'room',sha256:room}];let calls=0;
 const store={get:async key=>values.get(key)||null,set:async(key,value,{onlyIfNew}={})=>{if(onlyIfNew&&values.has(key))return false;values.set(key,value);return true;}};
 const reader=withReader?{
  quote:async({source})=>quoteSourceAnalysis(source),
  run:async({source,intent})=>{calls++;if(readerFailure)throw Error('synthetic_timeout');return {receiptId:randomUUID(),draftId:draft,sourceSha256:source.sourceSha256,roomSha256:source.roomSha256,intentFingerprint:intent.fingerprint,readers:['03 Eye reads the product photo','05 Second count','06 Room reader','09 Conflict check'].map(node=>({node,status:'completed',operationKey:'ledger-'+node,receiptRef:'receipt-'+node})),observation:{category:'Sofa',eyeCount:2,secondCount:2,visibleSeatCount:3,pieces:[{label:'left',kind:'seat module',role:'product'}]},roomObservation:{sourceSha256:room,roomType:'Living room',walls:'white',floor:'oak',windows:'one',doors:'one',builtIns:null,freeFloorZone:'central',fixedObjects:[],unknowns:[]}};}
 }:null;
 const dependencies=()=>({references:async(id,version)=>{if(id!==owner||version!==draft)throw Error('not_found');return refs;},draftRecord:async()=>({brief:{routeIntent:'single',routeChoice:'hero'},parent_id:null}),store,reader});
 return {service:sourceUnderstandingService(dependencies()),dependencies,refs,get calls(){return calls;}};
}
test('bounded authorization reuses its durable receipt and invalidates changed original references',async()=>{
 const h=harness(),quote=await h.service.quote(owner,draft);
 const input={requestId:randomUUID(),referenceFingerprint:quote.source.referenceFingerprint,quoteFingerprint:quote.fingerprint,maxCostUsd:quote.maxCostUsd,confirmed:true};
 const first=await h.service.analyze(owner,draft,input);
 assert.equal(first.status,'awaiting_confirmation');assert.equal(h.calls,1);
 assert.equal((await h.service.analyze(owner,draft,input)).receipt.fingerprint,first.receipt.fingerprint);assert.equal(h.calls,1);
 assert.equal((await sourceUnderstandingService(h.dependencies()).analyze(owner,draft,input)).receipt.fingerprint,first.receipt.fingerprint);assert.equal(h.calls,1);
 assert.equal(first.receipt.observation.visibleSeatCount,3);assert.equal(first.receipt.observation.eyeCount,2);
 const confirmed=await h.service.confirm(owner,draft,{confirmed:true,receiptFingerprint:first.receipt.fingerprint});
 assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.confirmation.physicalCount,2);
 assert.throws(()=>requireConfirmedSource(first,{product:'Sofa',inventory:'2 seat modules',routeIntent:'single',routeChoice:'hero'}),/source_confirmation_required/);
 assert.throws(()=>requireConfirmedSource(confirmed,{product:'Sofa',inventory:'3 seats',routeIntent:'single',routeChoice:'hero'}),/confirmed_inventory_mismatch/);
 assert.equal(requireConfirmedSource(confirmed,{product:'Sofa',inventory:'2 seat modules',routeIntent:'single',routeChoice:'hero'}).facts.physicalCount,2);
 // Another view is not read by the readers: the reading still describes the photos it read.
 h.refs.push({reference_id:randomUUID(),role:'other_view',sha256:'c'.repeat(64)});
 assert.equal((await h.service.state(owner,draft)).status,'confirmed');
 // A different product photo is not what was read.
 h.refs[0]={...h.refs[0],sha256:'d'.repeat(64)};
 assert.equal((await h.service.state(owner,draft)).status,'stale');
 await assert.rejects(h.service.confirm(owner,draft,{confirmed:true,receiptFingerprint:first.receipt.fingerprint}),/source_changed/);
});
test('no adapter fails closed without a claim, and changed quote cannot launch a reader',async()=>{
 const h=harness(false),q=await h.service.quote(owner,draft);assert.equal(q.status,'not_connected');
 await assert.rejects(h.service.analyze(owner,draft,{confirmed:true}),/analysis_not_connected/);
 assert.equal((await h.service.state(owner,draft)).status,'not_started');
 const live=harness(),quote=await live.service.quote(owner,draft);
 await assert.rejects(live.service.analyze(owner,draft,{requestId:randomUUID(),confirmed:true,referenceFingerprint:quote.source.referenceFingerprint,quoteFingerprint:'wrong',maxCostUsd:quote.maxCostUsd}),/quote_changed/);
 assert.equal(live.calls,0);
});
test('an uncertain reader outcome retains one claim and never resends on duplicate authorization',async()=>{
 const h=harness(true,true),q=await h.service.quote(owner,draft);
 const input={requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true};
 await assert.rejects(h.service.analyze(owner,draft,input),/analysis_outcome_uncertain/);
 assert.equal((await h.service.state(owner,draft)).status,'pending_or_uncertain');
 assert.equal((await h.service.analyze(owner,draft,input)).status,'pending_or_uncertain');
 assert.equal(h.calls,1);
});
test('uncertain source analysis can recover completed receipts without another provider send',async()=>{
 const values=new Map(),version=randomUUID(),person=randomUUID(),ref={reference_id:randomUUID(),role:'product',sha256:product};let sends=0;
 const service=sourceUnderstandingService({references:async()=>[ref],draftRecord:async()=>({brief:{routeIntent:'single',routeChoice:'hero',budgetUsd:5},parent_id:null}),store:{get:async k=>values.get(k)||null,set:async(k,v)=>{values.set(k,v);return true}},reader:{quote:async({source})=>quoteSourceAnalysis(source),run:async()=>{sends++;throw Error('lost_ack');},recover:async({source,intent})=>({receiptId:randomUUID(),draftId:version,sourceSha256:source.sourceSha256,roomSha256:null,intentFingerprint:intent.fingerprint,readers:['03 Eye reads the product photo','05 Second count','09 Conflict check'].map(node=>({node,status:'completed',operationKey:'ledger-'+node,receiptRef:'receipt-'+node})),observation:{category:'Sofa',eyeCount:1,secondCount:1,pieces:[{label:'sofa',kind:'sofa',role:'product'}]}})}});
 const q=await service.quote(person,version),intent={requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true};
 await assert.rejects(service.analyze(person,version,intent),/analysis_outcome_uncertain/);
 assert.equal((await service.recover(person,version)).status,'awaiting_confirmation');
 assert.equal(sends,1);
 assert.equal((await service.recover(person,version)).status,'awaiting_confirmation');
 assert.equal(sends,1);
});
test('owner API authenticates before reading and production-like no-reader boundary stays closed',async()=>{
 const h=harness(false),handler=createSourceUnderstandingHandler(h.dependencies);
 const url=`https://example.test/api/owner/source-understanding/${draft}`;
 const context={params:{id:draft},cookies:{get:()=>undefined},site:{url:'https://example.test'},deploy:{context:'production'}};
 assert.equal((await handler(new Request(url),context)).status,401);
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:owner,app_metadata:{roles:['owner']}});
 try{
  const authed={...context,cookies:{get:()=> 'synthetic-test-token',delete:()=>{},set:()=>{}}};
  assert.equal((await handler(new Request(url+'?action=quote'),authed)).status,200);
  const data=await(await handler(new Request(url+'?action=quote'),authed)).json();assert.equal(data.status,'not_connected');
  const post=new Request(url,{method:'POST',headers:{origin:'https://example.test'},body:JSON.stringify({action:'analyze',confirmed:true})});
  const result=await handler(post,authed);assert.equal(result.status,503);assert.equal((await result.json()).error,'analysis_not_connected');
  globalThis.fetch=async()=>Response.json({id:other,app_metadata:{roles:[]}});
  assert.equal((await handler(new Request(url),authed)).status,403);
 }finally{globalThis.fetch=old;}
});
test('a budget below the reading\'s reservation is refused with the amount, in words the owner can act on',async()=>{
 const values=new Map(),refs=[{reference_id:randomUUID(),role:'product',sha256:product},{reference_id:randomUUID(),role:'room',sha256:room}];
 const dependencies=()=>({references:async()=>refs,draftRecord:async()=>({brief:{routeIntent:'single',routeChoice:'hero',budgetUsd:2},parent_id:null}),store:{get:async k=>values.get(k)||null,set:async(k,v)=>{values.set(k,v);return true;}},reader:{quote:async({source})=>quoteSourceAnalysis(source)}});
 const service=sourceUnderstandingService(dependencies()),source=await service.current(owner,draft),required=quoteSourceAnalysis(source).maxCostUsd;
 const error=await service.quote(owner,draft).then(()=>null,e=>e);
 assert.equal(error.message,'analysis_budget_exceeds_limit');assert.deepEqual(error.detail,{requiredUsd:required,budgetUsd:2,room:true});
 const handler=createSourceUnderstandingHandler(dependencies),old=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:owner,app_metadata:{roles:['owner']}});
 try{
  const response=await handler(new Request(`https://example.test/api/owner/source-understanding/${draft}?action=quote`),{params:{id:draft},cookies:{get:()=> 'synthetic-test-token',delete:()=>{},set:()=>{}},site:{url:'https://example.test'},deploy:{context:'production'}});
  assert.equal(response.status,409);const body=await response.json();
  assert.equal(body.error,'analysis_budget_exceeds_limit');assert.equal(body.requiredUsd,required);
  assert.match(body.message,new RegExp(`reserves up to USD ${required.toFixed(2)}, more than this job's USD 2\\.00 budget\\. Raise the job budget under The product`));
 }finally{globalThis.fetch=old;}
 for(const code of ['invalid_budget','invalid_route_case','saved_version_required','analysis_confirmation_incomplete','analysis_correction_reason_required','analysis_conflict_unresolved','analysis_quote_unavailable']){
  const {mapSourceUnderstandingError}=await import('../netlify/functions/owner-source-understanding.mjs');const mapped=mapSourceUnderstandingError(code);
  assert.equal(mapped.body.error,code);assert.match(mapped.body.message,/\. /,code+' has words');assert.notEqual(mapped.body.error,'source_understanding_unavailable');
 }
});
test('a piece total that differs from the confirmed count carries both numbers',async()=>{
 const h=harness(),quote=await h.service.quote(owner,draft);
 const input={requestId:randomUUID(),referenceFingerprint:quote.source.referenceFingerprint,quoteFingerprint:quote.fingerprint,maxCostUsd:quote.maxCostUsd,confirmed:true};
 const read=await h.service.analyze(owner,draft,input),confirmed=await h.service.confirm(owner,draft,{confirmed:true,receiptFingerprint:read.receipt.fingerprint,roomType:'Living room'});
 const error=(()=>{try{requireConfirmedSource(confirmed,{product:'Sofa',inventory:'1 sofa\n2 cushions',routeIntent:'single',routeChoice:'hero'});}catch(e){return e;}})();
 assert.equal(error.message,'confirmed_inventory_mismatch');assert.deepEqual(error.detail,{pieces:3,confirmed:2});
});
test('a secondary product is not read, and the quote names what would stop a version from being sent',async()=>{
 const values=new Map(),product1={reference_id:randomUUID(),role:'product',sha256:product},view={reference_id:randomUUID(),role:'other_view',sha256:'c'.repeat(64)};
 let brief={routeIntent:'single',routeChoice:'secondary',budgetUsd:5},refs=[product1];
 const dependencies=()=>({references:async()=>refs,draftRecord:async()=>({brief,parent_id:null}),store:{get:async k=>values.get(k)||null,set:async(k,v)=>{values.set(k,v);return true;}},reader:{quote:async({source})=>quoteSourceAnalysis(source)}});
 const service=sourceUnderstandingService(dependencies());
 await assert.rejects(service.quote(owner,draft),/hero_product_reference/);
 const {mapSourceUnderstandingError}=await import('../netlify/functions/owner-source-understanding.mjs');
 const refused=mapSourceUnderstandingError('hero_product_reference');assert.equal(refused.status,409);assert.match(refused.body.message,/secondary product needs the hero product/);
 brief={routeIntent:'single',routeChoice:'hero',budgetUsd:5,outcomes:'Lifestyle\nVariations'};refs=[product1,view];
 const handler=createSourceUnderstandingHandler(dependencies,{multiReference:()=>false}),old=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:owner,app_metadata:{roles:['owner']}});
 try{
  const response=await handler(new Request(`https://example.test/api/owner/source-understanding/${draft}?action=quote`),{params:{id:draft},cookies:{get:()=> 'synthetic-test-token',delete:()=>{},set:()=>{}},site:{url:'https://example.test'},deploy:{context:'production'}});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'verified');
  assert.equal(body.warnings.length,2);assert.match(body.warnings[0],/^Variations cannot be sent yet/);assert.match(body.warnings[1],/2 saved photos, and the A7 connection forwards one product image per job/);
 }finally{globalThis.fetch=old;}
 assert.equal(mapSourceUnderstandingError('price_verification_required').body.message,'Prices must be re-verified before new estimates; contact support. Your draft is saved and nothing was paid.');
});

test('a refused confirmation names what to fix: the explanation, or the findings it did not cover',async()=>{
 const {mapSourceUnderstandingError}=await import('../netlify/functions/owner-source-understanding.mjs');
 const say=detail=>mapSourceUnderstandingError('analysis_conflict_unresolved',detail);
 assert.equal(say({resolution:'missing',unresolved:['semantic_conflict']}).status,400);
 assert.match(say({resolution:'missing'}).body.message,/Explain how you resolved it in "Explain disputed facts"/);
 assert.match(say({resolution:'too_long'}).body.message,/Shorten the explanation .* to 600 characters/);
 assert.match(say({resolution:'given',unresolved:['reader_count_disagreement','semantic_conflict']}).body.message,/\(reader count disagreement, semantic conflict\)\. The page has reloaded the reading/);
 assert.match(say(undefined).body.message,/Explain how you resolved it/);
});
