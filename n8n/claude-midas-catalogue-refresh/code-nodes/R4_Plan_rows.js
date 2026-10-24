// Catalogue refresh · R4 Plan rows (16 Oct 2026; hand-stock rule 17 Oct 2026 00:08; stock_checked and pre-order rules 17 Oct 2026 00:36). Code only, no model.
// Reads what each listing page states and nothing else: SKU, name, product link, catalogue photo, price in KWD, the in-stock flag
// and the category. Dimensions and finish are not on the listing, so a new row says "not confirmed".
// Writes: a SKU not yet in the A7 catalogue is inserted; a row this refresh made earlier (notes start "Imported") is updated with
// today's availability, photo and price; a row someone wrote by hand (other notes) is never changed. A SKU missing from today's
// pages is left as it is (page 1 shows only part of a category, so absence proves nothing).
// 17 Oct 2026 (owner, 00:08): hand rows stay unchanged, except the stock field (availability) of the hand rows listed below.
// Only availability changes on them; name, link, photo, size, finish, date read and notes stay as written by hand.
// Cause of the 16 Oct gap (execution 429): the SKUs matched, but the rule above kept every hand row unchanged on purpose.
const HAND_STOCK_SKUS = ['174770', '174788'];
// MODE 'hand-stock-only' (this draft): the run writes only the hand-stock changes above; no insert and no imported-row update.
// MODE 'full': the 16 Oct behaviour plus the hand-stock rule. Changing the mode needs the owner's go.
const MODE = 'hand-stock-only';
// 17 Oct 2026 (owner, 00:36): every stock write also fills stock_checked: when and by which run the stock was read, and what the
// listing said. The "date read" (retrieved) of a hand row is never changed, because its other fields were not read again.
const RUN = (typeof $execution !== 'undefined' && $execution && $execution.id) ? String($execution.id) : 'unknown';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const amman = d => { const a = new Date(d.getTime() + 3 * 3600 * 1000); const p = n => String(n).padStart(2, '0'); // Jordan: UTC+3 all year
  return a.getUTCDate() + ' ' + MON[a.getUTCMonth()] + ' ' + a.getUTCFullYear() + ', ' + p(a.getUTCHours()) + ':' + p(a.getUTCMinutes()) + ' Amman'; };
