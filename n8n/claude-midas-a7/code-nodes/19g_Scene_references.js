// Stage 07 · Scene references: the images the scene call will send, in a fixed order, each with its checksum. Code only (16 Oct 2026).
// Empty room: no image is sent (the room is made from the plan text alone; the product is never in it).
// Placement: image 1 the vendor photo (the only authority for the product, as on every attempt), image 2 the owner-approved white
// master, image 3 the room, then (side views only) the supplied photo of that side, then the confirmed Midas pieces. The images are handed to stage 04's dispatch; this node pays nothing.
const arr = x => (Array.isArray(x) ? x : []);
const now = new Date().toISOString();
// Reached from the ticket (empty room: nothing to download) or from the photo check (placement).
const inp = $input.first() ? $input.first().json : {};
const st = JSON.parse(JSON.stringify(inp && inp.status === 'scene_preparing' && inp.scene && inp.scene.phase === 'room' ? inp : $('19c Prop verdict').first().json));
const sc = st.scene;
let settings = {};
try { settings = $('04 Settings').first().json || {}; } catch (e) { settings = {}; }
const cap = (Number(settings.max_inline_mb) || 14) * 1024 * 1024;
const notes = [];
function hold(why) {
  st.status = 'hold'; st.hold_for = 'owner'; st.hold_reason = why; st.client_question = ''; st.hold_step = 19;
  st.critical = arr(st.critical).concat([{ what: 'scenes', who: 'owner', why }]);
  st.next = 'Waiting for the owner: ' + why + ' No scene image was made or paid for in this step.';
}
const out = { json: null, binary: {} };
const refs = [];
if (sc.phase === 'place') {
  const vendor = arr(st.references).find(r => r.key === st.product_key && r.sha256);
  let master = null, room = null, photos = [];
  try { master = $('19d2 Master check').first().json.master; } catch (e) { master = null; }
  try { room = $('19e2 Room check').first().json.room; } catch (e) { room = null; }
  try { photos = $('19f2 Photo check').first().json.photos || []; } catch (e) { photos = []; }
  if (!vendor) hold('The vendor photo of this run is missing or has no checksum, so the scene is not made.');
  else if (!master || !master.ok) hold('The approved white master cannot be used: ' + ((master && master.why) || 'it was not checked') + '. The scene is not made.');
  else if (!room || !room.ok) hold('The room for scene ' + sc.output_id + ' cannot be used: ' + ((room && room.why) || 'it was not checked') + '. The scene is not made.');
  else {
    refs.push({ role: 'vendor photo', key: vendor.key, name: vendor.name, mime: vendor.mime, bytes: vendor.bytes, sha256: vendor.sha256 });
    refs.push({ role: 'approved white master', key: 'scene_master', name: (st.approved.candidate && st.approved.candidate.file_name) || 'white master', mime: master.mime, bytes: master.bytes, sha256: master.sha256 });
    refs.push({ role: 'room', key: room.key, name: room.name, mime: room.mime, bytes: room.bytes, sha256: room.sha256 });
    // A Left side or Right side view (owner, 16 Oct 2026, decision 27) carries the supplied photo that shows that side, from intake.
    if (sc.side && sc.side.photo) {
      const sp = arr(st.references).find(r => r.key === sc.side.photo.key && r.sha256 === sc.side.photo.sha256 && r.image);
      if (sp) refs.push({ role: 'side photo', side: sc.side.side, key: sp.key, name: sp.name, mime: sp.mime, bytes: sp.bytes, sha256: sp.sha256 });
      else hold('Scene ' + sc.output_id + ' is a ' + sc.side.camera + ' view, but the supplied photo of that side (' + sc.side.photo.name + ') is not available with the checksum recorded at go 1, so the view is not made.');
    }
    out.binary.scene_master = $('19d Download master').first().binary.data;
    if (room.key === 'scene_room') out.binary.scene_room = $('19e Download room').first().binary.data;
    const listed = $('19f0 Photo list').all().map(i => i.json);
    const got = listed.length === 1 && listed[0].none ? [] : $('19f Prop photos').all();
    const kept = [];
    for (const p of arr(sc.props)) {
      const j = listed.findIndex(x => x.sku === p.sku);
      const ph = photos.find(x => x.sku === p.sku);
      if (j === -1 || !ph || !ph.ok || !got[j] || !got[j].binary || !got[j].binary.data) { sc.props_left_out = arr(sc.props_left_out).concat([{ sku: p.sku, why: ((ph && ph.why) || 'its catalogue photo was not downloaded') + '; the spot stays empty' }]); continue; }
      const key = 'scene_prop_' + kept.length;
      out.binary[key] = got[j].binary.data;
      refs.push({ role: 'Midas piece', sku: p.sku, key, name: p.name + ' (SKU ' + p.sku + ')', mime: ph.mime, bytes: ph.bytes, sha256: ph.sha256 });
      kept.push(p);
    }
    sc.props = kept;
    // A view made from the approved base view (16 Oct 2026): that image already shows the base view's Midas pieces. If one of them
    // is no longer confirmed (live stock or catalogue photo), the view would still show it, so it is held, not made.
    if (sc.room && sc.room.content === 'approved view') {
      const lost = arr(sc.base_props).filter(sku => !kept.some(p => String(p.sku) === String(sku)));
      if (lost.length) hold('Scene ' + sc.output_id + ' is made from the approved ' + (sc.room.from_kind || 'base') + ' view, which shows Midas piece(s) ' + lost.join(', ') + '; ' + (lost.length === 1 ? 'it is' : 'they are') + ' no longer confirmed (' + arr(sc.props_left_out).filter(x => lost.indexOf(String(x.sku)) !== -1).map(x => x.why).join('; ') + '). The view would still show ' + (lost.length === 1 ? 'it' : 'them') + ', so it is not made.');
    }
    // One request carries every image inline. If the images are too large together, the master goes first (image 1 still decides
    // the product); if they are still too large, the scene holds. Resizing references is not built.
    let total = refs.reduce((t, r) => t + (Number(r.bytes) || 0), 0);
    if (total > cap) {
      const m = refs.findIndex(r => r.key === 'scene_master');
      total -= Number(refs[m].bytes) || 0;
      refs.splice(m, 1); delete out.binary.scene_master;
      notes.push('The images were above the ' + (cap / 1048576) + ' MB request size, so the approved white master is not sent; the vendor photo still decides the product.');
    }
    if (st.status !== 'hold' && total > cap) hold('The vendor photo, the room and the Midas photos together are ' + (total / 1048576).toFixed(1) + ' MB, above the ' + (cap / 1048576) + ' MB set for one request. Resizing is not built, so the scene is not made.');
  }
}
if (st.status !== 'hold') {
  refs.forEach((r, i) => { r.n = i + 1; });
  sc.refs = refs;
  sc.ref_notes = notes;
  st.status = 'scene_due'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.next = 'Scene ' + sc.output_id + ': the ' + (sc.phase === 'room' ? 'empty room is' : 'placement (' + refs.length + ' images, ' + sc.props.length + ' Midas piece(s)) is') + ' ready for stage 04\'s dispatch: one paid image call within the job budget.';
}
st.scenes.current = sc;
st.stage = '07 Scenes';
st.vault_only = ['scene_ticket', 'hold', 'status'];
st.trail = arr(st.trail).concat([{ step: 19, name: 'Scene references', at: now, note: st.status === 'scene_due' ? sc.output_id + ' · ' + sc.phase + ' · ' + refs.length + ' image(s)' : 'held' }]);
out.json = st;
if (!Object.keys(out.binary).length || st.status === 'hold') delete out.binary;
return [out];
