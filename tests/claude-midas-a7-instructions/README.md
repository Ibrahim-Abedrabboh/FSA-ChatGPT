# A01 written instruction regression

The 09b Contract parser previously searched for a string containing JSON. With JSON-mode Responses output, n8n 2.3 can return `output[].content[].text` as an already-parsed object. Execution 529 reproduced this with the original failed request's instructions and the unchanged classifier. The old parser discarded that valid answer.

The fixture contains only assistant answer content, completion status and usage from that execution. It excludes encrypted reasoning, credentials, runtime data and request identifiers. The diagnostic input reconstructed the relevant brief/evidence fields; it was not a replay of an entire prior provider request.

## Fix

Only 09b Contract changes. Accept a schema-checked object or JSON text from assistant answer content; ignore echoed instructions and reasoning metadata. Reject provider errors, incomplete answers, refusals, malformed JSON and invalid schemas. A technical classifier failure holds for the owner while keeping the original instructions; it does not ask the client to rewrite them. Product conflicts and canonical contract stamping remain intact.

No model, model prompt, token cap, approval policy or image behavior changes.

## Checks

`node --test tests/claude-midas-a7-instructions/run_tests_instructions.js`

16 targeted checks. The real-response regression failed before the change and passes after it. Existing `node tests/claude-midas-a7-phase-1/run_tests_phase1.js`: 82 passed, 0 failed.

Published processor version: df48349d-f79a-4291-89f0-2f4b10e06aa4. Readback confirmed only 09b parameters changed and its code equals this source. The separate owner output settings remain in place. The old exported workflow metadata remains historical; the live version is recorded here.

The manual-only diagnostic is A7 · Isolated written instruction test, 1d8LAUGtvef5x6KL, in the personal project. It is unpublished and has no image or table-write nodes. Do not run it as a scheduled workflow.

## Live owner portal check

Execution 532, run claude-a7-20261017174319-hpoy3g, used the same original instructions and reference photo through the owner portal after publication. Parser status was ok, zero critical conflicts, all three requested rules persisted in the contract, and Go 1 was reached. Stop was recorded at Go 1. The operation ledger contains zero image operations for this run. Additional recorded estimate including the isolated classifier diagnosis: about USD 0.01165, not an invoice.
