// Reader test 3 settings (16 Oct 2026). Run ids start with claude-rt3-. No keys here.
const now = new Date();
return [{ json: { run_id: 'claude-rt3-' + now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14), testing_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1', a7_version: 'b187e58d', started_at: now.toISOString() } }];
