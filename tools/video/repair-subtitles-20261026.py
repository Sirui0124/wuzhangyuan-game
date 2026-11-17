"""Apply only source-worded, actual-audio-located missing cues; preserve original media."""
from pathlib import Path
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/subtitle-review-20261026';PUB=ROOT/'GameStarter/web-demo/public'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
by={c['id']:c for cs in read(PUB/'cinematics.json').values() for c in cs}
source=read(ROOT/'video/production/CH02-films-20261025/reviews/user-20261025-batch2/spoken-whitelist.json')
whitelist={c['id']:[r['text'] for r in c['spokenWhitelist']] for c in source['clips']}
repairs={
 'CH2-V11T':[(8.68,10.2,'要说粮的事'),(10.2,11.541,'就说粮的事')],
 'CH2-V11D':[(3.9,6.84,'你肯替我遮掩，我领情')],
 'CH2-V11N':[(2.34,3.32,'先看看这批粮')],
}
def stamp(s):
 ms=round(s*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
records=[]
for id,additions in repairs.items():
 clip=by[id];p=PUB/clip['subtitles'].lstrip('/');original=p.read_text(encoding='utf-8')
 evidence=read(OUT/'asr'/(id+'.json'));film=ROOT/'video/current'/Path(clip['src']).name
 assert hashlib.sha256(film.read_bytes()).hexdigest()==evidence['sha256']
 for a,z,t in additions:assert any(t in line for line in whitelist[id.removeprefix('CH2-')])
 before=OUT/'before'/p.name;before.parent.mkdir(parents=True,exist_ok=True)
 if not before.exists():shutil.copy2(p,before)
 if id=='CH2-V11N':additions=additions+[(4.16,6.34,'先看看这批粮，再说往后')]
 updated='WEBVTT\n\n'+''.join(f'{i+1}\n{stamp(a)} --> {stamp(z)}\n{t}\n\n' for i,(a,z,t) in enumerate(additions))
 p.write_text(updated,encoding='utf-8')
 records.append(dict(id=id,video=clip['src'],videoSha256=evidence['sha256'],subtitles=clip['subtitles'],beforeSha256=hashlib.sha256(before.read_bytes()).hexdigest(),afterSha256=hashlib.sha256(updated.encode()).hexdigest(),cues=[dict(start=a,end=z,text=t) for a,z,t in additions],wordingSource='spoken-whitelist.json',timingEvidence=str((OUT/'asr'/(id+'.json')).relative_to(ROOT)),humanListeningReview=False,userApproval='pending'))
(OUT/'repairs.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('Repaired 3 subtitle tracks; 4 missing cues added. Videos unchanged.')
