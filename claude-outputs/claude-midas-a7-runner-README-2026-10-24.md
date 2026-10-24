# A7 runner: local Phase 1 candidate

`claude-runner/runner.py` is a proposed single-file replacement for the seven n8n workflows and the existing Python A7 service. It embeds the frozen workflows, 190 Code-node scripts, reference instructions, data schemas and seeds, and the Node JavaScript bridge. It keeps the two owner approval gates and the existing HTTP routes. The file is intended to be maintained directly after cutover; `tools/claude_build_runner.py` is only the first-build converter.

## Local commands

Use Python 3.12 and Node with the versions pinned by the project. Install the Python dependencies from `pyproject.toml`. Then run:

```sh
python claude-runner/runner.py setup
python claude-runner/runner.py verify
python claude-runner/runner.py check
python claude-runner/runner.py serve
```

`setup` needs npm access unless `MIDAS_JS_NODE_MODULES` points to an existing compatible `node_modules`. The runner writes Node's runtime into `MIDAS_RUNNER_HOME`; it does not unpack the Python service. `SCHEDULES_ENABLED` and `RECOVERY_WEBHOOKS_ENABLED` default to false. The service can answer `/health` without credentials; real A7 jobs require the owner's existing service configuration and budget ledger.

Other commands: `seed`, `run <flow>`, `prompts [--out FILE]`, `extract-code DIR`, and read-only `migrate-check` with `DATABASE_URL` set.

Run `python tools/claude_runner_node_overlay.py` to copy the guidance tests into a disposable tree and replace its main-flow Code-node files with text extracted from `runner.py`. It currently exits nonzero for seven historical-suite mismatches; see below.

## Checked locally on 24 Oct 2026

- Old service baseline: 275 passed, 2 skipped, 1 expected failure.
- Runner through the full compatibility harness after adapting a generic multipart test to a neutral mock host: 281 passed, 2 skipped, 1 expected failure. The recorded run-1591 replay passed against the runner.
- Direct runner tests: 8 passed. `verify`, `check`, `/health` in-process, `migrate-check` on local SQLite, and ruff passed. Prompt and non-Code flow tampering fail verification; enabled recovery routes reject requests without the owner authorization header.
- Old-service versus runner differential replay of recorded run 1591: 1 passed. The nine focused runner tests pass together.
- Local Docker image built with Python 3.12 and Node 22. Build-time `setup` and `verify` passed; `docker run ... python runner.py check` passed.
- A temporary container served `GET /health` on loopback: `status: ok`, seven flows, nine registered webhooks. It was stopped afterward.
- Owner workspace build passed. Its full serial suite passed: 408 passed, 1 skipped, with localhost access.
- A temporary test tree with the main-flow JavaScript replaced by `runner.py extract-code` passed 14 of the 21 A7 guidance commands. Seven suites still assert historical Code-node behavior or snapshots; their failures need review before claiming extracted-code acceptance.
- Disposable SQLite and PostgreSQL compatibility rehearsals returned `/health` and authenticated `/status` 200 from runner and previous Python app, and both read the same parked row. Resume signatures are now wait-generation-specific; the direct stale-generation route test passes. With `RECOVERY_WEBHOOKS_ENABLED=true`, both recovery routes register locally and reject synthetic unapproved IDs without external calls. Full approved Go 1/Go 2 resume and recovery ledger paths remain outstanding.

These checks do not establish production parity. The extracted-code Node suite is not yet green, and the local cutover/rollback rehearsal is incomplete. No paid call, production read, deployment, engine switch, or n8n edit occurred.

See `claude-midas-a7-runner-cutover-runbook-2026-10-24.md` for later phases and rollback.
