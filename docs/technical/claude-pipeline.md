# The A7 pipeline

*Technical documentation · checked against commit `2bd6550` (21 Oct 2026)*

Main workflow `1cgZc9rmBOrPdKIe`, "Claude · Midas A7 (stages 01–07)". The frozen baseline (`n8n/baseline/1cgZc9rmBOrPdKIe.json`) has 362 nodes:
- 111 `Budget ·`, 25 `Blind ·`, 19 `Recovery ·` and 12 `Package ·` guard nodes;
- one `Receipt ·` node;
- 194 others, 8 of them sticky notes.

It has 151 Code nodes. Their JavaScript is copied byte for byte into `src/midas_a7/flows/a7_main/code/`, the source of truth for the Python service; CI regenerates and diffs it. `n8n/claude-midas-a7/code-nodes/` holds the 58 core Code nodes from the older export. Four of them differ from the baseline (`18a`, `18e3`, `18h`, `18p`), plus `11b`, which is changed on purpose by speed change 3.

## Stages

| Step | Purpose | Holds or rules | Main code nodes |
|---|---|---|---|
| **01 Intent & scope** | Map the brief to required outputs (at most 8, or 10 for a views-by-light lifestyle series); read shape, views, people on or off | Refuses bad job ids and variations without a parent | `01_Intent_scope.js` |
| **02 Ingest** | Give each file a role and a sha256; read text files | Refuses a job with no product photo, or a file over 25 MB | `02_Ingest_files.js` |
| **03–06 Evidence** | Eye (Gemini) lists pieces blind; a second blind count (Claude); a room reader if a room photo came; code compares the counts with the client's number | Disagreement, a cropped photo or fewer pieces than the contract hold. A reader with no answer holds for the owner | `04_06_Evidence.js`, `03a`, `06a`, `16xa` |
| **07–09 Route, locks, contract** | Pick the handling profile; set locks and freedoms per output; GPT conflict check; contract vN with a sha256 stamp | An unsettled conflict holds | `07_Route.js`, `08_Locks_and_freedoms.js`, `09b_Contract.js` |
| **10–12 Retrieve, style, Go 1** | Up to 12 in-stock Midas pieces; the stylist plans each output; the critic checks (at most 2 rewrites) | Go 1 waits 24 h: go, change (at most 3 rounds) or stop. more than 5 calls without this run's token, run id or round hold the run | `10_…`, `11a`–`11d`, `12_…`, `G1*` |
| **13–15 Compile & dispatch** | Build the white-master prompt; one POST to Google; store with checksum | Only a registry-"approved" model; daily image limit; job budget; operation key `run_id:output_id:tryN`; no auto-retry; never resend an uncertain call | `13_Compile.js`, `14_Choose_model.js`, `15*` |
| **16 Review & Go 2** | Critic against vendor photo and contract; blind count without the target; verdict passed, unsure or failed | Go 2: approve, repair, stop, review_again, approve_unreviewed. At most 2 repairs; `auto_repair=false` | `16a`, `16b`, `G2_Go_2_verdict.js` |
| **18 Package** | Checksum and size check; background set to 255 around a protected product box (no AI); JPG and WebP 1125×1125; manifest; identity-vault entry | `white_package_ready` only if every file saved and checked. Phase 1.2: when only the background rule failed (edge rows or a grey halo in a saved file), the owner decides at go 2: approve = deliver as exception (packaging runs again, no AI or paid call, the problem is recorded and the release is `owner_exception`, never catalogue-eligible), repair = a new image (one of the two repairs), or stop. Other package holds stay holds. Phase 1.3: the white files are delivered only when the product's longest side spans 76% ± 3 points; a product above the band (or too tight to clean) is fitted on a white canvas in code only when a review of that image found it whole (for an image approved without a review: when the blind count's box passes the review's own edge test and is not flagged "cropped"), and a cut-off, unconfirmed or too-small product holds with a plain reason (never enlarged) | `18a`–`18p`, `G2` |
| **19 Scenes** | Empty room first, then placement; props from a live Midas stock read (10 s apart); later views from the approved wide image | Each scene has its own review and Go 2. At most 3 props. One request carries every reference inline, up to `max_inline_mb` (14 MB). Phase 1.6 (Python service): above it, `19g` first shrinks each reference whose long side is above 2048 px to 2048 px in code (no AI, aspect kept, JPEG q90; the vendor photo last, only if still needed) and records each resize in `scene.ref_resized` and the trail; still too large, the master is dropped, then the scene holds before any reservation | `19a`–`19g` |
| **20 Scene files** | JPG and WebP at the scene's own shape, short side 1125 | Never stretched, cropped, padded or upscaled; a smaller master holds | `20a`–`20m` |
| **Vault** | Append-only events (brief, observation, contract, plan, decisions, operation, candidate, review, package, identity, scene…) | One row per event | `V1_Vault_events.js` |

