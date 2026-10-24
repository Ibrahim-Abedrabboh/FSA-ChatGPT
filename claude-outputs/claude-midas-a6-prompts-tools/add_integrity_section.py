"""Inserts the 'Data fidelity and integrity' section into the prompt export, after 'Where this comes from'.
Numbers are taken by code from verification.json and from run 362; Claude's own visual counts are typed in
and labelled as such. Run after verify_export.py; verify again afterwards."""
import json, hashlib

MD = 'claude-midas-a6-prompts-by-phase-2026-10-14.md'
v = json.load(open('verification.json'))
rd = json.load(open('exec362.json'))['data']['resultData']['runData']

reviews = []
for r in rd['10 Reviewer compares two images']:
    for o in r['data']['main']:
        for it in o or []:
            t = it['json']['output'][0]['content'][0]['text']
            reviews.append(t if isinstance(t, dict) else json.loads(t))
shots = []
for r in rd['09d Review tickets again']:
    for o in r['data']['main']:
        for it in o or []:
            shots.append(it['json']['shot'])
assert len(shots) == len(reviews) == 3, (shots, len(reviews))
label = [l for l in rd['03d Contract ticket'][0]['data']['main'][0][0]['json']['resolver_request'].split('\n') if l.startswith('Numbers of pieces printed')][0]

files = {1: ('shot1.png', '9b0d9ad9b964a775f04b4e8a4675c54a03902c7b0a20a2db957baa6b6dbe440e'),
         2: ('shot2.png', 'b32f6ae2152143e2732371ec16b8495f915f640632dc36b17a8cad4c4ec80f81'),
         3: ('shot3.png', '9818991dc850e7c506f52833efa03e236d92e5e95182ac78138d76a624c7f565')}
match = {}
for s, (f, recorded) in files.items():
    got = hashlib.sha256(open('/home/claude/run-cfdaefa8/' + f, 'rb').read()).hexdigest()
    match[s] = got == recorded
claude_count = {1: 'about 5', 2: 'about 6', 3: 'about 4 to 5'}
role = {1: 'White catalogue image (Flux.2 Max)', 2: 'Lifestyle (Nano Banana Pro)', 3: 'Lifestyle (Nano Banana Pro)'}

L = []
w = L.append
w('## Data fidelity and integrity\n')
w(f'Checked 14 Oct 2026, {v["checked_at_amman"][-5:]} Amman time.\n\n')
w('**Labels used in this section:**\n'
  '- **Verified:** checked by code against the source.\n'
  '- **Recorded:** copied from what the pipeline stored.\n'
  '- **Model judgement:** a model\'s opinion.\n'
  '- **Visual reading:** Claude looking at the image. Not a measurement.\n\n')

w('### 1. Sources\n')
w('| Source | Identifier | Check |\n|---|---|---|\n')
w(f'| A6 workflow in n8n | version {v["workflow_version"]} | Verified: still the published version at {v["checked_at_amman"][-5:]} |\n')
w(f'| Workflow export used | sha256 {v["workflow_export_sha256"][:16]}… | Read once, 14 Oct, 14:13 |\n')
w(f'| Run of job cfdaefa8 | n8n run {v["run"]} | Finished 15:45 |\n')
w(f'| Run export used | sha256 {v["run_export_sha256"][:16]}… | Read once, 14 Oct, 15:50 |\n\n')

w('### 2. Text fidelity of this document\n')
w(f'- **Verified: {v["md_exact"]} of {v["sources"]} prompt texts are byte-for-byte identical** to the source text in n8n. These are the fixed instructions of the 10 model steps, the look-reader message, and the 15 messages and image prompts sent in run 362. Nothing was retyped, shortened or reformatted.\n'
  f'- **Verified: {v["md_blocks"] - v["unmatched_md_blocks"]} of {v["md_blocks"]} prompt blocks in the document have a source.** No block was added that does not exist in n8n.\n'
  f'- **Verified: the Word copy contains all {v["docx_contains"]} texts.** The comparison ignores line breaks, because Word re-wraps lines.\n'
  f'- **Characters altered to fit the format: {v["fence_swaps"]}.**\n'
  '- **Left out on purpose:** the image data and image links sent with each request (they are named instead), and the keys. No key, token or access code appears in this document.\n'
  '- **How to re-check:** `verify_export.py` reads the n8n exports and this document, and repeats every comparison.\n\n')
