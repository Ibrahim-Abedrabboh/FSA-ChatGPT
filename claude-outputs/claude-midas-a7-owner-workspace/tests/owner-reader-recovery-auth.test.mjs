import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../netlify/functions/owner-reader-recovery.mjs';
test('anonymous reader recovery is denied before environment, storage or upstream access',async()=>{
 for(const method of ['GET','POST']){
  const response=await handler(new Request('https://midas-a7-owner-preview.netlify.app/api/owner/jobs/claude-a7-test/reader-recovery',{method}),{params:{id:'claude-a7-test'},cookies:{get:()=>undefined}});
  assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
