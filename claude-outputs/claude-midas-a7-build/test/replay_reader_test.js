// Replays the key fields of the real reader answers from the 15 Oct reader test (executions 386 and 387)
// through the A7 Code nodes, with no client number. Pieces, roles, unknowns, unclear notes, printed counts and
// cropping are as the readers returned them; boxes and long text are left out. No network, no model call.
const { scenario } = require('./harness');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const bin = { photo: { data: PNG, mimeType: 'image/jpeg', fileName: 'main.jpg' } };
const P = (k, role) => ({ label: k, kind: k, role: role || 'product', seen_whole: true });
const pay = (productType) => ({ clientRunId: 'claude-test-a7-replay', mode: 'manual', job: { type: 'New Project' }, item: { productType }, scope: { outcomes: ['Lifestyle'], imageCount: 2 }, references: [{ name: 'main.jpg', role: 'Product' }] });
const E503 = { error: 'Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)' };
const cases = [
  { t: 'Test 1', owner: '2', type: '2-piece sofa with chaise', eye: { category: 'sectional sofa pieces', pieces: [P('sectional chaise'), P('cushion', 'context'), P('one-arm sofa'), P('cushion', 'context')], unknowns: ['configuration of rear backs and dimensions', 'whether throw pillows are included with the sofa'], printed_counts: [], cropped: false },
    second: { total: 2, unclear: ['Two decorative accent pillows (one on each piece) were not counted because they only sit on the product and may be staging items.'], cropped: false } },
  { t: 'Test 2', owner: '2', type: '2-piece sofa with chaise', eye: { category: 'two-piece sectional sofa', pieces: [P('chaise'), P('sofa'), P('cushion', 'context'), P('cushion', 'context')], unknowns: ['total assembled dimensions', 'internal frame and cushion fill composition'], printed_counts: [], cropped: false },
    second: { total: 2, unclear: ['The two decorative throw pillows are not counted as product pieces. They look like accessories placed on the sectional pieces.'], cropped: false } },
  { t: 'Test 3', owner: '3 (to recheck)', type: 'modular sofa', eye: { category: 'modular sectional sofa', pieces: [P('armless seat'), P('armless seat'), P('armless seat'), P('corner seat'), P('armless seat'), P('one-arm seat'), P('coffee table', 'context')], unknowns: ['internal frame material', 'exact dimensions', 'connector hardware mechanism between modules'], printed_counts: [], cropped: true },
    second: { total: 7, unclear: ['exact number of modules in the right-hand return, since the seams are hard to see', 'coffee table and rug look like staging, so they are not counted', 'left inset shows a single module, so it is treated as an inset view and not counted'], cropped: false } },
  { t: 'Test 4', owner: '4', type: 'curved sofa set', eye: { category: 'sofa and armchair set', pieces: [P('sofa'), P('chair'), P('chair'), P('sofa')], unknowns: ['whether both sofas and armchairs are sold together as a set or individually configured', 'swivel mechanism material and base finish details'], printed_counts: [], cropped: false },
    second: { total: 2, unclear: ['The two sofa views and two armchair views look like mirrored or alternate angles of one sofa and one armchair, but they could be two of each (total 4).'], cropped: false } },
  { t: 'Test 5', owner: '4', type: 'classic carved sofa set', eye: { category: 'classical living room sofa set', pieces: [P('armchair'), P('armchair'), P('sofa'), P('sofa')], unknowns: ['backside appearance and construction', 'precise dimensions', 'frame wood species and fabric composition'], printed_counts: [], cropped: false },
    second: { total: 4, unclear: ['The three square swatches at the top are fabric samples, not pieces, so they are not counted', 'Scatter cushions on the seats are treated as accessories and not counted'], cropped: false } },
  { t: 'Test 6', owner: '4 (stool and mirror not in the set)', type: 'bedroom set', eye: { category: 'bedroom furniture set', pieces: [P('bed'), P('nightstand'), P('nightstand'), P('chest of drawers', 'excluded'), P('wardrobe', 'excluded'), P('dresser'), P('mirror'), P('stool'), P('rug', 'context')], unknowns: ['exact interior configurations of drawers and bed frame storage', 'precise upholstery material'], printed_counts: [], cropped: false },
    second: { total: 6, unclear: ['grey floor rug is probably room decor rather than part of the set, so it was not counted', 'right nightstand is partly hidden behind the bed'], cropped: false } },
  { t: 'Test 7', owner: '2', type: 'bookends', eyeRaw: E503, second: { total: 2, unclear: [], cropped: false } },
  { t: 'Test 8', owner: '1 (bed only)', type: 'bed', eye: { category: 'upholstered bed', pieces: [P('bed'), P('nightstand', 'context')], unknowns: ['internal support structure and slat system beneath the mattress', 'exact wood species and fabric composition'], printed_counts: [], cropped: false },
    second: { total: 1, unclear: ['two walnut nightstands, one cropped at the left edge, may be staging or part of a set', 'table lamps and woven rug look like styling props', 'left nightstand and lamp are cut off by the frame edge'], cropped: false } },
  { t: 'Test 9', owner: '15', type: 'dining set', eye: { category: 'dining set', pieces: [P('table'), P('chair'), P('chair'), P('chair'), P('chair'), P('armchair'), P('armchair'), P('cabinet', 'context'), P('mirror', 'context')], unknowns: ['dimensions and exact extension capability if any', 'remaining chairs referenced in text not visible in frame', 'full upholstery fabric composition'], printed_counts: [{ text: 'TABLE', item: 'table', count: 1 }, { text: '12CHAIRS', item: 'chair', count: 12 }, { text: '2 ARMCHAIRS', item: 'armchair', count: 2 }], cropped: true },
    second: { total: 7, unclear: ['The caption says 12 chairs + 2 armchairs, but only 4 chairs and 2 armchairs are visible', 'The armchair at the left edge is partly cut off', 'The chair at the right end may be an armchair or a regular chair', 'Other chairs may be hidden behind the table'], cropped: true } },
  { t: 'Test 10', owner: '7', type: 'dining set', eye: { category: 'dining set', pieces: [P('table'), P('chair'), P('chair'), P('chair'), P('chair'), P('chair'), P('chair')], unknowns: ['exact wood species or veneer construction', 'fabric composition', 'table underside attachment details'], printed_counts: [], signs: [{ sign: 'printed_label', text: 'Ashley FURNITURE HOMESTORE', meaning: 'brand logo' }], cropped: false },
    second: { total: 7, unclear: [], cropped: false } },
];
(async () => {
  const rows = [];
  for (const c of cases) {
    const r = await scenario({ payload: pay(c.type), binary: bin, eye: c.eye, eyeRaw: c.eyeRaw, second: c.second });
    const what = r.contract_ready ? 'proceeds with ' + r.out.inventory.reduce((t, x) => t + x.count, 0) + ' pieces' : 'holds for the ' + r.out.hold_for;
    rows.push({ test: c.t, owner_answer: c.owner, a7: what, reason: r.out.hold_reason || '', client_question: r.out.client_question || '' });
    console.log(c.t.padEnd(8), '| owner', c.owner.padEnd(34), '|', what.padEnd(22), '|', (r.out.client_question || r.out.hold_reason || '').slice(0, 140));
  }
  require('fs').writeFileSync(__dirname + '/replay_results.json', JSON.stringify(rows, null, 1));
})();
