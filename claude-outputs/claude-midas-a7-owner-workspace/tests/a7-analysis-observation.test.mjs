import test from 'node:test';
import assert from 'node:assert/strict';
import {observationFromVerifiedAnswers} from '../lib/a7-analysis-observation.mjs';

test('source facts are built from ledger answers, with physical pieces distinct from props and views',()=>{
 const answers={
  '03 Eye reads the product photo':{category:'Sofa',pieces:[{label:'left module',kind:'seat module',role:'product'},{label:'right module',kind:'seat module',role:'product'},{label:'plant',kind:'plant',role:'context'}],views_not_pieces:['side inset'],colour_observed:'beige',unknowns:['dimensions']},
  '05 Second count':{total:2},
  '09 Conflict check':{conflicts:[]}
 };
 const result=observationFromVerifiedAnswers({roomSha256:null},answers);
 assert.equal(result.observation.eyeCount,2);
 assert.equal(result.observation.secondCount,2);
 assert.equal(result.observation.pieces.length,3);
 assert.equal(result.observation.visibleSeatCount,null);
 assert.equal(result.roomObservation,null);
 assert.throws(()=>observationFromVerifiedAnswers({roomSha256:'a'.repeat(64)},answers),/analysis_receipt_unverified/);
});
