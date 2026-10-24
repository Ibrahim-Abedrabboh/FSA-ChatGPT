// Step 8 · Brain modes: what is locked and what may change, per output. Code only.
const s = $input.first().json;
const o = s.observation;
const identity = ['product identity as in the vendor photo (vendor photo is image 1 on every attempt)', 'piece count and pieces as in the inventory', 'shape, pattern, colour and left/right handedness as photographed']
  .concat(o.design_locks.map(String)).concat(o.sided_parts.map(x => 'sided part: ' + x));
const excluded = s.exclusions.map(x => 'must not appear: ' + x.item);
const roomLocks = o.room && !o.room.unread ? ['room architecture stays: walls, floor, windows, doors, built-ins', 'camera height and angle stay as in the room photo'] : [];
const FIDELITY = { white: 1, hero: 1, detail: 1 };
const outputs = s.brief.outputs.map(out => {
  const fidelity = Boolean(FIDELITY[out.kind]);
  const locks = identity.concat(excluded);
  const free = [];
  if (out.kind === 'white') { locks.push('pure white background, neutral studio light, no props, no person'); }
  else {
    if (roomLocks.length && out.kind !== 'detail') locks.push(...roomLocks);
    else free.push('setting', 'camera position within the camera view');
    // 16 Oct 2026 (owner decisions 22-24 and 27; prompt check P3): the camera view and the light preset of each image are fixed before
    // planning; only Midas pieces confirmed in stock are added, nothing generic; people only when the brief asks, at most one adult.
    if (out.camera && !(roomLocks.length && out.kind !== 'detail')) locks.push('camera view: ' + out.camera);
    if (out.light) locks.push('light preset: ' + (out.light_label || out.light) + ' (fixed for this image)');
    free.push('the light within the fixed preset', 'supporting pieces: only Midas pieces with a SKU, a catalogue photo and live stock; nothing else is added');
    locks.push(s.brief.preferences && s.brief.preferences.people === 'one' ? 'at most one natural adult, beside or behind the product, never in front of it or covering any piece' : 'no people');
    if (out.from) locks.push('made from the approved image of ' + out.from + ': its room, pieces and arrangement stay');
  }
  if (out.kind === 'variation') free.splice(0, free.length, 'only the axis the client changed');
  return { ...out, mode: out.kind === 'white' ? 'fidelity_locked' : (roomLocks.length ? 'room_locked' : (fidelity ? 'fidelity_locked' : 'creative_room')), locks, free, checks: s.profile.checks };
});
const now = new Date().toISOString();
const ticket = {
  client: { product_type: s.brief.product_type, category: s.brief.category, colour: s.brief.colour, material: s.brief.material, inventory: s.brief.inventory, exclusions: s.brief.exclusions, instructions: s.brief.instructions, description: s.brief.product_notes || '' },
  written: { files: (s.written_files || []).map(f => ({ name: f.name, text: String(f.text || '').slice(0, 3000) })), files_not_read: (o.written && o.written.files_not_read) || [], photo_text: (o.written && o.written.photo_text) || '' },
  photo_read: { category: o.category_seen, colour: o.colour_observed, swatch_colours: o.swatch_colours || [], count_reader: o.count_eye, count_second: o.count_second, count_printed: o.count_printed, cropped: o.cropped, signs: o.signs, views_not_pieces: o.views_not_pieces },
  conflicts: s.conflicts, unknowns: s.unknowns
};
return [{ json: { ...s, outputs, conflict_ticket: JSON.stringify(ticket), has_open_conflicts: s.conflicts.some(c => c.severity === 'to_classify') || Boolean(s.brief.instructions),
  trail: s.trail.concat([{ step: 8, name: 'Locks', at: now, note: outputs.length + ' outputs with locks' }]) } }];
