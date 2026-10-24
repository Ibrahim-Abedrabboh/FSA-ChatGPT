// Step 15 · Dispatch guard: daily limit, the job budget, and one operation key per paid call. Code only (15 Oct 2026).
// Rows come from "15a Load operations": every operation of today plus every operation of this run.
const S = $('13 Compile').first().json;
const s04 = JSON.parse(JSON.stringify($('14 Choose model').first().json.s04));
const set = s04.settings || {};
const items = $input.all().map(i => i.json);
const rows = items.filter(r => r && r.operation_key);
const now = new Date().toISOString();
const today = now.slice(0, 10);
function stop(why) { s04.go = false; s04.outcome = 'hold'; s04.hold_step = 15; s04.critical.push({ what: 'stage04', who: 'owner', why }); }
const o = s04.dispatch;
const key = S.run_id + ':' + o.output_id + ':try' + o.attempt;
// Calls that never reached Google, or that Google refused before starting, are not counted.
const NOT_CHARGED = ['failed_not_started', 'not_sent'];
const charged = r => NOT_CHARGED.indexOf(String(r.status || '')) === -1;
const usedToday = rows.filter(r => r.day === today && charged(r)).length;
const mine = rows.filter(r => r.run_id === S.run_id && charged(r));
const spent = mine.reduce((t, r) => t + (Number(r.actual_usd) || Number(r.reserved_usd) || 0), 0);
const budget = Number(S.cost_estimate && S.cost_estimate.max_two_repairs_each) || 0;
const limit = Number(set.daily_image_limit) || 0;
const same = rows.find(r => r.operation_key === key);
// Positive proof: every item is either an empty result or a real operations row. Anything else (an error, or the previous node's data passed through) stops here.
const readOk = items.length > 0 && items.every(r => r && !r.error && !r.s04 && (Object.keys(r).length === 0 || (r.operation_key && r.id !== undefined)));
if (!readOk) stop('The operations table could not be read, so the daily limit cannot be checked. Nothing was sent.');
else if (same && NOT_CHARGED.indexOf(String(same.status || '')) !== -1) stop('An earlier try with the key ' + key + ' stopped before payment (status ' + same.status + '). A key is never used twice; send the job again to make a new run.');
else if (same) stop('An operation with the key ' + key + ' already exists (status ' + (same.status || 'unknown') + (same.provider_request_id ? ', Google request ' + same.provider_request_id : '') + '). A paid call is never sent twice; check its receipt first.');
else if (!limit) stop('No daily image limit is set (04 Settings, daily_image_limit). Nothing was sent.');
else if (usedToday + 1 > limit) stop('The daily limit of ' + limit + ' paid image calls is reached (' + usedToday + ' used today, UTC). Nothing was sent.');
else if (!budget) stop('This job has no cost estimate, so there is no budget to check against. Nothing was sent.');
else if (spent + s04.reserve_usd > budget + 1e-9) stop('This call (reserved USD ' + s04.reserve_usd.toFixed(4) + ') would take the job past its estimate of USD ' + budget.toFixed(3) + ' (already reserved or spent: USD ' + spent.toFixed(4) + '). Nothing was sent.');
if (s04.outcome !== 'hold') {
  s04.guard = { used_today: usedToday, daily_limit: limit, spent_usd: Number(spent.toFixed(4)), budget_usd: budget, day: today };
  s04.op_row = { operation_key: key, run_id: S.run_id, client_run_id: S.client_run_id, output_id: o.output_id, attempt: o.attempt, model: s04.model.model_id, price_date: s04.model.price_date,
    contract_stamp: S.contract_stamp, prompt: o.prompt, prompt_sha256: o.prompt_sha256,
    reference_roles: JSON.stringify(o.references.map(r => ({ n: r.n, role: r.role, name: r.name, sha256: r.sha256 }))),
    // P1.3 (16 Oct 2026): the call is synchronous and not stored at Google since A7 8c9b4675 (15f); the record now says so.
    settings: JSON.stringify({ aspect_ratio: o.ratio, image_size: o.size, thinking_level: set.thinking_level || 'model default', background: false, store: false, mode: 'synchronous, not stored at Google' }),
    status: 'reserved', reserved_usd: s04.reserve_usd, cost_basis: s04.reserve_basis, day: today, at: now, updated_at: now };
  s04.go = true;
}
return [{ json: { s04 } }];
