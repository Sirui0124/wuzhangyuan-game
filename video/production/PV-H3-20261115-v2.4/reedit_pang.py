from pathlib import Path
import json,shutil,subprocess,hashlib
import numpy as np
import render_film as m
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.3';H=R.parent/'PV-H3-20261115-v2.1';B=R.parent/'PV-H3-20261115-v2.2';SR=48000
def load(p):return np.frombuffer(m.run([m.FF,'-v','error','-i',p,'-vn','-f','f32le','-ar',SR,'-ac',2,'pipe:1']).stdout,'<f4').reshape(-1,2).copy()
def save(p,a):m.run([m.FF,'-v','error','-y','-f','f32le','-ar',SR,'-ac',2,'-i','pipe:0','-c:a','pcm_s24le',p],input=a.astype('<f4').tobytes())
def ambience(src,start,sd,dur):
 raw=m.run([m.FF,'-v','error','-ss',start,'-i',src,'-vn','-af',f'atrim=duration={sd},atempo={sd/dur},apad,atrim=duration={dur}','-f','f32le','-ar',SR,'-ac',2,'pipe:1']).stdout
 return np.frombuffer(raw,'<f4').reshape(-1,2).copy()
parts=[dict(id='P00',source=str(P/'edit/V02-picture.mp4'),duration=7.5),dict(id='P01',source=str(H/'H11/source.mp4'),**{'in':5},source_duration=4.125,duration=77/24),dict(id='P02',source=str(H/'H10/source.mp4'),**{'in':0},source_duration=2.5,duration=47/24),dict(id='P03',source=str(B/'K01RR/source.mp4'),**{'in':0},source_duration=3.5,duration=68/24)]
parts[0].update(audio_source=str(P/'edit/V02-sound.wav'))
made=[m.part(s) for s in parts]
m.concat([p[0] for p in made],R/'edit/V02-picture.mp4')
# Approved Pang Tong dialogue stays continuous, at the already selected ~1.3x rate.
base=load(P/'edit/V02-sound.wav');mix=base.copy()
for src,start,sd,dur,dest,target in [(H/'H10/source.mp4',0,2.5,47/24,257/24,-32),(B/'K01RR/source.mp4',2,68/24,68/24,304/24,-35)]:
 a=ambience(src,start,sd,dur);a*=10**(target/20)/max(1e-9,float(np.sqrt(np.mean(a*a))));tt=np.arange(len(a))/SR;env=np.minimum(np.clip(tt/.08,0,1),np.clip((dur-tt)/.1,0,1));a*=env[:,None];i=round(dest*SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
save(R/'sound/pang-continuous-dialogue-and-action.wav',mix)
c=json.loads((P/'final-edit.json').read_text('utf-8'))
for s in c['shots']:
 if s['id']=='V02':
  s.update(source=str(R/'edit/V02-picture.mp4'),**{'in':0},duration=15.5,source_duration=15.5,audio_source=str(R/'sound/pang-continuous-dialogue-and-action.wav'),audio_in=0,audio_speed=1,title_name='庞统交印完成 · 马上与救援实景',picture_edit_record='pang-picture-map.json')
 else:
  for suffix in ['-picture.mp4','-sound.wav']:
   src=P/'edit'/(s['id']+suffix);dest=R/'edit'/src.name
   if not dest.exists():shutil.copy2(src,dest)
c.update(version='v2.4',user_review='待review');(R/'final-edit.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),'utf-8')
timeline=[];t=4.75
for s in parts:
 s.update(timeline_in=t,timeline_out=t+s['duration']);t+=s['duration'];timeline.append(s)
(R/'pang-picture-map.json').write_text(json.dumps({'parts':timeline,'voice_source':str(P/'edit/V02-sound.wav'),'voice_sha256':hashlib.sha256((P/'edit/V02-sound.wav').read_bytes()).hexdigest(),'dialogue_edits':'none; previous pitch-preserving~1.3x maintained','ambience':'horse source0-2.5 before speech; rescue source2 onward excludes 拉住我; no added BGM'},ensure_ascii=False,indent=2),'utf-8')
m.run([m.FF,'-v','error','-y','-i',R/'edit/V02-picture.mp4','-i',R/'sound/pang-continuous-dialogue-and-action.wav','-c:v','copy','-c:a','aac','-b:a','192k','-t',15.5,'-movflags','+faststart',R/'庞统交印与救援-修订检查片.mp4'])
print('Pang Tong recut prepared; original global segment4.75-20.25 preserved.')
