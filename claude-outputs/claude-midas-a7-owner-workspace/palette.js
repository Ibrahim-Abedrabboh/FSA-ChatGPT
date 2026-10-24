// Workspace look: palette (warm: Crimson Noir, Crimson Navy, Noir Navy; cold: Glacier, Fjord, Frost) and appearance (light, dark or follow the system).
// Default look: Noir Navy, dark. A per-browser display preference only; it is never sent to the owner APIs. Loaded without defer so it applies before first paint.
(() => {
  const PALETTES = ['noir', 'navy', 'noir-navy', 'glacier', 'fjord', 'frost'];
  const root = document.documentElement, media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const read = (key, fallback, allowed) => { try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let palette = read('midas-owner-palette', 'noir-navy', PALETTES), appearance = read('midas-owner-appearance', 'dark', ['light', 'dark', 'system']);
  const apply = () => {
    root.dataset.palette = palette;
    root.dataset.mode = appearance === 'system' ? (media && media.matches ? 'dark' : 'light') : appearance;
    for (const input of document.querySelectorAll('input[name="palette"]')) input.checked = input.value === palette;
    for (const input of document.querySelectorAll('input[name="appearance"]')) input.checked = input.value === appearance;
  };
  apply();
  if (media) { const follow = () => { if (appearance === 'system') apply(); }; if (media.addEventListener) media.addEventListener('change', follow); else if (media.addListener) media.addListener(follow); }
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.addEventListener('change', event => {
      const input = event.target;
      if (input && input.name === 'palette') { palette = PALETTES.includes(input.value) ? input.value : 'noir-navy'; write('midas-owner-palette', palette); apply(); }
      if (input && input.name === 'appearance') { appearance = ['light', 'system'].includes(input.value) ? input.value : 'dark'; write('midas-owner-appearance', appearance); apply(); }
    });
  });
})();
