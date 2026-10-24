// Owner studio (Claude-final-midas-a7): Draft 3 payload -> owner brief -> owner submission -> A7's own "01 Intent & scope" and
// "02 Ingest files" code (read only, from n8n/claude-midas-a7/code-nodes). And owner job reads -> the page's result contract.
// Synthetic data only. No network, no n8n, no paid call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {validateSubmission,studioFields} from '../lib/a7-actions.mjs';
import {validateDraft} from '../lib/a7-projects.mjs';
const require=createRequire(import.meta.url);
await import('../studio/owner-link.js');   // a browser script: it sets globalThis.MIDAS_OWNER_LINK
const LINK=globalThis.MIDAS_OWNER_LINK;
const CODE=new URL('../../../n8n/claude-midas-a7/code-nodes/',import.meta.url);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const AsyncFn=Object.getPrototypeOf(async function(){}).constructor;
async function intake(payload){
 const code=await readFile(new URL('01_Intent_scope.js',CODE),'utf8');
 const item={json:{body:{payload:JSON.stringify(payload)}},binary:{files:{fileName:'product-1.png',mimeType:'image/png'}}};
 const fn=new AsyncFn('$','$input','$execution','require',code);
 return (await fn.call({},()=>{throw new Error('no node');},{first:()=>item,all:()=>[item]},{},require))[0];
}
async function ingest(first){
 const code=await readFile(new URL('02_Ingest_files.js',CODE),'utf8');
 const fn=new AsyncFn('$input','require',code);
 return (await fn.call({helpers:{getBinaryDataBuffer:async()=>PNG}},{first:()=>first},require))[0].json;
}
const ID='6c1c2f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
// The shape draft 3's buildPayload() sends (claude-outputs/claude-midas-a7-page-3/app.js).
function draft3(over={}){
 const p={job:'lifestyle',jobMode:'new_project',workOn:'one_by_one',
  scope:{outcome:'Lifestyle',outcomes:['Lifestyle'],view:'Wide view',aspect:'4:5',resolution:'2K',imageCount:2,camera:'45° right',series:'Single image'},
  item:{department:'Living Room',category:'Sofas',subCategory:'Sofas / Corner sofas',referenceType:'Product / vendor reference',sku:'174770',dimensions:'W 280 x D 160 cm',inventory:[{item:'corner sofa',count:2}],description:'Two matching corner units.'},
  preferences:{lighting:'Golden afternoon',wallPaint:'Sage',floor:'Light oak',useWorkflowDefaults:false},
  metadata:{product_category:'Sofas',color:'Sand',material:'Boucle',scene:'Lifestyle',light:'Golden afternoon',locks:['Keep the brass feet'],must_not:['No rug'],delivery:{image_size:'',aspect:'4:5',resolution:'2K'}},
  instructions:'Place the units as photographed.',references:[{name:'sofa.png',role:'Product / vendor reference'}],clientRunId:ID,styling:{human:true}};
 return Object.assign(p,over);
}
const submit=(brief,note)=>({...brief,requestId:ID,draftId:ID,instructions:note,confirmed:true});

test('a Lifestyle draft 3 request reaches A7 01 and 02 with every choice applied and nothing listed as not applied',async()=>{
 const p=draft3(),brief=LINK.toOwnerBrief(p),note=LINK.noteOf(p);
 assert.equal(brief.outcome,'Lifestyle');assert.equal(brief.inventory,'2 corner sofa');assert.equal(brief.product,'Corner sofas');
 assert.doesNotThrow(()=>validateDraft({requestId:ID,mode:'project',title:'Studio · Corner sofas',caseTitle:'Corner sofas',note,brief}));
 const saved=validateDraft({requestId:ID,mode:'project',title:'Studio · Corner sofas',caseTitle:'Corner sofas',note,brief}).brief;
 assert.deepEqual(saved,brief,'the saved draft keeps every draft 3 field, so the submission brief matches it exactly');
 const body=validateSubmission(submit(brief,note));
 const one=await intake(body),j=one.json;
 assert.equal(j.usable,'ok',j.problems.join(' '));
 assert.deepEqual(j.not_applied,[]);
 assert.deepEqual(j.brief.outcomes,['lifestyle']);
 assert.equal(j.brief.outputs.length,2,'white catalogue image + one wide view');
 assert.equal(j.brief.camera_view,'45° right');
 assert.equal(j.brief.preferences.wall,'Sage');assert.equal(j.brief.preferences.floor,'Light oak');assert.equal(j.brief.preferences.people,'one');
 assert.equal(j.brief.colour,'Sand');assert.equal(j.brief.material,'Boucle');assert.deepEqual(j.brief.exclusions,['No rug']);
 assert.match(j.brief.instructions,/Keep the brass feet/);assert.equal(j.brief.product_notes,'Two matching corner units.');
 assert.deepEqual(j.brief.inventory,[{item:'corner sofa',count:2}]);
 const two=await ingest(one);
 assert.equal(two.usable,'ok');assert.equal(two.product_key,'files');
});

