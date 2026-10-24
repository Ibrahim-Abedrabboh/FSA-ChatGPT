import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const html=await readFile(new URL('../consumer.html',import.meta.url),'utf8');
const script=await readFile(new URL('../consumer.js',import.meta.url),'utf8');

test('consumer journey stays separate and never claims approval, generation or purchase',()=>{
 assert.match(html,/id="productStep"/);
 assert.match(html,/id="roomStep"/);
 assert.match(html,/id="reviewStep"/);
 assert.match(html,/Approved catalogue asset lookup, room rendering, fit checks, price, availability/);
 assert.doesNotMatch(script,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage/);
 assert.match(html,/Original product photos remain the authority/);
 assert.match(html,/Supporting pieces should prefer approved Midas products/);
});

test('room and product inputs produce a local request summary with validation',()=>{
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:'',files:[],handlers:{},focus(){this.focused=true},addEventListener(type,fn){this.handlers[type]=fn},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}});
  return nodes.get(id);
 };
 const labels=[0,1,2].map(()=>({setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}}));
 const document={getElementById:node,querySelectorAll:()=>labels,querySelector:()=>({value:'locked'})};
 const window={scrollTo(){},addEventListener(){}};
 const URLMock=class extends URL{static createObjectURL(){return 'blob:room'}static revokeObjectURL(){}};
 runInNewContext(script,{document,window,URL:URLMock});
 node('toRoom').handlers.click();
 assert.match(node('pageStatus').textContent,/Enter a Midas product/);
 node('productRef').value='https://other.example/item';
 node('toRoom').handlers.click();
 assert.match(node('pageStatus').textContent,/Use a Midas catalogue/);
 node('productRef').value='MIDAS-SKU-123';
 node('toRoom').handlers.click();
 assert.equal(node('roomStep').hidden,false);
 node('toReview').handlers.click();
 assert.match(node('pageStatus').textContent,/Choose a room photo/);
 node('roomFile').files=[{name:'home.jpg',type:'image/jpeg',size:100}];
 node('roomFile').handlers.change();
 node('placement').value='Near the window';
 node('toReview').handlers.click();
 assert.equal(node('reviewStep').hidden,false);
 assert.equal(node('reviewProduct').textContent,'MIDAS-SKU-123');
 assert.equal(node('reviewRoom').textContent,'home.jpg · local only');
 assert.equal(node('reviewPlacement').textContent,'Near the window');
 node('backRoom').handlers.click();
 assert.equal(node('roomStep').hidden,false);
});
