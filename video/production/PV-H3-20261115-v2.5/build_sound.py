from pathlib import Path
import subprocess,json
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;S=R/'sound';SR=48000
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def save(p,a):subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
def rms(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
wind=rms(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav'),-33)
masu=load(R/'M04/source.mp4');masu=rms(masu,-30);n=min(len(wind),len(masu));save(S/'masu-location.wav',masu[:n]+wind[:n])
rain=load(P/'PV-H3-20261115-v2.1/sound/valley-rain.wav')[:7*SR]
water=rms(load(P/'PV-H3-20261115-v2.3/R04RR/source.mp4'),-34)
for dest,start,duration in [(1.5,0,.75),(4.5,2,2.5)]:
 seg=water[round(start*SR):round((start+duration)*SR)].copy();tt=np.arange(len(seg))/SR;env=np.minimum(np.clip(tt/.08,0,1),np.clip((duration-tt)/.1,0,1));seg*=env[:,None];i=round(dest*SR);rain[i:i+len(seg)]+=seg
save(S/'rain-sequence.wav',rain)
(S/'provenance.json').write_text(json.dumps({'added_bgm':False,'masu':'M04 native breath/cloth normalized to -30dB RMS, no ASR words, native music event score0.0035; same camp wind -33dB RMS','rain':'One continuous 7s recorded rain bed (existing v2.1 valley-rain.wav, public domain ジダネ Rain.ogg); synchronized R04RR wet charcoal details only at 1.5-2.25 and4.5-7; no R05 or R06 audio','rain_license':'https://commons.wikimedia.org/wiki/File:Rain.ogg','pang':'Approved continuous v2.3 voice, horse foley then B01 fire, details camp-edit-record.json','user_review':'待review','human_listening':'not claimed'},ensure_ascii=False,indent=2),'utf-8')
print('Sound prepared')
