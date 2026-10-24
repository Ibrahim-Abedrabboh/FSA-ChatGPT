# A7 single-file runner (Phase 1 candidate)

Checked locally on 24 Oct 2026. `claude-runner/runner.py` contains the seven frozen A7 flow definitions, their Code-node JavaScript, reference text, schemas, seeds, and the former Python service logic. The one-time builder under `tools/` produced the initial file; after an approved cutover, maintain the runner directly. The existing Python service and n8n workflows remain the operational versions until separate owner approvals.

Run locally with Python 3.12 and Node 22. Set a writable `MIDAS_RUNNER_HOME`, then run `python claude-runner/runner.py setup`, `verify`, `check`, and `serve`. The runner keeps its Node files in that cache. It uses the existing `DATABASE_URL`, signing keys, owner headers, and one replica. Go 1 and Go 2 remain owner decisions; paid calls require prior budget reservations.

The local image is built from `claude-runner/Dockerfile`. `SCHEDULES_ENABLED` and `RECOVERY_WEBHOOKS_ENABLED` default off. The owner-site draft requires an explicit bare HTTPS `A7_ENGINE_BASE_URL`; an unset address fails closed. No owner site has been switched to this candidate.

See `claude-outputs/claude-midas-a7-runner-README-2026-10-24.md` for verified checks and open acceptance gaps, and `claude-outputs/claude-midas-a7-runner-cutover-runbook-2026-10-24.md` for the later staged cutover and rollback.
