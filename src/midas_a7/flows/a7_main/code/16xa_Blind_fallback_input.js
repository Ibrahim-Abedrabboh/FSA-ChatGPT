// Fallback (16 Oct 2026): Gemini's blind count did not answer after its retries, so the same candidate goes to gpt-6.1-sol with the same prompt.
const it = $('16a Review ticket').first();
return [{ json: it.json, binary: it.binary }];