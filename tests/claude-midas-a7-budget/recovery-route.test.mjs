import test from 'node:test';import assert from 'node:assert/strict';
import {recoveryRouteCode,repairRecoveryRoute} from '../../n8n/claude-midas-a7/budget-guards/recovery-route.mjs';
test('recovery routing handles JSON text, parsed objects and malformed input while retaining binary references',()=>{
 const run=new Function('$input',recoveryRouteCode),binary={files:{data:'synthetic'}};
 for(const [payload,expected] of [[JSON.stringify({recovery:{runId:'test'}}),true],[{recovery:{}},true],['bad JSON',false],[{},false],[null,false]]){
  const original={json:{body:{payload},other:'preserved'},binary};
  const out=run({first:()=>original})[0];assert.equal(out.json.__recoveryRequested,expected);assert.equal(out.binary,binary);assert.equal(out.json.other,'preserved');assert.equal('__recoveryRequested' in original.json,false);
 }
});
test('route repair preserves trigger, node IDs, credentials and the paid-claim graph',()=>{
 const edge=node=>({node,type:'main',index:0});
 const source={nodes:[{id:'hook',name:'A7 job webhook',parameters:{authentication:'headerAuth'},credentials:{existing:'unchanged'}},{id:'branch',name:'Recovery · Requested?',position:[0,0],parameters:{conditions:{conditions:[{leftValue:'old'}]}}},{id:'claim',name:'Recovery · Claim once'}],connections:{'A7 job webhook':{main:[[edge('Recovery · Requested?')]]},'Recovery · Requested?':{main:[[edge('Recovery · Request')],[edge('01 Intent & scope')]]},'Recovery · Valid checkpoint?':{main:[[edge('Recovery · Claim once')],[edge('Recovery · Return failure')]]}}};
 const out=repairRecoveryRoute(source,'parser');assert.deepEqual(out.nodes[0],source.nodes[0]);assert.equal(out.nodes[1].id,'branch');assert.deepEqual(out.connections['Recovery · Valid checkpoint?'],source.connections['Recovery · Valid checkpoint?']);assert.deepEqual(out.connections['Recovery · Requested?'],source.connections['Recovery · Requested?']);assert.equal(out.connections['A7 job webhook'].main[0][0].node,'Recovery · Parse route');assert.equal(out.nodes[1].parameters.conditions.conditions[0].leftValue,'={{ $json.__recoveryRequested === true }}');
});
