# Claude · Midas A7: stage 05 (review and owner go 2)

15 Oct 2026, 22:40 Amman. Written by Claude.

## Status

- Workflow: "Claude · Midas A7 (stages 01–05)", `1cgZc9rmBOrPdKIe`. It was renamed from "stages 01–04".
- Not published. No real run was made, and no paid call was made.
- Tested only with pinned data.
- The n8n version after the build is `4b88ed91`.

## What stage 05 does

1. After stage 04 stores the white master (status `awaiting_review`), **16a Review ticket** sends two images to the reviewers. Image 1 is the vendor photo. Image 2 is the candidate.
2. **16 Critic review** (Claude Sonnet 5.5) checks 16 points against the contract:
   - piece count and each piece present once
   - shape, colour, material and texture, identifying details
   - handedness, not mirrored, nothing invented
   - excluded pieces absent, room context left out
   - pure white background, contact shadow
   - whole product in frame, no text or logo, photographic realism
3. **16x Blind count** (Gemini 3.8 Flash) counts the candidate without being told the expected number. It also reports the background, any text or logo, and cropping.
4. **16b Review verdict** (code) compares the three counts (contract, reviewer, blind count) and decides the result:
   - **passed**: a reviewed candidate, not an approval.
   - **unsure**: a check was unsure or missing.
   - **failed**: at least one check failed.
   - Scores (fidelity, integrity, drift, data loss) are recorded as the reviewer's judgement. They are never a measurement or the 90–95 target.
   - A reader that does not answer holds the run for the owner.
5. **Every reviewed candidate waits for the owner's go 2** for up to 24 hours. The owner answers at the same decision address as go 1 (`/claude-midas-a7-decision`, owner header), with id, run_id and round taken from the go 2 ticket. There are three answers:
   - `approve`: status becomes `white_master_approved`. This is the only place "approved" comes from.
   - `repair`: one more paid attempt, which can carry a note. The note is added to the corrections as data. Then a new review and a new go 2.
   - `stop`: the run stops.
6. A repair is a paid call. By default the owner orders it at go 2 (04 Settings `auto_repair: false`). If `auto_repair` is set to true, up to two repairs run without asking, within the job budget the owner saw at go 1.
7. At most two repairs are allowed (attempt 3). After that the run holds.
8. A forged or stale answer is ignored, and the run waits again. After 5 such answers, the run holds.

## What changed

**New nodes (13):**
- Review due?
- 16a Review ticket
- Images ready?
- 16 Critic review
- 16x Blind count
- Reviews done
- 16b Review verdict
- Repair ordered?
- Waiting for go 2?
- Wait for go 2
- G2 Go 2 verdict
- Wait again for go 2?
- Sticky Note stage 05

**Changed nodes:**
- **13 Compile**:
  - Accepts status `repair_ordered`, and uses repair orders only in that state.
  - Applies the **Test 8 rule**: a context piece the inventory names (for example a light) counts as seen and is drawn. When there are two candidates for one item, the run holds.
- **15q Stage 04 result**: the round equals the attempt; the texts are updated.
- **15c Drive run folder**: from attempt 2, the folder name ends in "· try N".
- **V1 Vault events**: adds the events review, repair_order, go2_ticket and go2_decision, and fills the go 2 row fields. The go 2 token is kept in the run row only, never in the vault.
- **Update run row**: maps the 6 new columns.
- **G1a, G1b and G1d**: the decision address now serves both go 1 and go 2.
- **04 Settings** adds:
  - `auto_repair: false`
  - `hero_share_min_pct: 25` and `hero_share_max_pct: 40` (owner, 21:44; used by Scenes, not built)
  - `dimensions_from_photos: 'internal_estimate_only'` (owner, 21:48)
- **Sticky notes**: the overview note and the go 1 note were updated.

**Runs table (`l0roUCBwIQL3h9Eq`):** new columns `review`, `go2_token`, `go2_round`, `go2_decision`, `go2_note`, `go2_at`.

## What was checked, and how

**Local stage 05 tests: 57 of 57 pass.** They cover:
- pass, unsure, failed and missing checks
- blind count disagreeing with the contract
- reader errors
- auto repair, and attempt 3 holding
- all go 2 answers, forged token, wrong round, timeout, and 6 ignored calls
- 13 Compile repair and the Test 8 rule (4 cases)
- G1b for both gates
- V1 events, and the token kept out of the vault
- the first-attempt prompt is byte-identical to the earlier version

