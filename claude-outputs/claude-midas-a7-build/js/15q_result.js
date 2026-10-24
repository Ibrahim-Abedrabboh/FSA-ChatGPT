// Stage 04 · Result: the state that goes to the vault and the run row. Code only (15 Oct 2026).
// A made image is a candidate: not reviewed and not approved. Every stop holds for the owner; nothing is sent again automatically.
const S = $('13 Compile').first().json;
const inp = $input.first() ? $input.first().json : {};
// After a reservation the run always passes "15o Final receipt" and "15p Save receipt"; earlier stops come straight here with s04 on the input.
// One execution can hold several dispatches (white master, empty room, placement, repairs): a receipt counts only when it belongs
// to this compile (same start time). Found in pinned run 433: an early stop read the white master's older receipt (16 Oct 2026).
let viaReceipt = null;
try { viaReceipt = $('15o Final receipt').first().json.s04; } catch (e) { viaReceipt = null; }
const thisCompile = (S.s04 && S.s04.started_at) || '';
if (viaReceipt && viaReceipt.started_at !== thisCompile) viaReceipt = null;
let s04 = viaReceipt || (inp && inp.s04) || null;
const unmatched = !s04;
if (!s04) s04 = { started_at: thisCompile, orders: (S.s04 && S.s04.orders) || [], dispatch: (S.s04 && S.s04.dispatch) || null, outcome: 'hold', notes: [], hold_step: 15,
  critical: [{ what: 'stage04', who: 'owner', why: 'The result of this dispatch could not be matched to its compile, so it is not used. Check the operations table before anything is sent again.' }] };
// The receipt counts as saved only when the table returned the updated row for this operation key.
const receiptSaved = viaReceipt ? Boolean(inp && !inp.error && !inp.s04 && inp.operation_key === viaReceipt.op_row.operation_key) : null;
s04 = JSON.parse(JSON.stringify(s04));
const now = new Date().toISOString();
const arr = x => (Array.isArray(x) ? x : []);
const st = { ...S };
delete st.s04;
const op = s04.op_update || null;
const SENT = ['submitted', 'completed', 'failed', 'uncertain', 'uncertain_no_id', 'completed_no_image', 'completed_not_stored', 'completed_bad_image', 'receipt_unreadable'];
const paid = Boolean(op && SENT.indexOf(op.status) !== -1);
const refused = Boolean(op && op.status === 'failed_not_started');
if (receiptSaved === false && !(s04.reservation && s04.reservation.saved === false)) {
  s04.critical.push({ what: 'stage04', who: 'owner', why: 'The receipt could not be written to the operations table; its row may still say "reserved" or "submitted". The full receipt is in this run\'s vault.' });
  if (s04.outcome === 'candidate') s04.outcome = 'hold';
}
const pc = s04.permanent_copy || null;
const img = s04.receipt && s04.receipt.image;
const candidate = s04.outcome === 'candidate' && pc && pc.stored && img ? { output_id: s04.dispatch.output_id, scene: s04.dispatch.scene || null, drive_file_id: pc.drive_file_id, link: pc.link, folder_id: pc.folder_id, drive_sha256_matches: pc.drive_sha256_matches,
  sha256: img.sha256, bytes: img.bytes, px: img.px, file_name: img.file_name, label: img.label } : null;
