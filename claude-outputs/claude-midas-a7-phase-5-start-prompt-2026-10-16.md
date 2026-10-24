# Phase 5 start prompt: client page (mock mode only)

16 Oct 2026, 23:4x Amman. Written by Claude, to paste into a new chat. **Fill in the one choice marked [ ] before you send it.**

---

Phase 5 of Midas A7: the client page. Free; **mock mode only**. Nothing is sent to n8n or any provider, and nothing is published.

**Read first** (the Project, then the repo `claude-midas-studio`, branch `final`, commit `eb28135` or later):
- `claude-outputs/claude-midas-a7-remaining-plan-2026-10-16.md` (Phase 5 section; decisions D1, D8, D12; Phase 1 review finding 10)
- `claude-outputs/claude-midas-a7-page-2/README.md` and its `index.html`, `app.js`, `styles.css` (page draft 2, the starting point)
- `claude-outputs/claude-midas-a7-prompt-check-2026-10-16.md` (sections "Client first page check" and the page table)
- `claude-outputs/claude-midas-a7-owner-answers-2128-README-2026-10-16.md` (the `client_shown_as` field and the "Approved by the studio" labels)
- `DESIGN.md` (journey, wording, trust) and `midas-furniture-brand/DESIGN.md` (colour and type; it wins where they differ)
- `taxonomy.js` / `taxonomy.json` (use unchanged)
- repo: `tests/claude-midas-a7-page/run_page2_mock.js`, and A7's `01 Intent & scope` and `02 Ingest files` code nodes (read only)

Check n8n before you state anything about A7. The docs are snapshots.

**Where things stand (16 Oct 2026; check each)**
- **Live client page:** today it is the page in `midas-studio-site-regenerate/`, which sends to pipeline 3 (`LCkfLFMQS5MjA5FQ`, published). **Do not touch it, its addresses or pipeline 3.**
- **Page draft 2** (`claude-outputs/claude-midas-a7-page-2/`):
  - mock only;
  - not connected;
  - 100 of 100 mock tests passed on 16 Oct;
  - it sends each payload through A7's own `01 Intent & scope` code to compare the plan.
- **A7** (`1cgZc9rmBOrPdKIe`, draft `eefd6c42`, not published):
  - it has **no result address** a page can read (P5.1);
  - it writes `client_shown_as` into its records: "Approved by the studio" for an image you approved by eye, and "Approved" for a reviewed approval.
- **Photos besides the main one:** A7's code reads a room photo and other-view photos (reference roles `room` and `other_view`). The page takes one photo, so side views are held. Decision D12: both side-view series show "Coming later" until F4.
- **Phase 1 review finding 10:** page draft 2 said "2 to 10 images" and "or a series". Check whether this is fixed.
- **A7 itself:** do not change it in this chat. Phase 2 has an A7 change waiting for my go.

**My choice for this chat**
- **F4 (room photo and other views on the page): [BUILD IN MOCK / COMING LATER]**
  - BUILD IN MOCK: the page collects one optional room photo and optional side photos, only in the shape A7's `02 Ingest files` reads. When a room photo is added, the page says the light comes from that photo. Side-view series stay "Coming later" unless the matching photo is added.
  - COMING LATER: keep them as now.

**Do this**
1. **Page draft 3:** a new numbered copy, `claude-outputs/claude-midas-a7-page-3/`. Draft 2 stays unchanged, byte for byte.
2. **P5.1 Result address (contract and mock only).**
   - Write the contract the page would read: job status values, per-image state, and labels.
   - Labels:
     - "Generated image" for any image;
     - "Approved" only from my recorded decision;
     - "Approved by the studio" where `client_shown_as` says so;
     - held images as "Not made" with a plain reason;
     - an incomplete package never shown as complete.
   - Build the page's result view against a mock of that contract.
   - **Do not add a webhook or any node to A7.** Write the A7 side as a proposal for a later draft, with my go.
3. **P5.2 Offer only what A7 delivers.**
   - For every option on the page, check against A7's `01 Intent & scope` code whether A7 reads it.
   - What A7 does not read shows "Coming later" and is never sent.
   - Keep the "Keep faithful" fields A7 reads (colour, material, details to preserve, things to exclude).
   - Add any field A7 reads but the page lacks (for example SKU, dimensions, a piece count, written instructions), only if `01` reads it.
4. **P5.3** as chosen above.
5. **Wording and trust.** Apply both DESIGN.md files.
   - No internal terms where a client can see them: no Eye, Brain, Critic, n8n, or model or provider names.
   - No promised delivery time, pixel size, retention period or human stylist.
   - English first and RTL-ready (layout mirrors under `dir="rtl"`).
6. **P5.5 Arabic.** Draft the Arabic copy in a separate file, marked "needs a native review before use". The page does not show it as final.
7. **P5.4 Verify in mock mode only.**
   - Extend the mock test so every payload goes through A7's `01` (read only) and, for F4, `02`.
   - Check the result view against the mock contract, including held and partly ready packages.
   - Also check phone width (375 px), keyboard use and basic labels, and RTL.
   - The test must abort any network call.
8. **Report:** a dated README beside the page, and a copy in `claude-outputs/` in the Project. Cover status (not connected, mock only), what changed from draft 2, what was checked and how, what was not checked, assumptions, the A7 changes it needs (as a proposal), and leftovers.

**Standing rules**
- Mock mode only. No request leaves the page. No publish, unpublish or paid call.
- Never edit the live page, pipeline 3, or a published or earlier workflow. New numbered copies only. Prefix new things "Claude ·" or "claude-".
- No access codes, keys or tokens in any file, payload, log, screenshot or test.
- Never claim something was built, tested or verified without a test result or version id.
- The owner approves results; the page and the pipeline never do.
