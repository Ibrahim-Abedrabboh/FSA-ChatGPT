# A7 shared analysis and job ceiling: local release packet

This packet is local only. The published branch and n8n workflows have not been changed by this integration work.

## Reviewable artifacts

- `a7-analysis-only-workflow.ts`: a standalone authenticated analysis webhook. It carries the four existing provider readers (03, 05, optional 06, 09) and each corresponding reserve, permit, settle, durable answer checkpoint and hold chain. It has no planner or image generator. `build-analysis-workflow.mjs` regenerates it from `a7-analysis-node-snapshot.json`, pinned to the inspected main workflow version. The node snapshot includes sanitized configuration and credential *references*, not credential values.
- `a7-owner-analysis-workflow.ts`: existing five-node owner bridge, now bound to the shared draft/run identity. Its forward target is the standalone workflow's `claude-midas-a7-analysis` webhook.
- `lib/a7-main-workflow-patch.mjs`: applies a six-node continuation delta to a full exported main workflow. It accepts the server-bound preallocated run ID at `01 Intent & scope`; after the accepted-input restore it requests a source continuation proof from Netlify. Only a verified proof enters `Confirmed source evidence`, then the existing profile/contract/planning path. Legacy jobs retain the original reader fan-out. A rejected or uncertain proof enters an owner hold. The confirmed branch skips repeat 03/05/06 calls and prevents a repeat 09 conflict call.
- `netlify/functions/a7-budget.mjs` exposes `source-continuation` under the existing engine header authentication. `lib/a7-source-continuation.mjs` verifies owner, saved draft, current source, current confirmation, complete reader checkpoints and same budget/run, then atomically claims the one continuation. A duplicate or uncertain attempt does not receive another permit.
- `lib/a7-understanding-production.mjs` opens the chosen shared ceiling, loads only owner-scoped saved original blobs, verifies SHA-256 and checks completed answer checkpoints before deriving observations. `A7_ANALYSIS_READY` stays off until both n8n workflow changes are deployed. The `recover` action reads completed ledger answers without sending a model call.

## Production change order

1. Review and deploy the Netlify code with `A7_ANALYSIS_READY` absent or false. Confirm existing owner routes and legacy jobs still work; check the new budget action rejects unauthenticated calls.
2. Generate `a7-analysis-only-workflow.ts`, validate its pinned node definitions with the official n8n validator, create its draft, and inspect its credential references and multipart mapping. Publish it only when approved. The owner bridge forward path must match its published webhook.
3. Export the exact current main workflow, check its version against the reviewed source version, run `patchMainWorkflow(exportedWorkflow)` locally, inspect the six added nodes and three edited nodes, then validate the resulting draft. Publish only when approved. Do not apply the patch to a changed workflow version without re-review.
4. Use pinned, non-provider test data to prove product-only, product-plus-room, invalid owner/source, duplicate continuation and uncertain receipt paths. Only after that, enable `A7_ANALYSIS_READY` for the production owner preview. A paid live proof requires its own authorization.

## Rollback

Turn `A7_ANALYSIS_READY` off first. Restore the prior published main workflow version and unpublish the analysis-only workflow if necessary; retain budget rows, operation receipts, claims and held runs for reconciliation. Never delete uncertain reservations or replay a source reader automatically. Existing jobs keep their original reader route and random run IDs.

## Validation and limits

The official n8n SDK validator accepts the 46-node analysis workflow. It reports four warnings for literal `{{ ... }}` text embedded inside copied Code-node request hashing; isolated validation of the six new main nodes succeeds. Local tests cover identity reuse, owner and checkpoint verification, duplicate denial, uncertain recovery and legacy branch preservation. The patch was also applied to a read-only full export of the pinned 351-node main workflow: it produced 357 uniquely named/identified nodes with no dangling connections. The graph has not been executed with live providers, so binary field behavior, model response shapes and final provider receipts still require pinned-data validation before release. No schema change or new persistent credential is proposed.
