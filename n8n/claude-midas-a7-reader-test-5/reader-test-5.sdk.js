import { workflow, node, trigger, expr, ifElse, splitInBatches, nextBatch } from '@n8n/workflow-sdk';

// Claude · Midas A7 reader test 5, 21 Oct 2026. Unpublished; manual trigger only. PAID when run.
// A copy of reader test 4 (Ouf9Th4Xbg2hSa4u, version 6a59c8b2): same Drive photos, model (gpt-6.1-sol), detail, output cap, tries and budget loop.
// Only the reader prompt changes: prompt v3, the text live on the photo check since 19 Oct 2026; plus the run-id prefix (claude-rt5-).
// Code and the prompt are set right after creation with exact copies from the repo (n8n/claude-midas-a7-reader-test-5).
// The reader is created DISABLED, with no prompt; it is enabled only for the owner's paid run (go given 21 Oct 2026, cap USD 1).
const start = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Start reader test 5' } });
const DRIVE = { googleDriveOAuth2Api: { id: 'NA6JT99b4IrTLmzl', name: 'Claude · Midas Drive' } };
const OPENAI = { openAiApi: { id: 'WRK3A2qOkVQ5do9I', name: 'OpenAI account' } };
const SET_LATER = 'return $input.all();';

const config = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Config', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });
const findFolders = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Find test folders', credentials: DRIVE,
  parameters: { resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr("'{{ $json.testing_folder }}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"), returnAll: true, filter: {}, options: { fields: ["id", "name"] } } } });
const findPhoto = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Find main photo', credentials: DRIVE, alwaysOutputData: true,
  parameters: { resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr("'{{ $json.id }}' in parents and trashed = false"), returnAll: true, filter: {}, options: { fields: ["*"] } } } });
const pair = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Pair photos with folders', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });
const download = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Download photo', credentials: DRIVE,
  parameters: { resource: 'file', operation: 'download', fileId: { __rl: true, mode: 'id', value: expr('{{ $json.file_id }}') }, options: { binaryPropertyName: 'data' } } } });
const loop = splitInBatches({ version: 3, config: { name: 'Loop photos', parameters: { batchSize: 1, options: {} } } });
const budget = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Budget check', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });
const withinCap = ifElse({ version: 2.2, config: { name: 'Within the cap?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: [{ id: 'cap-ok', leftValue: expr('{{ $json.budget.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: true }],
  combinator: 'and' }, options: {} } } });
const reader = node({ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: { name: 'OpenAI photo reader', credentials: OPENAI, disabled: true,
  retryOnFail: true, maxTries: 2, waitBetweenTries: 5000, alwaysOutputData: false, onError: 'continueRegularOutput',
  parameters: { resource: 'image', operation: 'analyze', modelId: { __rl: true, mode: 'id', value: 'gpt-6.1-sol' }, text: 'PROMPT NOT SET: set from the repo right after creation (prompt v3), 21 Oct 2026',
    inputType: 'base64', binaryPropertyName: 'data', simplify: false, options: { detail: 'high', maxTokens: 6000 } } } });
const stoppedAtCap = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Stopped at cap', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });
const score = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Score against the truth sheet', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

export default workflow('claude-midas-a7-reader-test-5', 'Claude · Midas A7 reader test 5')
  .add(start).to(config).to(findFolders).to(findPhoto).to(pair).to(download)
  .to(loop
    .onDone(score)
    .onEachBatch(budget.to(withinCap
      .onTrue(reader.to(nextBatch(loop)))
      .onFalse(stoppedAtCap.to(score)))));
