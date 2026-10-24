// Stage 07 · Scene files ticket (step 20). Code only (16 Oct 2026).
// Runs right after the owner's go 2 "approve" on a scene (status scene_approved), before the next scene starts.
// Owner rule (16 Oct 2026, 03:25): keep the 2048-class master; make jpg and webp at the image's own shape with the short side at
// 1125 px; never stretch, crop, pad or upscale; a master smaller than that is held for the owner. The manifest lists the Midas
// pieces in the scene with their pages. A scene file is a "Generated image"; the approval is the owner's go 2, nothing else.
const st = JSON.parse(JSON.stringify($('V1 Vault events').first().json));
delete st.events; delete st.row;
const arr = x => (Array.isArray(x) ? x : []);
const clean = (v, n) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n || 300));
const now = new Date().toISOString();
let set = {};
try { set = ($('04 Settings').first().json || {}).scene_delivery || {}; } catch (e) { set = {}; }
const cfg = { short_side_px: Number(set.short_side_px) || 1125, formats: ['jpg', 'webp'], jpg_quality: Number(set.jpg_quality) || 92, shape_tolerance_pct: Number(set.shape_tolerance_pct) || 2 };
const problems = [];
const sc = st.scenes && typeof st.scenes === 'object' ? st.scenes : {};
const done = sc.done || {};
const id = st.go2 && st.go2.kind === 'scene' ? clean(st.go2.output_id, 80) : '';
const d = id ? done[id] : null;
const last = st.go2_last || {};
if (st.status !== 'scene_approved') problems.push('the run is not in the state "scene approved"');
if (!id || !d) problems.push('the approved scene is not recorded on this run');
else if (d.by !== 'owner' || ['approve', 'approve_unreviewed'].indexOf(last.decision) === -1 || last.by !== 'owner') problems.push('the owner\'s go 2 approval of scene ' + id + ' is not recorded');
const cand = d && d.candidate ? d.candidate : null;
if (d && (!cand || !cand.drive_file_id || !/^[0-9a-f]{64}$/.test(String(cand.sha256 || '')))) problems.push('the approved scene ' + id + ' has no Drive file or no checksum');
if (d && d.files) problems.push('the delivery files of scene ' + id + ' were already made; they are not made twice');
if (!st.contract_stamp) problems.push('the run has no locked contract');
// Packaging must not carry an approval onto changed bytes or a changed contract.
if (d && (!d.release || d.release.candidate_sha256 !== (cand && cand.sha256) || d.release.output_id !== id || d.release.contract_stamp !== st.contract_stamp || d.release.run_id !== st.run_id)) problems.push('the approval release record is missing or belongs to different bytes, output, run or contract; obtain a fresh owner approval');
// The shape that was planned (01 Intent & scope → 11a → the checked plan). The files follow the image itself; this is for the note only.
const shot = arr(st.shots).find(x => x && x.output_id === id) || {};
const m = String(shot.frame || '').match(/(\d+)\s*:\s*(\d+)/);
const planned = m ? { shape: m[1] + ':' + m[2], w: Number(m[1]), h: Number(m[2]) } : { shape: 'not recorded', w: 0, h: 0 };
const out = id ? arr(st.outputs).find(o => o && o.id === id) || {} : {};
const sku = clean(st.brief && st.brief.sku, 60);
const base = (sku || clean(st.client_run_id, 60) || 'midas').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'midas';
// Midas pieces as checked live at scene time (19b-19c) and kept in the owner's approval record (G2). Pieces left out are listed too.
const pieces = d ? arr(d.props).map(p => ({ sku: clean(p.sku, 40), name: clean(p.name, 120), page: clean(p.page, 300),
  stock: p.live ? { reading: clean(String(p.live.stock || '').replace('_', ' '), 40) || 'not recorded', read_at: clean(p.live.read_at, 40), size_on_page: clean(p.live.size_on_page, 160) || 'not confirmed' } : { reading: 'not recorded', read_at: '', size_on_page: 'not confirmed' } })) : [];
const left_out = d ? arr(d.props_left_out).map(p => ({ sku: clean(p.sku, 40), why: clean(p.why, 300) })) : [];
const sf = {
  ok: problems.length === 0, problem: problems.length ? 'The scene files were not made: ' + problems.join('; ') + '.' : '',
  cfg, at: now, output_id: id, kind: clean(out.kind || (d && d.kind) || '', 40), base, planned,
  master: cand ? { drive_file_id: cand.drive_file_id, folder_id: cand.folder_id || '', link: cand.link || '', sha256: cand.sha256, px: cand.px || '', bytes: cand.bytes || 0, file_name: cand.file_name || '' } : null,
  approval: d ? { by: 'owner', at: d.at, attempt: d.attempt, note: clean(d.note, 300), review_result: d.review_result || 'unknown', without_review: d.without_review === true, release: d.release || null, approval_kind: d.approval_kind || 'approved by the owner', shown_as: d.shown_as || (d.without_review === true ? 'Approved by the studio · not reviewed' : 'Approved'), client_shown_as: d.client_shown_as || (d.without_review === true ? 'Approved by the studio' : 'Approved') } : null,
  midas_pieces: pieces, midas_pieces_left_out: left_out
};
return [{ json: { st, sf } }];
