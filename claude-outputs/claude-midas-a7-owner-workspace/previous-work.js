// Previous work: a browsable archive of earlier Studio generations with their original references
// (data in previous-work-data.js). Read-only and local: nothing here calls the owner APIs, starts
// analysis or generation, or links an archive image to a saved version or job.
(() => {
  const data = window.MIDAS_PREVIOUS_WORK;
  const $ = id => document.getElementById(id);
  const grid = $('previousWorkGrid'), dialog = $('previousWorkDialog');
  if (!grid || !dialog || !Array.isArray(data)) return;
  const base = location.pathname.startsWith('/owner/') ? '/owner/previous-work/img/' : 'previous-work/img/';
  const img = (key, size = 'f') => `${base}${key}-${size}.webp`;
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const TAGS = ['Living', 'Bedroom', 'Dining', 'Accessories', 'Tables', 'White background', 'Angles', 'Lighting', 'People'];
  const PAGE = 24;
  let filter = 'all', query = '', limit = PAGE, current = null, selected = null, view = 'result', opener = null;

  const filters = $('previousWorkFilters');
  const pills = [['all', 'All', data.length], ...TAGS.map(tag => [tag, tag, data.filter(item => item.tags.includes(tag)).length]).filter(([, , count]) => count)];
  filters.replaceChildren(...pills.map(([value, label, count]) => {
    const pill = make('button', 'ledger-pill'); pill.type = 'button'; pill.dataset.workFilter = value;
    pill.setAttribute('aria-pressed', String(value === filter)); pill.append(label, make('span', 'pill-count', ' ' + count));
    return pill;
  }));
  filters.addEventListener('click', event => {
    const pill = event.target.closest('[data-work-filter]'); if (!pill) return;
    filter = pill.dataset.workFilter; limit = PAGE;
    for (const node of filters.querySelectorAll('[data-work-filter]')) node.setAttribute('aria-pressed', String(node === pill));
    render();
  });
  let timer = null;
  $('previousWorkSearch').addEventListener('input', event => { query = event.target.value; limit = PAGE; clearTimeout(timer); timer = setTimeout(render, 180); });
  $('previousWorkMore').addEventListener('click', () => { const before = grid.children.length; limit += PAGE; render(); grid.children[before]?.querySelector('button')?.focus(); });

  const matches = item => (filter === 'all' || item.tags.includes(filter)) &&
    (!query.trim() || [item.title, item.collection, ...item.tags, ...item.versions.map(v => v.label)].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  function render() {
    const visible = data.filter(matches), shown = visible.slice(0, limit);
    grid.replaceChildren(...shown.map(item => {
      const li = make('li'), card = make('button', 'work-card'); card.type = 'button';
      const frame = make('span', 'work-cover'), cover = document.createElement('img');
      cover.src = img(item.cover, 't'); cover.alt = ''; cover.loading = 'lazy'; cover.decoding = 'async';
      frame.append(cover);
      if (item.count) frame.append(make('span', 'work-count', `${item.count} references & versions`));
      card.append(frame, make('strong', 'work-title', item.title), make('span', 'work-collection', item.collection || 'Studio archive'));
      card.setAttribute('aria-label', `${item.title}, ${item.collection || 'Studio archive'}. Open references and versions`);
      card.addEventListener('click', () => open(item, card));
      li.append(card); return li;
    }));
    const status = $('previousWorkStatus');
    status.textContent = !visible.length ? 'No previous work matches this filter or search.' :
      shown.length < visible.length ? `Showing ${shown.length} of ${visible.length} examples.` : `${visible.length} example${visible.length === 1 ? '' : 's'} shown.`;
    const more = $('previousWorkMore'), remaining = visible.length - shown.length;
    more.hidden = remaining <= 0; more.textContent = `Show ${Math.min(PAGE, remaining)} more of ${remaining}`;
  }

  const labelOf = key => key === current.source ? 'Original reference' : current.versions.find(v => v.img === key)?.label || 'Version';
  function figure(key, label) {
    const fig = make('figure', 'work-figure'), image = document.createElement('img');
    image.src = img(key); image.alt = `${current.title} · ${label}`; image.decoding = 'async';
    fig.append(image, make('figcaption', '', label)); return fig;
  }
  function renderStage() {
    const stage = $('previousWorkStage');
    for (const button of dialog.querySelectorAll('[data-work-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.workView === view));
      button.disabled = button.dataset.workView !== 'result' && !current.source;
    }
    stage.className = 'work-stage' + (view === 'compare' ? ' is-compare' : '');
    if (view === 'source' && current.source) stage.replaceChildren(figure(current.source, 'Original reference'));
    else if (view === 'compare' && current.source) stage.replaceChildren(figure(current.source, 'Original reference'), figure(selected === current.source ? current.cover : selected, labelOf(selected === current.source ? current.cover : selected)));
    else stage.replaceChildren(figure(selected, labelOf(selected)));
    for (const button of $('previousWorkStrip').children) button.setAttribute('aria-pressed', String(button.dataset.key === (view === 'source' ? current.source : selected)));
  }
  function open(item, from) {
    current = item; selected = item.cover; view = 'result'; opener = from;
    $('previousWorkDialogTitle').textContent = item.title;
    $('previousWorkDialogCollection').textContent = (item.collection || 'Studio archive').toUpperCase();
    $('previousWorkTags').replaceChildren(...item.tags.map(tag => make('li', '', tag)));
    $('previousWorkMeta').textContent = item.native || '';
    const keys = [...(item.source ? [item.source] : []), ...item.versions.map(v => v.img)];
    $('previousWorkStrip').replaceChildren(...keys.map(key => {
      const button = make('button', 'work-thumb'); button.type = 'button'; button.dataset.key = key;
      const thumb = document.createElement('img'); thumb.src = img(key); thumb.alt = ''; thumb.loading = 'lazy'; thumb.decoding = 'async';
      button.append(thumb, make('span', '', key === item.source ? 'Original reference' : labelOf(key)));
      button.addEventListener('click', () => { if (key === item.source) view = 'source'; else { selected = key; if (view === 'source') view = 'result'; } renderStage(); });
      return button;
    }));
    renderStage(); dialog.showModal();
  }
  for (const button of dialog.querySelectorAll('[data-work-view]')) button.addEventListener('click', () => { view = button.dataset.workView; renderStage(); });
  $('closePreviousWork').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
  render();
})();
