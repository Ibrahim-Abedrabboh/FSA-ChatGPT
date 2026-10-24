// A saved edit of the approved image "wide" of an earlier run, with the earlier run's row, scene ticket and two Midas pieces.
const A = 'a'.repeat(64), B = 'b'.repeat(64), M = 'c'.repeat(64);
const parentRun = 'claude-a7-99999999-2222-4333-8444-555555555555';
function state(options, changes) {
  const camera = (options.find(o => o.kind === 'camera') || {}).value || '';
  const L = { 'Warm evening': 'night', Daylight: 'day', 'Golden afternoon': 'warm' };
  const lo = options.find(o => o.kind === 'lighting');
  const out = { id: 'edit_1', kind: 'hero', outcome: 'lifestyle', camera, light: lo ? L[lo.value] : '', light_label: lo ? lo.value : '', from: 'base_wide', edit_from_result: true, edit_changes: changes, edit_options: options, mode: 'creative_room',
    locks: ['product identity as in the vendor photo', 'requested edit (owner): ' + options.map(o => o.kind + ' ' + o.value).join('; '), 'keep unchanged (owner): The product: 1 x sofa'] };
  return { run_id: 'claude-a7-new', client_run_id: 'owner-new', status: 'edit_base_due', stage: '03 Retrieve & style', product_key: 'ref_0',
    references: [{ key: 'ref_0', name: 'sofa.jpg', role: 'product', sha256: A, bytes: 1000, mime: 'image/jpeg', image: true }],
    brief: { edit: { changes: 'Edit text', preserve: 'The product', options, base: { run_id: parentRun, output_id: 'wide', drive_file_id: 'DRIVEbase12345', sha256: B, px: '1024x1024', file_name: 'wide.png' } }, preferences: { people: 'none' }, dimensions: 'W 220 x D 90 x H 80 cm', product_type: 'sofa' },
    outputs: [out], shots: [{ n: 1, output_id: 'edit_1', kind: 'hero', frame: 'as the approved image', plan: { setting: 'x', midas_pieces: [] } }],
    go1_last: { decision: 'go', by: 'owner' }, contract: { a: 1 }, contract_stamp: 'stamp1', inventory: [{ item: 'sofa', count: 1 }], profile: { id: 'sofa' },
    retrieval: { shortlist: [], rejected: [], notes: [] }, trail: [], observation: { category_seen: 'sofa' } };
}
const parentRow = { run_id: parentRun, required_outputs: JSON.stringify([{ id: 'white_master', kind: 'white' }, { id: 'wide', kind: 'wide' }]),
  references: JSON.stringify([{ name: 'sofa.jpg', role: 'product', sha256: A }]),
  package: JSON.stringify({ master: { output_id: 'white_master', attempt: 1, drive_file_id: 'DRIVEmaster123', sha256: M, px: '1024x1024', file_name: 'white.png' } }),
  scenes: JSON.stringify({ done: { wide: { by: 'owner', at: '2026-10-18T10:00:00Z', candidate: { drive_file_id: 'DRIVEbase12345', sha256: B, px: '1024x1024', file_name: 'wide.png' }, props: [{ sku: 'M1', name: 'Arc lamp' }, { sku: 'M2', name: 'Side table' }] } } }) };
const ticket = { run_id: parentRun, kind: 'scene_ticket', at: '2026-10-18T09:00:00Z', payload: JSON.stringify({ scene: { output_id: 'wide', phase: 'place', kind: 'wide', presets: { view: 'Full frontal', light: { preset: 'warm' } }, person: '',
  shot: { frame: 'landscape, 3:2', plan: { camera: 'eye level from the doorway', light: 'low warm sun from the left window', presentation: 'sofa against the wall', midas_pieces: [{ sku: 'M1', purpose: 'reading light', rests_on: 'floor' }, { sku: 'M2', purpose: 'side table', rests_on: 'floor' }] } } } }) };
const catalogue = [{ sku: 'M1', name: 'Arc lamp', kind: 'floor lamp', image_url: 'https://midasfurniture.com/media/m1.jpg', url: 'https://midasfurniture.com/en/arc-lamp', retrieved: '2026-10-18', availability: 'In stock' },
  { sku: 'M2', name: 'Side table', kind: 'side table', image_url: 'https://midasfurniture.com/media/m2.jpg', url: 'https://midasfurniture.com/en/side-table', retrieved: '2026-10-18', availability: 'Out of stock' }];
module.exports = { state, parentRow, ticket, catalogue, A, B, M, parentRun };
