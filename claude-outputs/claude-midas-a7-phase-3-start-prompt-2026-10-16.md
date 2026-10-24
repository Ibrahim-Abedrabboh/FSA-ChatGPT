# Phase 3 start prompt: catalogue data

16 Oct 2026, 23:4x Amman. Written by Claude, to paste into a new chat. **Fill in the three choices marked [ ] before you send it.**

---

Phase 3 of Midas A7: catalogue data. Free; no AI, no paid call.

**Read first** (the Project, then the repo `claude-midas-studio`, branch `final`, commit `eb28135` or later):
- `claude-outputs/claude-midas-a7-remaining-plan-2026-10-16.md` (Phase 3 section, and decision D10)
- `claude-outputs/claude-midas-catalogue-import-README-2026-10-16.md` (how the catalogue was filled, and its limits)
- `claude-outputs/claude-midas-a7-prompt-check-2026-10-16.md` (section "Catalogue data found on the way")
- `claude-outputs/claude-midas-a7-stage-07-README-2026-10-16.md` (how A7 uses the catalogue at scene time)
- `taxonomy.json` and `taxonomy.js` (Midas Kuwait snapshot, 29 Sep 2026; use unchanged)
- repo: `tools/claude-midas-accessories-import.py`, `data/claude-midas-accessories-2026-10-16.json`, and the code nodes of A7 `10 Retrieve Midas pieces` and `19c Prop verdict`

Check n8n before you state or change anything. The docs are snapshots.

**Where things stand (16 Oct 2026; check each in n8n)**
- **Catalogue table:** "Claude Midas A7 catalogue", `lwJbRv4TVqlFTILl`. It held 428 rows after the 16 Oct import: 16 hand-written, 412 imported.
- **Refresh workflow:** "Claude · Midas catalogue refresh", `mGgKxO0638I77meF`, version `2b2be743`. Not published.
  - It reads page 1 of 19 Accessories categories on midasfurniture.com/en, 10 s apart (robots.txt).
  - That is 415 of about 2,082 listed accessories, about 20%.
  - robots.txt disallows addresses with "=", which the site uses for page 2. So page 2 cannot be read the same way.
- **Fields:** dimensions and finish are "not confirmed" on all 412 imported rows. The listings do not show them.
- **Known data problems:**
  - SANOVA end table (161283) points to the Saudi store page.
  - Hand row 174770 (RENESMEE lamp) still says "out of stock" from 28 Sep; the listing said "In stock" on 16 Oct. The refresh never changes hand rows.
- **Decision D10:** scene pieces are in stock only, every piece, Kuwait `/en/` pages only.
- **A7 itself:** draft `eefd6c42` (`1cgZc9rmBOrPdKIe`), not published. Phase 2 (the photo reader) has an A7 change still waiting for my go. **Do not change A7 in this chat.**

**My choices for this chat**
1. **Fuller catalogue (P3.1): [A / B / C]**
   - A: use the site's own sitemap (midasfurniture.com/en/amsitemap/). Read robots.txt first and follow it, with the 10 s gap. Product pages only as the sitemap lists them.
   - B: I will send an export or feed. Do not read the website.
   - C: skip P3.1 for now.
   - (My standing rule "do not resume reading Midas product pages until I say how" is lifted only as this choice says.)
2. **Table writes: [NEW TABLE / LIVE TABLE]**
   - NEW TABLE: write only to a new table, "Claude Midas A7 catalogue v2", with the same columns. The live table stays as it is.
   - LIVE TABLE: write to `lwJbRv4TVqlFTILl`, with the existing rules (insert new SKUs, update rows the refresh made, never change hand rows).
   - If I left this blank, use NEW TABLE.
3. **Scheduled refresh (P3.2): [PREPARE ONLY / NOT NOW]**
   - PREPARE ONLY: build the schedule as a new draft version of the refresh workflow (weekly, Amman time), test it with pinned data, do not publish. Publishing needs my go in a later message.

**Do this**
1. **P3.1 (only if A or B).**
   - Read the source the choice names. Keep the same row shape as today: SKU, name, product link, catalogue photo, price in KWD, in-stock flag, category, kind, notes (where and when read, the price that day).
   - Kuwait `/en/` pages only. A page from another country store is never used for a Kuwait row.
   - Do not guess anything a source does not state. Size and finish stay "not confirmed" unless a Midas source gives them, and then say which source.
   - Report coverage per category: listed, read, written.
2. **P3.2** as chosen above.
3. **P3.3 Facet vocabulary.**
   - From `taxonomy.json` unchanged, list the facets A7 can use as supplied facts: fabric, material, table top, colour family, handles.
   - Map each catalogue row to these facets only where the source states it. Otherwise "not confirmed".
   - Deliver it as a data file in the repo plus a proposal for where the spec card would use it. **Do not put it into A7.** It goes into A7 later, as its own draft version, after the Phase 2 change is settled and with my go.
4. **P3.4 Missing fields and data problems.**
   - Audit the catalogue: rows with a guessed size or finish, rows pointing outside Kuwait `/en/`, duplicate SKUs, rows with no photo, hand rows that disagree with the current listing.
   - Propose a fix for each (for SANOVA 161283 and hand row 174770 too). **Do not change hand rows or mark rows inactive without my go.**
5. **Tests:** local tests with code-made data for every parser and write rule. Run the n8n workflow only with pinned data, except the reads my choice in item 1 allows.
6. **Report:** a dated README in plain language in `claude-outputs/` in the Project (status, what changed, what was checked and how, what was not, assumptions, open questions for me, leftovers). Code and data in the repo.

**Standing rules**
- No publish, unpublish or paid call unless I say so in that message.
- New draft versions only. Never edit a published workflow or an earlier pipeline in place. Prefix new things "Claude ·" or "claude-".
- No keys or tokens in any file, payload, log or screenshot.
- Follow robots.txt and the 10 s gap on any Midas page. If a safety check refuses a step, do not work around it; ask me.
- Never claim something was built, tested or verified without a version id, a test result or an execution id.
- Never invent a Midas product, SKU, size, finish or stock state. Unknown stays "not confirmed".
- An incomplete result is never called complete. List the leftovers (tables, rows, workflows, executions).
