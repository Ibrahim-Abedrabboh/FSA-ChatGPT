import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';
import {CALL_POLICY} from '../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-budget.mjs';
const source=JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url),'utf8'));
const guarded=guardWorkflow(source),node=name=>guarded.nodes.find(n=>n.name===name);
const incoming=target=>Object.entries(guarded.connections).flatMap(([from,types])=>Object.values(types).flatMap(outputs=>outputs.flatMap((group,branch)=>group.filter(e=>e.node===target).map(e=>({from,branch})))));
test('all 12 provider calls have one guarded entry and no automatic retries',()=>{
 assert.equal(Object.keys(CALL_POLICY).length,12);
 for(const name of Object.keys(CALL_POLICY)) {
  const prefix='Budget · '+name.split(' ')[0]+' · ';
  assert.deepEqual(incoming(name),[{from:prefix+'Allowed',branch:0}]);
  assert.equal(node(name).retryOnFail,false);assert.equal(node(name).maxTries,undefined);
  assert.equal(node(prefix+'Reserve').retryOnFail,false);assert.equal(node(prefix+'Settle').retryOnFail,false);
 }
});
test('every provider continuation is gated on successful receipt settlement',()=>{
 for(const name of Object.keys(CALL_POLICY)) {
  const prefix='Budget · '+name.split(' ')[0]+' · ',original=name==='15g Send to Google'?'15o Final receipt':name;
  assert.equal(guarded.connections[original].main[0][0].node,prefix+(name==='15g Send to Google'?'Check actual call':'Receipt'));
  assert.deepEqual(guarded.connections[prefix+'Settled'].main[0],source.connections[original].main[0]);
  assert.equal(guarded.connections[prefix+'Settled'].main[1][0].node,prefix+'Hold');
  assert.equal(guarded.connections[prefix+'Hold'].main[0][0].node,name==='09 Conflict check'?'Contract clear?':'V1 Vault events');
 }
});
test('webhooks, IDs, credentials, settings and original grouping remain intact in the generated draft',()=>{
 assert.deepEqual(guarded.settings,source.settings);
 assert.equal(guarded.nodeGroups.length,source.nodeGroups.length);
 for(const original of source.nodeGroups){const group=guarded.nodeGroups.find(g=>g.id===original.id);assert.ok(group);for(const name of original.nodeNames)assert.ok(group.nodeNames.includes(name));if(!original.nodeNames.includes('09 Conflict check'))assert.deepEqual(group,original);}
 for(const original of source.nodes) {
  assert.equal(node(original.name).id,original.id);
  assert.deepEqual(node(original.name).credentials,original.credentials);
  if(original.type.includes('webhook')||original.type.includes('wait'))assert.deepEqual(node(original.name),original);
 }
 assert.equal(source.nodes.length,183);assert.equal(guarded.nodes.length,294);
});
test('budget HTTP calls use the existing credential and a fixed destination without redirects',()=>{
 const http=guarded.nodes.filter(n=>n.name.startsWith('Budget · ')&&n.type==='n8n-nodes-base.httpRequest');assert.equal(http.length,24);
 for(const n of http){assert.match(n.parameters.url,/^https:\/\/midas-a7-owner-preview\.netlify\.app\/api\/a7\/budget\/(reserve|settle)$/);assert.equal(n.credentials.httpHeaderAuth.id,'S6DlmKQiz2USSkNE');assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.parameters.options.response.response.fullResponse,true);}
});
test('all generated Code node programs compile, without network access in Code nodes',()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const n of guarded.nodes.filter(n=>n.name.startsWith('Budget · ')&&n.type==='n8n-nodes-base.code')) {
  assert.doesNotThrow(()=>new AsyncFunction('$input','$','require',n.parameters.jsCode),n.name);
  assert.ok(!/fetch\(|axios\(|https\.request/.test(n.parameters.jsCode));
 }
});
test('builder rejects double installation and omitted model policies',()=>{
 assert.throws(()=>guardWorkflow(guarded),/guards_already_present/);
 const extra=structuredClone(source);extra.nodes.push({id:'new',name:'Unbudgeted model',type:'@n8n/n8n-nodes-langchain.openAi',typeVersion:2.3,parameters:{},position:[0,0]});assert.throws(()=>guardWorkflow(extra),/uncovered_paid_nodes/);
});
test('changed model, output cap or unbudgeted paid tools cannot silently bypass the frozen policy',()=>{
 for(const change of [n=>{n.parameters.modelId.value='different';},n=>{n.parameters.options.maxOutputTokens=32000;},n=>{n.parameters.builtInTools={googleSearch:true};}]) {
  const changed=structuredClone(source);change(changed.nodes.find(n=>n.name==='03 Eye reads the product photo'));assert.throws(()=>guardWorkflow(changed),/provider_policy_changed|paid_tools_not_budgeted/);
 }
 assert.match(node('15f Build request').parameters.jsCode,/max_output_tokens: 32768/);
 assert.match(node('Budget · 15g · Ticket').parameters.jsCode,/image_call_policy_mismatch/);
});
