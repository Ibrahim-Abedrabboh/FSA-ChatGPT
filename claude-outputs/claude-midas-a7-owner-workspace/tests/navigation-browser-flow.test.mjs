import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map(),events=new Map(),pending=[],dispatched=[];
 function el(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{textContent:'',dataset:{},attributes:{},classList:{toggle(k,on){on??=!classes.has(k);on?classes.add(k):classes.delete(k);return on;},contains:k=>classes.has(k)},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){events.set(id+':'+k,fn);},replaceChildren(){},append(){},dispatchEvent(event){dispatched.push({id,event:event.type});},focus(){this.focused=true;},querySelector(){return el(id+'-heading');}});}return nodes.get(id);}
 const filters=['all','attention','progress','done'].map(k=>{const n=el('filter-'+k);n.dataset.filter=k;return n;});
 const prompt=el('quickPrompt');prompt.dataset.prompt='Synthetic quick instruction';
 const document={getElementById:el,createElement:()=>el('created-'+Math.random()),querySelector:s=>el(s),querySelectorAll:s=>s==='[data-filter]'?filters:s==='[data-prompt]'?[prompt]:[],addEventListener:(k,fn)=>events.set('document:'+k,fn)};
 vm.runInNewContext(source,{document,window:{scrollTo(){},dispatchEvent(){},addEventListener(){}},fetch:()=>new Promise(resolve=>pending.push(resolve)),AbortSignal,Intl,Date,Event,CustomEvent:class{}});
 return {el,events,pending,dispatched};
}
test('mobile menu opens with focus, exposes state, and Escape closes with focus restored',()=>{
 const s=setup();s.events.get('mobileMenu:click')();assert.equal(s.el('mobileMenu').attributes['aria-expanded'],'true');assert.equal(s.el('mobileMenu').attributes['aria-label'],'Close navigation');assert.equal(s.el('newCase').focused,true);
 s.events.get('document:keydown')({key:'Escape',preventDefault(){}});assert.equal(s.el('mobileMenu').attributes['aria-expanded'],'false');assert.equal(s.el('mobileMenu').focused,true);
});
test('queue filters announce selection and navigation focuses the visible heading',()=>{
 const s=setup();s.events.get('filter-attention:click')();assert.equal(s.el('filter-attention').attributes['aria-pressed'],'true');assert.equal(s.el('filter-all').attributes['aria-pressed'],'false');assert.equal(s.el('jobsView-heading').focused,true);
});
test('leaving a loading job prevents its late response from rendering or dispatching owner actions',async()=>{
 const s=setup();s.el('recentJobs');
 // Exercise the actual job function in the same runtime through a minimal exposed hook.
 const context={};
 // A separate context is unnecessary: use the existing navigation event to invalidate a pending job.
 // The source hook is test-only and does not change shipped code.
 const hook=source.slice(0,source.indexOf("$('refreshJobs').addEventListener"));
 const nodes=s.el;
 vm.runInNewContext(hook+"\nresult=openJob('test-run');show('studioView','Owner workspace');",Object.assign(context,{document:{getElementById:nodes,createElement:()=>nodes('temp'),querySelector:sel=>nodes(sel)},window:{dispatchEvent(){},scrollTo(){}},fetch:()=>Promise.resolve({ok:true,json:async()=>({job:{}})}),AbortSignal,Intl,Date,Event,CustomEvent:class{}}));
 await context.result;assert.equal(nodes('detailTitle').textContent,'Loading run…');
});

test('quick instruction buttons notify draft storage that the instruction changed',()=>{const s=setup();s.events.get('quickPrompt:click')();assert.equal(s.el('promptInput').value,'Synthetic quick instruction');assert.deepEqual(s.dispatched,[{id:'promptInput',event:'input'}]);});
