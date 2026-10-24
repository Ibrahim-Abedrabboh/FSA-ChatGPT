import test from 'node:test';import assert from 'node:assert/strict';
import {estimateDraft,confirmEstimate} from '../lib/a7-estimate.mjs';
const now=new Date('2026-10-18T12:01:00Z');
const draft={id:'draft',brief:{outcome:'White background',view:'Category template',resolution:'2K',budgetUsd:'4.74'},direction:'Keep two units separate'};
const ref={reference_id:'ref',role:'product',sha256:'a'.repeat(64)};
test('white estimate uses observed receipts; lifestyle retains provisional Route arithmetic',()=>{
 const white=estimateDraft(draft,[ref],now);assert.equal(white.noRepairUsd,.181);assert.equal(white.twoRepairsEachUsd,.501);assert.deepEqual(white.outputs,['White master']);
 const lifestyle=estimateDraft({...draft,brief:{...draft.brief,outcome:'Lifestyle',view:'Wide view + close-up'}},[ref],now);assert.deepEqual(lifestyle.outputs,['White master','Wide scene','Detail scene']);assert.equal(lifestyle.noRepairUsd,.609);assert.equal(lifestyle.twoRepairsEachUsd,1.261);
 assert.equal(white.ceilingUsd,4.74);assert.equal(white.status,'verified');
});
test('changed instructions, references, ceiling or output invalidate confirmation',()=>{
 const original=estimateDraft(draft,[ref],now);
 for(const [d,refs] of [[{...draft,direction:'Different direction'},[ref]],[draft,[{...ref,sha256:'b'.repeat(64)}]],[{...draft,brief:{...draft.brief,budgetUsd:1}},[ref]],[{...draft,brief:{...draft.brief,outcome:'Lifestyle'}},[ref]]])assert.notEqual(estimateDraft(d,refs,now).fingerprint,original.fingerprint);
 assert.throws(()=>confirmEstimate(original,{...original,fingerprint:'tampered'},now),/estimate_changed/);
 assert.throws(()=>confirmEstimate(original,original,new Date('2026-10-18T12:16:00Z')),/estimate_changed/);
});
test('a provisional estimate cannot authorize paid work and unsupported scopes have no invented estimate',()=>{
 const estimate=estimateDraft({...draft,parent_id:'saved-parent'},[ref],now);assert.throws(()=>confirmEstimate(estimate,estimate,now),/estimate_not_verified/);
 assert.throws(()=>estimateDraft({...draft,brief:{...draft.brief,outcome:'Unknown'}},[ref],now),/estimate_scope_unsupported/);
});

test('calibration permits only supported references and binds confirmation to parent and current prices',()=>{
 const calibrated=estimateDraft(draft,[ref],now);assert.equal(confirmEstimate(calibrated,calibrated,now).status,'verified');
 for(const [d,refs] of [[{...draft,parent_id:'parent'},[ref]],[draft,[ref,{...ref,reference_id:'second'}]],[{...draft,brief:{...draft.brief,editOperation:'remove'}},[ref]],[{...draft,brief:{...draft.brief,allowedChanges:'lighting'}},[ref]]])assert.equal(estimateDraft(d,refs,now).status,'provisional');
 assert.throws(()=>estimateDraft(draft,[ref],new Date('2027-01-01')),/price_verification_required/);
 assert.equal(calibrated.calibration.textCalls,22);assert.equal(calibrated.calibration.whiteImages,3);
});

