// Model test · one call · Ready check: the reserved row must be saved, and read back as the first row with this key, before anything is sent. Code only (15 Oct 2026).
// Two runs started at the same moment could both reserve the same call; only the run that holds the lowest row id sends.
const B = $('C4 Build request').first().json;
let ins = {};
try { ins = $('C5 Reserve').first().json || {}; } catch (e) { ins = {}; }
const saved = Boolean(ins && !ins.error && !ins.row && ins.operation_key === B.row.operation_key && Number(ins.id) > 0);
const items = $input.all().map(i => i.json);
const readOk = items.length > 0 && items.every(r => r && !r.error && !r.row && r.operation_key === B.row.operation_key && Number(r.id) > 0);
const first = readOk ? Math.min.apply(null, items.map(r => Number(r.id))) : 0;
const firstHere = saved && readOk && first === Number(ins.id);
const send = B.send === true && saved && String(ins.status) === 'reserved' && firstHere;
let problem = B.problem || '';
if (B.send === true && !saved) problem = 'The reserved row was not saved in the results table, so nothing was sent (a call is never made without its row).';
else if (B.send === true && !readOk) problem = 'The reserved row could not be read back from the results table, so nothing was sent.';
else if (B.send === true && !firstHere) problem = 'Another run reserved this same call first (row ' + first + '), so this run did not send it.';
return [{ json: { send, problem, row_saved: saved, sent_at: new Date().toISOString() } }];
