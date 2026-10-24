import {canonical,digest,requestId} from './a7-actions.mjs';
import {analysisIntent,analysisReceipt,confirmUnderstanding,requireCurrentUnderstanding,routeCase} from './a7-source-understanding.mjs';
import {quoteSourceAnalysis} from './a7-analysis-quote.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';
import {MAX_JOB_BUDGET_USD} from './a7-limits.mjs';

// The page writes each requested preference as "<label>: <value>" and each extra view as
// "Reference <label>: SHA-256 <hash>" into the direction. Neither is the owner's own direction:
// preferences are requests, and references are fingerprinted from their own records. Keep this list
// in step with preferenceFields in start.js (tests/a7-analysis-direction.test.mjs checks it).
export const PREFERENCE_LABELS=['Department','Category','Sub-category','Supplier facts','Outcomes','Images to include','Camera view','Image shape','Lighting','Resolution','Image proportions shortcut','Start with','Work on','Project starting point','Wall paint','Floor','Window position','Style direction','Mood / Vibes','Plants','Human','Atlas variation request','Variation count','Previous generation for continuity','Requested dimensions','User supplied pieces and quantities','Requested changes','Details to preserve','User resolution of a known conflict','Specific items or combination','Preservation mode','Initial description checkpoint','Semantic grounding','Description and meta','Fidelity steering','Styling steering','Cluttering steering'];
// The page saves this sentence when the owner wrote no direction; it is not a direction either.
export const DEFAULT_DIRECTION='Prepare a faithful source-based product image; original source is authoritative.';
// A preference value can span lines (pieces and quantities are one per line): its later lines belong to it, not to the
// owner's direction, until a line that starts another label. The server's own edit lines (lib/a7-projects.mjs draftDirection)
// and a saved direction's amendment always start a direction line. Under the earlier rule only a preference's first line was
// left out, so editing a two-line piece list after a paid reading discarded the reading although preferences "never count".
const DIRECTION_LABELS=['Edit action','Target instance','Placement','Preserve','Amendment','Saved direction'];
const labelled=(line,labels)=>labels.some(label=>line.startsWith(label+': '));
const referenceLine=line=>/^Reference .{1,80}: SHA-256 [a-f0-9]{64}$/.test(line);
export function analysisDirection(instructions){
  let inPreference=false;
  return String(instructions||'').split('\n').filter(line=>{
    if(labelled(line,PREFERENCE_LABELS)){inPreference=true;return false;}
    if(referenceLine(line)||line.trim()===DEFAULT_DIRECTION){inPreference=false;return false;}
    if(labelled(line,DIRECTION_LABELS))inPreference=false;
    return !inPreference;
  }).join('\n').trim();
}
// The earlier rule, line by line: claims made under it carry its fingerprint (see current()).
function lineDirection(instructions){
  return String(instructions||'').split('\n').filter(line=>line.trim()!==DEFAULT_DIRECTION&&!labelled(line,PREFERENCE_LABELS)&&!referenceLine(line)).join('\n').trim();
}


// A short reason for a reading that ended without readings: never a message body, URL or secret.
function stopDetail(error){
  const d=error?.detail||{};
  return {upstreamStatus:Number.isInteger(d.upstreamStatus)?d.upstreamStatus:null,error:typeof d.error==='string'&&/^[a-z0-9_]{1,80}$/.test(d.error)?d.error:/^analysis_[a-z_]{1,60}$/.test(error?.message||'')?error.message:'reader_failed'};
}

export function requireConfirmedSource(state,brief){
 if(state?.status!=='confirmed'||!state.receipt?.fingerprint)throw Error('source_confirmation_required');
 // An inherited analysis was confirmed on the draft that paid for it (the origin), for the same photos.
 const facts=requireCurrentUnderstanding(state.confirmation,{...state.source,draftId:state.inherited?.originDraftId||state.source.draftId,receiptFingerprint:state.receipt.fingerprint});
 // The detail lets the refusal say what to change: the pieces' total against the confirmed count.
 const mismatch=pieces=>Object.assign(Error('confirmed_inventory_mismatch'),{detail:{pieces,confirmed:facts.physicalCount}});
 if(typeof brief?.product!=='string'||!brief.product.trim()||typeof brief.inventory!=='string')throw mismatch(null);
 const lines=brief.inventory.split('\n').map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>20||lines.some(x=>!/^([1-9]\d{0,2})\s+.{1,60}$/.test(x)))throw mismatch(null);
 const total=lines.reduce((n,x)=>n+Number(x.split(/\s+/)[0]),0);if(total!==facts.physicalCount)throw mismatch(total);
 const route=routeCase({intent:brief.routeIntent,route:brief.routeChoice,draftId:state.source.draftId,sourceSha256:state.source.sourceSha256,parentVersionId:state.source.route.parentVersionId||undefined,requestedChanges:brief.allowedChanges,protectedDetails:brief.protectedDetails});
 if(!route.executionEligible)throw Error(route.blockingDependency);
 return {inheritedFrom:state.inherited?.originDraftId||null,receiptFingerprint:state.receipt.fingerprint,confirmationFingerprint:state.confirmation.fingerprint,sourceSha256:state.source.sourceSha256,referenceFingerprint:state.source.referenceFingerprint,route,facts:{category:facts.category,physicalCount:facts.physicalCount,visibleSeatCount:facts.visibleSeatCount,pieces:facts.pieces,roomObservation:facts.roomObservation,confirmedRoomType:facts.confirmedRoomType,visibleAttributes:facts.visibleAttributes,uncertainties:facts.uncertainties,ownerCorrections:facts.ownerCorrections,ownerResolution:facts.ownerResolution}};
}

