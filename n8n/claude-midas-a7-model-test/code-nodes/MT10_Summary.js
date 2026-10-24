// Model test · Summary in plain words. Costs are estimates from Google's token counts and registry prices, not an invoice.
// A made image is a candidate: not reviewed and not approved. The owner judges each image by eye in the results table.
const P = $('MT4 Plan').first().json;
const get = n => { try { return $(n).all().map(i => i.json); } catch (e) { return null; } };
const r4 = x => Number((Number(x) || 0).toFixed(4));
const base = { run_id: P.run_id, mode: P.mode, cases: P.cases.map(c => ({ folder: c.folder, status: c.status, reason: c.reason || '', notes: c.notes, inventory: c.inventory || [], reading_source: c.reading_source || '', prompt_chars: c.prompt_chars || 0 })), planned: P.totals, plan_problems: P.problems };
const reminder = 'A made image is a candidate: not reviewed and not approved. The owner marks each one by eye in the "Claude Midas A7 model test" table. No model is approved by this test.';
if (P.mode !== 'paid') return [{ json: { ...base, outcome: 'preview', said: 'Preview only: nothing was sent and nothing was paid. ' + P.totals.calls + ' calls are planned, reserving about USD ' + Number(P.totals.reserve_usd).toFixed(2) + ' (estimate). A paid run needs the owner\'s go, the paid switch and a new go token.' } }];
const G = get('MT6 Guard');
if (!G || !G[0] || G[0].clear !== true) return [{ json: { ...base, outcome: 'stopped', said: 'Stopped before any call. Nothing was sent or paid.', problems: G && G[0] ? G[0].problems : ['The guard did not run.'] } }];
const O = get('MT8 Orders');
if (!O || !O[0] || O[0].folder_ok !== true) return [{ json: { ...base, outcome: 'stopped', said: 'Stopped before any call. Nothing was sent or paid.', problems: [O && O[0] ? O[0].problem : 'The orders step did not run.'] } }];
const R = get('MT9 Run one call') || [];
const calls = O.map((o, i) => {
  const r = R.find(x => x && x.operation_key === o.operation_key) || (R[i] && !R[i].operation_key ? R[i] : {});
  const known = r.operation_key === o.operation_key;
  return known
    ? { folder: o.folder, model: o.model, status: r.status, paid_call: r.paid_call, actual_usd: r.actual_usd, seconds: r.seconds, image_px: r.image_px || '', drive_link: r.drive_link || '', receipt_saved: r.receipt_saved, problem: r.problem || '', label: r.label || '' }
    : { folder: o.folder, model: o.model, status: 'unknown', paid_call: 'may have been', actual_usd: o.reserve_usd, problem: 'The one-call step returned no result for this order' + (r && r.error ? ' (' + String(r.error.message || r.error).slice(0, 160) + ')' : '') + '. Check the results table and the sub-workflow executions before any new try.' };
});
const byModel = {};
for (const c of calls) {
  const b = byModel[c.model] || (byModel[c.model] = { calls: 0, images_stored: 0, held: 0, not_sent: 0, spend_usd: 0 });
  b.calls++;
  if (c.status === 'completed') b.images_stored++; else if (c.status === 'not_sent') b.not_sent++; else b.held++;
  if (c.paid_call !== 'no') b.spend_usd = r4(b.spend_usd + (Number(c.actual_usd) || 0));
}
const spend = r4(calls.reduce((t, c) => t + (c.paid_call !== 'no' ? Number(c.actual_usd) || 0 : 0), 0));
const unsure = calls.filter(c => ['completed', 'not_sent', 'failed_not_started'].indexOf(c.status) === -1).length;
const notSaved = calls.filter(c => c.receipt_saved === false).length;
const extra = (unsure ? ' ' + unsure + ' calls may have been charged without a stored image (see each call\'s cost basis).' : '') + (notSaved ? ' ' + notSaved + ' results rows were not updated; check those executions.' : '');
return [{ json: { ...base, outcome: 'ran', said: calls.filter(c => c.status === 'completed').length + ' of ' + calls.length + ' images were made and stored. Spend about USD ' + spend.toFixed(2) + ' (estimate from token counts, not an invoice).' + extra + ' ' + reminder, guard_notes: G[0].notes || [], folder: O[0].drive_run_folder_name, by_model: byModel, spend_usd: spend, may_be_charged_without_image: unsure, rows_not_updated: notSaved, calls } }];
