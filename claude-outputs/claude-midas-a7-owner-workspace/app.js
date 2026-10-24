// A7 status/history client. All remote data arrives through the owner API.
const $ = id => document.getElementById(id);
let queueError = false, activeRun = null;
let jobs = [], filter = 'all', nextOffset = null, total = 0, loading = false, detailVersion = 0;
const views = ['studioView','jobsView','detailView'];
const labels = {awaiting_go_1:'Go 1 needed',awaiting_go_2:'Go 2 needed',hold:'On hold',received:'Received',white_package_ready:'White package ready',scenes_start:'Scenes starting (no white image)',go_1_given:'Go 1 recorded',contract_ready:'Scope ready',refused:'Refused',completed:'Completed',delivered:'Delivered',failed:'Failed',stopped:'Stopped',stopped_by_owner:'Stopped by owner'};
function group(status) { return ['awaiting_go_1','awaiting_go_2','hold','refused','failed'].includes(status)?'attention':['completed','delivered'].includes(status)?'done':['stopped','stopped_by_owner','cancelled'].includes(status)?'closed':'progress'; }
function date(value) { if(value && Number.isNaN(new Date(value).getTime())) return 'Invalid recorded date'; return value ? new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Amman',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Not recorded'; }
function element(tag, className, value) { const el=document.createElement(tag); if(className)el.className=className;if(value!==undefined)el.textContent=value;return el; }
function title(job) { return job.clientId || job.id; }
function state(job) { return labels[job.status] || job.status || 'Status not recorded'; }
function setNavigation(open, restoreFocus=false) {
 document.querySelector('.sidebar').classList.toggle('open',open);
 $('mobileMenu').setAttribute('aria-expanded',String(open));
 $('mobileMenu').setAttribute('aria-label',open?'Close navigation':'Open navigation');
 if(restoreFocus)$('mobileMenu').focus();
}
function show(view, crumb) {
 if(view!=='detailView'){activeRun=null;window.dispatchEvent(new Event('a7-job-loading'));}
 views.forEach(id=>$(id).classList.toggle('hidden',id!==view));$('crumb').textContent=crumb;
 $('navStudio').classList.toggle('active',view==='studioView');$('navJobs').classList.toggle('active',view==='jobsView'&&filter==='all');$('navNeeds').classList.toggle('active',view==='jobsView'&&filter==='attention');
 setNavigation(false);window.scrollTo(0,0);
 const heading=$(view).querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function info(title,text) { $('dialogTitle').textContent=title;$('dialogBody').textContent=text;$('previewDialog').showModal(); }
function renderRecent() {
 const root=$('recentJobs');root.replaceChildren();
 jobs.slice(0,4).forEach(job=>{const b=element('button','recent-job');b.type='button';b.append(element('strong','',title(job)),element('small','',state(job)));b.addEventListener('click',()=>openJob(job.id));root.append(b);});
}
function renderJobs() {
 const root=$('jobList');root.replaceChildren();
 const list=jobs.filter(job=>filter==='all'||group(job.status)===filter);
 if(!list.length)root.append(element('p','empty-state',loading?'Loading jobs…':jobs.length?'No loaded jobs match this filter.':queueError?'Job data is unavailable. Refresh to try again.':'No A7 jobs to display.'));
 list.forEach(job=>{const b=element('button','job-row');b.type='button';const name=element('div','');name.append(element('strong','',title(job)),element('small','',job.id));b.append(name,element('span','job-meta',date(job.updatedAt)),element('span','job-stage',job.stage),element('span','status '+group(job.status),state(job)),element('span','','→'));b.addEventListener('click',()=>openJob(job.id));root.append(b);});
 $('jobCount').textContent=queueError&&!jobs.length?'—':String(total);$('attentionCount').textContent=String(jobs.filter(j=>group(j.status)==='attention').length);
 $('statTotal').textContent=queueError&&!jobs.length?'—':String(total);for(const [id,value] of [['statAttention','attention'],['statProgress','progress'],['statDone','done']])$(id).textContent=String(jobs.filter(j=>group(j.status)===value).length);
 $('loadMore').classList.toggle('hidden',nextOffset===null);$('loadMore').disabled=loading;
}
function openQueue(value='all') { filter=value;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});renderJobs();show('jobsView',filter==='attention'?'Needs attention':'All jobs'); }
function errorMessage(error) { return error.status===503?'The A7 connection is not configured yet.':error.status===401?'Your session expired. Sign in again.':error.status===403?'Owner access is required.':error.status===404?'This run could not be found.':error.status===409?'This run has conflicting records.':error.status===429?'Too many requests. Wait a minute and refresh.':'A7 could not be reached. Please try again.'; }
async function read(path) { const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(18000)});if(!response.ok){const error=new Error('Read failed');error.status=response.status;throw error;}return response.json(); }
async function loadJobs(append=false) {
 if(loading)return;loading=true;$('refreshJobs').disabled=true;$('dataStatus').textContent=append?'Loading more jobs…':'Refreshing A7 jobs…';renderJobs();
 try {
  const data=await read('/api/owner/jobs?offset='+(append?nextOffset:0));
  queueError=false; jobs=append?[...new Map([...jobs,...data.jobs].map(j=>[j.id,j])).values()]:data.jobs;total=data.total;nextOffset=data.nextOffset;
  $('dataStatus').textContent=`Showing ${jobs.length} of ${total}${data.capped?' most recent':''} runs · Updated ${date(data.asOf)} · Asia/Amman${data.capped?' · Limited to 1,000 runs':''}`;
  document.querySelector('.connection').textContent='A7 connected';renderRecent();
 } catch(error) {
  queueError=true; $('dataStatus').textContent=errorMessage(error)+(jobs.length?' Previously loaded data is still shown; it may be out of date.':'');document.querySelector('.connection').textContent='A7 unavailable';
 } finally {loading=false;$('refreshJobs').disabled=false;renderJobs();}
}
function line(label,value){const el=element('div','rail-line');el.append(element('span','',label),element('strong','',value));return el;}
function renderDetail(job) {
 $('detailTitle').textContent=title(job);$('detailSubtitle').textContent=`${job.id} · Updated ${date(job.updatedAt)} · Asia/Amman`;$('detailStatus').textContent=state(job);$('detailStatus').className='status '+group(job.status);
 const observed=$('observationCard');observed.replaceChildren();
 if(/^owner-[a-f0-9-]{36}$/.test(job.clientId)){const image=element('img','reference-preview');image.src='/api/owner/sources/'+job.clientId.slice(6);image.alt='Original product reference for this run';image.loading='lazy';observed.append(image);}
 const o=job.observation;
 if(!o)observed.append(element('p','','No recorded image reading is available for this run. Your entered quantities are not presented as AI findings.'));
 else {
 observed.append(element('p','',o.category||'Category not recorded'),element('p','','Eye count: '+(o.eyeCount??'Not recorded')+' · Independent count: '+(o.secondCount??'Not recorded')+' · Your stated count: '+(o.statedCount??'Not supplied')));
 if(o.colour)observed.append(element('p','','Observed colour: '+o.colour));if(o.materialAppearance)observed.append(element('p','','Material appearance: '+o.materialAppearance+' · visual observation, not a verified material specification.'));
 o.pieces.forEach(p=>observed.append(element('p','',[p.label||p.kind,p.role,p.features.join('; '),p.cutOff?'May be cut off by the image boundary':''].filter(Boolean).join(' · '))));
 for(const [label,list] of [['Details to preserve',o.locks],['Relationships · reader interpretation; physical compatibility unverified',o.relationships],['Hidden details',o.hidden],['Uncertainty',o.uncertainties],['Other views, not extra pieces',o.otherViews],['Files not read',o.unreadFiles]])if(list.length)observed.append(element('strong','',label),...list.map(t=>element('p','',t)));
 if(o.cropped||o.cropNote)observed.append(element('p','',o.cropNote||'The product may be cut off by the image boundary.'));
 observed.append(element('p','mock-note','Recorded model observations can be wrong. Compare them with the original; approval and review remain separate.'));
 }
 const messages=$('messages');messages.replaceChildren();
 if(!job.historyAvailable)messages.append(element('p','empty-state','History could not be read from this run.'));
 else if(!job.history.length)messages.append(element('p','empty-state','No history entries were recorded for this run.'));
 job.history.forEach(event=>{const row=element('div','message');const bubble=element('div','bubble');bubble.append(element('strong','',event.name),element('p','',event.note||'No additional note'),element('time','',date(event.at)));row.append(element('span','avatar',event.step===null?'A7':String(event.step)),bubble);messages.append(row);});
 if(job.historyTruncated)messages.append(element('p','mock-note','Showing the latest 300 history entries.'));
 const status=element('div','decision-body');status.append(element('strong','',state(job)),element('p','',job.summary||'No hold reason or question was recorded.'),element('p','mock-note','Loading current approval ticket…'));$('decisionCard').replaceChildren(status); window.dispatchEvent(new CustomEvent('a7-job-open',{detail:{id:job.id,summary:job.summary}}));
 const details=element('div','rail-list');details.append(line('Stage',job.stage||'Not recorded'),line('Created',date(job.createdAt)),line('Job type',job.type||'Not recorded'));if(/^owner-[a-f0-9-]{36}$/.test(job.clientId)){const source=element('a','','Open original product photo ↗');source.href='/api/owner/sources/'+job.clientId.slice(6);source.target='_blank';source.rel='noopener noreferrer';details.append(element('p','mock-note','Original saved privately by the owner workspace.'),source);}$('stageCard').replaceChildren(details);
 const decisions=element('div','rail-list');for(const [key,label] of [['go1','Go 1'],['go2','Go 2']]){const decision=job.decisions[key];decisions.append(line(label,decision.decision||'Not recorded'));if(decision.at)decisions.append(line(label+' time',date(decision.at)));}$('usageCard').replaceChildren(decisions);
}
async function openJob(id) {
 activeRun=id;
 const version=++detailVersion;window.dispatchEvent(new Event('a7-job-loading'));show('detailView',id);$('detailTitle').textContent='Loading run…';$('detailSubtitle').textContent=id;$('detailStatus').textContent='Loading';
 for(const key of ['messages','decisionCard','stageCard','usageCard','observationCard'])$(key).replaceChildren();
 try { const data=await read('/api/owner/jobs/'+encodeURIComponent(id));if(version===detailVersion&&activeRun===id)renderDetail(data.job); }
 catch(error){if(version===detailVersion&&activeRun===id){$('detailTitle').textContent='Unable to load run';$('detailStatus').textContent='Unavailable';$('messages').append(element('p','empty-state',errorMessage(error)));}}
}
function addPlan(){const prompt=$('promptInput').value.trim();if(!prompt){$('promptInput').focus();return;}const card=element('div','thread-bubble');card.append(element('span','eyebrow','LOCAL DRAFT · NOT SUBMITTED'),element('strong','',prompt),element('p','','Add the product details and photo below, then review the complete request before sending.'));$('newThread').replaceChildren(card);}
async function refreshWorkspace(){await loadJobs();if(activeRun)await openJob(activeRun);}
$('refreshJobs').addEventListener('click',refreshWorkspace);$('loadMore').addEventListener('click',()=>loadJobs(true));
$('navStudio').addEventListener('click',()=>show('studioView','Owner workspace'));$('navJobs').addEventListener('click',()=>openQueue());$('navNeeds').addEventListener('click',()=>openQueue('attention'));$('backToJobs').addEventListener('click',()=>openQueue(filter));
$('newCase').addEventListener('click',()=>{window.dispatchEvent(new Event('a7-new-case'));show('studioView','New job');$('promptInput').value='';$('newThread').replaceChildren();$('promptInput').focus();});$('reviewPlan').addEventListener('click',addPlan);
$('promptInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();addPlan();}});
$('mobileMenu').addEventListener('click',()=>{const open=!document.querySelector('.sidebar').classList.contains('open');setNavigation(open);if(open)$('newCase').focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.sidebar').classList.contains('open')){event.preventDefault();setNavigation(false,true);}});
$('preferences').addEventListener('click',()=>info('Owner workspace','Owner submission and approval controls use your private session. Times use Asia/Amman. Refresh jobs to get the latest records.'));
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>openQueue(b.dataset.filter)));
 document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.prompt.startsWith('Review the jobs'))openQueue('attention');else{$('promptInput').value=b.dataset.prompt;$('promptInput').dispatchEvent(new Event('input',{bubbles:true}));$('promptInput').focus();}}));
openQueue();loadJobs();

window.addEventListener('a7-action-complete',refreshWorkspace);
