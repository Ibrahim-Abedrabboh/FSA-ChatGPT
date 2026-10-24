"""Turn a frozen n8n workflow export (n8n/baseline/<id>.json) into a committed flow package.

    python tools/n8n_to_flow.py            # regenerate every flow listed in FLOWS

Each package gets __init__.py (FLOW: nodes and connections as Python data) and code/<node>.js
(each Code node's JavaScript, byte for byte). Sticky notes are dropped. Data-table schemas and the
reference seeds are copied to src/midas_a7/data/. Run it again only when a baseline changes.

PATCHES lists the only deliberate changes to the frozen JavaScript, each with its reason. Every patch must
match exactly once, and each patched file's checksum is recorded in the manifest next to the original's.
NODE_PATCHES and SETTINGS_PATCHES do the same for node parameters and flow settings; both are listed in the manifest.
"""

from __future__ import annotations

import copy
import hashlib
import json
import pprint
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "n8n" / "baseline"
FLOWS_DIR = ROOT / "src" / "midas_a7" / "flows"
DATA_DIR = ROOT / "src" / "midas_a7" / "data"

FLOWS = {
    "a7_main": "1cgZc9rmBOrPdKIe",
    "owner_bridge": "Mo9c5GmTcx0K79F7",
    "owner_read": "G4cLxmwbkCxmCbQF",
    "owner_analysis": "AOTL7OVYtXLLs1L1",
    "analysis_only": "AMdtt1fFwHln4DB8",
    "model_tests": "jYkKQ2NOreSG0t97",
    "catalogue_refresh": "mGgKxO0638I77meF",
}

