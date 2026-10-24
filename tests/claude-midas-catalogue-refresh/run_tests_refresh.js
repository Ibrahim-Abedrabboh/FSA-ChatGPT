// Local tests for "Claude · Midas catalogue refresh" (16 Oct 2026). No network.
// Run: node tests/claude-midas-catalogue-refresh/run_tests_refresh.js RAW_DIR PY_JSON
// RAW_DIR holds the 19 listing pages read on 16 Oct 2026 by tools/claude-midas-accessories-import.py; PY_JSON is that script's output.
// The pages are not kept in the repo (about 9 MB of site HTML); the test is skipped when they are not given.
const fs = require('fs'), path = require('path');
const N = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-catalogue-refresh', 'code-nodes');
let pass = 0, failN = 0; const ok = (c, n) => { if (c) pass++; else { failN++; console.log('FAIL: ' + n); } };
async function run(file, nodes, input) {
  const $ = n => { if (!(n in nodes)) throw new Error('node not run: ' + n); const v = nodes[n]; return { first: () => v[0], all: () => v }; };
  const items = input || []; const $input = { first: () => items[0], all: () => items };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  // 17 Oct 2026: these tests check the full refresh, so R4 runs in 'full' mode here (the draft default is 'hand-stock-only').
  const code = fs.readFileSync(path.join(N, file), 'utf8').replace("const MODE = 'hand-stock-only';", "const MODE = 'full';");
  return new AsyncFn('$', '$input', 'require', code).call({}, $, $input, require);
}
(async () => {
  const cats = await run('R1_Categories.js', {});
  ok(cats.length === 19 && cats.every(c => /^https:\/\/midasfurniture\.com\/en\/accessories\/.+\.html$/.test(c.json.url) && !/\?/.test(c.json.url)), 'R1: 19 category pages, no query strings');
  const [raw, pyFile] = process.argv.slice(2);
  if (!raw) { console.log('pages not given: parser tests skipped'); console.log(pass + ' passed, ' + failN + ' failed'); return; }
  const pages = cats.map(c => ({ json: { statusCode: 200, body: fs.readFileSync(path.join(raw, c.json.path.replace('/', '__') + '.html'), 'utf8') } }));
  const hand = { id: 9, sku: '173320', notes: '', availability: 'In stock' };
  const imported = { id: 40, sku: '175253', notes: 'Imported 2026-10-01 from …', availability: 'Out of stock' };
  let out = (await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': pages, 'R3 Load catalogue': [{ json: hand }, { json: imported }] }, [{ json: hand }, { json: imported }])).map(x => x.json);
  const py = JSON.parse(fs.readFileSync(pyFile, 'utf8'));
  const s = out[0].summary;
  ok(s.rows_unique === py.rows_unique && s.pages_ok === 19, 'R4 reads the same ' + py.rows_unique + ' unique rows as the Python import: ' + s.rows_unique);
  const ins = out.filter(x => x.action === 'insert').map(x => x.row);
  const pyBy = new Map(py.rows.map(r => [r.sku, r]));
  const same = ins.every(r => { const p = pyBy.get(r.sku); return p && p.name === r.name && p.url === r.url && p.image_url === r.image_url && p.availability === r.availability && p.kind === r.kind; });
  ok(same && ins.length === py.rows_unique - 2, 'R4 rows equal the Python rows field by field (' + ins.length + ' inserts)');
  ok(s.kept_hand_rows.length === 1 && s.kept_hand_rows[0].sku === '173320', 'a hand-written row is never changed');
  const up = out.filter(x => x.action === 'update');
  ok(up.length === 1 && up[0].row_id === 40 && up[0].row.availability === 'In stock' && !('dimensions' in up[0].row), 'a row made by an earlier refresh gets today\'s availability; dimensions untouched');
  ok(ins.every(r => r.dimensions === 'not confirmed' && r.finish === 'not confirmed' && /^Imported \d{4}-\d{2}-\d{2} from the public listing page/.test(r.notes)), 'new rows: dimensions and finish "not confirmed"; source noted');
  // Failure paths.
  const bad = pages.map((p, i) => i === 3 ? { json: { statusCode: 406, body: '' } } : p);
  out = (await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': bad, 'R3 Load catalogue': [] }, [])).map(x => x.json);
  ok(out[0].summary.pages_ok === 18 && out[0].summary.pages.find(x => x.status === 406), 'a refused page is logged; the others are still read');
  out = (await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': pages, 'R3 Load catalogue': [{ json: { error: { message: 'table down' } } }] }, [])).map(x => x.json);
  ok(out.length === 1 && out[0].action === 'none' && /could not be read/.test(out[0].problem), 'catalogue not readable → nothing written');
  out = (await run('R4_Plan_rows.js', { 'R1 Categories': cats, 'R2 Read listing': cats.map(() => ({ json: { statusCode: 406, body: '' } })), 'R3 Load catalogue': [] }, [])).map(x => x.json);
  ok(out.length === 1 && out[0].action === 'none' && out[0].summary.pages_ok === 0, 'every page refused → nothing written');
  console.log(pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
})();
