import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bridgeShape} from '../lib/a7-bridge-shape.mjs';
const ref=(role,bytes=1000)=>({role,bytes});
test('the site refuses photo sets the owner bridge would refuse, before anything is claimed or sent',()=>{
 assert.equal(bridgeShape([ref('product')]),null);
 assert.equal(bridgeShape([ref('product'),ref('other_view'),ref('other_view'),ref('room'),ref('look')]),null);
 assert.match(bridgeShape([ref('other_view')]),/exactly one primary product photo/);
 assert.match(bridgeShape([ref('product'),ref('product')]),/exactly one primary product photo/);
 assert.match(bridgeShape([ref('product'),ref('room'),ref('room')]),/one room photo/);
 assert.equal(bridgeShape([ref('product'),...Array(10).fill(ref('other_view')),ref('spec')]),null);
 assert.match(bridgeShape([ref('product'),...Array(12).fill(ref('other_view'))]),/at most 12 files/);
 assert.match(bridgeShape([ref('product',3e6),ref('other_view',3e6),ref('other_view',3e6),ref('other_view',3e6),ref('room',3e6)]),/at most 14 MB/);
});
