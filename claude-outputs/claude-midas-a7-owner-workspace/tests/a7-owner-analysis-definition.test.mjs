import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('proposed owner bridge has a separate analysis-only route and no generation dispatch',async()=>{
 const source=await readFile(new URL('../a7-owner-analysis-workflow.ts',import.meta.url),'utf8');
 assert.match(source,/path:'a7\/owner-analyze'/);
 assert.match(source,/claude-midas-a7-analysis/);
 assert.match(source,/source_analysis_only/);
 assert.match(source,/retryOnFail:false/);
 assert.doesNotMatch(source,/webhook\/claude-midas-a7['"]/);
 assert.doesNotMatch(source,/Send to Google|Stylist plans the scenes|owner-decision/);
});
