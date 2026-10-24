import {getStore} from '@netlify/blobs';
import authenticate from './owner-me.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {draftReferences,attachReference} from '../../lib/a7-projects.mjs';
import {sameOrigin,validateReferenceFile,digest} from '../../lib/a7-actions.mjs';
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;const owner=await auth.json(),id=context.params?.id;
 try{
 if(request.method==='GET'){const references=await draftReferences(budgetPool(),owner.id,id);if(context.params?.role){const ref=references.find(r=>r.reference_id===context.params.role||r.role===context.params.role);if(!ref)return noStoreJson({error:'not_found'},404);const data=await getStore({name:'a7-owner-production',consistency:'strong'}).get(ref.blob_key,{type:'arrayBuffer'});if(!data||digest(Buffer.from(data))!==ref.sha256)throw Error('reference_unavailable');return new Response(data,{headers:{'Content-Type':ref.mime,'Cache-Control':'no-store','Content-Disposition':'inline; filename=reference','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}
 return noStoreJson({references:references.map(({reference_id,role,sha256,mime,bytes})=>({id:reference_id,role,sha256,mime,bytes}))});}
 if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
 if(!sameOrigin(request)||context.deploy?.context!=='production')return noStoreJson({error:'origin_rejected'},403);
 await draftReferences(budgetPool(),owner.id,id);
 if(Number(request.headers.get('content-length'))>3300000)throw Error('invalid_reference');
 const form=await request.formData(),file=form.get('file'),role=form.get('role');if(!['product','room','other_view','look','previous','spec'].includes(role)||!file||typeof file.arrayBuffer!=='function'||file.size>3*1024*1024)throw Error('invalid_reference');
 const bytes=Buffer.from(await file.arrayBuffer());validateReferenceFile(bytes,file.type,role);const sha256=digest(bytes),key='project-references/'+owner.id+'/'+id+'/'+role+'/'+sha256;
 await attachReference(budgetPool(),owner.id,id,{role,sha256,blob_key:key,mime:file.type,bytes:bytes.length},()=>getStore({name:'a7-owner-production',consistency:'strong'}).set(key,bytes,{onlyIfNew:true,metadata:{type:file.type,ownerId:owner.id}}));return noStoreJson({saved:true,role,sha256});
 }catch(error){return noStoreJson({error:error.message==='not_found'?'not_found':['reference_conflict','reference_limit'].includes(error.message)?error.message:'reference_unavailable'},error.message==='not_found'?404:['reference_conflict','reference_limit'].includes(error.message)?409:503);}
}
export const config={path:['/api/owner/project-references/:id','/api/owner/project-references/:id/:role'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:20}};
