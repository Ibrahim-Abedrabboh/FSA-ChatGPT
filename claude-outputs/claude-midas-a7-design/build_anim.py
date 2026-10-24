"""Builds claude-midas-a7-stages-animated-2026-10-14.html: an animated walk through the 6 stages and 21 steps of A7.
Step data comes from content.py (same source as the blueprint). Design only."""
import json
from content import STAGES, STEPS

META = {
 "01": dict(
   happens=["The request and every file arrive. Each file is copied to storage and fingerprinted before anything else runs.",
            "One vision call lists every piece with a box around it, so the count is the length of a list.",
            "A second model family counts the source photo on its own. Signs are read: crosses, insets, swatches, printed counts.",
            "Every fact gets a basis: seen, supplied, inferred, unknown or conflicted."],
   passes="Observation record: typed facts, boxes, counts, unknowns",
   loop="Evidence loop", hold="A critical unknown, or two source counts that disagree: the job holds and the client is asked one question. Nothing is paid."),
 "02": dict(
   happens=["Code chooses the route from the category, the item's role and the outcomes asked for.",
            "Each output gets its locks (what must not change) and its freedoms (what may).",
            "A small model sorts any conflicts; code writes them to the ledger.",
            "The contract is stamped as version N. A new version cancels every older plan and review."],
   passes="Contract vN, stamped and stored",
   loop="Evidence loop", hold="A critical conflict holds before any money is spent."),
 "03": dict(
   happens=["Code filters the Midas catalogue; the client's own picks stay fixed. Nothing is called Midas without its SKU and photo.",
            "One model plans each image; a model from another family checks the plan against the contract.",
            "The item's role decides what leads the scene: furniture, an accessory or a supporting piece."],
   passes="Shortlist and one scene plan per output",
   loop="Styling loop", hold="A plan that breaks a lock is re-planned, at most twice, then held.", gate="Owner go 1: the plan is approved before any paid image."),
 "04": dict(
   happens=["Code writes the exact request: the vendor photo is always image 1, then the preserve list and the frame.",
            "The registry picks the model with its dated price.",
            "Cost is reserved and the call is claimed; the image is made; the receipt and actual cost are stored; the image is copied to storage."],
   passes="Candidate image with receipt, cost and hash",
   loop="Recovery loop", hold="No receipt: ask the provider about the same request id. A second paid call is never sent automatically."),
 "05": dict(
   happens=["The reviewer compares the candidate with the original on 7 checks.",
            "Two counters from two model families count the pieces without being told the expected number. Code compares both with the contract.",
            "A defect gets one targeted repair, back through stage 04, with every lock checked again.",
            "Kept images get an audit that also counts, and a final inspection across the set."],
   passes="Reviewed candidates (not approvals)",
   loop="Image loop", hold="After two repairs the output is held with its reason. A rejected image never becomes a reference.", gate="Owner go 2: after the white master passes."),
 "06": dict(
   happens=["The manifest checks every required output is reviewed and current.",
            "The description is written from recorded facts only, then checked line by line.",
            "The owner approves or holds. Only that decision makes an image “Approved”.",
            "The real cost of the job and of each accepted package is recorded."],
   passes="Package for the owner, or an explicit hold",
   loop="Evaluation loop (offline)", hold="One good image is not a complete package. Missing outputs keep it incomplete.", gate="Owner decision"),
}

stages = []
for code, name, desc, group in STAGES:
    m = META[code]
    stages.append(dict(code=code, name=name, desc=desc, group=group, **m,
        steps=[dict(n=s[0], name=s[1], does=s[3], inp=s[4], out=s[5], how=s[6], model=s[7], gate=s[8]) for s in STEPS if s[2] == code]))
DATA = json.dumps(stages, ensure_ascii=False)

