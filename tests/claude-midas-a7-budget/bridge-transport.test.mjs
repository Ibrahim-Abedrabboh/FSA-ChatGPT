import test from 'node:test';import assert from 'node:assert/strict';import {bridgeTransportCheck} from '../../n8n/claude-midas-a7/owner-bridge/transport-check.mjs';
test('authenticated bridge transport probe branches to receipt without reaching A7',async()=>{
 const before={nodes:[{id:'original',name:'Normalize owner upload',parameters:{jsCode:"throw Error('normal intake branch')"},credentials:{example:'unchanged'}}],connections:{}};const w=bridgeTransportCheck(before);assert.equal(w.nodes[0].id,'original');assert.deepEqual(w.nodes[0].credentials,before.nodes[0].credentials);
 const AF=Object.getPrototypeOf(async function(){}).constructor,run=new AF('$input',w.nodes[0].parameters.jsCode);const item={json:{body:{payload:JSON.stringify({transportProbe:true,clientRunId:'owner-12345678-1234-4234-8234-123456789abc'})}},binary:{files:{}}};
 assert.equal((await run.call({helpers:{getBinaryDataBuffer:async()=>Buffer.from('fixture')}},{first:()=>item}))[0].json.transportProbe,true);assert.deepEqual(w.connections['Transport check?'].main[0].map(x=>x.node),['Return owner response']);assert.deepEqual(w.connections['Transport check?'].main[1].map(x=>x.node),['Forward owner intake']);
 item.json.body.payload='{}';await assert.rejects(run({first:()=>item}),/normal intake branch/);
});
