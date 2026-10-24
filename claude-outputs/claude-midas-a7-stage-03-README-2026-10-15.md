# Midas A7 · Stage 03 "Retrieve & style" (steps 10–12) and owner go 1 · README

15 Oct 2026. Stage 03 written 04:50 Amman time; go 1 added 05:30 Amman time.

## Status
- **Workflow:** `Claude · Midas A7 (stages 01–03)`, id `1cgZc9rmBOrPdKIe` (renamed from "stages 01–02").
- **Published:** no. It is a draft, as before.
- **Real run:** none. No paid call was made. Every model step in the tests was pinned.
- **Where a run now stops:** it waits up to 24 hours for the owner's go 1. It then ends as **go 1 given**, **stopped by owner** or a **hold**. Stages 04–06 are not built, so go 1 makes nothing and pays for nothing.
- **Final n8n version checked:** `6d10534d-3c22-43e3-aac7-375b8e8123be` (65 nodes). The stage 03 version before go 1 was `273dc3ed-5259-4c6b-8926-320e32e77282`.

## What stage 03 does
1. **Step 10 · Retrieve Midas pieces (code).** It reads the new table `Claude Midas A7 catalogue` and builds a shortlist of up to 12 pieces.
   - A piece needs a SKU, a catalogue photo and the date it was read. Otherwise it is not offered.
   - Out of stock is never offered. Stock text that mentions "out of stock", "sold out" or "unavailable" anywhere counts as out of stock.
   - Stock text that is not clear (for example SANOVA, "In stock on the Saudi store; Kuwait page not found") is rejected as "availability not confirmed".
   - A piece of the same kind as the product is rejected. So is a kind the job excludes (for example a table when the client wants the chairs only).
   - **Client picks are fixed.** If a pick cannot be used, the job holds and the client gets **one** question that names every problem pick. A pick on a white-background-only job also becomes a question. A pick is never dropped silently.
   - A white-background-only job needs no retrieval.
2. **Step 12 decision, made before planning:** who leads the scene. The product leads, an accessory leads ("Create with this item", bookends, vases and similar), or the product supports a furniture-led scene (item role "secondary"). The blueprint makes this a parameter of the planner, so it is set first and checked again at the end.
3. **Step 11 · Plan (gpt-6.1-sol).** One plan per required output. The instructions are A6's stylist instructions, adapted to A7 outputs, plus the stylist skill rules: room size, one zone, rug, mirrors, curtains, layered light, 60-30-10 palette roles for the room only, the lead, and the Midas rules.
4. **Step 11b · Stylist check (code).** Code fixes only what it can fix without inventing anything:
   - It removes any SKU that is not on the shortlist.
   - It keeps the job to at most 3 different Midas pieces. Client picks hold their places first.
   - It resets the white master to neutral studio light with no props. The client's lighting never applies to it.
   - It removes a person from the props only when the job says "no people" (changed 15 Oct; see "Owner decisions applied").
   - It flags, for the critic, a generic prop that names a Midas product, a person in the presentation, and a client pick that no shot uses.
   - It runs the stylist skill's engine (unchanged, v0.3) on each scene shot. The result is labelled "rule-based judgement, not a measurement; not an approval".
   - A plan with a scene shot missing holds for the owner. A missing white master gets the studio's fixed plan.
5. **Step 11c · Plan check (claude-sonnet-5-5).** It is from a different family than the planner. It runs 10 checks per shot: the 7 A6 checks plus `midas_pieces_ok`, `room_rules` and `lead_respected`. From round 2 on it also sees the shots that already passed, for consistency.
6. **Step 11d · Verdict (code).** It applies the critic's rewrites and checks again.
   - **At most 2 rewrite rounds for the job, then hold for the owner.**
   - An unreadable critic answer is asked once more, then held.
   - A missing answer is never a pass.
