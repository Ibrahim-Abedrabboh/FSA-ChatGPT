# Midas Virtual Studio: Architecture A / B design specification (extracted notes)

Extracted 2026-10-14. Read-only. No web, no n8n, no paid service. Everything below comes from the local files.
"inference" = my own reading, not stated in the files.

## Source key (short names used below)

| Short name | File |
|---|---|
| SPEC | /home/claude/research/files/architecture-lab_two-architectures.txt (371 lines; "Revision 2 · 4 October 2026 · Scope correction and evidence audit") |
| FW | files/architecture-lab_framework.json (21 roles, stagesA, stagesB, decisions, loops, runtime, audit, sources) |
| CTRL | files/architecture-lab_controller.mjs ("Midas reference controller v1. Local executable specification; no network calls.") |
| UI | files/architecture-lab_ui.mjs |
| SAC | files/architecture-lab_single-agent-contract.json |
| AUDIT | files/architecture-lab_scope-audit.json (2026-10-04, r2) |
| TEST | files/architecture-lab_test-report.json (2026-10-01, 36 tests) |
| MANIFEST | files/architecture-lab_source-manifest.json (2026-10-04) |
| BROWSER | files/architecture-lab_browser-report.json (2026-10-04) |
| COV | files/architecture-lab_coverage.json (48 rows) |
| PAGE | text/studio-architectures.txt (rendered page, one block per view) |
| XPAGE | text/x-studio-architectures.txt (button-click capture; only B stage 1 text revealed, all other clicks timed out) |
| CASES | files/surgical-cases.html (shell only; see section 9) |
| ATLAS | text/workflow-pipelines.txt (outside the assigned list; used only for section 10) |

Important framing the files repeat many times (quote): "Frameworks + local control tests / Production autonomy: not yet proven" (PAGE l.15-16). "Not established in production by this delivery: the complete A service chain or B single-agent runtime; a durable queue across every stage; ..." (SPEC l.359). "New architecture visual runs remain zero" (SPEC l.334; AUDIT counts.newArchitectureVisualRuns = 0).

The files do not mention n8n anywhere (grep checked). SPEC assumes Cloudflare D1/R2, a "queue/worker or durable orchestration service", Magnific, OpenRouter, fal. Mapping A onto n8n is therefore an inference, not in these files.

---

## 1. A vs B

### North star (SPEC l.7; FW.northStar)
"The client submits a job once and receives a complete, faithful, well-styled output package, with less active work and lower cost per accepted package. The studio must perform the interpretation, styling, operation and critique previously supplied in this chat." (SPEC l.7)

Scope of the delivery (SPEC l.9): "two distinct architecture specifications, a shared executable local reference controller, a synthetic loop lab, failure tests and an evidence-linked coverage inventory. It does not connect a new autonomous production workflow or activate the client preview. A control test cannot establish visual-model accuracy."

### "Who decides the next action?" (PAGE l.29-38)
- Heading: "ONE STANDARD · TWO ARCHITECTURES / Who decides the next action?"
- Toggle labels: "A · Surgical replacement" and "B · One deployed agent".
- A card (UI architecture(), PAGE l.33-38): "Surgical replacement. The application decides the next stage. Specialist models perform interpretation, design and critique. Best suited to evaluate first for repeatable jobs."
- B card (UI l.15; XPAGE l.72-75): "One deployed agent. One agent observes, reasons, styles, operates tools, reviews and corrects. The backend stores state and enforces limits. Replicate this assistant's complete working loop with one deployed agent."
- Under the stage strip: "Critique returns to correction, evidence or design. The Vault records every transition." (PAGE l.61)
- Controller trace label for B: "B · SINGLE AGENT + BACKEND RULES"; for A: "A · WORKFLOW" (UI traceView).
- SPEC l.15-16: "1. A vs B determines who chooses the next action."

### Shared foundation (PAGE l.62-68), six items, verbatim
1. Original identity
2. Versioned contract
3. Genuine Midas references
4. Evidence-based review
5. Bounded spend
6. Complete package gate

### Six orthogonal decisions (SPEC l.15-22)
1. A vs B: who chooses the next action.
2. Fidelity-locked vs creative-room: "determines what may change. Both modes exist in A and B."
3. Product category: "handling rules, functional relations and output templates."
4. Input condition: "clean pack shot, scene, partial object, annotated multi-view sheet, low resolution, technical document, spreadsheet or mixed batch."
5. Product role: "whether furniture or an accessory is the focal item."
6. Output package: "required images, views, lighting variants, details and exports. A set is not a single image."

### Side-by-side

