// Stage 07 · One item per Midas piece to check on its live product page (16 Oct 2026). Code only.
const st = $input.first().json;
return (st.scene && Array.isArray(st.scene.props) ? st.scene.props : []).map((p, i) => ({ json: { i, sku: p.sku, url: p.url, scene: st.scene.output_id } }));
