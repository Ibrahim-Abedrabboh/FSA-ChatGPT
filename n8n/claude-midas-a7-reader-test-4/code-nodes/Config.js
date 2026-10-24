// Reader test 4 settings (16 Oct 2026). Run ids start with claude-rt4-. No keys here.
// The prompt is pending/03_Eye_photo_reader.rt4-candidate*.txt (one change from D13); prompt_variant says which.
const now = new Date();
return [{ json: { run_id: 'claude-rt4-' + now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14), testing_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1', a7_version: 'eefd6c42', prompt_variant: 'ADD (owner 22:56 wording): pending/03_Eye_photo_reader.rt4-candidate-with-test4-clause.txt', started_at: now.toISOString() } }];
