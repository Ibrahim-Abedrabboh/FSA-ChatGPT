// Stage 06 · Package result: the state that goes to the vault and the run row. Code only (16 Oct 2026).
// "white_package_ready" only when both images, the manifest and the identity entry are saved. Every other stop holds for the owner
// with the reason; an incomplete package is never called complete. This stage makes no AI call and no paid call.
const get = n => { try { return $(n).first().json; } catch (e) { return null; } };
const T = get('18a Package ticket');
const st = JSON.parse(JSON.stringify(T.st));
let pk = T.pk;
// Phase 1.2 (FL-4, review fix 22 Oct 2026): packaging can now run again in the same execution (after a deliver-as-exception or a
// repair), and a node that did not run on this pass still holds its earlier output. Only results made from this pass's ticket count.
const fresh = j => Boolean(j && j.pk && T.pk && j.pk.at === T.pk.at);
for (const n of ['18e Check master', '18e3 Clean background', '18h Check files', '18l Manifest', '18n Identity entry']) { const j = get(n); if (fresh(j)) pk = j.pk; }
pk = JSON.parse(JSON.stringify(pk));
const h18 = get('18h Check files'), h18fresh = fresh(h18) && h18.pk.files_ok === true;
const j18j = h18fresh ? get('18j Files to upload') : null;
if (j18j && j18j.skip) { pk.ok = false; pk.problem = j18j.problem; }
const n18 = fresh(get('18n Identity entry')) ? get('18n Identity entry') : null;
const saved18o = n18 ? get('18o Save identity') : null;
const inp = $input.first() ? $input.first().json : {};
const now = new Date().toISOString();
const arr = x => (Array.isArray(x) ? x : []);
let identity = null;
if (n18 && n18.entry_ready && saved18o) {
  const okRow = Boolean(inp && !inp.error && inp.identity_key === pk.identity_key && Number(inp.id) > 0 && Number(inp.package_version) === Number(pk.version));
  if (okRow) identity = { identity_key: pk.identity_key, row_id: Number(inp.id), package_version: pk.version, master_sha256: pk.master.sha256, manifest_sha256: pk.manifest_sha256 };
  else { pk.ok = false; pk.problem = 'The package is incomplete: the two images and the manifest are in Google Drive, but the identity vault entry could not be saved (' + String((inp && inp.error && (inp.error.message || inp.error)) || 'the table did not return the new row').slice(0, 200) + ').'; }
}
let ready = Boolean(identity && pk.ok !== false);
st.package = {
  outcome: ready ? 'white_package_ready' : 'hold', release: pk.approval && pk.approval.release || null, version: pk.version || null, identity_key: pk.identity_key, at: now,
  master: pk.master, master_check: pk.master_check || null, files: arr(pk.files), manifest: pk.manifest || null, manifest_sha256: pk.manifest_sha256 || '',
  method: pk.method || '', cost: pk.cost || null, spec_card: pk.spec_card, description: pk.description,
  approval_shown_as: pk.approval ? pk.approval.shown_as || '' : '', background_note: pk.background_note || '', skipped_steps: arr(pk.skipped_steps),
  accessories_used: [], not_in_package: arr(pk.not_in_package), notes: arr(pk.notes), problem: ready ? '' : (pk.problem || 'The package stopped without a recorded reason.'),
  white_clean: pk.white_clean || null, ai_or_paid_calls: 'none',
  owner_exception: ready && pk.owner_exception ? { problem: pk.owner_exception.problem, at: pk.owner_exception.at, note: pk.owner_exception.note, accepted: arr(pk.exceptions) } : null
};
st.identity = identity;
const sceneKinds = ['lifestyle', 'hero', 'wide', 'detail', 'composition', 'scene'];
const planned = arr(st.outputs), hasScenes = planned.some(o => sceneKinds.includes(o.kind));
const validHash = x => /^[0-9a-f]{64}$/.test(String(x || ''));
const release = pk.approval && pk.approval.release;
const matrix = planned.map(o => {
  const reasons = [];
  if (o.kind !== 'white') reasons.push('output has not been delivered');
  else {
    if (!ready) reasons.push(st.package.problem || 'white delivery not ready');
    if (!release || release.run_id !== st.run_id || release.output_id !== o.id || release.contract_stamp !== st.contract_stamp || release.candidate_sha256 !== (pk.master && pk.master.sha256)) reasons.push('owner approval is not bound to this output, image and contract');
    for (const format of ['jpg', 'webp']) { const f = arr(pk.files).find(f => f.format === format); if (!f || !f.drive_file_id || !validHash(f.sha256) || !(Number(f.bytes) > 0)) reasons.push(format + ' has no complete saved receipt'); }
    if (!pk.manifest || !pk.manifest.drive_file_id || !validHash(pk.manifest_sha256)) reasons.push('no saved manifest receipt');
  }
  return { output_id: o.id, kind: o.kind, complete: !reasons.length, classification: o.kind === 'white' && release ? release.classification : 'unapproved', catalogue_eligible: o.kind === 'white' && Boolean(release && release.catalogue_eligible), reasons };
});
const duplicateIds = new Set(planned.map(o => o.id)).size !== planned.length;
const complete = planned.length > 0 && !duplicateIds && matrix.every(o => o.complete);
st.package_release = { at: now, run_id: st.run_id, contract_stamp: st.contract_stamp, complete,
  classification: !complete ? 'incomplete' : (!pk.owner_exception && matrix.every(o => o.classification === 'reviewed_owner_approved') ? 'reviewed_owner_approved' : 'owner_exception'),
  catalogue_eligible: complete && !pk.owner_exception && matrix.every(o => o.catalogue_eligible), outputs: matrix,
  problems: [].concat(!planned.length ? ['no output plan recorded'] : [], duplicateIds ? ['duplicate output IDs'] : [], matrix.filter(o => !o.complete).map(o => o.output_id + ': ' + o.reasons.join('; '))) };
