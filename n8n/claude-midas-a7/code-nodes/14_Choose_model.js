// Step 14 · Choose the image model from the registry, check what it can do, check storage is set, and reserve a cost. Code only (15 Oct 2026).
// A model is used only when its registry row says "approved". The request address is fixed in the request node, never read from the table.
const S = $('13 Compile').first().json;
const s04 = JSON.parse(JSON.stringify(S.s04));
const set = s04.settings || {};
const rows = $input.all().map(i => i.json).filter(r => r && r.model_id);
function stop(why) { s04.go = false; s04.outcome = 'hold'; if (!s04.hold_step) s04.hold_step = 14; s04.critical.push({ what: 'stage04', who: 'owner', why }); }
if (s04.outcome === 'hold') return [{ json: { s04 } }];
const o = s04.dispatch;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
if ($input.all().some(i => i.json && i.json.error)) stop('The model registry table could not be read, so no model can be chosen. Nothing was sent or paid.');
if (!String(set.drive_root_folder_id || '').trim()) stop('No Google Drive folder is set for images (04 Settings, drive_root_folder_id). Nothing was sent or paid.');
const list = rows.map(r => r.model_id + ' (' + (r.status || 'no status') + ')').join(', ') || 'no rows';
let m = null;
if (set.image_model_policy !== 'approved_only') stop('Unknown model policy "' + set.image_model_policy + '" in 04 Settings; only approved_only is supported. Nothing was sent or paid.');
else {
  const approved = rows.filter(r => String(r.status || '').toLowerCase() === 'approved').sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));
  if (!approved.length) stop('No image model is approved yet. The model registry has: ' + list + '. Mark one row approved after the model test. Nothing was sent or paid.');
  else m = approved[0];
}
const num = k => Number(m && m[k]) || 0;
if (m) {
  const ratios = String(m.ratios || '').split('|').map(x => x.trim()).filter(Boolean);
  const sizes = String(m.sizes || '').split('|').map(x => x.trim().toUpperCase()).filter(Boolean);
  const maxRefs = num('max_refs');
  if (!/^[a-z0-9][a-z0-9.\-]*$/.test(String(m.model_id))) stop('The registry model id "' + String(m.model_id).slice(0, 60) + '" is not a plain model id.');
  if (String(m.endpoint || '') !== ENDPOINT) stop('The registry row for ' + m.model_id + ' names another address (' + String(m.endpoint || 'none').slice(0, 80) + '). Only ' + ENDPOINT + ' is built.');
  if (!ratios.length || !sizes.length || !maxRefs) stop('The registry row for ' + m.model_id + ' does not list its frame ratios, sizes and reference limit. Fill them in before it is used.');
  else {
    if (ratios.indexOf(o.ratio) === -1) stop(m.model_id + ' does not list the frame ' + o.ratio + ' (it lists ' + ratios.join(', ') + '). The frame is not changed without the owner.');
    if (sizes.indexOf(o.size) === -1) stop(m.model_id + ' does not list the size ' + o.size + ' (it lists ' + sizes.join(', ') + ').');
    if (o.references.length > maxRefs) stop(o.references.length + ' reference photos are more than the ' + maxRefs + ' that ' + m.model_id + ' accepts.');
  }
  if (!(num('input_usd_per_m') > 0 && num('text_out_usd_per_m') > 0 && num('image_out_usd_per_m') > 0 && num('input_image_tokens') > 0 && num('image_tokens_' + String(o.size).toLowerCase()) > 0 && m.price_date))
    stop('The registry row for ' + m.model_id + ' has no complete, dated price for ' + o.size + ', so no cost can be reserved.');
}
if (s04.outcome !== 'hold') {
  const pin = num('input_usd_per_m'), pt = num('text_out_usd_per_m'), pimg = num('image_out_usd_per_m');
  const inTok = Math.ceil(o.prompt.length / 4) + o.references.length * num('input_image_tokens');
  const imgTok = num('image_tokens_' + String(o.size).toLowerCase());
  const thoughtTok = 2000;
  s04.model = { model_id: m.model_id, label: m.label || '', registry_status: m.status, price_date: m.price_date, prices_usd_per_m: { input: pin, text_out: pt, image_out: pimg }, image_tokens: imgTok, input_image_tokens: num('input_image_tokens') };
  s04.reserve_usd = Number(((inTok * pin + imgTok * pimg + thoughtTok * pt) / 1e6).toFixed(4));
  s04.reserve_basis = 'estimate: about ' + inTok + ' input tokens, ' + imgTok + ' image tokens and a ' + thoughtTok + '-token thinking margin, at registry prices dated ' + m.price_date;
  s04.go = true;
}
return [{ json: { s04 } }];
