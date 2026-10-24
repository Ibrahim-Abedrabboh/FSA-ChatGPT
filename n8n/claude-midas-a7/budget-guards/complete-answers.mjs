import {CALL_POLICY} from '../../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-budget.mjs';
export function answerEnvelope(raw){
 if(raw?.statusCode&&raw.statusCode!==200)return {error:'provider_http_error'};const r=raw?.body||raw||{};return Object.fromEntries(['id','status','output','content','candidates','response','usage','usageMetadata','stop_reason','steps','output_image','finishReason','error'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
}
export function installCompleteAnswers(source){
 const w=structuredClone(source),find=name=>{const n=w.nodes.find(x=>x.name===name);if(!n)throw Error('missing_node:'+name);return n;};
 for(const name of Object.keys(CALL_POLICY)){
  const suffix=name.split(' ')[0];if(suffix==='03b')continue;
  const prefix='Budget · '+suffix+' · ',receipt=find(prefix+'Receipt'),restore=find(prefix+'Restore');
  if(receipt.parameters.jsCode.includes('completeAnswer:'))throw Error('complete_answers_already_installed');
  const needle='usage,receiptRef}';if(!receipt.parameters.jsCode.includes(needle))throw Error('receipt_changed:'+name);
  receipt.parameters.jsCode=receipt.parameters.jsCode.replace('it.json.id||it.json.response?.id', 'it.json.body?.id||it.json.id||it.json.response?.id');
  receipt.parameters.jsCode=answerEnvelope.toString()+'\n'+receipt.parameters.jsCode.replace(needle,'usage,receiptRef,checkpointRequired:!!usage,...((()=>{const a=answerEnvelope(it.json);return !a.error&&(a.output||a.content||a.candidates||a.response?.candidates||a.steps||a.output_image)?{completeAnswer:a}:{}})())}');
  restore.parameters.jsCode=restore.parameters.jsCode.replaceAll('settlementCompleted(result)','(settlementCompleted(result)&&result.body?.responsePreserved===true)');
  restore.parameters.jsCode=restore.parameters.jsCode.replace('...r.json.original,__budgetAllowed:true','...r.json.original,__budgetAllowed:true,__answerResponsePreserved:true');
  if(suffix==='15g')restore.parameters.jsCode=restore.parameters.jsCode.replace('stage04:r.json.original.s04','stage04:r.json.original.s04||$("Budget · 15g · Ticket").first().json.state.stage04');
 }
 const edge=n=>({node:n,type:'main',index:0});
 const afterProvider=w.connections['15g Send to Google'],afterSettled=w.connections['Budget · 15g · Settled'].main[0];
 if(afterProvider.main[0].length!==1||afterProvider.main[0][0].node!=='15h Read submission')throw Error('image_provider_route_changed');
 if(!afterSettled.length)throw Error('image_post_settlement_missing');
 w.connections['15g Send to Google']={main:[[edge('Budget · 15g · Receipt')]]};
 w.connections['Budget · 15g · Settled'].main[0]=structuredClone(afterProvider.main[0]);
 w.connections['15o Final receipt']={main:[structuredClone(afterSettled)]};
 w.connections['Budget · 15g · Check actual call']={main:[[]]};
 return w;
}
