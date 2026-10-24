# Owner submission and approval connection

This document supersedes the read-only scope in READ_STATUS.md.

## Connection

- Site: midas-a7-owner-preview / 46f574fa-3262-494a-8362-895323cd5a3e.
- Owner role is checked live against Netlify Identity on every API call.
- Cookies remain Secure, HttpOnly, SameSite=Lax. POST actions also require a matching Origin.
- The production context alone can write. A7_OWNER_ACTIONS_ENABLED must equal true.
- No browser receives n8n credentials, approval tokens, or waiting-run URLs.
- Bridge: Mo9c5GmTcx0K79F7, A7 · Owner submission and approval bridge, Personal project 9d8wrYFxXU6MFYbk.
- Main processor: 1cgZc9rmBOrPdKIe. Published existing graph, with completed execution payload saving disabled. The only processor logic change routes owner-UUID jobs into a private output folder; legacy configuration remains identical.
- Both workflows retain their existing credential references. The credential auto-assignment notice did not remove those references; readback confirmed them.
- n8n emitted a canvas layout advisory about twelve top-level nodes. The three trigger branches share one response node; functional validation passed.

## Interaction contract

1. A draft is local until the owner reviews and confirms it.
2. The initial supported submission is one PNG/JPEG/WebP product photo, at most 3 MB, White background or Lifestyle, 2K. This avoids A7's 1125px delivery minimum conflicting with 1K generation.
3. The source photo is saved in the private Netlify store a7-owner-production. Reads require owner authentication. Future owner-UUID jobs route generated files to the Restricted Drive folder `Midas A7 Owner Preview - Private` (`1EwLz7p9IG1G5JZK9kLH7MtVxgakgr2WF`). Legacy jobs retain their existing output location. The single generated test image was moved into the private folder.
4. An immutable, conditional creation claim precedes each upstream request. The source UUID binds one submission; the ticket revision binds one approval. A conflicting payload is rejected. No automatic write retry occurs.
5. A confirmation means A7 received a request; recorded job state remains authoritative. An uncertain receipt instructs the owner to check the queue before resending.
6. Approval context includes plan fields, room, selected Midas pieces, known holds, recorded estimates, review result/defects, and an allowlisted Drive candidate link.
7. Actionable tickets require a token and waiting address on the server, the current run and round, a current ticket, and age below 24 hours. Tokens and waiting URLs never leave n8n.
8. The server fetches current context again before forwarding a decision. A stale revision is refused. A7 then performs its own run/round/token validation.
9. Changes use a note for a new plan. Repairs, review-again, and approval without automated review are shown only when the current ticket offers them. The confirmation explains downstream paid work.
10. Failed queue reads show unavailable data rather than a false empty queue. Old responses cannot replace a newer selected job.

## Verification

- npm test: 21 checks pass, including malformed input, image signatures/size, origin checks, owner authentication, stale decisions, immutable claims, legacy null records, ticket expiry, candidate URL allowlist, and complete plan context.
- npm run build: succeeds.
- Signed-out POST submission / approval and GET source photo: HTTP 401, no-store. Static owner workspace: HTTP 401, private,no-store.
- Live owner submission accepted, recorded as owner-caf6e686-fd9d-4274-9091-1619f924541d / claude-a7-20261017165124-cv6b3r.
- Authenticated private source photo opened correctly. An expired legacy Go 1 ticket displayed its plan and no decision buttons.
- First live run held in stage 02: written instructions could not be turned into rules. Both readers counted two product units. Recorded text-model estimate USD 0.01323; no image generated. This is a processor issue requiring investigation, not a completed positive approval test.
- Second run `claude-a7-20261017165728-1d79cw`: submitted through the portal, Go 1 forwarded and recorded, one image generated, automated review failed, Go 2 Stop forwarded and recorded as `stopped_by_owner`. No repair or positive Go 2 approval was sent.
- The image joined two separated units and omitted connector details. Positive approval and packaging remain unverified.
- Recorded test estimate: USD 0.07397 text calls + USD 0.06940 image operation = USD 0.14337. Two duplicate text-call records were removed by identical payload/run identity. These are ledger estimates, not invoices; completeness is not independently reconciled against provider billing.
- Published processor version `78804143-8fe2-4952-b250-7737e400e5ab`. Node `04 Settings` (`a3899049-d492-4ea3-b533-756b99608719`) source is preserved in `a7-owner-output-settings.js.txt`. Existing configuration was compared in execution with mocked inputs: legacy values unchanged; owner UUID resolves to private folder.
- Manual-only helper `tG26htners4rA9GT` used the existing Drive credential to read the exact private folder. Execution 518 succeeded: ownedByMe=true, canAddChildren=true, only user/owner permission. No AI calls. Future private output creation was not tested with another paid job.
- The generated test file retained its ID when moved privately. Existing shared A7 folders and other jobs were not changed.

