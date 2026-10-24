import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// 11b flags any lamp or rug word. "without an added rug" plans no rug, so 11d must not hold the run on it
// (claude-a7-aec04faf, 20 Oct 2026); a rug or lamp the plan really places still holds.
const workflow=JSON.parse(await readFile(new URL('../../n8n/claude-midas-a7/live/workflow-1cgZc9rmBOrPdKIe.json',import.meta.url),'utf8'));
const code=workflow.nodes.find(n=>n.name==='11d Plan verdict').parameters.jsCode;
const NAMES=['product_unchanged','handedness_kept','shown_with_kept','frame_respected','client_choices_respected','product_visible','props_clean','midas_pieces_ok','room_rules','lead_respected'];
const RUG='a rug is planned that is not a Midas piece; only a Midas rug from the shortlist may appear';
const LAMP='a lamp or other light fitting is planned that is not a Midas piece; warm light comes from the room\'s built-in light (recessed downlights, a cove light or a plain ceiling fixture), and a lamp appears only as a Midas lamp from the shortlist';
function verdict(plan,findings){
 const st={plan_round:1,rewrites_used:0,trail:[],shots:[{n:2,output_id:'hero',plan,plan_ok:false,code_findings:findings}]};
 const reply={plans:[{shot:2,checks:Object.fromEntries(NAMES.map(k=>[k,{result:'pass',evidence:'ok'}]))}]};
 const $=name=>{assert.equal(name,'11b Stylist check');return {first:()=>({json:st})};};
 return new Function('$','$input',code)($,{first:()=>({json:{output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(reply)}]}]}})})[0].json;
}
const live={setting:'A comfortably proportioned residential lounge with Sand-painted walls and pale natural oak flooring. Keep the architecture restrained and the seating group dominant, without an added rug or decorative accessories.',
 light:'Warm evening illumination comes from the built-in ceiling cove and recessed downlights.',presentation:'Keep the central double seat flanked by the other double seats facing inward.',person:''};

test('a rug or lamp the plan only rules out does not hold the run',()=>{
 const out=verdict(live,[RUG]);
 assert.equal(out.shots[0].plan_ok,true);assert.equal(out.critical,undefined);assert.deepEqual(out.shots[0].code_findings_dismissed,[RUG]);
 assert.equal(verdict({...live,light:'Warm built-in light only, no lamps.'},[LAMP]).shots[0].plan_ok,true);
});

test('a rug or lamp the plan really places still holds the run',()=>{
 for(const [plan,finding] of [[{...live,setting:'A calm lounge with a large wool rug under the seating group.'},RUG],[{...live,light:'Warm evening light from a brass floor lamp beside the sofa.'},LAMP],[{...live,setting:'No clutter, a jute rug under the tables.'},RUG]]){
  const out=verdict(plan,[finding]);
  assert.equal(out.shots[0].plan_ok,false);assert.match(out.critical[0].why,/code findings not resolved/);
 }
});
