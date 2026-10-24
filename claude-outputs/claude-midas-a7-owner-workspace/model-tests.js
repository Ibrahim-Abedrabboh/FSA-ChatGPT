// Testing models per stage: owner page. Talks only to /api/owner/model-tests (same origin).
(() => {
  const API = '/api/owner/model-tests', MAX_BYTES = 2.9 * 1024 * 1024, POLL_MS = 5000, STALE_MS = 15 * 60 * 1000;
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); for (const child of children) node.append(child); return node; };
  const ERRORS = {
    daily_limit_reached: 'Today\'s limit of test runs is used. Try again tomorrow.',
    model_tests_not_enabled: 'Model tests are not enabled on this site.',
    origin_rejected: 'Model tests run only on the production site.',
    invalid_arms: 'Choose at least one model setup.',
    photo_missing: 'Choose a photo first.',
    photo_too_large: 'The photo is larger than 3 MB, even after reducing it.',
    photo_type: 'Use a JPEG, PNG or WebP photo.',
    invalid_expected: 'The correct count must be a whole number from 1 to 40.',
    midas_photo_unavailable: 'The Midas test photo could not be downloaded. Try again shortly.',
    stage_not_connected: 'This stage is not connected yet.'
  };
  const RUN_ERRORS = {no_answer_in_time: 'No answer within 110 s', gateway_timeout: 'Cut off at ~100 s by n8n Cloud', answer_not_json: 'Answer was not readable JSON', unreachable: 'Could not reach n8n'};
  let state = null, current = null, pollTimer = null;

  const fmtTime = ms => Number.isFinite(ms) ? (ms / 1000).toFixed(1) + ' s' : '—';
  const fmtCost = (answer) => answer?.costUsd != null ? 'USD ' + answer.costUsd.toFixed(4) : answer?.tokens?.input != null ? 'price not recorded' : '—';
  const fmtDate = iso => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  const status = (node, text, error = false) => { node.textContent = text; node.classList.toggle('is-error', error); };

  async function load() {
    const response = await fetch(API, {cache: 'no-store'});
    if (!response.ok) throw Error('load_failed');
    state = await response.json();
    renderStages(); renderForm(); renderHistory();
    if (!state.enabled) status($('formStatus'), ERRORS.model_tests_not_enabled, true);
  }

  function renderStages() {
    $('stageList').replaceChildren(...state.stages.map(stage => el('div', {className: 'mt-stage' + (stage.ready ? ' is-current' : ''), role: 'listitem'},
      el('strong', {textContent: stage.title}), el('small', {textContent: stage.help}), el('span', {className: 'mt-badge', textContent: stage.ready ? 'Connected' : 'Next'}))));
  }

  function renderForm() {
    $('midasPhoto').replaceChildren(...state.photos.map(p => el('option', {value: p.id, textContent: `${p.name} · ${p.expected} pieces`})));
    const truth = () => { const p = state.photos.find(x => x.id === $('midasPhoto').value); $('midasTruth').textContent = p ? 'Correct answer: ' + p.truth + '.' : ''; };
    $('midasPhoto').addEventListener('change', truth); truth();
    $('armList').replaceChildren(...state.arms.map(arm => {
      const input = el('input', {type: 'checkbox', name: 'arm', value: arm.id, checked: arm.default});
      return el('label', {className: 'mt-arm'}, input, el('span', {},
        el('strong', {textContent: `${arm.id} · ${arm.label}`}),
        el('small', {textContent: (arm.prompt === 'current' ? 'Current prompt' : 'Enhanced prompt') + (arm.note ? '. ' + arm.note : '')})));
    }));
    for (const radio of document.querySelectorAll('input[name="source"]')) radio.addEventListener('change', () => {
      const upload = document.querySelector('input[name="source"]:checked').value === 'upload';
      $('uploadPick').hidden = !upload; $('midasPick').hidden = upload;
    });
  }

  function renderHistory() {
    $('todayCount').textContent = `Today: ${state.today.used} of ${state.today.limit} runs used. Each run makes one paid call per chosen setup.`;
    if (!state.runs.length) { $('historyList').replaceChildren(el('li', {className: 'is-empty', textContent: 'No runs yet.'})); return; }
    $('historyList').replaceChildren(...state.runs.map(run => {
      const answers = Object.values(run.answers || {}).filter(Boolean), right = answers.filter(a => a.summary?.correct === true).length;
      const score = run.expected != null && answers.length ? ` · ${right} of ${run.arms.length} right` : '';
      const button = el('button', {type: 'button'}, el('span', {textContent: `${run.photo.name}${run.note ? ' — ' + run.note : ''}`}), el('span', {textContent: `${fmtDate(run.createdAt)} · ${label(run)}${score}`}));
      button.addEventListener('click', () => open(run.id));
      return el('li', {}, button);
    }));
  }

  const stale = run => ['queued', 'running'].includes(run.status) && Date.now() - Date.parse(run.createdAt) > STALE_MS;
  function label(run) {
    if (stale(run)) return 'stopped without all answers';
    return {queued: 'starting', running: 'running', done: 'done', failed: 'not started'}[run.status] || run.status;
  }

  async function open(id) {
    clearTimeout(pollTimer);
    const response = await fetch(`${API}/${id}`, {cache: 'no-store'});
    if (!response.ok) { status($('formStatus'), 'That run could not be opened.', true); return; }
    current = (await response.json()).run;
    renderRun();
    if (['queued', 'running'].includes(current.status) && !stale(current)) pollTimer = setTimeout(() => open(id), POLL_MS);
    else load().catch(() => {});
  }

  function renderRun() {
    const run = current;
    $('runSection').hidden = false;
    if ($('runPhoto').dataset.run !== run.id) { $('runPhoto').src = `${API}/${run.id}/photo`; $('runPhoto').dataset.run = run.id; }
    $('runMeta').textContent = `${run.photo.name}${run.note ? ' — ' + run.note : ''} · ${fmtDate(run.createdAt)} · correct count: ${run.expected ?? 'not given'}`;
    const waiting = run.arms.filter(a => !run.answers[a]).length;
    status($('runState'), stale(run) ? 'This run stopped before every answer arrived.' : run.status === 'failed' ? 'The run did not start; nothing was sent to the models.'
      : waiting ? `Waiting for ${waiting} of ${run.arms.length} answers. This page checks every few seconds.` : 'All answers are in.', stale(run) || run.status === 'failed');
    $('runRows').replaceChildren(...run.arms.map(id => {
      const arm = state.arms.find(a => a.id === id), answer = run.answers[id], s = answer?.summary;
      const right = s?.correct == null ? '—' : el('span', {className: s.correct ? 'mt-yes' : 'mt-no', textContent: s.correct ? 'Yes' : 'No'});
      const count = answer ? (answer.status === 'done' ? String(s?.productCount ?? '—') : RUN_ERRORS[answer.error] || answer.error) : stale(run) ? 'no answer' : 'waiting…';
      return el('tr', {}, el('th', {scope: 'row', textContent: `${id} · ${arm.label} (${arm.prompt})`}), el('td', {textContent: fmtTime(answer?.ms)}), el('td', {textContent: count}),
        el('td', {}, right), el('td', {textContent: fmtCost(answer)}), el('td', {textContent: s?.category || '—'}));
    }));
    $('runDetails').replaceChildren(...run.arms.filter(id => run.answers[id]).map(id => details(id, run.answers[id])));
  }

  function details(id, answer) {
    const s = answer.summary, rows = [];
    const add = (term, value) => { if (value != null && value !== '') rows.push(el('dt', {textContent: term}), el('dd', {textContent: value})); };
    add('Model', answer.model); add('Tokens', answer.tokens ? `in ${answer.tokens.input ?? '—'} · out ${answer.tokens.output ?? '—'}${answer.tokens.thinking != null ? ' · thinking ' + answer.tokens.thinking : ''}` : '');
    if (s) {
      add('Product pieces', s.kinds.map(k => `${k.count} × ${k.kind}`).join(', '));
      add('Listed as product', s.product.join(', ')); add('Room context', s.context.join(', ')); add('Excluded', s.excluded.join(', '));
      add('Unsure if in set', s.unclear.join(', ')); add('Colour', s.colour); add('Material look', s.material); add('Design details', s.designLocks.join(' · '));
    } else add('Problem', RUN_ERRORS[answer.error] || answer.error);
    const block = el('details', {}, el('summary', {textContent: `${id} · ${answer.label} — ${answer.status === 'done' ? 'answer' : 'no usable answer'}`}), el('dl', {}, ...rows));
    const raw = answer.result ? JSON.stringify(answer.result, null, 2) : answer.rawText;
    if (raw) block.append(el('details', {}, el('summary', {textContent: 'Full answer'}), el('pre', {textContent: raw})));
    return block;
  }

  // Keeps the original when it already fits; otherwise redraws it as a JPEG no larger than 3 MB.
  async function fitPhoto(file) {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= MAX_BYTES) return file;
    let bitmap; try { bitmap = await createImageBitmap(file); } catch { throw Error('photo_type'); }
    for (const side of [2400, 2000, 1600, 1280]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height)), canvas = el('canvas', {width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale)});
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (blob && blob.size <= MAX_BYTES) return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg'});
    }
    throw Error('photo_too_large');
  }

  $('runForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('runButton'), arms = [...document.querySelectorAll('input[name="arm"]:checked')].map(i => i.value);
    const upload = document.querySelector('input[name="source"]:checked').value === 'upload';
    button.disabled = true;
    try {
      if (!arms.length) throw Error('invalid_arms');
      const form = new FormData();
      form.set('stage', 'eye'); form.set('arms', arms.join(',')); form.set('note', $('note').value.trim());
      if (upload) {
        const file = $('photoFile').files[0]; if (!file) throw Error('photo_missing');
        status($('formStatus'), 'Preparing the photo…');
        form.set('photo', await fitPhoto(file)); if ($('expected').value) form.set('expected', $('expected').value);
      } else form.set('midas', $('midasPhoto').value);
      status($('formStatus'), 'Starting the run…');
      const response = await fetch(API, {method: 'POST', body: form});
      const body = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) throw Error(body.error || 'start_failed');
      status($('formStatus'), `Started. ${arms.length} setup${arms.length > 1 ? 's are' : ' is'} reading the photo.`);
      await open(body.run.id);
      $('runSection').scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (error) {
      status($('formStatus'), ERRORS[error.message] || 'The run could not start. Try again shortly.', true);
    } finally { button.disabled = false; }
  });

  load().catch(() => status($('formStatus'), 'This page could not load. Reload to try again.', true));
})();