test('a White BK draft 3 request is a square 2K white master without scene choices',async()=>{
 const p=draft3({scope:{outcome:'White BK',outcomes:['White BK'],view:'',aspect:'1:1',resolution:'2K',imageCount:1},preferences:{lighting:'',wallPaint:'',floor:'',useWorkflowDefaults:false},instructions:''});
 delete p.styling;
 const brief=LINK.toOwnerBrief(p),note=LINK.noteOf(p);
 assert.equal(brief.outcome,'White background');assert.equal(brief.lighting,'');assert.equal(brief.human,'no');assert.equal(brief.wallPaint,'');
 assert.equal(note,LINK.NO_INSTRUCTIONS);
 const body=validateSubmission(submit(brief,note));
 assert.equal(body.scope.camera,'Reference view');assert.equal(body.preferences.people,'none');assert.equal(body.styling,undefined);
 const j=(await intake(body)).json;
 assert.equal(j.usable,'ok',j.problems.join(' '));assert.deepEqual(j.not_applied,[]);
 assert.deepEqual(j.brief.outcomes,['white_bk']);assert.equal(j.brief.outputs.length,1);
});

test('"Studio choice" leaves light, wall and floor to the studio',async()=>{
 const p=draft3({preferences:{lighting:'',wallPaint:'',floor:'',useWorkflowDefaults:true}});
 const body=validateSubmission(submit(LINK.toOwnerBrief(p),LINK.noteOf(p)));
 assert.equal(body.preferences.useWorkflowDefaults,true);assert.equal(body.preferences.lighting,'');
 const j=(await intake(body)).json;assert.equal(j.usable,'ok');assert.equal(j.brief.preferences.use_defaults,true);
});

test('the page refuses what the owner backend cannot make, and the backend refuses it again',()=>{
 assert.throws(()=>LINK.toOwnerBrief(draft3({scope:{outcome:'Website',outcomes:['Website'],imageCount:4}})),/outcome_not_connected/);
 assert.throws(()=>LINK.toOwnerBrief(draft3({item:{...draft3().item,inventory:[]}})),/pieces_required/);
 const brief=LINK.toOwnerBrief(draft3()),note=LINK.noteOf(draft3());
 for(const change of [{page:'draft9'},{camera:'Left side'},{wallPaint:'Purple'},{floor:'Carpet'},{human:'maybe'},{lighting:'Neon'},{locks:'x'.repeat(161)},{mustNot:Array(13).fill('a').join('\n')},{resolution:'4K'},{outcome:'Website'}])
  assert.throws(()=>validateSubmission({...submit(brief,note),...change}),undefined,JSON.stringify(change).slice(0,40));
 assert.throws(()=>studioFields({page:'draft3',human:'yes'},'White background'),/invalid_choices/);
});

