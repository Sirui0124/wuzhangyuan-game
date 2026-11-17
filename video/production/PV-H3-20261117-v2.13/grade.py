from pathlib import Path
import subprocess,json,hashlib
R=Path(__file__).resolve().parent;P=R.parent;T=R.parents[2]/'.local-tools/pv-h3';FF=str(T/'ffmpeg.exe');FP=str(T/'ffprobe.exe')
SRC=P/'PV-H3-20261117-v2.12/夷陵撤离-PV-v2.12-暮夜至凌晨.mp4';OUT=R/'夷陵撤离-PV-v2.13-夜行赴火.mp4'
enable='lt(n,239)+gte(n,371)*lt(n,418)'
vf=f"eq=gamma=0.72:brightness=-0.008:saturation=0.92:enable='{enable}',colorbalance=rs=-0.014:bs=0.018:bm=0.008:pl=1:enable='{enable}'"
def run(a):
 p=subprocess.run(list(map(str,a)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2500:])
 return p.stdout
run([FF,'-v','error','-y','-i',SRC,'-map','0:v:0','-map','0:a:0','-vf',vf,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',OUT])
run([FF,'-v','error','-i',OUT,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',OUT]));v=next(x for x in meta['streams'] if x['codec_type']=='video');assert int(v['nb_frames'])==946
def audiohash(p):return run([FF,'-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
assert audiohash(SRC)==audiohash(OUT)
checks=[]
for sec in [2,6,8.5,11,16,18]:
 for label,path in [('before',SRC),('after',OUT)]:
  dest=R/f'{label}-{sec}.jpg';run([FF,'-v','error','-y','-ss',sec,'-i',path,'-frames:v','1',dest])
record=dict(version='v2.13',file=str(OUT),source=str(SRC),source_sha256=hashlib.sha256(SRC.read_bytes()).hexdigest(),sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),duration=float(v['duration']),frames=int(v['nb_frames']),full_decode='pass',audio_stream_copy_hash=audiohash(OUT),audio_unchanged=True,filter=vf,graded_frames=[[0,238],[371,417]],unchanged_picture_frames=[[239,370],[418,945]],new_api_requests=0,user_review='待review',metadata=meta)
(R/'final-technical.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({k:record[k] for k in ['file','duration','frames','audio_unchanged']},ensure_ascii=False))
