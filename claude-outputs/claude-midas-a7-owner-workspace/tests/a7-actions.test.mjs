import {randomUUID} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';
import {validateSubmission,validateDecision,validateImage,sameOrigin,claimOnce,editRequest,EDIT_DISPATCH_HELP} from '../lib/a7-actions.mjs';
import handler from '../netlify/functions/owner-actions.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
const input={requestId:'e10efbc4-4f57-4dca-a6e6-d763c4645179',product:'Dining set',inventory:'1 table\n8 chairs',outcome:'Lifestyle',aspect:'16:9',resolution:'2K',view:'Wide view',lighting:'Daylight',instructions:'Keep the product',dimensions:'',sku:'',confirmed:true};
test('submission maps explicit choices and rejects missing counts, unsupported options, and confirmation',()=>{
 const p=validateSubmission(input);assert.equal(p.item.inventory[1].count,8);assert.equal(p.scope.aspect,'16:9');assert.equal(p.preferences.people,'none');
 for(const change of [{inventory:'chairs'},{inventory:'200 chairs'},{outcome:'Invent a product'},{aspect:'18:9'},{resolution:'1K'},{confirmed:false},{requestId:'bad'}])assert.throws(()=>validateSubmission({...input,...change}));
});
test('saved draft uses one stable spending identity independent of retry request',()=>{
 const draftId='130efbc4-4f57-4dca-a6e6-d763c4645179';
 const expected=sharedRunIdentity(draftId);
 const first=validateSubmission({...input,draftId});
 const retry=validateSubmission({...input,draftId,requestId:'e10efbc4-4f57-4dca-a6e6-d763c4645180'});
 assert.equal(first.clientRunId,expected.clientRunId);
 assert.equal(first.runId,expected.runId);
 assert.equal(retry.clientRunId,first.clientRunId);
 assert.equal(retry.runId,first.runId);
 assert.throws(()=>sharedRunIdentity('bad'),/draft_required/);
});
test('image bytes must match the accepted type and bounded size',()=>{const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);validateImage(png,'image/png');assert.throws(()=>validateImage(png,'image/jpeg'));assert.throws(()=>validateImage(Buffer.alloc(3*1024*1024+1),'image/png'));assert.throws(()=>validateImage(Buffer.from('<svg></svg>'),'image/svg+xml'));});
test('approval binds the exact revision and offered action; a plan change requires a note',()=>{const c={revision:'new',allowed:['go','change','stop'],clientId:'job',runId:'run',round:2};const i={requestId:input.requestId,revision:'new',decision:'go',note:'',confirmed:true};assert.equal(validateDecision(i,c).round,2);for(const x of [{revision:'old'},{decision:'approve'},{confirmed:false},{decision:'change'}])assert.throws(()=>validateDecision({...i,...x},c));});
test('cross-origin, absent origin, and cross-site submissions fail closed',()=>{const make=h=>new Request('https://example.test/api/owner/submissions',{headers:h});assert.equal(sameOrigin(make({origin:'https://example.test'})),true);assert.equal(sameOrigin(make({})),false);assert.equal(sameOrigin(make({origin:'https://evil.test'})),false);assert.equal(sameOrigin(make({origin:'https://example.test','sec-fetch-site':'cross-site'})),false);});
test('concurrent duplicate requests get one immutable claim and conflicts do not send',async()=>{const values=new Map();const store={async setJSON(k,v){if(values.has(k))return {modified:false};values.set(k,v);return {modified:true};},async get(k){return values.get(k)}};const results=await Promise.all(Array.from({length:12},()=>claimOnce(store,'submit/id','same')));assert.equal(results.filter(Boolean).length,1);await assert.rejects(()=>claimOnce(store,'submit/id','different'),/request_conflict/);});
test('write API checks live owner role before storage or A7 access',async()=>{const response=await handler(new Request('https://example.test/api/owner/submissions',{method:'POST'}),{cookies:{get:()=>undefined}});assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');});
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const projection=await readFile(new URL('../lib/owner-context-projection.js.txt',import.meta.url),'utf8');
function ticketContext(row,ticket,kind='go1_ticket',at=new Date().toISOString(),events=[]){
 const record={run_id:row.run_id,kind,contract_stamp:row.contract_stamp,at,payload:JSON.stringify(ticket)};
 return new Function('$','$input','require',projection)(name=>({first:()=>({json:{query:{id:row.run_id}}}),all:()=>[{json:row}]}),{all:()=>[{json:record},...events.map(json=>({json}))]},createRequire(import.meta.url))[0].json;
}
const waiting={run_id:'run',client_run_id:'owner-id',status:'awaiting_go_1',go1_rounds:0,go1_token:'private-token',resume_url:'https://private-wait',contract_stamp:'stamp',cost_estimate:'{"max_two_repairs_each":1}'};
test('approval projection omits tokens and waiting URLs, closes answered tickets and keeps only stop on an expired one',()=>{
 const ticket={shots:[{n:1,kind:'white',plan:{setting:'Pure white'}}]};const c=ticketContext(waiting,ticket);assert.deepEqual(c.allowed,['go','stop']);const serialized=JSON.stringify(c);assert.ok(!serialized.includes('private-token'));assert.ok(!serialized.includes('private-wait'));
 assert.deepEqual(ticketContext({...waiting,status:'hold'},ticket).allowed,[]);
 const expired=ticketContext(waiting,{...ticket,decision_needed:'Approve the plan'},'go1_ticket','2020-01-01T00:00:00.000Z');
 assert.deepEqual(expired.allowed,['stop']);assert.match(expired.decisionNeeded,/more than 24 hours old, so the run cannot continue from it\. You can stop the run/);
 assert.deepEqual(ticketContext({...waiting,resume_url:''},ticket,'go1_ticket','2020-01-01T00:00:00.000Z').allowed,[],'without a way to answer the ticket, nothing is offered');
});
test('an edit of an approved image is not offered plan changes at Go 1',()=>{
 const ticket={shots:[{n:1,kind:'hero',plan:{setting:'Living room'}}]};
 assert.deepEqual(ticketContext(waiting,ticket).allowed,['go','change','stop']);
 const brief={run_id:waiting.run_id,kind:'brief',at:'2026-10-19T09:00:00.000Z',payload:JSON.stringify({edit:{base:{output_id:'hero',sha256:'e'.repeat(64)}}})};
 assert.deepEqual(ticketContext(waiting,ticket,'go1_ticket',new Date().toISOString(),[brief]).allowed,['go','stop']);
});
test('the bridge definition matches the projection file and returns the owner-approved results of the run',async()=>{
 const definition=await readFile(new URL('../a7-owner-actions-workflow.ts',import.meta.url),'utf8');
 const code=name=>JSON.parse(definition.split('\n').find(line=>line.includes('"name": "'+name+'"')).match(/"jsCode": ("(?:[^"\\]|\\.)*")/)[1]);
 assert.equal(code('Safe approval context'),projection,'the repo projection is the one in the bridge definition');
 assert.match(definition,/\.to\(project\)\.to\(approved\)\.to\(reply\)/);
 const row={...waiting,status:'scenes_complete',updatedAt:'2026-10-19T10:00:00Z',scenes:JSON.stringify({done:{hero:{by:'owner',at:'2026-10-19T09:00:00.000Z',without_review:false,candidate:{drive_file_id:'1AbCdEfGhIjKlMnOp',sha256:'e'.repeat(64),px:'2048x2048',file_name:'hero.png'}},wide:{by:'code',candidate:{drive_file_id:'1AbCdEfGhIjKlMnOq',sha256:'f'.repeat(64)}},detail:{by:'owner',without_review:true,candidate:{drive_file_id:'bad id',sha256:'a'.repeat(64)}}}})};
 const run=ctx=>new Function('$','$input',code('Approved results'))(name=>({first:()=>({json:{query:{id:row.run_id}}}),all:()=>[{json:row},{json:{...row,client_run_id:'owner-other',scenes:'{}'}}]}),{first:()=>({json:ctx})})[0].json;
 const out=run({http_status:200,runId:row.run_id,clientId:row.client_run_id});
 assert.deepEqual(out.results,[{outputId:'hero',kind:'scene',driveFileId:'1AbCdEfGhIjKlMnOp',sha256:'e'.repeat(64),px:'2048x2048',fileName:'hero.png',reviewed:true,approvedAt:'2026-10-19T09:00:00.000Z'}]);
 const {cleanResults}=await import('../lib/a7-results.mjs');assert.deepEqual(cleanResults(out.results).map(r=>r.outputId),['hero'],'the site keeps what the node returns');
 assert.deepEqual(run({http_status:404,error:'not_found'}),{http_status:404,error:'not_found'});
});
test('the bridge also returns the approved white master of a finished white package, and only that exact file',()=>{
 return readFile(new URL('../a7-owner-actions-workflow.ts',import.meta.url),'utf8').then(definition=>{
  const code=JSON.parse(definition.split('\n').find(line=>line.includes('"name": "Approved results"')).match(/"jsCode": ("(?:[^"\\]|\\.)*")/)[1]);
  const master={output_id:'white_master',drive_file_id:'1hvmFnJu7seIt6DRN0ks7qycIZzYDukCR',sha256:'c'.repeat(64),px:'2048x2048',file_name:'white_master_try1.jpg'};
  const release={run_id:waiting.run_id,output_id:'white_master',classification:'reviewed_owner_approved',candidate_sha256:'c'.repeat(64),at:'2026-10-18T03:20:22.587Z'};
  const results=pkg=>{const row={...waiting,status:'white_package_ready',updatedAt:'2026-10-19T10:00:00Z',scenes:'',package:JSON.stringify(pkg)};
   return new Function('$','$input',code)(()=>({first:()=>({json:{query:{id:row.run_id}}}),all:()=>[{json:row}]}),{first:()=>({json:{http_status:200,runId:row.run_id,clientId:row.client_run_id}})})[0].json.results;};
  assert.deepEqual(results({outcome:'white_package_ready',master,release}),[{outputId:'white_master',kind:'white',driveFileId:master.drive_file_id,sha256:'c'.repeat(64),px:'2048x2048',fileName:'white_master_try1.jpg',reviewed:true,approvedAt:release.at}]);
  assert.equal(results({outcome:'white_package_ready',master,release:{...release,classification:'owner_exception'}})[0].reviewed,false);
  for(const pkg of [{outcome:'hold',master,release},{outcome:'white_package_ready',master,release:{...release,candidate_sha256:'d'.repeat(64)}},{outcome:'white_package_ready',master,release:{...release,run_id:'claude-a7-other'}},{outcome:'white_package_ready',master,release:{...release,classification:'incomplete'}},{outcome:'white_package_ready',master:{...master,drive_file_id:'bad id'},release}])
   assert.deepEqual(results(pkg),[],'no white result unless the package is finished and its release names exactly this file');
 });
});
test('image approval requires an allowlisted candidate and uses the ticket decision list',()=>{
 const row={...waiting,status:'awaiting_go_2',go2_round:1,go2_token:'secret',review:'{"go2_decisions":["review_again","stop"]}'};
 assert.deepEqual(ticketContext(row,{candidate:{link:'https://evil.test/image'}},'go2_ticket').allowed,['stop']);
 const c=ticketContext(row,{candidate:{link:'https://drive.google.com/file/d/abc123/view'}},'go2_ticket');assert.deepEqual(c.allowed,['review_again','stop']);assert.equal(c.candidate,'https://drive.google.com/file/d/abc123/view');
});

test('legacy null review and cost fields remain readable without actions',()=>{const c=ticketContext({...waiting,review:'null',cost_estimate:'null',status:'hold'},{});assert.equal(c.review.result,'');assert.deepEqual(c.allowed,[]);});
test('plan context includes room, Midas pieces and known generation holds before approval',()=>{const c=ticketContext(waiting,{shots:[{n:1,kind:'hero',plan:{room:{walls:'white'},midas_pieces:[{sku:'SKU-1',count:2,purpose:'support',rests_on:'floor'}]}}],stage04_precheck:{will_hold:['photo cropped']},not_confirmed:['height']});assert.equal(c.shots[0].plan.room,'walls: white');assert.match(c.shots[0].plan.midas_pieces,/SKU-1 · quantity 2/);assert.ok(c.warnings.includes('Generation hold: photo cropped'));});

test('standard Drive sharing suffix is normalized without accepting arbitrary query parameters',()=>{const row={...waiting,status:'awaiting_go_2',go2_round:1,go2_token:'secret',review:'{\"go2_decisions\":[\"approve\",\"stop\"]}'};const c=ticketContext(row,{candidate:{link:'https://drive.google.com/file/d/abc/view?usp=drivesdk'}},'go2_ticket');assert.equal(c.candidate,'https://drive.google.com/file/d/abc/view');assert.deepEqual(c.allowed,['approve','stop']);assert.equal(ticketContext(row,{candidate:{link:'https://drive.google.com/file/d/abc/view?token=secret'}},'go2_ticket').candidate,null);});
test('an edit draft reaches A7 with structured change and keep fields; a new project carries none',()=>{
 const parent='130efbc4-4f57-4dca-a6e6-d763c4645179';
 assert.deepEqual(editRequest({parent_id:parent,brief:{allowedChanges:'Warm evening light',protectedDetails:'Same sofa and cushions'}}),{source:'saved',changes:'Warm evening light',preserve:'Same sofa and cushions',parentVersionId:parent,options:[]});
 assert.deepEqual(editRequest({parent_id:null,brief:{editSource:'new',allowedChanges:'Swap rug',protectedDetails:'Sofa'}}),{source:'new',changes:'Swap rug',preserve:'Sofa',parentVersionId:null,options:[]});
 assert.deepEqual(editRequest({parent_id:parent,brief:{allowedChanges:'x',protectedDetails:'y',editOptions:'lighting=Warm evening|props=Fewer'}}).options,[{kind:'lighting',value:'Warm evening'},{kind:'props',value:'Fewer'}]);
 assert.equal(editRequest({parent_id:null,brief:{routeIntent:'project'}}),null);
});
test('fixable edit refusals tell the owner what to do and that nothing was sent',()=>{
 for(const code of ['edit_instructions_required','saved_version_required'])assert.match(EDIT_DISPATCH_HELP[code],/Nothing was sent to A7\.$/);
 assert.match(EDIT_DISPATCH_HELP.edit_instructions_required,/what to change and what to keep/);
});
test('refused sends and decisions carry plain words, never only a code',async()=>{
 const {sendRefusal,DECISION_HELP}=await import('../lib/a7-actions.mjs');
 const mismatch=sendRefusal('confirmed_inventory_mismatch',{pieces:3,confirmed:2});
 assert.equal(mismatch.status,409);assert.match(mismatch.body.message,/add up to 3, but the confirmed count is 2\. Change the pieces so they add up to 2/);
 for(const code of ['hero_product_reference','draft_changed','batch_dispatch','not_found']){const r=sendRefusal(code);assert.equal(r.body.error,code);assert.doesNotMatch(r.body.message,/confirmed source facts are required/,code+' has its own words');}
 assert.equal(sendRefusal('analysis_confirmation_stale').body.error,'source_confirmation_required');
 assert.equal(sendRefusal('something_internal').status,503);
 for(const code of ['stale_decision','legacy_budget_missing','change_note_required'])assert.match(DECISION_HELP[code],/\./);
 const previousFetch=globalThis.fetch,previousNetlify=globalThis.Netlify;
 const context={runId:'claude-a7-run',clientId:'owner-'+randomUUID(),status:'awaiting_go_1',gate:'go1',round:1,revision:'a'.repeat(64),allowed:['go','change','stop'],shots:[],warnings:[]};
 globalThis.Netlify={env:{get:key=>({A7_OWNER_ACTIONS_ENABLED:'true',A7_READ_AUTHORIZATION:'synthetic'})[key]}};
 globalThis.fetch=async url=>String(url).includes('owner-context')?Response.json(context):Response.json({id:'owner',app_metadata:{roles:['owner']}});
 try{
  const response=await handler(new Request('https://example.test/api/owner/jobs/claude-a7-run/approval',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),revision:'b'.repeat(64),decision:'stop',note:'',confirmed:true})}),{params:{id:'claude-a7-run'},cookies:{get:()=> 'synthetic-test-token'},site:{url:'https://example.test'},deploy:{context:'production'}});
  assert.equal(response.status,409);const body=await response.json();assert.equal(body.error,'stale_decision');assert.match(body.message,/Refresh the job/);
 }finally{globalThis.fetch=previousFetch;globalThis.Netlify=previousNetlify;}
});
test('a decision A7 did not confirm can be sent again with the same body; an accepted one keeps its receipt',async()=>{
 const {actionStore}=await import('../netlify/functions/owner-actions.mjs');
 const values=new Map(),memory={setJSON:async(key,value,{onlyIfNew}={})=>{if(onlyIfNew&&values.has(key))return {modified:false};values.set(key,value);return {modified:true};},get:async key=>values.get(key)??null,set:async(key,value)=>{values.set(key,value);return {modified:true};},delete:async key=>{values.delete(key);}};
 const context={runId:'claude-a7-run',clientId:'owner-'+randomUUID(),status:'awaiting_go_1',gate:'go1',round:1,revision:'a'.repeat(64),allowed:['go','change','stop'],shots:[],warnings:[]};
 const previousFetch=globalThis.fetch,previousNetlify=globalThis.Netlify,previousStore=actionStore.get;let decisions=0,answer='fail';
 globalThis.Netlify={env:{get:key=>({A7_OWNER_ACTIONS_ENABLED:'true',A7_READ_AUTHORIZATION:'synthetic'})[key]}};actionStore.get=()=>memory;
 globalThis.fetch=async url=>{url=String(url);if(url.includes('owner-context'))return Response.json(context);if(url.includes('owner-decision')){decisions++;if(answer==='fail')throw Error('socket hang up');return Response.json({accepted:true,forwarded:true,clientId:context.clientId,outcome:'received'});}return Response.json({id:'owner',app_metadata:{roles:['owner']}});};
 const send=()=>handler(new Request('https://example.test/api/owner/jobs/claude-a7-run/approval',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),revision:context.revision,decision:'stop',note:'',confirmed:true})}),{params:{id:'claude-a7-run'},cookies:{get:()=> 'synthetic-test-token'},site:{url:'https://example.test'},deploy:{context:'production'}});
 try{
  const lost=await send();assert.equal(lost.status,502);const body=await lost.json();assert.equal(body.retryable,true);assert.match(body.message,/did not confirm this decision/);
  answer='ok';const retried=await send();assert.equal(retried.status,200,'the gate is not locked by the unconfirmed attempt');assert.equal(decisions,2);
  const repeat=await send();assert.equal(repeat.status,200);assert.equal(decisions,2,'an accepted decision is answered from its receipt, not sent again');
 }finally{globalThis.fetch=previousFetch;globalThis.Netlify=previousNetlify;actionStore.get=previousStore;}
});
test('the estimate\'s send blockers are the checks the send runs',async()=>{
 const {sendBlockers}=await import('../lib/a7-send-check.mjs');
 const product={reference_id:'r1',role:'product',sha256:'a'.repeat(64),bytes:100},id=randomUUID();
 const brief={product:'Sofa',sku:'',dimensions:'',inventory:'1 sofa',outcome:'White background',view:'Category template',aspect:'1:1',resolution:'2K',lighting:'Daylight',budgetUsd:4.74,routeIntent:'single',routeChoice:'hero'};
 const codes=(draft,refs=[product],options={})=>sendBlockers({id,note:'Keep the sofa',...draft},refs,{estimate:{status:'verified'},paidReady:true,...options}).map(b=>b.code);
 assert.deepEqual(codes({brief}),[]);
 assert.deepEqual(codes({brief:{...brief,routeChoice:'secondary'}}),['hero_product_reference']);
 assert.deepEqual(codes({brief},[product,{...product,reference_id:'r2',role:'other_view'}]),['bridge_single_reference']);
 assert.deepEqual(codes({brief},[product,{...product,reference_id:'r2',role:'other_view'}],{multiReference:true}),[]);
 assert.deepEqual(codes({brief:{...brief,outcome:'Lifestyle',outcomes:'Variations',page:'studio',lighting:''}}),['variations_not_available']);
 assert.deepEqual(codes({brief:{...brief,inventory:'some chairs'}}),['invalid_inventory']);
 assert.deepEqual(codes({brief:{...brief,routeIntent:'edit',routeChoice:'saved'},parent_id:randomUUID()}),['edit_instructions_required']);
 assert.deepEqual(codes({brief},[product],{paidReady:false,estimate:{status:'provisional'}}),['estimate_not_verified','paid_guards_not_ready']);
 assert.deepEqual(codes({brief},[product],{testMode:true,estimate:{status:'provisional'}}),[]);
 for(const b of sendBlockers({id,note:'x',brief:{...brief,routeChoice:'secondary',inventory:''}},[],{estimate:{status:'verified'}}))assert.doesNotMatch(b.message,/^[a-z_]+$/,b.code+' has words');
});

