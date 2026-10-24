import test from 'node:test';
import assert from 'node:assert/strict';
import '../edit-options.js';
const {keepItems,compose,parseCode,OPTIONS}=globalThis.a7EditOptions;
const facts={physicalCount:3,pieces:[{label:'bed',kind:'bed',role:'product'},{label:'left',kind:'nightstand',role:'product'},{label:'right',kind:'nightstand',role:'product'},{label:'lamp',kind:'lamp',role:'context'}],visibleAttributes:['Cream channel-tufted headboard','Gold bar handles on all drawers']};

test('the keep list starts from the confirmed pieces and details, then the scene',()=>{
 const items=keepItems(facts);
 assert.equal(items[0].text,'The product: 1 x bed, 2 x nightstand');
 assert.deepEqual(items.slice(1,3).map(i=>i.text),['Cream channel-tufted headboard','Gold bar handles on all drawers']);
 assert.ok(items.some(i=>i.id==='scene:lighting'));
 assert.equal(keepItems({physicalCount:2})[0].text,'The product: 2 pieces exactly as photographed');
});

test('each option is one fixed line, and what it changes leaves the keep list',()=>{
 const items=keepItems(facts),r=compose({choices:[{kind:'lighting',value:'Warm evening'},{kind:'props',value:'Fewer'}],note:'softer light on the headboard',items});
 assert.equal(r.changes,'Lighting: change the light to the Warm evening preset. Props: keep at most one Midas piece and remove the rest. Note: softer light on the headboard.');
 assert.equal(r.code,'lighting=Warm evening|props=Fewer');
 assert.doesNotMatch(r.preserve,/The lighting|Midas pieces and props/);
 assert.match(r.preserve,/^The product: 1 x bed, 2 x nightstand; Cream channel-tufted headboard/);
 assert.match(r.preserve,/The camera angle and framing/);
 const unticked=compose({choices:[{kind:'wall',value:'Sage'}],items,kept:items.filter(i=>i.id!=='detail:1').map(i=>i.id)});
 assert.doesNotMatch(unticked.preserve,/Gold bar handles|The walls/);
});

test('at most two changes; unknown values and repeated kinds are dropped; the result fits A7\'s field limits',()=>{
 assert.throws(()=>compose({choices:[{kind:'lighting',value:'Daylight'},{kind:'wall',value:'Sage'},{kind:'floor',value:'Marble'}]}),/at most two/);
 assert.equal(compose({choices:[{kind:'lighting',value:'Neon'},{kind:'lighting',value:'Daylight'},{kind:'lighting',value:'Warm evening'}]}).code,'lighting=Daylight');
 const long=compose({choices:[{kind:'defect',value:'x'.repeat(200)}],note:'y'.repeat(400),items:Array.from({length:40},(_,i)=>({id:'d'+i,text:'z'.repeat(40)}))});
 assert.ok(long.changes.length<=600&&long.preserve.length<=600);assert.equal(long.code,'defect='+'x'.repeat(80));
});

test('the server accepts only codes the panel can produce',()=>{
 assert.deepEqual(parseCode('camera=45° right|defect=chair leg floats'),[{kind:'camera',value:'45° right'},{kind:'defect',value:'chair leg floats'}]);
 assert.deepEqual(parseCode(''),[]);
 for(const bad of ['lighting=Neon','colour=Red','lighting=Daylight|lighting=Warm evening','lighting=Daylight|wall=Sage|floor=Marble','lighting','x'.repeat(201)])assert.throws(()=>parseCode(bad),/invalid_edit_options/);
 assert.equal(OPTIONS.length,6);
});
