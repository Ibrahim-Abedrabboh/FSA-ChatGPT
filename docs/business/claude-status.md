# Status and roadmap

*Business documentation · status as of 22 Oct 2026 (checked against commit `6925ad1`). Each item names the record it comes from.*

## Summary

| Area | Status |
|---|---|
| White catalogue image | **Works.** Made and approved on real photos. One complete package was delivered on 18 Oct through a one-off recovery step |
| Full run on the normal path | **Almost.** Run `4f80c2bf` (20 Oct) passed every step but stopped at packaging: the product filled 97.6% of the width against a 76% target. A fix is merged but not yet proven live. The supervised run of 22 Oct (`ff0aa7e5`) also stopped at packaging. **The second supervised run (22 Oct, evening) went through end to end** for one recliner: white image, package and scene (below) |
| Room scenes | **First one delivered** (22 Oct, evening, job `34eba12f`, one recliner): empty room, placement, review and your scene Go 2 all ran on the new service. The chair looks pasted in (no contact shadow), and whether the rug in it is a Midas piece is not yet checked |
| Repairs and edits | **Not yet proven.** No repair has run on a real job; five edit attempts each stopped on a different fault, all since fixed |
| Move to the Python service | **Mostly done.** Built, deployed, preview site switched (20 Oct). The first supervised paid run took place on 22 Oct (`ff0aa7e5`, USD 0.22 charged for the case that ran; an earlier attempt's photo checks were also paid) and stopped at packaging (below) |
| Owner app | **Works, clean-up under way.** Sign-in, sending jobs and both approvals work. Since 22 Oct only `/owner/` sends new jobs (the other screens are retired), failed sends say so plainly and are logged, and images from the new service are kept. Styles still differ between pages, and some options are saved but not used yet |
| Catalogue of Midas accessories | **Partial.** 428 of about 2,082 items are loaded. The weekly refresh is off |

## Why the move from n8n to Python

On 20 Oct the project moved its engine from n8n into its own Python code. The reasons recorded in the migration plan and review:

- **Too big to manage.** The main n8n workflow grew to 362 steps, 151 of them custom code (about 10,700 lines).
- **Hard to keep safe.** Old n8n run records hold an access key in plain text, two recovery paths are hard-wired to one old run, and two retired workflows (old client pipeline 3 and the white clean-up) are still switched on.
- **Slow.** The image check took 104 seconds against a 27-second image call.
- **Your request.** You asked for all logic, state, approvals and budget control to live in the project's own code.

The new service runs the same steps unchanged, so behaviour stays the same while the platform changes.

## What is blocking right now

1. **Resolved by the second run (22 Oct, evening):** the recliner job passed packaging and delivered the first room scene. A dining set in a furnished room did not work: the images showed 13 chairs against 12, and one repair put the set into a room. Report: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-2-2026-10-22.md`. Earlier: **the supervised run (22 Oct) stopped at packaging.** It passed the photo check, planning, Go 1, the image and Go 2, at USD 0.22 charged. The image was framed too wide and cut off at the edge, and the package held on a tiny grey halo. A held package blocks room scenes. Phase 1 items 1.2 and 1.3 address this. Report: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md`.

**Resolved since the last check:**
- The Anthropic workspace id is set; `/health` reports it (21 Oct).
- The two test suites that had been failing unnoticed since 17 Oct are fixed, and the automatic checks run every suite (PR #79, 21 Oct).
- Phase 0 is merged (PR #84, 22 Oct): one new-job screen, clear and logged send failures, the emergency stop also blocks spending, images from the new service are kept, and a run status page on the service.
- The service deploy went live after the Railway outage (22 Oct, 10:31 UTC).
- Phase 1.1 (22 Oct): a job that stops on an unexpected error now shows as held, with the step named, instead of staying on its last status for ever.
- Phase 1.5 (22 Oct, merged, on the new service): the image model is taken from the approved list instead of being fixed, and jobs not sent from the owner site are refused with a reason instead of failing later.
- Phase 1.6 (22 Oct, merged, on the new service): when the photos for a room scene are too large to send together, the oversized ones are made smaller first (without AI, never cropped), so the scene is made instead of stopping after the empty room was already paid.
- Phase 1.3 (22 Oct, merged): the white catalogue image is delivered at the agreed framing (76% ± 3 of the frame). When the review marks the product as cut off, it is never scaled to fit: the job stops and says why. This needs the review's product box; without one, the image is packaged as it is, as before. An image you approve without a review is checked the same way, from the product box of the second count.
- Phase 1.2 (22 Oct, merged): when the package stops only because of a faint edge in a file, as on 22 Oct, you now decide: deliver it as your exception, make a new image, or stop.
- Owner page fixes (22 Oct, merged): three problems from the 22 Oct run are fixed on the page. "Get estimate" works again after an edit. A reopened version with an invalid piece line can be corrected. A held job shows why it is held, with no Go 2 wording.

## Next decisions for the owner

| Decision | Why it matters |
|---|---|
| Yes or no on each remaining Phase 1 item (1.2, the held-package decision, started on 22 Oct with your yes) | Lets a job reach room scenes |
| Choose one owner site (`claude-final-midas-a7` still runs on n8n and cannot send) | Removes the duplicate site. The "new job" screen was decided on 22 Oct: only `/owner/` |
| Approve a bounded room-scene test, after 1.2 and 1.3 | Scenes have never been delivered. The job ceiling must be at least about USD 4.50, because the budget holds each call's worst case first (USD 4.32 for planning); the 22 Oct run charged USD 0.22 |
| Approve switching off the old n8n workflows (14-day rollback window) | Finishes the move |
| Approve cleanup: delete old n8n runs holding the access key, rotate that key | Security |
| Decide on the weekly catalogue refresh | More accessories to style with |

## Quality, honestly

- **Only 2 of 26 quality requirements are fully met** (project review, 20 Oct). No delivered image is yet marked fit for the catalogue.
- **The 90–95% faithfulness goal is not measured** by any automatic test. Check scores are the software's judgement, not a guarantee.
- **Photo reader accuracy** on your 10-photo test sheet: the prompt used in jobs scores 6 of 10, and the one on the photo check scores 8 of 10. Two prompts that aren't live yet scored 9 and 10 of 10. Choosing which to use is your decision. (reader test 5 README, 21 Oct)
