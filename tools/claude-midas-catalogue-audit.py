#!/usr/bin/env python3
"""Claude · Midas catalogue audit and facet map (Phase 3, P3.3 and P3.4; 16 Oct 2026).

Reads only files. No network, no AI, no write to n8n.

Inputs
  --table     JSON snapshot of the A7 catalogue table (n8n data table lwJbRv4TVqlFTILl), {"rows": [...]}
  --listing   the 16 Oct listing read (data/claude-midas-accessories-2026-10-16.json), used to compare hand rows
  --taxonomy  the Midas Kuwait taxonomy snapshot (taxonomy.json or taxonomy.js, 29 Sep 2026), read unchanged
  --date      the audit date (YYYY-MM-DD), used for the age of stock readings
  --out-audit, --out-facets   output files

Rules
  - Nothing is guessed. A facet value is written only when the taxonomy snapshot defines the facet vocabulary
    AND a row field states a value from that vocabulary. Otherwise the facet is "not confirmed".
  - The audit only reports. It never changes a row; every fix is a proposal for the owner.
"""
import argparse
import collections
import datetime
import hashlib
import json
import re
import sys

NC = 'not confirmed'
FACETS = ['fabric', 'material', 'table top', 'colour family', 'handles']
KUWAIT_EN = re.compile(r'^https://(www\.)?midasfurniture\.com/en/', re.I)
MIDAS_PHOTO = re.compile(r'^https://(www\.)?midasfurniture\.com/media/catalog/product/', re.I)
# Words that show a value was read by eye (photo or page picture), not stated in a page field.
READING = re.compile(r'\b(appearance|appears?|visible|visibly|looks?|not independently verified)\b', re.I)
# Words that show the page fields disagree or the value is open.
DISPUTED = re.compile(r'\b(disagree|disagrees|not confirmed)\b', re.I)
# Words that show a part of the value is missing (honest, not a guess).
INCOMPLETE = re.compile(r'\b(omitted|missing)\b', re.I)
# Words that show the value came from another country store.
OTHER_STORE = re.compile(r'\b(saudi|ksa|uae|emirates|qatar|bahrain|oman)\b', re.I)
STALE_DAYS = 7


def load_taxonomy(path):
    raw = open(path, 'rb').read()
    text = raw.decode('utf-8')
    if path.endswith('.js'):
        text = text[text.index('{'):text.rindex('}') + 1]
    tax = json.loads(text)
    return tax, hashlib.sha256(raw).hexdigest()


def facet_vocabulary(tax):
    """Return {facet: [values]} as the snapshot defines them. Looks for a top-level 'facets' block and for
    nodes whose kind is 'facet' or 'facet-value'. The 29 Sep 2026 snapshot has neither, so every list is empty."""
    vocab = {f: [] for f in FACETS}
    block = tax.get('facets') if isinstance(tax, dict) else None
    if isinstance(block, dict):
        for f in FACETS:
            for key in (f, f.replace(' ', '_'), f.replace(' ', '-'), f.replace('colour', 'color')):
                vals = block.get(key)
                if isinstance(vals, list):
                    vocab[f] = [str(v).strip() for v in vals if str(v).strip()]
                    break
    for n in tax.get('nodes', []) if isinstance(tax, dict) else []:
        if n.get('kind') in ('facet', 'facet-value'):
            f = str(n.get('facet') or n.get('parentId') or '').strip().lower().replace('_', ' ').replace('-', ' ').replace('color', 'colour')
            if f in vocab and str(n.get('name') or '').strip():
                vocab[f].append(str(n['name']).strip())
    return vocab


def is_hand(row):
    """The refresh marks its own rows: notes start with "Imported". Every other row was written by hand."""
    return not str(row.get('notes') or '').startswith('Imported')


def norm_stock(v):
    t = str(v or '').strip().lower()
    if re.search(r'out[\s-]*of[\s-]*stock|sold[\s-]*out|unavailable|discontinued', t):
        return 'out_of_stock'
    if t == 'in stock':
        return 'in_stock'
    if t in ('pre-order', 'pre order', 'preorder'):
        return 'pre_order'
    return 'not_confirmed'


def map_facets(row, vocab):
    """Map one row to the five facets. A value is kept only when a vocabulary value appears, as a whole word,
    in a field that states facts (finish, name). With an empty vocabulary every facet is "not confirmed"."""
    out = {}
    for f in FACETS:
        vals = vocab.get(f) or []
        hit = None
        if vals:
            for field in ('finish', 'name'):
                text = str(row.get(field) or '')
                if not text or text.strip().lower() == NC:
                    continue
                for v in vals:
                    if re.search(r'(?<![a-z])' + re.escape(v.lower()) + r'(?![a-z])', text.lower()):
                        hit = {'value': v, 'source': 'catalogue field "' + field + '" (row read on ' + str(row.get('retrieved') or 'unknown date') + ')'}
                        break
                if hit:
                    break
        out[f] = hit or {'value': NC, 'source': 'no vocabulary for this facet in the taxonomy snapshot' if not vals else 'no stated value in the row'}
    return out


