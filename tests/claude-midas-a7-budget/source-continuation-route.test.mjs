import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// A job whose source the owner confirmed skips the readers: "Confirmed source evidence" stands in for
// "04-06 Evidence", which never runs on that path. 07 Route must read whichever of the two ran.
const workflow=JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/live/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url),'utf8'));
const profiles=JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/data/claude-a7-handling-profiles-v2.json',import.meta.url),'utf8'));
const code=name=>workflow.nodes.find(n=>n.name===name).parameters.jsCode;

test('07 Route reads the confirmed source evidence when the reader step did not run',()=>{
 const accepted={run_id:'claude-a7-synthetic',client_run_id:'owner-synthetic',brief:{product_type:'Sofa',category:'Sofa',inventory:[{item:'sofa',count:1}],outputs:[{id:'white_master',kind:'white',outcome:'lifestyle'}],outcomes:['lifestyle'],instructions:''},references:[{name:'product-x',role:'product'}],trail:[]};
 const proof={verified:true,runId:accepted.run_id,clientRunId:accepted.client_run_id,receiptFingerprint:'a',confirmationFingerprint:'b',referenceFingerprint:'c',
  facts:{category:'Sofa',physicalCount:1,uncertainties:[]},
  answers:{'03 Eye reads the product photo':{pieces:[{label:'sofa',kind:'sofa',role:'product'}]},'05 Second count':{total:1},'09 Conflict check':{instruction_locks:[],conflicts:[],summary:''}}};
 const ran={'Receipt · Restore accepted input':accepted};
 const $=name=>{if(!(name in ran))throw Error(`Node '${name}' hasn't been executed`);return {first:()=>({json:ran[name]})};};
 const one=items=>({first:()=>items[0],all:()=>items});
 ran['Confirmed source evidence']=new Function('$','$input',code('Confirmed source evidence'))($,one([{json:{verified:true,proof}}]))[0].json;
 const routed=new Function('$','$input',code('07 Route'))($,one(profiles.map(json=>({json}))))[0].json;
 assert.equal(routed.run_id,accepted.run_id);
 assert.equal(routed.source_confirmation_bound,true);
 assert.ok(routed.profile?.id,'a handling profile is chosen');
});
