// Catalogue refresh · R12 Pre-order verdict (17 Oct 2026, owner decision 00:36). Code only, no model.
// For each active hand row marked "Pre-Order" (from R9), using its own product page (R10) and the Kuwait English sitemap (R11):
//   - page 404 AND the address and SKU are not in the Kuwait sitemap -> inactive (the rule used for SANOVA 161283). A flag only:
//     nothing is deleted, and the row can be switched back;
//   - page 404 but in the sitemap, or the sitemap could not be read -> no change; flagged for the owner;
//   - page shows a pre-order label or button -> no change; the label is recorded as the evidence;
//   - page says in stock -> no change here (the listing is the stock source); flagged for the owner;
//   - page says out of stock with no pre-order -> keep "Pre-Order", never write "Out of stock"; flagged for the owner;
//   - anything else (refused, no stock signal, another SKU on the page) -> no change; flagged.
// Every verdict writes stock_checked only (when, which run, what the page said). "Date read" (retrieved) is never changed.
// A row "R4 Plan rows" already updated from the listing in this run gets no second write.
const arr = x => (Array.isArray(x) ? x : []);
const one = n => { try { return $(n).all(); } catch (e) { return []; } };
const asked = one('R9 Pre-order hand rows').map(i => i.json);
const pages = one('R10 Read product page').map(i => i.json || {});
const sm = (one('R11 Read Kuwait sitemap')[0] || { json: {} }).json || {};
const smBody = typeof sm.body === 'string' ? sm.body : (typeof sm.data === 'string' ? sm.data : '');
const smOk = (Number(sm.statusCode) || 0) === 200 && /<urlset|<loc>/i.test(smBody);
const RUN = (typeof $execution !== 'undefined' && $execution && $execution.id) ? String($execution.id) : 'unknown';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const amman = d => { const a = new Date(d.getTime() + 3 * 3600 * 1000); const p = n => String(n).padStart(2, '0');
  return a.getUTCDate() + ' ' + MON[a.getUTCMonth()] + ' ' + a.getUTCFullYear() + ', ' + p(a.getUTCHours()) + ':' + p(a.getUTCMinutes()) + ' Amman'; };
const STAMP = amman(new Date()) + ', refresh run ' + RUN;
// Rows R4 already wrote in this run (listing decision wins; no second write).
const doneByListing = new Set(one('R4 Plan rows').map(i => i.json || {}).filter(j => j.action === 'hand_stock' || j.action === 'hand_note').map(j => String(j.sku)));
const NAMED = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const text = h => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] || ' ').replace(/\s+/g, ' ');
function read(h) {
  const t = text(h);
  const s = [];
  if (/class="[^"]*\bstock\b[^"]*\bavailable\b/i.test(h)) s.push('in_stock');
  if (/class="[^"]*\bstock\b[^"]*\bunavailable\b/i.test(h)) s.push('out_of_stock');
  const ld = h.match(/"availability"\s*:\s*"[^"]*schema\.org\/(InStock|OutOfStock|PreOrder|SoldOut|Discontinued)"/i);
  if (ld) s.push(/instock/i.test(ld[1]) ? 'in_stock' : (/preorder/i.test(ld[1]) ? 'pre_order' : 'out_of_stock'));
  // Pre-order label or button on the page: the words themselves are kept as evidence.
  // A label counts only with a buying control on the page (as in A7 step 19c), so a menu link alone is not evidence.
  const label = /add to cart|pre[-\s]?order now/i.test(t) ? t.match(/\b(pre[-\s]?order(?:\s+now)?)\b/i) : null;
  const button = /<button[^>]*>[^<]*pre[-\s]?order[^<]*<\/button>/i.test(h) || /<input[^>]*value="[^"]*pre[-\s]?order[^"]*"/i.test(h);
  if (label || button) s.push('pre_order');
  const u = Array.from(new Set(s));
  const sku = (t.match(/\bSKU\s*:?\s*([A-Za-z0-9-]{3,20})\b/) || [])[1] || '';
  return { stock: u.length === 1 ? u[0] : (u.length ? (u.includes('pre_order') ? 'pre_order' : 'conflicting') : 'not_found'), signals: u,
    evidence: button ? 'pre-order button on the page' + (label ? ' ("' + label[1] + '")' : '') : (label ? 'pre-order label on the page ("' + label[1] + '")' : (ld ? 'schema.org ' + ld[1] : '')), sku };
}
const out = [], log = [];
asked.forEach((a, i) => {
  const p = pages[i] || {};
  const status = Number(p.statusCode) || 0;
  const body = typeof p.body === 'string' ? p.body : (typeof p.data === 'string' ? p.data : '');
  const base = { row_id: a.row_id, sku: a.sku, url: a.url };
  const write = (action, note, extra) => { out.push({ json: Object.assign({ action }, base, { row: Object.assign({ stock_checked: STAMP + '; ' + note }, extra || {}) }) }); log.push(Object.assign({ verdict: action, note }, base)); };
  if (doneByListing.has(String(a.sku))) { log.push(Object.assign({ verdict: 'listing decided this run; page not used for a write', page_status: status }, base)); return; }
  if (status === 404) {
    const inSitemap = smOk && (smBody.indexOf(a.url) !== -1 || new RegExp('[^0-9]' + String(a.sku).replace(/[^0-9A-Za-z-]/g, '') + '[^0-9]').test(smBody));
    if (smOk && !inSitemap) return write('inactive', 'product page 404 and not in the Kuwait English sitemap; set inactive (owner rule, 17 Oct 2026). Kept "Pre-Order"; nothing deleted', { active: false });
    return write('hand_note', 'product page 404 but ' + (smOk ? 'still in the Kuwait English sitemap' : 'the Kuwait sitemap could not be read') + '; no change; FLAG for the owner');
  }
  if (status !== 200 || !body) return write('hand_note', 'product page did not answer (status ' + (status || 'none') + '); no change; FLAG for the owner');
  const r = read(body);
  if (r.sku && r.sku !== String(a.sku)) return write('hand_note', 'product page shows another SKU (' + r.sku + '); no change; FLAG for the owner');
  if (r.stock === 'pre_order') return write('hand_note', 'product page: ' + (r.evidence || 'pre-order') + '; kept "Pre-Order"');
  if (r.stock === 'in_stock') return write('hand_note', 'product page says in stock, but the listing is the stock source and did not show this SKU; no change; FLAG for the owner');
  if (r.stock === 'out_of_stock') return write('hand_note', 'product page says out of stock and shows no pre-order; kept "Pre-Order" (owner rule, 17 Oct 2026); FLAG for the owner');
  return write('hand_note', 'product page gives ' + (r.stock === 'conflicting' ? 'conflicting stock signals (' + r.signals.join(', ') + ')' : 'no stock signal') + '; no change; FLAG for the owner');
});
if (!out.length) return [{ json: { action: 'none', preorder_log: log, sitemap_read: smOk } }];
out[0].json.preorder_log = log; out[0].json.sitemap_read = smOk;
return out;
