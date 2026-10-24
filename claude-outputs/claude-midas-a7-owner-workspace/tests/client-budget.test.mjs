import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateSubmission} from '../lib/a7-actions.mjs';
import {MAX_JOB_BUDGET_USD} from '../lib/a7-limits.mjs';
const app=await readFile(new URL('../client/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../client/index.html',import.meta.url),'utf8');
// The client studio's own budget check, run as written in the page.
const piece=app.slice(app.indexOf('const MAX_BUDGET_USD'),app.indexOf('function blockers()'));
const page=vm.runInNewContext(piece+';({MAX_BUDGET_USD,validBudget})',{});
const input={requestId:'e10efbc4-4f57-4dca-a6e6-d763c4645179',product:'Dining set',inventory:'1 table\n8 chairs',outcome:'Lifestyle',aspect:'16:9',resolution:'2K',view:'Wide view',lighting:'Daylight',instructions:'Keep the product',dimensions:'',sku:'',confirmed:true};
const serverAccepts=v=>{try{validateSubmission({...input,budgetUsd:Number(v)});return true;}catch(e){if(e.message!=='invalid_budget')throw e;return false;}};

test('the client studio budget check agrees with the server for every edge',()=>{
 assert.equal(page.MAX_BUDGET_USD,MAX_JOB_BUDGET_USD);
 for(const v of ['5','0.25','10','10.00','4.74','0.24','10.01','0','-1','4.745','abc'])assert.equal(page.validBudget(v),serverAccepts(v),v);
 // An empty field is not a budget: Number('') would be 0, refused anyway, but the page says so before any save.
 assert.equal(page.validBudget(''),false);assert.equal(page.validBudget('  '),false);
});

test('the client studio sends the owner-set budget instead of a fixed USD 5, and keeps it in the draft',()=>{
 assert.match(app,/budgetUsd: Number\(s\.budget\)/);assert.doesNotMatch(app,/budgetUsd: 5\b/);
 assert.match(app,/mustNot: '', budget: '5'\n/);   // default, and a string so loadDraft restores it
 assert.match(app,/\$\('budget'\)\.addEventListener\('input', e => \{ s\.budget = e\.target\.value;[^}]*saveDraft\(\); \}\)/);
 assert.match(app,/if \(!validBudget\(s\.budget\)\) b\.push\(/);
});

test('the budget field sits in Step 3, outside the room preferences that a white background disables',()=>{
 const field=html.indexOf('id="budget"'),scope=html.indexOf('id="s-scope"'),prefs=html.indexOf('id="s-preferences"');
 assert.ok(field>scope&&field<prefs);
 assert.match(html,/<input id="budget" type="number" min="0\.25" max="10" step="0\.01"/);
});
