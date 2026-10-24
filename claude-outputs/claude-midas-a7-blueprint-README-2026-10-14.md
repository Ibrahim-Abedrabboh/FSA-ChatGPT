# Midas A7 blueprint: README (14 Oct 2026)

## Status
- Design only. Nothing was built, changed, published or run in n8n.
- No paid call was made. A6 (FPAF0QHltl8iIcdZ, version b1b0f696) is unchanged and still published.
- Deliverable: `claude-midas-a7-blueprint-2026-10-14.html`, published as a private artifact.

## What it contains
- A vs B, with the recommendation: build A7 as Architecture A; try B or a hybrid only after the anchor-set benchmark.
- The 6 stages and 21 steps. Each step has its input, output, method, model, gate and A6 state: 6 in A6, 14 partly, 1 missing (step 18).
- The five loops, with trigger, limit and build phase for each.
- The four control scenarios traced for A and for B, and the same scenarios as A7 step paths.
- Four real cases, plus run 362 (job cfdaefa8).
- Projects vs Manual, the nine "How choices combine" cases mapped to A7, and the chat or refine flow as child jobs.
- Several products, existing rooms and spaces, with a data model.
- The models table, with image generation fixed on `gemini-nano-banana-2.1`.
- Cost per job, with and without correction, and the A6 to A7 gap list.
- Build phases and open decisions.

## Checked, and how
- All 5 Mermaid diagrams parse with mermaid 11.4.1. 4 remain after one was replaced by cards. They render in headless Chromium.
- No horizontal page scroll at 1280px or at 400px.
- No console errors.
- The price-basis toggle works: the fal.ai row reads $0.220 / $0.357 / $0.495.
- The step filter works: "Missing" shows 1 step.
- Cost figures come from `cost_model.py` → `cost_model.json`, which the page embeds. Nothing was retyped.

## Not checked
- How the artifact viewer's own Mermaid theme renders the diagrams. Local checks used the "neutral" theme.
- Any image quality of Nano Banana 2.1 on Midas products. Not tested; it needs a paid test.

## Assumptions
These are estimates, not invoices:
- Token sizes are taken from run 362 at 4 characters per token.
- Reasoning tokens are counted at 1× the visible output. A 3× view is shown for sensitivity.
- gpt-6.1-sol is assumed to use 2,000 tokens per image.
- Nano Banana 2.1 costs about 1,000 thinking tokens per image.
- Excluded: the n8n plan, storage and owner time.

Other assumptions:
- The saved-spaces library is a proposal. No source describes it.
- The mapping of the 21 roles to the 6 stages is inferred. The source files give no official map.

## Not built
- Everything in the page is not built.

## Leftovers
- No n8n test rows or scratch workflows were created.
- Saved in the project on 14 Oct 2026 at 19:55:
  - the page
  - `claude-midas-a7-design/` (the sources and costs)
  - `claude-midas-a7-research/` (the reading notes)
  - `claude-midas-a6-prompts-by-phase-2026-10-14.md`
  - `claude-midas-a6-prompts-tools/`
  - `claude-midas-studio-site-a6-go/` (the site and its tests)
- Not saved:
  - **Binary files**, which project docs cannot hold: the Word copy (the `.md` has the same text), the verification zip, the hero image, the screenshots and the run 362 images.
  - **Raw n8n exports.** Run records can hold keys.
