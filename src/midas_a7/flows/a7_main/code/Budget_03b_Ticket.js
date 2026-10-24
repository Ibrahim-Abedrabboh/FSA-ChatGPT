function operationSlot(state,nodeName,input={}) {
 const stage04=input.s04||state.stage04||{};
 const current=state.scenes?.current||{};
 const output=input.rv?.output_id||stage04.dispatch?.output_id||stage04.operation?.output_id||current.output_id||'job';
 const slot={client:state.client_run_id,run:state.run_id,node:nodeName,output,
  attempt:input.rv?.attempt??stage04.dispatch?.attempt??stage04.operation?.attempt??current.attempt??0,
  phase:current.phase||'',go1:state.go1_rounds||0,go2:state.go2_round||0,
  plan:state.plan_round||0,rewrite:state.rewrites_used||0,review:state.review_again_count||0};
 if(!/^owner-[a-f0-9-]{36}$/.test(slot.client||'')||!slot.run||typeof slot.run!=='string')throw Error('budget_identity_missing');
 // Slot identity intentionally excludes the request hash. A changed request in the
 // same slot must conflict, rather than obtain another permission to spend.
 return slot;
}
function countedReaderInput(response,bodySha256){
 if(response?.statusCode!==200||response.body?.object!=='response.input_tokens'||!Number.isSafeInteger(response.body.input_tokens)||response.body.input_tokens<1||response.body.input_tokens>1049550||!/^[a-f0-9]{64}$/.test(bodySha256||''))throw Error('reader_input_count_unavailable');
 // Extra headroom is reserved, while the provider's exact immutable input is sent.
 return {inputTokens:response.body.input_tokens+450,inputBasis:'provider_counted_exact_request',countedRequestSha256:bodySha256};
}
const t=$('Recovery · Fallback request').first();const crypto=require('crypto');const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);const sha=v=>crypto.createHash('sha256').update(v).digest('hex');const requestSha256=sha(canonical(t.json.body));const counted=countedReaderInput($input.first().json,requestSha256);const state=t.json.state,slot=operationSlot(state,'03b Eye fallback (OpenAI)',state);const budgetRequest={clientId:state.client_run_id,runId:state.run_id,operationKey:'a7:'+sha(canonical(slot)),node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',outputId:slot.output,outputTokens:16000,requestSha256,...counted};if(state.reader_replacement){if(state.reader_replacement.id!=="owner-reader-replacement-20261018-1"||counted.inputTokens>2500)throw Error('replacement_reader_limit');budgetRequest.replacementId=state.reader_replacement.id;budgetRequest.operationKey="a7:replacement:f97ec4b8aea426774a7120c168ee20c888e4a1ab1a60cac3528804b8d8953ffb";}return [{json:{budgetRequest,state,original:{...state,__readerBody:t.json.body}},binary:t.binary}];