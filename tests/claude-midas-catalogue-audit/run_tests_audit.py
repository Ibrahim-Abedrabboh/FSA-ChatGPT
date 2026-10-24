#!/usr/bin/env python3
"""Local tests for tools/claude-midas-catalogue-audit.py (16 Oct 2026). Code-made data only; no network, no n8n.
Run: python3 -I tests/claude-midas-catalogue-audit/run_tests_audit.py"""
import importlib.util
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, '..', '..', 'tools', 'claude-midas-catalogue-audit.py')
spec = importlib.util.spec_from_file_location('audit', TOOL)
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

passed, failed = 0, []


def check(name, cond):
    global passed
    if cond:
        passed += 1
    else:
        failed.append(name)


def imp(i, sku, **kw):
    r = {'id': i, 'sku': sku, 'name': 'TEST ' + sku, 'kind': 'vase', 'url': 'https://midasfurniture.com/en/test-' + sku + '.html',
         'image_url': 'https://midasfurniture.com/media/catalog/product/0/0/' + sku + '.webp', 'dimensions': 'not confirmed',
         'finish': 'not confirmed', 'availability': 'In stock', 'retrieved': '2026-10-15',
         'notes': 'Imported 2026-10-15 from the public listing page (test).', 'active': True}
    r.update(kw)
    return r


def hand(i, sku, **kw):
    r = imp(i, sku, notes='', dimensions='10 × 10 × 10 cm', finish='Ceramic; white', retrieved='2026-10-14')
    r.update(kw)
    return r


def checks_of(findings, sku):
    return sorted(f['check'] for f in findings if f['sku'] == sku)


# 1. Hand or imported: only notes starting "Imported" belong to the refresh.
check('imported row is not hand', not A.is_hand(imp(1, '1')))
check('row with empty notes is hand', A.is_hand(hand(2, '2')))
check('row with other notes is hand', A.is_hand(hand(3, '3', notes='Added for draft A4.')))

# 2. Stock words.
check('in stock', A.norm_stock('In stock') == 'in_stock')
check('pre-order', A.norm_stock('Pre-Order') == 'pre_order')
check('out of stock', A.norm_stock('Out of stock') == 'out_of_stock')
check('mixed text is not in stock', A.norm_stock('In stock on the Saudi store; Kuwait page not found') == 'not_confirmed')
check('blank is not confirmed', A.norm_stock('') == 'not_confirmed')

# 3. Facet vocabulary: the real snapshot shape (nodes with id, name, parentId, kind only) gives no values.
snap = {'release': 'X', 'nodes': [{'id': 'accessories', 'name': 'Accessories', 'parentId': '', 'kind': 'category'},
                                  {'id': 'accessories/x', 'name': 'Cups And Glassware', 'parentId': 'accessories', 'kind': 'category'}]}
v = A.facet_vocabulary(snap)
check('no facets in a category-only snapshot', all(v[f] == [] for f in A.FACETS))
# A category name that contains a material word ("Glassware") is not a facet value.
m = A.map_facets(hand(4, '4', finish='Glass; clear'), v)
check('empty vocabulary maps nothing', all(m[f]['value'] == A.NC for f in A.FACETS))
check('empty vocabulary says why', m['material']['source'].startswith('no vocabulary'))

# 4. With a code-made vocabulary, only stated whole words map; imported "not confirmed" maps nothing.
v2 = A.facet_vocabulary({'facets': {'material': ['Ceramic', 'Metal'], 'colour_family': ['White']}, 'nodes': []})
check('facets block read', v2['material'] == ['Ceramic', 'Metal'] and v2['colour family'] == ['White'])
m2 = A.map_facets(hand(5, '5', finish='Ceramic; white'), v2)
check('stated material maps', m2['material']['value'] == 'Ceramic' and 'finish' in m2['material']['source'])
check('stated colour maps', m2['colour family']['value'] == 'White')
check('unstated facet stays open', m2['handles']['value'] == A.NC and m2['handles']['source'].startswith('no vocabulary'))
m3 = A.map_facets(imp(6, '6'), v2)
check('imported not confirmed maps nothing', m3['material']['value'] == A.NC and m3['material']['source'] == 'no stated value in the row')
m4 = A.map_facets(hand(7, '7', finish='Metallic paint', name='LAMP'), v2)
check('no partial-word match (Metallic is not Metal)', m4['material']['value'] == A.NC)
v3 = A.facet_vocabulary({'nodes': [{'id': 'f1', 'name': 'Velvet', 'parentId': 'fabric', 'kind': 'facet-value'}]})
check('facet-value nodes read', v3['fabric'] == ['Velvet'])

