from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;F=R/'夷陵大火-PV-v2.8-回忆与火场.mp4'
def read(p):return json.loads(p.read_text('utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'edit-timeline.json')
assert t['sha256']==sha(F)==a['source_sha256']==e['source_sha256'];assert b['status']=='pass';assert t['frames']==946
fire=next(s for s in c['shots'] if s['id']=='F01');assert abs(fire['timeline_in']-17.4166667)<.001
assert not [s for s in a['segments'] if s['in']>20.5]
q=dict(version='v2.8',date='2026-11-16',duration=t['duration'],frames=t['frames'],film_sha256=sha(F),full_decode=t['full_decode'],browser=b['status'],fire_in=fire['timeline_in'],memory_picture_range=[239/24,371/24],visual_review='Memory and fire/aftermath contact sheets plus new Y01 contact/dense frames; not human full audio approval',music_screen_max=max(w['music'] for w in e['windows']),new_video_requests=1,new_images=1,added_bgm=False,user_review='待review')
(R/'final-review.json').write_text(json.dumps(q,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(q,ensure_ascii=False))
