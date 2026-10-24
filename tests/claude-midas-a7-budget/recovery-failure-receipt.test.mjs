import test from 'node:test';import assert from 'node:assert/strict';import {recoveryFailureReceipt} from '../../n8n/claude-midas-a7/budget-guards/recovery-failure-receipt.mjs';
test('pre-start recovery errors return a bounded receipt instead of reaching paid claim',async()=>{
 const source={nodes:[{id:'request',name:'Recovery · Request',parameters:{jsCode:"throw Error('recovery_source_or_scope_changed')"}},{id:'restore',name:'Recovery · Restore checkpoint',parameters:{jsCode:"throw Error('private secret should never escape')"}},{id:'readrun',name:'Recovery · Read run'},{id:'readevents',name:'Recovery · Read evidence'},{id:'branch',name:'Recovery · Reuse readers?',parameters:{conditions:{conditions:[{}]}}},{id:'response',name:'Send job received',parameters:{}}],connections:{}};
 const w=recoveryFailureReceipt(source),AF=Object.getPrototypeOf(async function(){}).constructor;
 const a=await new AF(w.nodes[0].parameters.jsCode)();assert.equal(a[0].json.recovery_error,'recovery_source_or_scope_changed');
 const b=await new AF(w.nodes[1].parameters.jsCode)();assert.equal(b[0].json.recovery_error,'recovery_input_unavailable');assert.equal(JSON.stringify(b).includes('private'),false);
 assert.deepEqual(w.connections['Recovery · Valid checkpoint?'].main[0].map(x=>x.node),['Recovery · Claim once']);assert.deepEqual(w.connections['Recovery · Valid checkpoint?'].main[1].map(x=>x.node),['Recovery · Return failure']);
 for(const old of source.nodes)assert.equal(w.nodes.find(n=>n.name===old.name).id,old.id);
});
