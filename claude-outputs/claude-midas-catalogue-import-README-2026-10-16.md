# Claude · Midas accessories catalogue: import and refresh

16 Oct 2026, 02:45 Amman. Written by Claude. Built on the owner's answer of 16 Oct, 01:40 ("C then A": catalogue first). Source links from the owner: midasfurniture.com/en/amsitemap/ and /ar/amsitemap/.

Code and data: GitHub `Ibrahim-Abedrabboh/claude-midas-studio`, commit `7f7f655` (import and workflow) and the commit that adds this README.

## Status

- Workflow "Claude · Midas catalogue refresh", `mGgKxO0638I77meF`, version `2b2be743`, 8 nodes. **Not published.**
- **Run once, by the owner, by hand**: execution 429, 16 Oct 2026, 02:06–02:09 Amman. Result: 412 rows inserted. My own attempt to run it was refused by this session's safety check (it changes a shared table), so I asked the owner.
- The A7 catalogue table now has **428 rows**: 16 written earlier by hand, plus 412 imported.
- No AI and no paid call. The workflow reads public Midas listing pages only.

## What it does

1. **R1** lists 19 Accessories categories on midasfurniture.com/en (lighting, cushions, throws, rugs, bedding, wall art, mirrors, clocks, vases, flowers, candle holders, frames, figurines, table runners, trays). Each category has a "kind" (for example "table lamp", "rug").
2. **R2** reads page 1 of each category, one page every 10 seconds (robots.txt asks for a 10-second delay).
3. **R3** reads the A7 catalogue table.
4. **R4** reads what each listing states and nothing else:
   - SKU, name, product link, catalogue photo, price in KWD, the in-stock flag, the category.
   - Dimensions and finish are not on the listing, so they are "not confirmed".
   - The notes say where and when the row was read, and the price on that day.
5. **Writes:**
   - a SKU not yet in the catalogue is inserted;
   - a row this refresh made earlier (notes start "Imported") is updated;
   - a row written by hand is never changed;
   - a SKU missing from today's pages is left as it is, because page 1 shows only part of a category;
   - if the catalogue table cannot be read, nothing is written (a SKU could be written twice).

A Python version of the same reader (`tools/claude-midas-accessories-import.py`) made the data file `data/claude-midas-accessories-2026-10-16.json`. The n8n parser gives the same rows as the Python reader (9 local tests).

## What came in

| | Rows |
|---|---|
| Read from 19 listing pages | 415 (379 in stock, 36 out of stock) |
| Listed on the site in those categories | 2,082 |
| Inserted | 412 |
| Kept unchanged (written by hand earlier) | 3: SKUs 174781, 174788, 174770 |

So the import covers about 20% of the listed accessories (415 of 2,082). Categories with many items (flowers 472, vases 384, figurines 255, wall art 213, cushions 185) are covered only by their first page.

## What was checked, and how

- 9 local tests: the n8n parser's output equals the Python import, row for row; the write rules (insert, update, keep hand rows, no write when the table is unreadable).
- The product page format was read once with a web reader, to confirm what stage 07 checks at scene time ("In stock", "Product Size : …").
- The owner's run: success, 412 inserted.

## What was not checked

- Pages 2 and later of each category. robots.txt disallows addresses with "=", which the site uses for page 2, so they were not read.
- Arabic pages (/ar/). Names are English only.
- Dimensions and finish of the imported pieces: "not confirmed" for all 412.
- Stock is as listed on 16 Oct 2026. It changes. Stage 07 reads each piece's own page again at scene time and drops any piece that is not clearly in stock.

## Known issues

- **Date:** the rows say "retrieved 2026-10-15", because n8n stamps the date in UTC and the run was at 23:06 UTC on 15 Oct (02:06 on 16 Oct in Amman).
- **Hand-written rows are older.** SKU 174770 (RENESMEE table lamp) says "out of stock as read on 28 Sep" in its hand-written row. The listing now says "In stock". A7 follows the table, so it does not offer this lamp. The refresh does not change hand rows by design.
- Each category's kind comes from its category, not from the item. A few items may sit in a broad kind (for example "decor object").

## Assumptions

- The category-to-kind list in R1 is mine.
- "In stock" on the listing is taken as in stock for the shortlist; stage 07 confirms it again on the product page.

## Open, for the owner

1. **Schedule.** Should the refresh run on a schedule (for example weekly)? That needs publishing, which needs your word.
2. **Coverage.** Do you have another source for the full catalogue (a feed or an export)? Page 1 only gives about 20%.
3. **Hand-written rows.** Should the refresh update them too, or should someone update them by hand?

## Leftovers

- Workflow `mGgKxO0638I77meF` (meant to stay) and its execution 429.
- 412 new rows in the A7 catalogue table (meant to stay).
