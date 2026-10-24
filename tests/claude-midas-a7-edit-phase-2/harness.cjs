// Runs Code nodes of the live A7 workflow snapshot (n8n/claude-midas-a7/live/) with mocked node outputs.
// No network, no AI call, no paid call.
const fs = require('fs');
const path = require('path');
const LIVE = path.join(__dirname, '..', '..', 'n8n', 'claude-midas-a7', 'live', 'workflow-1cgZc9rmBOrPdKIe.json');
const workflow = JSON.parse(fs.readFileSync(LIVE, 'utf8'));
function code(name) {
  const node = workflow.nodes.find(n => n.name === name);
  if (!node || typeof node.parameters.jsCode !== 'string') throw Error('no Code node ' + name);
  return node.parameters.jsCode;
}
// nodes: { 'Node name': item | [items] }, input: item | [items]
async function run(name, nodes, input, buffers) {
  const wrap = v => { const items = Array.isArray(v) ? v : [v]; return { first: () => items[0], all: () => items, item: items[0] }; };
  const $ = n => { if (!(n in nodes)) throw Error('node not run: ' + n); return wrap(nodes[n]); };
  const $input = wrap(input || { json: {} });
  const helpers = { getBinaryDataBuffer: async (i, k) => (buffers || {})[k] };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFn('$input', '$', '$execution', 'require', code(name)).call({ helpers }, $input, $, { resumeUrl: 'https://n8n.example/webhook-waiting/1' }, require);
}
const clone = x => JSON.parse(JSON.stringify(x));
module.exports = { run, code, clone, workflow };
