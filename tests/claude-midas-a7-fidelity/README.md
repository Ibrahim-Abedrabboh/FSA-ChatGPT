# A02 furniture fidelity regression

The failed owner test `claude-a7-20261017165728-1d79cw` photographed two separate upholstered units with exposed connector panels and brackets. The Eye recorded those details but described the units as interlocking. The old white prompt promoted that inferred relationship to an arrangement instruction. Its context clause also allowed retained cushions to become plain. These are prompt conflicts; they do not establish a deterministic cause for all image variation.

## Targeted change

Only `13 Compile` and `16a Review ticket` change. The white generation prompt gives the photographed arrangement priority over inferred assembly, protects visible gaps and connector details, and preserves patterns on retained cushions. The review prompt explicitly checks these features through the existing `pieces_match` and `details` checks. Connected source units must also remain connected. No Eye reader, image model, approval policy, scene prompt, storage policy or workflow connections change.

## Verification

Run `node tests/claude-midas-a7-fidelity/run_tests_fidelity.js`.

Six targeted checks pass. The fixture contains the failed run's observation and inventory, with no credentials, tokens or execution runtime data. Prompt tests establish the instructions delivered, not visual fidelity.

Existing regressions: written instructions 16 passed; prompt fixes 107 passed; Phase 1 82 passed. `git diff --check` passed. Both Code node configurations validated.

Published version: `23ae2391-4a24-4fe5-94f9-ea8f8d033f02`. Readback confirms the published graph equals the draft, both code bodies equal source, only these two nodes' parameters changed, and settings/connections are unchanged from the A01 production baseline.

## Live test

Run `claude-a7-20261017180546-r1onco` (execution 548) used the same original photo and instructions through the owner portal. One 2048 x 2048 candidate was generated. Visual inspection and automated `pieces_match` / `details` checks confirmed separate units, connector faces/brackets and cushion patterns. Reviewer and blind reader both counted two units. This verifies the reported case, not universal fidelity or hidden construction (the original is only 340 x 223 pixels).

Overall review was **failed** for contact shadow, with contract handedness unsure and a separate tight-framing note. No delivery approval was given. Go 2 stop was recorded and read back as `stopped_by_owner`. Candidate SHA256: `d23cdd75dcc061361e8c33e2cd9c059e5e805cbd10a3ee73bd921adcf866fa66`. Drive reported the candidate private to its owner and the saved receipt reports a checksum match.

Additional recorded estimate: USD 0.10419 (text/review 0.04649, image 0.05770); identical repeated text-call vault payloads counted once. Estimates are not a provider invoice. No next checklist fix was implemented.

## Reference reconciliation follow-up

The user subsequently authorized applying findings from the Studio, Atlas, Guide and Examples. n8n replaces Magnific; no Magnific connection is a requirement.

The live observation in execution 548 returned `sided_parts` as `{piece, side}` objects. Existing locks, compiler, reviewer and repair code coerced these objects into `[object Object]`. The reviewer reported unreadable contract handedness. Four nodes now preserve readable meaning in both legacy string and structured object forms: `08 Locks and freedoms`, `13 Compile`, `16a Review ticket`, and `16b Review verdict`.

Scene generation and review now protect modules and connectors from inferred assemblies too, while still allowing the approved plan to reposition pieces. This covers the historical C5 warning: a proposed connection is not proof of compatibility, and a rectangular source module must not become an invented wedge corner. The white arrangement rules remain unchanged.

Category check focus now reaches both reviewer prompts and is stored with the candidate review. Blind readers receive no target/category checklist. This does not add a per-category structured verdict schema or a whole-package comparison gate; those remain separate work. Existing owner approvals, note-only styling policy, provider settings, budget and repair limits are unchanged.

Ten targeted tests passed, including the structured handedness case, scene instruction projection, contract locks and repair preservation. Existing suites: Phase 1 82 passed; prompt/intake 107 passed; written instructions 16 passed; node configuration validation and `git diff --check` passed. These follow-up checks used no paid calls and do not establish a new live scene-image outcome.

Published follow-up version: `060fca2e-6427-480b-b5ca-4cb2893d084b`. Readback before publication verified only the four intended parameter bodies changed, all exactly matched source, settings and connections were unchanged. Published active version was read back after publication.

### Scoped scene instructions

The deeper U2 evidence identifies weakening an explicit proposed five-seat assembly as a prompt/scope defect. Preserve the distinction: a white catalogue normalization retains the photographed arrangement; a scene's explicitly approved visual-assembly request can arrange the original modules, but cannot redesign them, invent a wedge connector or certify physical compatibility.

Output-specific contract locks reached the planner but were not copied into the final scene prompt. `13 Compile` now looks up the contracted output by output ID and carries its non-redundant constraints into scene generation. `16a Review ticket` carries the output's locks to the reviewer and reads its frozen category checks before a profile fallback. The blind count remains uninformed.

Eleven targeted tests now pass. The new scene-lock test initially caught the render-order object missing the underlying output locks; lookup by output ID fixes that boundary. Existing Phase 1 82 and prompt/intake 107 checks passed again; the prior written-instruction 16 checks remain passed. Final node validation and diff check passed. No new paid model call or live scene qualification is claimed.

Current published version: `fa100c94-9efd-4232-8da0-8aa95b9a8df0`. Exact readback confirmed only compiler/review-ticket parameters changed from the previous published follow-up, with settings/connections unchanged.