| | A · Surgical replacement (controlled workflow) | B · One deployed agent (with backend rules) |
|---|---|---|
| Flow (SPEC) | "Client → intake API → immutable contract → durable state machine → specialist services → provider gateway → independent review → bounded correction → package release." (l.26) | "Client → backend/project record → ONE agent → image/catalogue/file tools → the SAME agent reviews and iterates → backend package checks → delivery." (l.36) |
| What decides the next action | "The code chooses the stages and permitted transitions." (l.28) "A typed state machine coordinates extraction, retrieval, planning, generation and review calls... No open-ended agent needed to schedule the stages." (FW.runtime "A runtime"). CTRL: for A `allowedActions` returns exactly one action, `[nextAction(job)]`. | "The single agent owns interpretation, planning, styling, tool use and review. The backend owns spending, credentials, persistence and contract checks." (l.38) "The single agent chooses and revises its plan; the backend enforces contract and cost limits." (role 7 B). CTRL: for B `allowedActions` = next action plus `inspect`, plus `revise_plan` in phase `planned`. |
| What is code | Stage graph, transitions, rule-based plan compiler, prompt/schema compiler, model registry, queue/worker/lease/outbox, package manifest, count/schema checks, budget. "Vision/reasoning models perform the perceptual or judgment tasks; rules validate their outputs and coordinate the next action." (l.28) | Backend only: "authenticate, persist_state, reserve_budget, store_receipts, validate_contract, check_package" (SAC.backend). "Deterministic backend rules check completeness and permissions; they are software, not another agent." (role 20 B) |
| What is model | Specialist model calls for evidence interpretation, conflict resolution, visual classification, composition design, rendering, image inspection (review), repair planning. "Complex interpretation is not reduced to a category dropdown." (l.28) | One agent (model + instructions + tools) does: "observe, interpret, reason, plan, style, operate, review, repair, deliver" (SAC.functions). Image models are tools: "imageModelCallsAreAdditionalAgents": false (SAC). |
| Review | "Separate structured vision-review invocation plus deterministic count/schema checks." (role 16 A). Called "independent review" in the flow line. | "A review is a later pass by the same agent comparing the actual image to the original and client intent. This is self-review and may repeat the same blind spots; it must not be described as independent critique. A separately deployed reviewer would be a future scope decision, not a hidden requirement of B." (l.38) SAC.review: actor "same agent", independent false, extraCritic "not included". |
| Strengths ("Advantages to test") | "predictable transitions, smaller context, inspectable cost bounds, stable recovery." (l.32) PAGE: "Best suited to evaluate first for repeatable jobs." | "adaptive inspection, nuanced ambiguity resolution, better composition exploration, targeted failure diagnosis." (l.46) |
| Risks | "brittle routing on novel inputs, cascading extraction errors, excess prewritten rules, model-call costs that remain substantial. Missing evidence routes to a richer assessment or hold; it must never default to a fabricated product." (l.32) | "more model turns, redundant searches, long context, looping, tool misuse and inconsistent planning. Every tool action crosses the same contract/budget supervisor as A." (l.46) Plus self-review blind spots (l.38). |
| Persistence / context | Structured database + immutable assets + append-only events + versioned retrieval (role 19 A). | "The agent receives a compact project index, current contract, remaining budget and references to authoritative records. Retrieve original files and the relevant styling/category skill on demand. Store concise decision reasons, evidence and tool actions; do not depend on private chain-of-thought. Session summaries are a cache and may be rebuilt from the project record." (l.42) |
| Environment | Server-only adapters with exact API/model IDs. | "Tool-only jobs do not inherently require a shell sandbox. Use isolated compute when image analysis, file manipulation or artifact assembly needs it. Mounted originals are read-only; outputs use job-scoped storage. The backend copies durable artifacts before compute ends. The browser and this desktop session must be unnecessary to advance the job." (l.44) |
| Cost economics (PAGE #economics) | "Cost comes from extraction, planning, catalogue retrieval, generation, critique and repairs. Narrow calls and stable routes may reduce overhead; that saving must be measured." | "Include the single agent's turns, context, tool calls and optional environment time. Better diagnosis or composition could avoid expensive rework; extra turns can also make it worse." |
| When to choose | No decision rule is given beyond: A "Best suited to evaluate first for repeatable jobs" (PAGE l.38). SPEC l.353: "A and B remain separately selectable for evaluation. A hybrid policy may later route proven routine cases to A and difficult composition/ambiguity to B, but it is a result to earn through comparison, not a substitution for either requested architecture." So the files say: choose by paired benchmark (build step 5), not a priori. | Same. B's UI line: "Replicate this assistant's complete working loop with one deployed agent." Inference: B suits ambiguity/composition-heavy jobs per the "Advantages to test" list. |

### B implementation constraints (SPEC l.40; SAC)
"one agent configuration/session owner, ordinary tools, saved state, zero agent handoffs, no agents-as-tools and no subagent spawning. An application-controlled SDK runtime or a managed harness may implement this. Runtime choice is not evidence of this account's access or image-quality equivalence. The downloadable single-agent-contract.json records this design; it is not a deployed API configuration."
SAC fields: schema "midas-single-agent-scope/v1", status "design contract, not deployed runtime configuration", agentCount 1, autonomousActor "Midas Studio Agent", handoffs [], subagentSpawning false, agentsAsTools false.
SAC tools (9): read_files, inspect_images, query_midas_catalogue, generate_image, get_operation, edit_image, upscale, save_project, assemble_package.
SAC backend (6): authenticate, persist_state, reserve_budget, store_receipts, validate_contract, check_package.
Note: SAC tool names differ from the SPEC "Agent tool contract" names (see section 12).

### "Roles are not agents" (FW.decisions; PAGE l.77-79)
"Eye, Brain, Stylist, Operator and Critique name functions of the same agent in B. Repeated model turns and image-generation tool calls do not imply additional autonomous agents."
Other decisions (FW.decisions): "A · Replace the work with services" ("Their proposed automation must be distinguished from previous assisted work"); "B · One agent, the whole job" ("No manager-plus-specialist team."); "Evidence is classified"; "Preserve the agreed scope".
SPEC l.13: "The previous manager-plus-specialist design was an assistant-added assumption. It has been superseded. The 21 responsibility headings are a design crosswalk, not 21 agents, case families or proven automated capabilities."
PAGE l.527: "These are logical responsibilities. They do not imply 21 models, 21 fixed steps or 21 always-running agents."

### Hybrid
SPEC l.353 (quoted above): hybrid "is a result to earn through comparison".

---

## 2. The six stages of A and the six views of B

Source: FW.stagesA and FW.stagesB, each entry = [name, description, receives, passes onward, return/hold]. UI shows them as "Receives / Passes onward / Return / hold". Artifacts-written lists are from SPEC role "Required artifact" fields and the SPEC proposed tables (marked inference where I assign them to a stage). The files give no per-stage "stop conditions" beyond the "Return / hold" field plus the global stop rules (section 4, five correction rules).

### Architecture A

| # | Stage | Description (verbatim) | Receives (inputs) | Passes onward (outputs) | Return / hold (gate, stop) | Roles (inference, from role scopes) | Artifacts written (SPEC role artifacts; inference on stage assignment) |
|---|---|---|---|---|---|---|---|
| 01 | Intake & observe | "Parse files, discover source conditions, extract role-tagged evidence, resolve selections and declare unknowns." | "Originals + client choices" | "Product card / observation contract" | "Critical identity ambiguity → evidence hold" | 2 Eye ingest, 3 recognize, 4 interpret signs, 5 preserve uncertainty, 6 scene & time | File hashes; page/crop coordinates; source roles; parsing limits; category candidates; selection map; insets vs physical pieces; observed vs verified colour; unknowns; object relations. CTRL: `observe` event needs `unknowns` array and non-empty `locks`; `criticalUnknown` → phase `held`. |
| 02 | Compile scope | "Combine category, role, source condition, requested output package, room locks and creative freedoms." | "Product card + taxonomy + templates" | "Versioned job contract" | "Conflicts → brief resolution before spending" | 1 Intent & scope, 7 Brain route, 8 modes, 9 semantic grounding | Brief version; requested vs excluded pieces; allowed changes; output package; lock/variable matrix; plan, dependencies, capability requirements. CTRL `createJob` is the contract validator. |
| 03 | Retrieve & style | "Retrieve genuine Midas products; filter functional fit, then compare coherent compositions." | "Job + catalogue + styling skill" | "Selected and rejected references; scene plan" | "Unsourced SKU or weak functional pairing → retrieve/replan" | 10 retrieve, 11 compose, 12 reverse role | Dated product URLs, SKU/image hashes, dimensions, availability; candidate boards, selected layout, rejected alternatives, functional rationale; hero prominence, complement list. CTRL `plan` event: `planId`, `reason`, `catalogueIds` all in contract's `catalogue` references, "Unsupported Midas catalogue claim" otherwise; `requireMidas` demands at least one. |
| 04 | Compile & dispatch | "Choose capability-tested provider, compile precise references and view, reserve cost and persist a claim." | "Locked plan + original refs" | "Provider operation and receipt" | "Unknown receipt → reconcile same operation" | 13 compile, 14 choose models, 15 execute | Exact prompt, reference order/roles, model/version, output format; model IDs, capability checks; operation key, claim, receipt, status, costs, timestamps, retry classification. CTRL `claim` (reserve budget), `receipt`, `uncertain`, `failure`. |
| 05 | Critique & correct | "Inspect source and candidate, check counts and identity first, style and placement next. Apply targeted repair." | "Candidate + originals + scene contract" | "Evidence-bearing review and repair plan" | "Repair → re-review; new regression → repair/hold; max two" | 16 assess, 17 repair (18 benchmark is evaluation, outside the live loop: inference) | Region-specific findings, severity, source comparison, unknowns and repair instruction; target regions, preserve list, previous defect resolution, new regressions. CTRL `review`. |
| 06 | Package & release | "Check all planned views, source alignment, dimensions and current reviews. Record approval policy." | "Reviewed outputs + package template" | "Deliverable manifest or explicit hold" | "Only validated automated policy can release unattended" | 20 Package & release (19 Vault and 21 Business operator span all stages) | Each required output verified; descriptive limits; release/hold reason. CTRL `release`. |

Group labels in CASES (a different grouping, "Six execution groups"): "01–06 Understand → 07–09 Decide → 10–12 Style → 13–15 Generate ↔ 16–18 Review → 19–21 Record & deliver". CASES note: "These groups organise the responsibilities. They do not mean 21 sequential model calls. Memory and cost tracking span the job; repair returns to generation and review."

### Architecture B (six views; same agent in every one)

| # | View | Description (verbatim) | Receives | Passes onward | Return / hold |
|---|---|---|---|---|---|
| 01 | Load project | "One agent loads the job, sources, styling skill and current saved state." | "Project record + original references" | "One agent session with a versioned brief" | "Missing or contradictory evidence is recorded" |
| 02 | Observe & reason | "The same agent interprets items, signs, counts, functions and unknowns, then chooses a plan." | "Originals + client scope" | "Observation and plan from the same agent" | "Inspect references again when uncertain" |
| 03 | Style & compose | "The same agent selects genuine Midas companions and develops the requested look." | "Product role + catalogue evidence + styling skill" | "Source-backed scene direction" | "Revisit unsuitable pairings without changing the product" |
| 04 | Generate through tools | "The same agent calls Magnific or another supported image service; backend stores the operation." | "Image task + allowed references" | "Provider receipt + generated candidate" | "Reconcile an uncertain receipt before any repeat" |
| 05 | Review & iterate | "The same agent compares the actual image with the originals and asks the tool for corrections." | "Candidate + source locks + requested look" | "Self-review findings and targeted correction" | "Repeat within limits; self-review is not independent validation" |
| 06 | Save & deliver | "The same agent assembles all required views and descriptions. Backend enforces completeness." | "Reviewed output set + saved evidence" | "Complete package or an explicit unresolved issue" | "No specialist handoff or second critic agent" |

B tool surface per SPEC "Agent tool contract" (l.281-290) is in section 5. B stage-to-tool mapping is inference: 01 read_contract; 02 inspect_reference; 03 query_catalogue + propose_plan; 04 compile_render + request_render + get_operation; 05 record_review + propose_repair; 06 assemble_package.

Note on the "12 stages" phrase: BROWSER says "Both architectures: all 12 stage details" = 6 A + 6 B. This is not the same "12" as the 12-state trace in section 4.

---

## 3. The 21 roles (complete table; count found = 21)

Count check: FW.roles has 21 entries, ids 1 to 21; MANIFEST.roles = 21; PAGE shows "21 design responsibilities" (l.209); SPEC has headings 1 to 21. Names are exactly as below.

Columns: "Replaces" = FW.historicalBasis (what the assistant/operator actually did before; quoted) + the role scope. "Inputs/Outputs" = scope text and Required artifact. "Code / model / human" = my classification from the A-design wording (inference, except where quoted). "Gate" = FW.gate verbatim. "Depends on" = inference from the artifacts chain unless quoted. "Group" = CASES execution group (quoted); "A stage" = my inference.

Evidence-status vocabulary used by FW: "Assisted work evidenced", "Partial evidence", "Proposed automation", "Assisted/software evidence", "Proposed evaluation". Only roles 7, 9, 18 are purely proposed. No role is "automated in production".

### Roles 1 to 7

**1 · Intent & scope** (group Understand; A stage 02)
- Scope: "Convert the client's selected project, job, outputs and changes into a versioned brief. A product can be hero or supporting; input type and item category are separate variables."
- Replaces: "Repeated explicit user directions and retained job prompts." Evidence: Assisted work evidenced.
- A: "Typed intake compiler + conflict-resolution model call." B: "The single agent reads the brief and resolves scope conflicts against user intent and source evidence."
- Output artifact: "Brief version; requested vs excluded pieces; allowed changes; output package."
- Code/model/human: code (typed compiler) + model (conflict resolution); the client/owner is the source of intent (inference).
- Gate: "Do not let a prompt or vendor caption override the user's selected count."
- Depends on: client intake; feeds 2-8, 20 (inference).

**2 · Eye · ingest** (Understand; stage 01)
- Scope: "Read every file and page, distinguish images, spec sheets, spreadsheet facts and customer room evidence."
- Replaces: "Images and vendor-sheet interpretation evidenced. Broad PDF/Excel-to-generation ingestion has no executed proof in this registry." Partial evidence.
- A: "File parsers, image decoding, OCR and vision calls behind a stable observation schema." B: "The same agent reads the relevant images, pages and available metadata through tools; no separate perception agent."
- Artifact: "File hashes; page/crop coordinates; source roles; parsing limits."
- Code/model: code (parsers, hashing) + model (OCR/vision).
- Gate: "A filename or collage is insufficient evidence of the physical inventory."
- Depends on: 1 (what files/roles were declared); feeds 3-6, 19.

**3 · Eye · recognize** (Understand; 01)
- Scope: "Identify item, category, part, set and practical function; retain alternative hypotheses when necessary."
- Replaces: "Towel, robe, bookends, box and tableware records; inference is not specification certification." Assisted work evidenced.
- A: "Taxonomy matcher + visual classifier; uncertainty routes to a richer perception call." B: "The same agent infers category and function, states its evidence, and retains unresolved alternatives."
- Artifact: "Category candidates; confidence basis; resolved and unresolved ambiguity."
- Code/model: code (taxonomy matcher) + model (visual classifier).
- Gate: "Towel texture/borders support an inference; they do not prove fibre composition."
- Depends on: 2; feeds 5, 7, 9.

**4 · Eye · interpret signs** (Understand; 01)
- Scope: "Read arrows, crosses, circles, BODY FAB, PILLOW FAB, swatches and dimensions as evidence with explicit roles."
- Replaces: "Chair table-exclusion mark, fabric/wood sheet roles, open/closed insets." Assisted work evidenced.
- A: "Region detection + relation extraction + intent precedence rules." B: "The same agent interprets signs, swatches and inset relationships in the original reference."
- Artifact: "Selection map; insets vs physical pieces; observed specification text."
- Code/model: model/CV (region detection, relation extraction) + code (precedence rules). Inference on split.
- Gate: "Crossed table excluded; open-box inset is not a second box."
- Depends on: 2 (+ 1 for user intent precedence); feeds 1/8 (counts and exclusions), 16.

**5 · Eye · preserve uncertainty** (Understand; 01)
- Scope: "Separate visible facts, supplied specifications, derived measurements and inferred hypotheses."
- Replaces: "Recorded material/colour limits and partial-bed/side-view limitations." Assisted work evidenced.
- A: "Typed evidence fields and a critical-unknown gate." B: "The same agent distinguishes observation, supplied fact and inference; missing details stay unknown."
- Artifact: "Observed colour vs verified code; material appearance vs composition; unknowns."
- Code/model: code (typed fields; gate; CTRL `criticalUnknown` → `held`) with model-supplied observations.
- Gate: "A crop cannot establish the unseen bed base or turn a guessed side view into a product fact."
- Depends on: 2, 3, 4; blocks 7 until resolved (CTRL: observe must precede plan).

**6 · Eye · scene & time** (Understand; 01 and 05)
- Scope: "Understand supports, contacts, occlusion, reflections, lighting and changes across revisions or views."
- Replaces: "Placement/reflection and revision comparisons recorded; no verified automated scene-graph or video-time pipeline." Partial evidence.
- A: "Scene graph extraction and correspondence checks against reference roles." B: "The same agent compares spatial relations and revisions. Automated scene graphs and temporal-video understanding are not proven by these examples."
- Artifact: "Object relations, evidence regions, change log, view coverage."
- Code/model: model (scene graph extraction) + code (correspondence checks). Proposed.
- Gate: "2D boxes alone do not prove 3D fit. Temporal reasoning applies only when sequential evidence exists."
- Depends on: 2; feeds 11, 16, 17.

**7 · Brain · route** (Decide; 02, 04)
- Scope: "Select operations from input condition × category × role × output × room × permitted change."
- Replaces: "Human/assistant routing exists; a full autonomous plan compiler has not passed these cases." Proposed automation.
- A: "Rule-based plan compiler chooses a graph from capability-tested operations." B: "The single agent chooses and revises its plan; the backend enforces contract and cost limits."
- Artifact: "Plan, dependencies, capability requirements, concise decision reasons."
- Code/model: code (rule-based compiler) in A; model in B with code limits.
- Gate: "The product taxonomy does not mean hundreds of unrelated hard-coded workflows."
- Depends on: 1, 3, 5, 8, 14 (capability list); feeds 10-15.

### Roles 8 to 14

**8 · Brain · modes** (Decide; 02)
- Scope: "Keep identity and requested room locks strict while allowing declared creative variables."
- Replaces: "Room locks, cover-only colour changes and full lifestyle requests." Assisted work evidenced.
- A: "Two explicit policy modes: fidelity-locked and creative-room, independent of architecture A/B." B: "The same agent changes only explicitly unlocked scene variables while preserving product and room constraints."
- Artifact: "Lock/variable matrix and user-authorized overrides."
- Code/model: code (policy mode switch); model must obey in B.
- Gate: "Creative room freedom never silently changes the hero SKU or exact counts."
- Depends on: 1, 4, 5; feeds 7, 11, 13, 16.

**9 · Brain · semantic grounding** (Decide; 02/03)
- Scope: "Connect objects to functions, materials, categories, source provenance and relations."
- Replaces: "Source references and some structured cards exist; no proven dynamic knowledge-graph/Visual-RAG runtime." Proposed automation.
- A: "Versioned ontology and relational graph; retrieval uses metadata and visual similarity when implemented." B: "The single agent consults source-backed records. A deployed knowledge graph or automated Visual RAG is a proposed addition, not proven previous execution."
- Artifact: "SKU → reference → material claim → scene role → supporting object."
- Code/model: data + code (ontology/graph); similarity may use a model. Proposed.
- Gate: "A named knowledge graph is not deployed merely because a prompt mentions it."
- Depends on: 3, 10, 19. (SPEC l.273: "A separate graph database is optional, not a prerequisite to semantic relationships.")

**10 · Stylist · retrieve** (Style; 03)
- Scope: "Find genuine Midas companions by function, size, colour, material, availability and context."
- Replaces: "11 curated genuine Midas products and three style selections; not complete-catalogue optimization." Assisted work evidenced.
- A: "Catalogue indexing and retrieval service; hard filters before visual ranking." B: "The same agent browses or queries genuine Midas references and records selections. No separate catalogue/stylist agent is required."
- Artifact: "Dated product URLs, SKU/image hashes, dimensions, availability when checked."
- Code/model: code (index, hard filters) then visual ranking (model/embedding, inference).
- Gate: "No generic lamp may be labelled Midas without its source reference."
- Depends on: 7, 9; feeds 11. CTRL enforces: catalogue ids must be in contract's catalogue refs.

**11 · Stylist · compose** (Style; 03)
- Scope: "Build coherent alternatives with focal hierarchy, palette, spacing, surfaces, lighting and circulation."
- Replaces: "Three sofa moods and recorded repair iterations. No automated pre-render ranking benchmark." Assisted work evidenced.
- A: "Structured scene proposals; composition evaluator ranks candidates before rendering." B: "The same agent performs the stylist function: compares layouts, palette, scale and lighting and explains the selected composition."
- Artifact: "Candidate boards, selected layout, rejected alternatives, functional rationale."
- Code/model: model (proposals) + evaluator (code or model, unstated).
- Gate: ""Best" means best supported among compared candidates, never the whole catalogue without a search."
- Depends on: 8, 10, 12; feeds 13. Uses the "Styling loop" (default up to three boards).

**12 · Stylist · reverse role** (Style; 03, parameter set at 02)
- Scope: "Build a room around a small accessory, textile or table just as around a sofa."
- Replaces: "Nesting tables as hero versus sofa support; accessory-led placements." Assisted work evidenced.
- A: "Hero/support relation is a parameter in the same scene planner." B: "The same agent makes the accessory the focal product and selects suitable supporting furniture."
- Artifact: "Hero prominence; complement list; close-up and wide-view requirements."
- Code/model: code parameter in planner.
- Gate: "Bookends need books and support; napkin rings need credible table use."
- Depends on: 1 (hero/support role), 10, 11.

**13 · Engine · compile** (Generate; 04)
- Scope: "Compile the source roles, locks, scene map and requested view into provider-specific instructions."
- Replaces: "Retained prompts and existing compile paths; not proof every proposed format is integrated." Assisted/software evidence.
- A: "Prompt/schema compiler and adapter capability checks." B: "The same agent prepares the image task and invokes the generation tool through the backend."
- Artifact: "Exact prompt, reference order/roles, model/version, output format."
- Code/model: code (compiler, capability checks); in B model-written.
- Gate: "A uniform target quality does not justify the same prompt for a towel and 12-chair dining set."
- Depends on: 2, 4, 8, 11, 14; feeds 15.

**14 · Engine · choose models** (Generate; 04)
- Scope: "Use reasoning, vision, generation and upscale models according to demonstrated task capability."
- Replaces: "Recorded provider model IDs and some model changes; four no-output comparison failures cannot establish a winner." Partial evidence.
- A: "Per-task model registry selected by measured quality, cost and limits." B: "The same agent chooses among supported image tools/models. Calling an image model does not create another autonomous agent."
- Artifact: "Model IDs; capability checks; benchmark evidence; fallback reason."
- Code/model: code (registry); entries need benchmark evidence from role 18 (inference).
- Gate: "Multiple roles need not mean different model families; comparisons need actual outputs."
- Depends on: 18 (benchmark evidence); feeds 7, 13. SPEC table "model_registry (capability evidence and pricing effective date)".

### Roles 15 to 21

**15 · Operator · execute** (Generate; 04, spans recovery)
- Scope: "Run background tasks, persist receipts, survive browser closure and recover without duplicate paid calls."
- Replaces: "Saved receipts and recovery code; full autonomous restart/recovery across all stages remains unproved." Partial evidence. (ATLAS: Operator "Attached references, wrote and submitted prompts, chose tools/models, checked run status, retained candidates and exported files.")
- A: "Durable queue + worker + transactional lease/outbox + provider receipt reconciliation." B: "The same agent issues and follows tool calls; the backend stores state, receipts and retries."
- Artifact: "Operation key, claim, receipt, status, costs, timestamps and retry classification."
- Code/model: code only (A); in B the agent issues calls, code owns state.
- Gate: "Polling a UI or reopening chat is not an unattended background runtime."
- Depends on: 13, 14, 19; feeds 16, 21.

**16 · Critique · assess** (Review; 05)
- Scope: "Inspect actual originals and outputs for inventory, identity, geometry, details, appearance, placement, lighting and composition."
- Replaces: "Assistant reviews and conditional structured-review code. No independent critic agent shown in the prior image workflow." Assisted/software evidence.
- A: "Separate structured vision-review invocation plus deterministic count/schema checks." B: "The same agent reviews the actual output against original references in a separate review pass. This is self-review, not an independent critic agent."
- Artifact: "Region-specific findings, severity, source comparison, unknowns and repair instruction."
- Code/model: model (vision review) + code (counts, schema; CTRL review validation).
- Gate: "A high aesthetic score cannot override a missing chair or changed fabric." (TEST: "Fidelity 99 cannot override wrong physical count".)
- Depends on: 2, 4, 5, 15 (candidate), 19; feeds 17, 20. The seven check names are in CTRL: inventory, geometry, details, appearance, placement, lighting, composition.

**17 · Critique · repair** (Review; 05)
- Scope: "Identify the smallest safe correction; preserve correct features and recheck regressions."
- Replaces: "Centre-table, sofa and bed repair histories; automatic repair controller is a local fixture." Assisted work evidenced.
- A: "Bounded controller selects local edit, fresh render from originals, or hold." B: "The same agent diagnoses defects, requests targeted changes, rechecks identity and stops at the agreed limit."
- Artifact: "Target regions, preserve list, previous defect resolution, new regressions."
- Code/model: code (controller limit) + model (repair prompt, preserve list).
- Gate: "Two image repairs maximum by current policy; exhausted or non-improving loops hold."
- Depends on: 16, 15, 13. CTRL: repair claim consumes a repair; "Targeted repair and preserved features required".

**18 · Critique · benchmark** (Review; evaluation loop, not in the live job path: inference)
- Scope: "Separate visual assessment from measured acceptance; calibrate against owner-reviewed examples."
- Replaces: "No calibrated, blinded, repeated A/B quality benchmark completed." Proposed evaluation.
- A: "Fixed evaluation corpus and versioned graders; paired runs with actual provider receipts." B: "The same agent records observations. A calibrated benchmark is future evaluation work and cannot be claimed from self-review."
- Artifact: "Case-level results, false approvals, acceptance, cost and latency per complete package."
- Code/model/human: human (owner-reviewed anchors; "blinded evaluators", SPEC l.338) + versioned graders.
- Gate: "Historical subjective 90–95 scores do not establish calibrated ≥95% fidelity."
- Depends on: 16, 21; feeds 14.

**19 · Vault · memory** (Record & deliver; spans all)
- Scope: "Keep the product and project authoritative across restarts, agents and new chats."
- Replaces: "Saved source/scene records exist; complete production memory consolidation remains proposed." Partial evidence.
- A: "Structured database + immutable assets + append-only events + versioned retrieval." B: "One agent reloads the project record and current state; no team handoff is part of this scope."
- Artifact: "Product card, scene card, plan, provenance, attempts, review and release record."
- Code/model: code/data only.
- Gate: "The chat history is not the studio's durable memory."
- Depends on: every role writes to it.

**20 · Package & release** (Record & deliver; 06)
- Scope: "Deliver the requested catalogue, lifestyle, alternative view, detail and upscale set with matching metadata."
- Replaces: "Multi-view/upscale deliveries and export logic; package-wide autonomous release unproved." Assisted/software evidence. (ATLAS: "Release: I package and state limitations; owner decides.")
- A: "Package manifest + checksums/dimensions + current review gates + release policy." B: "The same agent assembles the requested package. Deterministic backend rules check completeness and permissions; they are software, not another agent."
- Artifact: "Each required output verified; descriptive limits; release/hold reason."
- Code/model/human: code (manifest, gates); human (owner) when policy is `review_only`.
- Gate: "One attractive image is not completion of a bed, table or set's image package."
- Depends on: 16 (current reviews), 1 (output package), 19.

**21 · Business operator** (Record & deliver; spans all)
- Scope: "Reduce client effort, cost and elapsed time per accepted complete package."
- Replaces: "Some provider credits/timestamps retained; complete accepted-package economics not measured." Partial evidence.
- A: "Queue scheduling, bounded retries, caching valid results and package-level metrics." B: "Measure the single agent's inference, tools, image calls, runtime and rework against cost per accepted complete package."
- Artifact: "Accepted-package cost; human active time; p50/p95 latency; repeat-work rate."
- Code/model: code (scheduler, metrics).
- Gate: "Higher agent spending is not automatically better; compare total accepted-output economics."
- Depends on: 15, 16, 20.

Tally of evidence status: Assisted work evidenced = 1, 3, 4, 5, 8, 10, 11, 12, 17 (9 roles); Partial evidence = 2, 6, 14, 15, 19, 21 (6); Proposed automation = 7, 9 (2); Assisted/software evidence = 13, 16, 20 (3); Proposed evaluation = 18 (1). Total 21.

---

## 4. Loops and the controller

### The five recursive loops (PAGE "Five distinct recursive loops" l.732-751; FW.loops; SPEC l.300-320)

| Loop | Verbatim definition | Trigger | Re-observes | Max iterations / budget | Stop rules | Invariants | When to implement / use |
|---|---|---|---|---|---|---|---|
| Evidence loop | "Observation → conflicting/missing identity evidence → inspect original or retrieve verified facts → update evidence basis → re-evaluate. Hidden geometry stays unknown. No endless rendering to answer a missing specification." | Conflicting or missing identity evidence (CTRL: `criticalUnknown` on observe) | The original (`inspect_reference`) or verified catalogue facts | No numeric cap stated. CTRL: B `inspect` is an `agent_action` that costs budget and counts against `maxActions` (≤ 200); in A the `held` phase is terminal (nextAction `stop`). | Critical identity unknown → hold ("Critical identity/selection unknown; obtain evidence, do not invent it", CTRL). "stop on critical missing evidence" (rule 5). Hidden geometry stays unknown. | Original hashes and roles; no invented product. | Build step 1 "Contract foundation" (SPEC l.346): "partial/inset/count cases produce defensible contracts". Use at stage 01 before any spend (inference: ties to gate "Critical identity ambiguity → evidence hold"). |
| Styling loop | "Functional brief → Midas shortlist → compare palettes/scale/composition → reject unsuitable combinations → chosen scene. Proposed default: up to three boards before rendering; adjustable within budget." | A brief needing a composed scene; "Compare alternatives when the job calls for them, recording reasons." (SPEC l.326) | Palette, scale, composition, functional pairing against the shortlist | "up to three boards before rendering; adjustable within budget." SPEC l.326: "A universal three-board requirement was an assistant proposal, not an agreed or executed default." | Unsuitable pairing rejected; "Unsourced SKU or weak functional pairing → retrieve/replan"; B: "Revisit unsuitable pairings without changing the product" | Product unchanged; only genuine sourced Midas items labelled Midas; "Generic contextual books/rugs/plants must be marked as context." (SPEC l.328) | Stage 03 "Retrieve & style". No build-sequence step names it: it is proposed; inference: with step 3 (A vertical slice) as a minimal single-board version first. |
| Image loop | "Render tool → same-agent review in B (review service in A) → targeted repair → review again against originals and previously correct regions → accept or hold. The B review is not independent." | A candidate with a defect from the seven checks or a count mismatch | Original references plus previously correct (protected) regions; "Recheck all locks" | "Two image repairs maximum by current policy; exhausted or non-improving loops hold." (role 17). CTRL: `maxRepairs` 0 to 2 per output (counter resets after each output approval); `maxActions` ≤ 200; `budgetUnits` > 0. | Five correction rules (below); review `unknown` → hold; repairs exhausted with defects → hold ("Repair limit reached with unresolved defects"); overcharge → hold. | "preserve the original identity reference on every attempt"; reviewed regions; counts. | Step 2 "Provider proof" (one generation adapter + one server-readable critic) then step 3 "Durable A vertical slice" (render → critique → repair → full package). |
| Recovery loop | "Claim → submission → missing receipt → reconciliation of the saved operation. Do not repeat the paid call unless the provider authoritatively confirms it never started and the idempotency policy permits retry." | Missing/unknown receipt after claim | The saved operation (same operation ID) with the provider | No retry unless authoritatively confirmed never started; reservation kept. CTRL: reservation stays; only `receipt` or `failure` for that exact `operationId` resolves. | "Lost receipts retain reservations until reconciled; they are not refunded merely because the client timed out. Confirmed failures retain their charges and never count as quality comparisons." (SPEC l.275) | One unresolved operation at a time (CTRL: "An operation is already unresolved"). | Step 3 "Durable A vertical slice": "continuing with browser closed and after a worker restart. Acceptance: no chat intervention, no duplicate paid calls". Also step 2 receipts. |
| Proposed evaluation loop | "Future work: freeze inputs, perform paired A/B runs, assess outputs against agreed examples, measure quality and cost, then revise. This protocol was not executed by the historical image runs." | Decision to compare A vs B or models | Frozen inputs, unseen-SKU holdout, repeated difficult subset | Not specified ("Repeat a stratified difficult subset to estimate variability") | Stage 1 same renderer; stage 2 change one provider/model at a time; no self-score alone | Same inputs/references/deliverables for A and B | Step 5 "Paired benchmark" (after A slice and B execution). Not part of runtime job path. |

### Five correction rules (SPEC l.322, verbatim)
"preserve the original identity reference on every attempt; repair only named defects; compare unaffected protected regions again; reject new regressions; stop on critical missing evidence, exhausted repair/action/time/cost limits or contradictory authority. If a defective candidate keeps transmitting bad geometry, discard it as identity conditioning and return to originals. A model change and reference change in the same attempt cannot isolate which caused improvement."

### ATLAS description of the recursive loop (workflow-pipelines.txt l.1933-1990, outside assigned list)
Steps: "Observe against source → Classify defect → Target one correction → Generate candidate → Recheck all locks ↺".
Invariant list: "Original reference hashes and roles; rejected images stay rejected. / Unaffected product parts, selected room, accepted inventory and explicit user decisions. / Case-specific checks on every candidate, including features the repair was not meant to change."
Stop list: "No image / uncertain receipt: reconcile execution before any duplicate launch. / Missing source evidence: hold the claim, request an input or label the output illustrative. / Repeated defect or exhausted repair budget: hold and change evidence/method rather than loop indefinitely. / Passing a visual check produces a reviewed candidate; owner approval and complete package checks remain separate."
ATLAS: "The local decision function has a two-repair limit. These actual histories include bounded three-candidate sequences, but no live autonomous correction controller is established by them."

### Controller states (CTRL), read from source and verified by executing it on a copy
Phases (11): `intake`, `observed`, `planned`, `submitted`, `uncertain`, `reviewing`, `repairable`, `package`, `held`, `released`, `review_ready`.
`nextAction` map: intake→observe, observed→plan, planned→render, reviewing→review, repairable→repair, package→release, uncertain→reconcile, submitted→poll, held→stop, released→stop, review_ready→stop.
Event types (10): `observe`, `plan`, `claim`, `uncertain`, `receipt`, `failure`, `review`, `release`, `agent_action` (B only), plus the duplicate-ID short circuit.
`checks` (7): inventory, geometry, details, appearance, placement, lighting, composition.
Reference roles allowed: original, room, catalogue, composition. Output scopes: whole, detail.
Release policies: `review_only` | `validated_automatic`.

### The 12-state trace (default scenario "Defect repaired; wide + detail complete", architecture A; PAGE l.674-697; confirmed by running CTRL)

| # | Phase (state) | Event · revision | Meaning (UI `explanations` text, quoted/condensed) | Revision / budget semantics |
|---|---|---|---|---|
| 1 | observed | observe · rev 1 | "The fixture supplied an observation with identity locks and explicit unknowns. This is a synthetic observation, not a vision inference." | Needs `contractStamp`, `unknowns` array, ≥1 `locks`. `criticalUnknown` → `held` instead. |
| 2 | planned | plan · rev 2 | "The plan names catalogue references already in the contract. A new or invented SKU is rejected. Architecture B may inspect or revise a plan before any output is approved." | Needs `planId`, `reason`, `catalogueIds` ⊆ contract catalogue refs; blocked once any output is approved ("A package plan change requires a new version and re-review"). |
| 3 | submitted | claim · rev 3 | "A provider operation is claimed and its cost reserved before dispatch. This lab records the claim; it does not submit to a provider." | Reserve 10 units; spent 0, reserved 10, actions 1. Needs `reserve` > 0 and spent+reserved+reserve ≤ budget; one unresolved operation only. |
| 4 | reviewing | receipt · rev 4 | "The candidate now has a matching receipt, model label and hash. A review must match that candidate, source contract, plan and requested view." | Needs `providerReceipt`, 64-hex `candidateHash`, `model`, actual `cost`. spent 10, reserved 0. If spent > budget → `held`. |
| 5 | repairable | review · rev 5 | "A visible defect was declared. Correct it while preserving protected features. The next review must resolve previous issues and check for new regressions." | Fixture: placement fail ("Simulated floating bookend"). Requires `repairPrompt` + non-empty `preserve`. |
| 6 | submitted | claim (repair) · rev 6 | as 3 | repairs 1/2; reserved 10; actions 2 |
| 7 | reviewing | receipt · rev 7 | as 4 | spent 20 |
| 8 | planned | review · rev 8 | output "wide" approved, `repairs` reset to 0, `current` → "detail", phase back to `planned` | approved {wide: candidateHash, reviewId, planId} |
| 9 | submitted | claim · rev 9 | as 3 | actions 3 |
| 10 | reviewing | receipt · rev 10 | as 4 | spent 30 |
| 11 | package | review · rev 11 | "Every requested output now has a current accepted review. Package completion is a separate state from a single-image pass." | both outputs approved |
| 12 | review_ready | release · rev 12 | "The complete fixture package is ready for review. This lab contract does not have a validated automatic-release policy." | `released` only if `releasePolicy === 'validated_automatic'` AND `productionValidated === true`; else `review_ready`. |

Note: the task wording "observe → plan → claim → receipt → review → ... → release" matches the Event column. Fixture numbers: contract `synthetic-bookends`, `lab-v1`, outputs `wide` (whole, inventory bookend-pieces ×2) and `detail` (detail, visible-bookend ×1), maxRepairs 2, maxActions 20, budgetUnits 100, requireMidas true, releasePolicy review_only. UI: "The fixture uses abstract cost units and a review-only release policy."

### Revision semantics (CTRL)
- Every accepted event goes through `record()`: `revision++`, appends to `events` with `{id,type,revision,phase,reason,payload}`. State is immutable (structuredClone copies).
- Every event must carry `expectedRevision === job.revision` ("Concurrent or stale write"). Agent proposals carry `revision` and `contractStamp` ("Stale proposal", "Wrong contract").
- Idempotency: an event with an already-seen `id` and identical JSON payload returns the same job (no new revision); a different payload with the same id → "Event ID conflict".
- `contractStamp` = `JSON.stringify(contract)`; any mutation → "Contract was mutated; create a new version". SPEC l.359: "Its contractStamp is an exact JSON equality guard, not a cryptographic signature."
- `commit(store, id, event)`: read, transition, then `store.compareAndSwap(id, previous.revision, next)`; failure → "Concurrent write lost; reload before dispatch".
- Reviews are bound to `contractStamp`, `candidateHash`, `planId`, `scope`, `reviewer` and `receipt`; each of the 7 checks exactly once with status pass/fail/unknown and evidence; inventory covers every contracted item; `visible` is an integer or null (null → unknown → hold); `resolvedIssueIds` must clear prior issues; `regressions` array required.
- `uncertain` event only from `submitted` with matching operation; keeps reservation; "never resubmit automatically".
- `failure` event: needs `providerReceipt` and a charge; → `held`; "Provider failure retained; no generated quality comparison".
- B only: `agent_action` with `inspect` or `revise_plan`, costs charged, counted in actions; "No direct generation or release through agent_action".

### The eight A/B control scenarios (UI scenarios: "Defect repaired; wide + detail complete", "Critical evidence missing", "Provider receipt uncertain", "Two repairs exhausted")
Executed `runFixture` locally (no network). Traces (phase list):
- A repair (12): observed, planned, submitted, reviewing, repairable, submitted, reviewing, planned, submitted, reviewing, package, review_ready. Cost 30 units.
- B repair (13): same plus an extra `agent_action inspect` (cost 2) after plan; total spent 32.
- unknown (A and B, 1 each): observed event → `held`, holdReason "Critical identity/selection unknown; obtain evidence, do not invent it". No spend.
- uncertain A (4): observed, planned, submitted, uncertain (reservation 10 kept, spent 0). B (5): extra inspect (spent 2).
- exhausted A (11): ... repairable (repairs 1), submitted (repairs 2), reviewing, held "Repair limit reached with unresolved defects". Spent 30. B (12): spent 32.

---

## 5. Agent and backend runtime (#runtime)

### Diagram (PAGE l.561-577)
"Client (Brief + progress + delivery) ↔ Application server (Identity + contract + tools) ↔ Agent runtime (ONE agent · all functions) ↔ Provider gateway (Magnific / verified APIs)". "Persistent outside the agent: Vault, Originals in object storage, Operation ledger, Review fingerprints, Release controller". Heading "ARCHITECTURE B · BACKEND OWNERSHIP / The agent needs a working environment. Its plan is adaptive. Its access, budget and authority are explicit."

### Runtime components (FW.runtime, quoted)
- Client / existing Site: "Owner-scoped intake, uploads, saved projects, progress and delivery. Current /client-first-page remains an interactive preview until submission is connected."
- Shared backend: "D1 records and R2 assets are present in this Site. Add job contracts, atomic claims/outbox, operation receipts, immutable reference versions and package manifests. Current recovery and review code are reusable pieces."
- Durable worker: "Choose and provision a supported queue/worker or durable orchestration service. It owns wake-ups and retries when the browser closes; confirm its binding and delivery semantics on the hosting platform. Not provisioned by this architecture page."
- A runtime: "A typed state machine coordinates extraction, retrieval, planning, generation and review calls. Server-only adapters use exact supported API/model IDs. No open-ended agent needed to schedule the stages."
- B runtime: "Exactly one persistent reasoning agent with tools and saved project state. No handoffs, agent-as-tool specialists or subagent spawning. Runtime/API choice remains an implementation decision requiring account and execution proof."
- B environment: "Image inspection and catalogue/API tools can start without a shell environment. Add an isolated sandbox only for scripts, image analysis, export or document assembly. Mount job-scoped originals read-only and write artifacts to a separate path; preserve artifacts outside ephemeral compute."
- Provider gateway: "Magnific remains a render/upscale worker through the supported connection; OpenRouter can route verified vision/reasoning models; fal needs a generation adapter. A verified account/key is not a tested workflow."
- Review and credentials: "In B the same agent performs the review pass and records evidence. Backend code validates schema, ownership, limits and package completeness. A separate critic model/agent would be an optional scope change, not part of this baseline."

### What the single-agent request means (PAGE l.610-614)
"A separately deployed reasoning capability supplied with the project's files, styling skill, tools and authoritative memory. It does not reuse this desktop chat as a backend or assume that my current connectors are website credentials. One agent reads, interprets, reasons, styles, calls generation tools, reviews the returned images, requests corrections and delivers. Eye, Brain, Stylist, Operator and Critique describe its functions. Its self-review is not independent validation. No separate specialist agent or handoff is included."

### Concise runtime instruction for the agent (PAGE l.621-623)
"Deliver the contracted Midas image package. Load originals and relevant project records. Interpret evidence, propose a coherent source-backed design, operate approved tools, inspect actual outputs and correct named defects within limits. Persist concise evidence and decisions. Escalate missing identity evidence; never rewrite it as certainty. Load focused skills as needed. Do not rely on a transcript dump or private reasoning as durable memory."

### Backend interfaces (SPEC l.262-271): "proposed versioned contracts, not currently active endpoints"

| Boundary | Input | Output / control |
|---|---|---|
| POST /api/studio/v2/jobs | Owner identity, idempotency key, brief, file IDs, category, role, package, limits | Job ID and contract version; same key returns the same request |
| GET /api/studio/v2/jobs/:id | Owner-scoped job ID | Progress and release/hold reason; polling is not the execution engine |
| POST /internal/jobs/:id/advance | Authenticated worker, expected revision, action | Atomic next state, queued operation or rejection |
| POST /internal/provider-events | Verified provider event, operation ID | Deduplicated receipt/status; provider event cannot self-approve quality |
| POST /internal/agent-tools | Signed run identity, job ID, contract version, typed tool arguments | Authorized tool result with provenance or explicit denied/unknown |
| POST /api/studio/v2/jobs/:id/revision | User steering plus current version | New contract; invalidate affected plans/reviews; preserve historical outputs |

### Persistence (SPEC l.273)
Proposed tables: "jobs (owner, version, state, lease); references (role, hash, authority); item_facts (value, basis, evidence region); plans (contract/skill/catalogue versions); operations (idempotency key, claim, receipt, charge); events (sequence, expected revision, actor); candidates (original lineage, model, hash); reviews (candidate/source/plan fingerprint); packages (required outputs and release policy); model_registry (capability evidence and pricing effective date). Assets belong in R2; verified metadata and relationships in D1 or an equivalent transactional store. A separate graph database is optional, not a prerequisite to semantic relationships."

### Idempotency, claims, receipts (SPEC l.275)
"Atomic claim and outbox commit must precede external dispatch. Compare-and-swap versioning prevents two workers issuing the same operation. Exactly-once execution is not presumed: deduplicate locally and reconcile with provider IDs/idempotency capabilities. Lost receipts retain reservations until reconciled; they are not refunded merely because the client timed out. Confirmed failures retain their charges and never count as quality comparisons."

### Required provider capabilities (SPEC l.277)
"actual supported multi-reference roles/limits; image output retrieval; server-readable vision JSON; provider operation status; image edit/mask support where promised; background task wake-up; webhook authentication or authenticated polling; upload ownership and secret handling. Unsupported capability rejects the plan before dispatch. Browser automation or undocumented UI internals are not the default production adapter."

### Agent tool contract (SPEC l.281-290), verbatim list
- read_contract(job_id, version): read-only authoritative state and remaining limits.
- inspect_reference(reference_id, region): source bytes/crop with coordinates and hash; never manufacture missing detail.
- query_catalogue(filters, visual_query): verified SKU/image facts, dated availability, candidates and reasons.
- propose_plan(contract_version, scene_map, output_dependencies): validate and persist a proposed plan, not mutate originals.
- compile_render(output_id, plan_id): exact identity sources, supporting refs, view and model capability requirements.
- request_render(compiled_task_id): reserve, claim and enqueue; return operation ID, not a free-form promise.
- get_operation(operation_id): read/reconcile only; no silent second generation.
- record_review(candidate_id, contract_version, findings): save the same agent's evidence-bearing review in B; a review service remains part of proposed A.
- propose_repair(candidate_id, defects, preserve, target_regions): controller checks limits; unsupported masks become explicit limitations.
- assemble_package(job_id): verify manifest and current reviews. request_release never overrides the server gate.

Privileges (SPEC l.292): "All tools enforce owner/job scope. The agent cannot edit credentials, increase its own budget, replace original authority, change the fixed evaluation corpus, approve itself, or execute arbitrary production shell commands. Document text, OCR and catalogue content remain untrusted task data." PAGE l.629: "The server validates every call. No self-increased budget, new unverified SKU, changed original authority, unrestricted secret access or self-granted approval."

### Budget accounting (PAGE l.1018)
"Production budgets must cover every reasoning, retrieval, image and review call, including maximum completion costs. The reference lab implements rendering reservations and adaptive-action charges only." SPEC l.359 also lists "accounting for every reasoning/retrieval call" as not established.

### Other runtime facts
- "The browser and this desktop session must be unnecessary to advance the job." (SPEC l.44)
- "Preserve source files throughout; normalization is not mandatory for every input." (SPEC l.30)
- A services list (SPEC l.30): "file extraction; evidence interpretation; taxonomy/ontology lookup; catalogue retrieval; composition design; prompt compilation; model capability selection; rendering; image inspection; targeted repair planning; package export. Each consumes a typed versioned contract and returns evidence or a recorded failure."
- Providers named: Magnific (render/upscale), OpenRouter (verified vision/reasoning models; "Structured OpenRouter review with hashes and saved receipts exists when a server connection is verified"), fal ("Pricing/auth verification exists; no connected production fal generation adapter in the audited path").
- SPEC references (l.363-371): OpenAI agent docs (7 links). "None of these references establishes this studio's deployed readiness."

---

## 6. Stress coverage (#coverage)

PAGE l.784: "41 rows with retained image files · 1 QA row with output metadata only · 6 QA attempts with no output. This audits the 48-row index, not the entire project history. New A/B visual runs: 0."
Filters: evidence class (retained 41 / metadata 1 / no-output 6) and case family (direct, additional-accessories, early, baseline, gold, views, integration). Family counts: direct 7, additional-accessories 7, early 6, baseline 7, gold 7, views 7, integration 7 = 48.
Each row shows: condition, "Locks and checks" (inventory), a handling profile with "Eye" and "Plan / critique", "Proposed A route", "Proposed B route · one agent", evidence class, retained finding, limits, and always "New A/B result: not executed."

Important data limitation: in COV, the `A` and `B` route text is identical boilerplate in all 48 rows: A = "Proposed: compile these handling rules into service contracts; automated execution is not established by this historical case." B = "Proposed: the single agent inspects, plans, uses image tools, reviews and corrects this case. These are functions of one agent." COV contains no per-row mapping to a loop, role number or gate. The "Handled by" column below is therefore my inference from the row's profile (Eye/Plan text) and the role gates; it is labelled as such.

Handling profiles (14) and the text for each (COV.handling.eye / .plan):
- Tableware / functional accessory (6 rows): Eye "Separate packaging, sheet insets and physical items; lock counts, rim/motif/edge geometry and reflective surfaces." Plan "Use dining functions: napkins through rings, knives remain knives, glass on credible support. Transparent objects need background-aware reflection checks."
- Seating collection / modular assembly (7): Eye "Count physical modules, seats, ottoman and cushions separately; identify handedness, arms and joins." Plan "Preserve the requested layout and five-seat or multi-piece selection. Style with coordinated Midas tables and lighting without obscuring joins."
- Existing room / targeted edit (5): Eye "Room reference sets architecture; original product establishes identity; inherited scene is composition evidence only." Plan "Keep walls/windows and unrelated objects locked; chest, lamp, chandelier, bench or ceiling edit applies only to named changes; side views stay unverified where hidden."
- Dining / selected counts (4): Eye "Resolve selected chairs, armchairs and excluded table from original annotations plus user direction; count separately." Plan "Dining-12 keeps twelve selected seats; chair-only removes the crossed table. Preserve usable spacing, source style and dining accessories."
- Bedding / technical layout (4): Eye "Separate pattern tile, dimensions, pillow references and finished-bed example; preserve motif repeat, tufting and set quantity." Plan "Map textile onto plausible bed surfaces; review drape, motif scale and pillow count. A requested blue change may not recolour unrelated pillows."
- Lighting / reflective decoration (4): Eye "Protect shade/crystal/frame silhouette, wiring or suspension, structure, material and practical function." Plan "Check support or hanging connections, consistent emission/highlights, reflection and focal hierarchy; choose appropriate day/evening package."
- Bedroom collection (4): Eye "Inventory bed, bedside pieces and other set members from evidence; distinguish suite from a single saleable piece." Plan "Compile the requested bedroom image package with shared source identity; unsupported new angles cannot certify hidden construction."
- Functional paired accessories (3): Eye "Separate complementary forms; infer function from geometry, corroborate when possible; preserve each groove and opening." Plan "Place books between supported pieces; compare wide context and a scoped detail. Count physical pieces rather than insets."
- One product / multiple states (3): Eye "Resolve open/closed reference views as the same object; protect hinge, mirror, compartments, tassels and lid texture." Plan "Build dressing or shelving context with the box as hero; render open and closed states only if requested and supported."
- Wearable home textile (2): Eye "Separate mannequin from robe; preserve belt, pockets, collar and sleeve cut; distinguish pictured colour from a conflicting swatch." Plan "Use supported hanging/dressing context; no invented human model or different garment construction."
- Tables / structural geometry (2): Eye "Preserve base/ring/tier structure, wheels or nesting relations; technical substructure is an identity lock." Plan "Use original geometry when a bad candidate repeats errors. Review top/support contact, real tier count and accessory scale."
- Patterned soft accessory (2): Eye "Register face pattern, piping, seam and rear-view inset; preserve motif scale and orientation." Plan "Accessory-led sofa/bed composition; keep fabric readable under new lighting; scope close-up to the pattern."
- Long patterned textile (1): Eye "Protect border, proportions, weave and supported edge finish; no invented fringe." Plan "Use dining placement with a believable table overhang and visible product pattern; support with genuine dining references."
- Bath textile / swatches and insets (1): Eye "Separate terry body, border detail and colour swatch; distinguish towel from rug; fibre and exact colour remain unknown." Plan "Show plausible folded or draped towel use with border visible; close-up targets pile and trim without inventing fibre."

Standard per-row "Proposed validation — not completed tests" (PAGE l.944-955):
- Identity and completeness: "Selected pieces, exclusion marks, exact count, motif and silhouette; no invented hidden truth. Required views must all exist and have current reviews."
- Styling and functional use: "Genuine Midas companions; scale, palette, hierarchy, surfaces and lighting. Accessory-led and furniture-led compositions receive equal scrutiny."
- Model comparison: "First compare architectures with the same renderer. Then change one model or reference strategy at a time. Keep failures and costs; use unseen SKUs and repeat difficult cases."
Also: "A and B must receive the same original files, requested counts, package and limits. Historical assisted outputs are references for evaluation, not proof that either new architecture generated them."
Fidelity/integrity definitions (COV limits boilerplate): "Approximate visual-assessment ranges, not instrumented measurements or vendor certification. Fidelity = visible likeness of the primary product. Integrity = inventory, parts and relationships. Assessed against small uncalibrated vendor originals. Supporting context is not a verified Midas SKU unless directly supplied as a reference."

### The 48-row table

Columns: # | id | family | name | what it stresses (from COV condition/inventory/profile) | handled by (INFERENCE: loop / role / gate) | evidence class and status | retained finding or limit (short)

| # | id | family | name | what it stresses | handled by (inference) | evidence / status | key finding or limit |
|---|---|---|---|---|---|---|---|
| 1 | direct-1 | direct | D1 Cutlery - four knives | Exact count of 4 knives; reflective edges; packaging removed; handles stay knife handles | Roles 3, 5, 12; Image loop; gate "Exactly four" count check | retained / Assistant-inspected historical candidate | Four knives preserved; fine handle geometry interpreted from small source |
| 2 | direct-2 | direct | D2 Denise sofa - twilight room | One sofa; BODY FAB / PILLOW FAB / WOOD are reference samples not furniture; unreadable colour codes not invented | Role 4, 5, 8; Evidence loop; Styling loop | retained / Assistant-inspected | Lower front straighter than reference; table proportions drift |
| 3 | direct-3 | direct | D3 Dining collection - six chairs | Collage with 1 table + exactly 6 chairs + sideboard; no duplicated collage panels | Roles 1, 4; Image loop count gate | retained / Assistant-inspected | Six chairs retained; tableware and wall lights generated context |
| 4 | direct-4 | direct | D4 Botanical bedding - daylight | Board of 7 panels = ONE coordinated bedding set (cover, 2 pillow fronts, fitted sheet); annotations must not render | Roles 4, 5, 16; Image loop | retained / Assistant-inspected | Two extra plain pillows added (a count defect); pattern scale varies |
| 5 | direct-5 | direct | D5 Mirrored wardrobe - coherent reflection | Photo + drawing = one wardrobe; coherent room reflection; no diagram overlay | Roles 4, 6; Image loop | retained / Assistant-inspected | Product appears wider; reflection geometry uncalibrated. Note profile label mismatch (section 12) |
| 6 | direct-6 | direct | D6 Nesting tables - daytime lounge | Exactly 2 round nesting tables; showroom stock excluded; nesting geometry | Roles 4, 12, 17; Image loop (source reset) | retained / Assistant-inspected | Leg profiles and top-support details differ; sofa drifts |
| 7 | direct-7 | direct | D7 Crystal pendant - evening detail | One pendant; no exact crystal count claimed; ceiling suspension; warm light | Roles 5, 6, 16 | retained / Assistant-inspected | Crystal arrangement, diameter, scale unverified |
| 8 | accessory-1 | additional-accessories | A1 Glass and rootwood vessel | Transparent glass; EMPTY vessel (fish/water/plants removed); refraction | Roles 6, 16 | retained / Assistant-inspected | Wood contours and junction reconstructed, not exact |
| 9 | accessory-2 | additional-accessories | A2 Four gold napkin rings | Exactly 4 rings, each around one napkin; packaging removed | Roles 12, 16 count gate | retained / Assistant-inspected | Weave scale differs; rear pair softer |
| 10 | accessory-3 | additional-accessories | A3 Faceted etched goblet | Single goblet; angular faceted rim not rounded; etched glass | Roles 5, 16 | retained / Assistant-inspected | Faint texture becomes stronger relief; etching unconfirmed |
| 11 | accessory-4 | additional-accessories | A4 Paired fan bookends | Exactly 2 bookends holding 5 books; function inferred from geometry | Roles 3, 12; Image loop | retained / Assistant-inspected | Prompt asked 5 books, 4 generated (staging props) |
| 12 | accessory-5 | additional-accessories | A5 Abstract woven cushion | One cushion; pattern orientation and colour distribution | Roles 4, 16 | retained / Assistant-inspected | Not a one-to-one print match; piping stronger |
| 13 | accessory-6 | additional-accessories | A6 Tassel jewellery box | ONE closed box; open inset is the same item; exactly 2 tassels | Role 4 (inset rule); Role 3 | retained / Assistant-inspected | Tassels longer/fuller; interior not tested |
| 14 | accessory-7 | additional-accessories | A7 Geometric table runner | Border pattern continuity; no invented fringe; retail tag removed | Roles 5, 12 | retained / Assistant-inspected | Repeat spacing approximate; length unverifiable |
| 15 | R2-A | early | Bed 1 in Space 2 | Existing room ("Space 2") kept; product placed; initial + 2 repairs | Roles 8, 17; Image loop; room lock | retained / SELECTED CONCEPT | Pale motifs larger/brighter than original; headboard width inferred |
| 16 | R2-B | early | Bed 2 in Space 1 | Existing room ("Space 1"); partly cropped bed source | Roles 5, 8 | retained / SELECTED CONCEPT | Right side cropped in source; hidden structure inferred |
| 17 | R2-C | early | Bed 1 cover changed to blue | Cover-only colour change must not recolour pillows | Role 8 (cover-only), 17; Image loop | retained / SELECTED CONCEPT | Blue was an execution assumption (no swatch); not a manufactured colourway |
| 18 | R2-D | early | Bed 2 side-view concept | Side view from one photo; hidden geometry | Roles 5, 17; Evidence loop | retained / SELECTED INFERRED CONCEPT WITH PROFILE HOLD | Oblique not 90-degree profile; depth/construction inferred |
| 19 | R3-A | early | Furnished Bed 1 in Space 2 | Add chandelier, chest, lamp to selected repair | Roles 8, 10 | retained / SELECTED CONCEPT | Chest depth inferred; chandelier canopy out of frame |
| 20 | R3-B | early | Furnished Bed 2 in Space 1 | Add ceiling lamp + bench | Roles 8, 10 | retained / SELECTED CONCEPT | Bench on wood not rug (failed the on-rug constraint) |
| 21 | baseline-S1 | baseline | Brown classic suite | Armchair, loveseat, sofa, marble table; armchair not a duplicate sofa | Roles 3, 5; count gate | retained / REVIEW_REQUIRED: ornament/material or realism differences remain | Partially hidden console/end table uncertain |
| 22 | baseline-S2 | baseline | Grey chaise sectional | Chaise handedness LEFT; do not mirror; exclude source shelving/rug/plants | Role 4 (exclusions), 8 | retained / ACCEPT_VISUAL_ONLY in historical review; metric fit unverified | Fine weave, hidden legs unrecoverable |
| 23 | baseline-S3 | baseline | Ivory carved three-sofa suite | Exactly 3 sofas + 1 table; cropped side sofas completed conservatively | Roles 5, 16 | retained / REVIEW_REQUIRED | Hidden carving unverified |
| 24 | baseline-S4 | baseline | Dark modular sofa and ottoman | 2 seat modules + 1 ottoman on viewer RIGHT; glass table excluded | Roles 4, 5 | retained / ACCEPT_VISUAL_ONLY; metric fit unverified | True colour uncertain in shadow |
| 25 | baseline-B1 | baseline | Roma gold bedroom | Bed with distinct footboard + 2 bedside + 2 lamps | Roles 3, 16 | retained / ACCEPT_VISUAL_ONLY; metric fit unverified | Right cabinet partly hidden; infer matching pair conservatively |
| 26 | baseline-B2 | baseline | Walnut inlay bedroom | 3-drawer chests; exclude original chandelier/curtains/rug/wall decor | Role 4 exclusions | retained / ACCEPT_VISUAL_ONLY | Do not manufacture different ornament |
| 27 | baseline-B3 | baseline | Tall tufted dark-wood bedroom | Tall headboard; do NOT invent footboard of another case; warm light not orange upholstery | Role 5; Evidence loop | retained / ACCEPT_VISUAL_ONLY | Hidden structure unverified |
| 28 | G01 | gold | Antique-brass lantern | Catalogue + lifestyle from one raw accessory; candle is added prop | Role 20 (2-output package) | retained / Retained Gold candidate; not a universal benchmark | Hammered texture reconstructed; candle clearance unverified |
| 29 | G02 | gold | Marbled-shade table lamp | Patterned shade preserved; lit scene | Role 5, 16 | retained / Gold candidate | Marbling similar, not patch-for-patch |
| 30 | G03 | gold | Ornate gold mirror | Remove showroom reflections; coherent room | Role 6 | retained / Gold candidate | Reflection accuracy not measured |
| 31 | G04 | gold | Twin-pedestal dining table | Twin bases visible; supporting Midas ORGANIC plate and RIFFLE glass refs; first localized repair failed | Roles 10, 17; Image loop | retained / Gold candidate | Plates appear stacked; plate count unverified |
| 32 | G05 | gold | Tiled mobile bar counter | Front and rear views = one object; RIFFLE glasses; carafe is illustrative | Role 4 | retained / Gold candidate | Tile count, rear shelving not metrically validated |
| 33 | G06 | gold | Four-piece seating collection | 2 sofas + 2 armchairs not merged; KUBA centre table SKU 162010 and CELATO vase used | Roles 10, 11; count gate | retained / Gold candidate | Rear chair geometry inferred; scale unverified |
| 34 | G07 | gold | Five-piece bedroom collection | Bed, 2 nightstands, dresser (6 drawers), mirror; lamp is not part of set | Roles 3, 20 | retained / Gold candidate | Mirror reflection illustrative |
| 35 | views-N01 | views | Equestrian dinnerware collection | Existing composition → wide + close views → separate actual 2× upscale | Role 20 (view package); roles 13-14 | retained / Historical multi-output package; appearance limits remain | Retail quantities unreadable; ceramic composition unverified |
| 36 | views-N02 | views | Bordered terry towel | Towel vs bath mat ambiguity; photographed taupe conflicts with olive swatch; fibre unknown | Roles 3, 5 | retained / same | Towel is provisional; colour pending client Excel |
| 37 | views-N03 | views | Belted terry bathrobe | Hanging robe; collar/hood unverified; XL only in filename | Roles 5, 16 | retained / same | Earlier wider attempt stiff; superseded |
| 38 | views-N04 | views | Olive leaf-pattern cushion | Source inset has a different pattern; not claimed as reverse | Roles 4, 5 | retained / same | Edge and rear construction interpreted |
| 39 | views-N05 | views | Heart-tufted bedding | Pantone text unreadable; 220 x 240 cm diagram; plain backing pillows | Roles 2, 5, 20 | retained / same | 2x upscale preserved the prior composition including plain backing pillows |
| 40 | views-N06 | views | Sculptural bookend pair | Pair + books; duplicate ornament removed in selected correction; matched FC-SZ23034 catalogue identification | Roles 3, 9, 17 | retained / same | Weight/support not tested; composition unverified |
| 41 | views-N07 | views | Mirrored jewellery box | Open/closed = one item; 2x upscale model switched after two timeouts | Roles 4, 14, 15 | retained / same | No objective product accuracy increase claimed by upscale |
| 42 | qa-dinnerware | integration | Dinnerware vendor sheet | Client submission / recovery / saved result state | Recovery loop; Role 15 | no-output / needs_recovery | "Preparation timeout" |
| 43 | qa-dining-12 | integration | Dining set · 12 chairs | same | Recovery loop; Role 15 | no-output / needs_recovery | "Preparation timeout" |
| 44 | qa-sofa-5 | integration | Three modules · five seats | same | Recovery loop; Role 15 | no-output / needs_recovery | "Preparation timeout" |
| 45 | qa-chair-pair | integration | Two chairs · excluded table | same | Recovery; Role 1 (prompt vs selection) | no-output / needs_recovery | "Prompt mismatch" |
| 46 | qa-bookend-pair | integration | Complementary bookends | same | Recovery; Role 1/13 | no-output / needs_recovery | "Prompt mismatch" |
| 47 | qa-bedding-sheet | integration | Heart-pattern bedding sheet | same | Recovery; Role 1/13 | no-output / needs_recovery | "Prompt mismatch" |
| 48 | qa-jewellery-box | integration | Jewellery box · open/closed reference | same | Role 16; Image loop | metadata / review_pending | "Generated; visual revision needed"; output metadata 2000 x 2000, sha256 e7a89496eb9756a43b2ce30c8abdf79a185089c72a21a777ebd03db011d20547 |

Source records per family (COV.sourceRecord): direct = Midas-Direct-Space-Results/execution-record.json + visual-review.json; additional-accessories = Midas-Accessory-Stress-Results/execution-and-review.json; early = Midas-Stress-Evidence-2026-09-22/data/generations.json; baseline = PF1-R1/data/demos.json; gold = Midas-Gold-Cases-2026-09-29/cases.json; views = Midas-Complex-Cases-Views-2026-09-29/delivery.json; integration = Midas-Live-Studio-QA-2026-09-30/cases.json.

Caveat quoted for the QA rows: "This integration record is not a new image-quality pass. Older visual examples must not be substituted for this job."
Audit statement: "These are not 48 successful image cases, independent SKUs or autonomous workflow validations." (SPEC l.332) "The complete original project contains other records; this audit does not claim 48 is the total historical project count."
Statuses overall: Assistant-inspected historical candidate 14; Retained Gold candidate; not a universal benchmark 7; Historical multi-output package; appearance limits remain 7; needs_recovery 6; SELECTED CONCEPT 5; ACCEPT_VISUAL_ONLY in historical review; metric fit unverified 5; REVIEW_REQUIRED: ornament/material or realism differences remain 2; SELECTED INFERRED CONCEPT WITH PROFILE HOLD 1; review_pending 1.

Notable families of failure shown in COV that the architecture must handle (all quoted from findings): extra pillows added (D4, "two extra plain pillows were added"); requested 5 books but 4 generated (A4); bench on wood not rug (R3-B); first localized repair failed (G04); plate stacking (G04); duplicate ornament generated and removed (N06); upscale model fallback after two timeouts (N07); "Precision Photo timeouts".

---

## 7. Cost and time (#economics)

Short version: the page contains NO measured or estimated cost or time figures at all. There is no cost per job, per image, with/without correction, or elapsed time in any of the assigned files. A search for $, USD, credits, seconds, p50, p95 found only labels and the calculator. The only numbers are synthetic fixture "cost units" in the controller. Verbatim content follows.

Heading: "THE BUSINESS STANDARD / Cost per accepted complete package. Include failed calls, repairs, review, compute and human time. B uses one agent. Measure its inference, tools and rework rather than assuming a multi-agent team." (PAGE l.984-988)

- A · Controlled workflow: "Cost comes from extraction, planning, catalogue retrieval, generation, critique and repairs. Narrow calls and stable routes may reduce overhead; that saving must be measured."
- B · One adaptive agent: "Include the single agent's turns, context, tool calls and optional environment time. Better diagnosis or composition could avoid expensive rework; extra turns can also make it worse."
- Calculator inputs: "A · Your measured totals: Total cost, one currency; Accepted complete packages; Total human active minutes" and "B · Your measured totals: Total cost, same currency; Accepted complete packages; Total human active minutes". Placeholder in input: "No measured total yet".
- Formulas (UI economics()): cost per accepted package = total cost / accepted packages, shown with 2 decimals, unit "currency units per accepted package"; human minutes per accepted package = total minutes / accepted packages, 1 decimal ("human active minutes per accepted package"). Valid only if cost is finite and >= 0 and accepted packages is a positive whole number; otherwise "Enter total cost and a positive whole number of accepted packages."
- "Local calculator only. Values are not provider prices or invoices and are not saved. Provider credits cannot be added to currency without a verified conversion."
- "Reserve before work: Production budgets must cover every reasoning, retrieval, image and review call, including maximum completion costs. The reference lab implements rendering reservations and adaptive-action charges only."
- "Time has two measures: Track human active minutes separately from total elapsed time. Publish median and slow-case latency, queue wait and failure recovery for complete packages."
- "Acceptance remains the denominator: Cheap rejected images are not a business win. With zero accepted packages, cost per accepted package is undefined, not zero." (BROWSER: "Cost denominator and zero-acceptance handling" passed.)
- SPEC l.342 business metrics (verbatim): "total billed compute plus runtime/storage plus human review divided by accepted complete packages; active human minutes; submission-to-package p50/p95; first-pass acceptance; repair recovery; false approval; package completeness. Count rejected/failed runs in cost, not as accepted outputs. Track invoice currency and provider credits separately until an actual conversion is known."
- Role 21 artifact: "Accepted-package cost; human active time; p50/p95 latency; repeat-work rate." Evidence: "Some provider credits/timestamps retained; complete accepted-package economics not measured."
- Role 14 gate relevant to cost: "four no-output comparison failures cannot establish a winner".
- SPEC l.275: "Confirmed failures retain their charges and never count as quality comparisons."

Fixture cost units in CTRL (synthetic, "abstract cost units"; not money): budgetUnits 100; each render or repair claim reserves 10 and receipt charges 10; B `inspect` agent_action costs 2. Totals: A repair scenario 30 units; B repair scenario 32 units (the 2 is the extra inspect). maxActions 20.

Measured vs estimated:
- Measured: none in these files. Estimated: none either; no numeric estimate is offered.
- ATLAS contains provider model names and run IDs (e.g. "Model: imagen-nano-banana-2", "Run: 6044I5iJO3") but not prices in the portion I read.
- Project implication (inference): any per-image cost figure for the build must come from n8n execution logs / provider invoices, not from these specs.

---

## 8. Audit and gates (#proof)

### Header (PAGE l.1055-1058)
"AUDIT · LOCAL PROOF · PRODUCTION GATES / What exists, and what earns release. 36 / 36 local control tests passed. Synthetic events test the controller's decisions. They do not test visual accuracy or confirm a deployed agent runtime. Report: 2026-10-01 Browser interaction checks"

### Implementation audit rows (FW.audit; each: name, state, finding, source)
1. Scope correction | Revised 4 October | "Architecture B is one agent. The previous manager/specialist decomposition and extra test ideas were assistant proposals, not an implementation of the requested one-agent scope." | docs/architecture/superseded-r1/two-architectures.md
2. Client execution | Preview only | "The first-page UI has no generation dispatch. Connect validated intake, uploads, contracts, progress and results after runtime gates pass." | app/client-first-page/studio.tsx
3. U2 multi-model flow | Executed, narrow scope | "Eye/Brain/renderer node chain has seven retained website jobs, one image input and one output. No exposed Eye JSON or autonomous critic/repair proof." | lib/unified-live.ts; public/unified-evidence/evidence.json
4. F1 multi-reference execution | Implemented path | "Role-tagged references and output planning exist. That executor uses one renderer; automated correction is not wired." | lib/generation-service.ts; lib/production-contract.ts
5. External critic | Conditional implementation | "Structured OpenRouter review with hashes and saved receipts exists when a server connection is verified. Live readiness is not established by this audit." | lib/vision-review-service.ts; lib/vision-review-provider.ts
6. Repair and release | Local reference built | "The new controller and failure tests exercise transitions with synthetic evidence. It does not call providers, interpret real images, or validate production quality." | public/architecture-lab/controller.mjs; tests/architecture-lab.test.mjs
7. Catalogue styling | Historical curated evidence | "11 genuine Midas items and three documented style boards exist. Exhaustive automated catalogue selection and ranking remain to be integrated." | lib/workflow-history-r2.json
8. Background operation | Incomplete proof | "Saved leases/receipts and recovery logic exist. A durable worker independently advancing all stages and review/repair must still be connected and tested." | lib/generation-service.ts; lib/generation-recovery.ts
9. fal | Connection verifier only | "Pricing/auth verification exists; no connected production fal generation adapter in the audited path." | lib/provider-connections.ts

### Eight scope corrections (AUDIT.corrections; PAGE l.1113-1160)
1. "B needs a manager, perception agent, stylist agent and independent critic" → added by the assistant, contrary to one-agent; replaced with one agent, self-review named.
2. "The 21-role crosswalk represents things already automated" → mixed assisted with proposed; added evidence status and historical basis.
3. "48 coverage rows represent generated test cases" → 41 / 1 / 6; separate evidence filters.
4. "Live automatic catalogue ranking finds the best Midas composition" → only curated; removed implication of a global-best selector.
5. "Dynamic graph, Visual RAG and scene/temporal automation were previously used" → proposed only.
6. "Broad PDF/Excel ingestion and batch-to-final generation are proven" → no executed evidence; "Keep as requested/proposed scope, not previous image success."
7. "Repair-loop fixtures prove visual critique or unattended operation" → "36 tests use synthetic events; no models or image-quality assessment occur."
8. "Paired A/B, blinded evaluation, unseen-SKU holdout and restart-fault tests were completed" → were proposed protocols; zero completed new-architecture visual runs.
Delegation audit (AUDIT.delegation): "Only /root active in collaboration.list_agents on 2026-10-04"; "One spawn_agent call located in this thread journal: midas_catalogue_references, 2026-09-28T20:31:14.559Z"; "No claim that this was a persistent image-production specialist team."
Counts: retainedImageRows 41, qaOutputMetadataOnlyRows 1, qaNoOutputRows 6, newArchitectureVisualRuns 0. qaRecordSha256 a371177f35cb3c9f4c69a489d872b8172a1f36fa2c2069493593ac4ff95ee60e.

### The 36 local control tests (TEST; synthetic events; "no generated-image quality test")
Grouped: (a) A and B each: repair re-reviewed and wide/detail package stays review-only; critical unknown holds before spending; unresolved receipt keeps reservation and cannot resubmit; max two repairs then hold (8 tests). (b) No mutation to original references, output scope or limits; duplicate reference and output ids rejected; generated composition cannot replace original identity source; no silent Midas SKU invention; genuine reference required when Midas styling contracted. (c) Spend: insufficient reserve prevents submission; unexpected overcharge stops further work; confirmed failure retained, charged, never a quality comparison; receipt must match exact operation; recover same operation after uncertain receipt without duplicate charge. (d) Event integrity: conflicting duplicate ids rejected; stale revision and stale contract rejected. (e) Review integrity: review cannot approve another candidate/contract/scope/plan; missing/duplicate/unexplained checks rejected; "Fidelity 99 cannot override wrong physical count"; unknown visible count holds; critic cannot omit contracted product or add unrequested inventory; repair needs target instructions and preserve list; repaired area cannot hide new regression; previously flagged issue must be explicitly resolved. (f) Package: incomplete package cannot release; plan cannot silently change after an accepted package member; automatic release requires explicit validated policy. (g) Agent: cannot bypass review, replace source or grant itself approval; exploration has action and spend bounds; adaptive action denied in deterministic architecture. (h) Checkpoint can be serialized and resumed; store CAS rejects concurrent write before dispatch.
Caveat: TEST is dated 2026-10-01, before the 4 October r2 correction; MANIFEST pins controller.mjs sha256 3a4a67a9e0cffe39641882e41270ca124d846a35e7c65d2270c1824fcef81fd4 (2026-10-04). I cannot confirm from the files that the 36 tests were re-run against that exact controller after r2.

### BROWSER checks (2026-10-04, "Local browser interaction checks"), 13 passed items
All 12 stage details of both architectures; B names one agent carrying all functions; seven sections navigate; 21 responsibilities searchable and expandable; eight A/B control-scenario traces; trace controls and download; 48 case rows with reference files and condition-specific handling; evidence filters (41/1/6); 21 evidence labels, 8 scope corrections and explicit one-agent contract; cost denominator and zero-acceptance handling; direct section link survives reload; 390px layout without overflow; no JS errors.

### Production gates

Build sequence and acceptance gates (SPEC l.344-351; PAGE l.1162-1169):
1. Contract foundation. "Acceptance: partial/inset/count cases produce defensible contracts; source revisions invalidate dependent reviews."
2. Provider proof. "connect one generation adapter and one server-readable critic with real backend credentials. Acceptance: receipts, files, errors and actual usage are recorded; client connection tests are not mistaken for quality proof."
3. Durable A vertical slice. "queue-driven intake → styling → render → critique → repair → full package, continuing with browser closed and after a worker restart. Acceptance: no chat intervention, no duplicate paid calls, no wrong-source review reuse."
4. B single-agent execution. "one deployed agent with skills, tools and saved state on the same contract and limits. Acceptance: it performs interpretation through self-review and delivery, without a hidden specialist team or manual chat intervention."
5. Paired benchmark. "same difficult inputs, references and deliverables; compare quality and total economics, including failures and repeat runs. Acceptance: calibrated quality gates and business limits, with remaining failures visible."
6. Client cutover. "connect the accepted preview to the selected validated runtime by category/capability. Use a feature flag and keep rollback to review-only; do not route unvalidated families silently. Acceptance: unattended full-package success across the declared supported coverage."

Fidelity and release thresholds: "Fidelity target: ≥95% needs a calibrated measurement method and approved anchors. Zero critical violations is a release gate. A self-reported percentage or successful unit test is not a fidelity measurement." (PAGE l.1169). SPEC l.340: "'≥95% fidelity' remains a target until the measurement method and accepted references are calibrated; 0 critical violations is a release criterion, not a claim of zero stochastic error."
Hard rejection examples (SPEC l.340): "wrong selected count, swapped product, changed defining geometry/pattern, invented Midas SKU, impossible support, unauthorized room change or missing required outputs. Report visible fidelity and integrity independently from aesthetics."
Benchmark protocol (SPEC l.330-338), summary: freeze originals, category/role, package, Midas candidate pool, budget; include clean controls plus difficult annotations, partial views, collages, tableware, reflective glass, patterned fabric, functional accessories, sets, exclusions, room locks, reverse roles, view packages; add restart/duplicate-event/expired-provider tests; reserve unseen SKUs per family as holdout; repeat stratified difficult subset; "publish case results and uncertainty rather than selecting the nicest image." Stage 1 same rendering model; stage 2 change one provider/model at a time; failed calls reported separately; "Models with no output have no quality score."; blinded evaluators; owner-approved anchors; "No benchmark result may be supplied by the creator's self-score alone."

Controller gates (CTRL), the code-level rules: contract identity required; typed reference hashes (64 hex) with roles; at least one `original`; unique ids; scoped output inventory with positive integer counts; `maxRepairs` 0 to 2; `maxActions` 1 to 200; positive `budgetUnits`; explicit `releasePolicy`; boolean `productionValidated`; release needs phase `package`, no unresolved operation, reserved 0, and every output's approved hash equal to its current candidate hash.

Shared foundation (six items) and per-role gates (section 3) are also gates.

---

## 9. "New · A in four real cases" and case tracing paths

What the files contain: PAGE l.17 banner only: "New · A in four real cases — generated lifestyle/detail images, all 21 responsibilities, actual repair attempts and a Vault sample. Open the case walkthroughs →" (link /surgical-cases.html). The page itself (CASES) is only an HTML shell in the local file; its data (/a-cases/ui.mjs, /a-cases/style.css, generation-ledger.json, source-manifest.json, check-report.json) is NOT in the research folder. The four cases are therefore not identified anywhere in the assigned files. I did not invent them.

What CASES does say:
- Title/description: "Midas · A in four real cases" / "Four source-led image cases, mapped to 21 responsibilities with prompts, actual outputs, review findings and a Vault sample."
- Eyebrow "A · SURGICAL REPLACEMENT / CASE WALKTHROUGHS"; heading "Follow the work. Inspect the evidence."; intro "Four difficult inputs. Each responsibility shows its inputs, decision, output and handoff."
- "Execution boundary: New image calls and assistant reviews, with local routing, file and package checks. The production service replacement is shown at every step. This is not an unattended A deployment."
- Tabs: "Images & selection" (lifestyle view / detail view toggle; "Why these Midas pieces?"; catalogue; "Composition, protected features and unknowns"), "All 21 responsibilities", "Review & repair" ("What passed inspection—and what did not." / "Every generated attempt" / "The original remains the product authority. Review here is assistant-performed. No calibrated fidelity percentage, independent vision-service pass or whole-catalogue "best" score is claimed."), "Vault · start → finish" ("One item record, before and after." / "The same originals and identity locks accompany every variant and correction." / Starting contract vs Ending package).
- Six execution groups (buttons): "01–06 Understand → 07–09 Decide → 10–12 Style → 13–15 Generate ↔ 16–18 Review → 19–21 Record & deliver".
- Downloads: this complete case; all image-call records (generation-ledger.json); original hashes (source-manifest.json); local check report (check-report.json).
- Footer: "4 October 2026 · New assisted candidates, retained failures and explicit unknowns."
- Not-in-files point: SPEC l.357 "Built: this framework, 21-responsibility crosswalk, all 48 coverage rows, a shared pure reference controller, a browser loop lab..." does not list the four-case walkthrough, so the cases page appears to post-date or sit outside the SPEC text (inference). FW.decisions still says "None is a completed execution of the new A or B architecture" and AUDIT counts show newArchitectureVisualRuns 0; the cases page says "New image calls and assistant reviews", which is a different claim (see section 12).

What I can give as tracing paths, from running CTRL (these are fixtures, NOT the four real cases):

Path 1 · A, "Defect repaired; wide + detail complete". Stage 01 observe (rev 1) → 02/03 plan with catalogue ref `midas-shelf` (rev 2) → 04 claim render, reserve 10 (rev 3) → receipt, spent 10 (rev 4) → 05 review fails placement "Simulated floating bookend", status `repairable` (rev 5) → claim repair (repairs 1/2) (rev 6) → receipt (rev 7) → review passes, resolves prior issue, output `wide` approved, `current` moves to `detail` (rev 8) → claim (rev 9) → receipt (rev 10) → review passes, `package` (rev 11) → 06 release: policy `review_only` → `review_ready` (rev 12). Outcome: complete 2-output package, 30 units, awaiting human review.
Path 2 · B, same. Adds one `agent_action inspect` (cost 2) after plan (rev 3), so 13 events, 32 units; same outcome.
Path 3 · A and B, "Critical evidence missing". observe with `criticalUnknown` → `held` at rev 1, 0 spend, reason "Critical identity/selection unknown; obtain evidence, do not invent it". Outcome: evidence hold.
Path 4 · A, "Provider receipt uncertain". observe, plan, claim (reserve 10), `uncertain` (rev 4). Reservation kept, nextAction `reconcile`, no resubmit allowed. B adds the inspect (spent 2). Outcome: stalled pending reconciliation.
Path 5 · A and B, "Two repairs exhausted". Every review fails placement; repair 1 and repair 2 are claimed; after the third candidate's review defects remain and `repairs >= maxRepairs` → `held`, "Repair limit reached with unresolved defects". A spent 30, B 32. Outcome: hold, no third repair.
(8 traces in total = 2 architectures x 4 scenarios, matching BROWSER "Eight A/B control-scenario traces".)

Cases from the 48-row coverage with multi-attempt histories (retained evidence, not new runs), usable as tracing examples: R2-A, R2-C, R2-D (initial + Repair 1 REJECTED + Repair 2 SELECTED), G04 (first localized repair failed, second selected), views-N06 (duplicate ornament removed in corrected wide view), views-N07 (2x upscale switched model after two Precision Photo timeouts). ATLAS "Replay a documented correction history" lists: Centre table (source reset + model change; attempt 3 changed model and reference set together, "so this is not a controlled model-quality benchmark"), Midas evening sofa (accessory topology), Bed 1 in Space 2, Bed 1 cover changed to blue, Bed 2 side-view concept.

---

## 10. "The responsibility that cannot disappear at deployment" (ATLAS #loops, l.1933-1975; outside the assigned list but present locally)

Heading: "THE RESPONSIBILITY THAT CANNOT DISAPPEAR AT DEPLOYMENT / What I did as Brain, Operator and Critique."
- Brain: "Interpreted the request, reconciled counts and reference conflicts, set product locks, selected the composition and planned outputs."
- Operator: "Attached references, wrote and submitted prompts, chose tools/models, checked run status, retained candidates and exported files."
- Critique: "Compared originals and results, described defects, separated style from identity, selected repair targets and stopped unresolved sequences."
- Diagram nodes: "Originals + contract (Identity and allowed changes) → Generate candidate (References, model, receipt) → Eye + critique (Identity AND scene regression) → Reviewed candidate (Package checks → owner release); defect → Targeted repair (Preserve locks · re-observe next result); stop rule → Hold / new evidence (Budget exhausted or uncertainty unresolved)".
- Caption: "The loop was operated by me in the case histories below. This diagram does not imply a deployed automatic controller. The operator reattaches original evidence and the protected context at every correction."
- "These actions were performed by me during assisted sessions. They do not automatically run inside the client website when I am absent. A deployed replacement needs the same inputs, persisted decisions, evidence, execution privileges and release rules."
- "Passing a visual check produces a reviewed candidate; owner approval and complete package checks remain separate."
- "What is actually automated?" table (ATLAS): Observe → design → render: assisted "I interpret, compile and launch"; software "U2 runs Gemini Flash → Gemini Pro → Nano Banana Pro; F1 compiles prompts and launches an image model"; boundary "U2 one reference / one image; not full scope or all packages". Catalogue selection: "No verified dynamic Visual RAG / knowledge-graph selection service". Source-aware critique: "External structured vision review is implemented; requires a supported saved connection and runs from review UI"; boundary "No live critic receipt verified in this audit; no autonomous background guarantee". Repair & regression: "Strict review schema and max-two decision logic tested locally"; boundary "Persisted automatic repair dispatch not connected". Release: "I package and state limitations; owner decides"; boundary "A client-ready full-package release requires all checks and resolved approval".

Same theme in SPEC: roles 7, 15, 16, 17 (Brain/Operator/Critique), role 15 gate "Polling a UI or reopening chat is not an unattended background runtime", role 19 gate "The chat history is not the studio's durable memory", and l.7 "The studio must perform the interpretation, styling, operation and critique previously supplied in this chat."
Operator/Brain/Critique duty list in the role table: Brain = roles 7, 8, 9; Operator = 15 (and 21 business operator); Critique = 16, 17, 18; Eye = 2 to 6; Stylist = 10 to 12; Engine = 13, 14; Vault = 19.

---

## 11. Existing rooms / "spaces", multiple products in one job, chat variations, batch

Quote-only. Gaps are stated.

Existing rooms and "Space 1 / Space 2" (names from coverage and the Direct-Space file name):
- COV early family rows: "Bed 1 in Space 2" (R2-A), "Bed 2 in Space 1" (R2-B), "Furnished Bed 1 in Space 2" (R3-A), "Furnished Bed 2 in Space 1" (R3-B). Condition text e.g. "Space 1.png + bed 2.png", "R2-B selected initial candidate + Ceiling Lamp.png + Bench.png".
- Profile "Existing room / targeted edit": Eye "Room reference sets architecture; original product establishes identity; inherited scene is composition evidence only." Plan "Keep walls/windows and unrelated objects locked; chest, lamp, chandelier, bench or ceiling edit applies only to named changes; side views stay unverified where hidden."
- Reference roles in CTRL include `room` ("original, room, catalogue, composition"). Role 2 ingests "customer room evidence". Role 8 "Keep identity and requested room locks strict while allowing declared creative variables." Gate "Creative room freedom never silently changes the hero SKU or exact counts." Hard rejection: "unauthorized room change". Role 8 evidence: "Room locks, cover-only colour changes and full lifestyle requests."
- "Direct-Space" is a results-folder name (Midas-Direct-Space-Results), not a feature. The files contain nothing about "creating a space" as an operation, a saved-space library, or a space picker. Intake in SPEC is "selected project, job, outputs and changes" (role 1 scope). "Saved projects" appear under Client/existing Site (FW.runtime). (Inference: a "space" = an existing room reference with role `room`.)

Multiple products in one image/job:
- Role 1: "A product can be hero or supporting; input type and item category are separate variables." Orthogonal decision 5: "Product role determines whether furniture or an accessory is the focal item."
- Collections: "Assemble exactly ONE rectangular dark wood dining table, SIX matching upholstered chairs, and ONE matching sideboard from this product collage" (D3); G06 four-piece seating collection (2 sofas + 2 armchairs + Midas centre table + vase); G07 five-piece bedroom collection; S1 to S4 suites; "Interpret this board as one coordinated ... bedding collection ... They are not seven separate products." (D4). Role 20 gate: "One attractive image is not completion of a bed, table or set's image package."
- Counting rule in CTRL: each output has an `inventory` of items with positive integer counts; review must report visible count per item; a mismatch is a defect ("count:<id>"); "Critic cannot omit the contracted product or add unrequested inventory" (TEST).
- Unsure/over-selection: role 4 and D3/qa-chair-pair: "chair-only removes the crossed table"; "Dining-12 keeps twelve selected seats".
- The files contain no separate "multi-product job" object beyond per-output `inventory`, nor a rule for several unrelated hero products in one image. Gap.

Chat-box / conversational variations:
- SPEC l.271: POST /api/studio/v2/jobs/:id/revision, "User steering plus current version" → "New contract; invalidate affected plans/reviews; preserve historical outputs". SPEC l.298: "User steering creates a new version; old reviews do not migrate silently." Build gate 1: "source revisions invalidate dependent reviews". CTRL: plan change after any approval requires new version.
- Role 15 gate: "Polling a UI or reopening chat is not an unattended background runtime." Role 19: "The chat history is not the studio's durable memory." Step 3 acceptance: "no chat intervention"; step 4: "without a hidden specialist team or manual chat intervention".
- Variations: SPEC l.328 "Three sofa moods" (role 11 evidence); styling loop "up to three boards before rendering". Output package = "required images, views, lighting variants, details and exports" (decision 6). ATLAS mentions "choose appropriate day/evening package" (lighting profile plan).
- There is NO chat-box feature, free-text "make it more X" variation flow, or conversational UI described in any assigned file. Only the "revision" endpoint (structured steering) and the statement that chat must not be the runtime. Gap.

Batch:
- Input condition list includes "spreadsheet or mixed batch" (SPEC l.20). Role 2: "spreadsheet facts". Audit correction 6: "Broad PDF/Excel ingestion and batch-to-final generation are proven → No executed evidence for that end-to-end claim in this registry. Keep as requested/proposed scope, not previous image success."
- Benchmark: "mixed batch" is an input condition only; no batch scheduling design except role 21 A "Queue scheduling, bounded retries, caching valid results and package-level metrics".
- N02/N03 (towel/robe) mention "pending the client Excel" (colour/fibre data) → spreadsheet facts are expected input but not ingested in evidence.
- CTRL has one job per contract; no multi-job batching.

---

## 12. Contradictions, gaps, and things to treat carefully

1. Stage names differ between A and B and between the page and the case walkthroughs: 6 A stages (01-06), 6 B views, plus a separate 6-group grouping of the 21 roles (Understand / Decide / Style / Generate / Review / Record & deliver). The files give no official role-to-stage mapping; mine is inference.
2. Two different "12s": BROWSER "all 12 stage details" (6 A + 6 B) vs the "12-state trace" (12 events of the A repair scenario). B's default trace has 13 events.
3. No loop/role mapping for coverage rows: COV has no field linking a row to a loop, role or gate; its A and B route text is the same boilerplate in all 48 rows. My "handled by" column is inference.
4. COV profile mismatch: direct-5 "D5 Mirrored wardrobe - coherent reflection" is assigned the profile "Wearable home textile" whose Eye/Plan text is about robes ("Separate mannequin from robe ..."). The wardrobe-specific rules are only in its condition text. Also the "inventory" field is null for 27 rows (accessory-1..7, R2-A..R3-B (6), views-N01..N07, qa-* (7)), so the "Locks and checks" panel would be empty for them (UI renders `r.inventory||[]`).
5. Inventory data type is inconsistent in COV: strings for D rows, null for A/R/N/qa rows, and lists of lists for G rows (item; count; note).
6. Test report date vs spec revision: TEST is 2026-10-01 (36/36 pass) but the r2 correction and MANIFEST hashes are 2026-10-04. SPEC l.357 says "adversarial transition tests" built. Cannot confirm tests were re-run after r2. ATLAS also says "Evidence revision 2 / 1 October 2026" while the architecture page is "REVISED 04 OCT 2026".
7. Four-case walkthrough vs "zero runs": PAGE banner advertises "generated lifestyle/detail images ... actual repair attempts" and CASES says "New image calls and assistant reviews", yet AUDIT/MANIFEST/PAGE state "New A/B visual runs: 0" and "None is a completed execution of the new A or B architecture." They can be reconciled (assisted, not unattended A), but the case data is not in the folder so I cannot verify; the SPEC "What was built" list (l.357) does not mention the cases page.
8. Tool names differ: SPEC "Agent tool contract" (10 tools: read_contract, inspect_reference, query_catalogue, propose_plan, compile_render, request_render, get_operation, record_review, propose_repair, assemble_package) vs SAC tools (9: read_files, inspect_images, query_midas_catalogue, generate_image, get_operation, edit_image, upscale, save_project, assemble_package). Different granularity; no mapping given.
9. Review independence wording: role 16 B and SPEC l.38 consistently say B self-review is "not independent"; but SPEC flow line for A says "independent review" and role 16 A says "Separate structured vision-review invocation". A's critic is a separate invocation, not stated to be a different model family; independence in A is therefore also unproven (inference). Role 14 gate: "Multiple roles need not mean different model families".
10. Controller scope vs the five loops: CTRL implements the image loop (review/repair, max 2), recovery loop (claim/uncertain/receipt/failure), release gating, and B's bounded `inspect`/`revise_plan`. It does NOT implement: any transition out of `held` (so the Evidence loop's "update evidence basis → re-evaluate" requires a new job/contract version); the Styling loop (no multi-board comparison; `revise_plan` only charges cost and does not change the plan; `plan` event is the only way to replace a plan); the Evaluation loop; reconcile/poll as actual events (they are labels in `nextAction`; resolution is via `receipt`/`failure`). Also repairs counter is per output and resets on approval, while budget and actions are per job.
11. Repair-limit statements: SPEC/role 17 "Two image repairs maximum by current policy" vs CTRL `maxRepairs` between 0 and 2 (contract-set). ATLAS: "These actual histories include bounded three-candidate sequences". Consistent (initial + 2 repairs) but "three" attempts vs "two" repairs can be confusing. Project rule (in the user's instructions) "At most two repairs per image, then hold" matches.
12. "≥95%" vs "90 to 95": role 18 gate "Historical subjective 90–95 scores do not establish calibrated ≥95% fidelity"; PAGE l.1169 "Fidelity target: ≥95% needs a calibrated measurement method". The files treat 95 as a target not an achievement. The project's own rule "never present the 90 to 95 target as achieved" is consistent.
13. Release semantics: PAGE stage 06 gate "Only validated automated policy can release unattended"; CTRL ends at `review_ready` unless `releasePolicy: validated_automatic` and `productionValidated: true`. There is no field for owner approval inside CTRL: `review_ready` is a terminal stop ("stop"); human approval is outside the controller. ATLAS: "owner approval and complete package checks remain separate." The user's rule "The owner approves; the pipeline never does" aligns, but no file defines the owner-approval event.
14. Budget scope: "Bounded spend" is a shared-foundation item, yet the reference lab only reserves rendering/repair and charges B inspect; reasoning/retrieval/review calls are not accounted (PAGE l.1018; SPEC l.359). Review calls have no cost event in CTRL.
15. Economics: no figures exist; any claim of "lower cost per accepted package" is a hypothesis ("that saving must be measured").
16. Evidence-status mismatch for role 14: FW says "four no-output comparison failures" while the six QA no-output rows are "Preparation timeout" (3) and "Prompt mismatch" (3). The "four" is not traceable to the QA rows I can see (inference: refers to an earlier model comparison not in these files).
17. SPEC mentions Cloudflare D1/R2, Magnific, OpenRouter, fal; the project's pipeline is n8n (project instructions say n8n pipelines implement Option A; Option B not built). No file maps the SPEC services to n8n nodes. The SPEC's "durable queue/worker with transactional lease/outbox" and CAS have no direct n8n equivalent specified; they would need Data Tables or an external store (inference).
18. `contractStamp` is only JSON string equality (SPEC l.359 says so); not a signature. Hash check in CTRL is only regex /^[a-f0-9]{64}$/ for candidate/reference hashes, not a verification that the bytes match.
19. Taxonomy: role 7 gate says the taxonomy must not become "hundreds of unrelated hard-coded workflows"; COV uses 14 handling profiles. No taxonomy file is among the assigned files.
20. "Space" terminology: "Direct-Space" folder name vs "Space 1/Space 2" room references vs the project's own notion of "spaces/rooms". Not defined in files.

---

## Appendix: ten most important rules for building a production pipeline (with sources)

1. The original vendor photo is the only authority for identity; every attempt re-attaches it, and a generated composition may never replace it. "preserve the original identity reference on every attempt" (SPEC l.322); TEST "A generated composition cannot replace original identity source"; shared foundation "Original identity" (PAGE l.63).
2. Counts and inventory are hard gates that beat aesthetics. "A high aesthetic score cannot override a missing chair or changed fabric." (role 16 gate); TEST "Fidelity 99 cannot override wrong physical count"; CTRL flags `count:<id>` defects; unknown count holds.
3. Unknown stays unknown; missing critical evidence holds instead of guessing. "Missing evidence routes to a richer assessment or hold; it must never default to a fabricated product." (SPEC l.32); CTRL `criticalUnknown` → `held`; role 5 gate "A crop cannot establish the unseen bed base".
4. Never invent a Midas product: supporting items need a source reference. "No generic lamp may be labelled Midas without its source reference." (role 10 gate); CTRL "Unsupported Midas catalogue claim"; SPEC l.328 "Generic contextual books/rugs/plants must be marked as context."
5. Maximum two repairs per image, each targeted, with preserve list and regression recheck, then hold. "Two image repairs maximum by current policy; exhausted or non-improving loops hold." (role 17); five correction rules (SPEC l.322); CTRL `maxRepairs` ≤ 2, requires `repairPrompt` + `preserve`.
6. Claim and reserve before any paid call; never repeat a paid call on a missing receipt: reconcile the same operation. "Atomic claim and outbox commit must precede external dispatch" and "Lost receipts retain reservations until reconciled" (SPEC l.275); recovery loop (SPEC l.316); CTRL `claim`/`uncertain`/`receipt`.
7. Every review is bound to the exact candidate, source contract, plan and scope, and must list all seven checks with evidence; stale reviews never carry over. CTRL `review` event; "source revisions invalidate dependent reviews" (SPEC l.346); "old reviews do not migrate silently" (SPEC l.298); TEST "Review cannot approve another candidate, contract, scope or plan".
8. A passed review is not release: the package gate requires every required output to have a current accepted review, and unattended release only under an explicit validated policy; otherwise `review_ready`. "One attractive image is not completion of a bed, table or set's image package." (role 20 gate); CTRL `release`; PAGE stage 06 gate.
9. Self-review is not independent validation, and scores are not measurements: do not claim the ≥95% target without calibrated anchors; zero critical violations is the release criterion. SPEC l.38 and l.340; PAGE l.1169; role 18 gate.
10. Persist state outside the agent and chat; use versioned contracts with idempotent, compare-and-swap writes; user steering creates a new contract version. "The chat history is not the studio's durable memory." (role 19 gate); "Compare-and-swap versioning prevents two workers issuing the same operation" (SPEC l.275); POST .../revision (SPEC l.271); CTRL `expectedRevision` and duplicate-event handling.

(Honourable mentions: bounded spend and action limits for any adaptive step, SPEC l.46 / CTRL `maxActions`; the agent cannot increase its own budget or approve itself, SPEC l.292; document/OCR/catalogue text is untrusted data, SPEC l.292.)
