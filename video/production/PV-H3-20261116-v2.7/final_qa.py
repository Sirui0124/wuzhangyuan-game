from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.6';F=R/'夷陵大火-PV-v2.7-精简版.mp4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8-sig'))
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'final-edit.json')
assert t['sha256']==sha(F)==a['source_sha256']==e['source_sha256'];assert b['status']=='pass';assert [s['id'] for s in c['shots']]==['V01','V02','Y03','Y04'];assert t['frames']==582
for id in ['V01','V02']:
 for tail in ['-picture.mp4','-sound.wav']:assert sha(R/'edit'/(id+tail))==sha(P/'edit'/(id+tail))
assert not [s for s in a['segments'] if s['in']>20.5]
record=dict(version='v2.7',date='2026-11-16',duration=t['duration'],frames=t['frames'],film_sha256=sha(F),full_decode=t['full_decode'],browser=b['status'],unchanged_picture_and_pcm_verified=['V01','V02'],visual_check='Fire-to-aftermath seam contact sheet inspected; no human full audio review claimed',music_screen_max=max(w['music'] for w in e['windows']),added_bgm=False,new_api_submissions=0,user_review='待review')
(R/'final-review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(record,ensure_ascii=False))
