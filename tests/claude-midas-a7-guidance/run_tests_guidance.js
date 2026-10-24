const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.join(__dirname,'../../n8n/claude-midas-a7'),ref=path.join(base,'reference-review');
const raw=fs.readFileSync(path.join(ref,'guidance-baseline.json'),'utf8'),baseline=JSON.parse(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
const source=name=>fs.readFileSync(path.join(base,'code-nodes',name),'utf8');
test('baseline includes guide, atlas, Studio, category docs and all audited sample journeys',()=>{
 for(const suffix of ['/','/guide','/atlas','/workflow-docs/CATEGORY-GUIDE.html','/workflow-docs/CUMULATIVE-STEERING.md'])assert.ok(baseline.sources.some(s=>s.url==='https://midas-client-studio.arafat312096.chatgpt.site'+suffix));
 assert.equal(fs.readFileSync(path.join(ref,'a7-sample-review-index.csv'),'utf8').trim().split('\n').length-1,73);assert.equal(baseline.requirements.length,26);
});
test('source evidence changes require an explicit baseline update',()=>{for(const [file,sha] of Object.entries(baseline.evidence_files))assert.equal(crypto.createHash('sha256').update(file.endsWith('.csv') ? fs.readFileSync(path.join(ref,file),'utf8').replace(/\r?\n/g,'\r\n') : fs.readFileSync(path.join(ref,file))).digest('hex'),sha,file);});
test('new jobs require the baseline, and the baseline is hashed inside contracts',()=>{
 assert.match(source('01_Intent_scope.js'),/guidance_required: true/);
 const text=source('09b_Contract.js');assert.ok(text.includes(hash));assert.match(text,/const contract = \{\s+guidance,/);assert.match(text,/update\(canon\(contract\)\)/);
 assert.ok(source('13_Compile.js').includes(hash));assert.match(source('13_Compile.js'),/if \(s.guidance_required/);
});
test('open requirements remain explicit; historical examples are not new validation passes',()=>{
 assert.match(baseline.compliance,/partial/);assert.ok(baseline.requirements.some(r=>r.status==='pending'));
 assert.match(baseline.external_updates,/cannot change production instructions automatically/);
 assert.ok(baseline.owner_overrides.includes('n8n replaces Magnific'));
});
// 20 Oct 2026: checked against the live read-back, not the pre-guard baseline; 16a and 13 other files had drifted from live.
test('source export matches every revised guidance and release node',()=>{
 const w=JSON.parse(fs.readFileSync(path.join(base,'live','workflow-1cgZc9rmBOrPdKIe.json'),'utf8'));
 for(const name of ['01 Intent scope','09b Contract','13 Compile','G2 Go 2 verdict','18a Package ticket','18l Manifest','18p Package result','19a Scene ticket','20a Scene files ticket','20k Scene manifest','20m Scene files result','V1 Vault events']){
  const node=w.nodes.find(n=>n.name===name || (name==='01 Intent scope' && n.name==='01 Intent & scope'));assert.ok(node,name);
  assert.equal(node.parameters.jsCode.replace(/\n$/,''),source(name.replaceAll(' ','_')+'.js').replace(/\n$/,''),name);
 }
});
// Same file-name rule as tools/claude-midas-a7-export.py. Code nodes without a file (the Budget, Recovery, Blind and Package
// guards, built by budget-guards/) are not checked here; every file must still name a live Code node.
test('every code-node file equals its live Code node, ignoring one trailing newline',()=>{
 const w=JSON.parse(fs.readFileSync(path.join(base,'live','workflow-1cgZc9rmBOrPdKIe.json'),'utf8'));
 const fname=n=>n.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')+'.js',trim=s=>s.endsWith('\n')?s.slice(0,-1):s;
 const byFile=new Map(w.nodes.filter(n=>n.type==='n8n-nodes-base.code').map(n=>[fname(n.name),n]));
 const files=fs.readdirSync(path.join(base,'code-nodes')).filter(f=>f.endsWith('.js'));assert.ok(files.length>=58,'code-node files');
 for(const f of files){const node=byFile.get(f);assert.ok(node,f+' has no live Code node');assert.equal(trim(source(f)),trim(node.parameters.jsCode),f);}
});
// The root export is the pre-guard baseline that budget-guards/ builds live from (README.md); it must not be replaced by live.
test('root export stays the unguarded baseline of the live workflow',()=>{
 const root=JSON.parse(fs.readFileSync(path.join(base,'workflow-1cgZc9rmBOrPdKIe.json'),'utf8')),live=JSON.parse(fs.readFileSync(path.join(base,'live','workflow-1cgZc9rmBOrPdKIe.json'),'utf8'));
 assert.equal(JSON.parse(fs.readFileSync(path.join(base,'budget-guards','installed-version.json'),'utf8')).baseline,'../workflow-1cgZc9rmBOrPdKIe.json');
 assert.equal(root.id,live.id);
 assert.deepEqual(root.nodes.filter(n=>/^(Budget|Recovery|Blind|Package) · /.test(n.name)).map(n=>n.name),[]);
 const liveNames=new Set(live.nodes.map(n=>n.name));for(const n of root.nodes)assert.ok(liveNames.has(n.name),n.name+' is not in the live workflow');
});
