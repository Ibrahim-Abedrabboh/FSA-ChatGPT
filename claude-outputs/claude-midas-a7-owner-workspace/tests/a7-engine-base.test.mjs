import test from 'node:test';
import assert from 'node:assert/strict';
import {a7Origin,a7Webhook} from '../lib/a7-engine-base.mjs';

const env=value=>({get:key=>key==='A7_ENGINE_BASE_URL'?value:undefined});

test('A7 calls refuse an unconfigured engine',()=>{
 assert.throws(()=>a7Origin(env(undefined)),/A7 engine not configured/);
 assert.throws(()=>a7Origin(env('  ')),/A7 engine not configured/);
 assert.throws(()=>a7Webhook('a7/owner-read',env(undefined)),/A7 engine not configured/);
});

test('a bare https origin routes every A7 call to the runner',()=>{
 assert.equal(a7Webhook('a7/owner-submit',env('https://midas-a7.up.railway.app')),'https://midas-a7.up.railway.app/webhook/a7/owner-submit');
 assert.equal(a7Webhook('a7/',env('https://midas-a7.up.railway.app/')),'https://midas-a7.up.railway.app/webhook/a7/');
});

test('anything but a bare https origin is refused',()=>{
 for(const bad of ['http://midas-a7.up.railway.app','https://user:pw@x.example','https://x.example/path','https://x.example/?a=1','not a url','javascript:alert(1)'])
  assert.throws(()=>a7Origin(env(bad)),/A7 engine not configured/,bad);
});
