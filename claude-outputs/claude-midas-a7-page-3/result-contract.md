# Result contract `midas-result/1`: what the client page reads (P5.1)

17 Oct 2026. Written by Claude for Phase 5 of Midas A7.

**Status: contract and mock only.**
- Nothing in A7 was changed.
- A7 has **no result address** today. This was checked read-only in n8n on 17 Oct 2026, on draft `eefd6c42-ea05-4de8-8a1b-3a7a1008ff4c`, which is not published. The workflow has two triggers:
  - `claude-midas-a7`: POST, submits a job;
  - `claude-midas-a7-decision`: POST, the owner's decision.

  Both need an `X-Midas-Key` header. Neither can be read by a page.
- The page's result view (draft 3) reads this contract. Its mock (`mockResult()` in `app.js`) produces it.
- The A7 side, at the end of this file, is a **proposal for a later draft**. It needs your go.

## 1. How the page asks

The page sends one POST to the result address:

```
id=<client_run_id>&access_code=<code>
```

- The body is `application/x-www-form-urlencoded`.
- The page adds no headers of its own, so the browser sends no preflight request.
- Draft 2 used the same pattern.

The page never asks more often than the poll settings in `STUDIO_CONFIG.poll`:
- the first check is after 30 s;
- then one check every 15 s;
- it stops after 8 min for 1 image, or 20 min for more;
- it stops after 3 failures in a row.

## 2. Replies

### Refusal

| HTTP | `reason` | The page does |
|---|---|---|
| 401 | `access_denied` | Signs out. Shows the studio's message. |
| 403 | `access_off` | Signs out. Shows the studio's message. |
| 404 | `unknown_request` | Shows "Request not found." Stops checking. |
| 503 | `try_again` | Counts as a failure and checks again later. |

The body of a refusal:

```json
{ "ok": false, "found": false, "reason": "unknown_request", "message": "No request with this reference was found for this account." }
```

### A found request

```json
{
  "contract": "midas-result/1",
  "found": true,
  "state": "not_finished | finished",
  "client_run_id": "6c1c…",
  "images_planned": 3,
  "finished_at": "2026-10-17T09:12:00Z",
  "package": {
    "kind": "lifestyle | white_bk | website",
    "complete": false,
    "website_views": { "required": ["catalogue","hero","wide","detail"], "ready": ["catalogue","hero"], "missing": ["wide","detail"] },
    "limitations": ["Plain sentences the client may read."],
    "catalogue": [{ "name": "…", "sku": "…" }]
  },
  "images": [ /* one entry per planned image, in plan order (see 3) */ ],
  "summary": "Plain notes for the client. No internal terms."
}
```

- `state`:
  - `not_finished` while any image is still in production;
  - `finished` when every image has a final state.
- `images` may be partial while `not_finished`. The page fills those frames and says "So far x of n images are ready. The request is not complete yet."
- `website_views` is `null` for non-Website jobs.

## 3. One image

```json
{
  "slot": 2,
  "output_id": "wide",
  "role": "catalogue | hero | wide | detail",
  "camera": "Reference view | Full frontal | 45° right | Left side | Right side",
  "light": "day | warm | night | ''",
  "state": "in_production | passed_checks | on_hold | not_made | approved | changes_requested | not_approved",
  "reason": "Plain words, required for on_hold and not_made",
  "note": "The studio's note, for changes_requested or not_approved",
  "image_url": "https://… (temporary link; empty for in_production and not_made)",
  "client_shown_as": "Approved | Approved by the studio | ''",
  "decided_at": "ISO time of the recorded decision, or ''",
  "checks": [["inventory_count","pass","…"], …]
}
```

### Per-image state and what the client sees

| `state` | Picture shown | Label (pill) | Also shown |
|---|---|---|---|
| `in_production` | no (empty frame) | — | "So far x of n…" |
| `passed_checks` | yes, tagged **Generated image** | Passed automatic checks | "Awaiting the studio's decision." |
| `on_hold` | yes if a picture exists, tagged **Generated image** (owner decision pending: see note below) | On hold | "Why it is on hold:" + `reason` (fallback: "The studio is checking this image.") |
| `not_made` | **never** (an empty, dashed frame of the planned set) | **Not made** | "Why it was not made:" + `reason` (fallback: "The studio did not make this image.") |
| `approved` | yes, tagged **Generated image** | exactly `client_shown_as`: **Approved** or **Approved by the studio** | "Recorded on {date}." |
| `changes_requested` | yes, tagged **Generated image** | The studio has asked for changes | "The studio's note:" + `note` |
| `not_approved` | yes, tagged **Generated image** | Not approved by the studio | "The studio's note:" + `note` |

