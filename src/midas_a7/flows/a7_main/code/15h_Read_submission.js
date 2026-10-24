// Step 15 · Read Google's answer to the image request. Code only (15 Oct 2026).
// A refusal before start is not charged and is never retried by itself. No answer, or a server error without a request id, is "uncertain": it may have started and been charged, so it is never sent again automatically.
const s04 = JSON.parse(JSON.stringify($('15f Build request').first().json.s04));
const now = new Date().toISOString();
// Removes anything that looks like a key or token from an error text before it is stored or shown.
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const r = $input.first() ? $input.first().json : {};
const code = Number(r && r.statusCode) || 0;
const body = r && r.body && typeof r.body === 'object' ? r.body : {};
const TERMINAL = ['completed', 'failed', 'cancelled', 'incomplete', 'requires_action'];
const gErr = body.error ? (body.error.status ? body.error.status + ': ' : '') + (body.error.message || '') : '';
let status = '', next = 'stop', id = '', problem = '', interaction = null;
const rawId = String(body.id || '').replace(/^interactions\//, '');
if (code >= 200 && code < 300 && rawId) {
  if (!/^[A-Za-z0-9_.\-]{1,200}$/.test(rawId)) { status = 'uncertain'; id = clean(rawId).slice(0, 120); problem = 'Google accepted the request but returned an id this flow cannot use (' + id.slice(0, 60) + '). It may be charged. It is not sent again.'; }
  else {
    id = rawId;
    status = 'submitted';
    const ps = String(body.status || '');
    if (TERMINAL.indexOf(ps) !== -1) { next = 'receipt'; interaction = body; }
    else next = 'poll';
  }
} else if (code >= 200 && code < 300 && TERMINAL.indexOf(String(body.status || '')) !== -1) {
  // A synchronous call that is not stored at Google (16 Oct 2026) finishes in this answer and has no request id. It is read at once.
  status = 'submitted'; next = 'receipt'; interaction = body;
} else if (code >= 200 && code < 300) { status = 'uncertain_no_id'; problem = 'Google answered without a request id. The request may have started and may be charged. It is not sent again; check Google AI Studio before any new try.'; }
else if (code >= 400 && code < 500 && [408, 409, 499].indexOf(code) === -1) { status = 'failed_not_started'; problem = 'Google refused the request before starting (HTTP ' + code + (gErr ? ', ' + clean(gErr) : '') + '). No charge is expected (not confirmed). It is not sent again by itself.'; }
else if (code >= 400) { status = 'uncertain_no_id'; problem = 'Google returned an error that does not prove the request never started (HTTP ' + code + (gErr ? ', ' + clean(gErr) : '') + ') and no request id. The request may have started and may be charged. It is not sent again; check Google AI Studio before any new try.'; }
else { status = 'uncertain_no_id'; problem = 'No answer from Google' + (r && r.error ? ' (' + clean(r.error.message || r.error) + ')' : '') + '. The request may have started and may be charged. It is not sent again; check Google AI Studio before any new try.'; }
s04.submission = { at: now, http: code, provider_request_id: id, provider_status: String(body.status || ''), status, problem };
s04.paid = status !== 'failed_not_started';
s04.op_update = { status, provider_request_id: id, provider_status: String(body.status || ''), problem, drive_folder_id: (s04.drive_folder && s04.drive_folder.id) || '', updated_at: now };
if (next === 'stop') { s04.outcome = 'hold'; s04.hold_step = 15; s04.critical.push({ what: 'stage04', who: 'owner', why: problem }); }
return [{ json: { s04, next, interaction } }];
