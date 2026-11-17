from pathlib import Path
import subprocess,numpy as np,json,imageio_ffmpeg as io
r=Path('video/production/PV-regrets-20261117-music-study');ff=io.get_ffmpeg_exe()
src=Path(r'C:\Users\zhousirui\Downloads\用户5806 - 止戈.mp3')
p=subprocess.run([ff,'-v','error','-i',str(src),'-vn','-ac','1','-ar','8000','-f','f32le','pipe:1'],capture_output=True,check=True)
a=np.frombuffer(p.stdout,dtype='<f4');duration=len(a)/8000
rms=[]
for i in range(0,len(a),40000):
 x=a[i:i+40000];rms.append({'start':i/8000,'rms_db':round(float(20*np.log10(np.sqrt(np.mean(x*x))+1e-9)),1)})
(r/'音量结构.json').write_text(json.dumps({'duration':duration,'five_second_rms':rms},ensure_ascii=False,indent=2),'utf8')
print(duration);print(rms)
