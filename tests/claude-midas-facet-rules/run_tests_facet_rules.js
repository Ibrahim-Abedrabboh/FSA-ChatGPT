// Local tests for the facet rules (17 Oct 2026, owner 00:36). Uses the real approved snapshot; no network.
// Run: node tests/claude-midas-facet-rules/run_tests_facet_rules.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const { makeRules } = require(path.join(ROOT, 'tools', 'claude-midas-facet-rules.js'));
let pass = 0, failN = 0; const ok = (c, n) => { if (c) pass++; else { failN++; console.log('FAIL: ' + n); } };

const SNAP = path.join(ROOT, 'data', 'claude-midas-facets-site-2026-10-17.json');
const raw = fs.readFileSync(SNAP);
const approval = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claude-midas-facets-approval-2026-10-17.json'), 'utf8'));
const snap = JSON.parse(raw.toString('utf8'));
const before = JSON.stringify(snap);
const R = makeRules(snap);

// The snapshot is the approved one, byte for byte.
ok(crypto.createHash('sha256').update(raw).digest('hex') === approval.snapshot.sha256, 'snapshot file matches the approved hash');
ok(approval.category_urls.length === 18 && approval.category_urls.every(u => /^https:\/\/midasfurniture\.com\/en\/.+\.html$/.test(u.url)), '18 Kuwait /en/ category URLs are recorded');
ok(new Set(approval.category_urls.map(u => u.url)).size === 18, 'the 18 URLs are distinct');

// R1: case-insensitive; both spellings kept.
const tt = snap.facets.find(f => f.facet === 'table top').values;
let m = R.match('table top', 'Faux Leather');
ok(m.status === 'in snapshot' && m.value === 'Faux Leather', 'R1: "Faux Leather" matches table top case-insensitively');
ok(R.match('table top', 'faux leather').status === 'in snapshot' && R.match('table top', 'FAUX LEATHER').status === 'in snapshot', 'R1: any case matches');
ok(tt.includes('Faux leather'), 'R1: the stored spelling "Faux leather" stays as read');
m = R.match('fabric', 'faux leather');
ok(m.status === 'in snapshot' && m.snapshot_values.join() === 'Faux Leather', 'R1: fabric "faux leather" matches the stored "Faux Leather"');
ok(R.match('handles', 'Zinc Alloy').status === 'in snapshot' && R.match('handles', 'Zinc Alloy').snapshot_values[0] === 'zinc alloy', 'R1: "Zinc Alloy" matches the stored lower-case "zinc alloy"');

// R2: held fabric values.
for (const v of ['Stainless Steel', 'Exposed', 'exposed']) {
  m = R.match('fabric', v);
  ok(m.status === 'in snapshot, held' && m.offered === false && /held/.test(m.log), 'R2: fabric "' + v + '" is in the snapshot but not offered');
}
const fc = R.choices('fabric');
ok(!fc.includes('Stainless Steel') && !fc.includes('Exposed') && fc.length === 17, 'R2: fabric choices leave out the 2 held values (17 offered)');
ok(R.choices('material').includes('Stainless Steel') && R.choices('handles').includes('Stainless Steel'), 'R2: the hold is for Fabric only; Stainless Steel stays a material and handle choice');
ok(snap.facets.find(f => f.facet === 'fabric').values.includes('Exposed'), 'R2: "Exposed" stays in the snapshot');

// R3: unknown values kept as read, logged, never rejected or replaced.
m = R.match('fabric', 'Velour');
ok(m.status === 'not in snapshot' && m.value === 'Velour' && m.snapshot_values.length === 0, 'R3: "Velour" is kept as read, no nearest value');
ok(m.log === 'not in snapshot: fabric "Velour" (kept as read)', 'R3: it is logged "not in snapshot"');
m = R.match('fabric', 'Velvets');
ok(m.status === 'not in snapshot' && m.value === 'Velvets', 'R3: a near miss ("Velvets") is not turned into "Velvet"');
let threw = false; try { R.match('colour family', 'Charcoal'); } catch (e) { threw = true; }
ok(!threw, 'R3: an unknown value never throws');

// R4: nothing is changed.
const product = { fabric: 'Faux leather', material: ['Metal', 'Rattan'], 'colour family': 'Off-white' };
const copy = JSON.stringify(product);
const c = R.checkProduct(product);
ok(JSON.stringify(product) === copy && c.product === product, 'R4: the product is returned untouched');
ok(c.results.map(r => r.value).join('|') === 'Faux leather|Metal|Rattan|Off-white', 'R4: every value comes back exactly as given');
ok(c.log.length === 1 && /Rattan/.test(c.log[0]), 'R3/R4: only the unknown value is logged');
ok(JSON.stringify(snap) === before, 'R4: the snapshot object is not changed by any call');
ok(R.choices('table top').filter(v => v.toLowerCase() === 'faux leather').length === 1, 'choices offer a case-only duplicate once');
ok(R.match('style', 'Modern').status === 'unknown facet', 'a facet not in the snapshot is reported, not guessed');

console.log(pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
