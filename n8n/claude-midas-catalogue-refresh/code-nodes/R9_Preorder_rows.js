// Catalogue refresh · R9 Pre-order hand rows (17 Oct 2026, owner decision 00:36). Code only.
// Lists the active hand rows (notes do not start "Imported") marked "Pre-Order" whose page is on the Midas Kuwait English site,
// so "R10 Read product page" can read each one's own page (one page every 10 s, robots.txt).
// A row "R4 Plan rows" already decided from the listing is still read: the product page is recorded as evidence only.
const rows = $('R3 Load catalogue').all().map(i => i.json || {}).filter(r => r && r.sku);
const isPre = v => /^\s*pre[-\s]?order\s*$/i.test(String(v || ''));
const out = rows
  .filter(r => !/^Imported /.test(String(r.notes || '')) && r.active !== false && isPre(r.availability))
  .filter(r => /^https:\/\/(www\.)?midasfurniture\.com\/en\/[^?#]+\.html$/i.test(String(r.url || '')))
  .map(r => ({ json: { row_id: r.id, sku: String(r.sku), name: r.name || '', url: r.url, availability: r.availability } }));
return out;
