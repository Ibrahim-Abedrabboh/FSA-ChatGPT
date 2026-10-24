"""A7 cost-per-job model. Prices verified 14 Oct 2026 (sources in PRICES). Token sizes are ESTIMATES from the
real call sizes of A6 job cfdaefa8 (n8n run 362; chars/4). Reasoning/thinking tokens are an ASSUMPTION (x1 of
visible output). Nothing here is an invoice."""
import json
PRICES = {  # USD per 1M tokens: (input, output); image tokens per image at the detail used
 'gemini-3.8-flash': dict(i=0.75, o=3.75, img=1120, src='ai.google.dev/gemini-api/docs/pricing (through 31 Dec 2026; doubles 1 Jan 2027)'),
 'gpt-6.1-sol':      dict(i=2.00, o=10.0, img=2000, src='developers.openai.com/api/docs/pricing; image tokens not published for this model: 2000 is an estimate'),
 'gpt-6-luna':       dict(i=0.10, o=0.50, img=0,    src='developers.openai.com/api/docs/pricing'),
 'claude-sonnet-5-5':dict(i=2.00, o=10.0, img=1600, src='Anthropic pricing (research notes); image tokens estimated from the 28px-patch rule'),
 'gpt-4.1':          dict(i=2.00, o=8.00, img=765,  src='A6 today; retired from the API 14 Jan 2027'),
 'gpt-4o':           dict(i=2.50, o=10.0, img=765,  src='A6 today; retired from the API 14 Jan 2027'),
}
IMG = {  # per generated image, USD
 'nano-2.1 (Google API)': 0.0504 + (1750 + 2*1120) * 1.50/1e6 + 1000 * 7.50/1e6,  # 2K output + prompt + 2 refs + ~1000 thinking tokens (assumed)
 'nano-2.1 (fal.ai)':     0.063  + 1750 * 1.764/1e6 + 1000 * 8.823/1e6,          # fal table: 2K edit with two 1K inputs, plus prompt and thinking
 'nano-pro (fal.ai, A6)': 0.15,
 'flux-2-max (fal.ai, A6)': 0.20,   # fal: $0.07 first MP + $0.03 per extra MP; ~0.20 for 2048x2048 with one 1MP input (inference)
}
BG_REMOVE = 0.018  # fal bria background remove, per image (White BK only)
T = json.load(open('/home/claude/research/notes/token-estimates.json'))
def call(model, in_tok, out_tok, images, reasoning=1.0):
    p = PRICES[model]
    return (in_tok + images * p['img']) * p['i'] / 1e6 + out_tok * (1 + reasoning) * p['o'] / 1e6
t = lambda k: (T[k]['in_tok_est'], T[k]['out_tok_est'])
# A7 call catalogue: role -> (model, in, out, images)
A7 = {
 'photo reading (3,4,6)':     ('gemini-3.8-flash', *t('02 Eye reads the product photo'), 1),
 'source count cross-check':  ('claude-sonnet-5-5', 900, 250, 1),
 'conflict check (9)':        ('gpt-6-luna', *t('03f Conflict check'), 0),
 'scene planning (11)':       ('gpt-6.1-sol', *t('04 Stylist plans the scenes'), 0),
 'plan check (11)':           ('claude-sonnet-5-5', *t('05b Plan critic'), 0),
 'review (16)':               ('gpt-6.1-sol', *t('10 Reviewer compares two images'), 2),
 'blind count A (16)':        ('gemini-3.8-flash', 700, 300, 1),
 'blind count B (16)':        ('claude-sonnet-5-5', 700, 250, 1),
 'audit with count (16)':     ('claude-sonnet-5-5', *t('14 Auditor compares two images'), 2),
 'final inspection (16)':     ('gpt-6.1-sol', 900, 250, 2),
 'description writer (20)':   ('claude-sonnet-5-5', *t('21b Description writer'), 0),
 'description check (20)':    ('gpt-6-luna', *t('21d Description check'), 0),
}
A6 = {
 'photo reading':  ('gpt-4.1', *t('02 Eye reads the product photo'), 1),
 'conflict check': ('gpt-4.1', *t('03f Conflict check'), 0),
 'scene planning': ('gpt-4.1', *t('04 Stylist plans the scenes'), 0),
 'plan check':     ('gpt-4.1', *t('05b Plan critic'), 0),
 'review':         ('gpt-4.1', *t('10 Reviewer compares two images'), 2),
 'audit':          ('gpt-4o', *t('14 Auditor compares two images'), 2),
 'description writer': ('gpt-4.1', *t('21b Description writer'), 0),
 'description check':  ('gpt-4o', *t('21d Description check'), 0),
}
c = lambda table, k: call(*table[k])
def a7_job(images, repairs, white_bk=False, img_key='nano-2.1 (Google API)', reasoning=1.0):
    cc = lambda k: call(*A7[k][:4], reasoning=reasoning)
    renders = images + repairs
    lines = {
      'Fixed: read, check and plan the job': cc('photo reading (3,4,6)') + cc('source count cross-check') + cc('conflict check (9)') + cc('scene planning (11)') + cc('plan check (11)'),
      'Images made': renders * IMG[img_key] + (renders * BG_REMOVE if white_bk else 0),
      'Checks on every image made': renders * (cc('review (16)') + cc('blind count A (16)') + cc('blind count B (16)')),
      'Audit and final inspection of kept images': images * cc('audit with count (16)') + max(0, images - 1) * cc('final inspection (16)'),
      'Description and its check': cc('description writer (20)') + cc('description check (20)'),
    }
    return lines