test('engine and frontend show the same calibrated white costs',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const code=await readFile(new URL('../../../n8n/claude-midas-a7/code-nodes/07_Route.js',import.meta.url),'utf8');
 const state={brief:{outputs:[{kind:'white'}],job_type:'new_project'},references:[{role:'product'}],inventory:[],observation:{},exclusions:[],conflicts:[],trail:[]};
 const run=s=>runInNewContext('(function(){'+code+'})()',{Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-10-18T12:00:00Z']));}},$input:{all:()=>[]},$:()=>({first:()=>({json:s})})})[0].json.cost_estimate;
 const engine=run(state),ui=estimateDraft(draft,[ref],now);assert.equal(engine.no_repair,ui.noRepairUsd);assert.equal(engine.max_two_repairs_each,ui.twoRepairsEachUsd);assert.equal(engine.version,ui.version);
 assert.equal(run({...state,references:[{role:'product'},{role:'look'}]}).label,'provisional estimate');
});
test('owner test mode accepts a provisional estimate but still binds it to the same fingerprint and expiry',()=>{
 const lifestyle=estimateDraft({...draft,brief:{...draft.brief,outcome:'Lifestyle',view:'Wide view'}},[ref],now);
 assert.equal(lifestyle.status,'provisional');
 assert.throws(()=>confirmEstimate(lifestyle,lifestyle,now),/estimate_not_verified/);
 assert.equal(confirmEstimate(lifestyle,lifestyle,now,{allowProvisional:true}).status,'provisional');
 assert.throws(()=>confirmEstimate(lifestyle,{...lifestyle,fingerprint:'tampered'},now,{allowProvisional:true}),/estimate_changed/);
 assert.throws(()=>confirmEstimate(lifestyle,lifestyle,new Date('2026-10-18T12:16:00Z'),{allowProvisional:true}),/estimate_changed/);
 assert.throws(()=>confirmEstimate({...lifestyle,status:'unknown'},{...lifestyle,status:'unknown'},now,{allowProvisional:true}),/estimate_not_verified/);
});
test('every guide outcome has the images A7 plans; only a square 2K White BK alone is verified',async()=>{
 const {plannedOutputs}=await import('../lib/a7-estimate.mjs');
 assert.deepEqual(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle\nWebsite',view:'Close-up'}),['White master','Detail scene','Hero scene','Wide scene']);
 assert.deepEqual(plannedOutputs({outcome:'Lifestyle',outcomes:'New Composition\nCreate with this item'}),['White master','Composition','Scene with this item']);
 assert.equal(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle',series:'Views by light'}).length,10);
 assert.equal(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle\nWebsite',series:'Views by light'}).length,10);
 assert.deepEqual(plannedOutputs({outcome:'Lifestyle',outcomes:'Variations',variationCount:'3'}),['Variation 1','Variation 2','Variation 3']);
 const combo=estimateDraft({...draft,brief:{...draft.brief,outcome:'Lifestyle',outcomes:'Lifestyle\nWebsite'}},[ref],now);assert.equal(combo.status,'provisional');
 const white4k=estimateDraft({...draft,brief:{...draft.brief,outcomes:'White BK',resolution:'4K'}},[ref],now);assert.equal(white4k.status,'provisional');assert.match(white4k.warnings.join(' '),/4K/);
 assert.equal(estimateDraft({...draft,brief:{...draft.brief,outcomes:'White BK'}},[ref],now).status,'verified');
});

test('an out-of-scope version names the one setting to change',()=>{
 const reason=brief=>{try{estimateDraft({...draft,brief:{...draft.brief,...brief}},[ref],now);}catch(error){assert.equal(error.message,'estimate_scope_unsupported');return error.reason;}return null;};
 assert.equal(reason({outcome:''}),'outcome');assert.equal(reason({resolution:'8K'}),'resolution');
 assert.equal(reason({view:undefined}),'view');assert.equal(reason({budgetUsd:10.01}),'budget');assert.equal(reason({}),null);
});
test('an estimate is valid for 15 minutes from when it was issued, across a quarter hour, and cannot be stretched',()=>{
 const issued=new Date('2026-10-18T12:14:30Z'),shown=estimateDraft(draft,[ref],issued);
 assert.equal(shown.expiresAt,'2026-10-18T12:29:30.000Z');assert.equal(shown.issuedAt,'2026-10-18T12:14:30.000Z');
 // The send recomputes the estimate later; the same inputs and figures confirm what the owner saw.
 const at=new Date('2026-10-18T12:15:10Z'),recomputed=estimateDraft(draft,[ref],at);
 assert.equal(recomputed.fingerprint,shown.fingerprint);assert.equal(confirmEstimate(recomputed,shown,at).status,'verified');
 assert.throws(()=>confirmEstimate(estimateDraft(draft,[ref],new Date('2026-10-18T12:29:31Z')),shown,new Date('2026-10-18T12:29:31Z')),/estimate_changed/);
 assert.throws(()=>confirmEstimate(recomputed,{...shown,expiresAt:'2026-10-18T13:30:00Z'},at),/estimate_changed/,'an expiry further than 15 minutes away was not issued here');
 assert.throws(()=>confirmEstimate(recomputed,{...shown,expiresAt:'not a date'},at),/estimate_changed/);
 assert.throws(()=>confirmEstimate(estimateDraft({...draft,direction:'Changed'},[ref],at),shown,at),/estimate_changed/,'changed inputs are refused');
});
test('after the price verification date every estimate is refused with words, not a generic failure',async()=>{
 const error=(()=>{try{estimateDraft(draft,[ref],new Date('2027-01-02T00:00:00Z'));}catch(e){return e;}})();
 assert.equal(error.message,'price_verification_required');
 const {estimateRefusal}=await import('../netlify/functions/owner-estimate.mjs');
 const refusal=estimateRefusal(error);assert.equal(refusal.status,503);assert.equal(refusal.unexpected,undefined);
 assert.deepEqual(refusal.body,{error:'price_verification_required',message:'Prices must be re-verified before new estimates; contact support. Your draft is saved; nothing was sent or paid.'});
 assert.equal(estimateRefusal(Object.assign(Error('estimate_scope_unsupported'),{reason:'outcome'})).body.reason,'outcome');
 assert.equal(estimateRefusal(Error('connection reset')).body.error,'estimate_unavailable');
});
test('scenes made from an approved white image count no new white master',()=>{
 const scenes=estimateDraft({...draft,parent_id:'parent',brief:{...draft.brief,outcome:'Lifestyle',view:'Wide view + close-up',resultAssetId:'asset',editBaseKind:'white'}},[ref],now);
 assert.deepEqual(scenes.outputs,['Wide scene','Detail scene']);assert.equal(scenes.status,'provisional');
 const fresh=estimateDraft({...draft,brief:{...draft.brief,outcome:'Lifestyle',view:'Wide view + close-up'}},[ref],now);
 assert.ok(scenes.noRepairUsd<fresh.noRepairUsd);
 assert.throws(()=>estimateDraft({...draft,parent_id:'parent',brief:{...draft.brief,resultAssetId:'asset',editBaseKind:'white'}},[ref],now),/estimate_scope_unsupported/,'a white-only job from a white image makes nothing');
});
