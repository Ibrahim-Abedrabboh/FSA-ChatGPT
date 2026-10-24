import {createHash} from 'node:crypto';
import {canonical} from './a7-actions.mjs';
export const ANSWER_NODES=Object.freeze({
 '03 Eye reads the product photo':'gemini','05 Second count':'anthropic','06 Room reader':'gemini',
 '09 Conflict check':'openai','11 Stylist plans the scenes':'openai','11c Plan critic':'anthropic',
 '15g Send to Google':'image','16 Critic review':'anthropic','16x Blind count':'gemini',
 '06b Room fallback (OpenAI)':'openai','16xb Blind count fallback (OpenAI)':'openai'
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const invalid=()=>{throw Error('invalid_answer_checkpoint');};
const jsonValue=v=>{const s=JSON.stringify(v);if(s===undefined||Buffer.byteLength(s)>120000)invalid();return JSON.parse(s);};
const nonempty=v=>typeof v==='string'?v.trim().length>0:v!==null&&typeof v==='object'&&Object.keys(v).length>0;
function mediaBlock(b,media){
 if(b?.type==='text'&&nonempty(b.text))return {type:'text',text:jsonValue(b.text)};
 if(b?.type!=='image'||typeof b.data!=='string'||b.data.length>5400000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.data))invalid();
 const bytes=Buffer.from(b.data,'base64');if(bytes.length<32||bytes.length>4000000)invalid();
 const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
 if(!mime)invalid();const ref={sha256:sha(bytes),bytes:bytes.length,mime};media.push({...ref,data:bytes});return {type:'image',checkpoint_media:ref};
}
// Preserve complete answer content, never the source request, HTTP headers, tools,
// credentials, provider reasoning or arbitrary envelope metadata. Text may be
// structured JSON in n8n's OpenAI output; retain its type without truncation.
export function normalizeAnswer(raw,op,usage,receiptRef){
 const kind=ANSWER_NODES[op.node_name];if(!kind||!raw||typeof raw!=='object'||Array.isArray(raw))invalid();
 const r=raw.body||raw;if(r.error||raw.error||raw.statusCode&&raw.statusCode!==200)invalid();
 if(r.id&&receiptRef&&r.id!==receiptRef)invalid();
 const source=kind==='gemini'?(r.response||r):r,u=source.usageMetadata||source.usage;
 let input,output;
 if(kind==='gemini'){input=u?.promptTokenCount;output=u?.candidatesTokenCount+(u?.thoughtsTokenCount??0);}
 else if(kind==='image'){input=u?.total_input_tokens;output=u?.total_output_tokens+u?.total_thought_tokens;if(u?.total_tool_use_tokens)invalid();}
 else{input=u?.input_tokens??u?.prompt_tokens;input+=u?.cache_read_input_tokens??0;output=u?.output_tokens??u?.completion_tokens;if(u?.cache_creation_input_tokens)invalid();}
 if(usage!==null&&(!Number.isSafeInteger(input)||!Number.isSafeInteger(output)||input<0||output<0||input+output===0||input!==usage.input||output!==usage.output))invalid();
 let answer;const media=[];
 if(kind==='openai'){
  if(r.status&&r.status!=='completed')invalid();
  const output=(Array.isArray(r.output)?r.output:[]).filter(x=>x?.type==='message').map(m=>({type:'message',role:'assistant',content:(Array.isArray(m.content)?m.content:[]).filter(c=>['output_text','text'].includes(c?.type)&&nonempty(c.text)).map(c=>({type:'output_text',text:jsonValue(c.text)}))}));
  if(!output.some(m=>m.content.length))invalid();answer={output};
 }else if(kind==='anthropic'){
  if(r.stop_reason&&!['end_turn','stop_sequence'].includes(r.stop_reason))invalid();
  const content=(Array.isArray(r.content)?r.content:[]).filter(b=>b?.type==='text'&&nonempty(b.text)).map(b=>({type:'text',text:jsonValue(b.text)}));if(!content.length)invalid();answer={content};
 }else if(kind==='gemini'){
  const g=r.response||r;const candidates=(Array.isArray(g.candidates)?g.candidates:[]).map(c=>{if(c.finishReason&&c.finishReason!=='STOP')invalid();return {content:{role:'model',parts:(c.content?.parts||[]).filter(p=>p?.thought!==true&&nonempty(p.text)).map(p=>({text:jsonValue(p.text)}))},...(c.finishReason?{finishReason:c.finishReason}:{})};});
  if(!candidates.length||!candidates.some(c=>c.content.parts.length))invalid();answer={candidates};
 }else{
  if(r.status!=='completed')invalid();
  const steps=(Array.isArray(r.steps)?r.steps:[]).filter(s=>s?.type==='model_output').map(s=>({type:'model_output',content:(s.content||[]).filter(b=>['text','image'].includes(b?.type)).map(b=>mediaBlock(b,media))}));
  if(!steps.length&&r.output_image)steps.push({type:'model_output',content:[mediaBlock({...r.output_image,type:'image'},media)]});
  if(!media.length||media.reduce((s,m)=>s+m.bytes,0)>4000000)invalid();answer={steps};
 }
 const checkpoint={schema:'a7-complete-answer-v1',node:op.node_name,model:op.model,kind,receipt_ref:receiptRef||'',usage:usage===null?null:{input:usage.input,output:usage.output},answer};
 const serialized=canonical(checkpoint);if(Buffer.byteLength(serialized)>131072)throw Error('answer_checkpoint_too_large');
 return {checkpoint,sha256:sha(serialized),media};
}
export async function persistAnswerMedia(store,normalized,op){
 if(!normalized.media.length)return;
 if(!store)throw Error('answer_storage_unavailable');
 for(const m of normalized.media){
  const key='answer-checkpoints/'+sha(op.operation_key)+ '/'+m.sha256;
  await store.set(key,m.data,{onlyIfNew:true,metadata:{mime:m.mime,sha256:m.sha256}});
  const got=await store.get(key,{type:'arrayBuffer'});if(!got||Buffer.byteLength(got)!==m.bytes||sha(Buffer.from(got))!==m.sha256)throw Error('answer_storage_unverified');
 }
}
export async function readAnswerCheckpoint(pool,store,input){
 if(!input||typeof input.clientId!=='string'||typeof input.operationKey!=='string'||typeof input.permit!=='string')throw Error('invalid_settlement');
 const {rows:[op]}=await pool.query('SELECT operation_key,permit,status,reader_response,reader_response_sha256 FROM a7_paid_operations WHERE operation_key=$1 AND client_run_id=$2',[input.operationKey,input.clientId]);
 if(!op||op.permit!==input.permit)throw Error('operation_mismatch');
 const c=op.reader_response;if(!['completed','uncertain'].includes(op.status)||c?.schema!=='a7-complete-answer-v1')return {preserved:false,resend:false,status:op.status};
 if(sha(canonical(c))!==op.reader_response_sha256)throw Error('answer_storage_unverified');
 const response=structuredClone(c),blocks=response.answer.steps?.flatMap(s=>s.content)||[];
 for(const b of blocks)if(b.checkpoint_media){const m=b.checkpoint_media,key='answer-checkpoints/'+sha(op.operation_key)+'/'+m.sha256;const data=await store.get(key,{type:'arrayBuffer'});if(!data||Buffer.byteLength(data)!==m.bytes||sha(Buffer.from(data))!==m.sha256)throw Error('answer_storage_unverified');b.data=Buffer.from(data).toString('base64');b.mime_type=m.mime;delete b.checkpoint_media;}
 return {preserved:true,response,status:op.status,resend:false};
}
