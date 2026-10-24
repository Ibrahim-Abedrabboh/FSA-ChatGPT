import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {BLIND} from '../../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-blind-recovery.mjs';
import {PACKAGE} from '../../../claude-outputs/claude-midas-a7-owner-workspace/lib/a7-package-recovery.mjs';
export function restoreApprovedPackage(c){
 if(c?.ready!==true||c.paidCalls!==0||c.row?.go2_decision!=='approve'||c.decision?.decision!=='approve'||c.review?.result!=='passed'||!c.cost?.operations)throw Error('package_context_missing');
 const r=c.row,contract=JSON.parse(r.contract),s04=JSON.parse(r.stage04),d=c.decision;
 if(c.brief.outputs.some(o=>o.id!=='white_master')||contract.outputs.some(o=>o.kind!=='white'))throw Error('package_paid_path_denied');
 const st={...contract,brief:c.brief,stage04:s04,contract,contract_stamp:r.contract_stamp,contract_version:r.contract_version,observation:JSON.parse(r.observation),references:JSON.parse(r.references),not_applied:JSON.parse(r.not_applied),cost_estimate:JSON.parse(r.cost_estimate),trail:JSON.parse(r.trail),received_at:r.received_at,go1_rounds:r.go1_rounds||0,go1_last:{decision:'go',by:'owner',at:r.go1_at,note:r.go1_note||''},go2_round:d.round,go2_last:d,review:c.review,review_log:JSON.parse(r.review).log||[],stage:'06 Package',status:'white_master_approved',critical:[],text_calls:[],text_calls_new:[],package_cost_history:c.cost};
 st.approved={output_id:d.release.output_id,attempt:c.review.attempt,by:'owner',at:d.at,note:d.note||'',candidate:s04.candidate,release:d.release,contract_stamp:r.contract_stamp,review_result:c.review.result,without_review:false,approval_kind:'approved by the owner',shown_as:d.release.label,client_shown_as:'Approved',product_box_2d:c.review.product_box_2d};
 // Historical calls are restored for summaries only, never appended as new calls.
 st.text_calls=c.cost.operations.filter(o=>o.node!=='15g Send to Google').map(o=>({node:o.node,model:o.model,status:o.status,usd:o.status==='completed'?o.usd:null,held_usd:o.status!=='completed'?o.usd:0,usage:o.usage,receipt_ref:o.receipt_ref,operation_key:o.operation_key,basis:o.basis}));
 return st;
}
export function installPackageRecovery(workflow){
 const w=structuredClone(workflow),find=n=>{const v=w.nodes.find(x=>x.name===n);if(!v)throw Error('node_missing:'+n);return v;};
 if(w.nodes.some(n=>n.name==='Package · Webhook'))throw Error('package_already_installed');
 const id=n=>{const h=createHash('sha256').update('package-recovery:'+n).digest('hex');return h.slice(0,8)+'-0000-4000-8000-'+h.slice(0,12);};
 let x=0;const add=(name,type,parameters,extra={})=>{const n={id:id(name),name,type,typeVersion:type.endsWith('.code')?2:type.endsWith('.httpRequest')?4.2:1,position:[220*x++,3000],parameters,retryOnFail:false,...extra};w.nodes.push(n);return n;};
 const code=(name,jsCode)=>add(name,'n8n-nodes-base.code',{jsCode});
 const link=(a,b,index=0)=>{w.connections[a]??={main:[]};w.connections[a].main[index]??=[];w.connections[a].main[index].push({node:b,type:'main',index:0});};
 const credentials=structuredClone(find('Budget · 03 · Reserve').credentials);
 add('Package · Webhook','n8n-nodes-base.webhook',{httpMethod:'POST',path:'a7/approved-package-recovery',authentication:'headerAuth',responseMode:'responseNode',options:{}},{typeVersion:2.1,credentials,webhookId:id('webhook')});
 code('Package · Authorized request',`const b=$input.first().json.body;if(b?.recoveryId!==${JSON.stringify(PACKAGE.id)}||b.confirmed!==true||b.paidCalls!==0)throw Error('package_request_denied');return [{json:{authorized:true}}];`);
 for(const [name,source,extra] of [['Package · Read run','Blind · Read run',[]],['Package · Read vault','Recovery · Read evidence',[]]]){
  const n=add(name,'n8n-nodes-base.dataTable',structuredClone(find(source).parameters),{typeVersion:1.1,executeOnce:true});
  n.parameters.filters.conditions=[{keyName:'run_id',keyValue:BLIND.runId},{keyName:'client_run_id',keyValue:BLIND.clientId}];n.parameters.returnAll=true;
 }
 code('Package · Evidence',`const rows=$('Package · Read run').all().map(x=>x.json),vault=$input.all().map(x=>x.json);const reviews=vault.filter(x=>x.kind==='review').map(x=>JSON.parse(x.payload)).filter(x=>x.at===${JSON.stringify(PACKAGE.reviewAt)});const decisions=vault.filter(x=>x.kind==='go2_decision').map(x=>JSON.parse(x.payload)).filter(x=>x.at===${JSON.stringify(PACKAGE.approvalAt)});if(rows.length!==1||reviews.length!==1||decisions.length!==1)throw Error('package_evidence_ambiguous');return [{json:{recoveryId:${JSON.stringify(PACKAGE.id)},row:rows[0],review:reviews[0],decision:decisions[0]}}];`);
 const service=(name,action,body)=>add(name,'n8n-nodes-base.httpRequest',{method:'POST',url:'https://midas-a7-owner-preview.netlify.app/api/a7/budget/'+action,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:body,options:{redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}},timeout:25000}},{credentials});
 service('Package · Context read','package-context','={{ $json }}');
 code('Package · Context',`const r=$input.first().json;if(r.statusCode!==200||r.body?.ready!==true||r.body.paidCalls!==0)throw Error('package_context_rejected:'+String(r.body?.error||r.statusCode));return [{json:r.body}];`);
 service('Package · Claim continuation','package-continue',"={{ $('Package · Evidence').first().json }}");
 code('Package · Restored approval',`${restoreApprovedPackage.toString()}\nconst r=$input.first().json;if(r.statusCode!==200)throw Error('package_claim_denied:'+String(r.body?.error||r.statusCode));return [{json:restoreApprovedPackage(r.body)}];`);
 add('Package · Accepted','n8n-nodes-base.respondToWebhook',{respondWith:'json',responseBody:JSON.stringify({accepted:true,recoveryId:PACKAGE.id,runId:BLIND.runId,paidCalls:0,message:'Non-paid packaging claimed once; no image or review call will be repeated.'}),options:{responseCode:202}},{typeVersion:1.4});
 const settings=find('04 Settings');settings.parameters.jsCode=settings.parameters.jsCode.replace("catch{return $('Blind · Context').first().json.row.client_run_id}","catch{try{return $('Blind · Context').first().json.row.client_run_id}catch{return $('Package · Context').first().json.row.client_run_id}}" );
 code('Package · Settings route',`let pack=false;try{pack=$('Package · Context').first().json.ready===true}catch{}return [{json:{...$input.first().json,__packageRecovery:pack}}];`);
 const condition=structuredClone(find('Blind · Settings recovery?').parameters);condition.conditions.conditions[0].leftValue='={{ $json.__packageRecovery }}';condition.conditions.conditions[0].id=id('route');
 add('Package · Settings recovery?','n8n-nodes-base.if',condition,{typeVersion:2.2});
 w.connections['04 Settings']={main:[[{node:'Package · Settings route',type:'main',index:0}]]};link('Package · Settings route','Package · Settings recovery?');link('Package · Settings recovery?','Package · Claim continuation');link('Package · Settings recovery?','Blind · Settings route',1);
 for(const [a,b] of [['Package · Webhook','Package · Authorized request'],['Package · Authorized request','Package · Read run'],['Package · Read run','Package · Read vault'],['Package · Read vault','Package · Evidence'],['Package · Evidence','Package · Context read'],['Package · Context read','Package · Context'],['Package · Context','04 Settings'],['Package · Claim continuation','Package · Restored approval'],['Package · Restored approval','Package · Accepted'],['Package · Accepted','18a Package ticket']])link(a,b);
 for(const [name,file] of [['18a Package ticket','18a_Package_ticket.js'],['18e Check master','18e_Check_master.js'],['18e3 Clean background','18e3_Clean_background.js'],['18p Package result','18p_Package_result.js']]){
  find(name).parameters.jsCode=readFileSync(new URL('../code-nodes/'+file,import.meta.url),'utf8');
 }
 return w;
}
