import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto,randomUUID} from 'node:crypto';

const source = await readFile(new URL('../start-connected.js',import.meta.url),'utf8');
const parentId=randomUUID();
function harness({outcome='White BK',saved=false,delayedEstimate=false,job=null,jobs=null,approvalFailure=false,approval=null,analysisReady=false,estimateStatus='verified',testMode=false,extraRecords=[],dispatchCheck=null,analysisFlow=null,patchError=null,fastTimers=false,estimateError=null,savedBrief={},receipt=null,confirmedCount=null,quoteError=null,midas=null,estimateExtra={},paidReady=true,savedVersion={},quoteWarnings=undefined,confirmRefusal=null,directionChanged=false,search=''}={}) {
  const handlers=new Map(),elements=new Map(),calls=[];
  function on(id,type,fn){const key=id+':'+type;handlers.set(key,[...(handlers.get(key)||[]),fn]);}
  function element(id){
    if(!elements.has(id)) elements.set(id,{id,value:'',textContent:'',disabled:false,checked:false,children:[],name:'',addEventListener(type,fn){on(id,type,fn)},dispatchEvent(event){for(const fn of handlers.get(id+':'+event.type)||[])fn(event)},click(){for(const fn of handlers.get(id+':click')||[])fn()},replaceChildren(...children){this.children=children},append(...children){this.children.push(...children)},add(option){this.children.push(option)},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false},after(...nodes){this.siblings=[...(this.siblings||[]),...nodes]},closest(){return null},setAttribute(name,value){this[name]=value}});
    return elements.get(id);
  }
  const state={intent:'single',route:'hero',primary:{file:new File([new Uint8Array(16)],'product.png',{type:'image/png'})},side:{left:null,right:null},views:[],notes:[]};
  element('estimateConnected').disabled=true;element('submitConnected').disabled=true;
  Object.assign(element('connectedProduct'),{value:'Sofa'});Object.assign(element('connectedInventory'),{value:'1 sofa'});Object.assign(element('connectedBudget'),{value:'4.74'});
  Object.assign(element('prefResolution'),{value:'2K'});Object.assign(element('prefCamera'),{value:'Reference view'});Object.assign(element('imagePreset'),{value:'category'});
  const outcomes=['White BK','Lifestyle','Website'].map(value=>({value,checked:value===outcome}));
  const refs=[{id:'ref-1',role:'product',sha256:'a'.repeat(64)}];
  const version=saved?{version_id:parentId,title:'Saved sofa',case_title:'Sofa case',version:1,dispatch_state:'draft',client_run_id:null,fingerprint:'a'.repeat(64),note:'Original instruction',direction:'Original instruction',brief:{product:'Sofa',sku:'SKU-1',inventory:'1 sofa',outcome:'White background',view:'Category template',aspect:'1:1',resolution:'2K',lighting:'Daylight',budgetUsd:4.74,editSource:'saved',startType:'product_collection',dimensions:'200 cm wide',...savedBrief},...savedVersion}:null;
  let nextId=randomUUID(),resolveEstimate,analysisState='not_started';const jobList=jobs||(job?[job]:[]);
  const analysisReceipt=receipt||{fingerprint:'b'.repeat(64),observation:{category:'Sofa',eyeCount:2,secondCount:2,visibleSeatCount:3},roomObservation:null,conflicts:[]};
  const confirmation=confirmedCount?{confirmation:{category:'Sofa',physicalCount:confirmedCount,pieces:[]}}:{};
  const failure=(status,body)=>({ok:false,status,json:async()=>body});
  const fetch=async(url,options={})=>{
    calls.push({url,method:options.method||'GET',body:options.body});
    let data={};
    if(url==='/api/owner/projects')data=options.method==='POST'?{draft:{id:nextId,fingerprint:'a'.repeat(64)}}:{records:version?[version,...extraRecords]:extraRecords};
    else if(url.startsWith('/api/owner/projects/')&&options.method==='PATCH'){if(patchError)return {ok:false,status:409,json:async()=>({error:patchError})};data={draft:{id:nextId,fingerprint:'b'.repeat(64)}};}
    else if(url.startsWith('/api/owner/projects/')&&options.method==='POST'&&JSON.parse(options.body).action==='dispatch_check')data=dispatchCheck||{state:'draft',changed:true};
    else if(url.startsWith('/api/owner/project-references/'))data=options.method==='POST'?{saved:true}:{references:refs};
    else if(url.startsWith('/api/owner/project-estimate/')){
      if(estimateError)return {ok:false,status:503,json:async()=>estimateError};
      if(delayedEstimate)await new Promise(resolve=>{resolveEstimate=resolve});
      data={status:estimateStatus,paidReady,testMode,ceilingUsd:4.74,noRepairUsd:0.5,twoRepairsEachUsd:0.7,outputs:['White master'],fingerprint:'f'.repeat(64),expiresAt:'2099-01-01T00:00:00Z',warnings:[],...estimateExtra};
    }
    else if(url.startsWith('/api/owner/source-understanding/')){
      if(url.includes('?action=quote')){if(quoteError)return failure(quoteError.status,quoteError.body);data=analysisReady?{status:'verified',maxCostUsd:1.25,fingerprint:'analysis-quote',source:{referenceFingerprint:'a'.repeat(64)},...(quoteWarnings?{warnings:quoteWarnings}:{})}:{status:'not_connected'};}
      else if(options.method==='POST'){
        const body=JSON.parse(options.body);
        // analysisFlow 'source_changed': the reading runs in the background, then the version changes under it,
        // so the server answers every check with 409 and reports the analysis as stale.
        if(analysisFlow==='source_changed'){
          if(body.action==='analyze'){analysisState='running';data={status:'pending_or_uncertain',analysis:'running'};}
          else if(body.action==='recover'){analysisState='stale';return {ok:false,status:409,json:async()=>({error:'analysis_source_changed'})};}
        }else if(analysisFlow==='recover_unavailable'){
          // The reading runs; every check of its receipt fails on the server (503), so whether reads were charged is unknown.
          if(body.action==='analyze'){analysisState='running';data={status:'pending_or_uncertain',analysis:'running'};}
          else return failure(503,{error:'source_understanding_unavailable'});
        }else if(analysisFlow==='signed_out'){
          // The reading runs; then the owner's sign-in ends, so every later check is refused with 401.
          if(body.action==='analyze'){analysisState='running';data={status:'pending_or_uncertain',analysis:'running'};}
          else return failure(401,{error:'unauthorized'});
        }else{
        if(body.action==='confirm'&&confirmRefusal){const refusal=confirmRefusal;confirmRefusal=null;return failure(400,refusal);}
        if(body.action==='analyze')analysisState='awaiting_confirmation';if(body.action==='confirm')analysisState='confirmed';
        data={status:analysisState,receipt:analysisState==='not_started'?null:analysisReceipt,...(analysisState==='confirmed'?confirmation:{})};}
      }else if(analysisState==='running')data={status:'pending_or_uncertain',analysis:'running',source:{referenceFingerprint:'a'.repeat(64)}};
      else if(analysisState==='stale')data={status:'stale',source:{referenceFingerprint:'c'.repeat(64)}};
      else data={status:analysisState,source:{referenceFingerprint:'a'.repeat(64),directionChanged},...(analysisState==='not_started'?{}:{receipt:analysisReceipt}),...(analysisState==='confirmed'?confirmation:{})};
    }
    else if(url.startsWith('/api/owner/jobs?offset=')){const offset=Number(url.split('=')[1]);data={jobs:jobList.slice(offset,offset+50),total:jobList.length,nextOffset:offset+50<jobList.length?offset+50:null,asOf:'2026-10-18T00:00:00Z'};}
    else if(jobList.some(x=>url==='/api/owner/jobs/'+x.id)){data={job:jobList.find(x=>url==='/api/owner/jobs/'+x.id)};}
    else if(jobList.some(x=>url==='/api/owner/jobs/'+x.id+'/approval')){if(approvalFailure)throw Error('ticket_unavailable');data=approval||{gate:null,decisionNeeded:false,allowed:[]};}
    else if(url==='/api/owner/submissions')data={accepted:true,message:'received'};
    else if(url==='/api/owner/me')return failure(401,{error:'unauthorized'});
    else if(url==='/api/owner/midas-import'&&midas)data={product:{sku:'175913',name:'Abali sofa',photos:2}};
    else if(url.startsWith('/api/owner/midas-import/')&&midas)return {ok:true,blob:async()=>new Blob([new Uint8Array(16)],{type:'image/png'})};
    else throw Error('Unexpected request: '+url);
    return {ok:true,json:async()=>data};
  };
  const document={getElementById:element,querySelector:selector=>selector==='input[name="intent"][value="edit"]'?element('intent-edit'):selector==='input[name="route"][value="saved"]'?element('route-saved'):element('setupPage'),querySelectorAll:selector=>selector.includes('prefOutcome')?selector.includes(':checked')?outcomes.filter(x=>x.checked):outcomes:selector.includes('#connectedInventory')?['connectedProduct','connectedInventory','connectedSku','connectedBudget','sourceCatalogueRefs','prefInventory','prefBudget'].map(element):[],createElement:tag=>element('created-'+tag+'-'+Math.random()),addEventListener(type,fn){on('document',type,fn)},visibilityState:'visible'};
  const window={location:{search},history:{pushState(){}},a7Start:{state,preferenceFields:[],preferenceValue:()=>'',restoreSaved({version,reference}){state.intent='edit';state.route='saved';state.primary={file:{name:'Saved original',stored:true},url:'/api/owner/project-references/'+version.version_id+'/'+reference.id};element('chatInput').value=version.direction},clearSaved(){state.primary=null},...(midas?{addPrimary:async()=>midas.primary,addViews:async()=>midas.views}:{})},addEventListener(type,fn){on('window',type,fn)}};
  runInNewContext(source,{window,document,fetch,crypto:webcrypto,setTimeout:(fn,ms)=>{const t=setTimeout(fn,fastTimers&&ms>=10000?0:ms);t.unref?.();return t;},clearTimeout,File,FormData,AbortSignal,Event,Option:class{constructor(text,value){this.text=text;this.value=value}},console});
  return {state,calls,element,outcomes,version,byId:id=>[...elements.values()].find(x=>x.id===id),text:id=>[element(id).textContent,...element(id).children.map(x=>x.textContent)].join(' '),flush:()=>new Promise(resolve=>setImmediate(resolve)),releaseEstimate:()=>resolveEstimate?.(),async fire(id,type,extra={}){for(const fn of handlers.get(id+':'+type)||[])await fn({target:element(id),...extra});},async click(id){assert.ok(handlers.has(id+':click'),'missing handler '+id);await this.fire(id,'click');}};
}

