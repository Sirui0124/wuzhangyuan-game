from pathlib import Path
import subprocess,numpy as np,json,hashlib,shutil
r=Path.cwd();out=r/'video/production/PV-H3-20261117-v2.17-music';out.mkdir(exist_ok=True)
ff=str(r/'.local-tools/pv-h3/ffmpeg.exe');src=r/'video/current/yiling-opening-v2.16-20261117.mp4';music=Path(r'C:\Users\zhousirui\Downloads\用户5806 - Silence Before the Storm.mp3');dur=1820/24;sr=48000
cmd=[ff,'-v','error','-i',str(music),'-t',str(dur),'-vn','-af','highpass=f=45,equalizer=f=2500:t=q:w=0.7:g=-2','-f','f32le','-ac','2','-ar',str(sr),'pipe:1']
x=np.frombuffer(subprocess.run(cmd,capture_output=True,check=True).stdout,dtype=np.float32).reshape(-1,2).copy()
points=[(0,-60),(2,-16),(4,-23),(4.7,-26),(20.5,-26),(22.5,-10),(36.5,-10),(39.4,-18),(45.8,-18),(47.2,-27),(73.8,-27),(dur,-80)]
t=np.arange(len(x))/sr;gain=10**(np.interp(t,*zip(*points))/20);x*=gain[:,None]
raw=out/'music-envelope.f32';raw.write_bytes(x.astype(np.float32).tobytes())
film=out/'夷陵撤离与认印托付-PV-v2.17-配乐版.mp4'
subprocess.run([ff,'-v','error','-y','-i',str(src),'-f','f32le','-ar',str(sr),'-ac','2','-i',str(raw),'-filter_complex','[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false:latency=true[a]','-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-t',str(dur),'-movflags','+faststart',str(film)],check=True)
raw.unlink()
d={'version':'v2.17','authorization':'用户明确授权嵌入指定配乐并直接替换第四章PV','source_film':str(src),'music':str(music),'music_sha256':hashlib.sha256(music.read_bytes()).hexdigest(),'music_excerpt':[0,dur],'gain_points_db':points,'dialogue_environment_gain':1,'picture':'stream-copy unchanged','film':str(film),'sha256':hashlib.sha256(film.read_bytes()).hexdigest(),'status':'待review','verification_note':'声量包络和技术检查不等同人工听审'}
(out/'mix-record.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(film);print(d['sha256'])
