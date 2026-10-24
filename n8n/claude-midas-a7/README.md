# Claude · Midas A7 (n8n workflow 1cgZc9rmBOrPdKIe)

Three copies of the workflow live here. They are meant to differ.

| File | What it is | Who writes it |
|---|---|---|
| `live/workflow-1cgZc9rmBOrPdKIe.json` | The workflow as it runs in n8n, guards included (361 nodes on 20 Oct 2026). The authoritative copy. | A saved n8n read-back, written with `json.dumps(d, indent=1, ensure_ascii=False)` and no trailing newline. |
| `workflow-1cgZc9rmBOrPdKIe.json` | The pre-guard baseline: the workflow without the `Budget · …`, `Recovery · …`, `Blind · …` and `Package · …` nodes (183 nodes). | Edited by hand, node by node, when a baseline node changes. Do not overwrite it with the live copy, and do not run `tools/claude-midas-a7-export.py` against it: that script writes this path from a read-back, and a read-back of today's workflow includes the guards. |
| `code-nodes/*.js` | One file per baseline Code node, equal to that node's `jsCode` in the live copy. | Copied from live; never the other way round. |

`budget-guards/build-guarded-workflow.mjs` and the other builders in `budget-guards/` take the baseline and add the guards
(`installed-version.json` names it as `"baseline"`). `guardWorkflow()` refuses a workflow that already has guards
(`guards_already_present`), so the baseline must stay unguarded. Because live code has moved on since the baseline was written,
the baseline's node code can be older than live; the code-node files, not the baseline, track live.

`tests/claude-midas-a7-guidance/run_tests_guidance.js` checks that every code-node file equals its live node and that the
baseline stays unguarded.
