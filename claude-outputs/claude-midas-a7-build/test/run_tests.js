const { scenario } = require('./harness');
const { autoPlan: autoPlan2, failWith, decisionCheck, forwardResult } = require('./harness');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
const prod = { photo: { data: PNG, mimeType: 'image/png', fileName: 'sofa.png' } };
const sofaInv = [{ item: 'left-arm piece', count: 1 }, { item: 'armless piece', count: 4 }, { item: 'corner piece', count: 1 }, { item: 'right-arm piece', count: 1 }];
const piece = (k, role) => ({ label: k, kind: k, box: [100, 100, 400, 300], seen_whole: true, role: role || 'product' });
const sevenEye = { category: 'sectional sofa', pieces: [piece('left-arm piece'), piece('armless'), piece('armless'), piece('armless'), piece('armless'), piece('corner'), piece('right-arm piece')], signs: [], printed_counts: [], colour_observed: 'warm grey', design_locks: ['boucle grey upholstery'], sided_parts: ['left-arm piece', 'right-arm piece'], unknowns: ['back of the sofa'], cropped: false };
const fiveEye = { ...sevenEye, pieces: sevenEye.pieces.slice(0, 5) };
// 16 Oct 2026 (owner, 04:16): a lifestyle job's scene images follow the view choice. The base job asks for "Wide view + close-up"
// (white master, wide, detail: three outputs, as the two lifestyle scenes gave before), so the scenarios keep their meaning.
const base = (extra) => Object.assign({ clientRunId: 'claude-test-a7-0001', mode: 'manual', job: { type: 'New Project', workOn: 'one_by_one' }, item: { productType: 'Sectional sofa', inventory: sofaInv }, scope: { outcomes: ['Lifestyle'], view: 'Wide view + close-up', imageCount: 3 }, references: [{ name: 'sofa.png', role: 'Product' }] }, extra);
const noNumber = (productType) => base({ item: { productType } });
const E503 = { error: 'Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)' };
const ownerHold = r => r.path === 'hold' && r.out.hold_for === 'owner' && r.out.client_question === '' && r.row.client_question === '';
// Reader replies modelled on the real 15 Oct reader test (runs 386 and 387).
const test6Eye = { category: 'bedroom furniture set', pieces: [piece('bed'), piece('nightstand'), piece('nightstand'), piece('chest of drawers', 'excluded'), piece('wardrobe', 'excluded'), piece('dresser'), piece('mirror'), piece('stool'), piece('rug', 'context')], signs: [{ sign: 'cross', text: 'X', meaning: 'tall chest is excluded' }, { sign: 'cross', text: 'X', meaning: 'wardrobe is excluded' }], printed_counts: [], colour_observed: 'off-white with champagne gold accents', design_locks: [], sided_parts: [], unknowns: ['precise upholstery material'], cropped: false };
const test6Second = { pieces: [{ kind: 'bed', count: 1 }, { kind: 'nightstand', count: 2 }, { kind: 'dresser', count: 1 }, { kind: 'dresser mirror', count: 1 }, { kind: 'stool', count: 1 }], excluded: [{ kind: 'tall chest of drawers', count: 1 }, { kind: 'wardrobe', count: 1 }], total: 6, unclear: ['grey floor rug is probably room decor rather than part of the set, so it was not counted', 'right nightstand is partly hidden behind the bed'], cropped: false };
const test8Eye = { category: 'upholstered bed', pieces: [piece('bed'), piece('nightstand', 'context')], signs: [], printed_counts: [], colour_observed: 'light grey fabric with warm brown wood', design_locks: [], sided_parts: [], unknowns: ['exact wood species'], cropped: false };
const test8Second = { pieces: [{ kind: 'upholstered bed frame', count: 1 }], excluded: [], total: 1, unclear: ['two walnut nightstands, one cropped at the left edge, may be staging or part of a set', 'table lamps and woven rug look like styling props'], cropped: false };
const test1Eye = { category: 'sectional sofa pieces', pieces: [piece('sectional chaise'), piece('cushion', 'context'), piece('one-arm sofa'), piece('cushion', 'context')], signs: [], printed_counts: [], colour_observed: 'light beige', design_locks: [], sided_parts: ['left-side chaise piece', 'right-arm sofa unit'], unknowns: ['whether throw pillows are included with the sofa'], cropped: false };
const test1Second = { pieces: [{ kind: 'chaise sectional piece', count: 1 }, { kind: 'sofa sectional piece', count: 1 }], excluded: [], total: 2, unclear: ['Two decorative accent pillows (one on each piece) were not counted because they only sit on the product and may be staging items.'], cropped: false };
const test9Eye = (cropped) => ({ category: 'dining set', pieces: [piece('table')].concat([1, 2, 3, 4].map(() => piece('chair')), [piece('armchair'), piece('armchair'), piece('sideboard cabinet', 'context')]), signs: [{ sign: 'printed_count', text: 'TABLE+12CHAIRS + 2 ARMCHAIRS' }], printed_counts: [{ text: 'TABLE', item: 'table', count: 1 }, { text: '12CHAIRS', item: 'chair', count: 12 }, { text: '2 ARMCHAIRS', item: 'armchair', count: 2 }], colour_observed: 'antique gold with ivory upholstery', design_locks: [], sided_parts: [], unknowns: ['remaining chairs referenced in text not visible in frame'], cropped });
const test9Second = (cropped) => ({ pieces: [{ kind: 'dining table', count: 1 }, { kind: 'dining chair', count: 4 }, { kind: 'armchair', count: 2 }], excluded: [], total: 7, unclear: ['The caption says 12 chairs + 2 armchairs, but only 4 chairs and 2 armchairs are visible'], cropped });
const test4Eye = { category: 'sofa and armchair set', pieces: [piece('sofa'), piece('chair'), piece('chair'), piece('sofa')], signs: [{ sign: 'swatch', text: '', meaning: 'cream/grey boucle option' }, { sign: 'swatch', text: '', meaning: 'rust red velvet option' }], printed_counts: [], colour_observed: 'sofas light grey; chairs dusty rose with dark back', swatch_colours: ['cream grey', 'rust red', 'brown leather'], design_locks: [], sided_parts: ['left-hand curved sofa', 'right-hand curved sofa'], unknowns: [], cropped: false };
const tests = [
  { name: 'S1 sectional, counts agree with client', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7, pieces: [{ kind: 'seat module', count: 7 }] } },
    check: r => r.contract_ready && r.out.contract.contract_version === 1 && r.out.profile.id === 'sofa' && r.out.outputs.length === 3 && r.out.outputs[0].id === 'white_master' && r.out.gates.count_gate === true && r.events.includes('contract') && !r.out.has_open_conflicts },
  { name: 'S2 run-362 case: client 7, both readers 5 → owner question', sc: { payload: base({}), binary: prod, eye: fiveEye, second: { total: 5 }, luna: { conflicts: [{ topic: 'piece_count', evidence_shows: 'reader 5, second count 5', severity: 'critical', resolution: 'needs_owner', reason: 'Both counts agree on 5 pieces, the client says 7.' }], instruction_locks: [] } },
    check: r => r.path === 'hold' && /Client says 7/.test(r.out.hold_reason) && r.events.includes('contract') && r.events.includes('hold') },
  { name: 'S3 no client count, readers disagree (7 vs 5) → hold before stage 02', sc: { payload: base({ item: { productType: 'Sectional sofa' } }), binary: prod, eye: sevenEye, second: { total: 5 } },
    check: r => r.path === 'hold' && r.out.stage === '01 Intake & observe' && /disagree \(7 and 5\)/.test(r.out.hold_reason) && !r.events.includes('contract') },
  { name: 'S4 dining 12 chairs + table, printed label differs → client wins, ready', sc: { payload: base({ item: { productType: '12 seater dining table set', inventory: [{ item: 'table', count: 1 }, { item: 'chair', count: 12 }] } }), binary: prod,
      eye: { category: 'dining set', pieces: [piece('table')].concat(Array.from({ length: 12 }, () => piece('chair'))), printed_counts: [{ text: '12 chairs + 2 armchairs', item: 'chairs', count: 14 }], signs: [{ sign: 'printed_count', text: '12 chairs + 2 armchairs' }] }, second: { total: 13 } },
    check: r => r.contract_ready && r.out.profile.id === 'dining' && r.out.conflict_ledger.length === 1 && r.out.conflict_ledger[0].resolution === 'client_wins' },
  { name: 'S5 two chairs, table crossed out → excluded, selection gate', sc: { payload: base({ item: { productType: 'Dining chairs', inventory: [{ item: 'chair', count: 2 }], exclusions: ['table'] } }), binary: prod,
      eye: { category: 'dining chairs and table', pieces: [piece('chair'), piece('chair'), piece('table', 'excluded')], signs: [{ sign: 'cross', text: 'X over table', meaning: 'table not included' }] }, second: { total: 2, excluded: [{ kind: 'table', count: 1 }] } },
    check: r => r.contract_ready && r.out.gates.selection_gate === true && r.out.exclusions.length === 2 && r.out.outputs[1].locks.some(l => /must not appear: table/.test(l)) },
  { name: 'S6 towel with olive swatch → colour conflict classified minor, colour hold flagged', sc: { payload: base({ item: { productType: 'Towel' } }), binary: prod,
      eye: { category: 'bath towel', pieces: [piece('towel')], colour_observed: 'rose-taupe', signs: [{ sign: 'swatch', text: 'olive swatch', meaning: 'olive colourway' }] }, second: { total: 1 },
      luna: { conflicts: [{ topic: 'colour', evidence_shows: 'photo: rose-taupe; swatch: olive colourway', severity: 'minor', resolution: 'evidence_wins', reason: 'The photo decides colour; the swatch is another colourway.' }] } },
    check: r => r.contract_ready && r.out.profile.id === 'towel' && r.out.gates.colour_hold === true && r.out.conflict_ledger[0].settled === 'yes' },
  { name: 'S7 no files → refused, nothing read', sc: { payload: base({}), binary: {} }, check: r => r.path === 'refused' && r.out.reply.problems.includes('Add at least one product photo.') },
  { name: 'S8 variations without a parent → refused', sc: { payload: base({ scope: { outcomes: ['Variations'] } }), binary: prod }, check: r => r.path === 'refused' && /approved result/.test(r.out.reply.problems.join(' ')) },
  { name: 'S9 readers unavailable (bad credential) → hold, nothing invented', sc: { payload: base({}), binary: prod }, check: r => r.path === 'hold' && /could not be read/.test(r.out.hold_reason) },
  { name: 'S10 room photo → room locks on scene outputs, white master keeps neutral light', sc: { payload: base({ references: [{ name: 'sofa.png', role: 'Product' }, { name: 'room.jpg', role: 'Room / target space' }] }),
      binary: { ...prod, room: { data: PNG, mimeType: 'image/jpeg', fileName: 'room.jpg' } }, eye: sevenEye, second: { total: 7 }, room: { room_type: 'living room', windows: 'two on the left' } },
    check: r => r.contract_ready && r.out.outputs[1].mode === 'room_locked' && r.out.outputs[0].locks.some(l => /neutral studio light/.test(l)) && r.out.gates.room_lock },
  { name: 'S11 same job sent again → contract v2, v1 voided', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, earlier: [{ kind: 'contract', contract_version: 1, contract_stamp: 'sha256:old' }] },
    check: r => r.contract_ready && r.out.contract_version === 2 && r.events.includes('contract_voided') },
  { name: 'S12 written instructions but classifier failed → hold', sc: { payload: base({ instructions: 'keep the original windows' }), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'hold' && /instructions/.test(r.out.hold_reason) },
  { name: 'S13 instructions turned into locks', sc: { payload: base({ instructions: 'no plants; keep it minimal' }), binary: prod, eye: sevenEye, second: { total: 7 }, luna: { conflicts: [], instruction_locks: ['no plants in the scene'] } },
    check: r => r.contract_ready && r.out.outputs[1].locks.includes('no plants in the scene') },
  // --- 15 Oct 2026: fixes from the reader test ---
  { name: 'S14 first reader 503 → owner hold, the client is not asked for a new photo', sc: { payload: base({}), binary: prod, eyeRaw: E503, second: { total: 7 } },
    check: r => ownerHold(r) && /did not answer/.test(r.out.hold_reason) && !/clearer photo/.test(JSON.stringify(r.vault)) },
  { name: 'S15 first reader cut off (MAX_TOKENS) → owner hold', sc: { payload: base({}), binary: prod, eyeRaw: { content: { parts: [{ text: '```json\n{"category": "sofa", "pieces": [{"label"' }] }, finishReason: 'MAX_TOKENS' }, second: { total: 7 } },
    check: r => ownerHold(r) && /cut off/.test(r.out.hold_reason) },
  { name: 'S16 second count 503 → owner hold', sc: { payload: base({}), binary: prod, eye: sevenEye, secondRaw: E503 },
    check: r => ownerHold(r) && /second count/i.test(r.out.hold_reason) },
  { name: 'S17 room reader 503 → owner hold, not "send a clearer room photo"', sc: { payload: base({ references: [{ name: 'sofa.png', role: 'Product' }, { name: 'room.jpg', role: 'Room / target space' }] }),
      binary: { ...prod, room: { data: PNG, mimeType: 'image/jpeg', fileName: 'room.jpg' } }, eye: sevenEye, second: { total: 7 }, roomRaw: E503 },
    check: r => ownerHold(r) && /room/i.test(r.out.hold_reason) },
  { name: 'S18 reader test case 6: no number, stool and mirror counted → ask which pieces belong', sc: { payload: noNumber('Bedroom set'), binary: prod, eye: test6Eye, second: test6Second },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /stool/.test(r.out.client_question) && /mirror/.test(r.out.client_question) && r.out.critical[0].what === 'set_membership' },
  { name: 'S19 reader test case 8 as a "bed set": reader doubts the nightstands, nothing written → ask', sc: { payload: noNumber('Bed set'), binary: prod, eye: test8Eye, second: test8Second },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /nightstand/.test(r.out.client_question) },
  { name: 'S20 reader test case 1: no number, only pillows doubted → no hold, contract ready', sc: { payload: noNumber('Sofa with chaise'), binary: prod, eye: test1Eye, second: test1Second },
    check: r => r.contract_ready && r.out.inventory.reduce((t, x) => t + x.count, 0) === 2 },
  { name: 'S21 reader test case 9, no number: itemised label covers the 7 seen → inventory 15 from the label, no hold', sc: { payload: noNumber('Dining set'), binary: prod, eye: test9Eye(true), second: test9Second(true) },
    check: r => r.contract_ready && r.out.inventory.reduce((t, x) => t + x.count, 0) === 15 && r.out.inventory.every(x => /written on the photo/.test(x.basis)) },
  { name: 'S21b label does not cover what is seen (label 6 chairs, 8 chairs seen) → hold', sc: { payload: noNumber('Dining chairs'), binary: prod,
      eye: { category: 'dining chairs', pieces: Array.from({ length: 8 }, () => piece('chair')), signs: [], printed_counts: [{ text: '6 CHAIRS', item: 'chair', count: 6 }], colour_observed: 'black', design_locks: [], sided_parts: [], unknowns: [], cropped: false }, second: { total: 8 } },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /label/.test(r.out.hold_reason) },
  { name: 'S22 reader test case 9, client says 15: label sum agrees → no label conflict, client wins', sc: { payload: base({ item: { productType: 'Dining set', inventory: [{ item: 'table', count: 1 }, { item: 'chair', count: 12 }, { item: 'armchair', count: 2 }] } }), binary: prod, eye: test9Eye(true), second: test9Second(true),
      luna: { conflicts: [{ topic: 'piece_count', evidence_shows: 'reader 7, second count 7, photo may be cropped', severity: 'minor', resolution: 'client_wins', reason: 'The photo shows only part of the set.' }], instruction_locks: [] } },
    check: r => r.contract_ready && r.out.conflict_ledger.length === 1 && !r.out.conflict_ledger.some(c => /printed/.test(c.evidence_shows)) },
  { name: 'S23 printed label total differs from the client → one conflict, client wins', sc: { payload: base({ item: { productType: 'Dining set', inventory: [{ item: 'table', count: 1 }, { item: 'chair', count: 12 }] } }), binary: prod,
      eye: { ...test9Eye(false), pieces: [piece('table')].concat(Array.from({ length: 12 }, () => piece('chair'))) }, second: { total: 13 } },
    check: r => r.contract_ready && r.out.conflict_ledger.filter(c => /printed/.test(c.evidence_shows)).length === 1 && r.out.conflict_ledger[0].resolution === 'client_wins' },
  { name: 'S24 swatch colours kept apart from the photo colour', sc: { payload: base({ item: { productType: 'Sofa set', inventory: [{ item: 'sofa', count: 2 }, { item: 'chair', count: 2 }] } }), binary: prod, eye: test4Eye, second: { total: 4 },
      luna: { conflicts: [{ topic: 'colour', severity: 'minor', resolution: 'evidence_wins', reason: 'Swatches are options.' }], instruction_locks: [] } },
    check: r => r.contract_ready && r.out.observation.swatch_colours.length === 3 && /swatch colours: cream grey, rust red, brown leather/.test(r.out.conflict_ledger.find(c => c.topic === 'colour').evidence_shows) && !/rust/.test(r.out.observation.colour_observed) },
  { name: 'S25 companion piece named in the product type → no membership hold', sc: { payload: noNumber('Dresser with mirror'), binary: prod, eye: { category: 'dresser with mirror', pieces: [piece('dresser'), piece('mirror')], signs: [], printed_counts: [], colour_observed: 'white', design_locks: [], sided_parts: [], unknowns: [], cropped: false }, second: { total: 2, unclear: [] } },
    check: r => r.contract_ready },
  { name: 'S26 a single stool on its own → no membership hold', sc: { payload: noNumber('Bar stool'), binary: prod, eye: { category: 'bar stool', pieces: [piece('stool')], signs: [], printed_counts: [], colour_observed: 'black', design_locks: [], sided_parts: [], unknowns: [], cropped: false }, second: { total: 1, unclear: [] } },
    check: r => r.contract_ready },
  // --- 15 Oct 2026: anything written about the product is read before asking ---
  { name: 'S27 written notes name the stool and mirror → no question, 6 pieces', sc: { payload: base({ item: { productType: 'Bedroom set', description: 'Set includes bed, 2 nightstands, dresser with mirror and vanity stool' } }), binary: prod, eye: test6Eye, second: test6Second },
    check: r => r.contract_ready && r.out.inventory.reduce((t, x) => t + x.count, 0) === 6 && r.out.facts.some(f => f.fact === 'set_membership') },
  { name: 'S28 notes say the stool is sold separately → stool excluded, mirror still asked', sc: { payload: base({ item: { productType: 'Bedroom set', description: 'Stool sold separately.' } }), binary: prod, eye: test6Eye, second: test6Second },
    check: r => r.path === 'hold' && /mirror/.test(r.out.client_question) && !/stool/.test(r.out.client_question) },
  { name: 'S29 reader test case 8, written product type "Bed" → nightstands not part, proceeds with 1', sc: { payload: noNumber('Bed'), binary: prod, eye: test8Eye, second: test8Second },
    check: r => r.contract_ready && r.out.inventory.reduce((t, x) => t + x.count, 0) === 1 && r.out.facts.some(f => f.fact === 'set_membership' && /nightstand is not part/.test(f.value)) },
  { name: 'S30 readers disagree, product type says "7-piece" → written total used, conflict classified', sc: { payload: noNumber('7-piece modular sofa'), binary: prod, eye: { ...sevenEye, pieces: sevenEye.pieces.slice(0, 6), cropped: true }, second: { total: 7, pieces: [{ kind: 'modular unit', count: 7 }] },
      luna: { conflicts: [{ topic: 'piece_count', severity: 'minor', resolution: 'client_wins', reason: 'One reader agrees with the written 7.' }], instruction_locks: [] } },
    check: r => r.contract_ready && r.out.inventory.reduce((t, x) => t + x.count, 0) === 7 && /written/.test(r.out.inventory[0].basis) },
  { name: 'S31 text spec file read: it names the stool and mirror → no question', sc: { payload: base({ item: { productType: 'Bedroom set' }, references: [{ name: 'sofa.png', role: 'Product' }, { name: 'spec.txt', role: 'Specification sheet' }] }),
      binary: { ...prod, spec: { data: Buffer.from('Package contents: bed, two nightstands, dresser, dresser mirror, vanity stool.').toString('base64'), mimeType: 'text/plain', fileName: 'spec.txt' } }, eye: test6Eye, second: test6Second },
    check: r => r.contract_ready && r.out.observation.written.files.includes('spec.txt') },
  { name: 'S32 PDF spec cannot be read and a question is due → owner checks the file first', sc: { payload: base({ item: { productType: 'Bedroom set' }, references: [{ name: 'sofa.png', role: 'Product' }, { name: 'spec.pdf', role: 'Specification sheet' }] }),
      binary: { ...prod, spec: { data: Buffer.from('%PDF-1.4').toString('base64'), mimeType: 'application/pdf', fileName: 'spec.pdf' } }, eye: test6Eye, second: test6Second },
    check: r => ownerHold(r) && /spec\.pdf/.test(r.out.hold_reason) && /mirror, stool/.test(r.out.hold_reason) },
  { name: 'S33 PDF spec unread but nothing to ask → no hold', sc: { payload: base({ references: [{ name: 'sofa.png', role: 'Product' }, { name: 'spec.pdf', role: 'Specification sheet' }] }),
      binary: { ...prod, spec: { data: Buffer.from('%PDF-1.4').toString('base64'), mimeType: 'application/pdf', fileName: 'spec.pdf' } }, eye: sevenEye, second: { total: 7 } },
    check: r => r.contract_ready && r.out.not_applied.some(x => /spec\.pdf/.test(x)) },
  // --- 15 Oct 2026: stage 03 (retrieve, plan, plan check, lead, go 1 ticket). Model replies simulated. ---
  { name: 'S34 sectional lifestyle → shortlist, plan, check, awaiting go 1', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'awaiting_go_1' && r.out.stage === '03 Retrieve & style' && ['shortlist', 'plan', 'go1_ticket'].every(k => r.events.includes(k))
      && r.out.retrieval.rejected.some(x => x.sku === '174770' && /out of stock/.test(x.reason)) && r.out.retrieval.rejected.some(x => x.sku === '161283' && /not confirmed/.test(x.reason))
      && r.out.go1.midas_pieces.length === 1 && r.out.go1.midas_pieces[0].catalogue_photo && /not scored/.test(r.out.go1.shots[1].styling_line) && /not an approval/.test(r.out.go1.shots[1].styling_line)
      && /neutral/i.test(r.out.go1.shots[0].plan.light) && r.vault.find(e => e.kind === 'status').stage === '03' && r.row.status === 'awaiting_go_1' && /No paid image/.test(r.out.next) },
  { name: 'S35 planner invents a SKU and dresses the white master → code removes both, records the fix', sc: { payload: base({ preferences: { lighting: 'Warm evening' } }), binary: prod, eye: sevenEye, second: { total: 7 },
      planner: st => { const p = autoPlan2(st); p.shots[0].supporting_props = ['vase']; p.shots[0].light = 'Warm evening'; p.shots[1].midas_pieces.push({ sku: '999999', count: 1, purpose: 'x', rests_on: 'y' }); return p; } },
    check: r => r.path === 'awaiting_go_1' && r.out.shots[0].code_fixes.length === 2 && r.out.shots[1].code_fixes.some(f => /999999/.test(f)) && !r.out.go1.midas_pieces.some(m => m.sku === '999999') && r.out.shots[0].plan.supporting_props.length === 0 },
  { name: 'S36 client pick left out of the plan, critic passes anyway → owner hold (no rewrite)', sc: { payload: base({ midasPicks: ['160218'] }), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { midas: [] } },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && r.out.stage === '03 Retrieve & style' && /160218/.test(r.out.hold_reason) && r.out.client_question === '' && r.vault.find(e => e.kind === 'hold').stage === '03' },
  { name: 'S37 client pick left out, critic rewrites with the pick → passes in round 2, 1 rewrite used', sc: { payload: base({ midasPicks: ['160218'] }), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { midas: [] },
      critic: [st => failWith(st, 'midas_pieces_ok', { midas_pieces: [{ sku: '160218', count: 1, purpose: 'centre table for the seating group', rests_on: 'the rug' }] })] },
    check: r => r.path === 'awaiting_go_1' && r.out.rewrites_used === 1 && r.out.go1.midas_pieces.some(m => m.sku === '160218' && m.client_pick) && r.out.go1.shots.some(s => /passed after 1 rewrite/.test(s.plan_check)) },
  { name: 'S38 client pick out of stock → one client question, no planner call', sc: { payload: base({ midasPicks: ['174770'] }), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /174770/.test(r.out.client_question) && /out of stock/.test(r.out.client_question) && !r.events.includes('plan') && r.events.includes('shortlist') },
  { name: 'S39 client pick not in the catalogue → client question', sc: { payload: base({ midasPicks: ['123456'] }), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /could not find the Midas item 123456/.test(r.out.client_question) },
  { name: 'S40 side table product, client picks a side table → same kind, client question', sc: { payload: base({ item: { productType: 'Side table' }, midasPicks: ['141365'] }), binary: prod, eye: { ...sevenEye, category: 'side table', pieces: [piece('side table')], sided_parts: [] }, second: { total: 1 } },
    check: r => r.path === 'hold' && /same kind/.test(r.out.client_question) },
  { name: 'S41 critic fails three rounds → 2 rewrites, then owner hold', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, critic: [st => failWith(st, 'room_rules', { setting: 'room A' }), st => failWith(st, 'room_rules', { setting: 'room B' }), st => failWith(st, 'room_rules', { setting: 'room C' })] },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && r.out.rewrites_used === 2 && /job limit of 2 rewrite rounds is used/.test(r.out.hold_reason) && !r.events.includes('go1_ticket') },
  { name: 'S42 critic unreadable twice → owner hold, no plan goes forward unchecked', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, critic: [{ __raw: { error: 'overloaded' } }, { __raw: { content: [{ type: 'text', text: '{"plans": [' }] } }] },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && /could not be read after two tries/.test(r.out.hold_reason) },
  { name: 'S43 planner error → owner hold, critic not called', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, plannerRaw: { error: 'The service is overloaded' }, critic: [() => { throw new Error('critic must not run'); }] },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && /planner did not return/.test(r.out.hold_reason) },
  { name: 'S44 white background only → no retrieval, no planner, awaiting go 1', sc: { payload: base({ scope: { outcomes: ['White BK'] } }), binary: prod, eye: sevenEye, second: { total: 7 }, plannerRaw: { error: 'must not be called' } },
    check: r => r.path === 'awaiting_go_1' && r.out.go1.shots.length === 1 && r.out.retrieval.shortlist.length === 0 && /no retrieval/.test(r.out.retrieval.notes[0]) && r.out.go1.shots[0].plan_check === 'fixed by the studio' },
  { name: 'S45 dining set → tables rejected as same kind; lamps, plates and glasses kept', sc: { payload: base({ item: { productType: '12 seater dining table set', inventory: [{ item: 'table', count: 1 }, { item: 'chair', count: 12 }] } }), binary: prod,
      eye: { category: 'dining set', pieces: [piece('table')].concat(Array.from({ length: 12 }, () => piece('chair'))), signs: [] }, second: { total: 13 } },
    check: r => r.path === 'awaiting_go_1' && ['141368', '141365', '160218'].every(k => r.out.retrieval.rejected.some(x => x.sku === k && /same kind/.test(x.reason))) && ['174781', '173765', '167602'].every(k => r.out.retrieval.shortlist.some(x => x.sku === k)) },
  { name: 'S46 bookends "create with this item" → accessory leads, planner told so', sc: { payload: base({ item: { productType: 'Bookends', inventory: [{ item: 'bookend', count: 2 }] }, scope: { outcomes: ['Create with this item'] } }), binary: prod, eye: { category: 'bookends', pieces: [piece('bookend'), piece('bookend')], signs: [] }, second: { total: 2 } },
    check: r => r.path === 'awaiting_go_1' && r.out.lead === 'accessory_leads' && /accessory and leads the scene/.test(r.out.plan_request) },
  { name: 'S47 two chairs, table excluded → Midas tables rejected because the job excludes them', sc: { payload: base({ item: { productType: 'Dining chairs', inventory: [{ item: 'chair', count: 2 }], exclusions: ['table'] } }), binary: prod,
      eye: { category: 'dining chairs and table', pieces: [piece('chair'), piece('chair'), piece('table', 'excluded')], signs: [] }, second: { total: 2, excluded: [{ kind: 'table', count: 1 }] } },
    check: r => r.path === 'awaiting_go_1' && r.out.retrieval.rejected.some(x => x.sku === '141368' && /excludes table/.test(x.reason)) && !r.out.retrieval.shortlist.some(x => /table$/.test(x.kind)) },
  { name: 'S48 planner uses 4 different Midas pieces → 4th removed (limit 3)', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 },
      planner: st => { const p = autoPlan2(st); p.shots[1].midas_pieces = ['141368', '141365', '174781', '176249'].map(k => ({ sku: k, count: 1, purpose: 'p', rests_on: 'floor' })); return p; } },
    check: r => r.path === 'awaiting_go_1' && r.out.go1.midas_pieces.length === 3 && r.out.shots[1].code_fixes.some(f => /176249.*limit of 3/.test(f)) },
  // Changed 16 Oct 2026 (owner decision 22; prompt check P3): a person is planned in its own field; generic props are removed by code.
  { name: 'S49 people set to none: a planned person → removed; generic props removed and listed at go 1', sc: { payload: base({ preferences: { people: 'none' } }), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { person: 'a woman reading behind the sofa', props: ['linen cushions'] } },
    check: r => r.path === 'awaiting_go_1' && r.out.shots[1].code_fixes.some(f => /removed the person/.test(f)) && r.out.shots[1].plan.person === '' && r.out.shots[1].plan.supporting_props.length === 0 && r.out.go1.shots[1].left_out_at_scene_time.some(x => /linen cushions/.test(x)) },
  { name: 'S50 catalogue table empty → generic props only, go 1 says so', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, catalogue: [] },
    check: r => r.path === 'awaiting_go_1' && r.out.retrieval.shortlist.length === 0 && r.out.go1.warnings.some(w => /no rows/.test(w)) && /none for this job/.test(r.out.plan_request) },
  // --- 15 Oct 2026: regressions from the independent review of stage 03 ---
  { name: 'S51 pick written last after 3 others → limit of 3 still holds, pick kept', sc: { payload: base({ midasPicks: ['160218'] }), binary: prod, eye: sevenEye, second: { total: 7 },
      planner: st => { const p = autoPlan2(st); p.shots[1].midas_pieces = ['174781', '173765', '167602', '160218'].map(k => ({ sku: k, count: 1, purpose: 'p', rests_on: 'floor' })); return p; } },
    check: r => r.path === 'awaiting_go_1' && r.out.go1.midas_pieces.length === 3 && r.out.go1.midas_pieces.some(m => m.sku === '160218') && r.out.shots[1].code_fixes.some(f => /limit of 3/.test(f)) },
  { name: 'S52 planner leaves out a scene shot → owner hold, no crash', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, planner: st => { const p = autoPlan2(st); p.shots = p.shots.slice(0, 2); return p; } },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && /no plan for: detail/.test(r.out.hold_reason) },
  { name: 'S53 planner leaves out the white master → studio plan used, recorded', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, planner: st => { const p = autoPlan2(st); p.shots = p.shots.slice(1); return p; } },
    check: r => r.path === 'awaiting_go_1' && r.out.shots[0].plan && /neutral/i.test(r.out.shots[0].plan.light) && r.out.shots[0].code_fixes.some(f => /no entry for the white master/.test(f)) && r.out.shots[1].plan.setting },
  { name: 'S54 white-only job with a Midas pick → client question, pick not dropped', sc: { payload: base({ scope: { outcomes: ['White BK'] }, midasPicks: ['160218'] }), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'hold' && r.out.hold_for === 'client' && /white background images show the product alone/.test(r.out.client_question) },
  { name: 'S55 pick with stock text "Sold out" → treated as out of stock, client question', sc: { payload: base({ midasPicks: ['160218'] }), binary: prod, eye: sevenEye, second: { total: 7 }, catalogue: require('./catalogue.json').map(x => x.sku === '160218' ? { ...x, availability: 'Sold out' } : x) },
    check: r => r.path === 'hold' && /out of stock/.test(r.out.client_question) },
  { name: 'S56 round-2 critic message shows the shots already passed, for consistency', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, critic: [st => { const x = failWith(st, 'room_rules', { setting: 'room B' }); x.plans = x.plans.map(p => p.shot === 2 ? { ...p, checks: Object.fromEntries(Object.entries(p.checks).map(([k]) => [k, { result: 'pass', evidence: 'ok' }])), rewrite: null } : p); return x; }] },
    check: r => r.path === 'awaiting_go_1' && /Shots already checked, shown for consistency only/.test(r.out.critic_request) && /Shot 2 \(output wide/.test(r.out.critic_request.split('Plans to check:')[0]) },
  { name: 'S57 two bad picks → one client question naming both', sc: { payload: base({ midasPicks: ['174770', '123456'] }), binary: prod, eye: sevenEye, second: { total: 7 } },
    check: r => r.path === 'hold' && /174770/.test(r.out.client_question) && /123456/.test(r.out.client_question) && r.out.critical.filter(c => c.what === 'midas_pick').length === 1 },
  // Changed 16 Oct 2026 (prompt check P3): generic props are removed by code (owner, 15 Oct 21:50); one naming a Midas product is flagged.
  { name: 'S58 generic props removed by code and listed at go 1; a prop named VILARI is flagged; no person read into "model boat"', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { props: ['hand-woven jute basket', 'a model sailing boat', 'VILARI centre table'] }, critic: [st => failWith(st, 'midas_pieces_ok', { supporting_props: [] })] },
    check: r => r.path === 'awaiting_go_1' && !r.out.shots.some(s => (s.code_fixes || []).some(f => /person/.test(f))) && r.out.shots[1].plan.supporting_props.length === 0 && r.out.rewrites_used === 1 && r.out.go1.shots[1].left_out_at_scene_time.length === 3 },
  // --- 15 Oct 2026, 05:00: owner decision on people and plants ---
  // Changed 16 Oct 2026 (owner decision 22, replacing the 15 Oct 05:00 rule): no person by default; plants only as Midas pieces.
  { name: 'S59 default: no person; plants only as Midas pieces; rules sent to planner and critic', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { person: 'a woman reading beside the sofa', props: ['two potted olive trees', 'a fern'] } },
    check: r => r.path === 'awaiting_go_1' && r.out.people_max === 0 && r.out.shots[1].plan.person === '' && r.out.shots[1].plan.supporting_props.length === 0 && /People: none in any shot/.test(r.out.plan_request) && /People: none in any shot/.test(r.out.critic_request) && /Plants: none, unless a Midas artificial plant/.test(r.out.plan_request) },
  { name: 'S59b Human presence asked → one adult allowed, kept in the person field, rules sent to planner and critic', sc: { payload: base({ preferences: { human: true } }), binary: prod, eye: sevenEye, second: { total: 7 }, planOpts: { person: 'a woman reading in an armchair behind the sofa' } },
    check: r => r.path === 'awaiting_go_1' && r.out.people_max === 1 && /reading/.test(r.out.shots[1].plan.person) && /At most one natural adult per scene shot/.test(r.out.plan_request) && /never in front of it or covering any piece/.test(r.out.critic_request) },
  // --- 15 Oct 2026: owner go 1 ---
  { name: 'G1 owner says go → go 1 given; only the decision and status are added to the vault', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'go' }] },
    check: r => r.path === 'go_1_given' && /Stage 04 makes the white master next/.test(r.out.next) && r.events.filter(k => k === 'brief').length === 1 && r.events.filter(k => k === 'plan').length === 1 && r.events.filter(k => k === 'go1_decision').length === 1
      && /^[0-9a-f]{32}$/.test(r.rows[0].go1_token) && /webhook-waiting/.test(r.rows[0].resume_url) && r.row.resume_url === '' && r.row.go1_token === '' && r.row.go1_decision === 'go' && !r.vault.some(e => /[0-9a-f]{32}/.test(e.payload) && e.payload.indexOf(r.rows[0].go1_token) !== -1) },
  { name: 'G2 owner says stop → stopped, nothing made', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'stop', note: 'not this season' }] },
    check: r => r.path === 'stopped_by_owner' && r.row.go1_note === 'not this season' && /No image was made/.test(r.out.next) },
  { name: 'G3 no answer in 24 hours → owner hold', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: ['timeout'] },
    check: r => r.path === 'hold' && r.out.hold_for === 'owner' && /24 hours/.test(r.out.hold_reason) && r.vault.find(e => e.kind === 'hold' && e.stage === '03') },
  { name: 'G4 answer without the run token → ignored, the run keeps waiting, nothing written', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'go', go1_token: 'wrong' }] },
    check: r => r.path === 'awaiting_go_1' && r.out.go1_route === 'rewait' && r.rows.length === 1 && !r.events.includes('go1_decision') },
  { name: 'G5 owner edits the light of shot 2 → checked again → asked again → go', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'change', changes: [{ shot: 2, light: 'Soft morning daylight from the left window.' }] }, { decision: 'go' }] },
    check: r => r.path === 'go_1_given' && r.out.shots[1].plan.light === 'Soft morning daylight from the left window.' && r.out.go1_log.length === 2 && r.out.go1_log[0].result === 'recheck'
      && /Shots already checked, shown for consistency only/.test(r.out.critic_request) && r.rows.length === 5 && r.rows[1].status === 'replanning' && r.rows[1].resume_url === '' && r.rows[2].status === 'awaiting_go_1' && r.rows[2].go1_decision === 'change' && r.rows[2].go1_rounds === 1 && r.events.filter(k => k === 'go1_ticket').length === 2 },
  { name: 'G6 owner sends a note only → new plan with the note → go', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'change', note: 'Make it feel like a Gulf majlis evening.' }, { decision: 'go' }] },
    check: r => r.path === 'go_1_given' && /Gulf majlis evening/.test(r.out.plan_request) && r.out.go1_log[0].result === 'replan' && r.events.filter(k => k === 'plan').length === 2 },
  { name: 'G7 owner edits only the white master → nothing changes, owner hold', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'change', changes: [{ shot: 1, light: 'warm' }] }] },
    check: r => r.path === 'hold' && /named no shot or field/.test(r.out.hold_reason) && /fixed by the studio/.test(r.out.go1_log[0].changes[0].result) },
  { name: 'G8 a 4th change round → owner hold', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [1, 2, 3, 4].map(() => ({ decision: 'change', changes: [{ shot: 2, camera: 'Eye level, front.' }] })) },
    check: r => r.path === 'hold' && /3 times/.test(r.out.hold_reason) && r.out.go1_rounds === 3 },
  { name: 'G9 owner edit adds a SKU not on the shortlist → removed by code before the check', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [{ decision: 'change', changes: [{ shot: 2, midas_pieces: [{ sku: '888888', count: 1, purpose: 'x', rests_on: 'y' }] }] }, { decision: 'go' }] },
    check: r => r.path === 'go_1_given' && r.out.shots[1].code_fixes.some(f => /888888/.test(f)) && !r.out.shots[1].plan.midas_pieces.some(m => m.sku === '888888') },
  { name: 'G13 six forged answers → owner hold; recorded as ignored by an unknown caller, never as the owner', sc: { payload: base({}), binary: prod, eye: sevenEye, second: { total: 7 }, go1: [1, 2, 3, 4, 5, 6].map(() => ({ decision: 'go', go1_token: 'wrong' })) },
    check: r => r.path === 'hold' && /More than 5 calls/.test(r.out.hold_reason) && r.out.go1_last.decision === 'ignored' && r.out.go1_last.by === 'unknown caller' && r.row.go1_decision === 'ignored' && r.row.resume_url === '' && r.vault.some(e => e.kind === 'go1_decision' && e.actor === 'unknown caller') && !r.vault.some(e => e.kind === 'go1_decision' && e.actor === 'owner') },
];

