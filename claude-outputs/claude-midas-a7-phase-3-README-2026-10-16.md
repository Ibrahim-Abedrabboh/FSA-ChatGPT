# Claude · Midas A7 Phase 3: catalogue data

16 Oct 2026, 23:50 Amman. Written by Claude, from the Phase 3 start prompt of the same day.

Code and data: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, branch `final`, the commit that adds this README.

**Updated 17 Oct 2026, 00:25 Amman** after your decisions of 00:08: see "Update, 17 Oct 2026" at the end. It changes the status below. Three table values changed (SANOVA inactive; stock on 174770 and 174788), the refresh has a new draft version `c0722832`, and the five facet lists wait for your review.

## Your choices in this chat

- **P3.1 fuller catalogue: C, skip.** No Midas page was read. The rule "do not resume reading Midas product pages" stays in force.
- **Table writes:** not needed, because P3.1 was skipped. Nothing was written to any table.
- **P3.2 scheduled refresh: not now.** The refresh workflow was not touched.

## Status

- **Nothing in n8n changed.** No publish, no unpublish, no run, no paid call, no table write.
- Checked in n8n at 23:45 Amman:
  - A7 `1cgZc9rmBOrPdKIe`: version `eefd6c42`, not published, 183 nodes.
  - Refresh `mGgKxO0638I77meF`: version `2b2be743`, not published.
  - Catalogue table `lwJbRv4TVqlFTILl`: 428 rows (16 by hand, 412 imported), all marked active.
- New in the repo: an audit and facet tool, its tests, a snapshot of the table, and two result files (listed under "What changed").
- **P3.3 is not complete.** The taxonomy snapshot holds no facet vocabulary. See below.
- **P3.4 is done as a report.** No row was changed. Every fix needs your go.

## P3.3 Facet vocabulary: the snapshot has none

I read `taxonomy.json` and `taxonomy.js` (release F1-CATEGORIES-2026-09-29) unchanged.

- They hold 247 nodes: 221 categories, 23 sections, 3 item types.
- Each node has only an id, a name, a parent and a kind.
- **There is no fabric, material, table top, colour family or handles list in them.** No other project or repo file has one either. `dropdown-options.json` lists page choices (wall paint, floor, light, mood), not product facets.

So I could not list facet values, and I did not make any up.

What was delivered instead:

- **`data/claude-midas-facets-2026-10-16.json`**: the five facets, each with an empty value list and the status "not in the snapshot"; and all 428 rows with all five facets "not confirmed", with the reason.
- **The mapper is ready for a vocabulary.** When a list is supplied, a facet gets a value only when a row's finish or name states that value as a whole word. Otherwise it stays "not confirmed". Tested with made-up lists.
- All 16 hand rows already carry finish text (for example "Ceramic; white"). Those could be mapped once a vocabulary exists. The 412 imported rows have no finish, so they would stay "not confirmed".

### Proposal: where the spec card would use it (not built, not in A7)

Today the spec card in **18a Package ticket** lists Product, SKU, Pieces, Excluded pieces, Colour, Material and Dimensions. Each says where its value came from.

Proposed, once a vocabulary exists, as its own A7 draft version after Phase 2 is settled and with your go:

1. **18a spec card:** add Fabric, Table top, Colour family and Handles beside Material.
   - Value only when supplied in the brief.
   - Source "supplied in the brief; in the Midas vocabulary (release …)" when the value is on the list.
   - Source "supplied in the brief; not in the Midas vocabulary" when it is not. It is kept as written, never changed to the nearest word.
   - No value from photo readings. They stay internal, as today.
2. **10 Retrieve Midas pieces:** each shortlist card carries the piece's facets from the facet file, so the planner sees stated facts only.
3. **Scene manifest (step 20):** each Midas piece lists its stated facets beside its SKU and link.

## P3.4 Audit of the catalogue

Tool: `tools/claude-midas-catalogue-audit.py`. Input: the table as read from n8n at 23:45 (`data/claude-midas-catalogue-snapshot-2026-10-16.json`) and the 16 Oct listing read. Result: `data/claude-midas-catalogue-audit-2026-10-16.json`.

**The 412 imported rows are clean on every check.** All say "not confirmed" for size and finish. All link to Kuwait `/en/` pages. All have a Midas catalogue photo. No SKU, link or photo appears twice. Each matches the 16 Oct listing file field by field.

All findings are on the 16 hand rows.

