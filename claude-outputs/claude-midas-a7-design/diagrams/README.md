# A7 diagrams (Mermaid)

Design only, 14 Oct 2026. Nothing is built in n8n. Each file holds one diagram; open one file at a time in any Mermaid viewer.

## `a7-flow.mmd`

- A7 full workflow (Architecture A, surgical replacement). Design, 14 Oct 2026; not built in n8n.
- Shows all 21 steps grouped into the 6 stages, in the order code runs them.
- Red hexagons are holds and reconciliation; gold rounded boxes are the owner's decisions (Go 1, Go 2, final decision).
- Return arrows show the loops: a critical unknown returns to step 1 as brief v+1; a failed plan re-plans (max 2);
- a defect goes back to step 13 for a repair (max 2), then holds; a missing receipt is reconciled by request id.
- Step 19 (Vault) records every step; step 18 (benchmark) runs offline and updates the model registry.

## `a7-handoff.mmd`

- A7 stage hand-offs. Design, 14 Oct 2026.
- Shows the one record each stage passes to the next: observation, contract vN, scene plan, candidate with receipt,
- reviewed candidates, then the manifest or a hold for the owner.
- Dotted arrows are the two ways back: missing evidence returns to stage 01; a plan that breaks a lock returns to stage 02.

## `a7-data-model.mmd`

- A7 data model (records and how they link). Design, 14 Oct 2026.
- A project holds jobs (a batch is N jobs). Each job has references (each with a role), contract versions and outputs.
- Each output has paid operations; each operation returns a candidate; each candidate has reviews bound to its hash and contract.
- A job may have a parent job (edit or variation). A package holds the owner's decision.
- SPACE (saved rooms reused as target_room references) is a proposal, not in any source.

## `a7-revision.mmd`

- A7 revision or variation flow (client page, pipeline, owner). Design, 14 Oct 2026.
- A chip or message on result X changes one axis and creates a new brief v+1 linked to X; old plans and reviews are voided.
- The client sees the plan preview and what stays locked, then confirms. The owner gives Go 1 on the plan.
- Images are made and checked (at most 2 repairs each). The owner approves or holds the package.
- The client sees a Generated image; "Approved" appears only after the owner's decision.
