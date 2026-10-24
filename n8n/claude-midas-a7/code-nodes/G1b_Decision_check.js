// Go 1 and go 2 · Decision check (decision address). Code only. The address itself needs the owner header.
// It finds the run waiting for go 1 or go 2 under the job id and checks the answer before the waiting run is resumed.
// Go 2 (15 Oct 2026): approve, repair (with an optional note) or stop, for the round on the go 2 ticket; or the decisions the ticket lists.
// The answer must name the job id, the run id and the round shown on the ticket, so it can only answer the plan or image the owner saw.
// It never changes a plan: the waiting run applies the answer and checks it again.
function clean(v, n) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 600); }
function hostOf(url) { const s = String(url || ''); const a = s.indexOf('://'); if (a === -1) return ''; const rest = s.slice(a + 3); const b = rest.indexOf('/'); return (b === -1 ? rest : rest.slice(0, b)).toLowerCase(); }
const MAX_CHANGE_ROUNDS = 3;
// 16 Oct 2026: person and room can be edited at go 1 too; generic props are no longer used, so supporting_props is not a field to edit.
const FIELDS = ['setting', 'light', 'camera', 'presentation', 'person', 'room', 'midas_pieces'];
const hook = $('A7 owner decision webhook').first().json || {};
const body = hook.body && typeof hook.body === 'object' ? hook.body : {};
const id = clean(body.id, 90);
const runId = clean(body.run_id, 90);
const round = Number(body.round);
const decision = clean(body.decision, 20).toLowerCase();
const note = clean(body.note, 1000);
const changes = Array.isArray(body.changes) ? body.changes.slice(0, 8) : [];
const rows = $input.all().map(i => i.json).filter(r => r && r.client_run_id === id && (r.status === 'awaiting_go_1' || r.status === 'awaiting_go_2'));
const row = rows[0] || null;
const gate = row && row.status === 'awaiting_go_2' ? 'go2' : 'go1';
// Go 2 decisions come from the ticket (16 Oct 2026, D3): approve, repair, stop for a reviewed candidate; review_again or stop for one
// that was not reviewed; approve_unreviewed or stop after a review again that did not answer. Older rows: approve, repair, stop.
let go2Decisions = [];
try { const rvw = JSON.parse((row && row.review) || '{}'); go2Decisions = Array.isArray(rvw.go2_decisions) ? rvw.go2_decisions.map(x => clean(x, 30)) : []; } catch (e) {
  // Review finding 7: a review text cut at 60,000 characters is not valid JSON; the decisions are written first, so read them from the start.
  const mm = String((row && row.review) || '').match(/^\{"go2_decisions":(\[[^\]]*\])/);
  try { go2Decisions = mm ? JSON.parse(mm[1]).map(x => clean(x, 30)) : []; } catch (e2) { go2Decisions = []; }
}
const DECISIONS = gate === 'go2' ? (go2Decisions.length ? go2Decisions : ['approve', 'repair', 'stop']) : ['go', 'change', 'stop'];
const rowRound = row ? Number(gate === 'go2' ? row.go2_round : row.go1_rounds) || 0 : 0;
const rowToken = row ? String((gate === 'go2' ? row.go2_token : row.go1_token) || '') : '';
let outputs = [];
try { outputs = JSON.parse((row && row.required_outputs) || '[]'); } catch (e) { outputs = []; }
const scene = outputs.map((o, i) => ({ n: i + 1, id: o.id, kind: o.kind })).filter(o => o.kind !== 'white');
let problem = '', code = 400;
if (id.length < 8 || id.length > 80) problem = 'No valid job id was sent.';
else if (!runId || !Number.isInteger(round) || round < 0) problem = 'Send run_id and round exactly as shown on the ticket.';
else if (!row) { problem = 'No run is waiting for go 1 or go 2 under this job id. It may already have been answered, or it timed out.'; code = 409; }
else if (rows.length > 1) { problem = 'More than one run is waiting under this job id. Stop the older run in n8n first.'; code = 409; }
else if (DECISIONS.indexOf(decision) === -1) problem = 'This run is waiting for ' + (gate === 'go2' ? 'go 2' : 'go 1') + '; the decision must be ' + DECISIONS.join(', ') + '.';
else if (row.run_id !== runId || rowRound !== round) { problem = 'This answer is for another ' + (gate === 'go2' ? 'image' : 'plan') + ' (run ' + runId + ', round ' + round + '). Waiting now: run ' + row.run_id + ', round ' + rowRound + '. Read the newest ' + (gate === 'go2' ? 'go 2' : 'go 1') + ' ticket and answer again.'; code = 409; }
else if (gate === 'go2' && changes.length) problem = 'Go 2 takes no field edits. To correct the image, answer repair with a note.';
else if (gate === 'go2' && decision === 'repair' && round >= 3) { problem = 'The two repairs for this image are used. Answer approve or stop.'; code = 409; }
else if (decision === 'change') {
  if (Number(row.go1_rounds || 0) >= MAX_CHANGE_ROUNDS) problem = 'The ' + MAX_CHANGE_ROUNDS + ' change rounds for this run are used. Answer go or stop, or send the job again with the new wishes.';
  else if (!scene.length) problem = 'This job has only the white master, which is fixed by the studio, so there is nothing to change. Answer go or stop.';
  else if (!changes.length && !note) problem = 'A change needs field edits for at least one scene shot, or a note.';
  else if (changes.length && note) problem = 'Send either field edits or a note, not both: edits are checked again as they are, a note asks for a new plan.';
  else {
    for (const c of changes) {
      const n = c && typeof c === 'object' ? Math.round(Number(c.shot)) : NaN;
      const hit = scene.find(o => o.n === n || (c && c.output_id && o.id === c.output_id));
      if (!hit) { problem = 'Shot ' + clean(c && (c.shot || c.output_id), 30) + ' is not a scene shot of this job. Scene shots: ' + scene.map(o => o.n + ' (' + o.id + ')').join(', ') + '. The white master is fixed.'; break; }
      if (!FIELDS.some(k => k in c)) { problem = 'The change for shot ' + hit.n + ' names no field that can change (' + FIELDS.join(', ') + ').'; break; }
    }
  }
}
if (!problem && row) {
  const url = String(row.resume_url || '');
  const own = hostOf(hook.webhookUrl);
  if (!own || url.indexOf('https://') !== 0 || url.indexOf('/webhook-waiting/') === -1 || hostOf(url) !== own) { problem = 'The waiting run has no usable address to continue from.'; code = 409; }
  else if (!rowToken) { problem = 'The waiting run has no token, so it cannot be answered safely.'; code = 409; }
}
const at = new Date().toISOString();
return [{ json: {
  ok: problem ? 'no' : 'yes', id, run_id: runId, round, decision, gate, at, code: problem ? code : 200,
  resume_url: problem ? '' : row.resume_url,
  answer: problem ? null : (gate === 'go2' ? { decision, note, run_id: runId, round, go2_token: rowToken, at } : { decision, note, changes, run_id: runId, round, go1_token: rowToken, at }),
  reply: problem ? { forwarded: false, problem } : null
} }];
