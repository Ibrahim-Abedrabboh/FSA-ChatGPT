import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMidasRef,cleanImageUrl,lookupMidasProduct,fetchMidasImage} from '../lib/midas-catalogue.mjs';

const product={sku:'175913',name:'ALIVAN SIDE TABLE - PINK',url_key:'alivan-side-table-pink-175913-midas',image:{url:'https://midasfurniture.com/media/catalog/product/4/4/44-175913_e.webp?optimize=high'},media_gallery:[{url:'https://midasfurniture.com/media/catalog/product/4/4/44-175913_e.webp?x=1',position:1},{url:'https://midasfurniture.com/media/catalog/product/4/4/44-175913_a.webp',position:2},{url:'https://evil.example/x.webp',position:3},{url:'https://midasfurniture.com/media/catalog/product/4/4/44-175913_b.webp',position:4,disabled:true}]};
const graph=items=>async url=>{assert.ok(url.startsWith('https://midasfurniture.com/graphql?query='));const q=decodeURIComponent(url.split('query=')[1]);const match=items.filter(i=>q.includes(`"${i.sku}"`)||q.includes(`"${i.url_key}"`));return new Response(JSON.stringify({data:{products:{total_count:match.length,items:match}}}),{headers:{'content-type':'application/json'}});};

test('product links and SKUs resolve; category, foreign and malformed input is refused',()=>{
 assert.deepEqual(parseMidasRef('https://midasfurniture.com/ksa_ar/alivan-side-table-pink-175913-midas.html'),{urlKey:'alivan-side-table-pink-175913-midas',sku:'175913'});
 assert.deepEqual(parseMidasRef('midasfurniture.com/en/challvor-center-table.html'),{urlKey:'challvor-center-table'});
 assert.deepEqual(parseMidasRef(' 141368 '),{sku:'141368'});
 assert.throws(()=>parseMidasRef('https://example.com/x-175913-y.html'),/not_midas_link/);
 assert.throws(()=>parseMidasRef('https://midasfurniture.com/ksa_ar/'),/not_a_product_link/);
 assert.throws(()=>parseMidasRef('https://midasfurniture.com/en/a"b.html'),/not_a_product_link/);
 assert.throws(()=>parseMidasRef(''),/invalid_midas_reference/);
});
test('only Midas product-media photos are kept, deduplicated and without query strings',async()=>{
 assert.equal(cleanImageUrl('https://midasfurniture.com/media/catalog/product/4/4/44-1_a.jpg?w=1'),'https://midasfurniture.com/media/catalog/product/4/4/44-1_a.jpg');
 assert.equal(cleanImageUrl('https://midasfurniture.com/../etc/passwd'),null);
 assert.equal(cleanImageUrl('http://midasfurniture.com/media/catalog/product/4/4/44-1_a.jpg'),null);
 const found=await lookupMidasProduct(parseMidasRef('https://midasfurniture.com/ksa_ar/alivan-side-table-pink-175913-midas.html'),{fetch:graph([product])});
 assert.equal(found.sku,'175913');
 assert.deepEqual(found.images,['https://midasfurniture.com/media/catalog/product/4/4/44-175913_e.webp','https://midasfurniture.com/media/catalog/product/4/4/44-175913_a.webp']);
 await assert.rejects(lookupMidasProduct({urlKey:'home-furniture'},{fetch:graph([product])}),/not_a_product_link/);
 await assert.rejects(lookupMidasProduct({sku:'999999'},{fetch:graph([product])}),/sku_not_found/);
});
test('a downloaded photo must be a real image under 3 MB and not the Midas placeholder',async()=>{
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(64)]);
 const ok=await fetchMidasImage('https://midasfurniture.com/media/catalog/product/4/4/44-1_a.png',{fetch:async()=>new Response(png,{headers:{'content-type':'image/png'}})});
 assert.equal(ok.type,'image/png');assert.equal(ok.bytes.length,png.length);
 await assert.rejects(fetchMidasImage('https://midasfurniture.com/media/catalog/product/4/4/44-1_a.png',{fetch:async()=>new Response('<html>',{headers:{'content-type':'image/png'}})}),/image_unavailable/);
 await assert.rejects(fetchMidasImage('https://evil.example/a.png',{fetch:async()=>{throw Error('must not fetch');}}),/image_unavailable/);
});
