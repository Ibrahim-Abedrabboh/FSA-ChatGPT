// Pairs each "Test N" folder with its main photo (same rule as the reader test, 14 Oct). A folder with no photo is reported, not skipped.
const cfg = $('MT1 Config').first().json;
const folders = $('Find test folders').all().map(i => i.json)
  .filter(f => f && f.id && /^Test \d+$/.test(String(f.name || '').trim()))
  .sort((a, b) => Number(a.name.replace(/\D/g, '')) - Number(b.name.replace(/\D/g, '')));
const only = cfg.only_folders || [];
const wanted = only.length ? folders.filter(f => only.indexOf(f.name.trim()) !== -1) : folders;
const files = $input.all().map(i => i.json).filter(f => f && f.id && !f.trashed);
const out = [];
for (const f of wanted) {
  const mine = files.filter(x => Array.isArray(x.parents) && x.parents.indexOf(f.id) !== -1);
  const photo = mine.find(x => /^main\./i.test(String(x.name)) && String(x.mimeType || '').indexOf('image/') === 0)
    || mine.find(x => String(x.mimeType || '').indexOf('image/') === 0);
  out.push({ json: {
    folder: f.name.trim(), folder_id: f.id,
    file_id: photo ? photo.id : '', file_name: photo ? photo.name : '', mime: photo ? photo.mimeType : '',
    problem: photo ? (mine.length > 1 ? 'more than one file; used ' + photo.name : '') : 'no photo in the folder'
  } });
}
if (!out.length) out.push({ json: { none: true, problem: 'No "Test N" folder was found in the Testing folder.' } });
return out;
