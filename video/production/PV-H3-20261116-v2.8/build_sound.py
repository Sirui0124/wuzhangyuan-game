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
duration=946/24;out=np.zeros((round(duration*SR),2),np.float32)
def add(a,dest,fade=.035):
 a=a.copy();n=len(a);tt=np.arange(n)/SR
 if fade:a*=np.minimum(np.clip(tt/fade,0,1),np.clip((n/SR-tt)/fade,0,1))[:,None]
 i=round(dest*SR);n=min(n,len(out)-i);out[i:i+n]+=a[:n]
add(load(P/'PV-H3-20261115-v2.6/edit/V01-sound.wav'),0,0)
# Approved existing words and 1.3x pace; only a restrained short reflection and soft high-frequency rolloff.
memory=load(P/'PV-H3-20261115-v2.3/edit/V02-sound.wav','highpass=f=80,lowpass=f=5500,aecho=0.95:0.95:42|86:0.08|0.03')
mid=np.mean(memory,axis=1,keepdims=True);memory=.8*memory+.2*mid
add(memory,4.75,.015)
horse=load(P/'PV-H3-20261115-v2.1/H10/source.mp4',f'atrim=duration=2.5,atempo={2.5/(47/24)},apad,atrim=duration={47/24}')
add(norm(horse,-29),371/24)
flag=load(P/'PV-H3-20261115-v2.6/edit/V09-sound.wav')[:3*SR];flag=norm(flag,-28);ft=np.arange(len(flag))/SR;flag*=10**((np.clip((ft-2.2)/.6,0,1)*2)/20)[:,None];add(flag,418/24)
camp=norm(load(P/'PV-H3-20261115-v2.2/B01/source.mp4')[:5*SR],-26);add(camp,490/24)
# A short rain prelap joins the fire stage to the wet ruined camp, with no musical pad.
rain=load(P/'PV-H3-20261115-v2.1/sound/valley-rain.wav');rain=np.tile(rain,(2,1));rain=norm(rain,-29)
rain_start=610/24-.25;length=round((duration-rain_start)*SR);rain=rain[:length];tt=np.arange(len(rain))/SR
gain=1-.78*np.clip((tt-6)/2,0,1);gain*=np.clip(tt/.35,0,1);rain*=gain[:,None];add(rain,rain_start,.12)
water=norm(load(P/'PV-H3-20261115-v2.3/R04RR/source.mp4')[2*SR:round(4.5*SR)],-34);add(water,694/24)
wind=norm(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav')[:8*SR],-34);add(wind,754/24,.3)
events=json.loads((R/'Y01/audio-events-unverified.json').read_text('utf-8'));asr=json.loads((R/'Y01/audio-small-unverified.json').read_text('utf-8'))
native_used=not asr['segments'] and max(w['music'] for w in events['windows'])<.1
if native_used:add(norm(load(R/'Y01/source.mp4')[:8*SR],-34),754/24,.2)
t=np.arange(len(out))/SR;out*=np.clip((duration-t)/.8,0,1)[:,None]
subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(R/'sound/full-location-mix.wav')],input=out.astype('<f4').tobytes(),check=True)
(R/'sound/provenance.json').write_text(json.dumps(dict(added_bgm=False,new_dialogue=False,memory='Existing v2.3 Pang dialogue timing preserved at approx1.3x; 5.5kHz soft rolloff and42/86ms reflections at8%/3%, modest stereo narrowing, no long echo or pitch change',return_to_present='15.458s sharp matching hoof foley;17.416s fire enters under remembered final clause',fire='same flag source3s then B01 native5s; dialogue duck kept',rain='existing public-domain ジダネ Rain.ogg, continuous prelap, quieter into aftermath',rain_license='https://commons.wikimedia.org/wiki/File:Rain.ogg',aftermath_native_used=native_used,user_review='待review',human_listening='not claimed'),ensure_ascii=False,indent=2),'utf-8')
print('Sound ready; native aftermath used:',native_used)
