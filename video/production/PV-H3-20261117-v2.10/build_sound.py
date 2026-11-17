from pathlib import Path
import json,subprocess
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;O=P/'PV-H3-20261117-v2.9';SR=48000
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def load(p,af=None):
 cmd=[FF,'-v','error','-i',str(p),'-vn']
 if af:cmd+=['-af',af]
 return np.frombuffer(subprocess.check_output(cmd+['-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def norm(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
dur=946/24;out=np.zeros((round(dur*SR),2),np.float32);records=[]
def add(a,dest,fade=.035):
 a=a.copy();tt=np.arange(len(a))/SR
 if fade:a*=np.minimum(np.clip(tt/fade,0,1),np.clip((len(a)/SR-tt)/fade,0,1))[:,None]
 i=round(dest*SR);n=min(len(a),len(out)-i);out[i:i+n]+=a[:n]
def clip(id,start,length,db,dest,fade=.025,speed=1):
 src=O/id/'source.mp4'
 asr=json.loads((O/id/'audio-small-unverified.json').read_text('utf-8'))
 ev=json.loads((O/id/'audio-events-unverified.json').read_text('utf-8'))
 assert not asr['segments'],f'{id} extra speech needs review'
 assert max(w['music'] for w in ev['windows'])<.1,f'{id} possible music needs replacement'
 a=norm(load(src,f'atrim=start={start}:duration={length*speed},asetpts=PTS-STARTPTS,atempo={speed},apad,atrim=duration={length}'),db);add(a,dest,fade)
 records.append(dict(id=id,source=str(src),source_in=start,duration=length,timeline=dest,rms_target=db))
add(load(P/'PV-H3-20261115-v2.6/edit/V01-sound.wav'),0,0)
memory=load(P/'PV-H3-20261115-v2.3/edit/V02-sound.wav','highpass=f=80,lowpass=f=5500,aecho=0.95:0.95:42|86:0.08|0.03')
memory=.8*memory+.2*np.mean(memory,axis=1,keepdims=True);add(memory,4.75,.015)
clip('H21',.25,2.75,-30,4.75,speed=1.45)
clip('H22',0,59/24,-30,7.5,speed=1.35)
clip('H23',.5,17/24,-25,371/24,speed=1.4)
clip('H22',3.375,1.25,-29,388/24,speed=1.35)
# F21 native contains a high music classification (.8154), exclude it completely.
# Existing clean camp fire and clean burning-canvas sound provide spatially matching fire.
fire=norm(load(P/'PV-H3-20261115-v2.2/B01/source.mp4'),-27)
add(fire[:4*SR],418/24)
clip('S21',1,1.5,-24,514/24)
add(norm(fire[SR:round(2.5*SR)],-36),514/24)
clip('F22',.75,3,-27,550/24)
fire_end=fire[2*SR:4*SR].copy();fire_end[-int(.65*SR):]*=np.linspace(1,0,int(.65*SR))[:,None];add(fire_end,622/24)
clip('A24',0,4,-30,670/24,.5)
oldwide=P/'PV-H3-20261116-v2.8/Y01/source.mp4'
add(norm(load(oldwide)[int(.5*SR):8*SR],-32),766/24,.2)
records.append(dict(id='Y01_previous',source=str(oldwide),source_in=.5,duration=7.5,timeline=766/24))
wind=norm(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav')[:round((dur-670/24)*SR)],-38);add(wind,670/24,.4)
t=np.arange(len(out))/SR;out*=np.clip((dur-t)/.8,0,1)[:,None]
subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(R/'sound/full-location-mix.wav')],input=out.astype('<f4').tobytes(),check=True)
(R/'sound/provenance.json').write_text(json.dumps(dict(added_bgm=False,new_dialogue=False,excluded_native_audio={'F21':'music classifier .8154; completely excluded'},memory='Existing Pang voice timing and short reflection preserved',native_clip_records=records,fire_replacement='v2.2 B01 clean location fire',match_cut='Fire fades out before short black pause; rainfall enters after temporal ellipsis; wet charcoal removed',human_listening='not claimed',user_review='待review'),ensure_ascii=False,indent=2),'utf-8')
print('Sound ready')
