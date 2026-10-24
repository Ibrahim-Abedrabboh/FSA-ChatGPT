// Stage 07 · Prop verdict: is each planned Midas piece confirmed in stock on its live Midas page today? Code only (16 Oct 2026).
// The live page is the stock source. A piece is used only when its page answers and says "In stock" (owner, 16 Oct 2026, D10: in stock
// only for every piece; pre-order is left out like out of stock; only pages on the Midas Kuwait English site, midasfurniture.com/en/);
// anything else (out of stock, the page refused or changed, no answer) leaves that spot empty, as the owner decided (15 Oct, 21:50).
// The size printed on the page ("Product Size") is kept as the vendor's figure; nothing is measured or guessed.
const arr = x => (Array.isArray(x) ? x : []);
const clean = (v, n) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 300));
const now = new Date().toISOString();
const first = $input.first() ? $input.first().json : {};
// This node is reached two ways: from the page reads (one item per piece) or straight from the ticket when no piece was planned.
const viaPages = !(first && first.status && first.scene);
const st = JSON.parse(JSON.stringify(viaPages ? $('19a Scene ticket').first().json : first));
const props = arr(st.scene && st.scene.props);
const pages = viaPages ? $input.all().map(i => i.json || {}) : [];
const asked = viaPages ? $('19b0 Prop page list').all().map(i => i.json) : [];
// P1.4 (16 Oct 2026): named entities such as &diams; are decoded or dropped, so page symbols never reach a prompt.
const NAMED = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', times: 'x', diams: ' ', hellip: '...', ndash: '-', mdash: '-', deg: ' deg', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
const unesc = t => String(t || '').replace(/&([a-z]+);/gi, (m, n) => (Object.prototype.hasOwnProperty.call(NAMED, n.toLowerCase()) ? NAMED[n.toLowerCase()] : ' ')).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');
// P1.4: the size line keeps only the measurement part (W, D, H and their numbers and unit); a line with no measurement is dropped.
function sizeOnly(raw) {
  const t = clean(String(raw || '').replace(/[♦◆*•|]/g, ' '), 200);
  // Review finding 9 (16 Oct 2026): a unit counts only right after a number, and cm or mm wins, so the word "in" ("Made in ...",
  // "in stock") is never read as inches.
  const units = [];
  // "in" counts only when written against the number ("45in") or when no other word follows it ("60 in", not "60 in stock").
  const ure = /\d(?:[.,]\d+)?(?:\s*(cm|mm|inch(?:es)?|m)\b|(in)\b|\s+(in)\b(?!\s+[a-z]))/gi;
  let um;
  while ((um = ure.exec(t))) units.push((um[1] || um[2] || um[3]).toLowerCase());
  const pick = units.find(u => u === 'cm' || u === 'mm') || units[0] || '';
  const unit = pick ? ' ' + (/^inch/.test(pick) ? 'in' : pick) : '';
  const pairs = [];
  const re = /\b(Dia(?:meter)?|[WDHL])\s*[:.]?\s*(\d+(?:[.,]\d+)?)/gi;
  let m;
  while ((m = re.exec(t)) && pairs.length < 4) pairs.push((/^dia/i.test(m[1]) ? 'Dia' : m[1].toUpperCase()) + ' ' + m[2]);
  if (pairs.length) return pairs.join(' x ') + unit;
  const U = '(?:\\s*(?:cm|mm|inch(?:es)?|m)\\b|in\\b)?';
  const bare = t.match(new RegExp('\\d+(?:[.,]\\d+)?' + U + '(?:\\s*[x×]\\s*\\d+(?:[.,]\\d+)?' + U + '){1,2}', 'i'));
  return bare ? bare[0].replace(/\s*(?:cm|mm|inch(?:es)?|m)\b|in\b/gi, '').replace(/\s*[x×]\s*/g, ' x ').trim() + unit : '';
}
function read(html) {
  const h = String(html || '');
  const text = unesc(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const signals = [];
  if (/class="[^"]*\bstock\b[^"]*\bavailable\b/i.test(h)) signals.push('in_stock');
  if (/class="[^"]*\bstock\b[^"]*\bunavailable\b/i.test(h)) signals.push('out_of_stock');
  const ld = h.match(/"availability"\s*:\s*"[^"]*schema\.org\/(InStock|OutOfStock|PreOrder|SoldOut|Discontinued)"/i);
  if (ld) signals.push(/instock/i.test(ld[1]) ? 'in_stock' : (/preorder/i.test(ld[1]) ? 'pre_order' : 'out_of_stock'));
  if (/\bpre[-\s]?order\b/i.test(text) && /add to cart|pre[-\s]?order now/i.test(text)) signals.push('pre_order');
  const uniq = Array.from(new Set(signals));
  const stock = uniq.length === 1 ? uniq[0] : (uniq.length ? 'conflicting' : 'not_found');
  const size = text.match(/Product Size\s*:?\s*(.{3,160}?)(?=\s+(?:Product Colou?r|Family Colou?r|Colou?r|Combination|Material|Fabric|Warranty|SKU|Delivery|Description|Specifications?|Qty|Quantity|Add to Cart|Add to Wishlist|Add Wishlist|Buy Now|Share)\b|$)/i);
  const sku = text.match(/\bSKU\s*:?\s*([A-Za-z0-9-]{3,20})\b/);
  return { stock, signals: uniq, size: size ? sizeOnly(size[1]) : '', sku_on_page: sku ? sku[1] : '' };
}
const kept = [], dropped = [];
props.forEach((p, i) => {
  const k = asked.findIndex(a => a.sku === p.sku && a.url === p.url);
  const page = k === -1 ? null : pages[k];
  const status = page ? Number(page.statusCode) || 0 : 0;
  const body = page ? (typeof page.body === 'string' ? page.body : (typeof page.data === 'string' ? page.data : '')) : '';
  if (!page) { dropped.push({ sku: p.sku, name: p.name, why: 'its page was not read' }); return; }
  if (status !== 200 || !body) { dropped.push({ sku: p.sku, name: p.name, why: 'its Midas page did not answer (status ' + (status || (page.error ? 'error' : 'none')) + ')' }); return; }
  const r = read(body);
  if (r.sku_on_page && r.sku_on_page !== String(p.sku)) { dropped.push({ sku: p.sku, name: p.name, why: 'the page shows another SKU (' + r.sku_on_page + ')' }); return; }
  // A lamp or other light fitting appears only when its page says in stock (owner, 16 Oct 2026, decision 23); pre-order is not enough for it.
  // Every other piece on pre-order is left out too (owner, 16 Oct 2026, D10, which settles decision 28), a few lines below.
  // The same lamp words as 13 and 16a (review fix, 16 Oct 2026), so a "ceiling light" is held to the same rule.
  if (r.stock === 'pre_order' && /\b(lamps?|lights?|lighting|sconces?|chandeliers?|lanterns?|pendants?)\b/i.test(String(p.kind || ''))) { dropped.push({ sku: p.sku, name: p.name, why: 'a lamp appears only when its Midas page says in stock; it says pre-order today' }); return; }
  if (!/^https:\/\/(www\.)?midasfurniture\.com\/en\//i.test(String(p.url || ''))) { dropped.push({ sku: p.sku, name: p.name, why: 'its page is not on the Midas Kuwait English site (midasfurniture.com/en/)' }); return; }
  if (r.stock === 'pre_order') { dropped.push({ sku: p.sku, name: p.name, why: 'its Midas page says pre-order today; only pieces in stock are used' }); return; }
  if (r.stock === 'in_stock') kept.push(Object.assign({}, p, { live: { stock: r.stock, read_at: now, size_on_page: r.size || 'not confirmed', page: p.url } }));
  else dropped.push({ sku: p.sku, name: p.name, why: r.stock === 'out_of_stock' ? 'out of stock on its Midas page today' : (r.stock === 'conflicting' ? 'its page gives conflicting stock signals (' + r.signals.join(', ') + ')' : 'its page does not show the stock status') });
});
st.scene.props = kept;
st.scene.props_left_out = arr(st.scene.props_left_out).concat(dropped.map(d => ({ sku: d.sku, why: d.why + '; the spot stays empty' })));
st.scene.prop_check = { at: now, source: 'live Midas product pages', asked: props.length, kept: kept.length, dropped };
st.trail = arr(st.trail).concat([{ step: 19, name: 'Prop check', at: now, note: props.length ? kept.length + ' of ' + props.length + ' Midas piece(s) confirmed on their live page' : 'no Midas piece planned for this scene' }]);
return [{ json: st }];
