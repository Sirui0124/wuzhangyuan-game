from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;F=R/'夷陵大火-PV-v2.9-火营与归途.mp4'
def read(p):return json.loads(p.read_text('utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'edit-timeline.json')
assert t['sha256']==sha(F)==a['source_sha256']==e['source_sha256'];assert b['status']=='pass';assert t['frames']==946
fire=next(s for s in c['shots'] if s['id']=='F21A');assert abs(fire['timeline_in']-17.4166667)<.001
soldiers=next(s for s in c['shots'] if s['id']=='S21');assert soldiers['duration']==1.5
assert not [s for s in a['segments'] if s['in']>20.5]
assert max(w['music'] for w in e['windows'])<.1
q=dict(version='v2.9',date='2026-11-17',duration=t['duration'],frames=t['frames'],film_sha256=sha(F),full_decode=t['full_decode'],browser=b['status'],fire_in=fire['timeline_in'],soldiers_duration=1.5,match_cut=670/24,memory_picture_range=[239/24,371/24],visual_review='Source2fps contacts, selected8fps action contacts, final contact sheets and match-cut frames; not human full audio approval',music_screen_max=max(w['music'] for w in e['windows']),new_video_requests=10,discarded_video=['A21','A22','A23'],added_bgm=False,user_review='待review')
(R/'final-review.json').write_text(json.dumps(q,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(q,ensure_ascii=False))
