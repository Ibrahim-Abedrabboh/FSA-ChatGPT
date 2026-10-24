// Reader test 4 · Stopped before the cap (owner, 16 Oct 2026, 21:28). No more calls are made; the photos already read are scored.
const b = $input.first().json.budget || {};
return [{ json: { stopped_at_cap: true, completed: b.photos_done || 0, budget: b } }];
