import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';
import {installReaderRecovery} from '../../n8n/claude-midas-a7/budget-guards/install-reader-recovery.mjs';
import {installCompleteAnswers} from '../../n8n/claude-midas-a7/budget-guards/complete-answers.mjs';
import {CALL_POLICY} from '../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-budget.mjs';
const base=installReaderRecovery(guardWorkflow(JSON.parse(readFileSync(new URL('../../n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url))))),w=installCompleteAnswers(base),node=n=>w.nodes.find(x=>x.name===n),AF=Object.getPrototypeOf(async function(){}).constructor,require=createRequire(import.meta.url);
test('checkpoint repair preserves node identities, credentials, policies, waits and adds no paid entry',()=>{
 assert.equal(w.nodes.length,base.nodes.length);for(const n of base.nodes){const after=node(n.name);assert.equal(after.id,n.id);assert.deepEqual(after.credentials,n.credentials);if(Object.keys(CALL_POLICY).includes(n.name)||n.type.endsWith('.wait')||n.type.endsWith('.webhook'))assert.deepEqual(after,n);}
 assert.equal(w.connections['15g Send to Google'].main[0][0].node,'Budget · 15g · Receipt');assert.equal(w.connections['Budget · 15g · Settled'].main[0][0].node,'15h Read submission');assert.deepEqual(w.connections['15o Final receipt'].main[0],base.connections['Budget · 15g · Settled'].main[0]);
 for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new AF('$input','$','require',n.parameters.jsCode),n.name);
 assert.throws(()=>installCompleteAnswers(w),/already_installed/);
});
for(const name of Object.keys(CALL_POLICY).filter(n=>!n.startsWith('03b ')))test(name+': requires preservation acknowledgement and retains memory payloads',async()=>{
 const prefix='Budget · '+name.split(' ')[0]+' · ',receipt=node(prefix+'Receipt'),restore=node(prefix+'Restore');
 const raw={id:'synthetic',status:'completed',headers:{authorization:'DO_NOT_KEEP'},input:'DO_NOT_KEEP',output:[{type:'message',content:[{type:'output_text',text:'synthetic answer'}]}],usage:{input_tokens:10,output_tokens:20},usageMetadata:{promptTokenCount:10,candidatesTokenCount:20},s04:{receipt:{usage:{total_input_tokens:10,total_output_tokens:20,total_thought_tokens:0}}}},binary={synthetic:{id:'local'}};
 const ticket={json:{budgetRequest:{clientId:'owner-synthetic',operationKey:'synthetic'},state:{run_id:'synthetic',stage04:{test:true}}}},reserve={json:{statusCode:200,body:{send:true,permit:'11111111-1111-4111-8111-111111111111',reservedMicroUsd:1000}}};let rec;
 const $=n=>({first:()=>n===prefix+'Ticket'?ticket:n===prefix+'Reserve'?reserve:n===prefix+'Receipt'?rec:(()=>{throw Error(n)})()});
 [rec]=await new AF('$input','$','require',receipt.parameters.jsCode)({first:()=>({json:raw,binary})},$,require);
 assert.equal(rec.json.budgetRequest.checkpointRequired,true);assert.equal(rec.json.budgetRequest.completeAnswer.headers,undefined);assert.equal(rec.json.budgetRequest.completeAnswer.input,undefined);
 const run=async ack=>(await new AF('$input','$','require',restore.parameters.jsCode)({first:()=>({json:{statusCode:200,body:{recorded:true,status:'completed',responsePreserved:ack}}})},$,require))[0];
 assert.equal((await run(false)).json.__budgetAllowed,false);const allowed=await run(true);assert.equal(allowed.json.__budgetAllowed,true);assert.equal(allowed.json.id,raw.id);assert.deepEqual(allowed.binary,binary);
});
