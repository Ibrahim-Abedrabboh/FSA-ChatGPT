import json
from prompts import EYE, SECOND, ROOM, CONFLICT
J = lambda s: json.dumps(s, ensure_ascii=False)
def code(f): return open('js/' + f, encoding='utf-8').read()

RUNS = 'l0roUCBwIQL3h9Eq'; VAULT = 'Tyn4UT6BmIYMHAYl'; PROFILES = 'KTTMJZ0Wh84cAyDm'
CRED_GEMINI = "{ googlePalmApi: { id: 'x4UVLy8NoFwtzu30', name: 'Google Gemini(PaLM) Api account' } }"
CRED_ANTH = "{ anthropicApi: { id: 'djyqAg9Cx4M3ztVp', name: 'Anthropic account' } }"
CRED_OAI = "{ openAiApi: { id: 'WRK3A2qOkVQ5do9I', name: 'OpenAI account' } }"
CRED_HDR = "{ httpHeaderAuth: { id: 'mbZqYVn5TGqhMf2C', name: 'Claude · Midas client header' } }"

def schema(cols):
    return '[' + ', '.join("{ id: %s, displayName: %s, required: false, defaultMatch: false, display: true, type: %s, canBeUsedToMatch: true }" % (J(c), J(c), J(t)) for c, t in cols) + ']'
def values(d):
    return '{ ' + ', '.join('%s: %s' % (k, v) for k, v in d.items()) + ' }'
def E(s): return "expr(%s)" % J(s)

RUN_COLS = [('run_id','string'),('client_run_id','string'),('parent_run_id','string'),('job_type','string'),('stage','string'),('status','string'),('hold_reason','string'),('client_question','string'),('outcomes','string'),('required_outputs','string'),('brief_version','number'),('contract_version','number'),('contract_stamp','string'),('references','string'),('observation','string'),('contract','string'),('not_applied','string'),('cost_estimate','string'),('trail','string'),('execution_id','string'),('received_at','string')]
VAULT_COLS = [('run_id','string'),('client_run_id','string'),('kind','string'),('stage','string'),('step','number'),('brief_version','number'),('contract_version','number'),('contract_stamp','string'),('ref','string'),('payload','string'),('actor','string'),('at','string')]

def codenode(var, name, f, pos, extra=''):
    return f"""const {var} = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: {J(name)}, parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: {J(code(f))} }}, position: {pos}{extra} }}, output: [{{ run_id: 'claude-a7-x', client_run_id: 'claude-test-0001' }}] }});\n"""

def ifnode(var, name, left, pos):
    return f"""const {var} = ifElse({{ version: 2.2, config: {{ name: {J(name)}, parameters: {{ conditions: {{ options: {{ caseSensitive: true, leftValue: '', typeValidation: 'loose' }}, conditions: [{{ leftValue: {E(left)}, operator: {{ type: 'boolean', operation: 'true', singleValue: true }} }}], combinator: 'and' }} }}, position: {pos} }} }});\n"""

S = "import { workflow, node, trigger, sticky, ifElse, merge, expr } from '@n8n/workflow-sdk';\n\n"
S += f"""const jobWebhook = trigger({{ type: 'n8n-nodes-base.webhook', version: 2.1, config: {{ name: 'A7 job webhook', parameters: {{ httpMethod: 'POST', path: 'claude-midas-a7', authentication: 'headerAuth', responseMode: 'responseNode', options: {{ allowedOrigins: '*' }} }}, credentials: {CRED_HDR}, position: [0, 400] }}, output: [{{ body: {{ payload: '{{}}' }} }}] }});\n"""
S += codenode('intent', '01 Intent & scope', '01_intent.js', '[220, 400]')
S += codenode('ingest', '02 Ingest files', '02_ingest.js', '[440, 400]')
S += ifnode('usable', 'Job can start?', "{{ $json.usable === 'ok' }}", '[660, 400]')
S += f"""const accepted = node({{ type: 'n8n-nodes-base.noOp', version: 1, config: {{ name: 'Job accepted', position: [880, 300] }}, output: [{{}}] }});\n"""
S += f"""const sendReceived = node({{ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: {{ name: 'Send job received', parameters: {{ respondWith: 'json', responseBody: {E('{{ JSON.stringify({ ok: true, status: \"received\", job_id: $json.client_run_id, not_applied: $json.not_applied }) }}')}, options: {{ responseCode: 202, responseHeaders: {{ entries: [{{ name: 'Cache-Control', value: 'no-store' }}] }} }} }}, position: [1100, 100] }}, output: [{{}}] }});\n"""
recv_vals = {'run_id': E('{{ $json.run_id }}'), 'client_run_id': E('{{ $json.client_run_id }}'), 'parent_run_id': E('{{ $json.parent_run_id }}'), 'job_type': E('{{ $json.brief.job_type }}'),
  'stage': "'01 Intake & observe'", 'status': "'received'", 'outcomes': E('{{ JSON.stringify($json.brief.outcomes) }}'), 'required_outputs': E('{{ JSON.stringify($json.brief.outputs) }}'),
  'brief_version': '1', 'references': E('{{ JSON.stringify($json.references.map(r => ({ name: r.name, role: r.role, sha256: r.sha256, bytes: r.bytes }))) }}'),
  'not_applied': E('{{ JSON.stringify($json.not_applied) }}'), 'execution_id': E('{{ $execution.id }}'), 'received_at': E('{{ $json.received_at }}'), 'trail': E('{{ JSON.stringify($json.trail) }}')}
