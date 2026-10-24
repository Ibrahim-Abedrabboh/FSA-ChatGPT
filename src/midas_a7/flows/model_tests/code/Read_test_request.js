const b=$json.body||{};
// Owner model test: one stage, one arm, one photo per call. Only 03 Eye is connected; generation and verdict come next.
if(b.stage!=='eye'||!['A','B','C','D','E'].includes(b.arm))throw Error('invalid_test_request');
const MIDAS=/^https:\/\/(www\.)?midasfurniture\.com\/media\/catalog\/product\/[A-Za-z0-9_\-\/]+\.(jpe?g|png|webp)$/;
if(typeof b.imageUrl==='string'&&b.imageUrl){if(!MIDAS.test(b.imageUrl))throw Error('image_url_not_allowed');return [{json:{stage:b.stage,arm:b.arm,url:b.imageUrl,hasUrl:true}}];}
const mime=b.image?.mime,data=b.image?.base64;
if(!['image/jpeg','image/png','image/webp'].includes(mime)||typeof data!=='string'||data.length<20||data.length>4300000||!/^[A-Za-z0-9+/=]+$/.test(data))throw Error('invalid_image');
return [{json:{stage:b.stage,arm:b.arm,url:null,hasUrl:false},binary:{data:{data,mimeType:mime,fileName:'photo'}}}];