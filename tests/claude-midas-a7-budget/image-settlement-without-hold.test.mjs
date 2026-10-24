import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// Owner decision, 20 Oct 2026: the white master image call is not held on its budget settlement. The cost is sent
// after the call finishes, without the image (a 2K image is larger than the site accepts), and the run continues.
const workflow=JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/live/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url),'utf8'));
const code=name=>workflow.nodes.find(n=>n.name===name).parameters.jsCode;
const clientId='owner-'+randomUUID(),operationKey='claude-a7-x:white_master:try1',permit=randomUUID();
const ran={'Budget · 15g · Ticket':{budgetRequest:{clientId,operationKey},state:{run_id:'claude-a7-x',client_run_id:clientId}},
 'Budget · 15g · Reserve':{statusCode:200,body:{send:true,permit,reservedMicroUsd:69900}}};
const $=name=>{if(!(name in ran))throw Error(`Node '${name}' hasn't been executed`);return {first:()=>ran[name].json?ran[name]:{json:ran[name]}};};
const one=item=>({first:()=>item,all:()=>[item]});
const image='A'.repeat(7_000_000); // larger than the site's 5.5 MB settle limit once sent
const provider={json:{status:'completed',id:'interaction-1',usage:{total_input_tokens:2987,total_output_tokens:1680,total_thought_tokens:420},steps:[{type:'model_output',content:[{type:'image',mime_type:'image/png',data:image}]}],s04:{receipt:{provider_request_id:'interaction-1'}}},binary:{image:{mimeType:'image/png',fileName:'white_master.png'}}};

test('the image settlement carries the cost only, never the image',()=>{
 const [out]=new Function('$','$input',code('Budget · 15g · Receipt'))($,one(provider));
 const body=out.json.budgetRequest;
 assert.equal(body.completeAnswer,undefined);assert.equal(body.checkpointRequired,false);
 assert.deepEqual(body.usage,{input:2987,output:2100});assert.equal(body.receiptRef,'interaction-1');assert.equal(body.permit,permit);
 assert.ok(JSON.stringify(body).length<2000,'the settlement stays small');
 assert.equal(out.binary,provider.binary,'the image stays in the run');
 ran['Budget · 15g · Receipt']=out;
});

test('the run continues with the image whether or not the site recorded the settlement',()=>{
 for(const [response,recorded] of [[{statusCode:400,body:{error:'invalid_request'}},false],[{statusCode:200,body:{recorded:true,status:'completed',responsePreserved:false}},true]]){
  const [out]=new Function('$','$input',code('Budget · 15g · Restore'))($,one({json:response}));
  assert.equal(out.json.__budgetAllowed,true);assert.equal(out.json.status,'completed');
  assert.equal(out.json.__budgetSettlement.recorded,recorded);assert.equal(out.json.__budgetSettlement.httpStatus,response.statusCode);
  assert.equal(out.binary,provider.binary);
 }
});
