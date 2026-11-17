from pathlib import Path
import subprocess,json
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.2';S=R/'sound';SR=48000
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def save(p,a):subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
def rms(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
wind=rms(load(P/'sound/camp-wind.wav'),-31)
cloth=load(R/'G21_audio/ambience-separated.wav');n=min(len(wind),len(cloth));cloth=rms(cloth[:n],-36);save(S/'zhuge-continuous-foley.wav',wind[:n]+cloth)
tail=np.zeros((SR*4,2));breath=load(P/'K03/source.mp4')[3*SR:4*SR]*10**(10/20);tail[:len(breath)]+=breath
fire=load(P/'B01/source.mp4');fire=rms(fire[:SR*4],-43);n=min(len(fire),len(tail));tail[:n]+=fire[:n]
t=np.arange(len(tail))/SR;fade=np.clip((1.75-t)/.65,0,1);tail*=fade[:,None];save(S/'ending-breath-tail.wav',tail)
if (R/'M03/source.mp4').exists():
 a=load(R/'M03/source.mp4');bed=load(R/'M03/ambience-separated.wav');n=min(len(a),len(bed),len(wind));a=a[:n]-bed[:n];gain=min(10,10**(-31/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))),10**(-6/20)/max(1e-9,float(np.max(np.abs(a)))));save(S/'masu-breath-ambience.wav',a*gain+wind[:n]*.7)
(S/'provenance.json').write_text(json.dumps({'no_added_bgm':True,'camp':'v2.2 nonmelodic wind brought to -31dB RMS','zhuge':'G21 native voice removed using MDX; synchronous fan/cloth residual with continuous wind','masu':'M03 minus MDX music/nonvocal estimate, retained breath with bounded gain and continuous wind; native music bed rejected','ending':'K03 actual later breath extends over black/title; weak same-camp fire fades before title hold','human_listening':'not claimed'},ensure_ascii=False,indent=2),'utf-8')
print('Sound stems built')
if (R/'R04RR/source.mp4').exists():
 rain=load(R.parent/'PV-H3-20261115-v2.1/sound/valley-rain.wav')[:int(SR*6.25)]
 water=load(R/'R04RR/source.mp4');water=rms(water,-34)
 for dest,start,duration in [(1.5,0,.75),(3.75,2,2.5)]:
  seg=water[int(start*SR):int((start+duration)*SR)].copy();tt=np.arange(len(seg))/SR;env=np.minimum(np.clip(tt/.08,0,1),np.clip((duration-tt)/.1,0,1));seg*=env[:,None];i=int(dest*SR);rain[i:i+len(seg)]+=seg
 save(S/'rain-sequence.wav',rain)
