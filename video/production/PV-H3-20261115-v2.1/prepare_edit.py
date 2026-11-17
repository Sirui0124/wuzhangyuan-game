from pathlib import Path
import json,subprocess
import numpy as np
R=Path(__file__).resolve().parent;FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def wav(p):
 return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar','48000','-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def save(p,a):
 subprocess.run([FF,'-v','error','-y','-f','f32le','-ar','48000','-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
# Elliptical impact cut: one native arrow sound, no deformed arrow or blood-spray images.
hit=wav(R/'H05B/source.mp4');bed=wav(R/'H06/ambience-separated.wav')
n=int(3.75*48000);tail=bed[:n].copy();p=hit[int(2.25*48000):int(3.35*48000)]
env=np.ones(len(p));env[-int(.15*48000):]=np.linspace(1,0,int(.15*48000));tail[:len(p)]+=p*env[:,None]
save(R/'sound/sha-empty-horse.wav',tail)
shots=[]
def add(id,unit,dur,**kw):shots.append(dict(id=id,unit=unit,duration=dur,**kw))
add('V01','H01',4.75,title_name='山河火线',gain_db=0)
add('V02','H10',6.75,**{'in':2.5},title_name='奔赴与庞统画外叮嘱')
add('V03','H02',7.25,title_name='梦中托付',audio_in=0,picture_parts=[{'in':0,'out':5,'duration':5},{'in':6,'out':7.25,'duration':2.25}],note='去除模型溶接；对白完整保留，掌心末段降速，不涉及口型。')
add('V04','H11',6.166666666666667,**{'in':3},title_name='接印与保全儿郎',note='删除0–2.27无关念白，保留完整条件句与交印动作。')
add('V05','H12',3.75,title_name='伤兵退入败营')
add('V06','H03B',4.25,**{'in':.75},title_name='御营告急')
add('V07','H03',3.5,**{'in':3},title_name='前路受阻',audio_source=str(R/'H03/ambience-separated.wav'),audio_in=3,note='转向后战况，去除重复警告。')
add('V08a','H04',1.75,title_name='敌将劝降')
add('V08b','H04',4.5,**{'in':4.75},title_name='傅肜拒降',crop='1216:684:0:42',note='压缩回答前无行动停顿；同轴轻近景接完整回答与迈步。')
add('V09','H05B',2.25,title_name='沙摩柯回望',note='仅用异常箭出现前的干净回望；中箭在画外，由单次同期箭啸与下一镜结果建立。')
add('V10','H06',3.75,title_name='人去马还行',audio_source=str(R/'sound/sha-empty-horse.wav'),audio_in=0)
add('V11','H13',3.5,title_name='残旗')
add('V12','H14',3.75,title_name='雨中余烬')
add('V13','H07',4.75,title_name='大雨压火',audio_source=str(R/'sound/valley-rain.wav'),audio_in=0)
add('V14','H08',2,title_name='闭口望天',audio_source=str(R/'sound/valley-rain.wav'),audio_in=4.75,picture_parts=[{'in':0,'out':1.25,'duration':2}],note='仅取开口前的抬眼动作，雨声连续；不使用原片配乐与无关台词。')
add('V15','H15',7.75,title_name='关羽刀落泥中')
add('V16','H09',12,title_name='马谡与诸葛亮相望掩面',audio_source=str(R/'H09/no-music-mix.wav'),audio_in=0)
add('V17','H16B',4.75,title_name='五丈原手停地图',audio_source=str(R/'H16B/ambience-separated.wav'),audio_in=0)
add('V18','H17',3.75,title_name='灯灭')
shots.append(dict(id='V19',duration=.5,black=True,title_name='暗场换气',audio_source=str(R/'H18B/source.mp4'),audio_in=0))
add('V20','H18B',7.75,title_name='我拉起伤兵',audio_in=.5,picture_parts=[{'in':.5,'out':3.25,'duration':2.75},{'in':3.25,'out':4.5,'duration':1.25,'crop':'864:486:240:282'},{'in':4.5,'out':8.25,'duration':3.75}],note='施救者只露前臂；我的台词期间切双手握紧特写，避免伤兵口型代说；原生声音与动作保持同一时间。')
shots.append(dict(id='V21',duration=4,title=True,title_name='逆转五丈原',audio_source=str(R/'H18B/source.mp4'),audio_in=8.25))
config={'version':'v2.1','date':'2026-11-15','scope':'完整H3动态成片；非静态预演','shots':shots,'bridges':[],'user_review':'待review'}
(R/'final-edit.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),'utf-8')
print('Timeline prepared:',sum(s['duration'] for s in shots),'seconds; rescue sound pending completed source audit.')
