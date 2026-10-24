// Reader test 4 · Budget check before each photo (owner, 16 Oct 2026, 21:28: cap USD 1; stop the run if the cap would be exceeded).
// Spent so far = the provider token counts of the calls already made x the price (USD 2 input / 10 output per million, gpt-6.1-sol,
// read 16 Oct 2026). A call with no token counts is counted at the worst case. The next call is allowed only if spent + the worst case
// of one more photo (2 tries, each up to 6000 input and 6000 output tokens) stays within the cap.
const CAP = 1.0, PRICE = { input: 2, output: 10 };
const WORST_TRY = (6000 * PRICE.input + 6000 * PRICE.output) / 1e6, WORST_PHOTO = 2 * WORST_TRY;
function usageOf(o) {
  const u = o && (o.usage || (o.response && o.response.usage));
  if (!u) return null;
  const n = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
  if (u.input_tokens !== undefined || u.output_tokens !== undefined) return { input: n(u.input_tokens), output: n(u.output_tokens) };
  if (u.prompt_tokens !== undefined) return { input: n(u.prompt_tokens), output: n(u.completion_tokens) };
  return null;
}
const done = $runIndex; // photos already sent (this node runs once per photo)
let spent = 0, unknown = 0;
for (let r = 0; r < done; r++) {
  let items = [];
  try { items = $('OpenAI photo reader').all(0, r); } catch (e) { items = []; }
  for (const it of items) {
    const u = usageOf(it.json);
    if (u) spent += (u.input * PRICE.input + u.output * PRICE.output) / 1e6; else { spent += WORST_PHOTO; unknown++; }
  }
}
const ok = spent + WORST_PHOTO <= CAP;
const budget = { cap_usd: CAP, spent_usd: Number(spent.toFixed(4)), worst_next_usd: Number(WORST_PHOTO.toFixed(4)), photos_done: done, calls_counted_at_worst: unknown, ok };
return $input.all().map(i => ({ json: Object.assign({}, i.json, { budget }), binary: i.binary }));
