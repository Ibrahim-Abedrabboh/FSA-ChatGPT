function blindAnswer(response){
 if(response?.status!=='completed'||response.error)throw Error('blind_answer_incomplete');
 const text=(response.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let b;try{b=JSON.parse(text);}catch{throw Error('blind_answer_invalid');}
 if(!Number.isSafeInteger(b.total)||b.total<0||b.total>199||!Array.isArray(b.pieces)||b.pieces.length>30||b.pieces.some(x=>typeof x.kind!=='string'||x.kind.length>100||!Number.isSafeInteger(x.count)||x.count<1)||b.pieces.reduce((n,x)=>n+x.count,0)!==b.total||!['background_white','text_or_logo','cropped'].every(k=>typeof b[k]==='boolean')||!['unclear','hidden'].every(k=>Array.isArray(b[k])&&b[k].length<=12&&b[k].every(x=>typeof x==='string'&&x.length<=200))||!Array.isArray(b.box_2d)||b.box_2d.length!==4||!b.box_2d.every(x=>Number.isFinite(x)&&x>=0&&x<=1000)||b.box_2d[0]>=b.box_2d[2]||b.box_2d[1]>=b.box_2d[3])throw Error('blind_answer_invalid');
 return b;
}
const r=$input.first().json;if(r.statusCode!==200||!r.body?.preservedResponse)throw Error('blind_continuation_rejected');const response=r.body.preservedResponse;const parsed=blindAnswer(response);return [{json:{response,parsed}}];