import { createHash } from 'node:crypto';
import {sharedRunIdentity} from './a7-shared-run.mjs';
import {MAX_JOB_BUDGET_USD} from './a7-limits.mjs';
import {editOptionsOf} from './a7-edit-options.mjs';
export const canonical = value => JSON.stringify(value, (key,item) => item && typeof item==='object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])) : item);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const requestId = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function sameOrigin(request) {
 const origin=request.headers.get('origin');
 return origin===new URL(request.url).origin && !['cross-site','none'].includes(request.headers.get('sec-fetch-site'));
}
export function validateSubmission(input) {
 if (!input || typeof input!=='object' || !requestId(input.requestId)) throw new Error('invalid_request');
 const text=(key,max,required=false)=>{const v=input[key];if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new Error('invalid_'+key);return v.trim();};
 const outcome=text('outcome',30,true);if(!['White background','Lifestyle'].includes(outcome))throw new Error('invalid_outcome');
 const product=text('product',80,true), inventory=text('inventory',1000,true), instructions=text('instructions',1200), dimensions=text('dimensions',120), sku=text('sku',40);
 const pieces=inventory.split(/\n/).filter(x=>x.trim()).map(line=>{const m=line.trim().match(/^(\d{1,3})\s+(.{1,60})$/);if(!m||+m[1]<1||+m[1]>199)throw new Error('invalid_inventory');return {count:+m[1],item:m[2]};});
 if(!pieces.length||pieces.length>20)throw new Error('invalid_inventory');
 const studio=studioFields(input,outcome);
 // The Draft 3 studio page may leave the light to the studio (white background, or "Studio choice"); the classic desk always names one.
 const lightingOk=['Daylight','Golden afternoon','Warm evening'].includes(input.lighting)||(studio&&(studio.lighting===''||studio.lighting==='Soft daylight'));
 if(!['1:1','4:5','5:4','3:4','4:3','2:3','3:2','16:9','9:16'].includes(input.aspect)||!(input.resolution==='2K'||(input.page==='studio'&&input.resolution==='4K'))||!['Category template','Wide view','Close-up','Wide view + close-up'].includes(input.view)||!lightingOk||input.confirmed!==true)throw new Error('invalid_choices');
 const budgetLimitUsd=input.budgetUsd===undefined?5:Number(input.budgetUsd);if(!Number.isFinite(budgetLimitUsd)||budgetLimitUsd<.25||budgetLimitUsd>MAX_JOB_BUDGET_USD||Math.abs(Math.round(budgetLimitUsd*100)-budgetLimitUsd*100)>1e-6)throw Error('invalid_budget');
 const identity=input.draftId?sharedRunIdentity(input.draftId):{clientRunId:'owner-'+input.requestId};
 const body={budgetLimitUsd,...identity,jobMode:'new_project',scope:{outcomes:[outcome],view:input.view,camera:'Reference view',series:'Single image',aspect:input.aspect,resolution:input.resolution},item:{productType:product,category:product,inventory:pieces,dimensions,sku},preferences:{lighting:input.lighting,people:'none',useWorkflowDefaults:false},instructions,references:[{name:'product-reference',role:'Product / vendor reference'}]};
 if(!studio)return body;
 // Draft 3 fields, each one read by A7's "01 Intent & scope" (checked by tests/studio-intake.test.mjs). Absent fields leave the
 // classic desk payload above byte-for-byte unchanged.
 const life=outcome==='Lifestyle';
 body.scope.camera=life?studio.camera:'Reference view';
 body.item={...body.item,category:studio.category||studio.department||product,department:studio.department,subCategory:studio.subCategory,description:studio.description,color:studio.color,material:studio.material};
 body.preferences={lighting:life&&!studio.studioChoice?studio.lighting:'',wallPaint:life&&!studio.studioChoice?studio.wallPaint:'',floor:life&&!studio.studioChoice?studio.floor:'',people:life&&studio.human?'one':'none',useWorkflowDefaults:life&&studio.studioChoice};
 if(life)body.styling={human:studio.human};
 body.metadata={locks:studio.locks,must_not:studio.mustNot};
 if(input.page!=='studio')return body;
 // The guide's full first page (owner, 18 Oct 2026). Each field is one that A7's "01 Intent & scope" reads; A7 lists back under
 // "not applied" whatever it does not use yet (plants, mood, strengths, validation, links, catalogue references, room description).
 const g=studio.guide;
 if(g.outcomes.length)body.scope.outcomes=g.outcomes;
 // Sent only when the owner left the white image out and no outcome needs it; otherwise the request is unchanged and A7 makes it.
 if(!g.whiteMaster&&g.outcomes.length&&!whiteRequired(g.outcomes))body.scope.whiteMaster=false;
 body.job={workOn:'one_by_one',itemRole:g.itemRole};   // no job.type: A7 then reads jobMode (new_project or edit, set on send). A batch is split into one job per item before it is sent.
 if(g.series)body.scope.series=g.series;
 if(g.outcomes.includes('Variations'))body.scope.imageCount=g.variationCount;
 if(g.midasPicks.length)body.midasPicks=g.midasPicks;
 if(g.catalogueRefs.length)body.catalogueReferences=g.catalogueRefs;
 const details={};
 if(g.links)details.links=g.links;
 if(g.previousGeneration)details.previousGeneration=g.previousGeneration;
 if(!g.includeMeta)details.includeDescriptionAndMetadata=false;
 if(Object.keys(details).length)body.details=details;
 const scene=g.outcomes.some(o=>o!=='White BK');
 if(scene&&(g.plants||g.mood)){body.styling={...(body.styling||{})};if(g.plants)body.styling.plants=true;if(g.mood)body.styling.mood=g.mood;}
 if(Object.keys(g.strengths).length)body.strengths=g.strengths;
 if(g.validation)body.validation=g.validation;
 if(g.roomBrief)body.roomBrief=g.roomBrief;
 return body;
}
export const STUDIO_KEYS=['camera','human','wallPaint','floor','studioChoice','color','material','locks','mustNot','department','category','subCategory','description','page'];
// The guide's first page (page "studio" only). otherOutcome, variationAxes and workOn are kept in the saved version; the page also writes
// the first two into the instructions, because the guide makes them explicit brief instructions.
export const GUIDE_KEYS=['outcomes','otherOutcome','itemRole','workOn','series','variationCount','variationAxes','plants','mood','midasPicks','catalogueRefs','links','includeMeta','previousGeneration','fidelityStrength','stylingStrength','clutterStrength','reviewFirst','grounding','roomBrief','whiteMaster'];
export const GUIDE_OUTCOMES=['White BK','Lifestyle','Website','New Composition','Variations','Create with this item'];
// White catalogue image on demand (owner, 20 Oct 2026; WP3 stage A). White BK and Website always make the white image. A job whose
// outcomes need none of it may leave it out when the owner unticks "Also make the white catalogue image" (brief whiteMaster 'no').
export const WHITE_OUTCOMES=['White BK','Website'];
export const whiteRequired=outcomes=>outcomes.some(o=>WHITE_OUTCOMES.includes(o));
export const CAMERAS=['Reference view','Full frontal','Left side','45° right','Right side'];
export const MOODS=['Calm & natural','Warm & inviting','Refined & elegant','Bold & expressive'];
const WALLS=['White','Ivory','Sand','Greige','Taupe','Sage','Charcoal','Terracotta'],FLOORS=['Light oak','Dark walnut','Limestone','Marble'];
// Returns null for a classic desk submission (no Draft 3 page marker); otherwise strictly validated Draft 3 choices.
export function studioFields(input,outcome){
 if(input.page===undefined)return null;
 if(!['draft3','studio'].includes(input.page))throw new Error('invalid_page');   // draft 3 page, or the client-first-page studio
 const s=(key,max,list)=>{const v=input[key]===undefined?'':input[key];if(typeof v!=='string'||v.length>max)throw new Error('invalid_'+key);const x=v.trim();if(list&&x&&!list.includes(x))throw new Error('invalid_'+key);return x;};
 const flag=key=>{const v=input[key]===undefined?'no':input[key];if(!['yes','no'].includes(v))throw new Error('invalid_'+key);return v==='yes';};
 const lines=(key,each,count)=>{const v=s(key,each*count+count);const out=v.split(/\n/).map(x=>x.trim()).filter(Boolean);if(out.length>count||out.some(x=>x.length>each))throw new Error('invalid_'+key);return out;};
 const lighting=input.lighting===undefined?'':input.lighting;
 if(typeof lighting!=='string'||(lighting&&!['Soft daylight','Daylight','Golden afternoon','Warm evening'].includes(lighting)))throw new Error('invalid_choices');
 const out={camera:s('camera',20,input.page==='studio'?CAMERAS:['Reference view','Full frontal','45° right'])||'Reference view',human:flag('human'),studioChoice:flag('studioChoice'),lighting,wallPaint:s('wallPaint',20,WALLS),floor:s('floor',20,FLOORS),
  color:s('color',60),material:s('material',80),locks:lines('locks',160,12),mustNot:lines('mustNot',80,12),department:s('department',80),category:s('category',80),subCategory:s('subCategory',160),description:s('description',1200)};
 if(outcome!=='Lifestyle'&&(out.human||out.studioChoice))throw new Error('invalid_choices');
 out.guide=input.page==='studio'?guideFields(input,outcome,s,flag,lines):{outcomes:[]};
 return out;
}
function guideFields(input,outcome,s,flag,lines){
 const outcomes=lines('outcomes',30,6);
 if(outcomes.some(o=>!GUIDE_OUTCOMES.includes(o))||new Set(outcomes).size!==outcomes.length)throw new Error('invalid_outcomes');
 // The primary outcome stays the desk's two-value field: White background only when nothing but White BK is asked.
 if(outcomes.length&&(outcomes.length===1&&outcomes[0]==='White BK')!==(outcome==='White background'))throw new Error('invalid_outcomes');
 const itemRole=s('itemRole',12,['hero','secondary'])||'hero';
 s('workOn',12,['one_by_one','batch']);
 const series=s('series',20,['Single image','Three views','Views by light']);
 const n=s('variationCount',2,['1','2','3','4'])||'2';
 const picks=lines('midasPicks',40,12),catalogueRefs=lines('catalogueRefs',200,6);
 const mood=s('mood',24,['Automatic',...MOODS]);
 const strength=k=>{const v=s(k,3);if(v&&!/^(\d{1,2}|100)$/.test(v))throw new Error('invalid_'+k);return v===''?null:Number(v);};
 const strengths=Object.fromEntries([['fidelity','fidelityStrength'],['styling','stylingStrength'],['clutter','clutterStrength']].map(([k,f])=>[k,strength(f)]).filter(([,v])=>v!==null));
 const reviewFirst=s('reviewFirst',20,['share_first','proceed_without'])||'share_first',grounding=flag('grounding');
 const validation=reviewFirst==='proceed_without'||grounding?[reviewFirst==='proceed_without'?'Proceed without the description first':'',grounding?'Use semantic grounding':''].filter(Boolean).join('; '):'';
 s('otherOutcome',300);lines('variationAxes',20,3);
 return {outcomes,itemRole,series,variationCount:Number(n),midasPicks:picks,catalogueRefs,links:s('links',300),includeMeta:input.includeMeta===undefined?true:flag('includeMeta'),whiteMaster:input.whiteMaster===undefined?true:flag('whiteMaster'),
  previousGeneration:s('previousGeneration',20,['Space','Look','Space and look']),plants:flag('plants'),mood:mood==='Automatic'?'':mood,strengths,validation,roomBrief:s('roomBrief',600)};
}
export function validateImage(bytes,type) {
 if(bytes.length<16||bytes.length>3*1024*1024)throw new Error('image_size');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!(type==='image/png'&&png||type==='image/jpeg'&&jpeg||type==='image/webp'&&webp))throw new Error('image_type');
}
// Specification files (guide: "Text, PDF or the client's Excel supplies product facts"). A7 reads text, CSV and JSON; it registers PDF and
// Excel but does not read them yet, and says so under "not applied". Photos of a specification sheet are images.
export const SPEC_TYPES=['text/plain','text/csv','application/json','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
export function validateReferenceFile(bytes,type,role) {
 if(role!=='spec'||type.startsWith('image/'))return validateImage(bytes,type);
 if(bytes.length<4||bytes.length>3*1024*1024)throw new Error('file_size');
 if(type==='application/pdf'&&bytes.toString('latin1',0,5)==='%PDF-')return;
 if(type===SPEC_TYPES[4]&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4)return;
 if(['text/plain','text/csv','application/json'].includes(type)){
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('file_type');}
  if(text.includes('\u0000'))throw new Error('file_type');return;
 }
 throw new Error('file_type');
}
export function validateDecision(input,context) {
 if(!input||!requestId(input.requestId)||typeof input.revision!=='string'||input.revision!==context.revision||!context.allowed.includes(input.decision))throw new Error('stale_decision');
 if(typeof input.note!=='string'||input.note.length>1000||input.confirmed!==true)throw new Error('invalid_decision');
 if(input.decision==='change'&&!input.note.trim())throw new Error('change_note_required');
 return {id:context.clientId,run_id:context.runId,round:context.round,decision:input.decision,note:input.note.trim()};
}
// The first immutable claim wins across function instances. Unknown outcomes are never retried automatically.
export async function claimOnce(store,key,fingerprint) {
 const result=await store.setJSON('claims/'+key,{fingerprint,at:new Date().toISOString()},{onlyIfNew:true});
 if(result.modified)return true;
 const old=await store.get('claims/'+key,{type:'json',consistency:'strong'});
 if(old?.fingerprint!==fingerprint)throw new Error('request_conflict');
 return false;
}

