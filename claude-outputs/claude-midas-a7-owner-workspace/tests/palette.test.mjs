// Workspace palettes: palette.js accepts the warm and cold palettes, the picker offers each one,
// and every cold palette defines light and dark tokens that meet WCAG 2.1 AA contrast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const paletteSource = read('palette.js'), startHtml = read('start.html'), startCss = read('start.css'), catalogueCss = read('catalogue/catalogue.css');
const PALETTES = JSON.parse(paletteSource.match(/const PALETTES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const COLD = ['glacier', 'fjord', 'frost'];

function runPalette({ stored = {}, prefersDark = false } = {}) {
  const store = { ...stored }, listeners = {}, inputs = [];
  const root = { dataset: {} };
  const document = {
    documentElement: root,
    querySelectorAll: selector => inputs.filter(input => selector.includes(`name="${input.name}"`)),
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const window = { matchMedia: () => ({ matches: prefersDark, addEventListener() {} }) };
  const localStorage = { getItem: key => (key in store ? store[key] : null), setItem: (key, value) => { store[key] = String(value); } };
  vm.runInNewContext(paletteSource, { document, window, localStorage });
  for (const value of PALETTES) inputs.push({ name: 'palette', value, checked: false });
  for (const value of ['light', 'dark', 'system']) inputs.push({ name: 'appearance', value, checked: false });
  listeners.DOMContentLoaded?.();
  const choose = (name, value) => listeners.change?.({ target: { name, value } });
  return { root, store, inputs, choose };
}

test('palette.js offers the three warm and three cold palettes, default Noir Navy', () => {
  assert.deepEqual(PALETTES, ['noir', 'navy', 'noir-navy', 'glacier', 'fjord', 'frost']);
  const { root } = runPalette();
  assert.equal(root.dataset.palette, 'noir-navy');
  assert.equal(root.dataset.mode, 'dark');
});

test('a saved cold palette is applied before first paint and checked in the picker', () => {
  for (const name of COLD) {
    const { root, inputs } = runPalette({ stored: { 'midas-owner-palette': name, 'midas-owner-appearance': 'light' } });
    assert.equal(root.dataset.palette, name);
    assert.equal(root.dataset.mode, 'light');
    assert.deepEqual(inputs.filter(input => input.name === 'palette' && input.checked).map(input => input.value), [name]);
  }
});

test('choosing a cold palette saves it; an unknown value falls back to Noir Navy', () => {
  const { root, store, choose } = runPalette();
  choose('palette', 'fjord');
  assert.equal(root.dataset.palette, 'fjord');
  assert.equal(store['midas-owner-palette'], 'fjord');
  choose('palette', 'magenta');
  assert.equal(root.dataset.palette, 'noir-navy');
  assert.equal(store['midas-owner-palette'], 'noir-navy');
  const stale = runPalette({ stored: { 'midas-owner-palette': 'magenta' } });
  assert.equal(stale.root.dataset.palette, 'noir-navy');
});

test('the Preferences picker has a radio and a swatch for every palette, grouped warm and cold', () => {
  for (const name of PALETTES) {
    assert.match(startHtml, new RegExp(`<input type="radio" name="palette" value="${name}"`), `radio for ${name}`);
    assert.match(startHtml, new RegExp(`palette-swatch is-${name}"`), `swatch markup for ${name}`);
    assert.match(startCss, new RegExp(`\\.palette-swatch\\.is-${name}\\{background:`), `swatch style for ${name}`);
  }
  assert.match(startHtml, /role="group" aria-labelledby="paletteWarmLabel"><p id="paletteWarmLabel" class="palette-group-label">Warm<\/p>/);
  assert.match(startHtml, /role="group" aria-labelledby="paletteColdLabel"><p id="paletteColdLabel" class="palette-group-label">Cold<\/p>/);
  const cold = startHtml.slice(startHtml.indexOf('paletteColdLabel'));
  for (const name of COLD) assert.ok(cold.includes(`value="${name}"`), `${name} sits in the cold group`);
});

// Seeds are read back from the shipped CSS so the contrast check guards what users actually get.
function seeds(name) {
  const blocks = [...startCss.matchAll(new RegExp(`:root\\[data-palette="${name}"\\]\\{([^}]*)\\}`, 'g'))].map(match => match[1]).join(';');
  const tokens = {};
  for (const [, key, value] of blocks.matchAll(/--(k-[a-z0-9-]+):(#[0-9a-f]{6})/g)) tokens[key] = value;
  return tokens;
}
const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('every cold palette defines light and dark seeds in start.css and catalogue.css', () => {
  const required = ['k-950', 'k-700', 'k-600', 'k-500', 'k-300', 'k-200', 'k-50', 'k-canvas', 'k-surface', 'k-ink', 'k-muted', 'k-band', 'k-panel', 'k-danger', 'k-d-canvas', 'k-d-surface', 'k-d-surface-2', 'k-d-ink', 'k-d-muted', 'k-d-select-tint', 'k-d-band', 'k-d-danger'];
  for (const name of COLD) {
    const tokens = seeds(name);
    for (const key of required) assert.ok(tokens[key], `${name} defines --${key}`);
    assert.match(startCss, new RegExp(`:root\\[data-palette="${name}"\\]\\{[^}]*--k-arrow:url\\(`), `${name} light select arrow`);
    assert.match(catalogueCss, new RegExp(`:root\\[data-palette="${name}"\\]\\{--c-bg:#`), `${name} catalogue light tokens`);
    assert.match(catalogueCss, new RegExp(`:root\\[data-mode="dark"\\]\\[data-palette="${name}"\\]\\{--c-bg:#`), `${name} catalogue dark tokens`);
  }
});

test('cold palette text and action colours meet WCAG 2.1 AA in light and dark', () => {
  for (const name of COLD) {
    const k = seeds(name);
    const pairs = [
      ['light ink on canvas', k['k-ink'], k['k-canvas'], 4.5], ['light muted on canvas', k['k-muted'], k['k-canvas'], 4.5], ['light muted on band', k['k-muted'], k['k-band'], 4.5],
      ['light action text on surface', k['k-600'], k['k-surface'], 4.5], ['light action text on tint', k['k-600'], k['k-50'], 4.5], ['white on action', '#ffffff', k['k-600'], 4.5], ['white on hover-free action 500', '#ffffff', k['k-500'], 4.5],
      ['light error on surface', k['k-danger'], k['k-surface'], 4.5], ['light focus ring on canvas', k['k-600'], k['k-canvas'], 3],
      ['dark ink on canvas', k['k-d-ink'], k['k-d-canvas'], 4.5], ['dark muted on surface', k['k-d-muted'], k['k-d-surface'], 4.5], ['dark muted on surface 2', k['k-d-muted'], k['k-d-surface-2'], 4.5],
      ['dark action text on surface', k['k-200'], k['k-d-surface'], 4.5], ['dark accent text on surface 2', k['k-300'], k['k-d-surface-2'], 4.5], ['dark ink on selection', k['k-d-ink'], k['k-d-select-tint'], 4.5],
      ['dark error on surface 2', k['k-d-danger'], k['k-d-surface-2'], 4.5], ['dark focus ring on canvas', k['k-300'], k['k-d-canvas'], 3],
    ];
    for (const [label, fg, bg, min] of pairs) {
      const ratio = contrast(fg, bg);
      assert.ok(ratio >= min, `${name}: ${label} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    }
  }
});

test('cold palettes keep errors red and leave the warm palettes untouched', () => {
  const coldLayer = startCss.slice(startCss.indexOf('Cold palettes: Glacier'));
  assert.ok(coldLayer.length > 0);
  assert.match(coldLayer, /:is\(\.setup-actions p\.error,\.source-status\.error\)\{color:var\(--k-danger-now\)/);
  for (const name of COLD) assert.match(seeds(name)['k-danger'], /^#b4/, `${name} light error stays red`);
  // Every selector in the cold layer is scoped to a cold palette, except the picker's own group styles.
  const css = coldLayer.slice(coldLayer.indexOf('*/') + 2).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/(^|\})([^{}]+)\{/g)].map(match => match[2].trim()).filter(selector => selector && !selector.startsWith('@'));
  assert.ok(rules.length > 40, 'cold layer rules found');
  for (const selector of rules) {
    const parts = []; let depth = 0, current = '';
    for (const ch of selector) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch; }
    parts.push(current);
    const unscoped = parts.filter(part => !/data-palette="(glacier|fjord|frost)"|\[data-palette="glacier"\]/.test(part) && !/^\s*(\/\*[\s\S]*?\*\/\s*)?(\.palette-group|#preferencesDialog \.palette-group-label|\.palette-choice label small|\.palette-swatch\.is-(glacier|fjord|frost))/.test(part));
    assert.deepEqual(unscoped, [], `unscoped cold rule: ${selector.slice(0, 120)}`);
  }
});
