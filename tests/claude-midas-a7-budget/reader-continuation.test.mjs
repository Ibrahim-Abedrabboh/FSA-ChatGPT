import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';
import {installReaderRecovery} from '../../n8n/claude-midas-a7/budget-guards/install-reader-recovery.mjs';
import {requirePreservedReader} from '../../n8n/claude-midas-a7/budget-guards/reader-continuation.mjs';
const AF=Object.getPrototypeOf(async function(){}).constructor;
async function workflow(){return installReaderRecovery(guardWorkflow(JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url)))));}
test('only a durably saved, settled answer can continue recovery',()=>{
 const state={reader_recovery:true,cached_second:{total:2}},response={status:'completed',output:[],__budgetAllowed:true,__readerResponsePreserved:true};
 assert.equal(requirePreservedReader(state,response),response);
 for(const s of [{...state,room_key:'unexpected'},{...state,cached_second:{total:0}},{...state,reader_recovery:false}])assert.throws(()=>requirePreservedReader(s,response),/no_resend/);
 for(const r of [{...response,__readerResponsePreserved:false},{...response,__budgetAllowed:false},{...response,status:'incomplete'}])assert.throws(()=>requirePreservedReader(state,r),/no_resend/);
});
test('recovery bypasses merge exactly once; ordinary fallback retains the normal merge and failure hold',async()=>{
 const w=await workflow(),edge=n=>w.connections[n].main.map(es=>es.map(e=>e.node));
 assert.deepEqual(edge('Recovery · Reuse readers?')[0],['Recovery · Saved answer available?']);
 assert.deepEqual(edge('Budget · 03b · Settled'),[['Recovery · Continue preserved reader?'],['Budget · 03b · Hold']]);
 assert.deepEqual(edge('Recovery · Continue preserved reader?'),[['Recovery · Preserved reader ready'],['Readers done']]);
 assert.deepEqual(edge('Recovery · Preserved reader ready'),[['04-06 Evidence']]);
 const ready=w.nodes.find(n=>n.name==='Recovery · Preserved reader ready');
 assert.equal(ready.retryOnFail,false);const group=w.nodeGroups.find(g=>g.nodeNames?.includes('04-06 Evidence')||g.nodeIds?.includes(w.nodes.find(n=>n.name==='04-06 Evidence').id));assert.ok(group);assert.ok(!group.nodeNames?.includes('Readers done'));assert.ok(!group.nodeIds?.includes(w.nodes.find(n=>n.name==='Readers done').id));assert.deepEqual(edge('Recovery · Cached count'),[[]]);
});
test('actual restore code fails closed when usage was settled without a saved answer',async()=>{
 const w=await workflow(),code=w.nodes.find(n=>n.name==='Budget · 03b · Restore').parameters.jsCode;
 const original={id:'resp_synthetic',status:'completed',output:[]};
 const receipt={json:{original}},ticket={json:{state:{run_id:'synthetic'}}};
 const lookup=name=>({first:()=>name.endsWith('Receipt')?receipt:ticket});
 const run=response=>new AF('$input','$','require',code)({first:()=>({json:response})},lookup,createRequire(import.meta.url));
 const [held]=await run({statusCode:200,body:{recorded:true,status:'completed'}});assert.equal(held.json.__budgetAllowed,false);
 const [ready]=await run({statusCode:200,body:{recorded:true,status:'completed',responsePreserved:true}});assert.equal(ready.json.__readerResponsePreserved,true);assert.equal(ready.json.id,original.id);
});
