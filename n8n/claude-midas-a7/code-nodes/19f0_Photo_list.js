// Stage 07 · One item per confirmed Midas piece whose catalogue photo is downloaded next (16 Oct 2026). Code only.
const st = $('19c Prop verdict').first().json;
const props = (st.scene && Array.isArray(st.scene.props) ? st.scene.props : []);
if (!props.length) return [{ json: { none: true, scene: st.scene ? st.scene.output_id : '' } }];
return props.map((p, i) => ({ json: { none: false, i, sku: p.sku, photo_url: p.photo_url, scene: st.scene.output_id } }));
