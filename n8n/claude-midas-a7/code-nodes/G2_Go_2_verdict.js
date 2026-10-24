// Go 2 · Verdict: read the owner's answer when the waiting run resumes. Code only (15 Oct 2026).
// approve → the white master is approved by the owner (recorded here; the only place "approved" comes from).
// repair (with an optional note) → one more attempt, if a repair is left (at most two per image).
// stop → stopped. No answer in 24 hours → hold for the owner.
// An answer without this run's token, run id and round is ignored and the run waits again (at most 5 times, then hold).
// Phase 1 (owner, 16 Oct 2026, D3): a candidate that was not reviewed offers review_again (once per candidate image, i.e. per output and attempt: the review and the blind
// count of the stored image again, no image call) or stop; after a review again that also did not answer, approve_unreviewed or stop.
// approve_unreviewed is recorded as "approved by owner without an automated review" and never as a passed review.
// An answer that this ticket does not offer is ignored like an answer for another round (the decision address refuses it first).
function clean(v, n) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 600); }
const arr = v => (Array.isArray(v) ? v : []);
const MAX_ATTEMPT = 3, MAX_IGNORED = 5;
const st = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete st.events; delete st.row;
let ignored = 0;
try { const prev = $('G2 Go 2 verdict').first().json; if (prev && prev.go2_route === 'rewait' && prev.go2_token === st.go2_token) ignored = prev.go2_ignored || 0; } catch (e) { ignored = 0; }
const got = $input.first() ? $input.first().json : null;
const body = got && got.body && typeof got.body === 'object' ? got.body : null;
const at = new Date().toISOString();
const decision = body ? clean(body.decision, 20).toLowerCase() : '';
const note = body ? clean(body.note, 1000) : '';
const round = Number(st.go2_round) || 0;
const rec = { round, decision: decision || 'none', note, at, by: 'owner', result: '' };
let route = 'end';
st.go2_ignored = ignored;
const link = st.go2 && st.go2.candidate && st.go2.candidate.link ? ' Candidate: ' + st.go2.candidate.link : '';
// Stage 07 (16 Oct 2026): the same go 2 answers a placed scene. Its approval is recorded per scene; the white master's stays as it was.
const isScene = Boolean(st.go2 && st.go2.kind === 'scene');
const thing = isScene ? 'scene ' + st.go2.output_id : 'white master';
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = ''; st.hold_step = 17;
  st.critical = arr(st.critical).concat([{ what: 'go_2', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' Nothing is sent again automatically.' + link;
}
const allowed = Array.isArray(st.go2_allowed) && st.go2_allowed.length ? st.go2_allowed : ['approve', 'repair', 'stop'];
const WITHOUT = 'approved by owner without an automated review';
// Owner, 16 Oct 2026, 19:26: a white master approved by eye is shown as "Approved by the studio · not reviewed" in the manifest and the
// owner's view. The record above (approval_kind) stays as the audit wording.
const SHOWN_BY_EYE = 'Approved by the studio · not reviewed';
// Owner, 16 Oct 2026, 21:28: a scene approved by eye follows the same rule as the white master: "Approved by the studio · not reviewed"
// in the manifest and the owner's view; the client sees "Approved by the studio" (never "not reviewed").
const CLIENT_BY_EYE = 'Approved by the studio';
// An owner decision is scoped to these bytes and this frozen contract. It never turns a failed review into a pass.
function releaseFor(without) {
  const c = st.go2 && st.go2.candidate || {}, r = st.review || {};
  const bound = Boolean(r.candidate && r.candidate.sha256 === c.sha256 && r.output_id === st.go2.output_id && Number(r.attempt) === round);
  const passed = !without && bound && r.result === 'passed';
  const defects = arr(r.defects).map(x => clean(x.what || x.name || x, 300));
  const unknowns = arr(r.unsure).map(x => clean(x.evidence || x.name || x, 300));
  return { classification: passed ? 'reviewed_owner_approved' : 'owner_exception',
    label: passed ? 'Owner approved · review passed' : (without ? SHOWN_BY_EYE : 'Owner approved · review ' + clean(bound ? r.result : 'not bound to this candidate', 80)),
    catalogue_eligible: passed && Boolean(st.contract && st.contract.guidance && st.contract.guidance.compliance === 'verified'), allowed_use: passed ? 'Owner-approved reviewed output; full guidance qualification and package completion are checked separately.' : 'Owner exception only; not a verified catalogue release.',
    run_id: st.run_id, output_id: st.go2.output_id, candidate_sha256: c.sha256 || '', contract_stamp: st.contract_stamp || '',
    guidance: st.contract && st.contract.guidance || null, guidance_compliance: 'Not certified: open requirements remain in the versioned guidance checklist.', review_bound: bound, review_result: without ? 'not reviewed' : (bound ? r.result : 'unknown'), defects, unknowns, owner_note: note, at };
}
const genuine = body && st.go2_token && clean(body.go2_token, 80) === st.go2_token && clean(body.run_id, 90) === st.run_id && Number(body.round) === round;
if (!body) hold('No go 2 answer arrived within 24 hours, so the ' + thing + ' is held. It is not approved.');
else if (!genuine || allowed.indexOf(decision) === -1) {
  st.go2_ignored = ignored + 1;
  rec.decision = 'ignored'; rec.by = 'unknown caller'; // never recorded as the owner's decision
  if (st.go2_ignored > MAX_IGNORED) hold('More than ' + MAX_IGNORED + ' calls reached the waiting run without the decision address, so it stopped for safety. The ' + thing + ' is not approved.');
  else route = 'rewait';
}
else if (decision === 'review_again') {
  // Review again (D3): the same stored candidate goes back to 16a; no image call. Recorded so 16b allows it once per candidate image (output and attempt).
  st.review_again = { output_id: st.go2.output_id, attempt: round, ordered_at: at, by: 'owner', cost_shown: st.go2 && st.go2.review_again_cost ? st.go2.review_again_cost : null };
  st.status = 'awaiting_review'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
  st.next = 'The owner ordered one review again of the ' + thing + ' (attempt ' + round + ') at ' + at + ': the review and the blind count run again on the stored image. No image call.';
}
else if ((decision === 'approve' || decision === 'approve_unreviewed') && isScene) {
  const without = decision === 'approve_unreviewed';
  const release = releaseFor(without);
  const sc = st.scenes || { queue: [], done: {}, log: [] };
  sc.done = sc.done || {};
  sc.done[st.go2.output_id] = { attempt: round, by: 'owner', at, note, candidate: st.go2.candidate, release, contract_stamp: st.contract_stamp, review_result: without ? 'not reviewed' : (st.review ? st.review.result : 'unknown'), without_review: without, approval_kind: without ? WITHOUT : 'approved by the owner', shown_as: release.label, client_shown_as: without ? CLIENT_BY_EYE : 'Approved', props: st.scene ? arr(st.scene.props).map(p => ({ sku: p.sku, name: p.name, page: p.url, live: p.live || null })) : [], props_left_out: st.scene ? arr(st.scene.props_left_out) : [] };
  sc.log = arr(sc.log).concat([{ output_id: st.go2.output_id, event: without ? WITHOUT : 'approved by the owner', at }]);
  sc.current = null;
  st.scenes = sc; st.scene = null;
  st.status = 'scene_approved';
  st.next = 'The owner ' + (without ? 'approved scene ' + st.go2.output_id + ' by eye, without an automated review (shown as "' + SHOWN_BY_EYE + '"; the client sees "' + CLIENT_BY_EYE + '"),' : 'approved scene ' + st.go2.output_id) + ' (attempt ' + round + ') at ' + at + '. The next scene starts, if any is left.';
}
else if (decision === 'approve' || decision === 'approve_unreviewed') {
  const without = decision === 'approve_unreviewed';
  const release = releaseFor(without);
  st.status = 'white_master_approved';
  st.approved = { output_id: st.go2.output_id, attempt: round, by: 'owner', at, note, candidate: st.go2.candidate, release, contract_stamp: st.contract_stamp, review_result: without ? 'not reviewed' : (st.review ? st.review.result : 'unknown'), without_review: without, approval_kind: without ? WITHOUT : 'approved by the owner', shown_as: release.label, client_shown_as: without ? CLIENT_BY_EYE : 'Approved', product_box_2d: st.review && Array.isArray(st.review.product_box_2d) ? st.review.product_box_2d : null };
  st.next = 'The owner ' + (without ? 'approved the white master by eye, without an automated review (shown as "' + SHOWN_BY_EYE + '"; the client sees "' + CLIENT_BY_EYE + '"),' : 'approved the white master') + ' (attempt ' + round + ') at ' + at + '. Stage 06 makes the delivery package next (1125 x 1125 jpg and webp, resized from the master without AI, background set to 255 when the review gave a product box; without one, the master\'s own background is delivered and the package says so). Then stage 07 makes the scene images, one at a time, each with its own review and go 2.';
}
else if (decision === 'stop') {
  st.status = 'stopped_by_owner';
  st.next = 'Stopped by the owner at go 2 (' + at + '). The ' + thing + ' is not approved.' + (isScene ? ' Scenes approved before stay approved.' : '');
}
else if (decision === 'repair') {
  if (round >= MAX_ATTEMPT) hold('The owner asked for a repair, but the two repairs for this image are used. The ' + thing + ' is held; it is not approved.');
  else {
    const proposed = st.go2_proposed_repair || null;
    const obs = st.observation || {};
    const corr = arr(proposed && proposed.corrections).slice(0, 8);
    if (note) corr.push('The owner asks (a wish to apply to the product as the vendor photo shows it, never a new design): ' + note);
    if (!corr.length) hold('The owner asked for a repair, but the review found no problem to correct and no note was sent. Answer again with a note that says what to correct.');
    else {
      const preserve = proposed ? arr(proposed.preserve) : ['the exact inventory: ' + arr(st.inventory).map(x => x.count + ' x ' + x.item).join('; ')].concat(arr(obs.sided_parts).map(x => 'handedness: ' + (typeof x === 'string' ? x : (x && x.piece && x.side ? x.piece + ': ' + x.side : JSON.stringify(x)))));
      st.repair_orders = { [st.go2.output_id]: { attempt: round + 1, corrections: corr, preserve, by_owner_at: at } };
      st.status = 'repair_ordered'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
      st.next = 'The owner ordered repair ' + round + ' of 2 at ' + at + ': one more paid image call within the job budget, then a new review and go 2.';
      route = 'repair';
    }
  }
}
else hold('The go 2 answer was not one this ticket offers (' + allowed.join(', ') + ').');
if (genuine && allowed.includes(decision) && ['white_master_approved', 'scene_approved'].includes(st.status)) rec.release = (isScene ? st.scenes.done[st.go2.output_id] : st.approved).release;
rec.result = route === 'rewait' ? 'rewait' : st.status;
st.go2_route = route;
if (route !== 'rewait') {
  st.go2_last = rec;
  st.go2_log = arr(st.go2_log).concat([rec]);
  st.vault_only = ['go2_decision', 'repair_order', 'hold', 'status'];
}
st.stage = '05 Review & go 2';
st.trail = arr(st.trail).concat([{ step: 17, name: 'Go 2', at, note: 'answer: ' + rec.decision + ' → ' + rec.result }]);
return [{ json: st }];
