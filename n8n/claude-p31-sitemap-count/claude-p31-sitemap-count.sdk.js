import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Claude · scratch · P3.1 sitemap count (17 Oct 2026). Unpublished, manual only, read-only. Free: one Midas request, one table read, code.
// Reads the Midas Kuwait English sitemap once (inside the Code node, so the 9.7 MB page is not stored) and the A7 catalogue table,
// and counts the accessory product addresses not yet in the catalogue. Writes nothing anywhere. For the P3.1 plan only.
// Version 2 (as in n8n after execution 472): the separate HTTP node was removed. Execution 473 is the run used in the plan.
const start = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Start', parameters: {} } });

const table = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load catalogue',
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'lwJbRv4TVqlFTILl' }, returnAll: true },
    executeOnce: true,
    alwaysOutputData: true
  }
});

const count = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Count', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `// 17 Oct 2026: the sitemap is read here, so the 9.7 MB page is not stored in the execution (only this summary is).
let sm = { statusCode: 0 }, body = '';
try { const r = await this.helpers.httpRequest({ method: 'GET', url: 'https://midasfurniture.com/sitemap/kw_en/kw_en_sitemap.xml', returnFullResponse: true, json: false, timeout: 180000 });
  sm = { statusCode: r.statusCode }; body = typeof r.body === 'string' ? r.body : String(r.body || ''); } catch (e) { sm = { statusCode: (e.response && e.response.status) || 0, error: String(e.message || e).slice(0, 200) }; }
const locs = (body.match(/<loc>([^<]+)<\\/loc>/g) || []).map(x => x.replace(/<\\/?loc>/g, '').trim());
const en = locs.filter(u => /^https:\\/\\/midasfurniture\\.com\\/en\\/[^?#]+\\.html$/.test(u));
const products = en.filter(u => !/\\/en\\/[^/]+\\/.+\\.html$/.test(u)); // product pages sit right under /en/; category pages have folders
const acc = products.filter(u => /-accessories-/.test(u.split('/').pop()));
const rows = $('Load catalogue').all().map(i => i.json || {}).filter(r => r.sku);
const urls = new Set(rows.map(r => String(r.url || '').trim()));
const skus = new Set(rows.map(r => String(r.sku)));
const skuOf = u => { const m = u.split('/').pop().match(/-(\\d{6})-/); return m ? m[1] : ''; };
const notIn = acc.filter(u => !urls.has(u) && !(skuOf(u) && skus.has(skuOf(u))));
const words = ['lamp', 'cushion', 'throw', 'rug', 'bedding', 'wall-art', 'mirror', 'clock', 'vase', 'pot', 'flower', 'plant', 'tree', 'candle', 'frame', 'figurine', 'sculpture', 'runner', 'tray', 'bowl', 'basket', 'box', 'lantern', 'bookend', 'planter', 'diffuser'];
const byWord = {}; for (const w of words) byWord[w] = notIn.filter(u => u.split('/').pop().indexOf(w) !== -1).length;
const other = notIn.filter(u => !words.some(w => u.split('/').pop().indexOf(w) !== -1));
return [{ json: {
  read_at_utc: new Date().toISOString(), status: sm.statusCode || 0, bytes: body.length,
  locs: locs.length, en_html: en.length, en_products: products.length, accessory_products: acc.length,
  accessory_with_sku_in_address: acc.filter(skuOf).length,
  catalogue_rows: rows.length, accessory_already_in_catalogue: acc.length - notIn.length, accessory_not_in_catalogue: notIn.length,
  not_in_catalogue_by_word: byWord, not_in_catalogue_no_word: other.length,
  sample_not_in_catalogue: notIn.slice(0, 15), sample_no_word: other.slice(0, 15),
  hours_at_one_page_per_11_s: Number((notIn.length * 11 / 3600).toFixed(2))
} }];` } }
});

export default workflow('claude-p31-sitemap-count', 'Claude · scratch · P3.1 sitemap count')
  .add(start).to(table).to(count);