S += f"""const logReceived = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: 'Log received', parameters: {{ resource: 'row', operation: 'insert', dataTableId: {{ __rl: true, mode: 'id', value: '{RUNS}', cachedResultName: 'Claude Midas A7 runs' }}, columns: {{ mappingMode: 'defineBelow', value: {values(recv_vals)}, schema: {schema(RUN_COLS)} }}, options: {{}} }}, onError: 'continueRegularOutput', position: [1320, 100] }}, output: [{{ id: 1 }}] }});\n"""
S += f"""const eyeRead = node({{ type: '@n8n/n8n-nodes-langchain.googleGemini', version: 1.2, config: {{ name: '03 Eye reads the product photo', parameters: {{ resource: 'image', operation: 'analyze', modelId: {{ __rl: true, mode: 'id', value: 'gemini-3.8-flash' }}, text: {J(EYE)}, inputType: 'binary', binaryPropertyName: {E('{{ $json.product_key }}')}, simplify: true, options: {{ maxOutputTokens: 6000 }} }}, credentials: {CRED_GEMINI}, onError: 'continueRegularOutput', alwaysOutputData: true, position: [1100, 300] }}, output: [{{ content: {{ parts: [{{ text: '{{}}' }}] }} }}] }});\n"""
S += f"""const secondCount = node({{ type: '@n8n/n8n-nodes-langchain.anthropic', version: 1, config: {{ name: '05 Second count', parameters: {{ resource: 'image', operation: 'analyze', modelId: {{ __rl: true, mode: 'id', value: 'claude-sonnet-5-5' }}, text: {J(SECOND)}, inputType: 'binary', binaryPropertyName: {E('{{ $json.product_key }}')}, simplify: true, options: {{ maxTokens: 1500 }} }}, credentials: {CRED_ANTH}, onError: 'continueRegularOutput', alwaysOutputData: true, position: [1100, 480] }}, output: [{{ content: [{{ type: 'text', text: '{{}}' }}] }}] }});\n"""
S += ifnode('roomSent', 'Room photo sent?', "{{ Boolean($json.room_key) }}", '[1100, 660]')
S += f"""const roomRead = node({{ type: '@n8n/n8n-nodes-langchain.googleGemini', version: 1.2, config: {{ name: '06 Room reader', parameters: {{ resource: 'image', operation: 'analyze', modelId: {{ __rl: true, mode: 'id', value: 'gemini-3.8-flash' }}, text: {J(ROOM)}, inputType: 'binary', binaryPropertyName: {E('{{ $json.room_key }}')}, simplify: true, options: {{ maxOutputTokens: 2000 }} }}, credentials: {CRED_GEMINI}, onError: 'continueRegularOutput', alwaysOutputData: true, position: [1320, 600] }}, output: [{{ content: {{ parts: [{{ text: '{{}}' }}] }} }}] }});\n"""
S += f"""const noRoom = node({{ type: 'n8n-nodes-base.noOp', version: 1, config: {{ name: 'No room photo', position: [1320, 760] }}, output: [{{}}] }});\n"""
S += f"""const readersDone = merge({{ version: 3.2, config: {{ name: 'Readers done', parameters: {{ mode: 'append', numberInputs: 3 }}, position: [1540, 460] }} }});\n"""
S += codenode('evidence', '04-06 Evidence', '04_evidence.js', '[1760, 460]')
S += ifnode('criticalUnknown', 'Critical unknown?', "{{ $json.critical.length > 0 }}", '[1980, 460]')
S += f"""const loadProfiles = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: '07a Load handling profiles', parameters: {{ resource: 'row', operation: 'get', dataTableId: {{ __rl: true, mode: 'id', value: '{PROFILES}', cachedResultName: 'Claude Midas handling profiles' }}, returnAll: true }}, executeOnce: true, alwaysOutputData: true, position: [2200, 560] }}, output: [{{ profile_id: 'general' }}] }});\n"""
S += codenode('route', '07 Route', '07_route.js', '[2420, 560]')
S += codenode('locks', '08 Locks and freedoms', '08_locks.js', '[2640, 560]')
S += f"""const findContracts = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: '09a Find earlier contracts', parameters: {{ resource: 'row', operation: 'get', dataTableId: {{ __rl: true, mode: 'id', value: '{VAULT}', cachedResultName: 'Claude Midas A7 vault' }}, matchType: 'allConditions', filters: {{ conditions: [{{ keyName: 'client_run_id', condition: 'eq', keyValue: {E('{{ $json.client_run_id }}')} }}, {{ keyName: 'kind', condition: 'eq', keyValue: 'contract' }}] }}, returnAll: true }}, executeOnce: true, alwaysOutputData: true, position: [2860, 560] }}, output: [{{}}] }});\n"""
S += ifnode('toClassify', 'Conflicts to classify?', "{{ $('08 Locks and freedoms').first().json.has_open_conflicts }}", '[3080, 560]')
S += f"""const conflictCheck = node({{ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: {{ name: '09 Conflict check', parameters: {{ resource: 'text', operation: 'response', modelId: {{ __rl: true, mode: 'id', value: 'gpt-6-luna' }}, responses: {{ values: [{{ type: 'text', role: 'user', content: {E("{{ $('08 Locks and freedoms').first().json.conflict_ticket }}")} }}] }}, simplify: true, options: {{ instructions: {J(CONFLICT)}, maxTokens: 2000, store: false, textFormat: {{ textOptions: [{{ type: 'json_object' }}] }} }} }}, credentials: {CRED_OAI}, onError: 'continueRegularOutput', alwaysOutputData: true, position: [3300, 480] }}, output: [{{ output: [{{ content: [{{ text: '{{}}' }}] }}] }}] }});\n"""
S += codenode('contract', '09b Contract', '09_contract.js', '[3520, 560]')
S += ifnode('contractClear', 'Contract clear?', "{{ $json.critical.length === 0 }}", '[3740, 560]')
S += codenode('ready', 'Contract ready', 'ready.js', '[3960, 480]')
S += codenode('hold', 'Hold and ask the client', 'hold.js', '[3960, 760]')
S += codenode('vault1', 'V1 Vault events', 'v1_vault.js', '[4180, 620]')
upd_vals = {k: E('{{ $json.row.%s }}' % k) for k in ['status','stage','hold_reason','client_question','contract_stamp','required_outputs','references','observation','contract','not_applied','cost_estimate','trail']}
upd_vals['contract_version'] = E('{{ $json.row.contract_version }}')
upd_cols = [c for c in RUN_COLS if c[0] in upd_vals]
S += f"""const updateRun = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: 'Update run row', parameters: {{ resource: 'row', operation: 'update', dataTableId: {{ __rl: true, mode: 'id', value: '{RUNS}', cachedResultName: 'Claude Midas A7 runs' }}, matchType: 'allConditions', filters: {{ conditions: [{{ keyName: 'run_id', condition: 'eq', keyValue: {E('{{ $json.run_id }}')} }}] }}, columns: {{ mappingMode: 'defineBelow', value: {values(upd_vals)}, schema: {schema(upd_cols)} }}, options: {{}} }}, onError: 'continueRegularOutput', alwaysOutputData: true, position: [4400, 620] }}, output: [{{ id: 1 }}] }});\n"""
S += codenode('vault2', 'V2 One row per event', 'v2_split.js', '[4620, 620]')
vault_vals = {c: E('{{ $json.%s }}' % c) for c, _ in VAULT_COLS}
S += f"""const saveVault = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: 'V3 Save to vault', parameters: {{ resource: 'row', operation: 'insert', dataTableId: {{ __rl: true, mode: 'id', value: '{VAULT}', cachedResultName: 'Claude Midas A7 vault' }}, columns: {{ mappingMode: 'defineBelow', value: {values(vault_vals)}, schema: {schema(VAULT_COLS)} }}, options: {{}} }}, onError: 'continueRegularOutput', position: [4840, 620] }}, output: [{{ id: 1 }}] }});\n"""
S += codenode('refuse', 'Refuse with reasons', 'refuse.js', '[880, 900]')
S += f"""const sendRefusal = node({{ type: 'n8n-nodes-base.respondToWebhook', version: 1.5, config: {{ name: 'Send refusal', parameters: {{ respondWith: 'json', responseBody: {E('{{ JSON.stringify($json.reply) }}')}, options: {{ responseCode: 422, responseHeaders: {{ entries: [{{ name: 'Cache-Control', value: 'no-store' }}] }} }} }}, position: [1100, 900] }}, output: [{{}}] }});\n"""
ref_vals = {'run_id': E('{{ $json.run_id }}'), 'client_run_id': E('{{ $json.client_run_id }}'), 'stage': "'01 Intake & observe'", 'status': "'refused'", 'hold_reason': E('{{ $json.problems.join(\" \") }}'), 'not_applied': E('{{ JSON.stringify($json.not_applied) }}'), 'execution_id': E('{{ $execution.id }}'), 'received_at': E('{{ $json.received_at }}')}
ref_cols = [c for c in RUN_COLS if c[0] in ref_vals]
S += f"""const logRefused = node({{ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {{ name: 'Log refused', parameters: {{ resource: 'row', operation: 'insert', dataTableId: {{ __rl: true, mode: 'id', value: '{RUNS}', cachedResultName: 'Claude Midas A7 runs' }}, columns: {{ mappingMode: 'defineBelow', value: {values(ref_vals)}, schema: {schema(ref_cols)} }}, options: {{}} }}, onError: 'continueRegularOutput', position: [1320, 900] }}, output: [{{ id: 1 }}] }});\n"""

