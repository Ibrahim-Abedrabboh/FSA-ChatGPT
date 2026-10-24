// Step 9 · Semantic grounding: settle conflicts, stamp contract version N, void older versions. Code after the classifier.
const crypto = require('crypto');
function deepText(o) {
  if (o === null || o === undefined) return '';
  if (typeof o === 'string') return o.indexOf('{') !== -1 ? o : '';
  if (Array.isArray(o)) { for (const x of o) { const t = deepText(x); if (t) return t; } return ''; }
  if (typeof o === 'object') { if (typeof o.text === 'string' && o.text.indexOf('{') !== -1) return o.text; for (const k of Object.keys(o)) { const t = deepText(o[k]); if (t) return t; } }
  return '';
}
function parse(t) { if (!t) return null; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v); }
const s = out('08 Locks and freedoms');
const ran = s.has_open_conflicts;
const cls = ran ? parse(deepText(out('09 Conflict check'))) : null;
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
if (s.brief.instructions && ran && !cls) critical.push({ what: 'instructions', why: 'The written instructions could not be turned into rules.' });
const outputs = s.outputs.map(o => ({ ...o, locks: o.locks.concat(instructionLocks) }));

// Version: one more than any contract already recorded for this client job; older versions are voided.
const earlier = $('09a Find earlier contracts').all().map(i => i.json).filter(r => r && r.kind === 'contract');
const prev = earlier.reduce((m, r) => Math.max(m, Number(r.contract_version) || 0), 0);
const version = prev + 1;
const contract = {
  run_id: s.run_id, client_run_id: s.client_run_id, parent_run_id: s.parent_run_id || '', brief_version: s.brief.version, contract_version: version,
  profile: s.profile.id, gates: s.gates, outputs, inventory: s.inventory, exclusions: s.exclusions, facts: s.facts, unknowns: s.unknowns,
  conflict_ledger: ledger, room: s.observation.room, references: s.references.map(r => ({ key: r.key, name: r.name, role: r.role, sha256: r.sha256 })),
  cost_estimate: s.cost_estimate
};
const stamp = 'sha256:' + crypto.createHash('sha256').update(canon(contract)).digest('hex');
const now = new Date().toISOString();
const voided = earlier.map(r => ({ contract_version: Number(r.contract_version) || 0, contract_stamp: r.contract_stamp || '' })).filter(r => r.contract_version);
const QUESTIONS = { piece_count: 'Please confirm how many pieces the product has.', colour: 'Please confirm which colour should be shown.', selection: 'Please confirm which pieces belong to this job.', instructions: 'Please rewrite your instructions in short, simple points.' };
return [{ json: {
  ...s, outputs, conflict_ledger: ledger, critical: s.critical.concat(critical), contract, contract_version: version, contract_stamp: stamp, voided_contracts: voided,
  client_question: critical.length ? (QUESTIONS[critical[0].what] || 'Please check the product details.') : s.client_question,
  trail: s.trail.concat([{ step: 9, name: 'Contract', at: now, note: 'version ' + version + '; ' + ledger.length + ' conflicts, ' + critical.length + ' critical; ' + voided.length + ' older versions voided' }])
} }];
