import {randomUUID} from 'node:crypto';
export function recoveryFailureReceipt(source){
 const w=structuredClone(source),find=name=>w.nodes.find(n=>n.name===name),edge=node=>({node,type:'main',index:0});
 if(find('Recovery · Valid checkpoint?'))throw Error('already_installed');
 for(const name of ['Recovery · Request','Recovery · Restore checkpoint']){
  const n=find(name);if(!n)throw Error('missing_node');
  n.parameters.jsCode="try{\n"+n.parameters.jsCode+"\n}catch(error){const code=String(error.message||'');return [{json:{recovery_error:/^(?:recovery_[a-z_]+|invalid_recovery|ambiguous_recovery_run)$/.test(code)?code:'recovery_input_unavailable',failed_node:"+JSON.stringify(name)+"}}];}";
 }
 for(const name of ['Recovery · Read run','Recovery · Read evidence'])find(name).onError='continueRegularOutput';
 const check=structuredClone(find('Recovery · Reuse readers?'));check.id=randomUUID();check.name='Recovery · Valid checkpoint?';check.position=[-1100,-400];check.parameters.conditions.conditions[0].id=randomUUID();check.parameters.conditions.conditions[0].leftValue='={{ !$json.recovery_error && $json.reader_recovery === true }}';
 const response=structuredClone(find('Send job received'));response.id=randomUUID();response.name='Recovery · Return failure';response.position=[-850,-250];response.parameters={respondWith:'json',responseBody:'={{ JSON.stringify({accepted:false,error:$json.recovery_error || "recovery_checkpoint_invalid",failed_node:$json.failed_node || "Recovery checkpoint"}) }}',options:{responseCode:409,responseHeaders:{entries:[{name:'Cache-Control',value:'no-store'}]}}};
 w.nodes.push(check,response);w.connections['Recovery · Restore checkpoint']={main:[[edge(check.name)]]};w.connections[check.name]={main:[[edge('Recovery · Claim once')],[edge(response.name)]]};return w;
}
