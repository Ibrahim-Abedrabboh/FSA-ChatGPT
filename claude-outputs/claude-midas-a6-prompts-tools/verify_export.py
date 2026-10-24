"""Checks the prompt export against its sources, independently of build_export.py.
Every prompt block in the .md must equal, byte for byte, one source string read from the n8n exports
(workflow JSON and run 362 JSON). The .docx text must contain every source string (whitespace normalised,
because Word reflows lines). Writes verification.json. Reads no keys."""
import json, re, hashlib, subprocess, sys

WF = '/root/.claude/projects/-home-claude/227af1d8-82c1-5a5f-8cee-7a14aedbaade/tool-results/mcp-n8n-get_workflow_details-1791976387742.txt'
EX = 'exec362.json'
MD = 'claude-midas-a6-prompts-by-phase-2026-10-14.md'
DOCX = 'claude-midas-a6-prompts-by-phase-2026-10-14.docx'
sha = lambda b: hashlib.sha256(b).hexdigest()

wf_bytes = open(WF, 'rb').read(); ex_bytes = open(EX, 'rb').read()
wf = json.loads(wf_bytes)['workflow']; rd = json.loads(ex_bytes)['data']['resultData']['runData']

def run_items(node):
    out = []
    for r in rd.get(node, []):
        for o in (r.get('data') or {}).get('main') or []:
            for it in o or []:
                out.append(it['json'])
    return out

# expected source strings: (label, text)
src = []
for n in wf['nodes']:
    if n['type'].endswith('openAi'):
        src.append((f'{n["name"]} · fixed instructions', n['parameters']['options']['instructions']))
        if n['name'] == '03m Look reader':
            src.append((f'{n["name"]} · message template', n['parameters']['responses']['values'][0]['content']))
fields = [('01 Job intake', 'eye_request'), ('03d Contract ticket', 'resolver_request'), ('03c Category and catalogue brief', 'plan_request'),
          ('05a Plan critic ticket', 'plan_check_request'), ('09d Review tickets again', 'audit_request'), ('13 Audit tickets', 'audit_request'),
          ('21a Description ticket', 'description_request'), ('21c Description', 'description_check_request')]
for node, f in fields:
    for j in run_items(node):
        src.append((f'{node} · {f}' + (f' · image {j["shot"]}' if 'shot' in j else '') + ' (run 362)', j[f]))
for j in run_items('07 Image requests'):
    src.append((f'07 Image requests · prompt · image {j["shot"]} (run 362)', j['request']['prompt']))

md = open(MD, encoding='utf-8').read()
blocks = re.findall(r'```text\n(.*?)\n```\n', md, flags=re.S)
fence_swaps = sum(t.count('```') for _, t in src)
rows, used = [], set()
for label, text in src:
    want = str(text).replace('```', "'''").rstrip()
    hit = [i for i, b in enumerate(blocks) if b == want and i not in used]
    if hit: used.add(hit[0])
    rows.append({'source': label, 'chars': len(str(text)), 'sha256': sha(str(text).encode())[:16], 'md_exact': bool(hit)})

docx_text = subprocess.run(['pandoc', DOCX, '-t', 'plain', '--wrap=none'], capture_output=True, text=True).stdout
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
dn = norm(docx_text)
for r, (label, text) in zip(rows, src):
    r['docx_contains'] = norm(str(text).replace('```', "'''")) in dn

result = {
    'checked_at_amman': subprocess.run(['date', '+%Y-%m-%d %H:%M'], capture_output=True, text=True, env={'TZ': 'Asia/Amman'}).stdout.strip(),
    'workflow_export_sha256': sha(wf_bytes), 'run_export_sha256': sha(ex_bytes),
    'workflow_version': wf['versionId'], 'run': json.loads(ex_bytes)['execution']['id'],
    'md_sha256': sha(md.encode()), 'docx_sha256': sha(open(DOCX, 'rb').read()),
    'sources': len(src), 'md_blocks': len(blocks), 'md_exact': sum(r['md_exact'] for r in rows),
    'unmatched_md_blocks': len(blocks) - len(used), 'docx_contains': sum(r['docx_contains'] for r in rows),
    'fence_swaps': fence_swaps, 'rows': rows,
}
json.dump(result, open('verification.json', 'w'), indent=1)
print({k: v for k, v in result.items() if k != 'rows'})
for r in rows:
    if not (r['md_exact'] and r['docx_contains']): print('MISMATCH', r)
sys.exit(0 if result['md_exact'] == len(src) == result['docx_contains'] and result['unmatched_md_blocks'] == 0 else 1)