PAGE = r'''<title>A7 Stages in Motion</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Playfair+Display:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{--ink:#121111;--text:#363636;--muted:#606060;--page:#FFFFFF;--off:#F6F6F6;--soft:#F9F9F9;--line:#E9E9E9;--line2:#D1D1D1;
--red:#B22020;--redbg:#FFF1F1;--gold:#C9962A;--goldbg:#FFF8E6;--ok:#2F6B3B;--okbg:#EEF6EF;
--sans:"Nord","Figtree",system-ui,-apple-system,"Segoe UI",sans-serif;--serif:"Playfair Display",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace;color-scheme:light}
*{box-sizing:border-box}
body{background:var(--page);color:var(--text);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:32px 56px;display:grid;gap:22px}
h1,h2{font-family:var(--serif);color:var(--ink);font-weight:600;margin:0;letter-spacing:-.4px;text-wrap:balance}
h1{font-size:clamp(28px,4.4vw,40px);line-height:1.1}
h2{font-size:clamp(22px,3vw,30px);line-height:1.15}
p{margin:0}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--red);font-weight:600}
.lede{max-width:66ch;color:var(--muted)}
.pill{font-size:12.5px;padding:4px 11px;border-radius:30px;border:1px solid #E7B9B9;background:var(--redbg);color:var(--red);justify-self:start}
/* controls */
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;position:sticky;top:env(safe-area-inset-top,0px);background:rgba(255,255,255,.95);backdrop-filter:blur(6px);z-index:5;padding-block:10px;border-bottom:1px solid var(--line)}
.bar button{font:600 14px var(--sans);border:1px solid var(--ink);background:var(--page);color:var(--ink);border-radius:30px;padding:7px 16px;cursor:pointer}
.bar button.primary{background:var(--ink);color:#fff}
.bar button:disabled{opacity:.35;cursor:default}
.bar .speed{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-left:auto}
.bar select{font:500 13px var(--sans);border:1px solid var(--line2);border-radius:8px;padding:5px 8px;background:var(--page);color:var(--ink)}
/* track */
.track{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;padding-top:6px}
.rail{position:absolute;left:8%;right:8%;top:27px;height:3px;background:var(--line);border-radius:3px}
.rail i{display:block;height:100%;width:0;background:var(--red);border-radius:3px;transition:width .9s cubic-bezier(.4,0,.2,1)}
.node{position:relative;display:grid;justify-items:center;gap:6px;background:none;border:0;cursor:pointer;padding:0;font:inherit;color:inherit}
.node .dot{width:44px;height:44px;border-radius:50%;border:2px solid var(--line2);background:var(--page);display:grid;place-items:center;font:600 13px var(--mono);color:var(--muted);transition:all .4s}
.node .nm{font-size:12.5px;font-weight:600;color:var(--muted);text-align:center;line-height:1.25;transition:color .4s}
.node.done .dot{border-color:var(--red);color:var(--red)}
.node.on .dot{background:var(--red);border-color:var(--red);color:#fff;transform:scale(1.12);box-shadow:0 0 0 6px rgba(178,32,32,.12)}
.node.on .nm,.node.done .nm{color:var(--ink)}
.token{position:absolute;top:17px;width:24px;height:24px;margin-left:-12px;border-radius:6px;background:var(--gold);box-shadow:0 2px 8px rgba(0,0,0,.18);transition:left .9s cubic-bezier(.4,0,.2,1);display:grid;place-items:center;font:700 10px var(--mono);color:var(--ink);z-index:2;pointer-events:none}
/* stage panel */
.panel{border:1px solid var(--line);border-radius:14px;overflow:hidden;min-height:420px}
.phead{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;padding:20px 22px;background:var(--soft);border-bottom:1px solid var(--line)}
.big{font:600 34px/1 var(--mono);color:var(--red)}
.phead p{color:var(--muted);max-width:70ch}
.grp{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.pbody{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:0}
.col{padding:18px 22px;display:grid;gap:12px;align-content:start;min-width:0}
.col+.col{border-left:1px solid var(--line)}
.lbl{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600}
.happen{list-style:none;margin:0;padding:0;display:grid;gap:10px;counter-reset:h}
.happen li{counter-increment:h;display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;font-size:14.5px}
.happen li::before{content:counter(h);width:22px;height:22px;border-radius:50%;background:var(--off);color:var(--ink);font:600 11.5px var(--mono);display:grid;place-items:center;margin-top:2px}
.step{border:1px solid var(--line);border-radius:10px;background:var(--page);overflow:hidden}
.step>button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:baseline;width:100%;padding:11px 14px}
.step>button:focus-visible{outline:2px solid var(--red);outline-offset:-2px}
.sn{font:600 13px var(--mono);color:var(--red)}
.st{font-weight:600;color:var(--ink)}
.sd{display:block;font-size:13.5px;color:var(--muted);font-weight:400}
.chev{font-size:12px;color:var(--muted);transition:transform .3s}
.step.open .chev{transform:rotate(90deg)}
.detail{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s ease}
.step.open .detail{grid-template-rows:1fr}
.detail>div{overflow:hidden}
.detail dl{margin:0;padding:2px 14px 14px 58px;display:grid;grid-template-columns:78px minmax(0,1fr);gap:5px 12px;font-size:13.5px}
.detail dt{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:600;padding-top:2px}
.detail dd{margin:0}
.mono{font-family:var(--mono);font-size:.88em}
.box{border-radius:10px;padding:12px 14px;font-size:14px;display:grid;gap:4px}
.box.pass{background:var(--okbg);border:1px solid #CFE3D3}
.box.hold{background:var(--redbg);border:1px solid #EFCACA}
.box.gate{background:var(--goldbg);border:1px solid #EBD9A8}
.box b{color:var(--ink)}
.loopchip{justify-self:start;font-size:12px;font-weight:600;border-radius:30px;padding:3px 10px;background:var(--off);color:var(--ink)}
.loopchip::before{content:"\21BB  "}
/* reveal animation */
.rv{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}
.rv.in{opacity:1;transform:none}
.flow{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);flex-wrap:wrap}
.arrow{flex:1;min-width:60px;height:2px;background:linear-gradient(90deg,var(--red) 50%,transparent 50%) 0 0/12px 2px repeat-x;animation:dash 1s linear infinite}
@keyframes dash{to{background-position:12px 0}}
.foot{font-size:13px;color:var(--muted);display:grid;gap:6px;border-top:1px solid var(--line);padding-top:16px}
@media (max-width:800px){.pbody{grid-template-columns:1fr}.col+.col{border-left:0;border-top:1px solid var(--line)}}
@media (max-width:560px){.node .nm{font-size:10.5px}.node .dot{width:36px;height:36px;font-size:11.5px}.rail{top:23px}.token{top:13px;width:20px;height:20px}
 .detail dl{grid-template-columns:1fr;padding:2px 14px 14px 14px}.phead{grid-template-columns:1fr;gap:6px}.bar .speed{margin-left:0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">
<header style="display:grid;gap:10px">
<p class="eyebrow">Midas Virtual Studio · A7 · Surgical replacement · 14 Oct 2026</p>
<h1>A7, stage by stage</h1>
<p class="lede">Press Play to follow one job through the six stages. Each stage shows what happens inside it, then its steps one by one. Open any step for its input, output, model and gate.</p>
<span class="pill">Design only. Nothing is built in n8n yet.</span>
</header>

<div class="bar" role="group" aria-label="Animation controls">
<button id="prev" aria-label="Previous stage">&#8592; Back</button>
<button id="play" class="primary">&#9654; Play</button>
<button id="next" aria-label="Next stage">Next &#8594;</button>
<button id="all">Open all steps</button>
<label class="speed">Speed <select id="speed"><option value="1.4">Slow</option><option value="1" selected>Normal</option><option value="0.6">Fast</option></select></label>
</div>

<div class="track" id="track" aria-label="Stages"><div class="rail"><i id="fill"></i></div><div class="token" id="token" aria-hidden="true">JOB</div></div>

<section class="panel" id="panel" aria-live="polite"></section>

<div class="foot">
<p>Step 19, the Vault, runs through every stage: each step writes its record there. Step 18, the benchmark, runs outside live jobs when a model or a prompt changes.</p>
<p>A passed review is a reviewed candidate, not an approval. Only the owner's recorded decision makes an image "Approved".</p>
</div>
</div>

<script>
const STAGES = __DATA__;
const $ = s => document.querySelector(s);
let cur = 0, playing = false, timers = [], allOpen = false;
const speed = () => parseFloat($('#speed').value);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const track = $('#track');
STAGES.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'node'; b.dataset.i = i;
  b.innerHTML = `<span class="dot">${s.code}</span><span class="nm">${esc(s.name)}</span>`;
  b.setAttribute('aria-label', `Stage ${s.code}: ${s.name}`);
  b.addEventListener('click', () => { stop(); show(i); });
  track.appendChild(b);
});

function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
function later(fn, ms){ timers.push(setTimeout(fn, reduced ? 0 : ms * speed())); }

function stepHTML(st){
  return `<div class="step rv${allOpen ? ' open' : ''}"><button aria-expanded="${allOpen}"><span class="sn">${String(st.n).padStart(2,'0')}</span><span><span class="st">${esc(st.name)}</span><span class="sd">${esc(st.does)}</span></span><span class="chev">&#9654;</span></button>
  <div class="detail"><div><dl><dt>Input</dt><dd>${esc(st.inp)}</dd><dt>Output</dt><dd>${esc(st.out)}</dd><dt>How</dt><dd>${esc(st.how)}</dd><dt>Model</dt><dd class="mono">${esc(st.model)}</dd><dt>Gate</dt><dd>${esc(st.gate)}</dd></dl></div></div></div>`;
}

function show(i){
  clearTimers();
  cur = i;
  const s = STAGES[i];
  document.querySelectorAll('.node').forEach((n, k) => { n.classList.toggle('on', k === i); n.classList.toggle('done', k < i); });
  const nodes = document.querySelectorAll('.node');
  const tr = track.getBoundingClientRect(), nr = nodes[i].getBoundingClientRect();
  $('#token').style.left = (nr.left - tr.left + nr.width / 2) + 'px';
  $('#fill').style.width = (i / (STAGES.length - 1) * 100) + '%';
  const next = STAGES[i + 1];
  $('#panel').innerHTML = `
   <div class="phead"><span class="big">${s.code}</span><div style="display:grid;gap:4px;min-width:0">
     <p class="grp">Steps ${s.steps[0].n} to ${s.steps[s.steps.length-1].n} · ${esc(s.group)}</p><h2>${esc(s.name)}</h2><p>${esc(s.desc)}</p></div></div>
   <div class="pbody">
     <div class="col"><p class="lbl">What happens inside</p><ol class="happen">${s.happens.map(h => `<li class="rv">${esc(h)}</li>`).join('')}</ol>
       <span class="loopchip rv">${esc(s.loop)}</span>
       <div class="box hold rv"><b>Stops here when</b><span>${esc(s.hold)}</span></div>
       ${s.gate ? `<div class="box gate rv"><b>Owner gate</b><span>${esc(s.gate)}</span></div>` : ''}
       <div class="box pass rv"><b>Passes on${next ? ' to ' + next.code + ' ' + esc(next.name) : ''}</b><span>${esc(s.passes)}</span></div>
       ${next ? `<div class="flow rv"><span>${s.code}</span><span class="arrow"></span><span>${next.code}</span></div>` : ''}</div>
     <div class="col"><p class="lbl">The steps in this stage</p>${s.steps.map(stepHTML).join('')}</div>
   </div>`;
  document.querySelectorAll('.step>button').forEach(b => b.addEventListener('click', () => {
    const st = b.parentElement; st.classList.toggle('open'); b.setAttribute('aria-expanded', st.classList.contains('open'));
  }));
  const happens = [...document.querySelectorAll('.happen .rv')];
  const steps = [...document.querySelectorAll('.step.rv')];
  const rest = [...document.querySelectorAll('.col > .rv')];
  let t = 150;
  happens.forEach(el => { later(() => el.classList.add('in'), t); t += 650; });
  steps.forEach(el => {
    later(() => el.classList.add('in'), t);
    if (playing && !allOpen) later(() => { el.classList.add('open'); el.querySelector('button').setAttribute('aria-expanded', 'true'); }, t + 450);
    if (playing && !allOpen) later(() => { el.classList.remove('open'); el.querySelector('button').setAttribute('aria-expanded', 'false'); }, t + 2600);
    t += playing ? 2900 : 350;
  });
  rest.forEach(el => { later(() => el.classList.add('in'), t); t += 450; });
  $('#prev').disabled = i === 0;
  $('#next').disabled = i === STAGES.length - 1;
  if (playing) later(() => { if (cur < STAGES.length - 1) show(cur + 1); else stop(); }, t + 2200);
}

function stop(){ playing = false; $('#play').innerHTML = '&#9654; Play'; }
$('#play').addEventListener('click', () => {
  if (playing) { stop(); clearTimers(); document.querySelectorAll('.rv').forEach(e => e.classList.add('in')); return; }
  playing = true; $('#play').innerHTML = '&#10074;&#10074; Pause';
  show(cur === STAGES.length - 1 ? 0 : cur);
});
$('#next').addEventListener('click', () => { stop(); if (cur < STAGES.length - 1) show(cur + 1); });
$('#prev').addEventListener('click', () => { stop(); if (cur > 0) show(cur - 1); });
$('#all').addEventListener('click', () => {
  allOpen = !allOpen; $('#all').textContent = allOpen ? 'Close all steps' : 'Open all steps';
  document.querySelectorAll('.step').forEach(s => { s.classList.toggle('open', allOpen); s.querySelector('button').setAttribute('aria-expanded', allOpen); });
});
addEventListener('keydown', e => { if (e.key === 'ArrowRight') $('#next').click(); if (e.key === 'ArrowLeft') $('#prev').click(); });
addEventListener('resize', () => { const nodes = document.querySelectorAll('.node'); const tr = track.getBoundingClientRect(), nr = nodes[cur].getBoundingClientRect(); $('#token').style.left = (nr.left - tr.left + nr.width / 2) + 'px'; });
show(0);
</script>
'''.replace('__DATA__', DATA)
OUT = 'claude-midas-a7-stages-animated-2026-10-14.html'
open(OUT, 'w', encoding='utf-8').write(PAGE)
print(OUT, len(PAGE), 'stages', len(stages), 'steps', sum(len(s['steps']) for s in stages))
