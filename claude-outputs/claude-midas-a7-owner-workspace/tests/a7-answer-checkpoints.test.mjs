import {probeBudget} from '../lib/a7-budget-probe.mjs';
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';import {getDatabase} from '@netlify/database';
import {normalizeAnswer,ANSWER_NODES,readAnswerCheckpoint} from '../lib/a7-answer-checkpoints.mjs';
import {openBudget,reserveCall,settleCall,readBudget,RATES,CALL_POLICY} from '../lib/a7-budget.mjs';
const local=new NetlifyDB(),owner=randomUUID();let pool;
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;});
after(async()=>{await pool?.end();await local.stop();});
const image=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(100,90)]);
export function answer(kind){
 const common={headers:{authorization:'DO_NOT_KEEP'},request_photo:'DO_NOT_KEEP',instructions:'DO_NOT_KEEP',input:[{image:'DO_NOT_KEEP'}]};
 if(kind==='gemini')return {...common,candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'{"complete":"synthetic"}',thoughtSignature:'DO_NOT_KEEP'}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,thoughtsTokenCount:0}};
 if(kind==='anthropic')return {...common,id:'synthetic-receipt',stop_reason:'end_turn',content:[{type:'thinking',thinking:'DO_NOT_KEEP'},{type:'text',text:'{"complete":"synthetic"}'}],usage:{input_tokens:10,output_tokens:20}};
 if(kind==='openai')return {...common,id:'synthetic-receipt',status:'completed',output:[{type:'reasoning',summary:['DO_NOT_KEEP']},{type:'message',content:[{type:'output_text',text:{complete:'synthetic'}}]}],usage:{input_tokens:10,output_tokens:20}};
 return {...common,id:'synthetic-receipt',status:'completed',steps:[{type:'thought',content:[{text:'DO_NOT_KEEP'}]},{type:'model_output',content:[{type:'text',text:'complete synthetic image'},{type:'image',data:image.toString('base64'),mime_type:'image/png'}]}],usage:{total_input_tokens:10,total_output_tokens:20,total_thought_tokens:0}};
}
function store(){const blobs=new Map();return {blobs,async set(k,b){if(!blobs.has(k))blobs.set(k,Buffer.from(b));},async get(k){return blobs.get(k)||null;}};}
async function reserved(node){const client='owner-'+randomUUID();await openBudget(pool,{clientId:client,ownerId:owner,limitUsd:5});const [model,cap]=CALL_POLICY[node],request={clientId:client,runId:'synthetic-run',operationKey:'checkpoint:'+randomUUID(),node,model,outputId:node.startsWith('15')||node.startsWith('16')?'white_master':'job',requestSha256:'a'.repeat(64),inputTokens:RATES[model].inputLimit,outputTokens:cap};const permit=await reserveCall(pool,request);assert.equal(permit.send,true);return {clientId:client,operationKey:request.operationKey,permit:permit.permit,request,reservedMicro:permit.reservedMicroUsd};}
for(const [node,kind] of Object.entries(ANSWER_NODES))test(node+': durable complete answer, private reread and duplicate denial',async()=>{
 const s=await reserved(node),raw=answer(kind),usage={input:10,output:20},storage=store(),input={...s,receiptRef:raw.id||'',usage,completeAnswer:raw};
 assert.equal((await settleCall(pool,input,storage)).responsePreserved,true);
 const read=await readAnswerCheckpoint(pool,storage,s);assert.equal(read.preserved,true);assert.equal(read.resend,false);assert.equal(read.response.node,node);assert.doesNotMatch(JSON.stringify(read),/DO_NOT_KEEP/);
 if(kind==='image'){assert.equal(storage.blobs.size,1);assert.deepEqual(Buffer.from(read.response.answer.steps[0].content[1].data,'base64'),image);}
 const expected=Math.ceil(usage.input*RATES[s.request.model].input+usage.output*RATES[s.request.model].output);assert.equal(Number((await readBudget(pool,owner,s.clientId)).budget.committed_micro_usd),expected);
 assert.equal((await settleCall(pool,input,storage)).responsePreserved,true);assert.equal((await reserveCall(pool,s.request)).send,false);
 await assert.rejects(readAnswerCheckpoint(pool,storage,{...s,permit:randomUUID()}),/operation_mismatch/);
 const changed=answer(kind);if(kind==='openai')changed.output[1].content[0].text={complete:'changed'};else if(kind==='gemini')changed.candidates[0].content.parts[0].text='changed';else if(kind==='anthropic')changed.content[1].text='changed';else changed.steps[1].content[0].text='changed';
 await assert.rejects(settleCall(pool,{...input,completeAnswer:changed},storage),/reader_response_conflict/);
 assert.equal((await readBudget(pool,owner,s.clientId)).operations[0].reader_response,undefined);
});
test('lost usage keeps full reservation while preserving a complete answer; no automatic resend',async()=>{
 const s=await reserved('06 Room reader'),raw=answer('gemini');delete raw.usageMetadata;
 const result=await settleCall(pool,{...s,receiptRef:'',usage:null,completeAnswer:raw});assert.equal(result.status,'uncertain');assert.equal(result.responsePreserved,true);
 const read=await readAnswerCheckpoint(pool,store(),s);assert.equal(read.preserved,true);assert.equal(read.status,'uncertain');assert.equal(read.response.usage,null);assert.equal(read.resend,false);
 assert.equal(Number((await readBudget(pool,owner,s.clientId)).budget.committed_micro_usd),s.reservedMicro);assert.equal((await reserveCall(pool,s.request)).send,false);
});
test('incomplete, empty, mismatched usage and oversized answers never settle',async()=>{
 const s=await reserved('11 Stylist plans the scenes'),raw=answer('openai'),input={...s,receiptRef:raw.id,usage:{input:10,output:20}};
 for(const v of [{...raw,status:'incomplete'},{...raw,output:[]},{...raw,usage:{input_tokens:11,output_tokens:20}},{...raw,output:[{type:'message',content:[{type:'output_text',text:'x'.repeat(140000)}]}]}])await assert.rejects(settleCall(pool,{...input,completeAnswer:v}));
 const before=await readBudget(pool,owner,s.clientId);assert.equal(before.operations[0].status,'reserved');assert.equal(Number(before.budget.committed_micro_usd),s.reservedMicro);
});
test('image persistence failure and corrupt or missing readback retain the whole reservation',async()=>{
 const s=await reserved('15g Send to Google'),raw=answer('image'),input={...s,receiptRef:raw.id,usage:{input:10,output:20},completeAnswer:raw};
 await assert.rejects(settleCall(pool,input,{set:async()=>{},get:async()=>null}),/answer_storage_unverified/);
 assert.equal((await readBudget(pool,owner,s.clientId)).operations[0].status,'reserved');
 const storage=store();await settleCall(pool,input,storage);storage.blobs.clear();await assert.rejects(readAnswerCheckpoint(pool,storage,s),/answer_storage_unverified/);
});
test('SQL checkpoint failure rolls back settlement and prevents duplicate send',async()=>{
 const s=await reserved('16 Critic review'),raw=answer('anthropic'),dbPool={connect:async()=>{const db=await pool.connect();return {release:()=>db.release(),query:(sql,args)=>{if(sql.startsWith('UPDATE a7_paid_operations'))throw Error('synthetic_sql_failure');return db.query(sql,args);}};}};
 await assert.rejects(settleCall(dbPool,{...s,receiptRef:raw.id,usage:{input:10,output:20},completeAnswer:raw}),/synthetic_sql_failure/);
 const record=await readBudget(pool,owner,s.clientId);assert.equal(record.operations[0].status,'reserved');assert.equal(Number(record.budget.committed_micro_usd),s.reservedMicro);assert.equal((await reserveCall(pool,s.request)).send,false);
});

test('synthetic deployed probe covers every branch and removes all temporary records and media',async()=>{const storage=store();storage.delete=async key=>storage.blobs.delete(key);const result=await probeBudget(pool,storage);assert.equal(result.verified,true);assert.equal(result.paidCalls,0);assert.equal(result.rolledBack,true);assert.equal(result.checkpointNodes.length,11);assert.equal(result.syntheticMediaDeleted,1);assert.equal(storage.blobs.size,0);});