test('nonempty Step 2 prompt persists, binds estimate, and enters only a confirmed mocked submission',async()=>{
  const h=harness({analysisReady:true});h.element('chatInput').value='Keep the exact left arm and fabric.';
  await h.click('saveConnectedDraft');
  const saved=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
  assert.match(saved.note,/Keep the exact left arm and fabric/);
  assert.equal(saved.brief.page,'studio');assert.equal(saved.brief.outcomes,'White BK');assert.equal(saved.brief.outcome,'White background');assert.equal(saved.brief.camera,'Reference view');assert.equal(saved.brief.lighting,'');
  await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');await h.click('sourceReviewConfirm');
  await h.click('estimateConnected');
  assert.equal(h.element('submitConnected').disabled,false);
  await h.click('submitConnected');
  assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
  await h.click('confirmSend');
  assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
  h.element('confirmChecked').checked=true;await h.click('confirmSend');
  const sent=JSON.parse(h.calls.find(x=>x.url==='/api/owner/submissions').body.get('payload'));
  assert.equal(sent.instructions,saved.note);
  assert.equal(sent.estimateConfirmation.fingerprint,'f'.repeat(64));
});

test('a changed prompt discards an in-flight estimate and cannot submit the stale draft',async()=>{
  const h=harness({delayedEstimate:true,analysisReady:true});await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');await h.click('sourceReviewConfirm');
  const inFlight=h.click('estimateConnected');await h.flush();
  h.element('chatInput').value='Changed after estimate started';await h.fire('setupPage','input',{target:elementFor(h,'chatInput')});
  h.releaseEstimate();await inFlight;
  assert.equal(h.element('submitConnected').disabled,true);
  await h.click('submitConnected');assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
});
function elementFor(h,id){return h.element(id)}
// The saved-work search waits for typing to pause before it filters.
const searchSettles=()=>new Promise(resolve=>setTimeout(resolve,400));

test('saved direction restores into editable Step 2 and saves one replacement version with original fields',async()=>{
  const h=harness({saved:true});await h.flush();assert.equal(h.element('savedWorkList').children.length,1);h.element('savedVersion').value=parentId;
  await h.click('openSavedVersion');
  assert.equal(h.element('chatInput').value,'Original instruction');
  assert.equal(h.element('connectedSku').value,'SKU-1');
  assert.equal(h.element('prefDimensions').value,'200 cm wide');
  h.element('editChanges').value='Warm evening light';h.element('editPreserve').value='Same original sofa and room';
  h.element('chatInput').value='Updated instruction';await h.fire('setupPage','input',{target:h.element('chatInput')});
  await h.click('saveConnectedDraft');
  const request=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
  assert.equal(request.parentId,parentId);
  assert.equal(request.directionMode,'replace');
  assert.equal(request.note,'Updated instruction');
  assert.equal(request.brief.sku,'SKU-1');
  assert.equal(request.brief.dimensions,'200 cm wide');
  assert.equal(request.brief.allowedChanges,'Warm evening light');
  assert.equal(request.brief.protectedDetails,'Same original sofa and room');
  assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url.startsWith('/api/owner/project-references/')).length,0);
  await h.click('estimateConnected');assert.equal(h.element('submitConnected').disabled,true);
});
test('saved-work card opens the real recorded version and reloads its original',async()=>{
 const h=harness({saved:true});await h.flush();
 const card=h.element('savedWorkList').children[0];
 assert.match(card.children[0].textContent,/Sofa case/);
 card.children.find(child=>child.textContent==='Edit this version').click();
 await h.flush();await h.flush();
 assert.equal(h.state.intent,'edit');assert.equal(h.state.route,'saved');
 assert.equal(h.state.primary.file.stored,true);
 assert.equal(h.element('chatInput').value,'Original instruction');
 assert.equal(h.calls.some(call=>call.url==='/api/owner/project-references/'+parentId),true);
});

test('unsupported outcome remains blocked despite job instructions',async()=>{
  const h=harness({outcome:'Lifestyle'});h.element('chatInput').value='Sunny room';await h.click('saveConnectedDraft');await h.click('estimateConnected');
  assert.equal(h.element('submitConnected').disabled,true);
  await h.click('submitConnected');assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
});
test('an unconfirmed source cannot reach paid planning, even when the white-master estimate is available',async()=>{
 const h=harness({analysisReady:true});await h.click('saveConnectedDraft');await h.click('estimateConnected');
 assert.equal(h.calls.filter(x=>x.url.startsWith('/api/owner/project-estimate/')).length,0);
 await h.click('submitConnected');assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
});
test('result guidance names missing details and invalid inventory without sending a draft',async()=>{
  const h=harness();h.element('connectedProduct').value='';h.element('connectedInventory').value='';
  await h.fire('window','a7-results-open');assert.match(h.element('connectedStatus').textContent,/analysis is not connected/);
  await h.click('saveConnectedDraft');assert.match(h.element('connectedStatus').textContent,/physical piece/);
  h.element('connectedInventory').value='1 sofa\nunknown quantity';await h.click('saveConnectedDraft');
  assert.equal(h.calls.filter(x=>x.url==='/api/owner/projects'&&x.method==='POST').length,0);
  h.element('connectedInventory').value='1 sofa';await h.click('saveConnectedDraft');
  assert.match(h.element('connectedStatus').textContent,/product type/);
  assert.equal(h.calls.filter(x=>x.url==='/api/owner/projects'&&x.method==='POST').length,0);
});
test('recorded observations survive an unavailable approval ticket',async()=>{
  const job={id:'run-1',clientId:'owner-'+randomUUID(),status:'hold',stage:'Evidence',history:[],observation:{category:'Sofa',eyeCount:2,secondCount:2,statedCount:3,colour:'Beige',materialAppearance:'Woven',pieces:[{kind:'module',label:'left unit',features:['connector']}],uncertainties:['rear not visible']}};
  const h=harness({job,approvalFailure:true});await h.flush();
  h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
  const text=h.element('connectedJobDetail').children.map(x=>x.textContent).join(' ');
  assert.match(text,/Recorded reader observations/);assert.match(text,/left unit/);assert.match(text,/rear not visible/);assert.match(text,/Approval ticket unavailable/);
  assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/submissions').length,0);
});
test('change approval requires a typed note inside the confirmation dialog',async()=>{
 const job={id:'run-approval',clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 1',history:[],observation:null};
 const approval={clientId:job.clientId,runId:job.id,gate:'go1',round:1,revision:'revision-1',paidReady:true,allowed:['change']};
 const h=harness({job,approval});await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const button=h.element('connectedJobDetail').children.find(child=>child.textContent==='Request plan changes');
 assert.ok(button);button.click();h.element('confirmChecked').checked=true;
 await h.click('confirmSend');
 assert.equal(h.calls.filter(call=>call.url.endsWith('/approval')&&call.method==='POST').length,0);
 h.element('confirmNote').value='Keep both chairs and remove the table';await h.click('confirmSend');
 const posted=h.calls.find(call=>call.url.endsWith('/approval')&&call.method==='POST');
 assert.equal(JSON.parse(posted.body).note,'Keep both chairs and remove the table');
});
test('job dropdown gathers paginated real IDs and filters by recorded status without opening jobs',async()=>{
 const jobs=Array.from({length:56},(_,i)=>({id:'run-'+i,clientId:'owner-'+randomUUID(),status:i%2?'hold':'completed',stage:'Recorded',history:[]}));
 const h=harness({jobs});await h.flush();await h.flush();
 assert.equal(h.element('jobSelect').children.length,57);
 assert.equal(h.element('jobSelect').children[56].value,'run-55');
 assert.equal(h.calls.filter(x=>x.url.startsWith('/api/owner/jobs?')).length,2);
 assert.equal(h.calls.filter(x=>x.url==='/api/owner/jobs/run-55').length,0);
 h.element('jobStatusFilter').value='hold';await h.fire('jobStatusFilter','change');
 assert.equal(h.element('jobSelect').children.length,29);
 h.element('jobSelect').value='run-55';await h.fire('jobSelect','change');await h.flush();
 assert.equal(h.calls.filter(x=>x.url==='/api/owner/jobs/run-55').length,1);
 assert.equal(h.calls.filter(x=>x.method==='POST').length,0);
});
test('source review uses a separate cost confirmation, then shows physical pieces and owner correction',async()=>{
 const h=harness({analysisReady:true});await h.click('saveConnectedDraft');
 assert.match(h.element('sourceReviewStatus').textContent,/reserves up to USD 1.25/);
 await h.click('sourceReviewAnalyze');assert.equal(h.calls.filter(x=>x.url.includes('/source-understanding/')&&x.method==='POST').length,0);
 h.element('confirmChecked').checked=true;await h.click('confirmSend');
 assert.equal(h.calls.filter(x=>x.url.includes('/source-understanding/')&&x.method==='POST').length,1);
 assert.match(h.element('sourceReviewFacts').children[0].textContent,/physical count: 2/);
 assert.match(h.element('sourceReviewFacts').children[0].textContent,/visible seats: 3/);
 assert.match(h.element('resultCategory').textContent,/Observed: Sofa/);
 assert.match(h.element('briefFacts').textContent,/require your review/);
 h.element('sourceReviewCount').value='2';await h.click('sourceReviewConfirm');
 const confirmation=JSON.parse(h.calls.filter(x=>x.url.includes('/source-understanding/')&&x.method==='POST')[1].body);
 assert.equal(confirmation.physicalCount,2);assert.equal(h.element('sourceReviewStatus').textContent.includes('confirmed'),true);
 assert.match(h.element('resultCategory').textContent,/Confirmed: Sofa/);
 assert.match(h.element('resultReviewState').textContent,/Owner confirmed/);
});
test('Step 2 saves original source without a fabricated product type or count, then revises the same draft',async()=>{
 const h=harness();h.element('connectedProduct').value='';h.element('connectedInventory').value='';
 await h.click('saveSourceDraft');
 const saved=JSON.parse(h.calls.find(x=>x.url==='/api/owner/projects'&&x.method==='POST').body);
 assert.equal(saved.brief.product,'');assert.equal(saved.brief.inventory,'');
 assert.equal(h.element('estimateConnected').disabled,true);
 h.element('connectedProduct').value='Sofa';h.element('connectedInventory').value='2 seat modules';
 await h.fire('connectedProduct','input');await h.click('saveConnectedDraft');
 const revised=h.calls.find(x=>x.url.startsWith('/api/owner/projects/')&&x.method==='PATCH');
 assert.ok(revised);assert.equal(JSON.parse(revised.body).expectedFingerprint,'a'.repeat(64));
 assert.equal(h.calls.filter(x=>x.url==='/api/owner/projects'&&x.method==='POST').length,1);
 assert.equal(h.element('estimateConnected').disabled,false);
});

test('an uncalibrated scope stays draft-only, and owner test mode can send it with the provisional estimate',async()=>{
  for(const testMode of [false,true]){
    const h=harness({outcome:'Lifestyle',estimateStatus:'provisional',testMode,analysisReady:true});
    await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');await h.click('sourceReviewConfirm');
    await h.click('estimateConnected');
    assert.equal(h.element('submitConnected').disabled,!testMode);
    await h.click('submitConnected');h.element('confirmChecked').checked=true;await h.click('confirmSend');
    assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,testMode?1:0);
    if(testMode)assert.match(h.element('executionScopeStatus').textContent,/Owner test mode/);
  }
});

