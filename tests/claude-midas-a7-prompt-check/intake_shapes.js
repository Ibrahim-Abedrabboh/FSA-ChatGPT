// Runs A7's real "01 Intent & scope" on two request shapes: the A7 page draft's buildPayload() and the client first page's stored brief.
// Local only. Written 16 Oct 2026 for the client first page check. Run: node tests/claude-midas-a7-prompt-check/intake_shapes.js
const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, '..', '..', 'n8n', 'claude-midas-a7', 'code-nodes', '01_Intent_scope.js'), 'utf8');
async function run01(payload) {
  const items = [{ json: { body: { payload: JSON.stringify(payload) } }, binary: {} }];
  const $input = { first: () => items[0], all: () => items };
  const fn = new (Object.getPrototypeOf(async function () {}).constructor)('$input', code);
  return (await fn($input))[0].json;
}
(async () => {
  // As the A7 page draft's buildPayload() writes it (Lifestyle, Wide view + close-up, 4:5, Keep-faithful fields filled).
  const page = { job: 'lifestyle', jobMode: 'new_project', workOn: 'one_by_one',
    scope: { outcome: 'Lifestyle', outcomes: ['Lifestyle'], view: 'Wide view + close-up', aspect: '4:5', resolution: '2K', imageCount: 3 },
    item: { department: 'Home Furniture', category: 'Dining Rooms', subCategory: 'Dining Chairs', referenceType: 'Product / vendor reference' },
    preferences: { lighting: 'Warm evening', wallPaint: 'Sage', floor: 'Light oak', useWorkflowDefaults: false },
    styling: { plants: true, human: true, mood: 'Warm & inviting', catalogue: false },
    metadata: { product_category: 'Dining Rooms', color: 'cream', material: 'boucle', scene: 'Lifestyle', light: 'Warm evening', camera: 'Wide view + close-up', hero: 'the two chairs',
      locks: ['exactly two chairs'], must_not: ['the wooden table in the photo'], delivery: { image_size: '', aspect: '4:5', resolution: '2K' } },
    references: [{ name: 'chairs.jpg', role: 'Product / vendor reference' }], clientRunId: 'test-page-0001' };
  // As the client first page (design 2) stores its brief (data-brief in the saved page), with Lifestyle and 4:5 chosen.
  const first = { version: 'Client first-page design · 2', mode: 'Manual', job: { type: 'New Project', option: 'One by one (same department)' },
    item: { department: 'Home Furniture', category: 'Dining Rooms', subCategory: 'Dining Chairs', role: 'Product / set' },
    outcomes: ['Lifestyle'], delivery: { views: 'Wide view + close-up', ratio: 'Portrait · 4:5', resolution: '2K', variations: 'Not requested' }, variationAxes: [],
    references: [], catalogueReferences: [], roomBrief: '',
    preferences: { lighting: 'Warm evening', wall: 'Sage', floor: 'Light oak', mood: 'Warm & inviting', plants: true, human: false },
    details: { links: '', sku: '161283', dimensions: '50 x 40 x 60 cm', colour: 'cream', fabric: 'boucle', inventory: '2 chairs', includeDescriptionAndMetadata: true, previousGeneration: '', customPrompt: 'show the two chairs without the table' },
    strengths: { Fidelity: 100, Styling: 65, Cluttering: 30 } };
  for (const [name, p] of [['A7 page draft', page], ['client first page', first]]) {
    const r = await run01(p);
    const b = r.brief;
    console.log('== ' + name);
    console.log(JSON.stringify({ usable: r.usable, problems: r.problems, not_applied: r.not_applied, outputs: b.outputs.map(o => o.id), proportions: b.proportions, view: b.view, resolution: b.resolution,
      colour: b.colour, material: b.material, sku: b.sku, dimensions: b.dimensions, inventory: b.inventory, exclusions: b.exclusions, instructions: b.instructions, preferences: b.preferences, category: b.category }, null, 1));
  }
})();
