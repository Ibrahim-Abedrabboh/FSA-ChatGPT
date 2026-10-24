import {a7Webhook} from './a7-engine-base.mjs';
// "Testing models per stage": the owner sends one photo to several model setups of one A7 stage and compares
// what each returns. Only 03 Eye is connected; generation and verdict come next. Each setup ("arm") is one
// call to the n8n workflow "A7 · Model tests per stage (owner page)", so every call stays under n8n Cloud's
// ~100 s gateway limit unless the model itself is slower than that.
// Read per call, never once at load, so the configured engine is always the one used.
export const modelTestWebhook = () => a7Webhook('a7/model-test');
export const DAILY_RUN_LIMIT = 20;
export const ARM_TIMEOUT_MS = 110000;

export const STAGES = [
 {id:'eye',title:'03 Eye · photo reading',ready:true,help:'Reads one vendor photo: category, every product piece and what is only room context.'},
 {id:'generation',title:'14 Generation · white master image',ready:false,help:'Next: compare image models on the same master brief.'},
 {id:'verdict',title:'16 Verdict · image review',ready:false,help:'Next: compare reviewers on the same generated image.'}
];

// USD per million tokens from claude-midas-a7-design/cost_model.json. null = no recorded price; the page then
// shows tokens only and never a guessed cost.
export const PRICES = {
 'gemini-3.8-flash':{input:.75,output:3.75},
 'gpt-6.1-sol':{input:2,output:10},
 'gemini-3.5-flash':null,
 'claude-opus-5-5':null
};

export const ARMS = {
 A:{model:'gemini-3.8-flash',label:'Gemini 3.8 Flash',prompt:'current',note:'Today\'s 03 Eye setup. It took 227.6 s in the first test, so n8n Cloud usually cuts the answer off at ~100 s.',default:false},
 B:{model:'gpt-6.1-sol',label:'GPT-6.1 Sol',prompt:'enhanced',default:true},
 C:{model:'gemini-3.8-flash',label:'Gemini 3.8 Flash',prompt:'enhanced',default:true},
 D:{model:'gemini-3.5-flash',label:'Gemini 3.5 Flash',prompt:'enhanced',default:true},
 E:{model:'claude-opus-5-5',label:'Claude Opus 5.5',prompt:'enhanced',default:true}
};

// Midas lifestyle photos with a counted answer. The server maps an id to its URL, so no other address is fetched.
export const MIDAS_PHOTOS = {
 '160689':{name:'Casarra bedroom set',url:'https://midasfurniture.com/media/catalog/product/1/6/160689-aa.png',expected:6,truth:'bed 1, nightstand 2, dresser 1, wall mirror 1, dresser stool 1'},
 '152343':{name:'Roanhowe bedroom set',url:'https://midasfurniture.com/media/catalog/product/1/5/152343.webp',expected:5,truth:'visible: bed, 1 nightstand, dresser, wall mirror, chest of drawers (the listing has 6; one nightstand is out of view)'},
 '161099':{name:'Maval dining set',url:'https://midasfurniture.com/media/catalog/product/4/3/43-161099_a.webp',expected:7,truth:'dining table 1, dining chair 6; the matching sideboard is not in the set'},
 '150533':{name:'Mavera sofa set',url:'https://midasfurniture.com/media/catalog/product/1/1/11-150533_a.jpg',expected:4,truth:'three seater 2, one seater 2'},
 '158858':{name:'Takara sofa set',url:'https://midasfurniture.com/media/catalog/product/1/1/11-158858_a.webp',expected:4,truth:'four seater 1, three seater 1, one seater 2; side and coffee tables are not in the set'}
};

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const runId = value => typeof value==='string'&&ID.test(value);

