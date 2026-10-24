// Plain summary of the run. Scores are model readings compared with the owner's sheet, not measurements.
const rows = $('Score against the answer sheet').all().map(i => i.json);
const c = (f) => rows.filter(f).length;
return [{ json: {
  run_id: rows.length ? rows[0].run_id : '',
  folders: rows.length,
  read_by_both: c(r => r.eye_count !== null && r.second_count !== null),
  counts_agree: c(r => r.counts_agree),
  first_reader_matches: c(r => /match$/.test(r.eye_vs_truth)),
  second_count_matches: c(r => /match$/.test(r.second_vs_truth)),
  final_rows: c(r => r.truth_confirmed),
  provisional_rows: c(r => !r.truth_confirmed && /match|miss/.test(r.eye_vs_truth)),
  problems: rows.filter(r => r.problem).map(r => r.folder + ': ' + r.problem)
} }];
