import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateSubmission} from '../lib/a7-actions.mjs';
// The shape start-connected.js studioChoices() saves for the redesigned studio, checked against what A7 receives.
const base=(over={})=>({requestId:randomUUID(),draftId:randomUUID(),confirmed:true,product:'Sofa',inventory:'1 sofa',instructions:'Keep the fabric.',dimensions:'',sku:'141368',view:'Category template',aspect:'4:5',budgetUsd:4.74,
 page:'studio',outcomes:'Lifestyle\nWebsite',outcome:'Lifestyle',camera:'Left side',resolution:'4K',lighting:'Golden afternoon',human:'yes',plants:'no',grounding:'no',wallPaint:'Sage',floor:'Light oak',mood:'Warm & inviting',
 department:'Living Rooms',category:'Sofas',subCategory:'',description:'',locks:'Keep both cushions',itemRole:'hero',workOn:'one_by_one',series:'Three views',variationCount:'2',midasPicks:'174770',catalogueRefs:'',
 includeMeta:'yes',reviewFirst:'share_first',fidelityStrength:'80',stylingStrength:'',clutterStrength:'',...over});
test('the redesigned studio sends every choice A7 reads: several outcomes, camera, series, person, 4K, wall and floor',()=>{
 const b=validateSubmission(base());
 assert.deepEqual(b.scope.outcomes,['Lifestyle','Website']);
 assert.equal(b.scope.camera,'Left side');assert.equal(b.scope.series,'Three views');assert.equal(b.scope.resolution,'4K');assert.equal(b.scope.aspect,'4:5');
 assert.equal(b.preferences.people,'one');assert.equal(b.preferences.lighting,'Golden afternoon');assert.equal(b.preferences.wallPaint,'Sage');assert.equal(b.preferences.floor,'Light oak');
 assert.deepEqual(b.midasPicks,['174770']);assert.equal(b.item.department,'Living Rooms');assert.deepEqual(b.metadata.locks,['Keep both cushions']);
 assert.equal(b.strengths.fidelity,80);assert.equal(b.styling.mood,'Warm & inviting');
});
test('a White BK-only studio brief keeps the verified white-master shape',()=>{
 const b=validateSubmission(base({outcomes:'White BK',outcome:'White background',camera:'Reference view',resolution:'2K',lighting:'',human:'no',wallPaint:'',floor:'',mood:'Automatic',series:''}));
 assert.deepEqual(b.scope.outcomes,['White BK']);assert.equal(b.scope.camera,'Reference view');assert.equal(b.preferences.people,'none');assert.equal(b.preferences.lighting,'');
});
test('an outcome list that disagrees with the primary outcome is refused',()=>{
 assert.throws(()=>validateSubmission(base({outcomes:'White BK',outcome:'Lifestyle'})),/invalid_outcomes/);
});
