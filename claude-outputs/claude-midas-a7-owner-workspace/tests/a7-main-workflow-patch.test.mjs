import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {patchMainWorkflow} from '../lib/a7-main-workflow-patch.mjs';

test('main workflow gates confirmed source before readers and preserves legacy fan-out',async()=>{
 const fixture=JSON.parse(await readFile(new URL('../a7-main-patch-fixture.json',import.meta.url)));
 const snapshot=JSON.parse(await readFile(new URL('../a7-analysis-node-snapshot.json',import.meta.url)));
 fixture.nodes.push(snapshot.nodes.find(n=>n.name==='Budget · 03 · Reserve'));
 const patched=patchMainWorkflow(fixture),route=patched.connections['Receipt · Restore accepted input'].main;
 assert.deepEqual(route[0].map(x=>x.node),['Source continuation requested?']);
 assert.deepEqual(patched.connections['Source continuation requested?'].main[1].map(x=>x.node),['Budget · 03 · Ticket','Budget · 05 · Ticket','Room photo sent?']);
 assert.deepEqual(patched.connections['Source proof accepted?'].main[0].map(x=>x.node),['Confirmed source evidence']);
 assert.deepEqual(patched.connections['Source proof accepted?'].main[1].map(x=>x.node),['Hold unverified source continuation']);
 assert.deepEqual(patched.connections['Confirmed source evidence'].main[0].map(x=>x.node),['Critical unknown?']);
 assert.match(patched.nodes.find(n=>n.name==='01 Intent & scope').parameters.jsCode,/invalid_preallocated_run/);
 assert.match(patched.nodes.find(n=>n.name==='08 Locks and freedoms').parameters.jsCode,/s\.source_confirmation_bound \? false/);
 assert.throws(()=>patchMainWorkflow(patched),/already_applied/);
 const state={run_id:'claude-a7-synthetic',client_run_id:'owner-synthetic',brief:{inventory:[{item:'sofa',count:1}],outputs:[{kind:'white'}]},references:[{role:'product'}],trail:[]};
 const proof={verified:true,runId:state.run_id,clientRunId:state.client_run_id,receiptFingerprint:'a',confirmationFingerprint:'b',referenceFingerprint:'c',facts:{physicalCount:1,category:'Sofa',uncertainties:[]},answers:{'03 Eye reads the product photo':{category:'Sofa',pieces:[{label:'sofa',kind:'sofa',role:'product'}]},'05 Second count':{total:1},'09 Conflict check':{conflicts:[]}}};
 const get=name=>patched.nodes.find(n=>n.name===name).parameters.jsCode,$=()=>({first:()=>({json:state})});
 const check=new Function('$input','$',get('Check source continuation'))({first:()=>({json:{statusCode:200,body:proof}})},$)[0].json;
 const evidence=new Function('$input','$',get('Confirmed source evidence'))({first:()=>({json:check})},$)[0].json;
 assert.equal(evidence.observation.count_eye,1);
 assert.equal(evidence.inventory[0].count,1);
 assert.equal(evidence.source_confirmation_bound,true);
 assert.equal(new Function('$input','$',get('Check source continuation'))({first:()=>({json:{statusCode:502,body:{verified:false}}})},$)[0].json.verified,false);
});
