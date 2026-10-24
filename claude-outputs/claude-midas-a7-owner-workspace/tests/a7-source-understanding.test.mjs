import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {analysisIntent,analysisReceipt,confirmUnderstanding,requireCurrentUnderstanding,routeCase} from '../lib/a7-source-understanding.mjs';

const productHash='a'.repeat(64),roomHash='b'.repeat(64);
const intent=(room=false)=>analysisIntent({requestId:randomUUID(),draftId:randomUUID(),sourceSha256:productHash,...(room?{roomSha256:roomHash}:{}),maxCostUsd:4.74,confirmed:true});
const reader=node=>({node,status:'completed',operationKey:'operation-'+node.slice(0,2),receiptRef:'provider-receipt-'+node.slice(0,2)});
const receipt=(i,patch={})=>analysisReceipt(i,{receiptId:randomUUID(),draftId:i.draftId,sourceSha256:i.sourceSha256,roomSha256:i.roomSha256,intentFingerprint:i.fingerprint,readers:[reader('03 Eye reads the product photo'),reader('05 Second count'),...(i.roomSha256?[reader('06 Room reader')]:[]),reader('09 Conflict check')],observation:{category:'Sofa',eyeCount:2,secondCount:2,statedCount:2,visibleSeatCount:3,pieces:[{kind:'armless seat module',label:'left module',role:'product'},{kind:'cushion',label:'pillow',role:'context'}],visibleAttributes:['visible connectors'],uncertainties:['rear is hidden']},roomObservation:i.roomSha256?{sourceSha256:roomHash,roomType:'Bedroom',walls:'Ivory',floor:'Oak',windows:'one window',doors:'one door',builtIns:'wardrobe',freeFloorZone:'beside window',fixedObjects:['radiator'],unknowns:['dimensions unknown']}:null,...patch});

test('three route contracts preserve distinct dependencies before source analysis',()=>{
 const base={draftId:randomUUID(),sourceSha256:productHash};
 assert.equal(routeCase({...base,intent:'project',route:'one'}).analysisEligible,true);
 assert.equal(routeCase({...base,intent:'project',route:'collection'}).blockingDependency,null);assert.equal(routeCase({...base,intent:'project',route:'collection'}).executionEligible,true);
 assert.equal(routeCase({...base,intent:'single',route:'hero'}).analysisEligible,true);
 assert.equal(routeCase({...base,intent:'single',route:'secondary'}).analysisEligible,true);
 assert.equal(routeCase({...base,intent:'single',route:'secondary'}).blockingDependency,'hero_product_reference');
 assert.throws(()=>routeCase({...base,intent:'edit',route:'saved',requestedChanges:'Change lighting',protectedDetails:'Same sofa'}),/saved_version_required/);
 const saved={...base,intent:'edit',route:'saved',parentVersionId:randomUUID(),requestedChanges:'Change lighting',protectedDetails:'Same sofa'};
 assert.equal(routeCase(saved).parentVersionId,saved.parentVersionId);
 assert.equal(routeCase({...base,intent:'edit',route:'new'},{phase:'analysis'}).analysisEligible,true);
 assert.throws(()=>routeCase({...saved,editTarget:'result'}),/result_asset_required/);
 assert.equal(routeCase({...saved,editTarget:'result',resultAssetId:randomUUID()}).analysisEligible,true);
 assert.throws(()=>routeCase({...base,intent:'edit',route:'new',requestedChanges:'Change lighting'}),/edit_instructions_required/);
});

