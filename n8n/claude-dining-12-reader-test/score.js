// Score (17 Oct 2026). Pipeline test only: the photo is a generated test photo, NOT A VENDOR PHOTO.
// Owner's sheet (17 Oct 2026, 02:31 "OK"): 1 table + 10 armless chairs + 2 armchairs = 13 product pieces; nothing excluded.
const raw = $('03 Eye reads the photo (copy of A7 03)').first().json || {};
const gate = $('Gate: allowed file only').first().json;
function bodyOf(o) { if (!o || typeof o !== 'object') return o; if (Array.isArray(o.output)) return o.output; if (Array.isArray(o.candidates)) return o.candidates; if (o.content !== undefined) return o.content; if (o.message !== undefined) return o.message; return o; }
function deepText(o) { if (o === null || o === undefined) return ''; if (typeof o === 'string') return o.indexOf('{') !== -1 ? o : ''; if (Array.isArray(o)) { for (const x of o) { const t = deepText(x); if (t) return t; } return ''; } if (typeof o === 'object') { if (typeof o.text === 'string' && o.text.indexOf('{') !== -1) return o.text; for (const k of Object.keys(o)) { const t = deepText(o[k]); if (t) return t; } } return ''; }
function parse(t) { if (!t) return null; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
const u = raw.usageMetadata || raw.usage || null;
const n = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const tokens = u ? { input: n(u.promptTokenCount), output: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount) } : null;
const usd = tokens ? Number(((tokens.input * 0.75 + tokens.output * 3.75) / 1e6).toFixed(5)) : null;
const finish = String((raw.candidates && raw.candidates[0] && raw.candidates[0].finishReason) || '').toUpperCase();
const data = raw.error ? null : parse(deepText(bodyOf(raw)));
const base = { label: 'PIPELINE TEST ONLY: generated test photo, NOT A VENDOR PHOTO', photo: gate, model: 'gemini-3.8-flash', prompt: 'A7 03 old reader prompt (eefd6c42), byte-identical', tokens, usd_estimate: usd,
  cost_basis: 'provider token counts x USD 0.75 input / 3.75 output per million (A7 01 prices, read 16 Oct 2026); an estimate, not an invoice', finish_reason: finish };
if (!data) return [{ json: Object.assign(base, { result: 'HOLD', why: raw.error ? 'the reader did not answer: ' + String(raw.error.message || raw.error).slice(0, 200) : 'the answer was not in the expected format' + (finish ? ' (finish ' + finish + ')' : '') }) }];
const pieces = Array.isArray(data.pieces) ? data.pieces : [];
const roleOf = p => String(p.role || '').toLowerCase();
const prod = pieces.filter(p => roleOf(p) === 'product');
const isArm = p => /arm\s*-?\s*chair|carver|with arms|\barmed\b/i.test(String(p.kind || '') + ' ' + String(p.label || '')) && !/armless/i.test(String(p.kind || '') + ' ' + String(p.label || ''));
const isTable = p => /table/i.test(String(p.kind || '')) || (/table/i.test(String(p.label || '')) && !/chair/i.test(String(p.kind || '')));
const isChair = p => /chair|seat/i.test(String(p.kind || '') + ' ' + String(p.label || ''));
const t = prod.filter(isTable).length, arm = prod.filter(p => !isTable(p) && isArm(p)).length, side = prod.filter(p => !isTable(p) && !isArm(p) && isChair(p)).length;
const other = prod.filter(p => !isTable(p) && !isChair(p));
const ok = { total_13: prod.length === 13, table_1: t === 1, armless_10: side === 10, armchairs_2: arm === 2, none_excluded: !pieces.some(p => roleOf(p) === 'excluded'), no_other_product: other.length === 0 };
const pass = Object.values(ok).every(Boolean);
return [{ json: Object.assign(base, {
  result: pass ? 'PASS (pipeline test only)' : 'HOLD: does not match the sheet',
  sheet: { table: 1, armless_chairs: 10, armchairs: 2, total: 13 },
  read: { product_total: prod.length, table: t, armless_chairs: side, armchairs: arm, other_product: other.map(p => p.label + ' (' + p.kind + ')') },
  checks: ok,
  roles: pieces.reduce((a, p) => { const r = roleOf(p) || 'none'; a[r] = (a[r] || 0) + 1; return a; }, {}),
  count_by_kind: data.count_by_kind, pieces: pieces.map(p => ({ label: p.label, kind: p.kind, role: p.role, seen_whole: p.seen_whole, box: p.box })),
  cropped: data.cropped, unknowns: data.unknowns, conflicts: data.conflicts, views_not_pieces: data.views_not_pieces, printed_counts: data.printed_counts,
  relations: data.relations, sided_parts: data.sided_parts, category: data.category, colour_observed: data.colour_observed
}) }];
