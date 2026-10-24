// Local tests for the refresh rules of 17 Oct 2026, 00:36: stock_checked on every stock write; hand rows marked "Pre-Order".
// Code-made pages and rows only; no network, no n8n. Run: node tests/claude-midas-catalogue-refresh/run_tests_preorder.js
const fs = require('fs'), path = require('path');
const N = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-catalogue-refresh', 'code-nodes');
let pass = 0, failN = 0; const ok = (c, n) => { if (c) pass++; else { failN++; console.log('FAIL: ' + n); } };
async function run(file, nodes, mode, execId) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  let code = fs.readFileSync(path.join(N, file), 'utf8');
  if (mode) code = code.replace("const MODE = 'hand-stock-only';", "const MODE = '" + mode + "';");
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return (await new AsyncFn('$', '$input', '$execution', code).call({}, $, { first: () => null, all: () => [] }, { id: execId || '999' })).map(x => x.json);
}
const li = (sku, inStock) => '<li class="item product product-item"><a class="product-item-link" href="https://midasfurniture.com/en/p-' + sku + '.html">ITEM ' + sku + '</a>' +
  '<span data-product-sku="' + sku + '"></span><img data-src="https://midasfurniture.com/media/catalog/product/x/' + sku + '.webp"/><div data-in-stock="' + (inStock ? 1 : 0) + '"></div></li>';
const page = items => '<html><ol>' + items.join('') + '</ol></html>';
const cats = [{ json: { path: 'lighting/table-lamps', kind: 'table lamp', url: 'https://midasfurniture.com/en/accessories/lighting/table-lamps.html' } }];
const hand = (id, sku, availability, extra) => ({ json: Object.assign({ id, sku, notes: 'hand note', availability, retrieved: '2026-09-28', active: true, url: 'https://midasfurniture.com/en/p-' + sku + '.html' }, extra || {}) });