| Check | Rows | What it means |
|---|---:|---|
| Page outside Kuwait `/en/` | 1 | SANOVA 161283 (Saudi `ksa_en` page) |
| Size or finish from another store | 2 values | SANOVA 161283: size and finish come from the Saudi page |
| Stock not clear | 1 | SANOVA 161283: "In stock on the Saudi store; Kuwait page not found" |
| Hand row differs from the 16 Oct listing | 2 | RENESMEE 174770 (row: out of stock; listing: in stock). **New:** white/gold lamp 174788 (row: pre-order; listing: in stock) |
| Finish partly read by eye | 3 | CHALLVOR 141368 and 141365 ("marble-effect appearance"), floor vase 176249 ("visible gold collar") |
| Size incomplete, honestly marked | 3 | 174770, 174788, 170143: "depth omitted". No change needed |
| Size or finish written by hand, page field not recorded | 24 values | The other hand values. Not wrong, but the row does not say which page field they came from |
| Stock reading older than 7 days | 16 | Every hand row (read 28 Sep or 7 Oct) |
| Duplicate SKU, link or photo | 0 | |
| No photo, or photo not on Midas | 0 | |
| Guessed size or finish on an imported row | 0 | |

Pre-order rows (D10 keeps them out of scenes): 158478, 162510, 174788, 170143. All are hand rows.

### What A7 does with these today

I checked the code of **10 Retrieve Midas pieces** and **19c Prop verdict** in n8n. Both match the repo byte for byte.

- Step 10 offers in-stock pieces on Kuwait `/en/` pages only (D10). By its filters, 355 of 428 rows can be offered before job rules.
- 19c refuses any page outside `midasfurniture.com/en/` and any pre-order.
- So the risk the 16 Oct prompt check found for SANOVA (19c accepting the Saudi page) is already closed in `eefd6c42`.
- 36 links contain "midasunited-arab-emirates" in their address. They are `/en/` pages that the Kuwait listing itself links to (33 imported, 3 hand rows). A7 accepts them. I did not treat them as another store.

### Proposed fixes (none applied; each needs your go)

1. **SANOVA 161283.** Mark the row inactive. A7 already refuses it, so scenes do not change. If a client picks 161283, the question they get changes from a stock reason ("stock not confirmed as read on 2026-10-07") to "not offered at the moment", which is clearer. If you want it back, send its Kuwait `/en/` page and allow one page read.
2. **RENESMEE 174770 and white/gold lamp 174788.** Two ways:
   - **Recommended:** let the refresh update stock, date and the stock line in the notes on hand rows whose SKU is on the listing, and nothing else. Size and finish stay as written. This is a change to the refresh, built as a new draft version.
   - Or update the two rows by hand.

   Until then, A7 does not offer either lamp. If one is planned anyway, 19c reads its live page at scene time.
3. **CHALLVOR 141368, 141365 and vase 176249.** Keep only what the Kuwait product page states in "finish". Move the read-by-eye part to notes. Record the page and date.
4. **The 24 hand values without a recorded page field.** No change now. Note the page field and date the next time each row is checked.
5. **Old stock on hand rows.** No change needed for scenes, because 19c reads the live page. Fix 2 would keep the 3 listed SKUs fresh. The other 13 hand rows are furniture, or accessories not on page 1 of the 19 listing pages, so the refresh as built cannot reach them.

## What changed

- New: `tools/claude-midas-catalogue-audit.py` (reads files only; no network, no n8n).
- New: `tests/claude-midas-catalogue-audit/run_tests_audit.py`.
- New: `data/claude-midas-catalogue-snapshot-2026-10-16.json` (the 428 rows as read from n8n), `data/claude-midas-catalogue-audit-2026-10-16.json`, `data/claude-midas-facets-2026-10-16.json`.
- This README. The plan's Phase 3 section and the repo README index were updated to point to it.

## What was checked, and how

- **Local tests: 40 of 40 pass**, all with code-made data. They cover: hand or imported rows; stock words; an empty vocabulary maps nothing; a made-up vocabulary maps whole words only ("Metallic" is not "Metal"); each audit rule; the input is not changed; `.js` and `.json` taxonomy give the same result; the taxonomy file is not changed.
- **Live data:** all 428 rows read from n8n in 5 pages; ids 1 to 428, none missing.
- **Imported rows against the listing file:** 0 differences in name, link, photo, stock, kind, size and finish.
- **A7 code:** 10 and 19c in n8n `eefd6c42` equal the repo files.
- The existing refresh tests ran: 1 passed; the parser tests were skipped because the saved listing pages are not in the repo.

