from pathlib import Path
import subprocess,json
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;SR=48000
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def norm(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
t=np.arange(4*SR)/SR
rain=norm(load(P/'PV-H3-20261115-v2.1/sound/valley-rain.wav')[:4*SR],-29)
rain*=np.clip(t/.15,.15,1)[:,None]
fire=load(P/'PV-H3-20261115-v2.2/B01/source.mp4')[round(68/24*SR):round((68/24+1.5)*SR)]*10**(5/20)
fire*=np.clip(1-np.arange(len(fire))/SR/1.5,0,1)[:,None];rain[:len(fire)]+=fire
water=norm(load(P/'PV-H3-20261115-v2.3/R04RR/source.mp4')[2*SR:round(4.5*SR)],-34)
env=np.minimum(np.clip(np.arange(len(water))/SR/.1,0,1),np.clip((len(water)/SR-np.arange(len(water))/SR)/.1,0,1));rain[round(1.5*SR):]+=water*env[:,None]
rain*=np.clip((4-t)/.6,0,1)[:,None]
subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(R/'sound/fire-to-aftermath.wav')],input=rain.astype('<f4').tobytes(),check=True)
(R/'sound/provenance.json').write_text(json.dumps(dict(added_bgm=False,new_dialogue=False,preserved='V01/V02 picture and PCM copied byte-identically from v2.6',transition='B01 fire continues from source68/24s and recedes over1.5s; continuous recorded rain -29dB RMS under fire and aftermath; R04RR source2-4.5 synchronized to aftermath; final0.6s sound fade',rain_source='Existing v2.1/valley-rain.wav; ジダネ Rain.ogg public domain PD-self',rain_license='https://commons.wikimedia.org/wiki/File:Rain.ogg',new_api_submissions=0,user_review='待review',human_listening='not claimed'),ensure_ascii=False,indent=2),'utf-8')
print('Four-second fire-to-aftermath sound ready')
