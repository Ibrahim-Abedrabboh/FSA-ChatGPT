# Draft A3: five amendments to Option A2. README

7 October 2026, 00:15 Amman time · prepared by Claude

## Status

- **Workflow:** `Claude · Midas VTON · Option A3`, id `FoSSz8n5nUEpfx1H`, in n8n, Personal project.
- **Published:** no. Read back at 00:11: not active, no active version, last change 00:05.
- **Real run made:** no.
- **Paid call made:** no. No call to OpenAI or fal.ai was made by this build or its tests.
- **Test runs:** five, with simulated replies only (executions 255 to 259, 00:06 to 00:09). All were made after the last change.
- **Option A2:** unchanged. `Claude · Midas VTON · Option A2` (`HicX8PPeeH7jMNZw`) was last changed at 22:38 on 6 October.
- **Paid test on the 12 pipeline 3 jobs:** not run. See "The paid test" below.

You asked for "a new option A2". It is named A3, because your rule is that an earlier draft is not edited in place.

## What A3 is

A3 is a copy of A2, made with n8n's Duplicate at 23:53 on 6 October. It then got its own names and five amendments.

| Own to A3 | Value |
| --- | --- |
| Addresses (paths) | `claude-midas-vton-a3`, `-status`, `-decision`, `-batch`, `-file`. `-regenerate` exists and is switched off, as in A2 |
| Run ids | start with `va3-` |
| Run log | `Claude job runs VTON A3` (`KnsirWSKA3tIWXKd`) |
| Vault | `Claude Midas vault VTON A3` (`k8My0Lyc6j1zKlnf`), actor `vton option a3` |
| Operations | `Claude Midas operations VTON A3` (`MHmbn6ORgRIkLI1E`) |

Shared with A2 and Option A, read only: handling profiles, catalogue, lessons VTON A, model registry VTON A, the white clean-up sub-workflow.

The access header is `X-Midas-Key`, as before. Its value is not in this file.

## What changed

| # | Amendment | Steps | What the draft does now | What A2 did |
| --- | --- | --- | --- | --- |
| 1 | Plan check fails safe | `05c` | A plan check that cannot be read is asked once more. If it is unreadable again, the image is held and nothing is made from an unchecked plan | Counted an unreadable check as a pass |
| 2 | Owner changes are re-checked | `05h`, new step `Owner changed a plan?`, `05c`, `05i`, `05g` | When you change the wording of a plan at the first stop, only the changed plans go back to the plan check. A pass locks the contract again as version 2 and the run goes on without a second stop. A fail holds that image. Your wording is never rewritten | Rendered the changed plan without a check, under the old contract stamp |
| 3 | Honest hold message | `03` | When no product is found, the hold says which case it is: the product type in the form was not found, the pieces could not be counted, or nothing could be identified. It lists what the photo shows | Always said "No product inventory could be read from the photo" |
| 4 | Out-of-stock pieces | `03c`, `05i` | A Midas piece listed as out of stock is not offered to the stylist. It is recorded as rejected with its listed status and date | Offered it, then dropped it after the stylist chose |
| 5 | Record fixes | `03c`, `05f`, `05i`, `05g` | The contract ledger travels on from `03g`. A piece whose catalogue photo fails to load is recorded with that reason. The go preview counts the conflict check and lists the description calls | Dropped the ledger at `03c`. Recorded a failed photo as "not chosen". Left both calls out of the preview |

**Steps changed (9):** `01` (run-id prefix only), `03`, `03c`, `05c`, `05f`, `05g`, `05h`, `05i`, `V1` (actor name only).

**Steps added (2):** `Owner changed a plan?` and a note, `Sticky Note A3`.

**Links changed:** `Go given?` now leads to `Owner changed a plan?`. Yes leads to `05a Plan critic ticket`. No leads to `06 Render ticket`.

**Instructions to the models:** none changed. All ten model steps are identical to A2.

**What a normal job sends to the models:** the same as A2, with one exception. With Midas pieces allowed, the two pieces listed as out of stock (SKU 174770 and 167956, as listed on 28 September) are no longer in the list given to the stylist.

Also in `03`: when the kind of vendor file cannot be read, it is still handled as a single product shot, and that is now noted for the owner.

## What was checked, and how

1. **Local simulation: 86 checks, all passed.** The changed steps were run on this session's machine, outside n8n, with invented replies in place of the models. Inputs came from the record of A2's simulated run 253. It covered:
   - each changed step against the A2 code on the same input: identical output, except the intended differences;
   - a wrong product type, a photo with no product, pieces that cannot be counted, an unreadable Eye reply;
   - an unreadable plan check once, twice, and on the last allowed round;
   - a go with no change, a changed plan that passes, one that fails, one that is unreadable, a left-out image, a stop, no answer;
   - the full re-check chain after a go, up to the step before rendering;
   - catalogue candidates with and without the out-of-stock rows, and a failed catalogue photo.
