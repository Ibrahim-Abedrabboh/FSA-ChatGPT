import {randomUUID} from 'node:crypto';
// Acknowledge before processing, and never insert a duplicate run on recovery.
export function acknowledgeBeforeProcessing(source){
 const w=structuredClone(source),job=w.connections['Job accepted']?.main?.[0],reply=w.connections['Send job received']?.main?.[0],branches=w.connections['Recovery · Reuse readers?']?.main;
 if(job?.length!==2||!job.some(e=>e.node==='Send job received')||!job.some(e=>e.node==='Recovery · Reuse readers?')||reply?.length!==1||reply[0].node!=='Log received'||!branches?.[1]?.length||w.connections['Log received']||w.nodes.some(n=>n.name==='Receipt · Restore accepted input'))throw Error('acknowledgement_graph_changed');
 const edge=node=>({node,type:'main',index:0}),log=w.nodes.find(n=>n.name==='Log received'),send=w.nodes.find(n=>n.name==='Send job received');
 if(!log||!send)throw Error('acknowledgement_nodes_missing');
 const process=job.find(e=>e.node==='Recovery · Reuse readers?');
 const originalReaders=branches[1];
 const restore={id:randomUUID(),name:'Receipt · Restore accepted input',type:'n8n-nodes-base.code',typeVersion:2,retryOnFail:false,position:[log.position[0]+220,log.position[1]],parameters:{mode:'runOnceForAllItems',jsCode:"const it=$('Job accepted').first();return [{json:it.json,binary:it.binary}];"}};
 w.nodes.push(restore);
 w.connections['Job accepted'].main[0]=job.filter(e=>e!==process);
 w.connections['Send job received'].main[0]=[process];
 branches[1]=[edge('Log received')];
 w.connections['Log received']={main:[[edge(restore.name)]]};
 w.connections[restore.name]={main:[originalReaders]};
 // Keep this existing group a connected subgraph with one entry and one exit.
 for(const g of w.nodeGroups||[]){
  if(g.name!=='Receipt')continue;
  if(g.nodeNames)g.nodeNames=g.nodeNames.filter(n=>n!==send.name).concat(restore.name);
  if(g.nodeIds)g.nodeIds=g.nodeIds.filter(id=>id!==send.id).concat(restore.id);
 }
 return w;
}
