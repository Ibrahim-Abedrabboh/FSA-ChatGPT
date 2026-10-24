"""Assembles stage-03 Code node text. 11b = stylist skill engine (unchanged, wrapper removed) + A7 wrapper."""
import hashlib, pathlib
here = pathlib.Path(__file__).parent
# Project layout: claude-outputs/claude-midas-a7-build/js/ and claude-outputs/claude-midas-stylist-skill/n8n/
src = here / '..' / '..' / 'claude-midas-stylist-skill' / 'n8n' / 'claude-stylist-check.code.js'
if not src.exists(): src = pathlib.Path('/home/claude/claude-midas-stylist-skill/n8n/claude-stylist-check.code.js')
eng = src.read_text()
cut = eng.index('// ---- n8n wrapper ----')
body = eng[:cut].rstrip() + '\n\n'
(here / '11b_check.js').write_text('// A7 step 11b · Stylist check. Engine: claude-stylist-check.code.js (stylist skill v0.3), sha256 ' + hashlib.sha256(eng.encode()).hexdigest()[:16] + ', wrapper replaced.\n' + body + (here / '11b_check.part.js').read_text())
print('11b_check.js', len((here / '11b_check.js').read_text()))
