import test from 'node:test';import assert from 'node:assert/strict';
import {operationSlot,providerUsage,permissionGranted,settlementCompleted,budgetHold} from '../../n8n/claude-midas-a7/budget-guards/runtime.mjs';
const state={client_run_id:'owner-e10efbc4-4f57-4dca-a6e6-d763c4645179',run_id:'run',go2_round:1,trail:[],stage04:{operation:{output_id:'white_master',attempt:1}}};
test('logical slots stay stable across retries and distinguish output, repair and review rounds',()=>{
 const a=operationSlot(state,'16 Critic review',{rv:{output_id:'white_master',attempt:1},prompt:'a'});
 assert.deepEqual(operationSlot(state,'16 Critic review',{rv:{output_id:'white_master',attempt:1},prompt:'changed'}),a);
 for(const s of [{...state,go2_round:2},{...state,stage04:{operation:{output_id:'hero',attempt:1}}},{...state,stage04:{operation:{output_id:'white_master',attempt:2}}}])assert.notDeepEqual(operationSlot(s,'16 Critic review'),a);
 assert.throws(()=>operationSlot({...state,client_run_id:'legacy'},'03 Eye'),/budget_identity_missing/);
});
test('missing, malformed and zero-only receipts never turn into free successful calls',()=>{
 for(const response of [{},{usage:{}},{usage:{input_tokens:10}},{usage:{input_tokens:10,output_tokens:-1}},{usage:{input_tokens:'10',output_tokens:2}},{usage:{input_tokens:0,output_tokens:0}},{error:'timeout',usage:{input_tokens:10,output_tokens:2}}])assert.equal(providerUsage(response,'openai'),null);
 assert.deepEqual(providerUsage({usage:{input_tokens:100,output_tokens:20}},'openai'),{input:100,output:20});
 assert.deepEqual(providerUsage({usage:{prompt_tokens:100,completion_tokens:20}},'openai'),{input:100,output:20});
 assert.equal(providerUsage({usage:{prompt_tokens:100}},'openai'),null);
});
test('Google thought tokens are accounted for, with no extra search tool allowance',()=>{
 assert.deepEqual(providerUsage({usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}},'gemini'),{input:100,output:50});
 assert.deepEqual(providerUsage({s04:{receipt:{usage:{total_input_tokens:100,total_output_tokens:20,total_thought_tokens:30,total_tool_use_tokens:0}}}},'interaction'),{input:100,output:50});
 assert.equal(providerUsage({usage:{total_input_tokens:100,total_output_tokens:20}},'interaction'),null);
 assert.equal(providerUsage({usage:{total_input_tokens:100,total_output_tokens:20,total_thought_tokens:0,total_tool_use_tokens:1}},'interaction'),null);
});
test('cached reads are conservative standard input; unexpected cache writes require reconciliation',()=>{
 assert.deepEqual(providerUsage({usage:{input_tokens:100,output_tokens:20,cache_read_input_tokens:200}},'anthropic'),{input:300,output:20});
 assert.equal(providerUsage({usage:{input_tokens:100,output_tokens:20,cache_creation_input_tokens:200}},'anthropic'),null);
});
test('only a complete successful reservation permits a provider call',()=>{
 const valid={statusCode:200,body:{send:true,permit:'e10efbc4-4f57-4dca-a6e6-d763c4645179',reservedMicroUsd:100}};
 assert.equal(permissionGranted(valid),true);
 for(const response of [{...valid,statusCode:503},{...valid,body:{...valid.body,send:false}},{...valid,body:{...valid.body,permit:''}},{...valid,body:{...valid.body,reservedMicroUsd:0}},valid.body])assert.equal(permissionGranted(response),false);
 assert.equal(settlementCompleted({statusCode:200,body:{recorded:true,status:'completed'}}),true);
 assert.equal(settlementCompleted({statusCode:200,body:{recorded:true,status:'uncertain'}}),false);
});
test('budget holds keep project identity and explicitly prohibit automatic resend',()=>{
 const hold=budgetHold(state,'05 Review','16 Critic review','Receipt uncertain');assert.equal(hold.run_id,state.run_id);assert.equal(hold.status,'hold');assert.equal(hold.budget_hold.automatic_resend,false);assert.equal(state.trail.length,0);assert.deepEqual(hold.vault_only,['hold','status']);
});
