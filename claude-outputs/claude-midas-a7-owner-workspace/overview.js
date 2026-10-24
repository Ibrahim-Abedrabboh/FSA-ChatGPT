// Owner Overview page: reads saved work (/api/owner/projects) and the recorded A7 job queue (/api/owner/jobs) and shows
// three counts, up to two items that need the owner, and the latest jobs. Read-only: it never saves, analyses, estimates,
// sends or approves anything. The counting and naming rules live in overview-model.js.
(() => {
  const $ = id => document.getElementById(id);
  const model = window.MidasOverview;
  const make = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const when = value => { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); } catch { return date.toISOString(); } };
  let left = false;
  const leave = () => { if (left) return; left = true; try { window.location.replace('/'); } catch {} };

  async function request(path, options = {}) {
    const response = await fetch(path, { cache: 'no-store', ...options });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (response.status === 401) { leave(); throw Object.assign(Error('signed_out'), { status: 401 }); }
    if (!response.ok) throw Object.assign(Error(data?.error || `Request failed (${response.status})`), { status: response.status });
    return data && typeof data === 'object' ? data : {};
  }

  // The same paging and checks as Jobs: up to 20 pages of 50, stopping on any malformed page.
  async function loadJobs() {
    const all = [], ids = new Set(); let offset = 0;
    for (let page = 0; page < 20; page++) {
      const data = await request('/api/owner/jobs?offset=' + offset);
      if (!Array.isArray(data.jobs) || data.jobs.length > 50 || !Number.isSafeInteger(data.total) || data.total > 1000) throw Error('invalid_job_page');
      for (const job of data.jobs) if (job?.id && !ids.has(job.id)) { ids.add(job.id); all.push(job); }
      if (data.nextOffset === null || data.nextOffset === undefined) return { jobs: all, asOf: data.asOf || '' };
      if (!Number.isSafeInteger(data.nextOffset) || data.nextOffset <= offset) throw Error('invalid_job_page');
      offset = data.nextOffset;
    }
    throw Error('job_pages_incomplete');
  }

  const BADGE_TEXT = { attention: 'Needs attention', progress: 'In progress', done: 'Completed', draft: 'Draft', other: 'Other' };
  function badge(status, group) {
    const node = make('span', status ? String(status).replace(/_/g, ' ') : 'state unknown', 'badge is-' + (group === 'draft' ? 'other' : group));
    node.title = BADGE_TEXT[group] || '';
    return node;
  }
  function openLink(item) {
    const link = make('a', item.jobId ? 'Open job' : 'Open in Saved work', 'text-link');
    link.href = item.jobId ? model.jobLink(item.jobId) : '/owner/#savedWorkSection';
    link.append(make('span', ' · ' + item.title, 'sr-only'));
    return link;
  }
  function row(item, detail) {
    const li = make('li', undefined, 'item');
    const main = make('div', undefined, 'item-main');
    main.append(make('strong', item.title, 'item-title'));
    const sub = [item.product, detail].filter(Boolean).join(' · ');
    if (sub) main.append(make('span', sub, 'item-sub'));
    li.append(main, badge(item.status, item.group), openLink(item));
    return li;
  }
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  const show = (id, visible) => { const node = $(id); if (node) node.hidden = !visible; };

  function render({ records, jobs, recordsError, jobsError, asOf }) {
    const data = model.overview(records || [], jobsError ? null : jobs, { when });
    if (recordsError) { setText('metricDrafts', '—'); setText('metricProgress', '—'); setText('metricAttention', '—'); }
    else { setText('metricDrafts', String(data.metrics.drafts)); setText('metricProgress', String(data.metrics.progress)); setText('metricAttention', String(data.metrics.attention)); }
    $('metricAttentionBox')?.classList?.toggle('is-attention', !recordsError && data.metrics.attention > 0);

    const attention = $('attentionList');
    // Without saved work every job would look unlinked, so the list waits for saved work instead of guessing names.
    attention.replaceChildren(...(recordsError ? [] : data.attention).map(item => row(item, [item.detail, when(item.at)].filter(Boolean).join(' · '))));
    show('attentionEmpty', !data.attention.length && !recordsError);
    if (recordsError) { show('attentionEmpty', true); setText('attentionEmpty', 'Saved work is unavailable, so items that need you cannot be listed. Refresh to try again.'); }
    else setText('attentionEmpty', jobsError ? 'No saved version needs you. Job statuses could not be read, so this uses saved states only.' : 'Nothing needs you right now.');
    show('attentionMore', !recordsError && data.attentionMore > 0);
    setText('attentionMore', data.attentionMore ? `${data.attentionMore} more in Jobs and Saved work.` : '');

    const recent = $('recentList');
    const recentItems = recordsError ? data.recent.map(item => ({ ...item, title: item.title.startsWith('Unlinked job') ? 'A7 job · ' + (when(item.at) || 'time unrecorded') : item.title })) : data.recent;
    recent.replaceChildren(...recentItems.map(item => row(item, [item.stage, when(item.at) && 'updated ' + when(item.at)].filter(Boolean).join(' · '))));
    show('recentEmpty', !recentItems.length);
    setText('recentEmpty', jobsError ? 'Jobs are unavailable. Refresh to try again.' : 'No A7 jobs are recorded yet.');

    const notes = [];
    if (recordsError) notes.push('Saved work is unavailable.');
    if (jobsError) notes.push('Jobs are unavailable' + (recordsError ? '.' : '; counts use saved states only.'));
    if (!recordsError && !jobsError) notes.push(`${data.metrics.versions} saved version${data.metrics.versions === 1 ? '' : 's'} · ${data.jobsTotal} recorded job${data.jobsTotal === 1 ? '' : 's'}${asOf && when(asOf) ? ' · jobs updated ' + when(asOf) : ''}`);
    setText('overviewStatus', notes.join(' '));
  }

  let loading = false;
  async function load() {
    if (loading) return; loading = true;
    const button = $('refreshOverview'); if (button) button.disabled = true;
    setText('overviewStatus', 'Loading saved work and jobs…');
    const [projects, queue] = await Promise.allSettled([request('/api/owner/projects'), loadJobs()]);
    if (projects.status === 'rejected' && projects.reason?.status === 401 || queue.status === 'rejected' && queue.reason?.status === 401) { loading = false; return; }
    render({
      records: projects.status === 'fulfilled' && Array.isArray(projects.value.records) ? projects.value.records : [],
      recordsError: projects.status === 'rejected' || !Array.isArray(projects.value?.records),
      jobs: queue.status === 'fulfilled' ? queue.value.jobs : [],
      jobsError: queue.status === 'rejected',
      asOf: queue.status === 'fulfilled' ? queue.value.asOf : '',
    });
    loading = false; if (button) button.disabled = false;
  }

  async function start() {
    try { await request('/api/owner/me'); } catch { leave(); return; }
    $('refreshOverview')?.addEventListener('click', load);
    $('signOut')?.addEventListener('click', async () => {
      const button = $('signOut'); button.disabled = true;
      try { const response = await fetch('/api/logout', { method: 'POST' }); if (!response.ok) throw Error(); leave(); }
      catch { button.textContent = 'Retry sign out'; button.disabled = false; }
    });
    await load();
  }
  window.midasOverviewReady = start();
})();
