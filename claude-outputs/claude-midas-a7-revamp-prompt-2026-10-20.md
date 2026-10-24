# Prompt: finish the Midas A7 revamp

Use this as the opening message of a new session on the repository `Ibrahim-Abedrabboh/claude-midas-studio` (branch from `main`). It lists everything still to do, in order, with the rules that apply. Written 20 Oct 2026.

---

You are continuing the revamp of the Midas A7 studio pipeline. The n8n workflows were replaced by one Python service (`src/midas_a7/`, FastAPI, Postgres), deployed on Railway and already running. Read these first, in this order:

1. `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md` (what the service is, variables, switch steps, known differences).
2. `claude-outputs/claude-midas-a7-python-migration-plan-2026-10-20.md`, section 10 (fast track, as built).
3. `claude-outputs/claude-midas-a7-run-reports/2026-10-20-first-end-to-end-run.md` (timings of the last n8n run; section 4 lists the speed changes).
4. `claude-outputs/claude-midas-a7-prompts-catalogue-2026-10-20.md` (every prompt A7 sends to a model, with hashes).
5. `src/midas_a7/flows/manifest.json` (the recorded patches to the frozen flows: `PATCHES`, `NODE_PATCHES`, `SETTINGS_PATCHES` in `tools/n8n_to_flow.py`).

## Ground rules

- **Secrets:** never ask for, print or store a secret. Variables are set by the owner in Railway's Raw Editor from a local `.env`. The repo and chat stay free of them.
- **Paid calls:** no model or image call unless the owner gives an explicit go for that run, with a stated cap. Tests use mocks (`tests/py/`, 191 pass; owner-site tests, 364 pass).
- **Consequential actions need the owner's go each time:** switching the owner site (`A7_ENGINE_BASE_URL` on Netlify), unpublishing n8n workflows, deleting anything, changing flow behaviour.
- **Flow changes are patches, never edits of the generated files.** Change `tools/n8n_to_flow.py` (`PATCHES` for JavaScript, `NODE_PATCHES` for node parameters, `SETTINGS_PATCHES` for engine settings), run `python tools/n8n_to_flow.py`, and keep CI green (`ruff` 0.8.4, `pytest`, Docker build, flow packages identical to a regeneration).
- **Parity first:** the replay of run 1591 (`tests/py/test_replay_run_1591.py`) must keep matching n8n node for node unless a change deliberately alters a node, in which case say so in the manifest reason and the PR.
- Work on a branch, open a draft PR per work package, and report what was done, what was verified and what was not.

## Work packages, in order

### WP0 · Access (owner actions, you only check)

