from pathlib import Path
import json,hashlib,datetime
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.2';F=R/'逆转五丈原-PV-v2.3-完整成片.mp4'
def read(p):return json.loads(p.read_text('utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));m=read(F.with_suffix('.events.json'));timeline=read(R/'edit-timeline.json')
assert t['sha256']==sha(F)==a['source_sha256']==m['source_sha256'];assert b['status']=='pass'
unchanged=[]
for s in timeline['shots']:
 if s['id'] not in ('V11','V11B','V12','V14','V15','V17','V20','V21','V22'):
  name=s['id']+'-picture.mp4';assert sha(R/'edit'/name)==sha(P/'edit'/name);unchanged.append(s['id'])
q=dict(version='v2.3',date='2026-11-15',film_sha256=sha(F),duration=t['duration'],frames=t['frames'],full_decode=t['full_decode'],browser=b['status'],unchanged_picture_parts_verified=unchanged,asr_is_human_transcript=False,music_screen_max=max(x['music'] for x in m['windows']),music_screen_is_absence_proof=False,added_bgm=False,user_review='待review',unknown_submissions=['R04 HTTP520','R04R HTTP522'],sound_preference='人物呼吸、衣料、环境音，无新增对白')
(R/'final-review.json').write_text(json.dumps(q,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(q,ensure_ascii=False))
