// Reader test 5 settings (21 Oct 2026). Run ids start with claude-rt5-. No keys here.
// The prompt is v3, live on the photo check since 19 Oct 2026 (claude-outputs/claude-midas-a7-owner-workspace/analysis-reader-prompts-live.md).
// prompt_check reports the reader prompt as stored in this workflow (length, line count, first and last words), so a wrong paste shows in a free dry run before any paid call.
const now = new Date();
let prompt_check;
try { const t = String($('OpenAI photo reader').params.text || ''); prompt_check = { chars: t.length, lines: t.split('\n').length, first: t.slice(0, 40), last: t.slice(-40) }; } catch (e) { prompt_check = { error: String((e && e.message) || e) }; }
return [{ json: { run_id: 'claude-rt5-' + now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14), testing_folder: '1hRC7Wd9n9Sh2IRpvlX01MuZ4P6ksvag1', a7_version: 'a8e184b (Python service)', prompt_variant: 'v3 (photo-check prompt, owner-approved 19 Oct 2026); same model and settings as reader test 4', prompt_check, started_at: now.toISOString() } }];
