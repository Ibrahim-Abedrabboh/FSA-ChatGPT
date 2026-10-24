# Owner page messages: what they mean and what to do

Messages on the owner page (`/owner/start/`), in the order you meet them.
"Paid" means the step spends from the job budget. Every message that says "Nothing was sent" means no money was spent by that action.

## The job flow in one line

Save → **Review analysis cost** (reads the photos; paid, small) → **Confirm or correct source facts** → **Get estimate** → **Review paid submission** → A7 reads and plans → **Go 1** (approve the plan) → white master is made and reviewed (paid) → **Go 2** (approve the image) → package.

## 1. Saving the draft

| Message | Meaning | What to do |
|---|---|---|
| Select a primary original product image first. | No product photo is chosen. | Upload a photo, or import a Midas link. |
| Enter each physical piece on its own line as a quantity and name, such as "1 sofa". Use at most 20 lines. | A line in **Physical pieces and quantities** is not "number, space, name". "1. Mirror" and "Mirror" are refused. | Write `1 Wall Hanging Mirror`: a number 1–999, a space, a name up to 60 characters. Check every line, including lines you must scroll to. |
| Enter the product type before saving. | **Product type** is empty. | Type it, for example "bedroom set". |
| Enter a job budget from USD 0.25 to USD 10.00 in cents. | The budget is outside the allowed range or has more than two decimals. | Enter, for example, `4.74` or `10`. |
| Describe the requested edit and what must remain unchanged before requesting an estimate. | Edit jobs need both boxes filled. | Fill "changes" and "keep unchanged" in Step 2. |
| The direction is unchanged. Edit Step 2 before saving a new version. | You reopened a sent version and changed nothing. | Change the direction, then save. |
| Unchanged saved draft reopened. No new version or paid job was created. | Information only. | Continue. |
| An earlier draft update has an uncertain result. Reopen the saved version before changing it again. | A previous save did not get a clear answer, so the page refuses a different save until you reload. (On 19 Oct this was caused by a site bug, fixed the same day.) | Reload the page, open the saved version, then save once. |
| An earlier draft was updated while the page changed. | You changed fields while a save was running. | Review the saved version, then save again. |
| Details changed. Save this version again before requesting a new estimate. | You edited after saving. | Click **Save draft and original references** again. |
| This source version is already saved. Review its source analysis before requesting an estimate. | The photos are saved; the next step is the analysis. | In Step 2 · Source understanding, click **Review analysis cost**. |

## 2. Source facts and conflicts (photo reading)

These buttons are in **Step 2 · Source understanding**: **Save originals for analysis**, **Check analysis availability** (free) and **Review analysis cost** (starts the paid reading after you confirm the amount). The analysis reads your saved photos with two independent readers (category, piece count, colour, cut-off parts) and a third check compares what they saw with what you wrote.

| Message | Meaning | What to do |
|---|---|---|
| **No source/request comparison has been recorded.** | The photos of this saved version have not been analysed yet. Normal for a new job. | Click **Review analysis cost**, then confirm the small reservation. |
| **A source/request conflict check has not run.** | Same as above: the conflict check runs as part of the analysis. | Click **Review analysis cost**. |
| No reader observation is available for this saved version. | Not analysed yet. | Click **Review analysis cost**. |
| A reading exists, but for a different product or room photo than this version has now. / The conflict check ran for photos this version no longer has. | The product or room photo changed after the reading. Since 20 Oct a reading belongs to the photos it read, so changing the direction, preferences, pieces or budget never discards it. | Save the originals as a new version and analyze that. |
| The direction changed after these photos were read. The facts above still describe the photos… | The reading is kept. Its conflict check compared the photos with the earlier direction; A7 checks the current direction again when the job is sent. | Confirm the facts as usual. |
| The source analysis could not be read just now. | The page could not load the analysis state; it does not mean "not analysed". | Step 2 shows the reason. Reload the page; do not start another analysis. |
| Save the current original and draft before requesting a separate source-analysis estimate. | Nothing is saved yet. | Save the draft first. |
| Source analysis reserves up to USD X within your USD Y total job ceiling. | Price of the analysis, taken from the same job budget. Unused reserve is released. | Click **Review analysis cost**, then confirm. |
| Source reading is not connected to a verified cost and reader yet. No paid analysis can start. | Analysis is switched off on this site (`A7_ANALYSIS_READY`). | Use the preview site, or ask for it to be switched on. |
| Reading the originals in the background. Do not start another analysis. | The analysis is running. It usually takes 1–5 minutes. The page checks every 10 seconds. | Wait. You may leave the page; the result is kept. |
| The readings have not arrived after six minutes. | The page stopped checking; the reading may still finish. | Click **Check analysis availability** (free). Do not start another analysis. |
| The background reading stopped before all readings arrived (reason: …). | A reader failed. A *524* or *504* answer is a gateway timeout, not a failure: since 19 Oct the page keeps checking and collects the reads from the ledger, so it no longer shows as stopped. Other reasons: *a7 no answer in time* (took longer than allowed), *a7 unreachable*, *a7 http error*, *a7 unreadable answer*, *a7 not accepted*, *no answer recorded* (nothing came back within 10 minutes). | Click **Check analysis availability**; it recovers any reads already paid. If it still fails, send the reason to support. Do not start another analysis on this version. |
| The reading’s receipt could not be checked: … / The source analysis state could not be read: … Whether reads already started were charged is not confirmed … | The check itself failed, so the page cannot tell whether reads were charged. It no longer says "nothing was paid" here. | Do not start another analysis. Press **Check analysis availability** again later: completed reads are collected from the ledger without a new charge. |
| The analysis receipt is pending or uncertain. / Analysis was sent and may still be running. | A7 got the request but the result is not confirmed. | Wait a minute, then **Check analysis availability**. |
| Original references changed. Save and analyze the current version again. | The photos changed after the analysis. | Save, then analyze the new version. |
| Compare these model observations with every original, then confirm or correct them. | Readings arrived. They are model observations, not facts yet. | Check category, piece count and room against your photos, then click **Confirm or correct source facts**. |
| Resolve: … / Reader conflict: … | The readers disagree with each other or with your request (for example count 3 vs 4). | Correct the value and write a short reason in the resolution box, then **Confirm or correct source facts**. |
| No recorded conflict in this reader receipt. Check the originals before confirming. | Readers agree with your request. | Click **Confirm or correct source facts**. |
| Source facts confirmed for this saved version. / Owner resolution recorded. | Done. | Go to **Get estimate**. |