const WAIT = { run_id: 'claude-a7-x', client_run_id: 'claude-test-a7-0001', status: 'awaiting_go_1', resume_url: 'https://test.app.n8n.cloud/webhook-waiting/391', go1_token: 'a'.repeat(32), go1_rounds: 0, required_outputs: JSON.stringify([{ id: 'white_master', kind: 'white' }, { id: 'lifestyle_1', kind: 'lifestyle' }, { id: 'lifestyle_2', kind: 'lifestyle' }]), updatedAt: '2026-10-15T02:00:00Z' };
const A = (x) => ({ id: 'claude-test-a7-0001', run_id: 'claude-a7-x', round: 0, ...x });
const decisionTests = [
  ['D1 valid go → forwarded with the run token and address', async () => { const d = await decisionCheck(A({ decision: 'go' }), [WAIT]); return d.ok === 'yes' && d.answer.go1_token === WAIT.go1_token && d.resume_url === WAIT.resume_url; }],
  ['D2 no run waiting → 409, nothing forwarded', async () => { const d = await decisionCheck(A({ decision: 'go' }), []); return d.ok === 'no' && d.code === 409 && !d.resume_url; }],
  ['D3 decision "approve" → 400', async () => { const d = await decisionCheck(A({ decision: 'approve' }), [WAIT]); return d.ok === 'no' && d.code === 400; }],
  ['D4 resume address on another host → 409', async () => { const d = await decisionCheck(A({ decision: 'go' }), [{ ...WAIT, resume_url: 'https://evil.example.com/webhook-waiting/1' }]); return d.ok === 'no' && d.code === 409; }],
  ['D5 change with no edits and no note → 400', async () => { const d = await decisionCheck(A({ decision: 'change' }), [WAIT]); return d.ok === 'no' && d.code === 400; }],
  ['D6 two runs waiting under one job id → 409', async () => { const d = await decisionCheck(A({ decision: 'stop' }), [WAIT, { ...WAIT, run_id: 'claude-a7-y' }]); return d.ok === 'no' && d.code === 409; }],
  ['D8 resume call failed → 502, not forwarded', async () => { const f = await forwardResult({ id: 'claude-test-a7-0001', decision: 'go', at: 'x' }, { error: 'The resource you are requesting could not be found' }); return f.code === 502 && f.reply.forwarded === false; }],
  ['D9 resume call worked → 200, forwarded, says stage 05 asks for go 2', async () => { const f = await forwardResult({ id: 'claude-test-a7-0001', decision: 'go', at: 'x' }, { message: 'Workflow was started' }); return f.code === 200 && f.reply.forwarded && /asks for your go 2/.test(f.reply.next); }],
  ['D10 answer for an older round → 409, names the plan waiting now', async () => { const d = await decisionCheck(A({ decision: 'go', round: 0 }), [{ ...WAIT, go1_rounds: 1 }]); return d.ok === 'no' && d.code === 409 && /round 1/.test(d.reply.problem); }],
  ['D11 change on a white-only job → 400', async () => { const d = await decisionCheck(A({ decision: 'change', note: 'warmer' }), [{ ...WAIT, required_outputs: JSON.stringify([{ id: 'white_master', kind: 'white' }]) }]); return d.ok === 'no' && /only the white master/.test(d.reply.problem); }],
  ['D12 change with a note and edits together → 400', async () => { const d = await decisionCheck(A({ decision: 'change', note: 'x', changes: [{ shot: 2, light: 'y' }] }), [WAIT]); return d.ok === 'no' && /not both/.test(d.reply.problem); }],
  ['D13 change to shot 1 (white master) or shot 9 → 400 listing the scene shots', async () => { const a = await decisionCheck(A({ decision: 'change', changes: [{ shot: 1, light: 'y' }] }), [WAIT]); const b = await decisionCheck(A({ decision: 'change', changes: [{ shot: 9, light: 'y' }] }), [WAIT]); return a.ok === 'no' && b.ok === 'no' && /2 \(lifestyle_1\)/.test(b.reply.problem); }],
  ['D14 a 4th change round → 400', async () => { const d = await decisionCheck(A({ decision: 'change', round: 3, note: 'x' }), [{ ...WAIT, go1_rounds: 3 }]); return d.ok === 'no' && /3 change rounds/.test(d.reply.problem); }],
  ['D15 no webhook address known → refuse (host check never skipped)', async () => { const d = await decisionCheck(A({ decision: 'go' }), [WAIT], ' '); return d.ok === 'no' && d.code === 409; }],
  ['D16 valid change with edits → forwarded with run id and round', async () => { const d = await decisionCheck(A({ decision: 'change', changes: [{ shot: 2, light: 'morning' }] }), [WAIT]); return d.ok === 'yes' && d.answer.run_id === 'claude-a7-x' && d.answer.round === 0; }],
  ['D7 a held run (not waiting) → 409', async () => { const d = await decisionCheck(A({ decision: 'go' }), [{ ...WAIT, status: 'hold' }]); return d.ok === 'no' && d.code === 409; }],
];
(async () => {
  let pass = 0; const rows = [];
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  for (const t of tests) {
    if (only && !only.test(t.name)) continue;
    let ok = false, info = '';
    try { const r = await scenario(t.sc); ok = Boolean(t.check(r)); info = r.path + (r.out.hold_for ? ' (' + r.out.hold_for + ')' : '') + ' | ' + (r.out.hold_reason || r.out.next || '') + (r.out.client_question ? ' | Q: ' + r.out.client_question : '') + (r.out.contract_stamp ? ' | ' + r.out.contract_stamp.slice(0, 19) : '') + (r.events ? ' | events ' + r.events.length : ''); }
    catch (e) { info = 'ERROR ' + e.message; }
    if (ok) pass++;
    rows.push({ test: t.name, ok, info });
    console.log((ok ? 'PASS ' : 'FAIL ') + t.name + '\n     ' + info);
  }
  if (!only || only.test('D')) for (const [name, fn] of decisionTests) {
    if (only && !only.test(name)) continue;
    let ok = false; try { ok = Boolean(await fn()); } catch (e) { console.log('ERROR', e.message); }
    if (ok) pass++; rows.push({ test: name, ok, info: '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name);
  }
  console.log(pass + '/' + rows.length + ' passed');
  require('fs').writeFileSync(__dirname + '/local_results.json', JSON.stringify(rows, null, 1));
})();