test('explicit analysis authorization binds the saved version and original hashes',()=>{
 const i=intent(true);assert.equal(i.roomSha256,roomHash);assert.match(i.fingerprint,/^[a-f0-9]{64}$/);
 assert.throws(()=>analysisIntent({requestId:randomUUID(),draftId:i.draftId,sourceSha256:productHash,maxCostUsd:4.74}),/invalid_analysis_intent/);
 assert.throws(()=>analysisIntent({requestId:randomUUID(),draftId:i.draftId,sourceSha256:productHash,maxCostUsd:5.01,confirmed:true}),/invalid_analysis_intent/);
});
test('room and product readings remain distinct; image views and seats are not physical counts',()=>{
 const i=intent(true),r=receipt(i);assert.equal(r.observation.eyeCount,2);assert.equal(r.observation.visibleSeatCount,3);
 assert.equal(r.observation.pieces[1].role,'context');assert.equal(r.roomObservation.sourceRole,'room');assert.equal(r.roomObservation.roomType,'Bedroom');
 assert.equal(r.conflicts.length,0);assert.equal(receipt(i,{receiptId:r.receiptId}).fingerprint,r.fingerprint);
 const confirmed=confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint},{draftId:i.draftId,sourceSha256:productHash});
 assert.equal(confirmed.physicalCount,2);assert.equal(confirmed.confirmedRoomType,'Bedroom');assert.equal(requireCurrentUnderstanding(confirmed,{draftId:i.draftId,sourceSha256:productHash,roomSha256:roomHash,receiptFingerprint:r.fingerprint}).physicalCount,2);
 assert.throws(()=>requireCurrentUnderstanding(confirmed,{draftId:i.draftId,sourceSha256:productHash,roomSha256:'c'.repeat(64),receiptFingerprint:r.fingerprint}),/stale/);
});
test('uncertain counts and room classification require explicit owner resolution',()=>{
 const i=intent(true),r=receipt(i,{observation:{category:'Sofa',eyeCount:2,secondCount:3,statedCount:2,pieces:[{label:'module',kind:'unclear module',role:'product'}]},roomObservation:{sourceSha256:roomHash,roomType:null,walls:null,floor:null,windows:null,doors:null,builtIns:null,freeFloorZone:null,fixedObjects:[],unknowns:['room type unclear']}});
 assert.deepEqual(r.conflicts,['reader_count_disagreement','stated_count_disagreement','piece_kind_unclear','room_type_unknown']);
 assert.throws(()=>confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint},{draftId:i.draftId,sourceSha256:productHash}),/incomplete/);
 assert.throws(()=>confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint,physicalCount:2,roomType:'Bedroom'},{draftId:i.draftId,sourceSha256:productHash}),/unresolved/);
 const c=confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint,physicalCount:2,roomType:'Bedroom',resolution:'Two modules; the extra detected seat is part of one module. Room is a bedroom.',resolvedConflicts:r.conflicts},{draftId:i.draftId,sourceSha256:productHash});
 assert.equal(c.confirmedRoomType,'Bedroom');assert.equal(c.physicalCount,2);assert.equal(c.roomObservation.roomType,null);
});
test('a refused confirmation says which rule refused it, in codes and lengths only',()=>{
 const i=intent(true),r=receipt(i,{observation:{category:'Sofa',eyeCount:2,secondCount:3,pieces:[]},roomObservation:{sourceSha256:roomHash,roomType:null,walls:null,floor:null,windows:null,doors:null,builtIns:null,freeFloorZone:null,fixedObjects:[],unknowns:[]}});
 const refused=input=>{try{confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint,...input},{draftId:i.draftId,sourceSha256:productHash});}catch(error){return [error.message,error.detail];}assert.fail('accepted');};
 assert.deepEqual(refused({}),['analysis_confirmation_incomplete',{missing:['physical_count','room_type']}]);
 assert.deepEqual(refused({physicalCount:2,roomType:'Bedroom'}),['analysis_conflict_unresolved',{conflicts:r.conflicts,unresolved:r.conflicts,sent:0,resolution:'missing'}]);
 assert.deepEqual(refused({physicalCount:2,roomType:'Bedroom',resolution:'x'.repeat(601),resolvedConflicts:r.conflicts}),['analysis_conflict_unresolved',{conflicts:r.conflicts,unresolved:[],sent:2,resolution:'too_long'}]);
 assert.deepEqual(refused({physicalCount:2,roomType:'Bedroom',resolution:'Two modules.',resolvedConflicts:['reader_count_disagreement']}),['analysis_conflict_unresolved',{conflicts:r.conflicts,unresolved:['room_type_unknown'],sent:1,resolution:'given'}]);
 const detail=JSON.stringify(refused({physicalCount:2,roomType:'Bedroom',resolution:'Private owner words.'})[1]);
 assert.doesNotMatch(detail,/Private owner words/);
});
test('missing reader receipts, mismatched source and forged analysis are rejected',()=>{
 const i=intent(true),r=receipt(i);
 assert.throws(()=>receipt(i,{sourceSha256:'c'.repeat(64)}),/source_changed/);
 assert.throws(()=>receipt(i,{readers:[reader('03 Eye reads the product photo'),reader('05 Second count')]}),/receipt_unverified/);
 assert.throws(()=>receipt(i,{roomObservation:{...r.roomObservation,sourceSha256:'c'.repeat(64)}}),/room_unverified/);
 assert.throws(()=>confirmUnderstanding({...r,observation:{...r.observation,eyeCount:4}},{confirmed:true,receiptFingerprint:r.fingerprint},{draftId:i.draftId,sourceSha256:productHash}),/receipt_unverified/);
});
test('semantic conflict reader findings require an owner resolution',()=>{
 const i=intent(),r=receipt(i,{conflictFindings:['Reference says three units but only two are visible']});
 assert.deepEqual(r.conflicts,['semantic_conflict']);
 assert.throws(()=>confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint},{draftId:i.draftId,sourceSha256:productHash}),/unresolved/);
});
test('owner corrections to a reader consensus retain a reason instead of silently changing facts',()=>{
 const i=intent(),r=receipt(i);
 assert.throws(()=>confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint,physicalCount:3},{draftId:i.draftId,sourceSha256:productHash}),/correction_reason_required/);
 const c=confirmUnderstanding(r,{confirmed:true,receiptFingerprint:r.fingerprint,physicalCount:3,resolution:'The back module is mostly hidden but visible in the second reference.'},{draftId:i.draftId,sourceSha256:productHash});
 assert.deepEqual(c.ownerCorrections,['physical_count']);assert.equal(c.physicalCount,3);
});
