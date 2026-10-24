import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {sourceUnderstandingService,analysisDirection,PREFERENCE_LABELS} from '../lib/a7-understanding-service.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {canonical,digest} from '../lib/a7-actions.mjs';

test('the server knows every preference label the page writes into the direction',async()=>{
 const page=await readFile(new URL('../start.js',import.meta.url),'utf8');
 const list=page.match(/const preferenceFields = (\[.*?\]\]);/)[1];
 assert.deepEqual(JSON.parse(list.replaceAll("'",'"')).map(([label])=>label),PREFERENCE_LABELS);
});
test('preference and reference lines are left out of the analysis direction; the owner\'s words stay',()=>{
 const text=['Keep the walnut legs.','Lighting: Daylight','Resolution: 2K','Reference Left side: SHA-256 '+'c'.repeat(64),'Outcomes: White BK, Lifestyle'].join('\n');
 assert.equal(analysisDirection(text),'Keep the walnut legs.');
 assert.equal(analysisDirection('Lighting is soft in the original'),'Lighting is soft in the original');
 assert.equal(analysisDirection('Prepare a faithful source-based product image; original source is authoritative.'),analysisDirection('Resolution: 2K'));
});

const owner=randomUUID(),product='a'.repeat(64),READERS=['03 Eye reads the product photo','05 Second count','09 Conflict check'];
function harness(note,{values=new Map()}={}){
 const draft=randomUUID(),record={note,brief:{routeIntent:'single',routeChoice:'hero',budgetUsd:5},parent_id:null},ref={reference_id:randomUUID(),role:'product',sha256:product};
 const store={get:async k=>values.get(k)||null,set:async(k,v,{onlyIfNew}={})=>{if(onlyIfNew&&values.has(k))return false;values.set(k,v);return true;}};
 const reader={quote:async({source})=>quoteSourceAnalysis(source),run:async({source,intent})=>({receiptId:randomUUID(),draftId:draft,sourceSha256:source.sourceSha256,roomSha256:null,intentFingerprint:intent.fingerprint,readers:READERS.map(node=>({node,status:'completed',operationKey:'k-'+node,receiptRef:'r-'+node})),observation:{category:'Sofa',eyeCount:1,secondCount:1,pieces:[{label:'sofa',kind:'sofa',role:'product'}]}})};
 const service=sourceUnderstandingService({references:async()=>[ref],draftRecord:async()=>record,store,reader});
 return {draft,record,ref,values,service};
}
async function analyzeAndConfirm(h){
 const q=await h.service.quote(owner,h.draft);
 const done=await h.service.analyze(owner,h.draft,{requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true});
 return h.service.confirm(owner,h.draft,{confirmed:true,receiptFingerprint:done.receipt.fingerprint});
}
test('preferences and the owner\'s direction can change after confirming: the facts stay, a changed direction is flagged',async()=>{
 const h=harness('Keep the walnut legs.');
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 h.record.note='Keep the walnut legs.\nResolution: 2K\nLighting: Daylight\nOutcomes: Lifestyle';
 assert.equal((await h.service.state(owner,h.draft)).status,'confirmed');
 assert.equal((await h.service.state(owner,h.draft)).source.directionChanged,false);
 h.record.note='Make the legs oak.\nResolution: 2K';
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.directionChanged,true);
});
test('a claim made with the earlier full-text fingerprint stays valid when its text changes',async()=>{
 const h=harness('Keep the walnut legs.\nLighting: Daylight');
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 // Rewrite the stored claim as the earlier rule bound it: over the whole direction text.
 const claimKey=[...h.values.keys()].find(k=>k.endsWith('/claim')),claim=h.values.get(claimKey);
 const legacy=digest(canonical({instructions:h.record.note,refs:[{id:h.ref.reference_id,role:'product',sha256:product}],route:'single',choice:'hero',parentVersionId:null,budgetLimitUsd:5}));
 h.values.set(claimKey,{...claim,referenceFingerprint:legacy});
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.referenceFingerprint,legacy);
 h.record.note='Keep the walnut legs.\nLighting: Golden afternoon';
 const changed=await h.service.state(owner,h.draft);
 assert.equal(changed.status,'confirmed');assert.equal(changed.source.referenceFingerprint,legacy);assert.equal(changed.source.directionChanged,true);
});