# (package, code file, old text, new text, reason)
PATCHES = [
    ("owner_bridge", "Safe_approval_context.js",
     """function drive(v){
 if(typeof v!=='string')return null;
 const match=v.match(/^https:\\/\\/drive\\.google\\.com\\/file\\/d\\/([A-Za-z0-9_-]+)\\/view(?:\\?usp=(?:drivesdk|sharing|drive_link))?$/);
 return match?'https://drive.google.com/file/d/'+match[1]+'/view':null;
}""",
     """function drive(v){
 if(typeof v!=='string')return null;
 // Google Drive dropped (owner, 20 Oct 2026): the A7 service keeps the files; links are /files/<id>/view?sig=<hmac>.
 const match=v.match(/^(https:\\/\\/[A-Za-z0-9.-]+(?::\\d+)?)\\/files\\/([A-Za-z0-9_-]{10,200})\\/view\\?sig=([a-f0-9]{64})$/);
 return match?match[1]+'/files/'+match[2]+'/view?sig='+match[3]:null;
}""",
     "Google Drive dropped: candidate links point at the service's signed file links"),
    ("a7_main", "11b_Stylist_check.js",
     """st.critic_needed = st.plan_readable !== false && pending.length > 0;
st.trail = st.trail.concat([{ step: 11, name: 'Stylist check', at: now, note: 'round ' + st.plan_round + ': ' + pending.length + ' shots to check; code fixes ' + st.shots.reduce((t, x) => t + (x.code_fixes || []).length, 0) + '; findings ' + st.shots.reduce((t, x) => t + (x.code_findings || []).length, 0) }]);""",
     """// Owner, 20 Oct 2026 (speed change 3): a white master's plan is the studio's fixed plan (WHITE above; 13 Compile uses its own
// WHITE_PLAN), so the paid plan critic adds nothing when every shot left to check is a white master and code found nothing to fix.
// Such a shot passes here; 12 shows its plan check as "fixed by the studio".
const codeMadeOnly = st.plan_readable !== false && pending.length > 0 && pending.every(x => x.kind === 'white' && !(x.code_findings || []).length);
if (codeMadeOnly) for (const x of pending) x.plan_ok = true;
st.critic_needed = st.plan_readable !== false && pending.length > 0 && !codeMadeOnly;
st.trail = st.trail.concat([{ step: 11, name: 'Stylist check', at: now, note: 'round ' + st.plan_round + ': ' + pending.length + ' shots to check; code fixes ' + st.shots.reduce((t, x) => t + (x.code_fixes || []).length, 0) + '; findings ' + st.shots.reduce((t, x) => t + (x.code_findings || []).length, 0) + (codeMadeOnly ? '; plan critic not called: white master only, plan written by code' : '') }]);""",
     "Speed change 3: no paid plan critic when only code-made white-master plans are left to check"),
    # White master on demand (owner, 20 Oct 2026; WP3 stage A). Every change is conditional on brief.white_master 'not_asked' or the
    # flag scope.whiteMaster false, so a job that makes the white master (the default; run 1591) runs exactly as before.
    ("a7_main", "01_Intent_scope.js",
     """for (const o of outcomes) {
  if (o === 'white_bk') add('white_master', 'white', o);
  if (o === 'lifestyle') {
    add('white_master', 'white', o);
""",
     """// White catalogue image on demand (owner, 20 Oct 2026; WP3 stage A): scope.whiteMaster false leaves it out of a job whose outcomes
// do not need it. White BK and Website always make it. When the field is absent, as in every request before this change, it is made.
const whiteOff = scope.whiteMaster === false || /^(no|off|false)$/i.test(text(scope.whiteMaster));
const whiteNeeded = !whiteOff || outcomes.some(k => k === 'white_bk' || k === 'website');
if (whiteOff && whiteNeeded) notApplied.push('White catalogue image left out: not applied, because White BK or Website needs it, so it is made.');
for (const o of outcomes) {
  if (o === 'white_bk') add('white_master', 'white', o);
  if (o === 'lifestyle') {
    if (whiteNeeded) add('white_master', 'white', o);
""",
     "White master on demand: 01 adds the white master only when asked (default) or when White BK or Website needs it"),
    ("a7_main", "01_Intent_scope.js",
     """  if (o === 'new_composition') { add('white_master', 'white', o); add('composition_1', 'composition', o); }""",
     """  if (o === 'new_composition') { if (whiteNeeded) add('white_master', 'white', o); add('composition_1', 'composition', o); }""",
     "White master on demand: a composition follows the same flag"),
    ("a7_main", "01_Intent_scope.js",
     """  if (o === 'create_with_item') { add('white_master', 'white', o); add('scene_1', 'scene', o); }""",
     """  if (o === 'create_with_item') { if (whiteNeeded) add('white_master', 'white', o); add('scene_1', 'scene', o); }""",
     "White master on demand: a scene with this item follows the same flag"),
    ("a7_main", "01_Intent_scope.js",
     """const stamp = new Date().toISOString();
const draftId=""",
     """// A job that makes no white catalogue image says so once, for the steps after go 1 (12, 13, 15q, 19a, 19d2, 19g, G1). Never on an edit.
if (whiteOff && !whiteNeeded && !editBase && jobType !== 'edit' && outputs.length && !outputs.some(o => o.kind === 'white')) brief.white_master = 'not_asked';
const stamp = new Date().toISOString();
const draftId=""",
     "White master on demand: the brief records white_master 'not_asked' only for a job that makes none"),
    ("a7_main", "12_Who_leads_the_scene.js",
     """const eb = s.brief && s.brief.edit && s.brief.edit.base && !wb ? s.brief.edit : null;""",
     """const eb = s.brief && s.brief.edit && s.brief.edit.base && !wb ? s.brief.edit : null;
const nw = Boolean(s.brief && s.brief.white_master === 'not_asked'); // no white catalogue image (owner unticked it, 20 Oct 2026)""",
     "White master on demand: 12 knows when the job makes no white master"),
    ("a7_main", "12_Who_leads_the_scene.js",
     """    : 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. A go lets stage 04 make the white master:""",
     """    : nw ? 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. This job makes no white catalogue image: a go lets stage 07 make the first scene (an empty room, then the product placed in it; paid image calls, only if an image model is approved and the Drive folder is set).'
    : 'go 1: approve the plan, ask for a change, or stop. No image has been made or paid for yet. A go lets stage 04 make the white master:""",
     "White master on demand: go 1 says the first scene is made next"),
    ("a7_main", "12_Who_leads_the_scene.js",
     """    : 'Waiting for the owner\\'s go 1 on the plan. After a go, stage 04 makes the white master only""",
     """    : nw ? 'Waiting for the owner\\'s go 1 on the plan. After a go, stage 07 makes the first scene (this job makes no white catalogue image). No paid image was made.'
    : 'Waiting for the owner\\'s go 1 on the plan. After a go, stage 04 makes the white master only""",
     "White master on demand: the waiting note says the first scene is made next"),
    ("a7_main", "13_Compile.js",
     """if (sceneMode && !(s.approved && s.approved.by === 'owner')) stop(""",
     """// White catalogue image on demand (20 Oct 2026): a job that makes none (01 records it) has no white approval to wait for.
const noWhite = Boolean(s.brief && s.brief.white_master === 'not_asked') && !arr(s.outputs).some(o => o.kind === 'white');
if (sceneMode && !(s.approved && s.approved.by === 'owner') && !noWhite) stop(""",
     "White master on demand: a scene of a job without a white master needs no white approval"),
    ("a7_main", "13_Compile.js",
     """arr(shot.plan && shot.plan.midas_pieces).map(m => 'Midas catalogue photo ' + m.sku), ['passed white master']);""",
     """arr(shot.plan && shot.plan.midas_pieces).map(m => 'Midas catalogue photo ' + m.sku), noWhite ? [] : ['passed white master']);""",
     "White master on demand: planned references list no white master when none is made"),
    ("a7_main", "13_Compile.js",
     """      waits_for: o.kind === 'variation' ? 'the approved parent image, which earlier runs did not store' : 'the owner\\'s go 2 on the white master, then stage 07 Scenes',""",
     """      waits_for: o.kind === 'variation' ? 'the approved parent image, which earlier runs did not store' : (noWhite ? 'stage 07 Scenes, right after go 1 (no white master in this job)' : 'the owner\\'s go 2 on the white master, then stage 07 Scenes'),""",
     "White master on demand: an order waits for stage 07, not for a white master"),
    ("a7_main", "13_Compile.js",
     """const now1 = s04.orders.filter(x => x.dispatch_now);
""",
     """const now1 = s04.orders.filter(x => x.dispatch_now);
// No white master in this job: nothing is made in this compile. 15q hands the run to stage 07 (status scenes_start), which prepares the
// first scene's empty room and placement through 19a and 19g as for any scene; each paid call comes back here in scene mode.
if (noWhite && !now1.length && !repairing && s.status === 'go_1_given' && !s04.critical.length && !s04.orders.some(x => x.kind === 'variation')) {
  s04.go = false; s04.outcome = 'scenes_first'; s04.dispatch = null;
  s04.notes.push('This job makes no white master; stage 07 makes the first scene next.');
  return [{ json: { ...s, s04 } }];
}
""",
     "White master on demand: after go 1, a job without a white master goes to stage 07 instead of holding"),
    ("a7_main", "14_Choose_model.js",
     """if (s04.outcome === 'hold') return [{ json: { s04 } }];""",
     """if (s04.outcome === 'hold' || s04.outcome === 'scenes_first') return [{ json: { s04 } }]; // scenes_first: no image in this compile (13)""",
     "White master on demand: no model is chosen when 13 hands the run to stage 07"),
    ("a7_main", "15q_Stage_04_result.js",
     """} else {
  const c = s04.critical[0] || { why: 'Stage 04 stopped without a recorded reason.' };""",
     """} else if (s04.outcome === 'scenes_first') {
  // White catalogue image on demand (20 Oct 2026): this job makes none, so stage 07 starts its first scene. Not go_1_given (it would loop).
  st.status = 'scenes_start'; st.hold_reason = ''; st.client_question = ''; st.critical = []; st.hold_for = '';
  st.next = 'Go 1 given. This job makes no white catalogue image, so stage 07 starts the first scene next: an empty room, then the product placed in it, each one paid image call within the job budget. No image was made yet.';
} else {
  const c = s04.critical[0] || { why: 'Stage 04 stopped without a recorded reason.' };""",
     "White master on demand: 15q records scenes_start, which Scene due? sends to 19a"),
    ("a7_main", "19a_Scene_ticket.js",
     """const ap = st.approved || null;
""",
     """const ap = st.approved || null;
// White catalogue image on demand (20 Oct 2026): a job that makes none starts its scenes after go 1, with no white approval to check.
const noWhite = Boolean(st.brief && st.brief.white_master === 'not_asked') && !arr(st.outputs).some(o => o.kind === 'white');
""",
     "White master on demand: 19a knows when the job makes no white master"),
    ("a7_main", "19a_Scene_ticket.js",
     """else if (!ap || ap.by !== 'owner' || !ap.candidate || !/^[0-9a-f]{64}$/.test(String(ap.candidate.sha256 || ''))) hold(""",
     """else if (!noWhite && (!ap || ap.by !== 'owner' || !ap.candidate || !/^[0-9a-f]{64}$/.test(String(ap.candidate.sha256 || '')))) hold(""",
     "White master on demand: 19a asks for the white approval only when a white master is made"),
    ("a7_main", "19a_Scene_ticket.js",
     """  // white_package_ready, scene_files_ready or scene_files_held: start the next scene that is neither done nor held.""",
     """  // white_package_ready, scene_files_ready, scene_files_held or scenes_start (no white master): start the next scene that is neither done nor held.""",
     "White master on demand: comment names the new status"),
    ("a7_main", "19d2_Master_check.js",
     """const want = String((ap.candidate && ap.candidate.sha256) || '');
""",
     """const want = String((ap.candidate && ap.candidate.sha256) || '');
// White catalogue image on demand (20 Oct 2026): a job that makes none has no master to download or check (19d's error item is expected).
if (Boolean(st.brief && st.brief.white_master === 'not_asked') && !(Array.isArray(st.outputs) ? st.outputs : []).some(o => o.kind === 'white')) return [{ json: { master: { ok: true, none: true, sha256: '', bytes: 0, mime: '', why: 'this job makes no white master' } } }];
""",
     "White master on demand: 19d2 passes with no master when the job makes none"),
    ("a7_main", "19g_Scene_references.js",
     """    refs.push({ role: 'approved white master', key: 'scene_master',""",
     """    if (!master.none) refs.push({ role: 'approved white master', key: 'scene_master',""",
     "White master on demand: no white master reference when the job makes none"),
    ("a7_main", "19g_Scene_references.js",
     """    out.binary.scene_master = $('19d Download master').first().binary.data;""",
     """    if (!master.none) out.binary.scene_master = $('19d Download master').first().binary.data;""",
     "White master on demand: no white master file when the job makes none"),
    ("a7_main", "19g_Scene_references.js",
     """      const m = refs.findIndex(r => r.key === 'scene_master');
      total -= Number(refs[m].bytes) || 0;
      refs.splice(m, 1); delete out.binary.scene_master;
      notes.push(""",
     """      const m = refs.findIndex(r => r.key === 'scene_master');
      if (m !== -1) { total -= Number(refs[m].bytes) || 0;
      refs.splice(m, 1); delete out.binary.scene_master;
      notes.push(""",
     "White master on demand: the size cap drops the master only when one is sent (opening)"),
    ("a7_main", "19g_Scene_references.js",
     """so the approved white master is not sent; the vendor photo still decides the product.');
    }""",
     """so the approved white master is not sent; the vendor photo still decides the product.'); }
    }""",
     "White master on demand: the size cap drops the master only when one is sent (closing)"),
    ("a7_main", "G1_Go_1_verdict.js",
     """  st.next = 'Go 1 given by the owner at ' + at + '. Stage 04 makes the white master next: compile, model and storage check, dispatch guard, then one paid image call.';""",
     """  st.next = 'Go 1 given by the owner at ' + at + '. ' + (st.brief && st.brief.white_master === 'not_asked' ? 'This job makes no white catalogue image: stage 07 makes the first scene next (an empty room, then the product placed in it), each one paid image call.' : 'Stage 04 makes the white master next: compile, model and storage check, dispatch guard, then one paid image call.');""",
     "White master on demand: the go 1 note names the first scene"),
    ("a7_main", "G1b_Decision_check.js",
     """  reply: problem ? { forwarded: false, problem } : null
} }];""",
     """  reply: problem ? { forwarded: false, problem } : null,
  ...(gate !== 'go2' && outputs.length && !outputs.some(o => o.kind === 'white') ? { no_white_master: true } : {})
} }];""",
     "White master on demand: the go 1 decision says when the job makes no white master (key added only then)"),
    ("a7_main", "G1d_Forward_result.js",
     """  : { go: 'Go 1 is recorded. Stage 04 makes the white master next""",
     """  : { go: d.no_white_master ? 'Go 1 is recorded. This job makes no white catalogue image: stage 07 makes the first scene next (an empty room, then the product placed in it; paid image calls, only if an image model is approved and the Drive folder is set), then stage 05 reviews it and asks for your go 2.' : 'Go 1 is recorded. Stage 04 makes the white master next""",
     "White master on demand: the go 1 reply names the first scene"),
    # Phase 1.2 (FL-4, owner's go 22 Oct 2026): a package held only by the background rule (edge rows or grey halo of a saved file)
    # opens a go 2 decision instead of ending the run: approve = deliver as exception (packaging runs again from the same approved
    # master, no AI and no paid call, and accepts those files as the owner's exception), repair = a new image (one of the two repairs),
    # stop. Every other package hold stays a hold, as before. Run 1591 never reaches stage 06, so its replay is unchanged.
    ("a7_main", "18a_Package_ticket.js",
     """  product_box_2d: ap && Array.isArray(ap.product_box_2d) ? ap.product_box_2d : null
};""",
     """  product_box_2d: ap && Array.isArray(ap.product_box_2d) ? ap.product_box_2d : null,
  // Phase 1.2 (FL-4, owner, 22 Oct 2026): the owner's "deliver as exception" at the package's go 2, bound to these bytes and this contract.
  owner_exception: st.package_exception && st.package_exception.by === 'owner' && cand && st.package_exception.candidate_sha256 === cand.sha256 && st.package_exception.contract_stamp === st.contract_stamp
    ? { problem: clean(st.package_exception.problem, 600), note: clean(st.package_exception.note, 300), at: st.package_exception.at } : null
};""",
     "Phase 1.2: the package ticket carries the owner's deliver-as-exception, only when bound to the approved bytes and contract"),
    ("a7_main", "18h_Check_files.js",
     """  let done = false, lastProblem = '';""",
     """  let done = false, lastProblem = '';
  let ruleFail = null; // Phase 1.2: the last try that failed only the background rule (edge rows or grey halo)""",
     "Phase 1.2: 18h remembers a file that failed only the background rule"),
    ("a7_main", "18h_Check_files.js",
     """    lastProblem = !edgePass ? 'the saved '""",
     """    lastProblem = !edgePass ? 'the saved '""",
     "Phase 1.2: 18h keeps the bytes of a background-rule failure"),
    ("a7_main", "18h_Check_files.js",
     """    // Only a compression problem gets the next try (the jpg at quality 100).
  }""",
     """    ruleFail = { buf, kind, rec, problem: lastProblem };
    // Only a compression problem gets the next try (the jpg at quality 100).
  }
  if (ruleFail && ruleFail.problem !== lastProblem) ruleFail = null; // a later try failed for another reason: not rule-only (review fix)""",
     "Phase 1.2 review fix: a file is rule-only only when its last try failed the background rule; the recorded problem is that rule problem"),
    ("a7_main", "18h_Check_files.js",
     """  f.tries = tries;
  if (done && tries.length > 1)""",
     """  // Phase 1.2 (FL-4, owner, 22 Oct 2026): after the owner chose "deliver as exception" at the package's go 2, a file that failed only
  // the background rule is delivered as it is, and the problem is recorded with it. A wrong format, size or unreadable file never is.
  if (!done && ruleFail && pk.owner_exception) {
    Object.assign(f, ruleFail.rec); f.owner_exception = 'delivered as the owner\\'s exception: ' + ruleFail.problem; done = true;
    outBin[f.format] = await this.helpers.prepareBinaryData(ruleFail.buf, f.file_name, ruleFail.kind);
    pk.exceptions = (pk.exceptions || []).concat([f.format + ': ' + ruleFail.problem]);
  }
  if (!done && !ruleFail) ruleOnly = false;
  f.tries = tries;
  if (done && tries.length > 1)""",
     "Phase 1.2: with the owner's exception, a file that failed only the background rule is delivered and the problem recorded"),
    ("a7_main", "18h_Check_files.js",
     """const TRY = { jpg:""",
     """let ruleOnly = true; // Phase 1.2: every file that failed, failed only the background rule
const TRY = { jpg:""",
     "Phase 1.2: 18h tracks whether only the background rule failed"),
    ("a7_main", "18h_Check_files.js",
     """pk.files_ok = problems.length === 0;""",
     """pk.files_ok = problems.length === 0;
pk.exception_possible = !pk.files_ok && ruleOnly && !skipped; // Phase 1.2: the owner may deliver these files as an exception""",
     "Phase 1.2: 18h says when the owner may deliver the files as an exception"),
    ("a7_main", "18p_Package_result.js",
     """for (const n of ['18e Check master', '18e3 Clean background', '18h Check files', '18l Manifest', '18n Identity entry']) { const j = get(n); if (j && j.pk) pk = j.pk; }
pk = JSON.parse(JSON.stringify(pk));
const j18j = get('18j Files to upload');
if (j18j && j18j.skip) { pk.ok = false; pk.problem = j18j.problem; }
const n18 = get('18n Identity entry');
const saved18o = get('18o Save identity');""",
     """// Phase 1.2 (FL-4, review fix 22 Oct 2026): packaging can now run again in the same execution (after a deliver-as-exception or a
// repair), and a node that did not run on this pass still holds its earlier output. Only results made from this pass's ticket count.
const fresh = j => Boolean(j && j.pk && T.pk && j.pk.at === T.pk.at);
for (const n of ['18e Check master', '18e3 Clean background', '18h Check files', '18l Manifest', '18n Identity entry']) { const j = get(n); if (fresh(j)) pk = j.pk; }
pk = JSON.parse(JSON.stringify(pk));
const h18 = get('18h Check files'), h18fresh = fresh(h18) && h18.pk.files_ok === true;
const j18j = h18fresh ? get('18j Files to upload') : null;
if (j18j && j18j.skip) { pk.ok = false; pk.problem = j18j.problem; }
const n18 = fresh(get('18n Identity entry')) ? get('18n Identity entry') : null;
const saved18o = n18 ? get('18o Save identity') : null;""",
     "Phase 1.2 review fix: 18p reads only this pass's package results, never an earlier pass's"),
    ("a7_main", "18p_Package_result.js",
     """  white_clean: pk.white_clean || null, ai_or_paid_calls: 'none'
};""",
     """  white_clean: pk.white_clean || null, ai_or_paid_calls: 'none',
  owner_exception: ready && pk.owner_exception ? { problem: pk.owner_exception.problem, at: pk.owner_exception.at, note: pk.owner_exception.note, accepted: arr(pk.exceptions) } : null
};""",
     "Phase 1.2: the package records the owner's exception"),
    ("a7_main", "18p_Package_result.js",
     """  classification: !complete ? 'incomplete' : (matrix.every(o => o.classification === 'reviewed_owner_approved') ? 'reviewed_owner_approved' : 'owner_exception'),
  catalogue_eligible: complete && matrix.every(o => o.catalogue_eligible), outputs: matrix,""",
     """  classification: !complete ? 'incomplete' : (!pk.owner_exception && matrix.every(o => o.classification === 'reviewed_owner_approved') ? 'reviewed_owner_approved' : 'owner_exception'),
  catalogue_eligible: complete && !pk.owner_exception && matrix.every(o => o.catalogue_eligible), outputs: matrix,""",
     "Phase 1.2: a package delivered as an exception is never a reviewed catalogue release"),
    ("a7_main", "18p_Package_result.js",
     """  const again = arr(pk.files).filter(f => f.saved_again).map(f => ' The ' + f.format + ' was ' + f.saved_again + '.').join('');""",
     """  const again = arr(pk.files).filter(f => f.saved_again).map(f => ' The ' + f.format + ' was ' + f.saved_again + '.').join('')
    + (st.package.owner_exception ? ' Delivered as the owner\\'s exception (go 2, ' + st.package.owner_exception.at + '): ' + st.package.owner_exception.accepted.join('; ') + '.' : '');""",
     "Phase 1.2: the package note names the owner's exception"),
    ("a7_main", "18p_Package_result.js",
     """} else {
  st.status = 'hold'; st.hold_for = 'owner'; st.client_question = ''; st.hold_step = 18; st.hold_reason = st.package.problem;""",
     """} else if ((() => { const h = get('18h Check files'); const ap = st.approved; return Boolean(fresh(h) && h.pk.exception_possible === true && !pk.owner_exception && ap && ap.by === 'owner' && ap.candidate && ap.candidate.link); })()) {
  // Phase 1.2 (FL-4, owner, 22 Oct 2026): only the background rule failed, so the owner decides at go 2 instead of a dead end.
  const ap = st.approved, attempt = Number(ap.attempt) || 1, MAX_ATTEMPT = 3;
  const can = ['approve', 'stop'].concat(attempt < MAX_ATTEMPT ? ['repair'] : []);
  st.status = 'awaiting_go_2'; st.hold_reason = ''; st.client_question = ''; st.hold_for = ''; st.critical = [];
  st.go2_round = attempt; st.go2_token = require('crypto').randomBytes(16).toString('hex'); st.go2_allowed = can; st.go2_route = '';
  st.go2 = {
    for: 'owner', kind: 'package', output_id: ap.output_id, attempt, label: 'Generated image. Owner-approved white master; its package held.', decisions: can,
    problem: st.package.problem, candidate: ap.candidate, repairs_left: MAX_ATTEMPT - attempt,
    decision_needed: 'go 2 (package): the package of the approved white master held. ' + st.package.problem + ' Choose: approve to deliver as exception (the files are delivered as they are and recorded as your exception with this problem; no paid call; then the scenes), ' + (attempt < MAX_ATTEMPT ? 'repair to make a new image (repair ' + attempt + ' of 2: a paid image call, then a new review and go 2), ' : '') + 'or stop. Nothing is delivered until you answer.',
    answer_with: { id: st.client_run_id, run_id: st.run_id, round: attempt },
    how_to_answer: 'Send id, run_id and round exactly as in answer_with, plus decision ' + can.join(', ') + ', to the A7 decision address. The run waits 24 hours.',
    reminders: ['Delivering as exception never makes the package a reviewed catalogue release.', 'Nothing is repaired or delivered automatically.']
  };
  st.next = 'Waiting for the owner\\'s go 2 on the package: ' + st.package.problem + ' The approved master is unchanged. No AI or paid call was made in this stage.';
} else {
  st.status = 'hold'; st.hold_for = 'owner'; st.client_question = ''; st.hold_step = 18; st.hold_reason = st.package.problem;""",
     "Phase 1.2: a package held only by the background rule opens a go 2 decision (deliver as exception, repair, stop)"),
    ("a7_main", "18p_Package_result.js",
     """st.vault_only = ['package', 'identity', 'package_release', 'hold', 'status'];""",
     """st.vault_only = ['package', 'identity', 'package_release', 'hold', 'status', 'go2_ticket'];""",
     "Phase 1.2: the package's go 2 ticket is written to the vault, where the owner's approval context reads it"),
    ("a7_main", "G2_Go_2_verdict.js",
     """const thing = isScene ? 'scene ' + st.go2.output_id : 'white master';""",
     """// Phase 1.2 (FL-4, owner, 22 Oct 2026): the same go 2 answers a package held by the background rule.
const isPackage = Boolean(st.go2 && st.go2.kind === 'package');
const thing = isScene ? 'scene ' + st.go2.output_id : (isPackage ? 'package of the white master' : 'white master');""",
     "Phase 1.2: go 2 knows a package decision"),
    ("a7_main", "G2_Go_2_verdict.js",
     """else if ((decision === 'approve' || decision === 'approve_unreviewed') && isScene) {""",
     """else if (decision === 'approve' && isPackage) {
  // Deliver as exception: the white master's approval stays as it was; packaging runs again from the same bytes and records the exception.
  st.package_exception = { problem: clean(st.go2.problem, 600), note, at, by: 'owner', round, candidate_sha256: (st.go2.candidate && st.go2.candidate.sha256) || '', contract_stamp: st.contract_stamp || '' };
  st.status = 'white_master_approved'; st.hold_reason = ''; st.client_question = ''; st.hold_for = '';
  st.next = 'The owner chose to deliver the package as an exception at ' + at + ' (' + st.package_exception.problem + '). Stage 06 makes the package again from the same approved master, without AI and without a paid call, delivers the files that broke only the background rule as they are and records the exception. Then the scenes.';
}
else if ((decision === 'approve' || decision === 'approve_unreviewed') && isScene) {""",
     "Phase 1.2: approve at the package's go 2 means deliver as exception"),
    ("a7_main", "G2_Go_2_verdict.js",
     """  st.next = 'Stopped by the owner at go 2 (' + at + '). The ' + thing + ' is not approved.' + (isScene ? ' Scenes approved before stay approved.' : '');""",
     """  st.next = isPackage ? 'Stopped by the owner at the package decision (' + at + '). No package is delivered; the approved white master is unchanged.' : 'Stopped by the owner at go 2 (' + at + '). The ' + thing + ' is not approved.' + (isScene ? ' Scenes approved before stay approved.' : '');""",
     "Phase 1.2: stopping at the package decision says what stays"),
    ("a7_main", "G2_Go_2_verdict.js",
     """if (genuine && allowed.includes(decision) && ['white_master_approved', 'scene_approved'].includes(st.status)) rec.release = (isScene ? st.scenes.done[st.go2.output_id] : st.approved).release;""",
     """if (genuine && allowed.includes(decision) && ['white_master_approved', 'scene_approved'].includes(st.status)) rec.release = isPackage ? null : (isScene ? st.scenes.done[st.go2.output_id] : st.approved).release;
if (isPackage && st.package_exception && decision === 'approve') { rec.kind = 'package'; rec.exception = st.package_exception; }""",
     "Phase 1.2 review fix: a package decision's audit record carries the exception, not the white master's release"),
    # Phase 1.3 (FL-5, owner's go 22 Oct 2026): 18e3 fits (scales down on a white canvas) only a product a review bound to this image
    # found whole in the frame, and delivers the white files only when the product's longest side spans 76% +/- 3 points (rule 20).
    # A cut-off or unconfirmed product that would need fitting, or one below the band (never enlarged), holds with a plain reason.
    # The tolerance defaults to 3 in 18a (04 Settings framing.white_delivery_tolerance_pts may set it later), so 04 is unchanged and
    # run 1591, which never reaches stage 06, replays as before.
    ("a7_main", "18a_Package_ticket.js",
     """fit_span_pct: Number(framing.white_span_pct) || 76 };""",
     """fit_span_pct: Number(framing.white_span_pct) || 76, fit_tolerance_pts: Number.isFinite(framing.white_delivery_tolerance_pts) ? framing.white_delivery_tolerance_pts : 3 };""",
     "Phase 1.3: the package ticket carries the delivery framing tolerance (76 +/- 3 points by default)"),
    ("a7_main", "18a_Package_ticket.js",
     """  // Phase 1.2 (FL-4, owner, 22 Oct 2026): the owner's "deliver as exception" at the package's go 2""",
     """  // Phase 1.3 (FL-5, owner, 22 Oct 2026): whether the review of these exact bytes found the whole product in the frame.
  whole_in_frame: (() => { const r = st.review || {}, c = r.crop || null; const bound = Boolean(cand && r.candidate && r.candidate.sha256 === cand.sha256);
    return bound && c ? { known: true, cut_off: c.cut_off === true, disagree: c.disagree === true, decided_by: clean(c.decided_by, 120) } : { known: false, cut_off: null, disagree: null, decided_by: bound ? 'the review recorded no crop check' : 'no review bound to these bytes' }; })(),
  // Phase 1.2 (FL-4, owner, 22 Oct 2026): the owner's "deliver as exception" at the package's go 2""",
     "Phase 1.3: the package ticket carries the bound review's whole-in-frame result"),
    ("a7_main", "18e3_Clean_background.js",
     """  if (unsafe(box)) {
    const spanBefore = Math.max(box[3] - box[1], box[2] - box[0]) / 10;""",
     """  // Phase 1.3 (FL-5, owner, 22 Oct 2026): only a whole product is fitted, and the delivered files keep FIT_SPAN_PCT +/- TOL on the
  // longest side (rule 20). A product that is cut off, or not confirmed whole by a review of these bytes, is never scaled or framed in
  // code (rule 17); one below the band is never enlarged. Each of these holds with a plain reason.
  const TOL = pk.cfg && Number.isFinite(pk.cfg.fit_tolerance_pts) ? pk.cfg.fit_tolerance_pts : 3;
  const spanNow = Math.round(Math.max(box[3] - box[1], box[2] - box[0])) / 10;
  const whole = pk.whole_in_frame || {};
  const needsFit = unsafe(box) || spanNow > FIT_SPAN_PCT + TOL;
  wc.framing_rule = { measure: 'longest side of the product box', target_pct: FIT_SPAN_PCT, tolerance_pts: TOL, span_before_pct: spanNow, whole_in_frame: whole };
  if (needsFit && !(whole.known === true && whole.cut_off === false && whole.disagree !== true)) {
    wc.hold_kind = 'framing';
    throw new Error(whole.cut_off === true ? 'the review found the product cut off at the frame edge, so it is not scaled or framed in code; a cut-off product is never delivered'
      : whole.disagree === true ? 'the review was unsure whether the product is cut off at the frame edge, so it is not scaled or framed in code'
      : 'no review of this image confirmed the whole product is in the frame, so it is not scaled or framed in code');
  }
  if (!needsFit && spanNow < FIT_SPAN_PCT - TOL) {
    wc.hold_kind = 'framing';
    throw new Error('the product spans ' + spanNow + '% of the frame on its longest side, below ' + (FIT_SPAN_PCT - TOL) + '% (the white catalogue framing is ' + FIT_SPAN_PCT + '% +/- ' + TOL + '); it is never enlarged');
  }
  if (needsFit) {
    const spanBefore = spanNow;""",
     "Phase 1.3: 18e3 fits only a product a bound review found whole, and holds outside 76 +/- 3 on the longest side"),
    ("a7_main", "18e3_Clean_background.js",
     """    wc.fit = { done: true, why: 'the product box left no safe background margin at an image edge', scale:""",
     """    wc.fit = { done: true, why: unsafe(box) ? 'the product box left no safe background margin at an image edge' : 'the product spanned ' + spanBefore + '% of the frame, above ' + (FIT_SPAN_PCT + TOL) + '%', scale:""",
     "Phase 1.3: 18e3 records why it fitted"),
    ("a7_main", "18e3_Clean_background.js",
     """    const s = Math.min(1, FIT_SPAN_PCT / spanBefore);""",
     """    const s = Math.min(1, FIT_SPAN_PCT / spanBefore);
    // Phase 1.3: the span after fitting must be in the band too; checked before any resampling (review fix, 22 Oct 2026).
    if (spanBefore * s < FIT_SPAN_PCT - TOL || spanBefore * s > FIT_SPAN_PCT + TOL) { wc.hold_kind = 'framing'; throw new Error(spanBefore * s < FIT_SPAN_PCT - TOL ? 'the product spans ' + spanBefore + '% of the frame on its longest side, below ' + (FIT_SPAN_PCT - TOL) + '% (the white catalogue framing is ' + FIT_SPAN_PCT + '% +/- ' + TOL + '), and it is too close to an edge to clean; it is never enlarged' : 'after fitting, the product would span ' + (Math.round(spanBefore * s * 10) / 10) + '% of the frame, outside ' + FIT_SPAN_PCT + '% +/- ' + TOL); }""",
     "Phase 1.3: 18e3 checks the span after fitting before it resamples"),
    ("a7_main", "18e3_Clean_background.js",
     """  { step: 'framing band check (white master 72-80% on the longest side)', why: 'it needs the product box; not measured' }""",
     """  { step: 'framing band check (white master 76% +/- 3 on the longest side; Phase 1.3)', why: 'it needs the product box; not measured' }""",
     "Phase 1.3: the skipped-step note names the delivery band"),
    ("a7_main", "18e3_Clean_background.js",
     """} else if (!wc.done) { pk.ok = false; pk.problem = 'The package was not made: the background could not be set to 255 (' + wc.problem + '). The approved master is unchanged. Nothing was uploaded.'; }""",
     """} else if (!wc.done && wc.hold_kind === 'framing') { pk.ok = false; pk.problem = 'The package was not made: ' + wc.problem + '. The approved master is unchanged. Nothing was uploaded.'; }
else if (!wc.done) { pk.ok = false; pk.problem = 'The package was not made: the background could not be set to 255 (' + wc.problem + '). The approved master is unchanged. Nothing was uploaded.'; }""",
     "Phase 1.3: a framing hold says so plainly"),
    # Phase 1.5 (FL-12, FL-2, owner's go 22 Oct 2026). The image budget ticket uses the model 14 Choose model picked (an approved
    # registry row) instead of a fixed id; the ledger on the owner site stays the price authority and refuses a model it has no
    # price for, before any call. Job ids other than owner-<uuid> are refused at intake with a reason, before any paid call.
    # Run 1591 uses the approved default model and an owner- id, so its replay is unchanged.
    ("a7_main", "Budget_15g_Ticket.js",
     """const body=JSON.parse(it.json.body);if(body.model!=="gemini-nano-banana-2.1"||body.generation_config?.max_output_tokens!==32768||body.tools?.length)throw Error('image_call_policy_mismatch');""",
     """// Phase 1.5 (FL-12, owner, 22 Oct 2026): the model is the one 14 Choose model picked from an approved registry row, not a fixed id.
const chosen=it.json.s04?.model||{};const imageModel=String(chosen.model_id||'');
const body=JSON.parse(it.json.body);if(!/^[a-z0-9][a-z0-9.-]{0,79}$/.test(imageModel)||String(chosen.registry_status||'').toLowerCase()!=='approved'||body.model!==imageModel||body.generation_config?.max_output_tokens!==32768||body.tools?.length)throw Error('image_call_policy_mismatch');""",
     "Phase 1.5: the image budget ticket checks the request against the approved model 14 chose (status read as 14 reads it, any case), not a fixed id"),
    ("a7_main", "Budget_15g_Ticket.js",
     """node:"15g Send to Google",model:"gemini-nano-banana-2.1",outputId:slot.output,""",
     """node:"15g Send to Google",model:imageModel,outputId:slot.output,""",
     "Phase 1.5: the ledger reservation names the chosen model, so the ledger prices or refuses that model"),
    ("a7_main", "01_Intent_scope.js",
     """if (clientRunId.length < 8 || clientRunId.length > 80) problems.push('The job id must be 8 to 80 characters.');""",
     """if (clientRunId.length < 8 || clientRunId.length > 80) problems.push('The job id must be 8 to 80 characters.');
// Phase 1.5 (FL-2, owner, 22 Oct 2026): every paid step's budget identity needs an owner-<uuid> job id. Any other form is refused here,
// with a reason and before any paid call, instead of crashing at the first paid step. Jobs from the client page are not supported yet.
else if (!/^owner-[a-f0-9-]{36}$/.test(clientRunId)) problems.push('Only jobs sent from the owner site can start (job id "owner-" plus its id). This job id form is not supported yet, so nothing was started or paid.');""",
     "Phase 1.5: job ids other than owner-<uuid> are refused at intake with a reason, before any paid call"),
    # Phase 1.3 follow-up (owner's go 22 Oct 2026, "go with the order"): an image the owner approved without a review has no
    # review.crop, so 1.3 held it whenever it needed fitting. The package now falls back on the same code test the review uses (D6):
    # the blind count's box more than 15 of 1000 from every frame edge and no "cropped" flag means whole; a box at the edge means
    # cut off; a safe box with the flag means unsure. 16b keeps the flag beside the box it already keeps, reviewed or not.
    ("a7_main", "16b_Review_verdict.js",
     """if (blind && boxEdge(blind) !== null) review.product_box_2d = blind.box_2d.map(Number);""",
     """if (blind && boxEdge(blind) !== null) { review.product_box_2d = blind.box_2d.map(Number); review.product_box_flagged = blind.cropped === true; } // flag: Phase 1.3 follow-up""",
     "Phase 1.3 follow-up: the review keeps the blind count's cropped flag beside its box, reviewed or not"),
    ("a7_main", "18a_Package_ticket.js",
     """    return bound && c ? { known: true, cut_off: c.cut_off === true, disagree: c.disagree === true, decided_by: clean(c.decided_by, 120) } :""",
     """    if (bound && !c && Array.isArray(r.product_box_2d) && r.product_box_2d.length === 4 && typeof r.product_box_flagged === 'boolean') {
      // Phase 1.3 follow-up: no review result (approved without a review), so the review's own code test (D6) on the blind count's box.
      // Only when 16b recorded the flag beside the box; a box from another path without it stays unknown (review fix, 22 Oct 2026).
      const b = r.product_box_2d.map(Number), edge = Math.min(b[0], b[1], 1000 - b[2], 1000 - b[3]), flagged = r.product_box_flagged === true;
      if (b.every(Number.isFinite)) return { known: true, cut_off: edge <= 15, disagree: edge > 15 && flagged, decided_by: 'code, from the blind count\\'s box (no review result): ' + edge + ' of 1000 from the nearest frame edge, limit 15' + (flagged ? ', flagged "cropped"' : '') };
    }
    return bound && c ? { known: true, cut_off: c.cut_off === true, disagree: c.disagree === true, decided_by: clean(c.decided_by, 120) } :""",
     "Phase 1.3 follow-up: without a review result, the package decides whole-in-frame by the review's own box test"),
    # Phase 1.6 (FL-10, owner's go 22 Oct 2026). A placement sends the vendor photo, the approved master, the room and the Midas photos
    # inline; above max_inline_mb (04 Settings, 14 MB) the scene held with "Resizing is not built" after the room was already paid.
    # Now 19g first shrinks, in code and without AI, each reference whose long side is above 2048 px to a 2048 px long side (aspect
    # kept, JPEG q90), through the engine helper this.helpers.midasResizeReference (nodes/claude_reference_resize.py, the Edit Image
    # node's Pillow resize): the other references first, the vendor photo only if still needed. Only if still too large does it drop
    # the master and hold, as before. Nothing is resized when the references fit. Run 1591 ends at Go 1, so its replay is unchanged.
    ("a7_main", "19g_Scene_references.js",
     """    // One request carries every image inline. If the images are too large together, the master goes first (image 1 still decides
    // the product); if they are still too large, the scene holds. Resizing references is not built.
    let total = refs.reduce((t, r) => t + (Number(r.bytes) || 0), 0);
""",
     """    // One request carries every image inline. Phase 1.6 (FL-10, owner, 22 Oct 2026): if the images are too large together, each
    // reference whose long side is above 2048 px is first shrunk in code, without AI (the engine's helper: the Edit Image node's
    // resize), to a 2048 px long side; the aspect ratio is kept and nothing is cropped. The room, the side photo, the Midas photos and
    // the approved master (only made smaller) go first; the vendor photo only if the images are still too large. Each resize is
    // recorded in scene.ref_resized, the scene notes and the trail. If they are still too large, the master goes (image 1 still
    // decides the product); if they are still too large after that, the scene holds. Nothing is resized when the images fit.
    let total = refs.reduce((t, r) => t + (Number(r.bytes) || 0), 0);
    const RESIZE_PX = 2048;
    const mb = n => (n / 1048576).toFixed(1);
    sc.ref_resized = [];
    const resizer = this.helpers && typeof this.helpers.midasResizeReference === 'function' ? this.helpers.midasResizeReference : null;
    if (st.status !== 'hold' && total > cap && resizer) {
      let ingest = {};
      try { ingest = $('02 Ingest files').first().binary || {}; } catch (e) { ingest = {}; }
      for (const vendorPass of [false, true]) {
        for (const r of refs) {
          if (total <= cap) break;
          if ((r.role === 'vendor photo') !== vendorPass) continue;
          const src = out.binary[r.key] || ingest[r.key] || null;
          if (!src) continue;
          let res = null;
          try { res = await resizer(src, RESIZE_PX); } catch (e) { res = null; notes.push('The ' + r.role + ' (' + r.name + ') could not be resized in code (' + String((e && e.message) || e).slice(0, 200) + ').'); }
          if (!res || !res.resized || !res.binary) continue;
          const before = Number(r.bytes) || Number(res.from_bytes) || 0;
          sc.ref_resized.push({ role: r.role, key: r.key, name: r.name, from_px: res.from_px, to_px: res.to_px, from_bytes: before, to_bytes: res.to_bytes, from_sha256: r.sha256, to_sha256: res.sha256, mime: res.mime, how: 'in code, without AI: long side to ' + RESIZE_PX + ' px, aspect kept, JPEG quality 90' });
          total += res.to_bytes - before;
          out.binary[r.key] = res.binary;
          r.bytes = res.to_bytes; r.sha256 = res.sha256; r.mime = res.mime; r.resized_from = { px: res.from_px, bytes: before };
          notes.push('The ' + r.role + ' (' + r.name + ') was resized in code, without AI, from ' + res.from_px.join(' x ') + ' px to ' + res.to_px.join(' x ') + ' px (' + mb(before) + ' MB to ' + mb(res.to_bytes) + ' MB), so the images fit the ' + (cap / 1048576) + ' MB request size.');
        }
      }
    }
""",
     "Phase 1.6: over the request size, 19g shrinks references above 2048 px (others first, then the vendor photo) in code before it drops the master or holds"),
    ("a7_main", "19g_Scene_references.js",
     """MB set for one request. Resizing is not built, so the scene is not made.');""",
     """MB set for one request' + (resizer ? ', even after every photo above ' + RESIZE_PX + ' px was resized in code to ' + RESIZE_PX + ' px' : ' (resizing in code is not available here)') + ', so the scene is not made.');""",
     "Phase 1.6: the size hold says the photos were resized first and are still too large"),
    ("a7_main", "19g_Scene_references.js",
     """note: st.status === 'scene_due' ? sc.output_id + ' · ' + sc.phase + ' · ' + refs.length + ' image(s)' : 'held' }]);""",
     """note: (st.status === 'scene_due' ? sc.output_id + ' · ' + sc.phase + ' · ' + refs.length + ' image(s)' : 'held') + (arr(sc.ref_resized).length ? ' · resized in code: ' + sc.ref_resized.map(x => x.role + ' ' + x.from_px.join('x') + ' to ' + x.to_px.join('x') + ' px, ' + x.from_bytes + ' to ' + x.to_bytes + ' bytes').join('; ') : '') }]);""",
     "Phase 1.6: the trail names each resized reference (px and bytes, before and after)"),
]

