// Pair each "Test N" folder with its main photo. A folder with no photo is reported, not skipped.
const folders = $('Find test folders').all().map(i => i.json)
  .filter(f => /^Test \d+$/.test(String(f.name || '').trim()))
  .sort((a, b) => Number(a.name.replace(/\D/g, '')) - Number(b.name.replace(/\D/g, '')));
const only = $('Config').first().json.only_folders || [];
const wanted = only.length ? folders.filter(f => only.indexOf(f.name.trim()) !== -1) : folders;
const files = $input.all().map(i => i.json).filter(f => f && f.id && !f.trashed);
const out = [];
for (const f of wanted) {
  const mine = files.filter(x => Array.isArray(x.parents) && x.parents.indexOf(f.id) !== -1);
  const photo = mine.find(x => /^main\./i.test(String(x.name)) && String(x.mimeType || '').indexOf('image/') === 0)
    || mine.find(x => String(x.mimeType || '').indexOf('image/') === 0);
  out.push({ json: {
    run_id: $('Config').first().json.run_id,
    folder: f.name.trim(), folder_id: f.id,
    file_id: photo ? photo.id : '', file_name: photo ? photo.name : '', mime: photo ? photo.mimeType : '',
    problem: photo ? (mine.length > 1 ? 'more than one file; used ' + photo.name : '') : 'no photo in the folder'
  } });
}
return out;