## What was not checked

- Any Midas page (choice C). The 13 hand rows that are not on the 19 listing pages were not compared with a current page.
- Whether the Midas site has its own facet lists (for example filter lists on category pages).
- The facet mapper on a real vocabulary.
- The taxonomy counts come from the repo copy `claude-outputs/claude-midas-studio-site-a6-go/site/taxonomy.js`. The Project's `taxonomy.json` and `taxonomy.js` were read in full in this chat: same release, date, first and last nodes, and the same node fields. They were not compared byte for byte.

## Assumptions

- A row is a hand row when its notes do not start with "Imported". This is the refresh's own rule.
- "Older than 7 days" for stock readings is my threshold.
- Words such as "appearance" and "visible" mark a value read by eye. "Omitted" and "missing" mark a value the page lacks.

## Open questions for you

1. **Facet vocabulary source.** The snapshot has none. Which should it be?
   - you send the lists (fabric, material, table top, colour family, handles);
   - or you allow a read of the Midas site's own filter lists, under robots.txt and the 10 s gap;
   - or the spec card keeps today's fields until a list exists.
2. **SANOVA 161283:** mark inactive?
3. **174770 and 174788:** refresh updates stock on hand rows (new draft version), or by hand?
4. **CHALLVOR and the floor vase:** may I trim "finish" to page-stated words, once a page read is allowed?
5. **P3.1 and P3.2** remain open: a fuller catalogue (A or B) and the weekly schedule.

## Leftovers

- No workflow, table, row or execution was created or changed in n8n.
- Repo: the files listed under "What changed". They are meant to stay.
- A scratch copy of the table pages in this session's scratch folder; not in the repo or the Project.

## Update, 17 Oct 2026: your decisions of 00:08

Done in this order: robots.txt, facet filter lists, the SANOVA check, then the refresh draft.

### Reading the Midas site

- robots.txt read at 00:09 Amman (Crawl-delay 10; addresses with `?…=…` blocked; sitemap at `/sitemap.xml`).
- Read in your Chrome, as plain page loads, about 11 s apart. Only category pages, the Kuwait English sitemap and one product address were read. No filter link was opened, no search was used and nothing was clicked.
- **Two exceptions:**
  - The wardrobes page was read twice within one second (00:11:21), to check that the method gives the same lists as the open page. It did.
  - A batch that timed out at about 00:11:40 may have kept running for up to a minute beside the next batch. Some requests then may have been less than 10 s apart.
- The raw reads are in `data/claude-midas-site-reads-2026-10-17/`. Each file was checked against a SHA-256 made in the browser, so the values are byte-for-byte what the pages showed: `category-pages-a.json` `c7ae277e…`, `category-pages-b.json` `c77fdaac…`.

### 1. Facets: the five lists, for your review

File: `data/claude-midas-facets-site-2026-10-17.json`. Source: https://midasfurniture.com/en/, 18 category pages read 17 Oct 2026, 00:12 to 00:19 Amman (each page and time is in the file).

- Values are copied word for word, in page order. Nothing is renamed, merged or added. The item counts the site shows are not kept.
- Each facet takes values only from the site filter with that name. Each value keeps the pages where it was seen.
- **The spec card does not use them.** It stays as it is until you approve.

| Your facet | Site filter | Values |
|---|---|---|
| Fabric | Fabric Type | Boucle; Chenille; Leather Air; Linen; Microfiber; Velvet; Polyester; Genuine Leather; Stainless Steel; Cotton; Jacquard; Tweed; Faux fur; Nuvella; Faux Leather; Cashmere; Exposed; Suede; Leather |
| Material | Material | Mirror; Engineered Wood; Metal; Glass; Solid Wood; Plastic; Stainless Steel; Fiber Glass; Faux Marble; Acrylic; Polyester; Leather Air; Linen; Chenille; Wood; Iron; Fabric; Sintered Stone; Polypropylene; Cotton; Velvet; Jacquard |
| Table top | Table Top Material | Faux Marble; Solid Wood; Glass; Engineered Wood; Mirror; Marble; Fiber Glass; Ceramic; Acrylic; Tempered Glass; Sintered Stone; Travertine Stone; Genuine Marble; Stone; Metal; Stainless Steel; Polyresin; Faux leather; Aluminum; Genuine Leather |
| Colour family | Family Color | Black; White; Brown; Off-white; Beige; Grey; Gold; Multicolored; Silver; Mirror; Clear; Metallic; Green; Blue; Tiffany; Orange; Rose Gold; Greige; Pink; Red; Yellow; Pearl White; Bronze; Antique Gold; Antique White; Purple |
| Handles | Handles Materials | Metal; Stainless Steel; Handleless; Solid Wood; Engineered Wood; Wood; zinc alloy |

