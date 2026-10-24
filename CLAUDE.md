# CLAUDE.md: Midas Studio (claude-midas-studio)

Instructions for Claude Code and any agent working in this repository. Read this first, then `docs/claude-docs-README.md` for the documentation map. Every rule below comes from an existing project file, named in brackets, so it can be checked.

## What this project is

Midas Studio turns one vendor product photo into catalogue images for Midas Furniture. A7 is the current pipeline. It makes a white catalogue master, packaged JPG/WebP files and, after approval, room scenes. The studio owner approves at two gates, Go 1 (plan) and Go 2 (image). Midas Studio, Midas VTON, Midas Styling and the A7 workflow are one app. The Midas-AI-Chatbot repo and the Midas ad dashboard are separate projects. [docs/claude-midas-studio-review/README.md]

**Where it runs (21 Oct 2026):**
- The A7 logic was built in n8n. It is now also served by one Python service (`src/midas_a7/`, FastAPI, Postgres, Railway), which keeps the n8n Code-node JavaScript byte for byte. [claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md]
- Owner site `midas-a7-owner-preview` calls the Python service (`A7_ENGINE_BASE_URL`, since 20 Oct 2026). Owner site `claude-final-midas-a7` still calls n8n. [claude-outputs/claude-midas-a7-owner-workspace/SETTINGS.md]
- The owner web app lives in `claude-outputs/claude-midas-a7-owner-workspace/` (Netlify).
- `services/a7-engine/` is an earlier, paused source-analysis service, superseded by `src/midas_a7/`. [claude-outputs/claude-midas-python-migration-plan-2026-10-20.md]

## Map

| Path | What it holds |
|---|---|
| `src/midas_a7/` | The Python service: engine, node handlers, generated flow packages |
| `tools/n8n_to_flow.py` | Turns `n8n/baseline/*.json` into `src/midas_a7/flows/`; holds the only allowed flow patches |
| `n8n/` | Dated n8n exports, code nodes, frozen baselines |
| `claude-outputs/claude-midas-a7-owner-workspace/` | Owner web app and Netlify functions (budget ledger, auth) |
| `claude-outputs/` | READMEs, handoffs, run reports, prompts, client page drafts |
| `tests/` | Local Node suites per stage; `tests/py/` for the Python service |
| `docs/technical/`, `docs/business/` | Current documentation for two audiences |

## Commands

- Python service: `pip install -e '.[dev]'`, `(cd src/midas_a7/engine/js && npm ci)`, `python -m pytest -q`, `midas-a7 check`, `ruff check src tests/py tools/n8n_to_flow.py tools/extract_prompt_catalog.py`
- Flow packages: `python tools/n8n_to_flow.py`, then `git diff --exit-code -- src/midas_a7/flows src/midas_a7/data` must show nothing
- A7 suites: every `node …` / `python3 …` step in `.github/workflows/a7-guidance.yml`
- Owner app: `cd claude-outputs/claude-midas-a7-owner-workspace && npm ci && npm test && npm run build`

## Rules that always apply

**Secrets and data**
1. No keys, tokens or access codes in any file, commit, log or chat. Credentials appear only as names and ids. Report variable names, never values. [README.md; claude-outputs/claude-midas-a7-revamp-prompt-2026-10-20.md]
2. The owner sets service variables himself (Railway Raw Editor, Netlify). Never ask for a secret's value. [revamp prompt]

**Owner approval (ask, then wait for a clear yes in that message)**

3. Each of these needs the owner's go every time:
   - Any paid model or image call, with a stated cap. Tests use mocks or pinned data.
   - Publishing or unpublishing anything.
   - Switching an owner site's engine.
   - Deleting anything.
   - Changing flow behaviour.

   [revamp prompt; claude-outputs/claude-midas-a7-build-prompt-2026-10-16.md]
4. Being in this repo publishes, deploys or runs nothing. Never edit a published n8n workflow in place; build a new draft version. [README.md; build prompt]
5. If a safety check refuses a step, do not work around it; ask the owner to run it. [build prompt]

**How code changes**

6. Flow changes are patches in `tools/n8n_to_flow.py` (`PATCHES`, `NODE_PATCHES`, `SETTINGS_PATCHES`), never edits of generated files under `src/midas_a7/flows/`. Regenerate and keep the manifest reason. [revamp prompt]
7. Parity first: `tests/py/test_replay_run_1591.py` must keep matching n8n unless a change deliberately alters a node, and the manifest and PR say so. [revamp prompt]
8. Keep CI green: ruff 0.8.4, pytest, Docker build, flow packages identical to a regeneration, and every A7 suite. Run the suites before every commit. [revamp prompt; .github/workflows/]
9. After any n8n change, re-export, byte-check every Code node, and run every suite. Read the workflow again right before each save; if it changed, stop and report. [build prompt]
10. `railway.json` keeps one replica, because active run state lives in the process. [runbook]
11. Work on a branch with one draft PR per work package. The report says what changed, what was verified (command or run id), what was not, and what needs the owner. [revamp prompt]
12. A separate agent that did not write the code reviews the diff. Check each finding against the code before acting. [build prompt]
13. New files are prefixed `claude-` (exceptions: `CLAUDE.md` and files a tool requires by name). [README.md]

**Product rules the code must keep**

14. Code decides each next stage; models do the reading, planning, image making and checking. [claude-outputs/claude-midas-a7-decisions-2026-10-14.md]
15. Go 1 and Go 2 always apply. A passed review is a "reviewed candidate", never an approval. "Approved" comes only from the owner's recorded Go 2. [coverage register; build prompt]
16. At most two repairs per image, then hold. `auto_repair` stays false. [coverage register section 2, decisions 10 and 29]
17. Never invent unseen parts. A cropped photo, or one with fewer pieces than the contract, holds and asks. [coverage register decision 3]
18. Props are Midas catalogue pieces only, in stock, from midasfurniture.com /en/ pages. Pre-order is excluded. [coverage register]
19. Delivery is 1125×1125 JPG and WebP from the 2048 master, resized without AI. Scenes keep their shape with a short side of 1125. [coverage register decisions 4, 17]
20. Framing is measured on the longest side: white about 76%, hero 60–70%, wide 40–55%. [04_Settings.js]
21. Dimensions read from photos are internal estimates, never shown as fact. Costs shown are estimates. [coverage register decision 7; decisions 2026-10-14]
22. Every paid call reserves budget on the owner site's ledger first. The image call never retries, and an uncertain outcome is never resent. Text and vision calls retry at most once inside the same reservation. [review diagrams; migration plan §3]

**Client-facing wording**

23. Never use internal terms: Eye, Brain, Critic, n8n, model or provider names. Label results "Generated image". Promise no delivery time, pixel size, retention or human stylist. English first and ready for right-to-left; no Arabic copy without a native review. [build prompt]

**Claims and evidence**

24. Never say something was built, tested, verified, published or deployed without evidence: a version id, a test result or an execution id. Model scores are judgements; never present the 90–95% fidelity target as achieved. [build prompt]

## Documentation

- `docs/technical/` is for developers; `docs/business/` is for the owner and non-technical readers. `docs/claude-docs-state.json` records the commit they were last checked against.
- When a change alters behaviour, a route, a variable, a rule or a status, update the matching docs page in the same PR. Also keep `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md` current. [runbook]
- A daily scheduled task compares new commits with `docs/claude-docs-state.json` and opens a docs PR when they are behind.
- Every build also gets a dated, plain-language README in `claude-outputs/`. [build prompt]
