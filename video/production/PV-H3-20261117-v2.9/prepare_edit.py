from pathlib import Path
import json
R=Path(__file__).resolve().parent;P=R.parent;Q=P/'PV-H3-20261115-v2.4'
def shot(id,name,src,dur,start=0,**extra):return dict(id=id,title_name=name,source=str(src),duration=dur,**{'in':start},**extra)
look='eq=saturation=0.55:contrast=0.94:brightness=0.015,gblur=sigma=0.25,'
ss=[
shot('V01','江岸火线 · 大远景',P/'PV-H3-20261115-v2.1/逆转五丈原-PV-v2.1-完整成片.mp4',4.75),
shot('H21','侧后跟骑 · 奔赴火场',R/'H21/source.mp4',2.75,.25),
shot('H22A','骑手视角 · 林间前行',R/'H22/source.mp4',59/24),
shot('M01','回忆 · 庞统托付',Q/'edit/P00-picture.mp4',55/24,125/24,pre_crop=look),
shot('M02','回忆 · 持印救主',Q/'edit/P01-picture.mp4',77/24,pre_crop=look),
shot('H23','落蹄 · 回到当下',R/'H23/source.mp4',17/24,0.5),
shot('H22B','骑手视角 · 火场已近',R/'H22/source.mp4',30/24,3.75),
shot('F21A','揭开连营大火',R/'F21/source.mp4',4),
shot('S21','短暂一瞥 · 士卒相互支撑',R/'S21/source.mp4',1.5,1),
shot('F22','细节 · 帐布烧断',R/'F22/source.mp4',3,.75),
shot('F21B','连营全景 · 火势仍在',R/'F21/source.mp4',2,4),
shot('A21A','同机位 · 火后空营',R/'A24/source.mp4',4),
shot('R02','细节 · 湿炭滴水',P/'PV-H3-20261115-v2.3/R04RR/source.mp4',2.5,2),
shot('A21B','空营大全景 · 余韵',P/'PV-H3-20261116-v2.8/Y01/source.mp4',5,3,picture_fade_out=.75)
]
t=0
for s in ss:
 s.update(audio_source=str(R/'sound/full-location-mix.wav'),audio_in=t,audio_speed=1,reuse_unchanged=False);t+=s['duration']
assert round(t*24)==946
(R/'final-edit.json').write_text(json.dumps(dict(version='v2.9',user_review='待review',shots=ss,latest_user_change='搀扶只留1.5秒，营地以大全景为主，近景强调材质与具体动作'),ensure_ascii=False,indent=2),'utf-8')
print('Planned seconds',t)
