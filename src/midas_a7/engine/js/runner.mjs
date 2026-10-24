// Runs A7's frozen Code-node logic and n8n-style ={{ }} expressions for the Python engine.
// Protocol: one JSON request per line on stdin, one JSON reply per line on stdout.
// Anything the code prints goes to stderr so it never mixes with replies.
// Trust boundary: `code` and expression strings come only from the flow definitions committed in
// src/midas_a7/flows (the Python side never forwards request data as code). Request data reaches
// this process only as item values ($json, $input), which are never evaluated.
// Engine helpers (Phase 1.6, 22 Oct 2026): a Code node may await a helper the Python engine provides (this process has no image
// library). The request goes out on stdout as { id, callback, op, payload } and the answer comes back on stdin as
// { op: 'callbackResult', callback, ok, result | error }. Only data travels both ways; nothing received is evaluated.
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { DateTime, Duration, Interval, Settings } from 'luxon';

const nodeRequire = createRequire(import.meta.url);
const ALLOWED_MODULES = new Set(['crypto', 'buffer', 'zlib', 'url', 'util']);
function sandboxRequire(name) {
  const bare = String(name).replace(/^node:/, '');
  if (!ALLOWED_MODULES.has(bare)) throw new Error(`Cannot find module '${name}'`);
  return nodeRequire(bare);
}

for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...args) => {
    process.stderr.write(args.map(a => (typeof a === 'string' ? a : safeJson(a))).join(' ') + '\n');
  };
}
function safeJson(v) { try { return JSON.stringify(v); } catch { return String(v); } }

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const codeCache = new Map();
const exprCache = new Map();

const CODE_ARGS = ['$', '$input', '$json', '$execution', '$workflow', '$runIndex', '$now', '$today',
  'DateTime', 'Duration', 'Interval', 'require', 'items'];

function compileCode(code) {
  let fn = codeCache.get(code);
  // The node's code runs in its own inner function, as in n8n's Code node sandbox, where these names are globals: so a node may declare
  // its own `items` (15b Dispatch guard does) without "Identifier 'items' has already been declared".
  if (!fn) { fn = new AsyncFunction(...CODE_ARGS, 'return (async function () {\n' + code + '\n}).call(this);'); codeCache.set(code, fn); }
  return fn;
}

function compileExpr(src) {
  let fn = exprCache.get(src);
  if (!fn) {
    // Sloppy-mode function so `with` can expose the n8n variables by name.
    fn = new Function('__ctx', `with (__ctx) { return (${src}\n); }`);
    exprCache.set(src, fn);
  }
  return fn;
}

class ReferencedNodeError extends Error {}

function nodeAccessor(nodes) {
  return (name) => {
    const n = nodes[name];
    if (!n) throw new ReferencedNodeError(`Referenced node is unexecuted: ${name}`);
    const items = n.items || [];
    return {
      first: () => items[0],
      last: () => items[items.length - 1],
      all: () => items,
      get item() { return items[0]; },
      isExecuted: true,
    };
  };
}

function inputAccessor(items) {
  return {
    all: () => items,
    first: () => items[0],
    last: () => items[items.length - 1],
    get item() { return items[0]; },
  };
}

function setZone(timezone) {
  Settings.defaultZone = timezone || 'UTC';
}

function executionVar(execution) {
  return Object.assign({ id: '', mode: 'production', resumeUrl: '', customData: { set() {}, get() {}, getAll: () => ({}) } }, execution || {});
}