def a6_job(images, repairs, masters=1):
    renders = images + repairs
    lines = {
      'Fixed: read, check and plan the job': c(A6,'photo reading') + c(A6,'conflict check') + c(A6,'scene planning') + c(A6,'plan check'),
      'Images made': masters * IMG['flux-2-max (fal.ai, A6)'] + (renders - masters) * IMG['nano-pro (fal.ai, A6)'],
      'Checks on every image made': renders * c(A6,'review'),
      'Audit and final inspection of kept images': images * c(A6,'audit'),
      'Description and its check': c(A6,'description writer') + c(A6,'description check'),
    }
    return lines
S = []
def add(name, outcome, images, lo_rep, hi_rep, white=False):
    for rep, label in ((0, 'no correction'), (images, 'one repair per image'), (2*images, 'two repairs per image (maximum)')):
        l = a7_job(images, rep, white)
        S.append(dict(job=name, outcome=outcome, images=images, repairs=rep, case=label, lines={k: round(v,4) for k,v in l.items()}, total=round(sum(l.values()),4),
                      total_fal=round(sum(a7_job(images, rep, white, 'nano-2.1 (fal.ai)').values()),4),
                      total_think3=round(sum(a7_job(images, rep, white, reasoning=3.0).values()),4)))
add('White BK, 1 image', 'White BK', 1, 0, 2, white=True)
add('Lifestyle, 2 images + white master', 'Lifestyle', 3, 0, 6)
add('Website package, 4 images', 'Website', 4, 0, 8)
add('Lifestyle + Website, 1 master + 2 + 3', 'Lifestyle + Website', 6, 0, 12)
a6_actual = a6_job(3, 0)
out = dict(prices={k: v['src'] for k,v in PRICES.items()}, price_values={k: dict(i=v['i'], o=v['o'], img=v['img']) for k,v in PRICES.items()},
           image_prices={k: round(v,4) for k,v in IMG.items()}, bg_remove=BG_REMOVE,
           a7_calls={k: dict(model=v[0], in_tok=v[1], out_tok=v[2], images=v[3], usd=round(call(*v[:4]),5)) for k,v in A7.items()},
           scenarios=S,
           a6_job_cfdaefa8=dict(lines={k: round(v,4) for k,v in a6_actual.items()}, total=round(sum(a6_actual.values()),4)),
           a7_same_job=dict(total=round(sum(a7_job(3,0).values()),4)),
           per_repair_a7=round(IMG['nano-2.1 (Google API)'] + call(*A7['review (16)'][:4]) + call(*A7['blind count A (16)'][:4]) + call(*A7['blind count B (16)'][:4]),4))
json.dump(out, open('cost_model.json','w'), indent=1)
print('A6 job cfdaefa8 (estimated):', out['a6_job_cfdaefa8'])
print('A7 same job:', out['a7_same_job'], '| per extra repair:', out['per_repair_a7'])
for s in S: print(f"{s['job']:42s} {s['case']:32s} renders {s['images']+s['repairs']:2d}  ${s['total']:.3f}  (fal ${s['total_fal']:.3f}, 3x thinking ${s['total_think3']:.3f})")
for k,v in out['a7_calls'].items(): print(f"  {k:30s} {v['model']:18s} ${v['usd']:.5f}")