// A decision A7 did not confirm (a failed or timed-out call, or a refusal) is not kept as claimed, so the same decision can be sent
// again. That is safe: A7's ticket is single-use, and once A7 records a decision the ticket's revision changes, so a resend after a
// lost answer is refused as stale and never applied twice. An accepted decision keeps its claim and receipt (a repeat gets the receipt).
export async function releaseClaim(store,key){try{await store.delete('claims/'+key);return true;}catch{return false;}}
export const DECISION_UNCONFIRMED='A7 did not confirm this decision. Refresh the job: if the ticket is still open, decide again. A decision A7 already applied is never applied twice.';

// A saved draft is an edit when it continues a saved version or was started as an edit of a new item.
// A7 receives the edit as data, not only inside the instructions: what to change, what to keep and
// which saved version it starts from. Returns null for a new project.
export function editRequest(draft){
 if(!draft?.parent_id&&draft?.brief?.editSource!=='new')return null;
 let options=[];try{options=editOptionsOf(draft.brief?.editOptions);}catch{options=[];}
 return {source:draft.parent_id?'saved':'new',changes:draft.brief?.allowedChanges||'',preserve:draft.brief?.protectedDetails||'',parentVersionId:draft.parent_id||null,options};
}

// Owner-facing wording for edit drafts the dispatch check refuses. Both are fixable by the owner,
// so they are answered as conflicts rather than as an unavailable service.
export const EDIT_DISPATCH_HELP=Object.freeze({
 edit_instructions_required:'An edit needs both what to change and what to keep, each up to 600 characters. Fill in both, save the draft and send it again. Nothing was sent to A7.',
 saved_version_required:'This edit is not linked to a saved version. Open the saved result you want to change and start the edit from there. Nothing was sent to A7.',
 result_asset_required:'The approved image this edit starts from is not one of the earlier version\'s recorded images. Open that version, choose Edit this result again and save the edit. Nothing was sent to A7.'
});

