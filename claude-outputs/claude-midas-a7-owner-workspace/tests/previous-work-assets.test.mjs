import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const files=new Set(await readdir(new URL('previous-work/img/',root)));
const window={};runInNewContext(await readFile(new URL('previous-work-data.js',root),'utf8'),{window});
const items=window.MIDAS_PREVIOUS_WORK;

test('every previous-work example points at self-hosted images that exist',()=>{
  assert.equal(items.length,73);
  for(const item of items){
    assert.ok(item.title&&Array.isArray(item.tags)&&item.versions.length,item.title);
    assert.ok(files.has(item.cover+'-t.webp'),'cover thumb '+item.cover);
    for(const key of [item.cover,item.source,...item.versions.map(v=>v.img)].filter(Boolean))assert.ok(files.has(key+'-f.webp'),'detail '+key);
  }
});
test('upload guide photos all come from the previous-work image set',async()=>{
  const guide=await readFile(new URL('upload-examples.js',root),'utf8');
  const keys=[...guide.matchAll(/key: '([^']+)'/g)].map(m=>m[1]);
  assert.ok(keys.length>=10);
  for(const key of keys)assert.ok(files.has(key+'-f.webp'),'guide photo '+key);
  assert.doesNotMatch(guide,/https?:\/\//);
});
