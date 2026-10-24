const meta=$('Build model test').first().json,ms=Date.now()-meta.started,j=$input.first().json;
let text='',tin=null,tout=null,think=null,err=null,finish=null;
if(meta.arm==='B'){const body=j.body||{};if(j.statusCode!==200)err='openai_http_'+j.statusCode+(body.error?.code?' '+body.error.code:'');for(const o of body.output||[])for(const c of o.content||[])if(c.type==='output_text')text+=c.text;const u=body.usage||{};tin=u.input_tokens??null;tout=u.output_tokens??null;think=u.output_tokens_details?.reasoning_tokens??null;finish=body.status||null;}
else if(meta.arm==='E'){if(j.error)err=String(j.error.message||j.error).slice(0,200);finish=j.stop_reason||null;text=(j.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');const u=j.usage||{};tin=u.input_tokens??null;tout=u.output_tokens??null;}
else{if(j.error)err=String(j.error.message||j.error).slice(0,200);const c=j.candidates?.[0];finish=c?.finishReason||null;text=(c?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');const u=j.usageMetadata||{};tin=u.promptTokenCount??null;tout=u.candidatesTokenCount??null;think=u.thoughtsTokenCount??null;}
let parsed=null;const t=String(text).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
try{parsed=JSON.parse(t);}catch{const m=t.match(/\{[\s\S]*\}/);if(m){try{parsed=JSON.parse(m[0]);}catch{}}}
// Checks the answer against the Eye v3 schema (null for the current prompt, which has its own shape).
function check(value,s,path,errors){
 if(errors.length>=12)return;
 const types=Array.isArray(s.type)?s.type:[s.type];
 const kind=value===null?'null':Array.isArray(value)?'array':Number.isInteger(value)?'integer':typeof value;
 if(!types.includes(kind)&&!(kind==='integer'&&types.includes('number'))){errors.push(path+': expected '+types.join('|')+', got '+kind);return;}
 if(s.enum&&!s.enum.includes(value))errors.push(path+': '+JSON.stringify(value)+' not allowed');
 if(kind==='array')value.forEach((v,i)=>check(v,s.items,path+'['+i+']',errors));
 if(kind==='object'&&s.properties){for(const k of s.required||[])if(!(k in value))errors.push(path+'.'+k+': missing');for(const [k,v] of Object.entries(value)){if(s.properties[k])check(v,s.properties[k],path+'.'+k,errors);else if(s.additionalProperties===false)errors.push(path+'.'+k+': not in schema');}}
}
let schemaErrors=null;
if(meta.schema&&parsed){
 schemaErrors=[];check(parsed,meta.schema,'$',schemaErrors);
 if(Array.isArray(parsed.pieces)&&Array.isArray(parsed.count_by_kind)){
  const seen={};for(const p of parsed.pieces)if(p?.role==='product')seen[p.kind]=(seen[p.kind]||0)+1;
  const said={};for(const c of parsed.count_by_kind)if(c&&typeof c.kind==='string')said[c.kind]=(said[c.kind]||0)+(Number(c.count)||0);
  for(const k of new Set([...Object.keys(seen),...Object.keys(said)]))if((seen[k]||0)!==(said[k]||0))schemaErrors.push('count_by_kind.'+k+': '+(said[k]||0)+' but '+(seen[k]||0)+' product pieces');
 }
 schemaErrors=schemaErrors.slice(0,12);
}
return [{json:{stage:meta.stage,arm:meta.arm,model:meta.model,promptName:meta.promptName,ms,ok:!err&&!!parsed,error:err||(parsed?null:'answer_not_json'),finish,tokens:{input:tin,output:tout,thinking:think},schemaErrors,result:parsed,rawText:parsed?null:String(text).slice(0,4000)}}];