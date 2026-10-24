// Model test · one call · Return a short result to the model test: no image data, no key. Code only (15 Oct 2026).
// A made image is a candidate: not reviewed and not approved.
const get = n => { try { return $(n).first().json; } catch (e) { return null; } };
const C = get('C1 Check order');
const o = (C && C.order) || {};
const fin = get('C10 Final'), ready = get('C6 Ready check'), budget = get('C3 Budget check');
let status = 'not_sent', problem = '', u = null, receipt_saved = null;
if (fin) {
  u = fin.op_update; status = u.status; problem = u.problem || '';
  const inp = $input.first() ? $input.first().json : {};
  receipt_saved = Boolean(inp && !inp.error && !inp.op_update && inp.operation_key === fin.operation_key && Number(inp.id) > 0 && inp.status === u.status);
  if (!receipt_saved) problem = (problem + ' The results row was not updated; it may still say "reserved". The details are in this execution.').trim();
} else if (ready) problem = ready.problem || 'Not sent.';
else if (budget) problem = budget.problem || 'Not sent.';
else if (C) problem = C.problem || 'Not sent.';
else problem = 'Stopped before the order was read. Nothing was sent.';
const paid_call = !u ? 'no' : (status === 'failed_not_started' ? 'refused before start; no charge expected (not confirmed)' : 'yes, or may have been');
return [{ json: { operation_key: o.operation_key || '', folder: o.folder || '', model: o.model || '', status, paid_call,
  actual_usd: u ? u.actual_usd : 0, cost_basis: u ? u.cost_basis : 'nothing sent', seconds: u ? u.seconds : 0, image_px: u ? u.image_px : '',
  drive_link: u ? u.drive_link : '', receipt_saved, problem,
  label: status === 'completed' ? 'Generated image. Candidate: not reviewed and not approved.' : '' } }];
