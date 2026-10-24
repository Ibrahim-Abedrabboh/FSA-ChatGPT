"""Builds claude-midas-a6-prompts-by-phase-2026-10-14.md from the A6 workflow (n8n) and the real run of job
cfdaefa8 (execution 362). All prompt text is copied by code, never retyped. No keys are read or written."""
import json, re

wf = json.loads(open('/root/.claude/projects/-home-claude/227af1d8-82c1-5a5f-8cee-7a14aedbaade/tool-results/mcp-n8n-get_workflow_details-1791976387742.txt').read())['workflow']
ex = json.load(open('exec362.json'))
rd = ex['data']['resultData']['runData']
phases = json.load(open('phases.json'))
ai = {n['name']: n for n in json.load(open('openai_nodes.json'))}

def items(node, run=None):
    out = []
    for ri, r in enumerate(rd.get(node, [])):
        if run is not None and ri != run:
            continue
        for o in (r.get('data') or {}).get('main') or []:
            for it in o or []:
                out.append(it['json'])
    return out

def block(text):
    text = str(text).replace('```', "'''")
    return '```text\n' + text.rstrip() + '\n```\n'

def model_head(name, attached, note=''):
    n = ai[name]
    lines = [f'**Step:** {name}  ', f'**Model:** {n["model"]} (OpenAI) · temperature {n["temperature"]} · up to {n["maxTokens"]} tokens · reply format: {n["format"] or "text"}  ',
             f'**Images attached:** {attached}  ']
    if note:
        lines.append(f'**Note:** {note}  ')
    return '\n'.join(lines) + '\n\n'

out = []
w = out.append
w('# Midas Virtual Studio · A6 · Prompts by phase\n')
w('Exported 14 Oct 2026, 15:52 Amman time.\n')
w('## Where this comes from\n')
w('- **Workflow:** "Claude · Midas VTON · Option A6" in n8n, published version b1b0f696 (unchanged since 14 Oct, 11:32 Amman time).\n'
  '- **Real run:** job cfdaefa8 (sectional sofa, photo 11-ASH10202-08.jpg), n8n run 362, 15:40 to 15:45 Amman time. Goes given at 15:41 and 15:43.\n'
  '- **Each prompt has two parts.** The **fixed instructions** are the same for every job and are set in the step. The **message** is written by code for each job; the message shown here is exactly what job cfdaefa8 sent.\n'
  '- **Photos are named, not copied.** Where a step sends images, they are listed by name. The image data and links are not copied into this file.\n'
  '- **Not used in this job:** the look reader and the final inspector. For those, only the fixed instructions are shown.\n'
  '- **No keys, tokens or access codes appear in this file.**\n')

# ------------------------------------------------------------------ counts
total = sum(p['steps'] for p in phases)
w('## Phases and steps\n')
w(f'A6 has **165 steps** in n8n: **157 working steps** plus **8 canvas notes**. They fall into **17 phases** for one job, and **6 service addresses** that run on their own.\n\n'
  '- **Calls to OpenAI:** 10 model steps.\n'
  '- **Calls to fal.ai:** 2 steps, image making and storing the product photo.\n'
  '- **The white clean-up sub-workflow:** it has its own 26 steps, and is used for White BK jobs only.\n\n')
w('| # | Phase | Steps | Model steps (prompts) | fal.ai calls |\n|---|---|---|---|---|\n')
for p in phases:
    num, name = p['phase'].split(' ', 1)
    w(f'| {num} | {name} | {p["steps"]} | {", ".join(p["model_steps"]) or "none"} | {", ".join(p["paid_calls"]) or "none"} |\n')
w(f'| | **Total working steps** | **{total}** | **10** | |\n\n')
w('Only the model steps and the image-making step have prompts. Every other step is code, a table read or write, a branch, a wait or an address.\n\n')

# ------------------------------------------------------------------ prompts
w('## Prompts, in the order a job uses them\n')

w('### Phase 2 · Read the photo\n')
w(model_head('02 Eye reads the product photo', 'the product photo'))
w('**Fixed instructions**\n\n' + block(ai['02 Eye reads the product photo']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('01 Job intake')[0]['eye_request']))

