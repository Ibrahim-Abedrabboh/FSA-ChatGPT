(() => {
 const el=id=>document.getElementById(id), node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const dialog=el('actionDialog'), form=el('submissionForm');let pending=null, busy=false, selected=null, selectedSummary='', version=0, submitted=false, reviewing=false, reviewRevision=0;
 const labels={go:'Approve plan · Go 1',change:'Request plan changes',stop:'Stop this run',approve:'Approve image · Go 2',repair:'Request a paid repair',review_again:'Run a paid review again',approve_unreviewed:'Approve by eye · automated review unavailable'};
 const effects={go:'This authorizes image generation, followed by paid review, within A7’s configured limits.',change:'A7 will plan or check the requested changes again. Text model calls may cost money.',stop:'The waiting run will stop. Earlier approved outputs remain recorded.',approve:'A7 packages this approved image. If scenes remain, processing can continue with paid image and review calls.',repair:'A7 will make one paid repair, review it, and ask for approval again.',review_again:'A7 will review the stored image again. No new image call, but review model calls cost money.',approve_unreviewed:'This records your approval without a completed automated review. Remaining scenes may trigger paid processing.'};
 function show(title,lines,request){el('actionTitle').textContent=title;el('actionSummary').replaceChildren(...lines.map(t=>{if(typeof t==='string')return node('p',t);const d=document.createElement('details');d.append(node('summary',t.title));const p=node('p',t.text);p.style.whiteSpace='pre-wrap';d.append(p);return d;}));el('actionConfirmed').checked=false;el('actionStatus').textContent='';pending=request;dialog.showModal();}
 function findingText(value){try{const v=JSON.parse(value);if(v&&typeof v==='object'&&!Array.isArray(v))return [v.name,v.what||v.evidence,v.where?'Where: '+v.where:'',v.fix?'Suggested correction: '+v.fix:'',v.result==='unsure'?'Uncertain':''].filter(x=>typeof x==='string'&&x).join(' · ');}catch{}return value;}
 function error(data,status){return data.error==='edit_flow_not_ready'?'Your edit is saved. Add/remove/replace rendering is deferred and cannot be submitted.':data.error==='owner_actions_not_enabled'?'Owner actions are awaiting the connection check. Your request was not sent.':data.error==='stale_decision'?'This ticket changed. Close this window and reopen the job before deciding.':status===401?'Your session expired. Sign in again.':data.message||'The action was not confirmed. Check the queue before retrying.';}
 const invalidateReview=()=>{reviewRevision++;};form.addEventListener('input',invalidateReview);form.addEventListener('change',invalidateReview);el('promptInput').addEventListener('input',invalidateReview);
 el('cancelAction').addEventListener('click',()=>{if(!busy)dialog.close();});el('closeAction')?.addEventListener('click',()=>{if(!busy)dialog.close();});dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 el('actionForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!pending||!el('actionConfirmed').checked)return;busy=true;el('confirmAction').disabled=true;el('cancelAction').disabled=true;el('actionStatus').textContent='Sending once to A7…';
  const actionRequest=pending;
  try {const response=await fetch(actionRequest.url,{method:'POST',headers:actionRequest.json?{'Content-Type':'application/json'}:{},body:actionRequest.json?JSON.stringify(actionRequest.body):actionRequest.body,signal:AbortSignal.timeout(45000)});const data=await response.json();
   const reconciled=actionRequest.url.startsWith('/api/owner/budgets/')&&data.recorded===true&&data.resend===false;
   if(!response.ok||(!data.accepted&&!reconciled)){el('actionStatus').textContent=error(data,response.status);if(data.error!=='owner_actions_not_enabled')pending=null;return;}
   el('actionStatus').textContent=(data.message||(reconciled?'Billing reconciliation recorded. No provider request was resent.':''))+(data.clientId?' Job: '+data.clientId:'');pending=null;if(selected)loadApproval(selected);if(actionRequest.url==='/api/owner/submissions'){el('submissionStatus').textContent=data.message+' Job: '+data.clientId;form.querySelector('button[type=submit]').disabled=true;}window.dispatchEvent(new Event('a7-action-complete'));
  }catch{el('actionStatus').textContent='Receipt is uncertain. Refresh the queue before sending anything again.';pending=null;}
  finally{busy=false;el('confirmAction').disabled=!pending;el('cancelAction').disabled=false;}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitted||reviewing)return;reviewing=true;const revision=reviewRevision;const reviewButton=form.querySelector('button[type=submit]');reviewButton.disabled=true;
  try{const values=Object.fromEntries(new FormData(form));const file=values.file;if(file?.size>3*1024*1024){el('submissionStatus').textContent='Choose a product photo up to 3 MB.';return;}
  const draft=await window.a7Projects.ready();if(!draft)return;if(revision!==reviewRevision){el('submissionStatus').textContent='The request changed during saving. Review the updated request again.';return;}
  let estimate;try{const response=await fetch('/api/owner/project-estimate/'+encodeURIComponent(draft.id),{cache:'no-store',signal:AbortSignal.timeout(18000)});estimate=await response.json();if(!response.ok||!estimate.fingerprint)throw Error('estimate_unavailable');}catch{el('submissionStatus').textContent='The cost estimate is unavailable. Your draft is saved. Paid processing cannot start.';return;}
  if(revision!==reviewRevision){el('submissionStatus').textContent='The request changed while the estimate loaded. Review the updated request again. No processing started.';return;}
  const id=crypto.randomUUID();const data={...values,requestId:id,draftId:draft.id,estimateConfirmation:{fingerprint:estimate.fingerprint,expiresAt:estimate.expiresAt},instructions:el('promptInput').value.trim(),confirmed:true};delete data.file;delete data.roomFile;delete data.viewFiles;delete data.lookFiles;
  const body=new FormData();body.set('payload',JSON.stringify(data));if(file?.size)body.set('file',file);submitted=true;
  const startLabels={product_collection:'Product or collection',existing_room:'Existing room',new_space:'New styled space',saved_project:'Saved project'};
  show('Review new A7 job',[
   data.product+' · '+data.outcome,
   (estimate.status==='verified'?'Calibrated estimate without repairs: USD ':'Provisional estimate without repairs: USD ')+estimate.noRepairUsd.toFixed(3),
   'With two requested repairs per image: USD '+estimate.twoRepairsEachUsd.toFixed(3),
   'Maximum job budget (separate from the estimate): USD '+data.budgetUsd,
   'Planned outputs: '+estimate.outputs.join(', '),
   ...estimate.warnings,
   'Pieces: '+data.inventory,
   'Scene: '+data.view+' · '+data.aspect+' · '+data.resolution+' · '+data.lighting,
   'Starting point: '+(startLabels[data.startType]||'Product or collection'),
   {title:'What this estimate includes and excludes',text:'Includes: '+estimate.coverage.join('; ')+'\nAdditional costs not included: '+estimate.exclusions.join('; ')+'\nBasis: '+estimate.basis},
   {title:'Complete saved instructions',text:draft.direction},
   {title:'Saved reference details',text:draft.references.map(r=>r.role+' · SHA-256 '+r.sha256).join('\n')+'\nSaved draft: '+draft.id},
   'Sending starts A7 readers and planning, which can incur costs before Go 1. Image generation waits for your separate approval.'
  ],{url:'/api/owner/submissions',body,json:false});
  el('confirmAction').disabled=estimate.status!=='verified'||!estimate.paidReady;
  if(estimate.status!=='verified'||!estimate.paidReady){pending=null;submitted=false;el('actionStatus').textContent=estimate.status!=='verified'?'This scope is not calibrated for paid submission. Your draft is saved.':'Estimate calibrated. Paid submission is paused. Production release: '+({'missing':'not configured','disabled':'disabled','enabled':'enabled'}[estimate.paidReleaseState]||'awaiting verification')+'.';}
  }catch{pending=null;submitted=false;el('submissionStatus').textContent='Request review is unavailable. Draft storage may have completed; reopen the saved draft before retrying.';}finally{reviewing=false;reviewButton.disabled=submitted;}
 });
 dialog.addEventListener('close',()=>{if(pending?.url==='/api/owner/submissions')submitted=false;pending=null;form.querySelector('button[type=submit]').disabled=submitted;});
 const money=micro=>'USD '+(Number(micro)/1000000).toFixed(6).replace(/0+$/,'').replace(/\.$/,'.00');
 async function spendingPanel(clientId,panel) {
  const section=document.createElement('section');section.append(node('h3','Job spending'));panel.append(section);
  if(!/^owner-[a-f0-9-]{36}$/.test(clientId||'')){section.append(node('p','This older job has no owner spending ledger. Paid continuation is unavailable.'));return null;}
  try {
   const response=await fetch('/api/owner/budgets/'+encodeURIComponent(clientId),{cache:'no-store',signal:AbortSignal.timeout(18000)});
   if(response.status===404){section.append(node('p','This job predates the spending ledger. Paid continuation is unavailable.'));return null;}
   if(!response.ok)throw Error('ledger_unavailable');
   const ledger=await response.json(),b=ledger.budget;
   const limit=Number(b.limit_micro_usd),committed=Number(b.committed_micro_usd);
   if(!Number.isSafeInteger(limit)||!Number.isSafeInteger(committed)||limit<0||committed<0||!Array.isArray(ledger.operations))throw Error('invalid_ledger');
   section.append(node('p','Job ceiling: '+money(limit)),node('p','Estimated charges and held reservations: '+money(committed)),node('p','Available for reservations: '+money(Math.max(0,limit-committed))),node('p',ledger.basis));
   for(const output of [...new Set(ledger.operations.map(o=>o.output_id))]){
    const operations=ledger.operations.filter(o=>o.output_id===output),recorded=operations.filter(o=>o.status==='completed').reduce((sum,o)=>sum+Number(o.accounted_micro_usd),0),held=operations.filter(o=>o.status==='reserved'||o.status==='uncertain').reduce((sum,o)=>sum+Number(o.accounted_micro_usd),0);
    const details=document.createElement('details');details.append(node('summary',output==='job'?'Shared job preparation · models and costs':'Image '+output+' · models and costs'),node('p','Models: '+[...new Set(operations.map(o=>o.model))].join(', ')),node('p','Recorded usage cost estimate: '+money(recorded)));
    for(const model of [...new Set(operations.map(o=>o.model))]){
     const calls=operations.filter(o=>o.model===model),cost=calls.filter(o=>o.status==='completed').reduce((sum,o)=>sum+Number(o.accounted_micro_usd),0),pendingCost=calls.filter(o=>o.status==='reserved'||o.status==='uncertain').reduce((sum,o)=>sum+Number(o.accounted_micro_usd),0),reconciled=calls.filter(o=>o.status==='owner_reconciled').reduce((sum,o)=>sum+Number(o.accounted_micro_usd),0);
     details.append(node('p',model+' · recorded usage '+money(cost)+(pendingCost?' · uncertain/pending reservation '+money(pendingCost):'')+(reconciled?' · owner-reported billing '+money(reconciled):'')));
    }
    if(held)details.append(node('p','Cost uncertain / pending — reservation held: '+money(held)));
    if(output==='job')details.append(node('p','Shared reader, scope or planning costs are shown separately; they are not charged again to each image.'));
    section.append(details);
   }
   if(!ledger.operations.length)section.append(node('p','No paid operation has been reserved.'));
   const statuses={reserved:'Awaiting a complete receipt · reservation held',completed:'Usage recorded · token-based cost estimate',uncertain:'Receipt uncertain · full reservation held',owner_reconciled:'Owner-reported billing reconciliation'};
   for(const operation of ledger.operations) {
    const details=document.createElement('details');details.append(node('summary',operation.node_name+' · '+(statuses[operation.status]||'Needs review')),
     node('p','Accounted amount: '+money(operation.accounted_micro_usd)),node('p','Originally reserved: '+money(operation.reserved_micro_usd)),node('p','Output: '+operation.output_id));
    details.append(node('p','Model: '+operation.model));
    if(operation.usage)details.append(node('p','Recorded tokens: '+operation.usage.input+' input · '+operation.usage.output+' output'));
    if(operation.receipt_ref)details.append(node('p','Provider receipt reference: '+operation.receipt_ref));
    if(operation.status==='uncertain') {
     details.append(node('p','Check the provider’s final billing before correcting this record. This records your report; A7 does not independently verify the invoice. It does not resend or resume processing.'));
     const field=(title,type)=>{const label=node('label',title),input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;label.append(input);details.append(label);return input;};
     const amount=field('Final charge in USD','number');amount.min='0';amount.max='10000';amount.step='0.000001';
     const evidence=field('Final billing receipt or reference','text');evidence.maxLength=200;
     const note=field('Reason for this billing correction','textarea');note.maxLength=1000;
     const status=node('p','');status.setAttribute('role','status');details.append(status);
     const button=node('button','Review billing correction');button.type='button';button.addEventListener('click',()=>{
      if(!amount.value||!amount.checkValidity()||!evidence.value.trim()||!note.value.trim()){status.textContent='Enter the final charge, billing reference and reason first.';return;}
      show('Confirm owner billing reconciliation',['Final reported charge: USD '+Number(amount.value).toFixed(6),'Evidence: '+evidence.value.trim(),'Reason: '+note.value.trim(),'This updates accounting only. It does not verify the provider invoice, resend a request or resume the held job.'],{url:'/api/owner/budgets/'+encodeURIComponent(clientId),json:true,body:{requestId:crypto.randomUUID(),operationKey:operation.operation_key,chargedUsd:Number(amount.value),evidence:evidence.value.trim(),note:note.value.trim(),confirmed:true}});el('confirmAction').disabled=false;
     });details.append(button);
    }
    section.append(details);
   }
   return ledger;
  }catch{section.append(node('p','Spending ledger unavailable. Paid decisions are paused; you can still stop a waiting run.'));return null;}
 }
 async function loadApproval(id){selected=id;const v=++version;const target=el('decisionCard');
  try{const response=await fetch('/api/owner/jobs/'+encodeURIComponent(id)+'/approval',{cache:'no-store',signal:AbortSignal.timeout(18000)});const c=await response.json();if(v!==version)return;if(!response.ok)throw new Error('unavailable');
   // Decision wording only while a decision can be sent (run report ff0aa7e5, 4.4): a held run keeps its last ticket's text
   // ("go 2: approve…") with nothing allowed, and the owner read it as a Go waiting. A hold says its reason instead.
   const open=!!c.gate&&c.allowed.length>0,held=/hold/i.test(c.status||'');
   const panel=document.createElement('div');panel.className='decision-body';panel.append(node('strong',open?(c.gate==='go1'?'Plan approval':'Image approval'):held?'On hold · no decision to make':c.gate?'No decision can be sent':'No active approval ticket'),node('p',open?c.decisionNeeded||'A decision is open on this run.':held?'On hold: '+(selectedSummary||'no hold reason was recorded')+'. No Go decision is open on this run, so nothing here approves or repairs it.':selectedSummary||'This run is not waiting for an approval.'));
   if(open)for(const shot of c.shots){const details=document.createElement('details');details.append(node('summary','Shot '+shot.number+' · '+shot.output+' · '+shot.frame));for(const [k,val] of Object.entries(shot.plan)){if(val)details.append(node('p',k+': '+val));}panel.append(details);}
   if(c.gate&&!c.allowed.length)panel.append(node('p','This ticket is expired or cannot be answered safely. No approval will be sent.'));
   c.warnings.forEach(w=>panel.append(node('p','Warning: '+w)));
   if(c.candidate){const a=node('a','Open candidate image ↗');a.href=c.candidate;a.target='_blank';a.rel='noopener noreferrer';panel.append(a);}
   if(c.review?.result)panel.append(node('p','Automated review: '+c.review.result));for(const d of [...(c.review?.defects||[]),...(c.review?.uncertain||[])])panel.append(node('p',findingText(d)));
   const costs=Object.entries(c.cost||{});if(costs.length){const details=document.createElement('details');details.append(node('summary','Recorded cost estimates · USD'));costs.forEach(([k,val])=>details.append(node('p',k.replaceAll('_',' ')+': '+val)));panel.append(details);}
   const ledger=await spendingPanel(c.clientId,panel);if(v!==version)return;
   if(c.status==='hold'&&!c.gate&&ledger&&c.paidReady){
    try{
     const response=await fetch('/api/owner/jobs/'+encodeURIComponent(id)+'/reader-recovery',{cache:'no-store',signal:AbortSignal.timeout(18000)}),recovery=await response.json();
     if(response.ok&&recovery.connection)panel.append(node('p','Submission connection check: '+(recovery.connection.accepted?'passed':String(recovery.connection.upstreamStatus||recovery.connection.transportCode||'unavailable')+' / '+recovery.connection.receiptKind)));
     if(response.ok&&recovery.replacement?.continuationEligible){
      const button=node('button','Review continuation from saved reader answer · no reread');button.type='button';button.addEventListener('click',()=>{show('Continue from the saved replacement answer',['Reuses the completed replacement answer and count of two. No photo reader is called.','Continue the approved white-master scope within the existing remaining budget. The original uncertain charge stays held.','Go 1 and Go 2 remain your decisions. No automatic repairs or extra paid reviews.'],{url:'/api/owner/jobs/'+encodeURIComponent(id)+'/reader-recovery',json:true,body:{requestId:crypto.randomUUID(),revision:recovery.revision,replacementId:recovery.replacement.id,resumePreserved:true,confirmed:true}});el('confirmAction').disabled=false;});panel.append(button);
     }else if(response.ok&&recovery.replacement?.eligible){
      const button=node('button','Review approved replacement reader · USD 0.25 cap');button.type='button';button.addEventListener('click',()=>{
       show('Confirm one replacement reading',['One intentional additional OpenAI reading of the same original photo. The previous completed answer is unavailable.','Reuse the completed count of two. Never resend the uncertain Gemini reader.','Reader reservation limit: USD 0.25. Total additional processing limit: USD 3.872506 within the existing job budget.','One square 2K white master only. Go 1 and Go 2 remain your decisions. No automatic repairs or extra paid reviews.','The old USD 0.846432 uncertain charge stays reserved.'],{url:'/api/owner/jobs/'+encodeURIComponent(id)+'/reader-recovery',json:true,body:{requestId:crypto.randomUUID(),revision:recovery.revision,replacementId:recovery.replacement.id,additionalBudgetUsd:3.872506,readerBudgetUsd:.25,confirmed:true}});el('confirmAction').disabled=false;
      });panel.append(button);
     }else if(response.ok&&recovery.replacement?.requested){panel.append(node('p','Replacement reading was requested. Check this same job; do not send another reading. Go 1 and Go 2 require your decisions.'));}
     if(response.ok&&(recovery.eligible||recovery.resumable)){
      const label=node('label','Maximum additional processing for recovery · USD'),amount=document.createElement('input');amount.type='number';amount.min='.25';amount.max=String(Math.floor(recovery.availableMicroUsd/10000)/100);amount.step='.01';amount.value=amount.max;label.append(amount);panel.append(label);
      const button=node('button',recovery.resumable?'Review pending reader recovery':'Review safe reader recovery');button.type='button';button.addEventListener('click',()=>{
       if(!amount.checkValidity())return;show('Resume with the unused fallback reader',['This continues the same job and keeps its original source.','The completed independent count is reused. The failed primary reader is not sent again.','Its uncertain charge remains reserved. No approval is inherited.','Additional processing ceiling: USD '+amount.value,'The fallback input is counted before generation. If permission or a usable receipt is missing, processing stops.'],{url:'/api/owner/jobs/'+encodeURIComponent(id)+'/reader-recovery',json:true,body:{requestId:crypto.randomUUID(),revision:recovery.revision,additionalBudgetUsd:Number(amount.value),confirmed:true}});el('confirmAction').disabled=false;
      });panel.append(button);
     }else if(response.ok&&recovery.recoveryRequested){panel.append(node('p',recovery.recoveryStarted?'Reader recovery was started. Check this same job for its result; do not submit another recovery.':'Reader recovery was requested but has not started. Existing charges remain reserved. Investigate the pending request before retrying.'));}
    }catch{panel.append(node('p','Safe reader recovery is unavailable. Existing charges remain reserved.'));}
   }
   if(!c.paidReady)panel.append(node('p','Paid processing is paused while spending verification is completed. Stop remains available.'));
   if(c.allowed.length){const label=node('label','Decision note (required for plan changes)');const note=document.createElement('textarea');note.rows=3;note.maxLength=1000;label.append(note);panel.append(label);
    for(const action of c.allowed){const button=node('button',labels[action]);button.type='button';button.disabled=action!=='stop'&&(!c.paidReady||!ledger);button.addEventListener('click',()=>{if(action==='change'&&!note.value.trim()){note.focus();return;}show(labels[action],[effects[action],...(ledger?['Job ceiling: '+money(ledger.budget.limit_micro_usd),'Estimated charges and held reservations: '+money(ledger.budget.committed_micro_usd)]:[]),c.clientId+' · '+c.runId,'Ticket: '+c.gate+' · round '+c.round,'Note: '+(note.value.trim()||'None')],{url:'/api/owner/jobs/'+encodeURIComponent(id)+'/approval',json:true,body:{requestId:crypto.randomUUID(),revision:c.revision,decision:action,note:note.value.trim(),confirmed:true}});el('confirmAction').disabled=false;});panel.append(button);}
   }if(v!==version)return;target.replaceChildren(panel);
  }catch{if(v===version)target.append(node('p','Approval ticket unavailable. Reopen this job to try again.'));}
 }
 window.addEventListener('a7-new-case',()=>{reviewRevision++;if(busy)return;submitted=false;form.reset();el('submissionStatus').textContent='';form.querySelector('button[type=submit]').disabled=false;});
 window.addEventListener('a7-job-loading',()=>{version++;selected=null;});
 window.addEventListener('a7-job-open',event=>{selectedSummary=event.detail.summary||'';loadApproval(event.detail.id);});
})();