**Things to look at before you approve** (copied as the site shows them, not changed):
- "Stainless Steel" appears under Fabric Type.
- "Faux leather" (Table Top Material) and "Faux Leather" (Fabric Type) are spelled differently.
- "Exposed" under Fabric Type seems to mean no fabric.
- "Mirror" appears under Family Color.
- "zinc alloy" under Handles Materials is lower case.
- Related filters were kept apart and not used: Table Frame Material, Inner Material, Headboard, Upholstery, Chairs Upholstery. They are listed in the file under `other_filters_not_used`.
- Pages read: home furniture, living rooms, sofas, chairs, coffee tables, side tables, TV units, cabinets, bedrooms, beds, night stands, wardrobes, dining rooms, dining tables, dining chairs, accessories, cushions, office furniture. Outdoor furniture shows no filters. Other category pages may carry more values. Each list is a union of these pages only.

### 2. SANOVA 161283: marked inactive

- **Condition met: its Kuwait /en/ page is gone.**
  - https://midasfurniture.com/en/sanova-end-table-living-rooms-midas.html (the same address as the Saudi page, on /en/) returned **404** on 17 Oct 2026 at 00:15:57 Amman.
  - It is not in the Kuwait English sitemap https://midasfurniture.com/sitemap/kw_en/kw_en_sitemap.xml (5,656 addresses; neither "sanova" nor "161283" appears), read at 00:19:46 Amman.
  - It is not on page 1 of the Kuwait side tables page, read at 00:14:55 Amman.
  - Not checked: the site search, which robots.txt blocks.
- **Change:** `active` set from true to false on row id 16 only, by the scratch workflow "Claude · scratch · SANOVA 161283 inactive flag" (`l3vyijYZQDLkR9oc`), execution **467**. Every other field is unchanged (read back at 00:20).
- **To undo:** set `active` back to true. Nothing was deleted.

### 3. 174770 and 174788: the refresh draft

**Cause.** It was not a SKU or variant mismatch. Run 429 (16 Oct) matched all three hand-row SKUs on the listing: 174770, 174781 and 174788. Its summary lists them under `kept_hand_rows`, with the listing stock beside the table stock. They were left unchanged on purpose, by the rule "a row written by hand is never changed" (R4).

**Other rows the same cause could affect.** Only hand rows whose SKU is on the 19 listing pages are reachable. Besides the two, that is **174781** (OAKLYNN), and its stock already matches ("In stock"). Not fixed, as you asked. The other 13 hand rows are not on those pages at all, which is a different cause (coverage, not the rule).

**New draft version** of "Claude · Midas catalogue refresh" (`mGgKxO0638I77meF`): version **`c0722832`**, not published.
- R4: a hand row whose SKU is on the list `174770, 174788` gets the listing's stock. Nothing else on it changes.
- R4: a mode switch. `hand-stock-only` (set in this version) holds back every other write: no insert, no update of imported rows. `full` restores the 16 Oct behaviour plus the new rule. Changing it needs your go.
- R5: new output `hand_stock`. R8 (new): updates `availability` only, matched by row id **and** SKU.

**Tests.**
- Local: 17 of 17 pass (`tests/claude-midas-catalogue-refresh/run_tests_hand_stock.js`).
- Pinned n8n run **466**: no Midas read and no table write. Both hand rows reached R8 with availability only; nothing reached the insert or update nodes. The table was read back unchanged afterwards.
- The older refresh test now runs R4 in `full` mode.

**Live run** (you approved the update, 00:08): execution **468**, 00:20:39 to 00:23:44 Amman, version `c0722832`, from n8n.**
- It read all 19 listing pages (19 of 19 answered; 415 items; 10 s apart).
- It wrote **only these two values**:

