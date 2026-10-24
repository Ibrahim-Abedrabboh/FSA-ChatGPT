import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPicks,pickProblem} from '../lib/a7-picks.mjs';
const noNetwork=async()=>{throw Error('network not expected');};
test('companion picks follow A7 step 10: in stock, on the Kuwait English site, never cushions or throws',()=>{
 const ok={sku:'1',name:'Lamp',kind:'table lamp',url:'https://midasfurniture.com/en/lamp.html',availability:'In stock',active:true,retrieved:'2026-10-15',photo:true};
 assert.equal(pickProblem(ok),'');
 assert.match(pickProblem({...ok,availability:'Out of stock'}),/out of stock/);
 assert.match(pickProblem({...ok,availability:'Pre-Order'}),/pre-order/);
 assert.match(pickProblem({...ok,url:'https://midasfurniture.com/ksa_ar/lamp.html'}),/Kuwait English/);
 assert.match(pickProblem({...ok,kind:'cushion'}),/cushions and throws/);
 assert.match(pickProblem({...ok,active:false}),/not offered/);
 assert.match(pickProblem(undefined),/not in the A7 catalogue/);
});
test('catalogue SKUs are checked without the network; unknown SKUs and category links are refused',async()=>{
 const {results}=await checkPicks(['174770','172460','999999','https://midasfurniture.com/ksa_ar/home-furniture.html'],{fetch:noNetwork});
 assert.deepEqual(results.map(r=>r.usable),[true,false,false,false]);
 assert.match(results[1].reason,/out of stock/);assert.match(results[2].reason,/not in the A7 catalogue/);
 await assert.rejects(checkPicks([],{fetch:noNetwork}),/invalid_picks/);
});
