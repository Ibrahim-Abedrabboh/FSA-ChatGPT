import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {BLIND as P,blindKey,blindContext,beginBlindContinuation} from '../lib/a7-blind-recovery.mjs';
import {openBudget,reserveCall,settleCall,readBudget,transaction} from '../lib/a7-budget.mjs';
const local=new NetlifyDB(),owner=randomUUID();let pool;
before(async()=>{const connectionString=await local.start();await local.applyMigrations(new URL('../netlify/database/migrations',import.meta.url).pathname);pool=getDatabase({connectionString}).pool;pool.options.max=1;});
after(async()=>{await pool?.end();await local.stop();});
beforeEach(async()=>{await pool.query('TRUNCATE a7_budget_audit,a7_paid_operations,a7_owner_budgets CASCADE');await openBudget(pool,{clientId:P.clientId,ownerId:owner,limitUsd:4.739996});await pool.query('UPDATE a7_owner_budgets SET run_id=$2,committed_micro_usd=$3 WHERE client_run_id=$1',[P.clientId,P.runId,P.initialMicro]);
 const records=[['primary','03 Eye reads the product photo',846432,'uncertain',''],['counter','05 Second count',3564,'completed',''],['oldfallback','03b Eye fallback (OpenAI)',17494,'completed',''],['newreader','03b Eye fallback (OpenAI)',19684,'completed',''],['conflict','09 Conflict check',353,'completed',''],['image','15g Send to Google',78042,'completed',''],['critic','16 Critic review',30460,'completed','msg_011Cg8x1XCDuxhhnRXSGne6g'],['blind','16x Blind count',816432,'uncertain','']];
 for(const [key,node,cost,status,ref] of records)await pool.query('INSERT INTO a7_paid_operations(operation_key,client_run_id,run_id,node_name,model,output_id,request_sha256,permit,pricing,reserved_micro_usd,accounted_micro_usd,status,receipt_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12)',[key,P.clientId,P.runId,node,'fixture','white_master','a'.repeat(64),randomUUID(),'{}',cost,status,ref]);
});

const fixture=JSON.parse(readFileSync(new URL('./fixtures/approved-package-context.json',import.meta.url)));
const brief=JSON.parse(readFileSync(new URL('./fixtures/approved-reader-replacement-brief.json',import.meta.url)));
const {packageContext,beginPackageContinuation,validatePackageEvidence,packageCostSummary}=await import('../lib/a7-package-recovery.mjs');
async function completeLedger(){
 await pool.query('INSERT INTO a7_paid_operations(operation_key,client_run_id,run_id,node_name,model,output_id,request_sha256,permit,pricing,reserved_micro_usd,accounted_micro_usd,status,receipt_ref,usage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[blindKey,P.clientId,P.runId,'16xb Blind count fallback (OpenAI)','gpt-6.1-sol','white_master','b'.repeat(64),randomUUID(),'{}',29600,13835,'completed','resp_saved_blind',JSON.stringify({input:3200,output:69})]);
 await pool.query('UPDATE a7_owner_budgets SET committed_micro_usd=1826296 WHERE client_run_id=$1',[P.clientId]);
 await pool.query("INSERT INTO a7_budget_audit(event_id,client_run_id,event,actor,detail) VALUES($1,$2,'reader_replacement_requested','test',$3)",[randomUUID(),P.clientId,JSON.stringify({started:true,checkpoint:{brief,cached_second:{total:2}}})]);
}
test('complete historical cost summary reconciles nine operations and both held amounts without secrets',async()=>{
 await completeLedger();const before=await readBudget(pool,owner,P.clientId),c=await packageContext(pool,fixture);
 assert.equal(c.cost.operation_count,9);assert.equal(c.cost.all_usd,1.826296);assert.equal(c.cost.held_uncertain_usd,1.662864);assert.equal(c.cost.known_accounted_usd,.163432);assert.equal(c.cost.usd,.078042);assert.equal(c.cost.text_usd,1.748254);assert.equal(c.cost.available_usd,2.9137);
 assert.equal(c.cost.operations.filter(o=>o.status==='uncertain').length,2);assert.doesNotMatch(JSON.stringify(c.cost),/permit|reader_response|request_sha256/);assert.deepEqual(await readBudget(pool,owner,P.clientId),before);
});
test('one atomic package claim changes no budget or provider operation; replay is denied',async()=>{
 await completeLedger();const before=await readBudget(pool,owner,P.clientId);
 const starts=await Promise.allSettled([transaction(pool,db=>beginPackageContinuation(db,fixture)),transaction(pool,db=>beginPackageContinuation(db,fixture))]);
 assert.equal(starts.filter(s=>s.status==='fulfilled').length,1);assert.match(starts.find(s=>s.status==='rejected').reason.message,/package_continuation_used/);assert.deepEqual(await readBudget(pool,owner,P.clientId),before);
});
test('changed image, approval, stage, export receipts, held amount or totals stop packaging',async()=>{
 await completeLedger();
 for(const r of [{...fixture.row,go2_decision:''},{...fixture.row,status:'done'},{...fixture.row,go2_at:'later'},{...fixture.row,stage04:JSON.stringify({candidate:{sha256:'f'.repeat(64)}})},{...fixture.row,package:JSON.stringify({files:[{drive_file_id:'already-uploaded'}]})}])assert.throws(()=>validatePackageEvidence({...fixture,row:r}),/package_evidence_mismatch/);
 await pool.query("UPDATE a7_paid_operations SET accounted_micro_usd=1 WHERE operation_key='blind'");await assert.rejects(packageContext(pool,fixture),/blind_ledger_mismatch/);
});
