import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {canonical} from '../lib/a7-actions.mjs';
import {sharedRunIdentity} from '../lib/a7-shared-run.mjs';
import {sourceUnderstandingService,requireConfirmedSource} from '../lib/a7-understanding-service.mjs';
import {quoteSourceAnalysis} from '../lib/a7-analysis-quote.mjs';
import {claimSourceContinuation} from '../lib/a7-source-continuation.mjs';

const product='a'.repeat(64),other='c'.repeat(64);
const NAMES=['03 Eye reads the product photo','05 Second count','09 Conflict check'];

// One owner with a parent version that paid for and confirmed its analysis, and edit children of it.
function world(){
 const owner=randomUUID(),parent=randomUUID(),values=new Map(),drafts=new Map(),refs=new Map();let reads=0;
 const brief={routeIntent:'single',routeChoice:'hero',budgetUsd:5,product:'Sofa',inventory:'1 sofa'};
 drafts.set(parent,{owner_id:owner,brief,note:'Original direction',direction:'Original direction',parent_id:null,dispatch_state:'received',client_run_id:sharedRunIdentity(parent).clientRunId});
 refs.set(parent,[{reference_id:randomUUID(),role:'product',sha256:product}]);
 const store={get:async key=>values.get(key)||null,set:async(key,value,{onlyIfNew}={})=>{if(onlyIfNew&&values.has(key))return false;values.set(key,value);return true;}};
 const readers=NAMES.map((node,i)=>({node,status:'completed',operationKey:'reader-'+i,receiptRef:'answer-'+i}));
 const reader={quote:async({source})=>quoteSourceAnalysis(source),run:async({source,intent})=>{reads++;return {receiptId:randomUUID(),draftId:source.draftId,sourceSha256:source.sourceSha256,roomSha256:null,intentFingerprint:intent.fingerprint,readers,observation:{category:'Sofa',eyeCount:1,secondCount:1,pieces:[{label:'sofa',kind:'sofa',role:'product'}]}};}};
 const service=sourceUnderstandingService({
  references:async(o,id)=>{if(o!==owner||!refs.has(id))throw Error('not_found');return refs.get(id);},
  draftRecord:async(o,id)=>{const d=drafts.get(id);if(o!==owner||!d)throw Error('not_found');return d;},store,reader});
 function child(of,{sha=product}={}){
  const id=randomUUID();
  drafts.set(id,{owner_id:owner,brief:{...brief,routeIntent:'edit',routeChoice:'saved',allowedChanges:'Warm evening light',protectedDetails:'Same sofa'},note:'Evening',direction:'Evening',parent_id:of,dispatch_state:'confirmed',client_run_id:sharedRunIdentity(id).clientRunId});
  refs.set(id,[{reference_id:randomUUID(),role:'product',sha256:sha}]);
  return id;
 }
 async function confirmParent(){
  const q=await service.quote(owner,parent);
  const observed=await service.analyze(owner,parent,{requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true});
  return service.confirm(owner,parent,{confirmed:true,receiptFingerprint:observed.receipt.fingerprint});
 }
 return {owner,parent,drafts,refs,store,service,child,confirmParent,readers,get reads(){return reads;}};
}

test('a saved edit with the same photos reuses its parent\'s confirmed analysis without a new paid read',async()=>{
 const w=world(),confirmed=await w.confirmParent(),kid=w.child(w.parent);
 assert.equal(w.reads,1);
 const s=await w.service.state(w.owner,kid);
 assert.equal(s.status,'confirmed');assert.equal(s.inherited.fromDraftId,w.parent);assert.equal(s.inherited.originDraftId,w.parent);
 assert.equal(s.receipt.fingerprint,confirmed.receipt.fingerprint);assert.equal(s.source.draftId,kid);
 const proof=requireConfirmedSource(s,w.drafts.get(kid).brief);
 assert.equal(proof.inheritedFrom,w.parent);assert.equal(proof.confirmationFingerprint,confirmed.confirmation.fingerprint);assert.equal(proof.facts.physicalCount,1);
 const q=await w.service.quote(w.owner,kid);
 await assert.rejects(w.service.analyze(w.owner,kid,{requestId:randomUUID(),referenceFingerprint:q.source.referenceFingerprint,quoteFingerprint:q.fingerprint,maxCostUsd:q.maxCostUsd,confirmed:true}),/analysis_inherited/);
 assert.equal(w.reads,1);
});

