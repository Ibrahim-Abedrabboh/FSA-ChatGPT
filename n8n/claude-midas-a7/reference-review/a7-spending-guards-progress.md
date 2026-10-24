# A7 spending controls — implementation status

Snapshot: 18 October 2026, Asia/Amman. Owner-only preview.

## Live and verified

- Owner job status, history, saved projects/cases/versions and private reference previews remain available.
- A provisional cost estimate is displayed before paid confirmation, with planned outputs, coverage, exclusions and the separate job ceiling.
- The estimate is calculated on the server from the saved draft and reference fingerprints. Changed/expired estimates cannot pass confirmation.
- Provisional estimates cannot authorize dispatch. All approval actions capable of continuing paid work are also paused server-side. Stop remains available.
- The live saved white-master test displayed USD 0.219 without repairs, USD 0.436 with two requested repairs and a separate USD 4.74 ceiling. These figures use the existing Route worksheet; they are not current-price quotes.
- Netlify deploy 6ad3ea805cf48f327c7a91d2 succeeded at source commit 75155663b7b8f7f2e12288dd2450a730d9672fc8. Both GitHub checks passed.

## Built and locally tested, not installed in the engine

- A generated 294-node draft retains the original 183 nodes and adds guard/settlement paths around all 12 identified paid provider nodes.
- Stable logical operation IDs, atomic database reservations and duplicate-send prevention.
- Frozen model/output-cap checks and an explicit image response cap.
- Separate accounting for Google thought tokens; malformed/missing receipts retain the reservation and stop continuation.
- Native provider retry settings are disabled in the generated draft.
- Original node IDs, credentials, webhook/wait nodes, settings and group definitions are checked in source tests.
- n8n schema checks accepted the new HTTP and IF configurations.

## Checks executed

- Owner application: 47 tests passed, including local database concurrency/idempotency, owner isolation and the authenticated paid-action hold.
- Guard runtime/graph: 13 tests passed. Generated Code-node programs compile.
- Owner application build passed.
- Native n8n diagnostic succeeded with paidCalls = 0. It tests import behavior only; it does not certify live provider guarding.
- The live estimate screen was opened with a saved private reference; Confirm and send was disabled.
- No new paid model calls were made during this work.

## Required before paid testing

1. Resolve workflow update access. The connector exposes no update tool; native import regenerated node IDs and can duplicate nodes. A protected local API key has been requested so the exact existing workflow can be updated.
2. Test API updates on the unpublished diagnostic first, including group and ID preservation.
3. Validate and read back every main-engine change, publish the exact verified version, then run zero-provider budget checks.
4. Recalibrate the cost worksheet against current pricing and the actual selected call paths. The current estimate remains provisional.
5. Complete the budget/uncertain-operation view and recovery checks before paid release. Provider exceptions or crashes can leave reservations requiring explicit review.
6. Only then run the bounded owner acceptance test within the remaining cumulative USD 4.74 test allowance.

Main A7 engine remains on dc64f332-a6e1-4bf3-87a8-e4309c49f3e1; the generated guard graph has not been installed or published.

## Remaining agreed implementation order

1. Finish spending guards, estimate confirmation and receipts/recovery.
2. Accepted-look continuation and real add/remove/replace rendering with preservation checks.
3. Guide/Draft 3 role, category/outcome, side-reference controls and output preview.
4. Collection/batch orchestration.
5. Midas selections, plants, mood and focus.
6. Delivery/release and operational experience.
7. Full owner acceptance journeys.

The remaining items are not claimed fully live. See the feature-status and Draft 3 audit reports for each individual gap.
