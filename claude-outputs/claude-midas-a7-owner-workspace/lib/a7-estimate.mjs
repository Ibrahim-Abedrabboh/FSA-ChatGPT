import {canonical,digest} from './a7-actions.mjs';
import {calibratedWhiteCost} from './a7-cost-calibration.mjs';
import {MAX_JOB_BUDGET_USD} from './a7-limits.mjs';
export const ESTIMATE_VERSION='a7-receipt-calibration-2026-10-18';
// An estimate is valid for 15 minutes from when it was issued (it once ended at the next quarter hour, so it could last seconds).
export const ESTIMATE_VALID_MS=15*60*1000;
// Match the currently published 07 Route worksheet, not an invented price list.
// This must be recalibrated against current provider receipts before paid release.
export function estimateDraft(draft,references,now=new Date()) {
 const b=draft.brief;
 // reason names the one setting outside the estimate's scope, so the page can say which to change.
 const unsupported=reason=>Object.assign(Error('estimate_scope_unsupported'),{reason});
 if(!b||!['White background','Lifestyle'].includes(b.outcome))throw unsupported('outcome');
 if(!['2K','4K'].includes(b.resolution))throw unsupported('resolution');
 if(!['Category template','Wide view','Close-up','Wide view + close-up'].includes(b.view))throw unsupported('view');
 const ceiling=Number(b.budgetUsd??5);if(!Number.isFinite(ceiling)||ceiling<.25||ceiling>MAX_JOB_BUDGET_USD)throw unsupported('budget');
 const outputs=plannedOutputs(b);
 if(!outputs.length)throw unsupported('outputs');
 const images=outputs.length,rooms=outputs.filter(o=>o!=='White master'&&!o.startsWith('Variation')).length;
 const base=.0607+images*(.0639+.0447)+images*.0229+.0084+.018+rooms*.0639;
 const round=v=>Number(v.toFixed(3));
 const estimate={version:ESTIMATE_VERSION,currency:'USD',status:'provisional',outputs,
  noRepairUsd:round(base),twoRepairsEachUsd:round(base+images*2*.1086),
  basis:'Published A7 Route worksheet: 14 October cost model, with 16 October empty-room allowance. Token workloads are assumed; current provider charges are not yet recalibrated.',
  coverage:['Initial reading, count checks and planning','Planned image generation and automated checks','Packaging allowance','One empty-room generation per scene (conservative when your room photo is used)'],
  exclusions:['Additional planning rounds, fallback model calls and extra reviews','Storage, hosting, taxes and currency conversion'],
  warnings:['Preliminary planning estimate, not a quote or a guaranteed maximum. More references and longer instructions can increase token costs.','The upper figure assumes two owner-requested repairs per image; it does not authorize repairs.','Paid submission remains paused until current estimates and every engine spending guard are verified.'],
  ceilingUsd:ceiling,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+ESTIMATE_VALID_MS).toISOString()};
 if(b.resolution==='4K')estimate.warnings.push('4K image charges are not calibrated yet; the figures use the 2K worksheet.');
 if(estimate.twoRepairsEachUsd>ceiling)estimate.warnings.push('The upper figure is above the job spending ceiling, so the run can pause before every image is made.');
 const calibration=calibratedWhiteCost(now);
 const calibratedScope=b.outcome==='White background'&&(!b.outcomes||b.outcomes==='White BK')&&b.resolution==='2K'&&!draft.parent_id&&b.editSource!=='new'&&(!b.startType||b.startType==='product_collection')&&references.length===1&&references[0].role==='product'&&!b.allowedChanges&&!b.protectedDetails&&!b.editTarget&&!['add','remove','replace'].includes(b.editOperation);
 if(calibratedScope){
  const up=micro=>Math.ceil(micro/1000)/1000;
  Object.assign(estimate,{status:'verified',noRepairUsd:up(calibration.baseMicro),twoRepairsEachUsd:up(calibration.baseMicro+2*calibration.repairMicro),
   basis:'Calibrated 18 October 2026 from 22 unique text-call receipts and 3 real white-master image receipts. Uses the largest observed cost per required step at current conservative ledger rates. No additional provider calls were made for calibration. This is a small historical sample, not an invoice or guaranteed maximum.',
   coverage:['One original product image, initial reading, independent count and conflict check','One square 2K white master, automated review and blind count','Two requested repairs per image are shown separately; no automatic repairs'],
   warnings:['Historical usage estimate, not a quote or a guaranteed maximum. Instructions and token workloads can increase costs.','The repair figure does not authorize repairs; each repair requires a separate owner decision.','Each provider call reserves its full configured token allowance before sending. A run can pause when its remaining ceiling cannot cover that reservation.','Ledger costs conservatively price all image-model output tokens at the image rate; the provider invoice may be lower.'],
   calibration:{checked:calibration.checked,textCalls:calibration.textSamples,whiteImages:calibration.imageSamples,scope:'One product reference; square 2K white master'},
   exclusions:['Fallback calls, repeated planning or extra reviews','Storage, hosting, taxes and currency conversion']});
 }
 const inputs={draftId:draft.id,parentId:draft.parent_id||null,brief:b,direction:draft.direction||draft.note,references:references.map(r=>({id:r.reference_id,role:r.role,sha256:r.sha256})).sort((a,b)=>a.id.localeCompare(b.id))};
 // The fingerprint binds the inputs and every figure the owner saw, not the time it was issued: the send recomputes the estimate
 // and must reach the same fingerprint, so changed inputs or prices are refused. The expiry is checked on its own (confirmEstimate).
 const {issuedAt,expiresAt,...figures}=estimate;
 return {...estimate,fingerprint:digest(canonical({inputs,estimate:figures}))};
}
// The images A7's "01 Intent & scope" plans for these outcomes (n8n/claude-midas-a7/code-nodes/01_Intent_scope.js, 18 Oct 2026):
// the white master first, then each outcome's images; at most 8 (10 for the views-by-light series). Scenes made from an approved
// white image (editBaseKind 'white', 20 Oct 2026) make no new white master, nor does a scene-only job whose owner unticked it
// (brief whiteMaster 'no', 21 Oct 2026).
const VIEW_SCENES={'Category template':['Hero scene'],'Wide view':['Wide scene'],'Close-up':['Detail scene'],'Wide view + close-up':['Wide scene','Detail scene']};
const SERIES_CAMS=['Full frontal','Left side','45° right'];
export function plannedOutputs(b){
 const asked=typeof b.outcomes==='string'&&b.outcomes.trim()?b.outcomes.split('\n').map(x=>x.trim()).filter(Boolean):[b.outcome==='Lifestyle'?'Lifestyle':'White BK'];
 const out=[],add=x=>{if(!out.includes(x))out.push(x);};
 // The white master is left out only when the owner unticked it and no asked outcome needs it (White BK, Website); see A7 01.
 const withWhite=b.whiteMaster!=='no'||asked.some(o=>['White BK','Website'].includes(o));
 for(const o of asked){
  if(o==='Variations'){const n=Math.min(4,Math.max(1,Number(b.variationCount)||2));for(let i=1;i<=n;i++)add('Variation '+i);continue;}
  if(withWhite)add('White master');
  if(o==='Lifestyle'){
   if(b.series==='Three views')SERIES_CAMS.forEach(c=>add('Series · '+c));
   else if(b.series==='Views by light')['Daylight','Golden afternoon','Warm evening'].forEach(l=>SERIES_CAMS.forEach(c=>add('Series · '+l+' · '+c)));
   else (VIEW_SCENES[b.view]||VIEW_SCENES['Category template']).forEach(add);
  }
  if(o==='Website')['Hero scene','Wide scene','Detail scene'].forEach(add);
  if(o==='New Composition')add('Composition');
  if(o==='Create with this item')add('Scene with this item');
 }
 const cap=b.series==='Views by light'&&asked.includes('Lifestyle')?10:8;
 const planned=out.slice(0,cap);
 return b.editBaseKind==='white'?planned.filter(x=>x!=='White master'):planned;
}
// allowProvisional is the owner test mode (A7_OWNER_TEST_ALL_SCOPES). Spending stays bounded by the
// job ceiling the budget ledger enforces; only the calibration requirement is lifted.
export function confirmEstimate(estimate,input,now=new Date(),{allowProvisional=false}={}) {
 // Same inputs and figures (fingerprint), not expired, and an expiry no further away than one validity period: a later one was
 // never issued here, so an old estimate cannot be stretched to authorize spending.
 const expires=Date.parse(input?.expiresAt);
 if(!input||input.fingerprint!==estimate.fingerprint||!Number.isFinite(expires)||now.getTime()>=expires||expires-now.getTime()>ESTIMATE_VALID_MS)throw Error('estimate_changed');
 // The provisional worksheet is useful for planning, but cannot release paid work outside test mode.
 if(estimate.status!=='verified'&&!(allowProvisional&&estimate.status==='provisional'))throw Error('estimate_not_verified');
 return estimate;
}
