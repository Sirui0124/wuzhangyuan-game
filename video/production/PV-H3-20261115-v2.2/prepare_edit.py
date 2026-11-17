from pathlib import Path
import json,subprocess
import numpy as np
R=Path(__file__).resolve().parent
P=R.parent/'PV-H3-20261115-v2.1'; V=R.parent/'PV-H3-20261115-v1'
OLD=P/'逆转五丈原-PV-v2.1-完整成片.mp4'
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
SR=48000
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def save(p,a):subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
raw=load(R/'K02/source.mp4');fire=load(R/'B01/source.mp4');fire=np.tile(fire,(2,1))[:len(raw)];fire*=10**(-35/20)/np.sqrt(np.mean(fire*fire));t=np.arange(len(raw))/SR
# Early ASR flags uncertain extra speech: use fire until exertion, retaining later native breath.
w=np.clip((t-2.85)/.2,0,1)[:,None];save(R/'K02/audio-selected.wav',fire*(1-w)+raw*w)
wind=load(R/'sound/camp-wind.wav');cloth=load(P/'H16B/ambience-separated.wav');n=min(len(wind),len(cloth));save(R/'sound/fan-wind-cloth.wav',wind[:n]+cloth[:n]*10**(20/20))
shots=[]
def add(id,name,src,at,dur,**kw):
 s={'id':id,'title_name':name,'duration':dur}
 if src:s.update(source=str(src),**{'in':at})
 s.update(kw);shots.append(s)
def unit(id):return R/id/'source.mp4'
def sound(p,at=0):return {'audio_source':str(p),'audio_in':at,'audio_speed':1}
add('V01','山河火线',OLD,0,4.75)
add('V02','庞统托付 · 含马背段约1.3倍速',OLD,4.75,15.5,source_duration=484/24)
add('V03','先见火烧连营',unit('B01'),.25,4.75,gain_db=5)
add('V04','两将穿行告急',unit('B02'),.75,5.25,gain_db=-4)
add('V05','火中断路',unit('B03'),.25,3.25,**sound(R/'B03/no-music-mix.wav',.25))
add('V06','镜外劝降',unit('B04'),0,1.75,gain_db=-1)
add('V07','傅肜拒降并迈步',unit('B04'),3.75,4.25,gain_db=-4)
add('V08','孤骑回望与空鞍',OLD,1024/24,6)
add('V09','残旗',OLD,1168/24,3)
add('V10','暴雨压向谷地',unit('R03'),0,1.5,**sound(P/'sound/valley-rain.wav',0))
add('V11','最后火苗被雨浇灭',unit('R02'),.5,3.25,**sound(P/'sound/valley-rain.wav',1.5))
add('V12','诸葛亮雨中失落',OLD,1456/24,2,**sound(P/'sound/valley-rain.wav',4.75))
add('V13','关羽与暮色长刀',OLD,1504/24,7.75)
add('V14','马谡跪地',V/'G18/source.mp4',.25,2,**sound(R/'sound/camp-wind.wav',0))
add('V15','马谡望向丞相',V/'G19/source.mp4',1.875,.75,**sound(R/'sound/camp-wind.wav',2))
add('V16','诸葛亮垂眼',unit('M02'),0,2.75,**sound(R/'M02/no-music-mix.wav',0))
add('V17','举扇遮面',V/'G21/source.mp4',0,3,**sound(R/'sound/fan-wind-cloth.wav',0))
add('V18','五丈原 · 图与灯',OLD,1978/24,8.5)
add('V19','暗场换气',None,0,.375)
add('V20','伸手与抓牢',unit('K01RR'),0,4,gain_db=-3)
add('V21','握紧后支撑受力',unit('K03'),.25,3.5,gain_db=-3)
add('V22','逆转五丈原',None,0,3.5,title=True,**sound(R/'B01/source.mp4',1),gain_db=-19,fade_at=0,fade_length=1.5)
(R/'final-edit.json').write_text(json.dumps({'version':'v2.2','user_review':'待review','shots':shots},ensure_ascii=False,indent=2),'utf-8')
print('Prepared',len(shots),'shots;',sum(s['duration'] for s in shots),'seconds')
