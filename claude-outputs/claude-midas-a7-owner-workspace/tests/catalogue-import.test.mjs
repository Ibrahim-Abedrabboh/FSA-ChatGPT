import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const window={};runInNewContext(await readFile(new URL('catalogue-import.js',root),'utf8'),{window,document:{getElementById:()=>null,querySelector:()=>null},location:{pathname:'/owner/',hash:'',search:''},history:{},setTimeout,console});
const {parse}=window.midasCatalogueImport;
const item=i=>({name:'Item '+i,url:`https://midasfurniture.com/en/item-${i}-midas.html`,sku:''});

test('catalogue import keeps at most 10 unique Midas links and drops anything else',()=>{
  const items=[...Array.from({length:12},(_,i)=>item(i)),item(1),{name:'x',url:'https://evil.example/a.html'},{name:'y',url:'javascript:alert(1)'},{name:'z',url:'http://midasfurniture.com/en/a.html'}];
  const out=parse(JSON.stringify({source:'midas-catalogue',snapshot:'2026-10-19',at:'2026-10-19T10:00:00Z',items}));
  assert.equal(out.items.length,10);
  assert.equal(new Set(out.items.map(i=>i.url)).size,10);
  assert.ok(out.items.every(i=>i.url.startsWith('https://midasfurniture.com/')));
  assert.equal(out.snapshot,'2026-10-19');
});
test('catalogue import rejects other payloads and keeps only numeric SKUs',()=>{
  assert.equal(parse('not json'),null);
  assert.equal(parse(JSON.stringify({source:'other',items:[item(1)]})),null);
  assert.equal(parse(JSON.stringify({source:'midas-catalogue',items:[]})),null);
  const out=parse({source:'midas-catalogue',items:[{...item(1),sku:'175913'},{...item(2),sku:'<b>'}]});
  assert.deepEqual(out.items.map(i=>i.sku),['175913','']);
});
