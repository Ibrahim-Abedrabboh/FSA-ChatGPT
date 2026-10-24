"""Adds the studio team's Go / Stop panel to the A6 client page (14 Oct 2026).
Run: python3 -I patch_owner_go.py <src folder>. Every replacement must match exactly once."""
import sys, pathlib

src = pathlib.Path(sys.argv[1])

def patch(name, pairs):
    path = src / name
    text = path.read_text(encoding='utf-8')
    for old, new in pairs:
        count = text.count(old)
        if count != 1:
            sys.exit(f'{name}: expected 1 match, found {count}: {old[:80]!r}')
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')
    print(f'{name}: {len(pairs)} change(s)')

# ------------------------------------------------------------------ app.js
patch('app.js', [
# header note
("""   because A6 has it switched off; client wording has no internal or provider names.
""",
"""   because A6 has it switched off; client wording has no internal or provider names.
   14 Oct 2026, owner go: while a request waits, the studio team can give the go or stop it from the
   waiting view. That uses the OWNER key, a different key from the studio key; it is read from its own
   field for one call and the field is then cleared. It is never stored, put in an address or logged here.
"""),
# config
("""  fileUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-file',
""",
"""  fileUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-file',
  /* The studio team's go or stop for a waiting request. Accepts the OWNER key only. */
  decisionUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-decision',
"""),
# strings: owner go block, before the mock strings
("""  mock: {
    title: 'Mock mode: no request is sent.',
    signin: 'Sign-in', submit: 'Submission', result: 'Result', regen: 'Re-generate',
""",
"""  ownerGo: {
    summary: 'For the Midas studio team: give the go',
    lead: 'Check the plan, then give the go or stop the request. Images are made only after a go. This needs the owner key, not the studio key. The key is used for this one answer and is not kept.',
    firstTitle: 'First go: the plan',
    masterTitle: 'Second go: the white catalogue image',
    product: 'Product', inventory: 'Read from the photo', unknowns: 'Not confirmed', file: 'Photo sent',
    shotTitle: 'Image {n} · {role} · {frame}',
    setting: 'Setting', light: 'Light', presentation: 'Arrangement', props: 'Props',
    noPlan: 'The plan could not be shown here. You can still give the go or stop.',
    masterLead: 'The white catalogue image passed the automatic review. That makes it a reviewed candidate, not an approval.',
    masterNext: 'A go makes the other images: at least {n}.',
    masterMissing: 'The white catalogue image could not be shown here.',
    generated: 'Generated image',
    imageAlt: 'White catalogue image made for this request. Generated image.',
    keyLabel: 'Owner key',
    noteLabel: 'Note (optional)',
    go: 'Give the go', stop: 'Stop this request', confirmStop: 'Press again to stop',
    busy: 'Sending…',
    armedStop: 'Press "Press again to stop" within 8 seconds to stop. Nothing more is made for this request after a stop.',
    needKey: 'Enter the owner key.',
    sentGo: 'Go recorded at {time}. This page keeps checking.',
    sentStop: 'Stop recorded at {time}. Nothing more is made for this request.',
    refused: 'The owner key was refused. Nothing was recorded. The studio key does not work here.',
    network: 'The studio could not be reached. Nothing was recorded. Check your connection and try again.',
    problem: 'Not recorded: {problem}',
    unknown: 'The studio did not confirm the answer. Check the request again before trying once more.',
    roles: { catalogue: 'catalogue on white', lifestyle: 'lifestyle scene', base: 'base scene', variation: 'variation', hero: 'hero', wide: 'wide view', detail: 'detail', view: 'other view on white' },
    frames: { '1:1': 'square', '4:5': 'portrait 4:5', '16:9': 'landscape 16:9', '3:2': 'landscape 3:2', '2:3': 'portrait 2:3' }
  },
  mock: {
    title: 'Mock mode: no request is sent.',
    signin: 'Sign-in', submit: 'Submission', result: 'Result', regen: 'Re-generate', decision: 'Owner go',
    decisionOptions: { accepted: 'Recorded', denied: 'Owner key refused', problem: 'Not recorded (problem)', network: 'Network failure' },
"""),
("""signedout: 'Key refused mid-run', unreachable: 'Address unreachable', waitgo: 'Waits for a go, then all passed'""",
 """signedout: 'Key refused mid-run', unreachable: 'Address unreachable', waitgo: 'Waits for one go, then all passed', waitgo2: 'Waits for two goes, then all passed'"""),
# network: a per-call key for the owner go
("""  async function call(method, url, options) {
    const init = Object.assign({ method, cache: 'no-store' }, options || {});
    init.headers = Object.assign({}, init.headers, { [STUDIO_CONFIG.keyHeader]: ownerKey });""",
"""  async function call(method, url, options) {
    const opts = Object.assign({}, options || {});
    const key = typeof opts.key === 'string' ? opts.key : ownerKey;   // the owner go passes its own key for one call
    delete opts.key;
    const init = Object.assign({ method, cache: 'no-store' }, opts);
    init.headers = Object.assign({}, init.headers, { [STUDIO_CONFIG.keyHeader]: key });"""),
("""    status: id => call('GET', withQuery(STUDIO_CONFIG.statusUrl, { id })),
    /* Makes held images""",
"""    status: id => call('GET', withQuery(STUDIO_CONFIG.statusUrl, { id })),
    /* The studio team's go or stop for a waiting request, sent with the OWNER key given for this call only. */
    decide: (id, decision, note, key) => call('POST', STUDIO_CONFIG.decisionUrl, { key, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note ? { id, decision, note } : { id, decision }) }),
    /* Makes held images"""),
# mock state
("""regen: params.get('regen') || 'accepted', jobs: new Map(), checks: new Map() };""",
 """regen: params.get('regen') || 'accepted', decision: params.get('decision') || 'accepted', jobs: new Map(), checks: new Map(), gates: new Map() };"""),
("""    let scenario = job.regenOf || mockState.result === 'waitgo' ? 'passed' : mockState.result;""",
 """    let scenario = job.regenOf || mockState.result === 'waitgo' || mockState.result === 'waitgo2' ? 'passed' : mockState.result;"""),
# mock status: wait until the go is given in the page
("""      if (s === 'waitgo' && seen < 5) return later({ status: 200, data: { found: true, state: 'awaiting_go', run_id: 'va6-mock', plan: null, summary: '' } });
""",
"""      if (s === 'waitgo' || s === 'waitgo2') {                      // waits until a go or a stop is given in the page
        const gate = mockGate(id), need = s === 'waitgo2' ? 2 : 1;
        if (gate.stopped) return later({ status: 200, data: { found: true, state: 'stopped', run_id: 'va6-mock', plan: null, summary: '', answered_at: gate.at } });
        if (gate.goes > 0 && gate.since < 2) { gate.since += 1; return later({ status: 200, data: { found: true, state: 'started', run_id: 'va6-mock', plan: null, summary: '' } }); }
        if (gate.goes < need) {
          const master = gate.goes > 0;
          return later({ status: 200, data: {
            found: true, state: 'awaiting_go', run_id: 'va6-mock', product_file: mockJob(id).file,
            plan: master ? mockMasterPlan() : mockPlan(id, need === 2),
            summary: master ? 'The white master passed the automatic review. 2 other image(s) are made only after a second go.' : '3 image(s) planned, at most 6 with repairs. Nothing is rendered until a go is given.',
            asked_at: master ? gate.masterAt : gate.planAt, answered_at: '' } });
        }
      }
"""),
("""  const mock = {
    signIn: () => {""",
"""  function mockGate(id) {
    if (!mockState.gates.has(id)) mockState.gates.set(id, { goes: 0, stopped: false, since: 0, at: '', planAt: new Date().toISOString(), masterAt: '' });
    return mockState.gates.get(id);
  }
  function mockPlan(id, twoStops) {
    const job = mockJob(id);
    const shots = [{ shot: 1, role: 'catalogue', frame: '1:1', setting: 'Pure white seamless studio background and clean white floor, the product alone, with no props.', light: 'Soft, even studio light.', presentation: 'The complete product as arranged in the photo, every piece visible and countable.', supporting_props: [] }];
    for (let n = 2; n <= Math.max(2, job.total); n += 1) shots.push({ shot: n, role: 'lifestyle', frame: '16:9', setting: 'A calm living room with sand walls and a dark walnut floor.', light: 'Warm evening light from a window out of frame.', presentation: 'The pieces stand as in the photo, every piece visible.', supporting_props: ['a ceramic bowl', 'a closed book'] });
    return {
      run_id: 'va6-mock', product: 'Sofas / Sofa Sets', product_file: job.file, outcome: job.outcome,
      inventory: ['2 x sofa', '2 x armchair'], shots,
      stops: twoStops ? 'This go covers the white catalogue master. The run stops again and asks for a second go before the other image(s).' : '',
      contract: { unknowns: ['back side of each piece', 'exact dimensions'] }
    };
  }
  function mockMasterPlan() {
    return { run_id: 'va6-mock', waiting_for: 'a go for the other images, after the white catalogue master', master: { shot: 1, image_url: mockPicture(), images_made: 1 }, to_come: { image_renders: { at_least: 2, at_most: 6 } } };
  }
  const mock = {
    signIn: () => {"""),
("""    regenerate: (id, newRunId, shot) => {
      const s = mockState.regen;""",
"""    decide: (id, decision, note, key) => {
      const s = mockState.decision;
      mockState.lastDecision = { id, decision, note, keySent: typeof key === 'string' && key.length > 0 };   // what would have been sent, without the key itself
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefused());
      if (s === 'problem') return later({ status: 200, data: { saved: false, problem: 'No run is waiting for a go under this job id. It may already have been answered.' } });
      const gate = mockGate(id), at = new Date().toISOString();
      if (decision === 'stop') { gate.stopped = true; gate.at = at; }
      else { gate.goes += 1; gate.since = 0; gate.masterAt = new Date(Date.now() + 1).toISOString(); }
      return later({ status: 200, data: { saved: true, decision, decided_at: at } });
    },
    regenerate: (id, newRunId, shot) => {
      const s = mockState.regen;"""),
# reload while waiting: check at once, so the go panel is there without a minute's wait
("""      state.run = pending;
      setStage('progress');
      startWatching(false);""",
"""      state.run = pending;
      setStage('progress');
      startWatching(pending.waiting === true);         // waiting for a go: check at once, so the go panel shows without delay"""),
# progress: hide the panel outside the waiting state
("""    setTimeline('is-done', 'is-now', 'is-waiting');
    show($('progress-message'), false);
    updateElapsed();
  }""",
"""    setTimeline('is-done', 'is-now', 'is-waiting');
    show($('progress-message'), false);
    if (!waiting) clearOwnerGo();
    updateElapsed();
  }"""),
("""      if (first) { renderProgress(); announce(t('progress.announceWaiting')); }
      scheduleCheck(false);
      return;
    }
    if (run.waiting === true)""",
"""      if (first) { renderProgress(); announce(t('progress.announceWaiting')); }
      updateOwnerGo(data);
      scheduleCheck(false);
      return;
    }
    clearOwnerGo();
    if (run.waiting === true)"""),
("""  function finishRun(data) {
    stopWatching();""",
"""  function finishRun(data) {
    stopWatching();
    clearOwnerGo();"""),
("""  function showEnded(status, text, title, tag) {
    const run = state.run;
    stopWatching();""",
"""  function showEnded(status, text, title, tag) {
    const run = state.run;
    stopWatching();
    clearOwnerGo();"""),
# the owner go panel itself, placed before the results section
("""  /* ------------------------------------------------------------------ results */""",
"""  /* ------------------------------------------------------------------ owner go (studio team only)
     While a request waits, the studio team answers it here. The panel shows what the go pays for:
     the plan at the first stop, the white catalogue image at the second. It needs the OWNER key,
     which is read from its field for one call; the field is cleared after every attempt. */
  const gate = { shown: '', sending: false, armed: false, armTimer: 0 };
  const listText = value => (Array.isArray(value) ? value.map(String).filter(Boolean).join('; ') : '');
  function gateKey(data) {
    const plan = data && data.plan && typeof data.plan === 'object' ? data.plan : null;
    return [plan && plan.waiting_for ? 'master' : 'plan', data.run_id || '', data.asked_at || ''].join('|');
  }
  function disarmStop() {
    gate.armed = false; window.clearTimeout(gate.armTimer);
    $('owner-stop-btn').textContent = t('ownerGo.stop');
  }
  function ownerMessage(text, isError) {
    const box = $('owner-go-message');
    box.textContent = text;
    box.classList.toggle('notice--error', !!isError);
    show(box, !!text);
    if (text) announce(text);
  }
  function clearOwnerGo() {
    gate.shown = '';
    disarmStop();
    $('owner-key').value = '';
    show($('owner-go'), false);
  }
  function planRow(label, value) {
    return value ? el('div', { class: 'ownergo__row' }, el('dt', { text: label }), el('dd', { text: value })) : null;
  }
  function renderPlan(data) {
    const plan = data.plan && typeof data.plan === 'object' ? data.plan : null;
    const nodes = [];
    if (plan && plan.waiting_for) {
      const master = plan.master && typeof plan.master === 'object' ? plan.master : {};
      const src = safeImageUrl(master.image_url);
      const next = plan.to_come && plan.to_come.image_renders ? Number(plan.to_come.image_renders.at_least) : 0;
      nodes.push(el('h4', { class: 'ownergo__title', text: t('ownerGo.masterTitle') }));
      nodes.push(src
        ? el('figure', { class: 'shot__fig ownergo__fig' }, el('img', { src, alt: t('ownerGo.imageAlt'), loading: 'lazy', referrerpolicy: 'no-referrer' }), el('span', { class: 'tag', text: t('ownerGo.generated') }))
        : el('p', { class: 'hint', text: t('ownerGo.masterMissing') }));
      nodes.push(el('p', { text: t('ownerGo.masterLead') }));
      if (next > 0) nodes.push(el('p', { text: t('ownerGo.masterNext', { n: next }) }));
      return nodes;
    }
    nodes.push(el('h4', { class: 'ownergo__title', text: t('ownerGo.firstTitle') }));
    if (data.summary) nodes.push(el('p', { text: String(data.summary) }));
    if (!plan) { nodes.push(el('p', { class: 'hint', text: t('ownerGo.noPlan') })); return nodes; }
    const unknowns = plan.contract && typeof plan.contract === 'object' ? plan.contract.unknowns : null;
    nodes.push(el('dl', { class: 'ownergo__facts' },
      planRow(t('ownerGo.product'), plan.product ? String(plan.product) : ''),
      planRow(t('ownerGo.inventory'), listText(plan.inventory)),
      planRow(t('ownerGo.unknowns'), listText(unknowns)),
      planRow(t('ownerGo.file'), plan.product_file ? String(plan.product_file) : '')));
    const shots = Array.isArray(plan.shots) ? plan.shots : [];
    if (shots.length) {
      nodes.push(el('ol', { class: 'ownergo__shots', role: 'list' }, ...shots.map((shot, i) => {
        const s = shot && typeof shot === 'object' ? shot : {};
        const frame = STRINGS.ownerGo.frames[s.frame] || String(s.frame || '');
        return el('li', { class: 'ownergo__shot' },
          el('strong', { text: t('ownerGo.shotTitle', { n: s.shot || i + 1, role: STRINGS.ownerGo.roles[s.role] || String(s.role || ''), frame }) }),
          el('dl', {},
            planRow(t('ownerGo.setting'), s.setting ? String(s.setting) : ''),
            planRow(t('ownerGo.light'), s.light ? String(s.light) : ''),
            planRow(t('ownerGo.presentation'), s.presentation ? String(s.presentation) : ''),
            planRow(t('ownerGo.props'), listText(s.supporting_props))));
      })));
    }
    if (plan.stops) nodes.push(el('p', { class: 'ownergo__stops', text: String(plan.stops) }));
    return nodes;
  }
  function updateOwnerGo(data) {
    const key = gateKey(data);
    if (key === gate.shown) return;                      // the same stop as before: keep what the owner is reading or typing
    gate.shown = key;
    disarmStop();
    $('owner-go-plan').replaceChildren(...renderPlan(data));
    show($('owner-go-form'), true);
    ownerMessage('', false);
    show($('owner-go'), true);
  }
  function setOwnerBusy(busy) {
    gate.sending = busy;
    ['owner-go-btn', 'owner-stop-btn'].forEach(id => { $(id).disabled = busy; $(id).classList.toggle('is-busy', busy); });
    $('owner-go-btn').textContent = busy ? t('ownerGo.busy') : t('ownerGo.go');
    if (!busy) disarmStop();
  }
  async function sendDecision(decision) {
    const run = state.run;
    if (!run || gate.sending) return;
    const input = $('owner-key');
    const key = input.value.trim();
    if (!key) { ownerMessage(t('ownerGo.needKey'), true); focusNode(input); return; }
    if (/[^\\x20-\\x7E]/.test(key)) { ownerMessage(t('signin.badChars'), true); focusNode(input); return; }
    if (decision === 'stop' && !gate.armed) {            // a stop ends the request: ask for a second press
      gate.armed = true;
      $('owner-stop-btn').textContent = t('ownerGo.confirmStop');
      ownerMessage(t('ownerGo.armedStop'), false);
      window.clearTimeout(gate.armTimer);
      gate.armTimer = window.setTimeout(() => { disarmStop(); ownerMessage('', false); }, 8000);
      return;
    }
    setOwnerBusy(true);
    ownerMessage('', false);
    const note = $('owner-note').value.trim().slice(0, 500);
    const res = await api.decide(run.id, decision, note, key);
    input.value = '';                                    // the owner key is used for this one call only
    setOwnerBusy(false);
    if (!res || res.network) { ownerMessage(t('ownerGo.network'), true); return; }
    if (res.status === 401 || res.status === 403) { ownerMessage(t('ownerGo.refused'), true); focusNode(input); return; }
    const data = res.data && typeof res.data === 'object' ? res.data : null;
    if (data && data.saved === true) {
      $('owner-note').value = '';
      show($('owner-go-form'), false);
      ownerMessage(t(decision === 'stop' ? 'ownerGo.sentStop' : 'ownerGo.sentGo', { time: timeText(Date.parse(data.decided_at) || Date.now()) }), false);
      if (state.run === run && !watch.stopped) scheduleCheck(true);   // read the new state at once
      return;
    }
    ownerMessage(data && data.problem ? t('ownerGo.problem', { problem: String(data.problem) }) : t('ownerGo.unknown'), true);
  }

  /* ------------------------------------------------------------------ results */"""),
# mock bar: the owner go select
("""['mock-regen', 'regen', STRINGS.mock.regenOptions]].forEach""",
 """['mock-regen', 'regen', STRINGS.mock.regenOptions], ['mock-decision', 'decision', STRINGS.mock.decisionOptions]].forEach"""),
# events
("""    $('progress-retry').addEventListener('click', () => { if (state.run) startWatching(true); });
""",
"""    $('progress-retry').addEventListener('click', () => { if (state.run) startWatching(true); });
    $('owner-go-btn').addEventListener('click', () => sendDecision('go'));
    $('owner-stop-btn').addEventListener('click', () => sendDecision('stop'));
    $('owner-key').addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });   // Enter must never send a paid go
"""),
])

