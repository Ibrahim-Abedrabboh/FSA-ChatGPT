// Step 9 · Semantic grounding: settle conflicts, stamp contract version N, void older versions. Code after the classifier.
const crypto = require('crypto');
// P1.8 (16 Oct 2026): the replies are no longer simplified, so each call's token counts can be recorded. bodyOf picks the answer
// part of a reply (so an echoed instruction is never read as the answer); textCall records the provider's own token counts.
function bodyOf(o) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o.output)) return o.output;
  if (Array.isArray(o.candidates)) return o.candidates;
  if (o.content !== undefined) return o.content;
  if (o.message !== undefined) return o.message;
  return o;
}
function usageOf(o) {
  if (!o || typeof o !== 'object') return null;
  const u = o.usage || o.usageMetadata || (o.response && o.response.usage) || null;
  if (!u || typeof u !== 'object') return null;
  const n = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  if (u.promptTokenCount !== undefined || u.candidatesTokenCount !== undefined) return { input: n(u.promptTokenCount), output: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount) };
  if (u.input_tokens !== undefined || u.output_tokens !== undefined) return { input: n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens), output: n(u.output_tokens) };
  if (u.prompt_tokens !== undefined) return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
  return null;
}
function textCall(state, step, node, model, raw) {
  if (!raw) return state;
  const P = state.text_prices || {};
  const u = usageOf(raw);
  const pr = P.models && P.models[model] ? P.models[model] : null;
  const usd = u && pr ? Number(((u.input * pr.input + u.output * pr.output) / 1e6).toFixed(5)) : null;
  const e = raw.error ? (typeof raw.error === 'string' ? raw.error : String((raw.error && raw.error.message) || JSON.stringify(raw.error))).split('\n')[0].slice(0, 120) : '';
  const rec = { step, node, model, at: new Date().toISOString(), tokens: u, usd, error: e, basis: u ? (pr ? 'provider token counts x prices read ' + (P.read_on || '?') + ' (' + (pr.source || '') + '); an estimate, not an invoice' : 'provider token counts; no price recorded for this model') : 'the provider reported no token counts (the call may still be charged)' };
  state.text_calls = (Array.isArray(state.text_calls) ? state.text_calls : []).concat([rec]);
  state.text_calls_new = (Array.isArray(state.text_calls_new) ? state.text_calls_new : []).concat([rec]);
  return state;
}
// n8n may decode JSON-mode output_text.text into an object before this node sees it.
// Read only assistant answer content, never echoed instructions or reasoning metadata.
function classifierReply(raw) {
  if (!raw || raw.error) return { value: null, reason: 'provider_error' };
  if (raw.status && raw.status !== 'completed') return { value: null, reason: 'incomplete_response' };
  let parts = [];
  if (Array.isArray(raw.output)) {
    const messages = raw.output.filter(x => x && x.type === 'message' && x.role === 'assistant');
    if (messages.some(x => x.status && x.status !== 'completed')) return { value: null, reason: 'incomplete_response' };
    for (const message of messages) parts.push(...(Array.isArray(message.content) ? message.content : []));
  } else {
    const body = bodyOf(raw);
    if (typeof body === 'string') parts = [{ type: 'text', text: body }];
    else if (Array.isArray(body)) parts = body;
    else if (body && Array.isArray(body.content)) parts = body.content;
    else if (body && typeof body.content === 'string') parts = [{ type: 'text', text: body.content }];
    else if (body && Object.prototype.hasOwnProperty.call(body, 'instruction_locks')) parts = [{ type: 'output_text', text: body }];
  }
  if (parts.some(p => p && p.type === 'refusal')) return { value: null, reason: 'provider_refusal' };
  const answers = parts.filter(p => p && (p.type === 'output_text' || p.type === 'text'));
  const objects = answers.filter(p => p.text && typeof p.text === 'object' && !Array.isArray(p.text));
  let value = null;
  if (objects.length === 1 && answers.length === 1) value = objects[0].text;
  else if (answers.length && answers.every(p => typeof p.text === 'string')) {
    const text = answers.map(p => p.text).join('').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
    try { value = JSON.parse(text); } catch (e) { return { value: null, reason: 'unreadable_response' }; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value: null, reason: 'unreadable_response' };
  const string = v => typeof v === 'string' && v.trim().length > 0;
  const valid = Array.isArray(value.instruction_locks) && value.instruction_locks.length <= 40
    && value.instruction_locks.every(x => string(x) && x.length <= 200)
    && Array.isArray(value.conflicts) && value.conflicts.length <= 40
    && value.conflicts.every(x => x && string(x.topic) && typeof x.evidence_shows === 'string'
      && ['critical', 'minor'].includes(x.severity) && ['evidence_wins', 'client_wins', 'needs_owner'].includes(x.resolution) && string(x.reason))
    && typeof value.summary === 'string';
  return valid ? { value, reason: 'ok' } : { value: null, reason: 'invalid_schema' };
}
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v); }
const s = out('08 Locks and freedoms');
const ran = s.source_confirmation_bound || s.has_open_conflicts;
const preserved = s.source_confirmation_bound ? {output:[{type:'message',role:'assistant',content:[{type:'output_text',text:s.source_conflict_answer}]}]} : out('09 Conflict check');
const classification = ran ? classifierReply(preserved) : { value: null, reason: 'not_needed' };
const cls = classification.value;
const ledger = [];
const critical = [];
for (const c of s.conflicts) {
  if (c.severity !== 'to_classify') { ledger.push({ ...c, settled: 'yes', by: 'rule' }); continue; }
  const m = cls && Array.isArray(cls.conflicts) ? cls.conflicts.find(x => x && x.topic === c.topic && String(x.evidence_shows || '').slice(0, 40) === String(c.evidence_shows).slice(0, 40)) || cls.conflicts.find(x => x && x.topic === c.topic) : null;
  if (!m) { ledger.push({ ...c, severity: 'critical', resolution: 'needs_owner', reason: ran ? 'The conflict check did not answer for this conflict.' : 'Not classified.', settled: 'no' }); continue; }
  ledger.push({ ...c, severity: m.severity === 'critical' ? 'critical' : 'minor', resolution: m.resolution || 'needs_owner', reason: String(m.reason || '').slice(0, 300), settled: m.severity === 'critical' && m.resolution === 'needs_owner' ? 'no' : 'yes', by: 'gpt-6-luna' });
}
for (const l of ledger) if (l.severity === 'critical' && l.settled !== 'yes') critical.push({ what: l.topic, why: l.client_says ? 'Client says ' + l.client_says + '; photo shows ' + l.evidence_shows + '.' : l.evidence_shows });
const instructionLocks = cls && Array.isArray(cls.instruction_locks) ? cls.instruction_locks.map(x => String(x).slice(0, 200)) : [];
if (ran && !cls) critical.unshift({ what: 'instruction_processing', who: 'owner', why: 'A7 could not read a complete, valid instruction/conflict response (' + classification.reason + '). The original instructions are retained. No paid image was made.' });
const outputs = s.outputs.map(o => ({ ...o, locks: o.locks.concat(instructionLocks) }));