7. **Step 12 · Lead check and go 1 ticket (code).** It writes the ticket for the owner:
   - each shot's plan, and whether it passed its check (and after how many rewrites);
   - the code fixes;
   - the Midas pieces with SKU, catalogue photo, page, the date they were read and availability;
   - generic props, each labelled "generic context, not a Midas product";
   - rejected pieces with reasons;
   - risks, what is not confirmed, warnings and the cost estimate.
   It sets the status `awaiting_go_1`.
8. **Vault.** It adds the events `shortlist`, `plan` and `go1_ticket`. Hold and status events now say stage 03. Every plan event carries the contract stamp, so a voided contract also voids its plans.

## Owner decisions applied (15 Oct 2026)
- **People:** a person may now appear. At most one per scene shot, only when it suits the scene, always beside or behind the product, never in front of it or covering it, never on the white master. If the client page sends "no people" (`preferences.people` = none, or `human: false`), people are off for that job.
- **Plants:** the stylist decides how many generic plants each scene shot gets. They never hide the product or stand in front of it.
- Changed in: `01 Intent & scope` (reads the people choice), `11a Plan ticket` (the people and plant lines), `11b Stylist check` (removes a person only when people are off), the planner instructions (rule 10) and the critic instructions (`client_choices_respected`, `props_clean`).

## Owner go 1 (built 15 Oct 2026)
**Main run.** After the vault is saved, a run in status `awaiting_go_1` waits up to 24 hours at `Wait for go 1`.
- The go 1 ticket now tells the owner how to answer: `answer_with` gives the job id, run id and round.
- Step 12 makes a one-time token for each round. It is kept only in the run row, never in the vault or the ticket.
- The run row also keeps the address the waiting run continues from (`resume_url`). n8n signs this address.

**Decision address.** `POST /webhook/claude-midas-a7-decision`, protected by the owner header (credential "Claude · Midas owner header"). The body is:
`{ "id": job id, "run_id": ..., "round": ..., "decision": "go" | "change" | "stop", "note": ..., "changes": [...] }`.
- It finds the one run waiting under that job id and checks the answer.
  - **400:** bad id; a decision other than go, change or stop; missing run id or round; a change with nothing in it, or with both edits and a note; a shot that is not a scene shot (the reply lists the scene shots); no field that can change; more than 3 change rounds; a change on a white-only job.
  - **409:** no run waiting; more than one waiting; a run id or round that is not the plan waiting now; the waiting address is not on this n8n host; no token.
- If the answer is valid, it adds the token and passes it on to the waiting run.
- It replies 200 when the waiting run got the answer, or 502 when the run could not be reached.

**What the waiting run does with the answer** (`G1 Go 1 verdict`, code only):
- **go:** status `go_1_given`. Stage 04 is not built, so no image is made or paid for.
- **stop:** status `stopped_by_owner`.
- **change with field edits** (setting, light, camera, presentation, supporting_props, midas_pieces) on scene shots: the changed shots go back through the stylist check and the plan critic, then the owner is asked again. The white master is fixed and is never changed. An owner edit with a SKU that is not on the shortlist is removed by code, as for the planner.
- **change with a note:** the planner plans again, with the note as data, then the check, then the owner is asked again.
- **At most 3 change rounds**, then hold. The 2-rewrite limit of the critic starts again for each owner change round.
- **No answer in 24 hours:** hold for the owner.
- **A call without this run's token, run id and round** (for example a call made straight to the waiting address) is ignored and recorded as "ignored" by "unknown caller", never as the owner. The run keeps waiting. After 5 such calls it holds.
- The run row is written at once: status, answer and time. The address and token are cleared. So a run never stays "waiting" after it has been answered.
- Each answer adds a `go1_decision` event to the vault. A new plan adds `plan` and `go1_ticket` events again. The brief, observation and contract are not written twice.

