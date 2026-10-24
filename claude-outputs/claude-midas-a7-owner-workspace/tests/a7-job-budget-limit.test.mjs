import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MAX_JOB_BUDGET_USD} from '../lib/a7-limits.mjs';
import {usdToMicro} from '../lib/a7-budget.mjs';
import {validateSubmission} from '../lib/a7-actions.mjs';
import {estimateDraft} from '../lib/a7-estimate.mjs';

const input={requestId:'e10efbc4-4f57-4dca-a6e6-d763c4645179',product:'Sofa',inventory:'1 sofa',outcome:'White background',aspect:'1:1',resolution:'2K',view:'Category template',lighting:'Daylight',instructions:'Keep the product',dimensions:'',sku:'',confirmed:true};
const draft=b=>({id:'draft',brief:{outcome:'White background',view:'Category template',resolution:'2K',budgetUsd:b},direction:'Keep'});
const ref={reference_id:'ref',role:'product',sha256:'a'.repeat(64)};

test('a job may be given up to USD 10.00 and no more, at every layer',async()=>{
 assert.equal(MAX_JOB_BUDGET_USD,10);
 assert.equal(usdToMicro(10),10000000);assert.throws(()=>usdToMicro(10.01),/invalid_usd/);
 assert.equal(validateSubmission({...input,budgetUsd:10}).budgetLimitUsd,10);
 assert.throws(()=>validateSubmission({...input,budgetUsd:10.01}),/invalid_budget/);
 const now=new Date('2026-10-18T12:01:00Z');
 assert.equal(estimateDraft(draft(10),[ref],now).ceilingUsd,10);
 assert.throws(()=>estimateDraft(draft(10.01),[ref],now),/estimate_scope_unsupported/);
 const page=await readFile(new URL('../start.html',import.meta.url),'utf8');
 assert.match(page,/id="connectedBudget" type="number" min="0.25" max="10"/);
});
