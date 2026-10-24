// Edit phase 2.5 (19 Oct 2026): a sent version whose receipt was never recorded ('confirmed' or 'outcome_unknown') is
// stuck, because a version is never sent twice: a second run with the same run id could overwrite the first run's
// record in A7. This check settles it. It runs only once the send can no longer be in flight (15 minutes after the
// state changed) and asks A7 for the run's record. A7 has it, or this site's ledger shows A7 worked on the job
// (a paid operation beyond the Step 2 source reading): the version is marked received. A7 answers that it
// has no such run and the ledger is empty: the version returns to draft and can be sent again. Any other answer
// changes nothing.
import {transaction} from './a7-budget.mjs';
import {requestId} from './a7-actions.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';
export const DISPATCH_CHECK_WAIT_MS=15*60*1000;
const UNSETTLED=['confirmed','sending','outcome_unknown'];
// A paid source reading (Step 2) runs under the same run identity and the same reader nodes as the job's own first steps,
// and it opens the budget and sets its run id. So a budget row, its engine audits or one read per reader node are not
// evidence that A7 took the job; a paid operation of any other node, or a second read of a reader node, is.
const READING_NODES=['03 Eye reads the product photo','05 Second count','06 Room reader','09 Conflict check'];
async function ledgerShowsA7(db,clientRunId){
 const {rows:[r]}=await db.query('SELECT count(*) FILTER (WHERE NOT (node_name = ANY($2))) AS other,count(*) FILTER (WHERE node_name = ANY($2))-count(DISTINCT node_name) FILTER (WHERE node_name = ANY($2)) AS again FROM a7_paid_operations WHERE client_run_id=$1',[clientRunId,READING_NODES]);
 return Number(r.other)>0||Number(r.again)>0;
}
// lookup(runId) answers 'found', 'not_found' or 'unknown' from A7's own run record.
export async function checkDispatch(pool,ownerId,id,lookup,now=new Date()){
 if(!requestId(id))throw Error('not_found');
 const {rows:[v]}=await pool.query('SELECT dispatch_state,dispatch_changed_at,created_at FROM a7_job_versions WHERE id=$1 AND owner_id=$2',[id,ownerId]);
 if(!v)throw Error('not_found');
 if(!UNSETTLED.includes(v.dispatch_state))return {state:v.dispatch_state,changed:false};
 const since=new Date(v.dispatch_changed_at||v.created_at).getTime();
 if(now.getTime()-since<DISPATCH_CHECK_WAIT_MS)return {state:v.dispatch_state,changed:false,checkAfter:new Date(since+DISPATCH_CHECK_WAIT_MS).toISOString()};
 const {clientRunId,runId}=sharedRunIdentity(id);
 const local=await ledgerShowsA7(pool,clientRunId);
 const seen=local?'found':await lookup(runId);
 if(seen!=='found'&&seen!=='not_found')return {state:v.dispatch_state,changed:false,a7:'unknown'};
 return transaction(pool,async db=>{
  const {rows:[cur]}=await db.query('SELECT dispatch_state FROM a7_job_versions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId]);
  if(!cur||!UNSETTLED.includes(cur.dispatch_state))return {state:cur?.dispatch_state||null,changed:false};
  if(seen==='found'||await ledgerShowsA7(db,clientRunId)){await db.query("UPDATE a7_job_versions SET dispatch_state='received',run_id=$2,dispatch_changed_at=now() WHERE id=$1",[id,runId]);return {state:'received',changed:true,runId};}
  await db.query("UPDATE a7_job_versions SET dispatch_state='draft',client_run_id=NULL,dispatch_changed_at=now() WHERE id=$1",[id]);
  return {state:'draft',changed:true};
 });
}