Errors shown after **Confirm or correct source facts** (as "Source confirmation was not recorded: …"):

| Code | Meaning | What to do |
|---|---|---|
| analysis_confirmation_incomplete | Category, count, or (when a room photo exists) room type is empty. | Fill all three. |
| analysis_correction_reason_required | You changed a reading. | Write why in the resolution box. |
| analysis_conflict_unresolved | A listed conflict has no resolution, the explanation is over 600 characters, or the explanation was not matched to every finding of the current reading. The message says which. Since 20 Oct the page reloads the reading after this refusal and keeps what you typed, and the server log records which rule refused it (codes only). | Write or shorten the explanation in **Explain disputed facts**, check the findings shown, then confirm again. |
| analysis_confirmation_stale / analysis_source_changed | The photos or readings changed. | Reload and review again. |
| analysis_already_confirmed | Already confirmed. | Continue to the estimate. |

## 3. Estimate and scope

| Message | Meaning | What to do |
|---|---|---|
| Confirm the source facts in Step 2 before requesting a job estimate. | Analysis not confirmed yet. | Finish section 2. |
| Draft request only: … paid submission stays disabled. | Owner test mode is **off** and the job is outside the one verified path (one product photo, one White BK, square 2K). The reasons listed say what is outside it. | Either reduce the job to the verified path, or turn on owner test mode (`A7_OWNER_TEST_ALL_SCOPES=true`, then redeploy). |
| Owner test mode: … can still be sent after a provisional estimate. | Test mode is on. Any scope the server accepts can be sent; spending still stops at the job ceiling. | Continue. Turn test mode off when testing ends. |
| This request matches the current single-source square 2K white-master scope. | Verified path. | Continue. |
| Estimate unavailable: … / The cost estimate is unavailable. | The estimate could not be made. Nothing was charged. | Retry; if it repeats, report the text after "unavailable". |
| Instructions changed while the estimate loaded. | You edited during the estimate. | Save and estimate again. |
| Review the current verified estimate before starting paid processing. | The estimate is missing or old. | Click **Get estimate** again, then review. |

## 4. Sending the paid job