# (package, node name, parameter path, value, reason): the only deliberate changes to node parameters, recorded in the manifest.
NODE_PATCHES = [
    ("a7_main", "16x Blind count", "options.thinkingLevel", "low",
     "Speed change 1: the blind count asks Gemini for low thinking; the image already goes inline, not through the Files API"),
    ("a7_main", "Scene due?", "conditions.conditions",
     [{"leftValue": "={{ ['white_package_ready', 'scene_room_ready', 'scene_files_ready', 'scene_files_held', 'edit_base_ready', 'scenes_start'].indexOf($('V1 Vault events').first().json.status) !== -1 && ($('V1 Vault events').first().json.outputs || []).some(o => ['lifestyle', 'hero', 'wide', 'detail', 'composition', 'scene'].indexOf(o.kind) !== -1) }}",
       "operator": {"operation": "true", "singleValue": True, "type": "boolean"}}],
     "White master on demand: Scene due? also accepts scenes_start (a job without a white master, after go 1)"),
]

# (package, setting, value, reason): engine settings added to a flow, recorded in the manifest.
SETTINGS_PATCHES = [
    ("a7_main", "parallelFanOut", ["Images ready?"],
     "Speed change 2: the critic review and the blind count run at the same time, then meet at the Reviews done merge"),
    ("a7_main", "holdOnError", {"runsTable": "l0roUCBwIQL3h9Eq"},
     "Phase 1.1 (FL-1, owner's go 22 Oct 2026): a run that ends in an error is recorded as a hold on its run row, naming the step"),
]

