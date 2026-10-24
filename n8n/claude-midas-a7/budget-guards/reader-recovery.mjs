// Reconstruct only the existing pre-approval white-master checkpoint. No supplied
// observations, contract, approval or count can override the persisted evidence.
export function restoreReaderCheckpoint(request,rows,events,sourceSha256,sourceKey){
 const r=request.recovery;
 if(!r||r.clientId!==request.clientRunId||!/^owner-[a-f0-9-]{36}$/.test(r.clientId||'')||!/^claude-a7-[a-zA-Z0-9-]+$/.test(r.runId||'')||!/^[a-f0-9-]{36}$/.test(r.requestId||''))throw Error('invalid_recovery');
 const matches=rows.filter(x=>x.run_id===r.runId&&x.client_run_id===r.clientId);
 if(matches.length!==1)throw Error('ambiguous_recovery_run');
 const row=matches[0],parse=s=>{try{return JSON.parse(s)}catch{throw Error('recovery_checkpoint_invalid')}};
 const obs=parse(row.observation),refs=parse(row.references);
 if(row.status!=='hold'||row.stage!=='01 Intake & observe'||row.contract_stamp||row.stage04||obs.count_eye!==null||!Number.isSafeInteger(obs.count_second)||obs.count_second<1)throw Error('recovery_not_available');
 const own=events.filter(e=>e.run_id===r.runId&&e.client_run_id===r.clientId);
 const briefs=own.filter(e=>e.kind==='brief').map(e=>parse(e.payload));
 if(briefs.length!==1)throw Error('recovery_brief_ambiguous');
 const brief=briefs[0];
 if(brief.outcomes?.length!==1||brief.outcomes[0]!=='white_bk'||brief.outputs?.length!==1||brief.outputs[0].id!=='white_master'||brief.parent_run_id||refs.length!==1||refs[0].role!=='product'||refs[0].sha256!==sourceSha256||r.sourceSha256!==sourceSha256)throw Error('recovery_scope_or_source_changed');
 const calls=own.filter(e=>e.kind==='text_call').map(e=>parse(e.payload));
 if(calls.length!==2||!calls.some(c=>c.node==='03 Eye reads the product photo'&&c.error&&!c.tokens)||!calls.some(c=>c.node==='05 Second count'&&!c.error&&c.tokens?.input>0))throw Error('recovery_receipts_invalid');
 const rawRefs=own.filter(e=>e.kind==='reference').map(e=>parse(e.payload));
 if(rawRefs.length!==1||rawRefs[0].sha256!==sourceSha256)throw Error('recovery_reference_invalid');
 return {guidance_required:true,run_id:row.run_id,client_run_id:row.client_run_id,parent_run_id:'',brief,received_at:row.received_at,
  usable:'ok',problems:[],not_applied:parse(row.not_applied||'[]'),
  references:[{...rawRefs[0],key:sourceKey,stored:'Original saved privately by owner workspace; hash verified for recovery'}],product_key:sourceKey,room_key:'',written_files:[],
  reader_recovery:true,recovery_request:r,
  cached_second:{total:obs.count_second,unclear:obs.unclear_second||[],relations:obs.relations_second||[],cropped:obs.cropped===true,hidden:obs.hidden||[]},
  text_calls:calls,text_calls_new:[],
  text_prices:{read_on:'2026-10-18',currency:'USD per million tokens',models:{'gemini-3.8-flash':{input:.75,output:3.75},'claude-sonnet-5-5':{input:2,output:10},'gpt-6.1-sol':{input:4,output:15},'gpt-6-luna':{input:.2,output:.75}}},
  trail:[...parse(row.trail||'[]'),{step:3,name:'Owner reader recovery',at:new Date().toISOString(),note:'Same job and original source; reuse recorded independent count. Primary uncertain call retained, never resent. Use the previously unused fallback once.'}]};
}

export function countedReaderInput(response,bodySha256){
 if(response?.statusCode!==200||response.body?.object!=='response.input_tokens'||!Number.isSafeInteger(response.body.input_tokens)||response.body.input_tokens<1||response.body.input_tokens>1049550||!/^[a-f0-9]{64}$/.test(bodySha256||''))throw Error('reader_input_count_unavailable');
 // Extra headroom is reserved, while the provider's exact immutable input is sent.
 return {inputTokens:response.body.input_tokens+450,inputBasis:'provider_counted_exact_request',countedRequestSha256:bodySha256};
}
