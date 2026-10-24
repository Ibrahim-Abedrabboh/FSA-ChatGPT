// Model test · one call · Final receipt: adds the Drive copy (or why there is none) before the results row is updated. Code only (15 Oct 2026).
// If an image was due for upload but the input is still the read step's output, the upload failed and passed its input on.
const D = $('C8 Read result').first().json;
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const inp = $input.first() ? $input.first().json : {};
const u = JSON.parse(JSON.stringify(D.op_update));
if (D.store_image === true) {
  const up = inp && inp.op_update ? { error: 'the upload step failed and returned no file' } : (inp || {});
  const ok = Boolean(up.id && !up.error);
  if (ok) {
    u.drive_file_id = String(up.id); u.drive_link = String(up.webViewLink || '');
    const m = up.sha256Checksum ? String(up.sha256Checksum).toLowerCase() === u.image_sha256 : null;
    if (m === false) u.problem = (u.problem + ' Google Drive saved the file, but its checksum differs from the image received. Check the Drive file before judging it.').trim();
  } else {
    u.status = 'completed_not_stored';
    u.problem = (u.problem + ' The image was made and is charged, but Google Drive did not save it (' + clean((up.error && (up.error.message || up.error)) || 'no file id returned') + '). It exists only in this n8n execution. It is not made again.').trim();
  }
}
u.updated_at = new Date().toISOString();
return [{ json: { operation_key: D.operation_key, op_update: u } }];
