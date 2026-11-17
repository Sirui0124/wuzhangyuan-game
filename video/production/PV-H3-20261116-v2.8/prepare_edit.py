from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent;P=R.parent;Q=P/'PV-H3-20261115-v2.4'
mix=str(R/'sound/full-location-mix.wav')
def shot(id,name,src,dur,start=0,**extra):return dict(id=id,title_name=name,source=str(src),duration=dur,**{'in':start},**extra)
look='eq=saturation=0.55:contrast=0.94:brightness=0.015,gblur=sigma=0.25,'
ss=[
shot('V01','眼前江岸 · 远处火线',P/'PV-H3-20261115-v2.1/逆转五丈原-PV-v2.1-完整成片.mp4',4.75),
shot('W02','马上奔赴 · 旧日叮嘱先入',Q/'edit/P00-picture.mp4',125/24),
shot('M01','回忆 · 庞统托付',Q/'edit/P00-picture.mp4',55/24,125/24,pre_crop=look),
shot('M02','回忆 · 印已交到手中',Q/'edit/P01-picture.mp4',77/24,pre_crop=look),
shot('W03','回到马背 · 蹄声拉回当下',Q/'edit/P02-picture.mp4',47/24),
shot('F01','熊熊大火 · 汉旗燃烧',P/'PV-H3-20261115-v2.1/逆转五丈原-PV-v2.1-完整成片.mp4',3,48.666666666666664),
shot('F02','火吞连营 · 显出营地纵深',P/'PV-H3-20261115-v2.2/B01/source.mp4',5),
shot('R01','雨幕进入 · 火场走向废墟',P/'PV-H3-20261115-v2.2/R03/source.mp4',3.5),
shot('R02','湿炭与细水 · 火已退去',P/'PV-H3-20261115-v2.3/R04RR/source.mp4',2.5,2),
shot('Y08','同一营道 · 灾后空营',R/'Y01/source.mp4',8,picture_fade_out=.75)
]
t=0
for s in ss:s.update(audio_source=mix,audio_in=t,audio_speed=1,reuse_unchanged=False);t+=s['duration']
assert round(t*24)==946
shutil.copy2(P/'PV-H3-20261115-v2.6/edit/V01-picture.mp4',R/'edit/V01-picture.mp4')
(R/'final-edit.json').write_text(json.dumps(dict(version='v2.8',user_review='待review',shots=ss),ensure_ascii=False,indent=2),'utf-8')
print('Planned duration',t)