**New nodes (16):** `Waiting for go 1?`, `Wait for go 1`, `G1 Go 1 verdict`, `Wait again?`, `G1 Record answer`, `G1 Restore state`, `Re-plan after go 1?`, `Re-check after go 1?`, `A7 owner decision webhook`, `G1a Find waiting run`, `G1b Decision check`, `Decision valid?`, `G1c Resume the waiting run`, `G1d Forward result`, `G1e Send reply`, and a sticky note.
**New columns in `Claude Midas A7 runs`:** `resume_url`, `go1_token`, `go1_decision`, `go1_note`, `go1_at`, `go1_rounds`.
**Updated nodes:** `01 Intent & scope`, `11a Plan ticket`, `11b Stylist check`, `12 Who leads the scene`, `V1 Vault events`, `Update run row`, both prompts, and the main sticky note.

### Go 1: what was checked, and how
- **Code matches n8n.** All 19 Code nodes and both prompts in n8n are byte-identical to the local files, on version `6d10534d…`. A scan found no key-like strings in the workflow or the files.
- **Local tests: 86 of 86 pass.** S1–S60, G1–G13 (go 1) and D1–D16 (decision address). S59–S60 cover the people rule. G13 was added after pinned run 398.
- **Pinned runs in n8n (no model was called, no real resume):**

  | Execution | Case | Result |
  |---|---|---|
  | 398 | 6 answers without the token | 5 times waited again, then an owner hold. Run row: address and token cleared. **Defect found:** the hold recorded the forged "go" as the decision |
  | 403 | Same case after the fix | Hold; recorded as `ignored`. The row's address and token are cleared |
  | 399 | Genuine go (state at step 12 pinned, with a test token) | `go_1_given`; row updated; address and token cleared |
  | 400 | Decision address: unknown job id (real table lookup) | 409 "No run is waiting for go 1…" |
  | 401 | Decision address: valid change for shot 2 (waiting row and resume call pinned) | 200; the answer carries the token, run id and round |
  | 402 | Decision address: resume call fails | 502 "The waiting run could not be reached…" |

- **Seen in run 398:** the address n8n gives a waiting run is `https://<host>/webhook-waiting/<execution id>?signature=…`. n8n signs it, so the waiting address cannot be guessed from the execution id alone.
- **Second independent review** (before deployment): all must-fix items were fixed in code and are covered by tests G4–G12 and D1–D16.

### Go 1: what was not checked
- **A real resume.** No run has truly waited and been resumed by the decision address. This cloud workspace cannot call n8n web addresses. The first live test should be one job: send it, read the ticket, answer go at the decision address, and check that the run row says `go_1_given`.
- **Change and re-plan inside n8n.** These paths are tested locally (G5, G6, G8, G9) but not in a pinned n8n run, because a pinned Wait gives the same answer every round.
- **The client or owner page.** No page sends go 1 answers yet.

### Go 1: open items
- **The token and the signed address are stored in the run row, and they also appear in n8n's execution data.** Anyone who can read the table or the executions can answer. Both are cleared from the row once answered.
- **The decision address has no CORS setting.** It is meant for the owner's tool or n8n, not a browser page yet.
- A held or timed-out run cannot be continued. The job is sent again.
- `Wait for go 1` and the decision address work only once the workflow is published. Publishing needs your go.

## What changed in n8n (stage 03)
- **Added (13 nodes):**
  - `10a Load Midas catalogue`, `10 Retrieve Midas pieces`
  - `Pieces clear?`, `Scene to plan?`
  - `11a Plan ticket`, `11 Stylist plans the scenes`, `11b Stylist check`
  - `Critic needed?`, `11c Plan critic`, `11d Plan verdict`
  - `Plan again?`, `Plan clear?`
  - `12 Who leads the scene`
  - plus a sticky note for stage 03.
- **Removed:** `Contract ready`. Its job is now done by stage 03.
- **Updated:**
  - `Hold and ask the client`: it knows stage 03, and its owner text fits a plan hold.
  - `V1 Vault events`: the stage 03 events.
  - The main sticky note.
  - The workflow name.
