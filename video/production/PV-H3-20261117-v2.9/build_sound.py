from pathlib import Path
import json,subprocess
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;SR=48000
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
def clip(id,start,length,db,dest,fade=.025):
 src=R/id/'source.mp4'
 asr=json.loads((R/id/'audio-small-unverified.json').read_text('utf-8'))
 ev=json.loads((R/id/'audio-events-unverified.json').read_text('utf-8'))
 assert not asr['segments'],f'{id} extra speech needs review'
 assert max(w['music'] for w in ev['windows'])<.1,f'{id} possible music needs replacement'
 a=norm(load(src)[round(start*SR):round((start+length)*SR)],db);add(a,dest,fade)
 records.append(dict(id=id,source=str(src),source_in=start,duration=length,timeline=dest,rms_target=db))
add(load(P/'PV-H3-20261115-v2.6/edit/V01-sound.wav'),0,0)
memory=load(P/'PV-H3-20261115-v2.3/edit/V02-sound.wav','highpass=f=80,lowpass=f=5500,aecho=0.95:0.95:42|86:0.08|0.03')
memory=.8*memory+.2*np.mean(memory,axis=1,keepdims=True);add(memory,4.75,.015)
clip('H21',.25,2.75,-31,4.75)
clip('H22',0,59/24,-31,7.5)
clip('H23',.5,17/24,-25,371/24)
clip('H22',3.75,1.25,-29,388/24)
# F21 native contains a high music classification (.8154), exclude it completely.
# Existing clean camp fire and clean burning-canvas sound provide spatially matching fire.
fire=norm(load(P/'PV-H3-20261115-v2.2/B01/source.mp4'),-27)
add(fire[:4*SR],418/24)
clip('S21',1,1.5,-24,514/24)
add(norm(fire[SR:round(2.5*SR)],-36),514/24)
clip('F22',.75,3,-27,550/24)
add(fire[2*SR:4*SR],622/24)
# Match-cut fire tail lasts0.45seconds into extinguished camp, with no musical pad.
tail=fire[4*SR:round(4.45*SR)].copy();tail*=np.linspace(1,0,len(tail))[:,None];add(tail,670/24,.01)
clip('A24',0,4,-30,670/24,.12)
water=norm(load(P/'PV-H3-20261115-v2.3/R04RR/source.mp4')[2*SR:round(4.5*SR)],-31);add(water,766/24,.08)
oldwide=P/'PV-H3-20261116-v2.8/Y01/source.mp4'
add(norm(load(oldwide)[3*SR:8*SR],-32),826/24,.15)
records.append(dict(id='Y01_previous',source=str(oldwide),source_in=3,duration=5,timeline=826/24,note='Previously screened empty camp wide shot; no new people or dialogue'))
wind=norm(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav')[:round((dur-670/24)*SR)],-38);add(wind,670/24,.3)
t=np.arange(len(out))/SR;out*=np.clip((dur-t)/.8,0,1)[:,None]
subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(R/'sound/full-location-mix.wav')],input=out.astype('<f4').tobytes(),check=True)
(R/'sound/provenance.json').write_text(json.dumps(dict(added_bgm=False,new_dialogue=False,excluded_native_audio={'F21':'music classifier .8154; completely excluded'},memory='Existing Pang voice timing and short reflection preserved',native_clip_records=records,fire_replacement='v2.2 B01 clean location fire',match_cut='0.45second fire tail into quiet wet camp',human_listening='not claimed',user_review='待review'),ensure_ascii=False,indent=2),'utf-8')
print('Sound ready')
