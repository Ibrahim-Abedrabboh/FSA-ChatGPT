import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {CALL_POLICY,RATES} from '../../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-budget.mjs';
import {operationSlot,providerUsage,permissionGranted,settlementCompleted,budgetHold} from './runtime.mjs';
const declarations=[operationSlot,providerUsage,permissionGranted,settlementCompleted,budgetHold].map(f=>f.toString()).join('\n');
const endpoint='https://midas-a7-owner-preview.netlify.app/api/a7/budget/';
const inboundCredential={httpHeaderAuth:{id:'S6DlmKQiz2USSkNE',name:'A7 GPT bridge inbound'}};
const edge=name=>({node:name,type:'main',index:0});
export function guardWorkflow(source) {
 const w=structuredClone(source),originalNames=new Set(w.nodes.map(n=>n.name)),added=[];
 const find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('node_missing: '+name);return n;};
 if(w.nodes.some(n=>n.name.startsWith('Budget · ')))throw Error('guards_already_present');
 for(const name of Object.keys(CALL_POLICY))find(name);
 const imageBuilder=find('15f Build request');
 const previousConfig="if (['minimal', 'medium', 'high'].indexOf(tl) !== -1) body.generation_config = { thinking_level: tl };";
 if(!imageBuilder.parameters.jsCode.includes(previousConfig))throw Error('image_request_builder_changed');
 imageBuilder.parameters.jsCode=imageBuilder.parameters.jsCode.replace(previousConfig,"body.generation_config = { max_output_tokens: 32768 };\nif (['minimal', 'medium', 'high'].indexOf(tl) !== -1) body.generation_config.thinking_level = tl;");
 imageBuilder.parameters.jsCode=imageBuilder.parameters.jsCode.replace("thinking_level: body.generation_config ? tl : 'model default'","thinking_level: body.generation_config.thinking_level || 'model default', max_output_tokens: 32768");
 const connect=(from,to)=>{w.connections[from]={main:[[edge(to)]]};};
 function add(name,type,parameters,position,extra={}) {
  const n={id:randomUUID(),name,type,typeVersion:type==='n8n-nodes-base.httpRequest'?4.2:type==='n8n-nodes-base.if'?2.2:2,position,parameters,retryOnFail:false,...extra};
  w.nodes.push(n);added.push(name);return n;
 }
 function code(name,jsCode,position){return add(name,'n8n-nodes-base.code',{mode:'runOnceForAllItems',jsCode},position);}
 function http(name,action,position){return add(name,'n8n-nodes-base.httpRequest',{method:'POST',url:endpoint+action,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ $json.budgetRequest }}',options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}},position,{credentials:structuredClone(inboundCredential),onError:'continueRegularOutput'});}
 function branch(name,position,field='__budgetAllowed'){return add(name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:'={{ $json.'+field+' }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},position);}
 let row=0;
 for(const [name,[model,outputTokens]] of Object.entries(CALL_POLICY)) {
  const provider=find(name),image=name==='15g Send to Google',suffix=name.split(' ')[0];
  if(!image) {
   const actualModel=String(provider.parameters.modelId?.value||'').replace(/^models\//,'');
   const actualCap=provider.parameters.options?.maxOutputTokens??provider.parameters.options?.maxTokens;
   if(actualModel!==model||actualCap!==outputTokens)throw Error('provider_policy_changed: '+name);
   if(Object.values(provider.parameters.builtInTools||{}).some(Boolean))throw Error('paid_tools_not_budgeted: '+name);
  }
  const prefix='Budget · '+suffix+' · ',names={ticket:prefix+'Ticket',reserve:prefix+'Reserve',permit:prefix+'Permit',allowed:prefix+'Allowed',hold:prefix+'Hold',receipt:prefix+'Receipt',settle:prefix+'Settle',restore:prefix+'Restore',settled:prefix+'Settled'};
  const x=provider.position[0]-900,y=provider.position[1]+row++*5;
  const point=n=>[x+n*160,y+220];
  const stateExpr=name==='09 Conflict check'?"$('08 Locks and freedoms').first().json":image?"({...$('13 Compile').first().json,stage04:it.json.s04})":name.startsWith('16')?"$('V1 Vault events').first().json":"it.json";
  const configHash=JSON.stringify(provider.parameters);
  code(names.ticket,declarations+`\nconst it=$input.first();
const state=${stateExpr};
${image?`const body=JSON.parse(it.json.body);if(body.model!==${JSON.stringify(model)}||body.generation_config?.max_output_tokens!==${outputTokens}||body.tools?.length)throw Error('image_call_policy_mismatch');`:''}
const crypto=require('crypto');const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const slot=operationSlot(state,${JSON.stringify(name)},it.json);
const binaryHashes={};for(const key of Object.keys(it.binary||{}))binaryHashes[key]=sha(await this.helpers.getBinaryDataBuffer(0,key));
const requestSha256=sha(canonical({parameters:${configHash},input:it.json,state,binaryHashes}));
const budgetRequest={clientId:state.client_run_id,runId:state.run_id,operationKey:'a7:'+sha(canonical(slot)),node:${JSON.stringify(name)},model:${JSON.stringify(model)},outputId:slot.output,inputTokens:${RATES[model].inputLimit},outputTokens:${outputTokens},requestSha256};
return [{json:{budgetRequest,state,original:it.json},binary:it.binary}];`,point(0));
  http(names.reserve,'reserve',point(1));
  code(names.permit,declarations+`\nconst response=$input.first().json;const t=$(${JSON.stringify(names.ticket)}).first();
const allowed=permissionGranted(response);
return [{json:allowed?{...t.json.original,__budgetAllowed:true}:{__budgetAllowed:false,__budgetState:t.json.state,__budgetReason:response.body?.reason==='budget_limit'?'The remaining job limit cannot cover the next call.':'No valid spending permission was received; nothing was sent to the provider.'},binary:allowed?t.binary:undefined}];`,point(2));
  branch(names.allowed,point(3));
  code(names.hold,declarations+`\nconst it=$input.first().json;return [{json:budgetHold(it.__budgetState||$(${JSON.stringify(names.ticket)}).first().json.state,${JSON.stringify(name.startsWith('16')?'05 Review':image?'04 Compile & dispatch':name.startsWith('11')?'03 Retrieve & style':'01 Intake & observe')},${JSON.stringify(name)},it.__budgetReason||'Provider receipt or budget settlement is uncertain. Full reservation retained.')}];`,point(4));
  const usageKind=image?'interaction':provider.type.includes('googleGemini')?'gemini':provider.type.includes('anthropic')?'anthropic':'openai';
  code(names.receipt,declarations+`\nconst it=$input.first();
let t;try{t=$(${JSON.stringify(names.ticket)}).first().json;}catch{throw Error('budget_ticket_missing');}
const reservation=$(${JSON.stringify(names.reserve)}).first().json;
if(!permissionGranted(reservation))throw Error('budget_permit_missing');
const usage=providerUsage(it.json,${JSON.stringify(usageKind)});
const candidateRef=it.json.s04?.receipt?.provider_request_id||it.json.id||it.json.response?.id||'';
const receiptRef=typeof candidateRef==='string'&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(candidateRef)?candidateRef:'';
return [{json:{budgetRequest:{clientId:t.budgetRequest.clientId,operationKey:t.budgetRequest.operationKey,permit:reservation.body.permit,usage,receiptRef},original:it.json},binary:it.binary}];`,point(5));
  http(names.settle,'settle',point(6));
  code(names.restore,declarations+`\nconst result=$input.first().json;const r=$(${JSON.stringify(names.receipt)}).first();
return [{json:settlementCompleted(result)?{...r.json.original,__budgetAllowed:true}:{__budgetAllowed:false,__budgetState:${image?`{...$(${JSON.stringify(names.ticket)}).first().json.state,stage04:r.json.original.s04}`:`$(${JSON.stringify(names.ticket)}).first().json.state`},__budgetReason:'Provider receipt or budget settlement is uncertain. Full reservation retained; do not resend.'},binary:settlementCompleted(result)?r.binary:undefined}];`,point(7));
  branch(names.settled,point(8));
  // Replace every original incoming edge; a provider has no unguarded entry.
  for(const [from,connections] of Object.entries(w.connections))if(originalNames.has(from))for(const outputs of Object.values(connections))for(const group of outputs)for(const e of group)if(e.node===name)e.node=names.ticket;
  connect(names.ticket,names.reserve);connect(names.reserve,names.permit);connect(names.permit,names.allowed);
  w.connections[names.allowed]={main:[[edge(name)],[edge(names.hold)]]};connect(names.hold,'V1 Vault events');
  connect(names.receipt,names.settle);connect(names.settle,names.restore);connect(names.restore,names.settled);
  const receiptSource=image?'15o Final receipt':name;
  const next=structuredClone(w.connections[receiptSource]||{main:[[]]});
  connect(receiptSource,names.receipt);w.connections[names.settled]={...next,main:[next.main[0],[edge(names.hold)]]};
  if(image) {
   // Original stage 04 can reach its final receipt without sending any provider
   // request. Keep that unpaid error path, and never settle a prior image's permit.
   const check=prefix+'Check actual call',skipped=prefix+'Call skipped',keep=prefix+'Keep unpaid receipt';
   code(check,declarations+`\nconst it=$input.first();const crypto=require('crypto');
const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
let ticket;try{ticket=$(${JSON.stringify(names.ticket)}).first().json;}catch{ticket=null;}
const state={...$('13 Compile').first().json,stage04:it.json.s04};
const slot=operationSlot(state,${JSON.stringify(name)},it.json);
const key='a7:'+crypto.createHash('sha256').update(canonical(slot)).digest('hex');
const matches=ticket?.budgetRequest?.operationKey===key;
const skipped=!matches&&it.json.s04?.send===false&&!it.json.s04?.submission;
if(!matches&&!skipped)throw Error('image_budget_receipt_binding_missing');
return [{json:{...it.json,__budgetSkip:skipped},binary:it.binary}];`,[x+900,y+450]);
   branch(skipped,[x+1080,y+450],'__budgetSkip');
   code(keep,"const it=$input.first();const json={...it.json};delete json.__budgetSkip;return [{json,binary:it.binary}];",[x+1260,y+450]);
   connect(receiptSource,check);connect(check,skipped);
   w.connections[skipped]={main:[[edge(keep)],[edge(names.receipt)]]};w.connections[keep]=next;
  }
  provider.retryOnFail=false;delete provider.maxTries;delete provider.waitBetweenTries;
  // n8n groups require a single entry and exit. Extend the existing scope group
  // around its guarded conflict call, and send holds through its existing exit.
  const ownerGroup=(w.nodeGroups||[]).find(g=>g.nodeIds?.includes(provider.id)||g.nodeNames?.includes(name));
  if(ownerGroup) {
   if(name!=='09 Conflict check')throw Error('provider_group_needs_route_review: '+name);
   const local=added.filter(n=>n.startsWith(prefix));
   if(ownerGroup.nodeNames)ownerGroup.nodeNames.push(...local);
   if(ownerGroup.nodeIds)ownerGroup.nodeIds.push(...local.map(n=>find(n).id));
   connect(names.hold,'Contract clear?');
  }
 }
 // Fail closed on any remaining paid-looking model node omitted from the policy.
 const uncovered=w.nodes.filter(n=>originalNames.has(n.name)&&(/googleGemini|anthropic|\.openAi$/.test(n.type))&&!CALL_POLICY[n.name]);
 if(uncovered.length)throw Error('uncovered_paid_nodes: '+uncovered.map(n=>n.name).join(', '));
 return w;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [source,target]=process.argv.slice(2);if(!source||!target)throw Error('Usage: node build-guarded-workflow.mjs baseline.json target.json');
 const baseline=JSON.parse(await readFile(source,'utf8'));
 const guarded=guardWorkflow(baseline);await writeFile(target,JSON.stringify(guarded,null,2));
 console.log(JSON.stringify({nodes:guarded.nodes.length,guardedProviders:Object.keys(CALL_POLICY).length,published:false}));
}
