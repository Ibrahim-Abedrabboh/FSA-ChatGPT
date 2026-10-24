// Companion Midas pieces ("Specific items or combination"). A7's step 10 treats every picked SKU as a fixed choice and holds the
// whole job with a question when one cannot be used, so these checks mirror its rules ("10 Retrieve Midas pieces", 19 Oct 2026).
import {CATALOGUE,CATALOGUE_AS_OF} from './a7-catalogue-snapshot.mjs';
import {parseMidasRef,lookupMidasProduct} from './midas-catalogue.mjs';
export const MAX_PICKS=12;
const BY_SKU=new Map(CATALOGUE.map(r=>[String(r.sku),r]));
function avail(raw){const t=String(raw||'').trim().toLowerCase();if(/out[\s-]*of[\s-]*stock|sold[\s-]*out|unavailable|discontinued/.test(t))return 'out_of_stock';if(t==='in stock')return 'in_stock';if(['pre-order','pre order','preorder'].includes(t))return 'pre_order';return 'not_confirmed';}
const words=t=>String(t||'').toLowerCase().replace(/[^a-z ]+/g,' ').split(' ').filter(Boolean);
const SKIP=['set','pcs','pc','piece','pieces','and','with','of','the','a','large','small','medium'];
const head=t=>{const w=words(t).map(x=>x.length>3&&x.endsWith('s')&&!x.endsWith('ss')?x.slice(0,-1):x).filter(x=>!SKIP.includes(x));return w.length?w[w.length-1]:'';};
/** Why A7 would refuse this catalogue row as a pick, or '' when it can be used (job-specific kind clashes are checked by A7). */
export function pickProblem(r){
 if(!r)return 'not in the A7 catalogue list';
 if(!r.photo||!r.retrieved)return 'no catalogue photo or no date it was read';
 if(r.active===false)return 'not offered at the moment';
 const a=avail(r.availability);
 if(a==='out_of_stock')return 'out of stock as read on '+r.retrieved;
 if(a!=='in_stock')return (a==='pre_order'?'pre-order':'stock not confirmed')+' as read on '+r.retrieved+'; only pieces in stock are used';
 if(!/^https:\/\/(www\.)?midasfurniture\.com\/en\//i.test(String(r.url||'')))return 'its page is not on the Midas Kuwait English site';
 if(['cushion','throw','pillow'].includes(head(r.kind||r.name)))return 'Midas cushions and throws are not offered in Studio scenes';
 return '';
}
/** Resolve each pasted SKU or Midas link and say whether A7 can use it as a companion piece. */
export async function checkPicks(items,{fetch:fetcher=fetch}={}){
 if(!Array.isArray(items)||!items.length||items.length>MAX_PICKS)throw Error('invalid_picks');
 const results=[];
 for(const raw of items){
  const input=String(raw||'').trim().slice(0,600);let sku='';
  try{const ref=parseMidasRef(input);sku=ref.sku&&BY_SKU.has(ref.sku)?ref.sku:ref.urlKey?(await lookupMidasProduct(ref,{fetch:fetcher})).sku:ref.sku||'';}
  catch(error){results.push({input,sku:null,usable:false,reason:error.message==='not_a_product_link'?'not a single Midas product link':error.message==='sku_not_found'?'no Midas product has this SKU':error.message==='not_midas_link'?'not a Midas link':'could not be read'});continue;}
  const r=BY_SKU.get(sku),reason=pickProblem(r);
  results.push({input,sku,name:r?.name||null,kind:r?.kind||null,usable:!reason,reason});
 }
 return {asOf:CATALOGUE_AS_OF,results};
}
