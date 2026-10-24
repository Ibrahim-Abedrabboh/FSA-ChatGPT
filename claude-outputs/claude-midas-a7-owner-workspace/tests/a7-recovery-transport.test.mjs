import test from 'node:test';import assert from 'node:assert/strict';
import {recoveryUpload,recoveryReceipt,transportFailure} from '../lib/a7-recovery-transport.mjs';
test('bounded multipart round trip preserves exact image and existing recovery identity',async()=>{
 const bytes=Buffer.from([0,255,13,10,12]),recovery={requestId:'existing',sourceSha256:'a'.repeat(64)},upload=recoveryUpload(bytes,'image/png','same-owner-job',recovery);
 assert.equal(Number(upload.headers['Content-Length']),upload.body.length);
 const request=new Request('https://example.test',{method:'POST',headers:upload.headers,body:upload.body}),form=await request.formData();
 assert.deepEqual(JSON.parse(form.get('payload')),{clientRunId:'same-owner-job',recovery});assert.deepEqual(Buffer.from(await form.get('files').arrayBuffer()),bytes);assert.equal(form.get('files').type,'image/png');assert.equal(form.get('files').name,'recovery-original.png');
 for(const [b,t] of [[Buffer.alloc(0),'image/png'],[Buffer.alloc(3*1024*1024+1),'image/png'],[bytes,'image/png\r\nx: invalid']])assert.throws(()=>recoveryUpload(b,t,'id',recovery),/source_unavailable/);
});
test('receipt distinguishes empty/non-JSON/rejected responses and never prints upstream text',async()=>{
 for(const [body,status,kind] of [['',200,'empty'],['private upstream error',502,'non_json'],['{"accepted":false}',502,'rejected'],['{}',200,'unexpected_json'],['{"accepted":true}',200,'accepted']]){
  const r=await recoveryReceipt(new Response(body,{status}));assert.equal(r.receiptKind,kind);assert.equal(r.accepted,kind==='accepted');assert.equal(JSON.stringify(r).includes('private'),false);
 }
 assert.equal((await recoveryReceipt(new Response('x'.repeat(16001)))).receiptKind,'oversized');
 assert.equal(transportFailure({cause:{code:'ECONNRESET',message:'secret'}}).transportCode,'ECONNRESET');assert.equal(transportFailure(Error('secret')).transportCode,'UNCLASSIFIED');
});
test('non-paid probe receipt is distinct from paid submission acceptance',async()=>{
 const response=()=>new Response('{"transportProbe":true,"valid":true}');assert.equal((await recoveryReceipt(response(),true)).accepted,true);assert.equal((await recoveryReceipt(response())).accepted,false);
 const upload=recoveryUpload(Buffer.from('probe'),'image/png','owner-test',{},true),f=await new Request('https://example.test',{method:'POST',headers:upload.headers,body:upload.body}).formData();assert.equal(JSON.parse(f.get('payload')).transportProbe,true);
});
