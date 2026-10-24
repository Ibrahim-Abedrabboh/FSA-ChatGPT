# Midas Studio documentation

Two sets, one per audience. Both describe the repository as of the commit in [`claude-docs-state.json`](claude-docs-state.json).

## For the owner and non-technical readers (`business/`)

| Page | Read it for |
|---|---|
| [Overview](business/claude-overview.md) | What Midas Studio does, who uses it, how a job works |
| [Status and roadmap](business/claude-status.md) | What works, what's blocked, the next decisions |
| [Rules, costs and risks](business/claude-rules-costs-risks.md) | The rules the studio keeps, spending controls, the risks |
| [Glossary](business/claude-glossary.md) | Plain meanings of project words |

## For developers (`technical/`)

| Page | Read it for |
|---|---|
| [Architecture](technical/claude-architecture.md) | Components, which engine serves which site, request path, auth, data |
| [A7 pipeline](technical/claude-pipeline.md) | Every stage, gate, rule and model |
| [Python service](technical/claude-python-service.md) | Engine, flows, API, CLI, storage, configuration, known issues |
| [Owner web app](technical/claude-owner-app.md) | Screens, functions, settings, UI review findings |
| [Build, test, deploy](technical/claude-build-test-deploy.md) | Every suite and CI job, deploy, changing a flow, rollback |
| [Migration status](technical/claude-migration-status.md) | n8n → Python status per part, and what is not working yet |

## Keeping them current

- **Instructions:** [`/CLAUDE.md`](../CLAUDE.md) holds the project rules every agent follows.
- **With every change:** a change that alters behaviour, a route, a variable, a rule or a status updates the matching page in the same PR.
- **Daily check:** a scheduled task compares the commits since `claude-docs-state.json` with these pages. When they are behind, it opens one docs PR (or updates the open one); you review it before anything changes.
- **Older review:** the owner review page with diagrams stays in [`claude-midas-studio-review/`](claude-midas-studio-review/README.md).
