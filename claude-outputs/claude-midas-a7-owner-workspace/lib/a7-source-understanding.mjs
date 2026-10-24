import {createHash} from 'node:crypto';
import {canonical,requestId} from './a7-actions.mjs';

const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=1&&value<=199;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;

// Route classification is intentionally separate from the existing white-master dispatcher.
// It describes what must be bound before analysis; it does not enable paid execution.
export function routeCase(input,{phase='execution'}={}){
  const routes={project:['one','collection'],edit:['saved','new'],single:['hero','secondary']};
  if(!routes[input?.intent]?.includes(input.route)||!requestId(input.draftId)||!sha(input.sourceSha256))throw Error('invalid_route_case');
  if(input.intent==='edit'){
    if(input.route==='saved'&&!requestId(input.parentVersionId))throw Error('saved_version_required');
    if(input.route==='new'&&input.parentVersionId)throw Error('invalid_route_case');
    if(phase==='execution'&&(!text(input.requestedChanges,600)||!text(input.protectedDetails,600)))throw Error('edit_instructions_required');
    if(input.editTarget==='result'&&!requestId(input.resultAssetId))throw Error('result_asset_required');
    if(input.editTarget!==undefined&&!['source','result'].includes(input.editTarget))throw Error('invalid_route_case');
  } else if(input.parentVersionId||input.resultAssetId||input.requestedChanges||input.protectedDetails)throw Error('invalid_route_case');
  // A collection (batch) is sent as one job per saved case: each case has its own product, originals and confirmed facts,
  // which is how A7 expects a batch ("a batch is split into one job per item before it reaches here").
  const needsBatch=false;
  const needsHero=input.intent==='single'&&input.route==='secondary';
  return {intent:input.intent,route:input.route,draftId:input.draftId,sourceSha256:input.sourceSha256,parentVersionId:input.parentVersionId||null,resultAssetId:input.resultAssetId||null,analysisEligible:true,executionEligible:!needsBatch&&!needsHero,blockingDependency:needsBatch?'batch_dispatch':needsHero?'hero_product_reference':null};
}

// Pure boundary contract. This module never calls a provider or authorizes a budget reservation.
export function analysisIntent(input){
  if(!requestId(input?.requestId)||!requestId(input?.draftId)||!sha(input?.sourceSha256)||input.confirmed!==true||!Number.isFinite(input.maxCostUsd)||input.maxCostUsd<.25||input.maxCostUsd>5||Math.abs(Math.round(input.maxCostUsd*100)-input.maxCostUsd*100)>1e-6)throw Error('invalid_analysis_intent');
  if(input.roomSha256!==undefined&&!sha(input.roomSha256))throw Error('invalid_analysis_intent');
  const intent={requestId:input.requestId,draftId:input.draftId,sourceSha256:input.sourceSha256,roomSha256:input.roomSha256||null,maxCostUsd:input.maxCostUsd};
  return {...intent,fingerprint:hash(intent)};
}

