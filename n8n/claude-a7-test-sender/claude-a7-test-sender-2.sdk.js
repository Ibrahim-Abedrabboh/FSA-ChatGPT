import { workflow, node, trigger, switchCase, expr } from '@n8n/workflow-sdk';

// Claude · A7 test sender 2 (17 Oct 2026). Copy of the repo export of "Claude · A7 test sender" (16 Oct, archived) for Phase 4.
// Changes: Test 8 photo and facts, job ids claude-a7-p4-YYYYMMDD-<product>-NN, the brief named by the owner (one of two),
// and the go 2 decisions added by D3 (review_again, approve_unreviewed). Unpublished helper.
// It sends the job (with the Test 8 photo from Drive) and the owner's go 1 / go 2 answers to A7's real addresses,
// using the header credentials already stored in n8n, so no key is typed, seen or saved anywhere.
// It sends only what the owner decided in the chat; it never decides.
const input = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Sender input',
    parameters: { httpMethod: 'POST', path: 'claude-a7-test-sender-2', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
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
    name: 'Download Test 8 photo',
    parameters: { resource: 'file', operation: 'download', fileId: { __rl: true, mode: 'id', value: '1wqXIWE7v1GKIUJJ2nthpzX3biLSbR67Y' }, options: { binaryPropertyName: 'files' } },
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
      jsCode: `// The job as the A7 page sends it. Facts come from the owner's truth sheet (Test 8, confirmed): the bed only (1 piece),
// an upholstered bed with light grey-oatmeal headboard and footboard and walnut posts and frame. Nightstands, lamps, rug, bedding and
// cushions in the photo are context, not product. Material: not confirmed (left empty). No excluded pieces.
// The brief is the one the owner names in the chat (Phase 4, 17 Oct 2026): "website" (white master, hero, wide, detail) or
// "lifestyle_wide_closeup" (white master, wide, detail). Daylight, no person. Anything else is refused.
const b = $('Sender input').first().json.body || {};
const id = String(b.job_id || '');
if (!/^claude-a7-p4-\\d{8}-[a-z0-9]{2,20}-\\d{2}$/.test(id)) throw new Error('job_id must look like claude-a7-p4-YYYYMMDD-<product>-NN');
const BRIEFS = {
  website: { outcome: 'Website', outcomes: ['Website'], view: 'Category template' },
  lifestyle_wide_closeup: { outcome: 'Lifestyle', outcomes: ['Lifestyle'], view: 'Wide view + close-up' }
};
const brief = BRIEFS[String(b.brief || '')];
if (!brief) throw new Error('brief must be website or lifestyle_wide_closeup, as the owner named it in the chat');
const item = $input.first();
const payload = {
  job: brief.outcome === 'Website' ? 'website' : 'lifestyle', jobMode: 'new_project', workOn: 'one_by_one',
  scope: { outcome: brief.outcome, outcomes: brief.outcomes, view: brief.view, camera: 'Reference view', series: 'Single image', aspect: '1:1', resolution: '2K' },
  item: { department: 'Bedroom', category: 'Beds', productType: 'bed', referenceType: 'Product / vendor reference',
    inventory: [{ item: 'bed', count: 1 }], exclusions: [] },
  preferences: { lighting: 'Daylight', people: 'none', useWorkflowDefaults: false },
  styling: { plants: false, human: false },
  metadata: { product_category: 'Bed', color: 'light grey-oatmeal fabric; walnut wood', material: '',
    locks: [], must_not: ['the nightstands, lamps, rug, bedding and cushions of the vendor photo as product pieces (they are room context, not part of the product)'] },
  references: [{ name: (item.binary && item.binary.files && item.binary.files.fileName) || 'main.jpg', role: 'Product / vendor reference' }],
  clientRunId: id
};
return [{ json: { payload: JSON.stringify(payload), job_id: id, brief: String(b.brief) }, binary: item.binary }];`
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
if (['go', 'change', 'stop', 'approve', 'repair', 'review_again', 'approve_unreviewed'].indexOf(d) === -1) throw new Error('decision must be go, change, stop, approve, repair, review_again or approve_unreviewed');
if (!/^claude-a7-p4-/.test(String(b.id || ''))) throw new Error('id must be a claude-a7-p4- job');
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

export default workflow('claude-a7-test-sender-2', 'Claude · A7 test sender 2')
  .add(input)
  .to(route
    .onCase(0, download.to(buildJob.to(sendJob)))
    .onCase(1, buildDecision.to(sendDecision)));
