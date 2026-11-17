from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;F=R/'夷陵大火-PV-v2.10-火营与归途.mp4'
def read(p):return json.loads(p.read_text('utf-8-sig'))
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'edit-timeline.json')
sha=hashlib.sha256(F.read_bytes()).hexdigest();assert t['sha256']==sha==a['source_sha256']==e['source_sha256']
assert b['status']=='pass' and t['frames']==946
ss={s['id']:s for s in c['shots']};assert 'R02' not in ss
assert all('pre_crop' not in ss[k] for k in ['M01','M02'])
assert ss['F21B']['picture_fade_out']==.5 and ss['A21A']['picture_black_hold']==.25
assert ss['A21B']['duration']==7.5
assert all(ss[k]['source_duration']>ss[k]['duration'] for k in ['H21','H22A','H23','H22B'])
assert ss['H22A']['in']+ss['H22A']['source_duration']<=ss['H22B']['in']
assert not [s for s in a['segments'] if s['in']>20.5]
assert max(w['music'] for w in e['windows'])<.1
v=dict(version='v2.10',date='2026-11-17',duration=t['duration'],frames=946,sha256=sha,full_decode='pass',browser='pass',horse_speeds={k:ss[k]['picture_speed'] for k in ['H21','H22A','H23','H22B']},memory='source color restored, no desaturation/blur',wet_charcoal_removed=True,fire_transition='0.5s fade out,0.25s black,0.625s fade in; temporal ellipsis',new_generation_requests=0,added_bgm=False,music_screen_max=max(w['music'] for w in e['windows']),visual_check='Final horse-memory and camp-seam contact sheets, not human full audio approval',user_review='待review')
(R/'final-review.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(v,ensure_ascii=False))
