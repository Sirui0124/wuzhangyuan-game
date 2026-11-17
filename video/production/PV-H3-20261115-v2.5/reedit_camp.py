from pathlib import Path
import json,shutil
import numpy as np
import render_film as m
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.4';A=R.parent/'PV-H3-20261115-v2.3';B=R.parent/'PV-H3-20261115-v2.2';H=R.parent/'PV-H3-20261115-v2.1';SR=48000
def load(p):return np.frombuffer(m.run([m.FF,'-v','error','-i',p,'-vn','-f','f32le','-ar',SR,'-ac',2,'pipe:1']).stdout,'<f4').reshape(-1,2).copy()
def save(p,a):m.run([m.FF,'-v','error','-y','-f','f32le','-ar',SR,'-ac',2,'-i','pipe:0','-c:a','pcm_s24le',p],input=a.astype('<f4').tobytes())
for id in ['P00','P01','P02']:shutil.copy2(P/'edit'/(id+'-picture.mp4'),R/'edit'/(id+'-picture.mp4'))
s=dict(id='P03',source=str(B/'B01/source.mp4'),duration=68/24)
vp,ap=m.part(s);m.concat([R/'edit'/(id+'-picture.mp4') for id in ['P00','P01','P02','P03']],R/'edit/V02-picture.mp4')
base=load(A/'edit/V02-sound.wav')
raw=m.run([m.FF,'-v','error','-i',H/'H10/source.mp4','-vn','-af',f'atrim=duration=2.5,atempo={2.5/(47/24)},apad,atrim=duration={47/24}','-f','f32le','-ar',SR,'-ac',2,'pipe:1']).stdout
horse=np.frombuffer(raw,'<f4').reshape(-1,2).copy();horse*=10**(-32/20)/np.sqrt(np.mean(horse*horse))
fire=load(B/'B01/source.mp4')[:round(68/24*SR)]*10**(5/20)
for a,dest,tailfade in [(horse,257/24,True),(fire,304/24,False)]:
 t=np.arange(len(a))/SR;env=np.clip(t/.08,0,1)
 if tailfade:env*=np.clip((len(a)/SR-t)/.08,0,1)
 a*=env[:,None];i=round(dest*SR);n=min(len(a),len(base)-i);base[i:i+n]+=a[:n]
save(R/'sound/pang-dialogue-horse-camp.wav',base)
(R/'camp-edit-record.json').write_text(json.dumps({'original_request':'也当尽力保全我军儿郎用大营，不用伸手动作','P03':'B01source0-2.833333 atglobal17.416667-20.25','V03':'B01source2.833333-5 follows continuously, no repeated pan','new_generation_for_camp':False,'dialogue_source':str(A/'edit/V02-sound.wav'),'added_bgm':False},ensure_ascii=False,indent=2),'utf-8')
print('Camp replaces early reach; continuation prepared')
