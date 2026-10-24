import {validateSubmission,SUBMIT_HELP,EDIT_DISPATCH_HELP} from './a7-actions.mjs';
import {bridgeShape} from './a7-bridge-shape.mjs';

// Whether a saved version can be sent, judged by the checks owner-actions.mjs runs at send, in the same order and on the same saved
// record: validateSubmission on the saved brief, the route, the edit texts, the saved references and the estimate. The page uses the
// list for Review paid submission and its explanation, so it no longer guesses from what the page shows. Source facts and the pieces
// against the confirmed count are checked by the page from the source review it already holds (and by the server at send).
const SAMPLE_REQUEST='00000000-0000-4000-8000-000000000000';
export function sendBlockers(draft,refs,{estimate,paidReady=false,testMode=false,multiReference=false}={}){
 const b=draft?.brief||{},out=[],add=(code,message)=>{if(!out.some(x=>x.code===code))out.push({code,message});};
 try{validateSubmission({...b,requestId:SAMPLE_REQUEST,draftId:draft.id,instructions:String(draft.note||draft.direction||''),confirmed:true});}
 catch(error){add(error.message,SUBMIT_HELP[error.message]||'A saved choice is not one A7 accepts. Check the settings under Look and settings, then save.');}
 const edit=Boolean(draft.parent_id)||b.editSource==='new'||b.routeIntent==='edit';
 if(b.routeIntent==='single'&&b.routeChoice==='secondary')add('hero_product_reference','A secondary product needs the hero product it supports, and this site cannot send that yet. Choose Main item (hero) under Type of work and save the originals as a new version.');
 if(b.routeIntent==='edit'&&b.routeChoice==='saved'&&!draft.parent_id)add('saved_version_required',EDIT_DISPATCH_HELP.saved_version_required);
 if(edit&&(!String(b.allowedChanges||'').trim()||!String(b.protectedDetails||'').trim()))add('edit_instructions_required',EDIT_DISPATCH_HELP.edit_instructions_required);
 if(b.resultAssetId&&!draft.parent_id)add('result_asset_required',EDIT_DISPATCH_HELP.result_asset_required);
 if(!refs.some(r=>r.role==='product')||(b.startType==='existing_room'&&!refs.some(r=>r.role==='room')))add('required_reference_missing','Save the required product and room references first.');
 if(refs.length!==1&&!multiReference)add('bridge_single_reference',`The A7 owner bridge forwards one product image per job, and this version has ${refs.length} saved references. Save a new version with only the product photo, or wait for the bridge update.`);
 const shape=refs.length?bridgeShape(refs):null;if(shape)add('bridge_reference_limits',shape.replace(/ Nothing was sent\.$/,''));
 if(String(b.outcomes||'').split('\n').includes('Variations'))add('variations_not_available','A7 cannot make Variations yet: they start from an approved result image, which A7 does not keep for earlier runs. Remove Variations under What to create and save.');
 if(estimate&&!(estimate.status==='verified'||testMode&&estimate.status==='provisional'))add('estimate_not_verified','This scope has no calibrated cost yet, so it can be saved but not sent.');
 if(!paidReady)add('paid_guards_not_ready','Paid steps are paused on this site, so nothing can be sent yet. Your draft stays saved.');
 return out;
}

// What makes a saved version impossible to send, known before the owner pays for its source reading: the reading is quoted and paid
// for its own sake, so these are said in the analysis cost confirmation (owner-source-understanding.mjs, quote). A secondary product
// is refused outright (the reading is never needed); the others are warnings, since the version can still be changed and saved.
export function scopeWarnings(source,{multiReference=false}={}){
 const out=[],scope=source?.scope||{};
 if(String(scope.outcomes||'').split('\n').includes('Variations'))out.push('Variations cannot be sent yet: they start from an approved result image, which A7 does not keep for earlier runs. Remove Variations under What to create before paying for this reading if you want to send this version.');
 if(Number(scope.references)>1&&!multiReference)out.push(`This version has ${scope.references} saved photos, and the A7 connection forwards one product image per job. It can be read, but not sent until the connection is updated; save a version with only the product photo to send it.`);
 return out;
}
