// One row per test folder: both blind counts side by side. Nothing here was told the expected number.
function deepText(o) {
  if (o === null || o === undefined) return '';
  if (typeof o === 'string') return o.indexOf('{') !== -1 ? o : '';
  if (Array.isArray(o)) { for (const x of o) { const t = deepText(x); if (t) return t; } return ''; }
  if (typeof o === 'object') {
    if (typeof o.text === 'string' && o.text.indexOf('{') !== -1) return o.text;
    for (const k of Object.keys(o)) { const t = deepText(o[k]); if (t) return t; }
  }
  return '';
}
function parse(t) { if (!t) return null; const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function num(v) { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function short(v, n) { const s = typeof v === 'string' ? v : JSON.stringify(v); return (s || '').slice(0, n); }
const kept = $('Keep eye').all();
const seconds = $input.all();
const rows = [];
for (let i = 0; i < kept.length; i++) {
  const k = kept[i].json;
  const eyeText = deepText(k.eye_out), secText = deepText(seconds[i] ? seconds[i].json : null);
  const eye = parse(eyeText), sec = parse(secText);
  const prod = eye ? arr(eye.pieces).filter(p => p && String(p.role || 'product').toLowerCase() === 'product') : [];
  const eyeCount = eye ? (prod.length || arr(eye.count_by_kind).reduce((t, r) => t + (num(r.count) || 0), 0) || null) : null;
  const secCount = sec ? (num(sec.total) !== null ? num(sec.total) : arr(sec.pieces).reduce((t, r) => t + (num(r.count) || 0), 0)) : null;
  const excl = eye ? arr(eye.pieces).filter(p => p && String(p.role).toLowerCase() === 'excluded').map(p => p.label || p.kind) : [];
  const problems = [k.problem].filter(Boolean);
  if (k.eye_out && k.eye_out.finishReason === 'MAX_TOKENS') problems.push('first reader ran out of output room (thinking counts toward the limit)');
  if (!eye) problems.push('first reader returned nothing usable' + (k.eye_out && k.eye_out.error ? ': ' + short(k.eye_out.error, 120) : ''));
  if (!sec) problems.push('second count returned nothing usable' + (seconds[i] && seconds[i].json && seconds[i].json.error ? ': ' + short(seconds[i].json.error, 120) : ''));
  rows.push({
    run_id: k.run_id, folder: k.folder, file_name: k.file_name, mime: k.mime,
    eye_count: eyeCount, second_count: secCount,
    counts_agree: eyeCount !== null && secCount !== null && eyeCount === secCount,
    excluded_seen: excl.concat(arr(sec && sec.excluded).map(x => (x.count || '') + ' ' + (x.kind || ''))).join('; '),
    printed_counts: arr(eye && eye.printed_counts).map(p => p.text || p.count).join('; '),
    colour_observed: eye ? String(eye.colour_observed || '') : '',
    sided_parts: arr(eye && eye.sided_parts).map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('; '),
    views_not_pieces: arr(eye && eye.views_not_pieces).join('; '),
    cropped: Boolean(eye && eye.cropped) || Boolean(sec && sec.cropped),
    eye_raw: short(eyeText, 6000), second_raw: short(secText, 3000),
    problem: problems.join('; ')
  });
}
// Folders with no photo still get a row.
for (const p of $('Pair photos with folders').all().map(i => i.json).filter(p => !p.file_id)) {
  rows.push({ run_id: p.run_id, folder: p.folder, file_name: '', mime: '', eye_count: null, second_count: null, counts_agree: false,
    excluded_seen: '', printed_counts: '', colour_observed: '', sided_parts: '', views_not_pieces: '', cropped: false, eye_raw: '', second_raw: '', problem: p.problem });
}
rows.sort((a, b) => Number(a.folder.replace(/\D/g, '')) - Number(b.folder.replace(/\D/g, '')));
return rows.map(r => ({ json: r }));
