// The request cannot start: say why in client-safe words. Nothing was read or paid for.
const s = $input.first().json;
return [{ json: { ...s, status: 'refused', stage: '01 Intake & observe', reply: { ok: false, status: 'not_started', job_id: s.client_run_id || '', problems: s.problems, not_applied: s.not_applied } } }];
