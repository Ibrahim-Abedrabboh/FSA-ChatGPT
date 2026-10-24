import authenticate from './owner-me.mjs';
import { noStoreJson } from '../../lib/owner-auth.mjs';
import {a7Webhook,a7Origin} from '../../lib/a7-engine-base.mjs';
// Which configured runner host this site calls.
const engineOf=()=>({engine:'runner',engineHost:new URL(a7Origin()).host});
export default async function handler(request, context) {
  if (request.method !== 'GET') return noStoreJson({error:'method_not_allowed'},405);
  const auth = await authenticate(request,context);
  if (!auth.ok) return auth;
  let engine;
  try { engine=engineOf(); }
  catch { return noStoreJson({connected:false,reason:'a7_engine_not_configured',engine:'unconfigured',engineHost:null},503); }
  const credential = Netlify.env.get('A7_READ_AUTHORIZATION');
  if (!credential) return noStoreJson({connected:false,reason:'missing_connection_secret',...engine});
  try {
    const response=await fetch(a7Webhook('a7/owner-read?offset=0'),{headers:{Authorization:credential,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)return noStoreJson({connected:false,reason:[401,403].includes(response.status)?'upstream_authentication_rejected':'upstream_http_error',upstreamStatus:response.status,...engine});
    const data=await response.json();
    return noStoreJson({connected:Array.isArray(data.jobs),reason:Array.isArray(data.jobs)?'ok':'unexpected_response',recordedRuns:Number.isSafeInteger(data.total)?data.total:null,asOf:typeof data.asOf==='string'?data.asOf:null,...engine});
  } catch(error) {return noStoreJson({connected:false,reason:error.name==='TimeoutError'?'upstream_timeout':'upstream_connection_or_format_error',...engine});}
}
export const config={path:'/api/owner/connection',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:10}};
