import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {sourceUnderstandingService} from '../lib/a7-understanding-service.mjs';
import {patchMainWorkflow} from '../lib/a7-main-workflow-patch.mjs';
const require=createRequire(import.meta.url),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const analysis=await readFile(new URL('../a7-analysis-only-workflow.ts',import.meta.url),'utf8');
const nodes=Object.fromEntries(analysis.split('\n').filter(l=>/^const \w+=(node|ifElse)\(/.test(l)).map(l=>{const o=JSON.parse(l.slice(l.indexOf('(')+1,-2));return [o.config.name,o.config.parameters];}));
const bridge=await readFile(new URL('../a7-owner-analysis-workflow.ts',import.meta.url),'utf8');
const collected=[];const stub={to(){return this},add(){return this}};
vm.runInNewContext(bridge.replace(/^import .*;$/m,'').replace('export default','const result='),{node:o=>{collected.push(o);return stub},trigger:()=>stub,workflow:()=>stub,expr:x=>x});
const normalize=collected.find(n=>n.config.name==='Validate analysis-only intake').config.parameters.jsCode;

test('bridge preserves all multipart images and exact original bytes',async()=>{
 const draftId=randomUUID(),files=[Buffer.from('synthetic product'),Buffer.from('synthetic room'),Buffer.from('synthetic side')];
 const p={purpose:'source_analysis_only',draftId,clientRunId:'owner-'+draftId,runId:'claude-a7-'+draftId,requestId:randomUUID(),sourceSha256:createHash('sha256').update(files[0]).digest('hex'),roomSha256:createHash('sha256').update(files[1]).digest('hex'),referenceFingerprint:'a'.repeat(64),quoteFingerprint:'b'.repeat(64),intentFingerprint:'c'.repeat(64),maxCostUsd:4.1,budgetLimitUsd:5};
 const binary=Object.fromEntries(['product','room','other_view'].map((r,i)=>['files'+i,{fileName:r+'-'+randomUUID(),mimeType:'image/png'}]));
 const fn=new AsyncFunction('$input','require','Buffer',normalize);
 const out=await fn.call({helpers:{getBinaryDataBuffer:async(_i,k)=>files[Number(k.slice(-1))],prepareBinaryData:async bytes=>({data:bytes.toString('base64')})}},{first:()=>({json:{body:{payload:JSON.stringify(p)}},binary})},require,Buffer);
 assert.equal(out[0].binary,binary);
 assert.deepEqual(out[0].json.uploadFields,Object.keys(binary));
 const forward=collected.find(n=>n.config.name==='Forward analysis only');
 assert.equal(forward.version,4.1);
 assert.equal(forward.config.parameters.contentType,'multipart-form-data');
 const parameters=forward.config.parameters.bodyParameters.parameters;
 assert.equal(parameters.length,13);
 const evaluate=value=>vm.runInNewContext(value.slice(2,-2),{$json:out[0].json});
 const form=new FormData();
 for(const param of parameters){if(param.parameterType==='formBinaryData'){const key=evaluate(param.inputDataFieldName);if(!key)continue;const index=Number(key.slice(-1));form.append(param.name,new Blob([files[index]],{type:binary[key].mimeType}),binary[key].fileName);}else form.append(param.name,evaluate(param.value));}
 const parsed=await new Request('https://fixture.invalid',{method:'POST',body:form}).formData();
 assert.deepEqual(JSON.parse(parsed.get('payload')),p);
 for(const [i,key] of out[0].json.uploadFields.entries())assert.deepEqual(Buffer.from(await parsed.get(key).arrayBuffer()),files[i]);
});
test('conflict ticket evaluates in standalone analysis, with no main-node reference',async()=>{
 const json={client_run_id:'owner-'+randomUUID(),run_id:'claude-a7-fixture',conflict_ticket:'{"instructions":"preserve connectors"}'};
 const fn=new AsyncFunction('$input','$','require',nodes['Budget · 09 · Ticket'].jsCode);
 const out=await fn.call({helpers:{}},{first:()=>({json})},name=>{assert.equal(name,'Prepare analysis conflict ticket');return {first:()=>({json})}},require);
 assert.equal(out[0].json.budgetRequest.node,'09 Conflict check');
 assert.match(nodes['Prepare analysis conflict ticket'].jsCode,/instructions:p.instructions/);
 assert.doesNotMatch(nodes['Budget · 09 · Ticket'].jsCode,/08 Locks and freedoms/);
});

test('changing written directions invalidates the current analysis binding',async()=>{
 const draft=randomUUID(),id=randomUUID(),row={brief:{routeIntent:'single',routeChoice:'hero',budgetUsd:5},direction:'Preserve connectors'};
 const service=sourceUnderstandingService({references:async()=>[{reference_id:id,role:'product',sha256:'a'.repeat(64)}],draftRecord:async()=>row,store:{get:async()=>null},reader:null});
 const first=await service.current('owner',draft);row.direction='Change connectors';
 const changed=await service.current('owner',draft);
 assert.notEqual(changed.referenceFingerprint,first.referenceFingerprint);
 assert.equal(changed.instructions,'Change connectors');
});

test('continued contract reuses saved classifier locks without reading or billing another response',async()=>{
 const fixture=JSON.parse(await readFile(new URL('../a7-main-patch-fixture.json',import.meta.url)));
 const snapshot=JSON.parse(await readFile(new URL('../a7-analysis-node-snapshot.json',import.meta.url)));
 fixture.nodes.push(snapshot.nodes.find(n=>n.name==='Budget · 03 · Reserve'));
 const code=patchMainWorkflow(fixture).nodes.find(n=>n.name==='09b Contract').parameters.jsCode;
 const classification=code.slice(code.indexOf('function classifierReply'),code.indexOf('const cls = classification.value;'));
 const state={source_confirmation_bound:true,has_open_conflicts:false,source_conflict_answer:{conflicts:[],instruction_locks:['Keep the two units separate'],summary:'Verified'}};
 // Only the saved locks stage is accessible. Accessing the provider would fail.
 const $=name=>{assert.equal(name,'08 Locks and freedoms');return {first:()=>({json:state})}};
 const result=new Function('$',classification+'return classification;')($);
 assert.deepEqual(result.value.instruction_locks,['Keep the two units separate']);
});

test('bridge preserves uncertainty as a conflict response without accepting or retrying',async()=>{
 const code=collected.find(n=>n.config.name==='Bounded source receipt').config.parameters.jsCode;
 const fn=new AsyncFunction('$input','$',code);
 const p={draftId:randomUUID(),clientRunId:'owner-fixture',runId:'run-fixture',sourceSha256:'a'.repeat(64),referenceFingerprint:'b'.repeat(64),intentFingerprint:'c'.repeat(64)};
 const lookup=name=>{assert.equal(name,'Validate analysis-only intake');return {first:()=>({json:{payload:JSON.stringify(p)}})}};
 for(const response of [{error:{}},{statusCode:500,body:{message:'Error in workflow'}},{statusCode:200,body:{}},{statusCode:200,body:'invalid json'}]){
  const out=await fn({first:()=>({json:response})},lookup);
  assert.deepEqual(out,[{json:{http_status:409,error:'analysis_outcome_uncertain',accepted:false}}]);
 }
 const forward=collected.find(n=>n.config.name==='Forward analysis only');
 assert.equal(forward.config.retryOnFail,false);
});

test('bridge returns the complete successful receipt with the matching request identity',async()=>{
 const code=collected.find(n=>n.config.name==='Bounded source receipt').config.parameters.jsCode;
 const fn=new AsyncFunction('$input','$',code);
 const p={draftId:randomUUID(),clientRunId:'owner-fixture',runId:'run-fixture',sourceSha256:'a'.repeat(64),referenceFingerprint:'b'.repeat(64),intentFingerprint:'c'.repeat(64)};
 const body={...p,status:'analysis_complete',receiptId:randomUUID(),readers:['03','05','09'].map(node=>({node,status:'completed',operationKey:node,receiptRef:'receipt-'+node}))};
 const out=await fn({first:()=>({json:{statusCode:200,body}})},()=>({first:()=>({json:{payload:JSON.stringify(p)}})}));
 assert.equal(out[0].json.http_status,200);assert.equal(out[0].json.accepted,true);
 assert.deepEqual(out[0].json.readers,body.readers);assert.equal(out[0].json.intentFingerprint,p.intentFingerprint);
});