// Validates the form fields of a new run. The photo itself is checked by validateImage.
export function validateRunRequest(fields){
 if(fields.stage!=='eye')throw Error(STAGES.some(s=>s.id===fields.stage)?'stage_not_connected':'invalid_stage');
 const arms=String(fields.arms||'').split(',').filter(Boolean);
 if(!arms.length||arms.length>5||new Set(arms).size!==arms.length||arms.some(a=>!ARMS[a]))throw Error('invalid_arms');
 const midas=fields.midas||'';
 if(midas&&!MIDAS_PHOTOS[midas])throw Error('invalid_photo');
 let expected=null;
 if(fields.expected!==undefined&&fields.expected!==''){expected=Number(fields.expected);if(!Number.isInteger(expected)||expected<1||expected>40)throw Error('invalid_expected');}
 if(midas&&expected===null)expected=MIDAS_PHOTOS[midas].expected;
 const note=String(fields.note||'').trim();if(note.length>300)throw Error('invalid_note');
 return {stage:'eye',arms:arms.sort(),midas:midas||null,expected,note};
}

// Estimated cost from the tokens the provider reported. Gemini bills thinking as output; OpenAI's output count
// already includes reasoning; Anthropic reports no separate thinking here.
export function estimateCost(model,tokens){
 const price=PRICES[model];
 if(!price||!tokens||!Number.isFinite(tokens.input)||!Number.isFinite(tokens.output))return null;
 const thinking=model.startsWith('gemini')&&Number.isFinite(tokens.thinking)?tokens.thinking:0;
 return Math.round((tokens.input*price.input+(tokens.output+thinking)*price.output)/1e6*1e5)/1e5;
}

const short = (value,max=80) => String(value??'').slice(0,max);
// What the site would read from an Eye answer (see lib/a7-analysis-observation.mjs): category and the product pieces.
export function summarizeEye(result,expected=null){
 if(!result||typeof result!=='object'||!Array.isArray(result.pieces))return null;
 const pieces=result.pieces.filter(p=>p&&typeof p==='object').slice(0,60);
 const product=pieces.filter(p=>p.role==='product');
 const kinds={};for(const p of product){const k=short(p.kind||p.label||'piece',40);kinds[k]=(kinds[k]||0)+1;}
 return {
  category:short(result.category),
  productCount:product.length,
  correct:expected===null?null:product.length===expected,
  kinds:Object.entries(kinds).map(([kind,count])=>({kind,count})),
  product:product.map(p=>short(p.label)),
  context:pieces.filter(p=>p.role==='context').map(p=>short(p.label)),
  excluded:pieces.filter(p=>p.role==='excluded').map(p=>short(p.label)),
  unclear:Array.isArray(result.unclear_membership)?result.unclear_membership.slice(0,10).map(x=>short(x)):[],
  colour:short(result.colour_observed,120),
  material:short(result.material_appearance,200),
  designLocks:Array.isArray(result.design_locks)?result.design_locks.slice(0,12).map(x=>short(x,120)):[]
 };
}

// Turns the webhook's answer (or a transport failure) into the stored arm record.
export function armRecord(arm,{status,body,error,ms},expected){
 const base={arm,model:ARMS[arm].model,label:ARMS[arm].label,prompt:ARMS[arm].prompt,ms:Number.isFinite(ms)?ms:null,finishedAt:new Date().toISOString()};
 if(error==='timeout')return {...base,status:'failed',error:'no_answer_in_time'};
 if(status===524||status===504)return {...base,status:'failed',error:'gateway_timeout'};
 if(error||status!==200||!body||typeof body!=='object')return {...base,status:'failed',error:status?'http_'+status:'unreachable'};
 const tokens={input:num(body.tokens?.input),output:num(body.tokens?.output),thinking:num(body.tokens?.thinking)};
 const record={...base,ms:num(body.ms)??base.ms,finish:short(body.finish,30)||null,tokens,costUsd:estimateCost(base.model,tokens)};
 if(!body.ok)return {...record,status:'failed',error:short(body.error||'answer_not_usable',120),rawText:body.rawText?short(body.rawText,4000):null};
 return {...record,status:'done',summary:summarizeEye(body.result,expected),result:body.result};
}
const num = value => Number.isFinite(value)?value:null;