# 5. Audit rules.
rows = [
    imp(10, '100'),                                                   # clean imported row
    imp(11, '101', dimensions='40 × 40 cm'),                          # imported row with a size: not from the listing
    hand(12, '102', url='https://midasfurniture.com/ksa_en/x.html', notes='Details are from the Saudi store page.',
         availability='In stock on the Saudi store; Kuwait page not found on 2026-10-07'),
    hand(13, '103', finish='Engineered wood; marble-effect appearance'),
    hand(14, '104', dimensions='W42 × H60 cm; depth omitted', availability='Out of stock', retrieved='2026-09-28'),
    hand(15, '105'),                                                  # plain hand row, recent
    imp(16, '106', image_url=''),
    imp(17, '107', image_url='https://example.com/x.jpg'),
    imp(18, '108'), imp(19, '108'),                                   # duplicate SKU
    hand(20, '109', finish='Light blue; material not confirmed, the page fields disagree'),
    imp(21, '110', retrieved=''),
]
listing = [{'sku': '104', 'availability': 'In stock', 'retrieved': '2026-10-16', 'url': rows[4]['url']},
           {'sku': '105', 'availability': 'In stock', 'retrieved': '2026-10-16', 'url': 'https://midasfurniture.com/en/other.html'}]
F = A.audit(rows, listing, '2026-10-16')
check('clean imported row has no finding', checks_of(F, '100') == [])
check('imported size flagged', 'size_or_finish_without_source' in checks_of(F, '101'))
c102 = checks_of(F, '102')
check('other store: page flagged', 'page_outside_kuwait_en' in c102)
check('other store: values flagged', c102.count('size_or_finish_from_other_store') == 2)
check('other store: stock not clear', 'stock_not_clear' in c102)
check('reading by eye flagged', checks_of(F, '103').count('finish_read_by_eye') == 1)
c104 = checks_of(F, '104')
check('missing depth is incomplete, not a guess', 'size_incomplete' in c104 and 'finish_read_by_eye' not in c104)
check('hand stock differs from listing', 'hand_row_differs_from_listing' in c104)
check('old hand stock reading', 'stock_reading_old' in c104)
c105 = checks_of(F, '105')
check('recent hand row: source not recorded only, plus link differs', c105 == ['hand_row_link_differs_from_listing', 'size_or_finish_source_not_recorded', 'size_or_finish_source_not_recorded'])
check('no photo', 'no_photo' in checks_of(F, '106'))
check('photo not on Midas', 'photo_not_on_midas' in checks_of(F, '107'))
check('duplicate SKU on both rows', checks_of(F, '108').count('duplicate_sku') == 2)
check('disputed finish', 'size_or_finish_disputed' in checks_of(F, '109'))
check('no read date', 'no_read_date' in checks_of(F, '110'))
check('imported rows never get hand-row checks', not any(f['check'].startswith('hand_row') for f in F if not f['hand_row']))
check('every finding has a proposed fix', all(f['proposed_fix'] for f in F))

# 6. The audit never changes its input.
before = json.dumps(rows, sort_keys=True)
A.audit(rows, listing, '2026-10-16')
check('input rows unchanged', json.dumps(rows, sort_keys=True) == before)

# 7. End to end through main(): files written, taxonomy read unchanged (.js and .json give the same result).
with tempfile.TemporaryDirectory() as d:
    tj = os.path.join(d, 'taxonomy.json')
    tjs = os.path.join(d, 'taxonomy.js')
    json.dump(snap, open(tj, 'w'))
    open(tjs, 'w').write('window.MIDAS_TAXONOMY = ' + json.dumps(snap) + ';\n')
    raw_before = open(tj, 'rb').read()
    json.dump({'rows': rows}, open(os.path.join(d, 't.json'), 'w'))
    json.dump({'rows': listing}, open(os.path.join(d, 'l.json'), 'w'))
    outs = []
    for t in (tj, tjs):
        oa, of = os.path.join(d, 'a.json'), os.path.join(d, 'f.json')
        A.main(['--table', os.path.join(d, 't.json'), '--listing', os.path.join(d, 'l.json'), '--taxonomy', t, '--date', '2026-10-16', '--out-audit', oa, '--out-facets', of])
        fa, ff = json.load(open(oa)), json.load(open(of))
        outs.append((fa['summary'], [x['values'] for x in ff['facets']], ff['rows_mapped']))
    check('main wrote both files', fa['summary']['rows'] == len(rows) and len(ff['rows']) == len(rows))
    check('json and js taxonomy give the same result', outs[0] == outs[1])
    check('taxonomy file not changed', open(tj, 'rb').read() == raw_before)
    check('facet file states the finding', 'defines none of the five facets' in ff['finding'])

print(passed, 'of', passed + len(failed), 'pass')
if failed:
    print('FAILED:', failed)
    sys.exit(1)
