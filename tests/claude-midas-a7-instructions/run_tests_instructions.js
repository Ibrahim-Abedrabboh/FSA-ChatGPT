const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'n8n/claude-midas-a7/code-nodes/09b_Contract.js'),'utf8');
const holdSource=fs.readFileSync(path.join(root,'n8n/claude-midas-a7/code-nodes/Hold_and_ask_the_client.js'),'utf8');
const fixture=require('./fixtures/execution-529-classifier.json');
const answer=fixture.output[0].content[0].text;
function run(raw,over={}) {
 const state={run_id:'instruction-regression',client_run_id:'test',brief:{version:1,instructions:'Preserve both units and cushions. White background only. No furniture or people.'},profile:{id:'sofa'},gates:{},outputs:[{id:'white_master',locks:['source identity']}],inventory:[{item:'chaise',count:1},{item:'sofa',count:1}],exclusions:[],facts:[],unknowns:[],observation:{room:null},references:[],critical:[],trail:[],conflicts:[],has_open_conflicts:true,text_prices:{models:{'gpt-6-luna':{input:1,output:1}}},...over};
 const $=name=>({first:()=>({json:name==='08 Locks and freedoms'?state:raw}),all:()=>[]});
 return new Function('require','$',source)(require,$)[0].json;
}
test('real n8n execution 529: parsed JSON text object becomes preservation locks',()=>{
 const r=run(fixture);assert.equal(r.critical.length,0);assert.deepEqual(r.outputs[0].locks,['source identity',...answer.instruction_locks]);assert.equal(r.text_calls_new[0].tokens.input,583);
});
const response=value=>({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:value}]}]});
test('JSON string output remains supported',()=>assert.equal(run(response(JSON.stringify(answer))).critical.length,0));
test('fenced legacy answer remains supported',()=>assert.equal(run({content:[{type:'text',text:'```json\n'+JSON.stringify(answer)+'\n```'}]}).critical.length,0));
test('split output text is assembled without searching metadata',()=>{
 const text=JSON.stringify(answer),raw=response(text.slice(0,25));raw.output[0].content.push({type:'output_text',text:text.slice(25)});assert.equal(run(raw).critical.length,0);
});
test('reasoning and echoed request JSON never become instruction locks',()=>{
 const raw=response(JSON.stringify(answer));raw.instructions=JSON.stringify({instruction_locks:['wrong']});raw.output.unshift({type:'reasoning',text:JSON.stringify({instruction_locks:['wrong']}),summary:[{text:'{}'}]});assert.deepEqual(run(raw).outputs[0].locks,['source identity',...answer.instruction_locks]);
});
for(const [label,raw,reason] of [
 ['truncated',response('{"instruction_locks":['),'unreadable_response'],
 ['incomplete with otherwise valid JSON',{...response(answer),status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'incomplete_response'],
 ['wrong schema',response({instruction_locks:'not an array',conflicts:[],summary:''}),'invalid_schema'],
 ['object lock',response({...answer,instruction_locks:[{text:'do not join'}]}),'invalid_schema'],
 ['invalid severity',response({...answer,conflicts:[{topic:'count',evidence_shows:'2',severity:'safe',resolution:'client_wins',reason:'x'}]}),'invalid_schema'],
 ['provider error',{error:{message:'test failure'},...response(answer)},'provider_error'],
 ['refusal',{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}]},'provider_refusal'],
 ['metadata only',{status:'completed',instructions:JSON.stringify(answer),output:[{type:'reasoning',summary:[{text:JSON.stringify(answer)}]}]},'unreadable_response']
])test(label+' holds for owner and preserves original wishes',()=>{
 const r=run(raw);assert.equal(r.instruction_processing.status,reason);assert.equal(r.critical[0].who,'owner');assert.equal(r.client_question,'');assert.deepEqual(r.outputs[0].locks,['source identity']);assert.match(r.brief.instructions,/Preserve both/);
 const held=new Function('$input',holdSource)({first:()=>({json:r})})[0].json;assert.equal(held.status,'hold');assert.equal(held.hold_for,'owner');assert.equal(held.client_question,'');
});
test('real critical product conflict remains unresolved',()=>{
 const conflict={topic:'piece_count',client_says:'3',evidence_shows:'2',severity:'to_classify'};
 const raw=response({...answer,conflicts:[{topic:'piece_count',evidence_shows:'2',severity:'critical',resolution:'needs_owner',reason:'Counts disagree.'}]});
 const r=run(raw,{conflicts:[conflict]});assert.equal(r.critical[0].what,'piece_count');assert.equal(r.conflict_ledger[0].settled,'no');
});
test('no instruction/conflict skips classifier and preserves existing locks',()=>{
 const r=run(null,{brief:{version:1,instructions:''},has_open_conflicts:false});assert.equal(r.critical.length,0);assert.equal(r.instruction_processing.status,'not_needed');assert.deepEqual(r.outputs[0].locks,['source identity']);assert.equal(r.text_calls_new.length,0);
});
test('valid object and text give same canonical contract stamp',()=>assert.equal(run(response(answer)).contract_stamp,run(response(JSON.stringify(answer))).contract_stamp));