test('A7 refusing a job at its intake is a definite refusal with its reasons; anything else stays unknown',async()=>{
 const {a7SendRefusal}=await import('../lib/a7-actions.mjs');
 const r=a7SendRefusal({accepted:false,receiptKind:'rejected',upstreamStatus:422,error:null,problems:['The piece count does not match the photo.','x'.repeat(400)]});
 assert.equal(r.refused,true);assert.equal(r.upstreamStatus,422);assert.equal(r.problems[1].length,300);
 assert.match(r.message,/^A7 refused to start this job \(answer 422\)\. A7 said: The piece count does not match the photo\./);
 assert.match(r.message,/Nothing was read or paid by this send, and the saved version is a draft again/);
 assert.match(a7SendRefusal({receiptKind:'rejected',upstreamStatus:422}).message,/A7 gave no reason this site can show\./);
 assert.match(a7SendRefusal({receiptKind:'rejected',upstreamStatus:404,error:'not_found'}).message,/reason not found\./);
 for(const unknown of [{receiptKind:'rejected',upstreamStatus:502},{receiptKind:'transport_error',upstreamStatus:null},{receiptKind:'invalid_response',upstreamStatus:200},{accepted:true,receiptKind:'accepted',upstreamStatus:200},null])assert.equal(a7SendRefusal(unknown),null);
});
test('the send reopens a refused version, releases its claim and answers 422 before any receipt is stored',async()=>{
 const src=await readFile(new URL('../netlify/functions/owner-actions.mjs',import.meta.url),'utf8');
 const at=src.indexOf('const refused=upload?a7SendRefusal(result):null;');
 assert.ok(at>0&&at<src.indexOf("await store.setJSON('receipts/'+key,receipt"));
 assert.match(src,/if\(refused\)\{await reopenRefusedDraft\(budgetPool\(\),owner\.id,input\.draftId\);await releaseClaim\(store,key\);return noStoreJson\(refused,422\);\}/);
});
test('the bridge receipt passes on A7\'s intake refusal reasons, short and plain, and nothing for an accepted job',async()=>{
 const definition=await readFile(new URL('../a7-owner-actions-workflow.ts',import.meta.url),'utf8');
 const code=JSON.parse(definition.split('\n').find(line=>line.includes('"name": "Safe action receipt"')).match(/"jsCode": ("(?:[^"\\]|\\.)*")/)[1]);
 const run=response=>new Function('$','$input',code)(()=>({first:()=>({json:{payload:JSON.stringify({clientRunId:'owner-1'})}})}),{first:()=>({json:response})})[0].json;
 const refused=run({statusCode:422,body:{ok:false,status:'not_started',job_id:'owner-1',problems:['Pieces do not match.',' ',7,'y'.repeat(400)],not_applied:['x']}});
 assert.equal(refused.accepted,false);assert.equal(refused.receiptKind,'rejected');assert.equal(refused.upstreamStatus,422);
 assert.deepEqual(refused.problems,['Pieces do not match.','y'.repeat(300)]);assert.equal(refused.not_applied,undefined);
 const ok=run({statusCode:200,body:{ok:true,status:'received',job_id:'owner-1',run_id:'claude-a7-abc'}});
 assert.equal(ok.accepted,true);assert.deepEqual(ok.problems,[]);
 const {a7SendRefusal}=await import('../lib/a7-actions.mjs');
 assert.match(a7SendRefusal(refused).message,/A7 said: Pieces do not match\. y{300}\./);
});
test('the bridge forwards owner intake with HTTP Request 4.1, which skips the empty file fields of a job with fewer than 12 files',async()=>{
 const definition=await readFile(new URL('../a7-owner-actions-workflow.ts',import.meta.url),'utf8');
 const line=definition.split('\n').find(l=>l.startsWith('const intake = node('));
 // 4.2 builds multipart bodies with a path that reads .value of a skipped (empty) file field and fails before sending.
 assert.match(line,/type:'n8n-nodes-base\.httpRequest',version:4\.1,config:\{"name": "Forward owner intake"/);
 assert.match(line,/\{"parameterType": "formData", "name": "payload", "value": "=\{\{ \$json\.payload \}\}"\}/);
 for(let i=0;i<12;i++)assert.ok(line.includes(`{"parameterType": "formBinaryData", "name": "files${i}", "inputDataFieldName": "={{ $json.uploadFields[${i}] || \\"\\" }}"}`),'files'+i);
 // On 4.1 the full response carries the body under data, as text; the receipt reads it.
 const code=JSON.parse(definition.split('\n').find(l=>l.includes('"name": "Safe action receipt"')).match(/"jsCode": ("(?:[^"\\]|\\.)*")/)[1]);
 const run=response=>new Function('$','$input',code)(()=>({first:()=>({json:{payload:JSON.stringify({clientRunId:'owner-1'})}})}),{first:()=>({json:response})})[0].json;
 const refused=run({statusCode:422,data:JSON.stringify({ok:false,status:'not_started',job_id:'owner-1',problems:['Choose at least one outcome.']})});
 assert.equal(refused.receiptKind,'rejected');assert.deepEqual(refused.problems,['Choose at least one outcome.']);
 assert.equal(run({statusCode:202,data:JSON.stringify({ok:true,status:'received',job_id:'owner-1',run_id:'claude-a7-abc'})}).accepted,true);
});
