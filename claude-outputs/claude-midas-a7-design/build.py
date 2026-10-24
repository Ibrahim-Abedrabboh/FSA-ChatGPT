"""Builds claude-midas-a7-blueprint-2026-10-14.html from content.py and cost_model.json. Design only: nothing here
touches n8n or makes a paid call."""
import json, html
from content import STAGES, STEPS, LOOPS, TRACES, CASES, COMBOS, MODELS, GAPS

E = lambda s: html.escape(str(s), quote=True)
cm = json.load(open('cost_model.json'))
OUT = 'claude-midas-a7-blueprint-2026-10-14.html'

# ---------- diagrams (mermaid, rendered natively by the artifact viewer) ----------
FLOW = r'''flowchart TD
  IN(["Client request + files"]) --> s1
  subgraph S1["01 · Intake & observe"]
    s1["1 Intent & scope"] --> s2["2 Ingest files"] --> s3["3 Recognize pieces"] --> s4["4 Read signs"] --> s5["5 Unknowns + 2nd source count"] --> s6["6 Scene, sides, room"]
  end
  s5 -- "critical unknown" --> H1{{"Hold: ask the client one question"}}
  H1 -- "answer = brief v+1" --> s1
  subgraph S2["02 · Compile scope"]
    s7["7 Route"] --> s8["8 Locks & freedoms"] --> s9["9 Contract vN + conflicts"]
  end
  s6 --> s7
  s9 -- "critical conflict" --> H1
  subgraph S3["03 · Retrieve & style"]
    s10["10 Midas SKUs"] --> s11["11 Plan + plan check"] --> s12["12 Who leads the scene"]
  end
  s9 --> s10
  s11 -- "plan fails, max 2" --> s11
  s12 --> G1(["Owner go 1"])
  subgraph S4["04 · Compile & dispatch"]
    s13["13 Compile request"] --> s14["14 Model registry"] --> s15["15 Paid call, receipt, copy"]
  end
  G1 --> s13
  s15 -- "no receipt" --> R1{{"Reconcile same request id"}}
  R1 -- "receipt found" --> s16
  subgraph S5["05 · Critique & correct"]
    s16["16 Review + 2 blind counts + audit"] --> s17["17 Repair one defect"]
  end
  s15 --> s16
  s17 -- "repair ≤ 2" --> s13
  s17 -- "2 used" --> H2{{"Hold output with reason"}}
  s16 -- "white master passes" --> G2(["Owner go 2"]) --> s13
  subgraph S6["06 · Package & release"]
    s20["20 Manifest + description"] --> OD(["Owner decision"]) --> s21["21 Cost per accepted package"]
  end
  s16 -- "all outputs pass" --> s20
  V[("19 Vault: every step writes here")]
  B["18 Benchmark (offline)"] -. "updates registry" .-> s14
  classDef hold fill:#FFF1F1,stroke:#B22020,color:#121111
  classDef owner fill:#FFF8E6,stroke:#C9962A,color:#121111
  class H1,H2,R1 hold
  class G1,G2,OD owner
'''

HANDOFF = r'''flowchart TD
  A["01 Intake & observe"] -- "Observation: typed facts, boxes, unknowns" --> B["02 Compile scope"]
  B -- "Contract vN (stamped)" --> C["03 Retrieve & style"]
  C -- "Shortlist + scene plan per output" --> D["04 Compile & dispatch"]
  D -- "Candidate + receipt + hash" --> E["05 Critique & correct"]
  E -- "defect: repair order" --> D
  E -- "Reviewed candidates" --> F["06 Package & release"]
  F -- "Manifest or hold" --> O(["Owner"])
  E -. "missing evidence" .-> A
  C -. "plan breaks a lock" .-> B
'''

AB = r'''flowchart LR
  subgraph A["A · Controlled workflow (A7)"]
    a1["Code picks the next stage"] --> a2["Specialist model call"] --> a3["Code checks the output"] --> a1
  end
  subgraph B["B · One agent + backend rules"]
    b1["One agent decides, styles, calls tools, reviews itself"] --> b2["Backend: budget, keys, storage, contract checks"] --> b1
  end
'''

DATA = r'''erDiagram
  PROJECT ||--o{ JOB : "has (batch = N jobs)"
  PROJECT ||--o{ SPACE : "keeps (proposal)"
  JOB ||--|{ REFERENCE : "has, each with a role"
  JOB ||--|{ CONTRACT_VERSION : "v1, v2 ..."
  JOB |o--o| JOB : "parent of (edit, variation)"
  CONTRACT_VERSION ||--|{ OUTPUT : "requires"
  OUTPUT ||--o{ OPERATION : "paid calls"
  OPERATION ||--o| CANDIDATE : "returns"
  CANDIDATE ||--o{ REVIEW : "bound to hash + contract"
  JOB ||--o| PACKAGE : "manifest"
  PACKAGE ||--o| OWNER_DECISION : "approved or held"
  SPACE ||--o{ REFERENCE : "reused as target_room"
'''

REVISION = r'''sequenceDiagram
  participant C as Client page
  participant P as Pipeline (A7)
  participant O as Owner
  C->>P: Chip or message on result X (one axis: light, view, accessories, room)
  P->>P: New brief v+1 linked to parent X, old plans and reviews voided
  P-->>C: Plan preview and what stays locked
  C->>P: Confirm
  P->>O: Go 1 (plan)
  O->>P: go
  P->>P: Images, checks, at most 2 repairs each
  P->>O: Package for decision
  O->>P: approve or hold
  P-->>C: Generated image, "Approved" only after the owner decision
'''

