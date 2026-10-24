import test from 'node:test';
import assert from 'node:assert/strict';
import {a7Origin,a7Webhook,N8N_ORIGIN} from '../lib/a7-engine-base.mjs';

const env=value=>({get:key=>key==='A7_ENGINE_BASE_URL'?value:undefined});

test('A7 calls stay on the n8n host until the Python service is chosen',()=>{
 assert.equal(a7Origin(env(undefined)),N8N_ORIGIN);
 assert.equal(a7Origin(env('  ')),N8N_ORIGIN);
 assert.equal(a7Webhook('a7/owner-read',env(undefined)),'https://ibrahimnewaeon.app.n8n.cloud/webhook/a7/owner-read');
});

test('a bare https origin switches every A7 call to the Python service',()=>{
 assert.equal(a7Webhook('a7/owner-submit',env('https://midas-a7.up.railway.app')),'https://midas-a7.up.railway.app/webhook/a7/owner-submit');
 assert.equal(a7Webhook('a7/',env('https://midas-a7.up.railway.app/')),'https://midas-a7.up.railway.app/webhook/a7/');
});

test('anything but a bare https origin is ignored',()=>{
 for(const bad of ['http://midas-a7.up.railway.app','https://user:pw@x.example','https://x.example/path','https://x.example/?a=1','not a url','javascript:alert(1)'])
  assert.equal(a7Origin(env(bad)),N8N_ORIGIN,bad);
});
