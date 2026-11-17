from pathlib import Path
import subprocess,json
import numpy as np
R=Path(__file__).resolve().parent;S=R/'sound';SR=48000
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
def load(p):return np.frombuffer(subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar',str(SR),'-ac','2','pipe:1']),'<f4').reshape(-1,2).copy()
def rms(a,db):return a*(10**(db/20)/max(1e-9,float(np.sqrt(np.mean(a*a)))))
a=load(R/'M06/source.mp4');method='M06 native quiet breath and cloth'
if (R/'M06/ambience-separated.wav').exists():
 bed=load(R/'M06/ambience-separated.wav');n=min(len(a),len(bed));a=a[:n]-bed[:n];method+=' minus MDX nonvocal/music estimate'
a=a[:round(2.5*SR)];a=rms(a,-30);wind=rms(load(R.parent/'PV-H3-20261115-v2.2/sound/camp-wind.wav'),-33);n=min(len(a),len(wind));a=a[:n]+wind[:n]
subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(S/'masu-location.wav')],input=a.astype('<f4').tobytes(),check=True)
(S/'provenance.json').write_text(json.dumps({'added_bgm':False,'dialogue':'none in M06','native_processing':method,'ambience':'Same camp wind from v2.2 -33dB RMS','M04_used':False,'user_review':'待review','human_listening':'not claimed'},ensure_ascii=False,indent=2),'utf-8')
print('M06 sound ready')
