import {randomUUID} from 'node:crypto';
// Buffer the bounded image explicitly: no streaming FormData dependency at the
// serverless-to-n8n boundary, and no caller-controlled multipart headers.
export function recoveryUpload(bytes,type,clientId,recovery,probe=false,budgetOrigin=''){
 const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>3*1024*1024||!extensions[type])throw Error('source_unavailable');
 const boundary='a7-recovery-'+randomUUID();
 const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="payload"\r\n\r\n'+JSON.stringify({clientRunId:clientId,recovery,...(probe?{transportProbe:true}:{}),...(budgetOrigin?{budgetOrigin}:{})})+'\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="files"; filename="recovery-original.'+extensions[type]+'"\r\nContent-Type: '+type+'\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 return {body,headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':String(body.length)}};
}
export async function recoveryReceipt(response,probe=false){
 const status=response.status,reader=response.body?.getReader();let size=0;const chunks=[];
 if(reader){for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return {accepted:false,upstreamStatus:status,receiptKind:'oversized'};}chunks.push(Buffer.from(value));}}
 const text=Buffer.concat(chunks).toString('utf8');let receipt;try{receipt=JSON.parse(text);}catch{return {accepted:false,upstreamStatus:status,receiptKind:text?'non_json':'empty'};}
 if(probe)return {accepted:response.ok&&receipt?.transportProbe===true&&receipt?.valid===true,upstreamStatus:status,receiptKind:receipt?.transportProbe===true?'transport_probe':'unexpected_json'};
 return {...(/^[a-z_]{1,80}$/.test(receipt?.error||'')?{error:receipt.error}:{}),accepted:response.ok&&receipt?.accepted===true,upstreamStatus:status,receiptKind:receipt?.accepted===true?'accepted':receipt?.accepted===false?'rejected':'unexpected_json'};
}
export function transportFailure(error){
 const code=error?.cause?.code||error?.code;
 return {accepted:false,receiptKind:'transport_error',transportCode:['ECONNRESET','ECONNREFUSED','ENOTFOUND','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_REQ_CONTENT_LENGTH_MISMATCH'].includes(code)?code:error?.name==='TimeoutError'?'TIMEOUT':'UNCLASSIFIED'};
}
