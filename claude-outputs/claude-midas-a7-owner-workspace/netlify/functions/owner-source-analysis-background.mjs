import authenticate from './owner-me.mjs';
import {productionSourceUnderstandingService} from '../../lib/a7-understanding-production.mjs';
import {requestId} from '../../lib/a7-actions.mjs';

// A Netlify background function: the caller gets 202 at once and this runs for up to 15 minutes,
// so the paid reads are no longer cut off when the owner's request times out.
// It runs only a claim the owner already authorized through /api/owner/source-understanding,
// and execute() takes a one-time dispatch marker before any paid call.
export function createSourceAnalysisBackground(service,{timeoutMs=305000}={}){
 return async function handler(request,context){
  // The caller only ever sees the platform's 202, so every early stop is logged with its reason (never the photo or a secret).
  const skip=reason=>{console.error('source-analysis-background','not started',reason);};
  if(request.method!=='POST')return skip('method_'+request.method);
  if(context.deploy?.context!=='production')return skip('deploy_context_'+String(context.deploy?.context||'unknown'));
  const auth=await authenticate(new Request(request.url,{method:'GET',headers:request.headers}),context);
  if(!auth.ok)return skip('sign_in_'+auth.status);
  const owner=(await auth.json()).id;
  let draft;try{draft=JSON.parse(await request.text())?.draftId;}catch{return skip('invalid_body');}
  if(!requestId(draft))return skip('invalid_draft_id');
  try{await service().execute(owner,draft,{timeoutMs});}
  catch(error){console.error('source-analysis-background',draft,error?.message);}
 };
}
export default createSourceAnalysisBackground(()=>productionSourceUnderstandingService());
export const config={background:true};
