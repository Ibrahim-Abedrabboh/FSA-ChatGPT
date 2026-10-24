import {repairPreservedContinuation} from './preserved-continuation.mjs';
import {installReaderReplacement} from './reader-replacement.mjs';
import {repairReaderContinuation} from './reader-continuation.mjs';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {restoreReaderCheckpoint,countedReaderInput} from './reader-recovery.mjs';
import {operationSlot,permissionGranted} from './runtime.mjs';
import {repairRecoveryRoute} from './recovery-route.mjs';
import {acknowledgeBeforeProcessing} from './acknowledge-before-processing.mjs';
export function installReaderRecovery(source){
 const w=structuredClone(source),find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('missing_node:'+name);return n};
 if(w.nodes.some(n=>n.name==='Recovery · Request'))throw Error('recovery_already_installed');
 const edge=(node,index=0)=>({node,type:'main',index});
 const connect=(from,to)=>w.connections[from]={main:[[edge(to)]]};
 let i=0;
 const add=(name,type,parameters,extra={})=>{const n={id:randomUUID(),name,type,typeVersion:type==='n8n-nodes-base.httpRequest'?4.5:type==='n8n-nodes-base.if'?2.2:type==='n8n-nodes-base.dataTable'?1.1:2,position:[-2200+(i++%5)*220,-600+Math.floor(i/5)*180],parameters,retryOnFail:false,...extra};w.nodes.push(n);return n;};
 const code=(name,jsCode)=>add(name,'n8n-nodes-base.code',{mode:'runOnceForAllItems',jsCode});
 const branch=(name,expression)=>add(name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
 const options={timeout:25000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}};
 branch('Recovery · Requested?',"={{ $json.__recoveryRequested === true }}");
 code('Recovery · Request',`const it=$input.first();let p=it.json.body?.payload;if(typeof p==='string')p=JSON.parse(p);if(!p?.recovery||!/^owner-[a-f0-9-]{36}$/.test(p.clientRunId||'')||!/^claude-a7-[A-Za-z0-9-]+$/.test(p.recovery.runId||'')||Object.keys(it.binary||{}).length!==1)throw Error('invalid_recovery');const key=Object.keys(it.binary)[0];const bytes=await this.helpers.getBinaryDataBuffer(0,key);const sourceSha256=require('crypto').createHash('sha256').update(bytes).digest('hex');return [{json:{...p,verifiedSourceSha256:sourceSha256},binary:it.binary}];`);
 const table=(name,id,conditions)=>add(name,'n8n-nodes-base.dataTable',{resource:'row',operation:'get',dataTableId:{__rl:true,mode:'id',value:id},matchType:'allConditions',filters:{conditions},returnAll:false,limit:100},{alwaysOutputData:true});
 const filters=[{keyName:'run_id',condition:'eq',keyValue:"={{ $('Recovery · Request').first().json.recovery.runId }}"},{keyName:'client_run_id',condition:'eq',keyValue:"={{ $('Recovery · Request').first().json.clientRunId }}"}];
 table('Recovery · Read run','l0roUCBwIQL3h9Eq',filters);table('Recovery · Read evidence','Tyn4UT6BmIYMHAYl',filters);
 code('Recovery · Restore checkpoint',restoreReaderCheckpoint.toString()+`\nconst it=$('Recovery · Request').first(),key=Object.keys(it.binary)[0];const sha=it.json.verifiedSourceSha256;if(!/^[a-f0-9]{64}$/.test(sha||''))throw Error('recovery_source_unverified');const state=restoreReaderCheckpoint(it.json,$('Recovery · Read run').all().map(x=>x.json),$input.all().map(x=>x.json),sha,key);return [{json:state,binary:it.binary}];`);
 add('Recovery · Claim once','n8n-nodes-base.httpRequest',{method:'POST',url:'https://midas-a7-owner-preview.netlify.app/api/a7/budget/reader-recovery',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:"={{ $('Recovery · Restore checkpoint').first().json.recovery_request }}",options},{credentials:structuredClone(find('Budget · 03 · Reserve').credentials),onError:'continueRegularOutput'});
 code('Recovery · Granted',`const r=$input.first().json,t=$('Recovery · Restore checkpoint').first();if(r.statusCode!==200||r.body?.allowed!==true||r.body.runId!==t.json.run_id||r.body.clientId!==t.json.client_run_id)throw Error('recovery_not_granted');return [{json:t.json,binary:t.binary}];`);
 connect('A7 job webhook','Recovery · Requested?');w.connections['Recovery · Requested?']={main:[[edge('Recovery · Request')],[edge('01 Intent & scope')]]};
 for(const [a,b] of [['Recovery · Request','Recovery · Read run'],['Recovery · Read run','Recovery · Read evidence'],['Recovery · Read evidence','Recovery · Restore checkpoint'],['Recovery · Restore checkpoint','Recovery · Claim once'],['Recovery · Claim once','Recovery · Granted'],['Recovery · Granted','01 Intent & scope']])connect(a,b);
 find('01 Intent & scope').parameters.jsCode="if($input.first().json.reader_recovery===true)return [$input.first()];\n"+find('01 Intent & scope').parameters.jsCode;
 find('02 Ingest files').parameters.jsCode="if($input.first().json.reader_recovery===true)return [$input.first()];\n"+find('02 Ingest files').parameters.jsCode;
 branch('Recovery · Reuse readers?',"={{ $json.reader_recovery === true }}");
 w.connections['Job accepted']={main:[[edge('Send job received'),edge('Recovery · Reuse readers?')]]};
 code('Recovery · Cached count',"const it=$('Job accepted').first();return [{json:{reused:true,total:it.json.cached_second.total},binary:it.binary}];");
 w.connections['Recovery · Reuse readers?']={main:[[edge('03a Eye fallback input'),edge('Recovery · Cached count'),edge('No room photo')],[edge('Budget · 03 · Ticket'),edge('Budget · 05 · Ticket'),edge('Room photo sent?')]]};
 w.connections['Recovery · Cached count']={main:[[edge('Readers done',1)]]};
 const ev=find('04-06 Evidence');
 const replacements=[
  ["const eyeMain = out('03 Eye reads the product photo');","const eyeMain = s.reader_recovery ? {error:'Primary reader unavailable; its uncertain reservation remains held.'} : out('03 Eye reads the product photo');"],
  ["const eyeBack = eyeMain && eyeMain.error ? out('03b Eye fallback (OpenAI)') : null;","const eyeBack = eyeMain && eyeMain.error ? out('Recovery · Fallback result') : null;"],
  ["const secondR = reading(out('05 Second count'), 'The second count');","const secondR = s.reader_recovery ? {data:s.cached_second,fail:null} : reading(out('05 Second count'), 'The second count');"]
 ];
 for(const [a,b]of replacements){if(!ev.parameters.jsCode.includes(a))throw Error('evidence_source_changed');ev.parameters.jsCode=ev.parameters.jsCode.replace(a,b);}
 // Preserve prior text-call evidence without manufacturing or re-recording usage.
 ev.parameters.jsCode=ev.parameters.jsCode.replace("textCall(sTc, 3, '03 Eye reads the product photo'","if(!s.reader_recovery) textCall(sTc, 3, '03 Eye reads the product photo'");
 ev.parameters.jsCode=ev.parameters.jsCode.replace("textCall(sTc, 4, '05 Second count'","if(!s.reader_recovery) textCall(sTc, 4, '05 Second count'");
 // Existing OpenAI fallback uses the same model and prompt, with exact-input
 // preflight. Both count and generation read this one immutable request body.
 const fallback=find('03b Eye fallback (OpenAI)'),prompt=fallback.parameters.text,credentials=structuredClone(fallback.credentials);
 code('Recovery · Fallback request',`const it=$input.first(),key=it.json.product_key;const bytes=await this.helpers.getBinaryDataBuffer(0,key);if(bytes.length>3*1024*1024)throw Error('reader_source_too_large');const mime=it.binary[key].mimeType;if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('reader_source_type');const body={model:'gpt-6.1-sol',input:[{role:'user',content:[{type:'input_text',text:${JSON.stringify(prompt)}},{type:'input_image',detail:'high',image_url:'data:'+mime+';base64,'+bytes.toString('base64')}]}],max_output_tokens:16000,store:false};return [{json:{body,state:it.json},binary:it.binary}];`);
 add('Recovery · Count fallback input','n8n-nodes-base.httpRequest',{method:'POST',url:'https://api.openai.com/v1/responses/input_tokens',authentication:'predefinedCredentialType',nodeCredentialType:'openAiApi',sendBody:true,specifyBody:'json',jsonBody:"={{ {model:$json.body.model,input:$json.body.input} }}",options},{credentials,onError:'continueRegularOutput'});
 const ticket=find('Budget · 03b · Ticket');
 ticket.parameters.jsCode=[operationSlot,countedReaderInput].map(f=>f.toString()).join('\n')+`\nconst t=$('Recovery · Fallback request').first();const crypto=require('crypto');const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);const sha=v=>crypto.createHash('sha256').update(v).digest('hex');const requestSha256=sha(canonical(t.json.body));const counted=countedReaderInput($input.first().json,requestSha256);const state=t.json.state,slot=operationSlot(state,'03b Eye fallback (OpenAI)',state);const budgetRequest={clientId:state.client_run_id,runId:state.run_id,operationKey:'a7:'+sha(canonical(slot)),node:'03b Eye fallback (OpenAI)',model:'gpt-6.1-sol',outputId:slot.output,outputTokens:16000,requestSha256,...counted};return [{json:{budgetRequest,state,original:{...state,__readerBody:t.json.body}},binary:t.binary}];`;
 const oldPermit=find('Budget · 03b · Permit');oldPermit.parameters.jsCode=permissionGranted.toString()+`\nconst response=$input.first().json,t=$('Budget · 03b · Ticket').first(),allowed=permissionGranted(response);return [{json:allowed?{...t.json.original,__budgetAllowed:true}:{__budgetAllowed:false,__budgetState:t.json.state,__budgetReason:'Fallback was not sent: no valid spending permission.'},binary:allowed?t.binary:undefined}];`;
 fallback.type='n8n-nodes-base.httpRequest';fallback.typeVersion=4.5;fallback.parameters={method:'POST',url:'https://api.openai.com/v1/responses',authentication:'predefinedCredentialType',nodeCredentialType:'openAiApi',sendBody:true,specifyBody:'json',jsonBody:'={{ $json.__readerBody }}',options};
 code('Recovery · Fallback result',`const it=$input.first(),r=it.json;if(r.statusCode<200||r.statusCode>=300||!r.body||r.body.error)return [{json:{error:'OpenAI fallback unavailable (HTTP '+(r.statusCode||'unknown')+'). No automatic resend.'}}];return [{json:r.body,binary:it.binary}];`);
 connect('03a Eye fallback input','Recovery · Fallback request');connect('Recovery · Fallback request','Recovery · Count fallback input');connect('Recovery · Count fallback input','Budget · 03b · Ticket');connect('03b Eye fallback (OpenAI)','Recovery · Fallback result');connect('Recovery · Fallback result','Budget · 03b · Receipt');
 return repairPreservedContinuation(installReaderReplacement(repairReaderContinuation(acknowledgeBeforeProcessing(repairRecoveryRoute(w)))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [a,b]=process.argv.slice(2);const w=installReaderRecovery(JSON.parse(await readFile(a,'utf8')));await writeFile(b,JSON.stringify(w));console.log(JSON.stringify({nodes:w.nodes.length,published:false}));}
