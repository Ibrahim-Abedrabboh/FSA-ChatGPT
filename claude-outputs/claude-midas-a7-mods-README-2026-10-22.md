# Midas A7: The Briefer and The Specialist (mods), 22 Oct 2026

Written by Claude. **Built and tested locally. Not yet running in a session: the owner switches them on.**

## What was built
- **The Briefer** (`tools/claude-mods/midas-a7-briefer/`):
  - Every Claude Code session in this repo starts with the A7 briefing in its system prompt: where things run, the plan phase, the open finding IDs, who does what, and the hard stops.
  - The text lives in `claude-outputs/claude-midas-a7-briefing.md`, so it is updated like any doc.
  - If the file is missing, a short built-in reminder of the hard stops is used.
  - `/a7-brief` shows the briefing.
- **The Specialist** (`tools/claude-mods/midas-a7-specialist/`):
  - Adds a reviewer agent, `midas-a7-specialist:a7-reviewer` (Opus).
  - It checks one change against the 24 rules in CLAUDE.md: correctness, flow patches, replay parity, budget and image-call rules, gates, repairs, product rules, secrets, client wording, tests and docs.
  - It runs the repo's checks and returns a verdict with findings and evidence.
  - It cannot edit, commit, push, merge, deploy or spend.

## Verified
- `claude plugin validate`: passed for both.
- `claude plugin test`:
  - Briefer: 3 of 3 pass. The briefing is added last; a missing file falls back to the built-in reminder; a long file is cut at 6,000 characters.
  - Specialist: 1 of 1 passes. The agent is registered with Opus, Edit and Write withheld, and a prompt built on CLAUDE.md.
- `tsc` type-check of both modules and their tests: clean.

## Not verified
- They have not yet loaded in a live session. In this cloud session Claude Code asks the owner once whether to turn on the mods written here.
- The reviewer has not reviewed a real PR yet. Its first job is the first Phase 0 PR.

## Owner actions
- Answer "Turn them on" when Claude Code asks, in this session.
- On your computer, start Claude Code with `--plugin-dir` for both folders (see `tools/claude-mods/claude-mods-README.md`).
