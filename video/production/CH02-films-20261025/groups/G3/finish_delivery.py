from pathlib import Path
import json,datetime,hashlib
O=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
movie=O/'assembled/V25-赴魏散谣的未实行计划与风险.mp4'
e=dict(id='V25',file=str(movie),duration=80.644,played=[[0,80.644]],ended=True,sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),observedUTC=now)
p=O/'review/assembled-browser-playback.json';proof=read(p)
proof['clips']=[v for v in proof['clips'] if v['id']!='V25']+[e]
write(p,proof)
d=read(O/'review/decisions.json')
for i in range(1,9):
 id=f'V25-{i:02d}'
 d[id]['actualDynamicReview']=True
 d[id]['dynamicReviewEvidence']=dict(assembledId='V25',proofPath=str(p),assembledPlayed=[[0,80.644]],method='实际浏览器完整静音播放、各子片完整3fps序列及动作点截图；非24fps逐帧、非听审',observedUTC=now)
write(O/'review/decisions.json',d)
s=read(O/'status.json');s.update(status='candidate',deliveryReady=True,updated_utc=now,review='五条完整成片已动态自查，待用户review；正式配音与口型待统一处理',inflight=[])
write(O/'status.json',s)
r=O/'assembled/V25-赴魏散谣的未实行计划与风险.json';rec=read(r);rec['duration']=80.644;rec['actualDynamicReview']=dict(proofPath=str(p),played=[[0,80.644]],ended=True);write(r,rec)
print('Saved V25 full-playback proof and all eight dynamic-review records.')
