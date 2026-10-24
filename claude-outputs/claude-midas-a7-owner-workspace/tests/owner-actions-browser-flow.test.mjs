import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../owner-actions.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const estimate={fingerprint:'fixture',status:'verified',paidReady:true,noRepairUsd:.181,twoRepairsEachUsd:.501,outputs:['white'],warnings:[],coverage:['fixture'],exclusions:[],basis:'Synthetic test only'};
function setup({estimateReply,ready,fetchReply}={}){
 const nodes=new Map(),listeners=new Map(),windowListeners=new Map(),requests=[];
 function element(id){if(!nodes.has(id))nodes.set(id,{id,value:'',style:{},children:[],checked:false,disabled:false,showCount:0,addEventListener(k,f){listeners.set(id+':'+k,f);},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},focus(){this.focused=true;},showModal(){this.showCount++;},close(){listeners.get(id+':close')?.();},reset(){},querySelector(){return element('reviewSubmit');}});return nodes.get(id);}
 element('promptInput').value='Synthetic instruction';
 const draft={id:'draft-fixture',direction:'Synthetic instruction',references:[]};
 const window={a7Projects:{ready:ready||(()=>Promise.resolve(draft))},addEventListener:(k,f)=>windowListeners.set(k,f),dispatchEvent(){}};
 const fetch=async(url,options={})=>{requests.push({url,options});if(fetchReply)return fetchReply(url,options);return{ok:true,json:async()=>estimateReply?estimateReply():estimate};};
 class Data{constructor(form){this.entries=form?[['product','Fixture'],['outcome','White background'],['budgetUsd','5'],['inventory','1 unit'],['file',{size:0}]]:[];}[Symbol.iterator](){return this.entries[Symbol.iterator]();}set(){}}
 vm.runInNewContext(source,{document:{getElementById:element,createElement:tag=>element('created-'+tag+'-'+nodes.size)},window,fetch,FormData:Data,crypto:{randomUUID:()=> 'synthetic-request'},AbortSignal,Event});
 return{element,listeners,windowListeners,requests,submit:()=>listeners.get('submissionForm:submit')({preventDefault(){}})};
}
test('concurrent review clicks get one estimate and one confirmation, with no action POST',async()=>{
 const d=deferred(),s=setup({estimateReply:()=>d.promise});const first=s.submit();await s.submit();await Promise.resolve();d.resolve(estimate);await first;
 assert.equal(s.requests.length,1);assert.equal(s.requests[0].options.method,undefined);assert.equal(s.element('actionDialog').showCount,1);
 s.element('actionDialog').close();assert.equal(s.element('reviewSubmit').disabled,false);
});
test('an instruction change while the estimate loads discards the old confirmation',async()=>{
 const d=deferred(),s=setup({estimateReply:()=>d.promise});const review=s.submit();await Promise.resolve();s.listeners.get('promptInput:input')();d.resolve(estimate);await review;
 assert.equal(s.element('actionDialog').showCount,0);assert.match(s.element('submissionStatus').textContent,/request changed/);assert.equal(s.element('reviewSubmit').disabled,false);
});
test('a draft failure restores review controls without dispatching anything',async()=>{
 const s=setup({ready:()=>Promise.reject(Error('synthetic failure'))});await s.submit();assert.equal(s.requests.length,0);assert.equal(s.element('reviewSubmit').disabled,false);assert.match(s.element('submissionStatus').textContent,/reopen the saved draft/);
});
test('a missing estimate cannot open confirmation or send paid processing',async()=>{
 const s=setup({fetchReply:async()=>({ok:false,json:async()=>({})})});await s.submit();assert.equal(s.element('actionDialog').showCount,0);assert.equal(s.requests.length,1);assert.match(s.element('submissionStatus').textContent,/Paid processing cannot start/);
});
test('leaving a job during recovery-state reading discards its late owner panel',async()=>{
 const waiting=deferred(),entered=deferred(),s=setup({fetchReply:async url=>{
 if(url.endsWith('/reader-recovery')){entered.resolve();return waiting.promise;}
 if(url.includes('/budgets/'))return{ok:true,json:async()=>({budget:{limit_micro_usd:5000000,committed_micro_usd:0},operations:[],basis:'Synthetic ledger'})};
 return{ok:true,json:async()=>({gate:null,shots:[],allowed:[],warnings:[],cost:{},clientId:'owner-12345678-1234-1234-1234-123456789abc',status:'hold',paidReady:true})};
 }});
 s.windowListeners.get('a7-job-open')({detail:{id:'test-run',summary:'Synthetic hold'}});await entered.promise;s.windowListeners.get('a7-job-loading')();waiting.resolve({ok:true,json:async()=>({eligible:false,recoveryRequested:true})});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(s.element('decisionCard').children.length,0);assert.ok(s.requests.every(r=>r.options.method!== 'POST'));
});
// Run report ff0aa7e5 (22 Oct 2026), 4.4: a held run keeps its last Go 2 ticket's wording with nothing allowed.
const staleGo2='go 2: approve this white master, order a repair, or stop. Approval is yours only; the review is not an approval.';
async function openWith(context,summary){
 const s=setup({fetchReply:async url=>{
  if(url.includes('/budgets/'))return{ok:true,json:async()=>({budget:{limit_micro_usd:5000000,committed_micro_usd:0},operations:[],basis:'Synthetic ledger'})};
  if(url.endsWith('/reader-recovery'))return{ok:true,json:async()=>({eligible:false})};
  return{ok:true,json:async()=>({shots:[{number:1,output:'white',frame:'Front',plan:{camera:'Front'}}],warnings:[],cost:{},clientId:'owner-12345678-1234-1234-1234-123456789abc',paidReady:true,decisionNeeded:staleGo2,...context})};
 }});
 s.windowListeners.get('a7-job-open')({detail:{id:'test-run',summary}});
 for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,0));
 const panel=s.element('decisionCard').children[0];return {s,panel,text:panel.children.map(x=>x.textContent||'').join(' ')};
}
test('a held run with no allowed decision shows its hold reason, no Go 2 wording, no shots and no decision button',async()=>{
 const {panel,text}=await openWith({gate:null,status:'hold',allowed:[]},'the saved webp file shows a grey halo');
 assert.match(text,/On hold · no decision to make/);assert.match(text,/On hold: the saved webp file shows a grey halo/);
 assert.doesNotMatch(text,/go 2: approve/i);assert.doesNotMatch(text,/Shot 1/);
 assert.equal(panel.children.filter(x=>String(x.id).startsWith('created-button')).length,0);
});
test('a Go 2 ticket that allows nothing does not show its decision wording',async()=>{
 const {text}=await openWith({gate:'go2',status:'awaiting_go_2',allowed:[]},'');
 assert.doesNotMatch(text,/go 2: approve/i);assert.doesNotMatch(text,/Image approval/);assert.match(text,/expired or cannot be answered safely/);
});
test('an open Go 2 ticket still shows its decision wording and buttons',async()=>{
 const {text}=await openWith({gate:'go2',status:'awaiting_go_2',allowed:['approve','stop'],round:1,revision:'r'.repeat(64),runId:'test-run'},'');
 assert.match(text,/Image approval/);assert.match(text,/go 2: approve/);assert.match(text,/Approve image · Go 2/);
});
