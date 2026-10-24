# Re-scores reader test 3 (execution 461) against the corrected answer sheet (owner, 16 Oct 2026, 22:06): Test 3 = 6 modules,
# and the white-background piece outside the sectional is context (or uncertain), never product. No model call; reads the saved result.
# Run: python3 tests/claude-midas-a7-reader-test-3/rescore_corrected_sheet.py
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(os.path.join(ROOT, 'n8n/claude-midas-a7-reader-test-3/results-execution-461.json')))
rows = [r for r in d['score_output'][1:]]
TRUTH = {'Test 1': 2, 'Test 2': 2, 'Test 3': 6, 'Test 4': 4, 'Test 5': 4, 'Test 6': 6, 'Test 7': 2, 'Test 8': 1, 'Test 9': 7, 'Test 10': 7}
CROPPED = {'Test 9'}
out = []
for r in rows:
    f, t = r['folder'], r['test3']
    out.append({'photo': f, 'owner': TRUTH[f], 'test2': r['test2_count'], 'test3': t['count'],
                'test2_ok': r['test2_count'] == TRUTH[f], 'test3_ok': t['count'] == TRUTH[f],
                'crop_flag_ok': t['cropped_flag'] == (f in CROPPED), 'crop_after_box_ok': t['cropped_after_box_check'] == (f in CROPPED)})
t3 = next(r for r in rows if r['folder'] == 'Test 3')['test3']
white_label = [v for v in t3['views_not_pieces'] if re.search(r'white', v, re.I)]
summary = {
  'count_right_test3': sum(o['test3_ok'] for o in out), 'count_right_test2': sum(o['test2_ok'] for o in out), 'of': len(out),
  'wrong_test3': [o['photo'] for o in out if not o['test3_ok']], 'wrong_test2': [o['photo'] for o in out if not o['test2_ok']],
  'crop_flag_right': sum(o['crop_flag_ok'] for o in out), 'crop_after_box_right': sum(o['crop_after_box_ok'] for o in out),
  'test3_photo': {'count': t3['count'], 'by_kind': t3['by_kind'], 'cushions_counted': t3['cushions_counted'],
                  'white_piece_role': 'not a product piece; listed under views_not_pieces' if white_label else 'not found in the reply',
                  'white_piece_text': white_label}
}
print(json.dumps(summary, indent=1))
for o in out: print(o)
