# midas-a7-dashboard (The Dashboard)

A pane beside the chat with three parts. It refreshes every minute; `/a7-dashboard` opens it and refreshes now. The status line shows "A7 up", plus the run counts once `/status` answers. It only reads; it changes nothing on the service, the sites or Railway.

| Part | Source | Needs |
|---|---|---|
| **Service** | `GET /health`: up or not, the number of flows, and the names of any credentials the service is missing (it never sends values) | Nothing |
| **Runs** | `GET /status`: runs by status, active and waiting runs with their age, the latest failures with the failing step (or the reason, for a run lost to a restart). A 503 says whether the service has no bridge secret or cannot read its database | `A7_BRIDGE_HEADER_VALUE` set in the shell that starts Claude Code. Without it, the part says so. Before the Phase 0 build is deployed, it says "Not deployed yet" |
| **Railway logs** | `railway logs --lines 40`, last 12 lines | A Railway CLI that supports `--lines` (not checked against a version here), logged in and linked to the A7 project in the folder Claude Code runs in (`railway login`, `railway link`). Set `A7_RAILWAY_SERVICE` if the project has more than one service. If the CLI refuses or is missing, the part says so |

## Secrets
- The bridge secret is read from the environment and sent only to the service's `/status`, and only when `A7_SERVICE_URL` is `https://` (or this computer); a plain `http://` address gets no secret. It is never kept in the pane's stored view. Tests check that it is not drawn in the pane, not in the status line, not sent with `/health`, and not sent at all to an `http://` address.
- Log lines and failure messages are masked with The Shield's rules before they are shown (`hooks/redact.ts` is a copy of The Shield's; keep the two in step).
- This is the only mod that reads a secret. It reads it from your own environment; nothing is written to a file.

## Settings (all optional)
- `A7_SERVICE_URL`: default `https://midas-a7-production.up.railway.app`.
- `A7_BRIDGE_HEADER_NAME`: default `Authorization`.
- `A7_RAILWAY_SERVICE`: the Railway service name, for `--service`.

## Not verified
- It has not run against the live `/status` (that build is not deployed yet) or a real `railway logs`. The tests use stand-in answers in the shapes the service code returns.

## Checked
- `claude plugin validate`: passed. Type check (`tsc`): clean. `claude plugin test`: 5 pass.
- An independent review (`midas-a7-specialist:a7-reviewer`) found the 503 answers and crashed-run reasons were not shown and the secret test covered the pane only; all fixed. With the secret deliberately written to the status line, the test fails.
