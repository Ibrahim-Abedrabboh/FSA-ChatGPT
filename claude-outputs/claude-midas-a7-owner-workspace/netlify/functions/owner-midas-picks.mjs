import authenticate from './owner-me.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {sameOrigin} from '../../lib/a7-actions.mjs';
import {checkPicks} from '../../lib/a7-picks.mjs';
/** POST /api/owner/midas-picks {items:[SKU or link]} checks companion pieces against A7's catalogue rules. Nothing is stored. */
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;
 if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
 if(!sameOrigin(request))return noStoreJson({error:'origin_rejected'},403);
 if(Number(request.headers.get('content-length'))>8000)return noStoreJson({error:'invalid_picks'},400);
 let body;try{body=await request.json();}catch{return noStoreJson({error:'invalid_picks'},400);}
 try{return noStoreJson(await checkPicks(body?.items));}
 catch(error){return noStoreJson({error:error.message==='invalid_picks'?'invalid_picks':'picks_unavailable',message:error.message==='invalid_picks'?'Check 1 to 12 SKUs or Midas product links at a time.':'The check could not run. Try again.'},error.message==='invalid_picks'?400:502);}
}
export const config={path:'/api/owner/midas-picks',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:20}};
