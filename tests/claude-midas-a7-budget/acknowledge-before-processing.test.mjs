import test from 'node:test';import assert from 'node:assert/strict';
import {acknowledgeBeforeProcessing} from '../../n8n/claude-midas-a7/budget-guards/acknowledge-before-processing.mjs';
test('processing cannot begin from accepted intake without passing through the acknowledgement',()=>{
 const edge=node=>({node,type:'main',index:0});
 const source={nodes:[{id:'reply',name:'Send job received',parameters:{respondWith:'json'}},{id:'log',name:'Log received',position:[0,0]}],nodeGroups:[{id:'group',name:'Receipt',nodeNames:['Send job received','Log received']}],connections:{'Job accepted':{main:[[edge('Send job received'),edge('Recovery · Reuse readers?')]]},'Send job received':{main:[[edge('Log received')]]},'Recovery · Reuse readers?':{main:[[edge('Budget · 03b · Ticket')],[edge('Budget · 03 · Ticket'),edge('Budget · 05 · Ticket')]]}}};
 const w=acknowledgeBeforeProcessing(source);
 assert.deepEqual(w.nodes.slice(0,2),source.nodes);assert.deepEqual(w.connections['Job accepted'].main[0].map(e=>e.node),['Send job received']);
 assert.deepEqual(w.connections['Send job received'].main[0].map(e=>e.node),['Recovery · Reuse readers?']);
 assert.deepEqual(w.connections['Recovery · Reuse readers?'].main[0],source.connections['Recovery · Reuse readers?'].main[0]);
 assert.deepEqual(w.connections['Recovery · Reuse readers?'].main[1].map(e=>e.node),['Log received']);
 assert.deepEqual(w.connections['Receipt · Restore accepted input'].main[0],source.connections['Recovery · Reuse readers?'].main[1]);
 assert.deepEqual(w.nodeGroups[0].nodeNames,['Log received','Receipt · Restore accepted input']);
 const input={json:{reader_recovery:false,brief:{outcomes:['white_bk']}},binary:{files:{data:'synthetic'}}};
 const run=new Function('$',w.nodes.at(-1).parameters.jsCode);assert.equal(run(()=>({first:()=>input}))[0].binary,input.binary);assert.equal(run(()=>({first:()=>input}))[0].json,input.json);
 assert.throws(()=>acknowledgeBeforeProcessing(w),/acknowledgement_graph_changed/);
});
