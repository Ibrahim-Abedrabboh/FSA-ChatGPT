// Step 15 · Final receipt: adds the permanent copy in Google Drive (or why there is none) before the operation row is updated. Code only (15 Oct 2026).
// Input is either the Drive upload result, or the state of a run that stopped earlier (it carries s04).
// If an image was due for upload but the input still carries s04, the upload step failed and passed its input on: that is treated as a failed upload.
const now = new Date().toISOString();
// Removes anything that looks like a key or token from an error text before it is stored or shown.
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const inp = $input.first() ? $input.first().json : {};
let s04;
if (inp && inp.s04 && inp.s04.store_image !== true) s04 = JSON.parse(JSON.stringify(inp.s04));
else {
  s04 = JSON.parse(JSON.stringify($('15m Receipt').first().json.s04));
  const up = inp && inp.s04 ? { error: 'the upload step failed and returned no file' } : (inp || {});
  const ok = Boolean(up.id && !up.error);
  const img = s04.receipt.image;
  const shaMatch = ok && up.sha256Checksum ? String(up.sha256Checksum).toLowerCase() === img.sha256 : null;
  s04.permanent_copy = ok
    ? { stored: true, drive_file_id: String(up.id), link: up.webViewLink || '', folder_id: s04.drive_folder.id, drive_sha256_matches: shaMatch === null ? 'not reported by Drive' : shaMatch, at: now }
    : { stored: false, problem: clean((up.error && (up.error.message || up.error)) || 'no file id returned'), at: now };
  if (ok) s04.op_update.drive_file_id = String(up.id);
  if (!ok) {
    s04.outcome = 'hold';
    s04.op_update.status = 'completed_not_stored';
    s04.op_update.problem = 'The image was made and is charged, but Google Drive did not save it (' + s04.permanent_copy.problem + '). It exists only in this n8n execution for now. It is not made again.';
    s04.hold_step = 15; s04.critical.push({ what: 'stage04', who: 'owner', why: s04.op_update.problem });
  } else if (shaMatch === false) {
    s04.outcome = 'hold';
    s04.op_update.problem = 'Google Drive saved the file, but its checksum differs from the image received. Check the Drive file before use.';
    s04.hold_step = 15; s04.critical.push({ what: 'stage04', who: 'owner', why: s04.op_update.problem });
  }
}
if (s04.op_update) s04.op_update.updated_at = now;
return [{ json: { s04 } }];
