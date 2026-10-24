// Claude · Midas facet rules (17 Oct 2026, owner decision 00:36 Amman). Code only; no network.
// Uses the approved raw snapshot data/claude-midas-facets-site-2026-10-17.json exactly as read. It never edits a stored value.
//   R1  Matching is case-insensitive ("Faux leather" = "Faux Leather"); both spellings stay in the snapshot.
//   R2  "Stainless Steel" and "Exposed" under Fabric Type stay in the snapshot but are not offered as fabric choices
//       until the owner confirms what they mean.
//   R3  The lists are incomplete (18 pages). A product value not on a list is kept as read and logged "not in snapshot";
//       it is never rejected or replaced with the nearest value.
//   R4  Matching only compares. The product's own value is always returned unchanged.
'use strict';

const HELD = { fabric: ['Stainless Steel', 'Exposed'] }; // R2: held until the owner confirms
const key = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase();

function makeRules(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.facets)) throw new Error('facet snapshot has no facets list');
  const byFacet = {};
  for (const f of snapshot.facets) byFacet[f.facet] = { site_filter: f.site_filter, values: f.values.slice() };
  const heldKeys = facet => new Set((HELD[facet] || []).map(key));

  // R1 + R3 + R4: compare one product value with a facet list. Never throws for an unknown value.
  function match(facet, value) {
    const f = byFacet[facet];
    const asRead = value; // R4: returned exactly as given
    if (!f) return { facet, value: asRead, status: 'unknown facet', snapshot_values: [], offered: false, log: 'facet "' + facet + '" is not in the snapshot' };
    const k = key(value);
    if (!k) return { facet, value: asRead, status: 'empty', snapshot_values: [], offered: false, log: null };
    const hits = f.values.filter(v => key(v) === k); // every spelling that matches, as stored (R1)
    if (!hits.length) return { facet, value: asRead, status: 'not in snapshot', snapshot_values: [], offered: false, log: 'not in snapshot: ' + facet + ' "' + asRead + '" (kept as read)' };
    const held = heldKeys(facet).has(k);
    return { facet, value: asRead, status: held ? 'in snapshot, held' : 'in snapshot', snapshot_values: hits, offered: !held,
      log: held ? 'held: ' + facet + ' "' + asRead + '" is in the snapshot but not offered until the owner confirms its meaning' : null };
  }

  // Choices to offer for a facet: the snapshot values in page order, minus held values (R2).
  // Values that differ only by case are offered once, under the first spelling seen; the snapshot keeps both (R1).
  function choices(facet) {
    const f = byFacet[facet];
    if (!f) return [];
    const held = heldKeys(facet), seen = new Set(), out = [];
    for (const v of f.values) { const k = key(v); if (held.has(k) || seen.has(k)) continue; seen.add(k); out.push(v); }
    return out;
  }

  // A whole product: { fabric: 'Velvet', material: ['Metal', 'Glass'], ... } -> per-value results and a log.
  function checkProduct(product) {
    const results = [], log = [];
    for (const facet of Object.keys(product || {})) {
      const vals = Array.isArray(product[facet]) ? product[facet] : [product[facet]];
      for (const v of vals) { const r = match(facet, v); results.push(r); if (r.log) log.push(r.log); }
    }
    return { results, log, product: product }; // the product object itself is returned untouched (R4)
  }

  return { match, choices, checkProduct, facets: Object.keys(byFacet), held: HELD };
}

module.exports = { makeRules, HELD };
