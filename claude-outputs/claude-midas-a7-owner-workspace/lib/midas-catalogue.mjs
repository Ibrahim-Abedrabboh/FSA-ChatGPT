// Midas product import. A product link or SKU is resolved through the public
// Midas catalogue API, and only photos that API lists for that product can be
// fetched. The browser never supplies an image address, so this cannot be used
// to fetch an arbitrary URL.
import {validateImage,digest} from './a7-actions.mjs';

export const MIDAS_GRAPHQL='https://midasfurniture.com/graphql';
export const MAX_GALLERY=8;
const HOSTS=new Set(['midasfurniture.com','www.midasfurniture.com']);
const MAX_BYTES=3*1024*1024;
// Midas serves this 626 x 626 placeholder when a photo does not exist.
const PLACEHOLDER_SHA256='ebffa3fbf7a3d7b6ae59d505fb6d466678ffd805f549f7aa76cf674f665e4453';
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

/** Turn an owner's pasted link or SKU into a catalogue lookup key, or throw. */
export function parseMidasRef(raw){
 const input=typeof raw==='string'?raw.trim():'';
 if(!input||input.length>600)throw Error('invalid_midas_reference');
 if(/^\d{4,8}$/.test(input))return {sku:input};
 let url;
 try{url=new URL(/^https?:\/\//i.test(input)?input:'https://'+input);}catch{throw Error('invalid_midas_reference');}
 if(!['https:','http:'].includes(url.protocol)||!HOSTS.has(url.hostname.toLowerCase()))throw Error('not_midas_link');
 const last=url.pathname.split('/').filter(Boolean).pop()||'';
 const key=last.toLowerCase().replace(/\.html$/,'');
 if(!last.toLowerCase().endsWith('.html')||!/^[a-z0-9][a-z0-9-]{0,199}$/.test(key))throw Error('not_a_product_link');
 const sku=key.match(/-(\d{5,8})(?:-|$)/)?.[1];
 return sku?{urlKey:key,sku}:{urlKey:key};
}

/** Keep only photo addresses on the Midas product-media path, without query strings. */
export function cleanImageUrl(raw){
 let url;try{url=new URL(raw);}catch{return null;}
 if(url.protocol!=='https:'||!HOSTS.has(url.hostname.toLowerCase()))return null;
 if(!/^\/media\/catalog\/product\/[a-z0-9]\/[a-z0-9]\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(url.pathname))return null;
 return 'https://midasfurniture.com'+url.pathname;
}

async function query(fetcher,field,value){
 // Callers restrict both values to letters, digits and hyphens, so inlining is safe.
 if(!/^[A-Za-z0-9-]{1,200}$/.test(value))throw Error('invalid_midas_reference');
 const q=`{products(filter:{${field}:{eq:"${value}"}}){total_count items{sku name url_key image{url} media_gallery{url disabled position}}}}`;
 const response=await fetcher(MIDAS_GRAPHQL+'?query='+encodeURIComponent(q),{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('catalogue_unavailable');
 const text=await response.text();if(text.length>300000)throw Error('catalogue_unavailable');
 let data;try{data=JSON.parse(text);}catch{throw Error('catalogue_unavailable');}
 const items=data?.data?.products?.items;if(!Array.isArray(items))throw Error('catalogue_unavailable');
 return items.find(item=>String(item?.[field==='sku'?'sku':'url_key']).toLowerCase()===value.toLowerCase())||null;
}

/** Find one product and its photo gallery: main photo first, then the rest in Midas order. */
export async function lookupMidasProduct(ref,{fetch:fetcher=fetch}={}){
 let item=null;
 if(ref.urlKey)item=await query(fetcher,'url_key',ref.urlKey);
 if(!item&&ref.sku)item=await query(fetcher,'sku',ref.sku);
 if(!item)throw Error(ref.urlKey?'not_a_product_link':'sku_not_found');
 const gallery=(Array.isArray(item.media_gallery)?item.media_gallery:[]).filter(m=>m&&!m.disabled).sort((a,b)=>(a.position??99)-(b.position??99));
 const images=[...new Set([item.image?.url,...gallery.map(m=>m.url)].map(cleanImageUrl).filter(Boolean))].slice(0,MAX_GALLERY);
 if(!images.length)throw Error('product_has_no_photo');
 const sku=String(item.sku||'').trim();
 if(!/^[A-Za-z0-9-]{1,40}$/.test(sku))throw Error('catalogue_unavailable');
 return {sku,name:String(item.name||'').trim().slice(0,160),urlKey:String(item.url_key||ref.urlKey||'').slice(0,200),images};
}

/** Download one gallery photo and check it is a real JPEG, PNG or WebP under 3 MB. */
export async function fetchMidasImage(url,{fetch:fetcher=fetch}={}){
 const clean=cleanImageUrl(url);if(!clean)throw Error('image_unavailable');
 const response=await fetcher(clean,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('image_unavailable');
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!TYPES[type]||Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('image_unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>MAX_BYTES)throw Error('image_unavailable');
 if(digest(bytes)===PLACEHOLDER_SHA256)throw Error('placeholder_image');
 try{validateImage(bytes,type);}catch{throw Error('image_unavailable');}
 return {bytes,type,extension:TYPES[type]};
}
