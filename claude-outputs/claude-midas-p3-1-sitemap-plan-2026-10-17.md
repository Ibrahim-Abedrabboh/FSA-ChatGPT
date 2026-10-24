# P3.1 plan: the rest of the accessories, from the Kuwait sitemap

17 Oct 2026, 01:0x Amman. Written by Claude. **A plan only. No rows were written, and none will be until you approve it.**

## What was read (free, read-only)

- **Scratch workflow:** "Claude · scratch · P3.1 sitemap count" (`QKNubeKlqZhyU9sx`). Unpublished, manual, writes nothing.
- **Execution 473**, 17 Oct 2026, 00:56 Amman. It made one read of https://midasfurniture.com/sitemap/kw_en/kw_en_sitemap.xml (status 200, 9,712,203 bytes) and one read of the A7 catalogue table (428 rows).
- **Execution 472** (00:55) read the same sitemap once, with an HTTP node. Its stored data held the whole 9.7 MB page and could not be shown. I moved the read into the Code node and ran it again, so the sitemap was read **twice**, about 78 s apart. That is within robots.txt (10 s gap).

| Count | Value |
|---|---|
| Addresses in the sitemap | 5,657 (5,656 on 17 Oct, 00:19) |
| Kuwait `/en/` .html addresses | 5,623 |
| Product pages (directly under `/en/`, no folder) | 5,410 |
| **Accessory product pages** (`-accessories-` in the address) | **1,788** |
| Of those, with a 6-digit SKU in the address | 1,140 |
| Already in the A7 catalogue (same address or SKU) | 234 |
| **Not yet in the catalogue** | **1,554** |

Words in the addresses of the 1,554. These are indicative only: one address can match several words, and the sitemap gives no category.

| Word | Count | Word | Count |
|---|---|---|---|
| flower | 279 | candle | 71 |
| vase | 248 | sculpture | 62 |
| cushion | 140 | lamp | 45 |
| plant | 93 | bowl | 29 |
| mirror | 85 | tree | 24 |
| wall-art | 83 | planter | 23 |
| | | none of the 26 words | 345 |

The 345 with none of the words include non-scene items, for example fireproof safes, privacy screens, trolleys, book shelves and chess pieces.

**What the sitemap does not give:** stock, price, category, size or photo. Each of these needs the product's own page.

## Proposed method

1. **A new numbered draft**, "Claude · Midas catalogue sitemap import". Unpublished, with its own run log. The refresh workflow is not changed.
2. **Pages to read:** the 1,554 addresses above. One page every 11 s (robots.txt: 10 s).
   - About **4 h 45 min** in total.
   - Run in batches of about 300 pages (about 55 min each), so no single run is long. Each batch skips what is already in the table, so a stopped batch can simply be run again.
3. **From each page, only what it states:**
   - SKU, name, the breadcrumb category, the stock state, the price in KWD, and the main catalogue photo.
   - Size and finish only if the page lists them. Otherwise "not confirmed".
   - The pre-order label or button is recorded as evidence, as in the refresh.
4. **Kind:** taken from the page's breadcrumb, mapped to the 19 kinds the refresh already uses (table lamp, cushion, rug, wall art, mirror, vase and so on).
   - A page whose breadcrumb maps to none of them is **not written**. It is listed for you instead (safes, screens, trolleys and the like).
   - No kind is guessed from the address.
5. **Rows written:** like the refresh's imported rows.
   - notes "Imported <date> from the product page <URL>";
   - `retrieved` = the day read;
   - `stock_checked` = when, which run, and what the page said.
   - Hand rows are never touched.
   - Facet values (fabric, material, colour) are checked against the approved facet snapshot. A value not on a list is kept as read and logged "not in snapshot".
6. **Order of work:**
   - (a) local tests with saved pages;
   - (b) a pinned n8n test with no Midas read and no write;
   - (c) a **dry run** of one batch that reads pages but writes nothing, and reports the rows it would write;
   - (d) your go;
   - (e) the batches that write.

## Decisions for you

1. **Scope:**
   - **(A)** all 1,554 pages, or
   - **(B)** only the pages whose breadcrumb maps to a scene kind. All 1,554 must still be read to know the breadcrumb, so (B) saves table rows, not reading time.
2. **Out-of-stock pages:**
   - write them as "Out of stock" (A7 uses in-stock only at scene time, D10), or
   - leave them out.
3. **Batches:** run them by hand one at a time, or as a single scheduled weekend run. A schedule needs publishing, which needs your go.

## Not done

- No product page was read.
- No row was written, and no workflow other than the scratch one was created.
- The cost is free (no paid calls). The load on the Midas site is about 1,554 page reads, 11 s apart.
