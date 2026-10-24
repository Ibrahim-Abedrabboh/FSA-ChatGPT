import {createHash} from 'node:crypto';
import {canonical} from './a7-actions.mjs';

// Only the provider's answer and receipt are retained. Never the request/photo,
// credential, HTTP headers, or arbitrary provider-envelope properties.
export function readerResponseCheckpoint(raw,receiptRef,usage){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.error||
    typeof raw.id!=='string'||raw.id!==receiptRef||
    raw.status!=='completed'||!Array.isArray(raw.output)||!usage||
    raw.usage?.input_tokens!==usage.input||raw.usage?.output_tokens!==usage.output)
  throw Error('invalid_reader_response');
 const output=raw.output.filter(x=>x?.type==='message').map(x=>({
  type:'message',role:'assistant',content:(Array.isArray(x.content)?x.content:[])
   .filter(c=>c?.type==='output_text'&&typeof c.text==='string')
   .map(c=>({type:'output_text',text:c.text}))
 }));
 if(!output.some(x=>x.content.some(c=>c.text.trim())))throw Error('invalid_reader_response');
 const response={id:raw.id,status:'completed',model:'gpt-6.1-sol',output,
  usage:{input_tokens:usage.input,output_tokens:usage.output}};
 const serialized=canonical(response);
 if(Buffer.byteLength(serialized)>131072)throw Error('reader_response_too_large');
 return {response,sha256:createHash('sha256').update(serialized).digest('hex')};
}
