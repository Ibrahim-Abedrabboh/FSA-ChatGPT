// Stage 07 · One item per scene delivery file for the Drive upload (jpg, then webp; step 20). Code only (16 Oct 2026).
const C = $('20f Check scene files').first();
const sf = C.json.sf;
let folder = {};
try { folder = $('20g Scene files folder').first().json || {}; } catch (e) { folder = {}; }
const folderOk = Boolean(folder.id && !folder.error);
// A scene run passes through these nodes once per approved scene in the same execution, so a stop says which ticket it belongs to.
if (!folderOk) return [{ json: { skip: true, ticket_at: sf.at, output_id: sf.output_id, problem: 'The scene files folder could not be made in Google Drive (' + String((folder.error && (folder.error.message || folder.error)) || 'no folder id returned').slice(0, 200) + '). Nothing was uploaded.' } }];
const bin = C.binary || {};
const missing = sf.files.filter(f => !bin[f.format]).map(f => f.format);
if (missing.length) return [{ json: { skip: true, ticket_at: sf.at, output_id: sf.output_id, problem: 'The checked ' + missing.join(' and ') + ' file did not reach the upload step, so nothing was uploaded. The scene files folder is in Google Drive and empty.' } }];
return sf.files.map(f => ({ json: { skip: false, format: f.format, name: f.file_name, folder_id: String(folder.id) }, binary: { file: bin[f.format] } }));
