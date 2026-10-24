// "Choose from Midas": opens the in-site Midas catalogue and receives the products imported from it (up to 10).
// Imported products become Midas product references in "Midas product links or SKUs" — not verified products,
// not availability-checked and not saved until Save draft. One can be made the source photo via Import Midas link.
(() => {
  const KEY = 'midas-catalogue-import', LIMIT = 10, MAX_AGE = 30 * 60 * 1000;
  const $ = id => document.getElementById(id);
  const validUrl = url => typeof url === 'string' && url.length <= 300 && /^https:\/\/(www\.)?midasfurniture\.com\/[\w\-./%]+$/i.test(url);
  function parse(raw) {
    let payload = raw;
    try { if (typeof raw === 'string') payload = JSON.parse(raw); } catch { return null; }
    if (!payload || payload.source !== 'midas-catalogue' || !Array.isArray(payload.items)) return null;
    const seen = new Set();
    const items = payload.items.filter(item => item && validUrl(item.url) && !seen.has(item.url) && seen.add(item.url)).slice(0, LIMIT)
      .map(item => ({ name: String(item.name || '').trim().slice(0, 160) || 'Midas product', url: item.url, sku: /^\d{4,8}$/.test(String(item.sku || '')) ? String(item.sku) : '' }));
    const at = Date.parse(payload.at || '');
    return items.length ? { items, snapshot: String(payload.snapshot || '').slice(0, 10), at: Number.isFinite(at) ? at : null } : null;
  }
  window.midasCatalogueImport = { parse };
  const field = $('sourceCatalogueRefs');
  if (!field) return;

  const inOwner = location.pathname.startsWith('/owner/');
  const catalogueUrl = inOwner ? `/owner/catalogue/?return=${encodeURIComponent(location.pathname)}` : 'catalogue/index.html';
  const link = document.querySelector('.midas-link');
  if (link) {
    link.href = catalogueUrl; link.removeAttribute('target');
    const small = link.querySelector('small'); if (small) small.textContent = 'Browse the Midas catalogue, select up to 10 products and import them here as Midas product references.';
    const strong = link.querySelector('strong'); if (strong) strong.textContent = 'Choose from Midas →';
    link.addEventListener('click', event => {
      // Unsaved photos live only in this page; keep them by opening the catalogue in a new tab instead.
      const state = window.a7Start?.state;
      const unsaved = state && (state.primary && !state.primary.file?.stored || state.views?.length || state.side?.left || state.side?.right);
      if (!unsaved) return;
      event.preventDefault();
      const tab = window.open(catalogueUrl, '_blank');
      if (!tab) location.href = catalogueUrl;
    });
  }

  const panel = document.createElement('section'); panel.id = 'catalogueImportPanel'; panel.className = 'catalogue-import'; panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'catalogueImportTitle');
  (field.closest('label') || field).after(panel);
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

  function useAsSource(item, button) {
    const radio = document.querySelector('input[name="source"][value="link"]'), ref = $('midasImportRef'), find = $('midasImportFind');
    if (!radio || radio.disabled || !ref || !find) { button.disabled = true; button.textContent = 'Import Midas link is not available here'; return; }
    radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
    ref.value = item.sku || item.url; find.click();
    $('midasImportPanel')?.scrollIntoView({ block: 'center' });
  }
  function apply(payload) {
    const lines = field.value.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const added = payload.items.filter(item => !lines.includes(item.url));
    field.value = [...lines, ...added.map(item => item.url)].join('\n');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const title = make('h3', '', `Imported from the Midas catalogue · ${payload.items.length} product${payload.items.length === 1 ? '' : 's'}`); title.id = 'catalogueImportTitle'; title.tabIndex = -1;
    const note = make('p', 'catalogue-import-note', `Added as Midas product references above${payload.snapshot ? ` (catalogue snapshot ${payload.snapshot})` : ''}. They are not verified products and stock or price is not checked. Save the draft to keep them; to use one as the source photo, choose “Use as source”.`);
    const total = field.value.split(/\n+/).filter(line => /^https:\/\//i.test(line.trim())).length;
    if (total > 6) note.textContent += ` Note: when a styled scene is saved, the first 6 Midas links are kept (you now have ${total}), and A7 places at most 3 supporting pieces per image.`;
    const list = make('ul', 'catalogue-import-list');
    for (const item of payload.items) {
      const li = make('li'), name = make('span', 'catalogue-import-name', item.name);
      const meta = make('span', 'catalogue-import-meta', item.sku ? `SKU ${item.sku}` : 'SKU not in link');
      const view = make('a', '', 'View on Midas ↗'); view.href = item.url; view.target = '_blank'; view.rel = 'noopener noreferrer';
      const use = make('button', '', 'Use as source'); use.type = 'button'; use.addEventListener('click', () => useAsSource(item, use));
      li.append(name, meta, view, use); list.append(li);
    }
    const again = make('a', 'catalogue-import-again', 'Choose more from Midas'); again.href = catalogueUrl;
    const dismiss = make('button', 'catalogue-import-dismiss', 'Hide'); dismiss.type = 'button'; dismiss.addEventListener('click', () => { panel.hidden = true; field.focus(); });
    const actions = make('div', 'catalogue-import-actions'); actions.append(again, dismiss);
    panel.replaceChildren(title, note, list, actions); panel.hidden = false;
    panel.scrollIntoView({ block: 'center' }); title.focus({ preventScroll: true });
  }
  function take(raw, { checkAge = false } = {}) {
    const payload = parse(raw);
    if (!payload || (checkAge && payload.at && Date.now() - payload.at > MAX_AGE)) return false;
    apply(payload); return true;
  }
  const clearStored = () => { try { localStorage.removeItem(KEY); } catch {} };
  function fromHash() {
    const match = location.hash.match(/^#catalogue-import=(.+)$/);
    if (!match) return false;
    history.replaceState(history.state, '', location.pathname + location.search);
    let raw = ''; try { raw = decodeURIComponent(match[1]); } catch { return false; }
    return take(raw);
  }
  // Defer until the rest of the page (including the Import Midas link panel) has been set up.
  setTimeout(() => {
    if (fromHash()) { clearStored(); return; }
    let stored = null; try { stored = localStorage.getItem(KEY); } catch {}
    if (stored) { take(stored, { checkAge: true }); clearStored(); }
  }, 0);
  window.addEventListener('storage', event => { if (event.key === KEY && event.newValue && take(event.newValue)) clearStored(); });
})();
