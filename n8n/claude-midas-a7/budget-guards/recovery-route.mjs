import {randomUUID} from 'node:crypto';
// Statement blocks belong in Code nodes, not in n8n's expression parser.
export const recoveryRouteCode=`const it=$input.first();let p=it.json.body?.payload;try{if(typeof p==='string')p=JSON.parse(p);}catch{p=null;}return [{json:{...it.json,__recoveryRequested:Boolean(p&&typeof p==='object'&&!Array.isArray(p)&&p.recovery)},binary:it.binary}];`;
export function repairRecoveryRoute(source,id=randomUUID()){
 const w=structuredClone(source),branch=w.nodes.find(n=>n.name==='Recovery · Requested?');
 if(!branch||w.nodes.some(n=>n.name==='Recovery · Parse route'))throw Error('recovery_route_source_changed');
 const edge=node=>({node,type:'main',index:0});
 const previous=w.connections['A7 job webhook'];
 if(previous?.main?.[0]?.length!==1||previous.main[0][0].node!==branch.name)throw Error('recovery_route_connection_changed');
 w.nodes.push({id,name:'Recovery · Parse route',type:'n8n-nodes-base.code',typeVersion:2,retryOnFail:false,position:[branch.position[0]-220,branch.position[1]],parameters:{mode:'runOnceForAllItems',jsCode:recoveryRouteCode}});
 branch.parameters.conditions.conditions[0].leftValue='={{ $json.__recoveryRequested === true }}';
 w.connections['A7 job webhook']={main:[[edge('Recovery · Parse route')]]};
 w.connections['Recovery · Parse route']={main:[[edge(branch.name)]]};
 return w;
}
