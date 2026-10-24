# Midas A7: supervised paid run checklist (22 Oct 2026)

> **Correction after the run (22 Oct, 12:30 UTC).** Two errors in this checklist, found in run `ff0aa7e5` (report: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md`):
> 1. A USD 3.00 job budget cannot work. The ledger holds each call's worst case first: the photo check holds USD 3.18, and planning holds about USD 4.32. A job ceiling of at least about 4.50 is needed, so the owner watches the spent figure against any lower line.
> 2. Set the budget *before* "5. Save all details". Any edit after saving turns Get estimate off again.
> Also start from **New case**, not from Saved work. A saved version reopens as an edit, with its fields locked.

Written by Claude for the owner. This is the first paid end-to-end run on the Python service, as runbook step 4: a white package plus one room scene, through Go 1 and Go 2. **Cap:** the owner's spending limit for the run. The job ceiling itself must be at least about USD 4.50 (note 1 above); the 22 Oct run used USD 5.00. The owner starts the run and makes every decision. Claude watches and reports.

## Before you start (all must be true)

- [ ] **The new service is live.** Claude confirms that `/status` answers on `https://midas-a7-production.up.railway.app` (it returned 404 while Railway's deploy queue was stuck).
- [ ] **No other job is running,** and no deploy is pending. A deploy mid-run kills the run (BE-1).
- [ ] **Railway is connected** so Claude can follow the logs. Without it, Claude can only report what you see on the page.
- [ ] **You are on the preview site:** `https://midas-a7-owner-preview.netlify.app/owner/`. The final site still uses n8n.

## Pick the product photo

Choose a product that gives the run its best chance. This run tests the service, not the hard cases.

- **One piece, or a small set** (for example one armchair or one sofa). Avoid wide sets (FL-5) and dining sets.
- **The whole product in the frame,** with space around it and nothing cut off at the edges. A cropped photo holds the run (rule 17), and the reader can wrongly flag a crop (FL-6).
- **A clear photo,** at least about 1500 px on the long side and under 6 MB. Bigger files can make the scene request too large (FL-10).
- **No room photo.** The scene starts from an empty generated room.

## Steps on the page

| # | You do | What it costs | What a good result looks like |
|---|---|---|---|
| 1 | New case → add the product photo → fill in the details (product type, pieces) → under **What to create** choose the white catalogue image **and one lifestyle scene** → Save | Nothing | "Saved" |
| 2 | **Check the photos** (review the reading cost, then confirm) | Paid, small (cents) | The piece count and category match the photo. **This is the first live test of the Anthropic reader.** If it says "outcome uncertain", stop and tell Claude |
| 3 | Confirm or correct the source facts | Nothing | "Confirmed" |
| 4 | Set the job budget to **4.50 or more** (5.00 on 22 Oct) → **Get estimate** → Review → tick → Confirm and send. The estimate is valid for 15 minutes | Starts reading and planning (paid) | "A7 received this job". It appears in **Jobs** |
| 5 | Wait for **Go 1**, usually a few minutes. Read the plan | — | The plan names the right product and pieces, the white framing and one scene |
| 6 | **Go 1 · Approve plan**, or Change (with a note, at most 3 rounds), or Stop | Approving starts the image call (paid, never retried) | The run continues |
| 7 | Wait for **Go 2** (white image). Open the image | — | The whole product is shown, nothing cut off or invented, on a clean white background. The product fills about 76% of the longest side |
| 8 | **Go 2**: Approve image, or Repair (at most 2), or Stop | A repair is paid | After approval: the package, 1125×1125 JPG and WebP |
| 9 | The scene runs: an empty room first, then placement. Then a **Go 2 for the scene** | Paid | The product is placed correctly, with Midas props only, at a natural scale |
| 10 | Approve the scene, or Repair, or Stop | — | The scene files are made (short side 1125) |

## What to send Claude at each stop

- **After step 4:** the job name or run ID shown in Jobs.
- **At Go 1:** a screenshot of the plan, or say "Go 1 open". Claude checks the log for the reader and count results first.
- **At Go 2:** a screenshot of the image and its review note. Claude reports the framing measurement and the blind count before you decide.
- **Any hold or error message:** the exact text. Claude finds the step in the logs and on `/status`.

## When to press Stop

- **Cost:** the spent figure is near the owner's limit with work still to do. The ledger also stops at the cap by itself.
- **Product shape:** the image shows a different or changed product, a missing piece, or an invented part. Use **Repair** first only if the fault is small.
- **Repeats:** the same fault comes back after a repair. There are at most 2 repairs, then hold.
- **Anything unexpected,** such as a page error, or Jobs not moving for more than 20 minutes after a step. Tell Claude before retrying. **Never send the same job twice.**

## What Claude checks during the run

| Check | Where | Pass |
|---|---|---|
| Anthropic reader accepted | Logs, step 05 | No "not scoped to a workspace" or 400 error |
| Blind count (speed change 1, low thinking) | Logs, steps 16/16x | Count matches the confirmed pieces |
| Framing on white | Review note and package | About 76% on the longest side (run `4f80c2bf` held at 97.6%) |
| Package files | Go 2 result | 1125×1125 JPG and WebP, links open (these are the service's own links, kept since Phase 0) |
| Scene delivered | Scene Go 2 | First scene ever delivered |
| Cost | Ledger, `/status` | Total spent within the owner's limit and the job ceiling. Every figure is an estimate |

## After the run

Claude writes a dated run report in `claude-outputs/claude-midas-a7-run-reports/`. It covers each step, the times, the costs, the checks above and every hold, and updates the status docs. Then Phase 1 starts, with your go on each flow change.
