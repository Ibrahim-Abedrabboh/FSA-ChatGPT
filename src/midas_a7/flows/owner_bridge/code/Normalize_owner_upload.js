const it=$input.first();let probe=it.json.body?.payload;try{if(typeof probe==='string')probe=JSON.parse(probe)}catch{probe=null}if(probe?.transportProbe===true){if(!/^owner-[a-f0-9-]{36}$/.test(probe.clientRunId||'')||Object.keys(it.binary||{}).length!==1)throw Error('invalid_transport_probe');try{const key=Object.keys(it.binary)[0];const data=await this.helpers.getBinaryDataBuffer(0,key);if(!data.length||data.length>3*1024*1024)throw Error('invalid_probe_size');return [{json:{http_status:200,transportProbe:true,valid:true,bytes:data.length,clientId:probe.clientRunId}}];}catch(error){return [{json:{http_status:409,transportProbe:true,valid:false,error:'probe_binary_unavailable',errorType:String(error.name||'Error').replace(/[^A-Za-z]/g,'').slice(0,40)}}];}}
// Owner submission: 1 to 12 files (photos, plus specification files). Every file keeps its saved name (role-<uuid>) so that
// "02 Ingest files" matches it to payload.references by name and reads its role; nothing is renamed or dropped.
const MAX_FILES=12,MAX_FILE=3*1024*1024,MAX_TOTAL=14*1024*1024;
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const SPEC={'text/plain':'txt','text/csv':'csv','application/json':'json','application/pdf':'pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'};
// Same role reading as "02 Ingest files" (roleOf), so the bridge refuses what A7 would not use.
function roleOf(label){const r=String(label||'').trim().toLowerCase();if(!r)return '';if(/room|space|target/.test(r))return 'room';if(/look|inspiration/.test(r))return 'look';if(/previous|result|generation/.test(r))return 'previous';if(/view|angle/.test(r))return 'other_view';if(/spec|sheet|excel|document/.test(r))return 'spec';if(/product|vendor/.test(r))return 'product';return 'other';}
const item=$input.first();let p=item.json.body?.payload;try{if(typeof p==='string')p=JSON.parse(p)}catch{p=null}
const b=item.binary||{},keys=Object.keys(b);
if(!p||typeof p!=='object'||!/^owner-[a-f0-9-]{36}$/.test(p.clientRunId||'')||keys.length<1||keys.length>MAX_FILES)throw new Error('Invalid owner submission');
const refs=Array.isArray(p.references)?p.references:[];
if(refs.length!==keys.length)throw Error('owner_references_mismatch');
const NAME=/^(product|room|other_view|look|previous|spec)-[a-f0-9-]{36}$/,used=new Set(),out={},uploadFields=[];let total=0,products=0,rooms=0;
for(let i=0;i<keys.length;i++){
 const key=keys[i],f=b[key]||{},raw=String(f.fileName||''),bare=raw.replace(/\.(jpe?g|png|webp|txt|csv|json|pdf|xlsx)$/i,'');
 const idx=refs.findIndex((r,j)=>!used.has(j)&&r&&typeof r.name==='string'&&(r.name===raw||r.name===bare));
 if(idx===-1)throw Error('owner_file_without_reference');
 used.add(idx);
 const name=refs[idx].name,role=roleOf(refs[idx].role);
 if(!NAME.test(name)||!['product','room','other_view','look','previous','spec'].includes(role)||!name.startsWith(role+'-'))throw Error('invalid_owner_role');
 if(role==='product')products++;if(role==='room')rooms++;
 const mime=f.mimeType,ext=EXT[mime]||(role==='spec'?SPEC[mime]:undefined);if(!ext)throw Error('invalid_owner_image');
 const bytes=await this.helpers.getBinaryDataBuffer(0,key);
 if(!bytes.length||bytes.length>MAX_FILE)throw Error('invalid_owner_image');
 total+=bytes.length;if(total>MAX_TOTAL)throw Error('owner_upload_too_large');
 const field='files'+i;out[field]={data:bytes.toString('base64'),mimeType:mime,fileName:name,fileExtension:ext};uploadFields.push(field);
}
// A7 reads one product photo and at most one room photo; a second of either would be registered but never used.
if(products!==1||rooms>1)throw Error('owner_roles_invalid');
return [{json:{payload:JSON.stringify(p),uploadFields,fileCount:uploadFields.length,totalBytes:total},binary:out}];
