import {ANSWER_NODES,readAnswerCheckpoint} from './a7-answer-checkpoints.mjs';
import {randomUUID} from 'node:crypto';
import {openBudget,reserveCall,settleCall,readBudget,readReaderResponse,quoteCall,CALL_POLICY,RATES} from './a7-budget.mjs';
// Exercise deployed SQL/accounting without a provider and without leaving fake
// charges in the live ledger. Every write is inside one rolled-back transaction.
export async function probeBudget(pool,answerStore) {
 const ownerId=randomUUID(),clientId='owner-'+randomUUID(),client=await pool.connect();
 const check=(value,name)=>{if(!value)throw Error('budget_probe_failed:'+name);};
 const request=slot=>({clientId,runId:'diagnostic-no-provider',operationKey:'diagnostic:'+clientId+':'+slot,node:'16 Critic review',model:'claude-sonnet-5-5',outputId:'diagnostic',requestSha256:'a'.repeat(64),inputTokens:1048576,outputTokens:4000});
 const nested={connect:async()=>{const name='probe_'+randomUUID().replaceAll('-','');return {query:async(sql,args)=>{
  if(sql==='BEGIN')return client.query('SAVEPOINT '+name);
  if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT '+name);
  if(sql==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT '+name);return client.query('RELEASE SAVEPOINT '+name);}
  return client.query(sql,args);
 },release(){}};},query:(...args)=>client.query(...args)};
 const mediaKeys=new Set();const store=answerStore?{set:async(k,b,o)=>{mediaKeys.add(k);return answerStore.set(k,b,o);},get:(...args)=>answerStore.get(...args)}:undefined;
 let result;
 try {
  await client.query('BEGIN');
  await openBudget(nested,{clientId,ownerId,limitUsd:5});
  const one=await reserveCall(nested,request('one')),two=await reserveCall(nested,request('two'));
  check(one.send&&two.send,'reservation');
  check((await reserveCall(nested,request('one'))).send===false,'duplicate');
  check((await reserveCall(nested,request('three'))).reason==='budget_limit','limit');
  const receipt={clientId,operationKey:request('one').operationKey,permit:one.permit,usage:{input:1000,output:500},receiptRef:'diagnostic-synthetic-not-provider'};
  check((await settleCall(nested,receipt)).accountedMicroUsd===7000,'settlement');
  await settleCall(nested,receipt);
  await settleCall(nested,{clientId,operationKey:request('two').operationKey,permit:two.permit,usage:null});
  const ledger=await readBudget(nested,ownerId,clientId);
  check(Number(ledger.budget.committed_micro_usd)===7000+quoteCall(request('two')).reserve,'uncertain_retained');
  check(ledger.operations.find(o=>o.operation_key===request('two').operationKey)?.status==='uncertain','uncertain_status');
  check((await reserveCall(nested,request('two'))).send===false,'uncertain_no_resend');
  const reader={...request('reader'),node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',inputTokens:1000,outputTokens:16000,inputBasis:'provider_counted_exact_request',countedRequestSha256:'a'.repeat(64)};
  const rp=await reserveCall(nested,reader),usage={input:676,output:986};
  check(rp.send,'reader_reserved');
  const answer={id:'resp_synthetic_rollback_probe',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'synthetic checkpoint; not a product observation'}]}],usage:{input_tokens:676,output_tokens:986}};
  const rr={clientId,operationKey:reader.operationKey,permit:rp.permit,usage,receiptRef:answer.id,readerResponse:answer};
  check((await settleCall(nested,rr)).responsePreserved===true,'reader_response_preserved');
  const saved=await readReaderResponse(nested,rr);check(saved.preserved&&saved.response.output[0].content[0].text===answer.output[0].content[0].text&&saved.resend===false,'reader_response_readback');
  const checkpointNodes=[];
  if(store)for(const [node,kind] of Object.entries(ANSWER_NODES)){
   const [model,outputTokens]=CALL_POLICY[node];
   const checkpointClient='owner-'+randomUUID();await openBudget(nested,{clientId:checkpointClient,ownerId,limitUsd:5});
   const req={...request('checkpoint-'+checkpointNodes.length),clientId:checkpointClient,node,model,inputTokens:RATES[model].inputLimit,outputTokens};
   const permit=await reserveCall(nested,req);check(permit.send,'checkpoint_reserve');
   const text='Synthetic checkpoint diagnostic; not a product observation';
   const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64');
   const answer=kind==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,thoughtsTokenCount:0}}:
    kind==='anthropic'?{id:'synthetic',stop_reason:'end_turn',content:[{type:'text',text}],usage:{input_tokens:10,output_tokens:20}}:
    kind==='openai'?{id:'synthetic',status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:10,output_tokens:20}}:
    {id:'synthetic',status:'completed',steps:[{type:'model_output',content:[{type:'image',data:image.toString('base64'),mime_type:'image/png'}]}],usage:{total_input_tokens:10,total_output_tokens:20,total_thought_tokens:0}};
   const settlement={clientId:checkpointClient,operationKey:req.operationKey,permit:permit.permit,usage:{input:10,output:20},receiptRef:answer.id||'',checkpointRequired:true,completeAnswer:answer};
   check((await settleCall(nested,settlement,store)).responsePreserved===true,'complete_checkpoint');
   const saved=await readAnswerCheckpoint(nested,store,settlement);check(saved.preserved&&saved.resend===false,'complete_readback');
   if(kind==='image')check(saved.response.answer.steps[0].content[0].data===image.toString('base64'),'image_hash_readback');
   check((await reserveCall(nested,req)).send===false,'complete_no_resend');checkpointNodes.push(node);
  }
  result={checkpointNodes,verified:true,paidCalls:0,synthetic:true,checks:['reservation','duplicate_denied','limit_denied','settlement','idempotent_settlement','uncertain_reservation_retained','uncertain_resend_denied','reader_response_transaction_and_readback']};
 }finally{try{await client.query('ROLLBACK');}finally{client.release();for(const key of mediaKeys)await answerStore.delete(key);}}
 const {rows:[remaining]}=await pool.query('SELECT count(*) AS count FROM a7_owner_budgets WHERE owner_id=$1',[ownerId]);
 check(Number(remaining.count)===0,'rollback');
 for(const key of mediaKeys)check(await answerStore.get(key)===null,'synthetic_media_cleanup');
 return {...result,rolledBack:true,syntheticMediaDeleted:mediaKeys.size};
}
