import { workflow, node, trigger, switchCase, expr } from '@n8n/workflow-sdk';

// Claude · A7 test sender (16 Oct 2026). Unpublished helper for the owner's first paid A7 test.
// It sends the job (with the Test 10 photo from Drive) and the owner's go 1 / go 2 answers to A7's real addresses,
// using the header credentials already stored in n8n, so no key is typed, seen or saved anywhere.
// It sends only what the owner decided in the chat; it never decides.
const input = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Sender input',
    parameters: { httpMethod: 'POST', path: 'claude-a7-test-sender', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
    credentials: { httpHeaderAuth: { id: '4Tf3ryBWPtc1IkvG', name: 'Claude · Midas owner header' } }
  }
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'Job or decision?',
    parameters: {
      rules: {
        values: [
          { outputKey: 'job', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.body.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'job' }], combinator: 'and' } },
          { outputKey: 'decision', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.body.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'decision' }], combinator: 'and' } }
        ]
      },
      options: {}
    }
  }
});

const download = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download Test 10 photo',
    parameters: { resource: 'file', operation: 'download', fileId: { __rl: true, mode: 'id', value: '13jfgFtCxf2oM-VrtASEMqSgKX-svnp27' }, options: { binaryPropertyName: 'files' } },
    credentials: { googleDriveOAuth2Api: { id: 'NA6JT99b4IrTLmzl', name: 'Claude · Midas Drive' } }
  }
});

const buildJob = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build job',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// The job as the A7 page sends it. Facts come from the owner's truth sheet (Test 10, confirmed): 1 table + 6 chairs,
// olive-green fabric, walnut-brown wood; the Ashley logo is a watermark, not part of the product. Material: not confirmed (left empty).
const b = $('Sender input').first().json.body || {};
const id = String(b.job_id || '');
if (!/^claude-a7-live-[a-z0-9-]{4,60}$/.test(id)) throw new Error('job_id must start with claude-a7-live-');
const item = $input.first();
const payload = {
  job: 'lifestyle', jobMode: 'new_project', workOn: 'one_by_one',
  scope: { outcome: 'Lifestyle', outcomes: ['Lifestyle'], view: 'Wide view', camera: 'Reference view', series: 'Single image', aspect: '1:1', resolution: '2K', imageCount: 2 },
  item: { department: 'Dining', category: 'Dining sets', productType: 'dining set', referenceType: 'Product / vendor reference',
    inventory: [{ item: 'dining table', count: 1 }, { item: 'dining chair', count: 6 }], exclusions: [] },
  preferences: { lighting: 'Daylight', people: 'none', useWorkflowDefaults: false },
  styling: { plants: false, human: false },
  metadata: { product_category: 'Dining set', color: 'olive-green fabric; walnut-brown wood', material: '',
    locks: [], must_not: ['the vendor logo in the corner of the photo (a watermark, not part of the product)'] },
  references: [{ name: (item.binary && item.binary.files && item.binary.files.fileName) || 'main.jpg', role: 'Product / vendor reference' }],
  clientRunId: id
};
return [{ json: { payload: JSON.stringify(payload), job_id: id }, binary: item.binary }];`
    }
  }
});

const sendJob = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Send job to A7',
    parameters: {
      method: 'POST',
      url: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-a7',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [
        { parameterType: 'formData', name: 'payload', value: expr('{{ $json.payload }}') },
        { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'files' }
      ] },
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 }
    },
    credentials: { httpHeaderAuth: { id: 'mbZqYVn5TGqhMf2C', name: 'Claude · Midas client header' } }
  }
});

const buildDecision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build decision',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Only the owner's answer, as given in the chat, with the ids printed on the ticket. Nothing else is added.
const b = $input.first().json.body || {};
const d = String(b.decision || '').toLowerCase();
if (['go', 'change', 'stop', 'approve', 'repair'].indexOf(d) === -1) throw new Error('decision must be go, change, stop, approve or repair');
if (!/^claude-a7-live-/.test(String(b.id || ''))) throw new Error('id must be a claude-a7-live- job');
const out = { id: String(b.id), run_id: String(b.run_id || ''), round: Number(b.round), decision: d, note: String(b.note || '') };
if (Array.isArray(b.changes) && b.changes.length) out.changes = b.changes;
return [{ json: { answer: out } }];`
    }
  }
});

const sendDecision = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Send decision to A7',
    parameters: {
      method: 'POST',
      url: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-a7-decision',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.answer) }}'),
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 }
    },
    credentials: { httpHeaderAuth: { id: '4Tf3ryBWPtc1IkvG', name: 'Claude · Midas owner header' } }
  }
});

export default workflow('claude-a7-test-sender', 'Claude · A7 test sender')
  .add(input)
  .to(route
    .onCase(0, download.to(buildJob.to(sendJob)))
    .onCase(1, buildDecision.to(sendDecision)));
