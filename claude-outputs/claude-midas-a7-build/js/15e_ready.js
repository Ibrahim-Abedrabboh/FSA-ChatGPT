// Step 15 · Ready check: the reservation is saved and the run folder exists in Google Drive, before anything is sent. Code only (15 Oct 2026).
// It also hands the run's photos to the next node, which can only read files on its own input.
const s04 = JSON.parse(JSON.stringify($('15b Dispatch guard').first().json.s04));
const now = new Date().toISOString();
// Removes anything that looks like a key or token from an error text before it is stored or shown.
const clean = t => String(t || '').replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[removed]').replace(/([?&](key|api_key|access_token|token)=)[^&\s"']+/gi, '$1[removed]').replace(/(\b(x-goog-api-key|authorization|api_key|apikey|access_token|token|key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]').slice(0, 300);
const ins = $input.first() ? $input.first().json : {};
let folder = {};
try { folder = $('15c Drive run folder').first().json || {}; } catch (e) { folder = { error: 'the folder step did not run' }; }
s04.reservation = { saved: Boolean(ins && !ins.error && Number(ins.id) > 0 && ins.operation_key === s04.op_row.operation_key), row_id: ins && Number(ins.id) > 0 ? Number(ins.id) : null };
s04.drive_folder = { id: folder && !folder.error && folder.id ? String(folder.id) : '', name: folder && folder.name ? String(folder.name) : '', problem: folder && folder.error ? clean(folder.error.message || folder.error) : '' };
function notReady(why) {
  s04.ready = false; s04.outcome = 'hold'; s04.hold_step = 15; s04.paid = false;
  s04.critical.push({ what: 'stage04', who: 'owner', why });
  s04.op_update = { status: 'not_sent', problem: why, drive_folder_id: s04.drive_folder.id, updated_at: now };
}
if (!s04.reservation.saved) notReady('The reservation could not be saved in the operations table, so nothing was sent or paid.');
else if (!s04.drive_folder.id) notReady('The run folder could not be made in Google Drive' + (s04.drive_folder.problem ? ' (' + s04.drive_folder.problem + ')' : '') + ', so nothing was sent or paid. Check the folder id in 04 Settings and the Drive connection.');
else s04.ready = true;
// Stage 07 (16 Oct 2026): a scene also carries the images checked in "19g Scene references" (master, room, Midas pieces).
let bin = Object.assign({}, $('02 Ingest files').first().binary || {});
if (s04.dispatch && s04.dispatch.scene) { let extra = null; try { extra = $('19g Scene references').first().binary || null; } catch (e) { extra = null; } if (extra) bin = Object.assign(bin, extra); }
return [{ json: { s04 }, binary: bin }];
