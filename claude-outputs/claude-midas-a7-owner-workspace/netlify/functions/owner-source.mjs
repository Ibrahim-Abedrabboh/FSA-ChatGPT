import {getStore} from '@netlify/blobs';
import authenticate from './owner-me.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {requestId} from '../../lib/a7-actions.mjs';
export default async function handler(request,context){
 if(request.method!=='GET')return noStoreJson({error:'method_not_allowed'},405);
 const auth=await authenticate(request,context);if(!auth.ok)return auth;
 const id=context.params?.id;if(!requestId(id))return noStoreJson({error:'not_found'},404);
 try{const result=await getStore({name:'a7-owner-production',consistency:'strong'}).getWithMetadata('sources/'+id,{type:'arrayBuffer'});if(!result)return noStoreJson({error:'not_found'},404);
 const type=result.metadata.type;if(!['image/jpeg','image/png','image/webp'].includes(type))return noStoreJson({error:'unavailable'},502);
 return new Response(result.data,{headers:{'Content-Type':type,'Cache-Control':'no-store','Content-Disposition':'inline; filename="product-reference"','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return noStoreJson({error:'storage_unavailable'},503);}
}
export const config={path:'/api/owner/sources/:id',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
