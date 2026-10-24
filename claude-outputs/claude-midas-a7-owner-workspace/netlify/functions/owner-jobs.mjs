import authenticate from './owner-me.mjs';
import { noStoreJson } from '../../lib/owner-auth.mjs';
import { validId, safeText, isoDate } from '../../lib/a7-contract.mjs';
import {a7Webhook} from '../../lib/a7-engine-base.mjs';

export function cleanJob(job, history = false) {
  if (!validId(job?.id)) throw new Error('Invalid job');
  const result = { id: job.id, clientId: safeText(job.clientId,120), type: safeText(job.type,80), status: safeText(job.status,80), stage: safeText(job.stage,100), summary: safeText(job.summary), createdAt: isoDate(job.createdAt), updatedAt: isoDate(job.updatedAt), decisions: {} };
  for (const key of ['go1','go2']) result.decisions[key] = { decision: safeText(job.decisions?.[key]?.decision,80), at: isoDate(job.decisions?.[key]?.at) };
  if (history) {
    if (!Array.isArray(job.history) || job.history.length > 300) throw new Error('Invalid history');
    result.observation=cleanObservation(job.observation);
    result.historyAvailable = job.historyAvailable === true;
    result.historyTruncated = job.historyTruncated === true;
    result.history = job.history.map(entry => ({ name: safeText(entry.name,100), at: isoDate(entry.at), note: safeText(entry.note,800), step: Number.isSafeInteger(entry.step) ? entry.step : null }));
  }
  return result;
}
export function cleanObservation(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=200?v:null;
 const list=v=>Array.isArray(v)?v.slice(0,20).map(x=>safeText(x,350)).filter(Boolean):[];
 return {category:safeText(value.category,120),eyeCount:count(value.eyeCount),secondCount:count(value.secondCount),statedCount:count(value.statedCount),printedCount:count(value.printedCount),colour:safeText(value.colour,180),materialAppearance:safeText(value.materialAppearance,180),cropped:value.cropped===true,cropNote:safeText(value.cropNote,350),hidden:list(value.hidden),locks:list(value.locks),relationships:list(value.relationships),uncertainties:list(value.uncertainties),otherViews:list(value.otherViews),unreadFiles:list(value.unreadFiles),pieces:Array.isArray(value.pieces)?value.pieces.slice(0,60).map(p=>({kind:safeText(p?.kind,80),label:safeText(p?.label,100),role:safeText(p?.role,40),features:list(p?.features),cutOff:p?.cutOff===true})):[]};
}
export default async function handler(request, context) {
  if (request.method !== 'GET') return noStoreJson({error:'method_not_allowed'},405);
  const auth = await authenticate(request, context);
  if (!auth.ok) return auth;
  const url = new URL(request.url);
  const id = context.params?.id;
  const offset = url.searchParams.get('offset') || '0';
  if ((id && !validId(id)) || !/^\d{1,4}$/.test(offset) || Number(offset)>1000 || [...url.searchParams.keys()].some(key=>key!=='offset')) return noStoreJson({error:'invalid_query'},400);
  const authorization = Netlify.env.get('A7_READ_AUTHORIZATION');
  if (!authorization) return noStoreJson({error:'a7_connection_not_configured'},503);
  // Fixed upstream prevents request-controlled hostnames, paths or credentials.
  const upstream = new URL(a7Webhook('a7/owner-read'));
  if (id) upstream.searchParams.set('id',id); else upstream.searchParams.set('offset',offset);
  try {
    const response = await fetch(upstream,{headers:{Authorization:authorization,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if ([404,409].includes(response.status) && id) return noStoreJson({error:response.status===404?'not_found':'ambiguous_run'},response.status);
    if (!response.ok) return noStoreJson({error:'a7_unavailable'},502);
    const text = await response.text();
    if (text.length > 1200000) throw new Error('Response too large');
    const data = JSON.parse(text);
    if (!isoDate(data.asOf)) throw new Error('Invalid timestamp');
    if (id) {
      if (data.job?.id!==id) throw new Error('Mismatched job');
      return noStoreJson({job:cleanJob(data.job,true),asOf:data.asOf});
    }
    if (!Array.isArray(data.jobs) || data.jobs.length>50 || !Number.isSafeInteger(data.total) || data.total<0 || data.total>1000 || !(data.nextOffset===null || Number.isSafeInteger(data.nextOffset) && data.nextOffset>Number(offset) && data.nextOffset<=1000)) throw new Error('Invalid response');
    return noStoreJson({jobs:data.jobs.map(job=>cleanJob(job)),total:data.total,capped:data.capped===true,nextOffset:data.nextOffset,asOf:data.asOf});
  } catch { return noStoreJson({error:'a7_unavailable'},502); }
}
export const config = {path:['/api/owner/jobs','/api/owner/jobs/:id'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:60}};
