function safeText(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/https?:\/\/\S+/gi, '[link hidden]')
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '[credential hidden]')
    .replace(/(?:token|authorization|api[_ -]?key|secret|password|resume_url)\s*[:=]\s*[^\s,;]+/gi, '[credential hidden]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[credential hidden]')
    .slice(0, max);
}
function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(value); }
function isoDate(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function safeObservation(raw) {
 let value=raw;try{if(typeof value==='string')value=JSON.parse(value);}catch{return null;}
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=200?v:null;
 const textList=v=>Array.isArray(v)?v.slice(0,20).map(x=>safeText(typeof x==='string'?x:x&&typeof x==='object'?['feature','what','detail','location','side','text','basis'].map(k=>typeof x[k]==='string'?x[k]:'').filter(Boolean).join(' · '):'',300)).filter(Boolean):[];
 const category=safeText(value.category_seen,120),eye=count(value.count_eye),second=count(value.count_second);
 if(!category&&eye===null&&second===null)return null;
 return {category,eyeCount:eye,secondCount:second,statedCount:count(value.count_stated),printedCount:count(value.count_printed),colour:safeText(value.colour_observed,180),materialAppearance:safeText(value.material_appearance,180),cropped:value.cropped===true,cropNote:safeText(value.crop_note,350),hidden:textList(value.hidden),locks:textList(value.design_locks),relationships:textList(value.relations),uncertainties:textList(value.unclear_second),otherViews:textList(value.views_not_pieces),unreadFiles:textList(value.written?.files_not_read),pieces:Array.isArray(value.pieces_seen)?value.pieces_seen.slice(0,60).map(p=>({kind:safeText(p?.kind,80),label:safeText(p?.label,100),role:safeText(p?.role,40),features:textList(p?.features||p?.visible_features),cutOff:p?.cut_off===true})):[]};
}
function projectRun(row, includeHistory = false) {
  if (!validId(row?.run_id)) return null;
  const job = {
    id: row.run_id, clientId: safeText(row.client_run_id, 120),
    type: safeText(row.job_type, 80), status: safeText(row.status, 80), stage: safeText(row.stage, 100),
    summary: safeText(row.hold_reason || row.client_question),
    createdAt: isoDate(row.createdAt), updatedAt: isoDate(row.updatedAt),
    decisions: {
      go1: { decision: safeText(row.go1_decision, 80), at: isoDate(row.go1_at) },
      go2: { decision: safeText(row.go2_decision, 80), at: isoDate(row.go2_at) }
    }
  };
  if (includeHistory) {
    job.observation = safeObservation(row.observation);
    let history;
    try { history = JSON.parse(row.trail || '[]'); } catch { history = null; }
    job.historyAvailable = Array.isArray(history);
    job.historyTruncated = Array.isArray(history) && history.length > 300;
    job.history = Array.isArray(history) ? history.slice(-300).map(entry => ({
      name: safeText(entry?.name, 100), at: isoDate(entry?.at), note: safeText(entry?.note, 800),
      step: Number.isSafeInteger(entry?.step) ? entry.step : null
    })).filter(entry => entry.name) : [];
  }
  return job;
}
// One run can be recorded twice when a send was repeated (same run id and client id, two rows). Those are one job:
// keep the most recently updated row. Rows that share a run id but belong to different clients stay ambiguous.
function latestPerRun(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = row.run_id + '\u0000' + (row.client_run_id || '');
    const old = best.get(key), at = String(row.updatedAt || ''), oldAt = String(old?.updatedAt || '');
    if (!old || at > oldAt || (at === oldAt && Number(row.id) > Number(old.id))) best.set(key, row);
  }
  const keep = new Set(best.values());
  return rows.filter(row => keep.has(row));
}
function readResponse(rows, query, now = new Date().toISOString()) {
  const source = latestPerRun(rows.filter(row => validId(row?.run_id)));
  const capped = source.length > 1000;
  const visible = source.slice(0,1000);
  const offset = Number(query.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000 || (query.id && !validId(query.id))) return { error: 'invalid_query', http_status: 400 };
  if (query.id) {
    const matching = visible.filter(row => row.run_id === query.id);
    if (!matching.length) return { error: 'not_found', http_status: 404 };
    if (matching.length !== 1) return { error: 'ambiguous_run', http_status: 409 };
    return { job: projectRun(matching[0], true), asOf: now, source: 'A7 runs table', http_status: 200 };
  }
  const jobs = visible.slice(offset, offset + 50).map(row => projectRun(row));
  return { jobs, total: visible.length, capped, nextOffset: offset + jobs.length < visible.length ? offset + jobs.length : null, asOf: now, source: 'A7 runs table', http_status: 200 };
}

const rows = $input.all().map(item => item.json);
const query = $('Owner read webhook').first().json.query || {};
return [{json: readResponse(rows, query)}];