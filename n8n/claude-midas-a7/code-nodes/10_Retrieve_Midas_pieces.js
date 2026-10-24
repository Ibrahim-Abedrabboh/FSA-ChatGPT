// Step 10 · Stylist retrieve: shortlist genuine Midas supporting pieces from the A7 catalogue table. Code only, no model.
// Nothing is called a Midas product without its SKU, catalogue photo and the date it was read. Out-of-stock pieces are not offered.
// The client's picks are fixed choices: a pick that cannot be used becomes one client question (hold), never a silent drop.
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
const s = out('09b Contract');
const rows = $input.all().map(i => i.json).filter(r => r && r.sku);
const b = s.brief;
const MAX_MIDAS = 3;      // per job, across all scene shots (stylist skill default)
const MAX_SHORTLIST = 12; // the planner sees at most 12 candidates
const SKIP = ['set', 'pcs', 'pc', 'piece', 'pieces', 'and', 'with', 'of', 'the', 'a', 'large', 'small', 'medium'];
function words(t) { return String(t || '').toLowerCase().replace(/[^a-z ]+/g, ' ').split(' ').filter(Boolean); }
function sing(w) { return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w; }
// Head noun: the last meaningful word ("table lamp" → lamp, "centre and side table set" → table).
function head(t) { const w = words(t).map(sing).filter(x => SKIP.indexOf(x) === -1); return w.length ? w[w.length - 1] : ''; }
function avail(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (/out[\s-]*of[\s-]*stock|sold[\s-]*out|unavailable|discontinued/.test(t)) return 'out_of_stock'; // mixed text counts as out of stock (safe side)
  if (t === 'in stock') return 'in_stock';
  if (t === 'pre-order' || t === 'pre order' || t === 'preorder') return 'pre_order';
  return 'not_confirmed';
}
const sceneOutputs = s.outputs.filter(o => o.kind !== 'white');
const productHeads = new Set([b.product_type, b.category, s.observation.category_seen].concat(s.inventory.map(r => r.item)).map(head).filter(Boolean));
const excludedHeads = new Set(s.exclusions.map(x => head(x.item)).filter(Boolean));
const picks = (b.midas_picks || []).map(x => String(x).trim()).filter(Boolean);
const shortlist = [];
const rejected = [];
const critical = [];
const notes = [];
function card(r) {
  return { sku: String(r.sku), name: r.name || '', kind: r.kind || '', catalogue_photo: r.image_url, url: r.url || '', dimensions: r.dimensions || 'not confirmed', finish: r.finish || 'not confirmed',
    availability: avail(r.availability), availability_text: r.availability || '', retrieved_on: r.retrieved, notes: r.notes || '',
    tags: { visual_weight: r.visual_weight || null, silhouette: r.silhouette || null, texture: r.texture || null, style: r.style || null, colour_hex: r.colour_hex || null, basis: r.tags_basis || '' } };
}
function why(r) {
  if (!r.image_url || !r.retrieved) return 'no catalogue photo or no date it was read';
  if (r.active === false) return 'not offered at the moment';
  const a = avail(r.availability);
  if (a === 'out_of_stock') return 'out of stock as read on ' + r.retrieved;
  // Owner, 16 Oct 2026 (D10): in stock only, for every piece. Pre-order or an unknown stock state is not offered.
  if (a !== 'in_stock') return (a === 'pre_order' ? 'pre-order' : 'stock not confirmed') + ' as read on ' + r.retrieved + '; only pieces in stock are used';
  // D10: the Midas Kuwait English site only (https://midasfurniture.com/en/...).
  if (!/^https:\/\/(www\.)?midasfurniture\.com\/en\//i.test(String(r.url || ''))) return 'its page is not on the Midas Kuwait English site (midasfurniture.com/en/)';
  const h = head(r.kind || r.name);
  // Midas cushions and throws are not offered in Studio scenes (owner, 16 Oct 2026, decision 25, as F1's prop sets); the product's own
  // cushions stay exactly as the vendor photo shows them.
  if (h === 'cushion' || h === 'throw' || h === 'pillow') return 'Midas cushions and throws are not offered in Studio scenes (owner, 16 Oct 2026)';
  if (excludedHeads.has(h)) return 'the job excludes ' + h;
  if (productHeads.has(h)) return 'same kind as the product (' + h + ')';
  return '';
}
const pickProblems = [];
if (!sceneOutputs.length) {
  notes.push('White background only: no supporting pieces are used, so no retrieval was needed.');
  if (picks.length) critical.push({ what: 'midas_pick', who: 'client', why: 'Midas item(s) ' + picks.join(', ') + ' were picked, but the job asks only for white background images, which show the product alone.', question: 'You picked Midas item(s) ' + picks.join(', ') + ', but white background images show the product alone. Should we leave them out, or add a room image to the job?' });
}
else {
  // 1. Client picks: fixed, but only when they can be used.
  for (const p of picks) {
    const r = rows.find(x => String(x.sku) === p);
    if (!r) { pickProblems.push({ sku: p, why: 'not in our catalogue list', ask: 'we could not find the Midas item ' + p + '; please check the item number, or remove it' }); continue; }
    const w = why(r);
    if (w) { pickProblems.push({ sku: p, why: w, ask: 'the Midas item ' + p + ' (' + (r.name || r.kind) + ') cannot be shown in this job (' + w + '); should we leave it out?' }); continue; }
    const c = card(r); c.fixed = true;
    shortlist.push(c);
  }
  // Every pick problem goes into one client question, so the client answers once.
  if (pickProblems.length) critical.push({ what: 'midas_pick', who: 'client', why: 'Picked Midas item(s) cannot be used: ' + pickProblems.map(x => x.sku + ' (' + x.why + ')').join('; ') + '.',
    question: pickProblems.length === 1 ? pickProblems[0].ask.charAt(0).toUpperCase() + pickProblems[0].ask.slice(1) + '.' : 'About the Midas items you picked: ' + pickProblems.map((x, i) => (i + 1) + ') ' + x.ask).join(' ') + '.' });
  if (picks.length > MAX_MIDAS) critical.push({ what: 'midas_pick', who: 'client', why: picks.length + ' Midas items picked; at most ' + MAX_MIDAS + ' fit one scene.', question: 'You picked ' + picks.length + ' Midas items. Please choose at most ' + MAX_MIDAS + '.' });
  // 2. Studio candidates: everything else that passes the filters.
  // 16 Oct 2026: the catalogue now holds hundreds of accessories, so the 12 places are shared out by kind: the kinds that suit
  // the room come first (ORDER, by the profile's prop policy), at most 2 per kind, in-stock first, newest reading first.
  const ORDER = {
    living: ['centre table', 'side table', 'rug', 'floor lamp', 'wall art', 'vase', 'decor object', 'tray', 'table lamp', 'artificial plant', 'candle holder', 'mirror'],
    bedroom: ['bedding set', 'table lamp', 'rug', 'wall art', 'wall lamp', 'mirror', 'vase', 'artificial plant', 'photo frame', 'table clock'],
    dining: ['table runner', 'vase', 'candle holder', 'tray', 'wall art', 'ceiling lamp', 'artificial plant', 'rug', 'mirror'],
    chairs: ['floor lamp', 'side table', 'rug', 'table lamp', 'wall art', 'artificial plant', 'decor object'],
    tables: ['vase', 'decor object', 'tray', 'candle holder', 'artificial plant', 'table lamp', 'rug', 'photo frame', 'wall art'],
    accessories: ['wall art', 'artificial plant', 'vase', 'table lamp', 'candle holder', 'decor object']
  };
  const policy = String((s.profile && s.profile.prop_policy) || 'none');
  const order = ORDER[policy] || ORDER.living;
  if (!ORDER[policy]) notes.push('Prop policy "' + policy + '" has no kind order; the living-room order is used.');
  const rankOf = k => { const t = String(k || '').toLowerCase().trim(); const i = order.findIndex(o => o === t || head(o) === head(t)); return i === -1 ? 99 : i; };
  const rest = rows.filter(r => picks.indexOf(String(r.sku)) === -1);
  const groups = new Map();
  let soft = 0; // Midas cushions and throws: counted in one line, not listed one by one
  for (const r of rest) {
    const w = why(r);
    if (w && /cushions and throws are not offered/.test(w)) { soft++; continue; }
    if (w) { rejected.push({ sku: String(r.sku), name: r.name || '', reason: w }); continue; }
    const a = avail(r.availability);
    if (a === 'not_confirmed') { rejected.push({ sku: String(r.sku), name: r.name || '', reason: 'availability not confirmed (' + (r.availability || 'blank') + ')' }); continue; }
    const k = String(r.kind || r.name || '').toLowerCase().trim();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(card(r));
  }
  if (soft) rejected.push({ sku: '', name: soft + ' Midas cushion(s) and throw(s)', reason: 'not offered in Studio scenes (owner, 16 Oct 2026); the product\'s own cushions stay as the vendor photo shows them' });
  const kinds = Array.from(groups.keys()).sort((x, y) => rankOf(x) - rankOf(y) || (x < y ? -1 : x > y ? 1 : 0));
  for (const k of kinds) groups.get(k).sort((x, y) => (x.availability === 'in_stock' ? 0 : 1) - (y.availability === 'in_stock' ? 0 : 1) || String(y.retrieved_on).localeCompare(String(x.retrieved_on)) || String(x.sku).localeCompare(String(y.sku)));
  const room = Math.max(0, MAX_SHORTLIST - shortlist.length);
  const taken = [];
  for (let round = 0; round < 2 && taken.length < room; round++) for (const k of kinds) { if (taken.length >= room) break; const g = groups.get(k); if (g[round]) taken.push(g[round]); }
  const takenSku = new Set(taken.map(c => c.sku));
  for (const c of taken) shortlist.push(c);
  // Usable pieces left out only for lack of places are counted, not listed one by one (the catalogue can hold hundreds).
  const left = kinds.reduce((t, k) => t + groups.get(k).filter(c => !takenSku.has(c.sku)).length, 0);
  if (left) rejected.push({ sku: '', name: left + ' more usable piece(s)', reason: 'not in the ' + MAX_SHORTLIST + ' places (at most 2 per kind; kind order for ' + (ORDER[policy] ? policy : 'living') + ' rooms)' });
  if (!rows.length) notes.push('The catalogue table returned no rows: scene shots show the product in the room shell only, with no supporting pieces.');
}
const now = new Date().toISOString();
const ownerFirst = critical.filter(c => c.who === 'owner').concat(critical.filter(c => c.who !== 'owner'));
return [{ json: {
  ...s, stage: '03 Retrieve & style', plan_stage: true,
  retrieval: { shortlist, rejected, picks, max_midas: Math.min(MAX_MIDAS, shortlist.length), notes, catalogue_rows: rows.length },
  scene_outputs: sceneOutputs.length,
  critical: s.critical.concat(ownerFirst),
  client_question: ownerFirst.length ? (ownerFirst.some(c => c.who === 'owner') ? '' : ownerFirst[0].question) : s.client_question,
  trail: s.trail.concat([{ step: 10, name: 'Retrieve', at: now, note: shortlist.length + ' shortlisted (' + shortlist.filter(x => x.fixed).length + ' client picks), ' + rejected.length + ' rejected, ' + critical.length + ' pick problems' }])
} }];
