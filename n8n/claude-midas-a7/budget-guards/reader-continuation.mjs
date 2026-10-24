import {randomUUID} from 'node:crypto';

export function requirePreservedReader(state,response){
 if(state?.reader_recovery!==true||state.room_key||
    !Number.isSafeInteger(state.cached_second?.total)||state.cached_second.total<1||
    response?.__budgetAllowed!==true||response?.__readerResponsePreserved!==true||
    response.status!=='completed'||!Array.isArray(response.output))
  throw Error('reader_continuation_not_ready_no_resend');
 return response;
}

// Recovery already owns a cached second count and has no room photo. It must
// not wait at the normal three-input merge for inactive provider branches.
export function repairReaderContinuation(source){
 const w=structuredClone(source),find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('missing_node:'+name);return n;};
 if(w.nodes.some(n=>n.name==='Recovery · Continue preserved reader?'))throw Error('reader_continuation_already_installed');
 const receipt=find('Budget · 03b · Receipt');
 if(!receipt.parameters.jsCode.includes('usage,receiptRef}'))throw Error('reader_receipt_changed');
 receipt.parameters.jsCode=receipt.parameters.jsCode.replace('usage,receiptRef}','usage,receiptRef,...(usage&&!it.json.error?{readerResponse:it.json}:{})}');
 const restore=find('Budget · 03b · Restore');
 restore.parameters.jsCode=restore.parameters.jsCode
  .replaceAll('settlementCompleted(result)','(settlementCompleted(result)&&result.body?.responsePreserved===true)')
  .replace('...r.json.original,__budgetAllowed:true','...r.json.original,__budgetAllowed:true,__readerResponsePreserved:true');
 const edge=node=>({node,type:'main',index:0});
 const settled=w.connections['Budget · 03b · Settled'];
 if(settled?.main?.[0]?.length!==1||settled.main[0][0].node!=='Readers done')throw Error('reader_settled_route_changed');
 const pos=find('Budget · 03b · Settled').position;
 const gate={id:randomUUID(),name:'Recovery · Continue preserved reader?',type:'n8n-nodes-base.if',typeVersion:2.2,retryOnFail:false,position:[pos[0]+220,pos[1]],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:"={{ $('02 Ingest files').first().json.reader_recovery === true }}",rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 const ready={id:randomUUID(),name:'Recovery · Preserved reader ready',type:'n8n-nodes-base.code',typeVersion:2,retryOnFail:false,position:[pos[0]+440,pos[1]],parameters:{mode:'runOnceForAllItems',jsCode:requirePreservedReader.toString()+"\nconst it=$input.first();requirePreservedReader($('02 Ingest files').first().json,it.json);return [it];"}};
 w.nodes.push(gate,ready);
 settled.main[0]=[edge(gate.name)];
 w.connections[gate.name]={main:[[edge(ready.name)],[{node:'Readers done',type:'main',index:0}]]};
 w.connections[ready.name]={main:[[edge('04-06 Evidence')]]};
 w.connections['Recovery · Reuse readers?'].main[0]=[edge('03a Eye fallback input')];
 // Existing unused nodes are preserved to keep identities and unrelated drafts.
 w.connections['Recovery · Cached count']={main:[[]]};
 // The normal merge and the recovery gate converge at Evidence. Keep Evidence
 // as the group's single root; the normal merge remains outside the group.
 const merge=find('Readers done');
 for(const g of w.nodeGroups||[]){
  if(g.nodeNames?.includes('04-06 Evidence')&&g.nodeNames.includes(merge.name))g.nodeNames=g.nodeNames.filter(n=>n!==merge.name);
  if(g.nodeIds?.includes(find('04-06 Evidence').id)&&g.nodeIds.includes(merge.id))g.nodeIds=g.nodeIds.filter(id=>id!==merge.id);
 }
 return w;
}
