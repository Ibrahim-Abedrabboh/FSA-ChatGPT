export function bufferBridgeUpload(source){
 const w=structuredClone(source),n=w.nodes.find(n=>n.name==='Normalize owner upload');
 const old='return [{json:{payload:JSON.stringify(p)},binary:{files:b[keys[0]]}}];';
 if(!n?.parameters.jsCode.includes(old))throw Error('bridge_upload_source_changed');
 n.parameters.jsCode=n.parameters.jsCode.replace(old,`const bytes=await this.helpers.getBinaryDataBuffer(0,keys[0]);const mime=b[keys[0]].mimeType,ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];if(!bytes.length||bytes.length>3*1024*1024||!ext)throw Error('invalid_owner_image');return [{json:{payload:JSON.stringify(p)},binary:{files:{data:bytes.toString('base64'),mimeType:mime,fileName:'owner-source.'+ext,fileExtension:ext}}}];`);
 const f=w.nodes.find(n=>n.name==='Forward owner intake');f.parameters.options.response.response.responseFormat='text';f.retryOnFail=false;
 return w;
}
