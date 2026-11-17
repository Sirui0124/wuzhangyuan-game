from pathlib import Path
import subprocess,json,hashlib
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;FF=io.get_ffmpeg_exe()
def run(args):
 p=subprocess.run([FF,'-y','-hide_banner',*map(str,args)],capture_output=True,timeout=300)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2000:])
 return p
for id in ['A01R','C01K','C01K2']:
 d=R/id;src=d/'source.mp4'
 if not src.exists():continue
 result=run(['-v','error','-i',src,'-progress','pipe:1','-f','null','-'])
 reader=io.read_frames(str(src));meta=next(reader);reader.close()
 (d/'technical.json').write_text(json.dumps(dict(metadata=meta,full_decode='pass',progress=result.stdout.decode(),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),user_review='待review'),ensure_ascii=False,indent=2),'utf-8')
 run(['-v','error','-i',src,'-vf','fps=2,scale=400:225,tile=4x4','-frames:v','1','-update','1',d/'contact.jpg'])
 run(['-v','error','-i',src,'-vn','-c:a','pcm_s16le',d/'native.wav'])
 print(id,meta,flush=True)
