// Go 1 and go 2 · Forward result (decision address): tell the owner whether the waiting run received the answer. Code only.
const d = $('G1b Decision check').first().json;
const r = $input.first() ? $input.first().json : null;
const failed = !r || Boolean(r.error);
const NEXT = d.gate === 'go2'
  ? { approve: 'Go 2 was passed to the waiting run, which records the white master as approved by you. Scene images and the delivery package are not built yet.', repair: 'Go 2 was passed to the waiting run: one repair is made (one paid image call), reviewed, and you are asked again.', stop: 'Go 2 was passed to the waiting run, which stops. The white master is not approved.' }
  : { go: 'Go 1 is recorded. Stage 04 makes the white master next (one paid image call, only if an image model is approved and the Drive folder is set), then stage 05 reviews it and asks for your go 2.', change: 'The changed plan goes back through the plan check, then you are asked again.', stop: 'The run is stopped. No image was made.' };
return [{ json: failed
  ? { code: 502, reply: { forwarded: false, problem: 'The waiting run could not be reached. It may have timed out or already been answered.' } }
  : { code: 200, reply: { forwarded: true, id: d.id, gate: d.gate === 'go2' ? 'go 2' : 'go 1', decision: d.decision, at: d.at, next: NEXT[d.decision] || '' } } }];
