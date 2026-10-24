function permissionGranted(response) {
 const body=response?.body;
 return response?.statusCode===200&&body?.send===true&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.permit||'')&&
  Number.isSafeInteger(body.reservedMicroUsd)&&body.reservedMicroUsd>0;
}
const response=$input.first().json,t=$('Budget · 03b · Ticket').first(),allowed=permissionGranted(response);return [{json:allowed?{...t.json.original,__budgetAllowed:true}:{__budgetAllowed:false,__budgetState:t.json.state,__budgetReason:'Fallback was not sent: no valid spending permission.'},binary:allowed?t.binary:undefined}];