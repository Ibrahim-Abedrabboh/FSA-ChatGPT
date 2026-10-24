#!/usr/bin/env python3
"""Claude · Midas facet snapshot (17 Oct 2026). Builds the dated facet snapshot from saved filter-list reads.

Input: one or more JSON files, each a list of page reads made in the browser on the public Midas Kuwait /en/ site:
  {"u": page URL, "status": HTTP status, "read": ISO time, "title": page title,
   "filters": [[filter title as shown, "list"|"swatch"|"none", [values as shown, in page order]], ...]}
Output: data/claude-midas-facets-site-<date>.json

Rules (owner, 17 Oct 2026, 00:08):
- Values are copied word for word. Nothing is renamed, merged, corrected or added.
  Two spellings stay two values (for example "Faux Leather" and "Faux leather").
- A facet takes values only from the filter whose title is that facet on the site (FACET_FILTERS below).
  Other filters that look related (for example "Table Frame Material", "Inner Material", "Headboard") are listed apart, unmerged.
- Each value keeps the pages where it was seen.
- Not used by A7 until the owner approves the lists.
"""
import collections
import json
import sys

# The owner's five facets -> the filter title the Midas Kuwait /en/ site shows for it (read 17 Oct 2026).
FACET_FILTERS = {
    'fabric': 'Fabric Type',
    'material': 'Material',
    'table top': 'Table Top Material',
    'colour family': 'Family Color',
    'handles': 'Handles Materials',
}
NOT_FACETS = {'Price', 'Discount Filter', 'Brand', 'Category'}


def build(reads, made):
    pages = [r for r in reads if r.get('status') == 200]
    facets = []
    for facet, title in FACET_FILTERS.items():
        seen = collections.OrderedDict()
        for r in pages:
            for f in r.get('filters', []):
                if f[0] == title:  # exact title only
                    for v in f[2]:
                        seen.setdefault(v, []).append(r['u'])
        facets.append({'facet': facet, 'site_filter': title, 'values': list(seen.keys()),
                       'seen_on': {v: u for v, u in seen.items()},
                       'pages_with_filter': sorted({r['u'] for r in pages for f in r.get('filters', []) if f[0] == title})})
    others = collections.OrderedDict()
    for r in pages:
        for f in r.get('filters', []):
            if f[0] in NOT_FACETS or f[0] in FACET_FILTERS.values():
                continue
            o = others.setdefault(f[0], collections.OrderedDict())
            for v in f[2]:
                o.setdefault(v, []).append(r['u'])
    return {
        'title': 'Claude · Midas facet lists, Midas Kuwait /en/ site filters',
        'made': made, 'made_by': 'tools/claude-midas-facet-snapshot.py',
        'source': 'https://midasfurniture.com/en/ (category pages; filter lists as shown on page 1; no filter link was opened)',
        'status': 'Snapshot for the owner to review. Not used by A7 or the spec card until the owner approves.',
        'rules': 'Values copied word for word in page order; first page first. No rename, merge or addition. Counts shown on the site are not kept.',
        'pages': [{'url': r['u'], 'status': r.get('status'), 'read_utc': r.get('read') or r.get('at'), 'title': r.get('title', ''),
                   'filters_seen': [f[0] for f in r.get('filters', [])]} for r in reads],
        'facets': facets,
        'other_filters_not_used': [{'site_filter': k, 'values': list(v.keys())} for k, v in others.items()],
    }


def main(argv):
    made, out, files = argv[0], argv[1], argv[2:]
    reads = []
    for p in files:
        reads.extend(json.load(open(p, encoding='utf-8')))
    snap = build(reads, made)
    json.dump(snap, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for f in snap['facets']:
        print(f['facet'], '<-', f['site_filter'], len(f['values']), 'values on', len(f['pages_with_filter']), 'pages')


if __name__ == '__main__':
    main(sys.argv[1:])
