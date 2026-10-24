import {randomUUID,createHash} from 'node:crypto';
import {transaction,readBudget,usdToMicro} from './a7-budget.mjs';
const claimId=client=>{const h=createHash('sha256').update('a7-reader-recovery:'+client).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);};

export function readerRecoveryEligibility(ledger,status){
 const ops=ledger.operations||[];
 const eye=ops.filter(x=>x.node_name==='03 Eye reads the product photo');
 const second=ops.filter(x=>x.node_name==='05 Second count');
 return status==='hold'&&eye.length===1&&eye[0].status==='uncertain'&&
  second.length===1&&second[0].status==='completed'&&
  ops.length===2&&Number(ledger.budget.committed_micro_usd)<Number(ledger.budget.limit_micro_usd);
}
export async function prepareReaderRecovery(pool,ownerId,clientId,runId,status,input){
 if(!input||input.confirmed!==true||!/^[a-f0-9-]{36}$/.test(input.requestId||'')||!/^[a-f0-9]{64}$/.test(input.revision||'')||!/^[a-f0-9]{64}$/.test(input.sourceSha256||''))throw Error('invalid_recovery');
 const extra=usdToMicro(input.additionalBudgetUsd);if(extra<250000)throw Error('invalid_recovery');
 const ledger=await readBudget(pool,ownerId,clientId);
 if(ledger.budget.run_id!==runId||!readerRecoveryEligibility(ledger,status))throw Error('recovery_not_available');
 return transaction(pool,async db=>{
  const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2 FOR UPDATE',[clientId,ownerId]);
  const {rows:prior}=await db.query("SELECT event_id FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_requested'",[clientId]);
  if(prior.length)throw Error('recovery_already_requested');
  const limit=Math.min(Number(b.limit_micro_usd),Number(b.committed_micro_usd)+extra);
  const detail={requestId:input.requestId,runId,revision:input.revision,sourceSha256:input.sourceSha256,started:false,limitMicroUsd:limit,route:'unused_openai_reader_only'};
  const inserted=await db.query('INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id',[claimId(clientId),clientId,'reader-recovery','reader_recovery_requested',ownerId,JSON.stringify(detail)]);
  if(inserted.rows.length!==1)throw Error('recovery_already_requested');
  await db.query('UPDATE a7_owner_budgets SET limit_micro_usd=$2,updated_at=now() WHERE client_run_id=$1',[clientId,limit]);
  return {requestId:input.requestId,runId,clientId,sourceSha256:input.sourceSha256};
 });
}
export async function beginReaderRecovery(pool,input){
 if(!input||!/^[a-f0-9-]{36}$/.test(input.requestId||'')||!/^owner-[a-f0-9-]{36}$/.test(input.clientId||''))throw Error('invalid_recovery');
 return transaction(pool,async db=>{
  await db.query('SELECT client_run_id FROM a7_owner_budgets WHERE client_run_id=$1 FOR UPDATE',[input.clientId]);
  const {rows:[a]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_recovery_requested' FOR UPDATE",[claimId(input.clientId),input.clientId]);
  if(!a||a.detail.requestId!==input.requestId||a.detail.started||a.detail.runId!==input.runId||a.detail.sourceSha256!==input.sourceSha256)throw Error('recovery_not_available');
  const {rows:ops}=await db.query('SELECT node_name,status FROM a7_paid_operations WHERE client_run_id=$1',[input.clientId]);
  if(ops.length!==2||!ops.some(o=>o.node_name==='03 Eye reads the product photo'&&o.status==='uncertain')||!ops.some(o=>o.node_name==='05 Second count'&&o.status==='completed'))throw Error('recovery_not_available');
  const started=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id",[claimId('start:'+input.clientId),input.clientId,'reader-recovery','reader_recovery_started','engine',JSON.stringify({requestId:input.requestId,runId:input.runId})]);
  if(started.rows.length!==1)throw Error('recovery_not_available');
  const consumed=await db.query("UPDATE a7_budget_audit SET detail=$2 WHERE event_id=$1 AND detail->>'started'='false' RETURNING event_id",[claimId(input.clientId),JSON.stringify({...a.detail,started:true,startedAt:new Date().toISOString()})]);
  if(consumed.rows.length!==1)throw Error('recovery_not_available');
  return {allowed:true,runId:input.runId,clientId:input.clientId};
 });
}
export async function resumePendingReaderRecovery(pool,ownerId,clientId,runId,status,input){
 const transportRepair=input?.transportRepair===true,bridgeRepair=input?.bridgeRepair===true,receiptRepair=input?.receiptRepair===true,bufferedRepair=input?.bufferedRepair===true,routeRepair=input?.routeRepair===true;
 if(input?.confirmed!==true||!/^[a-f0-9]{64}$/.test(input.revision||'')||!/^[a-f0-9]{64}$/.test(input.sourceSha256||''))throw Error('invalid_recovery');
 const extra=usdToMicro(input.additionalBudgetUsd);if(extra<250000||extra>3890000)throw Error('invalid_recovery');
 const ledger=await readBudget(pool,ownerId,clientId);
 if(ledger.budget.run_id!==runId||!readerRecoveryEligibility(ledger,status))throw Error('recovery_not_available');
 return transaction(pool,async db=>{
  const {rows:[b]}=await db.query('SELECT * FROM a7_owner_budgets WHERE client_run_id=$1 AND owner_id=$2 FOR UPDATE',[clientId,ownerId]);
  const {rows:[a]}=await db.query("SELECT detail FROM a7_budget_audit WHERE event_id=$1 AND client_run_id=$2 AND event='reader_recovery_requested' FOR UPDATE",[claimId(clientId),clientId]);
  const d=a?.detail;
  if(!b||!d||d.started!==false||(routeRepair?d.routeRepairDispatched===true:bufferedRepair?d.bufferedRepairDispatched===true:receiptRepair?d.receiptRepairDispatched===true:bridgeRepair?d.bridgeRepairDispatched===true:transportRepair?d.transportRepairDispatched===true:d.redispatched===true)||d.runId!==runId||d.revision!==input.revision||d.sourceSha256!==input.sourceSha256)throw Error('recovery_not_available');
  const {rows:starts}=await db.query("SELECT event_id FROM a7_budget_audit WHERE client_run_id=$1 AND event='reader_recovery_started'",[clientId]);
  if(starts.length)throw Error('recovery_not_available');
  const {rows:ops}=await db.query('SELECT node_name,status FROM a7_paid_operations WHERE client_run_id=$1',[clientId]);
  if(ops.length!==2||!ops.some(o=>o.node_name==='03 Eye reads the product photo'&&o.status==='uncertain')||!ops.some(o=>o.node_name==='05 Second count'&&o.status==='completed'))throw Error('recovery_not_available');
  const dispatch=await db.query("INSERT INTO a7_budget_audit(event_id,client_run_id,operation_key,event,actor,detail) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id",[claimId((routeRepair?'route-repair:':bufferedRepair?'buffered-repair:':receiptRepair?'receipt-repair:':bridgeRepair?'bridge-repair:':transportRepair?'transport-repair:':'redispatch:')+clientId),clientId,'reader-recovery',routeRepair?'reader_recovery_route_repaired':transportRepair?'reader_recovery_transport_repaired':'reader_recovery_redispatched',ownerId,JSON.stringify({requestId:d.requestId,runId,...(routeRepair?{routingVersion:'217bce71-bc40-4696-894d-65575feb2966'}:{})})]);
  if(dispatch.rows.length!==1)throw Error('recovery_not_available');
  const limit=Math.min(Number(b.limit_micro_usd),Number(b.committed_micro_usd)+extra);
  const predicate=routeRepair?"detail->>'routeRepairDispatched' IS DISTINCT FROM 'true'":bufferedRepair?"detail->>'bufferedRepairDispatched' IS DISTINCT FROM 'true'":receiptRepair?"detail->>'receiptRepairDispatched' IS DISTINCT FROM 'true'":bridgeRepair?"detail->>'bridgeRepairDispatched' IS DISTINCT FROM 'true'":transportRepair?"detail->>'transportRepairDispatched' IS DISTINCT FROM 'true'":"detail->>'redispatched' IS DISTINCT FROM 'true'";
  const detail=routeRepair?{...d,routeRepairDispatched:true,routeRepairAt:new Date().toISOString(),limitMicroUsd:limit}:bufferedRepair?{...d,bufferedRepairDispatched:true,bufferedRepairAt:new Date().toISOString(),limitMicroUsd:limit}:receiptRepair?{...d,receiptRepairDispatched:true,receiptRepairAt:new Date().toISOString(),limitMicroUsd:limit}:bridgeRepair?{...d,bridgeRepairDispatched:true,bridgeRepairAt:new Date().toISOString(),limitMicroUsd:limit}:transportRepair?{...d,transportRepairDispatched:true,transportRepairAt:new Date().toISOString(),limitMicroUsd:limit}:{...d,redispatched:true,redispatchedAt:new Date().toISOString(),limitMicroUsd:limit};
  const claimed=await db.query("UPDATE a7_budget_audit SET detail=$2 WHERE event_id=$1 AND detail->>'started'='false' AND ("+predicate+") RETURNING event_id",[claimId(clientId),JSON.stringify(detail)]);
  if(claimed.rows.length!==1)throw Error('recovery_not_available');
  await db.query('UPDATE a7_owner_budgets SET limit_micro_usd=$2,updated_at=now() WHERE client_run_id=$1',[clientId,limit]);
  return {requestId:d.requestId,runId,clientId,sourceSha256:d.sourceSha256};
 });
}
