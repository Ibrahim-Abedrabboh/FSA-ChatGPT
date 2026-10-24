# Builds the deployed "MT4 Plan" code: fills the two marks in mt4_plan.src.js with lines copied unchanged from stage 04 "13 Compile".
# Usage: python3 build_plan.py <13_compile.js> <mt4_plan.src.js> <out mt4_plan.js>
import re, sys
c = open(sys.argv[1], encoding='utf8').read()
src = open(sys.argv[2], encoding='utf8').read()
wp = re.search(r'\nfunction whitePrompt\(.*?\n}\n', c, re.S).group(0).strip('\n')
lines = [l for l in c.split('\n') if l.startswith('const WHITE_PLAN') or l.startswith('const RATIO_NAMES') or l.startswith('function ratioOf(')]
assert len(lines) == 3
open(sys.argv[3], 'w', encoding='utf8').write(src.replace('//@@STAGE04_LINES@@', '\n'.join(lines)).replace('//@@WHITEPROMPT@@', wp))