// The adapter must verify each operation against the existing owner ledger before calling this.
// Only source readers and the semantic conflict check are accepted here.
export function analysisReceipt(intent,input){
  if(!requestId(intent?.draftId)||!sha(intent?.sourceSha256)||!sha(intent?.fingerprint)||!requestId(input?.receiptId)||input.draftId!==intent.draftId||input.sourceSha256!==intent.sourceSha256||input.roomSha256!==(intent.roomSha256||null)||input.intentFingerprint!==intent.fingerprint)throw Error('analysis_source_changed');
  const readers=input.readers;
  const required=['03 Eye reads the product photo','05 Second count',...(intent.roomSha256?['06 Room reader']:[]),'09 Conflict check'];
  if(!Array.isArray(readers)||readers.length!==required.length||new Set(readers.map(r=>r.node)).size!==required.length||!required.every(node=>readers.some(r=>r.node===node))||readers.some(r=>r.status!=='completed'||!text(r.operationKey,180)||!text(r.receiptRef,200)))throw Error('analysis_receipt_unverified');
  const o=input.observation;
  if(!o||typeof o!=='object'||Array.isArray(o)||!(text(o.category,120)||count(o.eyeCount)||count(o.secondCount))||o.category&& !text(o.category,120)||[o.eyeCount,o.secondCount,o.statedCount,o.visibleSeatCount].some(v=>v!==null&&v!==undefined&&!count(v))||o.visibleAttributes!==undefined&&(!Array.isArray(o.visibleAttributes)||o.visibleAttributes.length>20||o.visibleAttributes.some(v=>!text(v,180)))||o.uncertainties!==undefined&&(!Array.isArray(o.uncertainties)||o.uncertainties.length>20||o.uncertainties.some(v=>!text(v,350)))||o.pieces!==undefined&&(!Array.isArray(o.pieces)||o.pieces.length>60||o.pieces.some(p=>!text(p?.label,100)||!text(p?.kind,80)||!['product','excluded','context'].includes(p?.role))))throw Error('analysis_observation_invalid');
  const observation={category:o.category?.trim()||null,eyeCount:o.eyeCount??null,secondCount:o.secondCount??null,statedCount:o.statedCount??null,visibleSeatCount:o.visibleSeatCount??null,pieces:(o.pieces||[]).map(p=>({label:p.label.trim(),kind:p.kind.trim(),role:p.role})),visibleAttributes:(o.visibleAttributes||[]).map(v=>v.trim()),uncertainties:(o.uncertainties||[]).map(v=>v.trim())};
  const room=input.roomObservation;
  if(intent.roomSha256){if(!room||room.sourceSha256!==intent.roomSha256||room.roomType!==null&&room.roomType!==undefined&&!text(room.roomType,120)||!Array.isArray(room.unknowns)||room.unknowns.length>20||room.unknowns.some(v=>!text(v,350))||['walls','floor','windows','doors','builtIns','freeFloorZone'].some(k=>room[k]!==null&&room[k]!==undefined&&!text(room[k],350))||!Array.isArray(room.fixedObjects)||room.fixedObjects.length>20||room.fixedObjects.some(v=>!text(v,180)))throw Error('analysis_room_unverified');}
  else if(room!==null&&room!==undefined)throw Error('analysis_room_unverified');
  const roomObservation=room?{sourceSha256:intent.roomSha256,sourceRole:'room',roomType:room.roomType?.trim()||null,...Object.fromEntries(['walls','floor','windows','doors','builtIns','freeFloorZone'].map(k=>[k,room[k]?.trim()||null])),fixedObjects:room.fixedObjects.map(v=>v.trim()),unknowns:room.unknowns.map(v=>v.trim())}:null;
  if(input.conflictFindings!==undefined&&(!Array.isArray(input.conflictFindings)||input.conflictFindings.length>20||input.conflictFindings.some(v=>!text(v,350))))throw Error('analysis_observation_invalid');
  const conflictFindings=(input.conflictFindings||[]).map(v=>v.trim());
  const conflicts=[];
  if(observation.eyeCount!==null&&observation.secondCount!==null&&observation.eyeCount!==observation.secondCount)conflicts.push('reader_count_disagreement');
  if(observation.statedCount!==null&&[observation.eyeCount,observation.secondCount].some(v=>v!==null&&v!==observation.statedCount))conflicts.push('stated_count_disagreement');
  if(!observation.category)conflicts.push('category_unknown');
  if(observation.eyeCount===null&&observation.secondCount===null)conflicts.push('physical_count_unknown');
  if(observation.pieces.some(p=>/unclear|unknown/i.test(p.kind)))conflicts.push('piece_kind_unclear');
  if(roomObservation&&!roomObservation.roomType)conflicts.push('room_type_unknown');
  if(conflictFindings.length)conflicts.push('semantic_conflict');
  const receipt={receiptId:input.receiptId,draftId:intent.draftId,sourceSha256:intent.sourceSha256,roomSha256:intent.roomSha256,intentFingerprint:intent.fingerprint,readers:readers.map(r=>({node:r.node,operationKey:r.operationKey,receiptRef:r.receiptRef})).sort((a,b)=>a.node.localeCompare(b.node)),observation,roomObservation,conflictFindings,conflicts};
  return {...receipt,fingerprint:hash(receipt)};
}

