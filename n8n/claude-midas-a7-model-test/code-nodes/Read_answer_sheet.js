// Reads the owner's answer sheet (downloaded from Drive as CSV) into rows. Code only (15 Oct 2026).
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
let sheet_rows = [], sheet_problem = '';
try {
  const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
  const t = parseCsv(buf.toString('utf8').replace(/^﻿/, ''));
  const head = t[0].map(h => String(h).trim().toLowerCase());
  if (head.indexOf('folder') === -1) sheet_problem = 'The answer sheet has no "folder" column.';
  else sheet_rows = t.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, String(r[i] || '').trim()])));
} catch (e) { sheet_problem = 'The answer sheet could not be read.'; }
return [{ json: { sheet_rows, sheet_problem } }];
