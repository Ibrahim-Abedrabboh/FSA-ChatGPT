// Runs the n8n Code node logic outside n8n on parity_cases.json and compares with the Python engine.
// Also runs the node exactly as n8n would (with a fake $input) for one webhook-shaped item.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'n8n', 'claude-stylist-check.code.js'), 'utf8');
const [core] = src.split('// ---- n8n wrapper ----');
const checkPlan = new Function(`${core}; return checkPlan;`)();
const cases = JSON.parse(fs.readFileSync(process.argv[2] || 'parity_cases.json', 'utf8'));

const KEYS = ['status', 'score', 'coverage', 'kept', 'excluded', 'pillars', 'critique', 'score_label'];
let mismatches = 0;
for (const [i, c] of cases.entries()) {
  const got = checkPlan(c.input);
  const keys = c.expected.status === 'invalid_input' ? ['status'] : KEYS;
  for (const k of keys) {
    if (JSON.stringify(got[k]) !== JSON.stringify(c.expected[k])) {
      mismatches += 1;
      if (mismatches <= 5) console.log(`case ${i} key ${k}\n  py: ${JSON.stringify(c.expected[k])}\n  js: ${JSON.stringify(got[k])}`);
    }
  }
}
console.log(`parity: ${cases.length} cases, ${mismatches} mismatching fields`);

// Whole node as n8n runs it: top-level return, $input global, webhook body.
const sample = cases.find((c) => c.expected.status !== 'invalid_input');
const node = new Function('$input', src);
const out = node({ first: () => ({ json: { headers: {}, body: sample.input } }) });
const ok = Array.isArray(out) && out.length === 1 && out[0].json.status === sample.expected.status;
console.log(`n8n wrapper (webhook body): ${ok ? 'ok' : 'FAILED'} -> ${out[0].json.status}, score ${out[0].json.score}`);
process.exit(mismatches || !ok ? 1 : 0);