- **Unknown state:** any `state` value not in this table is read as `not_made`. It shows no picture.
- **While in production:** only `passed_checks` and `approved` pictures fill their frames, each tagged **Generated image**. "So far x of n" counts only those images.
- **Owner decision (from the 17 Oct review):** should a picture that is `on_hold` (16b hold or failed review) be shown to the client at all? Draft 2 showed it with its reason, and so does draft 3. Your rule "held images as Not made" is applied to images A7 did not make (19a holds).

### Label rules (the page enforces these; tested in `run_page3_mock.js`)

1. **"Generated image"** is on every picture the studio made, whatever its state.
2. **"Approved"** and **"Approved by the studio"** come only from your recorded decision. The page shows one of them only when all three of these hold:
   - `state` is `approved`;
   - `decided_at` is a valid time;
   - `client_shown_as` is exactly one of those two strings.

   The page never chooses between the two labels itself. A7 writes `client_shown_as` in G2, 18a, 18l, 20a and 20k:
   - "Approved by the studio" for an image you approved by eye;
   - "Approved" for a reviewed approval.

   If the label is missing or anything else, the image shows **"Decision not readable"** and a line telling the client to ask the studio team. It is **not** shown as approved. Example: the owner-view wording "Approved by the studio · not reviewed" is refused this way.
3. Passing the automatic checks is never shown as approval.
4. A held image is **"Not made"**, with a plain reason. It never shows a picture, even if `image_url` is set.
5. **An incomplete package is never shown as complete.** "Package complete" shows only when all of these hold:
   - `state` is `finished`;
   - `package.complete` is `true`;
   - every image is `approved` (with a readable label);
   - the number of images is at least `images_planned`.

   Otherwise the page shows "Package incomplete", with the line "A package is complete when every image in it has the studio's approval."

### Request headline (page-derived, `finished` only)

| Condition | Headline | Recent-list status |
|---|---|---|
| every image approved and package complete | Approved. | Approved |
| every image approved, package not complete | Partly approved. | Partly approved |
| every image passed or approved, at least one only passed | Ready for review. | Ready for review |
| some passed or approved, others held, not made, or with changes asked | Partly approved. (if any approved) or Partly ready. | as headline |
| none passed or approved | On hold. | On hold |

When images are not made, the lead adds "1 image was not made." or "{k} images were not made."

## 4. What the client never sees

- Internal step names:
  - Eye, Brain, Critic;
  - go 1, go 2;
  - n8n, workflow ids;
  - model or provider names.
- Run ids.
- Costs.
- Audit wording such as "approved by owner without an automated review" or "not reviewed".
- A promised delivery time, pixel size, retention period or human stylist.

`summary`, `reason`, `note`, `limitations` and the automatic-check texts (`checks[i][2]`) must follow the same rules. The page shows only check ids it knows (its `checkNames` list) and drops any other. A7 should write them for clients, or leave them empty.

## 5. Proposal: the A7 side (for a later draft, with your go; NOT built)

1. **New, separate workflow `Claude · Midas A7 result address`**, not a node inside A7. A7 stays as it is.
   - One webhook: POST, path `claude-midas-a7-result`, response mode "Respond to Webhook".
   - It does not change A7's two existing webhooks.
2. **Auth: the client's access code, not the `X-Midas-Key` header.**
   - The key must never be in a public page.
   - A custom header also forces a browser preflight.
   - The access code is checked the same way as sign-in. That sign-in check is not built for A7 yet; this is decision P5.1-a.
3. **Lookup:**
   - It finds the run by `client_run_id`, only for the account that owns that access code.
   - It reads A7's run record: the stage-07 outputs, held images, G2's `done[...]` approvals with `client_shown_as`, and 18l/20k's manifest.
   - **Where that record is read from needs a decision (P5.1-b).** Today A7 has "permanent storage not connected" (02 Ingest). A data table written at G2 and at the end of stage 07 is the smallest option.
4. **Mapping** (a code node: plain mapping, no model):

   | A7 field | contract field |
   |---|---|
   | stage-07 output passed review, no owner decision yet | `state` `passed_checks` |
   | 16b hold / review failed | `on_hold`, with a client-safe `reason` |
   | 19a held output (for example, made from a held image, or an unseen side) | `not_made`, with a client-safe `reason` |
   | G2 `done[id]` with `approval_kind` | `approved`, with `client_shown_as` and `decided_at` copied unchanged |
   | owner "changes" / "reject" decision | `changes_requested` / `not_approved`, with the owner's client note |

   - `package.complete` comes from 18p/20k only.
   - Image links: temporary signed links. The client page states no retention period.
5. **CORS:** the reply carries `Access-Control-Allow-Origin` for the page's own origin only.
6. **Rate:** the page's poll settings (section 1). The reply never triggers a paid call.
7. **Tests before connecting:**
   - replay `run_page3_mock.js` against the new address with a test account;
   - check that no internal term appears in any reply.

Connecting the page also needs:
- `STUDIO_CONFIG.statusUrl` set;
- `mock: false`;
- `connect-src` in `index.html` changed from `'none'` to that one address.

Each of these needs your go.
