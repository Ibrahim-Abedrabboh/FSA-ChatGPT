import {readdir,readFile} from 'node:fs/promises';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {randomUUID} from 'node:crypto';
import {saveDraft,listProjects,claimDraft,reviseDraft,recordDraftReceipt,DRAFT_BRIEF_KEYS} from '../lib/a7-projects.mjs';
import {categoryCode,CATEGORIES} from '../lib/a7-naming.mjs';
const local=new NetlifyDB(),realPg=process.env.A7_REFERENCE_TEST_PG_URL;let pool;const owner=randomUUID(),other=randomUUID();
before(async()=>{const migrations=new URL('../netlify/database/migrations/',import.meta.url);if(realPg){const url=new URL(realPg);if(url.hostname!=='127.0.0.1'||url.pathname!=='/a7_reference_check')throw Error('isolated_local_database_required');pool=getDatabase({connectionString:realPg}).pool;for(const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile(new URL(file,migrations),'utf8'));}else{const connectionString=await local.start();await local.applyMigrations(migrations.pathname);pool=getDatabase({connectionString}).pool;}});
after(async()=>{if(pool)await pool.end();if(!realPg)await local.stop();});
const input=(patch={})=>({requestId:randomUUID(),mode:'project',title:'Owner test',caseTitle:'Two separate units',note:'Keep two units separate and preserve connectors.',brief:{product:'Sofa',budgetUsd:'4.74'},...patch});
test('project save is idempotent and owner isolated',async()=>{const x=input();const a=await saveDraft(pool,owner,x),b=await saveDraft(pool,owner,x);assert.equal(a.draft.id,b.draft.id);assert.equal(a.draft.dispatch_state,'draft');assert.equal((await listProjects(pool,other)).records.length,0);await assert.rejects(saveDraft(pool,other,x),/draft_conflict/);await assert.rejects(saveDraft(pool,owner,{...x,note:'Changed'}),/draft_conflict/);});
test('source-only draft can gain confirmed details in place, with owner and revision guards',async()=>{
 const x=input({brief:{routeIntent:'single',routeChoice:'hero',product:'',inventory:'',budgetUsd:1.25}}),{draft}=await saveDraft(pool,owner,x);
 const update={requestId:randomUUID(),expectedFingerprint:draft.fingerprint,note:x.note,brief:{...x.brief,product:'Sofa',inventory:'2 seat modules'}};
 await assert.rejects(reviseDraft(pool,other,draft.id,update),/not_found/);
 const first=await reviseDraft(pool,owner,draft.id,update),again=await reviseDraft(pool,owner,draft.id,update);
 assert.equal(first.draft.id,draft.id);assert.equal(again.draft.fingerprint,first.draft.fingerprint);
 assert.equal(first.draft.brief.inventory,'2 seat modules');
 await assert.rejects(reviseDraft(pool,owner,draft.id,{...update,requestId:randomUUID(),brief:{...update.brief,routeChoice:'secondary'}}),/draft_changed|route_changed/);
 await claimDraft(pool,owner,draft.id,'owner-'+randomUUID(),update.brief,update.note);
 await assert.rejects(reviseDraft(pool,owner,draft.id,{...update,requestId:randomUUID(),expectedFingerprint:first.draft.fingerprint}),/draft_changed/);
});
test('collection holds separate cases; amendments preserve original and approvals are absent',async()=>{const a=await saveDraft(pool,owner,input({mode:'collection'}));const {records}=await listProjects(pool,owner);const row=records.find(r=>r.version_id===a.draft.id);const b=await saveDraft(pool,owner,input({mode:'collection',projectId:row.id,caseTitle:'Second product'}));assert.notEqual(a.draft.case_id,b.draft.case_id);const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:a.draft.id,note:'Amend lighting only'}));assert.equal(edit.draft.case_id,a.draft.case_id);assert.equal(edit.draft.version,2);assert.equal(edit.draft.parent_id,a.draft.id);assert.equal(edit.draft.client_run_id,null);assert.equal(edit.draft.dispatch_state,'draft');assert.equal(a.draft.note,'Keep two units separate and preserve connectors.');await assert.rejects(saveDraft(pool,other,input({mode:'edit',parentId:a.draft.id})),/not_found/);});
test('confirmation binds exact saved brief and permits only one logical job',async()=>{const x=input(),{draft}=await saveDraft(pool,owner,x),client='owner-'+randomUUID();await assert.rejects(claimDraft(pool,other,draft.id,client,x.brief,x.note),/not_found/);await assert.rejects(claimDraft(pool,owner,draft.id,client,{...x.brief,product:'Changed'},x.note),/draft_changed/);await claimDraft(pool,owner,draft.id,client,{budgetUsd:'4.74',product:'Sofa'},x.note);await claimDraft(pool,owner,draft.id,client,x.brief,x.note);await assert.rejects(claimDraft(pool,owner,draft.id,'owner-'+randomUUID(),x.brief,x.note),/draft_already_submitted/);});
test('project API rejects anonymous access before database access',async()=>{const {default:handler}=await import('../netlify/functions/owner-projects.mjs');for(const method of ['GET','POST']){const r=await handler(new Request('https://example.test/api/owner/projects',{method}),{cookies:{get:()=>undefined}});assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');}});
test('authenticated project writes reject foreign origins and preview contexts before storage',async()=>{
 const {default:handler}=await import('../netlify/functions/owner-projects.mjs');const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:owner,email:'owner@example.test',app_metadata:{roles:['owner']}});
 const ctx={cookies:{get:()=> 'synthetic-test-token'},site:{url:'https://example.test'},deploy:{context:'production'}};
 try{for(const [origin,context] of [['https://foreign.test',ctx],['https://example.test',{...ctx,deploy:{context:'deploy-preview'}}]]){const r=await handler(new Request('https://example.test/api/owner/projects',{method:'POST',headers:{origin},body:'{}'}),context);assert.equal(r.status,403);}}finally{globalThis.fetch=previous;}
});
test('non-owner session cannot read project metadata',async()=>{
 const {default:handler}=await import('../netlify/functions/owner-projects.mjs');const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:other,app_metadata:{roles:[]}});try{const r=await handler(new Request('https://example.test/api/owner/projects'),{cookies:{get:()=> 'synthetic-test-token',delete:()=>{},set:()=>{}},site:{url:'https://example.test'}});assert.equal(r.status,403);}finally{globalThis.fetch=previous;}
});
test('saved edits inherit immutable original product and room references',async()=>{
 const {attachReference,draftReferences}=await import('../lib/a7-projects.mjs');const {draft}=await saveDraft(pool,owner,input());
 const product={role:'product',blob_key:'synthetic/product',sha256:'a'.repeat(64),mime:'image/png',bytes:40},room={...product,role:'room',blob_key:'synthetic/room',sha256:'b'.repeat(64)};
 await attachReference(pool,owner,draft.id,product);await attachReference(pool,owner,draft.id,room);const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id}));assert.equal((await draftReferences(pool,owner,edit.draft.id)).length,2);await attachReference(pool,owner,edit.draft.id,{...product,sha256:'c'.repeat(64),blob_key:'synthetic/new-product'});const originals=await draftReferences(pool,owner,edit.draft.id);assert.equal(originals.length,3);assert.ok(originals.some(r=>r.sha256===product.sha256));await assert.rejects(draftReferences(pool,other,edit.draft.id),/not_found/);
});
test('Edit new item starts its own case while saved edit requires a parent',async()=>{const {draft}=await saveDraft(pool,owner,input({mode:'edit',editSource:'new'}));assert.equal(draft.version,1);assert.equal(draft.parent_id,null);await assert.rejects(saveDraft(pool,owner,input({mode:'edit'})),/parent_required/);});
test('preflight leaves draft editable; only dispatch confirmation claims it',async()=>{const x=input(),{draft}=await saveDraft(pool,owner,x);await claimDraft(pool,owner,draft.id,'owner-'+randomUUID(),x.brief,x.note,false);const row=(await listProjects(pool,owner)).records.find(r=>r.version_id===draft.id);assert.equal(row.dispatch_state,'draft');assert.equal(row.client_run_id,null);});
test('saved direction and amendment survive together, with no silent instruction truncation',async()=>{const x=input(),{draft}=await saveDraft(pool,owner,x);const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Change lighting only',brief:{allowedChanges:'Warm evening',protectedDetails:'Same two separate units and connectors'}}));assert.match(edit.draft.direction,/Keep two units separate/);assert.match(edit.draft.direction,/Change lighting only/);assert.match(edit.draft.direction,/Same two separate units/);await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'a'.repeat(1200)})),/direction_too_long/);});
test('saved direction replacement keeps inherited references and does not concatenate old instructions',async()=>{
 const {attachReference,draftReferences}=await import('../lib/a7-projects.mjs');
 const brief={product:'Sofa',sku:'MID-17',dimensions:'205 × 90 × 77 cm',inventory:'1 sofa',budgetUsd:'4.74'};
 const {draft}=await saveDraft(pool,owner,input({note:'Original direction',brief}));
 await attachReference(pool,owner,draft.id,{role:'product',blob_key:'synthetic/replacement-test',sha256:'d'.repeat(64),mime:'image/png',bytes:40});
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,editSource:'saved',directionMode:'replace',note:'Revised direction',brief}));
 assert.equal(edit.draft.direction,'Revised direction');assert.equal(edit.draft.note,'Revised direction');assert.equal(edit.draft.parent_id,draft.id);
 assert.deepEqual(edit.draft.brief,brief);assert.equal((await draftReferences(pool,owner,edit.draft.id)).length,1);
 await assert.rejects(saveDraft(pool,owner,input({directionMode:'replace'})),/invalid_project/);
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',editSource:'new',parentId:draft.id,directionMode:'replace'})),/invalid_project/);
});
test('a replaced saved direction keeps what to change and what to keep, within the A7 instruction limit',async()=>{
 const {draft}=await saveDraft(pool,owner,input({note:'Original direction'}));
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,editSource:'saved',directionMode:'replace',note:'Evening version',brief:{allowedChanges:'Warm evening light',protectedDetails:'Same sofa, cushions and camera'}}));
 assert.equal(edit.draft.direction,'Evening version\nRequested changes: Warm evening light\nPreserve: Same sofa, cushions and camera');
 assert.doesNotMatch(edit.draft.direction,/Original direction/);
 await assert.rejects(saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,editSource:'saved',directionMode:'replace',note:'a'.repeat(1000),brief:{allowedChanges:'b'.repeat(150),protectedDetails:'c'.repeat(150)}})),/direction_too_long/);
});
test('revising a saved edit keeps the saved direction and the change and keep lines',async()=>{
 const {draft}=await saveDraft(pool,owner,input({note:'Original direction'}));
 const brief={allowedChanges:'Warm light',protectedDetails:'Same sofa',routeIntent:'edit',routeChoice:'saved'};
 const edit=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id,note:'Evening',brief}));
 assert.match(edit.draft.direction,/^Saved direction: Original direction\nAmendment: Evening/);
 const revised=await reviseDraft(pool,owner,edit.draft.id,{requestId:randomUUID(),expectedFingerprint:edit.draft.fingerprint,note:'Late evening',brief:{...brief,allowedChanges:'Dim warm light'}});
 assert.equal(revised.draft.direction,'Saved direction: Original direction\nAmendment: Late evening\nRequested changes: Dim warm light\nPreserve: Same sofa');
});
test('add/remove/replace drafts require explicit targets and preserve bounded edit instructions',async()=>{for(const action of ['add','remove','replace']){await assert.rejects(saveDraft(pool,owner,input({mode:'edit',editSource:'new',brief:{editOperation:action}})),/edit_target_required/);const {draft}=await saveDraft(pool,owner,input({mode:'edit',editSource:'new',brief:{editOperation:action,editTarget:'left side table',protectedDetails:'room, camera and right table'}}));assert.match(draft.direction,new RegExp('Edit action: '+action));assert.match(draft.direction,/left side table/);assert.match(draft.direction,/room, camera and right table/);}});
test('reference sets keep roles, deduplicate identical uploads, inherit IDs and enforce the limit',async()=>{const {attachReference,draftReferences}=await import('../lib/a7-projects.mjs');const {draft}=await saveDraft(pool,owner,input());const make=i=>({role:i===0?'product':i===1?'room':i===2?'look':'other_view',blob_key:'synthetic/ref-'+i,sha256:i.toString(16).padStart(64,'0'),mime:'image/png',bytes:40});for(let i=0;i<12;i++)await attachReference(pool,owner,draft.id,make(i));await attachReference(pool,owner,draft.id,make(0));const refs=await draftReferences(pool,owner,draft.id);assert.equal(refs.length,12);assert.equal(refs.filter(r=>r.role==='product').length,1);assert.equal(new Set(refs.map(r=>r.reference_id)).size,12);await assert.rejects(attachReference(pool,owner,draft.id,make(12)),/reference_limit/);const child=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id}));assert.deepEqual((await draftReferences(pool,owner,child.draft.id)).map(r=>r.reference_id).sort(),refs.map(r=>r.reference_id).sort());});