## Rollback and preservation

Set A7_OWNER_ACTIONS_ENABLED=false and redeploy to stop new owner writes while retaining status/history. Existing claims, receipts, and source photos remain intact. Running executions continue; a rollback does not cancel them. Re-publishing the prior Netlify deployment restores the old frontend. Do not delete claims to retry an uncertain operation; reconcile the A7 run first. No original sites, existing jobs, or tables were deleted.

## Remaining boundaries

The preview is owner-only. General conversational AI, batch jobs, multiple reference uploads, PDF/Excel extraction, direct Drive folder imports, private delivery downloads within the portal, resumable uploads, retention/deletion policy, and an operational recovery dashboard are not implemented. A7 still needs a verified full processing cycle and consistent budgeting across text, vision, image calls, and concurrent jobs before broader launch. Its default image-operation table guard is not a global transactional budget ledger.

## Owner test mode (18 Oct 2026)

`A7_OWNER_TEST_ALL_SCOPES=true` lets the owner send any scope the server validates (for example Lifestyle, other views, proportions or lighting) with a **provisional** estimate. Off by default; unset or any other value keeps the verified-only rule.

- Unchanged: the job ceiling enforced by the budget ledger, confirmed source facts, the estimate fingerprint and expiry, `A7_PAID_BUDGET_GUARDS_READY`, and the explicit confirmation before each send.
- A job with more than one saved reference is refused (`bridge_single_reference`) unless `A7_BRIDGE_MULTI_REFERENCE=true`, because the owner bridge forwards one image and would otherwise drop the rest silently.
- Still refused: add/remove/replace edits, batches and secondary items.
- Provisional figures are uncalibrated; each test job can spend up to its ceiling. Remove the variable and redeploy to return to verified-only sending.

## Sending a saved version (19 Oct 2026)

- A saved version is sent to A7 once. A second send of the same version is refused (`draft_already_submitted`) before anything is claimed, because it would start a second run with the same identity: A7 refuses that run at its source check ("Current confirmed source receipt could not be verified") and its hold overwrites the first run's record. This happened to `owner-5de62fad…` on 19 Oct (sends at 00:02:49 and 00:03:18).
- A retry with the same request ID gets the stored receipt back instead.
- Since 22 Oct 2026 only one send of a version can reach A7: right before calling A7 a send moves the version from `confirmed` to `sending` in the database. An overlapping send (another tab, a quick resend) finds no `confirmed` version and stops with `send_in_progress` (409). A send that fails before that step reopens the version only while it is still `confirmed`; `sending` and `outcome_unknown` are never reopened by a failed send. `sending` counts as unsettled for the 15-minute dispatch check. The gate lives in `lib/claude-a7-send-gate.mjs`; `tests/claude-overlapping-sends-handler.test.mjs` runs eight overlapping sends through it on the local database emulator and checks that exactly one calls A7, and that a send which confirmed and then failed before the gate never reopens a version another send is sending.
- After a send the button stays disabled and Jobs opens on the run. While A7 reads and plans, Jobs says Go 1 is not ready yet and checks again every 20 seconds (at most 15 minutes). The Go buttons read "Go 1 · Approve plan" and "Go 2 · Approve image"; a held or stopped run explains that it will not reach Go 1.
- To try a held version again, open it from Saved work and save a new version.

## Multi-photo jobs

- With `A7_BRIDGE_MULTI_REFERENCE=true` and the multi-file owner bridge published, a job can carry up to 12 files (14 MB in total): one product photo, side views, at most one room photo, inspiration, a previous result and specification files (text, CSV, JSON, PDF, Excel). Each file keeps its saved name (`role-<uuid>`) so A7 reads its role.
- The site refuses any other combination with a reason before sending (`bridge_reference_limits`).
- A7 uses the product photo and up to 13 side views for the white master; inspiration photos are registered but not read by a model yet.

## Reader time limits and retries (19 Oct 2026)

- A reading stopped when one reader was slow: on 19 Oct the first reader took about 2.5 minutes, while the analysis bridge waited 2 minutes and the run was capped at 3, so finished readings were lost.
- Now the analysis bridge waits up to 295 s, both analysis workflows may run 300 s (the n8n instance maximum), the site's background reader waits 305 s and the page checks for six minutes.
- Each reader (Eye, second count, room reader, conflict check) retries once after 5 s on an error, inside its budget reservation. The main A7 workflow has the same change for its reading and checking calls, saved as a draft until it is published; image generation never retries automatically.
- The analysis workflows accept a job budget up to USD 10; one analysis quote is still at most USD 5.
