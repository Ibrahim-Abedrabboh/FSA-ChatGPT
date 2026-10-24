// Claude · Midas job status
// PROPOSED, NOT YET CREATED IN n8n (4 October 2026).
// A small second workflow. The job form asks it "is run <id> finished?" and it answers from the run log.
// It reads the data table "Claude job runs" and makes no model call, so it costs no image or text credit.
// It needs the result-channel version of the main workflow, which saves image_url and checks in the log.
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const statusWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Job status webhook',
    parameters: {
      httpMethod: 'GET',
      path: 'claude-midas-job-status',
      authentication: 'none',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' },
    },
  },
  output: [{ query: { id: '4f8b89d2-ee7c-4312-a0ba-6e4f663c9c7f' } }],
});

const findRun = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find finished run',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ku3kwvpN6tGqeoBN', cachedResultName: 'Claude job runs' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'client_run_id', condition: 'eq', keyValue: expr('{{ $json.query.id || "none" }}') },
          { keyName: 'stage', condition: 'eq', keyValue: 'finished' },
        ],
      },
      returnAll: false,
      limit: 1,
      orderBy: true,
      orderByColumn: 'createdAt',
      orderByDirection: 'DESC',
    },
  },
  output: [{ id: 15, run_id: 'job-2026-10-04T12-34-45-203Z', client_run_id: '4f8b89d2-ee7c-4312-a0ba-6e4f663c9c7f', stage: 'finished', status: 'reviewed_candidate', images_made: 1, summary: 'run card text', image_url: 'https://v3.fal.media/files/example/render.png', checks: '[["inventory_count","pass","looked"]]', createdAt: '2026-10-04T12:35:35.955Z' }],
});

const statusReply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Status reply',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const asked = $('Job status webhook').first().json.query || {};
const id = String(asked.id || '').trim();
const first = $input.first();
const row = first && first.json ? first.json : {};
const idLooksReal = id.length >= 8 && id.length <= 80;
const match = idLooksReal && row.client_run_id === id && row.stage === 'finished';
if (!match) {
  return [{ json: { found: false, state: 'not_finished' } }];
}
let checks = [];
try {
  const parsed = JSON.parse(row.checks || '[]');
  checks = Array.isArray(parsed) ? parsed : [];
} catch (e) {
  checks = [];
}
return [{
  json: {
    found: true,
    state: 'finished',
    run_id: row.run_id || '',
    status: row.status || '',
    images_made: Number(row.images_made) || 0,
    image_url: row.image_url || '',
    checks: checks,
    summary: row.summary || '',
    product_file: row.product_file || '',
    finished_at: row.createdAt || ''
  }
}];`,
    },
  },
  output: [{ found: true, state: 'finished', run_id: 'job-2026-10-04T12-34-45-203Z', status: 'reviewed_candidate', images_made: 1, image_url: 'https://v3.fal.media/files/example/render.png', checks: [['inventory_count', 'pass', 'looked']], summary: 'run card text' }],
});

const sendStatus = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Send status',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ JSON.stringify($json) }}'),
      options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } },
    },
  },
  output: [{}],
});

export default workflow('claude-midas-job-status', 'Claude · Midas job status')
  .add(statusWebhook)
  .to(findRun)
  .to(statusReply)
  .to(sendStatus);
