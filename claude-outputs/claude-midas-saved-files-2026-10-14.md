# Files saved to the project on 14 Oct 2026

These files are the outputs of the 14 Oct session, saved at 19:55 Amman time.

## A7 design
- `claude-outputs/claude-midas-a7-blueprint-2026-10-14.html`: the blueprint page. A private artifact also holds it.
- `claude-outputs/claude-midas-a7-blueprint-README-2026-10-14.md`: its README.
- `claude-outputs/claude-midas-a7-design/`: the sources that build the page and the costs.
  - `content.py`
  - `build.py`
  - `cost_model.py`
  - `cost_model.json`
  - `diagrams/`: one Mermaid file per diagram (`a7-flow.mmd`, `a7-handoff.mmd`, `a7-data-model.mmd`, `a7-revision.mmd`). Each opens on its own in any Mermaid viewer.
  - `build_anim.py` builds the animated stages page.
  - To rebuild: run `python3 cost_model.py`, then `python3 build.py`.
- `claude-outputs/claude-midas-a7-research/`: the reading notes behind the design. They cover the architecture pages, the client page and guide, the workflow atlas, the four cases, model prices and token estimates. They are working notes with their sources, not requirements.

## A7 build, stages 01–02 (added 23:35)
- `claude-outputs/claude-midas-a7-stages-01-02-README-2026-10-14.md`: status, tests, gaps and leftovers. The draft workflow `1cgZc9rmBOrPdKIe` is not published and no paid call was made.
- `claude-outputs/claude-midas-a7-build/`:
  - `js/`: the source of every Code node.
  - `prompts.py`: the model prompts.
  - `build_sdk.py`: builds the workflow code.
  - `test/`: the local harness, the 13 scenarios and the n8n pin data.

## A6 prompts export
- `claude-outputs/claude-midas-a6-prompts-by-phase-2026-10-14.md`: every prompt by phase, with the data fidelity and integrity section.
- `claude-outputs/claude-midas-a6-prompts-tools/`: the scripts that built and checked the export, plus `verification.json` and `phases.json`.

## Owner Go/Stop panel (client page, live version)
- `claude-outputs/claude-midas-studio-site-a6-go/README.md`
- `claude-outputs/claude-midas-studio-site-a6-go/site/`: `index.html`, `app.js`, `styles.css`, `_headers` and `taxonomy.js` (the same 29 Sep release as the root snapshot).
- `claude-outputs/claude-midas-studio-site-a6-go/tests/`: `test_owner_go.py`, `test_live_reload.py` and `patch_owner_go.py`. The test keys are made-up strings.

## Not saved, and why
- **Binary files.** Project docs cannot hold binary files. These stayed out:
  - the Word copy of the prompts export (the `.md` has the same text)
  - the verification zip
  - `atelier-hero.webp`
  - the panel screenshots
  - the three images from run 362
- **The raw n8n exports** of workflow FPAF0QHltl8iIcdZ and run 362. Run records can hold keys, and n8n stays the authority for them.