export function confirmUnderstanding(receipt,input,expected){
  if(!receipt||!sha(receipt.fingerprint)||receipt.draftId!==expected?.draftId||receipt.sourceSha256!==expected?.sourceSha256||input?.receiptFingerprint!==receipt.fingerprint||input.confirmed!==true)throw Error('analysis_source_changed');
  const {fingerprint,...receiptBody}=receipt;if(hash(receiptBody)!==fingerprint)throw Error('analysis_receipt_unverified');
  const category=input.category?.trim()||receipt.observation.category;
  const physicalCount=input.physicalCount??(receipt.observation.eyeCount===receipt.observation.secondCount?receipt.observation.eyeCount:null);
  const confirmedRoomType=receipt.roomObservation?(input.roomType?.trim()||receipt.roomObservation.roomType):null;
  // Each refusal carries which rule refused it (codes and lengths only, never the owner's words), so a refused confirmation can be traced.
  const refuse=(code,detail)=>Object.assign(Error(code),{detail});
  if(!text(category,120)||!count(physicalCount)||receipt.roomObservation&&!text(confirmedRoomType,120))throw refuse('analysis_confirmation_incomplete',{missing:[!text(category,120)&&'category',!count(physicalCount)&&'physical_count',receipt.roomObservation&&!text(confirmedRoomType,120)&&'room_type'].filter(Boolean)});
  const ownerCorrections=[];
  if(receipt.observation.category&&category!==receipt.observation.category)ownerCorrections.push('category');
  if(receipt.observation.eyeCount===receipt.observation.secondCount&&receipt.observation.eyeCount!==null&&physicalCount!==receipt.observation.eyeCount)ownerCorrections.push('physical_count');
  if(receipt.roomObservation?.roomType&&confirmedRoomType!==receipt.roomObservation.roomType)ownerCorrections.push('room_type');
  const resolutionState=typeof input.resolution!=='string'||!input.resolution.trim()?'missing':input.resolution.trim().length>600?'too_long':'given';
  if(ownerCorrections.length&&resolutionState!=='given')throw refuse('analysis_correction_reason_required',{corrected:ownerCorrections,resolution:resolutionState});
  const covered=Array.isArray(input.resolvedConflicts)?input.resolvedConflicts:[];
  if(receipt.conflicts.length&&(resolutionState!=='given'||covered.length!==receipt.conflicts.length||receipt.conflicts.some(name=>!covered.includes(name))))throw refuse('analysis_conflict_unresolved',{conflicts:receipt.conflicts,unresolved:receipt.conflicts.filter(name=>!covered.includes(name)),sent:covered.length,resolution:resolutionState});
  const facts={category,physicalCount,visibleSeatCount:receipt.observation.visibleSeatCount,pieces:receipt.observation.pieces,roomObservation:receipt.roomObservation,confirmedRoomType,visibleAttributes:receipt.observation.visibleAttributes,uncertainties:receipt.observation.uncertainties,ownerCorrections,ownerResolution:input.resolution?.trim()||'',receiptFingerprint:receipt.fingerprint,draftId:receipt.draftId,sourceSha256:receipt.sourceSha256,roomSha256:receipt.roomSha256};
  return {...facts,fingerprint:hash(facts)};
}

export function requireCurrentUnderstanding(confirmation,{draftId,sourceSha256,roomSha256,receiptFingerprint}){
  if(!confirmation||confirmation.draftId!==draftId||confirmation.sourceSha256!==sourceSha256||confirmation.roomSha256!==(roomSha256||null)||confirmation.receiptFingerprint!==receiptFingerprint||!sha(confirmation.fingerprint))throw Error('analysis_confirmation_stale');
  const {fingerprint,...facts}=confirmation;if(hash(facts)!==fingerprint)throw Error('analysis_confirmation_stale');return facts;
}
