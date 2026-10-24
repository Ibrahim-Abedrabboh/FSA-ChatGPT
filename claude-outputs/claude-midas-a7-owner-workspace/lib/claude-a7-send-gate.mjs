// The send gate of a new job, kept apart from the handler so overlapping sends can be tested on a real database.
// Only the one send that moves a saved version from 'confirmed' to 'sending' may call A7 (rule 22).
import {markSending,reopenUnsentDraft} from './a7-projects.mjs';
import {releaseClaim} from './a7-actions.mjs';

export const SEND_IN_PROGRESS={error:'send_in_progress',retryable:false,message:'Another send of this saved version is already on its way to A7, or the version changed. Check Jobs before sending again; nothing more was sent.'};
export const NOT_SENT={error:'not_sent',retryable:true,message:'This job could not be sent because of a storage or service error on this site. Nothing was sent to A7 and nothing was paid. Try again in a minute.'};
export const NOT_SENT_CHECK_JOBS={error:'not_sent_check_jobs',retryable:false,message:'This send stopped before reaching A7, but another send of this version may already be with A7. Check Jobs before sending again; do not send it twice.'};

// Returns null when this send may call A7, or the 409 refusal body when another send holds the version.
export async function takeSend(pool,{ownerId,draftId,clientRunId,store,submitClaim}){
 if(await markSending(pool,ownerId,draftId,clientRunId))return null;
 if(submitClaim)await releaseClaim(store,submitClaim);
 return SEND_IN_PROGRESS;
}

// A send that failed before its request left this site. Only a version this send confirmed, and that is still
// 'confirmed' (no send has moved it to 'sending'), is reopened. Returns the status and body to answer.
// getPool is called inside the try, so a missing database connection still answers instead of throwing from the catch path.
export async function settleUnsentFailure(getPool,{ownerId,draftId,clientRunId,store,submitClaim,confirmedHere}){
 let reopened=false;
 try{
  if(confirmedHere)reopened=await reopenUnsentDraft(getPool(),ownerId,draftId,clientRunId);
  if(submitClaim)await releaseClaim(store,submitClaim);
 }catch(cleanup){console.error('owner-actions','submit','reopen failed',String(cleanup?.message||cleanup).slice(0,120));}
 return {status:503,body:reopened?NOT_SENT:NOT_SENT_CHECK_JOBS};
}