test('saved work summarises recorded dispatch states and filters by state, work type, outcome and search without inventing values',async()=>{
 const record=(i,state,brief={})=>({id:'project-'+(i%3),version_id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),title:'Project '+i,case_title:'Case '+i,version:1,dispatch_state:state,client_run_id:null,brief});
 const extraRecords=[record(1,'outcome_unknown',{routeIntent:'single',outcome:'White background'}),record(2,'received',{routeIntent:'project',outcome:'Lifestyle'}),record(3,'confirmed',{routeIntent:'edit'}),record(4,'draft',{}),record(5,'mystery_state',{outcome:'Lifestyle'})];
 const h=harness({extraRecords});await h.flush();
 const summary=Object.fromEntries(h.element('savedWorkSummary').children.map(row=>[row.children[0].textContent,row.children[1].textContent]));
 assert.deepEqual(summary,{'Recorded versions':'5','Drafts':'1','In progress':'2','Needs attention':'1','Completed':'0'});
 assert.equal(h.element('savedWorkSummary').children[0].children[2].textContent,'3 projects');
 const titles=()=>h.element('savedWorkList').children.map(card=>card.children[0].textContent);
 assert.equal(titles().length,5);
 const badges=h.element('savedWorkList').children.map(card=>card.children[4].textContent);
 assert.deepEqual(badges,['Outcome unknown','Received by A7','Sent · receipt not recorded','Draft','mystery state']);
 const pill=value=>({dataset:{savedFilter:value},closest(){return this;}});
 await h.fire('savedWorkFilters','click',{target:pill('attention')});assert.deepEqual(titles(),['Case 1']);
 await h.fire('savedWorkFilters','click',{target:pill('progress')});assert.deepEqual(titles(),['Case 2','Case 3']);
 await h.fire('savedWorkFilters','click',{target:pill('done')});assert.deepEqual(titles(),[]);
 await h.fire('savedWorkFilters','click',{target:pill('draft')});assert.deepEqual(titles(),['Case 4']);
 await h.fire('savedWorkFilters','click',{target:pill('all')});
 assert.deepEqual(h.element('savedWorkType').children.map(option=>option.text),['All work types','New project (1)','Single product (1)','Edit (1)','Not recorded (2)']);
 h.element('savedWorkType').value='single';await h.fire('savedWorkType','change');assert.deepEqual(titles(),['Case 1']);
 h.element('savedWorkType').value='';await h.fire('savedWorkType','change');
 h.element('savedWorkOutcome').value='Lifestyle';await h.fire('savedWorkOutcome','change');assert.deepEqual(titles(),['Case 2','Case 5']);
 h.element('savedWorkOutcome').value='unrecorded';await h.fire('savedWorkOutcome','change');assert.deepEqual(titles(),['Case 3','Case 4']);
 h.element('savedWorkOutcome').value='';await h.fire('savedWorkOutcome','change');
 await h.fire('savedWorkSearch','input',{target:{value:'case 4'}});await searchSettles();assert.deepEqual(titles(),['Case 4']);
 await h.fire('savedWorkSearch','input',{target:{value:'no such case'}});await searchSettles();
 assert.equal(titles().length,0);assert.match(h.element('savedWorkStatus').textContent,/No saved versions match/);
 assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
});
test('saved versions take the status of exactly one linked job and fall back to the saved state otherwise',async()=>{
 const record=(i,state,ids={})=>({id:'project-'+i,version_id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),title:'Project '+i,case_title:'Case '+i,version:1,dispatch_state:state,client_run_id:null,brief:{},...ids});
 const jobs=[{id:'run-a',clientId:'owner-a',status:'completed',stage:'06 Package'},{id:'run-b',clientId:'owner-b',status:'hold',stage:'Go 1'},{id:'run-dup',clientId:'owner-x',status:'processing'},{id:'run-dup2',clientId:'owner-x',status:'completed'}];
 const extraRecords=[record(1,'received',{run_id:'run-a',client_run_id:'owner-a'}),record(2,'confirmed',{client_run_id:'owner-b'}),record(3,'received',{client_run_id:'owner-x'}),record(4,'received',{client_run_id:'owner-missing'}),record(5,'draft')];
 const h=harness({extraRecords,jobs});await h.flush();await h.flush();await h.flush();
 const summary=Object.fromEntries(h.element('savedWorkSummary').children.map(row=>[row.children[0].textContent,row.children[1].textContent]));
 assert.deepEqual(summary,{'Recorded versions':'5','Drafts':'1','In progress':'2','Needs attention':'1','Completed':'1'});
 const cards=h.element('savedWorkList').children;
 assert.deepEqual(cards.map(card=>card.children[4].textContent),['completed','hold','Received by A7','Received by A7','Draft']);
 assert.deepEqual(cards.map(card=>card.children[5].children[0].textContent),['A7 job · 06 Package','A7 job · Go 1','More than one job matches · showing the saved state','No matching job in the loaded queue','No job yet']);
 const pill=value=>({dataset:{savedFilter:value},closest(){return this;}});
 await h.fire('savedWorkFilters','click',{target:pill('done')});assert.deepEqual(h.element('savedWorkList').children.map(card=>card.children[0].textContent),['Case 1']);
 await h.fire('savedWorkFilters','click',{target:pill('attention')});
 h.element('savedWorkList').children[0].children[5].children[1].click();await h.flush();await h.flush();
 assert.equal(h.element('jobSelect').value,'run-b');
 assert.equal(h.calls.filter(x=>x.url==='/api/owner/jobs/run-b').length,1);
 assert.equal(h.calls.filter(x=>x.method!=='GET').length,0);
});
test('compare reads up to three saved versions side by side and marks differing fields without writing',async()=>{
 const record=(i,brief)=>({id:'project-'+i,version_id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),title:'Project '+i,case_title:'Case '+i,version:i,dispatch_state:'draft',client_run_id:null,brief});
 const extraRecords=[record(1,{product:'Sofa',sku:'S-1',resolution:'2K'}),record(2,{product:'Sofa',sku:'S-2',resolution:'2K'}),record(3,{product:'Chair'}),record(4,{product:'Lamp'})];
 const h=harness({extraRecords});await h.flush();await h.flush();
 const box=i=>h.element('savedWorkList').children[i].children[7].children[0];
 const tick=async i=>{box(i).checked=!box(i).checked;box(i).dispatchEvent({type:'change'});};
 assert.equal(h.element('compareSavedVersions').disabled,true);
 await tick(0);assert.equal(h.element('compareSavedVersions').disabled,true);
 await tick(1);assert.equal(h.element('compareSavedVersions').disabled,false);assert.equal(h.element('compareSavedVersions').textContent,'Compare selected (2/3)');
 await tick(2);assert.equal(box(3).disabled,true);
 await tick(2);assert.equal(box(3).disabled,false);
 await h.click('compareSavedVersions');await h.flush();await h.flush();
 assert.equal(h.element('savedCompareDialog').open,true);
 const table=h.element('savedCompareContent').children[0].children[0],[,head,body]=table.children;
 assert.deepEqual(head.children[0].children.map(cell=>cell.textContent),['Field','v1 · Case 1','v2 · Case 2']);
 const row=label=>body.children.find(tr=>tr.children[0].textContent===label);
 assert.equal(row('SKU').className,'is-diff');assert.deepEqual(row('SKU').children.slice(1).map(td=>td.textContent),['S-1','S-2']);
 assert.notEqual(row('Product').className,'is-diff');assert.equal(row('Dimensions').children[1].textContent,'Not recorded');
 assert.match(row('Analysis on file').children[1].children[0].textContent,/No analysis on file/);
 for(const id of extraRecords.slice(0,2).map(r=>r.version_id))assert.equal(h.calls.some(x=>x.url==='/api/owner/source-understanding/'+id&&x.method==='GET'),true);
 assert.equal(h.calls.filter(x=>x.method!=='GET').length,0);
});
test('automatic names: reference, product name, Edited label and readable job names',async()=>{
 const v=(i,extra)=>({id:'p',version_id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),title:'Sofas and seating · October 2026',version:1,dispatch_state:'draft',client_run_id:null,brief:{},...extra});
 const extraRecords=[v(1,{case_title:'Abali Sofa — White',case_ref:'SOF-2610-07',case_category:'SOF'}),v(2,{case_title:'Abali Sofa — White',case_ref:'SOF-2610-07',case_category:'SOF',version:2,parent_id:'00000000-0000-4000-8000-000000000001',dispatch_state:'received',client_run_id:'owner-00000000-0000-4000-8000-000000000002'}),v(3,{case_title:'I005',case_ref:'GEN-2610-01',case_category:'GEN'})];
 const jobs=[{id:'claude-a7-00000000-0000-4000-8000-000000000002',clientId:'owner-00000000-0000-4000-8000-000000000002',status:'processing',stage:'03'}];
 const h=harness({extraRecords,jobs});await h.flush();await h.flush();await h.flush();
 const cards=h.element('savedWorkList').children;
 assert.deepEqual(cards.map(c=>c.children[0].textContent),['Abali Sofa — White','Abali Sofa — White','Unnamed product · file I005']);
 assert.match(cards[1].children[1].textContent,/v2 · Edited/);assert.doesNotMatch(cards[0].children[1].textContent,/Edited/);
 assert.equal(cards[1].children[0].children.at(-1).textContent,'Edited');
 assert.equal(h.element('jobQueueList').children[0].children[0].children[0].textContent,'SOF-2610-07 v2 · Edited');
 assert.match(h.element('jobSelect').children[1].text,/^SOF-2610-07 v2 · Edited · Abali Sofa — White · processing/);
 await h.fire('savedWorkSearch','input',{target:{value:'sof-2610-07'}});await searchSettles();assert.equal(h.element('savedWorkList').children.length,2);
 await h.fire('savedWorkSearch','input',{target:{value:'edited'}});await searchSettles();assert.equal(h.element('savedWorkList').children.length,1);
});
test('jobs and approvals use the saved version name, number repeat runs and label unlinked jobs',async()=>{
 const vid='00000000-0000-4000-8000-000000000002',client='owner-'+vid;
 const extraRecords=[{id:'p',version_id:vid,title:'Sofas and seating · October 2026',version:2,parent_id:'00000000-0000-4000-8000-000000000001',dispatch_state:'received',client_run_id:client,brief:{},case_title:'Abali Sofa — White',case_ref:'SOF-2610-07',case_category:'SOF'}];
 const jobs=[
  {id:'claude-a7-second',clientId:client,status:'hold',stage:'Go 1',createdAt:'2026-10-19T10:00:00Z',history:[]},
  {id:'claude-a7-first',clientId:client,status:'failed',stage:'03',createdAt:'2026-10-18T10:00:00Z',history:[]},
  {id:'claude-a7-20261017230527-1i4fxz',clientId:'owner-'+randomUUID(),status:'completed',stage:'Done',createdAt:'2026-10-17T20:05:27Z',history:[]}];
 const approval={clientId:client,runId:'claude-a7-second',gate:'go1',round:1,revision:'r1',paidReady:true,allowed:['stop']};
 const h=harness({extraRecords,jobs,approval});await h.flush();await h.flush();await h.flush();
 const rows=h.element('jobQueueList').children.map(li=>li.children[0].children);
 assert.deepEqual(rows.map(r=>r[0].textContent.replace(/ · .*\d{4}.*$/,' · <date>')),['SOF-2610-07 v2 · Edited · Run 2','SOF-2610-07 v2 · Edited · Run 1','Unlinked job · <date>']);
 assert.equal(rows[0][1].textContent,'Abali Sofa — White');assert.equal(rows[2][1].textContent,'claude-a7-20261017230527-1i4fxz');
 assert.match(rows[2][0].title,/No saved version/);
 assert.match(h.element('jobSelect').children[1].text,/^SOF-2610-07 v2 · Edited · Run 2 · Abali Sofa — White · hold · Go 1$/);
 h.element('jobSelect').value='claude-a7-second';await h.fire('jobSelect','change');await h.flush();await h.flush();
 const detail=h.element('connectedJobDetail').children;
 assert.equal(detail[0].textContent,'SOF-2610-07 v2 · Edited · Run 2');assert.equal(detail[1].textContent,'Abali Sofa — White');
 assert.match(detail.map(x=>x.textContent).join(' '),/A7 run claude-a7-second · request owner-0{8}/);
 detail.find(x=>x.textContent==='Stop this run').click();
 const lines=h.element('confirmDetails').children.map(x=>x.textContent);
 assert.equal(lines[0],'SOF-2610-07 v2 · Edited · Run 2 · Abali Sofa — White');assert.equal(lines[1],`A7 run claude-a7-second · request ${client}`);
 assert.equal(h.calls.filter(x=>x.method==='POST').length,0);
});
test('job queue mirrors the dropdown and opens the same read-only detail',async()=>{
 const jobs=Array.from({length:12},(_,i)=>({id:'run-'+i,clientId:'owner-'+randomUUID(),status:i%2?'hold':'completed',stage:'Recorded',history:[]}));
 const h=harness({jobs});await h.flush();await h.flush();
 const list=h.element('jobQueueList');assert.equal(list.children.length,8);assert.equal(h.element('jobQueueMore').hidden,false);
 await h.click('jobQueueMore');assert.equal(list.children.length,12);
 list.children[9].children[0].click();await h.flush();await h.flush();
 assert.equal(h.element('jobSelect').value,'run-9');
 assert.equal(h.calls.filter(x=>x.url==='/api/owner/jobs/run-9').length,1);
 assert.equal(h.calls.filter(x=>x.method==='POST').length,0);
});
test('typing a correction in the source review keeps the review and confirms a reader disagreement',async()=>{
  const h=harness({analysisReady:true});
  await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
  for(const [id,value] of [['sourceReviewCount','2'],['sourceReviewResolution','Two modules; the extra seat is part of one module.']]){
    h.element(id).value=value;await h.fire('setupPage','input',{target:h.element(id)});
  }
  assert.equal(h.element('sourceReviewCorrection').hidden,false);
  await h.click('sourceReviewConfirm');
  const confirm=h.calls.map(x=>x.body&&typeof x.body==='string'?JSON.parse(x.body):null).find(b=>b?.action==='confirm');
  assert.equal(confirm.physicalCount,2);assert.match(confirm.resolution,/Two modules/);
});

