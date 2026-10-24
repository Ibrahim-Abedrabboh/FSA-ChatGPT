import json,sys
d=json.load(open(sys.argv[1]))
rd=d['data']['resultData']
print('lastNode',rd.get('lastNodeExecuted'),'error',(rd.get('error') or {}).get('message'))
order=sorted(((r.get('startTime',0),n,i,r) for n,runs in rd['runData'].items() for i,r in enumerate(runs)))
for t,n,i,r in order:
  m=r.get('data',{}).get('main',[])
  j={};b=None
  for o in m:
    if o: j=o[0].get('json',{}); b=o[0].get('binary'); break
  err=(r.get('error') or {}).get('message','')
  line=f"{n} #{i} {[len(o or []) for o in m]} {j.get('status','')} {err}"
  if j.get('hold_reason'): line+=' HOLD: '+j['hold_reason'][:200]
  print(line)
  s=j.get('scene') if isinstance(j.get('scene'),dict) else {}
  if n.startswith('19') or n in ('13 Compile','15e Ready check'):
    if s: print('    scene', s.get('phase'), 'props', [p.get('sku') for p in s.get('props') or []], 'left', [(x.get('sku'),x.get('why')[:90]) for x in s.get('props_left_out') or []], 'refs', [(x.get('n'),x.get('role'),x.get('key')) for x in s.get('refs') or []])
    if b: print('    binary', list(b.keys()))
    for k in ('verdicts','master','room','photos','pages'):
      if k in j: print('   ',k, json.dumps(j[k])[:400])
    if n=='13 Compile': print('   next', str(j.get('next'))[:300]); print('   dispatch', json.dumps(j.get('dispatch'))[:600])