2. **Read back from n8n and compared, twice** (00:04 and 00:11). All 58 code steps equal the local files character for character. 49 of them are identical to A2. Every other difference from A2 is one of the 6 addresses, the 17 table pointers or the 2 added steps.
3. **Five test runs in n8n with pinned data.** The same 28 steps were pinned as in A2's tests, so nothing left n8n.

| Run | Case | Result |
| --- | --- | --- |
| 255 | Variations with a look image; go with a changed light on shot 2 | 153 steps, all succeeded. The re-check ran once for 1 plan. Contract version 2 replaced version 1. No second stop. Three image rounds, audit, final inspection, export, description and manifest ran. Vault holds both contract versions |
| 256 | Variations; plain go | 138 steps. The new step answered No and the run went straight to rendering, as in A2 |
| 257 | Form says "Bench and Ottoman", photo shows a lounge chair | Held at `03` with the new message. Only the Eye step ran |
| 258 | Plan check unreadable twice | Asked again once, then both images held. No go stop, no render |
| 259 | Lifestyle with Midas pieces; one catalogue photo fails; stop at the go | 9 pieces offered, 2 left out for stock. The failed photo is recorded with its true reason. Preview counts the conflict check |

## What was not checked

- **No model was called.** How the real models behave on A3 is not known. This was already true of A2.
- **A changed plan that fails, inside n8n.** A pinned step gives the same reply every time, so the first check and the re-check cannot differ. Local simulation only.
- **Whether the plan critic judges an owner's change well.** It needs a paid test.
- **The props-on-white fix inherited from A2.** Still not tested on a real room photo.
- **The six A2 additions.** Not re-tested beyond runs 255 and 256.
- **The owner decision address, the status address, the file address and a real upload.** The tests entered through the batch entry with small inline images. The addresses need publishing first.
- **White background jobs, Website package and batch on A3.** Not run.
- **Row counts in the three A3 tables.** Counted from the execution records, not read back from the tables.
- **Security scan:** not run. Nothing here serves web pages, and this session has no scanner key.

## Known gaps left as they are

- **The run card's paid-call line** still leaves out the conflict check and the two description calls. The manifest counts the conflict check. The go preview now counts both.
- **Leaving an image out at the go** does not lock the contract again. The manifest lists the image as left out.
- **Route and lock records** are still written and not read by a later step. A2 already routes in code by white or not, kind of vendor file and category.
- **The run card headline** for run 258 reads "No image passed the automatic checks". The reason per image is correct.

## Assumptions

- ASSUMPTION: a changed plan that fails the re-check is held, not rewritten. Rewriting would render something you did not approve.
- ASSUMPTION: "asked once more" means one retry of an unreadable plan check, inside the existing limit of three plan checks. After a go, one retry is allowed on top.
- ASSUMPTION: stock words that remove a piece are "out of stock", "sold out", "unavailable", "not available" and "discontinued". "Pre-Order" pieces are still offered.
- ASSUMPTION: the hold message names the product type as written in the form.

## The paid test

It was not run. Three things are missing.

1. **The photos.** The pipeline 3 run log keeps the result images, not the product photos. The 12 jobs used 6 files: `ChatGPT Image Oct 5, 2026, 12_57_01 AM.png`, `11-169456_a (1).webp`, `wmremove-transformed.jpeg`, `12-154934_A_…_1024x1024.webp`, `dining.jpg`, `888.jpg`. Attach them, or connect the folder that holds them.
2. **A way to answer the two stops.** A3 is not published, so its go and decision addresses do not answer. Publishing needs your word in a message.
3. **A spending limit.** No price is recorded for any model. A simulated job of 3 images with a look image and no repair makes 17 paid calls: 14 counted by the run card, plus the conflict check, the description writer and its check. That is a count, not a price.

Marking each image accept or reject stays with you. I can add my own reading beside yours, labelled as mine.

## Not built

The rule-book Brain (a table of rules read by one step before the stylist). Splitting "shown with" into things on the product and things around it. A warning for large sets. A benchmark set. Prices in the model registry. Everything listed as not built in the A2 README. Option B.

## Leftovers

- **Workflow:** `Claude · Midas VTON · Option A3`, unpublished.
- **Tables:** the three A3 tables above.
- **Test rows, by the execution records:** 15 in the run log, 17 in the vault, 12 in operations. Client run ids `vton-a3-selftest-0001` to `0005`.
- **Read the finished rows of runs 0001 and 0002 with care.** They say "reviewed candidate", show scores of 100 and count 3 image renders. All of that is simulated. No image exists.
- **Executions:** 255 to 259 on A3.
- **Canvas boxes:** the A2 box "2 Plan and plan check" is now two boxes, "2 Plan the scenes" and "2b Plan check". The re-check enters the plan check half-way, and n8n allows one entry per box. `Owner changed a plan?` sits outside the go box for the same reason. No step is affected.
- **This session only:** the patch script, the simulation script and saved copies of both drafts. They hold no key. The execution records used for checking held resume tokens; the tokens were stripped on save and the records were deleted at 00:12.
