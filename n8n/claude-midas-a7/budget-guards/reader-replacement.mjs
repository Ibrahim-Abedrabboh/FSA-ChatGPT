import {REPLACEMENT,replacementKey} from '../../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-reader-replacement.mjs';
export function replacementCheckpoint(state,briefSha256,approved){
 if(!state.recovery_request?.replacementId)return state;
 if(state.recovery_request.replacementId!==approved.id||state.run_id!==approved.runId||state.client_run_id!==approved.clientId||state.references.length!==1||state.references[0].sha256!==approved.sourceSha256||briefSha256!==approved.briefSha256||state.cached_second?.total!==2||state.room_key||state.brief.outcomes?.length!==1||state.brief.outcomes[0]!=='white_bk'||state.brief.outputs?.length!==1||state.brief.outputs[0].id!=='white_master')throw Error('recovery_replacement_scope_changed');
 const checkpoint={brief:state.brief,cached_second:state.cached_second,references:state.references,trail:state.trail,received_at:state.received_at,not_applied:state.not_applied};
 return {...state,reader_replacement:{id:approved.id},recovery_request:{...state.recovery_request,briefSha256,checkpoint},trail:[...state.trail,{step:3,name:'Approved replacement reader',at:new Date().toISOString(),note:'One intentional additional OpenAI reading; prior answer unavailable. Original completed receipts retained. Reuse count 2; uncertain primary call stays held. No automatic resend.'}]};
}
export function installReaderReplacement(source){
 const w=structuredClone(source),find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('missing_node:'+name);return n;};
 const restore=find('Recovery · Restore checkpoint');
 if(restore.parameters.jsCode.includes('replacementCheckpoint('))throw Error('replacement_already_installed');
 const needle='return [{json:state,binary:it.binary}];';
 if(!restore.parameters.jsCode.includes(needle))throw Error('checkpoint_source_changed');
 restore.parameters.jsCode=replacementCheckpoint.toString()+'\n'+restore.parameters.jsCode.replace(needle,`const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);const briefSha256=require('crypto').createHash('sha256').update(canonical(state.brief)).digest('hex');const replaced=replacementCheckpoint(state,briefSha256,${JSON.stringify(REPLACEMENT)});return [{json:replaced,binary:it.binary}];`);
 const ticket=find('Budget · 03b · Ticket');
 if(!ticket.parameters.jsCode.includes('return [{json:{budgetRequest,state,'))throw Error('reader_ticket_changed');
 ticket.parameters.jsCode=ticket.parameters.jsCode.replace('return [{json:{budgetRequest,state,',`if(state.reader_replacement){if(state.reader_replacement.id!==${JSON.stringify(REPLACEMENT.id)}||counted.inputTokens>2500)throw Error('replacement_reader_limit');budgetRequest.replacementId=state.reader_replacement.id;budgetRequest.operationKey=${JSON.stringify(replacementKey)};}return [{json:{budgetRequest,state,`);
 const granted=find('Recovery · Granted');
 granted.parameters.jsCode=granted.parameters.jsCode.replace('return [{json:t.json,binary:t.binary}];',"if(t.json.reader_replacement&&r.body.replacementId!==t.json.reader_replacement.id)throw Error('replacement_grant_mismatch');return [{json:t.json,binary:t.binary}];");
 return w;
}