(async () => {
  // ---- R4: stock_checked and the listing rules for "Pre-Order" hand rows ----
  const table = [hand(1, '500001', 'Pre-Order'), hand(2, '500002', 'Pre-Order'), hand(3, '500003', 'Pre-Order', { active: false }),
    hand(4, '174770', 'Out of stock'), { json: { id: 50, sku: '500050', notes: 'Imported 2026-10-15 …', availability: 'In stock' } }];
  const listing = [{ json: { statusCode: 200, body: page([li('500001', true), li('500002', false), li('500003', true), li('174770', true), li('500050', false), li('500099', true)]) } }];
  let out = await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': listing, 'R3 Load catalogue': table }, null, '777');
  const by = s => out.find(x => x.sku === s) || {};
  ok(by('500001').action === 'hand_stock' && by('500001').row.availability === 'In stock', 'Pre-Order + listing In stock -> In stock');
  ok(/refresh run 777; listing said In stock$/.test(by('500001').row.stock_checked) && / Amman, /.test(by('500001').row.stock_checked), 'stock_checked says when, which run, what the listing said');
  ok(!('retrieved' in by('500001').row), 'the date read (retrieved) is never written on a hand row');
  ok(by('500002').action === 'hand_note' && !('availability' in by('500002').row), 'Pre-Order + listing out of stock -> availability not written');
  ok(/kept "Pre-Order".*FLAG for the owner/.test(by('500002').row.stock_checked), 'that row is flagged, with the date, in stock_checked');
  ok(!out.some(x => x.sku === '500003'), 'an inactive hand row is not touched');
  ok(by('174770').action === 'hand_stock' && /listing said In stock/.test(by('174770').row.stock_checked), 'owner list row also gets stock_checked');
  const s = out[0].summary;
  ok(s.flags.length === 1 && s.flags[0].sku === '500002', 'summary lists the flag');
  ok(s.held_by_mode.insert === 1 && s.held_by_mode.update === 1 && !out.some(x => x.action === 'insert' || x.action === 'update'), 'hand-stock-only mode still holds back inserts and updates');
  out = await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': listing, 'R3 Load catalogue': table }, 'full', '778');
  const ins = out.find(x => x.action === 'insert'), upd = out.find(x => x.action === 'update');
  ok(ins && /refresh run 778; listing said In stock$/.test(ins.row.stock_checked), 'full mode: an insert fills stock_checked');
  ok(upd && /refresh run 778; listing said Out of stock$/.test(upd.row.stock_checked), 'full mode: an imported-row update fills stock_checked');

  // ---- R9: which rows get their product page read ----
  const r9table = [hand(1, '600001', 'Pre-Order'), hand(2, '600002', 'In stock'), hand(3, '600003', 'pre order'), hand(4, '600004', 'Pre-Order', { active: false }),
    hand(5, '600005', 'Pre-Order', { url: 'https://midasfurniture.com/ksa_en/x.html' }), { json: { id: 6, sku: '600006', notes: 'Imported …', availability: 'Pre-Order', url: 'https://midasfurniture.com/en/x.html' } }];
  const r9 = await run('R9_Preorder_rows.js', { 'R3 Load catalogue': r9table });
  ok(r9.map(x => x.sku).join() === '600001,600003', 'R9: active hand rows marked Pre-Order on Kuwait /en/ only');

  // ---- R12: product page and sitemap verdicts ----
  const asked = ['700001', '700002', '700003', '700004', '700005', '700006', '700007', '700008'].map((sku, i) => ({ json: { row_id: 10 + i, sku, url: 'https://midasfurniture.com/en/p-' + sku + '.html' } }));
  const sitemap = { json: { statusCode: 200, body: '<urlset><url><loc>https://midasfurniture.com/en/p-700002.html</loc></url></urlset>' } };
  const P = (status, body) => ({ json: { statusCode: status, body } });
  const pages = [
    P(404, ''),                                                                            // 700001 gone, not in sitemap -> inactive
    P(404, ''),                                                                            // 700002 gone but in sitemap -> flag
    P(200, '<div>SKU: 700003</div><button type="button">Pre-Order Now</button>'),             // pre-order button -> evidence
    P(200, '<div class="stock available">In stock</div> Add to Cart SKU: 700004'),           // page in stock -> flag, no change
    P(200, '<div class="stock unavailable">Out of stock</div> SKU: 700005'),                 // out of stock, no pre-order -> keep, flag
    P(200, '<div>SKU: 999999</div><div class="stock available"></div>'),                    // another SKU -> flag
    P(500, ''),                                                                            // refused -> flag
    P(200, '<nav><a>Pre-order collection</a></nav><div>SKU: 700008</div>')                    // menu link only, no buying control -> not evidence
  ];
  let v = await run('R12_Preorder_verdict.js', { 'R9 Pre-order hand rows': asked, 'R10 Read product page': pages, 'R11 Read Kuwait sitemap': [sitemap], 'R4 Plan rows': [] }, null, '880');
  const vb = s2 => v.find(x => x.sku === s2) || {};
  ok(vb('700001').action === 'inactive' && vb('700001').row.active === false && !('availability' in vb('700001').row), '404 + not in sitemap -> inactive, availability kept');
  ok(vb('700002').action === 'hand_note' && /still in the Kuwait English sitemap/.test(vb('700002').row.stock_checked), '404 but in sitemap -> no change, flagged');
  ok(vb('700003').action === 'hand_note' && /pre-order button on the page \("Pre-Order Now"\)/.test(vb('700003').row.stock_checked), 'pre-order button recorded as evidence');
  ok(/says in stock.*FLAG/.test(vb('700004').row.stock_checked) && !('availability' in vb('700004').row), 'page in stock -> no change, flagged');
  ok(/out of stock and shows no pre-order; kept "Pre-Order"/.test(vb('700005').row.stock_checked), 'page out of stock -> keep Pre-Order, flagged');
  ok(/another SKU \(999999\)/.test(vb('700006').row.stock_checked), 'another SKU -> flagged');
  ok(/did not answer \(status 500\)/.test(vb('700007').row.stock_checked), 'refused -> flagged');
  ok(/no stock signal/.test(vb('700008').row.stock_checked), 'a menu link alone is not pre-order evidence');
  ok(v.every(x => !('availability' in x.row) && !('retrieved' in x.row)), 'R12 never writes availability or the date read');
  ok(v.every(x => /refresh run 880; /.test(x.row.stock_checked)), 'every R12 write carries the run and time');
  // Sitemap unreadable: a 404 is never turned inactive.
  v = await run('R12_Preorder_verdict.js', { 'R9 Pre-order hand rows': [asked[0]], 'R10 Read product page': [pages[0]], 'R11 Read Kuwait sitemap': [P(406, '')], 'R4 Plan rows': [] });
  ok(v.length === 1 && v[0].action === 'hand_note' && /sitemap could not be read/.test(v[0].row.stock_checked), 'sitemap unreadable -> no inactive, flagged');
  // A row R4 already decided from the listing gets no second write.
  v = await run('R12_Preorder_verdict.js', { 'R9 Pre-order hand rows': [asked[0]], 'R10 Read product page': [pages[0]], 'R11 Read Kuwait sitemap': [sitemap], 'R4 Plan rows': [{ json: { action: 'hand_stock', sku: '700001' } }] });
  ok(v.length === 1 && v[0].action === 'none' && /listing decided/.test(v[0].preorder_log[0].verdict), 'listing decision wins; no second write');
  // No pre-order rows at all.
  v = await run('R12_Preorder_verdict.js', { 'R9 Pre-order hand rows': [], 'R10 Read product page': [], 'R11 Read Kuwait sitemap': [], 'R4 Plan rows': [] });
  ok(v.length === 1 && v[0].action === 'none', 'nothing to check -> nothing written');

  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})();
