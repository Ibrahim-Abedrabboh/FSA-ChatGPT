const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../../n8n/claude-midas-a7/code-nodes');
const hash='a'.repeat(64), contract='locked-contract';
const clone=x=>JSON.parse(JSON.stringify(x));
function run(file,st,body,settings={}) {
 const $=n=>({first:()=>{if(n==='V1 Vault events')return {json:st};if(n==='04 Settings')return {json:settings};throw Error('not run');}});
 return new Function('$','$input',fs.readFileSync(path.join(root,file),'utf8'))($,{first:()=>({json:{body}})})[0].json;
}
function state(result='passed') {
 const candidate={sha256:hash,drive_file_id:'candidate',output_id:'white_master'};
 return {run_id:'test-run',contract_stamp:contract,contract:{},go1_last:{decision:'go',by:'owner'},go2_token:'test-token',go2_round:1,go2_allowed:['approve','approve_unreviewed','repair','stop'],go2:{output_id:'white_master',candidate},review:{result,output_id:'white_master',attempt:1,candidate:clone(candidate),defects:result==='failed'?[{what:'Connector missing'}]:[],unsure:result==='unsure'?[{evidence:'Side not readable'}]:[]},outputs:[{id:'white_master',kind:'white'}],references:[{key:'source',sha256:hash}],product_key:'source',brief:{},inventory:[]};
}
function approve(st,decision='approve') {return run('G2_Go_2_verdict.js',st,{decision,go2_token:st.go2_token,run_id:st.run_id,round:1});}
function packaged(st){
 st.package={outcome:'white_package_ready',manifest:{drive_file_id:'manifest'},manifest_sha256:hash,files:['jpg','webp'].map(format=>({format,drive_file_id:format,sha256:hash,bytes:100}))};
 return st;
}
function finish(st){return run('19a_Scene_ticket.js',st,null,{scenes:{enabled:true}});}
test('passed review is bound to image, output and attempt',()=>{
 const s=approve(state());assert.equal(s.approved.release.classification,'reviewed_owner_approved');assert.equal(s.approved.release.candidate_sha256,hash);assert.equal(s.go2_last.release.contract_stamp,contract);
});
for(const result of ['failed','unsure','not reviewed'])test(result+' remains an explicit owner exception',()=>{
 const s=approve(state(result));assert.equal(s.status,'white_master_approved');assert.equal(s.approved.release.classification,'owner_exception');assert.equal(s.approved.release.catalogue_eligible,false);assert.notEqual(s.approved.shown_as,'Approved');assert.equal(s.review.result,result);
});
test('review of different bytes cannot qualify the new candidate',()=>{
 const s=state();s.review.candidate.sha256='b'.repeat(64);assert.equal(approve(s).approved.release.review_bound,false);
});
test('owner by-eye and client labels preserve confirmed wording',()=>{
 const s=approve(state('not reviewed'),'approve_unreviewed');assert.equal(s.approved.shown_as,'Approved by the studio · not reviewed');assert.equal(s.approved.client_shown_as,'Approved by the studio');
});
test('stale contract or replaced image cannot reuse approval for packaging',()=>{
 for(const change of ['contract','bytes']) {const s=approve(state());if(change==='contract')s.contract_stamp='changed';else s.approved.candidate.sha256='b'.repeat(64);const out=run('18a_Package_ticket.js',s);assert.equal(out.pk.ok,false);assert.match(out.pk.problem,/different bytes/);}
});
test('complete white-only package and complete exception package are distinct',()=>{
 for(const result of ['passed','failed']){const s=finish(packaged(approve(state(result))));assert.equal(s.package_release.complete,true);assert.equal(s.package_release.classification,result==='passed'?'reviewed_owner_approved':'owner_exception');}
});
test('missing requested output never passes because successful subset is ready',()=>{
 const s=packaged(approve(state()));s.outputs.push({id:'variation',kind:'variation'});const out=finish(s);assert.equal(out.status,'hold');assert.equal(out.package_release.complete,false);assert.equal(out.package_release.outputs[1].complete,false);
});
test('missing file or missing manifest prevents complete package',()=>{
 for(const part of ['file','manifest']){const s=packaged(approve(state()));if(part==='file')s.package.files.pop();else delete s.package.manifest;assert.equal(finish(s).package_release.complete,false);}
});
test('duplicate output IDs prevent complete package',()=>{
 const s=packaged(approve(state()));s.outputs.push(clone(s.outputs[0]));assert.equal(finish(s).package_release.complete,false);
});
test('changed contract invalidates already rendered delivery',()=>{const s=packaged(approve(state()));s.contract_stamp='new';assert.equal(finish(s).package_release.complete,false);});
test('complete scene set needs its own approval and both formats, not inherited white approval',()=>{
 const s=packaged(approve(state()));s.outputs.push({id:'hero',kind:'hero'});
 const candidate={sha256:'b'.repeat(64),drive_file_id:'scene-master'};
 const release={...s.approved.release,output_id:'hero',candidate_sha256:candidate.sha256};
 s.scenes={queue:['hero'],done:{hero:{by:'owner',candidate,release,files:{status:'ready',manifest_drive_file_id:'scene-manifest',manifest_sha256:hash,files:clone(s.package.files)}}},held:{},log:[]};
 const complete=finish(s);assert.equal(complete.status,'scenes_complete');assert.equal(complete.package_release.complete,true);
 s.scenes.done.hero.release=clone(s.approved.release);assert.equal(finish(s).package_release.complete,false);
});
test('review pass alone never certifies unfinished guidance as catalogue eligible',()=>{
 const s=state();s.contract.guidance={baseline_id:'a7-guidance-2026-10-17-v1',compliance:'partial'};const out=approve(s);
 assert.equal(out.approved.release.classification,'reviewed_owner_approved');assert.equal(out.approved.release.catalogue_eligible,false);assert.equal(out.approved.release.guidance.baseline_id,s.contract.guidance.baseline_id);
 assert.match(out.approved.release.guidance_compliance,/Not certified/);
});