// The injected reader must verify ledger operations and source hashes itself. There is
// deliberately no production reader here. The store uses durable, strong reads.
export function sourceUnderstandingService({references,draftRecord,store,reader}){
  const key=(owner,draft,suffix)=>`source-understanding/${owner}/${draft}/${suffix}`;
  async function current(owner,draft){
    if(!requestId(draft))throw Error('not_found');
    const refs=await references(owner,draft);
    const products=refs.filter(r=>r.role==='product'),rooms=refs.filter(r=>r.role==='room');
    if(products.length!==1||rooms.length>1)throw Error('source_roles_unresolved');
    const sourceSha256=products[0].sha256,roomSha256=rooms[0]?.sha256||null;
    const record=await draftRecord(owner,draft);
    const route=routeCase({intent:record.brief?.routeIntent,route:record.brief?.routeChoice,draftId:draft,sourceSha256,parentVersionId:record.parent_id||undefined},{phase:'analysis'});
    const budgetLimitUsd=Number(record.brief?.budgetUsd??5);
    if(!Number.isFinite(budgetLimitUsd)||budgetLimitUsd<.25||budgetLimitUsd>MAX_JOB_BUDGET_USD)throw Error('invalid_budget');
    const instructions=String(record.direction||record.note||'').trim();
    const refList=refs.map(r=>({id:r.reference_id,role:r.role,sha256:r.sha256})).sort((a,b)=>a.id.localeCompare(b.id));
    const fingerprintOf=(text,withBudget)=>digest(canonical({instructions:text,refs:refList,route:route.intent,choice:route.route,parentVersionId:route.parentVersionId,...(withBudget?{budgetLimitUsd}:{})}));
    // A reading measures the photos it was paid for: the product photo and the room photo (category, counts, pieces, room).
    // It stays this version's reading while those photos are the same, whatever the direction, preferences or budget say
    // now; a different product or room photo needs a new reading. Binding it to the text made the normal order (save the
    // photos, read them, then write the details and save) discard the paid reading. Only the conflict check compared the
    // photos with the direction; A7 runs its own readers and conflict check on the direction it is sent (01-09 of the main
    // workflow), so a later direction is still checked. directionChanged tells the page the findings are for earlier text.
    const current=fingerprintOf(analysisDirection(instructions),false);
    const claim=await store.get(key(owner,draft,'claim'));
    const samePhotos=Boolean(claim?.intent)&&claim.intent.sourceSha256===sourceSha256&&(claim.intent.roomSha256||null)===roomSha256;
    const referenceFingerprint=samePhotos?claim.referenceFingerprint:current;
    // The fingerprints this text would have had under each rule a claim has been made with: the full text with the budget,
    // the owner's direction read line by line (with or without the budget), and the direction as read now.
    const forText=[current,fingerprintOf(instructions,true),fingerprintOf(lineDirection(instructions),true),fingerprintOf(lineDirection(instructions),false)];
    const directionChanged=samePhotos&&!forText.includes(claim.referenceFingerprint);
    // scope: what decides whether the version can be sent later (lib/a7-send-check.mjs scopeWarnings); never part of a fingerprint.
    return {draftId:draft,...sharedRunIdentity(draft),budgetLimitUsd,sourceSha256,roomSha256,referenceFingerprint,directionChanged,route,instructions,scope:{references:refs.length,outcomes:String(record.brief?.outcomes||'')}};
  }
  // Edit phase 2.2: a saved edit that keeps its parent's product and room photos reuses the parent's
  // confirmed analysis instead of paying to read the same photos again. Nothing is copied or stored: the
  // inheritance is worked out on every read, so it ends as soon as the photos differ, and a draft with an
  // analysis of its own always uses that one. The origin is the draft whose paid reads the analysis is.
  async function inheritance(owner,draft,source,depth){
    const record=await draftRecord(owner,draft);
    if(!record?.parent_id||depth>=8)return null;
    let parent;try{parent=await stateAt(owner,record.parent_id,depth+1);}catch{return null;}
    if(parent.status!=='confirmed'||parent.source.sourceSha256!==source.sourceSha256||(parent.source.roomSha256||null)!==(source.roomSha256||null))return null;
    const origin=parent.inherited?.origin||parent.source;
    return {fromDraftId:record.parent_id,originDraftId:origin.draftId,origin,receipt:parent.receipt,confirmation:parent.confirmation};
  }
  async function state(owner,draft){return stateAt(owner,draft,0);}
  async function stateAt(owner,draft,depth){
    const source=await current(owner,draft),claim=await store.get(key(owner,draft,'claim'));
    if(!claim){const inherited=await inheritance(owner,draft,source,depth);if(inherited){const {receipt,confirmation,...link}=inherited;return {status:'confirmed',source,receipt,confirmation,inherited:link};}}
    const receipt=await store.get(key(owner,draft,'receipt'));
    const confirmation=await store.get(key(owner,draft,'confirmation'));
    const valid=claim?.referenceFingerprint===source.referenceFingerprint;
    if(!valid)return {status:claim?'stale':'not_started',source};
    let outcome=claim.background&&!receipt?await store.get(key(owner,draft,'outcome')):null;
    // A reader runs for at most a few minutes. One taken more than ten minutes ago that left neither
    // readings nor an outcome (for example, a run from before outcomes were recorded) has stopped.
    if(claim.background&&!receipt&&!outcome){const d=await store.get(key(owner,draft,'dispatch'));if(d?.at&&Date.now()-Date.parse(d.at)>10*60*1000)outcome={at:d.at,detail:{upstreamStatus:null,error:'no_answer_recorded'}};}
    const analysis=!claim.background||receipt?{}:outcome?{analysis:'stopped',analysisStopped:{at:outcome.at,...(outcome.detail||{})}}:{analysis:'running'};
    return {status:confirmation?'confirmed':receipt?'awaiting_confirmation':'pending_or_uncertain',source,receipt,confirmation,...analysis};
  }
  async function quote(owner,draft){
    const source=await current(owner,draft);
    if(!reader)return {status:'not_connected',source};
    // A route that can never be sent (a secondary product needs its hero product) is not read: the reading would be paid for nothing.
    if(!source.route.executionEligible)throw Error(source.route.blockingDependency||'invalid_route_case');
    const policy=quoteSourceAnalysis(source);
    // The owner fixes this by raising the job budget, so the refusal names the amount the reading reserves.
    if(policy.maxCostUsd>source.budgetLimitUsd)throw Object.assign(Error('analysis_budget_exceeds_limit'),{detail:{requiredUsd:policy.maxCostUsd,budgetUsd:source.budgetLimitUsd,room:Boolean(source.roomSha256)}});
    const q=await reader.quote({owner,source});
    if(q?.status!=='verified'||q.maxCostUsd!==policy.maxCostUsd||q.fingerprint!==policy.fingerprint)throw Error('analysis_quote_unavailable');
    return {status:'verified',source,maxCostUsd:q.maxCostUsd,fingerprint:q.fingerprint};
  }
  // Claims one paid analysis for this exact saved version. A claim made with
  // {background:true} is run later by execute(), outside the request that made it.
  async function claim(owner,draft,input,{background=false}={}){
    if(!reader)throw Error('analysis_not_connected');
    const q=await quote(owner,draft),source=q.source;
    if(input?.quoteFingerprint!==q.fingerprint||input.maxCostUsd!==q.maxCostUsd||input.referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_quote_changed');
    const intent=analysisIntent({...input,draftId:draft,sourceSha256:source.sourceSha256,...(source.roomSha256?{roomSha256:source.roomSha256}:{})});
    const record={intent,referenceFingerprint:source.referenceFingerprint,quoteFingerprint:q.fingerprint,...(background?{background:true}:{})};
    const claimKey=key(owner,draft,'claim'),existing=await store.get(claimKey);
    // An edit that inherits its parent's confirmed analysis has nothing to pay for.
    if(!existing&&(await state(owner,draft)).inherited)throw Error('analysis_inherited');
    if(existing){if(existing.intent.fingerprint!==intent.fingerprint||existing.referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_already_claimed');return {created:false,record:existing,source,quote:q};}
    const created=await store.set(claimKey,record,{onlyIfNew:true});
    if(!created){const saved=await store.get(claimKey);if(saved?.intent.fingerprint!==intent.fingerprint)throw Error('analysis_already_claimed');return {created:false,record:saved,source,quote:q};}
    return {created:true,record,source,quote:q};
  }
  async function readAndRecord(owner,draft,source,record,q,options){
    try{
      const output=await reader.run({owner,source,intent:record.intent,quote:q,...options});
      if((await current(owner,draft)).referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_source_changed');
      const receipt=analysisReceipt(record.intent,output);
      // The reader adapter must have verified every operation in the durable ledger.
      await store.set(key(owner,draft,'receipt'),receipt,{onlyIfNew:true});
      return state(owner,draft);
    }catch(error){throw Object.assign(Error('analysis_outcome_uncertain'),{detail:stopDetail(error),pending:error?.detail?.pending===true});}
  }
  async function analyze(owner,draft,input){
    const c=await claim(owner,draft,input);
    if(!c.created)return state(owner,draft);
    return readAndRecord(owner,draft,c.source,c.record,c.quote);
  }
  // Records the claim and returns at once; the paid reads run in execute().
  async function begin(owner,draft,input){
    await claim(owner,draft,input,{background:true});
    return state(owner,draft);
  }
  // True only for a background claim that no execute() has taken yet. A claim from the
  // synchronous path is never dispatched: its reads may already have been paid.
  async function needsDispatch(owner,draft){
    const record=await store.get(key(owner,draft,'claim'));
    if(!record?.background)return false;
    return !(await store.get(key(owner,draft,'dispatch')))&&!(await store.get(key(owner,draft,'receipt')));
  }
  // Runs a background claim at most once: the dispatch marker is taken before any paid call,
  // so a repeated trigger, a retry or a second invocation never sends the reads again.
  async function execute(owner,draft,options={}){
    if(!reader)throw Error('analysis_not_connected');
    const source=await current(owner,draft),record=await store.get(key(owner,draft,'claim'));
    if(!record?.background)return state(owner,draft);
    if(record.referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_source_changed');
    if(await store.get(key(owner,draft,'receipt')))return state(owner,draft);
    const q=await quote(owner,draft);
    if(q.fingerprint!==record.quoteFingerprint)throw Error('analysis_quote_changed');
    if(!(await store.set(key(owner,draft,'dispatch'),{at:new Date().toISOString(),intentFingerprint:record.intent.fingerprint},{onlyIfNew:true})))return state(owner,draft);
    try{return await readAndRecord(owner,draft,source,record,q,options);}
    catch(error){
      // Without this record the page would keep showing "Reading" after the reader has ended. A pending
      // answer (gateway timeout) is not recorded: the reads continue and recover() collects them from the
      // ledger; with no readings ten minutes after dispatch, state() reports the reading as stopped.
      if(!error.pending)await store.set(key(owner,draft,'outcome'),{status:'stopped',at:new Date().toISOString(),detail:error.detail||null},{onlyIfNew:true});
      throw error;
    }
  }
  async function recover(owner,draft){
    if(!reader?.recover)throw Error('analysis_not_connected');
    const source=await current(owner,draft),record=await store.get(key(owner,draft,'claim'));
    if(!record)return state(owner,draft);
    if(record.referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_source_changed');
    const existing=await store.get(key(owner,draft,'receipt'));
    if(existing)return state(owner,draft);
    const output=await reader.recover({owner,source,intent:record.intent});
    if(!output)return state(owner,draft);
    if((await current(owner,draft)).referenceFingerprint!==source.referenceFingerprint)throw Error('analysis_source_changed');
    await store.set(key(owner,draft,'receipt'),analysisReceipt(record.intent,output),{onlyIfNew:true});
    return state(owner,draft);
  }
  async function confirm(owner,draft,input){
    const s=await state(owner,draft);
    if(s.status==='stale')throw Error('analysis_source_changed');
    if(s.status==='confirmed'){
      if(input?.receiptFingerprint!==s.receipt?.fingerprint)throw Error('analysis_already_confirmed');
      return s;
    }
    if(s.status!=='awaiting_confirmation')throw Error('analysis_receipt_missing');
    const confirmation=confirmUnderstanding(s.receipt,input,{draftId:draft,sourceSha256:s.source.sourceSha256});
    requireCurrentUnderstanding(confirmation,{...s.source,receiptFingerprint:s.receipt.fingerprint});
    const created=await store.set(key(owner,draft,'confirmation'),confirmation,{onlyIfNew:true});
    if(!created)throw Error('analysis_already_confirmed');
    return state(owner,draft);
  }
  return {current,state,quote,analyze,begin,needsDispatch,execute,recover,confirm};
}
