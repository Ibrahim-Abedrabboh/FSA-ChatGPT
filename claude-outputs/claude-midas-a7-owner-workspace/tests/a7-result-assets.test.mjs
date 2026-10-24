import {readdir,readFile} from 'node:fs/promises';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {randomUUID} from 'node:crypto';
import {saveDraft,reviseDraft,listProjects} from '../lib/a7-projects.mjs';
import {cleanResults,recordResults,versionResults,resultAsset,editBase} from '../lib/a7-results.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {EDIT_DISPATCH_HELP} from '../lib/a7-actions.mjs';
const local=new NetlifyDB(),realPg=process.env.A7_REFERENCE_TEST_PG_URL;let pool;const owner=randomUUID(),other=randomUUID();
before(async()=>{const migrations=new URL('../netlify/database/migrations/',import.meta.url);if(realPg){const url=new URL(realPg);if(url.hostname!=='127.0.0.1'||url.pathname!=='/a7_reference_check')throw Error('isolated_local_database_required');pool=getDatabase({connectionString:realPg}).pool;for(const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile(new URL(file,migrations),'utf8'));}else{const connectionString=await local.start();await local.applyMigrations(migrations.pathname);pool=getDatabase({connectionString}).pool;}});
after(async()=>{if(pool)await pool.end();if(!realPg)await local.stop();});
const input=(patch={})=>({requestId:randomUUID(),mode:'project',title:'Owner test',caseTitle:'Sofa',note:'Original direction',brief:{product:'Sofa',budgetUsd:'4.74'},...patch});
const scene=(patch={})=>({outputId:'hero',kind:'scene',driveFileId:'1AbCdEfGhIjKlMnOp',sha256:'e'.repeat(64),px:'2048x2048',fileName:'hero.png',reviewed:true,approvedAt:'2026-10-19T10:00:00Z',...patch});

test('only well-formed approved scenes and the approved white master are kept from the A7 answer',()=>{
 const kept=cleanResults([scene(),scene({kind:'white'}),scene({kind:'white',outputId:'white_master'}),scene({kind:'variation'}),scene({sha256:'x'}),scene({driveFileId:'bad id!'}),null,scene({outputId:'wide',px:'huge',reviewed:false})]);
 assert.deepEqual(kept.map(r=>r.outputId+'/'+r.kind),['hero/scene','white_master/white','wide/scene']);assert.equal(kept[2].px,null);assert.equal(kept[2].reviewed,false);
});

test('a white master is recorded, and only an edit that makes scenes from it can start from it',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),runId=sharedRunIdentity(draft.id).runId;
 const [white]=await recordResults(pool,owner,runId,[scene({outputId:'white_master',kind:'white',fileName:'white.jpg'})]);
 assert.equal(white.kind,'white');
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',resultAssetId:white.assetId}})),/result_asset_required/,'a white master is not edited as a scene');
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',editBaseKind:'white'}})),/invalid_project/);
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',resultAssetId:white.assetId,editBaseKind:'white',editOptions:'lighting=Daylight'}})),/invalid_project/,'edit options are for a scene edit');
 const scenes=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Living room scenes',brief:{product:'Sofa',budgetUsd:'3',outcome:'Lifestyle',resultAssetId:white.assetId,editBaseKind:'white'}}));
 assert.deepEqual(await editBase(pool,owner,scenes.draft,runId),{assetId:white.assetId,runId,outputId:'white_master',kind:'white',driveFileId:'1AbCdEfGhIjKlMnOp',sha256:'e'.repeat(64),px:'2048x2048',fileName:'white.jpg'});
 const [hero]=await recordResults(pool,owner,runId,[scene()]);
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',resultAssetId:hero.assetId,editBaseKind:'white'}})),/result_asset_required/,'a scene does not start new scenes');
 await assert.rejects(editBase(pool,owner,{...scenes.draft,brief:{...scenes.draft.brief,editBaseKind:undefined}},runId),/result_asset_required/);
});

test('a run sent before runs were named after their version is found by the run id its receipt recorded',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),older='claude-a7-20261017230527-1i4fxz'+draft.id.slice(0,4);
 assert.equal((await recordResults(pool,owner,older,[scene()])).length,0,'no version recorded that run');
 await pool.query('UPDATE a7_job_versions SET run_id=$1 WHERE id=$2',[older,draft.id]);
 const [asset]=await recordResults(pool,owner,older,[scene({outputId:'white_master',kind:'white'})]);
 assert.equal(asset.versionId,draft.id);assert.equal(asset.runId,older);
 assert.equal((await recordResults(pool,other,older,[scene()])).length,0,'never another owner\'s');
});

test('approved images are recorded once per version, only for the owner whose run it is',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),runId=sharedRunIdentity(draft.id).runId;
 const first=await recordResults(pool,owner,runId,[scene()]),again=await recordResults(pool,owner,runId,[scene(),scene({outputId:'wide',sha256:'f'.repeat(64)})]);
 assert.equal(first.length,1);assert.equal(again.length,2);assert.equal(again.find(r=>r.outputId==='hero').assetId,first[0].assetId);
 assert.equal((await recordResults(pool,other,runId,[scene()])).length,0);
 assert.equal((await recordResults(pool,owner,'claude-a7-20261018101010-abcdef',[scene()])).length,0);
 assert.equal((await versionResults(pool,owner,draft.id)).length,2);
 const asset=await resultAsset(pool,owner,first[0].assetId);assert.equal(asset.driveFileId,'1AbCdEfGhIjKlMnOp');
 await assert.rejects(resultAsset(pool,other,first[0].assetId),/result_asset_required/);
});

