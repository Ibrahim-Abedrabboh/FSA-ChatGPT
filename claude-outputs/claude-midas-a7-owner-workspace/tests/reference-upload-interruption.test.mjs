import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer,request as httpRequest} from 'node:http';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {validateReferenceFile,digest,sameOrigin} from '../lib/a7-actions.mjs';
import {noStoreJson} from '../lib/owner-auth.mjs';
// Execute the production handler body. Only authentication/storage dependencies
// are replaced: no credentials, external connections or real owner data.
const source=await readFile(new URL('../netlify/functions/owner-project-references.mjs',import.meta.url),'utf8');
const body=source.replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler').replace(/export const config=[\s\S]*$/,'');
const makeHandler=new Function('authenticate','budgetPool','draftReferences','getStore','attachReference','sameOrigin','validateReferenceFile','digest','noStoreJson',body+'\nreturn handler;');
function harness(){
 const blobs=new Map(),refs=new Map(),writes=[],calls=[];
 const owner='synthetic-local-owner',id='synthetic-local-version';
 const handler=makeHandler(async()=>Response.json({id:owner}),()=>({}),async(_p,o,v)=>{assert.equal(o,owner);assert.equal(v,id);return [];},()=>({async set(k,b){writes.push(k);if(!blobs.has(k))blobs.set(k,Buffer.from(b));}}),async(_p,o,v,r,persist)=>{assert.equal(o,owner);assert.equal(v,id);if(refs.has(r.role+':'+r.sha256))return;await persist();calls.push(r.sha256);refs.set(r.role+':'+r.sha256,r);},sameOrigin,validateReferenceFile,digest,noStoreJson);
 const context={params:{id},deploy:{context:'production'}};
 return {handler,context,blobs,refs,writes,calls};
}
const boundary='a7-local-transport-test';
const fixture=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(131072,97)]);
const multipart=()=>Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="role"\r\n\r\nproduct\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n'),fixture,Buffer.from('\r\n--'+boundary+'--\r\n')]);
const headers={'content-type':'multipart/form-data; boundary='+boundary,origin:'https://owner.example'};
const syntheticRequest=b=>new Request('https://owner.example/api/owner/project-references/synthetic-local-version',{method:'POST',headers,body:b});
test('truncated multipart body is rejected before any blob or reference write',async()=>{
 const h=harness(),b=multipart();const response=await h.handler(syntheticRequest(b.subarray(0,b.length-2000)),h.context);
 assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(h.writes.length,0);assert.equal(h.calls.length,0);
});
test('real TCP interruption during multipart upload creates no reference; complete retry is bounded and deduplicated',async()=>{
 const h=harness();let resolveSeen,resolveFinished;const seen=new Promise(r=>resolveSeen=r),finished=new Promise(r=>resolveFinished=r);let requests=0,received=0;
 const server=createServer(async(req,res)=>{
  const number=++requests;req.on('data',chunk=>{received+=chunk.length;resolveSeen();});
  try{
   const r=new Request('https://owner.example'+req.url,{method:'POST',headers:{...req.headers,origin:'https://owner.example'},body:Readable.toWeb(req),duplex:'half'});
   const response=await h.handler(r,h.context);if(!res.destroyed){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}
   if(number===1)resolveFinished(response.status);
  }catch(error){if(number===1)resolveFinished('adapter_rejected');if(!res.destroyed)res.destroy();}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port,b=multipart();
 try{
  const req=httpRequest({host:'127.0.0.1',port,path:'/api/owner/project-references/synthetic-local-version',method:'POST',headers:{...headers,'content-length':b.length}});req.on('error',()=>{});req.flushHeaders();req.write(b.subarray(0,8192));await seen;req.destroy();
  const outcome=await Promise.race([finished,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('aborted_body_not_resolved')),3000);t.unref();})]);
  assert.equal(outcome,503);assert.ok(received>0&&received<b.length);assert.equal(h.writes.length,0);assert.equal(h.calls.length,0);
  const send=()=>new Promise((resolve,reject)=>{const r=httpRequest({host:'127.0.0.1',port,path:'/api/owner/project-references/synthetic-local-version',method:'POST',headers:{...headers,'content-length':b.length}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});r.on('error',reject);r.end(b);});
  assert.equal(await send(),200);assert.equal(h.blobs.size,1);assert.equal(h.refs.size,1);assert.deepEqual([...h.blobs.values()][0],fixture);
  assert.equal(await send(),200);assert.equal(h.blobs.size,1);assert.equal(h.refs.size,1);assert.equal(h.calls[0],digest(fixture));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('oversized declared body and unsupported file bytes stop before writes',async()=>{
 const h=harness();const tooLarge=new Request('https://owner.example/api/owner/project-references/synthetic-local-version',{method:'POST',headers:{...headers,'content-length':'3300001'},body:multipart()});assert.equal((await h.handler(tooLarge,h.context)).status,503);
 const b=multipart();const invalid=Buffer.from(b);invalid.fill(0,invalid.indexOf(fixture.subarray(0,8)),invalid.indexOf(fixture.subarray(0,8))+8);assert.equal((await h.handler(syntheticRequest(invalid),h.context)).status,503);assert.equal(h.writes.length,0);assert.equal(h.calls.length,0);
});