def audit(rows, listing_rows, audit_date):
    findings = []
    add = lambda kind, row, detail, fix: findings.append({
        'check': kind, 'id': row.get('id'), 'sku': str(row.get('sku') or ''), 'name': row.get('name') or '',
        'hand_row': is_hand(row), 'detail': detail, 'proposed_fix': fix})
    listing = {str(r['sku']).strip(): r for r in listing_rows}
    day = datetime.date.fromisoformat(audit_date)

    # 1. Size and finish: imported rows must say "not confirmed"; hand rows carry page values without a per-field source.
    for r in rows:
        dims, fin = str(r.get('dimensions') or '').strip(), str(r.get('finish') or '').strip()
        if not is_hand(r):
            for field, v in (('dimensions', dims), ('finish', fin)):
                if v.lower() != NC:
                    add('size_or_finish_without_source', r, 'imported row has ' + field + ' "' + v + '", but the listing does not state it',
                        'set ' + field + ' back to "not confirmed" (the refresh may do this, since it owns imported rows)')
            continue
        other_store = bool(OTHER_STORE.search(str(r.get('notes') or ''))) or not KUWAIT_EN.match(str(r.get('url') or ''))
        for field, v in (('dimensions', dims), ('finish', fin)):
            if not v or v.lower() == NC:
                continue
            if other_store:
                add('size_or_finish_from_other_store', r, field + ' "' + v + '" comes from a page outside Midas Kuwait /en/',
                    'owner: replace it from the Kuwait /en/ product page, or set it to "not confirmed"')
            elif READING.search(v):
                add('finish_read_by_eye', r, field + ' "' + v + '": part of it is a reading ("' + READING.search(v).group(0) + '"), not a page field',
                    'owner: keep only what the Kuwait /en/ page states and record the page and date; the read-by-eye part goes to notes')
            elif DISPUTED.search(v):
                add('size_or_finish_disputed', r, field + ' "' + v + '": the row itself says the value is open',
                    'owner: confirm from the Kuwait /en/ product page, or set it to "not confirmed"')
            elif INCOMPLETE.search(v):
                add('size_incomplete', r, field + ' "' + v + '": a part is missing on the page, and the row says so',
                    'no change: the row already says which part is missing; that part stays "not confirmed"')
            else:
                add('size_or_finish_source_not_recorded', r, field + ' "' + v + '" was written by hand on ' + str(r.get('retrieved')) + '; the row does not say which page field it came from',
                    'no change needed for scenes today; when the row is next checked, note the page field and date in the notes')

    # 2. Pages outside Midas Kuwait English.
    for r in rows:
        u = str(r.get('url') or '')
        if not KUWAIT_EN.match(u):
            add('page_outside_kuwait_en', r, 'product link is ' + (u or 'blank'),
                'owner: give the Kuwait /en/ page for this SKU, or mark the row inactive (A7 step 10 and 19c already refuse it)')

    # 3. Duplicates.
    for key in ('sku', 'url', 'image_url'):
        seen = collections.defaultdict(list)
        for r in rows:
            v = str(r.get(key) or '').strip()
            if v:
                seen[v].append(r)
        for v, rs in seen.items():
            if len(rs) > 1:
                for r in rs:
                    add('duplicate_' + key, r, key + ' "' + v + '" appears in rows ' + ', '.join(str(x.get('id')) for x in rs),
                        'keep one row per SKU; owner chooses which')

    # 4. Photos.
    for r in rows:
        img = str(r.get('image_url') or '').strip()
        if not img:
            add('no_photo', r, 'no catalogue photo', 'A7 step 10 already refuses it; add the photo from the product page or mark inactive')
        elif not MIDAS_PHOTO.match(img):
            add('photo_not_on_midas', r, 'photo is ' + img, 'replace with the Midas catalogue photo')

    # 5. Hand rows against the 16 Oct listing.
    for r in rows:
        if not is_hand(r):
            continue
        l = listing.get(str(r.get('sku')).strip())
        if not l:
            continue
        a, b = norm_stock(r.get('availability')), norm_stock(l.get('availability'))
        if a != b:
            add('hand_row_differs_from_listing', r,
                'stock in the row: "' + str(r.get('availability')) + '" (read ' + str(r.get('retrieved')) + '); listing: "' + str(l.get('availability')) + '" (read ' + str(l.get('retrieved')) + ')',
                'owner: allow the refresh to update stock on this hand row, or update it by hand; A7 checks the live page again at scene time either way')
        if str(r.get('url') or '').strip() != str(l.get('url') or '').strip():
            add('hand_row_link_differs_from_listing', r, 'link in the row differs from the listing link ' + str(l.get('url')), 'owner: keep the listing link')

    # 6. Stock readings and their age (information for the owner; D10 keeps only "In stock").
    for r in rows:
        try:
            age = (day - datetime.date.fromisoformat(str(r.get('retrieved'))[:10])).days
        except ValueError:
            add('no_read_date', r, 'retrieved is "' + str(r.get('retrieved')) + '"', 'A7 step 10 refuses a row with no date; add the date it was read')
            continue
        if is_hand(r) and age > STALE_DAYS:
            add('stock_reading_old', r, 'stock "' + str(r.get('availability')) + '" read ' + str(age) + ' days ago (' + str(r.get('retrieved')) + ')',
                'no change needed for scenes (19c reads the live page); refresh the row so the shortlist is not built on old stock')
        s = norm_stock(r.get('availability'))
        if s == 'not_confirmed':
            add('stock_not_clear', r, 'availability is "' + str(r.get('availability')) + '"', 'A7 does not offer it; owner decides whether to keep the row')
    return findings


