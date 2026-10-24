const requestId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

// A draft version owns one immutable spending identity. Both the source readers
// and the later job must use these values; request IDs remain retry keys only.
export function sharedRunIdentity(draftId){
 if(!requestId(draftId))throw Error('draft_required');
 return {clientRunId:'owner-'+draftId,runId:'claude-a7-'+draftId};
}
