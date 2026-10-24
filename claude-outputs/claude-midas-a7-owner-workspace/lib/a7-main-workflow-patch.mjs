import {createHash} from 'node:crypto';

const node=(name,type,typeVersion,parameters,extra={})=>{const h=createHash('sha256').update('a7-main-source-continuation:'+name).digest('hex');return {id:`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`,name,type,typeVersion,position:[850,850],parameters,...extra};};
const edge=name=>({node:name,type:'main',index:0});

// Applies a reviewable graph delta to the exact exported main workflow. The
// caller must compare sourceVersionId before uploading any resulting draft.
export function patchMainWorkflow(raw){
 if(raw?.id!=='1cgZc9rmBOrPdKIe'&&raw?.sourceWorkflowId!=='1cgZc9rmBOrPdKIe'||(raw?.versionId||raw?.sourceVersionId)!=='9ad27255-0243-4965-bf4d-eee37edd90a4')throw Error('main_workflow_version_changed');
 const w=structuredClone(raw),find=name=>{const n=w.nodes?.find(x=>x.name===name);if(!n)throw Error('main_node_missing_'+name);return n;};
 const one=find('01 Intent & scope'),restore=find('Receipt · Restore accepted input'),locks=find('08 Locks and freedoms'),reserve=find('Budget · 03 · Reserve');
 if(w.nodes.some(n=>n.name==='Source continuation requested?'))throw Error('main_patch_already_applied');
 const oldRun="const runId = 'claude-a7-' + stamp.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);";
 if(!one.parameters.jsCode.includes(oldRun))throw Error('main_run_logic_changed');
 one.parameters.jsCode=one.parameters.jsCode.replace(oldRun,`const draftId=p.ownerWorkspace?.versionId,requested=Boolean(p.sourceUnderstanding||draftId);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
if(requested&&(!uuid(draftId)||p.clientRunId!=='owner-'+draftId||p.runId!=='claude-a7-'+draftId||!p.sourceUnderstanding?.confirmationFingerprint))throw Error('invalid_preallocated_run');
const runId=requested?p.runId:'claude-a7-'+stamp.replace(/[-:TZ.]/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,8);`);
 if(!one.parameters.jsCode.includes('received_at: stamp,'))throw Error('main_intake_shape_changed');
 one.parameters.jsCode=one.parameters.jsCode.replace('received_at: stamp,','received_at: stamp, ownerWorkspace: requested ? {versionId:draftId,requestId:p.ownerWorkspace.requestId} : null, sourceUnderstanding: requested ? {sourceSha256:p.sourceUnderstanding.sourceSha256,confirmationFingerprint:p.sourceUnderstanding.confirmationFingerprint,receiptFingerprint:p.sourceUnderstanding.receiptFingerprint} : null,');
 const oldConnections=w.connections?.[restore.name]?.main?.[0];
 if(!oldConnections||!['Budget · 03 · Ticket','Budget · 05 · Ticket','Room photo sent?'].every(n=>oldConnections.some(x=>x.node===n)))throw Error('main_reader_route_changed');
 const requested=node('Source continuation requested?','n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ Boolean($json.sourceUnderstanding && $json.ownerWorkspace && $json.run_id === $json.runId) }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
 // The Intake code uses run_id and sourceUnderstanding; the false branch keeps
 // the exact preexisting legacy fan-out for already-running/recovery jobs.
 requested.parameters.conditions.conditions[0].leftValue='={{ Boolean($json.sourceUnderstanding && $json.ownerWorkspace && $json.run_id) }}';
 const proofBody="={{ {draftId: $json.ownerWorkspace.versionId,requestId: $json.ownerWorkspace.requestId,clientRunId: $json.client_run_id,runId: $json.run_id,sourceSha256: $json.sourceUnderstanding.sourceSha256,confirmationFingerprint: $json.sourceUnderstanding.confirmationFingerprint,receiptFingerprint: $json.sourceUnderstanding.receiptFingerprint} }}";
 const proof=node('Claim confirmed source continuation','n8n-nodes-base.httpRequest',reserve.typeVersion,{...structuredClone(reserve.parameters),url:'https://midas-a7-owner-preview.netlify.app/api/a7/budget/source-continuation',jsonBody:proofBody},{credentials:structuredClone(reserve.credentials),retryOnFail:false,onError:'continueRegularOutput'});
 const check=node('Check source continuation','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:`const r=$input.first().json,p=r.body;if(r.statusCode!==200||p?.verified!==true||p.runId!==$('Receipt · Restore accepted input').first().json.run_id||p.clientRunId!==$('Receipt · Restore accepted input').first().json.client_run_id)return [{json:{verified:false}}];return [{json:{verified:true,proof:p}}];`});
 const allowed=node('Source proof accepted?','n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ $json.verified }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
 const evidence=node('Confirmed source evidence','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:`const p=$input.first().json.proof,s=$('Receipt · Restore accepted input').first().json,b=s.brief,f=p.facts,e=p.answers['03 Eye reads the product photo'],q=p.answers['05 Second count'],r=p.answers['06 Room reader'];if(!p.verified||!e||!q||!Number.isSafeInteger(f.physicalCount)||f.physicalCount<1||!Array.isArray(b.inventory))throw Error('source_proof_invalid');const arr=x=>Array.isArray(x)?x:[],observation={category_seen:f.category,colour_observed:e.colour_observed||'',swatch_colours:arr(e.swatch_colours),material_appearance:e.material_appearance||'',pieces_seen:arr(e.pieces),count_eye:arr(e.pieces).filter(x=>x?.role==='product').length,count_second:q.total,count_stated:f.physicalCount,count_printed:null,cropped:Boolean(e.cropped),crop_note:'',hidden:[],readers_used:['03','05',...(r?['06']:[])],views_not_pieces:arr(e.views_not_pieces),signs:arr(e.signs),design_locks:arr(e.design_locks),sided_parts:arr(e.sided_parts),relations:arr(e.relations),relations_second:[],shown_with:arr(e.shown_with),unclear_second:arr(q.unclear),written:{client:b.product_notes||'',files:[],files_not_read:[],photo_text:'',count_written:null,count_from:'owner_confirmed'},room:r?{room_type:f.confirmedRoomType,walls:r.walls,floor:r.floor,windows:r.windows,doors:r.doors,built_ins:r.built_ins,fixed_objects:arr(r.fixed_objects),free_floor_zone:r.free_floor_zone,unknowns:arr(r.unknowns)}:null};return [{json:{...s,source_confirmation_bound:true,source_conflict_answer:p.answers['09 Conflict check'],source_proof:{receiptFingerprint:p.receiptFingerprint,confirmationFingerprint:p.confirmationFingerprint,referenceFingerprint:p.referenceFingerprint},observation,inventory:b.inventory,exclusions:arr(e.pieces).filter(x=>x.role==='excluded').map(x=>({item:x.label||x.kind||'excluded piece'})),conflicts:[],unknowns:arr(f.uncertainties),facts:[],critical:[],hold_for:'',client_question:'',trail:arr(s.trail).concat([{step:5,name:'Confirmed source evidence',at:new Date().toISOString(),note:'Server-verified original reader checkpoints reused; no reader resend'}])}}];`});
 const hold=node('Hold unverified source continuation','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:`const s=$('Receipt · Restore accepted input').first().json;return [{json:{...s,status:'hold',stage:'03 Source verification',hold_for:'owner',hold_reason:'Current confirmed source receipt could not be verified. No reader or planner was started.',client_question:'Check the saved source and receipt; do not resend automatically.',budget_hold:{automatic_resend:false,node:'source-continuation'}}}];`});
 w.nodes.push(requested,proof,check,allowed,evidence,hold);
 w.connections[restore.name].main[0]=[edge(requested.name)];
 w.connections[requested.name]={main:[[edge(proof.name)],oldConnections]};
 w.connections[proof.name]={main:[[edge(check.name)]]};
 w.connections[check.name]={main:[[edge(allowed.name)]]};
 w.connections[allowed.name]={main:[[edge(evidence.name)],[edge(hold.name)]]};
 w.connections[evidence.name]={main:[[edge('Critical unknown?')]]};
 w.connections[hold.name]={main:[[edge('V1 Vault events')]]};
 const fragment="has_open_conflicts: s.conflicts.some(c => c.severity === 'to_classify') || Boolean(s.brief.instructions)";
 if(!locks.parameters.jsCode.includes(fragment))throw Error('main_contract_logic_changed');
 locks.parameters.jsCode=locks.parameters.jsCode.replace(fragment,"has_open_conflicts: s.source_confirmation_bound ? false : (s.conflicts.some(c => c.severity === 'to_classify') || Boolean(s.brief.instructions))");
 const contract=find('09b Contract');
 const oldClass="const ran = s.has_open_conflicts;\nconst classification = ran ? classifierReply(out('09 Conflict check')) : { value: null, reason: 'not_needed' };";
 if(!contract.parameters.jsCode.includes(oldClass))throw Error('main_classifier_logic_changed');
 contract.parameters.jsCode=contract.parameters.jsCode.replace(oldClass,"const ran = s.source_confirmation_bound || s.has_open_conflicts;\nconst preserved = s.source_confirmation_bound ? {output:[{type:'message',role:'assistant',content:[{type:'output_text',text:s.source_conflict_answer}]}]} : out('09 Conflict check');\nconst classification = ran ? classifierReply(preserved) : { value: null, reason: 'not_needed' };");
 // The shared gate now has two sources. Keep the original evidence frame valid
 // by placing that gate outside the former single-entry visual group.
 const criticalId=find('Critical unknown?').id;
 for(const group of w.nodeGroups||[]){
  if(group.nodeIds?.includes(criticalId))group.nodeIds=group.nodeIds.filter(id=>id!==criticalId);
  if(group.nodeNames?.includes('Critical unknown?'))group.nodeNames=group.nodeNames.filter(name=>name!=='Critical unknown?');
 }
 return w;
}
