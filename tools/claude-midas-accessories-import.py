#!/usr/bin/env python3
"""Claude · Midas accessories import (16 Oct 2026).

Reads the first page of each scene-relevant Accessories category on the public Midas Kuwait site
(https://midasfurniture.com/en/accessories/...) and writes one row per product for the A7 catalogue table.

Rules followed:
- robots.txt (read 16 Oct 2026): "Crawl-delay: 10" for all crawlers, and query strings with "=" are disallowed.
  So this script waits 10 s between requests and reads only page 1 of each category (no ?p=2). It is a sample of
  each category (the site's default order), not the whole catalogue.
- Only what the listing page states is recorded: SKU (data-product-sku), name, product link, catalogue photo,
  price in KWD, the in-stock flag (data-in-stock) and the category. Dimensions and finish are not on the listing,
  so they stay "not confirmed". Nothing is guessed.
- No login, no cart, no account pages, no keys.

Usage: python3 -I tools/claude-midas-accessories-import.py OUT_DIR
Writes OUT_DIR/raw/<slug>.html (the pages read) and OUT_DIR/claude-midas-accessories-<date>.json.
"""
import html
import json
import os
import re
import sys
import time
import urllib.request

BASE = 'https://midasfurniture.com/en/accessories/'
UA = 'Mozilla/5.0 (compatible; claude-midas-catalogue-import; owner-approved read of public listings)'
DELAY_S = 10
# Category path -> the "kind" written to the catalogue (A7 step 10 compares kinds by their last word).
CATEGORIES = [
    ('lighting/table-lamps', 'table lamp'),
    ('lighting/floor-lamps', 'floor lamp'),
    ('lighting/hanging-and-ceiling-lamps', 'ceiling lamp'),
    ('lighting/wall-lamp', 'wall lamp'),
    ('soft-furnishings/cushions', 'cushion'),
    ('soft-furnishings/throws', 'throw'),
    ('soft-furnishings/rugs', 'rug'),
    ('soft-furnishings/bedding-set', 'bedding set'),
    ('wall-decor/wall-arts', 'wall art'),
    ('wall-decor/mirrors', 'mirror'),
    ('wall-decor/wall-clock', 'wall clock'),
    ('decor-accessories/vases-and-pots', 'vase'),
    ('decor-accessories/flowers', 'artificial plant'),
    ('decor-accessories/candle-holders', 'candle holder'),
    ('decor-accessories/photo-frames', 'photo frame'),
    ('table-accessories/deco-figurines-and-objects', 'decor object'),
    ('table-accessories/table-runners', 'table runner'),
    ('table-accessories/clocks', 'table clock'),
    ('kitchen-and-dining/trays', 'tray'),
]


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'en'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode('utf-8', 'replace')


def parse(page, cat_path, kind, read_on):
    rows = []
    for m in re.finditer(r'<li class="item product product-item[^"]*">(.*?)</li>', page, re.S):
        b = m.group(1)
        link = re.search(r'class="product-item-link" href="([^"]+)">\s*([^<]+?)\s*</a>', b)
        sku = re.search(r'data-product-sku="([^"]+)"', b) or re.search(r'"Product Id":"([^"]+)"', b)
        img = re.search(r'data-src="(https://midasfurniture\.com/media/catalog/product/[^"?]+)', b)
        stock = re.search(r'data-in-stock="(\d)"', b)
        price = re.search(r'data-price-type="finalPrice"[^>]*>\s*<span class="price">([0-9.,]+)\s*KWD', b) or \
            re.search(r'data-price-amount="([0-9.]+)" data-price-type="finalPrice"', b)
        if not (link and sku):
            continue
        rows.append({
            'sku': html.unescape(sku.group(1)).strip(),
            'name': html.unescape(link.group(2)).strip(),
            'kind': kind,
            'url': link.group(1),
            'image_url': img.group(1) if img else '',
            'dimensions': 'not confirmed',
            'finish': 'not confirmed',
            'availability': ('In stock' if stock.group(1) == '1' else 'Out of stock') if stock else 'not confirmed',
            'retrieved': read_on,
            'notes': 'Imported 16 Oct 2026 from the public listing page ' + BASE + cat_path + '.html (page 1 only; robots.txt allows no page 2). '
                     + 'Price on that day: ' + (price.group(1).replace(',', '') + ' KWD' if price else 'not read')
                     + '. Dimensions and finish are not on the listing: not confirmed.',
            'active': True,
            'tags_basis': '',
        })
    return rows


def main():
    out = sys.argv[1]
    os.makedirs(os.path.join(out, 'raw'), exist_ok=True)
    read_on = time.strftime('%Y-%m-%d')
    allrows, log = [], []
    for i, (path, kind) in enumerate(CATEGORIES):
        if i:
            time.sleep(DELAY_S)
        url = BASE + path + '.html'
        try:
            status, page = fetch(url)
        except Exception as e:  # noqa: BLE001 - every failure is logged, nothing is retried
            log.append({'category': path, 'url': url, 'status': 'error', 'problem': str(e)[:200], 'rows': 0})
            continue
        open(os.path.join(out, 'raw', path.replace('/', '__') + '.html'), 'w', encoding='utf-8').write(page)
        total = re.search(r'toolbar-number">(\d+)</span>\s*</span>\s*<span class="toolbar-number">\d+</span>\s*<span class="toolbar-number">(\d+)', page)
        tot = re.findall(r'toolbar-number">(\d+)', page)
        rows = parse(page, path, kind, read_on)
        allrows.extend(rows)
        log.append({'category': path, 'url': url, 'status': status, 'rows': len(rows), 'category_total_on_site': int(tot[2]) if len(tot) >= 3 else (int(tot[0]) if tot else None)})
        print(path, status, len(rows), 'of', log[-1]['category_total_on_site'], flush=True)
    # One row per SKU: an item listed in two categories keeps its first category.
    seen, uniq = set(), []
    for r in allrows:
        if r['sku'] in seen:
            continue
        seen.add(r['sku'])
        uniq.append(r)
    res = {'read_on': read_on, 'source': BASE, 'robots': 'Crawl-delay 10 s honoured; page 1 per category only', 'categories': log,
           'rows_read': len(allrows), 'rows_unique': len(uniq), 'rows': uniq}
    p = os.path.join(out, 'claude-midas-accessories-' + read_on + '.json')
    json.dump(res, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', p, len(uniq), 'unique rows')


if __name__ == '__main__':
    main()