test('a classic desk submission is unchanged by the draft 3 fields',()=>{
 const input={requestId:ID,product:'Chair',outcome:'Lifestyle',inventory:'1 chair\n8 legs',instructions:'',dimensions:'',sku:'',aspect:'16:9',resolution:'2K',view:'Category template',lighting:'Daylight',confirmed:true};
 assert.deepEqual(validateSubmission(input),{budgetLimitUsd:5,clientRunId:'owner-'+ID,jobMode:'new_project',scope:{outcomes:['Lifestyle'],view:'Category template',camera:'Reference view',series:'Single image',aspect:'16:9',resolution:'2K'},item:{productType:'Chair',category:'Chair',inventory:[{count:1,item:'chair'},{count:8,item:'legs'}],dimensions:'',sku:''},preferences:{lighting:'Daylight',people:'none',useWorkflowDefaults:false},instructions:'',references:[{name:'product-reference',role:'Product / vendor reference'}]});
 assert.throws(()=>validateSubmission({...input,lighting:''}),/invalid_choices/,'the desk still has to name a light');
});

// ---- owner job reads -> midas-result/1
const run={id:ID,outcome:'White BK',planned:[{role:'catalogue',camera:'',light:''}]};
const runLife={id:ID,outcome:'Lifestyle',planned:[{role:'catalogue',camera:'',light:''},{role:'wide',camera:'45° right',light:'warm'}]};
const job=(status,extra={})=>({id:'claude-a7-20261018-x',clientId:'owner-'+ID,status,stage:'06 Package',summary:'Recorded summary.',updatedAt:'2026-10-18T06:34:20.000Z',decisions:{go1:{decision:'go',at:'2026-10-18T05:00:00.000Z'},go2:{decision:'',at:''}},...extra});
const ticket=(gate,extra={})=>({runId:'claude-a7-20261018-x',clientId:'owner-'+ID,status:gate==='go1'?'awaiting_go_1':'awaiting_go_2',gate,round:0,revision:'a'.repeat(64),allowed:gate==='go1'?['go','change','stop']:['approve','repair','stop'],decisionNeeded:'Approve the plan?',shots:[],warnings:[],candidate:gate==='go2'?'https://drive.google.com/file/d/abc_DEF-1/view':null,review:{result:gate==='go2'?'pass':'',defects:[],uncertain:[]},cost:{},paidReady:false,...extra});

test('no A7 record yet: the request is received and still in production',()=>{
 const r=LINK.toResult(run,null,null);
 assert.equal(r.contract,'midas-result/1');assert.equal(r.state,'not_finished');assert.equal(r.images[0].state,'in_production');assert.equal(r.owner.waitingForRecord,true);
});
test('plan approval: waiting on the owner, never finished, no picture',()=>{
 const r=LINK.toResult(run,job('awaiting_go_1'),ticket('go1'));
 assert.equal(r.state,'not_finished');assert.equal(r.owner.gate,'go1');assert.equal(r.owner.attention,true);assert.equal(r.owner.context.revision,'a'.repeat(64));
 assert.equal(r.images[0].state,'in_production');
});
test('image approval: the candidate is linked, a passed review shows "passed checks", never "approved"',()=>{
 const r=LINK.toResult(run,job('awaiting_go_2'),ticket('go2'));
 assert.equal(r.images[0].state,'passed_checks');assert.equal(r.images[0].link,'https://drive.google.com/file/d/abc_DEF-1/view');assert.equal(r.images[0].client_shown_as,'');
 const held=LINK.toResult(run,job('awaiting_go_2'),ticket('go2',{review:{result:'fail',defects:['Contact shadow'],uncertain:[]}}));
 assert.equal(held.images[0].state,'on_hold');
 const mismatched=LINK.toResult(run,job('awaiting_go_2'),ticket('go1'));
 assert.equal(mismatched.owner.context,null,'a ticket for another gate is never shown');
});
test('a white package is complete only with a recorded owner approval',()=>{
 const ok=LINK.toResult(run,job('white_package_ready',{decisions:{go1:{},go2:{decision:'approve',at:'2026-10-18T03:20:22.587Z'}}}),null);
 assert.equal(ok.state,'finished');assert.equal(ok.package.complete,true);assert.equal(ok.images[0].state,'approved');assert.equal(ok.images[0].client_shown_as,'Approved');assert.equal(ok.images[0].decided_at,'2026-10-18T03:20:22.587Z');
 const eye=LINK.toResult(run,job('white_package_ready',{decisions:{go1:{},go2:{decision:'approve_unreviewed',at:'2026-10-18T03:20:22.587Z'}}}),null);
 assert.equal(eye.images[0].client_shown_as,'Approved by the studio');
 const none=LINK.toResult(run,job('white_package_ready'),null);
 assert.equal(none.package.complete,false);assert.equal(none.images[0].state,'passed_checks');
 const life=LINK.toResult(runLife,job('white_package_ready',{decisions:{go1:{},go2:{decision:'approve',at:'2026-10-18T03:20:22.587Z'}}}),null);
 assert.equal(life.state,'not_finished','a Lifestyle job is not finished when only the white image is packaged');
 assert.equal(life.images[0].state,'approved');assert.equal(life.images[1].state,'in_production');
});
test('holds, stops and failures keep their recorded reason',()=>{
 const hold=LINK.toResult(run,job('hold'),null);assert.equal(hold.state,'not_finished');assert.equal(hold.owner.attention,true);assert.equal(hold.images[0].reason,'Recorded summary.');
 const stop=LINK.toResult(run,job('stopped_by_owner'),null);assert.equal(stop.state,'finished');assert.equal(stop.images[0].state,'not_approved');
 const fail=LINK.toResult(run,job('failed_not_started'),null);assert.equal(fail.state,'finished');assert.equal(fail.images[0].state,'not_made');
});

