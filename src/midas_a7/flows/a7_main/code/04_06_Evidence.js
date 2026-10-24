// Steps 3–6 · Recognize, read signs, preserve uncertainty, scene: code checks what the two readers returned.
// The readers were not told any expected number. Code compares their counts with what the client stated.
// 15 Oct 2026 (after the reader test): a reader that did not answer is an owner hold, never a client question;
// set pieces nobody confirmed are asked about; printed labels are compared as a sum; swatch colours stay apart;
// anything written about the product is read before anything is asked.
// P1.8 (16 Oct 2026): the replies are no longer simplified, so each call's token counts can be recorded. bodyOf picks the answer
// part of a reply (so an echoed instruction is never read as the answer); textCall records the provider's own token counts.
function bodyOf(o) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o.output)) return o.output;
  if (Array.isArray(o.candidates)) return o.candidates;
  if (o.content !== undefined) return o.content;
  if (o.message !== undefined) return o.message;
  return o;
}
function usageOf(o) {
  if (!o || typeof o !== 'object') return null;
  const u = o.usage || o.usageMetadata || (o.response && o.response.usage) || null;
  if (!u || typeof u !== 'object') return null;
  const n = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  if (u.promptTokenCount !== undefined || u.candidatesTokenCount !== undefined) return { input: n(u.promptTokenCount), output: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount) };
  if (u.input_tokens !== undefined || u.output_tokens !== undefined) return { input: n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens), output: n(u.output_tokens) };
  if (u.prompt_tokens !== undefined) return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
  return null;
}
function textCall(state, step, node, model, raw) {
  if (!raw) return state;
  const P = state.text_prices || {};
  const u = usageOf(raw);
  const pr = P.models && P.models[model] ? P.models[model] : null;
  const usd = u && pr ? Number(((u.input * pr.input + u.output * pr.output) / 1e6).toFixed(5)) : null;
  const e = raw.error ? (typeof raw.error === 'string' ? raw.error : String((raw.error && raw.error.message) || JSON.stringify(raw.error))).split('\n')[0].slice(0, 120) : '';
  const rec = { step, node, model, at: new Date().toISOString(), tokens: u, usd, error: e, basis: u ? (pr ? 'provider token counts x prices read ' + (P.read_on || '?') + ' (' + (pr.source || '') + '); an estimate, not an invoice' : 'provider token counts; no price recorded for this model') : 'the provider reported no token counts (the call may still be charged)' };
  state.text_calls = (Array.isArray(state.text_calls) ? state.text_calls : []).concat([rec]);
  state.text_calls_new = (Array.isArray(state.text_calls_new) ? state.text_calls_new : []).concat([rec]);
  return state;
}
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
function parse(t) {
  if (!t) return null;
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
function out(name) { try { return $(name).first().json; } catch (e) { return null; } }
function num(v) { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function short(v, n) { const t = typeof v === 'string' ? v : (v && v.message) ? String(v.message) : JSON.stringify(v); return String(t || '').split('\n')[0].slice(0, n); }
// What a reader node returned: usable data, or why not. A node error or a cut-off answer is the service, not the photo.
function reading(raw, label) {
  if (!raw) return { data: null, fail: { who: 'owner', why: label + ' did not answer, so the photo could not be read yet. The client was not asked anything.' } };
  if (raw.error) return { data: null, fail: { who: 'owner', why: label + ' did not answer (' + short(raw.error, 120) + '), so the photo could not be read yet. The client was not asked anything.' } };
  const finish = String(raw.finishReason || (raw.candidates && raw.candidates[0] && raw.candidates[0].finishReason) || raw.stop_reason || '').toUpperCase();
  const data = parse(deepText(bodyOf(raw)));
  if (!data && (finish === 'MAX_TOKENS' || finish === 'MAX_TOKENS_REACHED')) return { data: null, fail: { who: 'owner', why: label + ' was cut off before it finished (output limit reached). The client was not asked anything.' } };
  if (!data) return { data: null, fail: { who: 'owner', why: label + ' answered, but not in the expected format. The client was not asked anything.' } };
  return { data, fail: null };
}
const s = out('02 Ingest files');
// Fallback readers (owner, 16 Oct 2026, after the first paid test): Gemini reads first; only when it did not answer after its retries does
// gpt-6.1-sol read the same photo with the same prompt (reader test 2, execution 459). The fallback is used only when the Gemini node of
// this run returned an error, so an older fallback answer is never read. The second count stays Claude, so the two readers stay
// different families.
const eyeMain = s.reader_recovery ? {error:'Primary reader unavailable; its uncertain reservation remains held.'} : out('03 Eye reads the product photo');
const eyeBack = s.preserved_reader_response || (eyeMain && eyeMain.error ? out('Recovery · Fallback result') : null);
const roomMain = s.room_key ? out('06 Room reader') : null;
const roomBack = roomMain && roomMain.error ? out('06b Room fallback (OpenAI)') : null;
const why = r => short(r.error, 80);
const eyeR = eyeBack ? reading(eyeBack, 'The fallback photo reader (gpt-6.1-sol, after Gemini did not answer: ' + why(eyeMain) + ')') : reading(eyeMain, 'The photo reader');
const secondR = s.reader_recovery ? {data:s.cached_second,fail:null} : reading(out('05 Second count'), 'The second count');
const roomR = s.room_key ? (roomBack ? reading(roomBack, 'The fallback room reader (gpt-6.1-sol, after Gemini did not answer: ' + why(roomMain) + ')') : reading(roomMain, 'The room reader')) : { data: null, fail: null };
const readersUsed = { photo: eyeBack ? 'gpt-6.1-sol (fallback; Gemini did not answer)' : 'gemini-3.8-flash', room: s.room_key ? (roomBack ? 'gpt-6.1-sol (fallback; Gemini did not answer)' : 'gemini-3.8-flash') : '', second: 'claude-sonnet-5-5' };
const eye = eyeR.data, second = secondR.data, room = roomR.data;
const brief = s.brief;
const critical = [];
const conflicts = [];
const facts = [];
const unknowns = [];
for (const r of [eyeR, secondR, roomR]) if (r.fail) critical.push({ what: 'reader_unavailable', who: 'owner', why: r.fail.why });

// Reader 1 (Eye): pieces with boxes; the count is the length of the product list.
let eyeTotal = null, eyeKinds = [], eyeExcluded = [];
if (eye) {
  const pieces = arr(eye.pieces);
  const prod = pieces.filter(p => (p && String(p.role || 'product').toLowerCase()) === 'product');
  eyeExcluded = pieces.filter(p => p && String(p.role).toLowerCase() === 'excluded').map(p => p.label || p.kind);
  eyeTotal = prod.length || arr(eye.count_by_kind).reduce((t, r) => t + (num(r.count) || 0), 0) || null;
  const byKind = {};
  for (const p of prod) { const k = String(p.kind || p.label || 'piece').toLowerCase(); byKind[k] = (byKind[k] || 0) + 1; }
  eyeKinds = Object.keys(byKind).map(k => ({ kind: k, count: byKind[k] }));
  if (eyeTotal === null) critical.push({ what: 'product_photo_unread', who: 'client', why: 'The photo reader found no product pieces in the photo.' });
}
// Reader 2 (second model family): blind count.
let secondTotal = null;
if (second) secondTotal = num(second.total) !== null ? num(second.total) : arr(second.pieces).reduce((t, r) => t + (num(r.count) || 0), 0);

// Printed labels are text on the photo, not the product. Their pieces are added up before any comparison.
const printed = arr(eye && eye.printed_counts).map(pc => ({ text: String((pc && pc.text) || ''), item: String((pc && pc.item) || ''), c: num(pc && pc.count) })).filter(p => p.c);
let printedTotal = null;
if (printed.length) {
  const totals = printed.filter(p => /\b(total|sets?|pieces?|pcs|items)\b/i.test(p.item));
  printedTotal = totals.length ? Math.max(...totals.map(p => p.c)) : printed.reduce((t, p) => t + p.c, 0);
}
const printedText = printed.map(p => p.text || (p.c + ' ' + p.item)).join(' + ');

// Written about the product: the client's own words, written files they sent, and text printed on the photo.
// The photo decides what it shows. Written words are read whenever the photo does not settle a question,
// before anything is asked. A written file that cannot be read yet goes to the owner before the client is asked.
const clientWords = [brief.product_type, brief.category, brief.sku, brief.dimensions, brief.material, brief.product_notes, brief.instructions].filter(Boolean).join(' | ');
const fileWords = arr(s.written_files).map(f => String(f.text || '')).join(' | ');
const photoWords = arr(eye && eye.signs).map(x => x && x.text).filter(Boolean).concat(printed.map(p => p.text)).join(' | ');
const writtenAll = [clientWords, fileWords, photoWords].filter(Boolean).join(' | ').toLowerCase();
const unreadFiles = arr(s.references).filter(r => r.role === 'spec' && r.read !== 'read as text').map(r => r.name);
function totalIn(t) { const m = String(t || '').match(/(\d{1,3})\s*-?\s*(piece|pieces|pc|pcs)\b/i); return m ? num(m[1]) : null; }
const writtenTotal = totalIn(clientWords) || totalIn(fileWords);
const writtenTotalFrom = totalIn(clientWords) ? 'the client\'s description' : 'a written file';

const stated = brief.inventory_total || 0;
const target = stated || writtenTotal || 0;
// Crop check (live test, 16 Oct 2026, owner go): one reading called the Test 10 photo "cropped" although every piece sits inside the
// frame (chairs hidden behind the table were read as cut off), and stage 04 then held after go 1. "Cropped" is now kept only when a
// product box of the photo reader touches a frame edge (within 15 of 1000), or when the reader gave no usable product box. Boxes are
// [ymin, xmin, ymax, xmax] on 0-1000, as the reader is asked. A crop flag that the boxes do not support is kept as a note.
const EDGE = 15;
const productBoxes = arr(eye && eye.pieces).filter(p => p && p.role !== 'context' && p.role !== 'excluded' && Array.isArray(p.box) && p.box.length === 4 && p.box.every(v => v !== null && v !== '' && Number.isFinite(Number(v)))).map(p => p.box.map(Number));
const nearEdge = productBoxes.length ? Math.min.apply(null, productBoxes.map(b => Math.min(b[0], b[1], 1000 - b[2], 1000 - b[3]))) : null;
// D13 (owner, 16 Oct 2026, 19:26): the readers now report "cropped" (cut off by the frame) and "hidden" (covered by another piece or
// object) apart. A piece the photo reader marks cut_off also counts as a crop flag; hidden parts become unknowns, never a crop.
const readerCropped = Boolean(eye && eye.cropped) || Boolean(second && second.cropped) || arr(eye && eye.pieces).some(p => p && p.role !== 'context' && p.role !== 'excluded' && p.cut_off === true);
const hiddenSeen = arr(eye && eye.hidden).concat(arr(second && second.hidden)).map(x => String(x).replace(/\s+/g, ' ').trim().slice(0, 160)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 12);
const cropped = readerCropped && (nearEdge === null || nearEdge <= EDGE);
const cropNote = readerCropped && !cropped ? 'A reader said the photo is cropped, but every product box is inside the frame (nearest edge ' + Math.round(nearEdge) + ' of 1000), so it is treated as not cropped.' : '';
const agree = eyeTotal !== null && secondTotal !== null && eyeTotal === secondTotal;
// An itemised printed label that covers every piece the readers see (a cropped dining set) gives the inventory.
const stemK = w => { const x = String(w || '').toLowerCase().trim(); if (/(ch|sh|x)es$/.test(x)) return x.slice(0, -2); if (/ves$/.test(x)) return x.slice(0, -3) + 'f'; if (/[^s]s$/.test(x)) return x.slice(0, -1); return x; };
const labelItems = printed.filter(p => !/\b(total|sets?|pieces?|pcs|items)\b/i.test(p.item)).map(p => ({ item: stemK(p.item || p.text.replace(/\d+/g, '')), c: p.c, text: p.text }));
let labelFits = false;
if (labelItems.length && eyeKinds.length) {
  const used = {};
  labelFits = eyeKinds.every(k => {
    const kk = stemK(k.kind);
    const li = labelItems.find(l => l.item === kk) || labelItems.find(l => kk.endsWith(' ' + l.item) || l.item.endsWith(' ' + kk));
    if (!li) return false;
    used[li.item] = (used[li.item] || 0) + k.count;
    return used[li.item] <= li.c;
  }) && printedTotal >= Math.max(eyeTotal || 0, secondTotal || 0);
}
let countFrom = '';
if (eyeTotal !== null && secondTotal !== null) {
  facts.push({ fact: 'piece_count_seen', value: agree ? eyeTotal : eyeTotal + ' / ' + secondTotal, basis: agree ? 'observed' : 'conflicted' });
  if (!target) {
    if (printedTotal !== null && labelFits) { countFrom = 'label'; facts.push({ fact: 'piece_count_written', value: printedTotal, basis: 'written on the photo: ' + printedText + '; ' + eyeTotal + ' visible' }); }
    else if (!agree) critical.push({ what: 'piece_count', who: 'client', why: 'Two independent counts of the photo disagree (' + eyeTotal + ' and ' + secondTotal + ') and no number was given or written.' });
    else if (printedTotal !== null && printedTotal !== eyeTotal) critical.push({ what: 'piece_count', who: 'client', why: 'The label on the photo says ' + printedTotal + ' pieces (' + printedText + '), but ' + eyeTotal + ' are visible, and the label does not match the pieces seen.' });
    else if (cropped) critical.push({ what: 'piece_count', who: 'client', why: 'Part of the product may be outside the photo, so the number of pieces is not confirmed.' });
  } else {
    if (!stated) { countFrom = 'written'; facts.push({ fact: 'piece_count_written', value: writtenTotal, basis: 'written in ' + writtenTotalFrom }); }
    if (!agree || target !== eyeTotal) conflicts.push({ topic: 'piece_count', client_says: String(target) + (stated ? '' : ' (written in ' + writtenTotalFrom + ')'), evidence_shows: 'reader ' + eyeTotal + ', second count ' + secondTotal + (cropped ? ', photo may be cropped' : ''), severity: 'to_classify' });
  }
}
if (target && printedTotal !== null && printedTotal !== target)
  conflicts.push({ topic: 'piece_count', client_says: String(target), evidence_shows: 'printed on the photo: ' + printedText + ' (' + printedTotal + ' pieces)', severity: 'minor', resolution: 'client_wins', reason: 'A printed label is text, not the product; the client number is the inventory.' });

// Set membership: with no number, a piece nobody confirmed as part of the product is checked against what is written,
// then asked about. Counted companions (a stool or mirror counted with a bedroom set) and pieces a reader doubts both count.
const COMPANION = /\b(stool|bench|ottoman|pouf|footstool|mirror|vanity|side table|end table|coffee table|console|lamp|rug)(e?s)?\b/i;
const FURNITURE = /\b(stool|bench|ottoman|pouf|footstool|mirror|vanity|nightstand|night stand|bedside table|side table|end table|coffee table|console|sideboard|credenza|chair|armchair|table|cabinet|dresser|chest|sofa|bed|shelf|shelves|desk|wardrobe|bookcase)(e?s)?\b/gi;
const MEMBERSHIP = /(part of (the|a|this) (set|product|collection)|\bbelongs?\b|\bincluded\b|sold (together|with|separately|individually)|\bstaging\b|styling prop|may be part|might be part|could be part)/i;
const typeWords = [brief.product_type, brief.category].filter(Boolean).join(' ').toLowerCase();
const singleItemType = Boolean(brief.product_type) && !/(\bset\b|\bsuite\b|\bcollection\b|\bwith\b|\band\b|\bpieces?\b|\bpcs\b|\+|&|\d)/i.test(typeWords);
const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const writtenSays = w => {
  const e = esc(w);
  if (new RegExp('(without|excluding|except|not including|minus|\\bno)\\s+(the\\s+|a\\s+|an\\s+)?([a-z-]+\\s+){0,2}' + e).test(writtenAll)
    || new RegExp(e + '(e?s)?\\s+(is\\s+|are\\s+)?(not included|excluded|sold separately|not part)').test(writtenAll)) return 'out';
  if (writtenAll.indexOf(w) !== -1) return 'in';
  return '';
};
const counted = [], noted = [], resolved = [];
if (!target && eye) {
  if (eyeKinds.length > 1) for (const k of eyeKinds) { const m = k.kind.match(COMPANION); if (m && counted.indexOf(stemK(m[1])) === -1) counted.push(stemK(m[1])); }
  const kindsText = eyeKinds.map(k => k.kind).join(' | ');
  const notes = arr(second && second.unclear).concat(arr(eye.unknowns)).map(x => String(x)).filter(x => MEMBERSHIP.test(x) && !/cross|crossed|x mark|excluded|struck/i.test(x));
  for (const n of notes) for (const w of (n.replace(/table lamps?/gi, 'lamp').match(FURNITURE) || []).map(stemK))
    if (kindsText.indexOf(w) === -1 && counted.indexOf(w) === -1 && noted.indexOf(w) === -1) noted.push(w);
}
const writtenOut = [];
const ask = [];
for (const w of counted.concat(noted)) {
  const said = typeWords.indexOf(w) !== -1 ? 'in' : writtenSays(w);
  if (said === 'in') resolved.push({ piece: w, belongs: true, basis: 'written' });
  else if (said === 'out') { resolved.push({ piece: w, belongs: false, basis: 'written' }); writtenOut.push(w); }
  else if (noted.indexOf(w) !== -1 && singleItemType) resolved.push({ piece: w, belongs: false, basis: 'written product type names one item: ' + brief.product_type });
  else ask.push(w);
}
for (const r of resolved) facts.push({ fact: 'set_membership', value: r.piece + (r.belongs ? ' belongs to the product' : ' is not part of the product'), basis: r.basis });
if (ask.length) {
  const list = ask.join(', ');
  critical.push({ what: 'set_membership', who: 'client', why: 'No piece count was given, nothing written settles it, and it is not confirmed whether these belong to the product: ' + list + '.',
    question: 'Please confirm which pieces belong to the product. We were not sure about: ' + list + '.' });
}

// Colour: the photo decides colour; swatches and other colourways are options, kept apart from the photographed colour.
const swatches = arr(eye && eye.signs).filter(x => String(x.sign).toLowerCase() === 'swatch');
const swatchColours = arr(eye && eye.swatch_colours).map(x => String(x).slice(0, 60)).filter(Boolean);
if (swatches.length || swatchColours.length) conflicts.push({ topic: 'colour', client_says: brief.colour || 'not stated', evidence_shows: 'photo: ' + ((eye && eye.colour_observed) || 'not read') + '; swatch: ' + (swatches.map(x => x.meaning || x.text).join(', ') || 'see swatch colours') + (swatchColours.length ? '; swatch colours: ' + swatchColours.join(', ') : ''), severity: 'to_classify' });
if (brief.colour && eye && eye.colour_observed && eye.colour_observed.toLowerCase().indexOf(brief.colour.toLowerCase()) === -1)
  conflicts.push({ topic: 'colour', client_says: brief.colour, evidence_shows: eye.colour_observed, severity: 'minor', resolution: 'evidence_wins', reason: 'The photo decides colour.' });
for (const c of arr(eye && eye.conflicts)) conflicts.push({ topic: 'other', client_says: '', evidence_shows: String(c).slice(0, 200), severity: 'to_classify' });

// Inventory used: the client's numbers when given (supplied), else the agreed blind count (observed).
let inventory = brief.inventory.map(r => ({ ...r, basis: 'supplied' }));
if (!inventory.length && countFrom === 'label') inventory = labelItems.map(l => ({ item: l.item, count: l.c, basis: 'written on the photo' }));
else if (!inventory.length && countFrom === 'written') {
  const match = eyeTotal === writtenTotal ? eyeKinds.map(r => ({ item: r.kind, count: r.count })) : (secondTotal === writtenTotal ? arr(second && second.pieces).map(r => ({ item: String(r.kind || 'piece'), count: num(r.count) || 0 })) : []);
  inventory = match.length ? match.map(r => ({ ...r, basis: 'observed; total as written in ' + writtenTotalFrom })) : [{ item: 'piece', count: writtenTotal, basis: 'written in ' + writtenTotalFrom }];
}
else if (!inventory.length && agree && !cropped) inventory = eyeKinds.filter(r => writtenOut.indexOf(stemK((r.kind.match(COMPANION) || [r.kind, r.kind])[1])) === -1).map(r => ({ item: r.kind, count: r.count, basis: 'observed' }));
const exclusions = brief.exclusions.map(x => ({ item: x, basis: 'supplied' })).concat(eyeExcluded.map(x => ({ item: String(x), basis: 'observed (crossed out)' })), writtenOut.map(x => ({ item: x, basis: 'written' })));
for (const u of arr(eye && eye.unknowns)) unknowns.push({ what: String(u).slice(0, 200), basis: 'unknown' });
for (const hdn of hiddenSeen) unknowns.push({ what: 'hidden in the photo: ' + hdn, basis: 'unknown (covered by another piece or object; not confirmed)' });
if (!brief.dimensions) unknowns.push({ what: 'dimensions', basis: 'unknown' });
if (!brief.material) unknowns.push({ what: 'material composition', basis: 'unknown' });

const observation = {
  category_seen: eye ? eye.category || '' : '', colour_observed: eye ? eye.colour_observed || '' : '', swatch_colours: swatchColours, material_appearance: eye ? eye.material_appearance || '' : '',
  pieces_seen: eye ? arr(eye.pieces).slice(0, 60) : [], count_eye: eyeTotal, count_second: secondTotal, count_stated: stated || null, count_printed: printedTotal, cropped, crop_note: cropNote, hidden: hiddenSeen, readers_used: readersUsed,
  views_not_pieces: arr(eye && eye.views_not_pieces), signs: arr(eye && eye.signs), design_locks: arr(eye && eye.design_locks),
  sided_parts: arr(eye && eye.sided_parts), relations: arr(eye && eye.relations).map(x => (typeof x === 'string' ? x : JSON.stringify(x))).slice(0, 20), relations_second: arr(second && second.relations).map(x => String(x).slice(0, 200)).slice(0, 20), shown_with: arr(eye && eye.shown_with),
  unclear_second: arr(second && second.unclear).map(x => String(x).slice(0, 200)),
  written: { client: clientWords.slice(0, 2000), files: arr(s.written_files).map(f => f.name), files_not_read: unreadFiles, photo_text: photoWords.slice(0, 500), count_written: writtenTotal, count_from: countFrom || (stated ? 'client' : (agree ? 'readers' : '')) },
  room: room ? room : (s.room_key ? { unread: true } : null)
};
const QUESTIONS = {
  product_photo_unread: 'We could not find the product in the photo. Please send a clearer photo of the product.',
  piece_count: 'Please tell us how many pieces the product has, and which pieces belong to it.'
};
// A written file that could not be read may hold the answer: the owner checks it before the client is asked.
if (unreadFiles.length && critical.some(c => c.who !== 'owner')) {
  const first = critical.find(c => c.who !== 'owner');
  critical.push({ what: 'written_unread', who: 'owner', why: 'A written file about the product was sent but could not be read yet (' + unreadFiles.join(', ') + '; PDF, Excel and Word need an extract step). Check it before the client is asked: ' + (first.question || QUESTIONS[first.what] || first.why) });
}
// The owner is told first: while a reader is down, no question goes to the client.
const ownerCrit = critical.filter(c => c.who === 'owner');
const clientCrit = critical.filter(c => c.who !== 'owner');
const ordered = ownerCrit.concat(clientCrit);
const question = ownerCrit.length ? '' : (clientCrit.length ? (clientCrit[0].question || QUESTIONS[clientCrit[0].what] || 'Please check the product details.') : '');
const stampNow = new Date().toISOString();
// P1.8: the token counts of the readers of this round.
const sTc = { text_prices: s.text_prices, text_calls: s.text_calls, text_calls_new: s.text_calls_new };
if(!s.reader_recovery) textCall(sTc, 3, '03 Eye reads the product photo', 'gemini-3.8-flash', eyeMain);
if (eyeBack) textCall(sTc, 3, '03b Eye fallback (OpenAI)', 'gpt-6.1-sol', eyeBack);
if(!s.reader_recovery) textCall(sTc, 4, '05 Second count', 'claude-sonnet-5-5', out('05 Second count'));
if (roomMain) textCall(sTc, 6, '06 Room reader', 'gemini-3.8-flash', roomMain);
if (roomBack) textCall(sTc, 6, '06b Room fallback (OpenAI)', 'gpt-6.1-sol', roomBack);
return [{ json: {
  ...s, text_calls: sTc.text_calls || [], text_calls_new: sTc.text_calls_new || [], observation, inventory, exclusions, conflicts, unknowns, facts, critical: ordered,
  hold_for: ownerCrit.length ? 'owner' : (clientCrit.length ? 'client' : ''),
  client_question: question,
  trail: s.trail.concat([{ step: 5, name: 'Evidence', at: stampNow, note: 'reader ' + eyeTotal + (eyeBack ? ' (fallback gpt-6.1-sol)' : '') + ', second count ' + secondTotal + ', stated ' + (stated || 'none') + (printedTotal !== null ? ', printed ' + printedTotal : '') + '; ' + ownerCrit.length + ' owner holds, ' + clientCrit.length + ' client questions, ' + conflicts.length + ' conflicts' }])
} }];