- **Model settings:**
  - `11` uses `gpt-6.1-sol` with credential "OpenAI account".
  - `11c` uses `claude-sonnet-5-5` with credential "Anthropic account".
  - Both were confirmed in the providers' model lists through n8n (a free list call).
  - Both have up to 8000 output tokens, 3 tries 5 seconds apart, and continue on error.
- **New table:** `Claude Midas A7 catalogue` (`lwJbRv4TVqlFTILl`).
  - It is a copy of the 16 rows of `Claude Midas catalogue VTON A5`, checked row by row after the copy.
  - It adds empty tag columns: `visual_weight`, `silhouette`, `texture`, `style`, `colour_hex`, `tags_basis`.
  - The A5 table was only read, not changed.

## Stage 03: what was checked, and how
- **Code matches n8n.** All 15 Code nodes and both prompts in n8n are byte-identical to the local files. That is the 7 stage 03 or changed nodes plus the 8 stage 01–02 nodes. A scan found no key-like strings in the workflow or the files.
- **Local tests: 59 of 59 passed at that time** (now 86; see go 1).
  - S1–S33 are the stage 01–02 tests. They now also run through stage 03.
  - S34–S50 test stage 03.
  - S51–S58 are regressions from the independent review.
  - The reader replay (10 real readings from 15 Oct) gives the same stage 01–02 results as the saved file.
- **Pinned runs in n8n (no model was called):**

  | Execution | Case | Result |
  |---|---|---|
  | 391 | Lifestyle, planner invents SKU 999999 and dresses the white master | `awaiting_go_1`. SKU removed, white master reset, 2 Midas pieces with photos, 9 vault events |
  | 392 | Critic fails two shots every round | 3 rounds: 2 rewrites, then an owner hold at stage 03. This shows the loop works in n8n and stops |
  | 393 | Client pick 174770 (out of stock) | Client hold. One question, no planner call |
  | 397 | Final version: client pick 174781 kept, invented SKU | `awaiting_go_1`. Pick placed and marked as client pick; SKU 999999 removed |

  Runs 391–393 ran before the review fixes. Run 397 ran on the final version.
- **Independent review.** A separate agent that did not write the code reviewed it.
  - **Five must-fix defects, all fixed and covered by tests S51–S58:**
    1. A late client pick could push the job past 3 Midas pieces.
    2. A plan that left out a shot crashed step 12.
    3. A pick on a white-only job was silently dropped.
    4. "Sold out" style stock text was not caught.
    5. The round-2 critic could not see shots that had already passed.
  - **Minor items, also fixed:**
    - several bad picks now get one question;
    - "hand-woven basket" no longer counts as a person;
    - plans are matched by output id;
    - a generic prop naming a Midas piece is flagged;
    - hold text is per shot;
    - client-facing wording is neutral.

## Stage 03: what was not checked
- **A real planner or critic answer.** The prompts have never been sent to gpt-6.1-sol or claude-sonnet-5-5. How well they plan and check is unknown until a paid test.
- **The styling score on real data.** Catalogue tags are empty, so most pillars are "not confirmed". Every plan so far shows "not scored (coverage 25%)". That is correct behaviour, not a result.
- **The client page.** It does not send `midasPicks` yet.

