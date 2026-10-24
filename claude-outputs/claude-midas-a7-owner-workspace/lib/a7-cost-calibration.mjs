import evidence from './a7-cost-evidence.json' with {type:'json'};
import {RATES} from './a7-budget.mjs';
// Historical usage × current conservative ledger rates. This is not billing.
export function calibratedWhiteCost(now=new Date()) {
 if(now>=new Date('2027-01-01'))throw Error('price_verification_required');
 const nodes=['03 Eye reads the product photo','05 Second count','09 Conflict check','16 Critic review','16x Blind count'];
 const parts=nodes.map(node=>{
  const calls=evidence.textCalls.filter(c=>c.node===node);
  if(!calls.length)throw Error('calibration_evidence_missing');
  const micro=Math.max(...calls.map(c=>Math.ceil(c.tokens.input*RATES[c.model].input+c.tokens.output*RATES[c.model].output)));
  return {node,samples:calls.length,micro};
 });
 const images=evidence.imageCalls.filter(c=>c.outputId==='white_master');
 const imageMicro=Math.max(...images.map(c=>Math.ceil(c.usage.total_input_tokens*1.5+(c.usage.total_output_tokens+c.usage.total_thought_tokens)*30)));
 const reviewMicro=parts.filter(p=>p.node.startsWith('16')).reduce((s,p)=>s+p.micro,0);
 const baseMicro=parts.reduce((s,p)=>s+p.micro,0)+imageMicro;
 return {checked:evidence.checked,baseMicro,repairMicro:imageMicro+reviewMicro,textSamples:evidence.textCalls.length,imageSamples:images.length,parts,imageMicro};
}