w('| Source text | Characters | sha256 (first 16) | In .md, exact | In Word |\n|---|---|---|---|---|\n')
for r in v['rows']:
    w(f'| {r["source"]} | {r["chars"]:,} | {r["sha256"]} | {"yes" if r["md_exact"] else "NO"} | {"yes" if r["docx_contains"] else "NO"} |\n')
w('\n')

w('### 3. Integrity of the images made in run 362\n')
w(f'- **Verified: {sum(match.values())} of 3 image files** downloaded on 14 Oct match, by sha256, the master checksums the pipeline recorded in its package manifest. The images described below are exactly the ones the run produced.\n'
  '- **Not verified:** the image links are held by fal.ai and may stop working. The pipeline has no permanent copy (open item 4).\n\n')

w('### 4. Product fidelity of those images: recorded versus independent count\n')
w(f'**What fixes the number of pieces.** Recorded: the photo reader counted **7 pieces** (1 left-arm piece, 4 armless, 1 corner, 1 right-arm piece). The vendor file carries a printed label with the same count, as the pipeline read it: "{label.split(": ", 1)[1]}" Every image prompt said "Total product pieces: 7. No more and no fewer."\n\n')
w('| Image | Recorded scores (model judgement) | Recorded piece count by the reviewer (model judgement) | Visual reading by Claude (not measured) |\n|---|---|---|---|\n')
for s, rv in zip(shots, reviews):
    seen = '; '.join(f'{c["seen"]} of {c["expected"]} {c["item"]}' for c in rv.get('counted', []))
    total = sum(int(c['seen']) for c in rv.get('counted', []))
    ev = rv['checks']['inventory_count']
    sc = 'fidelity 100, integrity 100, brief match 100' + (', styling not assessed' if s == 1 else ', styling 100')
    w(f'| {s} · {role[s]} | {sc} | **{total} pieces**: {seen}. inventory_count = {ev["result"]}: "{ev["evidence"]}" | **{claude_count[s]} seat sections**, fewer than 7 |\n')
w('\n')
w('**What this shows:**\n\n'
  '- **The two counts disagree.** For all three images, the reviewer reported seeing every one of the 7 pieces. Those reports gave fidelity 100 and integrity 100, and the package was marked ready for release. The visual reading finds fewer seat sections in every image, and the clearest gap is in the white image.\n'
  '- **The scores carry the reviewer\'s mistake.** "Fidelity" and "integrity" are calculated by code from the reviewer\'s pass and fail answers. When the reviewer is wrong, the scores are wrong in the same way. They are model judgements, not measurements, and here they do not hold.\n'
  '- **Limits of the visual reading.** Seat cushions are counted along the front. Where one cushion spans two modules, or a module joint is hidden, the module count can differ. Claude has not seen the vendor photo itself, so the reference is the count recorded by the pipeline and the printed label.\n'
  '- **Conclusion:** do not treat any of the three images as faithful to the product. They remain unapproved candidates.\n'
  '- **Correction to an earlier message:** on 14 Oct at about 15:55, Claude wrote in the chat that "the two lifestyle images show 7". That was not checked and is wrong.\n\n')

w('### 5. Not verified\n')
w('- The vendor photo itself (11-ASH10202-08.jpg). Claude has not seen it; its content is known only from the pipeline\'s reading.\n'
  '- The steps that did not run in this job: the look reader, the final inspector and the white clean-up. Their fixed instructions are verified, but there is no run to show.\n'
  '- The Word layout. Pages 1 and 4 of 43 were looked at. The text of every page is verified by code; the appearance of the other pages is not.\n\n')

section = ''.join(L)
md = open(MD, encoding='utf-8').read()
marker = '## Phases and steps\n'
assert md.count(marker) == 1 and '## Data fidelity and integrity' not in md
md = md.replace(marker, section + marker)
open(MD, 'w', encoding='utf-8').write(md)
print('section', len(section), 'chars; files match', match)
