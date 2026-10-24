# claude-midas-studio

Private working repository for Midas Virtual Studio: the A7 pipeline (now a Python service), its n8n history, tests, test data and the written outputs Claude produces for it. Started 15 Oct 2026. Start with `CLAUDE.md` and `docs/claude-docs-README.md`.

## Where the truth is

- **Since 20 Oct 2026 the A7 pipeline runs as a Python service** (`src/midas_a7/`, Railway), which keeps the n8n Code-node JavaScript byte for byte. The owner site `midas-a7-owner-preview` calls it; `claude-final-midas-a7` still calls n8n. See `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md`.
- **Flow changes** are patches in `tools/n8n_to_flow.py`, applied to the frozen exports in `n8n/baseline/`. Files under `n8n/` are dated exports, not a live workflow.
- **Generated images** are kept in the service's own file store and served by signed links; Google Drive is no longer used for them. Older test photos remain in Drive ("Claude · Midas Drive").
- **The Claude Project** "Midas Furniture styling" keeps the older READMEs, the coverage register, decisions and handoff notes.

The layout list below dates from the n8n period (16 Oct). `CLAUDE.md` has the current map.

## Layout

- `n8n/claude-midas-a7/`: export of "Claude · Midas A7 (stages 01–07)" (`1cgZc9rmBOrPdKIe`, version `a22b6f1a`, 16 Oct 2026, 05:09 Amman). The full workflow JSON and one file per Code node (54, byte-checked against n8n). Not published. The export is written from a saved n8n read-back by `tools/claude-midas-a7-export.py`, which also byte-checks every Code node.
- `n8n/claude-midas-a7-model-test/`: export of "Claude · Midas A7 model test" (`WvmDSrnX6lYdiKzZ`, version `2614706e`). Preview mode; paid switch off.
- `n8n/claude-midas-catalogue-refresh/`: export of "Claude · Midas catalogue refresh" (`mGgKxO0638I77meF`, version `2b2be743`). Not published; run once by the owner (execution 429).
- `n8n/claude-midas-a7-model-test-one-call/`: export of "Claude · Midas A7 model test · one call" (`MYwlkpnVdCqoEmfR`, version `e66075ec`, read 16 Oct 2026, 00:08 Amman). The sub-workflow that makes the model test's single paid call; callable only from the model test. Not published. Checked by two independent reads from n8n that match exactly (all 20 nodes, all 7 Code nodes).
- `tests/claude-midas-a7-stage-05/`: local stage 05 tests (`node tests/claude-midas-a7-stage-05/run_tests05.js`, 58 tests). They read the Code nodes from `n8n/`.
- `tests/claude-midas-a7-stage-06/`: local stage 06 (package) tests (`node tests/claude-midas-a7-stage-06/run_tests06.js`, 56 tests) with real image fixtures, the code-made test master used in scratch run 428, and that run's result.
- `tests/claude-midas-a7-stage-07/`: local stage 07 (scenes) tests (`node tests/claude-midas-a7-stage-07/run_tests07.js`, 86 tests).
- `tests/claude-midas-a7-scene-files/`: image shapes and scene delivery files (step 20) tests (`node tests/claude-midas-a7-scene-files/run_tests_scene_files.js`, 65 tests), the code-made image fixtures and their maker, and the record of scratch runs 435 and 436.
- `tests/claude-midas-a7-views-framing/`: framing on the longest side, view mapping and the shared room (`node tests/claude-midas-a7-views-framing/run_tests_views_framing.js`, 79 tests).
- `tests/claude-midas-a7-page/`: mock-mode check of the A7 client page draft in headless Chromium (`node tests/claude-midas-a7-page/run_page_mock.js [folder for screenshots]`, 36 tests). Nothing is sent; each payload is also passed through A7's 01 Intent & scope.
- `claude-outputs/claude-midas-a7-page/`: client page draft for A7 (copy of `claude-midas-studio-page`, nine-shape list, views decide the images). Not connected; mock mode only.
- `tests/claude-midas-a7-model-test/`: MT4 tests (`node tests/claude-midas-a7-model-test/run_tests_mt4.js`, 9 tests).
- `tests/claude-midas-catalogue-refresh/`: refresh parser tests (`node tests/claude-midas-catalogue-refresh/run_tests_refresh.js <folder of saved listing pages>`, 9 tests).
- `tools/claude-midas-a7-export.py`: writes the A7 export from a saved read-back and byte-checks the Code nodes.
- `tools/claude-midas-accessories-import.py` and `data/claude-midas-accessories-2026-10-16.json`: the accessories import (415 rows read 16 Oct 2026).
- `tools/claude-midas-catalogue-audit.py`: Phase 3 catalogue audit and facet map (reads files only). Inputs and results in `data/claude-midas-catalogue-snapshot-2026-10-16.json`, `data/claude-midas-catalogue-audit-2026-10-16.json`, `data/claude-midas-facets-2026-10-16.json`. Tests: `python3 -I tests/claude-midas-catalogue-audit/run_tests_audit.py` (40 tests). See `claude-outputs/claude-midas-a7-phase-3-README-2026-10-16.md`.
- `claude-outputs/`: the files moved from the Claude Project, at the same paths. See `MANIFEST.md` for each file's checksum and how it was checked.

## Documentation and agent instructions

- `CLAUDE.md`: the full project rules every agent follows, each with its source.
- `docs/claude-docs-README.md`: business documentation (`docs/business/`) and technical documentation (`docs/technical/`), checked daily against new commits.

## Rules for this repo

- No keys, tokens or access codes in any file. Credentials appear only as n8n credential names and ids, which are not secrets.
- Prefix new files with `claude-`.
- Nothing here is published, deployed or run by being in this repo.