| Row | SKU | Field | Before | After | Source page (Kuwait /en/ listing link) |
|---|---|---|---|---|---|
| 6 | 174770 RENESMEE table lamp | availability | Out of stock (read 28 Sep) | In stock | https://midasfurniture.com/en/renesmee-table-lamp-white-and-silver-accessories-174770-midasunited-arab-emirates.html |
| 8 | 174788 white/gold table lamp | availability | Pre-Order (read 28 Sep) | In stock | https://midasfurniture.com/en/table-lamp-white-and-goild-accessories-174788-midasunited-arab-emirates.html |

- Held back by the mode: 412 imported-row updates and 0 inserts. The insert and update nodes did not run.
- **Read back from n8n at 00:24:** rows 6, 8 and 16 are the only rows changed since 15 Oct. The table still has 428 rows. On rows 6 and 8, every field except availability is unchanged.

### Open questions for you

1. **Approve the five facet lists?** Approve as they are, or tell me which values to leave out. Nothing is renamed or merged either way. After approval, the spec card change is built as its own A7 draft (after Phase 2), with your go.
2. **Date read on rows 6 and 8.** `retrieved` still says 28 Sep, because you allowed the stock field only. A7's shortlist shows that date beside the stock. Should `retrieved` (or a note) record 17 Oct for the stock reading?
3. **Pre-order on the listing.** The listing gives only in stock or not (0 or 1). On a hand row that says "Pre-Order", the listing cannot show pre-order. If such a row's listing flag were 0, the rule would write "Out of stock". Neither of today's two rows hit this. Keep the rule, or skip hand rows that say "Pre-Order"?
4. **Refresh mode.** It stays `hand-stock-only`. Switching to `full` (new SKUs and imported-row refresh) needs your go.

### Leftovers (17 Oct)

- Workflow "Claude · scratch · SANOVA 161283 inactive flag" (`l3vyijYZQDLkR9oc`), not published, and its execution 467. Kept as the undo path; safe to archive.
- Refresh executions 466 (pinned, no write) and 468 (live: two values written).
- Table changes: row 16 `active` false; rows 6 and 8 `availability` "In stock".
- Repo: `data/claude-midas-site-reads-2026-10-17/`, `data/claude-midas-facets-site-2026-10-17.json`, `tools/claude-midas-facet-snapshot.py`, `tests/claude-midas-catalogue-refresh/run_tests_hand_stock.js`, and the updated refresh export and R4 code.
- Earlier reads typed by hand from page output (00:10) were not used. Only the hash-checked files were.

## Update, 17 Oct 2026, 01:0x: your decisions of 00:36 and 00:37

Everything stays in draft. No publish, no paid call. Facts below were checked in n8n at 00:5x–01:0x.

### 1. Facets: approved as a raw snapshot

- **The snapshot file is unchanged, byte for byte:** `data/claude-midas-facets-site-2026-10-17.json`, sha256 `06b6faed11cf2d642b9f36be8af53e2c9f9b62faca8f3a9c3f8d620f12d2ece1`.
- **New file beside it, with the approval record:** `data/claude-midas-facets-approval-2026-10-17.json`. It holds:
  - your decision, with the read window (17 Oct, 00:12–00:19 Amman);
  - the hashes of the snapshot and of the two raw read files;
  - **the 18 category URLs** that gave filter lists, each with its read time and the filters seen;
  - the two other pages read and why they don't count: outdoor furniture (200, no filter lists) and the SANOVA product page (404);
  - the rules.
- **Rules in code:** `tools/claude-midas-facet-rules.js`.
  - Matching is case-insensitive: "Faux leather" = "Faux Leather", and both spellings stay.
  - "Stainless Steel" and "Exposed" are held: they are not offered as fabric choices. Stainless Steel is still offered as a material and as a handle.
  - A value not on a list is kept as read and logged `not in snapshot: <facet> "<value>" (kept as read)`. It is never rejected or replaced; "Velvets" stays "Velvets".
  - Nothing is ever edited: the product and the snapshot come back unchanged.
- **Tests:** 24 of 24 pass (`tests/claude-midas-facet-rules/run_tests_facet_rules.js`), against the real snapshot and its hash.
- **Not done:** the spec card and A7 do not use the rules yet. Connecting them is a client-page or A7 change. It comes as its own draft, after Phase 2, with your go.

### 2. Stock-checked field

