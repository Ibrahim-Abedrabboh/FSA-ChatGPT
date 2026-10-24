/* Midas A7 owner studio: the link between the Draft 3 page and the owner backend (Claude-final-midas-a7, 18 Oct 2026).
   Pure functions only, so they run the same in the browser and in node tests:
   - toOwnerBrief(): a Draft 3 payload (app.js buildPayload) -> the owner draft brief / submission fields.
   - toResult(): an owner job read (+ the approval ticket, when one is open) -> the page's result contract midas-result/1.
   Nothing here sends a request. Everything in this file is public: never put a key, token or address with a secret here. */
(function (root) {
  'use strict';

  const OUTCOME = { 'White BK': 'White background', Lifestyle: 'Lifestyle' };
  const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const lines = (list, each, count) => (Array.isArray(list) ? list : []).map(x => clip(x, each)).filter(Boolean).slice(0, count).join('\n');

  /* The owner backend accepts White background and Lifestyle at 2K. A Draft 3 payload for anything else is a fault in the page. */
  function toOwnerBrief(p) {
    if (!p || typeof p !== 'object') throw new Error('no_payload');
    const outcome = OUTCOME[p.scope && p.scope.outcome];
    if (!outcome) throw new Error('outcome_not_connected');
    const scope = p.scope || {}, item = p.item || {}, pref = p.preferences || {}, meta = p.metadata || {};
    const pieces = (Array.isArray(item.inventory) ? item.inventory : []).filter(x => x && Number.isInteger(x.count) && x.count > 0 && x.count < 200 && clip(x.item, 60));
    if (!pieces.length) throw new Error('pieces_required');
    const product = clip(item.subCategory, 160).split(' / ').pop() || clip(item.category, 80) || clip(item.department, 80) || clip(pieces[0].item, 60);
    const life = outcome === 'Lifestyle';
    const brief = {
      page: 'draft3',
      product: clip(product, 80),
      sku: clip(item.sku, 40),
      outcome,
      view: life ? clip(scope.view, 40) || 'Category template' : 'Category template',
      aspect: scope.aspect === 'standard' || !scope.aspect ? '1:1' : String(scope.aspect),
      resolution: '2K',
      lighting: life ? clip(pref.lighting, 40) : '',
      dimensions: clip(item.dimensions, 120),
      inventory: pieces.map(x => x.count + ' ' + clip(x.item, 60)).join('\n'),
      budgetUsd: 5,
      startType: 'product_collection',
      camera: life ? clip(scope.camera, 20) || 'Reference view' : 'Reference view',
      human: life && p.styling && p.styling.human === true ? 'yes' : 'no',
      studioChoice: life && pref.useWorkflowDefaults === true ? 'yes' : 'no',
      wallPaint: life ? clip(pref.wallPaint, 20) : '',
      floor: life ? clip(pref.floor, 20) : '',
      color: clip(meta.color, 60),
      material: clip(meta.material, 80),
      locks: lines(meta.locks, 160, 12),
      mustNot: lines(meta.must_not, 80, 12),
      department: clip(item.department, 80),
      category: clip(item.category, 80),
      subCategory: clip(item.subCategory, 160),
      description: clip(item.description, 1200)
    };
    return brief;
  }

  /* The text the owner saves as the version's direction. The backend requires one, and it must be identical at submission. */
  const NO_INSTRUCTIONS = 'No additional instructions.';
  const noteOf = p => clip(p && p.instructions, 1200) || NO_INSTRUCTIONS;

  /* ------------------------------------------------------------------ owner job -> midas-result/1
     The owner page reads the same contract as the client draft, so every Draft 3 label rule still holds:
     "Approved" only from a recorded owner decision; a package is complete only when A7 records it. */
  const DONE = { 'White background': ['white_package_ready', 'completed', 'delivered'], Lifestyle: ['completed', 'delivered'] };
  const STOPPED = ['stopped', 'stopped_by_owner', 'cancelled'];
  const FAILED = ['failed', 'failed_not_started', 'refused', 'invalid_input'];
  const GATES = { awaiting_go_1: 'go1', awaiting_go_2: 'go2' };
  const validDate = v => typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '';

  function approvalLabel(job) {
    const d = job && job.decisions && job.decisions.go2 ? job.decisions.go2 : {};
    if (d.decision === 'approve') return 'Approved';
    if (d.decision === 'approve_unreviewed') return 'Approved by the studio';
    return '';
  }

  /* run: what the page fixed when it sent (planned images, outcome). job: GET /api/owner/jobs/:id -> job. context: the open ticket or null. */
  function toResult(run, job, context) {
    const planned = Array.isArray(run && run.planned) && run.planned.length ? run.planned : [{ role: 'catalogue', camera: '', light: '' }];
    const outcome = run && run.outcome === 'White BK' ? 'White background' : 'Lifestyle';
    const base = img => ({ slot: 0, output_id: img.role, role: img.role, camera: img.camera || '', light: img.light || '', state: 'in_production', reason: '', note: '', image_url: '', client_shown_as: '', decided_at: '', checks: [] });
    const out = { contract: 'midas-result/1', found: true, state: 'not_finished', client_run_id: run ? run.id : '', images_planned: planned.length, package: { kind: outcome === 'White background' ? 'white_bk' : 'lifestyle', complete: false, website_views: null, limitations: [], catalogue: [] }, images: [], summary: '' };
    const owner = { status: '', stage: '', gate: null, attention: false, context: null, runId: '' };
    out.owner = owner;
    if (!job) { out.images = planned.map((img, i) => Object.assign(base(img), { slot: i + 1 })); owner.waitingForRecord = true; return out; }
    const status = String(job.status || '');
    owner.status = status; owner.stage = String(job.stage || ''); owner.runId = String(job.id || '');
    out.summary = clip(job.summary, 800);
    const images = planned.map((img, i) => Object.assign(base(img), { slot: i + 1 }));
    const label = approvalLabel(job), decidedAt = validDate(job.decisions && job.decisions.go2 && job.decisions.go2.at) || validDate(job.updatedAt);

    if (GATES[status]) {
      owner.gate = GATES[status]; owner.attention = true;
      owner.context = context && context.gate === owner.gate ? context : null;
      if (owner.gate === 'go2') {
        // Lifestyle: once the white catalogue image is approved, the next image decision is for the first scene image.
        const at = outcome === 'Lifestyle' && label && decidedAt && images.length > 1 ? 1 : 0;
        if (at) Object.assign(images[0], { state: 'approved', client_shown_as: label, decided_at: decidedAt });
        const passed = owner.context && /pass/i.test(String(owner.context.review && owner.context.review.result || ''));
        images[at].state = passed ? 'passed_checks' : 'on_hold';
        images[at].reason = passed ? '' : 'The automatic review did not pass this image. Your decision is needed.';
        images[at].link = owner.context && owner.context.candidate ? owner.context.candidate : '';
      }
    } else if (status === 'hold') {
      owner.attention = true;
      images.forEach(img => { img.state = 'on_hold'; img.reason = out.summary || 'The studio put this job on hold.'; });
    } else if ((DONE[outcome] || []).includes(status)) {
      out.state = 'finished';
      out.finished_at = validDate(job.updatedAt);
      images.forEach(img => {
        if (label && decidedAt) { img.state = 'approved'; img.client_shown_as = label; img.decided_at = decidedAt; }
        else { img.state = 'passed_checks'; }
      });
      out.package.complete = !!label;
      out.package.limitations = ['The approved files are saved privately with the job. This page does not show them yet.'];
    } else if (STOPPED.includes(status)) {
      out.state = 'finished';
      images.forEach(img => { img.state = 'not_approved'; img.note = out.summary || 'This job was stopped.'; img.decided_at = validDate(job.updatedAt); });
    } else if (FAILED.includes(status)) {
      out.state = 'finished';
      images.forEach(img => { img.state = 'not_made'; img.reason = out.summary || 'The studio could not make this image.'; });
    } else if (outcome === 'Lifestyle' && ['white_master_approved', 'white_package_ready', 'scene_due', 'scene_preparing', 'scene_room_ready', 'scene_approved'].includes(status)) {
      // The white catalogue image is decided first; the scene images are still being made.
      if (label && decidedAt) Object.assign(images[0], { state: 'approved', client_shown_as: label, decided_at: decidedAt });
    }
    out.images = images;
    return out;
  }

  /* The decisions a ticket may offer, in plain owner words (no internal step names). */
  const DECISIONS = {
    go: 'Approve the plan', change: 'Ask for plan changes', stop: 'Stop this job',
    approve: 'Approve the image', repair: 'Ask for one repair', review_again: 'Review the image again', approve_unreviewed: 'Approve it as it is, by eye'
  };

  const api = { toOwnerBrief, noteOf, toResult, DECISIONS, NO_INSTRUCTIONS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MIDAS_OWNER_LINK = api;
})(typeof window === 'object' ? window : globalThis);
