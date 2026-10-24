// Local tests for the refresh hand-stock rule (17 Oct 2026). Code-made pages and rows only; no network, no n8n.
// Run: node tests/claude-midas-catalogue-refresh/run_tests_hand_stock.js
const fs = require('fs'), path = require('path');
const N = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-catalogue-refresh', 'code-nodes');
let pass = 0, failN = 0; const ok = (c, n) => { if (c) pass++; else { failN++; console.log('FAIL: ' + n); } };
const SRC = fs.readFileSync(path.join(N, 'R4_Plan_rows.js'), 'utf8');
async function run(nodes, mode) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  let code = SRC;
  if (mode) { code = code.replace("const MODE = 'hand-stock-only';", "const MODE = '" + mode + "';"); if (code === SRC && mode !== 'hand-stock-only') throw new Error('mode line not found'); }
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return (await new AsyncFn('$', '$input', code).call({}, $, { first: () => null, all: () => [] })).map(x => x.json);
}
const li = (sku, inStock, name) => '<li class="item product product-item"><a class="product-item-link" href="https://midasfurniture.com/en/p-' + sku + '.html">' + (name || 'ITEM ' + sku) + '</a>' +
  '<span data-product-sku="' + sku + '"></span><img data-src="https://midasfurniture.com/media/catalog/product/x/' + sku + '.webp"/>' +
  '<div data-in-stock="' + (inStock ? 1 : 0) + '"></div><span data-price-amount="10.5" data-price-type="finalPrice"></span></li>';
const page = items => '<html><span class="toolbar-number">1</span><span class="toolbar-number">' + items.length + '</span><span class="toolbar-number">' + items.length + '</span><ol>' + items.join('') + '</ol></html>';
const cats = [{ json: { path: 'lighting/table-lamps', kind: 'table lamp', url: 'https://midasfurniture.com/en/accessories/lighting/table-lamps.html' } }];
const listing = [{ json: { statusCode: 200, body: page([li('174770', true), li('174788', true), li('174781', true), li('900001', true), li('900002', false)]) } }];
const table = [
  { id: 6, sku: '174770', name: 'RENESMEE table lamp', notes: 'Vendor depth is missing.', availability: 'Out of stock', retrieved: '2026-09-28', dimensions: 'W42 × H60 cm; depth omitted' },
  { id: 8, sku: '174788', name: 'White/gold table lamp', notes: 'Vendor title spells gold as GOILD; depth omitted.', availability: 'Pre-Order', retrieved: '2026-09-28' },
  { id: 7, sku: '174781', name: 'OAKLYNN table lamp', notes: '', availability: 'Out of stock', retrieved: '2026-09-28' }, // hand row NOT on the owner's list
  { id: 50, sku: '900002', notes: 'Imported 2026-10-15 from …', availability: 'In stock' }
].map(json => ({ json }));
const nodes = (t, l) => ({ 'R1 Categories': cats, 'R2 Read listing': l || listing, 'R3 Load catalogue': t || table });

(async () => {
  // 1. This draft's mode: only the two owner-listed hand rows, only their availability.
  let out = await run(nodes());
  const hs = out.filter(x => x.action === 'hand_stock');
  ok(out.every(x => x.action === 'hand_stock'), 'hand-stock-only: no insert and no imported-row update are sent');
  ok(hs.length === 2 && hs.map(x => x.sku).sort().join() === '174770,174788', 'both owner-listed rows get a stock update');
  ok(hs.every(x => JSON.stringify(Object.keys(x.row).sort()) === '["availability","stock_checked"]'), 'only the stock fields are written (availability, stock_checked; 17 Oct 00:36)');
  ok(hs.find(x => x.sku === '174770').before === 'Out of stock' && hs.find(x => x.sku === '174770').row.availability === 'In stock', '174770: before Out of stock, after In stock');
  ok(hs.find(x => x.sku === '174788').before === 'Pre-Order' && hs.find(x => x.sku === '174788').row.availability === 'In stock', '174788: before Pre-Order, after In stock');
  ok(hs.find(x => x.sku === '174770').row_id === 6 && hs.find(x => x.sku === '174788').row_id === 8, 'updates target the right row ids');
  const s = out[0].summary;
  ok(s.mode === 'hand-stock-only' && s.held_by_mode.insert === 1 && s.held_by_mode.update === 1, 'held writes are counted (1 insert, 1 imported update)');
  ok(s.kept_hand_rows.some(k => k.sku === '174781' && /not changed/.test(k.why)), 'a hand row not on the list stays unchanged even when stock differs (174781)');
  ok(s.hand_stock.length === 2 && s.hand_stock.every(h => h.before && h.after), 'summary lists before and after');

  // 2. No change when the stock already matches.
  const same = table.map(t => ({ json: Object.assign({}, t.json, t.json.sku === '174770' || t.json.sku === '174788' ? { availability: 'In stock' } : {}) }));
  out = await run(nodes(same));
  ok(out.length === 1 && out[0].action === 'none', 'stock already matches → nothing written');
  ok(out[0].summary.kept_hand_rows.filter(k => /owner's stock list/.test(k.why)).length === 2, 'the reason says the stock already matches');

  // 3. Out of stock on the listing is written as it is read (no guess either way).
  const oos = [{ json: { statusCode: 200, body: page([li('174770', false), li('174788', true)]) } }];
  out = await run(nodes(table.map(t => ({ json: Object.assign({}, t.json, { availability: 'In stock' }) })), oos));
  ok(out.length === 1 && out[0].action === 'hand_stock' && out[0].sku === '174770' && out[0].row.availability === 'Out of stock', 'listing out of stock → written as Out of stock');

  // 4. A listing with no stock flag never overwrites a hand row.
  const noflag = [{ json: { statusCode: 200, body: page([li('174770', true).replace(/<div data-in-stock="1"><\/div>/, '')]) } }];
  out = await run(nodes(undefined, noflag));
  ok(out.length === 1 && out[0].action === 'none', 'no stock flag on the listing → hand row not changed');

  // 5. Full mode keeps the 16 Oct behaviour and adds the hand-stock rule.
  out = await run(nodes(), 'full');
  ok(out.filter(x => x.action === 'insert').length === 1 && out.filter(x => x.action === 'update').length === 1 && out.filter(x => x.action === 'hand_stock').length === 2, 'full mode: insert, imported update and hand stock');
  ok(out.find(x => x.action === 'update').row_id === 50, 'full mode: imported row updated by id');

  // 6. Safety paths kept.
  out = await run(nodes([{ json: { error: { message: 'table down' } } }]));
  ok(out.length === 1 && out[0].action === 'none' && /could not be read/.test(out[0].problem), 'catalogue not readable → nothing written');
  out = await run(nodes(undefined, [{ json: { statusCode: 406, body: '' } }]));
  ok(out.length === 1 && out[0].action === 'none', 'listing refused → nothing written');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})();
