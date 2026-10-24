import test from 'node:test';
import assert from 'node:assert/strict';
import {actionReceipt,installActionReceipt} from '../../n8n/claude-midas-a7/owner-bridge/action-receipt.mjs';
const id='owner-00000000-0000-4000-8000-000000000000';
test('text response under data acknowledges the matching intake only',()=>{
 const r=actionReceipt({statusCode:202,data:JSON.stringify({ok:true,status:'received',job_id:id})},id);
 assert.equal(r.accepted,true);assert.equal(r.clientId,id);assert.equal(r.outcome,'received');
});
test('HTTP success with rejection, unknown JSON, non-JSON or wrong identity stays unconfirmed',()=>{
 for(const body of [{accepted:false,error:'recovery_checkpoint_invalid'},{},'not JSON',{ok:true,status:'received',job_id:'wrong'},{forwarded:true,id:'wrong'}]){
  const r=actionReceipt({statusCode:200,body},id);assert.equal(r.accepted,false);assert.equal(r.runId,null);
 }
});
test('forwarded decision receipt requires the matching decision identity',()=>{
 assert.equal(actionReceipt({statusCode:200,body:{forwarded:true,id}},id).forwarded,true);
 assert.equal(actionReceipt({statusCode:500,body:{forwarded:true,id}},id).accepted,false);
});
test('failure keeps an explicit receipt without exposing upstream data or error text',()=>{
 const r=actionReceipt({statusCode:500,data:'{"message":"Error in workflow","secret":"private"}'},id);
 assert.equal(r.http_status,200);assert.equal(r.accepted,false);assert.equal(r.error,'upstream_workflow_failed');assert.equal(r.upstreamStatus,500);
 assert.equal(JSON.stringify(r).includes('private'),false);
 const raw=actionReceipt({error:{message:'Authorization: private'}},id);assert.equal(raw.receiptKind,'transport_error');assert.equal(JSON.stringify(raw).includes('private'),false);
});
test('installation preserves graph, credentials and immutable node IDs',()=>{
 const w={nodes:[{id:'same',name:'Safe action receipt',parameters:{jsCode:'old'},credentials:{existing:'unchanged'}}],connections:{a:{main:[]}}};
 const out=installActionReceipt(w);assert.equal(out.nodes[0].id,'same');assert.deepEqual(out.nodes[0].credentials,w.nodes[0].credentials);assert.deepEqual(out.connections,w.connections);
 const run=new Function('$','$input',out.nodes[0].parameters.jsCode);
 const $=name=>({first:()=>({json:name==='Normalize owner upload'?{payload:JSON.stringify({clientRunId:id})}:{}})});
 assert.equal(run($,{first:()=>({json:{statusCode:202,data:JSON.stringify({ok:true,status:'received',job_id:id})}})})[0].json.accepted,true);
});