KEEP_NODE_KEYS = ("name", "type", "typeVersion", "position", "parameters", "credentials", "onError", "continueOnFail",
                  "alwaysOutputData", "executeOnce", "retryOnFail", "maxTries", "waitBetweenTries", "disabled", "webhookId")


def slug(name: str) -> str:
    s = re.sub(r"[^0-9A-Za-z]+", "_", name).strip("_")
    return s or "node"


def convert(package: str, workflow_id: str) -> dict:
    wf = json.loads((BASELINE / f"{workflow_id}.json").read_text(encoding="utf-8"))
    pkg_dir = FLOWS_DIR / package
    code_dir = pkg_dir / "code"
    if pkg_dir.exists():
        shutil.rmtree(pkg_dir)
    code_dir.mkdir(parents=True)
    nodes = []
    used: set[str] = set()
    code_hashes = {}
    for raw in wf["nodes"]:
        if raw["type"].endswith(".stickyNote"):
            continue
        node = {k: raw[k] for k in KEEP_NODE_KEYS if k in raw}
        params = dict(node.get("parameters") or {})
        if "jsCode" in params:
            base = slug(raw["name"])
            fname, n = f"{base}.js", 2
            while fname in used:
                fname, n = f"{base}_{n}.js", n + 1
            used.add(fname)
            code = params.pop("jsCode")
            (code_dir / fname).write_bytes(code.encode("utf-8"))
            code_hashes[raw["name"]] = hashlib.sha256(code.encode("utf-8")).hexdigest()
            params = {"jsCodeFile": fname, **params}
        node["parameters"] = params
        nodes.append(node)
    node_patches = []
    for pkg, name, path, value, reason in NODE_PATCHES:
        if pkg != package:
            continue
        target = next((n for n in nodes if n["name"] == name), None)
        if target is None:
            raise SystemExit(f"node patch for {package}: no node named {name!r}")
        *parents, leaf = path.split(".")
        obj = target["parameters"] = copy.deepcopy(target["parameters"])
        for key in parents:
            obj = obj.setdefault(key, {})
        obj[leaf] = value
        node_patches.append({"node": name, "parameter": path, "value": value, "reason": reason})
    settings = dict(wf.get("settings") or {})
    settings_patches = []
    for pkg, key, value, reason in SETTINGS_PATCHES:
        if pkg == package:
            settings[key] = value
            settings_patches.append({"setting": key, "value": value, "reason": reason})
    flow = {
        "id": wf["id"], "name": wf["name"], "versionId": wf["versionId"],
        "settings": settings, "nodes": nodes, "connections": wf.get("connections") or {},
    }
    body = pprint.pformat(flow, width=120, sort_dicts=False)
    header = (
        f'"""{wf["name"]}: generated by tools/n8n_to_flow.py from n8n/baseline/{workflow_id}.json '
        f'(version {wf["versionId"]}).\n\nNodes and connections only; each Code node\'s JavaScript is in code/.\n"""\n\n'
    )
    (pkg_dir / "__init__.py").write_text(header + "FLOW = " + body + "\n", encoding="utf-8")
    entry = {"package": package, "id": workflow_id, "versionId": wf["versionId"], "nodes": len(nodes),
             "codeNodes": len(code_hashes), "codeSha256": code_hashes}
    if node_patches:
        entry["nodePatches"] = node_patches
    if settings_patches:
        entry["settingsPatches"] = settings_patches
    return entry


