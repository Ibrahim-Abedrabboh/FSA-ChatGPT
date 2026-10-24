# midas-a7-specialist (The Specialist)

Registers the agent type `midas-a7-specialist:a7-reviewer`: a read-only reviewer (Opus) that checks one Midas A7 change against the 24 rules in CLAUDE.md before the owner sees it. It covers correctness, flow patches only in tools/n8n_to_flow.py, replay parity, budget and image-call rules, Go 1/Go 2, repairs, rule 17-21 product rules, secrets, client wording, tests and docs, and it runs the repo's checks. It cannot edit, commit, push, merge, deploy or spend. Ask Claude to "review this PR with the a7-reviewer" or dispatch it with the Agent tool.
