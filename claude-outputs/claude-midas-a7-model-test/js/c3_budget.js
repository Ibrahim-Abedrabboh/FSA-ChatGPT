// Model test · one call · Check this go token's calls so far: this key is new, and the call and spend caps still hold. Code only (15 Oct 2026).
// Positive proof: the results table must answer with real rows or with nothing.
const o = $('C1 Check order').first().json.order;
const items = $input.all().map(i => i.json);
const readOk = items.length > 0 && items.every(r => r && !r.error && !r.order && (Object.keys(r).length === 0 || (r.operation_key && r.id !== undefined)));
const rows = items.filter(r => r && r.operation_key);
const p = [];
const dup = rows.find(r => r.operation_key === o.operation_key);
const sent = rows.filter(r => ['not_sent', 'failed_not_started'].indexOf(String(r.status)) === -1);
const cost = r => (r.actual_usd !== null && r.actual_usd !== undefined && r.actual_usd !== '' ? Number(r.actual_usd) || 0 : Number(r.reserved_usd) || 0);
const spent = Number(sent.reduce((t, r) => t + cost(r), 0).toFixed(4));
if (!readOk) p.push('the results table could not be read, so this key and the caps cannot be checked');
else {
  if (dup) p.push('this call already has a row (status "' + dup.status + '"); a call is never sent twice');
  if (sent.length >= Number(o.max_calls)) p.push('the cap of ' + o.max_calls + ' calls for this go token is reached');
  if (spent + Number(o.reserve_usd) > Number(o.max_spend_usd) + 1e-9) p.push('spend so far (about USD ' + spent.toFixed(2) + ') plus this call (USD ' + Number(o.reserve_usd).toFixed(2) + ') would pass the cap of USD ' + Number(o.max_spend_usd).toFixed(2));
}
return [{ json: { ok: p.length === 0, problem: p.length ? 'Not sent: ' + p.join('; ') + '.' : '', calls_before: sent.length, spent_before_usd: spent } }];
