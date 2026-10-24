// Step 19 · Vault: every step writes an append-only event. Also prepares the run row.
const s = $input.first().json;
const now = new Date().toISOString();
const base = { run_id: s.run_id, client_run_id: s.client_run_id, brief_version: (s.brief && s.brief.version) || 1, contract_version: s.contract_version || 0, contract_stamp: s.contract_stamp || '', at: now };
const ev = [];
// After go 1 the brief, observation and contract are already in the vault: only the listed kinds are added again.
const only = Array.isArray(s.vault_only) ? s.vault_only : null;
function add(kind, stage, step, ref, payload, actor) { if (only && only.indexOf(kind) === -1) return; ev.push({ ...base, kind, stage, step, ref: ref || '', payload: JSON.stringify(payload).slice(0, 60000), actor: actor || 'code' }); }
add('brief', '01', 1, s.parent_run_id || '', s.brief);
for (const r of (s.references || [])) add('reference', '01', 2, r.sha256, r);
if (s.observation) add('observation', '01', 5, '', { observation: s.observation, inventory: s.inventory, exclusions: s.exclusions, facts: s.facts, unknowns: s.unknowns }, 'gemini-3.8-flash + claude-sonnet-5-5 + code');
if (s.conflict_ledger) add('conflict_ledger', '02', 9, '', s.conflict_ledger, 'gpt-6-luna + code');
if (s.contract) add('contract', '02', 9, s.contract_stamp, s.contract);
for (const v of (s.voided_contracts || [])) add('contract_voided', '02', 9, v.contract_stamp, { voided_version: v.contract_version, by_version: s.contract_version });
// Stage 03 events (15 Oct 2026). A plan is bound to the contract stamp in every event, so voiding a contract voids its plans.
if (s.retrieval) add('shortlist', '03', 10, s.contract_stamp || '', { shortlist: s.retrieval.shortlist.map(c => ({ sku: c.sku, name: c.name, kind: c.kind, availability: c.availability_text, read_on: c.retrieved_on, client_pick: Boolean(c.fixed) })), rejected: s.retrieval.rejected, notes: s.retrieval.notes });
if (s.plan_stage && s.shots) add('plan', '03', 11, s.contract_stamp || '', { lead: s.lead, rounds: s.plan_round || 0, rewrites_used: s.rewrites_used || 0, risks: s.plan_risks || [], shots: s.shots.map(x => ({ n: x.n, output_id: x.output_id, kind: x.kind, frame: x.frame, plan: x.plan, plan_ok: Boolean(x.plan_ok), rewritten: x.rewritten || 0, code_fixes: x.code_fixes || [], code_findings: x.code_findings || [], check: x.check || null, styling: x.styling ? { status: x.styling.status, score: x.styling.score, coverage: x.styling.coverage, score_label: x.styling.score_label, pillars: x.styling.pillars } : null })) }, 'gpt-6.1-sol + claude-sonnet-5-5 + code');
if (s.go1_last) add('go1_decision', '03', 12, s.contract_stamp || '', s.go1_last, s.go1_last.by || 'owner');
if (s.go1 && s.status === 'awaiting_go_1') add('go1_ticket', '03', 12, s.contract_stamp || '', s.go1);
// Stage 04 events (15 Oct 2026): what was compiled, the paid operation and its receipt, and the candidate image (never an approval).
if (s.stage04) {
  const g4 = s.stage04;
  add('compile', '04', 13, s.contract_stamp || '', { orders: g4.orders, settings_date: g4.settings_date, notes: g4.notes });
  if (g4.operation) add('operation', '04', 15, g4.operation.operation_key, { ...g4.operation, model: g4.model, reserve_basis: g4.reserve_basis, guard: g4.guard, paid_call: g4.paid_call });
  if (g4.candidate) add('candidate', '04', 15, g4.candidate.sha256, g4.candidate);
}
// Stage 05 events (15 Oct 2026): the review, a repair order, the go 2 ticket and the owner's go 2 answer. A review is never an approval.
const in05 = String(s.stage || '').indexOf('05') === 0;
if (in05 && s.review) add('review', '05', 16, (s.review.candidate && s.review.candidate.sha256) || '', s.review, s.review.readers || 'code');
if (s.status === 'repair_ordered' && s.repair_orders) add('repair_order', '05', 16, s.contract_stamp || '', s.repair_orders, s.go2_route === 'repair' ? 'owner' : 'code');
if (s.go2 && s.status === 'awaiting_go_2') add('go2_ticket', '05', 17, s.contract_stamp || '', s.go2);
if (s.go2_last) add('go2_decision', '05', 17, s.contract_stamp || '', s.go2_last, s.go2_last.by || 'owner');
// Stage 06 events (16 Oct 2026): the delivery package and its identity vault entry. A package is never an approval: approval is the owner's go 2.
const in06 = String(s.stage || '').indexOf('06') === 0;
if (in06 && s.package) add('package', '06', 18, s.package.manifest_sha256 || '', s.package);
if (in06 && s.identity) add('identity', '06', 18, s.identity.identity_key || '', s.identity);
// Stage 07 events (16 Oct 2026): the scene ticket (which scene, which phase, presets, the live prop check and the images sent).
const in07 = String(s.stage || '').indexOf('07') === 0;
// Edit phase 2.4 (19 Oct 2026): the approved image an edit starts from, as E2 checked it against the earlier run.
if (s.edit_base) add('edit_base', '07', 19, s.edit_base.sha256 || '', s.edit_base);
if (in07 && s.scene) add('scene_ticket', '07', 19, s.contract_stamp || '', { scene: s.scene, scenes_done: Object.keys((s.scenes && s.scenes.done) || {}), queue: (s.scenes && s.scenes.queue) || [] });
// Step 20 (16 Oct 2026): the delivery files of an approved scene (jpg and webp at its own shape, short side 1125 px, and a manifest).
if (in07 && s.scene_files) add('scene_files', '07', 20, s.scene_files.manifest_sha256 || '', s.scene_files);
if (s.package_release) add('package_release', in06 ? '06' : '07', in06 ? 18 : 19, s.contract_stamp || '', s.package_release);
const st = in07 ? '07' : in06 ? '06' : in05 ? '05' : (s.stage04 ? '04' : (s.plan_stage ? '03' : (s.contract ? '02' : '01')));
const sp = in07 ? (s.scene_files || (s.status === 'hold' && s.hold_step === 20) ? 20 : 19) : in06 ? 18 : in05 ? (s.status === 'hold' ? (s.hold_step || 16) : (s.status === 'awaiting_go_2' || s.go2_last ? 17 : 16)) : s.stage04 ? (s.status === 'hold' ? (s.hold_step || 15) : 15) : (s.plan_stage ? (s.status === 'hold' ? (s.hold_step || 10) : 12) : (s.contract ? 9 : 5));
// P1.8 (16 Oct 2026): the token counts of each text and vision call since the last vault write. Always written, whatever vault_only says.
for (const c of (Array.isArray(s.text_calls_new) ? s.text_calls_new : [])) ev.push({ ...base, kind: 'text_call', stage: st, step: Number(c.step) || sp, ref: String(c.node || ''), payload: JSON.stringify(c).slice(0, 60000), actor: String(c.model || 'code') });
if (s.status === 'hold') add('hold', st, sp, '', { reason: s.hold_reason, hold_for: s.hold_for || 'client', question: s.client_question, critical: s.critical });
add('status', st, sp, '', { status: s.status, next: s.next });
return [{ json: { ...s, text_calls_new: [], events: ev,
  row: { status: s.status, stage: s.stage, hold_reason: s.hold_reason || '', client_question: s.client_question || '',
    contract_version: s.contract_version || 0, contract_stamp: s.contract_stamp || '',
    required_outputs: JSON.stringify((s.outputs || (s.brief && s.brief.outputs) || []).map(o => ({ id: o.id, kind: o.kind, mode: o.mode || '' }))),
    references: JSON.stringify((s.references || []).map(r => ({ name: r.name, role: r.role, sha256: r.sha256, bytes: r.bytes, stored: r.stored }))),
    observation: JSON.stringify(s.observation || {}).slice(0, 60000), contract: JSON.stringify(s.contract || {}).slice(0, 60000),
    not_applied: JSON.stringify(s.not_applied || []), cost_estimate: JSON.stringify(s.cost_estimate || {}), trail: JSON.stringify(s.trail || []),
    // Go 1: where the waiting run continues, and the owner's last answer.
    resume_url: s.status === 'awaiting_go_1' || s.status === 'awaiting_go_2' ? String($execution.resumeUrl || '') : '', go1_token: s.status === 'awaiting_go_1' ? (s.go1_token || '') : '',
    go1_decision: s.go1_last ? s.go1_last.decision : '', go1_note: s.go1_last ? s.go1_last.note : '', go1_at: s.go1_last ? s.go1_last.at : '', go1_rounds: s.go1_rounds || 0,
    // Stage 04: orders (prompts left out; they are in the vault and the operations table), operation, candidate.
    stage04: s.stage04 ? JSON.stringify({ ...s.stage04, orders: (Array.isArray(s.stage04.orders) ? s.stage04.orders : []).map(o => ({ ...o, prompt: undefined })) }).slice(0, 60000) : '',
    // Stage 05: the latest review, the go 2 token (run row only, never the vault) and the owner's last go 2 answer.
    // Review finding 7 (16 Oct 2026): go2_decisions first, so a cut at 60,000 characters never drops them (G1b also reads them from a cut text).
    review: s.review ? JSON.stringify({ go2_decisions: s.status === 'awaiting_go_2' && Array.isArray(s.go2_allowed) ? s.go2_allowed : [], attempt: s.review.attempt, result: s.review.result, counts: s.review.counts, defects: s.review.defects, unsure: s.review.unsure, notes_only: s.review.notes_only || [], scores: s.review.scores, score_label: s.review.score_label, candidate: s.review.candidate, log: s.review_log || [] }).slice(0, 60000) : '',
    go2_token: s.status === 'awaiting_go_2' ? (s.go2_token || '') : '', go2_round: Number(s.go2_round) || 0,
    go2_decision: s.go2_last ? s.go2_last.decision : '', go2_note: s.go2_last ? s.go2_last.note : '', go2_at: s.go2_last ? s.go2_last.at : '',
    // Stage 06: the delivery package (files, checksums, manifest, cost), or why it is held.
    package: s.package ? JSON.stringify(s.package).slice(0, 60000) : '',
    // Stage 07: the scenes done (owner-approved), the one in progress, and the log.
    scenes: s.scenes ? JSON.stringify({ queue: s.scenes.queue, done: s.scenes.done, current: s.scenes.current ? { output_id: s.scenes.current.output_id, phase: s.scenes.current.phase, attempt: s.scenes.current.attempt, props: (s.scenes.current.props || []).map(p => p.sku), props_left_out: s.scenes.current.props_left_out || [] } : null, log: s.scenes.log,
      // Edit phase 2.4: an edit run has no white master package of its own; the inherited master is kept here so an edit of this edit can use it.
      ...(s.scenes.edit_base && s.approved && s.approved.candidate ? { edit_base: { run_id: s.scenes.edit_base.run_id, output_id: s.scenes.edit_base.output_id, sha256: s.scenes.edit_base.candidate.sha256, master: { output_id: s.approved.output_id, attempt: s.approved.attempt, ...s.approved.candidate } } }
        // Scenes from an approved white image (20 Oct 2026): the run has no package of its own either; its inherited white master is kept the same way.
        : s.approved && s.approved.inherited_from && s.approved.inherited_from.kind === 'white' && s.approved.candidate ? { edit_base: { run_id: s.approved.inherited_from.run_id, output_id: 'white_master', sha256: s.approved.candidate.sha256, master: { output_id: s.approved.output_id, attempt: s.approved.attempt, ...s.approved.candidate } } } : {}) }).slice(0, 60000) : '' } } }];