| Message | Meaning | What to do |
|---|---|---|
| A7 received this job. It is reading and planning now… Do not send it again. | Sent. | Watch **Jobs** for Go 1 (usually a few minutes). |
| This saved version was already sent to A7. Nothing was sent again. | Each saved version can be sent once. | Follow it in Jobs. To send again, save a new version. |
| A7 refused to start this job (answer 422). A7 said: … Nothing was read or paid by this send, and the saved version is a draft again… | A7's intake checked the job and did not start it. Since 20 Oct the version goes back to draft (before, it stayed "sent, outcome unknown"). | Fix what A7 named, save, get the estimate again and send. |
| Receipt is uncertain. Check the queue before taking another action. | A7 did not confirm and did not clearly refuse (no answer, or a gateway error). The version stays sent. | Wait 15 minutes, then **Check with A7** in Saved work: if A7 has no run, the version becomes a draft again. Since 20 Oct a paid Step 2 source reading alone no longer counts as A7 having the job. |
| This job could not be sent because of a storage or service error on this site. Nothing was sent to A7 and nothing was paid. | Since 22 Oct 2026: the send failed on this site before reaching A7, and the version is a draft again. | Try again in a minute. |
| This send stopped before reaching A7, but another send of this version may already be with A7. Check Jobs before sending again | Since 22 Oct 2026: this send failed before reaching A7, but another send of the same version (another tab, a quick resend) may have gone through. | Check **Jobs**. If nothing appears within 15 minutes, use the dispatch check, then send again. |
| Another send of this saved version is already on its way to A7, or the version changed. Check Jobs before sending again; nothing more was sent. | Since 22 Oct 2026: two sends of one version overlapped; only one may reach A7, and this one stopped. | Check **Jobs**. If the version shows as a draft again, send it once more. |
| This send could not be checked just now because of a storage or service error. Nothing was sent to A7. | Since 22 Oct 2026: an unexpected error during the send checks (it used to be shown as a source-facts problem). | Try again in a minute. |
| Current confirmed source facts are required before planning. Nothing was sent to A7. | Confirmation missing or outdated. | Confirm the source (section 2). |
| confirmed_inventory_mismatch | The pieces you listed do not add up to the confirmed count (for example 2 + 1 + 1 = 4 but you confirmed 3). | Make the list total equal the confirmed count, or re-confirm. |
| Save the required product and room references first. Nothing was sent. | A required photo (product, or room for "existing room") is missing. | Add and save it. |
| bridge_reference_limits (message names the limit) | Too many files (max 12), too large (max 14 MB total), more than one product photo or more than one room photo. | Remove the extra files. |
| The A7 owner bridge forwards one product image per job. | Multi-photo is off on this site. | Use one photo, or turn on `A7_BRIDGE_MULTI_REFERENCE`. |
| A7 cannot make Variations yet. Nothing was sent. | Variations need an approved earlier image, which A7 does not keep yet. | Untick Variations. |
| This job budget is lower than the one already opened for this saved version. | A budget can be raised, not lowered, for the same version. | Keep or raise it. |
| The A7 connection secret is not set on this site. | Site setting missing. | Ask for `A7_READ_AUTHORIZATION` to be set. |

## 5. Jobs, Go 1 and Go 2

| Message | Meaning | What to do |
|---|---|---|
| No Go yet: A7 is still reading and planning this job. | Normal for the first minutes. The page checks every 20 seconds. | Wait for Go 1. |
| Go 1 · A7 has a plan. Approve it to start image generation, ask for changes, or stop. | The plan is ready. | Read the shots, then **Go 1 · Approve plan**, **Request plan changes** or **Stop**. |
| Go 2 · Review the white master. | The image is made and reviewed. | Open the image, then approve, request a repair (paid) or stop. |
| Go 1/Go 2 ticket is expired or can no longer be answered safely. | A decision waited more than 24 hours, or changed. | Refresh the job; if still expired, save a new version and send again. |
| No Go decision is open: this run is hold (…). | A7 held the run; the reason is in brackets. A held run never reaches Go 1. | Fix the reason, save a new version and send once. |
| No Go decision is open: A7 has recorded no progress on this run since … (over two hours). | The run stopped without saying why. | Save a new version and send again. |
| Unable to load run … | The job detail could not be read. (A duplicate-row cause was fixed on 19 Oct.) | Refresh; if it repeats, report the run id. |

Common A7 hold reasons (shown in brackets in Jobs):

| Hold reason | Meaning | What to do |
|---|---|---|
| Current confirmed source receipt could not be verified. No reader or planner was started. | The same version was sent twice; the source receipt can be used only once. Nothing was spent on reading or planning. | Save a new version, confirm, send once. |
| A Midas pick is not in the catalogue / not in stock / not on the Kuwait page / is a cushion or throw. | A companion piece cannot be used. | Remove or replace the pick, then send a new version. |

## 6. Midas import and companion pieces

| Message | Meaning | What to do |
|---|---|---|
| Paste a Midas product link or SKU first. | The box is empty. | Paste one product link or a numeric SKU. |
| This link is not a single Midas product. | You pasted a category or search page. | Open one product and copy its link. |
| No Midas product has this SKU. | Wrong or old SKU. | Check the SKU on midasfurniture.com. |
| Midas lists no photo / returned its "no photo" placeholder. | Midas has no usable photo. | Upload your own photo. |
| X of Y can be used as companion pieces. | Picks checked against the A7 catalogue. A7 uses at most 3, only in room images. | Keep the usable ones; save the draft again. |