NOTE_MAIN = """## Claude · Midas A7 · stages 01–02 (steps 1–9)
Design: claude-midas-a7-blueprint-2026-10-14. Architecture A: code decides every next step.
Built 14 Oct 2026. Draft, not published. Tested with pinned data only; no paid call made.
Stops at **Contract ready** on purpose: stages 03–06 are not built yet.
Readers are blind: they are never told the expected number of pieces. Code compares the two counts with the client's number.
Run ids start with claude-a7-. Tables: Claude Midas A7 runs, Claude Midas A7 vault."""
NOTE_S1 = """### Stage 01 · Intake & observe (steps 1–6)
1 brief v1 · 2 files with role and sha256 (storage not connected yet) · 3–4 Eye reads pieces with boxes (gemini-3.8-flash) · 5 second blind count (claude-sonnet-5-5) · 6 room locks when a room photo is sent.
Critical unknown → hold and ask the client one question. Nothing is paid before the answer."""
NOTE_S2 = """### Stage 02 · Compile scope (steps 7–9)
7 route by handling profile and gates · 8 locks and freedoms per output (white master: neutral light, no props) · 9 conflict check (gpt-6-luna) then contract vN with sha256 stamp; older versions voided.
Critical conflict → hold before any spend."""
NOTE_V = """### Step 19 · Vault
Append-only events: brief, references, observation, conflict ledger, contract, voided versions, hold, status. The run row is updated once."""
S += f"const noteMain = sticky({J(NOTE_MAIN)}, [], {{ color: 7, position: [0, -120], width: 640, height: 240 }});\n"
S += f"const noteS1 = sticky({J(NOTE_S1)}, [], {{ color: 4, position: [860, 900], width: 520, height: 200 }});\n"
S += f"const noteS2 = sticky({J(NOTE_S2)}, [], {{ color: 5, position: [2200, 260], width: 620, height: 200 }});\n"
S += f"const noteV = sticky({J(NOTE_V)}, [], {{ color: 3, position: [4180, 820], width: 520, height: 160 }});\n"