// n8n's normalizeItems plus the Code node's checks for a run-once-for-all-items node.
const N8N_KEYS = new Set(['json', 'binary', 'pairedItem', 'error', 'index']);
function normalizeCodeResult(result) {
  if (result === undefined || result === null || typeof result !== 'object') {
    throw new Error("Code doesn't return items properly. Please return an array of objects, one for each item you would like to output.");
  }
  let arr = Array.isArray(result) ? result : (result.json ? [result] : [{ json: result }]);
  const hasTopKey = arr.some(it => it && typeof it === 'object' && Object.keys(it).some(k => N8N_KEYS.has(k)));
  arr.forEach((it, i) => {
    if (it === undefined || it === null || typeof it !== 'object') throw new Error(`Code doesn't return a single object [item ${i}]`);
    if (hasTopKey) {
      for (const k of Object.keys(it)) if (!N8N_KEYS.has(k)) throw new Error(`Unknown top-level item key: ${k} [item ${i}]`);
    }
  });
  if (!arr.every(it => 'json' in it)) {
    if (arr.some(it => 'json' in it)) throw new Error('Inconsistent item format');
    if (arr.every(it => 'binary' in it)) arr = arr.map(it => ({ json: {}, binary: it.binary }));
    else arr = arr.map(it => ({ json: it }));
  }
  arr.forEach((it, i) => {
    if (it.json === null || typeof it.json !== 'object' || Array.isArray(it.json)) throw new Error(`A 'json' property isn't an object [item ${i}]`);
    if (it.binary !== undefined && (it.binary === null || typeof it.binary !== 'object')) throw new Error(`A 'binary' property isn't an object [item ${i}]`);
  });
  return arr.map(it => (it.binary ? { json: it.json, binary: it.binary } : { json: it.json }));
}

function binaryHelpers(items, binaries, newBins) {
  let counter = 0;
  return {
    async getBinaryDataBuffer(itemIndex, propertyName) {
      const item = items[itemIndex];
      const ref = item && item.binary && item.binary[propertyName];
      if (!ref) throw new Error(`This operation expects the node's input data to contain a binary file '${propertyName}', but none was found [item ${itemIndex}]`);
      if (newBins.has(ref.id)) return newBins.get(ref.id);
      const data = binaries[ref.id];
      if (data === undefined) throw new Error(`Binary data '${propertyName}' is not available to this node`);
      return Buffer.from(data, 'base64');
    },
    async prepareBinaryData(data, fileName, mimeType) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const id = `new:${++counter}`;
      newBins.set(id, buf);
      const meta = { data: 'filesystem-v2', id, bytes: buf.length };
      if (mimeType) meta.mimeType = mimeType;
      if (fileName) {
        meta.fileName = fileName;
        const dot = fileName.lastIndexOf('.');
        if (dot > 0) meta.fileExtension = fileName.slice(dot + 1).toLowerCase();
      }
      return meta;
    },
    async binaryToBuffer(stream) { return Buffer.isBuffer(stream) ? stream : Buffer.from(stream); },
  };
}

function collectNewBinaries(value, newBins, out) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(v => collectNewBinaries(v, newBins, out)); return; }
  if (typeof value.id === 'string' && value.id.startsWith('new:') && newBins.has(value.id) && !(value.id in out)) {
    out[value.id] = newBins.get(value.id).toString('base64');
  }
  for (const v of Object.values(value)) collectNewBinaries(v, newBins, out);
}

// ---------- engine helpers ----------
const pendingCallbacks = new Map();
let callbackIds = 0;
function engineCall(reqId, op, payload) {
  const callback = ++callbackIds;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(callback, { resolve, reject });
    process.stdout.write(JSON.stringify({ id: reqId, callback, op, payload }) + '\n');
  });
}
function settleCallback(msg) {
  const p = pendingCallbacks.get(msg.callback);
  if (!p) return;
  pendingCallbacks.delete(msg.callback);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(new Error((msg.error && msg.error.message) || 'the engine helper failed'));
}

