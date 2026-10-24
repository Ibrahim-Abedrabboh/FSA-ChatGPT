import authenticate from './owner-me.mjs';
import {budgetPool} from '../../lib/a7-database.mjs';
import {readBudget,reconcileCall} from '../../lib/a7-budget.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {sameOrigin} from '../../lib/a7-actions.mjs';
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;const owner=await auth.json();
 try{
  if(request.method==='GET')return noStoreJson(await readBudget(budgetPool(),owner.id,context.params?.id));
  if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
  if(!sameOrigin(request)||context.deploy?.context!=='production')return noStoreJson({error:'origin_rejected'},403);
  const text=await request.text();if(text.length>4000)return noStoreJson({error:'invalid_request'},400);
  return noStoreJson(await reconcileCall(budgetPool(),owner.id,context.params?.id,JSON.parse(text)));
 }catch(error){const known=['not_found','invalid_budget','invalid_reconciliation','operation_not_uncertain','reconciliation_conflict'];return noStoreJson({error:known.includes(error.message)?error.message:'budget_storage_unavailable'},error.message==='not_found'?404:known.includes(error.message)?409:503);}
}
export const config={path:'/api/owner/budgets/:id',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:20}};
