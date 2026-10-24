import authenticate from './owner-me.mjs';
import {noStoreJson} from '../../lib/owner-auth.mjs';
import {sameOrigin} from '../../lib/a7-actions.mjs';
import {parseMidasRef,lookupMidasProduct,fetchMidasImage,MAX_GALLERY} from '../../lib/midas-catalogue.mjs';

const CLIENT_ERRORS=['invalid_midas_reference','not_midas_link','not_a_product_link','sku_not_found','product_has_no_photo','placeholder_image'];
const MESSAGES={
 invalid_midas_reference:'Paste one Midas product link or a numeric SKU.',
 not_midas_link:'Only midasfurniture.com product links can be imported.',
 not_a_product_link:'This link is not a single Midas product. Category and search pages list many products; open one product and copy its link.',
 sku_not_found:'No Midas product has this SKU.',
 product_has_no_photo:'Midas lists no photo for this product. Upload the product image instead.',
 placeholder_image:'Midas returned its "no photo" placeholder for this image. Choose another photo or upload one.',
 image_unavailable:'The Midas photo could not be downloaded or is not a JPEG, PNG or WebP under 3 MB.',
 catalogue_unavailable:'The Midas catalogue did not answer. Try again, or upload the product image.'
};
const fail=code=>{const known=CLIENT_ERRORS.includes(code);const error=known||code==='image_unavailable'?code:'catalogue_unavailable';return noStoreJson({error,message:MESSAGES[error]},known?(error==='sku_not_found'||error==='not_a_product_link'?404:422):502);};

/**
 * POST /api/owner/midas-import {ref} finds a product and lists its photos.
 * GET /api/owner/midas-import/:sku/:index returns one of those photos, looked up again by SKU,
 * so the browser can add it to the form exactly like a file it uploaded. Nothing is stored here.
 */
export default async function handler(request,context){
 const auth=await authenticate(new Request(request.url,{headers:request.headers,method:'GET'}),context);if(!auth.ok)return auth;
 try{
  if(request.method==='POST'){
   if(!sameOrigin(request))return noStoreJson({error:'origin_rejected'},403);
   if(Number(request.headers.get('content-length'))>2000)return fail('invalid_midas_reference');
   let body;try{body=await request.json();}catch{return fail('invalid_midas_reference');}
   const product=await lookupMidasProduct(parseMidasRef(body?.ref));
   return noStoreJson({product:{sku:product.sku,name:product.name,url:product.urlKey?'https://midasfurniture.com/en/'+product.urlKey+'.html':null,photos:product.images.length}});
  }
  if(request.method!=='GET')return noStoreJson({error:'method_not_allowed'},405);
  const sku=context.params?.sku,index=Number(context.params?.index);
  if(!/^[A-Za-z0-9-]{1,40}$/.test(sku||'')||!Number.isInteger(index)||index<0||index>=MAX_GALLERY)return noStoreJson({error:'not_found'},404);
  const product=await lookupMidasProduct({sku});
  if(index>=product.images.length)return noStoreJson({error:'not_found'},404);
  const image=await fetchMidasImage(product.images[index]);
  return new Response(image.bytes,{headers:{'Content-Type':image.type,'Cache-Control':'no-store','Content-Disposition':`inline; filename="midas-${product.sku}-${index+1}.${image.extension}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(error){return fail(error.message);}
}
export const config={path:['/api/owner/midas-import','/api/owner/midas-import/:sku/:index'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:40}};
