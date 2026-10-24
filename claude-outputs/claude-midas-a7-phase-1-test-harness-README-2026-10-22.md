# Midas A7: Phase 1 test harness and baseline (22 Oct 2026)

Written by Claude. **Tests only. No flow, engine or site behaviour changes, and no paid call.** This prepares the ground for Phase 1 (`claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md`): every Phase 1 item needs whole runs that hold, refuse or crash on purpose, without paying anything.

## What was added

| File | What it does |
|---|---|
| `tests/py/claude_a7_harness.py` | Starts the real service with the real flows. Every outside call is answered by a stand-in: by default with what the budget site, OpenAI and Anthropic answered in the real run 1591. A test can replace any answer. Any call nobody answers fails the test. Each settle gets the recorded answer of its own stage (matched by its permit). Helpers send the recorded job, read the run row, read the approval context, decide at a gate, and make a named node throw (`fail_node`), as a Code node that throws does |
| `tests/py/test_claude_phase1_baseline.py` | Baseline tests: what whole runs do today, on the harness |

The harness grew out of the existing `test_go1_round_trip.py`, which already answered outside calls from run 1591 for one test.

## What the baseline shows today

**Already right, and kept by Phase 1 (plain tests):** eight outside faults before Go 1 all end as a recorded hold with a plain reason. No step crashes and nothing is resent.
- The source receipt can't be read, or the source check is down.
- The budget refuses, or answers without a ticket.
- The settlement can't be read, or the settlement service is down. No further provider call follows (rule 22).
- The planner's answer can't be read.
- The critic's answer can't be read twice. It is tried exactly twice, then holds.

**Gaps Phase 1 is meant to close (strict expected failures):**

| Gap | What happens today |
|---|---|
| FL-1 (1.1) | An owner run whose Code node throws (planted at `Budget · 11c · Ticket`) ends in an error, and its run row still says "received", with no hold |
| FL-2 (1.5) | A job from the client page (`client-…` id) is accepted ("received"), then crashes at `Budget · 03 · Ticket` with `budget_identity_missing`. Nothing is paid: the crash comes before any reservation |
| FL-9 (1.7) | A budget hold offers the owner no choice at all (`allowed: []`), even once the ledger permits again |

Two `test_today_*` tests describe the FL-1 and FL-2 crashes as they behave now; the 1.1 and 1.5 PRs replace them. A strict expected failure turns red the day a Phase 1 change fixes the gap, so that PR must remove the marker. Where the design leaves a choice open, every option satisfies the test: FL-2 passes if the job is refused at intake, held with a reason (both with nothing paid), or accepted and run to Go 1. The FL-1 test does not depend on FL-2, so the order of the Phase 1 items does not matter.

## Verified (locally)

- `python -m pytest -q`: 220 passed, 2 skipped, 3 xfailed.
- Each expected failure was run with `--runxfail` and fails on the gap it names: the row is "received" instead of "hold"; the client job's run ends in an error; no "Continue" is offered.
- An independent review (`midas-a7-specialist:a7-reviewer`) found that both settles got the stage-11 answer, that the FL-1 test depended on FL-2 and that the FL-2 test fitted only one design option; all fixed, with its nits.
- `ruff 0.8.4`: clean.
- `midas-a7 check`: all node types handled.
- Flow packages are identical to a regeneration.

## Not covered yet

The harness stops at Go 1, because the recorded run 1591 ends there. Runs past Go 1 (the image call, Go 2, the package, scenes) need recorded or made-up answers for the image and vision calls. Those will be added with the Phase 1 item that needs them (1.2, 1.3, 1.6).

## Owner actions

Review and merge when ready. Nothing here needs a deploy or a paid call.
