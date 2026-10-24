import test from 'node:test';import assert from 'node:assert/strict';import {bufferBridgeUpload} from '../../n8n/claude-midas-a7/owner-bridge/buffer-upload.mjs';
test('forwarding uses byte-identical bounded inline binary without stored stream identifiers',async()=>{
 const source={nodes:[{name:'Normalize owner upload',id:'same',parameters:{jsCode:"const item=$input.first(),b=item.binary,keys=Object.keys(b),p=item.json;return [{json:{payload:JSON.stringify(p)},binary:{files:b[keys[0]]}}];"}},{name:'Forward owner intake',parameters:{options:{response:{response:{fullResponse:true,neverError:true}}}},credentials:{original:'same'}}]};
 const w=bufferBridgeUpload(source),AF=Object.getPrototypeOf(async function(){}).constructor,bytes=Buffer.from([255,0,1,2]);
 const [r]=await new AF('$input',w.nodes[0].parameters.jsCode).call({helpers:{getBinaryDataBuffer:async()=>bytes}},{first:()=>({json:{request:'same'},binary:{files:{id:'stored-only',mimeType:'image/jpeg'}}})});
 assert.equal(w.nodes[0].id,'same');assert.equal(r.binary.files.id,undefined);assert.deepEqual(Buffer.from(r.binary.files.data,'base64'),bytes);assert.deepEqual(JSON.parse(r.json.payload),{request:'same'});assert.equal(w.nodes[1].retryOnFail,false);assert.deepEqual(w.nodes[1].credentials,source.nodes[1].credentials);
});
