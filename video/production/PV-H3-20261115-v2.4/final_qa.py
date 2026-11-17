from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.3';F=R/'逆转五丈原-PV-v2.4-完整成片.mp4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8-sig'))
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'final-edit.json')
assert t['sha256']==sha(F)==a['source_sha256']==e['source_sha256'];assert b['status']=='pass'
same=[]
for s in c['shots']:
 if s['id']=='V02':continue
 for suffix in ['-picture.mp4','-sound.wav']:
  name=s['id']+suffix;assert sha(R/'edit'/name)==sha(P/'edit'/name)
 same.append(s['id'])
record=dict(version='v2.4',date='2026-11-15',duration=t['duration'],frames=t['frames'],film_sha256=sha(F),full_decode=t['full_decode'],browser=b['status'],changed='V02 only, global4.75-20.25',unchanged_picture_and_pcm_verified=same,visual_check='handover and action cuts at4fps; timecoded source edit reviewed',music_screen_max=max(w['music'] for w in e['windows']),added_bgm=False,new_api_submissions=0,asr_is_human_transcript=False,user_review='待review')
(R/'final-review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(record,ensure_ascii=False))