# ------------------------------------------------------------------ index.html
patch('index.html', [
("""                    <button class="btn btn--ghost btn--sm" type="button" id="progress-retry" data-t="progress.checkAgain" hidden></button>
                  </div>
""",
"""                    <button class="btn btn--ghost btn--sm" type="button" id="progress-retry" data-t="progress.checkAgain" hidden></button>
                  </div>
                  <!-- The studio team's go or stop for a waiting request. Uses the OWNER key, kept in its field for one call only. -->
                  <details class="details ownergo" id="owner-go" hidden>
                    <summary data-t="ownerGo.summary"></summary>
                    <div class="ownergo__body">
                      <p class="hint" data-t="ownerGo.lead"></p>
                      <div class="ownergo__plan" id="owner-go-plan"></div>
                      <form class="ownergo__form" id="owner-go-form" novalidate>
                        <div class="field">
                          <label for="owner-key" data-t="ownerGo.keyLabel"></label>
                          <input id="owner-key" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                        </div>
                        <div class="field">
                          <label for="owner-note" data-t="ownerGo.noteLabel"></label>
                          <textarea id="owner-note" rows="2" maxlength="500"></textarea>
                        </div>
                        <div class="actions">
                          <button class="btn btn--primary btn--sm" type="button" id="owner-go-btn" data-t="ownerGo.go"></button>
                          <button class="btn btn--ghost btn--sm" type="button" id="owner-stop-btn" data-t="ownerGo.stop"></button>
                        </div>
                      </form>
                      <p class="notice ownergo__message" id="owner-go-message" hidden></p>
                    </div>
                  </details>
"""),
("""    <label><span data-t="mock.regen"></span><select id="mock-regen"></select></label>
""",
"""    <label><span data-t="mock.regen"></span><select id="mock-regen"></select></label>
    <label><span data-t="mock.decision"></span><select id="mock-decision"></select></label>
"""),
])

