# Draft 3 “Coming later” — current A7 owner frontend comparison

**Review date:** 18 October 2026, Asia/Amman. **Overall status: partially built.** A feature being visible or saved does not establish that it can render correctly or deliver a finished package.

## Evidence checked

- Original Draft 3: `outputs/draft-3-preview/app.js`, its strings, option flags, reference gates and submit mapping; `index.html` sections marking deferred options.
- Current source: private repository `Ibrahim-Abedrabboh/claude-midas-studio`, branch `codex/a7-owner-read-status`, commit `3a9a28785dfe6f6f03e9a417696f92ad4d9624af`.
- [Current owner workspace](https://midas-a7-owner-preview.netlify.app/owner/): owner session, job/history reads, original-photo display and the recorded Eye findings for the two-unit test.
- [Projects / Manual guide](https://midas-client-studio.arafat312096.chatgpt.site/client-first-page/guide): the saved guide, Atlas/Studio/example reconciliation, plus confirmed owner decisions.
- Current A7 code: intake, planner lead selection, reference ingestion, scene preparation and generation, review and package gates. Main engine remains published version `dc64f332-a6e1-4bf3-87a8-e4309c49f3e1`. Read-only status bridge now publishes sanitized observations in version `b640d920-0cbb-4189-aa37-ce8acb1a4c28`.
- Latest owner deploy: `6ad3e501c33cbf726caa45ae`, ready, source `3a9a287`; the additive reference-set migration applied successfully. **41 local tests passed** and the frontend build passed. A new paid end-to-end run has not been made.

## Status definitions

- **Fully implemented:** the narrowly named capability works in code and on the live owner preview, with the relevant checks executed.
- **Partially built:** some interface, storage or engine capability exists, but the complete user journey has an identified gap.
- **Not implemented:** the named user capability has no connected implementation. A placeholder, a generic note field or a neighbouring feature does not count.

## What Draft 3 actually deferred

Draft 3's `outcomes.laterText` explicitly named Edit, Single item, Batch, New Composition, Create with this item, plants, mood, selecting Midas supporting pieces, and hero item/focus. Its `OPT` flags also disabled Others. All of these are included below.

| Feature | What it means | Current owner frontend / engine status | Exactly what is missing to become fully implemented and live |
|---|---|---|---|
| **Edit / Edit a result** | Continue saved work or edit a new item; retain original references and the accepted direction; change only what was requested. | **Partially built.** Saved versions, original-reference inheritance, bounded saved direction and explicit change/preserve fields exist. Add/remove/replace targets can be saved. Rendering those operations is explicitly held. | Bind the accepted candidate and its exact approval/hash to the new version; use that composition as the edit base while preserving original product authority; implement a dedicated edit route rather than treating the request as a fresh white-master job; add delta review; test preservation, rejection/repair, new approvals and delivery. |
| **Single item — Hero / Secondary** | Decide whether an item leads the composition or supports other furniture/room content. | **Partially built in A7; not exposed as a frontend choice.** Current UI does not send an item-role choice. | Add a role control, validate it, carry it through the contract/planner/reviewer, and test both roles. The planner currently gives accessory detection priority over Secondary: that ordering needs correction so an accessory can remain secondary when requested. |
| **Batch** | Prepare several independent products/sets together, each with its own references, category, outputs and progress. | **Partially built.** Collections group separate saved cases. There is no batch preparation/dispatch/progress experience. | Add a case list and batch review, per-case reference and category validation, bounded aggregate/per-case budgets, idempotent child dispatch, partial-failure recovery, progress roll-up, and complete per-case delivery. Never merge unrelated products into one image. |
| **New Composition** | Arrange specified products together in a new or existing space. | **Partially built in A7; missing from the current outcome selector.** Intake plans composition output and stage 07 recognises it. | Restore the frontend outcome and its inventory/relationships/room controls; bind each product reference; verify supporting-product selection; run a complete owner-approved composition and review/package test. A selection label alone is insufficient. |
| **Create with this item** | Use the selected product as a design anchor. An accessory can lead while furniture supports it. | **Partially built in A7; absent from the frontend outcome selector.** A7 has anchor/accessory-lead planning. | Add the outcome and role controls; connect verified Midas supporting selections and their reference images; verify physical support, scale, prominence, inventory preservation and complete output delivery. |
| **Plants** | Optional greenery that supports the composition without hiding the product. | **Not implemented as an owner-selectable feature.** A7 currently reports the generic plants toggle as not applied. A confirmed Midas plant can only enter as an eligible Midas piece under existing rules. | Add a deliberate control and eligible Midas plant selection, keep stock/reference evidence, carry placement and density into the plan, and review scale/occlusion. Preserve the owner's Midas-only props rule; do not add generic plants. |
| **Mood / Vibes** | Choose a coherent scene direction such as Calm & natural or Refined & elegant, without changing product identity. | **Not implemented as a structured connected feature.** Lighting exists; it does not establish mood support. A7 explicitly lists the structured mood field as unused. | Add the agreed vocabulary, persist it, map it to composition/palette/material/light instructions, keep identity locks higher priority, expose the applied direction, and test that the chosen mood changes styling without drifting the product. |
| **Choose Midas supporting pieces** | Select the exact catalogue products to accompany the main item, including combinations. | **Partially built.** A7 retrieves and stock-checks supporting pieces, with existing limits. The frontend has no supporting-product picker. Its SKU field identifies the main product. | Add a catalogue/combination picker; distinguish hero SKU from supporting SKUs; validate availability, original product images, quantities, dimensions and support relationships; carry chosen SKUs into planning/rendering/review; show unavailable or omitted picks explicitly. |
| **Hero item or focus** | Identify the exact piece or area that should lead a multi-item scene or a detail view. | **Partially built.** A7 derives a lead; an explicit named focus is not connected. Intake currently marks `metadata.hero` unused. | Select an exact item/instance or detail, bind it to inventory/reference identity, carry it into framing and review, and verify that other required items are not accidentally omitted or distorted. |
| **Others** | Describe an additional outcome that does not fit a predefined package. | **Not implemented as a connected outcome.** Draft 3 disabled it. The current selector has no Others choice. | Capture a structured proposed outcome and deliverables; validate whether the engine supports them; obtain owner confirmation; hold unsupported outputs with a clear reason. Do not silently map an unknown request to generic image generation. |

### Important distinction: side views and series were conditionally enabled

Old Draft 3 comments call these “Coming later,” but its later F4 code actually enables them when the required reference exists. They should not be mistaken for permanently deferred features.

| Capability | Draft 3 behaviour | Current gap |
|---|---|---|
| Left / right camera view | Enabled only with the corresponding side photo. | Current frontend always sends Reference view. Its new other-view uploads do not yet have per-image left/right/back/detail/set-piece selectors. Restore the selectors and server evidence gates before enabling side-camera choices. |
| Three views | Requires a left-side reference; plans white plus three camera views. | Current frontend always sends Single image. Restore the option, preview the exact output list/cost implications, retain source side labels, and verify all four approved files and continuity. |
| Views by light | Requires a left-side reference; unavailable with a supplied room because the room's photographed light is retained. | Restore the option and the same reference/room restrictions; verify the white plus nine scene outputs, room continuity, per-output approval, aggregate cost control and package completeness. |

### Existing Draft 3 features also absent or reduced in the new owner frontend

These were not all labelled Later. They still belong in the restoration plan:

- Website's category package and the exact expected output list before confirmation.
- Department → category → subcategory, plus automatic recognition when category is unknown.
- Per-reference “what it shows,” source side labels, and separate companion-piece relationships.
- Wall paint, floor and studio-default controls, with white-output and supplied-room rules.
- Confirmed colour/material, explicit exclusions and stronger preservation fields.
- Full delivery gallery, individual output states/reasons, and complete package downloads.
- Draft 3 allowed 25 MB per source and up to 13 extra product photographs. The current owner transport allows 3 MB per file, up to four newly attached other views and two inspiration images, with 12 references total per version. Larger private uploads and the original reference capacity need a deliberate transport implementation; these limits are not equivalent.
- The current preview fixes resolution at 2K and sends no person. These are the current release choices; do not silently change them during restoration.

## Implementation order and release tests

| Priority | Work | Dependency / completion evidence |
|---|---|---|
| 1 | Connect every paid provider call to budget reservation/settlement; retain uncertain charges; disable unbudgeted native retries. | Concurrent-limit, idempotency, missing-receipt and recovery tests; every paid path guarded, including readers, planner, fallbacks, repairs and review. The tested ledger exists; engine guards are still missing. |
| 2 | Complete saved accepted-look continuation and explicit add/remove/replace edits. | Original product references + approved base hash + requested delta + protected scene. Verify only the named product/instance changes and new approvals are required. |
| 3 | Restore role, outcomes, taxonomy, reference-side metadata and exact output previews. | An interface choice must reach the canonical contract and affect the correct compiler/reviewer path. Test unsupported and contradictory choices as well as success. |
| 4 | Add collection/batch preparation and bounded dispatch. | Independent cases, shared project only, distinct sources/contracts/approvals/packages, aggregate budget, interruption and partial-failure recovery. |
| 5 | Restore selected Midas combinations, plants, mood and explicit focus. | Confirmed catalogue evidence and stock, coherent placement, identity preservation, clear omitted-pick reasons; no generic props. |
| 6 | Complete delivery/release experience and larger private intake. | Full requested-output matrix, truthful owner-exception labels, JPG/WebP/manifest receipts, preserved original bytes, no public file leakage. |
| 7 | Run the owner acceptance journeys and close each checklist item with evidence. | New project; mixed collection; new-item edit; saved-look edit; add; remove; replace; alternate views; failure/recovery; complete delivery. Local mocks do not prove live provider behaviour. |

**Spending:** Storage/database authorization is up to USD 10/month. The agent's cumulative live A7 test authorization remains USD 5 total; prior estimates were about USD 0.25921. No new paid model calls were made in this frontend/reference verification pass. A fresh paid acceptance test must fit within the remaining authorization and verified engine guards.

**Current release boundary:** owner access, saved drafts/history, source storage/previews and recorded image-reading display are available. New paid submission remains paused. Add/remove/replace are saved edit briefs, not certified live image-editing flows.

## Review limits

**Assumption:** the current release remains owner-only, with the existing model/2K/private-output decisions and approved spending limits. **Confidence:** high for the inspected source, deployment readbacks and listed live observations; limited for paid branches that have not been rerun. **needs_human_review:** false for this inventory and the implementation plan within existing authorization. **Missing evidence:** new complete paid acceptance receipts, broader category/view/edit test results, and measured monthly operating usage.
