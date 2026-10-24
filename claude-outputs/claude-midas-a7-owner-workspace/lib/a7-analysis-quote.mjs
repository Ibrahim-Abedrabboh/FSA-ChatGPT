import {canonical,digest,requestId} from './a7-actions.mjs';
import {CALL_POLICY,RATES,PRICING_VERSION,quoteCall} from './a7-budget.mjs';
import {sharedRunIdentity} from './a7-shared-run.mjs';

// Conservative reservation ceiling for the analysis-only reader set. A fallback
// reader is excluded and requires a new explicit quote and authorization.
export function quoteSourceAnalysis(source,now=new Date()){
 if(!requestId(source?.draftId)||!/^[a-f0-9]{64}$/.test(source?.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(source?.referenceFingerprint||''))throw Error('invalid_analysis_source');
 const nodes=['03 Eye reads the product photo','05 Second count',...(source.roomSha256?['06 Room reader']:[]),'09 Conflict check'];
 const calls=nodes.map(node=>{
  const [model,outputTokens]=CALL_POLICY[node];
  const identity=sharedRunIdentity(source.draftId);
  const q=quoteCall({clientId:identity.clientRunId,runId:identity.runId,operationKey:'analysis-'+node.slice(0,2)+'-'+source.draftId,node,model,outputId:'source_analysis',requestSha256:source.sourceSha256,inputTokens:RATES[model].inputLimit,outputTokens},now);
  return {node,model,reserveMicroUsd:q.reserve};
 });
 const totalMicroUsd=calls.reduce((sum,call)=>sum+call.reserveMicroUsd,0);
 if(totalMicroUsd>5000000)throw Error('analysis_budget_exceeds_limit');
 const maxCostUsd=Math.ceil(totalMicroUsd/10000)/100;
 const basis={draftId:source.draftId,referenceFingerprint:source.referenceFingerprint,sourceSha256:source.sourceSha256,roomSha256:source.roomSha256||null,budgetLimitUsd:source.budgetLimitUsd??5,pricingVersion:PRICING_VERSION,calls,totalMicroUsd,maxCostUsd};
 return {status:'verified',...basis,fingerprint:digest(canonical(basis)),excludes:['Fallback readers','Planning','Generation','Repair','Provider taxes and invoice reconciliation']};
}
