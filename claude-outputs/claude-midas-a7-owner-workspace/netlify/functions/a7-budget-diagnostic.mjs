import {getStore} from '@netlify/blobs';
import {timingSafeEqual} from 'node:crypto';
import {budgetPool} from '../../lib/a7-database.mjs';
import {probeBudget} from '../../lib/a7-budget-probe.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
export default async function handler(request,context) {
 if(request.method!=='POST')return noStoreJson({error:'method_not_allowed'},405);
 if(context.deploy?.context!=='production')return noStoreJson({error:'production_required'},403);
 const expected=Netlify.env.get('A7_READ_AUTHORIZATION'),actual=request.headers.get('authorization')||'';
 if(!expected||actual.length>4096||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return noStoreJson({error:'unauthorized'},401);
 const body=await request.text();
 if(body.length>32)return noStoreJson({error:'invalid_request'},400);
 try{return noStoreJson(await probeBudget(budgetPool(),body==='{"checkpoints":true}'?getStore({name:'a7-owner-production',consistency:'strong'}):undefined));}catch{return noStoreJson({error:'budget_diagnostic_failed',message:'No provider was called. The diagnostic did not complete; rollback confirmation is unavailable.'},503);}
}
export const config={path:'/api/a7/budget-diagnostic',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:3600,windowLimit:6}};
