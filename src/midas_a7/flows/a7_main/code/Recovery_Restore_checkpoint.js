function replacementCheckpoint(state,briefSha256,approved){
 if(!state.recovery_request?.replacementId)return state;
 if(state.recovery_request.replacementId!==approved.id||state.run_id!==approved.runId||state.client_run_id!==approved.clientId||state.references.length!==1||state.references[0].sha256!==approved.sourceSha256||briefSha256!==approved.briefSha256||state.cached_second?.total!==2||state.room_key||state.brief.outcomes?.length!==1||state.brief.outcomes[0]!=='white_bk'||state.brief.outputs?.length!==1||state.brief.outputs[0].id!=='white_master')throw Error('recovery_replacement_scope_changed');
 const checkpoint={brief:state.brief,cached_second:state.cached_second,references:state.references,trail:state.trail,received_at:state.received_at,not_applied:state.not_applied};
 return {...state,reader_replacement:{id:approved.id},recovery_request:{...state.recovery_request,briefSha256,checkpoint},trail:[...state.trail,{step:3,name:'Approved replacement reader',at:new Date().toISOString(),note:'One intentional additional OpenAI reading; prior answer unavailable. Original completed receipts retained. Reuse count 2; uncertain primary call stays held. No automatic resend.'}]};
}
try{
function restoreReaderCheckpoint(request,rows,events,sourceSha256,sourceKey){
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
const it=$('Recovery · Request').first(),key=Object.keys(it.binary)[0];const sha=it.json.verifiedSourceSha256;if(!/^[a-f0-9]{64}$/.test(sha||''))throw Error('recovery_source_unverified');const state=restoreReaderCheckpoint(it.json,$('Recovery · Read run').all().map(x=>x.json),$input.all().map(x=>x.json),sha,key);const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);const briefSha256=require('crypto').createHash('sha256').update(canonical(state.brief)).digest('hex');const replaced=replacementCheckpoint(state,briefSha256,{"id":"owner-reader-replacement-20261018-1","clientId":"owner-c999d3d0-348b-4bf2-b9f2-0bf8383ac4e6","runId":"claude-a7-20261017230527-1i4fxz","sourceSha256":"0936aa534965b928ef6a30f014f068c30fe91f2345e42983945212c3833c06b3","briefSha256":"feacf0e97918253891c4237508179f3e8b1e2a2d2130884efb1fb38ae4c61520","oldResponseId":"resp_0fa50fcd9c503b1c016ad423d1c9d887d281f0ee7a07ecd510","additionalMicro":3872506,"readerMicro":250000,"committedMicro":867490,"limitMicro":4739996});return [{json:replaced,binary:it.binary}];
}catch(error){const code=String(error.message||'');return [{json:{recovery_error:/^(?:recovery_[a-z_]+|invalid_recovery|ambiguous_recovery_run)$/.test(code)?code:'recovery_input_unavailable',failed_node:"Recovery · Restore checkpoint"}}];}