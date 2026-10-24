// New case as one vertical timeline: the order of the phases and which one is open. No DOM here (start.js draws it),
// so the rules can be tested on their own. One phase is open at a time; Next checks the open phase, marks it done and opens
// the next phase that applies; Change reopens a done phase. A phase that does not apply (for example "The edit" when the
// work is not an edit) is skipped and keeps no done mark.
(root => {
  function create(phases, { applies = () => true } = {}) {
    const done = new Set();
    let open = phases[0]?.key || '';
    const visible = () => phases.filter(phase => applies(phase.key));
    const index = key => visible().findIndex(phase => phase.key === key);
    const phase = key => phases.find(item => item.key === key) || null;
    // The phase after (or before) the open one, among those that apply now.
    const neighbour = step => { const list = visible(), at = index(open); return list[at + step]?.key || ''; };
    function state(key) {
      if (!applies(key)) return 'skipped';
      return key === open ? 'open' : done.has(key) ? 'done' : 'todo';
    }
    // Next: every earlier phase that applies must still pass its check (an earlier answer may have changed since it was
    // marked done); the first that fails opens instead, so the owner sees what to fix.
    function next(check = () => true) {
      const list = visible(), at = index(open);
      for (const item of list.slice(0, at + 1)) {
        if (!check(item.key)) { done.delete(item.key); open = item.key; return { moved: false, open, failed: item.key }; }
        done.add(item.key);
      }
      const following = list[at + 1]?.key;
      if (!following) return { moved: false, open, failed: '' };
      open = following;
      return { moved: true, open, failed: '' };
    }
    function back() { const previous = neighbour(-1); if (previous) open = previous; return open; }
    function reopen(key) { if (phase(key) && applies(key)) open = key; return open; }
    // A phase reached without going through the ones before it (for example a saved version opened from Saved work).
    function jumpTo(key, { markBefore = true } = {}) {
      if (!phase(key) || !applies(key)) return open;
      if (markBefore) for (const item of visible()) { if (item.key === key) break; done.add(item.key); }
      open = key; return open;
    }
    function reset(key) { done.delete(key); }
    const number = key => index(key) + 1;
    return { phases, visible, state, next, back, reopen, jumpTo, reset, number, get open() { return open; }, isLast: key => { const list = visible(); return list[list.length - 1]?.key === key; }, following: () => neighbour(1), previous: () => neighbour(-1) };
  }
  root.CaseTimeline = { create };
})(typeof window !== 'undefined' ? window : globalThis);