## Assumptions (conservative defaults, easy to change)
- **People and plants:** replaced by your decision of 15 Oct (see above).
- **Go 1 limits:** 24 hours to answer, at most 3 change rounds, at most 5 ignored calls. These follow A6's 24-hour wait; the other two are my defaults.
- **Limits:** at most 3 different Midas pieces per job, and at most 12 on the shortlist (the stylist skill default and A6's limit).
- **Pre-order pieces** are offered, and the ticket names them as pre-order. "Not confirmed" stock is not offered unless the client picked it.
- **"Same kind as the product"** is decided by the head noun ("table lamp" is a lamp, so it is not the same kind as a dining table).
- **Engine "plan needs change" results** go to go 1 as warnings and do not trigger a re-plan. With no tags they cannot happen yet.
- **"Retry once"** for an unreadable critic counts per job. With node retries an erroring critic can be called up to 6 times before the hold. Each call is a short text call.

## Not built
- **A page for the owner to answer go 1.** The address exists; nothing sends to it yet.
- **Catalogue tags.** This needs a one-time tagging pass (paid) or the owner's tags, marked "estimated".
- **Product tags from stage 01** (weight, silhouette, texture, style, all "observed in photo").
- **Up to 3 boards for New Composition**, and a client plan preview.
- **Stages 04–06.**
- **The review's grouping hint:** the stage 03 nodes cannot form one n8n group, because the group has more than one exit. It is cosmetic.

## Correction
At 04:40 one update set node 12's code to a placeholder by mistake. The next update, about one minute later, restored it. No run happened in between. Run 397 and the byte check above are on the restored version.

## Leftovers
- **Test rows in `Claude Midas A7 runs`:**
  - 4 rows from stage 03 (ids 7–10): `claude-test-a7-n8n-s03-ready-01`, `-loop-01`, `-pick-01`, `-ready-02`.
  - 4 rows from go 1 (ids 11–14): `claude-test-a7-n8n-g1-ignored-01`, `-ignored-02`, and two under `claude-test-a7-n8n-g1-go-01` (id 12 was added by hand as a seed for run 399; id 13 is the "received" row that run made).
- **Test rows in `Claude Midas A7 vault`:** 35 rows from stage 03, plus the vault events of runs 398, 399 and 403, all under the client job ids above.
- **Executions:** 391, 392, 393, 397 (stage 03) and 398–403 (go 1). All manual and pinned. Executions 394–396 belong to another workflow (`PS3VCZ8zpiTFm57d`) and were not started by this chat.
- **Not saved anywhere:** the test token is the plain text `claude-test-token-not-a-secret`. No real token or signed address is in any file.
- **New table:** `Claude Midas A7 catalogue`, which is meant to stay.
- **Scratch workflows:** none.

## Files (`claude-outputs/claude-midas-a7-build/`)
- **`js/`**
  - `01_intent.js`, `10_retrieve.js`, `11a_ticket.js`, `11b_check.part.js`, `11b_check.js` (built), `11d_verdict.js`, `12_lead.js`, `hold.js`, `v1_vault.js`
  - Go 1: `g1_verdict.js`, `g1_decision_check.js`, `g1_forward.js`, `g1_restore.js`
  - `prompts03.py` (planner and critic instructions; it writes `prompts03.json`)
  - `build03.py` (builds 11b from the stylist skill engine plus the part file)
- **`test/`**
  - `harness.js` (runs stage 03 and go 1), `run_tests.js` (86 tests), `catalogue.json` (the 16 rows), `replay_reader_test.js`
  - `pins03/` (the pinned data of runs 391–393; no keys)
  - `pinsg1/` (the pinned data of runs 398 and 403; `pin_g1_go.json` is the source for run 399, which was cut down further when it was sent)
- `build_sdk.py` and `prompts.py` in this folder are older than n8n. n8n and the `js/` files are the source.

## Decisions for the owner
1. **A small paid test of the planner and critic.** It would run on 2–3 pinned products. From the A7 cost model (an estimate, not a quote): about $0.045 per job when the plan passes first time (planner $0.0214 + check $0.0231), and at most about $0.091 with 2 rewrite rounds (the critic runs 3 times). It needs your go in that message.
2. **Catalogue tags.** Do you want a paid tagging pass (marked "estimated"), or will you tag the 16 pieces yourself?
3. **Publish the draft for one live go 1 test?** Go 1 can only be tested for real on a published workflow. The test needs one paid planner and critic call (about $0.045, an estimate). It needs your go in that message.
4. **Next build:** the owner's go 1 page, or stage 04 (compile and make the images)?
