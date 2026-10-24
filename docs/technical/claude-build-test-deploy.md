# Build, test and deploy

*Technical documentation · checked against commit `b286045` (22 Oct 2026)*

## Test suites

| Suite | Command | CI workflow |
|---|---|---|
| Python service (195 tests) | `python -m pytest -q` | `midas-a7-python.yml` |
| Flow packages = regeneration | `python tools/n8n_to_flow.py && git diff --exit-code -- src/midas_a7/flows src/midas_a7/data` | `midas-a7-python.yml` |
| Node handlers complete | `midas-a7 check` | `midas-a7-python.yml` |
| Lint | `ruff check src tests/py tools/n8n_to_flow.py tools/extract_prompt_catalog.py` | `midas-a7-python.yml` |
| A7 stage and guidance suites (Node, plus one Python catalogue-audit suite) | each `- run: node …` and `- run: python3 …` step | `a7-guidance.yml` job `guidance-and-release` |
| Owner app (371 tests) | `npm test` in the owner workspace | `a7-guidance.yml` job `owner-controls` |
| a7-engine (paused service) | `python -m pytest -q` in `services/a7-engine` | `a7-engine.yml` |

**Key Python tests:**
- `tests/py/test_replay_run_1591.py` replays recorded n8n run 1591 node by node up to Go 1. It is the parity check.
- `test_real_flows_e2e.py` runs the real flows with outside calls forbidden.
- `test_go1_round_trip.py`.
- `test_speed_changes.py`.
- `claude_a7_harness.py` runs whole runs on the real flows with every outside call answered (or replaced by a test), and can make a named node throw. Up to Go 1 the answers come from run 1591; past it they are made up: a budget permit and settlement per paid step, a stand-in image per image call, a passing blind count and review, and an in-stock Midas page per planned piece. A run then reaches Go 2, the package and a scene. A call nobody answers fails the test when the service stops. `test_claude_phase1_baseline.py` uses it before Go 1: plain tests for the faults that already hold cleanly, and strict xfails for FL-1, FL-2 and FL-9. `test_claude_phase1_past_go1.py` uses it past Go 1: plain tests for the image call, Go 2, the package and the first scene (and for an uncertain image outcome, which is never resent), and strict xfails for FL-4 (1.2), FL-5 (1.3) and FL-10 (1.6). The matching Phase 1 PR removes each xfail.

**The `a7-guidance.yml` suite list.** The job `guidance-and-release` runs 20 suite steps: 19 Node suites and `python3 -I tests/claude-midas-catalogue-audit/run_tests_audit.py`. Until 21 Oct 2026 only nine ran in CI, so the stage 05 and phase 1b suites failed unnoticed from 17 Oct. PR #79 (merged 21 Oct, commit `0f53b06`) fixed both stale tests and added the other eleven local suites. All 20 pass locally at `b286045` (docs check, 22 Oct 2026). The Claude Code mod `a7-drift-guard` reads the same list and holds `git commit`/`git push` until those suites pass after an A7 change.

## Python service: build and deploy

- **Image.** `Dockerfile`: a Node 22.12.0 stage runs `npm ci` for the JS runner; final image python:3.12.8-slim with the node binary; runs as uid 10001; `midas-a7 serve` on port 8080.
- **Railway.** `railway.json`: Dockerfile builder, **1 replica** (active run state is in the process), health check `/health` with a 60 s timeout, restart ON_FAILURE with 5 retries. Project `midas-a7`, URL `https://midas-a7-production.up.railway.app`.
- **Secrets.** The owner sets them in Railway's Raw Editor; they are never committed.

## Owner app: build and deploy

`npm ci && npm test && npm run build` → `dist/` plus `netlify/functions`. Netlify builds with base directory `claude-outputs/claude-midas-a7-owner-workspace`. The root `netlify.toml` fails any other base on purpose.

## Changing a flow

1. Add a patch to `PATCHES`, `NODE_PATCHES` or `SETTINGS_PATCHES` in `tools/n8n_to_flow.py`, with a reason.
2. Run `python tools/n8n_to_flow.py` and commit the regenerated packages and `manifest.json`.
3. Run the full Python and A7 suites. If the change alters a node on the replay path, update the replay expectation and say so in the PR.
4. The owner approves any change in flow behaviour before it is merged and deployed.

## Rollback (owner site)

1. Delete `A7_ENGINE_BASE_URL` on the site.
2. Redeploy.
3. Republish the n8n workflows if they were unpublished.

Runs started on the service stay there.
