# Midas A7: second supervised paid run on the Python service (22 Oct 2026, evening)

Written by Claude. Claude watched and reported, and Claude sent, retried and decided nothing. The owner started each job on the page and made every decision.

**Owner's go:** "go with the second paid run, cap USD 5" (22 Oct 2026). Job budget on each job: USD 5.00.
**Service build:** Railway deployment `a09a4664`, main `cfef3b6` (Phase 1.6, PR #100; it includes 1.2, 1.3, 1.3 follow-up and 1.5). Started 19:29 UTC.
**Owner site build:** `midas-a7-owner-preview`, Netlify deploy `6ada634f`, commit `4cc4ef6` (owner page fixes, PR #99), published 19:26 UTC.

**Result:**

| Job | Product | Outcome |
|---|---|---|
| `claude-a7-34eba12f-254c-401c-b117-c5a9b924ab20` | 1 recliner | **Done.** White master approved, package made with no hold, room scene made and approved. **This is the first room scene delivered by A7 on any job.** |
| `claude-a7-3801c66a-96c2-47cf-8c4f-f1975f9971af` | Dining set: 1 table and 12 chairs | Stopped by the owner after the first image and two repairs. The images showed 13 chairs, and one repair put the set into a furnished room. |
| `claude-a7-ed6a273a-c0eb-4472-a122-59e43f0f1834` | Not confirmed (probably the dining photo again) | Stopped by the owner after planning, before any image. |

**Costs:** Claude has no dollar amounts. The ledger's request logs show each reserve and settle, but not their amounts. The run page shows the amounts, and those screenshots were not supplied. Every paid call reserved first and was settled, with status 200. No call was retried, and no image call was resent. The jobs stayed below the USD 5.00 ceiling: the ledger refuses any reserve past the ceiling, and none was refused.

All times are UTC. Decision times are taken from the owner site's request log. The service's own log lines are stamped in batches, a few seconds late.

## 1. Before the run

| Check | Result | Evidence |
|---|---|---|
| Service build with 1.6 is live | Yes, from 19:29 | Railway deployment `a09a4664` SUCCESS; container started cleanly; `/health` ok |
| `/status` refuses requests without the secret | Yes | 403 |
| Owner site has the page fixes | Yes | Netlify deploy `6ada634f` from `4cc4ef6`, published 19:26 |
| No other job running, no deploy pending | Yes | Only health checks in the service log from 19:29 until the first photo check at 19:40 |
| `fileLinkSecret` | Not set (`false` on `/health`) | File links still use the resume secret, as before BE-6 PR A |

## 2. Dining set (`3801c66a`)

**Photo:** a styled dining room with a sideboard, mirror, vase, rug and curtains. The chairs overlap and are partly hidden. Before sending, Claude advised against this photo (a room, a wide set, a count that cannot be read reliably); the owner chose to test it. Pieces entered: `1 Dining Table`, `12 Dining Chair`.

**Saving.** The first press of "5. Save all details" was refused with the pieces-format message ("Enter each physical piece on its own line as a quantity and name…"). This was not the 22 Oct bug. "6. Get estimate" stays off until a first save succeeds. After the pieces line was corrected, the save worked.

| Time | Step | Evidence |
|---|---|---|
| 19:40:28–19:40:59 | Check the photos (2 calls) | 2 reserve and settle pairs; `owner-analyze` 200 (31.6 s) |
| 19:49:23–19:49:55 | Check the photos again (2 calls) | 2 reserve and settle pairs; `owner-analyze` 200 (32.6 s) |
| 19:51:10–19:51:12 | **Sent** | `owner/submissions` 200, `source-continuation` 200, `owner-submit` 200 |
| 19:51:13 → 19:51:54 | Planning | reserve, settle |
| 19:51:55 → 19:52:16 | Plan check | reserve, settle |
| 19:52:30 | **Go 1** (approve) | approval POST 200 |
| 19:52:31 → 19:52:55 | **Image call**, once (24 s) | reserve, settle |
| 19:52:56 → 19:53:17 | Blind count and review | 2 reserves, settled 19:53:02 and 19:53:17 |
| 19:58:04 | Go 2: **Repair 1**, with the note Claude drafted (exactly 1 table and 12 chairs, centred, nothing near an edge) | decision 200 |
| 19:58:08 → 19:58:26 | A text call, probably the repair instructions | reserve, settle |
| 19:58:51 → 19:59:20 | **Image call, repair 1** (29 s) | reserve, settle |
| 19:59:22 → 19:59:53 | Blind count and review | 2 reserves, 2 settles |
| about 20:03:50 | Go 2: **Repair 2** | decision 200 |
| 20:03:51 → 20:04:15 | **Image call, repair 2** (24 s) | reserve, settle |
| 20:04:17 → 20:04:42 | Blind count and review | 2 reserves, 2 settles |
| about 20:06:46 | **Stop** (owner confirmed) | decision 200 |

**Paid calls:** 4 photo-check calls, planning, plan check, 3 image calls, 3 blind counts, 3 reviews and 1 other text call: 16 in all.

**What the images showed** (from the owner's screenshots):
- **First image:** the right table and chairs on clean white, but **13 chairs** (6 on the far side, 6 on the near side, 1 at the front left) against 12 entered. The set sat at the bottom edge, with front legs about 1–2% from it, and the top half was empty.
- **A repair image:** the same 13-chair arrangement, but **inside a furnished room** (windows, curtains, panelling, wooden floor, patterned rug), with a **sculptural vase added** on the table. That is not a white master. The screenshots do not say whether this was repair 1 or repair 2.
- A later screenshot was **byte-identical** to the first image (same sha256), so the result of the other repair was not seen by Claude.
- The review notes were not supplied, so it is not known whether the automatic review flagged the background, the count or the edge.

## 3. Second dining job (`ed6a273a`)

| Time | Step |
|---|---|
| 20:05:54–20:05:56 | **Sent** (`source-continuation`, `owner-submit` 200). No photo check ran just before it, so it most likely reused the saved dining source (inferred, not confirmed). |
| 20:05:54 → 20:06:56 | Three text calls (planning, plan check and one more), each reserved and settled |
| about 20:07:09 | Decision: **Stop** (owner confirmed). No image call followed. |

## 4. Recliner (`34eba12f`)

**Photo:** one recliner, footrest extended, in a living room with a lamp, a side table and a gold ornament, a rug, a painting and a window. About 1024 px on the long side, below the checklist's 1500 px. Pieces: `1 Recliner`.

| Time | Step | Evidence |
|---|---|---|
| 20:11:32–20:11:55 | Check the photos (3 calls) | 3 reserve and settle pairs; `owner-analyze` 200 |
| 20:12:28–20:12:35 | **Sent** | `source-continuation` 200, `owner-submit` 200 |
| 20:12:28 → 20:12:55 | Planning | reserve, settle |
| 20:12:56 → 20:13:11 | Plan check | reserve, settle |
| 20:13:30 | **Go 1** (approve) | decision 200 |
| 20:13:30 → 20:13:45 | **Image call**, once (15 s) | reserve, settle |
| 20:13:46 → 20:14:00 | Blind count and review | 2 reserves, settled 20:13:52 and 20:14:00 |
| 20:15:13 | **Go 2, white image: Approve** | approval POST 200 (2.8 s) |
| after 20:15:13 | **Package made, no hold.** No paid call. The page then listed `owner-34eba12f-…_white_master_try1.jpg · 2048x2048` under "Approved images you can use". | page text, as quoted by the owner |
| 20:15:20 → 20:15:36 | **Scene: empty room** (image call) | reserve, settle |
| 20:15:51 → 20:16:23 | **Scene: placement** (image call, 32 s) | reserve, settle |
| 20:16:25 → 20:16:48 | Scene blind count and review | 2 reserves, settled 20:16:28 and 20:16:48 |
| 20:18:01–20:18:05 | The owner opened 5 file links from the service | 5 × `GET /files/…/view` 200 |
| 20:19:22 | **Go 2, scene: Approve.** Scene files made in code. | approval POST 200 (7.3 s). No paid call after it. |

**Paid calls:** 3 photo-check calls, planning, plan check, 1 white image, 2 white checks, empty room, placement and 2 scene checks: 12 in all.

**The white master** (owner's screenshot, measured by Claude on the image file):
- **Faithful to the photo:** the same recliner, fabric, two-part back, pillow arms, black side lever, extended footrest and rocker base.
- **Room removed, nothing added.**
- **Background:** the corners measure 254.
- **Framing:** the product spans **84.5%** of the longest side, wider than the 76% ± 3 target.
- **Edges:** nothing near an edge. The nearest is the bottom, at 4.7%.

  Phase 1.3 should therefore fit it to about 76% in the package. That was not checked, because the delivered files were not measured.

**The scene** (owner's screenshot, 2048 × 2048 per the owner):
- **Same recliner:** identical to the master, at a believable size.
- **The room:** an empty, plain room (walls, window, curtains, wooden floor) with **one prop, a patterned rug with fringe**.
- **Weak point:** the chair **looks pasted in**. There is no contact shadow under the base, and its lighting does not follow the window.
- **The rug:** it is the same rug that appeared in the dining repair image. Whether it is a confirmed Midas catalogue piece was not checked.

## 5. What worked

1. **The scene path ran end to end for the first time:** empty room, placement, scene review and the scene Go 2, all on the Python service.
2. **The package did not hold** on the recliner. On 22 Oct the package held on a grey halo, and a held package blocks scenes.
3. **Budget discipline held on every call** in all three jobs: reserve first, then settle, nothing retried, no image call resent, and nothing past the ceiling.
4. **Go 1, Go 2, two repairs and Stop all worked** from the owner page. Each job stopped when the owner pressed Stop.
5. **No errors** in the service log for the whole evening.

## 6. What went wrong or needs follow-up

These are in order of importance. Each one needs the owner's go before anything changes.

1. **A repair turned a white master into a room scene, and added a vase.** The white repair needs a hard "white background only, no room, no added objects" constraint. Check whether the review caught it (the review notes were not seen).
2. **The chair count reached Go 2 wrong (13 against 12).** Check what the blind count and the review recorded for `3801c66a`. A count mismatch should hold before Go 2, or be shown on it.
3. **Placement realism:** no contact shadow, and lighting that does not match the room. This is a prompt and flow item for the scene placement.
4. **Prop provenance:** the same rug appears in two jobs. Check whether the scene's prop list names it as a Midas piece. If not, it is an invented prop and needs a guard (rule 18).
5. **"Make scenes from this white image" is offered while the job's own scene is already running.** Pressing it would likely start a second, paid scene. It should be hidden or disabled while a scene is active. This is inferred from the page and the logs, and not tested.
6. **The pieces-format refusal does not say which line is wrong.** The message should name the line and focus the pieces field.
7. **Phase 1.6 was not exercised:** the scene request stayed under the size limit, so the resize never ran.
8. **Photo choice:** room photos and wide, overlapping sets are a poor fit for the white master. The checklist already says so. The page could warn when a photo is a furnished room.

## 7. Not verified

- Dollar amounts for any job (the run page screenshots were not supplied).
- The delivered white files' pixel size (expected 1125 × 1125) and the fitted framing (expected about 76%).
- The scene files' size after approval (expected short side 1125).
- The review notes for every image, and the blind counts.
- Which repair produced the room image in the dining job, and what the other repair looked like.
- Which photo `ed6a273a` used.
- Whether the rug is a confirmed Midas catalogue piece.

## 8. What the owner can send to close this report

1. Screenshots of the spending table on the run page for `34eba12f`, `3801c66a` and `ed6a273a`.
2. The delivered white JPG and the scene JPG, or their pixel sizes.
3. The scene's prop list, to check the rug.