# ------------------------------------------------------------------ styles.css
path = src / 'styles.css'
css = path.read_text(encoding='utf-8')
marker = '/* ---------- Footer ---------- */'
assert css.count(marker) == 1, 'footer marker'
css = css.replace(marker, """/* ---------- Owner go (studio team only) ---------- */
.ownergo { margin-block-start: 1.5rem; padding: 0.25rem 1.1rem 1rem; border-radius: 12px; border: 1px solid var(--c-line-strong); background: var(--c-surface); max-inline-size: 720px; }
.ownergo__body { display: flex; flex-direction: column; gap: 1rem; padding-block-start: 0.25rem; }
.ownergo__title { font-weight: 600; font-size: 1.05rem; }
.ownergo__plan { display: flex; flex-direction: column; gap: 0.75rem; }
.ownergo__plan p { line-height: 1.6; }
.ownergo dl { margin: 0; display: grid; gap: 0.35rem; }
.ownergo__row { display: grid; grid-template-columns: minmax(7rem, auto) minmax(0, 1fr); gap: 0.75rem; }
.ownergo dt { font-family: var(--f-label); font-weight: 500; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-text-2); padding-block-start: 0.15rem; }
.ownergo dd { margin: 0; color: var(--c-ink); overflow-wrap: anywhere; }
.ownergo__shots { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
.ownergo__shot { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.75rem 0.9rem; border-radius: 10px; background: #FFFFFF; border: 1px solid var(--c-line); }
.ownergo__stops { font-weight: 500; }
.ownergo__fig img { max-inline-size: 420px; }
.ownergo__form { display: flex; flex-direction: column; gap: 0.75rem; }
.ownergo__form .field { margin: 0; }
.ownergo__message { margin: 0; }
@media (max-width: 479px) { .ownergo__row { grid-template-columns: 1fr; gap: 0.1rem; } }

""" + marker)
path.write_text(css, encoding='utf-8')
print('styles.css: 1 change(s)')
