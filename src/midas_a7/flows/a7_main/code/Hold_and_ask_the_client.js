// Hold: stop before any money is spent. Nothing is invented. Used by stages 01, 02 and 03 (15 Oct 2026: stage 03 added).
// A missing fact goes to the client as one question. A reader that did not answer goes to the owner; the client is not asked anything.
const s = $input.first().json;
const crit = s.critical || [];
const c = crit.find(x => x.who === 'owner') || crit[0] || { what: 'unknown', why: 'A required fact is missing.' };
const forOwner = c.who === 'owner';
const v = (s.brief && s.brief.version) || 1;
return [{ json: { ...s, status: 'hold', hold_for: forOwner ? 'owner' : 'client', stage: s.plan_stage ? '03 Retrieve & style' : (s.contract ? '02 Compile scope' : '01 Intake & observe'), hold_reason: c.why,
  client_question: forOwner ? '' : (s.client_question || ''),
  next: forOwner
    ? (s.plan_stage ? 'Waiting for the owner: the plan could not be checked or still fails its check, and nothing goes forward unchecked. The client was not asked anything. No paid image was made.' : 'Waiting for the owner: run the job again when the reader answers. The client was not asked anything. No paid image was made.')
    : 'Waiting for the client answer. The answer becomes brief version ' + v + ' + 1 and the job restarts at step 1. No paid image was made.' } }];
