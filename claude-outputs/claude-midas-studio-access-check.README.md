# Claude · Midas studio access check

Built by Claude on 5 October 2026. An access-code check now sits in front of every address of the n8n workflow `Claude · Midas job request pipeline variations 2`. The workflow is still **not published**, so nothing live has changed.

## Where it is

- **n8n workflow:** `Claude · Midas job request pipeline variations 2`, id `lApASRrOG1EVoQi6`, version `e522eb23`, named "Access check in front of every address". 62 nodes, 13 of them new.
- **Version before the change:** `9fa50725`, "Group the canvas by stage". Restore it from the workflow's version history to undo the access check.
- **Access codes:** n8n data table `Claude studio access`, id `B24MNC0Pl8aSi6it`. It is empty, so every request is refused until a row is added.
- **Accepted requests:** n8n data table `Claude studio requests`, id `A2awHKCxBeo3DvOm`. One row per accepted job.
- **Page side:** `claude-midas-client-landing-page-build-prompt.md` in this folder.

Published workflows and the run log `Claude job runs` were not changed.

## Addresses, after publishing

All on `https://ibrahimnewaeon.app.n8n.cloud`. All four are `POST` and need the field `access_code` in the body.

| Purpose | Address | Body |
|---|---|---|
| Sign in | `/webhook/claude-midas-job-variations-2-access` | `access_code` |
| Send a job | `/webhook/claude-midas-job-variations-2` | `access_code`, `payload`, `files` |
| Ask for the result | `/webhook/claude-midas-job-variations-2-status` | `access_code`, `id` |
| Record the owner's decision | `/webhook/claude-midas-job-variations-2-decision` | `access_code`, `id`, `decision`, `note` |

Two things changed for existing callers:

- **The result address was `GET` with `?id=`. It is `POST` now.**
- **The job address no longer answers "Workflow got started."** It answers after the check, with HTTP 202 and `{ "ok": true, "accepted": true, "id": "...", "images_asked": 3 }`.

The form `claude-midas-job-request-one-or-many-2.html` sends no access code and polls with `GET`, so it will be refused by this version.

## How to add a client

Add a row to `Claude studio access`:

| Column | Value |
|---|---|
| `access_code` | A long random string, at least 16 characters. Shorter codes are always refused |
| `client_id` | A short fixed id, for example `acme-home`. Required. Do not change it later: usage is counted by it |
| `client_name` | The name shown to the client after sign-in |
| `role` | `client` or `owner`. Only `owner` can record a decision and read any client's result |
| `active` | Ticked. Untick it to switch the code off |
| `monthly_image_limit` | Images per calendar month, UTC. 0 means no limit |
| `notes` | Free text |

Codes are stored as plain text in this table. Anyone who can open the n8n project can read them.

## What the check does

1. **Access: read request** works out which address was called and reads the code and the job id.
2. **Access: find code** looks the code up. **Access: find request** and **Access: usage this month** read `Claude studio requests`.
3. **Access: decide** accepts or refuses.
4. For an accepted job, **Access: record request** writes the row, **Access: accept job** answers the page, and only then does `01 Job intake` start.

| Reply `reason` | HTTP | When |
|---|---:|---|
| `access_denied` | 401 | Code missing, shorter than 16 characters, unknown, or its row has no `client_id` |
| `access_off` | 403 | The row's `active` is not ticked |
| `owner_only` | 403 | A client code on the decision address |
| `bad_request` | 400 | No job id, or a job payload that cannot be read |
| `duplicate` | 409 | A job id that was already accepted. No second run starts |
| `limit_reached` | 429 | The images already asked for this month plus this job would pass the limit |
| `try_again` | 503 | A table could not be read |
| `unknown_request` | 404 | A client asks for the result of a job it did not send |

A refusal is `{ "ok": false, "accepted": false, "found": false, "reason": "...", "message": "..." }`.

The monthly count is the number of images asked for in accepted jobs, 4 for a Website package. Repairs are not counted, and a job that later fails still counts.

## What has been checked, and what has not

- **Checked, without any paid call:**
  - The two code steps were run locally on 31 mock requests.
  - After saving, the workflow in n8n was compared with the intended change: the code of the two new code steps and of `Status reply` matches, and no other existing step changed apart from the position of the three webhooks, the job webhook's response mode, the result webhook's method and the last paragraph of the canvas note.
  - Ten test runs inside n8n, executions 88 to 97, with the webhook data, the access row and every paid step replaced by fixed sample data. The table reads ran for real.
    - Unknown code on sign-in: refused, 401.
    - Valid code, new job with a small image attached: recorded, answered, then `01 Job intake` received the payload and the image. The record and the answer ran before intake.
    - Same job id again: `duplicate`.
    - New job over the limit: `limit_reached`.
    - Client asks for another run's result: `unknown_request`.
    - Client asks for its own unfinished job: `not_finished`.
    - Owner asks for a finished run: found, full result.
    - Client code on the decision address: `owner_only`.
    - Owner code with an invalid decision: passed the check and was refused by the decision step.
    - Valid code on sign-in: accepted, with the usage figures.
- **Not checked:**
  - Any real call over the internet. The HTTP status codes, the way n8n delivers `access_code` from a real form upload, and whether a browser can read a refusal from another site are all unconfirmed.
  - A real code row. The valid-code tests used a sample row in place of the table read.
  - A real paid run through this version.

The tests left one row in `Claude studio requests`: `claude-gate-test-run-0001`, client `claude-gate-test`. It can be deleted.

## Known limits

- There is no limit on wrong guesses. Long random codes make guessing impractical, but each attempt is one n8n execution.
- Two jobs sent at the same instant can both pass the limit check or the duplicate check.
- A code can be shared. Switch it off and issue a new one if that happens.
- All four addresses accept calls from any website (`allowedOrigins` is `*`). Set it to the page's own address once that address is known.
- Results of runs made before this version have no request row, so only an owner code can read them.
