// Owner Overview: pure rules that turn the recorded saved versions and A7 jobs into the Overview's numbers and lists.
// The status groups, dispatch states, job matching and job names are the same rules Saved work and Jobs use in
// start-connected.js (tests/overview.test.mjs checks they stay identical), so a number here always matches the
// same number there. Nothing is estimated: a count is only of records the owner APIs returned.
(root => {
  const ATTENTION = new Set(['hold', 'needs_attention', 'needs_owner_action', 'needs_review', 'blocked', 'failed', 'failure', 'error', 'outcome_unknown', 'pending_or_uncertain', 'stale', 'waiting_for_owner']);
  const PROGRESS = new Set(['queued', 'processing', 'in_progress', 'running', 'started', 'submitted', 'received', 'working', 'active']);
  const DONE = new Set(['completed', 'complete', 'succeeded', 'success', 'done']);
  const DISPATCH = { draft: ['draft', 'Draft', 'other'], confirmed: ['progress', 'Sent · receipt not recorded', 'progress'], sending: ['progress', 'Sent · receipt not recorded', 'progress'], received: ['progress', 'Received by A7', 'progress'], outcome_unknown: ['attention', 'Outcome unknown', 'attention'] };
  const CATEGORY_SINGULAR = { OFF: 'office piece', LGT: 'light', TEX: 'textile', DIN: 'dining piece', BED: 'bedroom piece', SOF: 'sofa', CHR: 'chair', TAB: 'table', STO: 'storage piece', ACC: 'accessory', GEN: 'product' };

  const statusGroup = value => { const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); return ATTENTION.has(key) ? 'attention' : PROGRESS.has(key) ? 'progress' : DONE.has(key) ? 'done' : 'other'; };
  const dispatchGroup = value => { const key = String(value || '').trim().toLowerCase(); return DISPATCH[key]?.[0] || (ATTENTION.has(key) ? 'attention' : 'other'); };
  const dispatchLabel = value => { const key = String(value || '').trim().toLowerCase(); return DISPATCH[key]?.[1] || (value ? String(value).replace(/_/g, ' ') : 'State not recorded'); };
  const isEdited = version => !!version.parent_id || version.brief?.routeIntent === 'edit';
  const looksLikeFile = value => /^[\w.\-]{1,60}$/.test(value) && /\d/.test(value) && !/\s/.test(value);
  const unnamed = version => 'Unnamed ' + (CATEGORY_SINGULAR[version.case_category] || 'product');
  const productName = version => { const value = String(version.case_title || version.title || '').trim(); if (!value) return unnamed(version); return looksLikeFile(value) ? `${unnamed(version)} · file ${value}` : value; };
  const versionLabel = version => `v${version.version ?? '?'}${isEdited(version) ? ' · Edited' : ''}`;
  const refLabel = version => version.case_ref ? `${version.case_ref} ${versionLabel(version)}` : versionLabel(version);
  const versionName = version => version.case_ref ? refLabel(version) : productName(version) + ' · ' + versionLabel(version);

  // A saved version's job: exactly one loaded job with its run ID (or owner request ID). None, or more than one, is no match.
  function jobMatch(version, jobs) {
    const runId = version.run_id, clientId = version.client_run_id;
    const matches = runId ? jobs.filter(job => job.id === runId && (!clientId || !job.clientId || job.clientId === clientId)) : clientId ? jobs.filter(job => job.clientId === clientId) : [];
    return matches.length === 1 ? matches[0] : null;
  }
  const savedGroup = (version, jobs) => { const job = jobMatch(version, jobs); return job ? statusGroup(job.status) : dispatchGroup(version.dispatch_state); };
  const versionForJob = (job, records) => records.find(version => version.version_id && (version.client_run_id && version.client_run_id === job.clientId || 'owner-' + version.version_id === job.clientId || version.run_id && version.run_id === job.id));

  // Job names follow Jobs: the saved version's reference and version, "· Run N" when a version ran more than once
  // (in the order A7 created the runs), or "Unlinked job · <start time>" when no loaded version matches.
  function nameJobs(jobs, records) {
    const names = new Map(), groups = new Map();
    jobs.forEach((job, index) => { const version = versionForJob(job, records); if (!version) return; names.set(job.id, { version }); const list = groups.get(version.version_id) || []; list.push({ id: job.id, index, at: Date.parse(job.createdAt || '') }); groups.set(version.version_id, list); });
    for (const list of groups.values()) { if (list.length < 2) continue; list.sort((a, b) => (Number.isFinite(a.at) ? a.at : Infinity) - (Number.isFinite(b.at) ? b.at : Infinity) || a.index - b.index); list.forEach((entry, i) => { names.get(entry.id).run = i + 1; }); }
    return names;
  }
  function jobName(job, names, when) {
    const known = names.get(job.id), version = known?.version;
    if (version) return { version, title: `${versionName(version)}${known.run ? ' · Run ' + known.run : ''}`, product: version.case_ref ? productName(version) : '' };
    return { version: null, title: `Unlinked job · ${when(job.createdAt) || 'start time unrecorded'}`, product: '' };
  }
  const time = value => { const at = Date.parse(value || ''); return Number.isFinite(at) ? at : -Infinity; };
  const latestFirst = (a, b) => time(b.updatedAt || b.updated_at || b.createdAt || b.created_at) - time(a.updatedAt || a.updated_at || a.createdAt || a.created_at);

  // The Overview: three counts (the same groups as the Saved work tiles), up to two items that need the owner,
  // and the latest jobs. jobs is null when the job queue could not be read; counts then use the saved states only.
  function overview(records, jobs, { when = () => '', attentionLimit = 2, recentLimit = 5 } = {}) {
    const list = Array.isArray(jobs) ? jobs : [];
    const groups = records.map(version => ({ version, job: jobMatch(version, list), group: savedGroup(version, list) }));
    const count = group => groups.filter(entry => entry.group === group).length;
    const names = nameJobs(list, records);
    const attentionVersions = groups.filter(entry => entry.group === 'attention').sort((a, b) => latestFirst(a.job || a.version, b.job || b.version));
    const linked = new Set(groups.map(entry => entry.job?.id).filter(Boolean));
    // Every other job that needs the owner is listed too (named as in Jobs), so none is dropped from the list.
    const otherAttention = list.filter(job => statusGroup(job.status) === 'attention' && !linked.has(job.id));
    const attention = [
      ...attentionVersions.map(({ version, job }) => ({
        title: versionName(version) + (job && names.get(job.id)?.run ? ' · Run ' + names.get(job.id).run : ''),
        product: version.case_ref ? productName(version) : '',
        detail: job ? [job.stage || 'Stage not recorded', String(job.status || 'status unknown').replace(/_/g, ' ')].join(' · ') : dispatchLabel(version.dispatch_state),
        status: job ? job.status : version.dispatch_state,
        group: 'attention',
        jobId: job ? job.id : null,
        at: job?.updatedAt || version.updated_at || version.created_at || '',
      })),
      ...otherAttention.sort(latestFirst).map(job => { const named = jobName(job, names, when); return { title: named.title, product: named.product, detail: [job.stage || 'Stage not recorded', String(job.status || 'status unknown').replace(/_/g, ' ')].join(' · '), status: job.status, group: 'attention', jobId: job.id, at: job.updatedAt || '' }; }),
    ];
    const recent = [...list].sort(latestFirst).slice(0, recentLimit).map(job => { const named = jobName(job, names, when); return { title: named.title, product: named.product, stage: job.stage || 'Stage not recorded', status: job.status || '', group: statusGroup(job.status), jobId: job.id, at: job.updatedAt || job.createdAt || '' }; });
    return {
      metrics: { drafts: count('draft'), progress: count('progress'), attention: count('attention'), done: count('done'), versions: records.length },
      attention: attention.slice(0, attentionLimit),
      attentionMore: Math.max(0, attention.length - attentionLimit),
      recent,
      jobsTotal: list.length,
    };
  }
  const jobLink = id => '/owner/?job=' + encodeURIComponent(id) + '#jobsSection';

  root.MidasOverview = { statusGroup, dispatchGroup, dispatchLabel, productName, versionName, jobMatch, savedGroup, nameJobs, jobName, overview, jobLink, ATTENTION, PROGRESS, DONE, DISPATCH };
})(typeof window !== 'undefined' ? window : globalThis);
