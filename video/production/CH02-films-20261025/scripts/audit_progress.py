from pathlib import Path
import json,time,hashlib,collections
OUT=Path(__file__).resolve().parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
groups=[];problems=[]
for gp in sorted((OUT/'groups').glob('G*')):
 if not (gp/'plan.json').exists():continue
 d=read(gp/'plan.json');cs=d.get('requests',d.get('clips',[]))
 actual=[c for c in cs if 'duration' in c]
 tasks=[]
 for p in (gp/'tasks').glob('*.json'):
  try:
   t=read(p)
   if 'status' in t:tasks.append({'id':p.stem,'status':t['status'],'task_id':t.get('task_id')})
  except Exception:pass
 counts=collections.Counter(t['status'] for t in tasks)
 for c in actual:
  if not 4<=c['duration']<=15:problems.append([gp.name,c['id'],'duration',c['duration']])
  shots=c.get('shots',[])
  if shots and isinstance(shots[0],dict) and 'start' in shots[0]:
   if shots[0]['start']!=0 or shots[-1]['end']!=c['duration']:problems.append([gp.name,c['id'],'shot coverage'])
   if any(a['end']!=b['start'] for a,b in zip(shots,shots[1:])):problems.append([gp.name,c['id'],'shot gap'])
  lines=c.get('spokenLines',c.get('sourceLines',[]))
  chars=sum(len(l.get('text','')) for l in lines if isinstance(l,dict) and ('只由' in l.get('voiceAndLipOwner','') or l.get('speaker') in ['苟安','李严','军吏','粮队管事','仓吏','前线接收人','地方经手人','仓中经手人']))
  if chars/max(c['duration']-1,1)>4.5:problems.append([gp.name,c['id'],'npc speech dense',chars,c['duration']])
 groups.append({'group':gp.name,'requests':len(actual),'seconds':sum(c['duration'] for c in actual),'tasks':dict(counts),'assembled':len(list((gp/'assembled').glob('*.mp4'))),'deliveryExists':(gp/'delivery.json').exists()})
voice=read(OUT/'voice/manifest.json') if (OUT/'voice/manifest.json').exists() else {}
summary={'updated':time.strftime('%Y-%m-%d %H:%M:%S'),'groups':groups,'requests':sum(g['requests'] for g in groups),'candidateSeconds':sum(g['seconds'] for g in groups),'problems':problems,'voiceReady':voice.get('readyCount',0),'voiceExpected':voice.get('expected',0)}
(OUT/'audit/progress.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
