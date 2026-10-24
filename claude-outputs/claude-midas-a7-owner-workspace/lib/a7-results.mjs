import {randomUUID} from 'node:crypto';
import {requestId} from './a7-actions.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';

// Edit phase 2.1: the images the owner approved in a run, as A7 recorded them (Google Drive file id and
// checksum). The site keeps them so an edit can name the exact image it starts from. Approved lifestyle scenes are kept, and
// (20 Oct 2026) the approved white master of a finished white package, so a new job can make its scenes from it.
const OUTPUT=/^[a-z0-9_]{1,60}$/,DRIVE=/^[A-Za-z0-9_-]{10,200}$/,SHA=/^[a-f0-9]{64}$/,PX=/^\d{2,5}x\d{2,5}$/;
const KIND=r=>r.kind==='scene'||(r.kind==='white'&&r.outputId==='white_master');
export function cleanResults(list){
 return (Array.isArray(list)?list:[]).filter(r=>r&&typeof r==='object'&&KIND(r)&&OUTPUT.test(r.outputId||'')&&DRIVE.test(r.driveFileId||'')&&SHA.test(r.sha256||'')).slice(0,30)
  .map(r=>({outputId:r.outputId,kind:r.kind,driveFileId:r.driveFileId,sha256:r.sha256,px:PX.test(r.px||'')?r.px:null,fileName:typeof r.fileName==='string'?r.fileName.slice(0,160):null,reviewed:r.reviewed!==false,approvedAt:typeof r.approvedAt==='string'&&!Number.isNaN(Date.parse(r.approvedAt))?new Date(r.approvedAt).toISOString():null}));
}
// The saved version a run belongs to: owner runs are named after the version they were sent from. A run sent before that naming
// (17-18 Oct 2026) is found by the A7 run id its send receipt recorded.
function versionOfRun(runId){const m=/^claude-a7-([a-f0-9-]{36})$/.exec(runId||'');return m&&requestId(m[1])&&sharedRunIdentity(m[1]).runId===runId?m[1]:null;}
async function ownVersionOfRun(pool,ownerId,runId){
 const named=versionOfRun(runId);
 if(named){const {rows:[v]}=await pool.query('SELECT id FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[named,ownerId]);return v?v.id:null;}
 if(!/^claude-a7-[A-Za-z0-9-]{6,80}$/.test(runId||''))return null;
 const {rows}=await pool.query('SELECT id FROM a7_job_versions WHERE run_id=$1 AND owner_id=$2',[runId,ownerId]);
 return rows.length===1?rows[0].id:null;
}
const asAsset=r=>({assetId:r.id,versionId:r.version_id,runId:r.run_id,outputId:r.output_id,kind:r.kind,sha256:r.sha256,px:r.px,fileName:r.file_name,reviewed:r.reviewed,approvedAt:r.approved_at?new Date(r.approved_at).toISOString():null});
// Records each approved image once and returns every recorded image of that version. A run that does not
// belong to one of this owner's saved versions records nothing.
export async function recordResults(pool,ownerId,runId,results){
 const versionId=await ownVersionOfRun(pool,ownerId,runId);if(!versionId)return [];
 for(const r of cleanResults(results))await pool.query('INSERT INTO a7_result_assets(id,owner_id,version_id,run_id,output_id,kind,drive_file_id,sha256,px,file_name,reviewed,approved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (version_id,output_id,sha256) DO NOTHING',[randomUUID(),ownerId,versionId,runId,r.outputId,r.kind,r.driveFileId,r.sha256,r.px,r.fileName,r.reviewed,r.approvedAt]);
 return versionResults(pool,ownerId,versionId);
}
export async function versionResults(pool,ownerId,versionId){
 if(!requestId(versionId))return [];
 const {rows}=await pool.query('SELECT * FROM a7_result_assets WHERE owner_id=$1 AND version_id=$2 ORDER BY approved_at NULLS LAST,output_id',[ownerId,versionId]);
 return rows.map(asAsset);
}
// One recorded image of this owner, with its Drive file id for A7. Never another owner's.
export async function resultAsset(pool,ownerId,assetId){
 if(!requestId(assetId))throw Error('result_asset_required');
 const {rows:[r]}=await pool.query('SELECT * FROM a7_result_assets WHERE id=$1 AND owner_id=$2',[assetId,ownerId]);
 if(!r)throw Error('result_asset_required');
 return {...asAsset(r),driveFileId:r.drive_file_id};
}
// The A7 run an edit continues. A send whose receipt was never recorded leaves run_id empty, yet every run sent from this site is
// named after its version (sharedRunIdentity): when the parent was sent from here (its client_run_id is its own), the name is derived,
// so such an edit is not refused for ever. A parent that was never sent has no run.
export function parentRunIdOf(parent){
 if(!parent||!requestId(parent.id))return null;
 if(parent.run_id)return parent.run_id;
 const identity=sharedRunIdentity(parent.id);
 return parent.client_run_id===identity.clientRunId?identity.runId:null;
}
// Edit phase 2.4: the receipt of the approved image an edit starts from, as A7 receives it (edit.base). The image must be
// one of this owner's recorded images of the version the edit continues, and come from that version's own A7 run. A7
// checks it again against its own run record before it uses it.
export async function editBase(pool,ownerId,draft,parentRunId){
 const a=await resultAsset(pool,ownerId,draft?.brief?.resultAssetId);
 if(!draft.parent_id||a.versionId!==draft.parent_id||!parentRunId||a.runId!==parentRunId)throw Error('result_asset_required');
 // A white master starts a new set of scenes (A7 makes no new white master); a scene is edited.
 if((draft.brief.editBaseKind==='white')!==(a.kind==='white'))throw Error('result_asset_required');
 return {assetId:a.assetId,runId:a.runId,outputId:a.outputId,kind:a.kind,driveFileId:a.driveFileId,sha256:a.sha256,px:a.px,fileName:a.fileName};
}
