import {canonical,digest} from './a7-actions.mjs';
export const BLIND=Object.freeze({id:'owner-blind-replacement-20261018-1',clientId:'owner-c999d3d0-348b-4bf2-b9f2-0bf8383ac4e6',runId:'claude-a7-20261017230527-1i4fxz',imageSha256:'c497535b8aead663c003f016c01e81e3f574428169b1e70894d8943df4b83020',fileId:'1hvmFnJu7seIt6DRN0ks7qycIZzYDukCR',reviewSha256:'7a01272fdbc7a6de54f940dbfff818bcfd476dd59c9951af3aeabc1934944845',initialMicro:1812461,limitMicro:4739996,capMicro:100000,inputCap:20000,outputCap:1000});
export const blindKey='a7:blind-replacement:'+digest(BLIND.id);
export function validateBlindEvidence(input){
 const r=input?.row,v=input?.review;
 if(input?.recoveryId!==BLIND.id||r?.run_id!==BLIND.runId||r.client_run_id!==BLIND.clientId||r.status!=='hold'||r.go1_decision!=='go'||r.go2_decision||digest(canonical(v))!==BLIND.reviewSha256)throw Error('blind_evidence_mismatch');
 let s;try{s=JSON.parse(r.stage04);}catch{throw Error('blind_evidence_mismatch');}
 if(s.candidate?.sha256!==BLIND.imageSha256||s.candidate.drive_file_id!==BLIND.fileId||s.operation?.status!=='completed'||s.operation.attempt!==1||v.candidate?.sha256!==BLIND.imageSha256||v.result!=='not reviewed'||v.counts?.reviewer!==2||v.counts?.blind!==null)throw Error('blind_evidence_mismatch');
 return s;
}
export function validateBlindLedger(b,ops,allowCompleted=false){
 const original=ops.filter(o=>o.operation_key!==blindKey),replacement=ops.find(o=>o.operation_key===blindKey);
 const held=(node,cost)=>original.filter(o=>o.node_name===node&&o.status==='uncertain'&&Number(o.accounted_micro_usd)===cost&&Number(o.reserved_micro_usd)===cost).length===1;
 if(!b||b.client_run_id!==BLIND.clientId||b.run_id!==BLIND.runId||Number(b.limit_micro_usd)!==BLIND.limitMicro||original.length!==8||!held('03 Eye reads the product photo',846432)||!held('16x Blind count',816432)||!original.some(o=>o.node_name==='15g Send to Google'&&o.status==='completed'&&Number(o.accounted_micro_usd)===78042)||!original.some(o=>o.node_name==='16 Critic review'&&o.status==='completed'&&o.receipt_ref==='msg_011Cg8x1XCDuxhhnRXSGne6g')||original.reduce((s,o)=>s+Number(o.accounted_micro_usd),0)!==BLIND.initialMicro||(!allowCompleted&&replacement)||Number(b.committed_micro_usd)!==BLIND.initialMicro+Number(replacement?.accounted_micro_usd||0))throw Error('blind_ledger_mismatch');
 return replacement;
}
export async function blindContext(pool,input){
 validateBlindEvidence(input);
 const {rows:[b]}=await pool.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1',[BLIND.clientId]);
 const {rows:ops}=await pool.query('SELECT * FROM a7_paid_operations WHERE client_run_id=$1',[BLIND.clientId]);
 const op=validateBlindLedger(b,ops,true);
 const {rows:claims}=await pool.query("SELECT detail FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_replacement_requested'",[BLIND.clientId]);
 const checkpoint=claims.find(x=>x.detail.started===true)?.detail.checkpoint;
 if(!checkpoint?.brief||!checkpoint.cached_second)throw Error('blind_checkpoint_missing');
 if(op&&(!op.reader_response||op.status!=='completed'))throw Error('blind_outcome_uncertain');
 return {ready:true,recoveryId:BLIND.id,checkpoint,row:{...input.row,go1_token:'',go2_token:'',resume_url:''},review:input.review,preservedResponse:op?.reader_response||null,resend:false};
}
// Called under the same budget row lock as reserveCall; no extra budget is opened.
export async function authorizeBlindReservation(db,input,quote){
 if(input.blindRecoveryId!==BLIND.id||input.clientId!==BLIND.clientId||input.runId!==BLIND.runId||input.operationKey!==blindKey||input.node!=='16xb Blind count fallback (OpenAI)'||input.model!=='gpt-6.1-sol'||input.outputId!=='white_master'||input.imageSha256!==BLIND.imageSha256||input.reviewSha256!==BLIND.reviewSha256||input.inputBasis!=='provider_counted_exact_request'||input.countedRequestSha256!==input.requestSha256||input.inputTokens>BLIND.inputCap||input.outputTokens!==BLIND.outputCap||quote.reserve>BLIND.capMicro)throw Error('blind_scope_mismatch');
 const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1',[BLIND.clientId]);
 const {rows:ops}=await db.query('SELECT * FROM a7_paid_operations WHERE client_run_id=$1',[BLIND.clientId]);
 validateBlindLedger(b,ops);
}
export async function beginBlindContinuation(db,input){
 const c=await blindContext(db,input);
 if(!c.preservedResponse)throw Error('blind_response_missing');
 await db.query('SELECT client_run_id FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[BLIND.clientId]);
 const eventId=digest(BLIND.id+':continue').slice(0,8)+'-0000-4000-8000-'+digest(BLIND.id+':continue').slice(0,12);
 const {rows}=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,'blind_replacement_continuation','engine',$4) ON CONFLICT DO NOTHING RETURNING event_id",[eventId,BLIND.clientId,blindKey,JSON.stringify({imageSha256:BLIND.imageSha256,reviewSha256:BLIND.reviewSha256,ownerApprovedCapMicro:BLIND.capMicro})]);
 if(rows.length!==1)throw Error('blind_continuation_used');
 return c;
}
