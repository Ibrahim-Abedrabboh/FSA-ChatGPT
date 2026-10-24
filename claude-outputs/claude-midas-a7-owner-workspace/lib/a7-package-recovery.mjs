import {digest,canonical} from './a7-actions.mjs';
import {BLIND,validateBlindLedger} from './a7-blind-recovery.mjs';
export const PACKAGE=Object.freeze({id:'owner-package-recovery-20261018-1',reviewAt:'2026-10-18T03:18:53.293Z',approvalAt:'2026-10-18T03:20:22.587Z',committedMicro:1826296});
export function validatePackageEvidence(input){
 const {row:r,review:v,decision:d}=input||{};
 const fail=()=>{throw Error('package_evidence_mismatch');};
 if(input?.recoveryId!==PACKAGE.id||r?.run_id!==BLIND.runId||r.client_run_id!==BLIND.clientId||r.status!=='hold'||r.stage!=='06 Package'||r.go1_decision!=='go'||r.go2_decision!=='approve'||r.go2_at!==PACKAGE.approvalAt||v?.at!==PACKAGE.reviewAt||v.result!=='passed'||d?.by!=='owner'||d.decision!=='approve'||d.at!==r.go2_at||d.result!=='white_master_approved')fail();
 const s=JSON.parse(r.stage04),p=JSON.parse(r.package);
 if(s.candidate?.sha256!==BLIND.imageSha256||s.candidate.drive_file_id!==BLIND.fileId||v.candidate?.sha256!==BLIND.imageSha256||v.counts?.contract!==2||v.counts?.reviewer!==2||v.counts?.blind!==2||canonical(v.product_box_2d)!=='[170,56,842,955]'||v.defects?.length||v.unsure?.length||p.done||p.folder?.id||p.files?.some(f=>f.drive_file_id))fail();
 const rel=d.release;
 if(rel?.run_id!==r.run_id||rel.candidate_sha256!==BLIND.imageSha256||rel.output_id!=='white_master'||rel.contract_stamp!==r.contract_stamp||rel.review_bound!==true||rel.review_result!=='passed'||rel.at!==d.at)fail();
 return s;
}
// Allowlisted accounting only. Never export permits, provider requests or stored answers.
export function packageCostSummary(b,ops){
 const n=v=>{v=Number(v);if(!Number.isSafeInteger(v)||v<0)throw Error('package_ledger_mismatch');return v;};
 if(new Set(ops.map(o=>o.operation_key)).size!==ops.length||ops.some(o=>o.run_id!==b.run_id||o.client_run_id!==b.client_run_id))throw Error('package_ledger_mismatch');
 const calls=ops.map(o=>({operation_key:o.operation_key,node:o.node_name,model:o.model,output_id:o.output_id,status:o.status,reserved_micro_usd:n(o.reserved_micro_usd),accounted_micro_usd:n(o.accounted_micro_usd),usd:n(o.accounted_micro_usd)/1e6,basis:o.status==='completed'?'Retained usage × configured conservative rates; estimate, not invoice':'Uncertain charge: full reservation remains held; final charge unknown',usage:o.usage||null,receipt_ref:o.receipt_ref||''}));
 const held=calls.filter(o=>o.status!=='completed').reduce((s,o)=>s+o.accounted_micro_usd,0),total=calls.reduce((s,o)=>s+o.accounted_micro_usd,0),image=calls.filter(o=>o.node==='15g Send to Google'),text=calls.filter(o=>o.node!=='15g Send to Google'),sum=a=>a.reduce((s,o)=>s+o.accounted_micro_usd,0)/1e6;
 if(total!==n(b.committed_micro_usd)||total>n(b.limit_micro_usd))throw Error('package_ledger_mismatch');
 return {source:'A7 retained budget ledger',currency:'USD',image_calls:image.length,usd:sum(image),per_accepted_package_usd:sum(image),calls:image,text_calls:text.length,text_calls_priced:text.filter(o=>o.status==='completed').length,text_usd:sum(text),all_usd:total/1e6,known_accounted_usd:(total-held)/1e6,held_uncertain_usd:held/1e6,budget_limit_usd:n(b.limit_micro_usd)/1e6,available_usd:(n(b.limit_micro_usd)-total)/1e6,operation_count:calls.length,operations:calls,basis:'Complete retained job history, including earlier recovery calls and unchanged uncertain reservations. Conservative estimates plus held amounts, not an invoice.',text_basis:'Completed historical text/vision calls plus held uncertain calls; held charges are unknown, never zero.',new_packaging_paid_usd:0};
}
export async function packageContext(pool,input){
 validatePackageEvidence(input);
 const {rows:[b]}=await pool.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1',[BLIND.clientId]);
 const {rows:ops}=await pool.query('SELECT * FROM a7_paid_operations WHERE client_run_id=$1',[BLIND.clientId]);
 const replacement=validateBlindLedger(b,ops,true);
 if(replacement?.status!=='completed'||Number(replacement.accounted_micro_usd)!==13835||Number(b.committed_micro_usd)!==PACKAGE.committedMicro)throw Error('package_ledger_mismatch');
 const {rows:claims}=await pool.query("SELECT detail FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_replacement_requested'",[BLIND.clientId]);
 const checkpoint=claims.find(x=>x.detail.started===true)?.detail.checkpoint;
 if(!checkpoint?.brief||checkpoint.brief.outputs?.some(o=>o.id!=='white_master'))throw Error('package_checkpoint_mismatch');
 return {ready:true,recoveryId:PACKAGE.id,row:{...input.row,go1_token:'',go2_token:'',resume_url:''},review:input.review,decision:input.decision,brief:checkpoint.brief,cost:packageCostSummary(b,ops),paidCalls:0};
}
export async function beginPackageContinuation(db,input){
 await db.query('SELECT client_run_id FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[BLIND.clientId]);
 const context=await packageContext(db,input),hash=digest(PACKAGE.id),eventId=hash.slice(0,8)+'-0000-4000-8000-'+hash.slice(0,12);
 const {rows}=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,event,actor,detail) VALUES($1,$2,'package_recovery_continuation','engine',$3) ON CONFLICT DO NOTHING RETURNING event_id",[eventId,BLIND.clientId,JSON.stringify({masterSha256:BLIND.imageSha256,approvalAt:PACKAGE.approvalAt,evidenceSha256:digest(canonical(input)),paidCalls:0,heldMicro:1662864})]);
 if(rows.length!==1)throw Error('package_continuation_used');
 return context;
}
