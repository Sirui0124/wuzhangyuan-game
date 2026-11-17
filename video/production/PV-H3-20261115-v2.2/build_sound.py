from pathlib import Path
import subprocess,json
import numpy as np
from scipy.signal import butter,sosfilt,stft,istft
from scipy.ndimage import median_filter
R=Path(__file__).resolve().parent;S=R/'sound';S.mkdir(exist_ok=True);FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';SR=48000
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def save(p,a):subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(p)],input=a.astype('<f4').tobytes(),check=True)
def rms(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
rng=np.random.default_rng(20261115);n=SR*20;x=rng.normal(0,1,(n,2));x=sosfilt(butter(2,[75,1100],fs=SR,btype='bandpass',output='sos'),x,axis=0);x*= (.8+.15*np.sin(np.arange(n)/SR*.7))[:,None];w=rms(x,-39);save(S/'camp-wind.wav',w)
if (R/'M02/ambience-separated.wav').exists():
 raw=load(R/'M02/source.mp4');bed=load(R/'M02/ambience-separated.wav');n=min(len(raw),len(bed));v=raw[:n]-bed[:n];save(R/'M02/voice-breath-only.wav',v);save(R/'M02/no-music-mix.wav',v+w[:n])
# Isolate non-tonal wood impact; discard any sustained musical bed from B03.
if (R/'B03/source.mp4').exists():
 a=load(R/'B03/source.mp4');out=[]
 for ch in a.T:
  _,_,z=stft(ch,SR,nperseg=1024,noverlap=768);mag=np.abs(z);h=median_filter(mag,size=(1,31));p=median_filter(mag,size=(31,1));mask=p*p/(p*p+h*h+1e-9);_,b=istft(z*mask,SR,nperseg=1024,noverlap=768);out.append(b[:len(ch)])
 per=np.stack(out,axis=1);t=np.arange(len(per))/SR;gate=np.clip((t-.65)/.15,0,1)*np.clip((2.6-t)/.3,0,1);per*=gate[:,None]
 fire=load(R/'B01/source.mp4');n=len(per);fire=np.tile(fire,(int(np.ceil(n/len(fire))),1))[:n];save(R/'B03/no-music-mix.wav',per+rms(fire,-32))
(S/'provenance.json').write_text(json.dumps({'M02':'original minus MDX nonvocal/music estimate; retained breathing + local non-tonal wind','B03':'percussive STFT mask and impact-time gate + B01 native fire; excludes sustained original bed','camp-wind':'locally synthesized filtered non-tonal scene wind','no_added_music':True,'human_listen_approval':False},ensure_ascii=False,indent=2),'utf-8')
print('Local music-free candidate stems built.')
