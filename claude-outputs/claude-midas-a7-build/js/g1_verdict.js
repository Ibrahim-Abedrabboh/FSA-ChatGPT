// Go 1 · Verdict: read the owner's answer when the waiting run resumes. Code only.
// go → go 1 given; stage 04 then makes the white master (one paid call, only with an approved model and a Drive folder).
// change with field edits → the changed shots are checked again by the plan critic, then the owner is asked again.
// change with a note → the planner plans again with the note as data, then check, then the owner is asked again.
// stop → stopped. No answer in 24 hours → hold for the owner.
// An answer without this run's token, run id and round is ignored and the run waits again (at most 5 times, then hold),
// so a call to the waiting address cannot approve or end the run.
// The white master is fixed by the studio and never changed here. The product is never changed here.
function clean(v, n) { return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 600); }
const arr = v => (Array.isArray(v) ? v : []);
const MAX_CHANGE_ROUNDS = 3, MAX_IGNORED = 5;
const st = JSON.parse(JSON.stringify($('12 Who leads the scene').first().json));
let ignored = 0;
try { const prev = $('G1 Go 1 verdict').first().json; if (prev && prev.go1_route === 'rewait' && prev.go1_token === st.go1_token) ignored = prev.go1_ignored || 0; } catch (e) { ignored = 0; }
const got = $input.first() ? $input.first().json : null;
const body = got && got.body && typeof got.body === 'object' ? got.body : null;
const at = new Date().toISOString();
const decision = body ? clean(body.decision, 20).toLowerCase() : '';
const note = body ? clean(body.note, 1000) : '';
st.vault_only = ['plan', 'go1_ticket', 'go1_decision', 'hold', 'status']; // the brief, observation and contract are already in the vault
st.go1_rounds = st.go1_rounds || 0;
st.go1_ignored = ignored;
const rec = { round: st.go1_rounds, decision: decision || 'none', note, at, by: 'owner', changes: [], result: '' };
let route = 'end';
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = ''; st.hold_step = 12;
  st.critical = (st.critical || []).concat([{ what: 'go_1', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' No paid image was made.';
}
const genuine = body && st.go1_token && clean(body.go1_token, 80) === st.go1_token && clean(body.run_id, 90) === st.run_id && Number(body.round) === st.go1_rounds;
if (!body) hold('No go 1 answer arrived within 24 hours, so the run stopped. Send the job again to plan it afresh.');
else if (!genuine) {
  st.go1_ignored = ignored + 1;
  rec.decision = 'ignored'; rec.by = 'unknown caller'; // never recorded as the owner's decision
  if (st.go1_ignored > MAX_IGNORED) hold('More than ' + MAX_IGNORED + ' calls reached the waiting run without the decision address, so it stopped for safety. Send the job again.');
  else route = 'rewait';
}
else if (decision === 'go') {
  st.status = 'go_1_given';
  st.next = 'Go 1 given by the owner at ' + at + '. Stage 04 makes the white master next: compile, model and storage check, dispatch guard, then one paid image call.';
}
else if (decision === 'stop') {
  st.status = 'stopped_by_owner';
  st.next = 'Stopped by the owner at go 1 (' + at + '). No image was made or paid for.';
}
else if (decision === 'change') {
  // The decision address already checked these; they are checked again here because this run must not trust its input.
  const scene = st.shots.filter(x => x.kind !== 'white');
  if (st.go1_rounds >= MAX_CHANGE_ROUNDS) hold('The owner asked for changes ' + MAX_CHANGE_ROUNDS + ' times on this run. Send the job again with the new wishes.');
  else if (!scene.length) hold('This job has only the white master, which is fixed, so a change cannot be applied.');
  else {
    st.go1_rounds += 1;
    for (const ch of arr(body.changes).slice(0, 8)) {
      if (!ch || typeof ch !== 'object') continue;
      const shot = st.shots.find(x => x.n === Math.round(Number(ch.shot)) || (ch.output_id && x.output_id === ch.output_id));
      if (!shot) { rec.changes.push({ shot: clean(ch.shot || ch.output_id, 30), result: 'no such shot; ignored' }); continue; }
      if (shot.kind === 'white') { rec.changes.push({ shot: shot.n, result: 'the white master is fixed by the studio; not changed' }); continue; }
      const p = shot.plan; const fields = [];
      for (const k of ['setting', 'light', 'camera', 'presentation']) if (clean(ch[k])) { p[k] = clean(ch[k]); fields.push(k); }
      // 16 Oct 2026: a person only when the brief allows one (people "one"); the room fields; generic props are not used in scenes.
      if (typeof ch.person === 'string') { p.person = st.people_max === 1 ? clean(ch.person, 240) : ''; fields.push('person'); }
      if (ch.room && typeof ch.room === 'object') { p.room = p.room || {}; for (const k of ['walls', 'floor', 'windows', 'zone']) if (typeof ch.room[k] === 'string') p.room[k] = clean(ch.room[k], 160); fields.push('room'); }
      if (Array.isArray(ch.supporting_props)) { rec.changes.push({ shot: shot.n, result: 'supporting_props ignored: only Midas pieces appear in Studio scenes' }); }
      if (Array.isArray(ch.midas_pieces)) { p.midas_pieces = ch.midas_pieces.slice(0, 6).map(m => ({ sku: clean(m && m.sku, 20), count: Math.max(1, Math.min(2, Math.round(Number(m && m.count) || 1))), purpose: clean(m && m.purpose, 160), rests_on: clean(m && m.rests_on, 120) })); fields.push('midas_pieces'); }
      if (!fields.length) { rec.changes.push({ shot: shot.n, result: 'no field that can change was sent; ignored' }); continue; }
      shot.plan_ok = false; shot.check = null; shot.rewritten = 0; shot.owner_changed = (shot.owner_changed || 0) + 1;
      rec.changes.push({ shot: shot.n, result: 'changed: ' + fields.join(', ') + '; to be checked again' });
    }
    const changed = rec.changes.some(c => /^changed/.test(c.result));
    if (changed) { route = 'recheck'; st.rewrites_used = 0; st.critic_unread = 0; }
    else if (note) { route = 'replan'; st.owner_note = note; }
    else { st.go1_rounds -= 1; hold('The change request named no shot or field that can change, and had no note.'); }
    if (route !== 'end') { st.status = 'replanning'; st.next = 'The owner asked for changes; the plan is being ' + (route === 'recheck' ? 'checked again' : 'made again') + '. No paid image was made.'; }
  }
}
else hold('The go 1 answer was not go, change or stop.');
if (route === 'end') st.vault_only = ['go1_decision', 'hold', 'status']; // the plan and ticket are already in the vault
rec.result = route === 'end' ? st.status : route;
st.go1_route = route;
if (route !== 'rewait') {
  st.go1_last = rec;
  st.go1_log = (st.go1_log || []).concat([rec]);
}
st.trail = st.trail.concat([{ step: 12, name: 'Go 1', at, note: 'answer: ' + rec.decision + ' → ' + rec.result + (rec.changes.length ? '; ' + rec.changes.length + ' change(s)' : '') }]);
// The run row is written now (status, no resume address, no token), so a crash in a new plan never leaves it "waiting".
st.go1_row = { status: route === 'rewait' ? 'awaiting_go_1' : st.status, stage: st.stage, hold_reason: st.status === 'hold' ? st.hold_reason : '',
  go1_decision: rec.decision, go1_note: rec.note, go1_at: at, go1_rounds: st.go1_rounds };
return [{ json: st }];
