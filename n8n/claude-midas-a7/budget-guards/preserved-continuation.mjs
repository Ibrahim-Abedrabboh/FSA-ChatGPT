import {randomUUID} from 'node:crypto';
export function repairPreservedContinuation(source){
 const w=structuredClone(source),find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('missing_node:'+name);return n;},edge=node=>({node,type:'main',index:0});
 if(w.nodes.some(n=>n.name==='Recovery · Use saved reader result'))throw Error('preserved_continuation_already_installed');
 const grant=find('Recovery · Granted');
 grant.parameters.jsCode=grant.parameters.jsCode.replace('return [{json:t.json,binary:t.binary}];',"if(r.body.resumePreserved===true&&(!r.body.readerResponse||r.body.readerResponse.status!=='completed'))throw Error('preserved_response_missing');return [{json:{...t.json,...(r.body.resumePreserved===true?{preserved_reader_response:r.body.readerResponse}:{})},binary:t.binary}];");
 const pos=find('Recovery · Reuse readers?').position;
 const gate={id:randomUUID(),name:'Recovery · Saved answer available?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[pos[0]+220,pos[1]-200],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:'={{ !!$json.preserved_reader_response }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 const input={id:randomUUID(),name:'Recovery · Use saved reader result',type:'n8n-nodes-base.code',typeVersion:2,retryOnFail:false,position:[pos[0]+440,pos[1]-200],parameters:{mode:'runOnceForAllItems',jsCode:"const it=$input.first(),r=it.json.preserved_reader_response;if(it.json.reader_recovery!==true||!it.json.reader_replacement||!r||r.status!=='completed'||!Array.isArray(r.output))throw Error('preserved_response_missing');return [{json:{...r,__budgetAllowed:true,__readerResponsePreserved:true},binary:it.binary}];"}};
 w.nodes.push(gate,input);w.connections['Recovery · Reuse readers?'].main[0]=[edge(gate.name)];w.connections[gate.name]={main:[[edge(input.name)],[edge('03a Eye fallback input')]]};w.connections[input.name]={main:[[edge('Recovery · Preserved reader ready')]]};
 const evidence=find('04-06 Evidence'),needle="const eyeBack = eyeMain && eyeMain.error ? out('Recovery · Fallback result') : null;";if(!evidence.parameters.jsCode.includes(needle))throw Error('evidence_changed');evidence.parameters.jsCode=evidence.parameters.jsCode.replace(needle,"const eyeBack = s.preserved_reader_response || (eyeMain && eyeMain.error ? out('Recovery · Fallback result') : null);");
 // The earlier-contract lookup deliberately emits an empty item on the first
 // contract. Get the immutable job state from Locks, not that lookup item.
 const ticket=find('Budget · 09 · Ticket');if(ticket.parameters.jsCode.includes('const state=it.json;'))ticket.parameters.jsCode=ticket.parameters.jsCode.replace('const state=it.json;',"const state=$('08 Locks and freedoms').first().json;");
 return w;
}
