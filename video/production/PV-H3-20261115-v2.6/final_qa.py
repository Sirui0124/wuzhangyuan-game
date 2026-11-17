from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.5';F=R/'逆转五丈原-PV-v2.6-完整成片.mp4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8-sig'))
t=read(R/'final-technical.json');b=read(R/'browser-verification.json');a=read(F.with_suffix('.asr.json'));e=read(F.with_suffix('.events.json'));c=read(R/'final-edit.json')
assert t['sha256']==sha(F)==a['source_sha256']==e['source_sha256'];assert b['status']=='pass'
same=[]
for s in c['shots']:
 if s['id']=='V14':continue
 for suffix in ['-picture.mp4','-sound.wav']:
  name=s['id']+suffix;assert sha(R/'edit'/name)==sha(P/'edit'/name)
 same.append(s['id'])
ref=R/'references/E07-马谡刑场-唯一母版.png';original=R.parent/'PV-opening-20261114/references/existing/E07-马谡刑场.png';assert sha(ref)==sha(original)
assert len(read(R/'M06/references.json'))==1
assert 'M04' not in json.dumps(c,ensure_ascii=False)
record=dict(version='v2.6',date='2026-11-15',duration=t['duration'],frames=t['frames'],film_sha256=sha(F),full_decode=t['full_decode'],browser=b['status'],changed='V14 only45.416667-47.916667, original E07 executioner composition restored',unchanged_picture_and_pcm_verified=same,original_reference_hash_verified=sha(ref),visual_check='M06 contact/dense frames and Ma Su-Zhuge reverse-shot seam frames inspected; human full audio review not claimed',music_screen_max=max(w['music'] for w in e['windows']),added_bgm=False,new_api_submissions=2,selected_new_units=['M06'],user_review='待review')
(R/'final-review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(record,ensure_ascii=False))
