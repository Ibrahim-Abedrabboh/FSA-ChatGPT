// Go 1 and go 2 · Forward result (decision address): tell the owner whether the waiting run received the answer. Code only.
const d = $('G1b Decision check').first().json;
const r = $input.first() ? $input.first().json : null;
const failed = !r || Boolean(r.error);
const NEXT = d.gate === 'go2'
  ? { approve: 'Go 2 was passed to the waiting run, which records your approval of this image. For the white master, the delivery package (1125 x 1125 jpg and webp) is made next, then the scene images, each with its own review and go 2. For a scene, its delivery files are made, then the next scene starts, if any is left.',
      approve_unreviewed: 'Go 2 was passed to the waiting run, which records this image as approved by owner without an automated review. It is never shown as a passed review. The next step follows as for an approval.',
      review_again: 'Go 2 was passed to the waiting run: the review and the blind count run once more on the stored image (no image call), and you are asked again.',
      repair: 'Go 2 was passed to the waiting run: one repair is made (one paid image call), reviewed, and you are asked again.', stop: 'Go 2 was passed to the waiting run, which stops. This image is not approved.' }
  : { go: 'Go 1 is recorded. Stage 04 makes the white master next (one paid image call, only if an image model is approved and the Drive folder is set), then stage 05 reviews it and asks for your go 2.', change: 'The changed plan goes back through the plan check, then you are asked again.', stop: 'The run is stopped. No image was made.' };
return [{ json: failed
  ? { code: 502, reply: { forwarded: false, problem: 'The waiting run could not be reached. It may have timed out or already been answered.' } }
  : { code: 200, reply: { forwarded: true, id: d.id, gate: d.gate === 'go2' ? 'go 2' : 'go 1', decision: d.decision, at: d.at, next: NEXT[d.decision] || '' } } }];
