import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

// Claude · Midas A7 reader test 3 (D13 prompts), 16 Oct 2026. Unpublished; manual trigger only. PAID when run.
// Code and prompt texts are set right after creation with exact copies from the repo (n8n/claude-midas-a7-reader-test-3).
const start = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Start reader test 3' } });
const DRIVE = { googleDriveOAuth2Api: { id: 'NA6JT99b4IrTLmzl', name: 'Claude · Midas Drive' } };
const GEMINI = { googlePalmApi: { id: 'g0WJ658hQMZWuEHU', name: 'Google Gemini(PaLM) Api account' } };
const OPENAI = { openAiApi: { id: 'WRK3A2qOkVQ5do9I', name: 'OpenAI account' } };
const ANTHROPIC = { anthropicApi: { id: '3RFaZDH3xCJ3rM63', name: 'Anthropic account' } };
const SET_LATER = 'return $input.all();';

const config = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Config', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

const findFolders = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Find test folders', credentials: DRIVE,
  parameters: { resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr("'{{ $json.testing_folder }}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"), returnAll: true, filter: {}, options: { fields: ["id", "name"] } } } });

const findPhoto = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Find main photo', credentials: DRIVE, alwaysOutputData: true,
  parameters: { resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr("'{{ $json.id }}' in parents and trashed = false"), returnAll: true, filter: {}, options: { fields: ["*"] } } } });

const pair = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Pair photos with folders', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

const download = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Download photo', credentials: DRIVE,
  parameters: { resource: 'file', operation: 'download', fileId: { __rl: true, mode: 'id', value: expr('{{ $json.file_id }}') }, options: { binaryPropertyName: 'data' } } } });

const gemini = node({ type: '@n8n/n8n-nodes-langchain.googleGemini', version: 1.2, config: { name: 'Gemini photo reader', credentials: GEMINI,
  alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
  parameters: { resource: 'image', operation: 'analyze', modelId: { __rl: true, mode: 'id', value: 'models/gemini-3.8-flash' }, text: 'set later', inputType: 'binary', binaryPropertyName: 'data', simplify: false, options: { maxOutputTokens: 16000 } } } });

const restore1 = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Photo again for OpenAI', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

const gpt = node({ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: { name: 'OpenAI photo reader', credentials: OPENAI,
  alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  parameters: { resource: 'image', operation: 'analyze', modelId: { __rl: true, mode: 'id', value: 'gpt-6.1-sol' }, text: 'set later', inputType: 'base64', binaryPropertyName: 'data', simplify: false, options: { detail: 'high', maxTokens: 16000 } } } });

const restore2 = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Photo again for Claude', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

const sonnet = node({ type: '@n8n/n8n-nodes-langchain.anthropic', version: 1, config: { name: 'Claude second count', credentials: ANTHROPIC,
  alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  parameters: { resource: 'image', operation: 'analyze', modelId: { __rl: true, mode: 'id', value: 'claude-sonnet-5-5' }, text: 'set later', inputType: 'binary', binaryPropertyName: 'data', simplify: false, options: { maxTokens: 1500 } } } });

const score = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Score against the truth sheet', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: SET_LATER } } });

export default workflow('claude-midas-a7-reader-test-3', 'Claude · Midas A7 reader test 3 (D13 prompts)')
  .add(start).to(config.to(findFolders.to(findPhoto.to(pair.to(download.to(gemini.to(restore1.to(gpt.to(restore2.to(sonnet.to(score)))))))))));
