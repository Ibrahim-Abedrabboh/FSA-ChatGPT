import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';import {installReaderRecovery} from '../../n8n/claude-midas-a7/budget-guards/install-reader-recovery.mjs';import {replacementCheckpoint} from '../../n8n/claude-midas-a7/budget-guards/reader-replacement.mjs';import {REPLACEMENT as P,replacementKey} from '../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-reader-replacement.mjs';
const brief=JSON.parse(await readFile(new URL('../../claude-outputs/claude-midas-a7-owner-workspace/tests/fixtures/approved-reader-replacement-brief.json',import.meta.url))),state={recovery_request:{replacementId:P.id},run_id:P.runId,client_run_id:P.clientId,references:[{role:'product',sha256:P.sourceSha256}],cached_second:{total:2},room_key:'',brief,trail:[]};
test('replacement checkpoint binds approved source, exact brief and reused count without approval inheritance',()=>{
 const result=replacementCheckpoint(state,P.briefSha256,P);assert.equal(result.reader_replacement.id,P.id);assert.equal(result.recovery_request.checkpoint.brief,brief);assert.equal(result.go1_token,undefined);assert.equal(state.reader_replacement,undefined);
 for(const changed of [{...state,room_key:'room'},{...state,cached_second:{total:3}},{...state,references:[{sha256:'a'.repeat(64)}]},{...state,run_id:'different'}])assert.throws(()=>replacementCheckpoint(changed,P.briefSha256,P));assert.throws(()=>replacementCheckpoint(state,'a'.repeat(64),P));
});
test('actual generated ticket caps input before reservation and gives exactly one new operation identity',async()=>{
 const w=installReaderRecovery(guardWorkflow(JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url))))),code=w.nodes.find(n=>n.name==='Budget · 03b · Ticket').parameters.jsCode;
 const AF=Object.getPrototypeOf(async function(){}).constructor,fn=new AF('$input','$','require',code),request={json:{body:{model:'gpt-6.1-sol',input:[],max_output_tokens:16000,store:false},state:{...state,reader_replacement:{id:P.id}}}};
 const run=count=>fn({first:()=>({json:{statusCode:200,body:{object:'response.input_tokens',input_tokens:count}}})},()=>({first:()=>request}),createRequire(import.meta.url));
 const [ticket]=await run(676);assert.equal(ticket.json.budgetRequest.operationKey,replacementKey);assert.equal(ticket.json.budgetRequest.inputTokens,1126);assert.equal(ticket.json.budgetRequest.replacementId,P.id);
 await assert.rejects(run(2051),/replacement_reader_limit/);assert.equal((await run(2050))[0].json.budgetRequest.inputTokens,2500);
 const find=n=>w.nodes.find(x=>x.name===n);for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new AF('$input','$','require',n.parameters.jsCode),n.name);
 assert.equal(find('03b Eye fallback (OpenAI)').retryOnFail,false);assert.deepEqual(w.connections['Recovery · Reuse readers?'].main[0].map(e=>e.node),['Recovery · Saved answer available?']);
 assert.ok(w.nodes.find(n=>n.type==='n8n-nodes-base.wait'&&/go 1/i.test(n.name)));assert.ok(w.nodes.find(n=>n.type==='n8n-nodes-base.wait'&&/go 2/i.test(n.name)));
});
test('first-contract guard uses Locks state when the prior-contract lookup returns an empty item',async()=>{
 const w=installReaderRecovery(guardWorkflow(JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url))))),code=w.nodes.find(n=>n.name==='Budget · 09 · Ticket').parameters.jsCode;
 const AF=Object.getPrototypeOf(async function(){}).constructor,scope={client_run_id:P.clientId,run_id:P.runId,outputs:[{id:'white_master'}]},args=[{first:()=>({json:{}})},()=>({first:()=>({json:scope})}),createRequire(import.meta.url)];
 await assert.rejects(new AF('$input','$','require',code.replace("const state=$('08 Locks and freedoms').first().json;",'const state=it.json;'))(...args),/budget_identity_missing/);
 const [ticket]=await new AF('$input','$','require',code)(...args);assert.equal(ticket.json.budgetRequest.clientId,P.clientId);assert.equal(ticket.json.budgetRequest.node,'09 Conflict check');assert.equal(ticket.json.budgetRequest.outputId,'job');
});