test('raising the job budget after confirmation keeps the source facts confirmed',async()=>{
 const h=harness('Keep the walnut legs.');
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 h.record.brief={...h.record.brief,budgetUsd:10};
 assert.equal((await h.service.state(owner,h.draft)).status,'confirmed');
});
test('a claim bound to the direction-plus-budget fingerprint stays valid',async()=>{
 const h=harness('Keep the walnut legs.\nResolution: 2K');
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 const claimKey=[...h.values.keys()].find(k=>k.endsWith('/claim')),claim=h.values.get(claimKey);
 const earlier=digest(canonical({instructions:'Keep the walnut legs.',refs:[{id:h.ref.reference_id,role:'product',sha256:product}],route:'single',choice:'hero',parentVersionId:null,budgetLimitUsd:5}));
 h.values.set(claimKey,{...claim,referenceFingerprint:earlier});
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.referenceFingerprint,earlier);
});

test('a preference that spans lines stays a preference: its later lines are not the owner\'s direction',()=>{
 const pieces=['Keep the walnut legs.','User supplied pieces and quantities: 1 table','6 chairs','2 benches','Lighting: Daylight'].join('\n');
 assert.equal(analysisDirection(pieces),'Keep the walnut legs.');
 // The server's own edit lines after the preferences, and a saved direction's amendment, are direction again.
 assert.equal(analysisDirection('Keep it.\nUser supplied pieces and quantities: 1 sofa\n2 cushions\nEdit action: remove\nTarget instance: left cushion'),'Keep it.\nEdit action: remove\nTarget instance: left cushion');
 assert.equal(analysisDirection('Saved direction: Keep it.\nSupplier facts: oak\nsolid wood\nAmendment: Make the legs darker.'),'Saved direction: Keep it.\nAmendment: Make the legs darker.');
 assert.equal(analysisDirection('Outcomes: White BK\nReference Left side: SHA-256 '+'c'.repeat(64)+'\n'),'');
});
test('changing a two-line piece list after confirming keeps the facts confirmed',async()=>{
 const h=harness('Keep the walnut legs.\nUser supplied pieces and quantities: 1 table\n8 chairs');
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 h.record.note='Keep the walnut legs.\nUser supplied pieces and quantities: 1 table\n6 chairs';
 const s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.directionChanged,false);
 h.record.note='Make the legs oak.\nUser supplied pieces and quantities: 1 table\n6 chairs';
 assert.equal((await h.service.state(owner,h.draft)).source.directionChanged,true);
});
test('a reading bound line by line (before 20 Oct) stays valid whatever its text says now',async()=>{
 const note='Keep the walnut legs.\nUser supplied pieces and quantities: 1 table\n8 chairs';
 const h=harness(note);
 assert.equal((await analyzeAndConfirm(h)).status,'confirmed');
 // Rewrite the stored claim as the line-by-line rule bound it: the second piece line counted as direction.
 const claimKey=[...h.values.keys()].find(k=>k.endsWith('/claim')),claim=h.values.get(claimKey);
 const lines=digest(canonical({instructions:'Keep the walnut legs.\n8 chairs',refs:[{id:h.ref.reference_id,role:'product',sha256:product}],route:'single',choice:'hero',parentVersionId:null}));
 h.values.set(claimKey,{...claim,referenceFingerprint:lines});
 let s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.referenceFingerprint,lines);assert.equal(s.source.directionChanged,false);
 // Changing the second piece line made such a reading stale before 20 Oct. It is the same photos, so it stays.
 h.record.note='Keep the walnut legs.\nUser supplied pieces and quantities: 1 table\n6 chairs';
 s=await h.service.state(owner,h.draft);
 assert.equal(s.status,'confirmed');assert.equal(s.source.referenceFingerprint,lines);assert.equal(s.source.directionChanged,true);
 h.record.note=note;
 assert.equal((await h.service.state(owner,h.draft)).source.directionChanged,false);
 // A different product photo is a different reading.
 h.ref.sha256='e'.repeat(64);
 assert.equal((await h.service.state(owner,h.draft)).status,'stale');
});
