# Writes the repo export of "Claude · Midas A7" from a saved n8n read-back and byte-checks every Code node and the two model prompts kept in model-prompts/ (16 Oct 2026).
# Input: the JSON that the n8n tool get_workflow_details (detail level "full") returned, saved to a file.
# Output: n8n/claude-midas-a7/workflow-<id>.json (id, name, versionId, nodes, connections, settings, nodeGroups).
# The Code-node files in n8n/claude-midas-a7/code-nodes/ are the source of truth; this script never writes them. It reports
# any Code node whose n8n code differs from its file, any Code node without a file, and any file without a Code node.
# It reads no keys and writes none: credentials appear in n8n exports only as names and ids.
# Run: python3 tools/claude-midas-a7-export.py SAVED_READ_BACK.json
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'n8n', 'claude-midas-a7')
C = os.path.join(D, 'code-nodes')
raw = json.load(open(sys.argv[1], encoding='utf-8'))
w = raw.get('workflow', raw)
out = {k: w[k] for k in ['id', 'name', 'versionId', 'nodes', 'connections', 'settings', 'nodeGroups'] if k in w}
path = os.path.join(D, 'workflow-%s.json' % w['id'])
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
fname = lambda n: re.sub(r'[^A-Za-z0-9]+', '_', n).strip('_') + '.js'
code = [n for n in w['nodes'] if n['type'] == 'n8n-nodes-base.code']
files = set(x for x in os.listdir(C) if x.endswith('.js'))
same, diff, missing = [], [], []
for n in code:
    f = fname(n['name'])
    if f not in files: missing.append(n['name']); continue
    (same if open(os.path.join(C, f), encoding='utf-8').read() == n['parameters'].get('jsCode', '') else diff).append(n['name'])
extra = sorted(files - set(fname(n['name']) for n in code))
# 16 Oct 2026: the planner and plan-critic prompts are model-node parameters; their source files live in model-prompts/ and are
# byte-checked the same way.
P = os.path.join(D, 'model-prompts')
# 16 Oct 2026, 19:3x (D13): the photo reader (03, and its fallback 03b, which must be byte-identical) and the second count (05).
PROMPTS = [('11_Stylist_instructions.txt', '11 Stylist plans the scenes', ['options', 'instructions']),
           ('11c_Plan_critic_system.txt', '11c Plan critic', ['options', 'system']),
           ('03_Eye_photo_reader.txt', '03 Eye reads the product photo', ['text']),
           ('03_Eye_photo_reader.txt', '03b Eye fallback (OpenAI)', ['text']),
           ('05_Second_count.txt', '05 Second count', ['text'])]
pdiff = []
for f, node, keys in PROMPTS:
    n = next((x for x in w['nodes'] if x['name'] == node), None)
    v = n['parameters'] if n else None
    for k in keys:
        v = v.get(k) if isinstance(v, dict) else None
    want = open(os.path.join(P, f), encoding='utf-8').read() if os.path.exists(os.path.join(P, f)) else None
    if want is None or v is None or want.rstrip('\n') != v.rstrip('\n'): pdiff.append(f + ' in ' + node)
print('workflow', w['id'], 'version', w['versionId'], 'nodes', len(w['nodes']), 'active', w.get('active'), 'groups', len(w.get('nodeGroups') or []))
print('code nodes', len(code), '| byte-identical', len(same), '| differ', diff, '| no file', missing, '| file without node', extra)
print('model prompts', len(PROMPTS), '| identical (ignoring a final newline)', len(PROMPTS) - len(pdiff), '| differ', pdiff)
print('written', path)
sys.exit(0 if not diff and not missing and not extra and not pdiff else 1)
