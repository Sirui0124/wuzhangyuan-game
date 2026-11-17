from pathlib import Path
import json,subprocess,concurrent.futures
R=Path(__file__).resolve().parent;FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
ss=json.loads((R/'final-edit.json').read_text('utf-8'))['shots']
def work(s):
 if s['id'].startswith('A21'):return
 dest=R/'edit'/(s['id']+'-picture.mp4');dur=s['duration']
 vf=s.get('pre_crop','')+'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,setpts=PTS-STARTPTS,fps=24'
 subprocess.run([FF,'-v','error','-y','-ss',str(s.get('in',0)),'-i',s['source'],'-an','-vf',vf,'-t',str(dur),'-frames:v',str(round(dur*24)),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(dest)],check=True,capture_output=True,timeout=180)
 print(s['id']+' picture ready',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as p:list(p.map(work,ss))
