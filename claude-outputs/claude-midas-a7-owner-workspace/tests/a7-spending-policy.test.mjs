import test from 'node:test';
import assert from 'node:assert/strict';
import {spendingHold} from '../lib/a7-spending-policy.mjs';
test('every action that can continue paid processing is held until guards are explicitly ready',()=>{
 for(const action of ['submit','go','change','approve','approve_unreviewed','repair','review_again',undefined,'unexpected']) {
  for(const flag of [undefined,null,false,true,'false','TRUE','1',''])assert.equal(spendingHold(action,flag),true);
  assert.equal(spendingHold(action,'true'),false);
 }
});
test('stopping remains possible when paid actions are held',()=>{
 for(const flag of [undefined,'false','true'])assert.equal(spendingHold('stop',flag),false);
});
test('authenticated paid decisions stop before any bridge, budget or dispatch access',async()=>{
 const {default:handler}=await import('../netlify/functions/owner-actions.mjs');
 const previousFetch=globalThis.fetch,previousNetlify=globalThis.Netlify;let calls=0;
 globalThis.Netlify={env:{get:key=>key==='A7_OWNER_ACTIONS_ENABLED'?'true':undefined}};
 globalThis.fetch=async()=>{calls++;return Response.json({id:'owner',app_metadata:{roles:['owner']}});};
 try {
  for(const decision of ['go','change','approve','approve_unreviewed','repair','review_again']) {
   calls=0;
   const response=await handler(new Request('https://example.test/api/owner/jobs/run/approval',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({decision})}),{params:{id:'run'},cookies:{get:()=> 'synthetic-test-token'},site:{url:'https://example.test'},deploy:{context:'production'}});
   assert.equal(response.status,503);assert.equal((await response.json()).error,'paid_guards_not_ready');assert.equal(calls,1,'Only the live Identity role check may run');
  }
 }finally{globalThis.fetch=previousFetch;globalThis.Netlify=previousNetlify;}
});

test('approval readiness reads the Netlify module binding without requiring a globalThis property',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const source=await readFile(new URL('../netlify/functions/owner-actions.mjs',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function cleanContext'),source.indexOf('export default async function handler'));
 const context={runId:'run',gate:null,allowed:[],shots:[],warnings:[],revision:'a'.repeat(64)};
 for(const flag of ['true','false']){
  const result=runInNewContext('const a7Origin=()=>"https://engine.example";const Netlify={env:{get:()=>flag}};'+code+';cleanContext(context,"run")',{flag,context});assert.equal(result.paidReady,flag==='true');
 }
});
