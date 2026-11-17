from pathlib import Path
import json,sys,shutil
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.2';V=R.parent/'PV-H3-20261115-v1';E=R/'edit';E.mkdir(exist_ok=True)
c=json.loads((P/'final-edit.json').read_text('utf-8'));shots=[]
rain=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--rain=')),'R04RR')
for s in c['shots']:
 s=dict(s);id=s['id']
 if id=='V16':continue
 if id=='V10':s.update(audio_source=str(R/'sound/rain-sequence.wav'),audio_in=0)
 if id=='V11':s.update(source=str(R/rain/'source.mp4'),**{'in':0},duration=.75,title_name='雨水与将熄的余炭',audio_source=str(R/'sound/rain-sequence.wav'),audio_in=1.5)
 if id=='V12':s.update(duration=1.5,audio_source=str(R/'sound/rain-sequence.wav'),audio_in=2.25)
 if id=='V14':s.update(duration=1.5,audio_source=str(R/'sound/masu-breath-ambience.wav'),audio_in=0,title_name='马谡跪地 · 呼吸先入',gain_db=4)
 if id=='V15':s.update(source=str(R/'M03/source.mp4'),**{'in':1.5},duration=2.5,audio_source=str(R/'sound/masu-breath-ambience.wav'),audio_in=1.5,title_name='马谡抬眼与吞咽',gain_db=4)
 if id=='V17':s.update(duration=3.25,audio_source=str(R/'sound/zhuge-continuous-foley.wav'),audio_in=0,title_name='诸葛亮低头举扇 · 连续动作')
 if id in ('V20','V21','V22'):
  s=next(x for x in json.loads((R/'ending-shots.json').read_text('utf-8')) if x['id']==id)
 shots.append(s)
 if id=='V12':shots.append(dict(id='V11B',title_name='雨后黑炭 · 火已熄',source=str(R/rain/'source.mp4'),**{'in':2},duration=2.5,audio_source=str(R/'sound/rain-sequence.wav'),audio_in=3.75,audio_speed=1))
 # Reuse already-encoded unchanged pictures, preserving earlier reviewed material.
 if id not in ('V11','V12','V14','V15','V17','V20','V21','V22'):
  src=P/'edit'/(id+'-picture.mp4');dest=E/src.name
  if not dest.exists():shutil.copy2(src,dest)
c.update(version='v2.3',shots=shots,user_review='待review')
(R/'final-edit.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),'utf-8')
print('Prepared candidate timeline',sum(s['duration'] for s in shots),'seconds. Missing sources must be resolved before final render.')