const CHECKED = amman(new Date()) + ', refresh run ' + RUN;
const checked = said => CHECKED + '; listing said ' + said;
// 17 Oct 2026 (owner, 00:36), hand rows marked "Pre-Order": listing In stock -> write In stock; listing out of stock -> keep
// "Pre-Order", do not write "Out of stock", flag the row with the date (written in stock_checked only). A page that is gone is
// handled by "R12 Pre-order verdict" (404 and not in the Kuwait sitemap -> inactive).
const isPre = v => /^\s*pre[-\s]?order\s*$/i.test(String(v || ''));
const cats = $('R1 Categories').all().map(i => i.json);
const pages = $('R2 Read listing').all();
const today = new Date().toISOString().slice(0, 10);
const unesc = t => String(t || '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parse(page, cat) {
  const rows = [];
  const re = /<li class="item product product-item[^"]*">([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(page))) {
    const b = m[1];
    const link = b.match(/class="product-item-link" href="([^"]+)">\s*([^<]+?)\s*<\/a>/);
    const sku = b.match(/data-product-sku="([^"]+)"/) || b.match(/"Product Id":"([^"]+)"/);
    const img = b.match(/data-src="(https:\/\/midasfurniture\.com\/media\/catalog\/product\/[^"?]+)/);
    const stock = b.match(/data-in-stock="(\d)"/);
    const price = b.match(/data-price-type="finalPrice"[^>]*>\s*<span class="price">([0-9.,]+)\s*KWD/) || b.match(/data-price-amount="([0-9.]+)" data-price-type="finalPrice"/);
    if (!link || !sku) continue;
    rows.push({
      sku: unesc(sku[1]).trim(), name: unesc(link[2]).trim(), kind: cat.kind, url: link[1], image_url: img ? img[1] : '',
      dimensions: 'not confirmed', finish: 'not confirmed',
      availability: stock ? (stock[1] === '1' ? 'In stock' : 'Out of stock') : 'not confirmed',
      retrieved: today,
      notes: 'Imported ' + today + ' from the public listing page ' + cat.url + ' (page 1 only; robots.txt allows no page 2). Price on that day: ' + (price ? price[1].replace(/,/g, '') + ' KWD' : 'not read') + '. Dimensions and finish are not on the listing: not confirmed.',
      active: true, tags_basis: ''
    });
  }
  return rows;
}
const log = [], read = [];
pages.forEach((it, i) => {
  const cat = cats[i] || { path: '?', kind: '', url: '' };
  const j = it.json || {};
  const status = Number(j.statusCode) || (j.error ? 0 : 200);
  const body = typeof j.body === 'string' ? j.body : (typeof j.data === 'string' ? j.data : '');
  if (status !== 200 || !body) { log.push({ category: cat.path, status, rows: 0, problem: j.error ? String(j.error.message || j.error).slice(0, 200) : 'no page text (status ' + status + ')' }); return; }
  const tot = (body.match(/toolbar-number">(\d+)/g) || []).map(x => Number(x.replace(/\D/g, '')));
  const rows = parse(body, cat);
  read.push(...rows);
  log.push({ category: cat.path, status, rows: rows.length, on_site: tot.length >= 3 ? tot[2] : (tot[0] || null), problem: rows.length ? '' : 'page read but no product found (the page layout may have changed)' });
});
const seen = new Set(), uniq = [];
for (const r of read) { if (seen.has(r.sku)) continue; seen.add(r.sku); uniq.push(r); }
const loaded = $('R3 Load catalogue').all().map(i => i.json || {});
const existing = loaded.filter(r => r && r.sku);
const bySku = new Map(existing.map(r => [String(r.sku), r]));
const out = [], kept = [];
for (const r of uniq) {
  const e = bySku.get(r.sku);
  if (!e) out.push({ json: { action: 'insert', row: Object.assign({}, r, { stock_checked: checked(r.availability) }) } });
  else if (/^Imported /.test(String(e.notes || ''))) out.push({ json: { action: 'update', row_id: e.id, row: { name: r.name, url: r.url, image_url: r.image_url, availability: r.availability, retrieved: r.retrieved, notes: r.notes, stock_checked: checked(r.availability) } } });
  else if (e.active !== false && isPre(e.availability) && r.availability === 'In stock') {
    out.push({ json: { action: 'hand_stock', row_id: e.id, sku: r.sku, row: { availability: 'In stock', stock_checked: checked('In stock') }, before: String(e.availability || ''), source: r.url, rule: 'pre-order row; listing In stock' } });
  }
  else if (e.active !== false && isPre(e.availability) && r.availability === 'Out of stock') {
    const note = checked('Out of stock') + '; kept "Pre-Order" (owner rule, 17 Oct 2026); FLAG for the owner';
    out.push({ json: { action: 'hand_note', row_id: e.id, sku: r.sku, row: { stock_checked: note }, before: String(e.availability || ''), source: r.url, flag: note } });
  }
  else if (HAND_STOCK_SKUS.indexOf(r.sku) !== -1 && r.availability !== 'not confirmed' && r.availability !== String(e.availability || '')) {
    out.push({ json: { action: 'hand_stock', row_id: e.id, sku: r.sku, row: { availability: r.availability, stock_checked: checked(r.availability) }, before: String(e.availability || ''), source: r.url, rule: 'owner stock list' } });
  }
  else kept.push({ sku: r.sku, why: HAND_STOCK_SKUS.indexOf(r.sku) !== -1 ? 'hand row on the owner\'s stock list; stock already matches the listing (or the listing gives none)' : 'written earlier by hand; not changed', catalogue_availability: e.availability || '', listing_availability: r.availability });
}
// In 'hand-stock-only' mode every other write is held back and only counted.
const handAct = a => a === 'hand_stock' || a === 'hand_note';
const held = MODE === 'hand-stock-only' ? out.filter(x => !handAct(x.json.action)) : [];
if (held.length) { const keep = out.filter(x => handAct(x.json.action)); out.length = 0; keep.forEach(x => out.push(x)); }
const summary = { at: new Date().toISOString(), pages: log, pages_ok: log.filter(x => x.status === 200 && x.rows).length, pages_total: cats.length, rows_read: read.length, rows_unique: uniq.length,
  mode: MODE, insert: out.filter(x => x.json.action === 'insert').length, update: out.filter(x => x.json.action === 'update').length,
  hand_stock: out.filter(x => x.json.action === 'hand_stock').map(x => ({ sku: x.json.sku, row_id: x.json.row_id, before: x.json.before, after: x.json.row.availability, rule: x.json.rule })),
  flags: out.filter(x => x.json.action === 'hand_note').map(x => ({ sku: x.json.sku, row_id: x.json.row_id, flag: x.json.flag })), stock_checked: CHECKED,
  held_by_mode: { insert: held.filter(x => x.json.action === 'insert').length, update: held.filter(x => x.json.action === 'update').length }, kept_hand_rows: kept,
  catalogue_rows_before: existing.length, catalogue_read_ok: !loaded.some(r => r.error) };
if (!summary.catalogue_read_ok) return [{ json: { action: 'none', summary, problem: 'The A7 catalogue could not be read, so nothing is written (a SKU could be written twice).' } }];
if (!out.length) return [{ json: { action: 'none', summary } }];
out[0].json.summary = summary;
return out;