st.stage04 = {
  round: Number(s04.dispatch && s04.dispatch.attempt) || 1, at: now, settings_date: (s04.settings || {}).settings_date || '',
  orders: arr(s04.orders).map(x => ({ output_id: x.output_id, kind: x.kind, dispatch_now: Boolean(x.dispatch_now), waits_for: x.waits_for || '', attempt: x.attempt || 0, frame: x.frame || '', ratio: x.ratio || '', size: x.size || '',
    prompt: x.dispatch_now ? x.prompt || '' : '', prompt_sha256: x.prompt_sha256 || '', references: arr(x.references).map(r => ({ n: r.n, role: r.role, name: r.name, sha256: r.sha256 })), planned_references: arr(x.planned_references) })),
  model: s04.model ? { model_id: s04.model.model_id, registry_status: s04.model.registry_status, price_date: s04.model.price_date } : null,
  reserve_usd: s04.reserve_usd || 0, reserve_basis: s04.reserve_basis || '',
  guard: s04.guard || null,
  operation: s04.op_row ? { operation_key: s04.op_row.operation_key, attempt: s04.op_row.attempt, model: s04.op_row.model, reserved_usd: s04.op_row.reserved_usd,
    status: op ? op.status : 'reserved', provider_request_id: op ? op.provider_request_id || '' : '', provider_status: op ? op.provider_status || '' : '', problem: op ? op.problem || '' : '',
    actual_usd: op && op.actual_usd !== undefined ? op.actual_usd : null, cost_basis: op ? op.cost_basis || '' : '', checks: s04.receipt ? s04.receipt.checks : 0, receipt_saved: receiptSaved } : null,
  candidate, paid_call: unmatched ? 'not confirmed' : paid ? 'yes, or may have been' : (refused ? 'refused before start; no charge expected (not confirmed)' : 'no'), notes: arr(s04.notes)
};
const scenePhase = s04.dispatch && s04.dispatch.scene ? s04.dispatch.scene.phase : '';
const what = scenePhase === 'room' ? 'The empty room for ' + s04.dispatch.scene.scene_output_id : (scenePhase ? 'Scene ' + s04.dispatch.scene.scene_output_id : 'The white master');
const costLine = ' Cost of this call: USD ' + (op && op.actual_usd !== undefined ? op.actual_usd : '?') + ' (' + (op ? op.cost_basis : '') + ').';
if (s04.outcome === 'candidate' && candidate && scenePhase === 'room') {
  // Stage 07: the empty room is a working image, not a deliverable. It goes straight to the placement; the placed scene is reviewed.
  st.status = 'scene_room_ready'; st.hold_reason = ''; st.client_question = ''; st.critical = []; st.hold_for = '';
  st.next = what + ' was made and saved in Google Drive. It is a working image (no product in it), not a deliverable. The product is placed into it next: one more paid image call.' + costLine;
} else if (s04.outcome === 'candidate' && candidate) {
  st.status = 'awaiting_review'; st.hold_reason = ''; st.client_question = ''; st.critical = []; st.hold_for = '';
  st.next = what + ' (attempt ' + (Number(s04.dispatch && s04.dispatch.attempt) || 1) + ') was made and saved in Google Drive. It is a candidate: not reviewed and not approved. Stage 05 reviews it next, then the owner\'s go 2.' + costLine;
  st.repair_orders = null; // used by this attempt
} else {
  const c = s04.critical[0] || { why: 'Stage 04 stopped without a recorded reason.' };
  st.status = 'hold'; st.hold_for = 'owner'; st.critical = s04.critical; st.hold_reason = c.why; st.client_question = ''; st.hold_step = s04.hold_step || 13;
  st.next = unmatched ? 'Waiting for the owner. It is not confirmed whether a paid image call was made for this dispatch; the operations table shows it. Nothing is sent again automatically.'
    : paid ? 'Waiting for the owner. A paid image call was made or may have been made (operation ' + s04.op_row.operation_key + '). Nothing is sent again automatically.'
    : (refused ? 'Waiting for the owner. A request was sent, and Google refused it before starting; no charge is expected (not confirmed). Nothing is sent again automatically.' : 'Waiting for the owner. No paid image call was made.');
}
st.stage = '04 Compile & dispatch';
st.vault_only = ['compile', 'operation', 'candidate', 'hold', 'status'];
st.trail = arr(S.trail).concat([
  { step: 13, name: 'Compile', at: s04.started_at || now, note: arr(s04.orders).length + ' orders; ' + (s04.dispatch ? 'attempt ' + s04.dispatch.attempt + ' sends ' + s04.dispatch.output_id : 'nothing to send') },
  { step: 14, name: 'Model', at: now, note: s04.model ? s04.model.model_id + ' (' + s04.model.registry_status + '), reserved USD ' + s04.reserve_usd : 'no model chosen' },
  { step: 15, name: 'Dispatch', at: now, note: op ? op.status : 'not reserved' }
]);
return [{ json: st }];
