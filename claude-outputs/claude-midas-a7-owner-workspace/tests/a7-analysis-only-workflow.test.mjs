import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

test('analysis-only workflow contains bounded original readers and no generation path',async()=>{
 const code=await readFile(new URL('../a7-analysis-only-workflow.ts',import.meta.url),'utf8');
 assert.match(code,/claude-midas-a7-analysis/);
 for(const stage of ['03','05','06','09'])for(const step of ['Ticket','Reserve','Permit','Allowed','Receipt','Settle','Restore','Settled'])assert.match(code,new RegExp(`Budget · ${stage} · ${step}`));
 assert.match(code,/Analysis hold/);
 assert.match(code,/automaticResend:false/);
 assert.match(code,/source_analysis_only/);
 assert.doesNotMatch(code,/15g Send to Google|11 Stylist plans the scenes|webhook\/claude-midas-a7['"]/);
});
test('analysis webhook intake binds original bytes and preallocated identity before any reader',async()=>{
 const code=await readFile(new URL('../a7-analysis-only-workflow.ts',import.meta.url),'utf8');
 const line=code.split('\n').find(s=>s.startsWith('const intake=node('));
 const config=JSON.parse(line.slice('const intake=node('.length,-2));
 const fn=new (Object.getPrototypeOf(async function(){}).constructor)('$input','require',config.config.parameters.jsCode);
 const draftId=randomUUID(),bytes=Buffer.from('synthetic-product-photo'),sourceSha256=createHash('sha256').update(bytes).digest('hex');
 const p={purpose:'source_analysis_only',draftId,clientRunId:'owner-'+draftId,runId:'claude-a7-'+draftId,requestId:randomUUID(),sourceSha256,referenceFingerprint:'b'.repeat(64),quoteFingerprint:'c'.repeat(64),intentFingerprint:'d'.repeat(64),maxCostUsd:3.18,budgetLimitUsd:5};
 const binary={files:{fileName:'product-'+randomUUID(),mimeType:'image/png'}};
 const run=payload=>fn.call({helpers:{getBinaryDataBuffer:async()=>bytes}},{first:()=>({json:{body:{payload:JSON.stringify(payload)}},binary})},createRequire(import.meta.url));
 assert.equal((await run(p))[0].json.product_key,'files');
 await assert.rejects(run({...p,runId:'claude-a7-'+randomUUID()}),/invalid_analysis_intake/);
 await assert.rejects(run({...p,sourceSha256:'f'.repeat(64)}),/analysis_source_mismatch/);
 await assert.rejects(run({...p,budgetLimitUsd:2}),/invalid_analysis_intake/);
});
