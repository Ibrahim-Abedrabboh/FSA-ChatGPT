// White catalogue image on demand (owner, 20 Oct 2026; WP3 stage A, site side). A Lifestyle job may leave the white catalogue
// image out when the owner unticks "Also make the white catalogue image" (on by default). White BK and Website always keep it.
// The site sends scope.whiteMaster=false only then; every other brief is sent exactly as before. A7's side: tests/py/test_white_master_on_demand.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateSubmission,whiteRequired,GUIDE_KEYS} from '../lib/a7-actions.mjs';
import {plannedOutputs} from '../lib/a7-estimate.mjs';
import {DRAFT_BRIEF_KEYS} from '../lib/a7-projects.mjs';

const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const base=(over={})=>({requestId:randomUUID(),draftId:randomUUID(),confirmed:true,product:'Sofa',inventory:'1 sofa',instructions:'',dimensions:'',sku:'141368',
 view:'Category template',aspect:'4:5',budgetUsd:4.74,page:'studio',outcomes:'Lifestyle',outcome:'Lifestyle',camera:'Reference view',resolution:'2K',
 lighting:'Golden afternoon',human:'no',plants:'no',grounding:'no',wallPaint:'',floor:'',mood:'Automatic',itemRole:'hero',workOn:'one_by_one',series:'',
 variationCount:'2',midasPicks:'',catalogueRefs:'',includeMeta:'yes',reviewFirst:'share_first',...over});

test('A7 gets whiteMaster=false only for an unticked job whose outcomes do not need the white image',()=>{
 assert.equal(validateSubmission(base({whiteMaster:'no'})).scope.whiteMaster,false);
 for(const over of [{},{whiteMaster:'yes'},{whiteMaster:'no',outcomes:'Lifestyle\nWebsite'},{whiteMaster:'no',outcomes:'Lifestyle\nWhite BK'},
   {whiteMaster:'no',outcomes:'White BK',outcome:'White background',lighting:''}])
  assert.equal('whiteMaster' in validateSubmission(base(over)).scope,false,JSON.stringify(over));
 assert.equal(whiteRequired(['Lifestyle']),false);assert.equal(whiteRequired(['Lifestyle','Website']),true);assert.equal(whiteRequired(['White BK']),true);
 // The choice is saved with the draft, so a reopened draft keeps it.
 assert.ok(GUIDE_KEYS.includes('whiteMaster')&&DRAFT_BRIEF_KEYS.includes('whiteMaster'));
});

test('the estimate plans no white master only when it is left out and not needed',()=>{
 assert.deepEqual(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle',view:'Category template'}).slice(0,1),['White master']);
 assert.equal(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle',whiteMaster:'no'}).includes('White master'),false);
 assert.ok(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle',whiteMaster:'no'}).length>0);
 assert.ok(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle\nWebsite',whiteMaster:'no'}).includes('White master'));
 assert.ok(plannedOutputs({outcome:'Lifestyle',outcomes:'Lifestyle',whiteMaster:'yes'}).includes('White master'));
});

test('new case page: the box shows for Lifestyle without White BK or Website, is ticked by default, and is sent only when unticked',async()=>{
 const html=await read('../start.html'),source=await read('../start-connected.js'),start=await read('../start.js');
 assert.match(html,/<label class="white-master-option" id="whiteMasterOption" hidden><input type="checkbox" id="prefWhiteMaster" checked>/);
 assert.match(start,/function renderWhiteOption\(\)/);assert.match(start,/no white catalogue image/);
 const fn=source.slice(source.indexOf('  function studioChoices('),source.indexOf('  async function snapshot()'));
 const run=(outcomes,ticked)=>{const els={prefWhiteMaster:{checked:ticked}};
  return vm.runInNewContext(fn+';studioChoices(picked)',{picked:outcomes,$:id=>els[id]||{value:''},LIGHT:{},SERIES:{},state:{intent:'single',route:'hero'}});};
 assert.equal(run(['Lifestyle'],false).whiteMaster,'no');
 assert.equal('whiteMaster' in run(['Lifestyle'],true),false);
 assert.equal('whiteMaster' in run(['Lifestyle','Website'],false),false);
 assert.equal('whiteMaster' in run(['White BK'],false),false);
});

test('client studio: the same rule, on by default, and its planned list leaves the catalogue image out only when unticked',async()=>{
 const app=await read('../client/app.js'),html=await read('../client/index.html');
 assert.match(html,/id="white-master-field"/);assert.match(html,/<input type="checkbox" id="white-master"/);
 assert.match(app,/whiteMaster: true, prevUse/);
 const rules=app.slice(app.indexOf('  const whiteOptional ='),app.indexOf('  const whiteOff =')+app.slice(app.indexOf('  const whiteOff =')).indexOf('\n'));
 const off=(picked,whiteMaster)=>vm.runInNewContext(rules+';whiteOff()',{s:{whiteMaster},life:()=>picked.includes('life'),has:k=>picked.includes(k)});
 assert.equal(off(['life'],false),true);assert.equal(off(['life'],true),false);
 assert.equal(off(['life','website'],false),false);assert.equal(off(['life','white'],false),false);assert.equal(off([],false),false);
 assert.match(app,/if \(whiteOff\(\)\) b\.whiteMaster = 'no';/);
});

test('the owner desk names the new A7 status in plain words',async()=>{
 assert.match(await read('../app.js'),/scenes_start:'Scenes starting \(no white image\)'/);
});