// Owner-facing wording for the refusals of a decision or a send. Each one is definite: nothing reached A7, so the owner can fix
// the cause and try again (owner-actions.mjs). A code the owner cannot act on keeps the generic wording.
export const DECISION_HELP=Object.freeze({
 stale_decision:'This approval ticket changed or expired after the job was opened. Refresh the job, check the new ticket and decide again. Nothing was sent to A7.',
 change_note_required:'Describe the plan changes in the note before sending. Nothing was sent to A7.',
 invalid_decision:'This decision is not one the ticket allows, or its note is longer than 1,000 characters. Refresh the job and decide again. Nothing was sent to A7.',
 legacy_budget_missing:'This run started before the site kept a spending ledger, so paid steps cannot continue from here. You can still stop it; to try again, save the version again and send a new job.',
 budget_storage_unavailable:'The spending ledger is unavailable just now, so no paid step can be approved. Try again in a minute; you can still stop the run.',
 edit_flow_not_ready:'Adding, removing or replacing a piece cannot be sent yet. Your edit stays saved. Nothing was sent to A7.',
 invalid_request:'The site refused this request as incomplete. Refresh the page, then try again. Nothing was sent to A7.'
});
// validateSubmission's field codes, in words (also used for the estimate's send blockers).
export const SUBMIT_HELP=Object.freeze({
 invalid_outcome:'Tick White BK or Lifestyle under What to create, then save.',
 invalid_product:'Enter the product type, then save.',
 invalid_inventory:'Enter each physical piece on its own line as a quantity and a name, such as "1 sofa" (at most 20 lines), then save.',
 invalid_instructions:'The direction is longer than 1,200 characters. Shorten the notes under Notes for the studio, then save.',
 invalid_dimensions:'The dimensions are longer than 120 characters. Shorten them under Look and settings, then save.',
 invalid_sku:'The SKU is longer than 40 characters. Shorten it, then save.',
 invalid_choices:'The image shape, resolution, view or lighting is not one A7 accepts. Check them under Look and settings, then save.',
 invalid_budget:'Set a job budget from USD 0.25 to USD 10.00 in cents under The product, then save.',
 invalid_outcomes:'The chosen outcomes do not match: White background needs White BK alone. Check the outcomes under What to create, then save.',
 invalid_page:'This version was saved by an older page. Save it again from this page.'
});
const SEND_HELP={
 not_found:()=>'This saved version was not found for this account. Refresh saved work and open it again. Nothing was sent to A7.',
 draft_required:()=>'Save the draft before sending. Nothing was sent to A7.',
 draft_changed:()=>'This saved version changed after its estimate (in another tab, or by a later save). Open it again, get the estimate again and send. Nothing was sent to A7.',
 draft_already_submitted:()=>'This saved version was already sent to A7. Follow it in Jobs: Go 1 appears there when A7 has finished reading and planning. Nothing was sent again.',
 confirmed_inventory_mismatch:d=>Number.isInteger(d?.pieces)&&Number.isInteger(d?.confirmed)?`The pieces saved with this version add up to ${d.pieces}, but the confirmed count is ${d.confirmed}. Change the pieces so they add up to ${d.confirmed}, save, get the estimate again and send. Nothing was sent to A7.`:'This version has no product type or pieces in the form "1 sofa", one per line, so they cannot be checked against the confirmed count. Fill them in, save, get the estimate again and send. Nothing was sent to A7.',
 batch_dispatch:()=>'A collection is sent one product at a time. Open each product\'s saved version and send it on its own. Nothing was sent to A7.',
 hero_product_reference:()=>'A secondary product needs the hero product it supports, and this site cannot send that yet. Choose Main item (hero) under Type of work and save the originals as a new version. Nothing was sent to A7.',
 source_confirmation_required:()=>'Current confirmed source facts are required before planning. Confirm them under Check the photos, then send. Nothing was sent to A7.',
 source_verification_unavailable:()=>'The confirmed source facts could not be checked just now. Try again in a minute. Nothing was sent to A7.',
 send_check_unavailable:()=>'This send could not be checked just now because of a storage or service error. Try again in a minute. Nothing was sent to A7.'
};
// A7 answered the send but did not take it. A 4xx answer from its intake is a definite refusal ("not started": nothing was read
// or paid by this send); anything else leaves the outcome unknown. problems are A7's own client-safe reasons, when the bridge
// passes them on; they are kept short and plain.
export function a7SendRefusal(result){
 const status=Number.isInteger(result?.upstreamStatus)?result.upstreamStatus:null;
 if(result?.accepted===true||result?.receiptKind!=='rejected'||!(status>=400&&status<500))return null;
 const problems=(Array.isArray(result.problems)?result.problems:[]).filter(p=>typeof p==='string'&&p.trim()).slice(0,10).map(p=>p.trim().slice(0,300));
 const why=problems.length?' A7 said: '+problems.join(' ')+'.':result.error?' A7 gave the reason '+String(result.error).replace(/_/g,' ')+'.':' A7 gave no reason this site can show.';
 return {accepted:false,refused:true,error:'a7_refused',upstreamStatus:status,problems,message:`A7 refused to start this job (answer ${status}).${why.replace(/\.\.$/,'.')} Nothing was read or paid by this send, and the saved version is a draft again: fix it, get the estimate again and send.`};
}
// The refusal of a send whose saved version, source facts or route are not ready (owner-actions.mjs).
export function sendRefusal(code,detail){
 if(EDIT_DISPATCH_HELP[code])return {status:409,body:{error:code,message:EDIT_DISPATCH_HELP[code]}};
 const known=['not_found','draft_changed','draft_already_submitted','draft_required','confirmed_inventory_mismatch','batch_dispatch','hero_product_reference'];
 const missing=['source_confirmation_required','analysis_confirmation_stale','invalid_route_case','source_roles_unresolved'];
 const reason=known.includes(code)?code:missing.includes(code)?'source_confirmation_required':code==='source_verification_unavailable'?code:'send_check_unavailable';
 // An unexpected error is logged by its code (never the job), instead of being shown as a source-facts problem.
 if(reason==='send_check_unavailable')console.error('owner-actions','send check failed',String(code).slice(0,120));
 return {status:['source_verification_unavailable','send_check_unavailable'].includes(reason)?503:409,body:{error:reason,message:SEND_HELP[reason](detail)}};
}