test('the client-first-page studio brief (page "studio") reaches A7 01 and 02 like a draft 3 one',async()=>{
 const brief={page:'studio',product:'Corner sofas',sku:'174770',outcome:'Lifestyle',view:'Wide view',aspect:'4:5',resolution:'2K',lighting:'Golden afternoon',dimensions:'',inventory:'2 corner sofa',budgetUsd:5,startType:'existing_room',
  camera:'Reference view',human:'yes',studioChoice:'no',wallPaint:'Sage',floor:'Light oak',color:'Sand',material:'Boucle',locks:'Keep the brass feet',mustNot:'No rug',department:'Home Furniture',category:'Living Rooms',subCategory:'Sofas',description:''};
 const note='Place the units as photographed.';
 const saved=validateDraft({requestId:ID,mode:'project',title:'Studio · Corner sofas',caseTitle:'Corner sofas',note,brief}).brief;
 assert.deepEqual(saved,brief);
 const body=validateSubmission(submit(brief,note));
 const one=await intake(body),j=one.json;
 assert.equal(j.usable,'ok',j.problems.join(' '));assert.deepEqual(j.not_applied,[]);
 assert.equal(j.brief.preferences.wall,'Sage');assert.equal(j.brief.preferences.people,'one');assert.equal(j.brief.outputs.length,2);
 assert.equal((await ingest(one)).usable,'ok');
 const white=validateSubmission(submit({...brief,outcome:'White background',view:'Category template',aspect:'1:1',lighting:'',human:'no',wallPaint:'',floor:'',studioChoice:'no'},note));
 assert.equal(white.preferences.people,'none');assert.equal(white.styling,undefined);
 assert.throws(()=>validateSubmission(submit({...brief,page:'other'},note)),/invalid_page/);
});

// ---- the guide's full first page (owner, 18 Oct 2026): every option is carried; A7 says itself what it does not apply yet
const guideBrief=(over={})=>({page:'studio',product:'Dining chairs',sku:'174770',outcome:'Lifestyle',view:'Wide view + close-up',aspect:'16:9',resolution:'4K',lighting:'Warm evening',dimensions:'',inventory:'2 dining chair',budgetUsd:5,startType:'product_collection',
 camera:'Left side',human:'no',studioChoice:'no',wallPaint:'Ivory',floor:'Marble',color:'',material:'',locks:'',mustNot:'table',department:'Home Furniture',category:'Dining Rooms',subCategory:'Dining Chairs',description:'',
 outcomes:'Lifestyle\nWebsite\nNew Composition\nCreate with this item',otherOutcome:'',itemRole:'secondary',workOn:'one_by_one',series:'Single image',variationCount:'2',variationAxes:'',plants:'yes',mood:'Warm & inviting',
 midasPicks:'174788\n161283',catalogueRefs:'',links:'https://www.midasfurniture.com/kw/en/example',includeMeta:'no',previousGeneration:'',fidelityStrength:'90',stylingStrength:'40',clutterStrength:'20',reviewFirst:'share_first',grounding:'yes',roomBrief:'',...over});
