# Midas A7 runner: local check and later cutover

Status: Phase 1 candidate. Nothing in this document authorizes a paid call, deployment, engine switch, or n8n change.

## Local checks

1. Use Python 3.12 and Node 22 with the pinned dependencies in `pyproject.toml` and the embedded Node lock file. Set `MIDAS_RUNNER_HOME` to a writable cache directory. Run `python claude-runner/runner.py setup` once.
2. Run `python claude-runner/runner.py verify`, `check`, and the Python and Node suites. Confirm that every check names a passing result. Run `extract-code` into a temporary folder and compare the extracted JavaScript with the source hashes.
3. Use a disposable SQLite database and mocks to start the service, check `/health` and `/status`, park a run at Go 1 and Go 2, resume each with the same signed link and secret, and repeat an already-used link to confirm it is rejected.
4. With `RECOVERY_WEBHOOKS_ENABLED=false`, confirm both recovery paths return 404. Enable it only in a disposable local process and use mocked ledger and model responses to confirm the paths and budget guard. Do not send a paid request.
5. Rehearse rollback by stopping the runner process and starting the previous Python service against a copy of the same disposable database. Confirm its health endpoint and stored run rows. Record any state that the old service cannot read.

The local run as of 24 Oct 2026 has confirmed `verify`, `check`, an in-process `/health` 200, the run-1591 replay, the full Python assertions through a compatibility harness, and read-only `migrate-check` on a local SQLite database. Disposable SQLite and PostgreSQL rehearsals started the runner and previous Python app in sequence against the same database; both returned `/health` 200 and authenticated `/status` 200, and both read the same parked row. The PostgreSQL container was removed afterward. Signed Go 1/Go 2 resume and recovery budget paths remain open. The full cutover and rollback rehearsal above has **not** been completed.

## Phase 2: staging, with the owner's go

- Create a new Railway service and its own Postgres. Do not point an owner site at it yet.
- Run `verify` and `migrate-check` on a copy of production data only if the owner permits a copy. Keep the copy private.
- Perform one supervised paid smoke job only after the owner gives a USD cap for that job. Record execution and budget operation IDs.

## Phase 3: traffic and service switch, with a separate go for each step

1. List n8n executions waiting at Go 1 or Go 2 and record their expiry times. These links point at n8n; they cannot be transferred. Keep the seven workflows published until those runs finish or pass the 24-hour wait.
2. Set `A7_ENGINE_BASE_URL` on `claude-final-midas-a7` to the runner URL. Check that new work reaches the runner and old n8n wait links still work.
3. Run production `migrate-check` read-only. Change the existing Python Railway service's image or start command to the runner, preserving `DATABASE_URL`, signing secrets, public URL, and one replica. Confirm `/health`, `/status`, and one parked-run resume.
4. Deploy the owner-site change to each site only after its separate go. Confirm no silent n8n fallback remains and both sites report the runner engine.
5. Watch holds, failed steps, budget reservations and settlements, and link failures during the owner-set stability window. The proposed window is seven days with at least three real jobs through Go 2; the owner decides the final criterion.

## Rollback

- While n8n remains published, restore the previous `claude-final-midas-a7` engine setting and previous owner-site build. Confirm a new request reaches n8n.
- Restore the previous Python Railway image and start command with the same database, URL, and secrets. Check `/health`, `/status`, old signed links, and parked-run state. Keep runner-created rows readable; do not delete them.
- Stop new runner traffic before restoring. Reconcile budget operations and any uncertain image call before retrying a job. Never resend an uncertain image request.

## Phase 4: retirement, only after the stability window and owner go

- Export each of the seven n8n workflows, compare hashes, and archive the exports. Unpublish; do not delete.
- Export n8n run, vault, operation, and identity tables to private storage chosen by the owner. They may contain client data. Do not commit them without the owner's approval.
- In a separate change, archive or remove the old Python service and converter tools as the owner directs. Remove the differential test only after parity has been accepted. Update the root Docker and Railway configuration at that point.
- The owner handles n8n credential rotation or revocation.
