"""Adds a blank line before headings, lists, tables and bold labels that directly follow text, outside code blocks."""
import re
MD = 'claude-midas-a6-prompts-by-phase-2026-10-14.md'
lines = open(MD, encoding='utf-8').read().split('\n')
out, in_code = [], False
starts = lambda l: l.startswith('#') or l.startswith('- ') or (l.startswith('|') ) or l.startswith('**') or l.startswith('```')
for l in lines:
    if not in_code and starts(l) and out and out[-1].strip() != '':
        prev = out[-1]
        same_block = (l.startswith('- ') and prev.startswith('- ')) or (l.startswith('|') and prev.startswith('|'))
        if not same_block:
            out.append('')
    out.append(l)
    if l.startswith('```'):
        in_code = not in_code
open(MD, 'w', encoding='utf-8').write('\n'.join(out))