test('every guide choice reaches A7 01: applied ones in the brief, the rest listed by A7 as not applied',async()=>{
 const brief=guideBrief(),note='Show the two chairs without the table.';
 const saved=validateDraft({requestId:ID,mode:'project',title:'Studio · Dining chairs',caseTitle:'Dining chairs',note,brief}).brief;
 assert.deepEqual(saved,brief,'the saved version keeps every guide field');
 const body=validateSubmission(submit(brief,note));
 assert.deepEqual(body.scope.outcomes,['Lifestyle','Website','New Composition','Create with this item']);assert.equal(body.job.itemRole,'secondary');assert.equal(body.job.type,undefined);
 const j=(await intake(body)).json;
 assert.equal(j.usable,'ok',j.problems.join(' '));
 assert.deepEqual(j.brief.outcomes,['lifestyle','website','new_composition','create_with_item']);
 assert.equal(j.brief.item_role,'secondary');assert.equal(j.brief.resolution,'4K');assert.equal(j.brief.camera_view,'Left side');assert.equal(j.brief.proportions,'16:9');
 assert.deepEqual(j.brief.midas_picks,['174788','161283']);assert.deepEqual(j.brief.exclusions,['table']);
 assert.deepEqual(j.brief.outputs.map(o=>o.id),['white_master','wide','detail','hero','composition_1','scene_1']);
 const na=j.not_applied.join(' | ');
 for(const word of ['Plants','Mood','Fidelity, styling and clutter','Validation','Product links','Description and metadata'])assert.match(na,new RegExp(word),word);
 assert.equal(j.not_applied.length,6,na);
 assert.equal((await ingest((await intake(body)))).usable,'ok');
});
test('White BK alone stays the verified square 2K job; scene options and wrong values are refused',()=>{
 const white=guideBrief({outcome:'White background',outcomes:'White BK',view:'Category template',aspect:'1:1',resolution:'2K',lighting:'',camera:'Reference view',wallPaint:'',floor:'',plants:'no',mood:'Automatic',itemRole:'hero',midasPicks:'',links:'',includeMeta:'yes',fidelityStrength:'',stylingStrength:'',clutterStrength:'',grounding:'no'});
 const body=validateSubmission(submit(white,'x'));
 assert.deepEqual(body.scope.outcomes,['White BK']);assert.equal(body.styling,undefined);assert.equal(body.strengths,undefined);assert.equal(body.validation,undefined);assert.equal(body.details,undefined);
 for(const change of [{outcome:'White background'},{outcomes:'White BK\nPainting'},{outcomes:'Lifestyle\nLifestyle'},{itemRole:'lead'},{series:'Ten views'},{variationCount:'9'},{mood:'Neon'},{fidelityStrength:'101'},{reviewFirst:'later'},{previousGeneration:'Room'},{midasPicks:Array(13).fill('1').join('\n')},{camera:'Top'},{resolution:'8K'}])
  assert.throws(()=>validateSubmission(submit({...guideBrief(),...change},'x')),undefined,JSON.stringify(change).slice(0,50));
});
test('variations ask for the approved run they start from, through the saved parent',async()=>{
 const body=validateSubmission(submit(guideBrief({outcomes:'Variations',variationCount:'3',series:''}),'Vary only: lighting.'));
 assert.equal(body.scope.imageCount,3);
 const refused=(await intake(body)).json;assert.equal(refused.usable,'refuse');assert.match(refused.problems.join(' '),/approved result/);
 const ok=(await intake({...body,parentRunId:'claude-a7-20261018101010-abcdef',jobMode:'edit'})).json;
 assert.equal(ok.usable,'ok',ok.problems.join(' '));assert.deepEqual(ok.brief.outputs.map(o=>o.id),['variation_1','variation_2','variation_3']);assert.equal(ok.brief.job_type,'edit');
});
