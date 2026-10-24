import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';

test('analysis-only reserve ceiling includes room when present and never budgets generation',()=>{
 const source={draftId:randomUUID(),sourceSha256:'a'.repeat(64),referenceFingerprint:'c'.repeat(64)};
 const product=quoteSourceAnalysis(source),withRoom=quoteSourceAnalysis({...source,roomSha256:'b'.repeat(64)});
 assert.equal(product.totalMicroUsd,3170084);assert.equal(product.maxCostUsd,3.18);
 assert.equal(withRoom.totalMicroUsd,3986516);assert.equal(withRoom.maxCostUsd,3.99);
 assert.deepEqual(withRoom.calls.map(x=>x.node),['03 Eye reads the product photo','05 Second count','06 Room reader','09 Conflict check']);
 assert.equal(withRoom.calls.some(x=>/Send to Google|Stylist plans/.test(x.node)),false);
 assert.notEqual(withRoom.fingerprint,product.fingerprint);
 assert.throws(()=>quoteSourceAnalysis({...source,referenceFingerprint:'wrong'}),/invalid_analysis_source/);
 assert.throws(()=>quoteSourceAnalysis(source,new Date('2027-01-01T00:00:00Z')),/price_verification_required/);
});