async function runCode(req) {
  setZone(req.timezone);
  const items = req.items || [];
  const newBins = new Map();
  const helpers = binaryHelpers(items, req.binaries || {}, newBins);
  // Phase 1.6 (FL-10): shrink a stored reference photo to `longSide` px on its long side, in the engine, without AI.
  helpers.midasResizeReference = (ref, longSide) => engineCall(req.id, 'resizeReference', { ref, longSide });
  const fn = compileCode(req.code);
  const now = DateTime.now();
  const result = await fn.call(
    { helpers, getWorkflowStaticData: () => ({}), getNodeParameter: () => undefined },
    nodeAccessor(req.nodes || {}), inputAccessor(items), items[0] ? items[0].json : {},
    executionVar(req.execution), req.workflow || {}, req.runIndex || 0, now, now.startOf('day'),
    DateTime, Duration, Interval, sandboxRequire, items,
  );
  const normalized = normalizeCodeResult(result);
  // Round-trip through JSON so Python receives exactly what n8n would store (undefined dropped, Dates as strings).
  const out = JSON.parse(JSON.stringify(normalized));
  const newBinaries = {};
  collectNewBinaries(out, newBins, newBinaries);
  return { items: out, newBinaries };
}

// ---------- expressions ----------
const TEMPLATE = /\{\{([\s\S]*?)\}\}/g;

function evalTemplate(src, ctx) {
  const body = src.slice(1); // drop leading '='
  const parts = [];
  let last = 0; let m;
  TEMPLATE.lastIndex = 0;
  while ((m = TEMPLATE.exec(body)) !== null) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ expr: m[1] });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  if (parts.length === 0) return body;
  if (parts.length === 1 && parts[0].expr !== undefined) {
    const code = parts[0].expr.trim();
    return code === '' ? '' : compileExpr(code)(ctx);
  }
  if (!parts.some(p => p.expr !== undefined)) return body;
  return parts.map(p => {
    if (p.text !== undefined) return p.text;
    const code = p.expr.trim();
    if (code === '') return '';
    const v = compileExpr(code)(ctx);
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }).join('');
}

function exprContext(req, item, itemIndex, items) {
  const now = DateTime.now();
  return {
    $json: item ? item.json : {},
    $binary: item ? (item.binary || {}) : {},
    $input: { item, all: () => items, first: () => items[0], last: () => items[items.length - 1] },
    $: nodeAccessor(req.nodes || {}),
    $execution: executionVar(req.execution),
    $workflow: req.workflow || {},
    $runIndex: req.runIndex || 0,
    $itemIndex: itemIndex,
    $now: now,
    $today: now.startOf('day'),
    DateTime, Duration, Interval,
  };
}

function resolveValue(value, ctx) {
  if (typeof value === 'string') {
    if (value.length > 0 && value[0] === '=') {
      try { return toPlain(evalTemplate(value, ctx)); }
      catch (e) { return { __exprError__: String(e && e.message || e) }; }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => resolveValue(v, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveValue(v, ctx);
    return out;
  }
  return value;
}

function toPlain(v) {
  if (v === undefined) return null;
  if (DateTime.isDateTime(v)) return v.toISO();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  if (v && typeof v === 'object') {
    try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
  }
  return v;
}

function resolve(req) {
  setZone(req.timezone);
  const items = req.items && req.items.length ? req.items : [{ json: {} }];
  return { perItem: items.map((item, i) => resolveValue(req.params, exprContext(req, item, i, items))) };
}

// ---------- loop ----------
async function handle(req) {
  switch (req.op) {
    case 'code': return runCode(req);
    case 'resolve': return resolve(req);
    case 'ping': return { pong: true };
    default: throw new Error(`unknown op ${req.op}`);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch (e) { process.stdout.write(JSON.stringify({ id: null, ok: false, error: { message: 'bad request json' } }) + '\n'); return; }
  if (req && req.op === 'callbackResult') { settleCallback(req); return; }
  try {
    const result = await handle(req);
    process.stdout.write(JSON.stringify({ id: req.id, ok: true, result }) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ id: req.id, ok: false, error: { message: String(e && e.message || e), name: e && e.name || 'Error', stack: String(e && e.stack || '').split('\n').slice(0, 6).join('\n') } }) + '\n');
  }
});
