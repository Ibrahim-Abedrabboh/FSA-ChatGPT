// Score the blind counts against the owner's answer sheet. A row is final only when the owner confirmed it:
// 'confirmed by owner' says yes, or the owner's 'Answer' cell is filled and does not start with 'no'.
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
let truth = {};
let sheetProblem = '';
try {
  const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
  const rows = parseCsv(buf.toString('utf8'));
  const head = rows[0].map(h => h.trim().toLowerCase());
  const iF = head.indexOf('folder'), iC = head.findIndex(h => h.indexOf('true piece count') === 0), iY = head.findIndex(h => h.indexOf('confirmed by owner') === 0), iA = head.indexOf('answer');
  for (const r of rows.slice(1)) {
    const yes = iY >= 0 && String(r[iY] || '').trim().toLowerCase() === 'yes';
    const ans = iA >= 0 ? String(r[iA] || '').trim() : '';
    const byAnswer = ans !== '' && !/^no\b/i.test(ans);
    truth[String(r[iF] || '').trim()] = { count: String(r[iC] || '').trim(), confirmed: yes || byAnswer, answer: ans };
  }
} catch (e) { sheetProblem = 'answer sheet could not be read'; }
function verdict(seen, t) {
  if (!t || !t.count) return 'no answer on the sheet';
  const m = t.count.match(/\d+/);
  if (!m) return 'answer not given yet';
  if (seen === null || seen === undefined) return 'no count';
  const ok = Number(m[0]) === seen;
  return (t.confirmed ? '' : 'provisional ') + (ok ? 'match' : 'miss (' + seen + ' vs ' + m[0] + ')');
}
const at = new Date().toISOString();
return $('Collect results').all().map(i => {
  const r = i.json; const t = truth[r.folder];
  return { json: { ...r, true_count: t ? t.count : '', truth_confirmed: Boolean(t && t.confirmed),
    eye_vs_truth: verdict(r.eye_count, t), second_vs_truth: verdict(r.second_count, t),
    problem: [r.problem, sheetProblem].filter(Boolean).join('; '), at } };
});
