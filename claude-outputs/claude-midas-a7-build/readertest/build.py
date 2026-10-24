import json, sys
sys.path.insert(0, '..')
from prompts import EYE, SECOND
J = lambda s: json.dumps(s)
def code(name, file, mode='runOnceForAllItems', pos=(0,0), extra=''):
    src = open('js/' + file).read()
    return f"node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: {J(name)}, parameters: {{ mode: '{mode}', language: 'javaScript', jsCode: {J(src)} }}, position: [{pos[0]}, {pos[1]}]{extra} }}, output: [{{}}] }})"
DRIVE = "{ googleDriveOAuth2Api: { id: 'NA6JT99b4IrTLmzl', name: 'Claude · Midas Drive' } }"
cols = ["run_id","folder","file_name","mime","eye_count","second_count","counts_agree","true_count","truth_confirmed","eye_vs_truth","second_vs_truth","excluded_seen","printed_counts","colour_observed","sided_parts","views_not_pieces","cropped","eye_raw","second_raw","problem","at"]
types = {"eye_count":"number","second_count":"number","counts_agree":"boolean","truth_confirmed":"boolean","cropped":"boolean"}
value = ", ".join(f"{c}: expr({J('{{ $json.' + c + ' }}')})" for c in cols)
schema = ", ".join(json.dumps({"id":c,"displayName":c,"required":False,"defaultMatch":False,"display":True,"type":types.get(c,"string"),"canBeUsedToMatch":True}) for c in cols)
ts = f"""import {{ workflow, node, trigger, sticky, ifElse, expr }} from '@n8n/workflow-sdk';

const start = trigger({{ type: 'n8n-nodes-base.manualTrigger', version: 1, config: {{ name: 'Start reader test', position: [0, 300] }}, output: [{{}}] }});
const config = {code('Config', 'config.js', pos=(220,300))};
const findFolders = node({{ type: 'n8n-nodes-base.googleDrive', version: 3, config: {{ name: 'Find test folders', parameters: {{ resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr({J("'{{ $json.testing_folder }}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false")}), returnAll: true, filter: {{}}, options: {{ fields: ['id', 'name'] }} }}, credentials: {DRIVE}, position: [440, 300] }}, output: [{{ id: 'f1', name: 'Test 1' }}] }});
const findPhotos = node({{ type: 'n8n-nodes-base.googleDrive', version: 3, config: {{ name: 'Find main photo', parameters: {{ resource: 'fileFolder', operation: 'search', searchMethod: 'query', queryString: expr({J("'{{ $json.id }}' in parents and trashed = false")}), returnAll: true, filter: {{}}, options: {{ fields: ['*'] }} }}, credentials: {DRIVE}, alwaysOutputData: true, position: [660, 300] }}, output: [{{ id: 'p1', name: 'main.jpg', mimeType: 'image/jpeg', parents: ['f1'] }}] }});
const pair = {code('Pair photos with folders', 'pair.js', pos=(880,300))};
const hasPhoto = ifElse({{ version: 2.2, config: {{ name: 'Photo found?', parameters: {{ conditions: {{ options: {{ caseSensitive: true, leftValue: '', typeValidation: 'loose' }}, conditions: [{{ leftValue: expr({J("{{ !!$json.file_id }}")}), operator: {{ type: 'boolean', operation: 'true', singleValue: true }} }}], combinator: 'and' }} }}, position: [1100, 300] }} }});
const download = node({{ type: 'n8n-nodes-base.googleDrive', version: 3, config: {{ name: 'Download photo', parameters: {{ resource: 'file', operation: 'download', fileId: {{ __rl: true, mode: 'id', value: expr({J("{{ $json.file_id }}")}) }}, options: {{ binaryPropertyName: 'data' }} }}, credentials: {DRIVE}, position: [1320, 220] }}, output: [{{ id: 'p1', name: 'main.jpg' }}] }});
const eye = node({{ type: '@n8n/n8n-nodes-langchain.googleGemini', version: 1.2, config: {{ name: 'First reader (blind)', parameters: {{ resource: 'image', operation: 'analyze', modelId: {{ __rl: true, mode: 'id', value: 'models/gemini-3.8-flash' }}, text: {J(EYE)}, inputType: 'binary', binaryPropertyName: 'data', simplify: true, options: {{ maxOutputTokens: 16000 }} }}, credentials: {{ googlePalmApi: {{ id: 'g0WJ658hQMZWuEHU', name: 'Google Gemini(PaLM) Api account' }} }}, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, position: [1540, 220] }}, output: [{{ content: {{ parts: [{{ text: '{{}}' }}] }} }}] }});
const keepEye = {code('Keep eye', 'keep_eye.js', mode='runOnceForEachItem', pos=(1760,220))};
const second = node({{ type: '@n8n/n8n-nodes-langchain.anthropic', version: 1, config: {{ name: 'Second count (blind)', parameters: {{ resource: 'image', operation: 'analyze', modelId: {{ __rl: true, mode: 'id', value: 'claude-sonnet-5-5' }}, text: {J(SECOND)}, inputType: 'binary', binaryPropertyName: 'data', simplify: true, options: {{ maxTokens: 1500 }} }}, credentials: {{ anthropicApi: {{ id: '3RFaZDH3xCJ3rM63', name: 'Anthropic account' }} }}, onError: 'continueRegularOutput', position: [1980, 220] }}, output: [{{ content: [{{ type: 'text', text: '{{}}' }}] }}] }});
const collect = {code('Collect results', 'collect.js', pos=(2200,300))};
const sheet = node({{ type: 'n8n-nodes-base.googleDrive', version: 3, config: {{ name: 'Download answer sheet', parameters: {{ resource: 'file', operation: 'download', fileId: {{ __rl: true, mode: 'id', value: expr({J("{{ $('Config').first().json.truth_sheet }}")}) }}, options: {{ binaryPropertyName: 'data', googleFileConversion: {{ conversion: {{ sheetsToFormat: 'text/csv' }} }} }} }}, credentials: {DRIVE}, executeOnce: true, position: [2420, 300] }}, output: [{{ id: 's1' }}] }});
const score = {code('Score against the answer sheet', 'score.js', pos=(2640,300))};
const save = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: 'Save results', parameters: {{ resource: 'row', operation: 'insert', dataTableId: {{ __rl: true, mode: 'id', value: 'U0quiuvjYjGt3HpZ', cachedResultName: 'Claude Midas A7 reader test' }}, columns: {{ mappingMode: 'defineBelow', value: {{ {value} }}, schema: [{schema}] }} }}, position: [2860, 300] }}, output: [{{ id: 1 }}] }});
const summary = {code('Summary', 'summary.js', pos=(3080,300))};
const note = sticky({J("## Claude · Midas A7 reader test\nReads every 'Test N' folder in Drive > Testing, runs the two blind counts (gemini-3.8-flash and claude-sonnet-5-5) on main.*, and scores them against the owner's answer sheet. The readers are never told the expected count.\nPAID when run for real: about $0.16 for 10 photos (estimate), at most about $0.45 (output token caps). Run only after the owner's go.\nResults: data table 'Claude Midas A7 reader test'. Run ids start with claude-rt-.")}, [], {{ color: 7, position: [0, 0], width: 720, height: 220 }});

export default workflow('claude-midas-a7-reader-test', 'Claude · Midas A7 reader test')
  .add(start)
  .to(config)
  .to(findFolders)
  .to(findPhotos)
  .to(pair)
  .to(hasPhoto.onTrue(download.to(eye.to(keepEye.to(second.to(collect))))))
  .add(collect)
  .to(sheet)
  .to(score)
  .to(save)
  .to(summary)
  .add(note);
"""
open('workflow.ts','w').write(ts)
print(len(ts))
