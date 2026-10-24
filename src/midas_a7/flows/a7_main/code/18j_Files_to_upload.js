// Stage 06 · One item per delivery file for the Drive upload (jpg, then webp). Code only (16 Oct 2026).
const C = $('18h Check files').first();
const pk = C.json.pk;
let folder = {};
try { folder = $('18i Package folder').first().json || {}; } catch (e) { folder = {}; }
const folderOk = Boolean(folder.id && !folder.error);
if (!folderOk) return [{ json: { skip: true, problem: 'The package folder could not be made in Google Drive (' + String((folder.error && (folder.error.message || folder.error)) || 'no folder id returned').slice(0, 200) + '). Nothing was uploaded.' } }];
const bin = C.binary || {};
const missing = pk.files.filter(f => !bin[f.format]).map(f => f.format);
if (missing.length) return [{ json: { skip: true, problem: 'The checked ' + missing.join(' and ') + ' file did not reach the upload step, so nothing was uploaded. The package folder is in Google Drive and empty.' } }];
return pk.files.map(f => ({ json: { skip: false, format: f.format, name: f.file_name, folder_id: String(folder.id) }, binary: { file: bin[f.format] } }));
