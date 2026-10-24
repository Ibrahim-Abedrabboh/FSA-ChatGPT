import {randomUUID} from 'node:crypto';
export function bridgeTransportCheck(source){
 const w=structuredClone(source),find=name=>w.nodes.find(n=>n.name===name);
 if(find('Transport check?'))throw Error('already_installed');
 const receipt=find('Safe action receipt');if(receipt)receipt.parameters.jsCode=receipt.parameters.jsCode.replace('accepted:ok,forwarded:',"accepted:ok,error:!ok&&/^[a-z_]{1,80}$/.test(b?.error||'')?b.error:null,forwarded:");
 const normalize=find('Normalize owner upload');
 normalize.parameters.jsCode="const it=$input.first();let probe=it.json.body?.payload;try{if(typeof probe==='string')probe=JSON.parse(probe)}catch{probe=null}if(probe?.transportProbe===true){if(!/^owner-[a-f0-9-]{36}$/.test(probe.clientRunId||'')||Object.keys(it.binary||{}).length!==1)throw Error('invalid_transport_probe');try{const key=Object.keys(it.binary)[0];const data=await this.helpers.getBinaryDataBuffer(0,key);if(!data.length||data.length>3*1024*1024)throw Error('invalid_probe_size');return [{json:{http_status:200,transportProbe:true,valid:true,bytes:data.length,clientId:probe.clientRunId}}];}catch(error){return [{json:{http_status:409,transportProbe:true,valid:false,error:'probe_binary_unavailable',errorType:String(error.name||'Error').replace(/[^A-Za-z]/g,'').slice(0,40)}}];}}\n"+normalize.parameters.jsCode;
 const node={id:randomUUID(),name:'Transport check?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[370,400],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:'={{ $json.transportProbe === true }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 w.nodes.push(node);const edge=name=>({node:name,type:'main',index:0});
 w.connections['Normalize owner upload']={main:[[edge(node.name)]]};
 w.connections[node.name]={main:[[edge('Return owner response')],[edge('Forward owner intake')]]};
 return w;
}