S += """
export default workflow('claude-midas-a7', 'Claude · Midas A7 (stages 01–02)')
  .add(jobWebhook)
  .to(intent)
  .to(ingest)
  .to(usable.onTrue(accepted).onFalse(refuse.to(sendRefusal.to(logRefused))))
  .add(accepted)
  .to(sendReceived.to(logReceived))
  .add(accepted)
  .to(eyeRead.to(readersDone.input(0)))
  .add(accepted)
  .to(secondCount.to(readersDone.input(1)))
  .add(accepted)
  .to(roomSent.onTrue(roomRead.to(readersDone.input(2))).onFalse(noRoom.to(readersDone.input(2))))
  .add(readersDone)
  .to(evidence)
  .to(criticalUnknown.onTrue(hold).onFalse(loadProfiles.to(route.to(locks.to(findContracts.to(toClassify.onTrue(conflictCheck.to(contract)).onFalse(contract)))))))
  .add(contract)
  .to(contractClear.onTrue(ready).onFalse(hold))
  .add(ready)
  .to(vault1)
  .add(hold)
  .to(vault1)
  .add(vault1)
  .to(updateRun.to(vault2.to(saveVault)))
  .add(noteMain)
  .add(noteS1)
  .add(noteS2)
  .add(noteV);
"""
open('workflow.ts', 'w', encoding='utf-8').write(S)
print(len(S))
