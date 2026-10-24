# Pinned n8n run for stage 07 (run 434, 16 Oct 2026)

- `claude-pin-run-434.json`: the pin data passed to `test_workflow` on A7 (`1cgZc9rmBOrPdKIe`) for run 434. Test values only; the tokens in it are fake ("claude-test-token-not-a-secret").
  It walks webhook → plan → go 1 → white master (pinned) → review → go 2. The pinned "G2 Go 2 verdict" returns a run in state "scene_room_ready", so the loop continues into stage 07 placement. The pinned "15d Reserve operation" returns the white master's key, so the scene dispatch stops at 15e by design: nothing is sent.
- `claude-summarise-execution.py <saved get_workflow_execution JSON>`: prints each node run in order, with status, hold reason and the scene fields.