## Fixed rules (in code)

- **Framing** is on the longest side: white about 76% (12% margin each end), hero 60–70%, wide 40–55%, detail more than half. A miss is a note. A cut-off product still fails hero and wide. (`04_Settings.js`)
- **Approval labels:**
  - A pass is a "reviewed candidate".
  - For an approval by eye, the owner sees "Approved by the studio · not reviewed" and the client sees "Approved by the studio".
  - A review bound to its candidate gives "Owner approved · review passed" (`G2_Go_2_verdict.js`).
- **Camera heights:** bedroom 135 cm, living 110–120, dining 130, other room-scale 120. A tabletop product is shot at surface plus half its height, tilt 0. Light presets 4000 K, 3000 K, 2700 K.
- **Paid nodes** 03, 03b, 05, 06, 06b, 09, 11, 11c, 15g, 16, 16x, 16xb are each wrapped in `Budget · NN` reserve, permit and settle nodes.
- **Engine helper for Code nodes (Phase 1.6, Python service only).** The JavaScript sidecar has no image library, so a Code node may await `this.helpers.midasResizeReference(ref, longSide)`: the sidecar asks the engine over its stdin/stdout protocol, the engine shrinks the stored file with Pillow (`src/midas_a7/nodes/claude_reference_resize.py`, the Edit Image node's resize) and answers with the new stored file, its sizes and checksum. Only `19g` uses it. n8n has no such helper.
- **Retries.** The image call 15g never retries, and an uncertain image outcome is never resent. Text and vision nodes 03, 05, 06, 06b, 09, 11, 11c, 16, 16x and 16xb retry once (2 tries, 5 s apart) inside the same budget reservation. The status poll 15k tries 3 times. (`n8n/baseline/1cgZc9rmBOrPdKIe.json`; migration plan §3)

## Models (from the live export)

| Step | Model |
|---|---|
| 03 Eye / 06 Room / 16x blind count | Gemini `gemini-3.8-flash` (fallback `gpt-6.1-sol`) |
| 05 Second count / 11c plan critic / 16 review | Anthropic `claude-sonnet-5-5` |
| 09 conflict check | OpenAI `gpt-6-luna` |
| 11 stylist | OpenAI `gpt-6.1-sol` |
| 15g image | The approved row of the model registry, today Google `gemini-nano-banana-2.1` at 2K. Since Phase 1.5 (Python service) the budget ticket follows the registry instead of a fixed id. The owner site's ledger (`lib/a7-budget.mjs`) must also allow and price the model (its `CALL_POLICY` names one model for 15g today), or the reservation is refused before any call. The n8n code nodes are unchanged |

## Other workflows

| Workflow | Id | Webhook | Purpose |
|---|---|---|---|
| Owner submission and approval bridge | `Mo9c5GmTcx0K79F7` | `a7/owner-context`, `a7/owner-submit`, `a7/owner-decision` | Owner site to A7 |
| Owner status and history | `G4cLxmwbkCxmCbQF` | `a7/owner-read` | Safe read-only job status |
| Owner source analysis bridge | `AOTL7OVYtXLLs1L1` | `a7/owner-analyze` | Forwards to analysis-only |
| Source analysis only | `AMdtt1fFwHln4DB8` | `claude-midas-a7-analysis` | Readers 03, 05, 06, 09 under budget guard; no image |
| Model tests per stage | `jYkKQ2NOreSG0t97` | `a7/model-test` | Owner page compares model setups on one photo |
| Catalogue refresh | `mGgKxO0638I77meF` | none (Saturday 04:00 Amman schedule) | Re-reads midasfurniture.com listings; unpublished in n8n |
| A7 model test / one call | `WvmDSrnX6lYdiKzZ` / `MYwlkpnVdCqoEmfR` | | White-master image model test; paid switch off |

The two recovery webhooks in the main flow (`a7/approved-blind-recovery`, `a7/approved-package-recovery`) hard-code one n8n run id. The Python service does not serve them.
