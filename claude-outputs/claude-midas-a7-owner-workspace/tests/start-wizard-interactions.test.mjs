import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../start.js',import.meta.url),'utf8');
const html=await readFile(new URL('../start.html',import.meta.url),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));

test('three creation modes retain their own route and original while switching',()=>{
 const state={intent:'',route:'',routes:{},primary:{file:{name:'original.png'}}};
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{id,hidden:false,children:[],replaceChildren(...items){this.children=items},append(...items){this.children.push(...items)},scrollIntoView(){}});return elements.get(id)};
 const document={createElement(tag){return {tag,children:[],append(...items){this.children.push(...items)},addEventListener(type,fn){this['on'+type]=fn}}}};
 const context={state,$,document,renderMode(){},renderResults(){},status(){}};
 runInNewContext(between('const routes =','const labelFor')+between('function showRoutes(intent)','function renderMode()')+'globalThis.show=showRoutes',context);
 context.show('project');
 const projectOne=$('routeOptions').children[0].children[0];projectOne.onchange();
 assert.equal(state.route,'one');
 context.show('single');
 const secondary=$('routeOptions').children[1].children[0];secondary.onchange();
 assert.equal(state.route,'secondary');
 context.show('edit');
 assert.deepEqual($('routeOptions').children.map(label=>label.children[0].value),['saved','new']);
 context.show('project');assert.equal(state.route,'one');
 context.show('single');assert.equal(state.route,'secondary');
 assert.equal(state.primary.file.name,'original.png');
});

test('Midas catalogue return text stays in the draft field without claiming import',()=>{
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn},dispatchEvent(event){this.handlers[event.type]?.(event)}});return nodes.get(id)};
 runInNewContext(between("$('sourceCatalogueRefs').addEventListener","$('prefAspect').addEventListener"),{$,Event});
 $('sourceCatalogueRefs').value='https://midasfurniture.com/product/example';$('sourceCatalogueRefs').handlers.input();
 assert.equal($('prefItems').value,$('sourceCatalogueRefs').value);
 $('prefItems').value='SKU-123';$('prefItems').handlers.input();assert.equal($('sourceCatalogueRefs').value,'SKU-123');
 assert.match(html,/href="https:\/\/midasfurniture\.com" target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/No catalogue product is imported or verified here/);
});

test('source-view drawer opens, closes and returns keyboard focus',()=>{
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{handlers:{},addEventListener(type,fn){this.handlers[type]=fn},showModal(){this.open=true},close(){this.open=false;this.handlers.close?.()},focus(){this.focused=true}});return nodes.get(id)};
 runInNewContext(between('const viewsDrawer =',"$('prefProportions').addEventListener"),{$});
 $('openViewsDrawer').handlers.click();assert.equal($('viewsDrawer').open,true);
 $('doneViewsDrawer').handlers.click();assert.equal($('viewsDrawer').open,false);assert.equal($('openViewsDrawer').focused,true);
 assert.match(html,/id="viewsDrawer"[^>]+aria-labelledby="viewsDrawerTitle"/);
 assert.match(html,/id="closeViewsDrawer"[^>]+aria-label="Close side views"/);
 assert.match(source,/previousStep\.id = 'previousStep'; previousStep\.type = 'button'/);
});
