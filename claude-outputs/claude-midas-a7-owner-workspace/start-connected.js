// Owner API adapter. Saving a draft and submitting a paid job are separate actions.
(() => {
  const $ = id => document.getElementById(id);
  const {state,preferenceFields,preferenceValue,addPrimary,addViews,nextItem} = window.a7Start;
  let collection=null;
  let records = [], draft = null, estimate = null, savePending = null, revisePending = null, busy = false, pendingAction = null, opened = null, editBase = null, pendingRetry = null, revision = 0, jobRevision = 0, expiryTimer = null;
  const dispatchNotes = new Map();
  const touched = new Set();
  const say = message => { const line=$('connectedStatus'); line.textContent = message; line.hidden=false; };
  // An answer appears beside the button that was pressed. #connectedStatus sits at the top of the estimate panel, off screen on a
  // phone and on the hidden results page while setup shows, so it only keeps the latest answer as history.
  // It is hidden while the same answer shows beside the button, so one message is not shown twice (run report ff0aa7e5, 4.1 item 3).
  const quiet = () => { $('connectedStatus').hidden=true; };
  const tell = (id, message) => { const box=$(id); if(box){box.textContent=message;box.hidden=!message;} say(message); if(box&&message)quiet(); };
  // Plain words for refusals that arrive without a message (an older server, or a code the page checks itself).
  const CODE_HELP={unauthorized:'Your sign-in has ended. Sign in again in a new tab, then come back; nothing on this page is lost.',forbidden:'This account is not the studio owner, so the request was refused.',not_found:'The saved version was not found. Refresh saved work and open it again.',draft_changed:'This saved version changed since this page loaded it (in another tab, or by an earlier save). Open it again from Saved work, then save. Nothing was saved.',route_changed:'The work type or route differs from the saved version. Save the originals as a new version instead. Nothing was saved.',direction_too_long:'The direction together with what to change and what to keep is longer than 1,200 characters, the most A7 reads. Shorten it, then save again. Nothing was saved.',result_asset_required:'The approved image this edit starts from is not one of the earlier version’s recorded images. Open that version, choose Edit this result again and save the edit. Nothing was saved.',draft_conflict:'This save was already used for different content. Save again; a new request is made. Nothing was saved.',parent_required:'An edit must start from a saved version. Open it from Saved work first. Nothing was saved.',invalid_project:'The site refused these details as invalid. Check the product details and settings, then save again. Nothing was saved.',project_storage_unavailable:'Saved work is unavailable just now. Try again in a minute; nothing was saved.',budget_lowered:'The job budget is lower than the one already opened for this saved version (its source reading used it). Keep it the same or raise it, then save. Nothing was saved.',
    stale_decision:'This approval ticket changed or expired after the job was opened. Refresh the job, check the new ticket and decide again. Nothing was sent.',change_note_required:'Describe the plan changes in the note before sending. Nothing was sent.',legacy_budget_missing:'This run started before the site kept a spending ledger, so paid steps cannot continue from here. You can still stop it; to try again, save the version again and send a new job.',budget_storage_unavailable:'The spending ledger is unavailable just now, so no paid step can be approved. Try again in a minute; you can still stop the run.',paid_guards_not_ready:'Paid steps are paused on this site; you can still stop.',owner_actions_not_enabled:'Sending to A7 is switched off on this site. Nothing was sent.',approval_context_unavailable:'The approval ticket could not be read from A7 just now. Refresh the job before deciding.',
    analysis_confirmation_incomplete:'Fill in the product category, the physical piece count and, when there is a room photo, the room type before confirming.',analysis_correction_reason_required:'You changed what the readers saw. Explain why in “Explain disputed facts” before confirming.',analysis_conflict_unresolved:'The readers found a conflict. Explain how you resolved it in “Explain disputed facts” before confirming.',analysis_budget_exceeds_limit:'Reading the originals costs more than this job’s budget. Raise the job budget under The product, save, then check analysis availability again. Nothing was paid.',invalid_budget:'Set a job budget from USD 0.25 to USD 10.00 under The product, save, then try again.',analysis_quote_unavailable:'The cost of reading the originals could not be confirmed just now, so no reading can start. Try again in a few minutes. Nothing was paid.',invalid_route_case:'This saved version has no clear work type and route. Choose them under Type of work and save the originals again. Nothing was paid.',saved_version_required:'This edit is not linked to a saved version. Open the saved version from Saved work and start the edit there. Nothing was sent.',hero_product_reference:'A secondary product needs the hero product it supports, and this site cannot send that yet. Choose Main item (hero) under Type of work and save the originals as a new version. Nothing was paid or sent.',source_understanding_unavailable:'Source analysis is unavailable just now. Try again in a minute; nothing was paid.'};
  const budgetNote=message=>{const box=$('budgetAnalysisNote');if(box){box.textContent=message;box.hidden=!message;}};
  const plain=error=>{const code=error?.code||'',text=error?.message||'';if(text&&text!==code&&!/^[a-z0-9_]+$/.test(text))return text;return CODE_HELP[code||text]||`The request was not completed (${String(code||text||'no answer').replace(/_/g,' ')}).`;};
  // A definite refusal (4xx): nothing was stored, so the next attempt is a fresh request, not a retry of this one.
  const definite=error=>Number.isInteger(error?.status)&&error.status>=400&&error.status<500;
  // A failed check of a reading that may have started cannot say whether reads were charged: the refusal's own
  // "nothing was paid" is about a new reading, so it is left out, and the charge is left to the ledger ("2. See the cost of the photo check").
  const unconfirmedCharge=error=>plain(error).replace(/\s*[^.;]*nothing was (paid|recorded)[^.]*\./gi,'').replace(/[;,]\s*$/,'.').trim()+' Whether reads already started were charged is not confirmed until the ledger is checked; do not start another analysis on this version. Use “2. See the cost of the photo check” again later: completed reads are collected from the ledger without a new charge.';
  // Why the server refused a photo, in words (owner-project-references.mjs answers with a code).
  const photoSaveHelp = code => ({origin_rejected:'photos are saved only on the published site, not on a preview link.',reference_limit:'this version already has the most photos allowed.',reference_conflict:'a different photo is already saved in that place.',reference_unavailable:'the server refused or could not store it. It must be a JPEG, PNG or WebP up to 3 MB.',not_found:'the draft was not found or was already sent.',unauthorized:'you are signed out. Sign in again, then save.'}[code] || (/\((401|403)\)/.test(code) ? 'you are signed out. Sign in again, then save.' : /\(429\)/.test(code) ? 'too many requests in the last minute. Wait a minute, then save again.' : code));
  const make = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  window.addEventListener('a7-results-open',()=>{
    if(!state.primary)say('Choose an original product image in setup. Nothing has been uploaded or analysed.');
    else if(!$('connectedProduct').value.trim()||!$('connectedInventory').value.trim())say('Your image is previewed locally, but image analysis is not connected here. Enter the product type and physical pieces (for example, “1 sofa”), then Save draft to store the original and request an estimate.');
    else if(!draft)say('Your source and details are ready to save. Save draft first; then request an estimate. No analysis or paid job starts on this page.');
  });
  async function request(path, options={}) {
    const response = await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(options.method==='POST'?60000:20000),...options});
    // An error reply that is not JSON must not hide the real HTTP status.
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!data || typeof data !== 'object') data = {};
    if (response.status===401) signedOut(); else if (response.ok) { const banner=document.getElementById('sessionBanner'); if(banner) banner.hidden=true; }
    if (!response.ok) throw Object.assign(Error(data.message || data.error || `Request failed (${response.status})`),{code:typeof data.error==='string'?data.error:'',status:response.status,data});
    return data;
  }
  // A sign-in that ended is said once at the top of whichever page is open. Nothing typed or chosen is lost: the owner signs in
  // again in a new tab and comes back to this one.
  function signedOut(){
    let banner=document.getElementById('sessionBanner');
    if(!banner){banner=document.createElement('div');banner.id='sessionBanner';$('main')?.prepend?.(banner);}
    banner.className='source-status error session-banner';banner.setAttribute?.('role','alert');banner.hidden=false;
    const link=document.createElement('a');link.href='/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Sign in again in a new tab';
    banner.replaceChildren(make('span','Your sign-in has ended. '),link,make('span',', then come back; unsaved photos and fields stay on this page.'));
  }
  // Back from another tab (for example after signing in again): check the sign-in once, without leaving this page.
  document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')request('/api/owner/me').catch(()=>{});});
  // sourceReadError: why the saved version's analysis could not be read, so the facts panel does not say "not analysed" instead.
  let understanding=null,analysisQuote=null,analysisRequestId=null,sourceReadError='';
  // The reading's conflict codes (lib/a7-source-understanding.mjs analysisReceipt), in words.
  const conflictWords=(code,o={})=>({reader_count_disagreement:`The two readers counted different numbers of pieces (${o.eyeCount??'?'} and ${o.secondCount??'?'}). Enter the real count.`,stated_count_disagreement:'The count you stated differs from what the readers saw.',category_unknown:'The readers could not name the product category. Type it.',physical_count_unknown:'Neither reader could count the pieces. Enter the count.',piece_kind_unclear:'At least one piece could not be identified. Check the pieces against the photo.',room_type_unknown:'The room type could not be read from the room photo. Type it.',semantic_conflict:'The conflict check found a difference between the photos and your direction (see the reader conflicts).'})[code]||String(code).replace(/_/g,' ');
  function updateSourceResult(){
    const receipt=understanding?.receipt,observed=receipt?.observation,confirmed=understanding?.status==='confirmed';
    const issues=[...(receipt?.conflicts||[]).map(code=>conflictWords(code,observed)),...(receipt?.conflictFindings||[])].filter(Boolean);
    $('resultCategory').textContent=observed?.category?`${confirmed?'Confirmed':'Observed'}: ${observed.category}`:'Unknown';
    $('resultCounts').textContent=observed?`${observed.eyeCount??'?'} / ${observed.secondCount??'?'} readers`:'Not read';
    $('resultRoom').textContent=receipt?.roomObservation?.roomType||'Not supplied or not read';
    $('resultReviewState').textContent=confirmed?'Owner confirmed':receipt?'Awaiting owner review':understanding?.analysis==='running'?'Reading':understanding?.analysis==='stopped'?'Reading stopped':understanding?.status==='pending_or_uncertain'?'Pending or uncertain':understanding?.status==='stale'?'Read for other photos':sourceReadError?'Unknown':'Not analyzed';
    const summary=!draft?'Originals are local until saved.':confirmed?'These source facts were confirmed for the saved version.':receipt?'Reader observations require your review before they become product facts.':understanding?.analysis==='running'?'Reading the originals in the background. Do not start another analysis.':understanding?.analysis==='stopped'?'The background reading stopped before all readings arrived. See Check the photos for the reason.':understanding?.status==='pending_or_uncertain'?'The reader receipt is uncertain; do not repeat the paid call.':understanding?.status==='stale'?'A reading exists, but for a different product or room photo than this version has now, so it is not shown. See Check the photos for what to do.':sourceReadError?'The source analysis could not be read just now. See Check the photos for why.':'No reader observation is available for this saved version.';
    $('resultSourceStatus').textContent=summary;
    $('briefFacts').textContent=summary;
    $('jobPreferencesIntro').textContent=confirmed?'Source facts are confirmed for this saved version. Select requested outputs and constraints below; only verified execution scope can proceed to an estimate.':receipt?'Reader observations are waiting for your review. Preferences remain requests until source facts are confirmed.':'Choose the output requests and constraints below. Source facts have not been confirmed for this case.';
    $('resultPreferenceStatus').textContent=confirmed?'The saved source facts are confirmed. These output choices remain requests until a verified estimate and job submission.':draft?'The originals are saved, but these preferences are not an approved or generated package.':'These are local draft requests; no job has been submitted.';
    const issueText=issues.length?issues:receipt?['No recorded conflict in this reader receipt. Check the originals before confirming.']:understanding?.status==='stale'?['The conflict check ran for photos this version no longer has.']:sourceReadError?['Not known: the source analysis could not be read just now.']:['A source/request conflict check has not run.'];
    for(const id of ['briefConflicts','resultConflictList'])$(id).replaceChildren(...issueText.map(value=>make('li',value)));
    $('resultConflictStatus').textContent=confirmed?'Owner resolution recorded for this saved version.':receipt?'Review each finding against the original and explain any correction under Check the photos.':understanding?.status==='stale'?'The recorded comparison belongs to photos this version no longer has.':'No source/request comparison has been recorded.';
    for(const id of ['sourceBrief','resultConflictPanel'])if($(id).dataset)$(id).dataset.state=confirmed?'confirmed':understanding?.status==='pending_or_uncertain'?'uncertain':'blocked';
  }
  // A started analysis runs in a background function. The page asks for the readings with
  // recover (a ledger read, never a new paid call) until they arrive or the watch times out.
  // A background reading that ended without readings. Reads already paid stay in the ledger, and
  // "2. See the cost of the photo check" still recovers them if every one completed.
  function stoppedText(info){const why=info?.error?` (reason: ${info.error.replaceAll('_',' ')}${info.upstreamStatus?`, A7 answered ${info.upstreamStatus}`:''})`:'';return `The background reading stopped before all readings arrived${why}. Do not start another analysis on this version; use "2. See the cost of the photo check" to recover completed reads, or send the reason to support.`;}
  let analysisWatch=null;
  function watchAnalysis(version){
    if(analysisWatch===version)return;analysisWatch=version;let checks=0;
    const tick=async()=>{
      if(analysisWatch!==version||draft?.id!==version){if(analysisWatch===version)analysisWatch=null;return;}
      checks++;
      try{const result=await request('/api/owner/source-understanding/'+encodeURIComponent(version),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover'})});
        if(result.status!=='pending_or_uncertain'||result.analysis==='stopped'){analysisWatch=null;await refreshSourceReview();return;}}
      // A network failure is retried on the next check. A refusal from the server (the version changed, or
      // is gone) is the answer: show the saved state instead of "Reading" until the watch runs out. An ended
      // sign-in is an answer too: every later check would be refused the same way.
      catch(error){
        if(error?.status===401){analysisWatch=null;$('sourceReviewStatus').textContent='Your sign-in has ended, so this page stopped checking for the readings. The reading itself continues. Sign in again in a new tab, then press “2. See the cost of the photo check”.';return;}
        if(/^(analysis_[a-z_]+|not_found|source_roles_unresolved|unauthorized)$/.test(error?.code||error?.message||'')){analysisWatch=null;await refreshSourceReview();return;}}
      if(checks>=36){analysisWatch=null;$('sourceReviewStatus').textContent='The readings have not arrived after six minutes. Use "2. See the cost of the photo check" later; do not start another analysis.';return;}
      $('sourceReviewStatus').textContent=`Reading the originals in the background… checked ${checks} time${checks===1?'':'s'}. You can leave this page; the result is kept for this saved version.`;
      setTimeout(tick,10000);
    };
    setTimeout(tick,10000);
  }
  // What this reading needs before it can be confirmed: the same rules as confirmUnderstanding (lib/a7-source-understanding.mjs).
  function confirmNeeds(receipt){
    const o=receipt.observation||{},r=receipt.roomObservation,needs=[];
    if(o.eyeCount==null||o.secondCount==null||o.eyeCount!==o.secondCount)needs.push(o.eyeCount!=null&&o.secondCount!=null?`The two readers counted ${o.eyeCount} and ${o.secondCount} pieces: enter the real physical count.`:'Enter the physical piece count; the readers did not agree on one.');
    if(!o.category)needs.push('Type the product category; the readers could not name it.');
    if(r)needs.push(r.roomType?'Check the room type; this version has a room photo.':'Type the room type; it could not be read from the room photo.');
    needs.push(receipt.conflicts?.length?'Explain in “Explain disputed facts” how you resolved the findings above; it is required because the reading found a conflict.':'If you change the category, count or room type, explain why in “Explain disputed facts”.');
    return needs.join(' ');
  }
  function confirmProblem(receipt,{category,count,room,resolution}){
    const o=receipt.observation||{},r=receipt.roomObservation;
    const finalCategory=category||o.category,finalCount=count??(o.eyeCount===o.secondCount?o.eyeCount:null),finalRoom=r?(room||r.roomType):null;
    if(!finalCategory)return 'Type the product category before confirming.';
    if(!Number.isInteger(finalCount)||finalCount<1||finalCount>199)return 'Enter the physical piece count, from 1 to 199, before confirming.';
    if(r&&!finalRoom)return 'Type the room type before confirming; this version has a room photo.';
    const corrected=(o.category&&finalCategory!==o.category)||(o.eyeCount===o.secondCount&&o.eyeCount!=null&&finalCount!==o.eyeCount)||(r?.roomType&&finalRoom!==r.roomType);
    if(corrected&&!resolution)return 'You changed what the readers saw. Explain why in “Explain disputed facts” before confirming.';
    if(receipt.conflicts?.length&&!resolution)return 'The reading found a conflict. Explain how you resolved it in “Explain disputed facts” before confirming.';
    return '';
  }
  // The pieces must add up to the count confirmed in Step 2: the server refuses a mismatch when the job is sent (requireConfirmedSource).
  const pieceTotal=text=>String(text||'').split('\n').map(x=>x.trim()).filter(Boolean).reduce((n,x)=>n+(Number(x.split(/\s+/)[0])||0),0);
  function countMismatch(inventory){
    const facts=understanding?.status==='confirmed'?understanding.confirmation:null;if(!Number.isInteger(facts?.physicalCount))return '';
    const total=pieceTotal(inventory);return total===facts.physicalCount?'':`Pieces add up to ${total}; the confirmed count is ${facts.physicalCount}. Change the pieces and quantities so they add up to ${facts.physicalCount}, then save.`;
  }
  // The same rules "5. Save all details" applies (saveCurrentDraft): one piece per line as a quantity and a name, at most 20 lines,
  // and a job budget from USD 0.25 to USD 10.00 in cents.
  const PIECE_LINE=/^([1-9]\d?|1\d\d)\s+.{1,60}$/; // 1-199, as the server accepts (lib/a7-actions.mjs)
  const budgetValid=value=>Number.isFinite(value)&&value>=.25&&value<=10&&Math.abs(value*100-Math.round(value*100))<=1e-6;
  // Saved values that saving would refuse (run report ff0aa7e5, 4.1 item 2): a version saved with "Four Seater Arm Sofa." as its
  // pieces opened with that field locked, so it could neither be saved nor corrected. Empty fields are handled as "missing".
  function savedProblems(saved={}){
    const problems=[],lines=String(saved.inventory||'').split('\n').map(line=>line.trim()).filter(Boolean),bad=lines.find(line=>!PIECE_LINE.test(line));
    if(lines.length&&(bad||lines.length>20))problems.push({key:'inventory',ids:['connectedInventory','prefInventory'],name:'pieces',words:bad?`the pieces line “${bad.slice(0,80)}” has no quantity; write each piece as a quantity and a name, such as “1 sofa”`:'the pieces have more than 20 lines'});
    if(saved.budgetUsd!==undefined&&saved.budgetUsd!==null&&saved.budgetUsd!==''&&!budgetValid(Number(saved.budgetUsd)))problems.push({key:'budgetUsd',ids:['connectedBudget','prefBudget'],name:'job budget',words:'the job budget is outside USD 0.25 to USD 10.00'});
    return problems;
  }
  async function refreshSourceReview(){
    const status=$('sourceReviewStatus'),facts=$('sourceReviewFacts');
    $('sourceReviewAnalyze').disabled=true;$('sourceReviewCorrection').hidden=true;facts.replaceChildren();
    if(!draft){status.textContent='Save the current original and draft before requesting a separate source-analysis estimate. No image has been read.';updateSourceResult();return;}
    sourceReadError='';let stateRead=false;
    try{
      const id=encodeURIComponent(draft.id);
      understanding=await request('/api/owner/source-understanding/'+id);stateRead=true;
      // The edit options panel (edit-options.js) builds its keep list from the confirmed facts.
      if(understanding?.status==='confirmed'&&typeof CustomEvent==='function')document.dispatchEvent?.(new CustomEvent('a7:source-facts',{detail:understanding.confirmation||null}));
      if(understanding.status==='stale'){status.textContent='The photos were read, but the product or room photo of this version is different now, so that reading does not describe it. Save the originals as a new version and analyze that; the earlier reading stays with the photos it read.';return;}
      if(understanding.receipt){
        const o=understanding.receipt.observation,r=understanding.receipt.roomObservation;
        facts.append(make('p',`Observed category: ${o.category||'unknown'} · physical count: ${o.eyeCount??'unknown'} · independent count: ${o.secondCount??'unknown'} · visible seats: ${o.visibleSeatCount??'unknown'}`));
        if(r)facts.append(make('p',`Room reference: ${r.roomType||'unknown'} · walls: ${r.walls||'unknown'} · floor: ${r.floor||'unknown'}`));
        for(const conflict of understanding.receipt.conflicts||[])facts.append(make('p','Resolve: '+conflictWords(conflict,o)));
        for(const finding of understanding.receipt.conflictFindings||[])facts.append(make('p','Reader conflict: '+finding));
        // The reading stays valid when the direction changes (it measures the photos); its conflict check compared the photos with the earlier text.
        if(understanding.source?.directionChanged)facts.append(make('p','The direction changed after these photos were read. The facts above still describe the photos; the conflict check compared them with the earlier direction, and A7 checks the current direction again when the job is sent.'));
        if(understanding.status==='confirmed'){status.textContent=understanding.inherited?'Source facts reused from the saved version this edit starts from: the photos are the same, so they are not read or paid for again. Changing a photo needs a new analysis.':'Source facts confirmed for this saved version. Changes to originals require review again.';return;}
        $('sourceReviewCategory').value=o.category||'';$('sourceReviewCount').value=o.eyeCount===o.secondCount?String(o.eyeCount??''):'';$('sourceReviewRoom').value=r?.roomType||'';
        $('sourceReviewNeeds').textContent=confirmNeeds(understanding.receipt);tell('sourceReviewConfirmStatus','');
        $('sourceReviewCorrection').hidden=false;status.textContent='Compare these model observations with every original, then confirm or correct them. They are not product facts yet.';return;
      }
      if(understanding.status==='pending_or_uncertain'){
        if(understanding.analysis==='running'){status.textContent='Reading the originals in the background. This page checks for the readings; do not start a second analysis.';watchAnalysis(draft.id);return;}
        if(understanding.analysis==='stopped'){status.textContent=stoppedText(understanding.analysisStopped);return;}
        status.textContent='The analysis receipt is pending or uncertain. Check this saved version later; do not start a second analysis.';return;}
      analysisQuote=await request('/api/owner/source-understanding/'+id+'?action=quote');
      if(analysisQuote.status!=='verified'){status.textContent='Source reading is not connected to a verified cost and reader yet. No paid analysis can start.';return;}
      const ceiling=Number(analysisQuote.source.budgetLimitUsd??draft?.brief?.budgetUsd??5);
      $('sourceReviewAnalyze').disabled=false;status.textContent=`Source analysis reserves up to USD ${analysisQuote.maxCostUsd.toFixed(2)} within your USD ${ceiling.toFixed(2)} total job ceiling. Actual token usage may release unused reserve. It will not generate an image.${(analysisQuote.warnings||[]).map(w=>' Before you pay: '+w).join('')}`;
      budgetNote(`Reading the originals reserves up to USD ${analysisQuote.maxCostUsd.toFixed(2)} of this budget; planning and images use the rest.`);
    }catch(error){understanding=null;analysisQuote=null;if(!stateRead)sourceReadError=plain(error);
      // An owner-fixable refusal (a budget below the reading's cost, a missing route) is said as it is; only a failure is "unavailable".
      // Without the state, a reading may exist: say nothing about charges. With it (only the quote failed), no reading has started.
      status.textContent=!stateRead?'The source analysis state could not be read: '+unconfirmedCharge(error):definite(error)?plain(error):'Source analysis unavailable: '+plain(error);
      if(error?.code==='analysis_budget_exceeds_limit'&&Number.isFinite(error.data?.requiredUsd))budgetNote(`Reading the originals needs up to USD ${error.data.requiredUsd.toFixed(2)}. Raise this budget to at least that, plus what planning and images need, then save.`);}
    finally{updateSourceResult();}
  }
  $('sourceReviewRefresh').addEventListener('click',async()=>{
    if(draft&&understanding?.status==='pending_or_uncertain'){
      try{await request('/api/owner/source-understanding/'+encodeURIComponent(draft.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover'})});}catch(error){$('sourceReviewStatus').textContent='The reading’s receipt could not be checked: '+unconfirmedCharge(error);return;}
    }
    await refreshSourceReview();
  });
  $('sourceReviewAnalyze').addEventListener('click',()=>{
    if(!draft||analysisQuote?.status!=='verified'||!understanding?.source)return;
    const version=draft.id,quote=analysisQuote,requestId=analysisRequestId||crypto.randomUUID();analysisRequestId=requestId;
    showConfirm('Authorize source reading',[`Saved version: ${version}`,`Analysis reservation: up to USD ${quote.maxCostUsd.toFixed(2)}`,`Shared job ceiling, including later planning and generation: USD ${Number(quote.source.budgetLimitUsd??draft?.brief?.budgetUsd??5).toFixed(2)}`,'This reads the original product and any saved room reference. It does not generate an image or approve a plan.',...(quote.warnings||[]).map(w=>'Before you pay: '+w)],async()=>{
      const result=await request('/api/owner/source-understanding/'+encodeURIComponent(version),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analyze',requestId,referenceFingerprint:quote.source.referenceFingerprint,quoteFingerprint:quote.fingerprint,maxCostUsd:quote.maxCostUsd,confirmed:true})});
      await refreshSourceReview();return {message:result.status==='awaiting_confirmation'?'Reader observations are ready for your source review.':result.analysis==='running'?'Analysis started. The readings appear in Source understanding when they are ready.':'Analysis is pending or uncertain; check its status before another action.'};
    });
  });
  $('sourceReviewConfirm').addEventListener('click',async()=>{
    if(!draft||understanding?.status!=='awaiting_confirmation')return;
    const receipt=understanding.receipt,resolution=$('sourceReviewResolution').value.trim(),typed=$('sourceReviewCount').value.trim();
    const answer={category:$('sourceReviewCategory').value.trim(),count:typed?Number(typed):null,room:$('sourceReviewRoom').value.trim(),resolution};
    // Checked here first, with the server's rules, so a missing answer is named beside the button instead of coming back as a code.
    const problem=confirmProblem(receipt,answer);if(problem){tell('sourceReviewConfirmStatus',problem);return;}
    const count=answer.count??receipt.observation?.eyeCount;
    try{const result=await request('/api/owner/source-understanding/'+encodeURIComponent(draft.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',confirmed:true,receiptFingerprint:receipt.fingerprint,category:answer.category,physicalCount:count,roomType:answer.room,resolution,resolvedConflicts:resolution?receipt.conflicts:[]})});
      const facts=result.confirmation;
      if(facts&&!$('connectedProduct').value.trim())$('connectedProduct').value=facts.category;
      const pieces=(facts?.pieces||[]).filter(p=>p.role==='product');
      if(facts&&!$('connectedInventory').value.trim()&&pieces.length===facts.physicalCount&&pieces.every(p=>p.kind&&!/unclear|unknown/i.test(p.kind))){
        const grouped=new Map();for(const piece of pieces)grouped.set(piece.kind,(grouped.get(piece.kind)||0)+1);
        $('connectedInventory').value=[...grouped].map(([kind,n])=>`${n} ${kind}`).join('\n');$('prefInventory').value=$('connectedInventory').value;
      }
      estimate=null;$('submitConnected').disabled=true;$('estimateDetails').replaceChildren();await refreshSourceReview();}
    catch(error){
      // A refused answer is checked against the reading the server holds: reload it, so the findings shown are the ones the
      // next confirmation must cover (the typed answers stay), then say why it was refused.
      if(['analysis_confirmation_incomplete','analysis_correction_reason_required','analysis_conflict_unresolved','analysis_source_changed'].includes(error?.code)){
        const kept=['sourceReviewCategory','sourceReviewCount','sourceReviewRoom'].map(id=>[id,$(id).value]);
        await refreshSourceReview();if(understanding?.status==='awaiting_confirmation')for(const [id,value] of kept)$(id).value=value;}
      tell('sourceReviewConfirmStatus','Source confirmation was not recorded. '+plain(error));}
  });
  const checked = name => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);
  const files = () => [state.primary && !state.primary.file.stored && {file:state.primary.file,role:'product',label:'Primary'},state.room&&{file:state.room.file,role:'room',label:'Room'},state.look&&{file:state.look.file,role:'look',label:'Inspiration'},state.side.left && {file:state.side.left.file,role:'other_view',label:'Left side'},state.side.right && {file:state.side.right.file,role:'other_view',label:'Right side'},...state.views.map((x,i)=>({file:x.file,role:'other_view',label:`Other view ${i+1}`}))].filter(Boolean);
  const sha = async file => [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  window.addEventListener('a7-source-change',()=>resetReview());
  $('prefInventory').addEventListener('input',()=>{ $('connectedInventory').value=$('prefInventory').value; resetReview(true); });
  $('connectedInventory').addEventListener('input',()=>{ $('prefInventory').value=$('connectedInventory').value; resetReview(true); });
  // The job budget is a preference the owner can raise between runs; both fields hold the same value.
  $('prefBudget').addEventListener('input',()=>{ $('connectedBudget').value=$('prefBudget').value; resetReview(true); });
  $('connectedBudget').addEventListener('input',()=>{ $('prefBudget').value=$('connectedBudget').value; });
  function supported() {
    const outcomes = checked('prefOutcome'), images = checked('imageChoice');
    const mapped = new Set(['prefAspect','prefProportions','prefLighting','prefResolution','prefDimensions','prefInventory']);
    const selected = [...touched].filter(id=>id.startsWith('pref')&&!mapped.has(id)&&id!=='prefCamera'&&$(id)?.value);
    return state.primary && files().length===1 && (state.intent==='project' && state.route==='one' || state.intent==='single' && state.route==='hero') && outcomes.length===1 && outcomes[0]==='White BK' && $('imagePreset').value!=='scene-set' && (!images.length || images.length===1 && images[0]==='Clean catalogue') && !selected.length && $('prefCamera').value==='Reference view' && ['', '1:1'].includes($('prefAspect').value) && ['Standard for category','2K'].includes($('prefResolution').value) && ['', 'a7:Daylight'].includes($('prefLighting').value);
  }
  // Verified scope, or any scope the server accepts while the owner test mode is on. The server
  // reports the mode with the estimate and enforces it again on submission.
  const testScope=()=>estimate?.testMode===true&&estimate.status!=='verified';
  // The estimate answers whether the saved version can be sent (sendable, blockers), from the checks the send itself runs. The page's
  // own guess (supported(), from what the page shows) is kept only for an older server: it misjudged a reopened saved version.
  const serverGate=()=>Array.isArray(estimate?.blockers);
  const sendable=()=>Boolean(estimate)&&(serverGate()?estimate.sendable===true:supported()&&estimate.status==='verified'||estimate.testMode===true&&['verified','provisional'].includes(estimate.status));
  function renderSupport(){
    const el=$('executionScopeStatus');
    if(serverGate()){
      const blockers=estimate.blockers.filter(b=>b.code!=='paid_guards_not_ready');
      el.textContent=blockers.length?'This saved version cannot be sent yet: '+blockers.map(b=>b.message).join(' '):estimate.testMode===true&&estimate.status!=='verified'?'Owner test mode: this saved version can be sent after a provisional estimate; spending stops at the job ceiling.':'This saved version can be sent: it passes the checks the send runs. Paid submission still needs confirmed source facts and your separate confirmation.';
      if(el.dataset)el.dataset.state=blockers.length?'blocked':'confirmed';return;
    }
    if(supported()){el.textContent='This request matches the current single-source square 2K white-master scope. Paid submission still requires saved originals, confirmed source facts, a verified estimate and separate confirmation.';if(el.dataset)el.dataset.state='confirmed';return;}
    const reasons=[];
    if(!state.primary)reasons.push('add an original product image');
    else if(files().length!==1)reasons.push('additional reference roles are saved as a draft but not verified for paid submission');
    // Scopes that can never be sent are named first and plainly: the owner should know before paying for a source reading.
    if(state.intent==='single'&&state.route==='secondary')reasons.push('a secondary product needs the hero product it supports, which this site cannot send yet, so it is not read or sent (choose Main item (hero) under Type of work)');
    else if(!(state.intent==='project'&&state.route==='one'||state.intent==='single'&&state.route==='hero'))reasons.push('this work route has no verified paid path');
    const outcomes=checked('prefOutcome');
    if(outcomes.includes('Variations'))reasons.push('Variations cannot be sent yet: they start from an approved result image, which A7 does not keep for earlier runs');
    if(files().length>1)reasons.push('the A7 connection may forward only the product photo, so a version with more photos may be read but not sent');
    if(outcomes.length!==1||outcomes[0]!=='White BK')reasons.push('only one White BK outcome is verified');
    if(!reasons.length)reasons.push('one or more selected views, lighting, dimensions or steering controls are outside the verified path');
    el.textContent=estimate?.testMode===true?'Owner test mode: '+reasons.join('; ')+'. This request can still be sent after a provisional estimate; spending stops at the job ceiling.':'Draft request only: '+reasons.join('; ')+'. You can save the brief and originals; paid submission stays disabled.';
    if(el.dataset)el.dataset.state='blocked';
  }
  function brief() {
    if(opened && state.intent==='edit' && state.route==='saved')return opened.brief;
    return freshBrief();
  }
  // The brief as the Step 3 fields read now, whatever version is open.
  function freshBrief() {
    const outcomes=checked('prefOutcome');
    const outcome=outcomes.length===1?(outcomes[0]==='White BK'?'White background':outcomes[0]==='Lifestyle'?'Lifestyle':''):'';
    const base={product:$('connectedProduct').value.trim(),sku:$('connectedSku').value.trim(),outcome,view:'Category template',aspect:$('prefAspect').value||'1:1',resolution:'2K',lighting:$('prefLighting').value.startsWith('a7:')?$('prefLighting').value.slice(3):'Daylight',dimensions:$('prefDimensions').value.trim(),inventory:$('connectedInventory').value.trim(),budgetUsd:Number($('connectedBudget').value),startType:'product_collection',editSource:state.intent==='edit'?'new':'saved',allowedChanges:state.intent==='edit'?$('editChanges').value.trim():'',protectedDetails:state.intent==='edit'?$('editPreserve').value.trim():'',routeIntent:state.intent,routeChoice:state.route};
    return {...base,...studioChoices(outcomes)};
  }
  // The preferences A7's "01 Intent & scope" reads, as the studio page fields lib/a7-actions.mjs validates
  // (page "studio"). A choice A7 has no field for is not mapped; it stays in the direction text as before.
  const SERIES={'One requested image':'Single image','Three views':'Three views','Views by lighting':'Views by light'};
  const LIGHT={'a7:Daylight':'Daylight','a7:Golden afternoon':'Golden afternoon','a7:Warm evening':'Warm evening','preview:Soft daylight':'Soft daylight','studio:Daylight':'Daylight'};
  function studioChoices(picked){
    const outcomes=picked.filter(o=>o!=='Others'),scene=outcomes.some(o=>o!=='White BK'),value=id=>($(id)?.value||'').trim(),onOff=id=>value(id)==='On'?'yes':'no';
    const lines=(text,test,each,count,split=/[\n,]+/)=>text.split(split).map(x=>x.trim()).filter(x=>x&&test(x)&&x.length<=each).slice(0,count).join('\n');
    const strength=id=>{const v=value(id);return /^(\d{1,2}|100)$/.test(v)?v:'';};
    const count=Number(value('prefVariationCount'));
    const out={page:'studio',outcomes:outcomes.join('\n'),camera:scene?value('prefCamera')||'Reference view':'Reference view',
     resolution:value('prefResolution')==='4K'?'4K':'2K',lighting:scene?LIGHT[value('prefLighting')]??'':'',
     human:scene?onOff('prefHuman'):'no',plants:scene?onOff('prefPlants'):'no',grounding:onOff('prefGrounding'),
     wallPaint:scene?value('prefWall'):'',floor:scene?value('prefFloor'):'',mood:scene?value('prefMood')||'Automatic':'Automatic',
     department:value('prefDepartment').slice(0,80),category:value('prefCategory').slice(0,80),subCategory:value('prefSubcategory').slice(0,160),description:value('prefSupplierFacts').slice(0,1200),
     locks:lines(value('prefPreserve'),()=>true,160,12,/\n+/),itemRole:state.intent==='single'&&state.route==='secondary'?'secondary':'hero',workOn:'one_by_one',
     series:scene?SERIES[value('prefSeries')]||'':'',variationCount:Number.isInteger(count)&&count>=1&&count<=4?String(count):'2',
     midasPicks:scene?lines(value('prefItems'),x=>/^[A-Za-z0-9-]{4,40}$/.test(x),40,12):'',catalogueRefs:scene?lines(value('prefItems'),x=>/^https:\/\/(www\.)?midasfurniture\.com\//i.test(x),200,6):'',
     includeMeta:value('prefMetadata')==='No'?'no':'yes',reviewFirst:value('prefDescriptionReview')==='Proceed without'?'proceed_without':'share_first',
     fidelityStrength:strength('prefFidelity'),stylingStrength:strength('prefStyling'),clutterStrength:strength('prefCluttering')};
    // The two-value primary outcome follows the studio rule: White background only when White BK is the only outcome.
    if(outcomes.length)out.outcome=outcomes.length===1&&outcomes[0]==='White BK'?'White background':'Lifestyle';
    // White catalogue image on demand (20 Oct 2026): written only when the owner unticked it and no outcome needs it.
    if(outcomes.includes('Lifestyle')&&!outcomes.includes('White BK')&&!outcomes.includes('Website')&&$('prefWhiteMaster')?.checked===false)out.whiteMaster='no';
    return out;
  }
  async function snapshot() {
    if(opened && state.intent==='edit' && state.route==='saved'){
      const note=$('chatInput').value.trim();
      if(!note||note.length>1200)throw Error('Enter saved direction within the 1,200 character limit.');
      // The opened version's own edit base and options belong to that version's edit, never to a new edit of it. An unsent edit is
      // revised in place instead (inPlace), so it keeps its own base, options and route: the server refuses a changed route or base.
      const {resultAssetId:_ownBase,editOptions:_ownOptions,...openedBrief}=opened.brief||{},own=inPlace();
      const base=editBase&&editBase.versionId===opened.version_id?{resultAssetId:editBase.assetId}:own&&_ownBase?{resultAssetId:_ownBase}:{};
      const options=$('editOptions')?.value;if(options)base.editOptions=options;else if(own&&_ownOptions)base.editOptions=_ownOptions;
      const route=own?{routeIntent:openedBrief.routeIntent,routeChoice:openedBrief.routeChoice}:{routeIntent:'edit',routeChoice:'saved'};
      // Only the saved values that saving would refuse were unlocked (opened.fix); the owner's correction of them goes into the
      // version this save writes. Every other saved fact stays as the opened version recorded it.
      const fixes=Object.fromEntries((opened.fix||[]).map(problem=>[problem.key,problem.key==='budgetUsd'?Number($('connectedBudget').value):$('connectedInventory').value.trim()]));
      // Scenes from an approved white image (20 Oct 2026): the scene choices and the budget come from Step 3 as it reads now; the
      // product, pieces and photo stay the earlier version's. A7 makes no new white master and takes no edit options.
      if(scenesFromWhite()){
        const fresh=freshBrief(),scene=Object.fromEntries(SCENE_KEYS.filter(k=>fresh[k]!==undefined).map(k=>[k,fresh[k]]));delete base.editOptions;
        return {labels:[],note,brief:{...openedBrief,...fixes,...base,...scene,editBaseKind:'white',allowedChanges:$('editChanges').value.trim(),protectedDetails:$('editPreserve').value.trim(),...route}};
      }
      return {labels:[],note,brief:{...openedBrief,...fixes,...base,allowedChanges:$('editChanges').value.trim(),protectedDetails:$('editPreserve').value.trim(),...route}};
    }
    const labels = await Promise.all(files().map(async ({file,role,label})=>({file,role,label,hash:await sha(file)})));
    const prefs = preferenceFields.filter(([,id])=>touched.has(id)).map(([label,id])=>[label,preferenceValue(id)]).filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`);
    const notes = state.notes.map(x=>typeof x==='string'?x:JSON.stringify(x));
    const lines = [...notes,$('chatInput').value.trim(),...prefs, ...labels.filter(x=>x.role==='other_view').map(x=>`Reference ${x.label}: SHA-256 ${x.hash}`)].filter(Boolean);
    const note = lines.join('\n') || 'Prepare a faithful source-based product image; original source is authoritative.';
    if (note.length>1200) throw Error('Directions exceed the 1,200 character backend limit. Shorten the creative direction or optional preferences.');
    return {labels,note,brief:brief()};
  }
  // Preferences no longer make confirmed source facts stale on the server, so after a change the page
  // re-reads the saved state (a cheap GET) instead of showing the facts as missing.
  let sourceRefreshTimer=null;
  function scheduleSourceRefresh(){clearTimeout(sourceRefreshTimer);sourceRefreshTimer=setTimeout(()=>{if(draft)refreshSourceReview();},600);}
  // A version saved from this page and never sent is updated in place (PATCH) when only its details change: the Step 2 direction or
  // the Step 3 fields. It keeps its id and its source analysis, so nothing is read or paid for again. New photos (keepSource false), a
  // sent version, or another work type or route start a new version instead: the server refuses a changed route (route_changed).
  const routeKey=()=>state.intent+'/'+state.route;
  const patchable=()=>!!draft&&!alreadySent()&&draft.route===routeKey();
  // An opened version that was never sent, and is an edit, is revised in place too, so it keeps the approved image it starts from.
  const unsentOpened=()=>!!opened&&opened.dispatch_state==='draft'&&!opened.client_run_id;
  const inPlace=()=>unsentOpened()&&(opened.brief?.routeIntent==='edit'||!!opened.parent_id);
  const UNSAVED='Details changed since the last save, so the earlier estimate no longer applies. Press 5. Save all details, then 6. Get estimate: the estimate is made from the saved version. If you undo the change, 6. Get estimate works without saving again.';
  // The form as it reads now, for comparing with what the saved version was saved from (draft.formKey, set by each save).
  function formKey(){
    const value=id=>String($(id)?.value??'').trim();
    return JSON.stringify([state.intent,state.route,freshBrief(),value('chatInput'),value('editChanges'),value('editPreserve'),value('editOptions'),state.notes,preferenceFields.map(([,id])=>preferenceValue(id)),[...touched].sort(),files().map(({role,file})=>[role,file?.name,file?.size])]);
  }
  // A save that the estimate may follow: the saved version now matches the form, so 6. Get estimate can be pressed.
  function savedForEstimate(){if(draft)draft.formKey=formKey();$('estimateConnected').disabled=false;}
  // A typed change makes the old estimate unusable (it is cleared here, and sending needs a new one), but it no longer
  // disables 6. Get estimate (run report ff0aa7e5, 4.1 item 1: a budget typed after saving left the button dead with no
  // way forward but a save nobody asked for). Pressing it compares the form with the saved version: unchanged, it asks the
  // server for a fresh estimate of the saved version (bound to its fingerprint, valid 15 minutes); changed, it says to save first.
  function resetReview(keepSource=false) {
    const hadReview=!!draft||!!estimate,moved=!!draft&&!alreadySent()&&draft.route!==routeKey();revision++;clearTimeout(expiryTimer);
    if(!(keepSource&&patchable())){draft=null;revisePending=null;}
    estimate=null;if(draft)scheduleSourceRefresh();else understanding=null;analysisQuote=null;analysisRequestId=null;
    $('sourceReviewStatus').textContent=draft?.sourceOnly?'Draft originals remain saved. Refresh source analysis; save changed details before a job estimate.':draft?'Details changed. Save again: the same saved version is updated and keeps its source analysis.':'Details changed. Save the current version before reviewing source analysis.';
    $('sourceReviewAnalyze').disabled=true;$('sourceReviewCorrection').hidden=true;$('submitConnected').disabled=true; $('estimateDetails').replaceChildren();updateSourceResult();renderSupport();
    if(moved){const message='You changed the work type or route, so the next save starts a new version. The earlier version, and any reading of it, stays in Saved work.';tell('saveSourceStatus',message);if($('setupStatus'))$('setupStatus').textContent+=' '+message;}
    else if(hadReview){if(keepSource)estimateNote(UNSAVED);else say(UNSAVED);}
  }
  ['connectedProduct','connectedInventory','connectedSku','connectedBudget','prefDimensions'].forEach(id=>$(id).addEventListener('input',()=>resetReview(true)));
  // Typing in the source review (count, category, room, resolution) is answering the review, not
  // changing the job; resetting on it collapsed the form on the first keystroke.
  const reviewField=target=>target?.id?.startsWith('sourceReview');
  document.querySelector('#setupPage').addEventListener('input',event=>{ if(reviewField(event.target))return; if(event.target.id?.startsWith('pref'))touched.add(event.target.id); resetReview(true); });
  document.querySelector('#setupPage').addEventListener('change',event=>{ if(reviewField(event.target))return; if(event.target.id?.startsWith('pref'))touched.add(event.target.id); resetReview(true); });
  function lockSavedFields(locked){for(const field of document.querySelectorAll('#jobPreferences input,#jobPreferences textarea,#jobPreferences select,#connectedProduct,#connectedInventory,#connectedSku,#connectedBudget,#sourceCatalogueRefs'))field.disabled=locked;}
  // Scenes from an approved white image: the opened version's approved white master starts new scenes (editBase.kind 'white'),
  // or an unsent version saved that way is opened again. Only the scene choices and the budget can change; the product cannot.
  const SCENE_KEYS=['outcome','outcomes','camera','lighting','aspect','resolution','human','plants','grounding','wallPaint','floor','mood','series','midasPicks','catalogueRefs','fidelityStrength','stylingStrength','clutterStrength','budgetUsd'];
  const SCENE_FIELDS=['prefSeries','prefCamera','prefLighting','prefAspect','prefProportions','prefResolution','prefWall','prefFloor','prefMood','prefHuman','prefPlants','prefGrounding','prefItems','prefStyle','prefStyling','prefCluttering','prefBudget','connectedBudget'];
  function scenesFromWhite(){return !!opened&&((editBase&&editBase.kind==='white'&&editBase.versionId===opened.version_id)||(inPlace()&&opened.brief?.editBaseKind==='white'));}
  function openScenesFromWhite(){
    for(const id of SCENE_FIELDS)if($(id))$(id).disabled=false;
    const choices=[...document.querySelectorAll('input[name="prefOutcome"]')];
    for(const choice of choices){choice.disabled=choice.value==='White BK'||choice.value==='Variations';if(choice.disabled)choice.checked=false;}
    if(!choices.some(choice=>choice.checked)){const lifestyle=choices.find(choice=>choice.value==='Lifestyle');if(lifestyle)lifestyle.checked=true;}
    const name=(editBase&&editBase.fileName)||'the approved white image';
    if(!$('editChanges').value.trim())$('editChanges').value='New lifestyle scenes made from '+name+'. No new white master.';
    if(!$('editPreserve').value.trim())$('editPreserve').value='The product exactly as in the approved white image: every piece, its shape, colour, material and left/right sides.';
  }
  document.querySelector('#setupPage').addEventListener('change',event=>{if(event.target.name==='route'&&event.target.value!=='saved'&&opened){opened=null;editBase=null;lockSavedFields(false);if($('editOptionsPanel'))$('editOptionsPanel').hidden=false;window.a7Start.clearSaved();resetReview();}});
  // Recorded-status groups shared by Saved work and Jobs. Draft, unknown and other states stay in "All" only.
  const ATTENTION=new Set(['hold','needs_attention','needs_owner_action','needs_review','blocked','failed','failure','error','outcome_unknown','pending_or_uncertain','stale','waiting_for_owner']);
  const PROGRESS=new Set(['queued','processing','in_progress','running','started','submitted','received','working','active']);
  const DONE=new Set(['completed','complete','succeeded','success','done']);
  const statusGroup=value=>{const key=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');return ATTENTION.has(key)?'attention':PROGRESS.has(key)?'progress':DONE.has(key)?'done':'other';};
  const badge=value=>{const node=make('span',value?String(value).replace(/_/g,' '):'state unknown');node.className='status-badge is-'+statusGroup(value);return node;};
  // A saved version records only its own dispatch state (draft, confirmed, received, outcome_unknown); it is never
  // updated when the job later finishes. When the loaded job queue holds exactly one job with the version's run ID
  // (or owner request ID), that job's recorded status is used instead. No match, or more than one, keeps the saved state.
  const DISPATCH={draft:['draft','Draft','other'],confirmed:['progress','Sent · receipt not recorded','progress'],sending:['progress','Sent · receipt not recorded','progress'],received:['progress','Received by A7','progress'],outcome_unknown:['attention','Outcome unknown','attention']};
  const dispatchGroup=value=>{const key=String(value||'').trim().toLowerCase();return DISPATCH[key]?.[0]||(ATTENTION.has(key)?'attention':'other');};
  const dispatchBadge=value=>{const key=String(value||'').trim().toLowerCase(),known=DISPATCH[key];const node=make('span',known?known[1]:value?String(value).replace(/_/g,' '):'State not recorded');node.className='status-badge is-'+(known?known[2]:ATTENTION.has(key)?'attention':'other');node.title='Recorded dispatch state: '+(value||'not recorded');return node;};
  const when=value=>{if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);}catch{return date.toISOString();}};
  const attr=(node,name,value)=>{if(node&&typeof node.setAttribute==='function')node.setAttribute(name,value);};
  // Automatic names: each product has a reference (CAT-YYMM-NN, assigned by the server) and a product name; any version
  // made by editing an earlier one is labelled "Edited". Technical IDs stay available as secondary details.
  const CATEGORY_SINGULAR={OFF:'office piece',LGT:'light',TEX:'textile',DIN:'dining piece',BED:'bedroom piece',SOF:'sofa',CHR:'chair',TAB:'table',STO:'storage piece',ACC:'accessory',GEN:'product'};
  const isEdited=version=>!!version.parent_id||version.brief?.routeIntent==='edit';
  const looksLikeFile=value=>/^[\w.\-]{1,60}$/.test(value)&&/\d/.test(value)&&!/\s/.test(value);
  const unnamed=version=>'Unnamed '+(CATEGORY_SINGULAR[version.case_category]||'product');
  function productName(version){const value=String(version.case_title||version.title||'').trim();if(!value)return unnamed(version);return looksLikeFile(value)?`${unnamed(version)} · file ${value}`:value;}
  const versionLabel=version=>`v${version.version??'?'}${isEdited(version)?' · Edited':''}`;
  const refLabel=version=>version.case_ref?`${version.case_ref} ${versionLabel(version)}`:versionLabel(version);
  const versionForJob=job=>records.find(version=>version.version_id&&(version.client_run_id&&version.client_run_id===job.clientId||'owner-'+version.version_id===job.clientId||version.run_id&&version.run_id===job.id));
  // Job names: a job takes the name of the saved version it ran (reference, version, Edited, product name). A version sent
  // more than once is numbered Run 1, Run 2… in the order A7 created the runs. A job that no loaded saved version matches
  // is an "Unlinked job", named by when A7 created it. The A7 run ID and request ID stay available as technical details.
  let jobNames=new Map();
  function nameJobs(){
    const groups=new Map();jobNames=new Map();
    jobs.forEach((job,index)=>{const version=versionForJob(job);if(!version)return;jobNames.set(job.id,{version});const list=groups.get(version.version_id)||[];list.push({id:job.id,index,at:Date.parse(job.createdAt||'')});groups.set(version.version_id,list);});
    for(const list of groups.values()){if(list.length<2)continue;list.sort((a,b)=>(Number.isFinite(a.at)?a.at:Infinity)-(Number.isFinite(b.at)?b.at:Infinity)||a.index-b.index);list.forEach((entry,i)=>{jobNames.get(entry.id).run=i+1;});}
  }
  const UNLINKED_NOTE='No saved version in Saved work matches this job. It may predate saved work, belong to a version that is not loaded, or come from another owner site.';
  function jobName(job){
    const known=jobNames.get(job.id),version=known?.version;
    if(version)return {version,title:`${version.case_ref?refLabel(version):productName(version)+' · '+versionLabel(version)}${known.run?' · Run '+known.run:''}`,product:version.case_ref?productName(version):''};
    return {version:null,title:`Unlinked job · ${when(job.createdAt)||'start time unrecorded'}`,product:''};
  }
  const jobIds=job=>`A7 run ${job.id}${job.clientId&&job.clientId!==job.id?' · request '+job.clientId:''}`;
  const niceName=value=>{const text=String(value||'').replace(/\s+/g,' ').trim().slice(0,110);if(!text)return '';const cased=text===text.toUpperCase()?text.toLowerCase().replace(/(^|[\s(/-])([a-z])/g,(m,a,b)=>a+b.toUpperCase()):text[0].toUpperCase()+text.slice(1);return cased.replace(/\s-\s/g,' — ');};
  // Product name for a new save: the Midas catalogue name when the source came from Midas, else the product type and SKU.
  function autoCaseName(){
    const midas=window.a7Start?.state?.primary?.midasName;if(midas)return niceName(midas).slice(0,120);
    const type=niceName($('connectedProduct').value),sku=$('connectedSku').value.trim();
    return [type,sku?`SKU ${sku}`:''].filter(Boolean).join(' · ').slice(0,120);
  }
  let jobsState='loading';
  function jobMatch(version){
    const runId=version.run_id,clientId=version.client_run_id,queue=jobs;
    const matches=runId?queue.filter(job=>job.id===runId&&(!clientId||!job.clientId||job.clientId===clientId)):clientId?queue.filter(job=>job.clientId===clientId):[];
    return {job:matches.length===1?matches[0]:null,count:matches.length};
  }
  const linkedJob=version=>jobMatch(version).job;
  function savedGroup(version,job=linkedJob(version)){return job?statusGroup(job.status):dispatchGroup(version.dispatch_state);}
  function savedStageText(version,{job,count}){
    if(job)return `A7 job · ${job.stage||'stage not recorded'}`;
    if(count>1)return 'More than one job matches · showing the saved state';
    if(!version.run_id&&!version.client_run_id)return String(version.dispatch_state||'').toLowerCase()==='draft'?'No job yet':'No job recorded';
    return jobsState==='loaded'?'No matching job in the loaded queue':jobsState==='failed'?'Job status unavailable':'Checking the job queue…';
  }
  const PAGE=12;let savedFilter='all',savedQuery='',savedLimit=PAGE;
  const compared=new Set(),savedAnalysisCache=new Map();let compareInputs=[];
  // Work type and outcome come only from what each version recorded; older drafts without them read "Not recorded".
  const WORK_LABELS={project:'New project',single:'Single product',edit:'Edit'};
  const workOf=version=>{const intent=version.brief?.routeIntent;return WORK_LABELS[intent]?intent:version.parent_id?'edit':'unrecorded';};
  const outcomeOf=version=>{const value=typeof version.brief?.outcome==='string'?version.brief.outcome.trim():'';return value||'unrecorded';};
  const optionValue=id=>{const node=$(id);return node&&node.value?node.value:'';};
  function fillFilter(id,allLabel,entries){
    const select=$(id);if(!select)return;const prior=select.value||'';
    select.replaceChildren(new Option(allLabel,''));
    for(const [value,label,count] of entries)select.add(new Option(`${label} (${count})`,value));
    select.value=entries.some(([value])=>value===prior)?prior:'';
  }
  function renderSavedFilters(versions){
    const tally=fn=>{const counts=new Map();for(const version of versions){const key=fn(version);counts.set(key,(counts.get(key)||0)+1);}return counts;};
    const works=tally(workOf),outcomes=tally(outcomeOf);
    fillFilter('savedWorkType','All work types',[...['project','single','edit'].filter(key=>works.has(key)).map(key=>[key,WORK_LABELS[key],works.get(key)]),...(works.has('unrecorded')?[['unrecorded','Not recorded',works.get('unrecorded')]]:[])]);
    fillFilter('savedWorkOutcome','All outcomes',[...[...outcomes.keys()].filter(key=>key!=='unrecorded').sort().map(key=>[key,key,outcomes.get(key)]),...(outcomes.has('unrecorded')?[['unrecorded','Not recorded',outcomes.get('unrecorded')]]:[])]);
  }
  function savedMatches(version){
    const job=linkedJob(version);
    if(savedFilter!=='all'&&savedGroup(version,job)!==savedFilter)return false;
    const work=optionValue('savedWorkType'),outcome=optionValue('savedWorkOutcome');
    if(work&&workOf(version)!==work)return false;
    if(outcome&&outcomeOf(version)!==outcome)return false;
    const query=savedQuery.trim().toLowerCase();if(!query)return true;
    return [version.case_ref,productName(version),isEdited(version)?'edited':'',version.case_title,version.title,version.version_id,version.run_id,version.client_run_id,version.dispatch_state,'version '+version.version,WORK_LABELS[workOf(version)],version.brief?.outcome,version.brief?.sku,version.brief?.product,job?.id,job?.clientId,job?.status,job?.stage].some(value=>String(value??'').toLowerCase().includes(query));
  }
  function renderSavedSummary(versions){
    const summary=$('savedWorkSummary');if(!summary)return;
    const count=group=>versions.filter(version=>savedGroup(version)===group).length;
    const projects=new Set(versions.map(version=>version.id||version.title)).size;
    const rows=[['Recorded versions',versions.length,`${projects} project${projects===1?'':'s'}`],['Drafts',count('draft'),'Saved, not yet sent'],['In progress',count('progress'),'Active jobs, or sent and awaiting a job match'],['Needs attention',count('attention'),'Held, for review, failed or outcome unknown'],['Completed',count('done'),'Linked job recorded as complete']];
    summary.replaceChildren(...rows.map(([label,value,caption])=>{const row=document.createElement('div');row.className='ledger-stat'+(label==='Needs attention'&&value?' is-attention':'');const note=make('dd',caption);note.className='ledger-caption';row.append(make('dt',label),make('dd',String(value)),note);return row;}));
  }
  function updateCompare(){
    const button=$('compareSavedVersions');if(!button)return;
    button.textContent=`Compare selected (${compared.size}/3)`;button.disabled=compared.size<2;
    for(const input of compareInputs)input.disabled=!input.checked&&compared.size>=3;
  }
  function renderSavedWork(){
    const list=$('savedWorkList'),versions=records.filter(item=>item.version_id);
    renderSavedFilters(versions);
    const visible=versions.filter(savedMatches),shown=visible.slice(0,savedLimit);
    list.replaceChildren();renderSavedSummary(versions);compareInputs=[];
    const filtered=visible.length!==versions.length;
    $('savedWorkStatus').textContent=!versions.length?'No saved versions were returned for this owner. Save the photos (1. Save the photos, under Check the photos) to see it here.':!visible.length?'No saved versions match these filters or search. Choose All, reset the work type and outcome, or clear the search.':filtered||shown.length<visible.length?`Showing ${shown.length} of ${visible.length} matching version${visible.length===1?'':'s'} (${versions.length} recorded). Open one to review its original references.`:`${versions.length} recorded version${versions.length===1?'':'s'} shown. Open one to review its original references.`;
    if(records.length>=300)$('savedWorkStatus').textContent+=' The owner API returns at most 300 rows, so older versions may be missing from these counts.';
    if(jobsState==='failed'&&versions.length)$('savedWorkStatus').textContent+=' Job status is unavailable, so sent versions show their saved dispatch state.';
    const more=$('savedWorkMore');if(more){const remaining=visible.length-shown.length;more.hidden=remaining<=0;more.textContent=`Show ${Math.min(PAGE,remaining)} more of ${remaining}`;}
    for(const version of shown){
      const card=document.createElement('section');card.className='ledger-row';
      const caseTitle=productName(version),match=jobMatch(version),job=match.job;
      const title=make('h3',caseTitle);title.className='ledger-title';
      if(version.case_ref){const ref=make('span',version.case_ref);ref.className='ledger-ref';title.prepend?.(ref);}
      if(isEdited(version)){const tag=make('span','Edited');tag.className='edited-tag';title.append(tag);}
      const ids=[`${version.title||'Project'} · ${versionLabel(version)}`,`ID ${String(version.version_id).slice(0,8)}`];if(version.run_id)ids.push('run '+version.run_id);
      const meta=make('p',ids.join(' · '));meta.className='ledger-meta';meta.title='Version ID '+version.version_id;
      const created=when(version.created_at),date=document.createElement('p');date.className='ledger-date';
      const dateLabel=make('span',created?'Project created':'Project date');dateLabel.className='ledger-date-label';date.append(dateLabel,make('span',created||'Not recorded'));
      const work=workOf(version),outcome=outcomeOf(version);
      const kind=document.createElement('p');kind.className='ledger-kind';
      const workText=make('span',work==='unrecorded'?'Type not recorded':WORK_LABELS[work]),outcomeText=make('span',outcome==='unrecorded'?'Outcome not recorded':outcome);
      workText.className='ledger-work';outcomeText.className='ledger-outcome';kind.append(workText,outcomeText);
      const state=job?badge(job.status):dispatchBadge(version.dispatch_state);if(job)state.title='Linked job status: '+(job.status||'not recorded');
      card.append(title,meta,date,kind,state);
      const stage=document.createElement('p');stage.className='ledger-stage';stage.append(make('span',savedStageText(version,match)));if(job)stage.title=`Job ${job.clientId||job.id}`;
      if(job){const view=make('button','View job');view.type='button';view.className='ledger-link';attr(view,'aria-label',`View job ${version.case_ref||job.clientId||job.id} for ${caseTitle}`);view.addEventListener('click',()=>showJob(job.id));stage.append(view);}
      // Edit phase 2.5: a send whose receipt was never recorded is checked against A7 before anything is sent again,
      // and a held or failed edit can be retried from the same approved image with the same choices.
      const unsettled=['confirmed','sending','outcome_unknown'].includes(String(version.dispatch_state||'').toLowerCase());
      if(!job&&unsettled){const check=make('button','Check with A7');check.type='button';check.className='ledger-link';attr(check,'aria-label',`Check whether A7 received ${version.case_ref?version.case_ref+' ':''}${caseTitle}, version ${version.version}`);check.addEventListener('click',()=>checkDispatch(version,check));stage.append(check);}
      if(job&&version.parent_id&&version.brief?.resultAssetId&&retryable(job.status)){const retry=make('button','Retry this edit');retry.type='button';retry.className='ledger-link';attr(retry,'aria-label',`Retry the edit ${version.case_ref?version.case_ref+' ':''}${caseTitle}, version ${version.version}`);
        if(!records.some(x=>x.version_id===version.parent_id)){retry.disabled=true;retry.title='The version this edit starts from is not loaded. Refresh saved work first.';}else retry.addEventListener('click',()=>retryEdit(version));stage.append(retry);}
      card.append(stage);
      if(dispatchNotes.has(version.version_id)){const note=make('p',dispatchNotes.get(version.version_id));note.className='ledger-note';attr(note,'role','status');card.append(note);}
      const open=make('button','Edit this version');open.type='button';open.className='ledger-action';attr(open,'aria-label',`Edit ${version.case_ref?version.case_ref+' ':''}${caseTitle}, version ${version.version}`);open.addEventListener('click',()=>editVersion(version.version_id,null));card.append(open);
      const choice=document.createElement('label');choice.className='ledger-compare-choice';
      const box=document.createElement('input');box.type='checkbox';box.checked=compared.has(version.version_id);box.value=version.version_id;attr(box,'aria-label',`Compare ${caseTitle}, version ${version.version}`);
      box.addEventListener('change',()=>{if(box.checked){if(compared.size>=3){box.checked=false;return;}compared.add(version.version_id);}else compared.delete(version.version_id);updateCompare();});
      choice.append(box,make('span','Compare'));card.append(choice);compareInputs.push(box);
      list.append(card);
    }
    updateCompare();
  }
  function showJob(id){
    const filter=$('jobStatusFilter');if(filter&&filter.value&&!jobs.some(job=>job.id===id&&job.status===filter.value))filter.value='';
    $('jobSelect').value=id;renderJobSelect();openJob(id);
    $('jobsSection').scrollIntoView?.({block:'start'});$('connectedJobDetail').focus?.({preventScroll:true});
  }
  // Comparison reads saved records only: the version fields, its stored originals and any analysis already on file.
  function analysisText(state){
    if(state?.readError)return 'Saved analysis could not be checked: '+state.readError;
    if(state?.status==='not_started')return 'No analysis on file for this version.';
    if(state?.status==='stale')return 'An analysis exists, but this version’s photos or written direction changed after it was authorized, so it is stale.';
    if(state?.status==='pending_or_uncertain')return 'Analysis was started; its receipt is pending or uncertain.';
    if(state?.status==='awaiting_confirmation')return 'AI observations on file, not yet confirmed by the owner.';
    if(state?.status==='confirmed')return 'AI observations on file; owner-confirmed facts below.';
    return `Analysis state: ${state?.status||'unknown'}.`;
  }
  function renderAnalysis(box,state){
    box.append(make('p',analysisText(state)));
    const observation=state?.receipt?.observation;
    if(observation){
      box.append(make('p',`Observed: ${observation.category||'category unknown'} · readers ${observation.eyeCount??'?'} / ${observation.secondCount??'?'}${observation.visibleSeatCount!=null?` · ${observation.visibleSeatCount} visible seats`:''}`));
      for(const uncertainty of observation.uncertainties||[])box.append(make('p','Uncertain: '+uncertainty));
    }
    const confirmed=state?.status==='confirmed'&&state.confirmation;
    if(confirmed){box.append(make('p',`Confirmed: ${confirmed.category||'category not recorded'} · ${confirmed.physicalCount??'?'} physical piece${confirmed.physicalCount===1?'':'s'}${confirmed.confirmedRoomType?` · room ${confirmed.confirmedRoomType}`:''}`));for(const correction of confirmed.ownerCorrections||[])box.append(make('p','Owner correction: '+String(correction).replace(/_/g,' ')));}
  }
  function readAnalysis(id){
    if(!savedAnalysisCache.has(id))savedAnalysisCache.set(id,request('/api/owner/source-understanding/'+encodeURIComponent(id)).catch(error=>{savedAnalysisCache.delete(id);return {readError:error.message};}));
    return savedAnalysisCache.get(id);
  }
  async function compareSaved(){
    const selected=[...compared].map(id=>records.find(version=>version.version_id===id)).filter(Boolean);
    if(selected.length<2)return;
    const content=$('savedCompareContent'),button=$('compareSavedVersions');button.disabled=true;
    content.replaceChildren(make('p','Loading saved fields, originals and any analysis on file…'));$('savedCompareDialog').showModal();
    const items=await Promise.all(selected.map(async version=>{
      const [refs,analysis]=await Promise.all([request('/api/owner/project-references/'+encodeURIComponent(version.version_id)).then(data=>({list:data.references||[]})).catch(error=>({error:error.message})),readAnalysis(version.version_id)]);
      return {version,job:linkedJob(version),refs,analysis};
    }));
    const usd=value=>typeof value==='number'&&Number.isFinite(value)?'US$'+value.toFixed(2):'';
    const fields=[
      ['Reference',item=>item.version.case_ref],['Name',item=>productName(item.version)],['Project · version',item=>`${item.version.title||'Project'} · ${versionLabel(item.version)}`],['Created',item=>when(item.version.created_at)],
      ['Work type',item=>{const work=workOf(item.version);return work==='unrecorded'?'':WORK_LABELS[work];}],['Requested outcome',item=>item.version.brief?.outcome],
      ['Recorded state',item=>item.job?`Job ${String(item.job.status||'status not recorded').replace(/_/g,' ')} · ${item.job.stage||'stage not recorded'}`:DISPATCH[String(item.version.dispatch_state||'').toLowerCase()]?.[1]||item.version.dispatch_state],
      ['Product',item=>item.version.brief?.product],['SKU',item=>item.version.brief?.sku],['Physical pieces',item=>item.version.brief?.inventory],['Dimensions',item=>item.version.brief?.dimensions],
      ['Aspect ratio',item=>item.version.brief?.aspect],['Resolution',item=>item.version.brief?.resolution],['Lighting',item=>item.version.brief?.lighting],['Budget ceiling',item=>usd(item.version.brief?.budgetUsd)],
      ['Saved direction',item=>String(item.version.direction||item.version.note||'').trim()]
    ];
    const table=document.createElement('table');table.className='saved-compare-table';
    const caption=make('caption','Saved versions compared');caption.className='sr-only';table.append(caption);
    const head=document.createElement('thead'),headRow=document.createElement('tr');const corner=make('th','Field');attr(corner,'scope','col');headRow.append(corner);
    for(const item of items){const th=make('th',`${refLabel(item.version)} · ${productName(item.version)}`);attr(th,'scope','col');headRow.append(th);}
    head.append(headRow);table.append(head);
    const body=document.createElement('tbody');
    for(const [label,read] of fields){
      const values=items.map(item=>String(read(item)??'').trim()),differs=new Set(values).size>1;
      const row=document.createElement('tr');if(differs)row.className='is-diff';
      const th=make('th',label);attr(th,'scope','row');if(differs){const tag=make('span','Differs');tag.className='diff-tag';th.append(tag);}
      row.append(th);for(const value of values)row.append(make('td',value||'Not recorded'));body.append(row);
    }
    const refRow=document.createElement('tr'),refHead=make('th','Original references');attr(refHead,'scope','row');refRow.append(refHead);
    for(const item of items){const cell=document.createElement('td');
      if(item.refs.error)cell.append(make('p','Originals could not be loaded: '+item.refs.error));
      else if(!item.refs.list.length)cell.append(make('p','No originals returned.'));
      else{const strip=document.createElement('div');strip.className='compare-refs';for(const ref of item.refs.list){const figure=document.createElement('figure'),image=document.createElement('img');image.src='/api/owner/project-references/'+encodeURIComponent(item.version.version_id)+'/'+encodeURIComponent(ref.id);image.alt=`Saved ${ref.role||'original'} reference`;image.loading='lazy';figure.append(image,make('figcaption',ref.role||'reference'));strip.append(figure);}cell.append(strip);}
      refRow.append(cell);}
    body.append(refRow);
    const analysisRow=document.createElement('tr'),analysisHead=make('th','Analysis on file');attr(analysisHead,'scope','row');analysisRow.append(analysisHead);
    for(const item of items){const cell=document.createElement('td');renderAnalysis(cell,item.analysis);analysisRow.append(cell);}
    body.append(analysisRow);table.append(body);
    const scroller=document.createElement('div');scroller.className='saved-compare-scroll';attr(scroller,'tabindex','0');attr(scroller,'role','region');attr(scroller,'aria-label','Comparison table');scroller.append(table);
    content.replaceChildren(scroller);updateCompare();
  }
  async function loadProjects() {
    $('savedWorkStatus').textContent='Loading saved versions…';
    try { const data=await request('/api/owner/projects'); records=data.records||[]; for(const id of [...compared])if(!records.some(item=>item.version_id===id))compared.delete(id); const select=$('savedVersion'); select.replaceChildren(new Option('Choose a saved version','')); for(const v of records.filter(x=>x.version_id)) select.add(new Option(`${v.case_ref?v.case_ref+' · ':''}${productName(v)} · ${versionLabel(v)} · ${v.dispatch_state}`,v.version_id)); $('savedStatus').textContent=`${records.filter(x=>x.version_id).length} saved versions available.`;renderSavedWork();if(jobsState==='loaded'){nameJobs();renderJobSelect();} }
    catch { $('savedStatus').textContent='Saved projects are unavailable. Refresh to try again.';$('savedWorkStatus').textContent='Saved work is unavailable. Refresh to try again.';$('savedWorkList').replaceChildren();$('savedWorkSummary')?.replaceChildren();if($('savedWorkMore'))$('savedWorkMore').hidden=true; }
  }
  $('refreshSavedWork').addEventListener('click',loadProjects);
  $('compareSavedVersions')?.addEventListener('click',compareSaved);
  $('closeSavedCompare')?.addEventListener('click',()=>$('savedCompareDialog').close());
  $('savedWorkFilters')?.addEventListener('click',event=>{
    const pill=event.target?.closest?.('[data-saved-filter]');if(!pill)return;
    savedFilter=pill.dataset.savedFilter;savedLimit=PAGE;
    for(const node of document.querySelectorAll('[data-saved-filter]'))attr(node,'aria-pressed',String(node===pill));
    renderSavedWork();
  });
  let searchTimer=null;
  $('savedWorkSearch')?.addEventListener('input',event=>{savedQuery=event.target?.value||'';savedLimit=PAGE;if(typeof setTimeout!=='function'){renderSavedWork();return;}clearTimeout(searchTimer);searchTimer=setTimeout(renderSavedWork,200);});
  for(const id of ['savedWorkType','savedWorkOutcome'])$(id)?.addEventListener('change',()=>{savedLimit=PAGE;renderSavedWork();});
  const focusRow=(list,index)=>{const row=list?.children?.[index];const target=row?.querySelector?.('button')||null;target?.focus?.();};
  $('savedWorkMore')?.addEventListener('click',()=>{const before=$('savedWorkList').children.length;savedLimit+=PAGE;renderSavedWork();focusRow($('savedWorkList'),before);});
  // Opens the saved-edit route for a version. With an approved image (phase 2.1) the edit starts from that
  // image: the site sends its receipt and A7 makes one image from it (phase 2.4).
  const retryable=status=>statusGroup(status)==='attention'||/^stop/.test(String(status||'').toLowerCase());
  function dispatchCheckText(r){
    if(r.checkAfter)return `This send may still be in progress. Check again after ${when(r.checkAfter)||r.checkAfter}; nothing was changed.`;
    if(r.state==='received')return 'A7 has this job, so it is now marked received. Follow it in Jobs.';
    if(r.state==='draft'&&r.changed)return 'A7 never received this version and nothing was spent on it. It is a draft again: open it with Edit this version, save it unchanged, then estimate and send it.';
    if(r.a7==='unknown')return 'A7’s record could not be read just now. Nothing was changed; check again later.';
    return `This version is no longer waiting for a receipt (now ${r.state||'unknown'}). Nothing was changed.`;
  }
  async function checkDispatch(version,button){
    button.disabled=true;button.textContent='Checking…';
    try{const r=await request('/api/owner/projects/'+encodeURIComponent(version.version_id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dispatch_check'})});dispatchNotes.set(version.version_id,dispatchCheckText(r));}
    catch(error){dispatchNotes.set(version.version_id,'The check did not finish: '+plain(error)+' Nothing was changed.');}
    await loadProjects();
  }
  // Retry: a new edit of the same approved image, with the choices and texts of the edit that stopped. The parent's
  // source facts are reused (same photos), so nothing is read or paid for again until the owner sends the new edit.
  function retryEdit(version){
    pendingRetry={parentId:version.parent_id,code:version.brief.editOptions||'',changes:version.brief.allowedChanges||'',preserve:version.brief.protectedDetails||'',from:version.version};
    editVersion(version.parent_id,{versionId:version.parent_id,assetId:version.brief.resultAssetId,fileName:version.base_file_name||null,outputId:'used by version '+version.version,...(version.brief.editBaseKind==='white'?{kind:'white'}:{})});
  }
  function editVersion(versionId,base){
    editBase=base;
    const intent=document.querySelector('input[name="intent"][value="edit"]');intent.checked=true;intent.dispatchEvent(new Event('change',{bubbles:true}));
    const route=document.querySelector('input[name="route"][value="saved"]');route.checked=true;route.dispatchEvent(new Event('change',{bubbles:true}));
    $('savedVersion').value=versionId;
    window.history.pushState({page:'setup'},'','/owner/');$('setupPage').hidden=false;$('resultsPage').hidden=true;
    $('openSavedVersion').click();
  }
  $('openSavedVersion').addEventListener('click',async()=>{
    const v=records.find(x=>x.version_id===$('savedVersion').value); if(!v)return;
    try { const data=await request('/api/owner/project-references/'+v.version_id); const refs=data.references||[],primary=refs.find(ref=>ref.role==='product');if(!primary)throw Error('product_reference_missing');resetReview();opened={...v,references:refs};
      $('connectedProduct').value=v.brief.product||'';$('connectedInventory').value=v.brief.inventory||'';$('prefInventory').value=v.brief.inventory||'';$('connectedSku').value=v.brief.sku||'';$('connectedBudget').value=v.brief.budgetUsd??4.74;$('prefBudget').value=$('connectedBudget').value;$('prefDimensions').value=v.brief.dimensions||'';$('sourceCatalogueRefs').value='';$('prefItems').value='';
      $('prefAspect').value=v.brief.aspect||'';$('prefResolution').value=v.brief.resolution||'2K';$('prefLighting').value=v.brief.lighting?'a7:'+v.brief.lighting:'';
      for(const choice of document.querySelectorAll('input[name="prefOutcome"]'))choice.checked=(choice.value==='White BK'&&v.brief.outcome==='White background')||(choice.value==='Lifestyle'&&v.brief.outcome==='Lifestyle');
      // A draft saved before any outcome was ticked (1. Save the photos) cannot be estimated, and an edit
      // reuses its brief. Such a draft, never sent and not an edit of a result, stays editable and is completed in place.
      // The same holds for a draft with an outcome but no product type or pieces: locking those empty fields left it unsendable.
      const missing=[!v.brief?.outcome&&'outcome',!String(v.brief?.product||'').trim()&&'product type',!String(v.brief?.inventory||'').trim()&&'pieces'].filter(Boolean);
      // A saved value that saving would refuse (pieces without a quantity, a budget out of range) is never left locked. A draft that
      // was never sent is completed in place like an incomplete one. A version already sent, or an edit of an approved image, keeps
      // its recorded facts locked: only the refused field is unlocked, and its correction goes into the new version the edit saves;
      // the earlier version stays as it was recorded.
      const invalid=savedProblems(v.brief),draftOnly=v.dispatch_state==='draft'&&!v.client_run_id&&!v.brief?.resultAssetId;
      const incomplete=draftOnly&&(missing.length>0||invalid.length>0);opened.incomplete=incomplete;opened.fix=incomplete?[]:invalid;
      lockSavedFields(!incomplete);for(const problem of opened.fix)for(const id of problem.ids)if($(id))$(id).disabled=false;
      window.a7Start.restoreSaved({version:v,reference:primary});
      const white=scenesFromWhite();if($('editOptionsPanel'))$('editOptionsPanel').hidden=white;
      if(white)openScenesFromWhite();
      const refused=invalid.map(problem=>problem.words).join('; ');
      const guidance=incomplete&&missing.length?`This saved draft has no ${missing.join(' or ')} yet, so it cannot be estimated. ${v.brief?.outcome?'':'Tick White BK or Lifestyle under What to create, '}${v.brief?.outcome?'Fill in':'fill in'} the product type and pieces, check the budget, then press 5. Save all details. The same version is updated and its source analysis is kept; nothing is paid.${refused?' Also correct this: '+refused+'.':''}`
        :incomplete?`This saved draft cannot be saved or estimated as it is: ${refused}. Its fields are unlocked so you can correct them. Correct them, check the budget, then press 5. Save all details. The same version is updated and its source analysis is kept; nothing is paid.`
        :invalid.length?`This version was saved with a value that cannot be sent: ${refused}. Only the ${invalid.map(problem=>problem.name).join(' and ')} field is unlocked so you can correct it. Your correction goes into the new version this edit saves; the earlier version stays as it was recorded. Then press 5. Save all details.`
        :'Saved direction is restored under Notes for the studio for editing. Other version fields and original references are retained unchanged. This edit is outside the verified paid scope.';
      const panel=$('savedStatus');panel.replaceChildren(make('p',`${v.title} / ${v.case_title} · version ${v.version} · ${v.dispatch_state}`),make('p',guidance));
      if(white)panel.append(make('p',`These scenes start from the approved white image ${(editBase&&editBase.versionId===v.version_id&&(editBase.fileName||editBase.outputId))||'of the earlier version'}. A7 makes no new white master: it checks that image against the earlier run's record, then plans and makes the scenes you choose under What to create. Choose the scenes there and the job budget under The product; the product and pieces stay as saved.`));
      else if(editBase&&editBase.versionId===v.version_id)panel.append(make('p',`This edit starts from the approved image ${editBase.fileName||editBase.outputId}. A7 checks that image against the earlier run's record before it makes anything.`));
      if(pendingRetry&&pendingRetry.parentId===v.version_id){
        const retry=pendingRetry;pendingRetry=null;
        if(typeof CustomEvent==='function')document.dispatchEvent?.(new CustomEvent('a7:edit-options-restore',{detail:{code:retry.code}}));
        $('editChanges').value=retry.changes;$('editPreserve').value=retry.preserve;
        for(const id of ['editChanges','editPreserve'])$(id).dispatchEvent?.(new Event('input',{bubbles:true}));
        panel.append(make('p',`Retrying the edit of version ${retry.from}: the same approved image and choices are filled in. Nothing is sent until you save and send this new edit.`));
      }
      for(const ref of refs){const figure=document.createElement('figure'),image=document.createElement('img');image.src='/api/owner/project-references/'+v.version_id+'/'+ref.id;image.alt='Saved '+ref.role+' original reference';image.className='saved-reference';figure.append(image,make('figcaption',ref.role+' · SHA-256 '+ref.sha256));panel.append(figure);}
    }
    catch { $('savedStatus').textContent='Saved original references could not be loaded.'; }
  });
  async function saveCurrentDraft(sourceOnly=false){
    const where=sourceOnly?'saveSourceStatus':'saveConnectedStatus';
    if (busy)return; if(!state.primary){tell(where,'Select a primary original product image first.');return;}
    const savedEdit=opened&&state.intent==='edit'&&state.route==='saved';
    if(!sourceOnly&&savedEdit&&opened.incomplete){await completeSavedDraft();return;}
    const inventory=$('connectedInventory').value.trim().split('\n').map(line=>line.trim()).filter(Boolean);
    if(!sourceOnly&&(!inventory.length||inventory.length>20||inventory.some(line=>!PIECE_LINE.test(line)))){tell(where,'Enter each physical piece on its own line as a quantity and name, such as “1 sofa”. Use at most 20 lines.');$('connectedInventory').focus();return;}
    if (!sourceOnly&&!$('connectedProduct').value.trim()){tell(where,'Enter the product type before saving. Image analysis has not filled it automatically.');$('connectedProduct').focus();return;}
    const mismatch=sourceOnly?'':countMismatch($('connectedInventory').value);if(mismatch){tell(where,mismatch);$('connectedInventory').focus();return;}
    const budget=Number($('connectedBudget').value);
    if(!Number.isFinite(budget)||budget<.25||budget>10||Math.abs(budget*100-Math.round(budget*100))>1e-6){tell(where,'Enter a job budget from USD 0.25 to USD 10.00 in cents.');return;}
    busy=true; $('saveConnectedDraft').disabled=true;
    try {
      const startedRevision=revision,snap=await snapshot();
      // A reopened version: unchanged, an unsent one is used as it is (for example after Check with A7 made it a draft again); a sent
      // one needs a change first. A changed unsent edit is revised in place below, so it keeps the approved image it starts from.
      if(savedEdit&&!draft){
        const o=opened.brief||{},shown=opened.direction||opened.note,field=key=>String(snap.brief[key]||'')===String(o[key]||'');
        // A corrected refused value (opened.fix) is a change too: the version is saved with it, never reused as it was.
        const same=snap.note===shown&&['allowedChanges','protectedDetails','editOptions','resultAssetId',...(opened.fix||[]).map(problem=>problem.key)].every(field);
        const asDraft={id:opened.version_id,brief:o,note:opened.note,references:opened.references,fingerprint:opened.fingerprint,sourceOnly:false,route:routeKey()};
        if(same&&unsentOpened()){draft={...asDraft,sourceOnly};if(!sourceOnly)savedForEstimate();tell(where,'Unchanged saved draft reopened. No new version or paid job was created.');await refreshSourceReview();return;}
        if(same){tell(where,'The direction is unchanged. Edit the notes under Notes for the studio before saving a new version.');return;}
        if(inPlace())draft={...asDraft,reopened:true,rawNote:opened.note,shownNote:shown};
      }
      // An edit that is saved (not an unchanged draft reused above) needs both what to change and what to keep.
      if(!sourceOnly&&state.intent==='edit'&&(!$('editChanges').value.trim()||!$('editPreserve').value.trim())){if(draft?.reopened)draft=null;tell(where,'Describe the requested edit and what must remain unchanged before requesting an estimate.');return;}
      if(patchable()){
        // A reopened edit keeps its own note while the direction shown in Step 2 is unchanged; the server rebuilds the direction
        // from the note and the edit fields, so sending the shown text would repeat those lines.
        const note=draft.reopened&&snap.note===draft.shownNote?draft.rawNote:snap.note;
        const unchanged=JSON.stringify(draft.brief)===JSON.stringify(snap.brief)&&draft.note===note;
        if(unchanged&&sourceOnly&&!draft.sourceOnly){tell(where,'This version is already saved with these details. Review its source analysis below before requesting an estimate.');await refreshSourceReview();return;}
        if(!unchanged){
          const signature=JSON.stringify({id:draft.id,note,brief:snap.brief});
          if(revisePending&&revisePending.signature!==signature)throw Error('An earlier draft update has an uncertain result. Reopen the saved version before changing it again.');
          if(!revisePending)revisePending={signature,requestId:crypto.randomUUID(),expectedFingerprint:draft.fingerprint};
          const data=await request('/api/owner/projects/'+encodeURIComponent(draft.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:revisePending.requestId,expectedFingerprint:revisePending.expectedFingerprint,note,brief:snap.brief})});
          if(startedRevision!==revision){tell(where,'An earlier draft was updated while the page changed. Review the saved version before continuing.');return;}
          draft={...draft,brief:snap.brief,note,fingerprint:data.draft.fingerprint};revisePending=null;
          if(savedEdit&&opened.version_id===draft.id)opened={...opened,brief:snap.brief,note,direction:data.draft.direction||opened.direction,fingerprint:data.draft.fingerprint};
        }
        const wasSourceOnly=draft.sourceOnly;draft.formKey=formKey();if(!sourceOnly){draft.sourceOnly=false;savedForEstimate();}
        tell(where,sourceOnly?(wasSourceOnly?'Originals saved for source analysis under the selected job ceiling. No product type or count was assumed.':'Changes saved to the same version; its source analysis is kept.'):'Details saved to the same version; its source analysis is kept. Get the estimate again before any paid job.');await refreshSourceReview();return;
      }
      const signature=JSON.stringify({brief:snap.brief,note:snap.note,hashes:snap.labels.map(x=>x.hash),intent:state.intent,route:state.route,parentId:savedEdit?opened.version_id:null});
      if(!savePending||savePending.signature!==signature) savePending={signature,id:crypto.randomUUID(),snap};
      const attempt=savePending;
      const inCollection=state.intent==='project'&&state.route==='collection'&&collection&&collection.title===$('projectName').value.trim();
      const payload={requestId:attempt.id,...(inCollection?{projectId:collection.id}:{}),mode:state.intent==='edit'?'edit':state.route==='collection'?'collection':'project',title:savedEdit?opened.title:$('projectName').value.trim(),caseTitle:savedEdit?opened.case_title:autoCaseName(),note:attempt.snap.note,brief:attempt.snap.brief,editSource:state.intent==='edit'?(savedEdit?'saved':'new'):'saved',...(savedEdit?{parentId:opened.version_id,directionMode:'replace'}:{})};
      const data=await request('/api/owner/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      for(const entry of attempt.snap.labels){const body=new FormData();body.set('file',entry.file);body.set('role',entry.role);try{await request('/api/owner/project-references/'+data.draft.id,{method:'POST',body});}catch(error){throw Error(`${entry.label} photo (${entry.file.name}) was not saved: ${photoSaveHelp(error.message)}`);}}
      const refs=await request('/api/owner/project-references/'+data.draft.id);
      if(payload.mode==='collection'&&data.projectId){collection={id:data.projectId,title:payload.title};$('nextCollectionItem').hidden=false;}
      savePending=null;await loadProjects();if(startedRevision!==revision){tell(where,'The earlier draft was saved, but your instructions changed during saving. Save the current text as a new version before requesting an estimate.');return;}
      draft={id:data.draft.id,brief:attempt.snap.brief,note:attempt.snap.note,references:refs.references,fingerprint:data.draft.fingerprint,sourceOnly,route:routeKey(),formKey:formKey()};revisePending=null;
      // The new edit is now the opened version: an unsent edit of the opened parent, revised in place by the next save (inPlace).
      if(savedEdit)opened={...opened,version_id:data.draft.id,parent_id:opened.version_id,direction:data.draft.direction||attempt.snap.note,note:attempt.snap.note,brief:attempt.snap.brief,references:refs.references,dispatch_state:'draft',client_run_id:null,fingerprint:data.draft.fingerprint};
      if(!sourceOnly)savedForEstimate();const named=data.ref?`Saved as ${data.ref}${savedEdit?' (edited version)':''}. `:'';tell(where,named+(sourceOnly?'Originals saved for source analysis under the selected job ceiling. No product type or count was invented.':savedEdit?'Edited direction saved as a new version with the original references. No paid processing started.':'Draft and original references saved. No paid processing started.'));await refreshSourceReview();
    } catch(error){
      // A definite refusal: nothing was saved, so the next save is a fresh update, not a retry of this one.
      if((error.code||error.message)==='analysis_running'){revisePending=null;tell(where,'The source reading for this version is still running. Wait until its readings arrive (under Check the photos) before changing the direction; saving the change now would discard the reading you are paying for. Nothing was saved.');return;}
      if(definite(error)){revisePending=null;savePending=null;tell(where,plain(error));return;}
      tell(where,plain(error)+' If saving was interrupted, retry with the same files; no paid job was sent.');}
    finally {busy=false;$('saveConnectedDraft').disabled=false;}
  }
  // Completes an opened draft that has no outcome: its Step 3 fields are written to the same version (PATCH), so it
  // keeps its id, direction and confirmed source analysis. Route fields stay as saved; the server refuses a change.
  let completePending=null;
  async function completeSavedDraft(){
    const fresh=freshBrief(),o=opened.brief||{};
    const next={...fresh,routeIntent:o.routeIntent,routeChoice:o.routeChoice,editSource:o.editSource,resultAssetId:o.resultAssetId,allowedChanges:o.allowedChanges,protectedDetails:o.protectedDetails};
    for(const key of Object.keys(next))if(next[key]===undefined)delete next[key];
    if(!['White background','Lifestyle'].includes(next.outcome)){tell('saveConnectedStatus','Tick White BK or Lifestyle under What to create before saving this draft.');return;}
    const lines=String(next.inventory||'').split('\n').map(line=>line.trim()).filter(Boolean);
    if(!next.product||!lines.length||lines.length>20||lines.some(line=>!/^([1-9]\d{0,2})\s+.{1,60}$/.test(line))){tell('saveConnectedStatus','Enter the product type and each physical piece on its own line as a quantity and name, such as “1 sofa”, before saving.');return;}
    if(!Number.isFinite(next.budgetUsd)||next.budgetUsd<.25||next.budgetUsd>10){tell('saveConnectedStatus','Enter a job budget from USD 0.25 to USD 10.00 in cents.');return;}
    const mismatch=countMismatch(next.inventory);if(mismatch){tell('saveConnectedStatus',mismatch);return;}
    const note=opened.note,signature=JSON.stringify({id:opened.version_id,note,brief:next});
    if(!completePending||completePending.signature!==signature)completePending={signature,requestId:crypto.randomUUID()};
    busy=true;$('saveConnectedDraft').disabled=true;
    try{
      const data=await request('/api/owner/projects/'+encodeURIComponent(opened.version_id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:completePending.requestId,expectedFingerprint:opened.fingerprint,note,brief:next})});
      completePending=null;
      opened={...opened,brief:next,fingerprint:data.draft.fingerprint,incomplete:false};lockSavedFields(true);
      draft={id:opened.version_id,brief:next,note,references:opened.references,fingerprint:data.draft.fingerprint,sourceOnly:false,route:routeKey()};
      savedForEstimate();
      tell('saveConnectedStatus','Outcome and details saved to this same version. Get the estimate next; nothing was paid.');
      await refreshSourceReview();await loadProjects();
    }catch(error){if(definite(error))completePending=null;tell('saveConnectedStatus',plain(error)+(definite(error)?'':' Nothing was sent to A7.'));}
    finally{busy=false;$('saveConnectedDraft').disabled=false;}
  }
  $('saveSourceDraft').addEventListener('click',()=>saveCurrentDraft(true));
  $('saveConnectedDraft').addEventListener('click',()=>saveCurrentDraft(false));
  // Estimate answers appear under the button: the status line at the foot of the form is off screen on a phone.
  function estimateNote(message){$('estimateDetails').replaceChildren(make('p',message));say(message);quiet();}
  $('estimateConnected').addEventListener('click',async()=>{
    if(!draft||draft.sourceOnly){estimateNote('Save the confirmed details (5. Save all details) before requesting an estimate. No planning started.');return;}
    // The estimate is made from the saved version only. When the form no longer matches it, saving comes first; when it
    // matches again (a change undone), a fresh estimate of the saved version is fetched without saving again.
    if(draft.formKey===undefined||draft.formKey!==formKey()){estimateNote('Your changes are not saved yet. Press 5. Save all details first, then 6. Get estimate: the estimate is made from the saved version, so it would not include them. No planning started.');return;}
    const startedRevision=revision,draftId=draft.id;estimateNote('Getting the estimate…');try{await refreshSourceReview();if(understanding?.status!=='confirmed'){estimateNote('Confirm the source facts under Check the photos before requesting a job estimate. No planning started.');return;}const mismatch=countMismatch(draft.brief?.inventory);if(mismatch){estimateNote('No estimate yet. '+mismatch);return;}const response=await request('/api/owner/project-estimate/'+draftId);if(startedRevision!==revision||draft?.id!==draftId){estimateNote('Instructions changed while the estimate loaded. Save and estimate the current version.');return;}estimate=response;renderSupport();const panel=$('estimateDetails');panel.replaceChildren(make('p',`${estimate.status==='verified'?'Verified':'Provisional'} estimate: USD ${estimate.noRepairUsd?.toFixed(3)} without repairs; USD ${estimate.twoRepairsEachUsd?.toFixed(3)} with two requested repairs per image.`),make('p',`Outputs: ${(estimate.outputs||[]).join(', ')}. ${estimate.basis||''}`));for(const warning of estimate.warnings||[])panel.append(make('p',warning));panel.append(make('p',`Valid until ${when(estimate.expiresAt)||estimate.expiresAt}. After that, get the estimate again before sending.`));$('submitConnected').disabled=!(sendable()&&estimate.paidReady&&understanding?.status==='confirmed'&&!alreadySent());if(testScope())panel.append(make('p','Owner test mode: this scope has no calibrated cost. The figures above are provisional; the run stops at your USD '+Number(estimate.ceilingUsd).toFixed(2)+' job ceiling.'));if($('submitConnected').disabled)panel.append(make('p',serverGate()&&estimate.blockers.length?'This version cannot be sent yet: '+estimate.blockers.map(b=>b.message).join(' ')+' Your draft remains saved.':'Paid submission requires confirmed source facts, one original product photo, one square 2K white master, supported preferences, and an enabled production release. Your draft remains saved.'));watchExpiry();}
    catch(error){estimateNote(plain(error));}
  });
  function confirmReady(){ $('confirmSend').disabled=!$('confirmChecked').checked||($('confirmNote').required&&!$('confirmNote').value.trim()); }
  function showConfirm(title,details,action,note={}){pendingAction=action;$('confirmTitle').textContent=title;$('confirmDetails').replaceChildren(...details.map(x=>make('p',x)));$('confirmChecked').checked=false;$('confirmNoteWrap').hidden=!note.label;$('confirmNoteLabel').textContent=note.label||'Decision note';$('confirmNote').value='';$('confirmNote').required=note.required===true;$('confirmStatus').textContent='';confirmReady();$('connectedConfirm').showModal();}
  $('confirmChecked').addEventListener('change',confirmReady);
  $('confirmNote').addEventListener('input',confirmReady);
  $('confirmCancel').addEventListener('click',()=>{$('connectedConfirm').close();pendingAction=null;});
  $('confirmClose')?.addEventListener('click',()=>{$('connectedConfirm').close();pendingAction=null;});
  $('connectedConfirm').addEventListener('close',()=>{pendingAction=null;});
  $('confirmSend').addEventListener('click',async()=>{
    if(!pendingAction||!$('confirmChecked').checked||($('confirmNote').required&&!$('confirmNote').value.trim())||busy)return;busy=true;$('confirmSend').disabled=true;const action=pendingAction;pendingAction=null;
    try{const result=await action();$('confirmStatus').textContent=result.message||'Request recorded. Refresh the queue for status.';await loadJobs();if(result.runId&&[...$('jobSelect').options].some(o=>o.value===result.runId)){$('jobSelect').value=result.runId;openJob(result.runId);}}
    // A refusal (4xx) is a definite answer: nothing was sent, so it is said as it is. Anything else may have reached A7.
    catch(error){$('confirmStatus').textContent=definite(error)?plain(error):'Outcome not confirmed: '+plain(error)+' Refresh the queue before any retry.';}
    finally{busy=false;}
  });
  $('submitConnected').addEventListener('click',()=>{
    if(alreadySent()){tell('submitConnectedStatus','This saved version was already sent to A7. Follow it in Jobs below: Go 1 appears there when A7 has finished reading and planning.');return;}
    const problem=sendProblem();if(problem){tell('submitConnectedStatus',problem);return;}tell('submitConnectedStatus','');
    const data={...draft.brief,requestId:crypto.randomUUID(),draftId:draft.id,estimateConfirmation:{fingerprint:estimate.fingerprint,expiresAt:estimate.expiresAt},instructions:draft.note,confirmed:true};
    const body=new FormData();body.set('payload',JSON.stringify(data));
    showConfirm('Start paid planning',[`Estimated total without repairs: USD ${estimate.noRepairUsd.toFixed(3)}`,`Shared analysis and job ceiling: USD ${data.budgetUsd}`,'Confirmed source readings are reused. Planning starts under the remaining ceiling before Go 1. Go 1 separately authorizes generation. No repair or approval is automatic.',...(testScope()?['Owner test mode: this scope is not calibrated, so the estimate is provisional. Spending still stops at the job ceiling.']:[])],async()=>{const sent=draft;try{const result=await request('/api/owner/submissions',{method:'POST',body});markSent(sent);return {...result,message:'A7 received this job. It is reading and planning now; Go 1 appears in Jobs when the plan is ready, usually within a few minutes. Do not send it again.'};}catch(error){if(/already sent/.test(error.message))markSent(sent);throw error;}});
  });
  // An estimate is valid for 15 minutes (lib/a7-estimate.mjs). When it passes, sending stops here, before the server refuses it.
  const expired=()=>!!estimate&&!(Date.now()<Date.parse(estimate.expiresAt));
  const EXPIRED='This estimate has expired (it is valid for 15 minutes). Press Get estimate again before sending; nothing was sent.';
  function watchExpiry(){
    clearTimeout(expiryTimer);if(!estimate)return;
    const shown=estimate,left=Date.parse(shown.expiresAt)-Date.now();
    // A timer that fires early changes nothing; the send button checks the expiry again when pressed.
    const lapse=()=>{if(estimate!==shown||!expired())return;$('submitConnected').disabled=true;tell('submitConnectedStatus',EXPIRED);};
    if(!(left>0)){lapse();return;}expiryTimer=setTimeout(lapse,Math.min(left,2147483647));
  }
  // Why Review paid submission cannot go ahead, in the order the owner can fix it; '' when it can.
  function sendProblem(){
    if(!draft||draft.sourceOnly)return 'Save the draft and original references first (5. Save all details).';
    if(understanding?.status!=='confirmed')return 'Confirm the source facts under Check the photos first.';
    const mismatch=countMismatch(draft.brief?.inventory);if(mismatch)return mismatch;
    if(!estimate)return 'Get the estimate first.';
    if(expired())return EXPIRED;
    if(!estimate.paidReady)return 'Paid steps are paused on this site, so this job cannot be sent yet. Your draft stays saved.';
    if(!sendable())return serverGate()?'This version cannot be sent yet: '+estimate.blockers.map(b=>b.message).join(' '):'This request is outside what can be sent: '+$('executionScopeStatus').textContent;
    return '';
  }
  // A sent version stays sent: sending it twice starts a second run that A7 refuses at its source check.
  function alreadySent(){return !!draft&&(draft.sent===true||(draft.dispatch_state&&draft.dispatch_state!=='draft'));}
  function markSent(sent){if(!sent)return;sent.sent=true;if(opened&&opened.version_id===sent.id)opened={...opened,dispatch_state:'confirmed',client_run_id:'owner-'+sent.id};if(sent===draft){$('submitConnected').disabled=true;tell('submitConnectedStatus','This saved version has been sent to A7. Follow it in Jobs; Go 1 appears there when the plan is ready.');}}
  let jobs=[],jobsRevision=0,visibleJobs=[],jobLimit=8;
  // The visual queue mirrors the job dropdown; both open the same read-only job detail.
  function renderJobQueue(){
    const list=$('jobQueueList');if(!list)return;
    const current=$('jobSelect').value,shown=visibleJobs.slice(0,jobLimit);
    list.replaceChildren();
    for(const job of shown){
      const item=document.createElement('li'),row=document.createElement('button');
      row.type='button';row.className='job-queue-row';attr(row,'aria-current',job.id===current?'true':'false');
      const named=jobName(job);
      const name=make('span',named.title);name.className='job-queue-name';name.title=named.version?jobIds(job):UNLINKED_NOTE;
      const run=make('span',named.product||job.id);run.className='job-queue-run';run.title=jobIds(job);
      const stage=make('span',job.stage||'Stage unrecorded');stage.className='job-queue-stage';
      const time=make('span',when(job.updatedAt)||'Update time unrecorded');time.className='job-queue-time';
      row.append(name,run,stage,badge(job.status),time);
      row.addEventListener('click',()=>{$('jobSelect').value=job.id;for(const entry of list.children||[])attr(entry.children?.[0],'aria-current',entry===item?'true':'false');openJob(job.id);const box=$('connectedJobDetail');if(window.matchMedia?.('(max-width: 900px)').matches)box.scrollIntoView?.({block:'start'});});
      item.append(row);list.append(item);
    }
    const more=$('jobQueueMore');if(more){const remaining=visibleJobs.length-shown.length;more.hidden=remaining<=0;more.textContent=`Show ${Math.min(PAGE,remaining)} more of ${remaining} jobs`;}
  }
  $('jobQueueMore')?.addEventListener('click',()=>{const before=$('jobQueueList').children.length;jobLimit+=PAGE;renderJobQueue();focusRow($('jobQueueList'),before);});
  function renderJobSelect(){
    const filter=$('jobStatusFilter').value,select=$('jobSelect'),prior=select.value;
    const visible=jobs.filter(job=>!filter||job.status===filter);
    select.replaceChildren(new Option('Select a job',''));
    for(const job of visible){const named=jobName(job);select.add(new Option(`${named.title}${named.product?' · '+named.product:''} · ${job.status||'status unknown'} · ${job.stage||'stage unknown'}`,job.id));}
    select.value=visible.some(job=>job.id===prior)?prior:'';
    if(visibleJobs.map(job=>job.id).join('\n')!==visible.map(job=>job.id).join('\n'))jobLimit=8;
    const selectedIndex=visible.findIndex(job=>job.id===select.value);if(selectedIndex>=jobLimit)jobLimit=selectedIndex+1;
    visibleJobs=visible;renderJobQueue();
    if(!select.value){jobRevision++;$('connectedJobDetail').replaceChildren(make('p',visible.length?'Choose a recorded job to see its details and any pending approval.':'No jobs match this status.'));}
  }
  // A link from the Overview (/owner/?job=<A7 run ID>#jobsSection) opens that job once, after the queue loads, if it is listed.
  let jobLinkUsed=false;
  function linkedJobId(){const match=/[?&]job=([^&#]*)/.exec(String(window.location?.search||''));if(!match)return '';try{return decodeURIComponent(match[1]);}catch{return '';}}
  function openLinkedJob(){
    if(jobLinkUsed)return;const id=linkedJobId();if(!id)return;jobLinkUsed=true;
    if(!jobs.some(job=>job.id===id)){$('jobsStatus').textContent+=' · The linked job is not in the loaded queue.';return;}
    const filter=$('jobStatusFilter');if(filter&&filter.value){filter.value='';}
    $('jobSelect').value=id;renderJobSelect();openJob(id);
    document.getElementById('jobsSection')?.scrollIntoView?.({block:'start'});
  }
  async function loadJobs(){
    const ticket=++jobsRevision;
    $('jobsStatus').textContent='Loading recorded jobs…';
    try{
      const all=[],ids=new Set();let offset=0,total=0,capped=false,asOf='';
      for(let page=0;page<20;page++){
        const data=await request('/api/owner/jobs?offset='+offset);if(ticket!==jobsRevision)return;
        if(!Array.isArray(data.jobs)||data.jobs.length>50||!Number.isSafeInteger(data.total)||data.total>1000)throw Error('invalid_job_page');
        for(const job of data.jobs)if(job?.id&&!ids.has(job.id)){ids.add(job.id);all.push(job);}
        total=data.total;capped=data.capped===true;asOf=data.asOf;
        if(data.nextOffset===null||data.nextOffset===undefined){offset=-1;break;}
        if(!Number.isSafeInteger(data.nextOffset)||data.nextOffset<=offset)throw Error('invalid_job_page');offset=data.nextOffset;
      }
      if(offset!==-1)throw Error('job_pages_incomplete');
      jobs=all;jobsState='loaded';nameJobs();if(records.length)renderSavedWork();
      const filter=$('jobStatusFilter'),prior=filter.value;
      filter.replaceChildren(new Option('All statuses',''));
      for(const status of [...new Set(jobs.map(job=>job.status).filter(Boolean))].sort())filter.add(new Option(status,status));
      filter.value=jobs.some(job=>job.status===prior)?prior:'';renderJobSelect();
      $('jobsStatus').textContent=`${jobs.length} of ${total} recorded jobs${capped?' · upstream list capped at 1,000':''} · updated ${when(asOf)||asOf||'time unrecorded'}`;
      openLinkedJob();
    }catch(error){if(ticket===jobsRevision){jobs=[];jobsState='failed';nameJobs();if(records.length)renderSavedWork();$('jobStatusFilter').replaceChildren(new Option('All statuses',''));renderJobSelect();$('jobsStatus').textContent='Jobs unavailable: '+plain(error);}}
  }
  $('jobStatusFilter').addEventListener('change',renderJobSelect);
  $('jobSelect').addEventListener('change',()=>{const id=$('jobSelect').value;renderJobQueue();if(id&&jobs.some(job=>job.id===id))openJob(id);else{jobRevision++;$('connectedJobDetail').replaceChildren();}});
  function renderObservation(box,o){
    if(!o){box.append(make('p','No reader observation is recorded for this job. An uploaded preview is not an analysis.'));return;}
    box.append(make('h4','Recorded reader observations · verify against the original'),make('p',`Category: ${o.category||'unknown'} · Reader count: ${o.eyeCount??'unknown'} · Independent count: ${o.secondCount??'unknown'} · Owner stated count: ${o.statedCount??'not supplied'}`));
    if(o.colour)box.append(make('p','Observed colour: '+o.colour));
    if(o.materialAppearance)box.append(make('p','Material appearance: '+o.materialAppearance+' (visual only; composition unverified).'));
    if(o.cropped)box.append(make('p','Source may be cropped. '+(o.cropNote||'')));
    for(const piece of o.pieces||[])box.append(make('p',`Visible ${piece.kind||'piece'}${piece.label?' · '+piece.label:''}${piece.role?' · '+piece.role:''}${piece.cutOff?' · cut off':''}${piece.features?.length?' · '+piece.features.join('; '):''}`));
    for(const [label,values] of [['Details to preserve',o.locks],['Relationships (unverified interpretation)',o.relationships],['Hidden details',o.hidden],['Uncertainties',o.uncertainties],['Other views, not extra pieces',o.otherViews],['Files not read',o.unreadFiles]])if(values?.length)box.append(make('h5',label),...values.map(value=>make('p',value)));
    box.append(make('p','These are model observations, not confirmed product facts. Compare them with the original before approving a plan.'));
  }
  const DECISION_LABELS={go:'Go 1 · Approve plan',change:'Request plan changes',stop:'Stop this run',approve:'Go 2 · Approve image',repair:'Request a paid repair',review_again:'Run a paid review again',approve_unreviewed:'Go 2 · Approve by eye'};
  // A7 records each step as it goes, so a run with no recorded progress for two hours is not expected to reach Go 1.
  const STALLED_AFTER_MS=2*60*60*1000;
  const stalled=job=>{const at=Date.parse(job?.updatedAt||'');return Number.isFinite(at)&&Date.now()-at>STALLED_AFTER_MS;};
  const waitingForPlan=job=>!/hold|stop|fail|error|ready|complete|approved|cancel/i.test(job?.status||'')&&!stalled(job);
  function gateText(context,job,polling=true){
    // An expired ticket keeps only Stop (lib/owner-context-projection.js.txt): the run cannot continue from it.
    if(context.gate&&context.allowed?.length===1&&context.allowed[0]==='stop')return `${context.gate==='go1'?'Go 1':'Go 2'} can no longer be approved from this ticket; the run cannot continue from it. You can stop the run; to try again, save the version again and send a new job.`;
    if(context.gate==='go1')return context.allowed?.length?`Go 1 · A7 has a plan (below). Approve it to start image generation${context.allowed.includes('change')?', ask for changes':''}, or stop.`:'Go 1 ticket is expired or can no longer be answered safely. No decision will be sent; refresh the job.';
    if(context.gate==='go2')return context.allowed?.length?`Go 2 · Review the image A7 made${context.candidate?' (open it from the link below)':''}. Approve it to continue, request a repair, or stop.`:'Go 2 ticket is expired or can no longer be answered safely. No decision will be sent; refresh the job.';
    if(context.gate)return `Approval gate ${context.gate}${context.allowed?.length?'':' · no decision can be sent now'}.`;
    // A held run offers no decision (run report ff0aa7e5, 4.4): its reason is said plainly, with no Go wording, so it is not read
    // as a Go waiting to be given.
    if(/hold/i.test(job?.status||'')||/hold/i.test(context.status||''))return `On hold: ${job?.summary||'no hold reason was recorded'}. There is no decision to make on this run now, so nothing can be approved, repaired or continued from this page. To try again, start a new saved version.`;
    if(!/hold|stop|fail|error|ready|complete|approved|cancel/i.test(job?.status||'')&&stalled(job))return `No Go decision is open: A7 has recorded no progress on this run since ${when(job.updatedAt)||job.updatedAt} (over two hours), so it is not expected to reach Go 1. Open its saved version and save a new version to send it again.`;
    if(waitingForPlan(job))return 'No Go yet: A7 is still reading and planning this job. Go 1 appears here when the plan is ready; '+(polling?'this page checks again every 20 seconds.':'this page stopped checking after 15 minutes. Press Refresh jobs, or open the job again, to check now.');
    return `No Go decision is open: this run is ${job?.status||'not waiting'}${job?.summary?' ('+job.summary+')':''}. A held or stopped run does not reach Go 1; start a new saved version to try again.`;
  }
  // The plan or image being decided, as Advanced controls shows it (owner-actions.js): what A7 asks, its warnings, each shot's plan
  // (collapsed), at Go 2 the image itself and its automated review, and the cost so far. A Go is never approved blind from this page.
  const findingText=value=>{try{const v=JSON.parse(value);if(v&&typeof v==='object'&&!Array.isArray(v))return [v.name,v.what||v.evidence,v.where?'Where: '+v.where:'',v.fix?'Suggested correction: '+v.fix:'',v.result==='unsure'?'Uncertain':''].filter(x=>typeof x==='string'&&x).join(' · ');}catch{}return value;};
  function renderTicket(box,c){
    if(!c.gate)return;
    // The ticket's own wording ("go 2: approve…") asks for a decision; with no decision allowed it would be read as one waiting.
    if(c.decisionNeeded&&c.allowed?.length)box.append(make('p',c.decisionNeeded));
    for(const shot of c.shots||[]){const details=document.createElement('details');details.append(make('summary',`Shot ${shot.number} · ${shot.output} · ${shot.frame}`));for(const [key,value] of Object.entries(shot.plan||{}))if(value)details.append(make('p',`${key.replace(/_/g,' ')}: ${value}`));box.append(details);}
    for(const warning of c.warnings||[])box.append(make('p','Warning: '+warning));
    if(c.candidate){const link=document.createElement('a');link.href=c.candidate;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open the image A7 made ↗';box.append(link);}
    if(c.review?.result)box.append(make('p','Automated review: '+c.review.result));
    for(const finding of [...(c.review?.defects||[]),...(c.review?.uncertain||[])])box.append(make('p',findingText(finding)));
    const costs=Object.entries(c.cost||{});if(costs.length){const details=document.createElement('details');details.append(make('summary','Recorded cost estimates · USD'));for(const [key,value] of costs)details.append(make('p',key.replace(/_/g,' ')+': '+value));box.append(details);}
  }
  let approvalTimer=null,approvalChecks=0;
  // While a run is still planning, re-open its detail until a gate appears (at most 15 minutes).
  function scheduleApprovalCheck(id,version){
    clearTimeout(approvalTimer);if(approvalChecks>=45)return;
    approvalTimer=setTimeout(()=>{if(version!==jobRevision||$('jobSelect').value!==id)return;approvalChecks++;openJob(id,{keepPolling:true});},20000);
  }
  async function openJob(id,{keepPolling=false}={}){
    if(!keepPolling){approvalChecks=0;clearTimeout(approvalTimer);}
    const version=++jobRevision,box=$('connectedJobDetail');box.replaceChildren(make('p','Loading recorded job…'));
    try{const {job}=await request('/api/owner/jobs/'+encodeURIComponent(id));if(version!==jobRevision)return;
      if(box.classList)box.classList.add('job-detail');
      const named=jobName(jobs.find(entry=>entry.id===job.id)||job);
      box.replaceChildren(make('h3',named.title));
      if(named.product)box.append(make('p',named.product));else if(!named.version)box.append(make('p',UNLINKED_NOTE));
      box.append(badge(job.status),make('p',`${job.status||'Status unknown'} · ${job.stage||'Stage unknown'}${job.summary?' · '+job.summary:''}`));
      box.append(make('p',`Recorded ${jobIds(job)}${job.updatedAt?' · updated '+(when(job.updatedAt)||job.updatedAt):''}. This view reads saved status; it does not start or retry a workflow.`));
      if(/^owner-[a-f0-9-]{36}$/.test(job.clientId||'')){const image=document.createElement('img');image.src='/api/owner/sources/'+job.clientId.slice(6);image.alt='Original product reference';image.className='saved-reference';box.append(image);}
      renderObservation(box,job.observation);
      const history=document.createElement('details');history.className='job-history';
      const summary=make('summary',`Recorded history · ${(job.history||[]).length} event${job.history?.length===1?'':'s'}`);history.append(summary);
      if(job.historyTruncated)history.append(make('p','The upstream history is truncated. Open Advanced controls for the complete recorded context.'));
      const timeline=document.createElement('ol');for(const event of job.history||[])timeline.append(make('li',`${event.at} · ${event.name}: ${event.note||''}`));
      if(!timeline.children.length)history.append(make('p','No history events were returned for this run.'));else history.append(timeline);
      box.append(history);
      let deliveryContext=null;
      try{const context=await request('/api/owner/jobs/'+encodeURIComponent(id)+'/approval');if(version!==jobRevision)return;deliveryContext=context;
        const polling=!context.gate&&waitingForPlan(job)&&approvalChecks<45;
        // An edit of an approved image makes its plan from that image; A7 holds the run if plan changes are asked at its Go 1.
        const editRun=context.gate==='go1'&&!!named.version?.brief?.resultAssetId,allowed=(context.allowed||[]).filter(decision=>!(editRun&&decision==='change'));
        box.append(make('p',gateText({...context,allowed},job,polling)));
        if(polling)scheduleApprovalCheck(id,version);
        renderTicket(box,context);
        if(editRun&&context.allowed?.includes('change'))box.append(make('p','Plan changes are not offered for an edit of an approved image: A7 would hold the run. Stop it and save a new edit with other texts instead.'));
        for(const decision of allowed){const button=make('button',DECISION_LABELS[decision]||`Review ${decision}`);button.type='button';button.className='decision-button is-'+decision;button.disabled=decision!=='stop'&&!context.paidReady;button.addEventListener('click',()=>showConfirm(`Confirm: ${DECISION_LABELS[decision]||decision}`,[`${named.title}${named.product?' · '+named.product:''}`,`A7 run ${context.runId} · request ${context.clientId}`,`Gate ${context.gate} · round ${context.round}`,`Decision: ${decision}`,'Paid continuation may follow this approval within existing budget guards.'],()=>request('/api/owner/jobs/'+encodeURIComponent(id)+'/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),revision:context.revision,decision,note:$('confirmNote').value.trim(),confirmed:true})}),{label:decision==='change'?'Describe the requested plan changes':'Optional decision note',required:decision==='change'}));if(button.disabled)button.title='Paid steps are paused on this site; you can still stop.';box.append(button);}
        if(!context.paidReady&&(context.allowed||[]).some(decision=>decision!=='stop'))box.append(make('p','Paid steps are paused on this site; you can still stop.'));
      }catch{if(version===jobRevision)box.append(make('p','Approval ticket unavailable. Recorded observations remain visible; refresh the job before making a decision.'));}
      box.append(make('h4','Generated assets and delivery'));
      const files=Array.isArray(deliveryContext?.deliveries)?deliveryContext.deliveries:[];
      if(files.length){
        const list=document.createElement('ul');
        for(const f of files){const item=document.createElement('li'),link=document.createElement('a');link.href=f.link;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`${({master:'Master image',manifest:'Manifest',scene:'Scene image'})[f.kind]||'Delivery file'} · ${f.label}${f.px?' · '+f.px:''}`;item.append(link);list.append(item);}
        box.append(list,make('p','These are the files A7 recorded for this run. Each link is private to this studio; do not share it.'));
      }else box.append(make('p','A7 has recorded no delivered files for this run yet. Files appear here when a package or scene set is finished.'));
      const results=Array.isArray(deliveryContext?.results)?deliveryContext.results:[];
      if(results.length){
        box.append(make('h4','Approved images you can use'));
        const list=document.createElement('ul');list.className='result-assets';
        for(const r of results){
          const item=document.createElement('li'),saved=records.find(x=>x.version_id===r.versionId);
          item.append(make('span',`${r.fileName||r.outputId}${r.px?' · '+r.px:''}${r.reviewed?'':' · approved without an automated review'}`));
          const white=r.kind==='white',edit=make('button',white?'Make scenes from this white image':'Edit this result');edit.type='button';edit.className='ledger-action';attr(edit,'aria-label',white?`Make lifestyle scenes from the approved white image ${r.fileName||r.outputId}`:`Edit the approved image ${r.fileName||r.outputId}`);
          if(!saved){edit.disabled=true;edit.title='The saved version of this job is not loaded. Refresh saved work first.';}
          else edit.addEventListener('click',()=>editVersion(r.versionId,r));
          item.append(edit);list.append(item);
        }
        box.append(list);
      }
      box.append(make('p','Full budget, receipt recovery and detailed controls remain in Advanced controls.'));
    }catch(error){if(version===jobRevision)box.textContent='Job detail unavailable: '+plain(error);}
  }
  $('refreshConnectedJobs').addEventListener('click',loadJobs);
  updateSourceResult();renderSupport();loadProjects();loadJobs();
  // Midas link import: the server looks the product up in the Midas catalogue and
  // returns its photos; each chosen photo then goes through the same checks and Save draft path as an upload.
  (function midasImport(){
    const radio=document.querySelector('input[name="source"][value="link"]'),options=document.querySelector('.source-options');
    if(!radio||!options||typeof addPrimary!=='function')return;
    radio.disabled=false;radio.closest('label')?.classList.remove('unavailable');
    const small=radio.closest('label')?.querySelector('small');if(small)small.textContent='Paste a Midas product link or SKU; its Midas photos are used as your originals.';
    const hint=document.querySelector('.catalogue-return small');if(hint)hint.textContent='Saved as a reference instruction for companion pieces. To use a Midas product as the source itself, choose Import Midas link above.';
    const panel=document.createElement('section');panel.id='midasImportPanel';panel.className='midas-import';panel.hidden=true;
    const label=document.createElement('label');label.textContent='Midas product link or SKU';
    const field=document.createElement('input');field.id='midasImportRef';field.type='text';field.maxLength=600;field.autocomplete='off';field.placeholder='https://midasfurniture.com/…/product-name-175913-midas.html or 175913';label.append(field);
    const find=make('button','Find product');find.type='button';find.id='midasImportFind';
    const note=make('p','');note.id='midasImportStatus';note.setAttribute('role','status');
    const gallery=document.createElement('div');gallery.id='midasImportGallery';gallery.className='preview-grid';
    panel.append(label,find,note,gallery);options.after(panel);
    let ticket=0;
    for(const input of document.querySelectorAll('input[name="source"]'))input.addEventListener('change',()=>{panel.hidden=!radio.checked;if(radio.checked)field.focus();});
    async function photoFile(product,index){
      const response=await fetch('/api/owner/midas-import/'+encodeURIComponent(product.sku)+'/'+index,{cache:'no-store',signal:AbortSignal.timeout(30000)});
      if(!response.ok){let data={};try{data=await response.json();}catch{}throw Error(data.message||'The Midas photo could not be downloaded.');}
      const blob=await response.blob(),type=blob.type,ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];if(!ext)throw Error('The Midas photo is not a JPEG, PNG or WebP image.');
      return new File([blob],`midas-${product.sku}-${index+1}.${ext}`,{type});
    }
    async function lookup(){
      const ref=field.value.trim();if(!ref){note.textContent='Paste one Midas product link or SKU first.';field.focus();return;}
      const mine=++ticket;find.disabled=true;note.textContent='Looking up the product in the Midas catalogue…';gallery.replaceChildren();
      try{
        const {product}=await request('/api/owner/midas-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref})});if(mine!==ticket)return;
        const main=await photoFile(product,0);if(mine!==ticket)return;
        // addPrimary answers false when the photo was not added (too large, unreadable, or replaced meanwhile); say so here.
        if(!(await addPrimary([main]))){if(mine===ticket)note.textContent=`${product.name||'Midas product'} · SKU ${product.sku} was found, but its main photo was not added: ${$('sourceStatus')?.textContent||'this browser could not use it'}. Upload the product image instead.`;return;}
        if(window.a7Start?.state?.primary)window.a7Start.state.primary.midasName=product.name||'';
        if($('connectedSku')&&!$('connectedSku').value.trim()){$('connectedSku').value=product.sku;$('connectedSku').dispatchEvent(new Event('input',{bubbles:true}));}
        note.textContent=`${product.name||'Midas product'} · SKU ${product.sku}. Its main Midas photo is now your primary original (not saved until Save draft). ${product.photos>1?'Add other Midas photos of this same product as side views if they help:':''}`;
        for(let index=1;index<product.photos;index++){
          const figure=document.createElement('figure');figure.className='preview-card';
          const img=document.createElement('img');img.src='/api/owner/midas-import/'+encodeURIComponent(product.sku)+'/'+index;img.alt=`Midas photo ${index+1} of ${product.name||product.sku}`;img.loading='lazy';
          const add=make('button','Add as side view');add.type='button';
          add.addEventListener('click',async()=>{add.disabled=true;try{if(await addViews([await photoFile(product,index)])){add.textContent='Added as side view';note.textContent=`Midas photo ${index+1} was added as a side view (not saved until Save draft).`;}else{add.disabled=false;note.textContent=`Midas photo ${index+1} was not added: ${$('drawerStatus')?.textContent||'this browser could not use it'}`;}}catch(error){add.disabled=false;note.textContent=error.message;}});
          const caption=document.createElement('figcaption');caption.append(make('span',`Midas photo ${index+1}`),add);figure.append(img,caption);gallery.append(figure);
        }
      }catch(error){if(mine===ticket)note.textContent=error.message||'The Midas catalogue did not answer. Try again or upload the product image.';}
      finally{if(mine===ticket)find.disabled=false;}
    }
    find.addEventListener('click',lookup);
    field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookup();}});
  })();
  // Companion pieces: check pasted SKUs or Midas links against A7's catalogue rules before they are saved as fixed picks.
  // A pick A7 cannot use holds the whole job with a question, so the owner sees the reason here first.
  (function companionCheck(){
    const field=$('prefItems');if(!field||!field.parentElement)return;
    const check=make('button','Check Midas items');check.type='button';check.id='prefItemsCheck';
    const use=make('button','Use the usable SKUs');use.type='button';use.id='prefItemsUse';use.hidden=true;
    const note=make('p','');note.id='prefItemsStatus';note.setAttribute('role','status');
    const list=document.createElement('ul');list.id='prefItemsResults';
    field.parentElement.after(check,use,note,list);
    let usable=[];
    check.addEventListener('click',async()=>{
      const items=field.value.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
      if(!items.length){note.textContent='Paste Midas SKUs or product links first, one per line.';return;}
      if(items.length>12){note.textContent='Check at most 12 items at a time.';return;}
      check.disabled=true;use.hidden=true;list.replaceChildren();note.textContent='Checking against the A7 catalogue…';
      try{
        const data=await request('/api/owner/midas-picks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
        usable=[...new Set(data.results.filter(r=>r.usable).map(r=>r.sku))];
        for(const r of data.results)list.append(make('li',r.usable?`${r.sku} · ${r.name} — usable`:`${r.input}${r.sku&&r.sku!==r.input?' ('+r.sku+')':''} — not usable: ${r.reason}`));
        note.textContent=`${usable.length} of ${data.results.length} can be used as companion pieces (A7 catalogue as of ${data.asOf}). A7 uses at most 3 per job, only in room images, and still checks that a piece is not the same kind as your product.`;
        use.hidden=!usable.length||usable.join('\n')===field.value.trim();
      }catch(error){note.textContent=error.message||'The check could not run.';}
      finally{check.disabled=false;}
    });
    use.addEventListener('click',()=>{field.value=usable.join('\n');field.dispatchEvent(new Event('input',{bubbles:true}));use.hidden=true;note.textContent='Only the usable SKUs are kept as companion pieces. Save the draft again to keep this change.';});
  })();
  // Batch: every product in a collection is its own case and its own A7 job. After a case is saved, the owner can start the
  // next product; it is saved into the same collection while the project name is unchanged.
  (function collectionNext(){
    const status=$('connectedStatus');if(!status||typeof nextItem!=='function')return;
    const next=make('button','Next item in this collection');next.type='button';next.id='nextCollectionItem';next.hidden=true;status.after(next);
    next.addEventListener('click',()=>{
      for(const id of ['connectedProduct','connectedSku','connectedInventory','prefInventory','prefDimensions'])if($(id))$(id).value='';
      draft=null;estimate=null;understanding=null;next.hidden=true;nextItem();
      say(`Add the next product for “${collection?.title||'this collection'}”. It is saved as a separate case and sent as its own job; preferences are kept.`);
    });
  })();
})();