test('the job budget is a Step 3 preference that the saved draft and the submission carry',async()=>{
  const h=harness({analysisReady:true});
  h.element('prefBudget').value='9.5';await h.fire('prefBudget','input');
  assert.equal(h.element('connectedBudget').value,'9.5');
  await h.click('saveConnectedDraft');
  const saved=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
  assert.equal(Number(saved.brief.budgetUsd),9.5);
  h.element('prefBudget').value='10.5';await h.fire('prefBudget','input');
  await h.click('saveConnectedDraft');
  assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length,1);
  assert.equal(h.calls.filter(x=>x.body&&typeof x.body==='string'&&/"budgetUsd":"?10\.5/.test(x.body)).length,0);
});
test('an open Go 1 ticket shows a Go 1 button; a run still planning says Go 1 is not ready yet',async()=>{
 const job={id:'run-go1',clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 1',history:[],observation:null};
 const h=harness({job,approval:{clientId:job.clientId,runId:job.id,gate:'go1',round:1,revision:'r1',paidReady:true,allowed:['go','change','stop']}});await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const labels=h.element('connectedJobDetail').children.map(x=>x.textContent);
 assert.ok(labels.includes('Go 1 · Approve plan'));assert.ok(labels.includes('Stop this run'));
 const planning={id:'run-planning',clientId:'owner-'+randomUUID(),status:'received',stage:'01 Intake & observe',history:[],observation:null};
 const p=harness({job:planning});await p.flush();
 p.element('jobSelect').value=planning.id;await p.fire('jobSelect','change');await p.flush();await p.flush();
 assert.match(p.element('connectedJobDetail').children.map(x=>x.textContent).join(' '),/still reading and planning/);
 const quiet={id:'run-quiet',clientId:'owner-'+randomUUID(),status:'received',stage:'01 Intake & observe',updatedAt:new Date(Date.now()-3*60*60*1000).toISOString(),history:[],observation:null};
 const q=harness({job:quiet});await q.flush();
 q.element('jobSelect').value=quiet.id;await q.fire('jobSelect','change');await q.flush();await q.flush();
 const quietText=q.element('connectedJobDetail').children.map(x=>x.textContent).join(' ');
 assert.match(quietText,/not expected to reach Go 1/);assert.doesNotMatch(quietText,/still reading and planning/);
});

test('a send with no recorded receipt offers Check with A7, which reports the answer and reloads saved work',async()=>{
 const id='00000000-0000-4000-8000-000000000021';
 const extraRecords=[{id:'project-21',version_id:id,title:'Stuck',case_title:'Stuck case',version:1,dispatch_state:'outcome_unknown',client_run_id:'owner-'+id,brief:{}}];
 const h=harness({extraRecords,dispatchCheck:{state:'draft',changed:true}});await h.flush();await h.flush();await h.flush();
 const card=h.element('savedWorkList').children.find(c=>c.children[0].textContent.includes('Stuck case'));
 const check=card.children[5].children.find(x=>x.textContent==='Check with A7');assert.ok(check,'Check with A7 is offered');
 const before=h.calls.filter(x=>x.url==='/api/owner/projects'&&x.method==='GET').length;
 check.click();await h.flush();await h.flush();await h.flush();
 const post=h.calls.find(x=>x.url==='/api/owner/projects/'+id&&x.method==='POST');assert.deepEqual(JSON.parse(post.body),{action:'dispatch_check'});
 assert.ok(h.calls.filter(x=>x.url==='/api/owner/projects'&&x.method==='GET').length>before,'saved work is reloaded');
 const again=h.element('savedWorkList').children.find(c=>c.children[0].textContent.includes('Stuck case'));
 assert.match(again.children.find(x=>x.className==='ledger-note').textContent,/A7 never received this version and nothing was spent on it\. It is a draft again/);
 const received=harness({extraRecords:[{...extraRecords[0],dispatch_state:'received'}]});await received.flush();await received.flush();await received.flush();
 assert.equal(received.element('savedWorkList').children[0].children[5].children.some(x=>x.textContent==='Check with A7'),false,'a received version is not checked again');
});

test('Retry this edit reopens the same approved image with the stopped edit\'s texts and saves a new edit of the parent',async()=>{
 const child='00000000-0000-4000-8000-000000000031',asset='00000000-0000-4000-8000-0000000000a1';
 const edit={id:'project-31',version_id:child,parent_id:parentId,title:'Saved sofa',case_title:'Sofa case',version:2,dispatch_state:'received',client_run_id:'owner-'+child,run_id:'claude-a7-'+child,base_file_name:'sofa-evening-hero.png',
  brief:{product:'Sofa',resultAssetId:asset,editOptions:'lighting=Warm evening',allowedChanges:'Lighting: change the light to the Warm evening preset.',protectedDetails:'The product'}};
 const h=harness({saved:true,extraRecords:[edit],jobs:[{id:'claude-a7-'+child,clientId:'owner-'+child,status:'hold',stage:'Go 2'}]});await h.flush();await h.flush();await h.flush();
 const card=h.element('savedWorkList').children.find(c=>c.children.some(x=>x.textContent==='Edit this version')&&c.children[5].children.some(x=>x.textContent==='Retry this edit'));
 assert.ok(card,'a held edit offers Retry this edit');
 card.children[5].children.find(x=>x.textContent==='Retry this edit').click();await h.flush();await h.flush();await h.flush();
 assert.equal(h.element('savedVersion').value,parentId,'the retry opens the parent version');
 assert.equal(h.element('editChanges').value,edit.brief.allowedChanges);assert.equal(h.element('editPreserve').value,'The product');
 assert.ok(h.element('savedStatus').children.some(x=>/Retrying the edit of version 2/.test(x.textContent||'')));
 assert.ok(h.element('savedStatus').children.some(x=>/starts from the approved image sofa-evening-hero\.png\./.test(x.textContent||'')),'the retry names the approved image by its file name');
 h.element('chatInput').value='Warm evening light, everything else as approved.';
 await h.click('saveConnectedDraft');
 const saved=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
 assert.equal(saved.parentId,parentId);assert.equal(saved.mode,'edit');
 assert.equal(saved.brief.resultAssetId,asset,'the new edit starts from the same approved image');
 assert.equal(saved.brief.allowedChanges,edit.brief.allowedChanges);
 const finished=harness({saved:true,extraRecords:[edit],jobs:[{id:'claude-a7-'+child,clientId:'owner-'+child,status:'completed',stage:'07 Scenes'}]});await finished.flush();await finished.flush();await finished.flush();
 assert.equal(finished.element('savedWorkList').children.some(c=>c.children[5].children.some(x=>x.textContent==='Retry this edit')),false,'a completed edit is not offered a retry');
});

test('scenes from an approved white image unlock only the scene choices and the budget, and save no new white master',async()=>{
 const child='00000000-0000-4000-8000-000000000032',asset='00000000-0000-4000-8000-0000000000a2';
 const edit={id:'project-32',version_id:child,parent_id:parentId,title:'Saved sofa',case_title:'Sofa case',version:2,dispatch_state:'received',client_run_id:'owner-'+child,run_id:'claude-a7-'+child,base_file_name:'white_master_try1.jpg',
  brief:{product:'Sofa',outcome:'Lifestyle',resultAssetId:asset,editBaseKind:'white',allowedChanges:'New lifestyle scenes',protectedDetails:'The product'}};
 const h=harness({saved:true,extraRecords:[edit],jobs:[{id:'claude-a7-'+child,clientId:'owner-'+child,status:'hold',stage:'07 Scenes'}]});await h.flush();await h.flush();await h.flush();
 const card=h.element('savedWorkList').children.find(c=>c.children[5]?.children.some(x=>x.textContent==='Retry this edit'));
 assert.ok(card,'a held set of scenes offers a retry');
 card.children[5].children.find(x=>x.textContent==='Retry this edit').click();await h.flush();await h.flush();await h.flush();
 assert.equal(h.element('savedVersion').value,parentId);
 assert.ok(h.element('savedStatus').children.some(x=>/These scenes start from the approved white image/.test(x.textContent||'')));
 assert.equal(h.element('connectedBudget').disabled,false,'the job budget can be set');assert.equal(h.element('prefSeries').disabled,false,'the scene choices can be set');
 h.element('connectedBudget').value='3';
 h.element('chatInput').value='Two living room scenes from the approved white master.';
 await h.click('saveConnectedDraft');
 const saved=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
 assert.equal(saved.mode,'edit');assert.equal(saved.parentId,parentId);
 assert.equal(saved.brief.resultAssetId,asset);assert.equal(saved.brief.editBaseKind,'white');
 assert.equal(saved.brief.outcome,'Lifestyle','White BK is replaced by Lifestyle');assert.equal(saved.brief.outcomes,'Lifestyle');assert.equal(saved.brief.budgetUsd,3);assert.equal(saved.brief.editOptions,undefined,'no edit options');
});

test('a running reading whose photos changed stops at the server\'s answer and says what to do',async()=>{
 const h=harness({analysisReady:true,analysisFlow:'source_changed',fastTimers:true});await h.click('saveConnectedDraft');
 await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 assert.match(h.element('sourceReviewStatus').textContent,/Reading the originals in the background/);
 await new Promise(resolve=>setTimeout(resolve,100));
 const recovers=()=>h.calls.filter(x=>x.method==='POST'&&x.url.includes('/source-understanding/')&&JSON.parse(x.body).action==='recover').length;
 assert.equal(recovers(),1);
 assert.match(h.element('sourceReviewStatus').textContent,/product or room photo of this version is different now/);
 assert.match(h.element('sourceReviewStatus').textContent,/Save the originals as a new version/);
 // The facts panel says the same thing, instead of "not analysed".
 assert.match(h.element('briefFacts').textContent,/for a different product or room photo/);
 assert.equal(h.element('resultReviewState').textContent,'Read for other photos');
 assert.doesNotMatch(h.element('briefFacts').textContent,/No reader observation/);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(recovers(),1);assert.doesNotMatch(h.element('sourceReviewStatus').textContent,/checked \d+ time/);
});
test('a direction change refused while the reading runs says why, saves nothing, and can be saved later',async()=>{
 const h=harness({patchError:'analysis_running'});h.element('connectedProduct').value='';h.element('connectedInventory').value='';
 await h.click('saveSourceDraft');
 h.element('chatInput').value='Show the sofa in a bright living room';await h.click('saveSourceDraft');
 const patches=()=>h.calls.filter(x=>x.url.startsWith('/api/owner/projects/')&&x.method==='PATCH');
 assert.equal(patches().length,1);
 assert.match(h.element('connectedStatus').textContent,/still running[\s\S]*Nothing was saved/);
 h.element('chatInput').value='Show the sofa in a warm living room';await h.click('saveSourceDraft');
 assert.equal(patches().length,2);assert.notEqual(JSON.parse(patches()[1].body).requestId,JSON.parse(patches()[0].body).requestId);
});

test('a refused estimate says why directly under Get estimate, not only in the status line off screen',async()=>{
 const message='No estimate: this saved version has no outcome. In Step 3, tick White BK or Lifestyle, save the version, then get the estimate again.';
 const h=harness({analysisReady:true,estimateError:{error:'estimate_scope_unsupported',reason:'outcome',message}});await h.click('saveConnectedDraft');
 await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 h.element('sourceReviewCount').value='2';await h.click('sourceReviewConfirm');
 await h.click('estimateConnected');
 assert.equal(h.element('estimateDetails').children.map(x=>x.textContent).join(' '),message);
 assert.equal(h.element('submitConnected').disabled,true);
});

test('a saved draft with no outcome stays editable when opened and is completed in place, not as a new edit',async()=>{
 const h=harness({saved:true,savedBrief:{outcome:undefined,routeIntent:'single',routeChoice:'hero'}});await h.flush();h.element('savedVersion').value=parentId;
 await h.click('openSavedVersion');
 assert.ok(h.element('savedStatus').children.some(x=>/has no outcome yet/.test(x.textContent||'')));
 await h.click('saveConnectedDraft');
 assert.equal(h.calls.some(x=>x.url.startsWith('/api/owner/projects/')&&x.method==='PATCH'),false,'nothing is saved without an outcome');
 assert.match(h.element('connectedStatus').textContent,/Tick White BK or Lifestyle/);
 h.outcomes.find(x=>x.value==='White BK').checked=true;
 await h.click('saveConnectedDraft');
 const patch=h.calls.find(x=>x.url==='/api/owner/projects/'+parentId&&x.method==='PATCH');assert.ok(patch,'the same version is updated');
 const body=JSON.parse(patch.body);
 assert.equal(body.brief.outcome,'White background');assert.equal(body.brief.routeIntent,'single');assert.equal(body.brief.routeChoice,'hero');
 assert.equal(body.brief.editSource,'saved');assert.equal(body.note,h.version.note);assert.equal(body.expectedFingerprint,'a'.repeat(64));
 assert.equal(h.calls.some(x=>x.method==='POST'&&x.url==='/api/owner/projects'),false,'no new edit version');
 assert.equal(h.element('estimateConnected').disabled,false);
 assert.match(h.element('connectedStatus').textContent,/saved to this same version/);
});

// Batch A (19 Oct 2026): every save, send and review answer appears where the owner pressed, in words.
test('Save originals for analysis answers beside its own button in Step 2; the results-page save and send answer under theirs',async()=>{
 const h=harness();h.state.primary=null;
 await h.click('saveSourceDraft');
 assert.match(h.element('saveSourceStatus').textContent,/Select a primary original product image first/);assert.equal(h.element('saveSourceStatus').hidden,false);
 const s=harness();s.element('connectedProduct').value='';s.element('connectedInventory').value='';
 await s.click('saveSourceDraft');assert.match(s.element('saveSourceStatus').textContent,/Originals saved for source analysis/);
 const r=harness();r.element('connectedInventory').value='a few chairs';
 await r.click('saveConnectedDraft');assert.match(r.element('saveConnectedStatus').textContent,/physical piece on its own line/);
 await r.click('submitConnected');assert.match(r.element('submitConnectedStatus').textContent,/Save the draft and original references first/);
});
test('a refused save shows the server\'s words, and a definite refusal is not retried with the same request',async()=>{
 const h=harness({patchError:'route_changed'});h.element('connectedProduct').value='';h.element('connectedInventory').value='';
 await h.click('saveSourceDraft');
 h.element('chatInput').value='A new direction';await h.click('saveSourceDraft');
 assert.match(h.element('saveSourceStatus').textContent,/work type or route differs/);assert.doesNotMatch(h.element('saveSourceStatus').textContent,/route_changed/);
 h.element('chatInput').value='Another direction';await h.click('saveSourceDraft');
 const patches=h.calls.filter(x=>x.method==='PATCH');assert.equal(patches.length,2,'a refused update does not block the next save');
 assert.notEqual(JSON.parse(patches[0].body).requestId,JSON.parse(patches[1].body).requestId);
});
test('a reading that costs more than the job budget names the amount in Step 2 and under the budget field',async()=>{
 const message='Reading the originals reserves up to USD 3.18, more than this job\'s USD 2.00 budget. Raise the job budget in Step 3 to at least USD 3.18, plus what planning and images need, save, then check analysis availability again. Nothing was paid.';
 const h=harness({quoteError:{status:409,body:{error:'analysis_budget_exceeds_limit',message,requiredUsd:3.18,budgetUsd:2}}});
 await h.click('saveConnectedDraft');
 assert.equal(h.element('sourceReviewStatus').textContent,message);
 assert.match(h.element('budgetAnalysisNote').textContent,/needs up to USD 3\.18/);assert.equal(h.element('budgetAnalysisNote').hidden,false);
 assert.equal(h.element('sourceReviewAnalyze').disabled,true);
 const ok=harness({analysisReady:true});await ok.click('saveConnectedDraft');
 assert.match(ok.element('budgetAnalysisNote').textContent,/reserves up to USD 1\.25 of this budget/);
});
test('pieces that do not add up to the confirmed count are refused at save, estimate and send, with both numbers',async()=>{
 const h=harness({analysisReady:true,confirmedCount:2});
 await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');await h.click('sourceReviewConfirm');
 await h.click('estimateConnected');
 assert.match(h.text('estimateDetails'),/Pieces add up to 1; the confirmed count is 2/);
 assert.equal(h.calls.filter(x=>x.url.startsWith('/api/owner/project-estimate/')).length,0,'no estimate is requested for a version that cannot be sent');
 await h.click('submitConnected');assert.match(h.element('submitConnectedStatus').textContent,/Pieces add up to 1; the confirmed count is 2/);
 await h.click('saveConnectedDraft');assert.match(h.element('saveConnectedStatus').textContent,/Pieces add up to 1; the confirmed count is 2/);
});
test('an ended sign-in shows a banner with a sign-in link and stops the analysis watch at the first refusal',async()=>{
 const h=harness({analysisReady:true,analysisFlow:'signed_out',fastTimers:true});await h.click('saveConnectedDraft');
 await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 await new Promise(resolve=>setTimeout(resolve,100));
 const recovers=()=>h.calls.filter(x=>x.method==='POST'&&x.url.includes('/source-understanding/')&&JSON.parse(x.body).action==='recover').length;
 assert.equal(recovers(),1,'the watch stops at the first 401');
 assert.match(h.element('sourceReviewStatus').textContent,/sign-in has ended, so this page stopped checking/);
 const banner=h.element('sessionBanner');assert.equal(banner.hidden,false);
 assert.match(banner.children.map(x=>x.textContent).join(''),/^Your sign-in has ended\. Sign in again in a new tab, then come back; unsaved photos and fields stay on this page\.$/);
 const link=banner.children[1];assert.equal(link.href,'/');assert.equal(link.target,'_blank');
 await new Promise(resolve=>setTimeout(resolve,100));assert.equal(recovers(),1);
});
test('coming back to the tab re-checks the sign-in and shows the banner when it has ended',async()=>{
 const h=harness();await h.flush();
 await h.fire('document','visibilitychange');await h.flush();
 assert.ok(h.calls.some(x=>x.url==='/api/owner/me'),'the sign-in is checked on return');
 assert.equal(h.element('sessionBanner').hidden,false);assert.match(h.element('sessionBanner').children[0].textContent,/sign-in has ended/);
});
test('the source review names what it needs, checks it before sending, and shows conflict codes in words',async()=>{
 const receipt={fingerprint:'b'.repeat(64),observation:{category:'Sofa',eyeCount:2,secondCount:3},roomObservation:{roomType:null},conflicts:['reader_count_disagreement','room_type_unknown']};
 const h=harness({analysisReady:true,receipt});await h.click('saveConnectedDraft');
 await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 const facts=h.element('sourceReviewFacts').children.map(x=>x.textContent).join(' ');
 assert.match(facts,/The two readers counted different numbers of pieces \(2 and 3\)/);assert.doesNotMatch(facts,/reader_count_disagreement/);
 assert.match(h.element('sourceReviewNeeds').textContent,/counted 2 and 3 pieces: enter the real physical count/);
 assert.match(h.element('sourceReviewNeeds').textContent,/Type the room type/);assert.match(h.element('sourceReviewNeeds').textContent,/required because the reading found a conflict/);
 const confirms=()=>h.calls.filter(x=>x.body&&typeof x.body==='string'&&JSON.parse(x.body).action==='confirm').length;
 await h.click('sourceReviewConfirm');assert.match(h.element('sourceReviewConfirmStatus').textContent,/physical piece count/);
 h.element('sourceReviewCount').value='2';await h.click('sourceReviewConfirm');assert.match(h.element('sourceReviewConfirmStatus').textContent,/room type/);
 h.element('sourceReviewRoom').value='Living room';await h.click('sourceReviewConfirm');assert.match(h.element('sourceReviewConfirmStatus').textContent,/found a conflict/);
 assert.equal(confirms(),0,'nothing incomplete is sent');
 h.element('sourceReviewResolution').value='Two modules; the third seat belongs to one of them.';await h.click('sourceReviewConfirm');
 assert.equal(confirms(),1);
});
test('a paused site says so beside the decisions, a Go 2 ticket is not called a white master, and polling says when it stopped',async()=>{
 const job={id:'run-go2',clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 2',history:[],observation:null};
 const h=harness({job,approval:{clientId:job.clientId,runId:job.id,gate:'go2',round:1,revision:'r1',paidReady:false,allowed:['approve','repair','stop'],shots:[],warnings:[]}});await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const text=h.element('connectedJobDetail').children.map(x=>x.textContent).join(' ');
 assert.match(text,/Paid steps are paused on this site; you can still stop\./);assert.doesNotMatch(text,/white master/);
 const planning={id:'run-planning',clientId:'owner-'+randomUUID(),status:'received',stage:'01 Intake & observe',history:[],observation:null};
 const p=harness({job:planning,fastTimers:true});await p.flush();
 p.element('jobSelect').value=planning.id;await p.fire('jobSelect','change');
 await new Promise(resolve=>setTimeout(resolve,400));
 const last=p.element('connectedJobDetail').children.map(x=>x.textContent).join(' ');
 assert.match(last,/stopped checking after 15 minutes/);assert.doesNotMatch(last,/checks again every 20 seconds/);
});
test('the Midas import reports a photo that was not added instead of claiming success',async()=>{
 const h=harness({midas:{primary:false,views:false}});await h.flush();
 h.byId('midasImportRef').value='175913';h.byId('midasImportFind').click();await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(h.byId('midasImportStatus').textContent,/was found, but its main photo was not added/);
 const ok=harness({midas:{primary:true,views:false}});await ok.flush();
 ok.byId('midasImportRef').value='175913';ok.byId('midasImportFind').click();await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(ok.byId('midasImportStatus').textContent,/is now your primary original/);
 const add=ok.byId('midasImportGallery').children[0].children[1].children[1];
 assert.equal(add.textContent,'Add as side view');add.click();await new Promise(resolve=>setTimeout(resolve,20));
 assert.notEqual(add.textContent,'Added as side view');assert.match(ok.byId('midasImportStatus').textContent,/Midas photo 2 was not added/);
});

// Batch B (19 Oct 2026): drafts, edits, estimates and decisions keep moving.
const readAndConfirm=async h=>{await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');await h.click('sourceReviewConfirm');};
test('an estimate says until when it is valid, and an expired one stops Review paid submission with what to do',async()=>{
 const h=harness({analysisReady:true,estimateExtra:{expiresAt:new Date(Date.now()-1000).toISOString()}});
 await h.click('saveConnectedDraft');await readAndConfirm(h);await h.click('estimateConnected');
 assert.match(h.text('estimateDetails'),/Valid until .*get the estimate again/);
 assert.equal(h.element('submitConnected').disabled,true);assert.match(h.element('submitConnectedStatus').textContent,/expired.*Get estimate again/);
 await h.click('submitConnected');assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
});
test('changing Step 3 after the full save updates the same version and keeps its paid reading',async()=>{
 const h=harness({analysisReady:true});await h.click('saveConnectedDraft');await readAndConfirm(h);
 h.element('prefBudget').value='6';await h.fire('prefBudget','input');
 await h.click('saveConnectedDraft');
 assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length,1,'no second version');
 const patch=h.calls.find(x=>x.method==='PATCH');assert.ok(patch,'the same version is updated');assert.equal(Number(JSON.parse(patch.body).brief.budgetUsd),6);
 assert.equal(h.calls.filter(x=>x.body&&typeof x.body==='string'&&JSON.parse(x.body).action==='analyze').length,1,'the reading is not paid for again');
 assert.match(h.element('saveConnectedStatus').textContent,/same version; its source analysis is kept/);assert.equal(h.element('estimateConnected').disabled,false);
});
test('saving an edit of an approved image twice keeps the image, and an unchanged unsent draft is reused as it is',async()=>{
 const child='00000000-0000-4000-8000-000000000031',asset='00000000-0000-4000-8000-0000000000a1';
 const edit={id:'project-31',version_id:child,parent_id:parentId,title:'Saved sofa',case_title:'Sofa case',version:2,dispatch_state:'received',client_run_id:'owner-'+child,run_id:'claude-a7-'+child,brief:{product:'Sofa',resultAssetId:asset,allowedChanges:'Warm light',protectedDetails:'The product'}};
 const h=harness({saved:true,extraRecords:[edit],jobs:[{id:'claude-a7-'+child,clientId:'owner-'+child,status:'hold',stage:'Go 2'}]});await h.flush();await h.flush();await h.flush();
 h.element('savedWorkList').children.find(c=>c.children[5]?.children.some(x=>x.textContent==='Retry this edit')).children[5].children.find(x=>x.textContent==='Retry this edit').click();await h.flush();await h.flush();await h.flush();
 h.element('chatInput').value='Warm evening light.';await h.click('saveConnectedDraft');
 h.element('chatInput').value='Warm evening light, softer shadows.';await h.fire('setupPage','input',{target:h.element('chatInput')});
 await h.click('saveConnectedDraft');
 assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length,1,'the second save does not make a third version');
 const patch=h.calls.find(x=>x.method==='PATCH');assert.ok(patch);assert.equal(JSON.parse(patch.body).brief.resultAssetId,asset,'the approved image stays the base');
 const r=harness({saved:true});await r.flush();r.element('savedVersion').value=parentId;await r.click('openSavedVersion');
 await r.click('saveConnectedDraft');
 assert.equal(r.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length+r.calls.filter(x=>x.method==='PATCH').length,0,'nothing new is saved');
 assert.match(r.element('saveConnectedStatus').textContent,/Unchanged saved draft reopened/);assert.equal(r.element('estimateConnected').disabled,false);
});
test('changing the route after Save originals for analysis starts a new version and says so',async()=>{
 const h=harness({patchError:'route_changed'});h.element('connectedProduct').value='';h.element('connectedInventory').value='';
 await h.click('saveSourceDraft');
 h.state.intent='project';h.state.route='one';await h.fire('setupPage','change',{target:{name:'intent',id:''}});
 assert.match(h.element('saveSourceStatus').textContent,/next save starts a new version/);
 await h.click('saveSourceDraft');
 assert.equal(h.calls.filter(x=>x.method==='PATCH').length,0);assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length,2);
});
test('a reopened draft with an outcome but no product or pieces is completed in place',async()=>{
 const h=harness({saved:true,savedBrief:{product:'',inventory:''}});await h.flush();h.element('savedVersion').value=parentId;
 await h.click('openSavedVersion');
 assert.ok(h.element('savedStatus').children.some(x=>/has no product type or pieces yet/.test(x.textContent||'')));
 h.element('connectedProduct').value='Sofa';h.element('connectedInventory').value='1 sofa';
 await h.click('saveConnectedDraft');
 const patch=h.calls.find(x=>x.url==='/api/owner/projects/'+parentId&&x.method==='PATCH');assert.ok(patch,'the same version is completed');
 assert.equal(JSON.parse(patch.body).brief.product,'Sofa');assert.equal(h.calls.some(x=>x.method==='POST'&&x.url==='/api/owner/projects'),false);
});
test('a reopened saved version can be sent when the server says it is sendable, and shows the server\'s blockers when not',async()=>{
 const run=async extra=>{const h=harness({saved:true,analysisReady:true,estimateExtra:extra});await h.flush();h.element('savedVersion').value=parentId;await h.click('openSavedVersion');
  await h.click('saveConnectedDraft');await readAndConfirm(h);await h.click('estimateConnected');return h;};
 const ok=await run({sendable:true,blockers:[]});assert.equal(ok.element('submitConnected').disabled,false);
 const message='The A7 owner bridge forwards one product image per job, and this version has 2 saved references.';
 const no=await run({sendable:false,blockers:[{code:'bridge_single_reference',message}]});
 assert.equal(no.element('submitConnected').disabled,true);assert.match(no.text('estimateDetails'),/one product image per job/);
 await no.click('submitConnected');assert.match(no.element('submitConnectedStatus').textContent,/cannot be sent yet: The A7 owner bridge/);
});

// Batch C (19 Oct 2026): the plan is shown at Go 1 and Go 2; scopes that cannot be sent are said before paying.
test('Go 1 shows what A7 asks, its warnings, each shot\'s plan and the cost above the decision buttons',async()=>{
 const job={id:'run-plan',clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 1',history:[],observation:null};
 const approval={clientId:job.clientId,runId:job.id,gate:'go1',round:1,revision:'r1',paidReady:true,allowed:['go','change','stop'],decisionNeeded:'Approve the hero scene plan.',warnings:['Rear legs not confirmed'],shots:[{number:1,output:'hero',frame:'4:5',plan:{setting:'Calm living room',light:'Daylight'}}],cost:{planning_usd:0.21}};
 const h=harness({job,approval});await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const children=h.element('connectedJobDetail').children,index=pattern=>children.findIndex(x=>pattern.test(x.textContent||x.children?.map?.(c=>c.textContent).join(' ')||''));
 const go=children.findIndex(x=>x.textContent==='Go 1 · Approve plan');
 for(const pattern of [/^Approve the hero scene plan\.$/,/^Warning: Rear legs not confirmed$/])assert.ok(index(pattern)>=0&&index(pattern)<go,'shown before the buttons: '+pattern);
 const shot=children.find(x=>x.children?.[0]?.textContent==='Shot 1 · hero · 4:5');assert.ok(shot,'the shot plan is collapsed in a details');assert.ok(children.indexOf(shot)<go);
 assert.match(shot.children.map(x=>x.textContent).join(' '),/setting: Calm living room/);
 assert.ok(children.some(x=>x.children?.[0]?.textContent==='Recorded cost estimates · USD'));
 const go2={...approval,gate:'go2',allowed:['approve','stop'],candidate:'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',review:{result:'pass',defects:[],uncertain:[]}};
 const g=harness({job,approval:go2});await g.flush();g.element('jobSelect').value=job.id;await g.fire('jobSelect','change');await g.flush();await g.flush();
 const link=g.element('connectedJobDetail').children.find(x=>x.href===go2.candidate);assert.ok(link,'the image is linked before Go 2');assert.equal(link.target,'_blank');
});
test('an edit\'s Go 1 does not offer plan changes, which would hold the run',async()=>{
 const vid='00000000-0000-4000-8000-000000000041',client='owner-'+vid;
 const extraRecords=[{id:'p',version_id:vid,parent_id:parentId,title:'Sofa',case_title:'Sofa case',version:2,dispatch_state:'received',client_run_id:client,brief:{resultAssetId:'00000000-0000-4000-8000-0000000000a1'}}];
 const job={id:'claude-a7-'+vid,clientId:client,status:'hold',stage:'Go 1',history:[],observation:null};
 const h=harness({extraRecords,job,approval:{clientId:client,runId:job.id,gate:'go1',round:1,revision:'r1',paidReady:true,allowed:['go','change','stop'],shots:[],warnings:[]}});await h.flush();await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const labels=h.element('connectedJobDetail').children.map(x=>x.textContent);
 assert.ok(labels.includes('Go 1 · Approve plan'));assert.ok(!labels.includes('Request plan changes'));assert.ok(labels.some(x=>/Plan changes are not offered for an edit/.test(x)));
});
test('the analysis cost confirmation says what would still stop the version from being sent',async()=>{
 const h=harness({analysisReady:true});await h.flush();
 h.state.intent='single';h.state.route='secondary';h.outcomes.push({value:'Variations',checked:true});await h.fire('setupPage','change',{target:{name:'route',id:''}});
 assert.match(h.element('executionScopeStatus').textContent,/secondary product needs the hero product/);assert.match(h.element('executionScopeStatus').textContent,/Variations cannot be sent yet/);
 const warning='Variations cannot be sent yet: they start from an approved result image, which A7 does not keep for earlier runs.';
 const q=harness({analysisReady:true,quoteWarnings:[warning]});await q.click('saveConnectedDraft');
 assert.match(q.element('sourceReviewStatus').textContent,/Before you pay: Variations cannot be sent yet/);
 await q.click('sourceReviewAnalyze');assert.equal(q.element('connectedConfirm').open,true);
 assert.ok(q.element('confirmDetails').children.some(x=>x.textContent==='Before you pay: '+warning),'the warning is in the cost confirmation');
 assert.equal(q.calls.filter(x=>x.body&&typeof x.body==='string'&&JSON.parse(x.body).action==='analyze').length,0,'nothing is paid before the owner confirms');
});
test('an expired ticket that keeps only Stop says the run cannot continue, and offers only Stop',async()=>{
 const job={id:'run-expired',clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 1',history:[],observation:null};
 const h=harness({job,approval:{clientId:job.clientId,runId:job.id,gate:'go1',round:1,revision:'r1',paidReady:true,allowed:['stop'],shots:[],warnings:[],decisionNeeded:'This approval ticket is more than 24 hours old, so the run cannot continue from it.'}});await h.flush();
 h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
 const labels=h.element('connectedJobDetail').children.map(x=>x.textContent);
 assert.ok(labels.some(x=>/^Go 1 can no longer be approved from this ticket/.test(x)));assert.deepEqual(labels.filter(x=>/^(Go 1 · Approve plan|Request plan changes|Stop this run)$/.test(x)),['Stop this run']);
});

test('a refused confirmation reloads the reading, keeps the typed answers and says why',async()=>{
 const receipt={fingerprint:'b'.repeat(64),observation:{category:'Dining set',eyeCount:7,secondCount:9},roomObservation:null,conflicts:['reader_count_disagreement']};
 const h=harness({analysisReady:true,receipt,confirmRefusal:{error:'analysis_conflict_unresolved',message:'The explanation was not matched to every finding of the current reading (reader count disagreement). The page has reloaded the reading: check the findings, then confirm again. Nothing was recorded.'}});
 await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 h.element('sourceReviewCount').value='7';h.element('sourceReviewResolution').value='One table and six chairs.';
 const reads=()=>h.calls.filter(x=>x.method==='GET'&&x.url.startsWith('/api/owner/source-understanding/')&&!x.url.includes('?')).length,before=reads();
 await h.click('sourceReviewConfirm');
 assert.equal(reads(),before+1);
 assert.equal(h.element('sourceReviewCount').value,'7');
 assert.match(h.element('sourceReviewConfirmStatus').textContent,/not recorded\. The explanation was not matched/);
 await h.click('sourceReviewConfirm');
 assert.equal(h.element('resultReviewState').textContent,'Owner confirmed');
});

test('a reading whose direction changed afterwards is still shown, with a note that its conflict check used the earlier text',async()=>{
 const h=harness({analysisReady:true,directionChanged:true});
 await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 assert.equal(h.element('sourceReviewCorrection').hidden,false);
 assert.match(h.text('sourceReviewFacts'),/direction changed after these photos were read/);
 assert.match(h.text('sourceReviewFacts'),/A7 checks the current direction again when the job is sent/);
});

test('a failed receipt check never says nothing was paid: the charge is left to the ledger',async()=>{
 const h=harness({analysisReady:true,analysisFlow:'recover_unavailable'});
 await h.click('saveConnectedDraft');await h.click('sourceReviewAnalyze');h.element('confirmChecked').checked=true;await h.click('confirmSend');
 await h.click('sourceReviewRefresh');
 const said=h.element('sourceReviewStatus').textContent;
 assert.match(said,/receipt could not be checked: Source analysis is unavailable just now/);
 assert.doesNotMatch(said,/nothing was paid/i);
 assert.match(said,/not confirmed until the ledger is checked; do not start another analysis/);
});

test('a job link from the Overview opens that job once the queue loads',async()=>{
  const job={id:'claude-a7-'+randomUUID(),clientId:'owner-'+randomUUID(),status:'hold',stage:'Go 2',history:[],observation:null};
  const h=harness({job,search:'?job='+encodeURIComponent(job.id)});await h.flush();await h.flush();await h.flush();
  assert.equal(h.element('jobSelect').value,job.id);
  assert.ok(h.calls.some(x=>x.method==='GET'&&x.url==='/api/owner/jobs/'+encodeURIComponent(job.id)),'the linked job is read');
  assert.equal(h.calls.filter(x=>x.method==='POST').length,0,'opening a linked job sends nothing');
});
test('a job link that is not in the queue says so and opens nothing',async()=>{
  const job={id:'run-listed',clientId:'owner-'+randomUUID(),status:'completed',stage:'07 Scenes',history:[],observation:null};
  const h=harness({job,search:'?job=run-missing'});await h.flush();await h.flush();await h.flush();
  assert.equal(h.element('jobSelect').value,'');
  assert.match(h.element('jobsStatus').textContent,/linked job is not in the loaded queue/);
  assert.equal(h.calls.filter(x=>x.url.startsWith('/api/owner/jobs/')).length,0);
});

// Site fixes from the paid run of 22 Oct 2026 (claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md).
const estimateCalls=h=>h.calls.filter(x=>x.url.startsWith('/api/owner/project-estimate/')).length;
test('4.1 item 1: a budget typed after saving leaves 6. Get estimate usable; it asks to save first, and an undone change estimates again without saving',async()=>{
  const h=harness({analysisReady:true});await h.click('saveConnectedDraft');await readAndConfirm(h);await h.click('estimateConnected');
  assert.equal(estimateCalls(h),1);assert.equal(h.element('submitConnected').disabled,false);
  h.element('connectedBudget').value='5.00';await h.fire('connectedBudget','input');
  assert.equal(h.element('estimateConnected').disabled,false,'the button is not left dead');
  assert.equal(h.element('submitConnected').disabled,true,'the old estimate is no longer usable');
  assert.match(h.text('estimateDetails'),/Save all details, then 6\. Get estimate/);
  await h.click('estimateConnected');
  assert.equal(estimateCalls(h),1,'an unsaved change is never estimated from the old saved version');
  assert.match(h.text('estimateDetails'),/not saved yet/);assert.equal(h.element('submitConnected').disabled,true);
  await h.click('submitConnected');assert.equal(h.calls.filter(x=>x.url==='/api/owner/submissions').length,0);
  // Undone: the form matches the saved version again, so a fresh estimate of it is fetched without saving.
  h.element('connectedBudget').value='4.74';await h.fire('connectedBudget','input');await h.click('estimateConnected');
  assert.equal(estimateCalls(h),2);assert.equal(h.element('submitConnected').disabled,false);
  // Changed and saved: the same version is updated, and the estimate follows the save.
  h.element('connectedBudget').value='5.00';await h.fire('connectedBudget','input');await h.click('saveConnectedDraft');
  const patch=h.calls.filter(x=>x.method==='PATCH').at(-1);assert.equal(JSON.parse(patch.body).brief.budgetUsd,5);
  assert.equal(h.element('estimateConnected').disabled,false);await h.click('estimateConnected');assert.equal(estimateCalls(h),3);
});
test('4.1 item 1: a photo-only save also records the form, so an undone budget change cannot quote a different saved budget',async()=>{
  const h=harness({analysisReady:true});await h.click('saveConnectedDraft');await readAndConfirm(h);await h.click('estimateConnected');
  const before=estimateCalls(h);
  h.element('connectedBudget').value='5.00';await h.fire('connectedBudget','input');await h.click('saveSourceDraft');
  const patch=h.calls.filter(x=>x.method==='PATCH').at(-1);assert.equal(JSON.parse(patch.body).brief.budgetUsd,5,'the photo save stored the new budget');
  h.element('connectedBudget').value='4.74';await h.fire('connectedBudget','input');await h.click('estimateConnected');
  assert.equal(estimateCalls(h),before,'the form no longer matches the saved version, so no estimate of a different budget is fetched');
  assert.match(h.text('estimateDetails'),/not saved yet/);
});

test('4.1 item 2: an unsent saved draft whose pieces have no quantity opens unlocked and is corrected in place',async()=>{
  const h=harness({saved:true,savedBrief:{inventory:'Four Seater Arm Sofa.'}});await h.flush();h.element('savedVersion').value=parentId;
  await h.click('openSavedVersion');
  assert.equal(h.element('connectedInventory').disabled,false,'the refused field can be corrected');
  assert.match(h.text('savedStatus'),/“Four Seater Arm Sofa\.” has no quantity/);
  h.element('connectedInventory').value='1 Four Seater Arm Sofa';await h.fire('connectedInventory','input');await h.click('saveConnectedDraft');
  const patch=h.calls.find(x=>x.method==='PATCH'&&x.url==='/api/owner/projects/'+encodeURIComponent(parentId));
  assert.ok(patch,'the same version is updated');assert.equal(JSON.parse(patch.body).brief.inventory,'1 Four Seater Arm Sofa');
  assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url==='/api/owner/projects').length,0,'no new version');
  assert.equal(h.element('estimateConnected').disabled,false);
});
test('4.1 item 2: a sent version with refused pieces unlocks only that field; the correction goes into the new edit, the product stays locked',async()=>{
  const h=harness({saved:true,savedBrief:{inventory:'Four Seater Arm Sofa.'},savedVersion:{dispatch_state:'received',client_run_id:'owner-'+parentId}});await h.flush();h.element('savedVersion').value=parentId;
  await h.click('openSavedVersion');
  assert.equal(h.element('connectedInventory').disabled,false);assert.equal(h.element('connectedProduct').disabled,true,'confirmed facts of a sent version stay locked');
  assert.match(h.text('savedStatus'),/Only the pieces field is unlocked/);
  h.element('connectedInventory').value='1 sofa';h.element('editChanges').value='Warmer light';h.element('editPreserve').value='The same sofa';
  h.element('chatInput').value='Corrected pieces';await h.fire('setupPage','input',{target:h.element('chatInput')});
  await h.click('saveConnectedDraft');
  const posted=JSON.parse(h.calls.find(x=>x.method==='POST'&&x.url==='/api/owner/projects').body);
  assert.equal(posted.parentId,parentId);assert.equal(posted.brief.inventory,'1 sofa');assert.equal(posted.brief.product,'Sofa');
  assert.equal(h.calls.filter(x=>x.method==='PATCH').length,0,'the sent version itself is not changed');
});
test('4.1 item 2: a valid sent version still opens with its saved facts locked',async()=>{
  const h=harness({saved:true,savedVersion:{dispatch_state:'received',client_run_id:'owner-'+parentId}});await h.flush();h.element('savedVersion').value=parentId;
  await h.click('openSavedVersion');
  assert.equal(h.element('connectedInventory').disabled,true);assert.equal(h.element('connectedProduct').disabled,true);
});
test('4.1 item 3: an answer shown beside its button is not repeated at the top of the panel',async()=>{
  const h=harness();h.element('connectedInventory').value='Four Seater Arm Sofa.';await h.click('saveConnectedDraft');
  assert.match(h.element('saveConnectedStatus').textContent,/quantity and name/);assert.equal(h.element('saveConnectedStatus').hidden,false);
  assert.equal(h.element('connectedStatus').hidden,true);
});
const jobText=h=>h.element('connectedJobDetail').children.map(x=>x.textContent).join(' ');
test('4.4: a held run with no allowed decision shows its hold reason and no Go 2 wording',async()=>{
  const job={id:'run-held',clientId:'owner-'+randomUUID(),status:'hold',stage:'06 Package',summary:'the saved webp file shows a grey halo',history:[],observation:null};
  const approval={clientId:job.clientId,runId:job.id,status:'hold',gate:null,round:1,revision:'r'.repeat(64),paidReady:true,allowed:[],shots:[],warnings:[],decisionNeeded:'go 2: approve this white master, order a repair, or stop. Approval is yours only; the review is not an approval.'};
  const h=harness({job,approval});await h.flush();
  h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
  const text=jobText(h);
  assert.match(text,/On hold: the saved webp file shows a grey halo/);assert.doesNotMatch(text,/go 2: approve/i);
  assert.equal(h.element('connectedJobDetail').children.filter(x=>/decision-button/.test(x.className||'')).length,0);
});
test('4.4: a Go 2 ticket that allows nothing does not show its decision wording',async()=>{
  const job={id:'run-closed',clientId:'owner-'+randomUUID(),status:'awaiting_go_2',stage:'05 Review',history:[],observation:null};
  const approval={clientId:job.clientId,runId:job.id,status:'awaiting_go_2',gate:'go2',round:1,revision:'r'.repeat(64),paidReady:true,allowed:[],shots:[],warnings:[],decisionNeeded:'go 2: approve this white master, order a repair, or stop.'};
  const h=harness({job,approval});await h.flush();
  h.element('jobSelect').value=job.id;await h.fire('jobSelect','change');await h.flush();await h.flush();
  const text=jobText(h);
  assert.doesNotMatch(text,/go 2: approve/i);assert.match(text,/can no longer be answered safely/);
});
