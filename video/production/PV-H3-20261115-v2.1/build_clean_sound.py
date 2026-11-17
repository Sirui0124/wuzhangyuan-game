from pathlib import Path
import json,subprocess
import numpy as np
from scipy.signal import butter,sosfilt
R=Path(__file__).resolve().parent;S=R/'sound';S.mkdir(exist_ok=True)
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';SR=48000
def load(p):
 raw=subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1'])
 return np.frombuffer(raw,'<f4').reshape(-1,2).copy()
def save(p,a):
 subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
def gain_rms(a,db):return a*(10**(db/20)/max(np.sqrt(np.mean(a*a)),1e-8))
def wind(n):
 rng=np.random.default_rng(137);x=rng.normal(0,1,(n,2))
 x=sosfilt(butter(2,[65,850],btype='bandpass',fs=SR,output='sos'),x,axis=0)
 env=.7+.17*np.sin(np.arange(n)/SR*1.3)+.08*np.sin(np.arange(n)/SR*3.1)
 return gain_rms(x*env[:,None],-38)
# Never retain the music-bearing H09 nonvocal stem. Preserve only the pre-word vocal residual.
raw=load(R/'H09/source.mp4');bed=load(R/'H09/ambience-separated.wav');n=min(len(raw),len(bed));v=raw[:n]-bed[:n]
t=np.arange(n)/SR;gate=np.clip((9.35-t)/.18,0,1);v*=gate[:,None]
cloth=load(R/'H16B/ambience-separated.wav');cloth=gain_rms(cloth,-42)
mix=v+wind(n)
at=int(7.7*SR);k=min(len(cloth),n-at);mix[at:at+k]+=cloth[:k]
save(R/'H09/no-music-mix.wav',mix)
# Continuous public-domain recorded rain across the valley and close reaction.
rain=load(S/'Rain-public-domain.ogg');rain=gain_rms(rain,-27)
save(S/'valley-rain.wav',rain)
records={'rain':{'source':'https://commons.wikimedia.org/wiki/File:Rain.ogg','download':'https://upload.wikimedia.org/wikipedia/commons/3/3d/Rain.ogg','author':'ジダネ','license':'Public domain / PD-self','changes':'resample, gain, segment selection; no music added'},'H09':{'music_bearing_original_bed':'excluded','retained':'original vocal residual before9.35s; no added dialogue','new_bed':'locally synthesized non-tonal wind; H16B separated cloth foley timed to fan movement','not_human_listen_approval':True}}
(S/'provenance.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),'utf-8')
print('Built continuous rain and music-free candidate for shared scene; needs event screening.')
