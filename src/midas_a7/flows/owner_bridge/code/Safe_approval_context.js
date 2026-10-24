const q=$('Owner context').first().json.query||{};
const matched=$('Read owner run').all().map(i=>i.json).filter(r=>r.run_id===q.id);
// A repeated send can record one run twice (same run id and client id): keep the most recently updated row. Different clients stay ambiguous.
const latest=new Map();for(const r of matched){const k=String(r.client_run_id||''),o=latest.get(k),at=String(r.updatedAt||''),oat=String(o?.updatedAt||'');if(!o||at>oat||(at===oat&&Number(r.id)>Number(o.id)))latest.set(k,r);}
const rows=[...latest.values()];
const safe=(v,n=800)=>typeof v==='string'?v.replace(/https?:\/\/\S+/gi,'[link omitted]').replace(/(?:token|authorization|secret|password|resume_url)\s*[:=]\s*[^\s,;]+/gi,'[hidden]').slice(0,n):'';
const arr=v=>Array.isArray(v)?v:[];
const parse=(s,f)=>{try{return JSON.parse(s)??f}catch{return f}};
if(rows.length!==1)return [{json:{http_status:rows.length?409:404,error:rows.length?'ambiguous_run':'not_found'}}];
const r=rows[0], gate=r.status==='awaiting_go_1'?'go1':r.status==='awaiting_go_2'?'go2':null;
const kind=gate==='go1'?'go1_ticket':'go2_ticket';
const events=$input.all().map(i=>i.json).filter(e=>e.run_id===r.run_id&&e.kind===kind&&e.contract_stamp===r.contract_stamp).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
const ticket=parse(events[0]?.payload,null), round=Number(gate==='go1'?r.go1_rounds:r.go2_round);
const review=parse(r.review,{}), cost=parse(r.cost_estimate,{});
const candidate=gate==='go2'?ticket?.candidate:null;
function drive(v){
 if(typeof v!=='string')return null;
 // Google Drive dropped (owner, 20 Oct 2026): the A7 service keeps the files; links are /files/<id>/view?sig=<hmac>.
 const match=v.match(/^(https:\/\/[A-Za-z0-9.-]+(?::\d+)?)\/files\/([A-Za-z0-9_-]{10,200})\/view\?sig=([a-f0-9]{64})$/);
 return match?match[1]+'/files/'+match[2]+'/view?sig='+match[3]:null;
}
const crypto=require('crypto');
const revision=crypto.createHash('sha256').update(JSON.stringify([r.run_id,r.status,round,r.contract_stamp,events[0]?.at||'',ticket])).digest('hex');
let allowed=gate==='go1'?['go','change','stop']:gate==='go2'&&Array.isArray(review.go2_decisions)?review.go2_decisions.filter(x=>['approve','repair','stop','review_again','approve_unreviewed'].includes(x)):[];
if(!ticket||!r.resume_url||!(gate==='go1'?r.go1_token:r.go2_token)||!Number.isSafeInteger(round)||round<0)allowed=[];
if(gate==='go1'&&(round>=3||!(ticket?.shots||[]).some(s=>s.kind!=='white')))allowed=allowed.filter(x=>x!=='change');
// Edit phase 2.4: an edit of an approved image is planned from that image (brief.edit.base); a plan change at its Go 1 holds the run, so it is not offered.
const briefEvent=$input.all().map(i=>i.json).find(e=>e.run_id===r.run_id&&e.kind==='brief');
if(gate==='go1'&&parse(briefEvent?.payload,null)?.edit?.base)allowed=allowed.filter(x=>x!=='change');
if(gate==='go2'&&round>=3)allowed=allowed.filter(x=>x!=='repair');
if(gate==='go2'&&!drive(candidate?.link))allowed=allowed.filter(x=>x==='stop');
// A ticket older than 24 hours cannot continue the run; stopping it stays possible, so the run is not left waiting with no way out.
const expired=Boolean(gate)&&(!events[0]?.at||Date.now()-Date.parse(events[0].at)>24*60*60*1000);
if(expired)allowed=allowed.filter(x=>x==='stop');
const ticketWarnings=arr(ticket?.warnings).concat(arr(ticket?.risks),arr(ticket?.not_confirmed).map(x=>'Not confirmed: '+safe(x)),arr(ticket?.stage04_precheck?.will_hold).map(x=>'Generation hold: '+safe(x)));
const shots=arr(ticket?.shots).slice(0,10).map(shot=>{
 const plan=Object.fromEntries(['room_size','setting','light','camera','presentation','person','rationale'].map(k=>[k,safe(shot.plan?.[k],1200)]));
 plan.room=Object.entries(shot.plan?.room||{}).filter(([k])=>['walls','floor','windows','zone'].includes(k)).map(([k,v])=>k+': '+safe(v,160)).join('; ');
 plan.midas_pieces=arr(shot.plan?.midas_pieces).slice(0,6).map(m=>safe(m.sku,40)+' · quantity '+(Number.isSafeInteger(m.count)?m.count:'not confirmed')+' · '+safe(m.purpose,160)+' · '+safe(m.rests_on,120)).join('; ');
 return {number:shot.n,output:safe(shot.output_id,80),kind:safe(shot.kind,40),frame:safe(shot.frame,120),check:safe(shot.plan_check,120),plan};
});
const numericCost=Object.fromEntries(Object.entries(cost).filter(([k,v])=>/^[a-z_]+$/.test(k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0));
// Delivered files of a finished package or scene set: private Drive file links only, labelled, deduplicated, at most 30.
const deliveries=[],seen=new Set();
function collect(v,kind,label,depth){
 if(!v||typeof v!=='object'||depth>6||deliveries.length>=30)return;
 if(Array.isArray(v)){for(const x of v)collect(x,kind,label,depth+1);return;}
 const link=drive(v.link);
 if(link&&!seen.has(link)){seen.add(link);deliveries.push({link,label:safe(String(v.file_name||v.output_id||label),120),px:typeof v.px==='string'&&/^\d{2,5}x\d{2,5}$/.test(v.px)?v.px:null,kind});}
 for(const [k,x] of Object.entries(v))if(x&&typeof x==='object')collect(x,k==='master'?'master':k==='manifest'?'manifest':kind,label,depth+1);
}
collect(parse(r.package,null),'file','Package file',0);
collect(parse(r.scenes,null),'scene','Scene image',0);
return [{json:{http_status:200,runId:r.run_id,clientId:r.client_run_id,status:r.status,gate,round,revision,allowed,decisionNeeded:expired?'This approval ticket is more than 24 hours old, so the run cannot continue from it. You can stop the run; to try again, save the version again and send a new job.':safe(ticket?.decision_needed,1800),shots,warnings:ticketWarnings.slice(0,30).map(x=>safe(x)),candidate:drive(candidate?.link),review:{result:safe(review.result,80),defects:(Array.isArray(review.defects)?review.defects:[]).slice(0,20).map(x=>safe(typeof x==='string'?x:JSON.stringify(x))),uncertain:(Array.isArray(review.unsure)?review.unsure:[]).slice(0,20).map(x=>safe(typeof x==='string'?x:JSON.stringify(x)))},cost:numericCost,deliveries,asOf:new Date().toISOString()}}];