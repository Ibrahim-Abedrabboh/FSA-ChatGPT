import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../start.js',import.meta.url),'utf8');
const html=await readFile(new URL('../start.html',import.meta.url),'utf8');
const buttons=source.slice(source.indexOf('const PHASE_BUTTONS ='),source.indexOf('function returnToStep('));

test('buttons that go back to an earlier answer open that phase of the timeline, and the old review address starts again',()=>{
  const events=new Map(),opened=[];
  const $=id=>({addEventListener(type,fn){events.set(id+':'+type,fn)}});
  vm.runInNewContext(buttons,{$,openPhase:key=>opened.push(key)});
  for(const [id,key] of [['editSourceButton','photos'],['editPromptButton','notes'],['editPreferencesButton','settings'],['changeEditSource','work'],['reviewSourceButton','check']]){
    events.get(id+':click')();assert.equal(opened.at(-1),key,id);
  }
  // A /results/ address from before the timeline opens the plain address at the first phase (photos do not survive a reload).
  assert.match(source,/if \(pageFromPath\(\) === 'results'\) history\.replaceState\?\.\(\{\}, '', caseOnly \? '\/owner\/start\/' : '\/owner\/'\);/);
});
test('Jobs links stay in the current tab so a local source selection survives',()=>{
  assert.doesNotMatch(html,/href="\/owner\/#jobs"/);
  assert.match(html,/<a href="#jobsSection">Jobs<\/a>/);
  assert.match(html,/Inspect recorded jobs and approvals/);
  assert.match(html,/<a href="#savedWorkSection">Saved work<\/a>/);
});
test('wizard keeps room and inspiration inputs distinct from product side views',()=>{
 assert.match(html,/id="roomInput"/);assert.match(html,/id="lookInput"/);
 assert.match(source,/state\.room.*Room reference/);assert.match(source,/state\.look.*Inspiration reference/);
});