if (ready && !hasScenes && !complete) { ready = false; st.package.outcome = 'hold'; st.package.problem = 'Full package is incomplete: ' + st.package_release.problems.join(' | '); }

if (ready) {
  st.status = 'white_package_ready'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  const c = pk.cost && pk.cost.source === 'A7 retained budget ledger' ? 'Job history: USD ' + pk.cost.known_accounted_usd.toFixed(6) + ' accounted estimates plus USD ' + pk.cost.held_uncertain_usd.toFixed(6) + ' in unchanged uncertain reservations; USD ' + pk.cost.all_usd.toFixed(6) + ' total committed. Packaging adds USD 0 in AI charges. These are estimates and held amounts, not an invoice.' : pk.cost && pk.cost.usd !== null && pk.cost.usd !== undefined ? 'Image-call cost of this package: about USD ' + pk.cost.usd + ' (' + pk.cost.image_calls + ' call' + (pk.cost.image_calls === 1 ? '' : 's') + '; estimate, not an invoice). ' + (pk.cost.text_usd !== null && pk.cost.text_usd !== undefined ? 'Text and vision calls: about USD ' + pk.cost.text_usd + ' (' + pk.cost.text_basis + ').' : 'Text and vision calls: ' + (pk.cost.text_basis || 'not counted') + '.') : 'The cost could not be read.';
  // Owner, 16 Oct 2026, 19:26: a master approved by eye is shown as "Approved by the studio · not reviewed"; a package without the
  // clean-up says so, with each skipped step.
  const shown = pk.approval && pk.approval.without_review ? ' It is shown as "' + (pk.approval.shown_as || 'Approved by the studio · not reviewed') + '".' : '';
  const bg = pk.white_clean && pk.white_clean.skipped ? ' The background was not set to 255: ' + (pk.background_note || 'no product box') + '. Skipped: ' + arr(pk.skipped_steps).map(x => x.step + ' (' + x.why + ')').join('; ') + '.' : ' Background set to 255.' + (pk.white_clean && pk.white_clean.fit && pk.white_clean.fit.done ? ' The master was framed too tight to clean, so the files place it on a white canvas in code (no AI): the product spans ' + pk.white_clean.fit.span_after_pct + '% of the side instead of ' + pk.white_clean.fit.span_before_pct + '%. The approved master is unchanged.' : '');
  const again = arr(pk.files).filter(f => f.saved_again).map(f => ' The ' + f.format + ' was ' + f.saved_again + '.').join('')
    + (st.package.owner_exception ? ' Delivered as the owner\'s exception (go 2, ' + st.package.owner_exception.at + '): ' + st.package.owner_exception.accepted.join('; ') + '.' : '');
  st.next = 'Package v' + pk.version + ' of the owner-approved white master is in Google Drive: 1125 x 1125 jpg and webp (resized without AI), a manifest with the spec card and a draft description, and the identity vault entry. Each image is a "Generated image".' + shown + bg + again + ' ' + c + (arr(pk.not_in_package).length ? ' Not in this package: ' + pk.not_in_package.join('; ') + '.' : '');
} else if ((() => { const h = get('18h Check files'); const ap = st.approved; return Boolean(fresh(h) && h.pk.exception_possible === true && !pk.owner_exception && ap && ap.by === 'owner' && ap.candidate && ap.candidate.link); })()) {
  // Phase 1.2 (FL-4, owner, 22 Oct 2026): only the background rule failed, so the owner decides at go 2 instead of a dead end.
  const ap = st.approved, attempt = Number(ap.attempt) || 1, MAX_ATTEMPT = 3;
  const can = ['approve', 'stop'].concat(attempt < MAX_ATTEMPT ? ['repair'] : []);
  st.status = 'awaiting_go_2'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.go2_round = attempt; st.go2_token = require('crypto').randomBytes(16).toString('hex'); st.go2_allowed = can; st.go2_route = '';
  st.go2 = {
    for: 'owner', kind: 'package', output_id: ap.output_id, attempt, label: 'Generated image. Owner-approved white master; its package held.', decisions: can,
    problem: st.package.problem, candidate: ap.candidate, repairs_left: MAX_ATTEMPT - attempt,
    decision_needed: 'go 2 (package): the package of the approved white master held. ' + st.package.problem + ' Choose: approve to deliver as exception (the files are delivered as they are and recorded as your exception with this problem; no paid call; then the scenes), ' + (attempt < MAX_ATTEMPT ? 'repair to make a new image (repair ' + attempt + ' of 2: a paid image call, then a new review and go 2), ' : '') + 'or stop. Nothing is delivered until you answer.',
    answer_with: { id: st.client_run_id, run_id: st.run_id, round: attempt },
    how_to_answer: 'Send id, run_id and round exactly as in answer_with, plus decision ' + can.join(', ') + ', to the A7 decision address. The run waits 24 hours.',
    reminders: ['Delivering as exception never makes the package a reviewed catalogue release.', 'Nothing is repaired or delivered automatically.']
  };
  st.next = 'Waiting for the owner\'s go 2 on the package: ' + st.package.problem + ' The approved master is unchanged. No AI or paid call was made in this stage.';
} else {
  st.status = 'hold'; st.hold_for = 'owner'; st.client_question = ''; st.hold_step = 18; st.hold_reason = st.package.problem;
  st.critical = [{ what: 'package', who: 'owner', why: st.package.problem }];
  st.next = 'Waiting for the owner: ' + st.package.problem + ' The approved master is unchanged in Google Drive. No AI or paid call was made in this stage.';
}
st.stage = '06 Package';
st.vault_only = ['package', 'identity', 'package_release', 'hold', 'status', 'go2_ticket'];
st.trail = arr(st.trail).concat([{ step: 18, name: 'Package', at: now, note: ready ? 'v' + pk.version + ': jpg + webp + manifest + identity entry' : 'held: ' + String(st.package.problem).slice(0, 160) }]);
return [{ json: st }];