- Railway project `midas-a7` (id `d3f4514a-ad4f-433b-ac90-f947fd4dd0bd`), service `midas-a7` (id `1317e32d-b477-4090-9ac6-f3947a694055`), address `https://midas-a7-production.up.railway.app`. Already set: `DATABASE_URL`, `PUBLIC_BASE_URL`, `SCHEDULES_ENABLED=false`.
- Still missing on the service: `RESUME_SIGNING_SECRET`, `A7_BRIDGE_HEADER_VALUE` (must equal the owner site's `A7_READ_AUTHORIZATION`), `MIDAS_CLIENT_HEADER_VALUE`, `MIDAS_OWNER_HEADER_VALUE`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`.
- When the owner says they are set: confirm the seven names appear on the service (never values), that the redeploy started cleanly, and that `GET /health` reports every credential `true`. If the session's network blocks the Railway host, ask the owner to add `midas-a7-production.up.railway.app` under Allowed domains in the environment settings; until then use Railway's own health check and logs.

### WP1 · Go live (runbook section 3, each step on the owner's go)

1. Unpaid check: `GET /webhook/a7/owner-read` on the service with the bridge header answers with an empty queue.
2. Switch the owner site: set `A7_ENGINE_BASE_URL` to the service origin on Netlify and redeploy. Confirm all seven call sites go to the service (`lib/a7-engine-base.mjs`).
3. One supervised paid run, cap USD 3.00: white package plus one scene, through go 1 and go 2. Record per-step timings from the service logs and the budget ledger (`reserve`/`settle` pairs), as the first-run report did.
4. Rollback stays: unset `A7_ENGINE_BASE_URL`, redeploy, republish n8n.

### WP2 · Measure the speed changes (merged in PR #67, live on Railway)

Using the WP1 run, report measured against the report's estimates:
- change 1, blind count with low thinking: duration, and whether its piece count matches the vendor photo;
- change 2, critic review and blind count in parallel: review segment duration (was 17 s + 84 s);
- change 3, plan critic skipped on white-only plans: confirm 11c is not called on a white-background job.
If a change hurts quality (a wrong count, a missed defect), revert that one patch by removing its entry in `tools/n8n_to_flow.py` and say why.

### WP3 · White master only when the client asks for it (owner's decision, 20 Oct)

Today every job type adds a white master and scenes wait for its approval at go 2 (`01_Intent_scope.js` `add('white_master', …)`; `13_Compile.js` round 1; `19a_Scene_ticket.js` gate; `16a_Review_ticket.js`). Build it in two stages:

Stage A, behaviour unchanged by default:
- Client form (`claude-outputs/claude-midas-a7-owner-workspace/client/app.js`): under Lifestyle add one checkbox, "Also make the white catalogue image", **on by default**. White background and Website jobs keep the white image with no new control.
- Brief flag read by A7 (patches in `tools/n8n_to_flow.py`): 01 adds `white_master` only when the flag is on or the outcome requires it; 13 makes the first scene in round 1 when there is no white master; 19a's gate becomes "approved reference exists, or none required"; 16a reviews the scene against the vendor photo only.
- Owner site: planned-images list (`studio/app.js` ≈530–534) adds the catalogue slot only when required; results page and go 2 treat a lifestyle package as complete when its scenes are approved; "scenes from an approved white image" stays, offered only when one exists.
- Tests for both paths; replay 1591 unchanged (it has the flag on).

Stage B, the test before switching the default: 10 products with approved white masters, hero scene made with and without the white master as a reference (≈USD 3–5, needs a go). Compare first-pass review result, blind-count correctness, repairs needed, owner approval. Flip the Lifestyle default to off only if going without costs at most 1 extra failure in 10; otherwise keep the white master as a hidden reference that is not delivered.

Also, at no quality risk: when the same product comes back, reuse its approved white master automatically instead of the owner picking it by hand.

### WP4 · Decide what to adopt from the client studio audit

The separate "Midas Furniture Studio" site (`midas-client-studio.arafat312096.chatgpt.site`, release F1-CATEGORIES-2026-09-29, Magnific-based, generator `imagen-nano-banana-2`) was audited on 20 Oct. Its public code holds: 43 category handling profiles (`scene`, `sourceRules`, `checks`, `propPolicy`); one compiled prompt structure per job (sections `SOURCE INVENTORY LOCK`, `CATEGORY GUIDANCE`, `OUTPUT`, `STYLING BRIEF` as JSON, `FRAMING CHOICE`, `CAMERA / LIGHTING / ROOM STYLE`, `ACCESSORIES`, `REFERENCE ORDER`, `CATALOGUE ACCESSORY CANDIDATES`, `CLIENT BRIEF AND CUMULATIVE CORRECTIONS`, a closing self-check); a 15-check review rubric (fidelity, integrity, styling; 0 / 0.5 / 1 per check with coverage); cumulative steering where a later correction overrides only its named property; a repair prompt saved but never auto-submitted.

For each, compare with what A7 already does (A7 has 44 handling profiles, category guidance in 13 Compile, a 16-check critic review plus a blind count, and 24-hour go tickets) and write a short table: adopt / already covered / not worth it, with the reason. Do not copy prompts wholesale; A7's prompt hashes are the baseline. Put forward at most three concrete changes with expected effect, and wait for a go before building any.

### WP5 · Cleanup and operations

- n8n (owner's go): after the WP1 run passes, unpublish A7 (`1cgZc9rmBOrPdKIe`), the five bridges and the catalogue refresh; keep them saved 14 days. Delete executions 677–682 and 1591 (they stored credentials in plain text). Rotate or delete the "Claude · Midas client header" credential.
- GitHub: 14 merged branches are still there (deletion returned 403 for the agent); give the owner the delete commands or confirm they are gone.
- Decide the weekly catalogue refresh: either set `SCHEDULES_ENABLED=true` on Railway or leave it off and run `midas-a7 run catalogue_refresh` by hand.
- Keep `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md` current with every change above.

## Done means

- Owner site on the Python service, one supervised run passed through go 1 and go 2, timings and costs recorded.
- Speed changes measured, any harmful one reverted.
- White master on demand built with the default unchanged, test run if approved, decision recorded.
- Adoption table from the client studio audit delivered, with at most three proposals.
- n8n unpublished (on the owner's go), cleanup done, runbook updated, CI green on main.

Report at the end of each work package: what changed, what was verified (with the command or run), what was not verified, and what needs the owner's decision.
