// MT4 Plan: changes of 15 Oct 2026, 21:20 (owner answers). Deployed in n8n with model test version 'Owner answers 21:12 applied'.
// The full deployed node = src/mt4_plan.src.js built by build_plan.py, plus these parts. The prompt function itself is unchanged:
// with the old settings, the new code reproduces every prompt of preview 421 byte for byte (local run on n8n's own inputs).
// Deployed code checked against this local file on execution 422's inputs: cases, prompts and totals identical.

// 1. Helpers, placed after buildPrompt():
// Owner-answer helpers (21:20). A context entry is matched to the inventory by its head word, and only for furniture words.
const FURN = ['bed', 'nightstand', 'dresser', 'mirror', 'stool', 'chair', 'armchair', 'sofa', 'loveseat', 'table', 'bench', 'ottoman', 'chest', 'wardrobe', 'chaise', 'module', 'bookend', 'console', 'cabinet', 'sideboard', 'desk', 'shelf', 'bookcase', 'pouf', 'footstool'];
const sing = w => { const t = String(w || '').toLowerCase(); if (/(ches|shes|xes)$/.test(t)) return t.slice(0, -2); if (/[^s]s$/.test(t)) return t.slice(0, -1); return t; };
function headOf(t) { const w = String(t || '').toLowerCase().split(':')[0].split(/\s+(?:on|in|at|with|featuring|placed|under|beside|near|of|for|from)\s+/)[0].replace(/[^a-z\s-]/g, ' ').trim().split(/\s+/).filter(Boolean); return w.length ? sing(w[w.length - 1]) : ''; }
function invHeads(pieceText, inv) { const parts = [String(pieceText || '')].concat(inv.map(x => x.item)).join(';').split(/[;,+]|\s+and\s+|\s+with\s+/); return Array.from(new Set(parts.map(headOf).filter(h => FURN.indexOf(h) !== -1))); }
function dropColour(text, drop) { const d = arr(drop).map(x => String(x).toLowerCase()); if (!d.length || !text) return text; const parts = String(text).split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean); const kept = parts.filter(x => !d.some(k => x.toLowerCase().indexOf(k) !== -1)); if (!kept.length) return ''; return kept.length === 1 ? kept[0] : kept.slice(0, -1).join(', ') + ' and ' + kept[kept.length - 1]; }


// 2. In the per-case loop: the expected_counts guard, no_reading_ok, and the edits applied to the reading before buildPrompt():
  if (expected[p.folder] !== undefined && Number(expected[p.folder]) !== n) { c.reason = 'the owner answered ' + expected[p.folder] + ' pieces in chat, but the sheet count says ' + n + '; fix the sheet first'; continue; }
  const rd = readingOf(p.folder);
  const eye = rd ? rd.eye : {};
  const okNoReading = cfg.allow_no_reading === true || arr(cfg.no_reading_ok).indexOf(p.folder) !== -1;
  if (rd) {
    const seen = Math.max(Number(rd.row.eye_count) || 0, Number(rd.row.second_count) || 0);
    if (rd.row.cropped === true || eye.cropped === true) { c.reason = 'the reading says the photo is cropped; stage 04 holds such a photo'; continue; }
    if (seen && n > seen) { c.reason = 'the photo shows ' + seen + ' pieces and the sheet holds ' + n + '; stage 04 holds this'; continue; }
  } else if (!okNoReading) { c.reason = 'no usable first-reader answer for this photo; stage 04 never sends without one (no_reading_ok in MT1 Config tests it from the sheet alone)'; continue; }
  else c.notes.push('no usable first-reader answer: the prompt uses the sheet only (no colour, details or context from the photo)');
  const iv = inventoryFrom(col(r, 'pieces that belong'), n);
  const piecesText = col(r, 'pieces that belong');
  const sheetSided = piecesText.split(/\s*;\s*|\s+\+\s+/).filter(x => /\b(LEFT|RIGHT)\b/.test(x)).map(x => x.trim());
  const excl = col(r, 'excluded pieces');
  const ed = (cfg.prompt_edits || {})[p.folder] || {};
  const heads = invHeads(piecesText, iv.inv);
  const notInv = x => heads.indexOf(headOf(x)) === -1;
  const shownRaw = arr(eye.shown_with).map(str);
  const ctxRaw = arr(eye.pieces).filter(x => x && typeof x === 'object');
  const shownKept = shownRaw.filter(notInv);
  const ctxKept = ctxRaw.filter(x => x.role !== 'context' || notInv(x.label || x.kind || ''));
  const dropped = shownRaw.filter(x => !notInv(x)).concat(ctxRaw.filter(x => x.role === 'context' && !notInv(x.label || x.kind || '')).map(x => String(x.label || x.kind || '')));
  if (dropped.length) c.notes.push('context entries that name an inventory piece are not told to be left out: ' + dropped.join('; '));
  const colourRaw = str(eye.colour_observed || '');
  const colour = dropColour(colourRaw, ed.colour_drop);
  if (colour !== colourRaw) c.notes.push('owner edit: colour line without "' + arr(ed.colour_drop).join('", "') + '"');
  if (ed.drop_relations && arr(eye.relations).length) c.notes.push('owner edit: the reader\'s relation lines are left out');
  const s = {
    brief: { product_type: col(r, 'product type').replace(/\s*\([^)]*\)/g, '').trim(), colour: rd ? '' : col(r, 'true colour') },
    observation: {
      category_seen: eye.category || '', colour_observed: colour, material_appearance: str(eye.material_appearance || ''),
      design_locks: arr(eye.design_locks).map(str), shown_with: shownKept,
      pieces_seen: ctxKept, relations: ed.drop_relations ? [] : arr(eye.relations).map(str),
      sided_parts: sheetSided.length ? sheetSided : arr(eye.sided_parts).map(str)
    },
    exclusions: /^(none|no|)$/i.test(excl) ? [] : excl.split(/\s*;\s*/).filter(Boolean).map(x => ({ item: x })),
    unknowns: arr(eye.unknowns).map(str)
  };
