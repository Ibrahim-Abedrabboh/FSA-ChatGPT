// Fallback (16 Oct 2026): Gemini did not answer after its retries, so the same room photo goes to gpt-6.1-sol with the same prompt.
const it = $('Job accepted').first();
return [{ json: it.json, binary: it.binary }];