test('inheritance follows a chain of edits back to the draft that paid, and stops when the photos differ',async()=>{
 const w=world();await w.confirmParent();
 const kid=w.child(w.parent),grandchild=w.child(kid);
 const s=await w.service.state(w.owner,grandchild);
 assert.equal(s.status,'confirmed');assert.equal(s.inherited.fromDraftId,kid);assert.equal(s.inherited.originDraftId,w.parent);
 assert.equal((await w.service.state(w.owner,w.child(w.parent,{sha:other}))).status,'not_started');
});

test('nothing is inherited from an unconfirmed parent, and a draft without a parent is unchanged',async()=>{
 const w=world(),kid=w.child(w.parent);
 assert.equal((await w.service.state(w.owner,kid)).status,'not_started');
 assert.equal((await w.service.state(w.owner,w.parent)).inherited,undefined);
});

test('the continuation proof of an inherited edit verifies the answers in the ledger of the run that paid',async()=>{
 const w=world(),confirmed=await w.confirmParent(),kid=w.child(w.parent),kidIds=sharedRunIdentity(kid),parentIds=sharedRunIdentity(w.parent),audit=new Set();
 const provider=[{category:'Sofa',pieces:[{label:'sofa',kind:'sofa',role:'product'}]},{total:1},{conflicts:[]}];
 const operations=NAMES.map((name,i)=>{const reader_response={schema:'a7-complete-answer-v1',node:name,answer:{content:[{text:JSON.stringify(provider[i])}]}};return {operation_key:'reader-'+i,client_run_id:parentIds.clientRunId,run_id:parentIds.runId,node_name:name,status:'completed',receipt_ref:'answer-'+i,reader_response,reader_response_sha256:createHash('sha256').update(canonical(reader_response)).digest('hex')};});
 const queried=[],bound=[];
 async function query(sql,args=[]){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.includes('SELECT brief,parent_id,note,direction FROM a7_job_versions WHERE id=$1 AND owner_id=$2')){const d=w.drafts.get(args[0]);return {rows:d&&args[1]===w.owner?[d]:[]};}
  if(sql.includes('FROM a7_job_versions WHERE id=$1 AND owner_id=$2'))return {rows:w.drafts.has(args[0])&&args[1]===w.owner?[{id:args[0]}]:[]};
  if(sql.includes('FROM a7_job_versions WHERE id=$1'))return {rows:[w.drafts.get(args[0])]};
  if(sql.includes('FROM a7_version_references'))return {rows:(w.refs.get(args[0])||[]).map(r=>({...r,blob_key:'synthetic',mime:'image/png',bytes:200}))};
  // The edit's budget row is opened at send with no run: nothing was paid under it yet (openBudget leaves run_id empty).
  if(sql.startsWith('UPDATE a7_owner_budgets SET run_id=$2')){bound.push(args);return {rows:[]};}
  if(sql.includes('FROM a7_owner_budgets')){queried.push(args[0]);return {rows:[{client_run_id:args[0],run_id:args[0]===kidIds.clientRunId?null:parentIds.runId,owner_id:w.owner,limit_micro_usd:5000000}]};}
  if(sql.includes('FROM a7_paid_operations'))return {rows:operations.filter(o=>o.client_run_id===args[0])};
  if(sql.includes('INSERT INTO a7_budget_audit')){if(audit.has(args[0]))return {rows:[]};audit.add(args[0]);return {rows:[{event_id:args[0]}]};}
  throw Error('unexpected_sql');
 }
 const pool={connect:async()=>({query,release:()=>{}}),query};
 const proof=await claimSourceContinuation(pool,w.store,{draftId:kid,requestId:randomUUID(),...kidIds,sourceSha256:product,receiptFingerprint:confirmed.receipt.fingerprint,confirmationFingerprint:confirmed.confirmation.fingerprint});
 assert.equal(proof.verified,true);assert.equal(proof.runId,kidIds.runId);assert.equal(proof.inheritedFrom,w.parent);assert.equal(proof.answers[NAMES[1]].total,1);
 assert.ok(queried.includes(parentIds.clientRunId),'answers are read from the paying run');assert.ok(queried.includes(kidIds.clientRunId),'the edit\'s own budget is still checked');
 // The proof binds the edit's own budget row to its run, as the first reservation would.
 assert.deepEqual(bound,[[kidIds.clientRunId,kidIds.runId]]);
});
