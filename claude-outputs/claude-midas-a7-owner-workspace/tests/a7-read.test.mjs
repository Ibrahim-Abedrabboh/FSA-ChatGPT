import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRun, readResponse } from '../lib/a7-contract.mjs';
import { cleanJob } from '../netlify/functions/owner-jobs.mjs';
const row = {run_id:'real-run-1',status:'hold',stage:'05 Review',hold_reason:'Check image',trail:JSON.stringify([{step:1,name:'Review',at:'2026-10-17T10:00:00Z',note:'Review held'}]),go1_token:'DO_NOT_EXPOSE',resume_url:'https://sensitive.example',contract:'PRIVATE'};
test('allowlist excludes credentials, model payloads and resume URLs',()=>{
 const result=projectRun(row,true);
 assert.equal(JSON.stringify(result).includes('DO_NOT_EXPOSE'),false);
 assert.equal(JSON.stringify(result).includes('sensitive.example'),false);
 assert.equal(result.history[0].name,'Review');
 const cleaned=cleanJob({...result,secret:'NEVER'},true);
 assert.equal('secret' in cleaned,false);
});
test('history handles malformed values, truncation and redaction',()=>{
 assert.equal(projectRun({...row,trail:'broken'},true).historyAvailable,false);
 const history=Array.from({length:301},()=>({name:'Step',note:'Visit https://example.test/?token=secret Authorization=secret'}));
 const job=projectRun({...row,trail:JSON.stringify(history)},true);
 assert.equal(job.history.length,300);assert.equal(job.historyTruncated,true);
 assert.equal(JSON.stringify(job).includes('example.test'),false);assert.equal(JSON.stringify(job).includes('=secret'),false);
});
test('bounded queue pagination, empty results, invalid IDs and exact unique lookup',()=>{
 const rows=Array.from({length:52},(_,i)=>({...row,run_id:'run-'+i}));
 assert.equal(readResponse(rows,{}).nextOffset,50);
 assert.equal(readResponse(rows,{offset:'50'}).jobs.length,2);
 assert.equal(readResponse([] ,{}).total,0);
 assert.equal(readResponse(rows,{id:'../secret'}).http_status,400);
 assert.equal(readResponse(rows,{id:'missing'}).http_status,404);
 assert.equal(readResponse([row,row],{id:row.run_id}).http_status,409);
 assert.equal(readResponse(rows,{offset:'-1'}).http_status,400);
 assert.equal(readResponse(rows,{id:'run-1'}).job.id,'run-1');
});

test('owner job API enforces authentication and read-only access before upstream calls',async()=>{
 const handler=(await import('../netlify/functions/owner-jobs.mjs')).default;
 const context={cookies:{get:()=>null},site:{url:'https://preview.example'},params:{}};
 assert.equal((await handler(new Request('https://preview.example/api/owner/jobs'),context)).status,401);
 assert.equal((await handler(new Request('https://preview.example/api/owner/jobs',{method:'POST'}),context)).status,405);
});

test('owner job API sanitizes upstream data and fails closed on errors',async()=>{
 const handler=(await import('../netlify/functions/owner-jobs.mjs')).default;
 const originalFetch=globalThis.fetch;
 globalThis.Netlify={env:{get:key=>key==='A7_ENGINE_BASE_URL'?'https://runner.example':'test-credential'}};
 let mode='owner';let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  if(String(url).includes('/.netlify/identity/'))return Response.json({id:'user',app_metadata:{roles:mode==='member'?['member']:['owner']}});
  assert.equal(options.headers.Authorization,'test-credential');assert.equal(options.redirect,'error');
  if(mode==='down')return new Response('Upstream secrets must not be forwarded',{status:500});
  return Response.json({jobs:[{...projectRun(row),go1_token:'NEVER_FORWARD'}],total:1,nextOffset:null,asOf:'2026-10-17T10:00:00Z'});
 };
 const context={cookies:{get:()=> 'test-token',delete:()=>{}},site:{url:'https://preview.example'},params:{}};
 try{
  let response=await handler(new Request('https://preview.example/api/owner/jobs'),context);
  assert.equal(response.status,200);assert.equal((await response.text()).includes('NEVER_FORWARD'),false);
  mode='member';calls=0;response=await handler(new Request('https://preview.example/api/owner/jobs'),context);assert.equal(response.status,403);assert.equal(calls,1);
  mode='down';response=await handler(new Request('https://preview.example/api/owner/jobs'),context);assert.equal(response.status,502);assert.equal((await response.text()).includes('secrets'),false);
 }finally{globalThis.fetch=originalFetch;delete globalThis.Netlify;}
});
test('recorded image findings remain distinct from entered quantities and redact private fields',()=>{
 const observation={category_seen:'Sofa',count_eye:2,count_second:2,count_stated:3,colour_observed:'Blue',material_appearance:'Woven fabric',pieces_seen:[{kind:'module',label:'left unit',role:'product',features:['connector bracket'],secret:'NEVER'}],design_locks:['keep connectors'],hidden:['back not visible'],unclear_second:['rear construction'],resume_url:'https://private.test',token:'NEVER'};
 const result=cleanJob(projectRun({...row,observation:JSON.stringify(observation)},true),true);assert.equal(result.observation.eyeCount,2);assert.equal(result.observation.statedCount,3);assert.equal(result.observation.pieces[0].features[0],'connector bracket');assert.ok(!JSON.stringify(result).includes('NEVER'));assert.ok(!JSON.stringify(result).includes('private.test'));assert.equal(projectRun({...row,observation:'broken'},true).observation,null);
});