test('duplicate, inherited and excess references are rejected before blob writes, including concurrent uploads',async()=>{
 const {attachReference,draftReferences}=await import('../lib/a7-projects.mjs');const {draft}=await saveDraft(pool,owner,input());let writes=0;const persist=async()=>{writes++;};
 const make=i=>({role:'other_view',blob_key:'synthetic/locked-'+i,sha256:(100+i).toString(16).padStart(64,'0'),mime:'image/png',bytes:177});
 await Promise.all([attachReference(pool,owner,draft.id,make(0),persist),attachReference(pool,owner,draft.id,make(0),persist)]);assert.equal(writes,1);
 const child=await saveDraft(pool,owner,input({mode:'edit',parentId:draft.id}));await attachReference(pool,owner,child.draft.id,{...make(0),blob_key:'synthetic/child-copy'},persist);assert.equal(writes,1);
 for(let i=1;i<12;i++)await attachReference(pool,owner,draft.id,make(i),persist);assert.equal(writes,12);
 await assert.rejects(attachReference(pool,owner,draft.id,make(12),persist),/reference_limit/);assert.equal(writes,12);
 await assert.rejects(attachReference(pool,other,draft.id,make(12),persist),/not_found/);assert.equal(writes,12);
 await assert.rejects(attachReference(pool,owner,child.draft.id,make(13),async()=>{throw Error('synthetic_blob_failure');}),/synthetic_blob_failure/);assert.equal((await draftReferences(pool,owner,child.draft.id)).length,1);
});
test('concurrent uploads cannot both consume the final reference slot',{skip:realPg?false:'Requires isolated real PostgreSQL; the local emulator shares a single backend across connections.'},async()=>{
 const {attachReference,draftReferences}=await import('../lib/a7-projects.mjs');const {draft}=await saveDraft(pool,owner,input());let writes=0;const persist=async()=>{writes++;};const make=i=>({role:'other_view',blob_key:'synthetic/last-slot-'+i,sha256:(200+i).toString(16).padStart(64,'0'),mime:'image/png',bytes:177});
 for(let i=0;i<11;i++)await attachReference(pool,owner,draft.id,make(i),persist);
 const results=await Promise.allSettled([attachReference(pool,owner,draft.id,make(11),persist),attachReference(pool,owner,draft.id,make(12),persist)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'reference_limit');assert.equal(writes,12);assert.equal((await draftReferences(pool,owner,draft.id)).length,12);
});
test('a version already sent to A7 cannot be sent again',async()=>{const x=input(),{draft}=await saveDraft(pool,owner,x),client='owner-'+randomUUID();await claimDraft(pool,owner,draft.id,client,x.brief,x.note);await recordDraftReceipt(pool,owner,draft.id,'received','claude-a7-test');await assert.rejects(claimDraft(pool,owner,draft.id,client,x.brief,x.note,false),/draft_already_submitted/);});
test('a draft saved with studio and guide fields can be claimed with the brief the send rebuilds from DRAFT_BRIEF_KEYS',async()=>{const x=input({brief:{product:'Sofa',budgetUsd:'4.74',outcomes:'Lifestyle\nWebsite',camera:'Left side',series:'Three views',page:'studio'}}),{draft}=await saveDraft(pool,owner,x);const sent={...x.brief,requestId:randomUUID(),draftId:draft.id,confirmed:true};const rebuilt=Object.fromEntries(DRAFT_BRIEF_KEYS.filter(k=>sent[k]!==undefined).map(k=>[k,sent[k]]));await claimDraft(pool,owner,draft.id,'owner-'+randomUUID(),rebuilt,x.note,false);const legacy=Object.fromEntries(['product','budgetUsd'].map(k=>[k,sent[k]]));await assert.rejects(claimDraft(pool,owner,draft.id,'owner-'+randomUUID(),legacy,x.note,false),/draft_changed/);});

test('every new product gets an automatic CAT-YYMM-NN reference, names and a counter per category and month',async()=>{
 const me=randomUUID();
 const a=await saveDraft(pool,me,input({title:'',caseTitle:'',brief:{product:'Sofa',budgetUsd:'4.74'}}));
 const b=await saveDraft(pool,me,input({title:'Spring campaign',caseTitle:'Abali Dining Table — White',brief:{product:'dining table',budgetUsd:'4.74'}}));
 const c=await saveDraft(pool,me,input({title:'',caseTitle:'Velvet sofa',brief:{product:'Sofa',budgetUsd:'4.74'}}));
 const yymm=(await pool.query("SELECT to_char(now() AT TIME ZONE 'Asia/Amman','YYMM') AS v")).rows[0].v;
 assert.equal(a.ref,`SOF-${yymm}-01`);assert.equal(b.ref,`DIN-${yymm}-01`);assert.equal(c.ref,`SOF-${yymm}-02`);
 const {records}=await listProjects(pool,me);const row=id=>records.find(r=>r.version_id===id);
 assert.equal(row(a.draft.id).case_title,'Unnamed sofa');assert.match(row(a.draft.id).title,/^Sofas and seating · \w+ \d{4}$/);
 assert.equal(row(b.draft.id).title,'Spring campaign');assert.equal(row(b.draft.id).case_ref,`DIN-${yymm}-01`);assert.equal(row(b.draft.id).case_category,'DIN');
 const edit=await saveDraft(pool,me,input({mode:'edit',parentId:a.draft.id,title:'',caseTitle:'',note:'Warmer light.',brief:{product:'Sofa',budgetUsd:'4.74',routeIntent:'edit'}}));
 assert.equal(edit.ref,a.ref);assert.equal(edit.draft.version,2);assert.equal(edit.draft.parent_id,a.draft.id);
 const again=await saveDraft(pool,me,{...input({title:'',caseTitle:'',brief:{product:'Sofa',budgetUsd:'4.74'}}),requestId:a.draft.id,note:input().note});assert.equal(again.ref,a.ref);assert.equal(again.draft.id,a.draft.id);
 assert.equal((await listProjects(pool,randomUUID())).records.length,0);
});
test('the naming migration uses the same category rules as the server',async()=>{
 const sql=await readFile(new URL('../netlify/database/migrations/20261019180000_a7_naming.sql',import.meta.url),'utf8');
 const expr=sql.slice(sql.indexOf('CASE\n'),sql.indexOf(' AS code'));
 const samples=['ABEAU OFFICE SOFA 1 SEATER','Arc floor lamp','Linen bedding set','Six-chair dining set','Cream panel bed','Boucle lounge sofa','Zura swivel chair','Marble side table','Oak bookcase','Celato vase','I005','Wing pedestal bowl','Bath towel','Teak coffee table'];
 for(const sample of samples){const {rows:[r]}=await pool.query(`SELECT ${expr} AS code FROM (SELECT lower($1::text) AS t) s`,[sample]);assert.equal(r.code,categoryCode(sample),sample);}
 assert.equal(CATEGORIES.length,10);
});
test('the naming migration numbers existing products in creation order per category and month',async()=>{
 const sql=await readFile(new URL('../netlify/database/migrations/20261019180000_a7_naming.sql',import.meta.url),'utf8');
 const backfill=sql.slice(sql.indexOf('WITH src AS'),sql.indexOf('INSERT INTO a7_case_ref_counters'));
 const me=randomUUID(),project=randomUUID();
 await pool.query("INSERT INTO a7_projects(id,owner_id,title,kind,created_at) VALUES($1,$2,'Legacy','project','2026-10-18T09:00:00Z')",[project,me]);
 const rows=[['I005','2026-10-18T10:00:00Z','Sofa'],['Two separate units','2026-10-18T09:30:00Z','sofa'],['Arc lamp','2026-10-18T11:00:00Z',''],['11-175450_c','2026-09-30T22:30:00Z','']];
 const ids=[];
 for(const [title,at,product] of rows){const c=randomUUID();ids.push(c);await pool.query('INSERT INTO a7_cases(id,project_id,owner_id,title,created_at) VALUES($1,$2,$3,$4,$5)',[c,project,me,title,at]);await pool.query("INSERT INTO a7_job_versions(id,case_id,owner_id,version,note,brief,fingerprint) VALUES($1,$2,$3,1,'n',$4,'f')",[randomUUID(),c,me,JSON.stringify({product})]);}
 await pool.query(backfill);
 const {rows:out}=await pool.query('SELECT id,ref,category FROM a7_cases WHERE owner_id=$1',[me]);const ref=id=>out.find(r=>r.id===id).ref;
 assert.equal(ref(ids[1]),'SOF-2610-01');assert.equal(ref(ids[0]),'SOF-2610-02');assert.equal(ref(ids[2]),'LGT-2610-01');
 assert.equal(ref(ids[3]),'GEN-2610-01','22:30 UTC on 30 Sep is 1 Oct in Asia/Amman');
});

test('a revision guard sees the saved and revised direction, and a refusal writes nothing',async()=>{
 const x=input({brief:{routeIntent:'single',routeChoice:'hero',product:'',inventory:'',budgetUsd:1.25}}),{draft}=await saveDraft(pool,owner,x);
 const seen=[],update={requestId:randomUUID(),expectedFingerprint:draft.fingerprint,note:'Show it in a garden.',brief:x.brief};
 await assert.rejects(reviseDraft(pool,owner,draft.id,update,{guard:async change=>{seen.push(change);throw Error('analysis_running');}}),/analysis_running/);
 assert.deepEqual(seen,[{before:x.note,after:'Show it in a garden.'}]);
 const {rows:[kept]}=await pool.query('SELECT note,direction,fingerprint FROM a7_job_versions WHERE id=$1',[draft.id]);
 assert.equal(kept.note,x.note);assert.equal(kept.fingerprint,draft.fingerprint);
 const saved=await reviseDraft(pool,owner,draft.id,update,{guard:async()=>{}});
 assert.equal(saved.draft.note,'Show it in a garden.');
});
test('a refused save or revision says what to do, in words',async()=>{
 const {projectRefusal}=await import('../lib/a7-projects.mjs');
 for(const code of ['direction_too_long','result_asset_required','route_changed','draft_changed','analysis_running']){const r=projectRefusal(code);assert.equal(r.status,409);assert.equal(r.body.error,code);assert.match(r.body.message,/Nothing was saved\.$/);}
 assert.deepEqual(projectRefusal('not_found').status,404);assert.equal(projectRefusal('connection reset').body.error,'project_storage_unavailable');
});
test('a version whose reading opened its budget cannot be saved with a lower one, and can keep or raise it',async()=>{
 const {openBudget}=await import('../lib/a7-budget.mjs');const {sharedRunIdentity}=await import('../lib/a7-shared-run.mjs');
 const x=input({brief:{routeIntent:'single',routeChoice:'hero',product:'Sofa',inventory:'1 sofa',budgetUsd:4.74}}),{draft}=await saveDraft(pool,owner,x);
 await openBudget(pool,{clientId:sharedRunIdentity(draft.id).clientRunId,ownerId:owner,limitUsd:4.74});
 const revise=(budgetUsd,expectedFingerprint=draft.fingerprint)=>reviseDraft(pool,owner,draft.id,{requestId:randomUUID(),expectedFingerprint,note:x.note,brief:{...x.brief,budgetUsd}});
 const error=await revise(3).then(()=>null,e=>e);assert.equal(error?.message,'budget_lowered');assert.equal(error.detail.floorUsd,4.74);
 const {projectRefusal}=await import('../lib/a7-projects.mjs');assert.match(projectRefusal('budget_lowered',error.detail).body.message,/opened its job budget at USD 4\.74\. Keep the budget at USD 4\.74 or raise it/);
 const raised=await revise(6);assert.equal(Number(raised.draft.brief.budgetUsd),6);
});