def summarise(rows, findings):
    by = collections.Counter(f['check'] for f in findings)
    stock = collections.Counter(norm_stock(r.get('availability')) for r in rows)
    return {'rows': len(rows), 'hand_rows': sum(1 for r in rows if is_hand(r)), 'imported_rows': sum(1 for r in rows if not is_hand(r)),
            'stock_as_recorded': dict(stock), 'findings_by_check': dict(sorted(by.items())),
            'rows_with_a_finding': len({f['id'] for f in findings})}


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--table', required=True)
    p.add_argument('--listing', required=True)
    p.add_argument('--taxonomy', required=True)
    p.add_argument('--date', required=True)
    p.add_argument('--out-audit', required=True)
    p.add_argument('--out-facets', required=True)
    a = p.parse_args(argv)
    rows = json.load(open(a.table, encoding='utf-8'))['rows']
    listing = json.load(open(a.listing, encoding='utf-8'))['rows']
    tax, tax_sha = load_taxonomy(a.taxonomy)
    vocab = facet_vocabulary(tax)
    kinds = collections.Counter(n.get('kind') for n in tax.get('nodes', []))
    facet_rows = [{'id': r.get('id'), 'sku': str(r.get('sku') or ''), 'hand_row': is_hand(r), 'facets': map_facets(r, vocab)} for r in rows]
    mapped = sum(1 for fr in facet_rows for f in FACETS if fr['facets'][f]['value'] != NC)
    facets_out = {
        'title': 'Claude · Midas facet vocabulary and catalogue facet map',
        'made': a.date, 'made_by': 'tools/claude-midas-catalogue-audit.py',
        'taxonomy': {'file': a.taxonomy, 'sha256': tax_sha, 'release': tax.get('release'), 'date': tax.get('date'), 'market': tax.get('market'),
                     'nodes': len(tax.get('nodes', [])), 'node_kinds': dict(kinds), 'node_fields': sorted({k for n in tax.get('nodes', []) for k in n})},
        'facets': [{'facet': f, 'values': vocab[f], 'status': 'defined in the snapshot' if vocab[f] else 'not in the snapshot: no values to supply'} for f in FACETS],
        'finding': ('The taxonomy snapshot defines none of the five facets. It holds categories, sections and item types only. '
                    'So no catalogue row can be mapped to a facet value, and every facet stays "not confirmed".') if not any(vocab.values()) else '',
        'rows_mapped': mapped, 'rows': facet_rows,
        'use_in_a7': 'Not in A7. Proposal only (see the Phase 3 README).'}
    findings = audit(rows, listing, a.date)
    audit_out = {'title': 'Claude · Midas A7 catalogue audit', 'made': a.date, 'table_snapshot': a.table, 'listing': a.listing,
                 'summary': summarise(rows, findings), 'findings': findings,
                 'note': 'Report only. No row was changed. Every fix is a proposal for the owner.'}
    json.dump(facets_out, open(a.out_facets, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(audit_out, open(a.out_audit, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'facets': [(f['facet'], len(f['values'])) for f in facets_out['facets']], 'rows_mapped': mapped, 'audit': audit_out['summary']}, indent=1))


if __name__ == '__main__':
    sys.exit(main())