def mermaid(src, label):
    return f'<figure class="diagram"><pre class="mermaid" aria-label="{E(label)}">{E(src)}</pre></figure>'

# ---------- cost ----------
sc = cm['scenarios']
jobs = []
for s in sc:
    if s['job'] not in jobs: jobs.append(s['job'])
cost_rows = {j: [s for s in sc if s['job'] == j] for j in jobs}
LINE_KEYS = list(sc[0]['lines'].keys())
cost_json = json.dumps({'jobs': jobs, 'rows': cost_rows, 'keys': LINE_KEYS,
                        'a6': cm['a6_job_cfdaefa8'], 'a7': cm['a7_same_job']['total'], 'per_repair': cm['per_repair_a7']})

calls_rows = ''.join(
    f'<tr><td>{E(name.split(" (")[0].capitalize())}</td><td class="mono">{E(c["model"])}</td>'
    f'<td class="num">{c["in_tok"]:,}</td><td class="num">{c["out_tok"]:,}</td><td class="num">{c["images"]}</td>'
    f'<td class="num">${c["usd"]:.4f}</td></tr>'
    for name, c in cm['a7_calls'].items())

# ---------- 21 steps ----------
stat_label = {'has': 'In A6', 'part': 'Partly in A6', 'none': 'Not in A6'}
counts = {k: sum(1 for s in STEPS if s[9] == k) for k in stat_label}
stage_cards = []
for code, name, desc, group in STAGES:
    steps = [s for s in STEPS if s[2] == code]
    items = []
    for (n, nm, st, does, inp, out, how, model, gate, a6, a6n) in steps:
        items.append(f'''<details class="step" data-a6="{a6}">
<summary><span class="sn">{n:02d}</span><span class="st">{E(nm)}</span><span class="sd">{E(does)}</span><span class="badge b-{a6}">{stat_label[a6]}</span></summary>
<dl>
<dt>Input</dt><dd>{E(inp)}</dd>
<dt>Output</dt><dd>{E(out)}</dd>
<dt>How</dt><dd>{E(how)}</dd>
<dt>Model</dt><dd class="mono">{E(model)}</dd>
<dt>Gate</dt><dd>{E(gate)}</dd>
<dt>A6 today</dt><dd>{E(a6n)}</dd>
</dl></details>''')
    stage_cards.append(f'''<section class="stage" id="stage-{code}">
<header><span class="scode">{code}</span><div><h3>{E(name)}</h3><p>{E(desc)}</p><p class="grp">Steps {steps[0][0]} to {steps[-1][0]} · group "{E(group)}"</p></div></header>
{''.join(items)}</section>''')

