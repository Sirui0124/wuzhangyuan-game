from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent;O=R.parent/'PV-H3-20261117-v2.9'
for name in ['render_film.py','make_delivery.py','check_review.mjs','audit_small.py','audit_music.py','check_levels.py']:
 s=(O/name).read_text('utf-8').replace('v2.9','v2.10');(R/name).write_text(s,'utf-8')
p=R/'render_film.py';s=p.read_text('utf-8').replace(" reuse=next("," if s.get('picture_fade_in'):\n  vf+=f\",fade=t=in:st={s.get('picture_black_hold',0)}:d={s['picture_fade_in']}\"\n reuse=next(");p.write_text(s,'utf-8')
c=json.loads((O/'final-edit.json').read_text('utf-8'));c['version']='v2.10';c['latest_user_change']='马加速，庞统自然色彩，删除湿炭与突然熄灭感，以淡黑表示时间过去'
ss=[];speeds={'H21':1.45,'H22A':1.35,'H23':1.4,'H22B':1.35}
for s in c['shots']:
 if s['id']=='R02':continue
 if s['id'] in speeds:
  s['source_duration']=s['duration']*speeds[s['id']];s['picture_speed']=speeds[s['id']]
  if s['id']=='H22B':s['in']=3.375
 if s['id'] in ['M01','M02']:s.pop('pre_crop',None)
 if s['id']=='F21B':s['picture_fade_out']=.5
 if s['id']=='A21A':s.update(picture_fade_in=.625,picture_black_hold=.25,title_name='时间过去 · 雨后空营')
 if s['id']=='A21B':s.update(duration=7.5,**{'in':.5})
 ss.append(s)
t=0
for s in ss:
 s.update(audio_source=str(R/'sound/full-location-mix.wav'),audio_in=t,audio_source_duration=s['duration'],audio_speed=1);t+=s['duration']
assert round(t*24)==946
c['shots']=ss;(R/'final-edit.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),'utf-8')
# Keep audited existing locations/voice; rebuild horse effects at matching tempo.
s=(O/'build_sound.py').read_text('utf-8')
s=s.replace("src=R/id/'source.mp4'","src=O/id/'source.mp4'").replace("(R/id/", "(O/id/")
s=s.replace("def clip(id,start,length,db,dest,fade=.025):","def clip(id,start,length,db,dest,fade=.025,speed=1):")
s=s.replace("a=norm(load(src)[round(start*SR):round((start+length)*SR)],db);add(a,dest,fade)","a=norm(load(src,f'atrim=start={start}:duration={length*speed},asetpts=PTS-STARTPTS,atempo={speed},apad,atrim=duration={length}'),db);add(a,dest,fade)")
s=s.replace("R=Path(__file__).resolve().parent;P=R.parent;SR=48000","R=Path(__file__).resolve().parent;P=R.parent;O=P/'PV-H3-20261117-v2.9';SR=48000")
s=s.replace("clip('H21',.25,2.75,-31,4.75)","clip('H21',.25,2.75,-30,4.75,speed=1.45)").replace("clip('H22',0,59/24,-31,7.5)","clip('H22',0,59/24,-30,7.5,speed=1.35)").replace("clip('H23',.5,17/24,-25,371/24)","clip('H23',.5,17/24,-25,371/24,speed=1.4)").replace("clip('H22',3.75,1.25,-29,388/24)","clip('H22',3.375,1.25,-29,388/24,speed=1.35)")
start=s.index('add(fire[2*SR:4*SR],622/24)');end=s.index('t=np.arange(len(out))/SR;',start)
s=s[:start]+'''fire_end=fire[2*SR:4*SR].copy();fire_end[-int(.65*SR):]*=np.linspace(1,0,int(.65*SR))[:,None];add(fire_end,622/24)
clip('A24',0,4,-30,670/24,.5)
oldwide=P/'PV-H3-20261116-v2.8/Y01/source.mp4'
add(norm(load(oldwide)[int(.5*SR):8*SR],-32),766/24,.2)
records.append(dict(id='Y01_previous',source=str(oldwide),source_in=.5,duration=7.5,timeline=766/24))
wind=norm(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav')[:round((dur-670/24)*SR)],-38);add(wind,670/24,.4)
'''+s[end:]
s=s.replace("match_cut='0.45second fire tail into quiet wet camp'","match_cut='Fire fades out before short black pause; rainfall enters after temporal ellipsis; wet charcoal removed'")
(R/'build_sound.py').write_text(s,'utf-8')
p=R/'make_delivery.py';s=p.read_text('utf-8').replace('奔马进入回忆，交印后回到火场；帐布让开，显出连营大火。士卒相互支撑只留短暂一瞥，随后以同一营地构图切至灾后空景。','奔马与蹄声同步加速；庞统恢复自然色彩。火营淡黑后进入雨后空营，删除湿炭插镜，以连续大全景收尾。').replace('<a href="导演执行稿-v2.10.md">导演执行稿</a>','');p.write_text(s,'utf-8')
(R/'修订记录-v2.10.md').write_text('''# 夷陵大火 v2.10

2026-11-17，待用户review。保留v2.9，本轮仅后期修订，无新增收费生成。

- H21侧后跟骑1.45倍；H22两段骑手视角1.35倍；H23落蹄1.4倍。通过扩大原片取样区间保持成片时长和台词位置，两个H22区间不重叠。蹄声按对应速度变速并保持音高。
- 庞统两段恢复原片色彩，去掉0.55饱和度、降低对比和模糊处理。回忆靠声音和剪辑表达。
- 27.42秒开始火景淡黑，接约0.25秒全黑及0.625秒雨后画面淡入，明确时间省略。删除31.92—34.42秒的湿炭插镜，31.92秒起使用7.5秒连续灾后大全景。
- 总长39.416667秒，1280×720、24fps。无BGM，保留原台词、呼吸及环境音。生成原片与来源仍在v2.9及既有版本，final-edit.json列绝对路径。
- 验证结果以本目录final-technical.json、browser-verification.json、final-review.json为准；自动识别和抽帧不等同人工完整听审或用户通过。
''','utf-8')
print('v2.10 edit and sound prepared')
