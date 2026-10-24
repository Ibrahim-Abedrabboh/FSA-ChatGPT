// Model test · one call · Check the order. Code only (15 Oct 2026).
// This sub-workflow makes at most one paid call per run. It refuses an order without the paid switch, a go token and a matching key.
const crypto = require('crypto');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const all = $input.all();
const o = all[0] ? all[0].json : {};
const p = [];
if (all.length !== 1) p.push('one order per run is allowed; ' + all.length + ' arrived');
if (o.paid_calls_allowed !== true) p.push('the paid switch is off');
if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(o.go_token || ''))) p.push('no valid go token');
if (!/^Test \d+$/.test(String(o.folder || ''))) p.push('the folder name is not "Test N"');
if (!/^[a-z0-9][a-z0-9.\-]*$/.test(String(o.model || ''))) p.push('the model id is not a plain model id');
if (o.operation_key !== 'claude-mt:' + o.go_token + ':' + o.folder + ':' + o.model) p.push('the operation key does not match the order');
if (!o.file_id) p.push('no vendor photo id');
if (!o.drive_run_folder_id) p.push('no Drive folder for the image');
if (!o.prompt || sha(o.prompt) !== o.prompt_sha256) p.push('the prompt does not match its checksum');
if (!/^\d+:\d+$/.test(String(o.ratio || '')) || ['1K', '2K', '4K'].indexOf(String(o.size)) === -1) p.push('the frame or size is not valid');
if (!(Number(o.reserve_usd) > 0) || !o.prices || !(Number(o.prices.input) > 0) || !(Number(o.prices.image_out) > 0) || !(Number(o.prices.text_out) > 0)) p.push('no reserved cost or prices');
if (!(Number(o.max_spend_usd) > 0) || !(Number(o.max_calls) > 0)) p.push('no spend or call cap');
return [{ json: { ok: p.length === 0, problem: p.length ? 'Order refused: ' + p.join('; ') + '. Nothing was sent.' : '', order: o } }];
