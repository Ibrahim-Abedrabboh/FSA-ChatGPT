import authenticate from './owner-me.mjs';
import { noStoreJson } from '../../lib/owner-auth.mjs';
import {a7Webhook,a7Origin,N8N_ORIGIN} from '../../lib/a7-engine-base.mjs';
// Which engine this site calls, so the owner can see it: the Python service or n8n, and the host itself.
const engineOf=()=>{const origin=a7Origin();return {engine:origin===N8N_ORIGIN?'n8n':'python_service',engineHost:new URL(origin).host};};
export default async function handler(request, context) {
  if (request.method !== 'GET') return noStoreJson({error:'method_not_allowed'},405);
  const auth = await authenticate(request,context);
  if (!auth.ok) return auth;
  const credential = Netlify.env.get('A7_READ_AUTHORIZATION');
  if (!credential) return noStoreJson({connected:false,reason:'missing_connection_secret',...engineOf()});
  try {
    const response=await fetch(a7Webhook('a7/owner-read?offset=0'),{headers:{Authorization:credential,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)return noStoreJson({connected:false,reason:[401,403].includes(response.status)?'upstream_authentication_rejected':'upstream_http_error',upstreamStatus:response.status,...engineOf()});
    const data=await response.json();
    return noStoreJson({connected:Array.isArray(data.jobs),reason:Array.isArray(data.jobs)?'ok':'unexpected_response',recordedRuns:Number.isSafeInteger(data.total)?data.total:null,asOf:typeof data.asOf==='string'?data.asOf:null,...engineOf()});
  } catch(error) {return noStoreJson({connected:false,reason:error.name==='TimeoutError'?'upstream_timeout':'upstream_connection_or_format_error',...engineOf()});}
}
export const config={path:'/api/owner/connection',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:10}};
