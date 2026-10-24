// HTTP success alone does not prove that A7 accepted the requested action.
export function actionReceipt(response,expectedClientId){
 const r=response||{};let b=r.body??r.data;
 try{if(typeof b==='string')b=JSON.parse(b);}catch{b=null;}
 const json=b&&typeof b==='object'&&!Array.isArray(b);
 const httpOk=r.statusCode>=200&&r.statusCode<300&&!r.error;
 const intake=json&&b.ok===true&&b.status==='received'&&b.job_id===expectedClientId;
 const decision=json&&b.forwarded===true&&b.id===expectedClientId;
 const accepted=Boolean(httpOk&&(intake||decision));
 const error=!accepted&&json&&/^[a-z_]{1,80}$/.test(b.error||'')?b.error:
  !accepted&&r.statusCode>=500?'upstream_workflow_failed':null;
 // Return an application receipt even for a failed upstream request. An edge
 // gateway can replace HTTP 502 bodies; callers must check accepted explicitly.
 return {http_status:200,accepted,error,forwarded:accepted&&decision,
  runId:accepted&&/^claude-a7-[A-Za-z0-9-]+$/.test(b.run_id||'')?b.run_id:null,
  clientId:accepted?expectedClientId:null,
  upstreamStatus:Number.isInteger(r.statusCode)?r.statusCode:null,
  receiptKind:accepted?'accepted':json?'rejected':r.error?'transport_error':'invalid_response',
  outcome:accepted?'received':'outcome_unknown',
  message:accepted?'A7 received the request. Refresh the queue to see the recorded result.':'A7 did not confirm receipt. Do not send a new request; check the queue first.'};
}
export function installActionReceipt(source){
 const w=structuredClone(source),n=w.nodes.find(n=>n.name==='Safe action receipt');
 if(!n)throw Error('receipt_node_missing');
 n.parameters.jsCode=actionReceipt.toString()+`\nlet expected;try{expected=JSON.parse($('Normalize owner upload').first().json.payload).clientRunId;}catch{try{expected=$('Validate owner decision').first().json.answer.id;}catch{}}return [{json:actionReceipt($input.first().json,expected)}];`;
 return w;
}
