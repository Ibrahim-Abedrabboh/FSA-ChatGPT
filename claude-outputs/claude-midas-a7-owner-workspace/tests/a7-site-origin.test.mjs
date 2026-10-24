import test from 'node:test';
import assert from 'node:assert/strict';
import {siteOrigin} from '../lib/a7-site-origin.mjs';
import {recoveryUpload} from '../lib/a7-recovery-transport.mjs';

const env=url=>({get:k=>k==='URL'?url:undefined});

test('the site names itself by the https origin of its main address',()=>{
 assert.equal(siteOrigin(env('https://claude-final-midas-a7.netlify.app')),'https://claude-final-midas-a7.netlify.app');
 assert.equal(siteOrigin(env('https://midas-a7-owner-preview.netlify.app/')),'https://midas-a7-owner-preview.netlify.app');
 for(const bad of [undefined,'','not a url','http://claude-final-midas-a7.netlify.app'])assert.equal(siteOrigin(env(bad)),'');
 assert.equal(siteOrigin(undefined),'');
});

test('a reader recovery names the sending site only when it has one',async()=>{
 const read=async upload=>JSON.parse((await new Request('https://example.test',{method:'POST',headers:upload.headers,body:upload.body}).formData()).get('payload'));
 const bytes=Buffer.from([1,2,3]),recovery={requestId:'r'};
 assert.equal((await read(recoveryUpload(bytes,'image/png','owner-x',recovery,false,'https://claude-final-midas-a7.netlify.app'))).budgetOrigin,'https://claude-final-midas-a7.netlify.app');
 assert.equal('budgetOrigin' in (await read(recoveryUpload(bytes,'image/png','owner-x',recovery))),false);
});
