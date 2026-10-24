const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../..'),nodes=path.join(root,'n8n/claude-midas-a7/code-nodes');
const fixture=require('./fixtures/separate-units-observation.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const structuredSides=[{piece:'sectional chaise component',side:'chaise extension on left, connecting bracket on right'},{piece:'right-arm sectional sofa component',side:'connecting bracket on left, track arm on right'}];
function reviewTicket(st){
 const $=name=>({first:()=>name==='V1 Vault events'?{json:st}:{binary:{photo:{mimeType:'image/jpeg',data:'test'},image:{mimeType:'image/jpeg',data:'test'}}}});
 return new Function('$','require',fs.readFileSync(path.join(nodes,'16a_Review_ticket.js'),'utf8'))($,require)[0].json.rv;
}
function compile(change={}){
 const st={run_id:'fidelity-regression',client_run_id:'test',status:'go_1_given',go1_last:{decision:'go',by:'owner'},contract:{version:1},contract_stamp:'test-contract',inventory:fixture.inventory,observation:clone(fixture.observation),exclusions:[],unknowns:[],brief:{product_type:'Sofa set',resolution:'2K'},outputs:[{id:'white_master',kind:'white',locks:[]}],product_key:'photo',references:[{key:'photo',name:'source.jpg',image:true,sha256:'source-hash',mime:'image/jpeg'}],trail:[],...change};
 const $=name=>({first:()=>({json:st})});
 return new Function('$','$input','require',fs.readFileSync(path.join(nodes,'13_Compile.js'),'utf8'))($,{first:()=>({json:{image_size:'2K'}})},require)[0].json;
}
test('real failed observation: photographed arrangement overrides inferred assembly',()=>{
 const s=compile(),p=s.s04.dispatch.prompt;assert.equal(s.s04.go,true);assert.match(p,/Do not assemble separate units/);assert.match(p,/Reader relationship notes.*may describe function/);assert.doesNotMatch(p,/Keep how the pieces stand to each other: The chaise section and the sofa section interlock/);
});
test('visible unfinished connector faces and brackets are specifically protected',()=>{
 const p=compile().s04.dispatch.prompt;assert.match(p,/exposed connector faces/);assert.match(p,/metal interlocking brackets/);assert.match(p,/Do not upholster over/);
});
test('existing patterned cushions are not simplified',()=>{
 const p=compile().s04.dispatch.prompt;assert.match(p,/concentric square geometric accent pillows/);assert.doesNotMatch(p,/keep it, plain/);assert.match(p,/do not simplify its pattern/);
});
test('connected source assemblies are protected too; no blanket separation',()=>{
 const obs=clone(fixture.observation);obs.relations=['The three modules are visibly connected into one sectional.'];
 const p=compile({observation:obs}).s04.dispatch.prompt;assert.match(p,/or separate units that image 1 shows connected/);assert.match(p,/Preserve only the connections actually visible/);assert.match(p,/three modules are visibly connected/);
});
test('reference authority, source checksum, frame and paid approval gate stay intact',()=>{
 const s=compile();assert.equal(s.s04.dispatch.references[0].role,'vendor photo');assert.equal(s.s04.dispatch.references[0].sha256,'source-hash');assert.equal(s.s04.dispatch.ratio,'1:1');assert.equal(s.s04.dispatch.attempt,1);assert.equal(compile({go1_last:{decision:'stop',by:'owner'}}).s04.go,false);
});
test('review ticket checks gaps and connector faces using existing identity gates',()=>{
 const st=compile();st.stage04={candidate:{output_id:'white_master',drive_file_id:'candidate',sha256:'candidate-hash'}};
 const $=name=>({first:()=>name==='V1 Vault events'?{json:st}:{binary:{photo:{mimeType:'image/jpeg',data:'test'},image:{mimeType:'image/jpeg',data:'test'}}}});
 const r=new Function('$','require',fs.readFileSync(path.join(nodes,'16a_Review_ticket.js'),'utf8'))($,require)[0].json;
 assert.match(r.rv.critic_text,/Joining separate units fails pieces_match/);assert.match(r.rv.critic_text,/connector brackets/);assert.match(r.rv.critic_text,/fails details/);
});
test('structured reader handedness survives white generation and contract locks',()=>{
 const observation={...clone(fixture.observation),sided_parts:structuredSides};
 const st=compile({observation}),p=st.s04.dispatch.prompt;
 assert.match(p,/sectional chaise component: chaise extension on left, connecting bracket on right/);assert.doesNotMatch(p,/\[object Object\]/);
 st.brief={...st.brief,outputs:[{id:'white_master',kind:'white'}],preferences:{}};st.trail=[];st.profile={checks:[]};st.conflicts=[];
 const out=new Function('$input',fs.readFileSync(path.join(nodes,'08_Locks_and_freedoms.js'),'utf8'))({first:()=>({json:st})})[0].json;
 assert.match(out.outputs[0].locks.join(';'),/right-arm sectional sofa component: connecting bracket on left, track arm on right/);assert.doesNotMatch(out.outputs[0].locks.join(';'),/\[object Object\]/);
});
test('scene placement permits composition without fabricated corner construction',()=>{
 const s=compile({status:'scene_due',approved:{by:'owner'},observation:{...clone(fixture.observation),sided_parts:structuredSides},outputs:[{id:'hero',kind:'hero'}],scene:{output_id:'hero',kind:'hero',phase:'place',refs:[{n:1,role:'vendor photo',key:'photo'}],props:[],presets:{},room:{},framing:{}}});
 assert.equal(s.s04.go,true);const p=s.s04.dispatch.prompt;
 assert.match(p,/approved scene plan may reposition/);assert.match(p,/invent a wedge-shaped connector/);assert.match(p,/Compatibility is not evidence/);assert.doesNotMatch(p,/Keep how the pieces stand to each other:|\[object Object\]/);
});
test('white and scene review receive category focus and readable sides; blind counts stay blind',()=>{
 for(const scene of [false,true]){
  const st=compile({observation:{...clone(fixture.observation),sided_parts:structuredSides},profile:{checks:['All seats and modules retained','Arms and upholstery unchanged']}});
  st.stage04={candidate:{output_id:scene?'hero':'white_master',scene:scene?{phase:'place'}:null,sha256:'candidate'}};st.scene={props:[],presets:{},framing:{type:'hero'}};
  const rv=reviewTicket(st);assert.deepEqual(rv.category_checks,st.profile.checks);assert.match(rv.critic_text,/All seats and modules retained/);assert.match(rv.critic_text,/sectional chaise component: chaise extension on left/);assert.doesNotMatch(rv.critic_text,/\[object Object\]/);assert.doesNotMatch(rv.blind_text,/All seats and modules retained|sectional chaise component/);
  if(scene)assert.match(rv.critic_text,/unrequested fabricated connection or a wedge-shaped replacement fails/);
 }
});
test('explicit scene contract changes reach generation and review without certifying assembly',()=>{
 const locks=['Owner requests a proposed visual assembly of the original modules into an L; preserve every source module shape.','Keep the existing windows unchanged.'];
 const output={id:'hero',kind:'hero',locks,checks:['All seats and modules retained']};
 const s=compile({status:'scene_due',approved:{by:'owner'},outputs:[output],profile:{checks:['unrelated current profile']},scene:{output_id:'hero',kind:'hero',phase:'place',refs:[{n:1,role:'vendor photo',key:'photo'}],props:[],presets:{},room:{},framing:{}}});
 assert.equal(s.s04.go,true);for(const l of locks)assert.ok(s.s04.dispatch.prompt.includes(l));assert.match(s.s04.dispatch.prompt,/unless this output's approved constraints explicitly request/);assert.match(s.s04.dispatch.prompt,/not verified physical compatibility/);
 s.stage04={candidate:{output_id:'hero',scene:{phase:'place'}}};const rv=reviewTicket(s);for(const l of locks)assert.ok(rv.critic_text.includes(l));assert.deepEqual(rv.category_checks,output.checks);assert.doesNotMatch(rv.blind_text,/Owner requests|existing windows/);
});
test('category data remains in candidate review and repair preserves structured handedness',()=>{
 const st=JSON.parse(fs.readFileSync(path.join(root,'tests/claude-midas-a7-stage-05/v1_404.json'),'utf8'));st.inventory=clone(fixture.inventory);st.observation={...clone(fixture.observation),sided_parts:structuredSides};st.profile={checks:['All seats and modules retained']};
 st.stage04={candidate:{output_id:'white_master',sha256:'candidate'}};const rv=reviewTicket(st);
 const keys=['piece_count','pieces_match','shape','colour','material_texture','details','handedness','not_mirrored','nothing_added','excluded_absent','context_removed','background','contact_shadow','whole_in_frame','no_text_or_logo','realism'];
 const checks=Object.fromEntries(keys.map(k=>[k,{result:'pass',evidence:'source match'}]));checks.piece_count.seen=2;checks.details={result:'fail',evidence:'connector missing'};
 const outputs={'V1 Vault events':{json:st},'16a Review ticket':{json:{rv}},'04 Settings':{json:{}},'16 Critic review':{json:{content:[{type:'text',text:JSON.stringify({checks,defects:[{check:'details',what:'connector missing',fix:'restore the source connector'}],scores:{},summary:'details fail'})}]}},'16x Blind count':{json:{candidates:[{content:{parts:[{text:JSON.stringify({total:2,box_2d:[100,100,900,900],background_white:true,cropped:false})}]}}]}}};
 const $=n=>({first:()=>outputs[n]||(()=>{throw Error('not run')})()});
 const out=new Function('$','require',fs.readFileSync(path.join(nodes,'16b_Review_verdict.js'),'utf8'))($,require)[0].json;
 assert.equal(out.review.result,'failed');assert.deepEqual(out.review.category_requirements,rv.category_checks);assert.match(out.go2_proposed_repair.preserve.join(';'),/sectional chaise component: chaise extension on left/);assert.doesNotMatch(out.go2_proposed_repair.preserve.join(';'),/\[object Object\]/);assert.equal(out.status,'awaiting_go_2');
});
test('new jobs cannot generate against a missing or mismatched guidance baseline',()=>{
 for(const guidance of [undefined,{baseline_id:'old',sha256:'old'}])assert.equal(compile({guidance_required:true,contract:{version:1,guidance}}).s04.go,false);
 const fsRaw=fs.readFileSync(path.join(root,'n8n/claude-midas-a7/reference-review/guidance-baseline.json'),'utf8');
 const baseline=JSON.parse(fsRaw),sha256=require('node:crypto').createHash('sha256').update(fsRaw).digest('hex');
 assert.equal(compile({guidance_required:true,contract:{version:1,guidance:{baseline_id:baseline.id,sha256}}}).s04.go,true);
});
