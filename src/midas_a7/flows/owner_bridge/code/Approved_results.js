// Edit phase 2.1 (19 Oct 2026): the scene images the owner approved in this run, with the Google Drive file id and checksum A7
// recorded at approval, so the owner site can start an edit from one exact image. Nothing else of the run record is added.
// 20 Oct 2026: also the white master of a finished white package (the owner's go 2 release of exactly that file), so a new job can
// make its scenes from it.
const out=$input.first().json;
if(out.http_status!==200)return [{json:out}];
const rows=$('Read owner run').all().map(i=>i.json).filter(x=>x.run_id===out.runId&&x.client_run_id===out.clientId).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||Number(b.id)-Number(a.id));
let done=null;try{done=JSON.parse(rows[0]?.scenes||'null')?.done;}catch(e){done=null;}
let pkg=null;try{pkg=JSON.parse(rows[0]?.package||'null');}catch(e){pkg=null;}
const results=[];
const m=pkg&&pkg.master,rel=pkg&&pkg.release;
if(pkg&&pkg.outcome==='white_package_ready'&&m&&rel&&rel.run_id===out.runId&&rel.output_id==='white_master'&&['reviewed_owner_approved','owner_exception'].includes(rel.classification)&&/^[A-Za-z0-9_-]{10,200}$/.test(String(m.drive_file_id||''))&&/^[a-f0-9]{64}$/.test(String(m.sha256||''))&&rel.candidate_sha256===m.sha256)
 results.push({outputId:'white_master',kind:'white',driveFileId:m.drive_file_id,sha256:m.sha256,px:typeof m.px==='string'&&/^\d{2,5}x\d{2,5}$/.test(m.px)?m.px:null,fileName:String(m.file_name||'white_master').replace(/https?:\/\/\S+/gi,'').slice(0,160),reviewed:rel.classification==='reviewed_owner_approved',approvedAt:typeof rel.at==='string'?rel.at:null});
if(done&&typeof done==='object'&&!Array.isArray(done))for(const [outputId,d] of Object.entries(done)){
 const c=d&&d.candidate;
 if(results.length>=30||!d||d.by!=='owner'||!c||!/^[a-z0-9_]{1,60}$/.test(outputId)||!/^[A-Za-z0-9_-]{10,200}$/.test(String(c.drive_file_id||''))||!/^[a-f0-9]{64}$/.test(String(c.sha256||'')))continue;
 results.push({outputId,kind:'scene',driveFileId:c.drive_file_id,sha256:c.sha256,px:typeof c.px==='string'&&/^\d{2,5}x\d{2,5}$/.test(c.px)?c.px:null,fileName:String(c.file_name||outputId).replace(/https?:\/\/\S+/gi,'').slice(0,160),reviewed:!d.without_review,approvedAt:typeof d.at==='string'?d.at:null});
}
return [{json:{...out,results}}];