// Version: one more than any contract already recorded for this client job; older versions are voided.
const earlier = $('09a Find earlier contracts').all().map(i => i.json).filter(r => r && r.kind === 'contract');
const prev = earlier.reduce((m, r) => Math.max(m, Number(r.contract_version) || 0), 0);
const version = prev + 1;
const guidance = {"baseline_id":"a7-guidance-2026-10-17-v1","sha256":"d173694b13343173ba2a50e60c7797d9832af902a4555dc5a21bc6c4564455f9","reviewed_on":"2026-10-17","compliance":"partial","requirements":["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A13","A14","A15","A16","A17","A18","A19","A20","A21","A22","A23","A24","A25","A26"],"owner_overrides":["Owner-only access first","n8n replaces Magnific","Existing Go1 and Go2; no new Go3","Owner may approve exceptions, with truthful review labels","No automatic repair; maximum two per image","Confirmed Midas props and room shell only","Side views require supplied visual evidence","Keep current image model and private output routing"]};
const contract = {
  guidance,
  run_id: s.run_id, client_run_id: s.client_run_id, parent_run_id: s.parent_run_id || '', brief_version: s.brief.version, contract_version: version,
  profile: s.profile.id, gates: s.gates, outputs, inventory: s.inventory, exclusions: s.exclusions, facts: s.facts, unknowns: s.unknowns,
  conflict_ledger: ledger, room: s.observation.room, references: s.references.map(r => ({ key: r.key, name: r.name, role: r.role, sha256: r.sha256 })),
  cost_estimate: s.cost_estimate
};
const stamp = 'sha256:' + crypto.createHash('sha256').update(canon(contract)).digest('hex');
const now = new Date().toISOString();
const voided = earlier.map(r => ({ contract_version: Number(r.contract_version) || 0, contract_stamp: r.contract_stamp || '' })).filter(r => r.contract_version);
const QUESTIONS = { piece_count: 'Please confirm how many pieces the product has.', colour: 'Please confirm which colour should be shown.', selection: 'Please confirm which pieces belong to this job.', instructions: 'Please rewrite your instructions in short, simple points.' };
// P1.8: the token counts of the conflict check, when it ran.
const sTc = { text_prices: s.text_prices, text_calls: s.text_calls, text_calls_new: s.text_calls_new };
if (ran) textCall(sTc, 9, '09 Conflict check', 'gpt-6-luna', out('09 Conflict check'));
return [{ json: {
  ...s, text_calls: sTc.text_calls || [], text_calls_new: sTc.text_calls_new || [], outputs, conflict_ledger: ledger, critical: s.critical.concat(critical), contract, contract_version: version, contract_stamp: stamp, voided_contracts: voided,
  instruction_processing: { status: classification.reason },
  client_question: critical.some(c => c.who === 'owner') ? '' : (critical.length ? (QUESTIONS[critical[0].what] || 'Please check the product details.') : s.client_question),
  trail: s.trail.concat([{ step: 9, name: 'Contract', at: now, note: 'version ' + version + '; ' + ledger.length + ' conflicts, ' + critical.length + ' critical; ' + voided.length + ' older versions voided' }])
} }];