test('an edit can start from an approved image of the version it edits, and keeps that image',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),[asset]=await recordResults(pool,owner,sharedRunIdentity(draft.id).runId,[scene()]);
 const {draft:elsewhere}=await saveDraft(pool,owner,input());
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Evening',brief:{product:'Sofa',budgetUsd:'4.74',resultAssetId:asset.assetId,allowedChanges:'Warm evening light',protectedDetails:'Same sofa'}}));
 assert.equal(edit.draft.brief.resultAssetId,asset.assetId);
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:elsewhere.id,brief:{product:'Sofa',resultAssetId:asset.assetId}})),/result_asset_required/);
 await assert.rejects(saveDraft(pool,other,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',resultAssetId:asset.assetId}})),/not_found|result_asset_required/);
 await assert.rejects(saveDraft(pool,owner,input({brief:{product:'Sofa',resultAssetId:asset.assetId}})),/invalid_project/);
 await assert.rejects(reviseDraft(pool,owner,edit.draft.id,{requestId:randomUUID(),expectedFingerprint:edit.draft.fingerprint,note:'Evening',brief:{...edit.draft.brief,resultAssetId:randomUUID()}}),/route_changed/);
 assert.match(EDIT_DISPATCH_HELP.result_asset_required,/Nothing was sent to A7\.$/);
});

test('an edit stores the options picked in the panel, and only valid options from an edit',async()=>{
 const {draft}=await saveDraft(pool,owner,input());
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Evening',brief:{product:'Sofa',editOptions:'lighting=Warm evening',allowedChanges:'Lighting: change the light to the Warm evening preset.',protectedDetails:'The product'}}));
 assert.equal(edit.draft.brief.editOptions,'lighting=Warm evening');
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,brief:{product:'Sofa',editOptions:'lighting=Neon'}})),/invalid_project/);
 await assert.rejects(saveDraft(pool,owner,input({brief:{product:'Sofa',editOptions:'lighting=Daylight'}})),/invalid_project/);
});

test('an edit sends A7 the receipt of its approved image only when it belongs to the version and run it edits',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),runId=sharedRunIdentity(draft.id).runId,[asset]=await recordResults(pool,owner,runId,[scene()]);
 const edit={parent_id:draft.id,brief:{resultAssetId:asset.assetId}};
 assert.deepEqual(await editBase(pool,owner,edit,runId),{assetId:asset.assetId,runId,outputId:'hero',kind:'scene',driveFileId:'1AbCdEfGhIjKlMnOp',sha256:'e'.repeat(64),px:'2048x2048',fileName:'hero.png'});
 await assert.rejects(editBase(pool,owner,edit,'claude-a7-'+randomUUID()),/result_asset_required/);
 await assert.rejects(editBase(pool,owner,{...edit,parent_id:randomUUID()},runId),/result_asset_required/);
 await assert.rejects(editBase(pool,other,edit,runId),/result_asset_required/);
 await assert.rejects(editBase(pool,owner,{parent_id:draft.id,brief:{}},runId),/result_asset_required/);
});

test('saved work names the approved image an edit starts from, and only for its owner',async()=>{
 const {draft}=await saveDraft(pool,owner,input()),[asset]=await recordResults(pool,owner,sharedRunIdentity(draft.id).runId,[scene({fileName:'sofa-evening-hero.png'})]);
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Evening',brief:{product:'Sofa',budgetUsd:'4.74',resultAssetId:asset.assetId,allowedChanges:'Warm evening light',protectedDetails:'Same sofa'}}));
 const {records}=await listProjects(pool,owner),row=id=>records.find(r=>r.version_id===id);
 assert.equal(row(edit.draft.id).base_file_name,'sofa-evening-hero.png');assert.equal(row(draft.id).base_file_name,null);
 assert.equal(records.filter(r=>r.version_id===edit.draft.id).length,1);
});
test('an edit continues its parent run by name when the parent\'s send receipt was never recorded',async()=>{
 const {parentRunIdOf}=await import('../lib/a7-results.mjs');
 const {draft:parent}=await saveDraft(pool,owner,input()),identity=sharedRunIdentity(parent.id);
 const [asset]=await recordResults(pool,owner,identity.runId,[scene()]);
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:parent.id,note:'Warmer light',brief:{product:'Sofa',budgetUsd:'4.74',resultAssetId:asset.assetId}}));
 // Sent from this site (client_run_id is its own) but no receipt: run_id is empty.
 const uncertain={id:parent.id,run_id:null,client_run_id:identity.clientRunId};
 assert.equal(parentRunIdOf(uncertain),identity.runId);
 assert.equal((await editBase(pool,owner,edit.draft,parentRunIdOf(uncertain))).assetId,asset.assetId);
 assert.equal(parentRunIdOf({id:parent.id,run_id:'claude-a7-recorded',client_run_id:identity.clientRunId}),'claude-a7-recorded');
 assert.equal(parentRunIdOf({id:parent.id,run_id:null,client_run_id:null}),null,'a parent that was never sent has no run');
 assert.equal(parentRunIdOf({id:parent.id,run_id:null,client_run_id:'owner-'+randomUUID()}),null);
});