**Regression suites, run by a separate agent:**
- The older suites are 86/86 and 37/37 on the old code.
- With the new code, 4 tests changed outcome, all because of intended text or contract changes: D9, T3, T34 and T35.
- After updating those expectations (for example, the test harness now sets status `repair_ordered` for repairs), the result is 86/86 and 37/37.

**Byte comparison:** all 9 changed or new Code nodes in n8n match the tested local files.

**Pinned n8n runs:**
- **424** (review passed). The run reached go 2. A forged answer was ignored 5 times; the 6th held the run. The token was not in the vault.
- **425** (review failed, `auto_repair` pinned to true). The repair was ordered and 13 Compile made attempt 2 with the correction (key `…:try2`). The run then held at 15e, as expected, because the pinned reservation was for try1. The real run row (id 21) received the new columns, including `review`.
- **423**: my pin-data mistake (it held at the planner). It is not a stage 05 test.

## Not checked

- Real reviewer calls. This includes whether the Anthropic node keeps the order of `vendor,candidate` (image 1 is assumed to be the vendor photo).
- The approve and repair answers through the real decision address. The pinned token cannot match a fresh random token.
- A full attempt 2 dispatch in n8n. This needs an unpinned reservation, which would write operations rows.
- Reading the binaries after a real 24-hour wait.

## Assumptions

- Repairs wait for the owner by default (reversible in 04 Settings).
- Test 8 matching is by head noun, with a few synonyms (lamp, pendant, chandelier and sconce all count as light; bedside table counts as nightstand).

## Not built

- The Scenes stage (it will use the hero share of 25–40%).
- The Package stage (1125×1125 jpg and webp, manifest, identity entry).
- Data imports.

## Leftovers

**Runs table rows:**
- 19 and 20 (`claude-test-a7-n8n-s05-01`)
- 21, my inserted test row `claude-a7-20261015-test-s05b`
- 22 (`claude-test-a7-n8n-s05-02`)

**Vault rows** for executions 423–425.

There are no new operations rows and no Drive files.

**Local work files:** `/home/claude/a7/` (s05, regress, regress_new).

## Update, 15 Oct 2026, 23:40

- Owner framing (23:22): the white-master prompt in 13 Compile gains one line (about 12% white margin on every side; the product spans about 76% of the frame; never crop). The model test MT4 gets the same line, so it still tests the stage 04 prompt.
- The review has a 17th check, `framing`, judged by eye by the reviewer.
- 04 Settings: `framing` replaces the hero share of 25–40%. Lifestyle hero about 60–70% of frame height, wide view less, detail view more; these are for the scenes stage, which is not built.
- Checked: stage 05 tests 57/57 (the first-attempt prompt equals the earlier one plus only the framing line); older suites 86/86 and 37/37; the model-test plan differs only by the framing line on all 16 planned calls. All 33 A7 Code nodes and MT4/MT1 in n8n match the repo byte for byte. No run was made.
- n8n versions: A7 `0f5ea2c8`, model test `5ed8dbbe`. Not published.

## Update, 16 Oct 2026, 00:15

Two housekeeping gaps closed. No run was made, no paid call, nothing published.

- **One-call export added to the repo.** "Claude · Midas A7 model test · one call" (`MYwlkpnVdCqoEmfR`, version `e66075ec`) is now in `n8n/claude-midas-a7-model-test-one-call/`: the workflow JSON and its 7 Code nodes. Checked by two independent reads from n8n (mine and a separate agent's); they match exactly on all 20 nodes. Read only; the workflow was not changed. Commit `0954ce1`.
- **A7 description corrected in n8n.** It now reads: stages 01–05, owner go 1, one paid white-master call, review, owner go 2 (approve, repair or stop; at most two repairs), not published. Metadata only: the node version stays `0f5ea2c8`, so the repo export of A7 is still exact.
- **Checked before the change:** no executions after 425; A7 and model-test versions match the repo exports; local tests 57/57, 86/86, 37/37.
- **Lesson:** the older suites rewrite their own result files (`local_results*.json`) when run. Those copies were restored, not committed. Future regression runs use a scratch copy.

## Code

All code, tests and n8n exports are in the private GitHub repo `Ibrahim-Abedrabboh/claude-midas-studio`: `n8n/claude-midas-a7/` (workflow export and one file per Code node), `n8n/claude-midas-a7-model-test/`, `n8n/claude-midas-a7-model-test-one-call/`, `tests/claude-midas-a7-stage-05/`, and the files moved from this Project under `claude-outputs/` (see `MANIFEST.md`). n8n remains the authority.
