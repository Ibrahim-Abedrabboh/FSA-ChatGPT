// Model test settings (15 Oct 2026). Folder and sheet ids are Drive ids, not secrets. No key or token is kept here.
// PAID SWITCH: paid_calls_allowed stays false until the owner says go in a message. A paid run also needs a go_token that was never used before.
// Used go tokens: claude-mt-go-20261015-t10 (Test 10, exec 417, 15 Oct 2026).
// 21:20: owner answers of 21:12 applied (prompt_edits, no_reading_ok, expected_counts; Test 8 off the skip list).
// 22:35: owner, 22:30: Test 8 is the bed only (1 piece; nightstands, lamps and decor are context). Test 6 is 6 pieces (sheet fixed).
const now = new Date();
const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
return [{ json: {
  run_id: 'claude-mt-' + stamp,
  paid_calls_allowed: false,
  go_token: '',
  models: ['gemini-nano-banana-2.1', 'gemini-3-pro-image'],
  frame: 'square, 1:1',
  image_size: '2K',
  thinking_level: '',
  testing_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1',
  truth_sheet: '1cKIwvEnnBwqPjkrx-pQ0WO1id2ajd1AcQk4hhAWRI9s',
  // The images go into a new folder made inside this one for each paid run.
  output_parent_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1',
  // Folders to test; an empty list means every confirmed Test folder.
  only_folders: [],
  skip_folders: {
    'Test 9': 'the photo is cropped and shows 7 of the 15 pieces; stage 04 would hold it'
  },
  // The owner's piece counts given in chat (21:06, 21:12 and 22:30). A case whose sheet count differs is skipped until the sheet is fixed.
  expected_counts: { 'Test 3': 7, 'Test 6': 6, 'Test 8': 1 },
  // Owner edits to the photo reading before the prompt is built (21:12).
  prompt_edits: {
    'Test 1': { drop_relations: true },
    'Test 4': { colour_drop: ['rust red'] }
  },
  // Folders the owner allows to run from the sheet alone, with no usable photo reading (21:12: Test 7).
  no_reading_ok: ['Test 7'],
  allow_no_reading: false,
  // Earlier calls (other go tokens) that may have been charged without a result hold the run. true = make them again.
  resend_after_uncertain: false,
  max_calls: 12,
  max_spend_usd: 3,
  max_inline_mb: 14,
  started_at: now.toISOString()
} }];
