import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../preview-image.js',import.meta.url),'utf8');
const csp=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');

function harness({decode=true}={}) {
  const window={};
  class FileReader {
    readAsDataURL(file) { this.result=file.data; queueMicrotask(()=>this.onload()); }
  }
  class Image {
    set src(value) { this.value=value; queueMicrotask(()=>decode?this.onload():this.onerror()); }
  }
  runInNewContext(source,{window,FileReader,Image,Promise});
  return window.a7PreviewImage;
}

test('source previews use a CSP-allowed data URL and reject corrupt images',async()=>{
  assert.match(csp,/img-src 'self' data:/);
  const url='data:image/png;base64,iVBORw0KGgo=';
  assert.equal(await harness().read({data:url}),url);
  await assert.rejects(harness({decode:false}).read({data:url}),/image_decode_failed/);
  await assert.rejects(harness().read({data:'blob:https://example.test/old'}),/image_read_failed/);
});

// A browser stand-in: bitmaps of a given size, a canvas whose encoded size follows its pixel count.
function fitHarness({width=4032,height=3024,decode=true,bytesPerPixel={'image/jpeg':0.25,'image/webp':0.2},webp=true}={}) {
  const window={},drawn=[];
  class File { constructor(parts,name,{type}){this.parts=parts;this.name=name;this.type=type;this.size=parts.reduce((n,p)=>n+p.size,0);} }
  const createImageBitmap=async()=>{if(!decode)throw Error('decode');return {width,height,close(){this.closed=true;}};};
  const document={createElement:()=>({width:0,height:0,getContext(){const canvas=this;return {fillRect(){canvas.filled=true;},drawImage(){drawn.push([canvas.width,canvas.height]);}};},toBlob(done,type){const real=type==='image/webp'&&!webp?'image/png':type;done({type:real,size:Math.round(this.width*this.height*(bytesPerPixel[real]??4))});}})};
  runInNewContext(source,{window,FileReader:class{},Image:class{},Promise,File,createImageBitmap,document});
  return {api:window.a7PreviewImage,File,drawn};
}
const MB=1024*1024;

test('a photo that already fits is kept as chosen, byte for byte',async()=>{
 const {api}=fitHarness(),file={name:'sofa.jpg',type:'image/jpeg',size:2*MB};
 const result=await api.fit(file);
 assert.equal(result.file,file);assert.equal(result.reduced,null);assert.equal(api.describe(result),'');
});

test('a large JPEG is redrawn at the largest size that fits 3 MB, and the page says so',async()=>{
 const {api,drawn}=fitHarness({bytesPerPixel:{'image/jpeg':0.3}}),file={name:'sofa.jpeg',type:'image/jpeg',size:7.4*MB};
 const result=await api.fit(file);
 assert.equal(result.file.type,'image/jpeg');assert.equal(result.file.name,'sofa.jpg');
 assert.ok(result.file.size<=3*MB);
 assert.deepEqual([...result.reduced.toSize],[3200,2400]);assert.deepEqual([...drawn[0]],[4032,3024]);
 assert.equal(api.describe(result),'sofa.jpg: reduced from a 7.4 MB JPEG (4032×3024) to a 2.2 MB JPEG (3200×2400) to fit the 3 MB limit.');
});

test('HEIC is converted when the browser can open it, and refused clearly when it cannot',async()=>{
 const {api}=fitHarness({width:2000,height:1500}),heic={name:'IMG_0001.HEIC',type:'image/heic',size:1.8*MB};
 const result=await api.fit(heic);
 assert.equal(result.file.type,'image/webp');assert.equal(result.file.name,'IMG_0001.webp');assert.deepEqual([...result.reduced.toSize],[2000,1500]);
 await assert.rejects(fitHarness({decode:false}).api.fit(heic),/image_unreadable/);
 await assert.rejects(fitHarness().api.fit({name:'empty.jpg',type:'image/jpeg',size:0}),/image_unreadable/);
});

test('a possibly transparent PNG becomes WebP, or JPEG on white where the browser cannot write WebP',async()=>{
 const png={name:'chair.png',type:'image/png',size:9*MB};
 assert.equal((await fitHarness().api.fit(png)).file.type,'image/webp');
 const jpeg=await fitHarness({webp:false}).api.fit(png);
 assert.equal(jpeg.file.type,'image/jpeg');assert.equal(jpeg.file.name,'chair.jpg');
});

test('a photo that cannot fit even at the smallest size is refused, not sent',async()=>{
 const {api}=fitHarness({bytesPerPixel:{'image/jpeg':5,'image/webp':5}});
 await assert.rejects(api.fit({name:'huge.jpg',type:'image/jpeg',size:40*MB}),/image_too_large/);
});

test('a refused photo is reported beside the upload box, and a failed save names the photo and the reason',async()=>{
 const html=await readFile(new URL('../start.html',import.meta.url),'utf8'),start=await readFile(new URL('../start.js',import.meta.url),'utf8'),connected=await readFile(new URL('../start-connected.js',import.meta.url),'utf8');
 assert.match(html,/<\/label>\s*<p id="sourceStatus" class="source-status" role="alert" hidden><\/p>\s*<div id="primaryPreview"/);
 assert.match(start,/sourceNote\('Primary image not added\. '\+fitError\(error\),true\)/);
 assert.match(start,/document\.addEventListener\('drop'/);
 const line=connected.split('\n').find(l=>l.includes('const photoSaveHelp ='));
 const help=runInNewContext(line.trim().replace(/^const photoSaveHelp = /,'(').replace(/;$/,'')+')');
 assert.match(help('origin_rejected'),/published site/);
 assert.match(help('reference_unavailable'),/JPEG, PNG or WebP up to 3 MB/);
 assert.match(help('Request failed (429)'),/Wait a minute/);
 assert.match(help('Request failed (401)'),/signed out/);
 assert.match(connected,/was not saved: \$\{photoSaveHelp\(error\.message\)\}/);
});