def apply_patches(manifest: list[dict]) -> None:
    by_pkg = {m["package"]: m for m in manifest}
    for package, code_file, old, new, reason in PATCHES:
        path = FLOWS_DIR / package / "code" / code_file
        text = path.read_text(encoding="utf-8")
        if text.count(old) != 1:
            raise SystemExit(f"patch for {package}/{code_file} does not match exactly once")
        patched = text.replace(old, new)
        path.write_text(patched, encoding="utf-8")
        by_pkg[package].setdefault("patches", []).append({
            "file": code_file, "reason": reason,
            "originalSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "patchedSha256": hashlib.sha256(patched.encode("utf-8")).hexdigest()})


def main() -> int:
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)
    (FLOWS_DIR / "__init__.py").write_text('"""Flow packages generated from the frozen n8n baselines."""\n', encoding="utf-8")
    manifest = [convert(pkg, wid) for pkg, wid in FLOWS.items()]
    apply_patches(manifest)
    (FLOWS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(BASELINE / "data-tables.json", DATA_DIR / "data-tables.json")
    seeds = DATA_DIR / "seeds"
    if seeds.exists():
        shutil.rmtree(seeds)
    shutil.copytree(BASELINE / "seeds", seeds)
    for m in manifest:
        print(f"{m['package']:<18} {m['id']}  v{m['versionId'][:8]}  nodes={m['nodes']:<4} code={m['codeNodes']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
