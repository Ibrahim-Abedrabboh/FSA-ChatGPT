// Reader test config. Folder and sheet ids are Drive ids, not secrets.
const now = new Date();
const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
return [{ json: {
  run_id: 'claude-rt-' + stamp,
  testing_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1',
  truth_sheet: '1cKIwvEnnBwqPjkrx-pQ0WO1id2ajd1AcQk4hhAWRI9s',
  // Folders to read this run; empty list = every Test folder.
  only_folders: [],
  started_at: now.toISOString()
} }];
