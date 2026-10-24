// Model test · Orders: one item per call, each with the Drive folder made for this run. Code only (15 Oct 2026).
// The folder needs positive proof: a Drive id. A step that failed and passed its input on counts as a failure.
const P = $('MT4 Plan').first().json;
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const f = $input.first() ? $input.first().json : {};
const ok = Boolean(f && f.id && !f.error && !('clear' in f) && !f.orders);
if (!ok) return [{ json: { folder_ok: false, problem: 'The Google Drive folder for this run was not made (' + clean((f && f.error && (f.error.message || f.error)) || 'no folder id returned') + '). Nothing was sent.' } }];
return P.orders.map(o => ({ json: { ...o, folder_ok: true, drive_run_folder_id: String(f.id), drive_run_folder_name: String(f.name || '') } }));
