// Step 15 · Read the status of the image request (one check per pass of the loop). Code only (15 Oct 2026).
// Asking costs nothing. After the last check the request stays "uncertain": it is never sent again, and the request id is kept for the owner.
const sub = $('15h Read submission').first().json.s04;
const set = sub.settings || {};
const now = new Date().toISOString();
const r = $input.first() ? $input.first().json : {};
const polls = $runIndex + 1;
const max = Math.max(1, Number(set.max_polls) || 20);
const code = Number(r && r.statusCode) || 0;
const body = r && r.body && typeof r.body === 'object' ? r.body : {};
const TERMINAL = ['completed', 'failed', 'cancelled', 'incomplete', 'requires_action'];
let next = 'wait', status = String(body.status || ''), problem = '', interaction = null;
if (code >= 200 && code < 300 && TERMINAL.indexOf(status) !== -1) { next = 'done'; interaction = body; }
else if (code === 404) { next = 'done'; status = 'not_found'; problem = 'Google no longer finds request ' + sub.submission.provider_request_id + '.'; }
else if (!(code >= 200 && code < 300)) problem = 'check ' + polls + ': ' + (code ? 'HTTP ' + code : 'no answer');
if (next === 'wait' && polls >= max) { next = 'done'; problem = (problem ? problem + '. ' : '') + 'Still not finished after ' + polls + ' checks (last status: ' + (status || 'unknown') + ').'; }
return [{ json: { poll: { polls, http: code, status, next, problem, at: now }, interaction } }];