w('### Phase 3 · Contract and conflict check\n')
w(model_head('03f Conflict check', 'none'))
w('**Fixed instructions**\n\n' + block(ai['03f Conflict check']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('03d Contract ticket')[0]['resolver_request']))

w('### Phase 4 · Look image (only when the client sends an inspiration image)\n')
w(model_head('03m Look reader', 'the inspiration image', 'Not used in job cfdaefa8, because no inspiration image was sent.'))
w('**Fixed instructions**\n\n' + block(ai['03m Look reader']['instructions']))
w('**Message (the same for every job, with the product type filled in)**\n\n' + block(ai['03m Look reader']['inputs'][0]['content']))

w('### Phase 6 · Scene planning\n')
w(model_head('04 Stylist plans the scenes', 'none'))
w('**Fixed instructions**\n\n' + block(ai['04 Stylist plans the scenes']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('03c Category and catalogue brief')[0]['plan_request']))

w('### Phase 7 · Plan check\n')
w(model_head('05b Plan critic', 'none'))
w('**Fixed instructions**\n\n' + block(ai['05b Plan critic']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('05a Plan critic ticket')[0]['plan_check_request']))

w('### Phase 9 · Image making (fal.ai)\n')
w('**Step:** 08 Render image. The prompt is written by code in "06 Render ticket" and "07 Image requests". These models have no separate fixed instructions: everything is in the prompt.\n\n')
for run in range(len(rd.get('07 Image requests', []))):
    for j in items('07 Image requests', run):
        req = j['request']
        settings = {k: v for k, v in req.items() if k not in ('prompt', 'image_urls')}
        refs = ['the product photo' if u.startswith('data:') else 'the white catalogue image of this job' for u in req.get('image_urls', [])]
        model = 'Flux.2 Max, edit (images on white)' if 'flux' in j['endpoint'] else 'Nano Banana Pro, edit (lifestyle images)'
        w(f'#### Image {j["shot"]} · {model}\n')
        w(f'**Images attached, in order:** {"; ".join(refs)}  \n**Settings:** `{json.dumps(settings)}`\n\n')
        w('**Prompt sent in job cfdaefa8**\n\n' + block(req['prompt']))

w('### Phase 10 · Review\n')
w(model_head('10 Reviewer compares two images', 'the product photo and the new image'))
w('**Fixed instructions**\n\n' + block(ai['10 Reviewer compares two images']['instructions']))
for run in range(len(rd.get('09d Review tickets again', []))):
    for j in items('09d Review tickets again', run):
        w(f'**Message sent in job cfdaefa8, image {j["shot"]}**\n\n' + block(j['audit_request']))

w('### Phase 12 · Audit\n')
w(model_head('14 Auditor compares two images', 'the product photo and the new image'))
w('**Fixed instructions**\n\n' + block(ai['14 Auditor compares two images']['instructions']))
for j in items('13 Audit tickets'):
    w(f'**Message sent in job cfdaefa8, image {j["shot"]}**\n\n' + block(j['audit_request']))

w('### Phase 13 · Final inspection\n')
w(model_head('17 Final inspector', 'two images to compare', 'Not used in job cfdaefa8: no final inspection was needed.'))
w('**Fixed instructions**\n\n' + block(ai['17 Final inspector']['instructions']))

w('### Phase 14 · White clean-up (White BK only)\n')
w('This phase has no text prompt. The sub-workflow "Claude · Midas white clean-up" sends the image to a background-removal model on fal.ai, and then cleans it to pure white in code. It was not used in job cfdaefa8, which was a lifestyle job.\n\n')

w('### Phase 16 · Description\n')
w(model_head('21b Description writer', 'none'))
w('**Fixed instructions**\n\n' + block(ai['21b Description writer']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('21a Description ticket')[0]['description_request']))
w(model_head('21d Description check', 'none'))
w('**Fixed instructions**\n\n' + block(ai['21d Description check']['instructions']))
w('**Message sent in job cfdaefa8**\n\n' + block(items('21c Description')[0]['description_check_request']))

text = ''.join(out)
for bad in ('X-Midas-Key:', 'Bearer ', 'sk-', 'webhook-waiting', 'signature='):
    assert bad not in text, bad
open('claude-midas-a6-prompts-by-phase-2026-10-14.md', 'w').write(text)
print(len(text), 'characters')
