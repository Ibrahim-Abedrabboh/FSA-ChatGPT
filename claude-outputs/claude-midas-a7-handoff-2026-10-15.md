# Midas A7: handoff for the next chat (15 Oct 2026, 23:45 Amman)

Paste the block below into a new chat in the "Midas Furniture styling" project.

```text
Continue the Midas A7 work, strictly following the project instructions.

First, check the current state, then wait for my choice of what to build. Do not build or run anything before I answer.
1. In n8n (the authority), check these workflows:
   - "Claude · Midas A7 (stages 01–05)", id 1cgZc9rmBOrPdKIe. Last version 0f5ea2c8. Not published.
   - "Claude · Midas A7 model test", id WvmDSrnX6lYdiKzZ. Last version 5ed8dbbe.
   - "Claude · Midas A7 model test · one call", id MYwlkpnVdCqoEmfR.
2. Read these Project docs:
   - claude-outputs/claude-midas-a7-stage-05-README-2026-10-15.md
   - claude-outputs/claude-midas-a7-coverage-register-2026-10-15.md (owner decisions and open points)
   - claude-outputs/claude-midas-a7-stage-04-README-2026-10-15.md and claude-outputs/claude-midas-a7-model-test-README-2026-10-15.md, if needed.
3. Attach the private GitHub repo Ibrahim-Abedrabboh/claude-midas-studio (add_repo with push access, then clone it).
   - Code, tests and n8n exports live there.
   - The Project keeps only the READMEs, the register, decisions and this handoff.
   - Repo layout:
     - n8n/claude-midas-a7/ (workflow JSON and one file per Code node)
     - n8n/claude-midas-a7-model-test/
     - tests/claude-midas-a7-stage-05/run_tests05.js (57 tests)
     - claude-outputs/ (earlier files moved from the Project; MANIFEST.md has checksums). Older test suites: claude-outputs/claude-midas-a7-build/test/run_tests.js (86) and run_tests04.js (37).
   - Save new code and tests in the repo, not in the Project. Commit with a clear message.
   - Re-export a workflow into n8n/ after every change, and check it byte for byte against the tested file.

Where A7 stands (15 Oct 2026, 23:45):
- Stages 01–05 are built in the draft:
  - Intake, contract.
  - Midas retrieval, plan, plan critic, owner go 1.
  - Compile, model registry, dispatch guard, one paid Gemini image call (gemini-nano-banana-2.1, approved by the owner), receipt, Drive upload.
  - Review: Claude reviewer with 17 checks including framing; Gemini blind count; code verdict.
  - Owner go 2: approve / repair / stop. At most two repairs.
- Repairs wait for the owner's go 2 (04 Settings auto_repair false).
- Tested with pinned data only:
  - Pinned runs 424 and 425 passed.
  - No real end-to-end A7 run has been made.
  - The real reviewer calls are not verified.
- Owner decisions:
  - Owner gates always.
  - Midas-only props in scenes (empty spot if no Midas piece fits).
  - Never invent unseen parts (hold and ask for a better photo).
  - Delivery 1125×1125 jpg and webp, resized from the 2048 master without AI; the master stays in the vault.
  - Dimensions from photos are an internal estimate only.
  - Framing:
    - White master: about 12% white margin on every side, so the product spans about 76% (built).
    - Lifestyle hero: about 60–70% of frame height.
    - Wide view: less.
    - Detail view: more.
    - The scene values are stored in 04 Settings `framing` and are not used yet.
- Truth sheet "claude-midas-model-test-truth" (id 1cKIwvEnnBwqPjkrx-pQ0WO1id2ajd1AcQk4hhAWRI9s): Test 6 = 6 pieces; Test 8 = the bed only (1 piece).
- Model test: preview mode, paid switch off.
  - A full run now plans 16 calls, over its 12-call cap.
  - Only Test 10 has had a real run (owner go).

Still open with me (ask, don't assume):
1. Truth sheet E6: write it as "1 bed; 2 nightstands; 1 dresser; 1 mirror; 1 stool" so the model test gets a piece-by-piece inventory.
2. A7's "context piece the inventory names counts as seen" rule (from the old Test 8 sheet): keep as a default, or remove?
3. Model test: which folders to run (only_folders), or raise the 12-call cap. Any paid run needs my go in that message.
4. auto_repair: keep false (I order each repair), or allow up to two repairs within the go 1 budget.

Next build options (my choice):
A. Scenes stage, after the owner's go 2 approves the white master:
   - architect room, then place the product
   - Midas-only accessories with SKU and catalogue photo
   - camera and Kelvin lighting presets per category
   - framing per output type: hero 60–70% of height, wide less, detail more
   - a scale report from supplied dimensions only
   - each scene reviewed by stage 05 and approved at go 2
B. Package stage:
   - 1125×1125 jpg and webp
   - versioned files and a manifest with Midas accessory links
   - description and spec card from recorded facts only ("not confirmed" for unknowns)
   - identity vault entry
   - cost per accepted package
C. Data: import the Midas accessories catalogue and set up a live stock source.

Test leftovers to know about:
- A7 runs table (l0roUCBwIQL3h9Eq): rows 19–22, plus vault rows from executions 423–425.
- Model test results table (LqajV3K8gVqYaN3E): rows 1–3 simulated; rows 4–5 are the real Test 10 results.

Rules (project instructions, still in force):
- No publish, unpublish or paid call unless I say so in that message. Test with pinned data.
- Build changes as new drafts; never edit published or earlier pipelines in place.
- Prefix new things with "Claude ·" or "claude-".
- No keys or tokens anywhere.
- A passed review is a reviewed candidate, not an approval.
- Scores are model judgements; never present the 90–95 target as achieved.
- Every build gets a dated README in plain language. Save the README to the Project; save the code in the repo.
```