- New column `stock_checked` (text) on the catalogue table `lwJbRv4TVqlFTILl`.
- Rows 6 (174770) and 8 (174788) now say: "17 Oct 2026, 00:20–00:23 Amman, refresh run 468; listing said In stock".
  - Written by the scratch workflow `q72277Upxzw71CVw`, execution 469.
  - `retrieved` stays 2026-09-28 on both.
- **The refresh fills it on every stock write.** That covers inserts, imported-row updates, hand-stock updates, and pre-order evidence or flags. The format is "<date>, <HH:MM> Amman, refresh run <execution>; listing said <stock>".
  - It never writes `retrieved` on a hand row.

### 3. Hand rows marked "Pre-Order"

**Rules in the refresh draft:**

| What the refresh sees | What it does |
|---|---|
| Listing says In stock | `availability` → "In stock", plus `stock_checked` |
| Listing says out of stock | Keep "Pre-Order". Write `stock_checked` only, ending "kept "Pre-Order" (owner rule, 17 Oct 2026); FLAG for the owner" |
| Not on the listing | Read the product page (R10) and the Kuwait sitemap (R11), then R12 decides |
| Product page 404 **and** not in the sitemap | `active` → false, with `stock_checked` (as for SANOVA). Nothing deleted |
| Product page 404 but in the sitemap, or the sitemap unreadable | No change, flagged |
| Pre-order label or button on the product page | No change. The label is recorded as the evidence (for example "pre-order button on the page ("Pre-Order Now")") |
| Product page says in stock, says out of stock, shows another SKU, or does not answer | No change, flagged. Only the listing changes stock |

- A label counts only with a buying control on the page, and a button only as `<button>` or `<input>`. So a menu link like "Pre-order collection" is not evidence.
- **Tests:** 25 of 25 pass (`run_tests_preorder.js`) and 17 of 17 (`run_tests_hand_stock.js`, updated: stock writes now carry two fields). The older refresh test passes. Audit tests: 40 of 40.

**Refresh draft:** "Claude · Midas catalogue refresh" (`mGgKxO0638I77meF`).
- Version **`040930df`**, 19 nodes, **not published**.
- The weekly schedule trigger (Saturday 04:00 Amman, P3.2) is in it. It fires only if the workflow is published, which needs your go.
- Mode is still `hand-stock-only`.
- **Pinned test, execution 470:** no table write. Every write node was pinned "no write in test".
  - Read back afterwards: the table still has 428 rows.
  - No row changed after 00:38 (rows 6 and 8, the `stock_checked` backfill).
- **Not run live since.** On the next live run, the three hand rows still marked "Pre-Order" get these rules: 158478 DUVAIRA (row 3), 162510 FERNLAY (row 5), 170143 WEX (row 14). None of them is on the 19 listing pages, so each goes through its product page and the sitemap.
- **Export:** `n8n/claude-midas-catalogue-refresh/workflow-mGgKxO0638I77meF.json`. It was rebuilt from the 16 Oct export plus the 00:36 update exactly as sent, with node ids from the n8n read-back. Its connections match the read-back. The R4, R9 and R12 code matches the files in `code-nodes/`.
  - This is a check against what was sent, not a byte read-back: the read-back was too large to save to a file.
- **Cosmetic, not fixed:**
  - R8's note still says "only availability, only 174770 and 174788". It now writes availability and `stock_checked`, and it also takes "Pre-Order → In stock" rows.
  - R8 and R10 sit at the same canvas position.

### 4. P3.1 plan (no rows written)

`claude-outputs/claude-midas-p3-1-sitemap-plan-2026-10-17.md`.
- The Kuwait sitemap lists **1,788 accessory product pages**. **1,554** of them are not in the catalogue.
- Reading them all takes about 4 h 45 min at one page every 11 s.
- Three decisions for you: scope, out-of-stock pages, and how batches run.

### Leftovers (17 Oct, 01:0x)

- Scratch workflows, not published:
  - `l3vyijYZQDLkR9oc` (SANOVA flag, execution 467);
  - `q72277Upxzw71CVw` (`stock_checked` backfill, execution 469);
  - `dB5mXV1fgKSG6uFz` (dining photo hash check, execution 471: Drive reads only);
  - `QKNubeKlqZhyU9sx` (P3.1 sitemap count; executions 472, which holds a 9.7 MB copy of the sitemap in its data, and 473).
  - All are safe to archive.
- Refresh executions 466 and 470 (pinned, no write) and 468 (live).
- Table: column `stock_checked`; row 16 `active` false; rows 6 and 8 availability and `stock_checked`.
