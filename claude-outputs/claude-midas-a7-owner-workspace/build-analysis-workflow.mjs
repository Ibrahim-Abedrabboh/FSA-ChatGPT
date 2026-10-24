// Deterministically materializes the analysis-only SDK definition from the
// pinned, sanitized A7 node snapshot. It never contacts or edits n8n.
import {readFile,writeFile} from 'node:fs/promises';
const snapshot=JSON.parse(await readFile(new URL('./a7-analysis-node-snapshot.json',import.meta.url)));
const get=name=>{const node=snapshot.nodes.find(n=>n.name===name);if(!node)throw Error('missing_node_'+name);return node;};
let code=`// Local analysis-only workflow derived from ${snapshot.sourceWorkflowId}, version ${snapshot.sourceVersionId}.\nimport {workflow,node,trigger,ifElse,expr} from '@n8n/workflow-sdk';\n`;
const add=(id,kind,value)=>{code+=`const ${id}=${kind}(${JSON.stringify(value)});\n`;};
const codeNode=(name,jsCode)=>({type:'n8n-nodes-base.code',version:2,config:{name,parameters:{mode:'runOnceForAllItems',jsCode}},output:[{}]});
const original=get('A7 job webhook');
add('inbound','trigger',{type:original.type,version:original.typeVersion,config:{name:'A7 analysis-only webhook',parameters:{...original.parameters,path:'claude-midas-a7-analysis',responseMode:'responseNode'},credentials:original.credentials},output:[{}]});
const intake=`const it=$input.first(),p=(()=>{try{return JSON.parse(it.json.body?.payload)}catch{return null}})(),b=it.binary||{},keys=Object.keys(b);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v),sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
if(!p||p.purpose!=='source_analysis_only'||!uuid(p.draftId)||p.clientRunId!=='owner-'+p.draftId||p.runId!=='claude-a7-'+p.draftId||!uuid(p.requestId)||!sha(p.sourceSha256)||!sha(p.referenceFingerprint)||!sha(p.quoteFingerprint)||!sha(p.intentFingerprint)||!Number.isFinite(p.maxCostUsd)||p.maxCostUsd<.25||p.maxCostUsd>5||!Number.isFinite(p.budgetLimitUsd)||p.budgetLimitUsd<p.maxCostUsd||p.budgetLimitUsd>5||keys.length<1||keys.length>12)throw Error('invalid_analysis_intake');
const crypto=require('crypto'),refs=[];for(const key of keys){const f=b[key],name=f.fileName||'',role=name.startsWith('product-')?'product':name.startsWith('room-')?'room':name.startsWith('other_view-')?'other_view':name.startsWith('look-')?'look':'unassigned',bytes=await this.helpers.getBinaryDataBuffer(0,key);refs.push({key,name,role,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),mime:f.mimeType,image:String(f.mimeType||'').startsWith('image/')});}
const product=refs.filter(r=>r.role==='product'&&r.image),room=refs.filter(r=>r.role==='room'&&r.image);
if(product.length!==1||product[0].sha256!==p.sourceSha256||room.length>1||Boolean(room.length)!==Boolean(p.roomSha256)||room.length&&room[0].sha256!==p.roomSha256||refs.some(r=>r.role==='unassigned'))throw Error('analysis_source_mismatch');
return [{json:{client_run_id:p.clientRunId,run_id:p.runId,source_payload:p,references:refs,product_key:product[0].key,room_key:room[0]?.key||'',brief:{reference_roles:refs.map(r=>({name:r.name,role:r.role}))},not_applied:[],problems:[],trail:[],usable:'ok'},binary:b}];`;
const intakeNode=codeNode('Validate analysis originals',intake);intakeNode.output=[{room_key:''}];add('intake','node',intakeNode);
const stages=['03','05','06','09'],steps=['Ticket','Reserve','Permit','Allowed','Receipt','Settle','Restore','Settled'];
const names=[...stages.flatMap(s=>steps.map(t=>`Budget · ${s} · ${t}`)),'03 Eye reads the product photo','05 Second count','06 Room reader','09 Conflict check'];
const vars={};
for(const name of names){
 const n=get(name),id='n'+name.replace(/[^A-Za-z0-9]/g,'_');vars[name]=id;
 const parameters=structuredClone(n.parameters);
 if(name.endsWith(' · Receipt')){
  const old="const receiptRef=typeof candidateRef==='string'&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(candidateRef)?candidateRef:'';";
  if(!parameters.jsCode.includes(old))throw Error('receipt_logic_changed_'+name);
  parameters.jsCode=parameters.jsCode.replace(old,"const receiptRef=typeof candidateRef==='string'&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(candidateRef)?candidateRef:'answer:'+require('crypto').createHash('sha256').update(JSON.stringify(answerEnvelope(it.json))).digest('hex');");
 }
 if(name==='09 Conflict check')parameters.responses.values[0].content="={{ $('Prepare analysis conflict ticket').first().json.conflict_ticket }}";
 if(name==='Budget · 09 · Ticket')parameters.jsCode=parameters.jsCode.replaceAll("$('08 Locks and freedoms').first().json","$('Prepare analysis conflict ticket').first().json");
 const config={name,parameters,position:n.position};if(n.credentials)config.credentials=n.credentials;if(n.onError)config.onError=n.onError;if(n.retryOnFail!==undefined)config.retryOnFail=n.retryOnFail;
 const output=name.endsWith(' · Ticket')||name.endsWith(' · Receipt')?[{budgetRequest:{}}]:name.endsWith(' · Permit')||name.endsWith(' · Restore')?[{__budgetAllowed:true}]:[{}];
 add(id,n.type==='n8n-nodes-base.if'?'ifElse':'node',{type:n.type,version:n.typeVersion,config,output});
}
const carry="const x=$('Validate analysis originals').first();return [{json:x.json,binary:x.binary}];";
for(const [id,name] of [['after03','Carry after 03'],['after05','Carry after 05'],['after06','Carry after 06']]){const c=codeNode(name,carry);c.output=[{room_key:''}];add(id,'node',c);}
add('roomGate','ifElse',{type:'n8n-nodes-base.if',version:2.2,config:{name:'Typed room present?',parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ $json.room_key }}',operator:{type:'string',operation:'notEmpty'}}],combinator:'and'}}},output:[{}]});
add('conflict','node',codeNode('Prepare analysis conflict ticket',`const take=n=>JSON.stringify($(n).first().json),p=$('Validate analysis originals').first().json.source_payload;return [{json:{...$input.first().json,conflict_ticket:JSON.stringify({source_sha256:p.sourceSha256,eye:take('03 Eye reads the product photo'),second:take('05 Second count'),room:p.roomSha256?take('06 Room reader'):null,instructions:p.instructions||'',conflicts:[],unknowns:[]})},binary:$input.first().binary}];`));
add('finish','node',codeNode('Return verified reader pointers',`const p=$('Validate analysis originals').first().json.source_payload,names=['03','05',...(p.roomSha256?['06']:[]),'09'];const readers=names.map(n=>{const t=$('Budget · '+n+' · Ticket').first().json,r=$('Budget · '+n+' · Receipt').first().json,s=$('Budget · '+n+' · Settle').first().json;if(s.statusCode!==200||s.body?.status!=='completed'||s.body?.responsePreserved!==true)throw Error('analysis_outcome_uncertain');return {node:t.budgetRequest.node,status:'completed',operationKey:t.budgetRequest.operationKey,receiptRef:r.budgetRequest.receiptRef}});return [{json:{status:'analysis_complete',accepted:true,receiptId:require('crypto').randomUUID(),draftId:p.draftId,clientRunId:p.clientRunId,runId:p.runId,sourceSha256:p.sourceSha256,roomSha256:p.roomSha256||null,referenceFingerprint:p.referenceFingerprint,intentFingerprint:p.intentFingerprint,readers}}];`));
add('hold','node',codeNode('Analysis hold',`const p=$('Validate analysis originals').first().json.source_payload;return [{json:{status:'analysis_outcome_uncertain',accepted:false,draftId:p.draftId,clientRunId:p.clientRunId,runId:p.runId,automaticResend:false}}];`));
add('reply','node',{type:'n8n-nodes-base.respondToWebhook',version:1.5,config:{name:'Analysis receipt response',parameters:{respondWith:'json',responseBody:'={{ JSON.stringify($json) }}',options:{responseCode:200,responseHeaders:{entries:[{name:'Cache-Control',value:'no-store'}]}}}},output:[{}]});
const stage=(number,provider,next)=>{const n=step=>vars[`Budget · ${number} · ${step}`];return `${n('Ticket')}.to(${n('Reserve')}).to(${n('Permit')}).to(${n('Allowed')}.onTrue(${vars[provider]}.to(${n('Receipt')}).to(${n('Settle')}).to(${n('Restore')}).to(${n('Settled')}.onTrue(${next}).onFalse(hold.to(reply)))).onFalse(hold.to(reply)))`;};
const nine=stage('09','09 Conflict check','finish.to(reply)');
const six=stage('06','06 Room reader',`after06.to(conflict).to(${nine})`);
const five=stage('05','05 Second count',`after05.to(roomGate.onTrue(${six}).onFalse(conflict.to(${nine})))`);
const three=stage('03','03 Eye reads the product photo',`after03.to(${five})`);
code+=`export default workflow('a7-analysis-only','A7 · Source analysis only').add(inbound).to(intake).to(${three});\n`;
await writeFile(new URL('./a7-analysis-only-workflow.ts',import.meta.url),code);