# ---------- tables ----------
def table(head, rows, cls=''):
    h = ''.join(f'<th>{E(x)}</th>' for x in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'

loops_t = table(['Loop', 'Steps', 'Starts when', 'What it does', 'Limit', 'Build in'],
                [[f'<b>{E(a)}</b>', E(b), E(c), E(d), E(e), f'<span class="ph">{E(f)}</span>'] for a, b, c, d, e, f in LOOPS])

AB_TRACES = [
 ("Defect repaired, package complete", "observed → planned → submitted → reviewing → repairable → submitted → reviewing → planned → submitted → reviewing → package → review_ready", "12 states · 30 units",
  "Same, plus one self-inspection after the plan", "13 states · 32 units", TRACES[0]),
 ("Critical evidence missing", "observed → held", "1 state · 0 spent", "observed → held", "1 state · 0 spent", TRACES[1]),
 ("Provider receipt uncertain", "observed → planned → submitted → uncertain (10 units stay reserved)", "4 states · 0 spent",
  "Same, plus one self-inspection", "5 states · 2 spent", TRACES[2]),
 ("Two repairs exhausted", "observed → planned → submitted → reviewing → repairable → submitted → reviewing → repairable → submitted → reviewing → held", "11 states · 30 units",
  "Same, plus one self-inspection", "12 states · 32 units", TRACES[3]),
]
trace_cards = []
for title, a, an, b, bn, (_, tone, steps, note) in AB_TRACES:
    chain = ''.join(f'<li><b>{E(x)}</b><span>{E(y)}</span></li>' for x, y in steps)
    trace_cards.append(f'''<article class="trace t-{tone}"><h4>{E(title)}</h4>
<div class="ab"><div><p class="lbl">A · controlled workflow</p><p class="seq">{E(a)}</p><p class="meta">{E(an)}</p></div>
<div><p class="lbl">B · one agent + backend rules</p><p class="seq">{E(b)}</p><p class="meta">{E(bn)}</p></div></div>
<p class="lbl">A7 path (step numbers)</p><ol class="chain">{chain}</ol><p class="note">{E(note)}</p></article>''')

cases_t = table(['Case', 'Input', 'A7 path (step numbers)', 'Result'],
                [[f'<b>{E(a)}</b>', E(c), E(d), E(e)] for a, b, c, d, e in CASES])
combo_t = table(['#', 'Case', 'Portal choice', 'A7 route and locks', 'Package', 'Key steps'],
                [[E(a), f'<b>{E(b)}</b>', E(c), E(d), E(e), f'<span class="mono">{E(f)}</span>'] for a, b, c, d, e, f in COMBOS])
models_t = table(['Job', 'A6 today', 'A7', 'Price per 1M tokens (in / out)', 'Why'],
                 [[E(a), f'<span class="mono muted">{E(b)}</span>', f'<span class="mono">{E(c)}</span>', E(d), E(e)] for a, b, c, d, e in MODELS])

gap_html = ''
for tier, rows in GAPS.items():
    li = ''.join(f'<li><b>{E(a)}</b> <span class="mono muted">step {E(b)}</span><br><span class="muted">A6: {E(c)}</span></li>' for a, b, c in rows)
    gap_html += f'<div class="gapcol g-{tier.lower()}"><h4>{tier} <span class="cnt">{len(rows)}</span></h4><ul>{li}</ul></div>'

PAGE = f'''<title>Midas A7 Blueprint</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Playfair+Display:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{{--ink:#121111;--text:#363636;--muted:#606060;--page:#FFFFFF;--off:#F6F6F6;--soft:#F9F9F9;--line:#E9E9E9;--line2:#D1D1D1;
--red:#B22020;--redbg:#FFF1F1;--gold:#F5CD6F;--goldbg:#FFF8E6;--ok:#2F6B3B;--okbg:#EEF6EF;--warn:#8A5A00;--warnbg:#FFF6E0;--blue:#24507A;--bluebg:#EEF3F8;
--sans:"Nord","Figtree",system-ui,-apple-system,"Segoe UI",sans-serif;--serif:"Playfair Display",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace;color-scheme:light}}
*{{box-sizing:border-box}}
body{{background:var(--page);color:var(--text);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1180px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 64px}}
h1,h2{{font-family:var(--serif);color:var(--ink);font-weight:600;letter-spacing:-.5px;text-wrap:balance;margin:0}}
h1{{font-size:clamp(30px,5vw,46px);line-height:1.1}} h2{{font-size:clamp(24px,3.4vw,32px);line-height:1.2}}
h3,h4{{color:var(--ink);font-weight:600;margin:0;text-wrap:balance}} h3{{font-size:19px}} h4{{font-size:16px}}
p{{margin:0}} .muted{{color:var(--muted)}} .mono{{font-family:var(--mono);font-size:.86em}}
a{{color:var(--red)}}
.top{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(6px)}}
.top nav{{max-width:1180px;margin:0 auto;display:flex;gap:4px;overflow-x:auto;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));scrollbar-width:none}}
.top a{{white-space:nowrap;text-decoration:none;color:var(--muted);font-size:13px;font-weight:500;padding:5px 11px;border-radius:30px}}
.top a:hover{{color:var(--ink);background:var(--off)}}
.hero{{padding-block:48px 28px;display:grid;gap:18px;border-bottom:1px solid var(--line)}}
.eyebrow{{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--red);font-weight:600}}
.lede{{font-size:17px;max-width:68ch;color:var(--text)}}
.status{{display:flex;flex-wrap:wrap;gap:8px}}
.pill{{font-size:12.5px;padding:4px 11px;border-radius:30px;border:1px solid var(--line2);background:var(--soft);color:var(--text)}}
.pill.red{{border-color:#E7B9B9;background:var(--redbg);color:var(--red)}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:6px}}
.kpi{{border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:var(--page)}}
.kpi b{{display:block;font:600 26px/1.15 var(--sans);color:var(--ink);font-variant-numeric:tabular-nums}}
.kpi span{{font-size:13px;color:var(--muted)}}
section.block{{padding-block:44px 8px;display:grid;gap:18px;scroll-margin-top:56px}}
.sub{{max-width:72ch;color:var(--muted)}}
.callout{{border-left:3px solid var(--red);background:var(--soft);padding:14px 18px;border-radius:0 8px 8px 0;max-width:80ch}}
.callout.gold{{border-left-color:#D9A93A;background:var(--goldbg)}}
.diagram{{margin:0;border:1px solid var(--line);border-radius:12px;background:var(--page);padding:14px;overflow-x:auto}}
.diagram pre{{margin:0;min-width:min(100%,560px);background:transparent}}
.grid2{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
.grid2>*{{min-width:0}}
.card{{border:1px solid var(--line);border-radius:10px;padding:16px 18px;background:var(--page);display:grid;gap:8px;align-content:start}}
.card ul,.card ol{{margin:0;padding-left:18px}} .card li{{margin:3px 0}}
.lbl{{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}}
.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:10px}}
table{{border-collapse:collapse;width:100%;font-size:13.5px;min-width:720px}}
th{{text-align:left;font-weight:600;color:var(--ink);background:var(--off);padding:9px 12px;border-bottom:1px solid var(--line2);font-size:12.5px}}
td{{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}}
td.num,th.num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
.ph{{font-size:12px;background:var(--bluebg);color:var(--blue);border-radius:30px;padding:2px 9px;white-space:nowrap}}
/* stages */
.filters{{display:flex;flex-wrap:wrap;gap:8px;align-items:center}}
.filters button{{font:500 13px var(--sans);border:1px solid var(--line2);background:var(--page);color:var(--text);border-radius:30px;padding:6px 13px;cursor:pointer}}
.filters button[aria-pressed=true]{{background:var(--ink);color:#fff;border-color:var(--ink)}}
.stage{{border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.stage>header{{display:flex;gap:14px;padding:16px 18px;background:var(--soft);border-bottom:1px solid var(--line)}}
.stage>header>div{{min-width:0;display:grid;gap:3px}}
.scode{{font:600 13px var(--mono);color:#fff;background:var(--ink);border-radius:8px;padding:6px 8px;height:fit-content}}
.grp{{font-size:12.5px;color:var(--muted)}}
.step{{border-top:1px solid var(--line)}} .step:first-of-type{{border-top:0}}
.step summary{{list-style:none;cursor:pointer;display:grid;grid-template-columns:34px minmax(0,190px) minmax(0,1fr) auto;gap:12px;align-items:baseline;padding:12px 18px}}
.step summary::-webkit-details-marker{{display:none}}
.step summary:hover{{background:var(--soft)}}
.step[open] summary{{background:var(--soft)}}
.sn{{font:600 13px var(--mono);color:var(--red)}} .st{{font-weight:600;color:var(--ink)}} .sd{{color:var(--muted);font-size:14px}}
.badge{{font-size:11.5px;font-weight:600;border-radius:30px;padding:2px 9px;white-space:nowrap}}
.b-has{{background:var(--okbg);color:var(--ok)}} .b-part{{background:var(--warnbg);color:var(--warn)}} .b-none{{background:var(--redbg);color:var(--red)}}
.step dl{{display:grid;grid-template-columns:110px minmax(0,1fr);gap:6px 14px;margin:0;padding:4px 18px 16px 64px;font-size:14px}}
.step dt{{color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;padding-top:2px}}
.step dd{{margin:0}}
.step.hide{{display:none}}
/* stage strip */
.strip{{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}}
.strip div{{border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:4px;align-content:start;background:var(--page)}}
.strip b{{font:600 12px var(--mono);color:var(--red)}} .strip span{{font-weight:600;color:var(--ink);font-size:14px;line-height:1.3}} .strip small{{color:var(--muted);font-size:12.5px;line-height:1.4}}
/* traces */
.trace{{border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:grid;gap:10px;border-top:3px solid var(--line2)}}
.t-ok{{border-top-color:var(--ok)}} .t-hold{{border-top-color:var(--red)}} .t-warn{{border-top-color:#D9A93A}}
.ab{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}}
.ab>div{{background:var(--soft);border-radius:8px;padding:10px 12px;display:grid;gap:4px;min-width:0}}
.seq{{font:12.5px/1.55 var(--mono);color:var(--ink);overflow-wrap:anywhere}} .meta{{font-size:12.5px;color:var(--muted)}}
.chain{{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}}
.chain li{{display:flex;flex-direction:column;border:1px solid var(--line2);border-radius:8px;padding:5px 9px;font-size:12.5px;line-height:1.3;position:relative}}
.chain li b{{font:600 12px var(--mono);color:var(--red)}}
.note{{font-size:14px;color:var(--text)}}
/* cost */
.seg{{justify-self:start;display:inline-flex;border:1px solid var(--line2);border-radius:30px;padding:3px;gap:2px;flex-wrap:wrap}}
.seg button{{font:500 13px var(--sans);border:0;background:transparent;border-radius:30px;padding:6px 12px;cursor:pointer;color:var(--text)}}
.seg button[aria-pressed=true]{{background:var(--ink);color:#fff}}
.bars{{display:grid;gap:14px}}
.bjob{{display:grid;gap:6px}}
.bjob h4{{font-size:14px}}
.brow{{display:grid;grid-template-columns:150px minmax(0,1fr) 70px;gap:10px;align-items:center;font-size:13px}}
.btrack{{height:20px;background:var(--off);border-radius:5px;display:flex;overflow:hidden}}
.btrack i{{display:block;height:100%}}
.bval{{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink)}}
.legend{{display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:var(--muted)}}
.legend span::before{{content:"";display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:var(--c)}}
.cmp{{display:grid;gap:10px}}
.cmp .brow{{grid-template-columns:200px minmax(0,1fr) 70px}}
/* gaps */
.gaps{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}}
.gapcol{{border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:10px;align-content:start;min-width:0}}
.gapcol h4{{display:flex;justify-content:space-between;align-items:center}}
.cnt{{font:600 12px var(--mono);background:var(--off);border-radius:30px;padding:2px 9px}}
.g-must{{border-top:3px solid var(--red)}} .g-should{{border-top:3px solid #D9A93A}} .g-later{{border-top:3px solid var(--line2)}}
.gapcol ul{{list-style:none;margin:0;padding:0;display:grid;gap:10px;font-size:14px}}
.gapcol li{{padding-bottom:10px;border-bottom:1px solid var(--line)}} .gapcol li:last-child{{border:0;padding:0}}
.decisions{{counter-reset:d;list-style:none;margin:0;padding:0;display:grid;gap:10px}}
.decisions li{{counter-increment:d;display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;border:1px solid var(--line);border-radius:10px;padding:12px 14px}}
.decisions li::before{{content:counter(d);font:600 13px var(--mono);color:#fff;background:var(--red);border-radius:50%;width:24px;height:24px;display:grid;place-items:center}}
footer{{border-top:1px solid var(--line);margin-top:48px;padding-top:20px;font-size:13px;color:var(--muted);display:grid;gap:6px}}
@media (max-width:860px){{.strip{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
@media (max-width:640px){{
 .step summary{{grid-template-columns:30px minmax(0,1fr);row-gap:2px}} .step .sd{{grid-column:2}} .step .badge{{grid-column:2;justify-self:start}}
 .step dl{{grid-template-columns:1fr;padding:4px 16px 14px 16px}} .step dt{{padding-top:6px}}
 .brow,.cmp .brow{{grid-template-columns:1fr 64px}} .brow .btrack{{grid-column:1/-1;grid-row:2}}
}}
</style>

<div class="top"><nav aria-label="Sections">
<a href="#answer">Answer</a><a href="#ab">A vs B</a><a href="#flow">Workflow</a><a href="#steps">21 steps</a><a href="#loops">Loops</a><a href="#traces">Traces</a><a href="#cases">Cases</a><a href="#portal">Client page</a><a href="#multi">Products &amp; rooms</a><a href="#models">Models</a><a href="#cost">Cost</a><a href="#gaps">A6 → A7</a><a href="#decide">Decisions</a>
</nav></div>

<div class="wrap">
<header class="hero" id="answer">
<p class="eyebrow">Midas Virtual Studio · design for pipeline A7 · 14 Oct 2026</p>
<h1>A7: one controlled workflow, counts first</h1>
<p class="lede">A7 keeps Architecture A: code decides the next stage and specialist models do the reading, planning, image making and checking. It closes the gap that let today's sectional sofa pass with fewer pieces than the product has. It adds the client page's missing inputs (several files, several outcomes, rooms, edits) and records the real cost of every job.</p>
<div class="status"><span class="pill red">Design only. Nothing built in n8n.</span><span class="pill">No paid calls made for this page</span><span class="pill">Costs are estimates, not invoices</span><span class="pill">A6 stays published and unchanged</span></div>
<div class="kpis">
<div class="kpi"><b>6 · 21 · 5</b><span>stages · steps · loops</span></div>
<div class="kpi"><b>{counts["has"]} / {counts["part"]} / {counts["none"]}</b><span>steps in A6 · partly · missing</span></div>
<div class="kpi"><b>${cm["a7_same_job"]["total"]:.3f}</b><span>A7 estimate for today's job (A6: ${cm["a6_job_cfdaefa8"]["total"]:.3f})</span></div>
<div class="kpi"><b>+${cm["per_repair_a7"]:.3f}</b><span>each repair (new image + 3 checks)</span></div>
</div>
</header>

<section class="block" id="ab">
<h2>Controlled workflow or one agent</h2>
<p class="sub">Both designs share six foundations: the original identity, a versioned contract, genuine Midas references, evidence-based review, bounded spend and a complete-package gate. They differ in who chooses the next action.</p>
<div class="grid2">
<div class="card"><p class="lbl">A · Surgical replacement · recommended for A7</p><h3>Code chooses; models perform</h3>
<ul><li>Predictable steps, small prompts, cost bounds you can inspect, stable recovery.</li><li>The reviewer is a separate call, and in A7 a different model family from the planner.</li><li>Fits n8n: every step is a node or a small sub-workflow.</li><li>Risk: brittle on new kinds of input. A7 answers that with the Evidence loop: hold and ask, never guess.</li></ul></div>
<div class="card"><p class="lbl">B · One agent with backend rules · not for now</p><h3>One agent does everything</h3>
<ul><li>Better at ambiguous briefs and exploring compositions.</li><li>Reviews its own images. The source calls this "self-review" and says it is not independent.</li><li>More turns, longer context, harder to bound cost. It costs more in every control trace below.</li><li>Not built. The sources say a hybrid is "a result to earn through comparison".</li></ul></div>
</div>
<p class="callout"><b>Recommendation.</b> Build A7 as Architecture A. Try B, or an A/B hybrid for difficult compositions, only after the anchor set (step 18) shows it wins on false approvals and cost per accepted package.</p>
</section>

<section class="block" id="flow">
<h2>The A7 workflow</h2>
<p class="sub">Six stages hand one record to the next. Red hexagons are holds and reconciliation; gold rounded boxes are the owner's decisions. Repairs go back to stage 04, missing evidence goes back to stage 01, and nothing reaches the client as "Approved" without the owner.</p>
<div class="strip">{''.join(f'<div><b>{c}</b><span>{E(n)}</span><small>{E(d)}</small></div>' for c, n, d, g in STAGES)}</div>
{mermaid(FLOW, "A7 workflow with 21 steps, gates and loops")}
<h3>What each stage hands to the next</h3>
{mermaid(HANDOFF, "Stage hand-offs")}
</section>

<section class="block" id="steps">
<h2>The 21 steps</h2>
<p class="sub">Every step with its input, output, how it runs, its model, its gate and its state in A6 today. The 21 are responsibilities, not 21 model calls: most are code, and several share one call. Open a step for detail.</p>
<div class="filters" role="group" aria-label="Filter by state in A6">
<button aria-pressed="true" data-f="all">All 21</button><button aria-pressed="false" data-f="none">Missing in A6 ({counts["none"]})</button><button aria-pressed="false" data-f="part">Partly in A6 ({counts["part"]})</button><button aria-pressed="false" data-f="has">In A6 ({counts["has"]})</button>
</div>
{''.join(stage_cards)}
</section>

<section class="block" id="loops">
<h2>Five loops and when to build each</h2>
<p class="sub">Each loop has a trigger, a limit and a stop. Four run inside a job; the Evaluation loop runs outside live jobs. All five follow the same correction rules: re-attach the original every time, repair only the named defect, check untouched areas again, reject new regressions, stop when evidence is missing or a limit is reached.</p>
{loops_t}
<p class="callout gold"><b>The rule that holds every loop together:</b> "Passing a visual check produces a reviewed candidate; owner approval and complete package checks remain separate."</p>
</section>

<section class="block" id="traces">
<h2>The four control scenarios, traced</h2>
<p class="sub">States from the reference controller in the architecture files, run locally on 14 Oct with no network. Units are the controller's abstract cost units, not money. Below each, the same scenario as A7 steps.</p>
<div class="grid2">{''.join(trace_cards)}</div>
<h3>The responsibility that cannot disappear at deployment</h3>
<div class="grid2">
<div class="card"><p class="lbl">Brain → steps 7, 8, 9</p><p>Interpret the request, reconcile counts and conflicts, set the locks, choose the composition, plan the outputs.</p></div>
<div class="card"><p class="lbl">Operator → steps 13, 14, 15, 21</p><p>Attach references, write and submit the request, choose the model, check status, keep candidates, export files, count cost.</p></div>
<div class="card"><p class="lbl">Critique → steps 16, 17, 18</p><p>Compare originals and results, name defects, keep style separate from identity, pick repair targets, stop sequences that do not resolve.</p></div>
<div class="card"><p class="lbl">What A7 must carry</p><p>In the case histories a person did these jobs in chat. A deployed pipeline needs the same inputs, saved decisions, evidence, rights to act and release rules, with no one in the chat.</p></div>
</div>
</section>

<section class="block" id="cases">
<h2>Real cases through A7</h2>
<p class="sub">The four cases from the architecture files, plus today's run 362 for the sectional sofa (job cfdaefa8).</p>
{cases_t}
</section>

<section class="block" id="portal">
<h2>What the client page needs</h2>
<div class="grid2">
<div class="card"><p class="lbl">Projects tab</p><h3>Start by intent</h3><p>Four starts: <b>Product or collection</b>, <b>Existing room</b>, <b>New styled space</b>, <b>Saved project</b>. The workflow chooses the rest from the input, the category and the result asked for. Use it for a fast start.</p></div>
<div class="card"><p class="lbl">Manual tab</p><h3>Start by job type</h3><p><b>New Project</b> (Batch or One by one), <b>Edit</b> (Choose from saving or New item), <b>Single item</b> (Hero or Secondary), then Item, Scope, Preferences and Suggestions. Use it for control over role, preferences and suggestions.</p></div>
<div class="card"><p class="lbl">Same in both</p><ul><li>One backend path: A7 receives the same brief either way.</li><li>Same items, six reference roles, seven outcomes.</li><li>A project carries the department, the accepted direction and the original references.</li></ul></div>
<div class="card"><p class="lbl">Different</p><ul><li>Rooms are explicit starts in Projects; Manual reaches them through Edit or a room reference.</li><li>Batch, One by one, Hero and Secondary exist only in Manual.</li><li>Preferences appear in Manual. Projects lets the workflow choose.</li><li>"New Project" is a Manual button; "Projects" is a tab. Keep both names, or rename one.</li></ul></div>
</div>
<h3>The nine "How choices combine" cases, mapped to A7</h3>
{combo_t}
<h3>Chat box, refine and variations</h3>
<div class="grid2">
<div class="card"><p class="lbl">What the sources show</p><ul><li>The target client page has no chat box. Refinement is a form field ("Custom prompting") and the Variations outcome.</li><li>The arafat preview has one: six chips (Accessories, Spaces, Views, White background, Lighting, Variations). Each message makes a new version with its own cost confirmation. Variations need an approved parent.</li></ul></div>
<div class="card"><p class="lbl">Effect on the workflow</p><ul><li>A message never edits an image in place. It creates a child job: brief v+1 linked to the parent, one changed axis, all other locks carried.</li><li>Old plans and reviews for that job are voided; the parent's results stay as history.</li><li>Cost and checks are the same as a new job. Free-text chat must pass step 1 like any instruction.</li></ul></div>
<div class="card"><p class="lbl">What the client page needs</p><ul><li>Phase 2: a "Refine" panel on each result: the chips, one short note, a plan preview, then confirm.</li><li>Phase 3: a chat box on the same mechanism, once refine works.</li><li>No internal or provider names; "Generated image" labels; "Approved" only from the owner.</li></ul></div>
</div>
{mermaid(REVISION, "Refine or variation as a new version")}
</section>

<section class="block" id="multi">
<h2>Several products, rooms and spaces</h2>
<div class="grid2">
<div class="card"><p class="lbl">Several products</p><ul>
<li><b>Several photos of one item are one item.</b> They are references with roles, not extra products.</li>
<li><b>A batch is N jobs</b>, each with its own route, checks and package. A towel, a lamp and a dining set never share one image.</li>
<li><b>One scene with several products</b> is New Composition: an inventory list with a count per item, and every item counted by the blind counters.</li>
<li><b>Midas supporting pieces</b> come from the SKU picker or the catalogue table, each with its photo.</li>
<li><b>"Multi-agent" in n8n</b> means parallel sub-workflow runs per item, one controller each, not agents talking to each other. A batch run splits items, runs them with a concurrency limit under the daily cap, then joins the packages.</li></ul></div>
<div class="card"><p class="lbl">Existing rooms</p><ul>
<li>The client uploads the room with the role <b>Room / target space</b>.</li>
<li>Step 6 records room locks: walls, windows, floor, camera and objects that must stay.</li>
<li>Step 8 allows changes only to the named pieces. Step 16 checks the room did not change.</li>
<li>No room measurements: scale stays "not confirmed" unless the client gives dimensions.</li></ul></div>
<div class="card"><p class="lbl">Creating and reusing a space</p><ul>
<li><b>New styled space:</b> the client describes a room; A7 plans it around the required pieces. Output: a room image and the plan.</li>
<li><b>Reuse:</b> today the only stated path is a previous generation or a saved project ("Reuse the accepted space").</li>
<li><b>Proposal, not in any source:</b> a saved-spaces library per project. An owner-approved room image becomes a <span class="mono">target_room</span> reference other jobs can pick. Your decision.</li></ul></div>
</div>
<h3>How the records fit together</h3>
{mermaid(DATA, "Data model")}
</section>

<section class="block" id="models">
<h2>Models</h2>
<p class="sub">Your choices, with image generation fixed on <span class="mono">gemini-nano-banana-2.1</span>. Prices checked on 14 Oct 2026 from the providers' pricing pages.</p>
<p class="callout"><b>A naming note.</b> There is no "Nano Banana Pro 2.1". The model id <span class="mono">gemini-nano-banana-2.1</span> is Google's "Nano Banana 2.1", the efficient tier, stable since 6 Oct 2026. "Nano Banana Pro" is a different model, <span class="mono">gemini-3-pro-image</span>, which A6 uses today through fal.ai. A7 uses 2.1 as you asked; check it on products with known piece counts before it replaces Pro on every job.</p>
{models_t}
<p class="sub">Reviewers and counters come from a different family than the planner, so one model's blind spot cannot pass its own work. OpenAI removes gpt-4.1 and gpt-4o from the API on 14 Jan 2027; A6 depends on both. Gemini 3.8 Flash prices double on 1 Jan 2027.</p>
</section>

<section class="block" id="cost">
<h2>Cost per job</h2>
<p class="sub">Estimated in USD. Token sizes come from the real calls of run 362, divided by four characters per token; n8n does not store token use. Excluded: the n8n plan, storage and the owner's time.</p>
<div class="seg" role="group" aria-label="Price basis">
<button aria-pressed="true" data-k="total">Google direct</button><button aria-pressed="false" data-k="total_fal">Through fal.ai</button><button aria-pressed="false" data-k="total_think3">Thinking ×3 (sensitivity)</button>
</div>
<div class="legend" id="legend"></div>
<p class="sub" id="splitnote" hidden>The split by line is shown for Google direct only; this view shows totals.</p>
<div class="bars" id="bars"></div>
<div class="tw"><table id="costtable"><thead><tr><th>Job</th><th class="num">No correction</th><th class="num">1 repair per image</th><th class="num">2 repairs per image (maximum)</th></tr></thead><tbody></tbody></table></div>
<h3>Today's job: A6 against A7</h3>
<div class="cmp" id="cmp"></div>
<p class="sub">Most of the difference is the image price: A6 pays a flat $0.20 for the Flux white image and $0.15 for each Nano Banana Pro image on fal.ai. A7 adds three checks per image (two blind counts and the counting audit) and still costs less. The cheaper image model is the reason, and its quality is not yet tested.</p>
<details class="step"><summary><span class="sn">$</span><span class="st">Cost of each A7 call</span><span class="sd">Tokens in, tokens out, images attached</span><span class="badge b-part">Estimate</span></summary>
<div class="tw" style="margin:0 18px 16px"><table><thead><tr><th>Step</th><th>Model</th><th class="num">Tokens in</th><th class="num">Tokens out</th><th class="num">Images</th><th class="num">USD</th></tr></thead><tbody>{calls_rows}</tbody></table></div></details>
<div class="callout"><b>Assumptions.</b> Reasoning tokens equal the visible output (×1); the ×3 view shows the effect if they run three times higher. The image token count for gpt-6.1-sol is not published; 2,000 is assumed. An image costs about $0.064 on Google directly: $0.0504 for the 2K output plus the prompt, two references and about 1,000 thinking tokens. On fal.ai it is about $0.075. White BK adds background removal at $0.018. Real costs will come from receipts once step 15 records them.</div>
</section>

<section class="block" id="gaps">
<h2>What A6 is missing</h2>
<p class="sub">Everything A7 needs that A6 lacks today, with the A7 step that fixes it.</p>
<div class="gaps">{gap_html}</div>
</section>

<section class="block" id="decide">
<h2>Build order and your decisions</h2>
<div class="grid2">
<div class="card"><p class="lbl">Phase 1 · the core</p><p>Count gates, structured intake (several references, outcomes, inventory), permanent copies, cost from receipts, reconcile path, neutral white master, new models, Evidence loop. Built as a new numbered pipeline, <span class="mono">Claude · Midas A7</span>, with its own addresses, run log and <span class="mono">claude-midas-a7-</span> run ids. Tested with pinned data first.</p></div>
<div class="card"><p class="lbl">Phase 2 · the client page</p><p>Projects tab, rooms, Edit and Variations as child jobs, Refine panel, SKU picker, client-safe replies, anchor set and Evaluation loop.</p></div>
<div class="card"><p class="lbl">Phase 3 · later</p><p>Chat box, saved-spaces library, three boards for New Composition, client plan preview, Arabic copy after a native review.</p></div>
</div>
<ol class="decisions">
<li><div><b>Approve this design</b> as the scope of phase 1, or tell me what to change.</div></li>
<li><div><b>Image model test.</b> A paid test on products with known piece counts, Nano Banana 2.1 against Pro. It needs your word in that message and a budget, for example 10 products.</div></li>
<li><div><b>Google direct or fal.ai for images.</b> Google is about 15% cheaper per image (about 7% per job) but needs a new Gemini key saved in n8n. fal.ai already has a key.</div></li>
<li><div><b>Permanent storage</b> for sources and outputs. Pick the store; the fal.ai links can expire.</div></li>
<li><div><b>Show cost to the client?</b> The arafat preview shows a credit estimate before each version. The client page shows none today.</div></li>
<li><div><b>Saved spaces and the chat box:</b> keep them in phase 3, move them earlier, or drop them.</div></li>
<li><div><b>Still open from before:</b> hide run data and change both keys; fix the owner key in n8n; client-safe replies; limit CORS to the portal; the daily cap; permanent storage.</div></li>
</ol>
</section>

<footer>
<p><b>Sources:</b> the studio-architectures and workflow-pipelines pages and their files (two-architectures.txt, framework.json, coverage.json, controller.mjs, cases), the client-first-page and its guide, and the arafat studio preview, all read on 14 Oct 2026. A6 in n8n: workflow FPAF0QHltl8iIcdZ, version b1b0f696, run 362. Prices: ai.google.dev pricing and the gemini-nano-banana-2.1 model page (updated 6 Oct 2026), developers.openai.com pricing, fal.ai model pages, Anthropic pricing.</p>
<p>Scores in any review are model judgements, not measurements. The 90 to 95 fidelity target is not achieved by A6 or by this design. A passed review is a reviewed candidate, not an approval.</p>
</footer>
</div>

<script>
const COST = {cost_json};
const COLORS = ["#121111","#B22020","#D9A93A","#24507A","#8A8A8A"];
const CASES = ["no correction","one repair per image","two repairs per image (maximum)"];
let key = "total";
const $ = s => document.querySelector(s);
function legend(){{ $("#legend").innerHTML = COST.keys.map((k,i)=>`<span style="--c:${{COLORS[i]}}">${{k}}</span>`).join(""); }}
function draw(){{
  const all = COST.jobs.flatMap(j=>COST.rows[j].map(r=>r[key]));
  const max = Math.max(...all, COST.a6.total) * 1.02;
  $("#bars").innerHTML = COST.jobs.map(j => `<div class="bjob"><h4>${{j}}</h4>` + COST.rows[j].map(r => {{
      const segs = key==="total" ? COST.keys.map((k,i)=>`<i title="${{k}}: $${{r.lines[k].toFixed(3)}}" style="width:${{(r.lines[k]/max*100).toFixed(2)}}%;background:${{COLORS[i]}}"></i>`).join("")
                                 : `<i style="width:${{(r[key]/max*100).toFixed(2)}}%;background:#5A5656"></i>`;
      return `<div class="brow"><span>${{r.case.replace(" (maximum)"," (max)")}}</span><div class="btrack" role="img" aria-label="${{j}}, ${{r.case}}: $${{r[key].toFixed(3)}}">${{segs}}</div><span class="bval">$${{r[key].toFixed(3)}}</span></div>`;
  }}).join("") + `</div>`).join("");
  $("#costtable tbody").innerHTML = COST.jobs.map(j => `<tr><td>${{j}}</td>` + CASES.map(c => {{
      const r = COST.rows[j].find(x=>x.case===c); return `<td class="num">$${{r[key].toFixed(3)}}</td>`; }}).join("") + `</tr>`).join("");
  const a7 = COST.rows[COST.jobs[1]].find(x=>x.case===CASES[0]);
  const row = (label, lines, total) => `<div class="brow"><span>${{label}}</span><div class="btrack">${{COST.keys.map((k,i)=>`<i title="${{k}}: $${{(lines[k]||0).toFixed(3)}}" style="width:${{((lines[k]||0)/max*100).toFixed(2)}}%;background:${{COLORS[i]}}"></i>`).join("")}}</div><span class="bval">$${{total.toFixed(3)}}</span></div>`;
  const a7row = key==="total" ? row("A7, same job, no repair", a7.lines, a7.total)
     : `<div class="brow"><span>A7, same job, no repair</span><div class="btrack"><i style="width:${{(a7[key]/max*100).toFixed(2)}}%;background:#5A5656"></i></div><span class="bval">$${{a7[key].toFixed(3)}}</span></div>`;
  $("#cmp").innerHTML = row("A6 run 362 (fal.ai, as run)", COST.a6.lines, COST.a6.total) + a7row;
  $("#legend").hidden = false; $("#splitnote").hidden = key==="total";
}}
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {{
  document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed", x===b)); key = b.dataset.k; draw(); }}));
document.querySelectorAll(".filters button").forEach(b => b.addEventListener("click", () => {{
  document.querySelectorAll(".filters button").forEach(x=>x.setAttribute("aria-pressed", x===b));
  const f = b.dataset.f; document.querySelectorAll("#steps .step").forEach(s => s.classList.toggle("hide", f!=="all" && s.dataset.a6!==f)); }}));
legend(); draw();
</script>
'''
open(OUT, 'w', encoding='utf-8').write(PAGE)
print(OUT, len(PAGE), 'chars; steps', len(STEPS), counts)
for name, src in [('flow', FLOW), ('handoff', HANDOFF), ('ab', AB), ('data', DATA), ('revision', REVISION)]:
    open(f'mmd_{name}.mmd', 'w').write(src)
