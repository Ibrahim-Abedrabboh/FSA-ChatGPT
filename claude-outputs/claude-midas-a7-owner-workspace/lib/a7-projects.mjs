import {randomUUID} from 'node:crypto';
import {transaction} from './a7-budget.mjs';
import {requestId,digest,canonical,STUDIO_KEYS,GUIDE_KEYS} from './a7-actions.mjs';
import {categoryCode,categoryLabel,categorySingular,formatRef} from './a7-naming.mjs';
import {editOptionsOf} from './a7-edit-options.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';
export const DRAFT_BRIEF_KEYS=['product','sku','outcome','view','aspect','resolution','lighting','dimensions','inventory','budgetUsd','startType','editSource','allowedChanges','protectedDetails','editOperation','editTarget','editPlacement','resultAssetId','editBaseKind','editOptions','routeIntent','routeChoice',...STUDIO_KEYS,...GUIDE_KEYS];
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('invalid_project');return v.trim();};
// Project and product names are optional: blank ones are named automatically when the draft is saved.
const optional=(v,max)=>{if(v===undefined||v===null||v==='')return '';if(typeof v!=='string'||v.length>max)throw Error('invalid_project');return v.trim();};
export function validateDraft(input){
 if(!input||!requestId(input.requestId)||!['project','collection','edit'].includes(input.mode))throw Error('invalid_project');
 if(input.brief?.startType&&!['product_collection','existing_room','new_space','saved_project'].includes(input.brief.startType))throw Error('invalid_project');
 if(input.brief?.startType==='saved_project'&&(!input.parentId||input.mode!=='edit'))throw Error('parent_required');
 if(input.brief?.editOperation&&!['change','add','remove','replace'].includes(input.brief.editOperation))throw Error('invalid_project');
 if(input.mode==='edit'&&['add','remove','replace'].includes(input.brief?.editOperation)&&(typeof input.brief?.editTarget!=='string'||!input.brief.editTarget.trim()))throw Error('edit_target_required');
 // Edit phase 2.3: the options picked in the edit panel, as "kind=value|kind=value" (edit-options.js).
 if(input.brief?.editOptions!==undefined){if(input.mode!=='edit')throw Error('invalid_project');try{editOptionsOf(input.brief.editOptions);}catch{throw Error('invalid_project');}}
 // Edit phase 2.1: an edit of a saved version may name the approved image it starts from.
 if(input.brief?.resultAssetId!==undefined&&(!requestId(input.brief.resultAssetId)||input.mode!=='edit'||!input.parentId))throw Error('invalid_project');
 // Scenes from an approved white image (20 Oct 2026): the approved image is a white master, so A7 makes new scenes from it.
 if(input.brief?.editBaseKind!==undefined&&(input.brief.editBaseKind!=='white'||input.brief.resultAssetId===undefined||input.brief.editOptions!==undefined))throw Error('invalid_project');
 for(const key of ['allowedChanges','protectedDetails','editOperation','editTarget','editPlacement'])if(input.brief?.[key]!==undefined&&(typeof input.brief[key]!=='string'||input.brief[key].length>600))throw Error('invalid_project');
 const title=optional(input.title,120),caseTitle=optional(input.caseTitle,120),note=text(input.note,1200);
 for(const k of ['projectId','parentId'])if(input[k]&&!requestId(input[k]))throw Error('invalid_project');
 if(input.mode==='edit'&&input.editSource!=='new'&&!input.parentId)throw Error('parent_required');
 if(input.mode!=='edit'&&input.parentId)throw Error('invalid_project');
 if(input.directionMode!==undefined&&(input.directionMode!=='replace'||input.mode!=='edit'||!input.parentId||input.editSource==='new'))throw Error('invalid_project');
 const brief=input.brief||{};if(typeof brief!=='object'||Array.isArray(brief)||JSON.stringify(brief).length>9000)throw Error('invalid_project');
 validRoute(brief);
 const allowed=DRAFT_BRIEF_KEYS;
 return {requestId:input.requestId,mode:input.mode,title,caseTitle,note,projectId:input.projectId||null,parentId:input.parentId||null,editSource:input.editSource==='new'?'new':'saved',...(input.directionMode?{directionMode:input.directionMode}:{}),brief:Object.fromEntries(allowed.filter(k=>typeof brief[k]==='string'||typeof brief[k]==='number').map(k=>[k,brief[k]]))};
}
// One wording for the owner's note plus the edit fields, used on save and on revision, so a saved
// edit never loses what to change and what to keep. A7 cuts instructions at 1200 characters, which is
// why the callers refuse a longer direction instead of letting it be truncated.
export function draftDirection(note,brief,isEdit){
 return [note,isEdit&&brief.editOperation?'Edit action: '+brief.editOperation:'',brief.editTarget?'Target instance: '+brief.editTarget:'',brief.editPlacement?'Placement: '+brief.editPlacement:'',brief.allowedChanges?'Requested changes: '+brief.allowedChanges:'',brief.protectedDetails?'Preserve: '+brief.protectedDetails:''].filter(Boolean).join('\n');
}
const validRoute=brief=>{if(brief.routeIntent!==undefined&&!['project','edit','single'].includes(brief.routeIntent)||brief.routeChoice!==undefined&&!['one','collection','saved','new','hero','secondary'].includes(brief.routeChoice))throw Error('invalid_project');};
// A draft can gain owner-confirmed facts and preferences before dispatch without
// changing its original-reference version. A request ID makes interrupted PATCHes idempotent.
// guard({before,after}) sees the saved and the revised direction and may refuse the change (by throwing)
// before it is written; owner-projects uses it to keep a running source reading from being discarded.
export async function reviseDraft(pool,ownerId,id,input,{guard}={}){
 if(!requestId(id)||!requestId(input?.requestId)||!(/^[a-f0-9]{64}$/.test(input?.expectedFingerprint||'')))throw Error('invalid_project');
 const note=text(input.note,1200),brief=input.brief;
 if(!brief||typeof brief!=='object'||Array.isArray(brief)||JSON.stringify(brief).length>9000)throw Error('invalid_project');
 if(Object.keys(brief).some(k=>!DRAFT_BRIEF_KEYS.includes(k))||Object.values(brief).some(v=>typeof v!=='string'&&typeof v!=='number'))throw Error('invalid_project');
 validRoute(brief);
 if(brief.editOptions!==undefined){try{editOptionsOf(brief.editOptions);}catch{throw Error('invalid_project');}}
 if(brief.editBaseKind!==undefined&&(brief.editBaseKind!=='white'||brief.editOptions!==undefined))throw Error('invalid_project');
 const nextFingerprint=digest(canonical({id,requestId:input.requestId,brief,note}));
 return transaction(pool,async db=>{
  const {rows:[v]}=await db.query('SELECT * FROM a7_job_versions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId]);
  if(!v)throw Error('not_found');
  if(v.fingerprint===nextFingerprint)return {saved:true,draft:v};
  if(v.fingerprint!==input.expectedFingerprint||v.dispatch_state!=='draft'||v.client_run_id)throw Error('draft_changed');
  if(v.brief?.routeIntent!==brief.routeIntent||v.brief?.routeChoice!==brief.routeChoice||v.brief?.editSource!==brief.editSource||v.brief?.resultAssetId!==brief.resultAssetId||v.brief?.editBaseKind!==brief.editBaseKind)throw Error('route_changed');
  // The source reading opened this version's job budget. A lower one is refused at send (budget_lowered), so it is refused here,
  // when the owner can still keep or raise it, instead of after estimating.
  const {rows:[opened]}=await db.query('SELECT limit_micro_usd FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2',[sharedRunIdentity(id).clientRunId,ownerId]);
  if(opened&&brief.budgetUsd!==undefined&&Math.round(Number(brief.budgetUsd)*1e6)<Number(opened.limit_micro_usd))throw Object.assign(Error('budget_lowered'),{detail:{floorUsd:Number(opened.limit_micro_usd)/1e6}});
  const own=draftDirection(note,brief,Boolean(v.parent_id)||brief.editSource==='new'),cut=v.parent_id&&v.direction?.startsWith('Saved direction: ')?v.direction.indexOf('\nAmendment: '):-1;
  const direction=cut>0?v.direction.slice(0,cut)+'\nAmendment: '+own:own;
  if(direction.length>1200)throw Error('direction_too_long');
  if(guard)await guard({before:v.direction||v.note,after:direction||note});
  const {rows:[draft]}=await db.query('UPDATE a7_job_versions SET note=$3,brief=$4,fingerprint=$5,direction=$6 WHERE id=$1 AND owner_id=$2 RETURNING *',[id,ownerId,note,JSON.stringify(brief),nextFingerprint,direction]);
  return {saved:true,draft};
 });
}
// base_file_name: the file name of the approved image an edit starts from (brief.resultAssetId), this owner's only.
export async function listProjects(pool,ownerId){
 const {rows}=await pool.query("SELECT p.id,p.title,p.kind,p.created_at,v.id AS version_id,v.case_id,v.version,v.parent_id,v.note,v.direction,v.brief,v.fingerprint,v.client_run_id,v.dispatch_state,v.run_id,v.dispatch_changed_at,v.created_at AS version_created_at,c.title AS case_title,c.ref AS case_ref,c.category AS case_category,ra.file_name AS base_file_name FROM a7_projects p LEFT JOIN a7_cases c ON c.project_id=p.id LEFT JOIN a7_job_versions v ON v.case_id=c.id LEFT JOIN a7_result_assets ra ON ra.owner_id=p.owner_id AND ra.id::text=v.brief->>'resultAssetId' WHERE p.owner_id=$1 ORDER BY p.created_at DESC,c.created_at,v.version DESC LIMIT 300",[ownerId]);return {records:rows};
}
export async function saveDraft(pool,ownerId,raw){
 const input=validateDraft(raw),fingerprint=digest(JSON.stringify(input));
 return transaction(pool,async db=>{
  const {rows:[old]}=await db.query('SELECT * FROM a7_job_versions WHERE id=$1',[input.requestId]);
  if(old){if(old.owner_id!==ownerId||old.fingerprint!==fingerprint)throw Error('draft_conflict');const {rows:[c]}=await db.query('SELECT project_id,ref FROM a7_cases WHERE id=$1',[old.case_id]);return {saved:true,draft:old,projectId:c?c.project_id:null,ref:c?.ref||null};}
  let projectId=input.projectId,caseId=randomUUID(),version=1,direction=draftDirection(input.note,input.brief,input.mode==='edit');
  if(input.mode==='edit'&&input.parentId){
   const {rows:[parent]}=await db.query('SELECT v.*,c.project_id FROM a7_job_versions v JOIN a7_cases c ON c.id=v.case_id WHERE v.id=$1 AND v.owner_id=$2 FOR UPDATE',[input.parentId,ownerId]);if(!parent)throw Error('not_found');
   if(projectId&&projectId!==parent.project_id)throw Error('not_found');
   if(input.brief.resultAssetId){const {rows:[asset]}=await db.query('SELECT id,kind FROM a7_result_assets WHERE id=$1 AND owner_id=$2 AND version_id=$3',[input.brief.resultAssetId,ownerId,parent.id]);if(!asset||(asset.kind==='white')!==(input.brief.editBaseKind==='white'))throw Error('result_asset_required');}projectId=parent.project_id;caseId=parent.case_id;direction=input.directionMode==='replace'?direction:'Saved direction: '+(parent.direction||parent.note)+'\nAmendment: '+direction;
   await db.query('SELECT id FROM a7_cases WHERE id=$1 FOR UPDATE',[caseId]);
   const {rows:[n]}=await db.query('SELECT COALESCE(MAX(version),0)+1 AS next FROM a7_job_versions WHERE case_id=$1',[caseId]);version=Number(n.next);
  }else{
   // New product: one reference per owner, category and month from an atomic counter, so concurrent saves never share it.
   const category=categoryCode(input.caseTitle,input.brief.product,input.title);
   const {rows:[clock]}=await db.query("SELECT to_char(now() AT TIME ZONE 'Asia/Amman','YYMM') AS yymm,to_char(now() AT TIME ZONE 'Asia/Amman','FMMonth YYYY') AS month");
   const prefix=category+'-'+clock.yymm;
   const {rows:[counter]}=await db.query('INSERT INTO a7_case_ref_counters(owner_id,prefix,last_value) VALUES($1,$2,1) ON CONFLICT (owner_id,prefix) DO UPDATE SET last_value=a7_case_ref_counters.last_value+1 RETURNING last_value',[ownerId,prefix]);
   const ref=formatRef(prefix,counter.last_value),caseTitle=input.caseTitle||`Unnamed ${categorySingular(category)}`;
   if(projectId){const {rows:[p]}=await db.query('SELECT id,kind FROM a7_projects WHERE id=$1 AND owner_id=$2',[projectId,ownerId]);if(!p||p.kind!=='collection')throw Error('not_found');}
   else {projectId=randomUUID();await db.query('INSERT INTO a7_projects(id,owner_id,title,kind) VALUES($1,$2,$3,$4)',[projectId,ownerId,input.title||`${categoryLabel(category)} · ${clock.month}`,input.mode==='edit'?'project':input.mode]);}
   await db.query('INSERT INTO a7_cases(id,project_id,owner_id,title,ref,category) VALUES($1,$2,$3,$4,$5,$6)',[caseId,projectId,ownerId,caseTitle,ref,category]);
  }
  if(direction.length>1200)throw Error('direction_too_long');
  const {rows:[draft]}=await db.query('INSERT INTO a7_job_versions(id,case_id,owner_id,version,parent_id,note,brief,fingerprint,direction) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[input.requestId,caseId,ownerId,version,input.parentId,input.note,JSON.stringify(input.brief),fingerprint,direction]);
  if(input.parentId)await db.query('INSERT INTO a7_version_references(version_id,reference_id,role,blob_key,sha256,mime,bytes) SELECT $1,reference_id,role,blob_key,sha256,mime,bytes FROM a7_version_references WHERE version_id=$2',[draft.id,input.parentId]);
  const {rows:[named]}=await db.query('SELECT ref FROM a7_cases WHERE id=$1',[caseId]);
  return {saved:true,draft,projectId,ref:named?.ref||null};
 });
}
export async function claimDraft(pool,ownerId,id,clientId,brief,note,confirm=true){
 if(!requestId(id))throw Error('draft_required');
 return transaction(pool,async db=>{
 const {rows:[v]}=await db.query('SELECT * FROM a7_job_versions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId]);if(!v)throw Error('not_found');
 if(digest(canonical(v.brief))!==digest(canonical(brief))||v.note!==note)throw Error('draft_changed');
 if(v.client_run_id&&v.client_run_id!==clientId)throw Error('draft_already_submitted');
 // A sent version is never sent again: a second run would compete for the same
 // single-use source proof and overwrite the first run's record.
 if(!confirm&&v.dispatch_state!=='draft')throw Error('draft_already_submitted');
 if(confirm)await db.query("UPDATE a7_job_versions SET client_run_id=$2,dispatch_state='confirmed',dispatch_changed_at=now() WHERE id=$1 AND (client_run_id IS NULL OR client_run_id=$2) AND dispatch_state IN ('draft','confirmed')",[id,clientId]);return v;
 });
}
// A7 refused to start the job at its intake (an answer of 4xx): nothing was read, generated or paid by that send, so the
// version is a draft again and can be fixed and sent. Only a version this send left unsettled is reopened.
export async function reopenRefusedDraft(pool,ownerId,id){await pool.query("UPDATE a7_job_versions SET dispatch_state='draft',client_run_id=NULL,run_id=NULL,dispatch_changed_at=now() WHERE id=$1 AND owner_id=$2 AND dispatch_state IN ('confirmed','sending','outcome_unknown')",[id,ownerId]);}
// Only one send of a version may call A7: right before the call it moves the version from 'confirmed' to 'sending' in the
// database. A second, overlapping send finds no 'confirmed' row and stops, so the same job is never sent twice (rule 22).
export async function markSending(pool,ownerId,id,clientId){const {rowCount}=await pool.query("UPDATE a7_job_versions SET dispatch_state='sending',dispatch_changed_at=now() WHERE id=$1 AND owner_id=$2 AND dispatch_state='confirmed' AND client_run_id=$3",[id,ownerId,clientId]);return rowCount>0;}
// A send that failed before reaching A7 reopens a version only while it is still 'confirmed': once any send has moved it to
// 'sending' (or further) it is never reopened here. An overlapping send then finds the version reopened and stops at markSending.
export async function reopenUnsentDraft(pool,ownerId,id,clientId){const {rowCount}=await pool.query("UPDATE a7_job_versions SET dispatch_state='draft',client_run_id=NULL,run_id=NULL,dispatch_changed_at=now() WHERE id=$1 AND owner_id=$2 AND dispatch_state='confirmed' AND client_run_id=$3",[id,ownerId,clientId]);return rowCount>0;}
export async function recordDraftReceipt(pool,ownerId,id,state,runId=null){await pool.query('UPDATE a7_job_versions SET dispatch_state=$3,run_id=$4,dispatch_changed_at=now() WHERE id=$1 AND owner_id=$2',[id,ownerId,state,runId]);}

export async function draftReferences(pool,ownerId,id){
 if(!requestId(id))throw Error('not_found');
 const {rows:[v]}=await pool.query('SELECT id FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[id,ownerId]);if(!v)throw Error('not_found');
 const {rows}=await pool.query('SELECT reference_id,role,blob_key,sha256,mime,bytes FROM a7_version_references WHERE version_id=$1 ORDER BY role,reference_id',[id]);return rows;
}
export async function attachReference(pool,ownerId,id,ref,persist){
 return transaction(pool,async db=>{
 const {rows:[v]}=await db.query('SELECT id,dispatch_state FROM a7_job_versions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId]);if(!v||v.dispatch_state!=='draft')throw Error('not_found');
 const {rows:[old]}=await db.query('SELECT sha256 FROM a7_version_references WHERE version_id=$1 AND role=$2 AND sha256=$3',[id,ref.role,ref.sha256]);
 if(old)return;
 const {rows:[total]}=await db.query('SELECT count(*) AS n FROM a7_version_references WHERE version_id=$1',[id]);if(Number(total.n)>=12)throw Error('reference_limit');
 // Keep duplicate/limit checks and the file write inside the version lock.
 // A rejected or inherited duplicate must never create an unused blob.
 const {rows:added}=await db.query('INSERT INTO a7_version_references(version_id,role,blob_key,sha256,mime,bytes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (version_id,role,sha256) DO NOTHING RETURNING reference_id',[id,ref.role,ref.blob_key,ref.sha256,ref.mime,ref.bytes]);
 if(added.length&&persist)await persist();
 });
}
// Owner-facing wording for a refused save or revision (owner-projects.mjs). Every one is definite: nothing was saved.
export const PROJECT_HELP=Object.freeze({
 invalid_project:'The site refused these details as invalid. Check the product details, settings and notes, then save again. Nothing was saved.',
 parent_required:'An edit must start from a saved version. Open it from Saved work first, then save. Nothing was saved.',
 edit_target_required:'Name the piece to add, remove or replace, then save again. Nothing was saved.',
 direction_too_long:'The direction together with what to change and what to keep is longer than 1,200 characters, the most A7 reads. Shorten it, then save again. Nothing was saved.',
 draft_conflict:'This save was already used for different content. Save again; a new request is made. Nothing was saved.',
 draft_changed:'This saved version changed since this page loaded it (in another tab, or by an earlier save), or it was already sent. Open it again from Saved work, then save. Nothing was saved.',
 route_changed:'The work type or route differs from the saved version, which keeps the route it was saved with. Save the originals as a new version instead. Nothing was saved.',
 result_asset_required:'The approved image this edit starts from is not one of the earlier version\'s recorded images. Open that version, choose Edit this result again and save the edit. Nothing was saved.',
 analysis_running:'The source reading for this version is still running. Wait until its readings arrive (under Check the photos) before changing the direction; saving the change now would discard the reading you are paying for. Nothing was saved.',
 not_found:'The saved version was not found for this account. Refresh saved work and open it again. Nothing was saved.',
 budget_lowered:'The job budget is lower than the one this version\'s source reading already opened. Keep it the same or raise it, then save. Nothing was saved.',
 project_storage_unavailable:'Saved work is unavailable just now. Try again in a minute; nothing was saved.'
});
export function projectRefusal(code,detail){
 const known=Object.keys(PROJECT_HELP).filter(k=>k!=='project_storage_unavailable'),error=known.includes(code)?code:'project_storage_unavailable';
 const message=error==='budget_lowered'&&Number.isFinite(detail?.floorUsd)?`This version's source reading opened its job budget at USD ${detail.floorUsd.toFixed(2)}. Keep the budget at USD ${detail.floorUsd.toFixed(2)} or raise it, then save. Nothing was saved.`:PROJECT_HELP[error];
 return {status:error==='not_found'?404:known.includes(code)?409:503,body:{error,message,...(error==='budget_lowered'&&detail?{floorUsd:detail.floorUsd}:{})}};
}
