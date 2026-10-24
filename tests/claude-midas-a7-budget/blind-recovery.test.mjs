import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';
import {installReaderRecovery} from '../../n8n/claude-midas-a7/budget-guards/install-reader-recovery.mjs';
import {installBlindRecovery,restoredBlindReview,blindAnswer,countedBlindRequest,BLIND_PROMPT} from '../../n8n/claude-midas-a7/budget-guards/blind-recovery.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url)));
const base=installReaderRecovery(guardWorkflow(read('n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json'))),w=installBlindRecovery(base),node=n=>w.nodes.find(x=>x.name===n);
const incoming=n=>Object.entries(w.connections).flatMap(([from,x])=>(x.main||[]).flatMap(edges=>edges.filter(e=>e.node===n).map(()=>from)));
test('replacement has one guarded provider entry, stable original IDs and owner Go 2 wait',()=>{
 assert.deepEqual(incoming('Blind · OpenAI once'),['Blind · Accepted']);assert.deepEqual(incoming('Blind · Accepted'),['Blind · Permit']);
 for(const old of base.nodes){const now=node(old.name);assert.equal(now.id,old.id);assert.deepEqual(now.credentials,old.credentials);if(old.type.endsWith('.webhook')||old.type.endsWith('.wait'))assert.deepEqual(now,old);}
 for(const n of w.nodes.filter(x=>x.name.startsWith('Blind ·')))assert.equal(n.retryOnFail,false);
 assert.equal(node('Blind · OpenAI once').parameters.url,'https://api.openai.com/v1/responses');assert.equal(node('Blind · Download candidate').parameters.fileId.value,'1hvmFnJu7seIt6DRN0ks7qycIZzYDukCR');
 const AF=Object.getPrototypeOf(async function(){}).constructor;for(const n of w.nodes.filter(x=>x.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new AF('$input','$','require',n.parameters.jsCode),n.name);
 assert.throws(()=>installBlindRecovery(w),/blind_already_installed/);
});
const fixture=p=>read('claude-outputs/claude-midas-a7-owner-workspace/tests/fixtures/'+p);
const context={ready:true,row:fixture('approved-blind-run.json'),review:fixture('approved-blind-review.json'),checkpoint:{brief:fixture('approved-reader-replacement-brief.json')}};
const response=patch=>({id:'resp_test',status:'completed',usage:{input_tokens:1400,output_tokens:200},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({pieces:[{kind:'seating',count:2}],total:2,background_white:true,text_or_logo:false,cropped:false,hidden:[],unclear:[],box_2d:[60,60,940,940],...patch})}]}]});
test('saved critic is reused without another paid call; framing warning and Go 2 stay explicit',async()=>{
 const restored=restoredBlindReview(context),raw=response();blindAnswer(raw);const nodes={'Blind · Build request':restored,'Blind · Answer':{response:raw},'04 Settings':{framing:{white_note_band_pct:[72,80]}}};
 const $=n=>({first:()=>{if(!nodes[n])throw Error('not run');return {json:nodes[n]};}}),AF=Object.getPrototypeOf(async function(){}).constructor;
 const [it]=await new AF('$input','$','require',node('Blind · Review verdict').parameters.jsCode)({},$,createRequire(import.meta.url));const s=it.json;
 assert.equal(s.status,'awaiting_go_2');assert.equal(s.review.counts.blind,2);assert.equal(s.review.framing.within,false);assert.equal(s.review.framing.measured_share_pct,88);assert.match(s.review.summary,/90%/);assert.equal(s.go2_last,undefined);assert.equal(s.text_calls_new.length,1);assert.equal(s.text_calls_new[0].node,'16xb Blind count fallback (OpenAI)');
});
test('incomplete or inconsistent answers and over-cap count stop; prompt hides the target count',()=>{
 assert.equal(blindAnswer(response()).total,2);assert.throws(()=>blindAnswer(response({total:3})),/blind_answer_invalid/);assert.throws(()=>blindAnswer({...response(),status:'incomplete'}),/blind_answer_incomplete/);
 assert.equal(countedBlindRequest({statusCode:200,body:{input_tokens:19550}},'a'.repeat(64)).inputTokens,20000);assert.throws(()=>countedBlindRequest({statusCode:200,body:{input_tokens:19551}},'a'.repeat(64)),/blind_count_unavailable/);assert.doesNotMatch(BLIND_PROMPT,/\btwo\b|"total"\s*:\s*2\b|expected count[^.]*\b2\b/i);
});
