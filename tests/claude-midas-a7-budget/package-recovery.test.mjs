import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {guardWorkflow} from '../../n8n/claude-midas-a7/budget-guards/build-guarded-workflow.mjs';
import {installReaderRecovery} from '../../n8n/claude-midas-a7/budget-guards/install-reader-recovery.mjs';
import {installBlindRecovery} from '../../n8n/claude-midas-a7/budget-guards/blind-recovery.mjs';
import {installPackageRecovery,restoreApprovedPackage} from '../../n8n/claude-midas-a7/budget-guards/package-recovery.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url)));
const base=installBlindRecovery(installReaderRecovery(guardWorkflow(read('n8n/claude-midas-a7/workflow-1cgZc9rmBOrPdKIe.json'))));
const w=installPackageRecovery(base),node=n=>w.nodes.find(x=>x.name===n);
test('package continuation preserves original IDs, credentials, waits and has no provider nodes',()=>{
 for(const old of base.nodes){const n=node(old.name);assert.equal(n.id,old.id);assert.deepEqual(n.credentials,old.credentials);if(old.type.endsWith('.webhook')||old.type.endsWith('.wait'))assert.deepEqual(n,old);}
 for(const n of w.nodes.filter(x=>x.name.startsWith('Package ·'))){assert.equal(n.retryOnFail,false);assert.ok(!/openai|anthropic|generativelanguage|fal.ai/i.test(n.parameters.url||''));}
 assert.equal(w.connections['Package · Settings recovery?'].main[0][0].node,'Package · Claim continuation');assert.equal(w.connections['Package · Settings recovery?'].main[1][0].node,'Blind · Settings route');
 const AF=Object.getPrototypeOf(async function(){}).constructor;for(const n of w.nodes.filter(x=>x.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new AF('$input','$','require',n.parameters.jsCode),n.name);
});
test('restores genuine owner approval, full master metadata and historical costs without new events or calls',()=>{
 const f=read('claude-outputs/claude-midas-a7-owner-workspace/tests/fixtures/approved-package-context.json');const brief=read('claude-outputs/claude-midas-a7-owner-workspace/tests/fixtures/approved-reader-replacement-brief.json');
 const c={...f,ready:true,paidCalls:0,brief,cost:{operations:[{node:'old reader',model:'fixture',status:'completed',usd:.017494},{node:'blind',status:'uncertain',usd:.816432}]}},s=restoreApprovedPackage(c);
 assert.equal(s.status,'white_master_approved');assert.deepEqual(s.go2_last,f.decision);assert.deepEqual(s.approved.release,f.decision.release);assert.deepEqual(s.approved.product_box_2d,[170,56,842,955]);assert.equal(s.approved.candidate.bytes,1899002);assert.equal(s.approved.candidate.folder_id,'1n1FYVNCauL_M23OqrROds4yGN8QjcL-F');assert.equal(s.text_calls_new.length,0);assert.equal(s.events,undefined);assert.equal(s.text_calls[1].usd,null);assert.equal(s.text_calls[1].held_usd,.816432);
 assert.throws(()=>restoreApprovedPackage({...c,brief:{outputs:[{id:'hero'}]}}),/package_paid_path_denied/);
});
