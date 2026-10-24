// All non-stop decisions may lead to paid work, including accepting a master
// while later scenes remain. Keep this fail-closed until every engine call is guarded.
// Owner approved production release on 18 Oct 2026, up to USD 5 per job.
// Redeploy after the owner saves the Functions/Production readiness setting.
// Deployment still reads the explicit readiness flag; this comment enables nothing.
export function spendingHold(action, guardsReady) {
 return action !== 'stop' && guardsReady !== 'true';
}

export const spendingHoldResponse = Object.freeze({
 error:'paid_guards_not_ready',
 message:'Your saved work is unchanged. Paid processing is paused while the engine spending checks are completed. You can still stop a waiting run.'
});
